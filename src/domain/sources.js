// Fontes clínicas dos alertas e textos de saúde. Cada texto em rules.js (COPY) aponta
// para as fontes que o sustentam (COPY_SOURCES); o app mostra a fonte junto do alerta.
// Trechos literais e o que cada fonte sustenta: docs/fontes-clinicas.md.
// Preferência: Ministério da Saúde e OMS; depois sociedades médicas e artigos revisados por pares.

export const SOURCES = Object.freeze({
  ms_caderneta_2026: {
    short: 'Caderneta da Gestante (MS, 2026)',
    title: 'Ministério da Saúde. Caderneta Brasileira da Gestante. Brasília, 2026.',
    url: 'https://www.gov.br/saude/pt-br/composicao/saps/publicacoes/cadernetas-e-cartoes/caderneta-brasileira-da-gestante.pdf',
  },
  ms_cab32_2012: {
    short: 'Pré-natal de baixo risco (MS, 2012)',
    title: 'Ministério da Saúde. Cadernos de Atenção Básica nº 32: Atenção ao pré-natal de baixo risco. Brasília, 2012.',
    url: 'https://bvsms.saude.gov.br/bvs/publicacoes/cadernos_atencao_basica_32_prenatal.pdf',
  },
  ms_cab26_2013: {
    short: 'Saúde sexual e reprodutiva (MS, 2013)',
    title: 'Ministério da Saúde. Cadernos de Atenção Básica nº 26: Saúde sexual e saúde reprodutiva. Brasília, 2013.',
    url: 'https://bvsms.saude.gov.br/bvs/publicacoes/saude_sexual_saude_reprodutiva.pdf',
  },
  ms_mulheres_2016: {
    short: 'Protocolos Saúde das Mulheres (MS, 2016)',
    title: 'Ministério da Saúde. Protocolos da Atenção Básica: Saúde das Mulheres. Brasília, 2016.',
    url: 'https://bvsms.saude.gov.br/bvs/publicacoes/protocolos_atencao_basica_saude_mulheres.pdf',
  },
  ms_ae_2011: {
    short: 'Anticoncepção de emergência (MS, 2011)',
    title: 'Ministério da Saúde. Anticoncepção de emergência: perguntas e respostas para profissionais de saúde. 2ª ed. Brasília, 2011.',
    url: 'https://bvsms.saude.gov.br/bvs/publicacoes/anticoncepcao_emergencia_perguntas_respostas_2ed.pdf',
  },
  who_ec: {
    short: 'OMS: contracepção de emergência',
    title: 'World Health Organization. Emergency contraception (fact sheet).',
    url: 'https://www.who.int/news-room/fact-sheets/detail/emergency-contraception',
  },
  icec_2015: {
    short: 'ICEC 2015 (uso repetido)',
    title: 'International Consortium for Emergency Contraception. Repeated use of emergency contraceptive pills: the facts. 2015.',
    url: 'https://www.ec-ec.org/wp-content/uploads/2016/11/ICEC_Repeat-Use_Oct-2015.pdf',
  },
  who_mec_2025: {
    short: 'OMS: critérios de elegibilidade (2025)',
    title: 'World Health Organization. Medical eligibility criteria for contraceptive use, 6th ed. 2025.',
    url: 'https://www.who.int/publications/i/item/9789240115583',
  },
  jackson_2011: {
    short: 'Jackson e Glasier, 2011',
    title: 'Jackson E, Glasier A. Return of ovulation and menses in postpartum nonlactating women: a systematic review. Obstet Gynecol. 2011;117(3):657-62.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/21343770/',
  },
  cochrane_lam_2015: {
    short: 'Cochrane 2015 (amamentação)',
    title: 'Van der Wijden C, Manion C. Lactational amenorrhoea method for family planning. Cochrane Database Syst Rev. 2015;CD001329.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/26457821/',
  },
  who_fp_handbook_2022: {
    short: 'OMS: Manual de Planejamento Familiar (2022)',
    title: 'WHO/Johns Hopkins CCP. Family Planning: A Global Handbook for Providers. 2022.',
    url: 'https://fphandbook.org/',
  },
  figo_2018: {
    short: 'FIGO 2018',
    title: 'Munro MG, Critchley HOD, Fraser IS. The two FIGO systems for normal and abnormal uterine bleeding symptoms… 2018 revisions. Int J Gynaecol Obstet. 2018;143(3):393-408.',
    url: 'https://doi.org/10.1002/ijgo.12666',
  },
  acog_aub: {
    short: 'ACOG: sangramento uterino anormal',
    title: 'American College of Obstetricians and Gynecologists. Abnormal Uterine Bleeding (FAQ095).',
    url: 'https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding',
  },
  acog_hmb: {
    short: 'ACOG: fluxo menstrual intenso',
    title: 'American College of Obstetricians and Gynecologists. Heavy Menstrual Bleeding (FAQ193).',
    url: 'https://www.acog.org/womens-health/faqs/heavy-menstrual-bleeding',
  },
  acog_dysmenorrhea: {
    short: 'ACOG: cólica menstrual',
    title: 'American College of Obstetricians and Gynecologists. Dysmenorrhea: Painful Periods (FAQ046).',
    url: 'https://www.acog.org/womens-health/faqs/dysmenorrhea-painful-periods',
  },
  acog_vaginitis: {
    short: 'ACOG: vaginite',
    title: 'American College of Obstetricians and Gynecologists. Vaginitis (FAQ028).',
    url: 'https://www.acog.org/womens-health/faqs/vaginitis',
  },
  nice_ng73: {
    short: 'NICE NG73 (endometriose)',
    title: 'National Institute for Health and Care Excellence. Endometriosis: diagnosis and management (NG73).',
    url: 'https://www.nice.org.uk/guidance/ng73/chapter/Recommendations',
  },
  aafp_amenorrhea_2019: {
    short: 'AAFP 2019 (amenorreia)',
    title: 'Klein DA, Paradise SL, Reeder RM. Amenorrhea: A Systematic Approach to Diagnosis and Management. Am Fam Physician. 2019;100(1):39-48.',
    url: 'https://www.aafp.org/pubs/afp/issues/2019/0701/p39.html',
  },
  nhs_missed_periods: {
    short: 'NHS: menstruação atrasada',
    title: 'NHS. Stopped or missed periods.',
    url: 'https://www.nhs.uk/conditions/stopped-or-missed-periods/',
  },
  nhs_pregnancy_test: {
    short: 'NHS: teste de gravidez',
    title: 'NHS. Doing a pregnancy test.',
    url: 'https://www.nhs.uk/pregnancy/trying-for-a-baby/doing-a-pregnancy-test/',
  },
  nhs_after_birth: {
    short: 'NHS: sexo e contracepção após o parto',
    title: 'NHS. Sex and contraception after birth.',
    url: 'https://www.nhs.uk/baby/support-and-services/sex-and-contraception-after-birth/',
  },
  cdc_hear_her: {
    short: 'CDC: sinais de alerta maternos',
    title: 'Centers for Disease Control and Prevention. Urgent Maternal Warning Signs (Hear Her). 2024.',
    url: 'https://www.cdc.gov/hearher/maternal-warning-signs/index.html',
  },
  cdc_spr_2024: {
    short: 'CDC US SPR 2024',
    title: 'Curtis KM et al. U.S. Selected Practice Recommendations for Contraceptive Use, 2024. MMWR Recomm Rep. 2024;73(RR-3).',
    url: 'https://www.cdc.gov/mmwr/volumes/73/rr/rr7303a1.htm',
  },
  fsrh_iuc_2023: {
    short: 'FSRH: contracepção intrauterina',
    title: 'Faculty of Sexual and Reproductive Healthcare. Intrauterine Contraception. 2023 (emendada em 2025).',
    url: 'https://cosrh.org/Common/Uploaded%20files/documents/fsrh-clinical-guideline-intrauterine-contraception-mar-23-amended.pdf',
  },
  fsrh_pop_2022: {
    short: 'FSRH: pílulas só de progestagênio',
    title: 'Faculty of Sexual and Reproductive Healthcare. Progestogen-only Pills. 2022 (emendada em 2026).',
    url: 'https://cosrh.org/Common/Uploaded%20files/documents/fsrh-ceu-clinical-guideline-progestogen-only-pills-aug22-amended-11july-2023-.pdf',
  },
  wilcox_2000: {
    short: 'Wilcox et al., BMJ 2000',
    title: 'Wilcox AJ, Dunson D, Baird DD. The timing of the "fertile window" in the menstrual cycle. BMJ. 2000;321:1259-62.',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC27529/',
  },
  bull_2019: {
    short: 'Bull et al., npj Digit Med 2019',
    title: 'Bull JR et al. Real-world menstrual cycle characteristics of more than 600,000 menstrual cycles. npj Digit Med. 2019;2:83.',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6710244/',
  },
  khambalia_2013: {
    short: 'Khambalia et al., 2013',
    title: 'Khambalia AZ et al. Predicting date of birth and examining the best time to date a pregnancy. Int J Gynaecol Obstet. 2013;123:105-9.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/23932061/',
  },
  anvisa_rdc47_2009: {
    short: 'ANVISA RDC 47/2009',
    title: 'Agência Nacional de Vigilância Sanitária. RDC nº 47, de 8 de setembro de 2009 (bulas de medicamentos).',
    url: 'https://mooc.campusvirtual.fiocruz.br/rea/inovacao_medicamentos/RDC_47_09.pdf', // cópia da Fiocruz
  },
});

/** Fontes completas para uma lista de ids. */
export const sourcesFor = (ids = []) => ids.map((id) => ({ id, ...SOURCES[id] }));
