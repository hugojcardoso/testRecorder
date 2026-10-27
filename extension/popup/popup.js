/**
 * Playwright Recorder - Popup Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnStop = document.getElementById('btn-stop');
  const btnReplay = document.getElementById('btn-replay');
  const replayBtnText = document.getElementById('replay-btn-text');
  const btnDownload = document.getElementById('btn-download');
  const btnCopy = document.getElementById('btn-copy');
  const btnClear = document.getElementById('btn-clear');

  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const actionCount = document.getElementById('action-count');
  const codeOutput = document.getElementById('code-output');

  const inputTestName = document.getElementById('input-test-name');
  const selectModuleType = document.getElementById('select-module-type');
  const selectReplaySpeed = document.getElementById('select-replay-speed');

  const replayProgressCard = document.getElementById('replay-progress-card');
  const replayStepCounter = document.getElementById('replay-step-counter');
  const replayCurrentDesc = document.getElementById('replay-current-desc');
  const replayProgressBar = document.getElementById('replay-progress-bar');
  const toast = document.getElementById('toast');

  let currentActions = [];
  let currentRecording = false;
  let currentPaused = false;
  let isReplaying = false;
  let toastTimer = null;

  // Show temporary toast message
  function showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.remove('hidden');
    toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2500);
  }

  // Update UI state and code preview
  function refreshUI(state = {}) {
    // 1. Status Indicator
    if (isReplaying) {
      statusDot.className = 'status-dot recording';
      statusText.textContent = 'Executando';
      btnStart.disabled = true;
      btnPause.disabled = true;
      btnStop.disabled = true;
      btnReplay.disabled = false;
      btnReplay.className = 'btn btn-replay running';
      replayBtnText.textContent = 'Parar Execução';
    } else if (currentRecording) {
      if (currentPaused) {
        statusDot.className = 'status-dot paused';
        statusText.textContent = 'Pausado';
        btnPause.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <span>Retomar</span>
        `;
      } else {
        statusDot.className = 'status-dot recording';
        statusText.textContent = 'Gravando';
        btnPause.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1"/>
            <rect x="14" y="4" width="4" height="16" rx="1"/>
          </svg>
          <span>Pausar</span>
        `;
      }
      btnStart.disabled = true;
      btnPause.disabled = false;
      btnStop.disabled = false;
      btnReplay.disabled = true;
      btnReplay.className = 'btn btn-replay';
      replayBtnText.textContent = 'Executar Gravação';
    } else {
      statusDot.className = 'status-dot';
      statusText.textContent = 'Pronto';
      btnStart.disabled = false;
      btnPause.disabled = true;
      btnStop.disabled = true;
      btnReplay.disabled = currentActions.length === 0;
      btnReplay.className = 'btn btn-replay';
      replayBtnText.textContent = 'Executar Gravação';
      btnPause.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1"/>
          <rect x="14" y="4" width="4" height="16" rx="1"/>
        </svg>
        <span>Pausar</span>
      `;
    }

    // 2. Action count & download enable
    actionCount.textContent = String(currentActions.length);
    btnDownload.disabled = currentActions.length === 0;

    // 3. Replay Progress Card
    if (isReplaying) {
      replayProgressCard.classList.remove('hidden');
      const cur = state.replayCurrent || 0;
      const tot = state.replayTotal || currentActions.length || 1;
      replayStepCounter.textContent = `Passo ${cur}/${tot}`;
      replayCurrentDesc.textContent = state.replayDescription || 'Executando interação...';
      const pct = Math.min(100, Math.round((cur / tot) * 100));
      replayProgressBar.style.width = `${pct}%`;
    } else {
      replayProgressCard.classList.add('hidden');
    }

    // 4. Generate and display Playwright code
    const generatedScript = window.PlaywrightCodeGenerator.generateFullTestScript(currentActions, {
      moduleType: selectModuleType.value,
      testName: inputTestName.value.trim() || 'teste gravado',
      includeComments: true
    });

    codeOutput.textContent = generatedScript;
  }

  // Load initial state
  const state = await chrome.storage.local.get([
    'isRecording',
    'isPaused',
    'actions',
    'moduleType',
    'testName',
    'isReplaying',
    'replayCurrent',
    'replayTotal',
    'replayDescription'
  ]);

  currentRecording = !!state.isRecording;
  currentPaused = !!state.isPaused;
  isReplaying = !!state.isReplaying;
  currentActions = state.actions || [];

  if (state.moduleType) selectModuleType.value = state.moduleType;
  if (state.testName) inputTestName.value = state.testName;

  refreshUI(state);

  // Listen for storage changes from background or content script
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    if (changes.isRecording !== undefined) {
      currentRecording = changes.isRecording.newValue;
    }
    if (changes.isPaused !== undefined) {
      currentPaused = changes.isPaused.newValue;
    }
    if (changes.actions !== undefined) {
      currentActions = changes.actions.newValue || [];
    }
    if (changes.moduleType !== undefined) {
      selectModuleType.value = changes.moduleType.newValue;
    }
    if (changes.testName !== undefined) {
      inputTestName.value = changes.testName.newValue;
    }

    if (changes.isReplaying !== undefined) {
      isReplaying = changes.isReplaying.newValue;
    }

    const currentState = {
      replayCurrent: changes.replayCurrent ? changes.replayCurrent.newValue : state.replayCurrent,
      replayTotal: changes.replayTotal ? changes.replayTotal.newValue : state.replayTotal,
      replayDescription: changes.replayDescription ? changes.replayDescription.newValue : state.replayDescription
    };

    if (changes.replayStatus !== undefined) {
      if (changes.replayStatus.newValue === 'completed') {
        showToast('✅ Gravação executada com sucesso!');
      } else if (changes.replayStatus.newValue === 'error') {
        showToast('❌ Erro na execução da gravação.');
      } else if (changes.replayStatus.newValue === 'stopped') {
        showToast('⏹ Execução interrompida.');
      }
    }

    refreshUI(currentState);
  });

  // Action: Iniciar Gravação
  btnStart.addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'START_RECORDING' });
      if (response && response.success) {
        showToast('Gravação iniciada!');
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao iniciar gravação.');
    }
  });

  // Action: Pausar / Retomar Gravação
  btnPause.addEventListener('click', async () => {
    const nextPaused = !currentPaused;
    await chrome.storage.local.set({ isPaused: nextPaused });
    showToast(nextPaused ? 'Gravação pausada' : 'Gravação retomada');
  });

  // Action: Parar Gravação
  btnStop.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'STOP_RECORDING' });
      showToast('Gravação finalizada!');
    } catch (err) {
      console.error(err);
    }
  });

  // Action: Executar Gravação (Replay)
  btnReplay.addEventListener('click', async () => {
    if (isReplaying) {
      await chrome.runtime.sendMessage({ action: 'STOP_REPLAY' });
    } else {
      if (currentActions.length === 0) {
        showToast('Grave algumas ações primeiro para executar.');
        return;
      }
      const speedMs = parseInt(selectReplaySpeed.value, 10) || 800;
      await chrome.runtime.sendMessage({ action: 'START_REPLAY', speedMs });
      showToast('Iniciando execução no navegador...');
    }
  });

  // Action: Baixar Gravação (.js)
  btnDownload.addEventListener('click', () => {
    if (currentActions.length === 0) {
      showToast('Nenhuma ação gravada para baixar.');
      return;
    }

    const scriptContent = window.PlaywrightCodeGenerator.generateFullTestScript(currentActions, {
      moduleType: selectModuleType.value,
      testName: inputTestName.value.trim() || 'teste gravado',
      includeComments: true
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const sanitizedTestName = (inputTestName.value.trim() || 'teste')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 30);
    const filename = `${sanitizedTestName}-${timestamp}.spec.js`;

    // Download via Blob link
    const blob = new Blob([scriptContent], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Arquivo "${filename}" baixado com sucesso!`);
  });

  // Action: Copiar Código
  btnCopy.addEventListener('click', async () => {
    const scriptContent = codeOutput.textContent;
    try {
      await navigator.clipboard.writeText(scriptContent);
      showToast('Código copiado para a área de transferência!');
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = scriptContent;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('Código copiado!');
    }
  });

  // Action: Limpar Gravação
  btnClear.addEventListener('click', async () => {
    if (currentActions.length === 0) return;
    if (confirm('Deseja realmente limpar todas as ações gravadas?')) {
      await chrome.runtime.sendMessage({ action: 'CLEAR_RECORDING' });
      showToast('Ações limpas com sucesso');
    }
  });

  // Settings: Alterar nome do teste
  inputTestName.addEventListener('input', () => {
    chrome.storage.local.set({ testName: inputTestName.value });
    refreshUI();
  });

  // Settings: Alterar tipo de módulo (ESM / CommonJS)
  selectModuleType.addEventListener('change', () => {
    chrome.storage.local.set({ moduleType: selectModuleType.value });
    refreshUI();
  });
});
