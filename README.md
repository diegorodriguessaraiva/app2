# 📬 Triagem — Caixa de Entrada Inteligente

App para **ler e-mails e classificá-los por relevância** (Alta / Média / Baixa),
ordenando-os de forma **decrescente**, com **alertas e notificações**, e recursos
de **organização**. Interface com **design iOS** (light/dark automático).

![Design iOS](https://img.shields.io/badge/design-iOS-007AFF) ![React](https://img.shields.io/badge/React-18-61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6) ![Vite](https://img.shields.io/badge/Vite-5-646CFF)

## ✨ Funcionalidades

| Recurso | Descrição |
|---|---|
| 🎯 **Triagem por relevância** | Motor de pontuação (0–100) que classifica cada e-mail em **Alta 🔴 / Média 🟠 / Baixa 🟢** |
| ⬇️ **Ordenação decrescente** | A caixa de entrada é ordenada do mais relevante para o menos relevante |
| 🔔 **Alertas** | Banner de destaque quando há e-mails de alta relevância não lidos |
| 📲 **Notificações** | Integração com a **Notification API** do navegador (botão 🔕/🔔 no topo) |
| 🗂️ **Organização** | Favoritar ⭐️, arquivar, excluir, marcar como lido/não lido, pastas (Entrada, Favoritos, Arquivo, Lixeira) |
| 🔍 **Busca e filtros** | Busca por remetente/assunto + segmented control por relevância |
| 📊 **Resumo** | Cartões com a contagem de e-mails por nível de relevância |
| 🧠 **Explicabilidade** | Cada e-mail mostra **por que** recebeu aquela pontuação (motivos legíveis) |
| 💾 **Persistência** | Estado salvo em `localStorage` — suas ações permanecem entre sessões |

## 🧮 Como a relevância é calculada

O arquivo [`src/relevance.ts`](src/relevance.ts) pontua cada e-mail combinando vários sinais:

- **Remetente importante (VIP)** → +22
- **Endereçado diretamente a você** (vs. newsletter/lista) → +8 / −10
- **Palavras de urgência** (urgente, prazo, vence, hoje…) → até +24
- **Palavras de importância** (reunião, contrato, fatura, entrevista…) → até +18
- **Ruído promocional** (promoção, desconto, cupom, unsubscribe…) → até −28
- **Categoria** (financeiro/trabalho +6, promoções −14, social −6)
- **Anexos** → +6 · **Não lido** → +4 · **Recência** (recente +8 / antigo −8)

Faixas: **≥ 70 = Alta · 45–69 = Média · < 45 = Baixa**.

> Os e-mails de exemplo estão em [`src/data.ts`](src/data.ts). Em um app real, essa
> lista viria de uma conta conectada (IMAP, Gmail API ou Microsoft Graph); basta
> substituir a fonte de dados mantendo o mesmo formato `Email`.

## 🚀 Como rodar

```bash
npm install
npm run dev       # ambiente de desenvolvimento (http://localhost:5173)
npm run build     # build de produção em dist/
npm run preview   # serve o build de produção
```

## 🧱 Estrutura

```
src/
├── App.tsx                    # estado, filtros, notificações, orquestração
├── relevance.ts               # motor de pontuação e classificação
├── data.ts                    # e-mails de exemplo (fonte de dados)
├── types.ts                   # tipos (Email, ScoredEmail, Relevance…)
├── index.css                  # design system iOS (light/dark)
└── components/
    ├── EmailRow.tsx           # item da lista (avatar, badge, ações)
    └── EmailDetail.tsx        # sheet de detalhe + análise de relevância
```

## 🎨 Design

Segue a linguagem visual do iOS: tipografia SF, cabeçalho com *blur*, *segmented
control*, cartões arredondados, *bottom tab bar*, *sheet* deslizante e suporte
automático a **tema claro e escuro**.
