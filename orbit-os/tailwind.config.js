/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        space: { 950: '#02040d', 900: '#050a1c', 800: '#0a1230', 700: '#111b45' },
        neon: { cyan: '#38bdf8', blue: '#3b82f6', violet: '#8b5cf6', green: '#22c55e' },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(56,189,248,.35), 0 0 24px rgba(56,189,248,.25)',
        'glow-violet': '0 0 0 1px rgba(139,92,246,.45), 0 0 28px rgba(139,92,246,.35)',
      },
      fontFamily: { sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
