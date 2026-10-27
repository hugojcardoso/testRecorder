/**
 * Playwright Code Generator
 * Converts recorded actions into idiomatic Playwright test scripts.
 */

(function (root) {
  'use strict';

  function formatActionCode(action) {
    if (!action) return '';

    // If action already has full statement
    if (action.code) {
      return action.code;
    }

    const { type, locatorCode, value, key, url } = action;

    switch (type) {
      case 'goto':
        return `await page.goto(${JSON.stringify(url)});`;

      case 'click':
        return `await ${locatorCode}.click();`;

      case 'dblclick':
        return `await ${locatorCode}.dblclick();`;

      case 'rightclick':
        return `await ${locatorCode}.click({ button: 'right' });`;

      case 'fill':
        return `await ${locatorCode}.fill(${JSON.stringify(value || '')});`;

      case 'check':
        return `await ${locatorCode}.check();`;

      case 'uncheck':
        return `await ${locatorCode}.uncheck();`;

      case 'selectOption':
        return `await ${locatorCode}.selectOption(${JSON.stringify(value || '')});`;

      case 'press':
        return `await ${locatorCode}.press(${JSON.stringify(key || 'Enter')});`;

      case 'assertVisible':
        return `await expect(${locatorCode}).toBeVisible();`;

      case 'assertUrl':
        return `await expect(page).toHaveURL(${JSON.stringify(url)});`;

      default:
        return `// Ação não mapeada: ${type}`;
    }
  }

  function generateFullTestScript(actions = [], options = {}) {
    const {
      moduleType = 'esm',
      testName = 'teste gravado',
      includeComments = true
    } = options;

    const lines = [];

    // Header imports
    if (moduleType === 'esm') {
      lines.push("// @ts-check");
      lines.push("import { test, expect } from '@playwright/test';");
    } else {
      lines.push("// @ts-check");
      lines.push("const { test, expect } = require('@playwright/test');");
    }

    lines.push("");
    lines.push(`test(${JSON.stringify(testName)}, async ({ page }) => {`);

    if (actions.length === 0) {
      lines.push("  // Nenhuma ação gravada ainda.");
      lines.push("  // Inicie a navegação para começar a gravar suas ações.");
    } else {
      let previousActionType = '';

      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];

        // Add blank line between different types of actions for readability
        if (i > 0 && action.type !== previousActionType && ['goto', 'click', 'fill'].includes(action.type)) {
          lines.push("");
        }
        previousActionType = action.type;

        if (includeComments && action.description) {
          lines.push(`  // ${action.description}`);
        }

        const codeStatement = formatActionCode(action);
        lines.push(`  ${codeStatement}`);
      }
    }

    lines.push("});");
    lines.push("");

    return lines.join("\n");
  }

  root.PlaywrightCodeGenerator = {
    formatActionCode,
    generateFullTestScript
  };

})(typeof window !== 'undefined' ? window : this);
