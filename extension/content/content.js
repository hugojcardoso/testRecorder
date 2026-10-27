/**
 * Playwright Recorder - Content Script
 * Captures user interactions and renders a non-intrusive floating control widget.
 */

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__PLAYWRIGHT_RECORDER_INJECTED__) return;
  window.__PLAYWRIGHT_RECORDER_INJECTED__ = true;

  let isRecording = false;
  let isPaused = false;
  let pendingInputTimeout = null;
  let pendingInputElement = null;
  let lastActionTimestamp = 0;
  let overlayRoot = null;
  let overlayShadow = null;

  // Initialize from storage
  chrome.storage.local.get(['isRecording', 'isPaused', 'actions'], (res) => {
    isRecording = !!res.isRecording;
    isPaused = !!res.isPaused;
    if (isRecording) {
      attachEventListeners();
      renderFloatingWidget(res.actions ? res.actions.length : 0);
    }
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    if (changes.isRecording !== undefined) {
      isRecording = changes.isRecording.newValue;
      if (isRecording) {
        attachEventListeners();
        chrome.storage.local.get(['actions'], (res) => {
          renderFloatingWidget(res.actions ? res.actions.length : 0);
        });
      } else {
        flushPendingInput();
        detachEventListeners();
        removeFloatingWidget();
      }
    }

    if (changes.isPaused !== undefined) {
      isPaused = changes.isPaused.newValue;
      updateWidgetStatus();
    }

    if (changes.actions !== undefined && isRecording) {
      const actions = changes.actions.newValue || [];
      updateWidgetCount(actions.length);
    }
  });

  // Listen for runtime messages
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'PING') {
      sendResponse({ status: 'OK', isRecording, isPaused });
    } else if (msg.action === 'EXECUTE_STEP') {
      executeStep(msg.step, msg.stepIndex, msg.totalSteps)
        .then((res) => sendResponse(res))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true; // Keep channel open for async response
    }
    return true;
  });

  /* ----------------------------------------------------
   * EVENT LISTENERS ATTACH / DETACH
   * ---------------------------------------------------- */
  function attachEventListeners() {
    window.addEventListener('click', handleClick, true);
    window.addEventListener('dblclick', handleDblClick, true);
    window.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('input', handleInput, true);
    window.addEventListener('change', handleChange, true);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('popstate', handleNavigation, true);
    window.addEventListener('hashchange', handleNavigation, true);

    // Observe SPA URL updates
    hookHistoryMethods();
  }

  function detachEventListeners() {
    window.removeEventListener('click', handleClick, true);
    window.removeEventListener('dblclick', handleDblClick, true);
    window.removeEventListener('contextmenu', handleContextMenu, true);
    window.removeEventListener('input', handleInput, true);
    window.removeEventListener('change', handleChange, true);
    window.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('popstate', handleNavigation, true);
    window.removeEventListener('hashchange', handleNavigation, true);
  }

  function isWidgetEvent(event) {
    if (!overlayRoot) return false;
    const path = event.composedPath ? event.composedPath() : [];
    return path.includes(overlayRoot) || path.includes(overlayShadow);
  }

  /* ----------------------------------------------------
   * DISPATCH RECORDED ACTION
   * ---------------------------------------------------- */
  function recordAction(action) {
    if (!isRecording || isPaused) return;

    action.url = window.location.href;
    action.timestamp = Date.now();
    lastActionTimestamp = action.timestamp;

    chrome.runtime.sendMessage({
      action: 'RECORD_ACTION',
      data: action
    });
  }

  /* ----------------------------------------------------
   * INPUT HANDLING & DEBOUNCING
   * ---------------------------------------------------- */
  function flushPendingInput() {
    if (pendingInputTimeout) {
      clearTimeout(pendingInputTimeout);
      pendingInputTimeout = null;
    }

    if (pendingInputElement) {
      const el = pendingInputElement;
      pendingInputElement = null;

      const locator = window.PlaywrightLocatorGenerator.generatePlaywrightLocator(el);
      const val = el.value !== undefined ? el.value : el.innerText;

      recordAction({
        type: 'fill',
        locatorCode: locator.locatorCode,
        targetInfo: locator.targetInfo,
        value: val,
        description: `Preencher ${locator.description} com "${val.length > 20 ? val.substring(0, 20) + '...' : val}"`
      });
    }
  }

  function handleInput(e) {
    if (!isRecording || isPaused || isWidgetEvent(e)) return;
    const target = e.target;
    if (!target) return;

    // Check if target is editable
    const isTextInput = (target.tagName === 'INPUT' && !['button', 'submit', 'checkbox', 'radio', 'file', 'image'].includes(target.type)) ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;

    if (!isTextInput) return;

    // If typing switched to a different element, flush previous immediately
    if (pendingInputElement && pendingInputElement !== target) {
      flushPendingInput();
    }

    pendingInputElement = target;

    if (pendingInputTimeout) {
      clearTimeout(pendingInputTimeout);
    }

    // Debounce 600ms
    pendingInputTimeout = setTimeout(() => {
      flushPendingInput();
    }, 600);
  }

  /* ----------------------------------------------------
   * CLICK HANDLING
   * ---------------------------------------------------- */
  function handleClick(e) {
    if (!isRecording || isPaused || isWidgetEvent(e)) return;

    const rawTarget = e.target;
    if (!rawTarget) return;

    // Find interactive target or closest meaningful container
    const interactiveTarget = rawTarget.closest(
      'button, a, input, select, textarea, [role="button"], [role="link"], summary, [role="menuitem"], [role="tab"]'
    ) || rawTarget;

    // If user clicked inside an input/textarea, do NOT record click
    // because Playwright .fill() automatically focuses and clicks!
    const isTextField = (interactiveTarget.tagName === 'INPUT' && !['button', 'submit', 'reset', 'checkbox', 'radio'].includes(interactiveTarget.type)) ||
      interactiveTarget.tagName === 'TEXTAREA';

    if (isTextField) {
      // Just let handleInput / handleChange record the fill action
      return;
    }

    // Checkboxes and radios are handled by handleChange
    if (interactiveTarget.tagName === 'INPUT' && ['checkbox', 'radio'].includes(interactiveTarget.type)) {
      return;
    }

    // Select dropdowns are handled by handleChange
    if (interactiveTarget.tagName === 'SELECT') {
      return;
    }

    // Flush any pending text before registering click
    flushPendingInput();

    // Prevent duplicate rapid click events (within 100ms on same target)
    if (Date.now() - lastActionTimestamp < 100) return;

    const locator = window.PlaywrightLocatorGenerator.generatePlaywrightLocator(interactiveTarget);
    recordAction({
      type: 'click',
      locatorCode: locator.locatorCode,
      targetInfo: locator.targetInfo,
      description: `Clicar em ${locator.description}`
    });
  }

  function handleDblClick(e) {
    if (!isRecording || isPaused || isWidgetEvent(e)) return;
    flushPendingInput();

    const target = e.target.closest('button, a, [role="button"]') || e.target;
    const locator = window.PlaywrightLocatorGenerator.generatePlaywrightLocator(target);

    recordAction({
      type: 'dblclick',
      locatorCode: locator.locatorCode,
      targetInfo: locator.targetInfo,
      description: `Duplo clique em ${locator.description}`
    });
  }

  function handleContextMenu(e) {
    if (!isRecording || isPaused || isWidgetEvent(e)) return;
    flushPendingInput();

    const target = e.target;
    const locator = window.PlaywrightLocatorGenerator.generatePlaywrightLocator(target);

    recordAction({
      type: 'rightclick',
      locatorCode: locator.locatorCode,
      targetInfo: locator.targetInfo,
      description: `Clique com botão direito em ${locator.description}`
    });
  }

  /* ----------------------------------------------------
   * CHANGE HANDLING (SELECT, CHECKBOX, RADIO)
   * ---------------------------------------------------- */
  function handleChange(e) {
    if (!isRecording || isPaused || isWidgetEvent(e)) return;
    const target = e.target;
    if (!target) return;

    // 1. Select dropdown
    if (target.tagName === 'SELECT') {
      flushPendingInput();
      const locator = window.PlaywrightLocatorGenerator.generatePlaywrightLocator(target);
      const selectedOption = target.options[target.selectedIndex];
      const val = target.value;
      const label = selectedOption ? selectedOption.text.trim() : val;

      recordAction({
        type: 'selectOption',
        locatorCode: locator.locatorCode,
        targetInfo: locator.targetInfo,
        value: val,
        description: `Selecionar "${label}" em ${locator.description}`
      });
      return;
    }

    // 2. Checkbox
    if (target.tagName === 'INPUT' && target.type === 'checkbox') {
      flushPendingInput();
      const locator = window.PlaywrightLocatorGenerator.generatePlaywrightLocator(target);
      const isChecked = target.checked;

      recordAction({
        type: isChecked ? 'check' : 'uncheck',
        locatorCode: locator.locatorCode,
        targetInfo: locator.targetInfo,
        description: `${isChecked ? 'Marcar' : 'Desmarcar'} ${locator.description}`
      });
      return;
    }

    // 3. Radio
    if (target.tagName === 'INPUT' && target.type === 'radio') {
      flushPendingInput();
      if (target.checked) {
        const locator = window.PlaywrightLocatorGenerator.generatePlaywrightLocator(target);
        recordAction({
          type: 'check',
          locatorCode: locator.locatorCode,
          targetInfo: locator.targetInfo,
          description: `Selecionar opção ${locator.description}`
        });
      }
      return;
    }

    // Text input blur/change
    if (pendingInputElement === target) {
      flushPendingInput();
    }
  }

  /* ----------------------------------------------------
   * KEYDOWN HANDLING (ENTER, ETC)
   * ---------------------------------------------------- */
  function handleKeyDown(e) {
    if (!isRecording || isPaused || isWidgetEvent(e)) return;

    if (e.key === 'Enter') {
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        flushPendingInput();

        const locator = window.PlaywrightLocatorGenerator.generatePlaywrightLocator(target);
        recordAction({
          type: 'press',
          locatorCode: locator.locatorCode,
          targetInfo: locator.targetInfo,
          key: 'Enter',
          description: `Pressionar Enter em ${locator.description}`
        });
      }
    }
  }

  /* ----------------------------------------------------
   * SPA NAVIGATION DETECTION
   * ---------------------------------------------------- */
  let lastRecordedUrl = window.location.href;

  function handleNavigation() {
    if (!isRecording || isPaused) return;

    const currentUrl = window.location.href;
    if (currentUrl !== lastRecordedUrl) {
      lastRecordedUrl = currentUrl;
      // Note: If previous action was a click, Playwright handles following links automatically.
      // But we can record page expectation or explicit navigation if desired.
    }
  }

  function hookHistoryMethods() {
    if (window.__PLAYWRIGHT_HISTORY_HOOKED__) return;
    window.__PLAYWRIGHT_HISTORY_HOOKED__ = true;

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function () {
      originalPushState.apply(this, arguments);
      handleNavigation();
    };

    history.replaceState = function () {
      originalReplaceState.apply(this, arguments);
      handleNavigation();
    };
  }

  /* ----------------------------------------------------
   * STEP REPLAY EXECUTION ENGINE
   * ---------------------------------------------------- */
  async function executeStep(step, stepIndex, totalSteps) {
    if (!step) return { success: false, error: 'Passo inválido' };

    showReplayToast(stepIndex, totalSteps, step.description || step.type);

    // 1. Locate element using auto-waiting
    const target = await window.PlaywrightLocatorGenerator.waitForElement(step.targetInfo || step, 4500);
    if (!target) {
      throw new Error(`Elemento não encontrado no site: ${step.description || step.locatorCode}`);
    }

    // 2. Scroll into view smoothly
    try {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {}

    // 3. Highlight element
    highlightReplayElement(target);

    // Wait a brief moment for human eye and animations
    await new Promise(r => setTimeout(r, 250));

    // 4. Perform simulation
    switch (step.type) {
      case 'click':
        simulateClick(target);
        break;

      case 'dblclick':
        simulateDblClick(target);
        break;

      case 'rightclick':
        simulateRightClick(target);
        break;

      case 'fill':
        simulateFill(target, step.value || '');
        break;

      case 'selectOption':
        simulateSelectOption(target, step.value || '');
        break;

      case 'check':
        simulateCheck(target, true);
        break;

      case 'uncheck':
        simulateCheck(target, false);
        break;

      case 'press':
        simulatePress(target, step.key || 'Enter');
        break;

      default:
        break;
    }

    return { success: true };
  }

  function highlightReplayElement(el) {
    const originalOutline = el.style.outline;
    const originalBoxShadow = el.style.boxShadow;
    const originalTransition = el.style.transition;

    el.style.transition = 'all 0.2s ease-in-out';
    el.style.outline = '3px solid #3b82f6';
    el.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.8)';

    setTimeout(() => {
      el.style.outline = originalOutline;
      el.style.boxShadow = originalBoxShadow;
      el.style.transition = originalTransition;
    }, 700);
  }

  function simulateClick(el) {
    el.focus();
    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new MouseEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new MouseEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.click();
  }

  function simulateDblClick(el) {
    simulateClick(el);
    simulateClick(el);
    el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window }));
  }

  function simulateRightClick(el) {
    el.focus();
    const opts = { bubbles: true, cancelable: true, view: window, button: 2 };
    el.dispatchEvent(new MouseEvent('contextmenu', opts));
  }

  function simulateFill(el, value) {
    el.focus();

    // Support React & Vue controlled inputs
    const nativeInputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    const nativeTextareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;

    if (el.tagName === 'INPUT' && nativeInputSetter) {
      nativeInputSetter.call(el, value);
    } else if (el.tagName === 'TEXTAREA' && nativeTextareaSetter) {
      nativeTextareaSetter.call(el, value);
    } else {
      el.value = value;
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function simulateSelectOption(el, value) {
    el.focus();
    let found = false;
    if (el.options) {
      for (let i = 0; i < el.options.length; i++) {
        if (el.options[i].value === value || el.options[i].text.trim() === value) {
          el.selectedIndex = i;
          found = true;
          break;
        }
      }
    }
    if (!found) {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function simulateCheck(el, shouldCheck) {
    el.focus();
    if (el.checked !== shouldCheck) {
      el.checked = shouldCheck;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  }

  function simulatePress(el, key) {
    el.focus();
    const keyOpts = {
      key,
      code: key === 'Enter' ? 'Enter' : key,
      keyCode: key === 'Enter' ? 13 : 0,
      which: key === 'Enter' ? 13 : 0,
      bubbles: true,
      cancelable: true,
      view: window
    };
    el.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
    el.dispatchEvent(new KeyboardEvent('keypress', keyOpts));
    el.dispatchEvent(new KeyboardEvent('keyup', keyOpts));

    if (key === 'Enter') {
      if (el.form) {
        const submitBtn = el.form.querySelector('button[type="submit"], input[type="submit"]');
        if (submitBtn) {
          submitBtn.click();
        } else if (typeof el.form.requestSubmit === 'function') {
          el.form.requestSubmit();
        } else {
          el.form.submit();
        }
      }
    }
  }

  let replayToastEl = null;
  function showReplayToast(stepIndex, totalSteps, description) {
    if (!replayToastEl) {
      replayToastEl = document.createElement('div');
      replayToastEl.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #1e293b;
        color: #f8fafc;
        border: 1px solid #3b82f6;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        padding: 8px 16px;
        border-radius: 20px;
        font-family: sans-serif;
        font-size: 13px;
        font-weight: 500;
        z-index: 2147483647;
        pointer-events: none;
        transition: opacity 0.3s;
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      document.documentElement.appendChild(replayToastEl);
    }

    replayToastEl.innerHTML = `
      <span style="color: #60a5fa; font-weight: bold;">[Replay ${stepIndex}/${totalSteps}]</span>
      <span>${description}</span>
    `;

    clearTimeout(replayToastEl._timer);
    replayToastEl._timer = setTimeout(() => {
      if (replayToastEl && replayToastEl.parentNode) {
        replayToastEl.parentNode.removeChild(replayToastEl);
        replayToastEl = null;
      }
    }, 3000);
  }

  /* ----------------------------------------------------
   * FLOATING CONTROL WIDGET (SHADOW DOM)
   * ---------------------------------------------------- */
  function renderFloatingWidget(count = 0) {
    if (overlayRoot) return;

    overlayRoot = document.createElement('div');
    overlayRoot.id = 'playwright-recorder-root';
    overlayRoot.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; bottom: 20px; right: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';

    overlayShadow = overlayRoot.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      .recorder-panel {
        display: flex;
        align-items: center;
        gap: 10px;
        background: #111827;
        color: #f3f4f6;
        padding: 8px 14px;
        border-radius: 9999px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
        border: 1px solid #374151;
        font-size: 13px;
        user-select: none;
        backdrop-filter: blur(8px);
        transition: all 0.2s ease;
      }
      .recorder-panel:hover {
        border-color: #4b5563;
      }
      .status-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
      .indicator-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background-color: #ef4444;
        animation: pulse 1.5s infinite;
      }
      .indicator-dot.paused {
        background-color: #f59e0b;
        animation: none;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.85); }
      }
      .actions-count {
        background: #1f2937;
        color: #60a5fa;
        padding: 2px 8px;
        border-radius: 12px;
        font-weight: bold;
        font-size: 12px;
        border: 1px solid #374151;
      }
      .btn {
        background: transparent;
        border: 1px solid transparent;
        color: #d1d5db;
        padding: 4px 8px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 500;
        transition: background-color 0.15s, color 0.15s;
      }
      .btn:hover {
        background: #374151;
        color: #ffffff;
      }
      .btn-download {
        background: #2563eb;
        color: #ffffff;
        font-weight: 600;
      }
      .btn-download:hover {
        background: #1d4ed8;
      }
      .btn-stop {
        background: #dc2626;
        color: #ffffff;
      }
      .btn-stop:hover {
        background: #b91c1c;
      }
    `;

    const container = document.createElement('div');
    container.className = 'recorder-panel';
    container.innerHTML = `
      <div class="status-badge">
        <span class="indicator-dot ${isPaused ? 'paused' : ''}" id="pwr-dot"></span>
        <span id="pwr-status-text">${isPaused ? 'Pausado' : 'Gravando'}</span>
      </div>
      <div class="actions-count" id="pwr-count">${count} ações</div>
      <button class="btn" id="pwr-pause-btn" title="Pausar / Continuar gravação">
        ${isPaused ? '▶ Continuar' : '⏸ Pausar'}
      </button>
      <button class="btn btn-download" id="pwr-download-btn" title="Baixar script Playwright (.js)">
        💾 Baixar .js
      </button>
      <button class="btn btn-stop" id="pwr-stop-btn" title="Parar gravação">
        ⏹ Parar
      </button>
    `;

    overlayShadow.appendChild(style);
    overlayShadow.appendChild(container);
    document.documentElement.appendChild(overlayRoot);

    // Setup widget buttons
    const pauseBtn = overlayShadow.getElementById('pwr-pause-btn');
    const stopBtn = overlayShadow.getElementById('pwr-stop-btn');
    const downloadBtn = overlayShadow.getElementById('pwr-download-btn');

    pauseBtn.addEventListener('click', () => {
      chrome.storage.local.get(['isPaused'], (res) => {
        const nextPaused = !res.isPaused;
        chrome.storage.local.set({ isPaused: nextPaused });
      });
    });

    stopBtn.addEventListener('click', () => {
      flushPendingInput();
      chrome.storage.local.set({ isRecording: false, isPaused: false });
    });

    downloadBtn.addEventListener('click', () => {
      flushPendingInput();
      chrome.runtime.sendMessage({ action: 'TRIGGER_DOWNLOAD' });
    });
  }

  function updateWidgetStatus() {
    if (!overlayShadow) return;
    const dot = overlayShadow.getElementById('pwr-dot');
    const statusText = overlayShadow.getElementById('pwr-status-text');
    const pauseBtn = overlayShadow.getElementById('pwr-pause-btn');

    if (dot) {
      dot.className = `indicator-dot ${isPaused ? 'paused' : ''}`;
    }
    if (statusText) {
      statusText.textContent = isPaused ? 'Pausado' : 'Gravando';
    }
    if (pauseBtn) {
      pauseBtn.textContent = isPaused ? '▶ Continuar' : '⏸ Pausar';
    }
  }

  function updateWidgetCount(count) {
    if (!overlayShadow) return;
    const countEl = overlayShadow.getElementById('pwr-count');
    if (countEl) {
      countEl.textContent = `${count} ${count === 1 ? 'ação' : 'ações'}`;
    }
  }

  function removeFloatingWidget() {
    if (overlayRoot && overlayRoot.parentNode) {
      overlayRoot.parentNode.removeChild(overlayRoot);
      overlayRoot = null;
      overlayShadow = null;
    }
  }

})();
