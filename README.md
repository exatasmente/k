# Ciclo (nome provisório)

App de acompanhamento menstrual local-first: zero fricção, privacidade rigorosa (LGPD) e regras
de saúde explicáveis.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/domain/` | Regras puras: ciclo e previsão, regularidade, alertas, três estados de registro, gestação, catálogo, privacidade |
| `src/data/` | Esquema do banco local (IndexedDB cifrado) e validadores |
| `test/` | Testes das regras (`node --test`) |
| `docs/` | ADRs e modelo de dados |
| `prototype/` | Fontes do protótipo de alta fidelidade (canvas interativo) |

## Rodar os testes

Requer Node 20 ou mais recente, sem dependências.

```sh
npm test
```

## Documentos

- [ADR 0001 — Arquitetura do MVP](docs/adr/0001-arquitetura-mvp.md)
- [Modelo de dados](docs/modelo-de-dados.md)
