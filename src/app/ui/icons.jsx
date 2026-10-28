// Ícones de traço (24×24). Cada código do catálogo aponta para um desenho.

const PATHS = {
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  lips: 'M3 12c3-3.5 6-4.5 9-2.2 3-2.3 6-1.3 9 2.2-3 4-6 5-9 5s-6-1-9-5z M3 12h18',
  ring: 'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z',
  spark: 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M6 6l2.5 2.5 M15.5 15.5L18 18 M6 18l2.5-2.5 M15.5 8.5L18 6',
  shield: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z M9.5 12l2 2 3.5-4',
  shieldOff: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z M4 4l16 16',
  pill: 'M4.5 12.5l8-8a4.95 4.95 0 0 1 7 7l-8 8a4.95 4.95 0 0 1-7-7z M8.5 8.5l7 7',
  drop1: 'M12 7c1.8 2.6 3.8 4.6 3.8 7a3.8 3.8 0 0 1-7.6 0c0-2.4 2-4.4 3.8-7z',
  drop2: 'M8.5 6c1.8 2.6 3.8 4.6 3.8 7a3.8 3.8 0 0 1-7.6 0c0-2.4 2-4.4 3.8-7z M16.5 9c1.4 2 2.9 3.5 2.9 5.3a2.9 2.9 0 0 1-5.8 0c0-1.8 1.5-3.3 2.9-5.3z',
  drop3: 'M12 2.5c1.3 1.9 2.7 3.3 2.7 5a2.7 2.7 0 0 1-5.4 0c0-1.7 1.4-3.1 2.7-5z M7.5 11.5c1.3 1.9 2.7 3.3 2.7 5a2.7 2.7 0 0 1-5.4 0c0-1.7 1.4-3.1 2.7-5z M16.5 11.5c1.3 1.9 2.7 3.3 2.7 5a2.7 2.7 0 0 1-5.4 0c0-1.7 1.4-3.1 2.7-5z',
  drop: 'M12 3.5c2.6 3.7 5.5 6.6 5.5 10a5.5 5.5 0 0 1-11 0c0-3.4 2.9-6.3 5.5-10z',
  dropDark: 'M12 3.5c2.6 3.7 5.5 6.6 5.5 10a5.5 5.5 0 0 1-11 0c0-3.4 2.9-6.3 5.5-10z M9 14h6 M10 17h4',
  dots: 'M8 7.5a1.2 1.2 0 1 0 0 .01 M15.5 6a1.2 1.2 0 1 0 0 .01 M12 12a1.2 1.2 0 1 0 0 .01 M7 16.5a1.2 1.2 0 1 0 0 .01 M16.5 15a1.2 1.2 0 1 0 0 .01',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
  spine: 'M12 3v18 M8 6h8 M9 10h6 M8 14h8 M9 18h6',
  breast: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M12 12h.01',
  acne: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8.5 9h.01 M15 8.5h.01 M10 14h.01 M14.5 14.5h.01',
  bloat: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M2.5 12h2 M19.5 12h2',
  head: 'M12 3a7 7 0 0 0-4 12.7V20h8v-4.3A7 7 0 0 0 12 3z M10 7l2.5 2.5L10 12',
  wave: 'M3 9c2-2 4 2 6 0s4-2 6 0 4 2 6 0 M3 15c2-2 4 2 6 0s4-2 6 0 4 2 6 0',
  happy: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M9 10h.01 M15 10h.01 M8.5 14a4 4 0 0 0 7 0',
  anxious: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M9 10h.01 M15 10h.01 M8.5 15.5c1-1 2 1 3.5 0s2.5 1 3.5 0',
  irritated: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8 8.5l2.5 1 M16 8.5l-2.5 1 M9 15.5h6',
  sad: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M9 10h.01 M15 10h.01 M8.5 16a4 4 0 0 1 7 0',
  sensitive: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M9 10h.01 M15 10h.01 M10 15.5h4 M16.5 12.5c.7 1 1.2 1.7 1.2 2.4a1.2 1.2 0 0 1-2.4 0c0-.7.5-1.4 1.2-2.4z',
  dumbbell: 'M6 7v10 M18 7v10 M3 10v4 M21 10v4 M6 12h12',
  flame: 'M12 21c4 0 6-3 6-6 0-4-3-6-4-9-2 2-2 4-2 4s-1-2-3-3c0 3-3 5-3 8 0 3 2 6 6 6z',
  walk: 'M14 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0z M12 8v5l-3 7 M12 13l3 7 M8 11l4-2 4 2',
  lotus: 'M12 20c-4 0-8-2-9-5 3 0 6 1 9 5z M12 20c4 0 8-2 9-5-3 0-6 1-9 5z M12 20c-2-3-2-8 0-13 2 5 2 10 0 13z',
  check: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8 12.5l2.5 2.5L16 9.5',
  belly: 'M8 4c-2 3-3 6-3 9a7 7 0 0 0 14 0c0-3-1-6-3-9 M12 13h.01 M9 17c2 1 4 1 6 0',
  battery: 'M3 8h15a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z M21 11v2 M5 11v2',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  itch: 'M6 7l2 2 M10 5l1 3 M14 5l-1 3 M18 7l-2 2 M12 11c-3 0-5 2.5-5 5.5S9 21 12 21s5-1.5 5-4.5S15 11 12 11z',
  diarrhea: 'M12 3v8 M8 7l4 4 4-4 M7 15c1.5 2 1.5 3.5 0 5 M12 15c1.5 2 1.5 3.5 0 5 M17 15c1.5 2 1.5 3.5 0 5',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3 M5 11h14v9H5z M12 15v2',
  calm: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8 10c.7.7 1.8.7 2.5 0 M13.5 10c.7.7 1.8.7 2.5 0 M9 14.5c1.7 1.3 4.3 1.3 6 0',
  swings: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 3v18 M8 10h.01 M16 10h.01 M7.5 15a2 2 0 0 0 3 0 M13.5 16a2 2 0 0 1 3 0',
  dry: 'M12 3.5c2.6 3.7 5.5 6.6 5.5 10a5.5 5.5 0 0 1-11 0c0-3.4 2.9-6.3 5.5-10z M4 4l16 16',
  cream: 'M6 15a6 4 0 0 0 12 0c0-2-2-3-3-5-1 1-2 1-3 0-1 1-2 1-3 0-1 2-3 3-3 5z',
  watery: 'M12 3c2 3 4 5 4 7.5a4 4 0 0 1-8 0C8 8 10 6 12 3z M6 18h12 M8 21h8',
  eggwhite: 'M12 3c3 4 5 7 5 10a5 5 0 0 1-10 0c0-3 2-6 5-10z M10 13a2 2 0 0 0 2 2',
  unusual: 'M12 3.5c2.6 3.7 5.5 6.6 5.5 10a5.5 5.5 0 0 1-11 0c0-3.4 2.9-6.3 5.5-10z M12 10v3 M12 16h.01',
  stress: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M13 7l-3 5h4l-3 5',
  bandage: 'M4.5 13.5l9-9a3.5 3.5 0 0 1 5 5l-9 9a3.5 3.5 0 0 1-5-5z M10 10h.01 M14 14h.01 M12 12h.01',
  pin: 'M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z M12 10a1.5 1.5 0 1 0 0 .01',
  glass: 'M7 3h10l-1 7a4 4 0 0 1-8 0L7 3z M12 14v6 M8 21h8',
  testPos: 'M3 10h18v4H3z M16 10v4 M6.5 12h3 M8 10.5v3',
  testNeg: 'M3 10h18v4H3z M16 10v4 M6.5 12h3',
  testNone: 'M3 10h18v4H3z M16 10v4 M4 4l16 16',
  noWorkout: 'M6 7v10 M18 7v10 M3 10v4 M21 10v4 M6 12h12 M4 4l16 16',
  thermo: 'M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z M12 9v6',
  pulse: 'M3 12h4l2-5 4 10 2-5h6',
  zz: 'M5 9h5l-5 6h5 M13 4h6l-6 8h6',
  bowl: 'M4 12h16a8 8 0 0 1-16 0z M9 8c0-2 1-3 3-4 M13 8c0-1.5.8-2.5 2-3',
  vomit: 'M12 3a7 7 0 0 0-7 7c0 2 1 3.5 2 4.5 M12 3a7 7 0 0 1 7 7c0 2-1 3.5-2 4.5 M9 15c0 2 1 3 3 3s3-1 3-3 M12 18v3',
  // Interface
  plus: 'M12 5v14 M5 12h14',
  close: 'M6 6l12 12 M18 6L6 18',
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  warn: 'M12 4l9 16H3l9-16z M12 10v4 M12 17h.01',
  home: 'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-9z',
  calendar: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M4 10h16 M8 3v4 M16 3v4',
  chart: 'M5 20V10 M12 20V4 M19 20v-7',
  settings: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z M9.5 12l2 2 3.5-4',
  phone: 'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M11 18h2',
};

