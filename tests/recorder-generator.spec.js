// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Playwright Recorder - Code Generator & Extension Validation', () => {
  const codeGeneratorPath = path.resolve('extension/utils/code-generator.js');
  const manifestPath = path.resolve('extension/manifest.json');

  test('manifest.json is valid Manifest V3 and files exist', () => {
    expect(fs.existsSync(manifestPath)).toBeTruthy();
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('Playwright Test Recorder');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('downloads');

    // Verify icons exist
    expect(fs.existsSync(path.resolve('extension', manifest.icons['16']))).toBeTruthy();
    expect(fs.existsSync(path.resolve('extension', manifest.icons['48']))).toBeTruthy();
    expect(fs.existsSync(path.resolve('extension', manifest.icons['128']))).toBeTruthy();

    // Verify background and content scripts exist
    expect(fs.existsSync(path.resolve('extension', manifest.background.service_worker))).toBeTruthy();
    manifest.content_scripts[0].js.forEach(file => {
      expect(fs.existsSync(path.resolve('extension', file))).toBeTruthy();
    });

    // Verify popup files exist
    expect(fs.existsSync(path.resolve('extension', manifest.action.default_popup))).toBeTruthy();
  });

  test('generates valid Playwright script (ESM)', () => {
    // Load code generator
    const codeGenScript = fs.readFileSync(codeGeneratorPath, 'utf8');
    const sandbox = {};
    const fn = new Function('window', codeGenScript);
    fn(sandbox);

    const CodeGen = sandbox.PlaywrightCodeGenerator;
    expect(CodeGen).toBeDefined();

    const sampleActions = [
      {
        type: 'goto',
        url: 'https://playwright.dev/',
        description: 'Navegar para a página inicial'
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

    // Assert standard imports and structure
    expect(script).toContain("import { test, expect } from '@playwright/test';");
    expect(script).toContain("test(\"fluxo completo de busca e selecao\", async ({ page }) => {");
    expect(script).toContain("await page.goto(\"https://playwright.dev/\");");
    expect(script).toContain("await page.getByRole('link', { name: 'Get started' }).click();");
    expect(script).toContain("await page.getByPlaceholder('Search docs').fill(\"locators\");");
    expect(script).toContain("await page.getByPlaceholder('Search docs').press(\"Enter\");");
    expect(script).toContain("await page.getByLabel('Lembrar de mim').check();");
    expect(script).toContain("await page.getByLabel('Idioma').selectOption(\"pt-BR\");");
  });

  test('generates valid Playwright script (CommonJS)', () => {
    const codeGenScript = fs.readFileSync(codeGeneratorPath, 'utf8');
    const sandbox = {};
    const fn = new Function('window', codeGenScript);
    fn(sandbox);

    const CodeGen = sandbox.PlaywrightCodeGenerator;
    const script = CodeGen.generateFullTestScript([], {
      moduleType: 'cjs',
      testName: 'teste vazio'
    });

    expect(script).toContain("const { test, expect } = require('@playwright/test');");
    expect(script).toContain("test(\"teste vazio\", async ({ page }) => {");
  });
});
