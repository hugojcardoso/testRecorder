# Playwright Test Recorder - Extension Folder

Esta pasta contém todos os arquivos prontos da extensão Google Chrome:

- `manifest.json`: manifesto Manifest V3
- `icons/`: ícones 16x16, 48x48 e 128x128
- `background/service-worker.js`: service worker em background
- `content/locator-generator.js`: gerador de seletores Playwright
- `content/content.js`: interceptor de eventos e widget flutuante
- `popup/`: interface do popup (HTML, CSS e JS com download e cópia)
- `utils/code-generator.js`: conversão de ações em scripts Playwright

### Para carregar no Chrome:
Acesse `chrome://extensions/`, ative o Modo Desenvolvedor e clique em "Carregar sem compactação" selecionando esta pasta.
