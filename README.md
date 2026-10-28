# Ciclo (nome provisório)

App de acompanhamento menstrual local-first: zero fricção, privacidade rigorosa (LGPD) e regras
de saúde explicáveis.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/domain/` | Regras puras: ciclo e previsão, regularidade, alertas, três estados de registro, gestação, catálogo, privacidade |
| `src/data/` | Banco local: esquema, validadores, criptografia (AES-GCM) e repositório IndexedDB |
| `src/app/` | Store (liga banco e domínio), view-models das telas, lembretes e interface em Preact |
| `src/sw.js` | Service worker: abre offline e mostra os lembretes (empacotado no build) |
| `test/` | Testes das regras (`node --test`) |
| `e2e/` | Cenários de ponta a ponta no navegador (Playwright), no app construído |
| `docs/` | ADRs e modelo de dados |
| `prototype/` | Fontes do protótipo de alta fidelidade (canvas interativo) |

## Rodar

Requer Node 20 ou mais recente.

```sh
npm install
npm run dev      # app em modo desenvolvimento
npm test         # testes das regras, do banco e das telas (sem navegador)
npm run test:e2e # constrói e roda os cenários num Chromium de celular (precisa de `npx playwright install chromium` na 1ª vez)
npm run build    # gera o PWA em dist/
```

## Publicar

O workflow `.github/workflows/pages.yml` publica o PWA no GitHub Pages a cada push na `master`.
Antes, ative em **Settings → Pages → Source: GitHub Actions**. No celular, abra o endereço e use
"Adicionar à tela inicial": instalado, o navegador não apaga os dados.

## Documentos

- [ADR 0001 — Arquitetura do MVP](docs/adr/0001-arquitetura-mvp.md)
- [ADR 0002 — Lembretes sem servidor](docs/adr/0002-lembretes-sem-servidor.md)
- [Fontes clínicas dos alertas](docs/fontes-clinicas.md)
- [Modelo de dados](docs/modelo-de-dados.md)
