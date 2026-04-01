/** @type {import('tailwindcss').Config} */
module.exports = {
  // Preset wires darkMode for web (media) + native (@cssInterop).
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        /** Equestrian palette — use semantic names in UI (cream, leather, meadow, …). */
        equa: {
          cream: '#F7F3EB',
          parchment: '#EDE6D8',
          sand: '#E8DCC8',
          leather: '#5C4033',
          'leather-deep': '#3D2914',
          ink: '#1C1917',
          mist: '#78716C',
          meadow: '#047857',
          glade: '#059669',
          forest: '#065F46',
          saddle: '#713F12',
        },
      },
      maxWidth: {
        content: '960px',
      },
    },
  },
  plugins: [],
};
