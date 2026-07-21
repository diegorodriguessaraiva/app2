# 📬 Triagem — Caixa de Entrada Inteligente

App para **ler e-mails e classificá-los por relevância** (Alta / Média / Baixa),
ordenando de forma **decrescente**, com **alertas e notificações** e recursos de
**organização**. Agora com **Gmail real**, **classificação por IA (Claude)** e
**etiquetas + regras automáticas**. Interface com **design iOS** (light/dark).

![Design iOS](https://img.shields.io/badge/design-iOS-007AFF) ![React](https://img.shields.io/badge/React-18-61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6) ![Claude](https://img.shields.io/badge/IA-Claude%20Opus%204.8-AF52DE) ![Gmail](https://img.shields.io/badge/Gmail-OAuth-EA4335)

## ✨ Funcionalidades

| Recurso | Descrição |
|---|---|
| 📧 **Gmail real** | Conecta via OAuth (somente leitura) e traz seus e-mails de verdade |
| 🧠 **Classificação por IA** | A **Claude** (`claude-opus-4-8`) lê cada e-mail e gera pontuação, motivos e um resumo |
| 🎯 **Triagem por relevância** | **Alta 🔴 / Média 🟠 / Baixa 🟢** — por IA ou por heurística local |
| ⬇️ **Ordenação decrescente** | Do mais relevante para o menos relevante |
| 🔔 **Alertas & notificações** | Banner de destaque + **Notification API** do navegador |
| 🗂️ **Etiquetas personalizadas** | Crie etiquetas coloridas e aplique manualmente ou por regra |
| ⚡ **Regras automáticas** | "Se o assunto contém *fatura* → etiqueta Financeiro", etc. |
| 🔍 **Busca, filtros e pastas** | Entrada, Favoritos, Arquivo, Lixeira; favoritar, arquivar, excluir |
| 💾 **Persistência** | Estado, etiquetas e regras salvos em `localStorage` |

## 🏗️ Arquitetura

```
Navegador (React + Vite)                    Backend (Node/Express)
├── Triagem local (relevance.ts)            └── POST /api/classify
├── Gmail OAuth (gmail.ts) ──── Gmail API         └── Claude API (structured outputs)
├── Etiquetas + regras (rules.ts)                  chave fica SÓ no servidor
└── Cliente de IA (ai.ts) ─────────────────► /api/classify
```

- A **chave da Claude nunca vai para o navegador** — o front chama `/api/classify`
  e o backend (com `ANTHROPIC_API_KEY`) fala com a API da Anthropic usando
  **saída estruturada** (JSON garantido).
- O **Gmail** é lido direto no cliente via Google Identity Services (escopo
  `gmail.readonly`) — nada dos seus e-mails passa por servidores próprios.
- Sem chave de IA ou sem Gmail, o app **continua funcionando** com a triagem
  local e uma caixa de entrada de exemplo.

## 🚀 Como rodar

### 1. Instalar

```bash
npm install
```

### 2. Configurar (opcional, mas recomendado)

Copie `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
```

- `ANTHROPIC_API_KEY` — para a classificação por IA (crie em https://console.anthropic.com/)
- `VITE_GOOGLE_CLIENT_ID` — para conectar o Gmail (Google Cloud → Credenciais OAuth,
  com a **Gmail API** ativada e `http://localhost:5173` como origem autorizada)

### 3. Desenvolvimento (front + back juntos)

```bash
npm run dev:all
```

- App: http://localhost:5173 (Vite; `/api` é encaminhado para o backend)
- API: http://localhost:8787

### 4. Produção

```bash
npm run build   # gera dist/
npm start       # serve dist/ + API na porta 8787
```

## 🧠 Como a relevância é calculada

- **Heurística local** ([`src/relevance.ts`](src/relevance.ts)): pontua 0–100 a
  partir de remetente VIP, urgência, importância, ruído promocional, categoria,
  anexos e recência. Instantânea e offline.
- **IA (Claude)** ([`server/index.mjs`](server/index.mjs)): envia os e-mails ao
  backend, que pede à Claude uma pontuação, motivos e um resumo por e-mail, com
  **saída estruturada** para garantir um JSON válido. Ative no menu **⚙️ →
  Classificar com IA**.

Faixas: **≥ 70 = Alta · 45–69 = Média · < 45 = Baixa**.

## 🗂️ Etiquetas e regras

Em **⚙️ Configurações** você pode:
- Criar/remover **etiquetas** coloridas (aplicáveis também dentro de cada e-mail);
- Criar **regras** do tipo *condição → ação* (aplicar etiqueta, arquivar ou
  favoritar) e **aplicá-las de uma vez** à caixa de entrada.

## 🧱 Estrutura

```
server/index.mjs            # backend: proxy da IA + serve o build
src/
├── App.tsx                 # estado, filtros, IA, Gmail, orquestração
├── relevance.ts            # motor de pontuação local
├── ai.ts                   # cliente do endpoint /api/classify
├── gmail.ts                # OAuth + leitura da Gmail API
├── rules.ts                # etiquetas, regras e persistência
├── data.ts                 # e-mails de exemplo
├── types.ts                # tipos
├── index.css               # design system iOS (light/dark)
└── components/
    ├── EmailRow.tsx         # item da lista (etiquetas, badge IA)
    ├── EmailDetail.tsx      # detalhe + análise + etiquetas
    └── SettingsSheet.tsx    # Gmail, IA, etiquetas e regras
```

## 🔒 Privacidade

- Sua chave da Claude fica apenas no servidor (variável de ambiente).
- O acesso ao Gmail é **somente leitura** e o token vive só na aba do navegador.
- Nenhum e-mail é armazenado em banco de dados — só no seu `localStorage`.
