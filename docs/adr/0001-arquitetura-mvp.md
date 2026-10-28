# ADR 0001 — Arquitetura do MVP

- **Status:** aceito
- **Data:** 2026-10-28

## Contexto

App de acompanhamento menstrual com foco em zero fricção, privacidade rigorosa (LGPD) e
alternativa ao design engessado dos concorrentes. No início, quem usa é só a autora,
talvez algumas amigas testando. O protótipo de alta fidelidade foi validado antes do código.

## Decisões

### 1. PWA em JavaScript, local-first
- O app é um **PWA** (JavaScript, sem TypeScript por enquanto), instalado na tela inicial.
- **O aparelho é a fonte da verdade.** Os dados ficam no IndexedDB e o app funciona offline (RNF06).
- **Sem conta e sem servidor no MVP.** Cada testadora usa no próprio celular. Conta e sincronização só
  entram quando houver backup em nuvem ou uso em mais de um aparelho.
- O esquema já é preparado para sincronizar depois: `updatedAt` e `deletedAt` (lápide) em todo
  registro, com "última escrita vence" por id.
- **Risco do PWA:** o Safari pode apagar dados de sites que não foram instalados na tela inicial.
  Mitigação: pedir a instalação, chamar `navigator.storage.persist()` e oferecer exportação/backup em JSON.

### 2. Criptografia em repouso (RNF02)
- Cada registro é gravado como envelope `{id, iv, data}`, com `data` cifrado em **AES-GCM 256** por
  uma chave não exportável do aparelho (WebCrypto). Um PIN opcional pode derivar a chave depois.
- **Nenhum índice além do `id`**: índices por data ou por código vazariam o conteúdo. O app carrega e
  decifra tudo em memória ao abrir (alguns anos de uso cabem em poucos MB).
- Limite honesto: isso protege contra cópia de arquivos e backups do navegador, não contra alguém com
  o aparelho desbloqueado e o app aberto. O bloqueio do aparelho continua sendo essencial.

### 3. Regras no domínio, determinísticas e testadas
- Previsão, regularidade, alertas (PDS, sinais de alerta da gestação) e estatísticas são **funções puras**
  em `src/domain`, testadas com `node --test`. Nenhuma depende da IA.
- A IA (fase seguinte) interpreta a pergunta e chama essas funções; os números vêm do código.

### 4. Regras de produto fechadas no protótipo
- **Previsão em janela:** do ciclo recente mais curto ao mais longo (nunca menor que média ± 1);
  "atrasada" só depois que a janela passa.
- **Regularidade (RN03) em dois tons:** um único ciclo fora da curva gera aviso suave e sai da média;
  variação acima de 8 dias mesmo sem ele é "irregular". Pausada na gestação, no pós-parto e até
  3 ciclos novos depois.
- **"Não registrou" ≠ "não teve":** três estados por dia e por categoria (teve / não teve / sem registro).
  Um ciclo só entra em "X de Y ciclos" se tiver algum dia observado na categoria. Ao encerrar a
  menstruação sem sintomas registrados, o app pergunta uma vez pelo ciclo todo.
- **Sem janela fértil** para métodos que suprimem a ovulação.
- **Modo gestação** com catálogo próprio, sinais de alerta locais e datação pela DUM ou pela DPP da
  ultrassonografia. Encerrar segue para pós-parto ou ciclo.

### 5. Privacidade e LGPD
- **Perfil sem identificação direta:** sem nome, e-mail, telefone ou foto. Só data de nascimento,
  dados do onboarding e preferências.
- **Desfecho da gestação nunca é perguntado nem guardado** (parto, perda ou interrupção). Só datas.
- **Exclusão (RNF05 revisado):** apaga do aparelho tudo que identifica a pessoa e o histórico detalhado.
  Pode ficar um registro **anônimo**, para uso interno e nunca repassado a terceiros (art. 16, IV), desde
  que seja anônimo de verdade (art. 12): sem datas, idade em anos, sem vida sexual, PDS, testes ou
  gestação, e durações ordenadas sem a sequência no tempo (`src/domain/privacy.js`).
- Com poucas usuárias, até dados agregados podem reidentificar. O registro anônimo só deve ser usado
  em conjunto, nunca individualmente.
- **Consentimento da IA é opcional** e separado do onboarding (art. 11).

## Pendências
- **Revisão médica antes de abrir para terceiras:** lista e semanas dos sinais de alerta da gestação,
  métodos que suprimem ovulação e todos os textos de orientação (`COPY` em `rules.js`).
- **Próximos ADRs:** camada de armazenamento cifrado (repositório IndexedDB) e o backend mínimo
  da IA (proxy sem estado, contrato de zero retenção com o provedor, transferência internacional, art. 33).
