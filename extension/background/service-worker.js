/**
 * Playwright Recorder - Background Service Worker (Manifest V3)
 * Manages recording state, badge updates, storage persistence, and file download triggers.
 */

importScripts('../utils/code-generator.js');

// Initialize storage defaults on install
chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(['isRecording', 'actions', 'moduleType', 'testName']);
  if (current.isRecording === undefined) {
    await chrome.storage.local.set({
      isRecording: false,
      isPaused: false,
      actions: [],
      moduleType: 'esm',
      testName: 'teste gravado'
    });
  }
});

// Update badge display based on recording state
async function updateBadge(isRecording, count = 0) {
  try {
    if (!chrome.action) return;

    if (isRecording) {
      await chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
      await chrome.action.setBadgeText({ text: count > 0 ? String(count) : 'REC' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch (err) {
    console.error('Erro ao atualizar badge:', err);
  }
}

// Ensure content script is injected into tab
async function ensureContentScriptInjected(tabId) {
  try {
    // Send a ping message first to see if it responds
    const response = await chrome.tabs.sendMessage(tabId, { action: 'PING' }).catch(() => null);
    if (!response) {
      // Content script not yet present, inject it
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/locator-generator.js', 'content/content.js']
      });
    }
  } catch (err) {
    // Some tabs (e.g., chrome://, edge://, about:blank) cannot have scripts injected
    console.warn(`Não foi possível injetar content script na aba ${tabId}:`, err.message);
  }
}

// Download script helper
async function downloadRecordedScript() {
  const data = await chrome.storage.local.get(['actions', 'moduleType', 'testName']);
  const actions = data.actions || [];
  const moduleType = data.moduleType || 'esm';
  const testName = data.testName || 'teste gravado';

  const scriptContent = self.PlaywrightCodeGenerator.generateFullTestScript(actions, {
    moduleType,
    testName,
    includeComments: true
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `playwright-test-${timestamp}.spec.js`;

  const base64Content = btoa(unescape(encodeURIComponent(scriptContent)));
  const dataUrl = `data:text/javascript;charset=utf-8;base64,${base64Content}`;

  await chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: true
  });
}

// Replay state tracking
let isReplayAborted = false;

function waitForTabLoad(tabId, timeoutMs = 20000) {
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(false);
      }
    }, timeoutMs);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve(true);
        }
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function runReplay(speedMs = 800) {
  isReplayAborted = false;

  const data = await chrome.storage.local.get(['actions']);
  const actions = data.actions || [];

  if (actions.length === 0) {
    return { success: false, error: 'Nenhuma ação registrada para executar.' };
  }

  // Set replaying state
  await chrome.storage.local.set({
    isReplaying: true,
    replayCurrent: 0,
    replayTotal: actions.length,
    replayStatus: 'executing',
    replayError: null
  });

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || !activeTab.id) {
    await chrome.storage.local.set({
      isReplaying: false,
      replayStatus: 'error',
      replayError: 'Nenhuma aba ativa encontrada.'
    });
    return { success: false, error: 'Aba ativa não encontrada' };
  }

  try {
    for (let i = 0; i < actions.length; i++) {
      if (isReplayAborted) {
        await chrome.storage.local.set({
          isReplaying: false,
          replayStatus: 'stopped'
        });
        return { success: false, message: 'Execução interrompida pelo usuário.' };
      }

      const action = actions[i];
      await chrome.storage.local.set({
        replayCurrent: i + 1,
        replayDescription: action.description || action.type
      });

      if (action.type === 'goto') {
        const curTab = await chrome.tabs.get(activeTab.id);
        if (curTab.url !== action.url) {
          await chrome.tabs.update(activeTab.id, { url: action.url });
          await waitForTabLoad(activeTab.id);
          await new Promise(r => setTimeout(r, 600)); // hydration pause
          await ensureContentScriptInjected(activeTab.id);
        }
      } else {
        await ensureContentScriptInjected(activeTab.id);

        const response = await chrome.tabs.sendMessage(activeTab.id, {
          action: 'EXECUTE_STEP',
          step: action,
          stepIndex: i + 1,
          totalSteps: actions.length
        }).catch(err => ({ success: false, error: err.message }));

        if (response && response.error) {
          await chrome.storage.local.set({
            isReplaying: false,
            replayStatus: 'error',
            replayError: `Erro no passo ${i + 1}: ${response.error}`
          });
          return { success: false, error: response.error };
        }
      }

      // Delay between steps for visual inspection
      await new Promise(r => setTimeout(r, speedMs));
    }

    await chrome.storage.local.set({
      isReplaying: false,
      replayStatus: 'completed',
      replayCurrent: actions.length
    });

    return { success: true };
  } catch (err) {
    await chrome.storage.local.set({
      isReplaying: false,
      replayStatus: 'error',
      replayError: err.message
    });
    return { success: false, error: err.message };
  }
}

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.action) {
        case 'START_RECORDING': {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          const initialActions = [];

          if (activeTab && activeTab.url && !activeTab.url.startsWith('chrome://')) {
            initialActions.push({
              type: 'goto',
              url: activeTab.url,
              description: `Navegar para ${activeTab.url}`,
              timestamp: Date.now()
            });
            await ensureContentScriptInjected(activeTab.id);
          }

          await chrome.storage.local.set({
            isRecording: true,
            isPaused: false,
            actions: initialActions
          });

          await updateBadge(true, initialActions.length);
          sendResponse({ success: true, count: initialActions.length });
          break;
        }

        case 'STOP_RECORDING': {
          await chrome.storage.local.set({
            isRecording: false,
            isPaused: false
          });
          await updateBadge(false);
          sendResponse({ success: true });
          break;
        }

        case 'RECORD_ACTION': {
          const { isRecording, isPaused, actions = [] } = await chrome.storage.local.get([
            'isRecording',
            'isPaused',
            'actions'
          ]);

          if (!isRecording || isPaused) {
            sendResponse({ ignored: true });
            return;
          }

          const newActions = [...actions, message.data];
          await chrome.storage.local.set({ actions: newActions });
          await updateBadge(true, newActions.length);
          sendResponse({ success: true, count: newActions.length });
          break;
        }

        case 'TRIGGER_DOWNLOAD': {
          await downloadRecordedScript();
          sendResponse({ success: true });
          break;
        }

        case 'CLEAR_RECORDING': {
          await chrome.storage.local.set({ actions: [] });
          const { isRecording } = await chrome.storage.local.get('isRecording');
          await updateBadge(isRecording, 0);
          sendResponse({ success: true });
          break;
        }

        case 'START_REPLAY': {
          runReplay(message.speedMs || 800);
          sendResponse({ success: true });
          break;
        }

        case 'STOP_REPLAY': {
          isReplayAborted = true;
          await chrome.storage.local.set({ isReplaying: false, replayStatus: 'stopped' });
          sendResponse({ success: true });
          break;
        }

        default:
          sendResponse({ error: 'Ação desconhecida' });
      }
    } catch (err) {
      console.error('Erro ao processar mensagem no service worker:', err);
      sendResponse({ error: err.message });
    }
  })();

  return true; // Keep message channel open for async response
});
