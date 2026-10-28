# Fontes clínicas dos alertas

Cada alerta e orientação de saúde do app tem fonte. O texto fica em `src/domain/rules.js` (`COPY`), a lista
de fontes de cada texto em `COPY_SOURCES` e as referências em `src/domain/sources.js`. O app mostra
"Fonte: ..." embaixo de cada alerta, e a lista completa fica em **Ajustes → Fontes clínicas dos alertas**.

Preferência de fonte: Ministério da Saúde e OMS; depois sociedades médicas (FIGO, ACOG, FSRH, NICE, CDC, NHS)
e artigos revisados por pares. Os trechos abaixo foram conferidos no texto da fonte em 28/10/2026.

> **Ainda falta revisão por profissional de saúde** (ginecologista e obstetra) antes de abrir o app para
> outras pessoas. As fontes sustentam os números e as recomendações; a forma de dizer é do app.

## Ciclo menstrual

| Regra no app | Fonte e trecho |
|---|---|
| **Regularidade (RN03):** irregular quando a variação entre o ciclo mais curto e o mais longo passa do normal para a idade: até **9 dias** (18–25 anos), até **7** (26–41), até **9** (42–45); sem idade, até 8. Um ciclo ocasional fora da curva vira "um ciclo fora do padrão". | FIGO 2018 (Munro et al., Int J Gynaecol Obstet 143:393): "variation of 7–9 days, depending upon age (18–25 years ≤9 days; 26–41 years ≤7 days; 42–45 years ≤9 days)"; "using the 75th percentile, effectively excluding the occasional long or short cycles". Tabela 1: "Normal variation (shortest to longest) 8 days". |
| A especificação original dizia "6 meses"; o app usa os **6 últimos ciclos**. | A FIGO não fixa número de ciclos; ela fala em alteração presente "for the majority of the preceding 6 months". É decisão de produto. |
| **Menstruação longa:** aviso quando passa de **8 dias**. | FIGO 2018, Tabela 1: "Normal: ≤8 days / Prolonged: >8 days". ACOG (Heavy Menstrual Bleeding): "Bleeding that lasts more than 7 days." |
| **Sangramento fora da menstruação ou depois da relação:** aviso para avaliação. Com método hormonal, só o que vem logo depois da relação. | ACOG (Abnormal Uterine Bleeding): "Bleeding or spotting between periods", "Bleeding or spotting after sex". NHS (Heavy periods): "you bleed between periods or after sex". MS, Protocolos Saúde das Mulheres 2016: "sangramento pós-coito: é desencadeado pelo ato sexual e, geralmente, decorre de patologias da vagina ou do colo uterino"; escape é comum com anticoncepcional oral combinado. |
| **Fluxo intenso** (ficha do "Intenso"). | ACOG (Heavy Menstrual Bleeding): "soaks through one or more tampons or pads every hour for several hours in a row". FIGO 2018 define fluxo intenso pelo impacto na qualidade de vida. "Tontura, fraqueza ou desmaio → atendimento" é tradução leiga do fluxograma do MS 2016 (sinais de instabilidade → urgência). |
| **Duração da menstruação:** a que ela informa no cadastro (pode mudar nos Ajustes). Vale para as menstruações previstas e para fechar uma menstruação esquecida (RF01.4). A média registrada aparece só como informação no Resumo. Se ela informar mais de 8 dias, o app avisa que merece avaliação. | Decisão dela (dona do produto). O aviso acima de 8 dias segue a FIGO 2018 (ver "Menstruação longa"). |
| **Mais de 3 meses sem menstruação** (sem método hormonal). | AAFP 2019 (Klein et al.): "cessation of previously regular menses for three months or previously irregular menses for six months and warrants evaluation". NHS (Stopped or missed periods): "you've missed your period 3 times in a row". |
| **Atraso:** "Estresse, doenças, mudança grande de peso ou exercício muito intenso podem atrasar o ciclo." (viagem saiu: não achamos fonte) | NHS: "Common causes of a missed or late period include: being pregnant, stress, sudden weight loss, … doing too much exercise". MS 2016 (amenorreia hipotalâmica): "Estresse situacional, exercícios físicos intensos, perda de peso". |
| **Dor** que atrapalha a rotina ou vem piorando → consulta. | NICE NG73: "period-related pain (dysmenorrhoea) affecting daily activities and quality of life". ACOG (Dysmenorrhea): "keeps them from doing their normal activities". |
| **Corrimento** com coceira, ardor, cheiro, dor na barriga ou febre → avaliação. | ACOG (Vaginitis): "itching, burning, a bad odor". MS 2016: sinais de alerta "dor abdominal… febre". |
| **Pós-parto:** a menstruação pode demorar, principalmente amamentando; dá para engravidar antes dela. A avaliação de regularidade recomeça do zero: precisa de 3 ciclos novos, como para qualquer pessoa, sem misturar os ciclos de antes da gestação. | NHS (Sex and contraception after birth): "You're unlikely to have any periods if you breastfeed exclusively…"; "You can get pregnant 3 weeks after the birth of a baby…". Jackson e Glasier 2011 (sem amamentar): "20%-71% of first menses were preceded by ovulation" (as primeiras menstruações muitas vezes vêm sem ovulação). Cochrane 2015 (amamentando): "The life table menstruation rate at six months in all studies varied between 11.1% and 39.4%". |

