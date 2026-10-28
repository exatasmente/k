# ADR 0002 — Lembretes sem servidor

- **Status:** aceito
- **Data:** 2026-10-28

## Contexto

A especificação pede avisos: confirmar o fim da menstruação depois de 10 dias (RF01.4) e recomendar
levar o histórico à ginecologista quando os ciclos ficam irregulares (RN03). Também é natural avisar
que a menstruação está chegando. Pelo ADR 0001 não há conta nem servidor.

Sem servidor não existe push agendado pela internet. O que a web oferece hoje:

| Caminho | Onde funciona | Limite |
|---|---|---|
| Aviso dentro do app | Todos | Só quando ela abre o app |
| Sincronização periódica (`periodicSync`) acordando o service worker | Chrome/Android, app instalado | O navegador decide o horário (cerca de 1 vez por dia, conforme o uso) |
| Agenda (.ics) com alarme | Todos, inclusive iPhone | Estático: precisa baixar de novo se as previsões mudarem |
| Web Push | Todos (iPhone só com o app na Tela de Início) | Precisa de servidor, e o servidor saberia os horários, ou seja, as previsões |

## Decisões

1. **Três camadas, sem servidor:**
   - avisos dentro do app (cartões na Home), sempre;
   - notificação do sistema pelo service worker quando o aparelho permite sincronização periódica;
   - "Adicionar previsões à agenda" (.ics) como caminho confiável em qualquer aparelho.
2. **O app aberto calcula o plano; o service worker só mostra o que venceu.** O plano
   (`reminders/plan`: chave, dia, tipo, título, texto) fica cifrado como todo o resto. O service worker
   abre o banco, mostra o que venceu e marca como mostrado (`dismissals`, regra `notified`). Ele não
   precisa das regras do ciclo, então nada que mude a previsão fica duplicado.
3. **Discreto por padrão.** A notificação aparece na tela de bloqueio, então diz só "Ciclo · Você tem um
   lembrete". O assunto ("Menstruação chegando") só aparece se ela ligar. O título do evento na agenda
   segue a mesma regra, porque a agenda costuma sincronizar com Google ou iCloud.
4. **Um aviso por ciclo.** A chave usa o início do ciclo (`period_soon|<início>`), não a data prevista:
   se a previsão mudar depois de novos registros, não chega um segundo aviso. Com o app aberto no dia,
   o aviso conta como visto, porque ela já está vendo o cartão. Lembretes vencidos há mais de 3 dias não
   aparecem mais (celular desligado, por exemplo).
5. **Sem lembrete de pílula.** Sem servidor o navegador não garante horário, e um lembrete de pílula que
   falha é pior que nenhum. O app sugere usar o alarme do celular.
6. **A agenda não leva a janela fértil.** Na agenda ela pareceria um método contraceptivo. Com a
   menstruação atrasada nada é exportado, porque as previsões mudam a cada dia.
7. **Apagar os dados desliga tudo.** "Apagar meus dados" cancela a sincronização periódica, e o
   service worker não recria um banco apagado.

## Consequências

- No iPhone, as notificações fora do app ficam para quando houver servidor (Web Push). Até lá, valem a
  agenda e os avisos dentro do app.
- O service worker passa a ser empacotado no build (`vite.config.js`, esbuild), porque importa o banco
  cifrado. O banco foi para a versão 2 (store `reminders`). Uma conexão aberta em outra aba fecha
  sozinha em vez de travar a migração ou a exclusão (`onversionchange`), e a aba recarrega.
- Quando houver servidor, o mesmo plano pode alimentar o Web Push. Para o servidor não conhecer as
  previsões, uma opção é ele enviar só um "acorde" diário genérico, e o próprio aparelho decidir o que
  mostrar.
