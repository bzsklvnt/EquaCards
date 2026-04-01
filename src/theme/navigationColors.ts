/**
 * React Navigation tab / header colors aligned with `tailwind.config.js` equa.* tokens.
 */
const meadow = '#047857';
const glade = '#059669';
const cream = '#F7F3EB';
const ink = '#1C1917';
const mist = '#78716C';

export const navigationColors = {
  light: {
    text: ink,
    background: cream,
    tint: meadow,
    tabIconDefault: mist,
    tabIconSelected: meadow,
  },
  dark: {
    text: cream,
    background: ink,
    tint: glade,
    tabIconDefault: mist,
    tabIconSelected: glade,
  },
} as const;