## Previsão e janela fértil

| Regra no app | Fonte e trecho |
|---|---|
| Média dos **6 últimos ciclos**. | OMS, Handbook 2022, cap. 18 (calendário): "always using the 6 most recent cycles". |
| Sem histórico, próxima menstruação em **média ± 3 dias** (antes ± 2). | Bull et al., npj Digit Med 2019 (600 mil ciclos): variação de cada pessoa de ~2,6 dias (desvio-padrão), maior antes dos 25 e depois dos 40. O ± 3 é derivado desse dado. |
| **Janela fértil** pela regra do calendário: do dia (ciclo mais curto − 18) ao dia (ciclo mais longo − 11). Usa os 6 últimos ciclos, inclusive um fora do padrão. | OMS, Handbook 2022, cap. 18: "subtracts 18 from the length of her shortest recorded cycle … subtracts 11 days from the length of her longest recorded cycle". MS, CAB 26 (2013): "Subtraindo-se 18 do ciclo mais curto, obtém-se o dia do início do período fértil." |
| Ovulação marcada 14 dias antes da próxima menstruação, como **ponto mais provável**. | MS, CAB 26: "ovulação ocorrendo entre 11 e 16 dias antes do início da próxima menstruação". Bull 2019: fase lútea média de 12,4 dias (IC 95% 7–17). |
| Aviso de **estimativa pouco confiável** quando os ciclos variam 10 dias ou mais. | MS, CAB 26: "Se a diferença entre o ciclo mais longo e o mais curto for de 10 dias ou mais, a mulher não deve usar esse método." |
| "**Não serve para evitar gravidez**"; calendário falha para ~15–20 em 100 por ano. | Wilcox et al., BMJ 2000: "In only about 30% of women is the fertile window entirely within … days 10 and 17"; "On every day between days 6 and 21, women had at minimum a 10% probability of being in their fertile window." MS, CAB 26: "taxa de gravidez de 20 em 100 mulheres no primeiro ano de uso". OMS, Handbook: "about 15 pregnancies per 100 women using periodic abstinence". |

## Métodos contraceptivos

| Regra no app | Fonte e trecho |
|---|---|
| **Sem janela fértil** com pílula combinada, desogestrel, implante, injeção, anel e adesivo (impedem a ovulação). | OMS, Handbook 2022 (caps. 1, 4, 5, 6, 7, 9): "Work[s] primarily by preventing the release of eggs from the ovaries (ovulation)". FSRH (Progestogen-only Pills 2022): "The contraceptive effect of DSG and DRSP POPs relies primarily on inhibition of ovulation." |
| **DIU hormonal e minipílula:** ovulação incerta → sem janela fértil, e a proteção vem do método. | FSRH (Intrauterine Contraception 2023): "the majority (>75%) of individuals continue to ovulate". FSRH POP: "LNG and NET POPs do not reliably suppress ovulation". |
| **DIU de cobre:** mostra a janela com o aviso de que o DIU protege todos os dias. | OMS, Handbook, cap. 10: age por mudança química que danifica espermatozoide e óvulo, sem atuar na ovulação. |
| Com **método hormonal**, não avaliamos regularidade nem ausência de menstruação. | CDC US SPR 2024: "Amenorrhea does not require any medical treatment. Provide reassurance."; "If a patient's regular bleeding pattern changes abruptly to amenorrhea, consider ruling out pregnancy". |
| **Pílula do dia seguinte (RN04):** cartão **informativo** (não alerta) na 2ª vez no ciclo ou na 4ª em 12 meses. Não é limite de segurança: é o momento de informar que ela protege por pouco tempo, que o uso frequente bagunça o ciclo e que um método contínuo protege mais. Tiramos "alta carga hormonal". | ICEC 2015: "Medical research provides no basis for limiting the number of times that women use ECPs, even within the same cycle"; "still at risk of pregnancy later in that same cycle since ECPs can work by delaying ovulation"; "ongoing methods of contraception are more effective than ECPs". OMS, MEC 6ª ed. (2025): "there are no restrictions on the use of ECPs more than once in a menstrual cycle (MEC Category 1)". OMS (fact sheet): "Frequent use of emergency contraception can result in increased side-effects, such as menstrual irregularities, although their repeated use poses no known health risks". MS 2011: "o uso repetitivo da AE é menos eficiente que os métodos anticonceptivos de rotina"; "se utilizada com frequência, a AE apresenta as mesmas contraindicações de qualquer método anticonceptivo hormonal". |

