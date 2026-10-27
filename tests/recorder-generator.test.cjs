const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('manifest.json is valid Manifest V3 and all files exist', () => {
  const manifestPath = path.resolve(__dirname, '../extension/manifest.json');
  assert.strictEqual(fs.existsSync(manifestPath), true, 'manifest.json must exist');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.strictEqual(manifest.manifest_version, 3);
  assert.strictEqual(manifest.name, 'Playwright Test Recorder');
  assert.ok(manifest.permissions.includes('storage'));
  assert.ok(manifest.permissions.includes('downloads'));
  assert.ok(manifest.permissions.includes('tabs'));
  assert.ok(manifest.permissions.includes('activeTab'));

  // Icons
  assert.strictEqual(fs.existsSync(path.resolve(__dirname, '../extension', manifest.icons['16'])), true);
  assert.strictEqual(fs.existsSync(path.resolve(__dirname, '../extension', manifest.icons['48'])), true);
  assert.strictEqual(fs.existsSync(path.resolve(__dirname, '../extension', manifest.icons['128'])), true);

  // Background
  assert.strictEqual(fs.existsSync(path.resolve(__dirname, '../extension', manifest.background.service_worker)), true);

  // Content scripts
  manifest.content_scripts[0].js.forEach(file => {
    assert.strictEqual(fs.existsSync(path.resolve(__dirname, '../extension', file)), true, `File ${file} must exist`);
  });

  // Popup
  assert.strictEqual(fs.existsSync(path.resolve(__dirname, '../extension', manifest.action.default_popup)), true);
});

test('generates valid Playwright script (ESM)', () => {
  const codeGeneratorPath = path.resolve(__dirname, '../extension/utils/code-generator.js');
  const codeGenScript = fs.readFileSync(codeGeneratorPath, 'utf8');
  const sandbox = {};
  const fn = new Function('window', codeGenScript);
  fn(sandbox);

  const CodeGen = sandbox.PlaywrightCodeGenerator;
  assert.ok(CodeGen, 'PlaywrightCodeGenerator must be defined');

  const sampleActions = [
    {
      type: 'goto',
      url: 'https://playwright.dev/',
      description: 'Navegar para https://playwright.dev/'
    },
    {
      type: 'click',
      locatorCode: "page.getByRole('link', { name: 'Get started' })",
      description: 'Clicar em "Get started"'
    },
    {
      type: 'fill',
      locatorCode: "page.getByPlaceholder('Search docs')",
      value: 'locators',
      description: 'Preencher busca com "locators"'
    },
    {
      type: 'press',
      locatorCode: "page.getByPlaceholder('Search docs')",
      key: 'Enter',
      description: 'Pressionar Enter'
    },
    {
      type: 'check',
      locatorCode: "page.getByLabel('Lembrar de mim')",
      description: 'Marcar Lembrar de mim'
    },
    {
      type: 'selectOption',
      locatorCode: "page.getByLabel('Idioma')",
      value: 'pt-BR',
      description: 'Selecionar idioma'
    }
  ];

  const script = CodeGen.generateFullTestScript(sampleActions, {
    moduleType: 'esm',
    testName: 'fluxo completo de busca e selecao',
    includeComments: true
  });

  assert.ok(script.includes("import { test, expect } from '@playwright/test';"));
  assert.ok(script.includes('test("fluxo completo de busca e selecao", async ({ page }) => {'));
  assert.ok(script.includes('await page.goto("https://playwright.dev/");'));
  assert.ok(script.includes("await page.getByRole('link', { name: 'Get started' }).click();"));
  assert.ok(script.includes('await page.getByPlaceholder(\'Search docs\').fill("locators");'));
  assert.ok(script.includes('await page.getByPlaceholder(\'Search docs\').press("Enter");'));
  assert.ok(script.includes("await page.getByLabel('Lembrar de mim').check();"));
  assert.ok(script.includes('await page.getByLabel(\'Idioma\').selectOption("pt-BR");'));
});

test('generates valid Playwright script (CommonJS)', () => {
  const codeGeneratorPath = path.resolve(__dirname, '../extension/utils/code-generator.js');
  const codeGenScript = fs.readFileSync(codeGeneratorPath, 'utf8');
  const sandbox = {};
  const fn = new Function('window', codeGenScript);
  fn(sandbox);

  const CodeGen = sandbox.PlaywrightCodeGenerator;
  const script = CodeGen.generateFullTestScript([], {
    moduleType: 'cjs',
    testName: 'teste vazio'
  });

  assert.ok(script.includes("const { test, expect } = require('@playwright/test');"));
  assert.ok(script.includes('test("teste vazio", async ({ page }) => {'));
});
