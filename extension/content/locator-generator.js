/**
 * Playwright Locator Generator
 * Generates optimal, user-facing Playwright locators following Playwright best practices.
 */

(function (root) {
  'use strict';

  const ELEMENT_NODE = typeof Node !== 'undefined' ? Node.ELEMENT_NODE : 1;
  const TEXT_NODE = typeof Node !== 'undefined' ? Node.TEXT_NODE : 3;

  function cssEscape(str) {
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(str);
    return String(str).replace(/([ #;?%&,.+*~':"!^$[\]()=>|/@])/g, '\\$1');
  }

  function cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
  }

  function isDynamicId(id) {
    if (!id) return true;
    // Common dynamic id patterns (UUIDs, auto-generated frameworks like mui, react, ember, vue)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(id)) return true;
    if (/(:r[0-9a-z]+:)/i.test(id)) return true; // React 18 useId
    if (/^(ember|mui|ng|chakra|css)-?[0-9]+/i.test(id)) return true;
    if (/\d{5,}/.test(id)) return true; // Large numbers usually mean timestamps or random counters
    return false;
  }

  function getTestId(el) {
    const testIdAttrs = ['data-testid', 'data-test', 'data-cy', 'data-qa', 'test-id'];
    for (const attr of testIdAttrs) {
      const val = el.getAttribute(attr);
      if (val && val.trim()) {
        return val.trim();
      }
    }
    return null;
  }

  function getAssociatedLabelText(el) {
    // 1. Check aria-labelledby
    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      const ref = document.getElementById(labelledby);
      if (ref) {
        const text = cleanText(ref.innerText || ref.textContent);
        if (text) return text;
      }
    }

    // 2. Check aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && cleanText(ariaLabel)) {
      return cleanText(ariaLabel);
    }

    // 3. For form controls, check <label for="id">
    if (el.id) {
      const label = document.querySelector(`label[for="${cssEscape(el.id)}"]`);
      if (label) {
        const text = cleanText(label.innerText || label.textContent);
        if (text) return text;
      }
    }

    // 4. Check wrapping <label>
    const parentLabel = el.closest('label');
    if (parentLabel) {
      // Clone label and remove this input to get just label text
      const clone = parentLabel.cloneNode(true);
      const inputs = clone.querySelectorAll('input, select, textarea');
      inputs.forEach(i => i.remove());
      const text = cleanText(clone.innerText || clone.textContent);
      if (text) return text;
    }

    return null;
  }

  function getAriaRole(el) {
    const explicitRole = el.getAttribute('role');
    if (explicitRole) {
      return explicitRole.toLowerCase().trim();
    }

    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();

    if (tag === 'a' && el.hasAttribute('href')) return 'link';
    if (tag === 'button') return 'button';
    if (tag === 'input') {
      if (['button', 'submit', 'reset'].includes(type)) return 'button';
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (['text', 'search', 'tel', 'url', 'email', 'password', 'number'].includes(type) || !type) return 'textbox';
    }
    if (tag === 'textarea') return 'textbox';
    if (tag === 'select') return 'combobox';
    if (/^h[1-6]$/.test(tag)) return 'heading';
    if (tag === 'img') return 'img';

    return null;
  }

  function getAccessibleName(el) {
    // aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && cleanText(ariaLabel)) return cleanText(ariaLabel);

    // aria-labelledby
    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      const ref = document.getElementById(labelledby);
      if (ref) {
        const text = cleanText(ref.innerText || ref.textContent);
        if (text) return text;
      }
    }

    // Value for buttons/inputs
    if (el.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(el.type)) {
      if (el.value && cleanText(el.value)) return cleanText(el.value);
    }

    // For buttons or links or headings: inner text
    const text = cleanText(el.innerText || el.textContent);
    if (text && text.length <= 80) return text;

    // Title
    const title = el.getAttribute('title');
    if (title && cleanText(title)) return cleanText(title);

    return null;
  }

  function getDirectText(el) {
    let text = '';
    for (let i = 0; i < el.childNodes.length; i++) {
      const node = el.childNodes[i];
      if (node.nodeType === TEXT_NODE) {
        text += node.textContent;
      }
    }
    return cleanText(text);
  }

  function getUniqueCssSelector(el) {
    if (typeof document === 'undefined') {
      return el.tagName ? el.tagName.toLowerCase() : 'body';
    }

    // Check if ID is unique and not dynamic
    if (el.id && !isDynamicId(el.id)) {
      const idSel = `#${cssEscape(el.id)}`;
      try {
        if (document.querySelectorAll(idSel).length === 1) return idSel;
      } catch (e) {}
    }

    // Check name attribute for forms
    const name = el.getAttribute('name');
    if (name) {
      const nameSel = `${el.tagName.toLowerCase()}[name="${cssEscape(name)}"]`;
      try {
        if (document.querySelectorAll(nameSel).length === 1) return nameSel;
      } catch (e) {}
    }

    // Build hierarchical selector
    const path = [];
    let current = el;
    while (current && current.nodeType === ELEMENT_NODE && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();

      if (current.id && !isDynamicId(current.id)) {
        selector += `#${cssEscape(current.id)}`;
        path.unshift(selector);
        break; // Stop at valid ID
      }

      // Add distinguishing classes if available
      if (current.className && typeof current.className === 'string') {
        const classes = current.className
          .split(/\s+/)
          .filter(c => c && !c.includes(':') && !/\d{4,}/.test(c) && !c.startsWith('ng-') && !c.startsWith('css-'))
          .slice(0, 2);
        if (classes.length > 0) {
          selector += `.${classes.map(c => cssEscape(c)).join('.')}`;
        }
      }

      // Check uniqueness of current selector chain
      path.unshift(selector);
      const fullPath = path.join(' > ');
      try {
        if (document.querySelectorAll(fullPath).length === 1) {
          return fullPath;
        }
      } catch (e) {}

      // Add :nth-of-type if ambiguous among siblings
      if (current.parentElement) {
        const siblings = Array.from(current.parentElement.children).filter(s => s.tagName === current.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          path[0] += `:nth-of-type(${index})`;
        }
      }

      current = current.parentElement;
      if (path.length >= 4) break; // Keep selectors reasonably short
    }

    return path.join(' > ');
  }

  /**
   * Main locator resolution
   * Returns: { locatorCode: string, description: string }
   */
  /**
   * Main locator resolution
   * Returns: { locatorCode: string, description: string, targetInfo: object }
   */
  function generatePlaywrightLocator(el) {
    if (!el || el.nodeType !== ELEMENT_NODE) {
      return { locatorCode: 'page.locator("body")', description: 'body', targetInfo: { cssSel: 'body' } };
    }

    const testId = getTestId(el);
    const labelText = getAssociatedLabelText(el);
    const placeholder = el.getAttribute('placeholder');
    const role = getAriaRole(el);
    const name = role ? getAccessibleName(el) : null;
    const alt = (el.tagName === 'IMG' || (el.tagName === 'INPUT' && el.type === 'image')) ? el.getAttribute('alt') : null;
    const title = el.getAttribute('title');
    const text = cleanText(el.innerText || el.textContent);
    const cssSel = getUniqueCssSelector(el);

    const targetInfo = {
      testId: testId || null,
      labelText: (labelText && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) ? labelText : null,
      placeholder: (placeholder && ['INPUT', 'TEXTAREA'].includes(el.tagName)) ? cleanText(placeholder) : null,
      role: role || null,
      name: name || null,
      alt: (alt && cleanText(alt)) ? cleanText(alt) : null,
      title: (title && cleanText(title)) ? cleanText(title) : null,
      text: (text && text.length <= 40) ? text : null,
      cssSel: cssSel || null,
      tagName: el.tagName.toLowerCase()
    };

    // 1. getByTestId
    if (testId) {
      return {
        locatorCode: `page.getByTestId(${JSON.stringify(testId)})`,
        description: `elemento com testid "${testId}"`,
        targetInfo
      };
    }

    // 2. getByLabel (ideal for inputs and selects)
    if (labelText && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
      return {
        locatorCode: `page.getByLabel(${JSON.stringify(labelText)})`,
        description: `campo "${labelText}"`,
        targetInfo
      };
    }

    // 3. getByPlaceholder
    if (placeholder && cleanText(placeholder) && ['INPUT', 'TEXTAREA'].includes(el.tagName)) {
      return {
        locatorCode: `page.getByPlaceholder(${JSON.stringify(cleanText(placeholder))})`,
        description: `campo placeholder "${cleanText(placeholder)}"`,
        targetInfo
      };
    }

    // 4. getByRole
    if (role && name) {
      return {
        locatorCode: `page.getByRole(${JSON.stringify(role)}, { name: ${JSON.stringify(name)} })`,
        description: `${role} "${name}"`,
        targetInfo
      };
    }

    // 5. getByAltText
    if (alt && cleanText(alt)) {
      return {
        locatorCode: `page.getByAltText(${JSON.stringify(cleanText(alt))})`,
        description: `imagem "${cleanText(alt)}"`,
        targetInfo
      };
    }

    // 6. getByTitle
    if (title && cleanText(title)) {
      return {
        locatorCode: `page.getByTitle(${JSON.stringify(cleanText(title))})`,
        description: `elemento com título "${cleanText(title)}"`,
        targetInfo
      };
    }

    // 7. getByText (for buttons, spans, headers with clear direct text)
    if (text && text.length > 0 && text.length <= 40) {
      return {
        locatorCode: `page.getByText(${JSON.stringify(text)}, { exact: true })`,
        description: `texto "${text}"`,
        targetInfo
      };
    }

    // 8. Fallback CSS locator
    return {
      locatorCode: `page.locator(${JSON.stringify(cssSel)})`,
      description: `seletor "${cssSel}"`,
      targetInfo
    };
  }

  /**
   * Finds a DOM element based on targetInfo using multiple fallback strategies
   */
  function findElement(targetInfo) {
    if (!targetInfo) return null;
    const doc = typeof document !== 'undefined' ? document : (typeof root !== 'undefined' && root.document ? root.document : null);
    if (!doc) return null;

    // 1. By Test ID
    if (targetInfo.testId) {
      const escaped = cssEscape(targetInfo.testId);
      const el = doc.querySelector(
        `[data-testid="${escaped}"], [data-test="${escaped}"], [data-cy="${escaped}"], [data-qa="${escaped}"], [test-id="${escaped}"]`
      );
      if (el) return el;
    }

    // 2. By Label
    if (targetInfo.labelText) {
      // Find label by text
      const labels = Array.from(doc.querySelectorAll('label'));
      for (const lbl of labels) {
        if (cleanText(lbl.innerText || lbl.textContent).includes(targetInfo.labelText)) {
          if (lbl.htmlFor) {
            const input = doc.getElementById(lbl.htmlFor);
            if (input) return input;
          }
          const nestedInput = lbl.querySelector('input, select, textarea');
          if (nestedInput) return nestedInput;
        }
      }
      // Check aria-label
      const ariaEl = doc.querySelector(`[aria-label="${cssEscape(targetInfo.labelText)}"]`);
      if (ariaEl) return ariaEl;
    }

    // 3. By Placeholder
    if (targetInfo.placeholder) {
      const el = doc.querySelector(`[placeholder="${cssEscape(targetInfo.placeholder)}"]`);
      if (el) return el;
    }

    // 4. By Role & Name
    if (targetInfo.role && targetInfo.name) {
      const candidates = doc.querySelectorAll('button, a, input, select, textarea, [role], h1, h2, h3, h4, h5, h6');
      for (const cand of candidates) {
        if (getAriaRole(cand) === targetInfo.role) {
          const accName = getAccessibleName(cand);
          if (accName && accName.toLowerCase() === targetInfo.name.toLowerCase()) {
            return cand;
          }
        }
      }
    }

    // 5. By Alt
    if (targetInfo.alt) {
      const el = doc.querySelector(`img[alt="${cssEscape(targetInfo.alt)}"], input[type="image"][alt="${cssEscape(targetInfo.alt)}"]`);
      if (el) return el;
    }

    // 6. By Title
    if (targetInfo.title) {
      const el = doc.querySelector(`[title="${cssEscape(targetInfo.title)}"]`);
      if (el) return el;
    }

    // 7. By CSS Selector
    if (targetInfo.cssSel) {
      try {
        const el = doc.querySelector(targetInfo.cssSel);
        if (el) return el;
      } catch (e) {}
    }

    // 8. By Text matching
    if (targetInfo.text) {
      const allElements = doc.querySelectorAll('button, a, span, p, label, li, td, th');
      for (const el of allElements) {
        if (cleanText(el.innerText || el.textContent) === targetInfo.text) {
          return el;
        }
      }
    }

    return null;
  }

  /**
   * Auto-waits for element to appear in DOM (Playwright style)
   */
  async function waitForElement(targetInfo, timeoutMs = 4000) {
    const startTime = Date.now();
    return new Promise((resolve) => {
      function check() {
        const el = findElement(targetInfo);
        if (el) {
          resolve(el);
          return;
        }
        if (Date.now() - startTime >= timeoutMs) {
          resolve(null);
          return;
        }
        setTimeout(check, 100);
      }
      check();
    });
  }

  // Export to root (content script window or module)
  root.PlaywrightLocatorGenerator = {
    generatePlaywrightLocator,
    findElement,
    waitForElement,
    cleanText,
    getAriaRole,
    getAccessibleName
  };

})(typeof window !== 'undefined' ? window : this);