A bula brasileira do levonorgestrel diz que o medicamento "causa malformação ao bebê se usado durante a gravidez".
OMS e FSRH dizem o contrário ("no evidence of … fetal abnormality"). O app não repete essa frase.

## Gestação

| Regra no app | Fonte e trecho |
|---|---|
| **Sinais de alerta** (busque atendimento imediatamente; se precisar, SAMU 192): sangramento, dor forte ou persistente na barriga, dor na boca do estômago, dor de cabeça forte ou que não melhora, alteração na visão, inchaço repentino no rosto, mãos ou pernas, pressão ≥ 14 por 9, febre ≥ 37,8 °C, dor ou ardência ao urinar, manchas vermelhas na pele ou olhos vermelhos, mal-estar intenso, dor forte no peito, falta de ar, convulsão, desmaio, bebê mexendo menos. | Caderneta Brasileira da Gestante (MS, 2026), "Busque atendimento imediatamente se houver:" (lista de 16 sinais); "procure o serviço de saúde mais próximo, incluindo a UBS. Se necessário, dirija-se à sua maternidade de referência ou a um serviço de urgência mais próximo, ou acione o Samu 192." |
| Também: perda de líquido e contrações regulares (a partir de 20 semanas). | MS, CAB 32 (2012), encaminhamento à urgência: "Amniorrexe prematura: perda de líquido vaginal"; "Trabalho de parto prematuro (contrações…)". |
| Também: vômitos que impedem comer, dor ou inchaço numa perna só, pensamentos de se machucar ou machucar o bebê. | CDC (Urgent Maternal Warning Signs, 2024); a Caderneta traz os dois últimos na lista do pós-parto. |
| **Bebê mexendo menos** a partir de **20 semanas** (antes era 28). | Caderneta 2026: "Diminuição ou ausência dos movimentos do bebê, especialmente se ficar mais de 4 horas sem se mexer após as 20 semanas de gestação." |
| **41 semanas:** procurar a maternidade para avaliação. | MS, CAB 32: encaminhar "IG a partir de 41 semanas confirmadas". |
| **DPP** = DUM + 280 dias; só ~5 em 100 nascem na data; o ultrassom do início é o mais preciso. | MS, CAB 32: "280 dias ou 40 semanas, a partir da DUM". Khambalia et al. 2013: "Only 5% of births occurred on the eDOB". ACOG CO 700: ultrassom até 13 6/7 semanas "is the most accurate method". |
| **Teste de gravidez:** positivo a partir do dia do atraso, mais confiável 1–2 semanas depois; negativo com atraso → repetir. O aviso de "teste cedo demais" usa o ciclo dela. | NHS: "a negative test result is less reliable … wait a few days and try again". FDA: "10 to 20 pregnant women out of every 100 will not detect their pregnancy on the first day of their missed period". MS, CAB 32: hCG "pode ser detectado no sangue … entre 8 a 11 dias após a concepção". |
| **Remédios:** a assistente não indica nem avalia, e orienta não parar por conta própria. | MS, CAB 32: queixas comuns "diminuem ou desaparecem sem o uso de medicamentos, que devem ser evitados ao máximo". Caderneta 2026: "não interrompa nada por conta própria". ANVISA, RDC 47/2009: "Não use medicamento sem o conhecimento do seu médico. Pode ser perigoso para a sua saúde." |

## Pós-parto

| Regra no app | Fonte e trecho |
|---|---|
| **Sinais de alerta no pós-parto** (lista no cartão do pós-parto). | Caderneta 2026: "Sangramento intenso que encharca o absorvente rapidamente ou sangramento com mau cheiro"; "Febre (temperatura igual ou maior a 37,8°C)"; "Dor, calor ou inchaço em uma das pernas"; "pensamentos de machucar a si mesma ou ao bebê"; e os demais da lista. |
| "Menstruei" nas **primeiras 6 semanas** pergunta se não é lóquio. | Caderneta 2026: lóquio "podendo durar cerca de 42 dias". |

## O que é decisão de produto

- Quando mostrar o cartão da pílula do dia seguinte (2ª vez no ciclo ou 4ª em 12 meses). As fontes dizem que não há
  limite de uso; o cartão só informa.
- Fechar uma menstruação aberta há 10 dias (RF01.4, da especificação) com a duração que ela informou. Desde o 9º dia
  já aparece o aviso de menstruação longa.
- Janela de previsão do ciclo mais curto ao mais longo (mínimo média ± 1).

## Pendências

- Revisão por ginecologista e obstetra de todos os textos.
- Sinais de alerta no pós-parto como itens de registro (hoje são só uma lista informativa).
- Orientação de comprimido esquecido e injeção atrasada (OMS, Handbook: limites por método).