const CODE_ICON = {
  sex_vaginal: 'heart', sex_oral: 'lips', sex_anal: 'ring', sex_foreplay: 'spark',
  protection_condom: 'shield', protection_none: 'shieldOff', emergency_contraception: 'pill',
  flow_light: 'drop1', flow_medium: 'drop2', flow_heavy: 'drop3', flow_dark: 'dropDark', spotting: 'dots',
  bleeding: 'drop1', fluid_loss: 'watery', severe_abdominal: 'belly', severe_headache: 'head', sudden_swelling: 'bloat',
  fever: 'thermo', persistent_vomiting: 'vomit', regular_contractions: 'pulse', less_movement: 'spark',
  no_symptoms: 'check', cramps: 'bolt', abdominal_pain: 'belly', back_pain: 'spine', breast_tenderness: 'breast',
  headache: 'head', acne: 'acne', bloating: 'bloat', nausea: 'wave', fatigue: 'battery', insomnia: 'moon',
  vaginal_itch: 'itch', diarrhea: 'diarrhea', constipation: 'lock', vomiting: 'vomit', heartburn: 'flame',
  sleepy: 'zz', leg_cramps: 'bolt', frequent_urination: 'drop1', cravings: 'bowl', swelling_legs: 'bloat',
  mood_calm: 'calm', mood_happy: 'happy', mood_swings: 'swings', mood_anxious: 'anxious', mood_irritated: 'irritated',
  mood_sad: 'sad', mood_sensitive: 'sensitive', baby_movement: 'spark', braxton: 'pulse',
  discharge_dry: 'dry', discharge_creamy: 'cream', discharge_watery: 'watery', discharge_eggwhite: 'eggwhite', discharge_unusual: 'unusual',
  stress: 'stress', illness: 'bandage', travel: 'pin', alcohol: 'glass',
  no_workout: 'noWorkout', workout_light: 'dumbbell', workout_intense: 'flame', walk: 'walk', yoga: 'lotus',
  preg_test_none: 'testNone', preg_test_positive: 'testPos', preg_test_negative: 'testNeg',
};

export function Icon({ name, code, size = 22, width = 1.8 }) {
  const d = PATHS[name ?? CODE_ICON[code]] ?? PATHS.dots;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={width}
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** Cor e fundo da categoria, como variáveis CSS para os componentes. */
export const catStyle = (cat) => ({ '--color': `var(--c-${cat})`, '--tint': `var(--t-${cat})` });
