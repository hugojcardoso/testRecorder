const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('PlaywrightLocatorGenerator chooses correct locator strategies', () => {
  const locatorGenPath = path.resolve(__dirname, '../extension/content/locator-generator.js');
  const locatorGenScript = fs.readFileSync(locatorGenPath, 'utf8');

  // Setup mock DOM environment
  const mockWindow = {
    CSS: {
      escape: (str) => String(str).replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g, '\\$1')
    },
    Node: {
      ELEMENT_NODE: 1,
      TEXT_NODE: 3
    }
  };
  mockWindow.this = mockWindow;

  const fn = new Function('window', locatorGenScript);
  fn(mockWindow);

  const Generator = mockWindow.PlaywrightLocatorGenerator;
  assert.ok(Generator, 'PlaywrightLocatorGenerator should be defined');

  // Helper to create mock element
  function createMockElement(opts) {
    const attrs = opts.attributes || {};
    return {
      nodeType: 1,
      tagName: (opts.tagName || 'DIV').toUpperCase(),
      id: opts.id || '',
      className: opts.className || '',
      type: opts.type || '',
      value: opts.value || '',
      innerText: opts.innerText || '',
      textContent: opts.textContent || opts.innerText || '',
      getAttribute: (name) => attrs[name] || null,
      hasAttribute: (name) => name in attrs,
      closest: (sel) => null,
      parentElement: null,
      childNodes: []
    };
  }

  // 1. Test data-testid priority
  const testIdEl = createMockElement({
    tagName: 'button',
    attributes: { 'data-testid': 'submit-order-button' },
    innerText: 'Finalizar Pedido'
  });
  const res1 = Generator.generatePlaywrightLocator(testIdEl);
  assert.strictEqual(res1.locatorCode, 'page.getByTestId("submit-order-button")');

  // 2. Test placeholder
  const placeholderEl = createMockElement({
    tagName: 'input',
    type: 'text',
    attributes: { placeholder: 'Digite seu e-mail' }
  });
  const res2 = Generator.generatePlaywrightLocator(placeholderEl);
  assert.strictEqual(res2.locatorCode, 'page.getByPlaceholder("Digite seu e-mail")');

  // 3. Test getByRole for button
  const buttonEl = createMockElement({
    tagName: 'button',
    innerText: 'Salvar Configurações'
  });
  const res3 = Generator.generatePlaywrightLocator(buttonEl);
  assert.strictEqual(res3.locatorCode, 'page.getByRole("button", { name: "Salvar Configurações" })');

  // 4. Test getByRole for link
  const linkEl = createMockElement({
    tagName: 'a',
    attributes: { href: '/sobre' },
    innerText: 'Sobre Nós'
  });
  const res4 = Generator.generatePlaywrightLocator(linkEl);
  assert.strictEqual(res4.locatorCode, 'page.getByRole("link", { name: "Sobre Nós" })');

  // 5. Test getByAltText for image
  const imgEl = createMockElement({
    tagName: 'img',
    attributes: { alt: 'Logo do Playwright' }
  });
  const res5 = Generator.generatePlaywrightLocator(imgEl);
  assert.strictEqual(res5.locatorCode, 'page.getByAltText("Logo do Playwright")');

  // 6. Test getByTitle
  const titleEl = createMockElement({
    tagName: 'span',
    attributes: { title: 'Dica de ajuda' }
  });
  const res6 = Generator.generatePlaywrightLocator(titleEl);
  assert.strictEqual(res6.locatorCode, 'page.getByTitle("Dica de ajuda")');
});

test('PlaywrightLocatorGenerator.findElement resolves elements correctly', () => {
  const locatorGenPath = path.resolve(__dirname, '../extension/content/locator-generator.js');
  const locatorGenScript = fs.readFileSync(locatorGenPath, 'utf8');

  const elements = [
    { id: 'btn1', attributes: { 'data-testid': 'login-button' }, tagName: 'BUTTON' },
    { id: 'input1', attributes: { placeholder: 'Seu email' }, tagName: 'INPUT' }
  ];

  const mockDocument = {
    querySelector: (selector) => {
      if (selector.includes('login-button')) return elements[0];
      if (selector.includes('Seu')) return elements[1];
      return null;
    },
    querySelectorAll: () => []
  };

  const mockWindow = {
    document: mockDocument,
    CSS: {
      escape: (str) => String(str).replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g, '\\$1')
    },
    Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 }
  };

  const fn = new Function('window', locatorGenScript);
  fn(mockWindow);

  const Generator = mockWindow.PlaywrightLocatorGenerator;
  const foundTestId = Generator.findElement({ testId: 'login-button' });
  assert.strictEqual(foundTestId.id, 'btn1');

  const foundPlaceholder = Generator.findElement({ placeholder: 'Seu email' });
  assert.strictEqual(foundPlaceholder.id, 'input1');
});
