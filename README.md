<div align="center">

  <img src="extension/icons/icon-128.png" alt="Playwright Test Recorder Logo" width="100" height="100" />

  # 🎬 Playwright Test Recorder

  **Extensão para Google Chrome (Manifest V3) que grava interações do usuário em qualquer site, executa testes via Replay ao vivo e exporta scripts prontos no padrão oficial do Playwright em JavaScript.**

  <br />

  [![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
  [![Playwright](https://img.shields.io/badge/Playwright-v1.40+-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
  [![JavaScript](https://img.shields.io/badge/JavaScript-ESM%20%7C%20CommonJS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/pt-BR/docs/Web/JavaScript)
  [![Tests](https://img.shields.io/badge/Tests-Passing-brightgreen?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
  [![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

  <br />

  [Recursos](#-recursos-principais) •
  [Instalação](#-como-instalar-no-google-chrome) •
  [Como Usar](#-guia-rápido-de-uso) •
  [Execução (Replay)](#-execução-ao-vivo-replay) •
  [Arquitetura](#-estrutura-e-arquitetura) •
  [Testes](#-testes-automatizados)

</div>

---

## 📌 Visão Geral

O **Playwright Test Recorder** é uma extensão projetada para acelerar a criação de testes end-to-end (E2E). Enquanto você navega e utiliza normalmente qualquer aplicação web, a extensão:

1. **Grava** todas as suas ações (cliques, preenchimento de campos, seleções, checkboxes, navegações e submissões com Enter).
2. **Gera seletores semânticos e resilientes** seguindo as recomendações oficiais da Microsoft (`getByRole`, `getByLabel`, `getByPlaceholder`, `getByTestId`, etc.).
3. **Executa o teste ao vivo no próprio navegador (Replay)** com destaque visual elemento a elemento e *auto-waiting* inteligente.
4. **Permite o download imediato** do script em arquivo `.spec.js` pronto para rodar com `npx playwright test`.

---

## ✨ Recursos Principais

### ⏺️ Gravação Completa e Precisa
- **Navegação de URLs**: Registra a URL inicial e mudanças de rotas SPA (`page.goto`).
- **Cliques Interativos**: Identifica botões, links, ícones, botões de rádio e menus.
- **Entrada de Texto Inteligente (`fill`)**: Agrupa digitações contínuas via *debounce*, evitando comandos redundantes tecla a tecla.
- **Formulários e Dropdowns (`selectOption`)**: Mapeia opções selecionadas em menus `<select>`.
- **Checkboxes & Radios**: Detecta eventos de `check()` e `uncheck()`.
- **Teclado Especial**: Captura teclas de submissão como `Enter` (`press('Enter')`).
- **Cliques Especiais**: Suporte a duplo clique (`dblclick`) e botão direito (`contextmenu`).

### 🎯 Seletores no Padrão Oficial do Playwright
A extensão implementa um motor de pontuação que prioriza seletores centrados no usuário, evitando seletores frágeis baseados em classes geradas por CSS-in-JS ou IDs dinâmicos:

| Prioridade | Localizador | Quando é Usado | Exemplo de Código |
| :---: | :--- | :--- | :--- |
| **1º** | `getByTestId` | `data-testid`, `data-test`, `data-cy`, `data-qa` | `page.getByTestId('submit-btn')` |
| **2º** | `getByLabel` | Inputs com rótulo `<label>` associado ou `aria-label` | `page.getByLabel('E-mail')` |
| **3º** | `getByPlaceholder` | Campos de formulário com texto placeholder | `page.getByPlaceholder('Buscar...')` |
| **4º** | `getByRole` | Elementos semânticos com nome acessível | `page.getByRole('button', { name: 'Entrar' })` |
| **5º** | `getByAltText` | Imagens e inputs do tipo imagem | `page.getByAltText('Logo da Empresa')` |
| **6º** | `getByTitle` | Elementos com atributo `title` descritivo | `page.getByTitle('Configurações')` |
| **7º** | `getByText` | Textos únicos e botões textuais | `page.getByText('Minha Conta', { exact: true })` |
| **8º** | `locator` *(fallback)* | CSS Selector estruturado e único | `page.locator('#form-login button[type="submit"]')` |

### ▶️ Execução ao Vivo (Replay)
- Reproduza a gravação diretamente na aba atual com um clique.
- **Destaque Visual**: Cada elemento recebe um contorno brilhante antes de ser acionado, facilitando a visualização humana.
- **Auto-Waiting**: Aguarda automaticamente até que os elementos estejam carregados no DOM e visíveis.
- **Controle de Velocidade**:
  - `Normal (0.8s)`: Cadência ideal para acompanhar passo a passo.
  - `Rápido (0.3s)`: Execução ágil para validação rápida.
  - `Lento (1.5s)`: Excelente para apresentações e demonstrações.
- **Barra de Progresso**: Exibe em tempo real o passo atual e a descrição da ação.

### 💾 Download com 1 Clique
- Baixe o script em formato de especificação Playwright (`.spec.js`) nomeado com timestamp: `[nome_do_teste]-[data-hora].spec.js`.
- Botão auxiliar para **Copiar Código** diretamente para a área de transferência.

### 🛠️ Widget Flutuante na Página (Shadow DOM)
- Um menu discreto e moderno flutua no canto da tela enquanto você grava.
- Encapsulado com **Shadow DOM**, garantindo imunidade total: não interfere no CSS do site e não sofre interferência dos estilos da página.

### ⚛️ Suporte Nativo a Frameworks Modernos (SPAs)
- Aciona os protótipos nativos de `HTMLInputElement` e `HTMLTextAreaElement`, garantindo que eventos de digitação sejam capturados corretamente em aplicações desenvolvidas em **React**, **Vue.js**, **Angular**, **Svelte** e Vanilla JS.

---

## 🚀 Como Instalar no Google Chrome

A extensão foi construída sob o padrão **Manifest V3**, não necessitando de builds complexos para uso imediato em desenvolvimento.

1. Clone ou baixe este repositório:
   ```bash
   git clone https://github.com/SEU_USUARIO/PlaywrightTestRecorder.git
   cd PlaywrightTestRecorder
   ```

2. Abra o Google Chrome e navegue até a tela de extensões:
   ```text
   chrome://extensions/
   ```

3. No canto superior direito, ative o botão **"Modo do desenvolvedor"** (*Developer mode*).

4. No canto superior esquerdo, clique no botão **"Carregar sem compactação"** (*Load unpacked*).

5. Selecione a pasta **`extension/`** dentro do diretório do projeto:
   ```text
   PlaywrightTestRecorder/extension
   ```

6. A extensão estará instalada! Para facilitar o uso, clique no ícone de "quebra-cabeça" na barra de ferramentas do Chrome e **fixe** (*pin*) o ícone da extensão.

---

## 🕹️ Guia Rápido de Uso

```
  ┌─────────────────────────────────────────────────────────────┐
  │ 1. Abrir Site ──> 2. Clicar em "Gravar" ──> 3. Interagir     │
  │                                               │             │
  │ 4. Executar Replay <── ou ──> 5. Baixar Script .spec.js     │
  └─────────────────────────────────────────────────────────────┘
```

1. **Abra o site alvo**: Navegue até a aplicação web que deseja gravar (ex: `https://playwright.dev/`).
2. **Inicie a gravação**:
   - Abra o popup da extensão clicando no ícone do Chrome.
   - Configure o nome do teste (ex: `fluxo de login`) e o padrão de módulo desejado (**ES Modules** ou **CommonJS**).
   - Clique em **"Gravar"**.
3. **Navegue e interaja**:
   - O badge da extensão mudará para `REC` e a barra de controle flutuante aparecerá na página.
   - Execute o fluxo normalmente: clique em links, preencha formulários, marque opções e submeta dados.
4. **Reproduza o teste (Replay)**:
   - Clique em **"Executar Gravação"** no popup.
   - Observe o teste sendo executado sozinho na tela com destaque visual a cada passo.
5. **Baixe o arquivo**:
   - Clique em **"Baixar (.js)"** no popup ou em **"💾 Baixar .js"** no widget flutuante da página.
   - O arquivo `.spec.js` será salvo na sua pasta de Downloads.

---

## 🧪 Exemplo de Código Gerado

Abaixo está um exemplo real de código Playwright produzido automaticamente pela extensão:

```javascript
// @ts-check
import { test, expect } from '@playwright/test';

test("busca e navegacao na documentacao", async ({ page }) => {
  // Navegar para https://playwright.dev/
  await page.goto("https://playwright.dev/");

  // Clicar em link "Get started"
  await page.getByRole('link', { name: 'Get started' }).click();

  // Clicar em button "Search"
  await page.getByRole('button', { name: 'Search' }).click();

  // Preencher campo placeholder "Search docs" com "locators"
  await page.getByPlaceholder("Search docs").fill("locators");

  // Pressionar Enter em campo placeholder "Search docs"
  await page.getByPlaceholder("Search docs").press("Enter");
});
```

---

## 💻 Como Executar os Testes Baixados

Você pode executar os arquivos gravados diretamente no ambiente Node.js com o Playwright Test Runner instalado:

1. Coloque o arquivo baixado dentro da pasta `tests/` deste repositório (ou em qualquer projeto Playwright).
2. Execute o comando no terminal:
   ```bash
   npx playwright test
   ```

3. Para visualizar a execução em modo interativo com a interface gráfica do Playwright:
   ```bash
   npx playwright test --ui
   ```

---

## 📁 Estrutura e Arquitetura

```text
PlaywrightTestRecorder/
├── extension/                       # Diretório da Extensão Chrome (Manifest V3)
│   ├── manifest.json                # Configurações de permissões, scripts e metadados
│   ├── icons/                       # Ícones oficiais (16x16, 48x48, 128x128)
│   ├── background/
│   │   └── service-worker.js        # Background worker: orquestração, replay e badges
│   ├── content/
│   │   ├── locator-generator.js     # Motor de resolução e geração de seletores
│   │   └── content.js               # Captura de eventos, replay e widget flutuante
│   ├── popup/
│   │   ├── popup.html               # Interface do popup (HTML5 semântico)
│   │   ├── popup.css                # Estilização profissional dark mode
│   │   └── popup.js                 # Controlador da UI, preview e download
│   └── utils/
│       └── code-generator.js        # Formatador de código Playwright em JavaScript
├── tests/                           # Suíte de testes unitários do projeto
│   ├── recorder-generator.test.cjs  # Validação de Manifest e gerador de código
│   └── locator-generator.test.cjs   # Validação de seletores e resolução de elementos
├── scripts/
│   └── generate-icons.js            # Gerador automatizado de ícones PNG
├── playwright.config.js             # Configurações do Playwright para execução E2E
├── package.json                     # Scripts de desenvolvimento e dependências
├── LICENSE                          # Licença MIT
└── README.md                        # Documentação do projeto
```

---

## 🧪 Testes Automatizados

O projeto conta com uma suíte de testes unitários que valida a consistência do manifesto, integridade dos ícones, precisão da geração de seletores Playwright e formatação do código em ESM/CommonJS:

Execute os testes com o runner nativo do Node.js:

```bash
npm test
```

Saída esperada:
```text
✔ PlaywrightLocatorGenerator chooses correct locator strategies
✔ PlaywrightLocatorGenerator.findElement resolves elements correctly
✔ manifest.json is valid Manifest V3 and all files exist
✔ generates valid Playwright script (ESM)
✔ generates valid Playwright script (CommonJS)
ℹ tests 5 | pass 5 | fail 0
```

---

## 🗺️ Roadmap & Próximos Passos

- [x] Gravação de cliques, digitação, seleção, checkboxes e teclas especiais.
- [x] Motor de seletores Playwright com priorização inteligente.
- [x] Download instantâneo de arquivos `.spec.js`.
- [x] Execução (Replay) direta no navegador com destaque visual.
- [ ] Exportação em **TypeScript** e **Python (PyTest)**.
- [ ] Captura de asserções visuais e verificações de texto (`toBeVisible`, `toHaveText`).
- [ ] Suporte a gravação de uploads de arquivo (`setInputFiles`).

---

## 🤝 Contribuindo

Contribuições são muito bem-vindas! Se você deseja colaborar:

1. Faça um Fork do projeto (`git checkout -b feature/minha-feature`).
2. Crie uma branch para a sua funcionalidade.
3. Garanta que os testes estejam passando executando `npm test`.
4. Faça o Commit de suas alterações (`git commit -m 'feat: adiciona nova funcionalidade'`).
5. Envie para o branch principal (`git push origin feature/minha-feature`).
6. Abra um **Pull Request**.

---

## 📄 Licença

Este projeto está sob a licença **MIT**. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

<div align="center">
  <sub>Desenvolvido para simplificar e acelerar a automação de testes com Playwright.</sub>
</div>
