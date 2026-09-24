/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f07316',
          600: '#d45a0a',
          700: '#b04509',
          800: '#8c380d',
          900: '#722f10',
          950: '#3d1606',
        },
        steel: {
          50: '#f4f5f7',
          100: '#e8eaee',
          200: '#d1d5de',
          300: '#aeb5c3',
          400: '#848da1',
          500: '#667084',
          600: '#515a6c',
          700: '#434a59',
          800: '#3a404c',
          900: '#333843',
          950: '#1c1f26',
        },
        ink: {
          DEFAULT: '#14171c',
          soft: '#1e232b',
          mute: '#2a303a',
        },
      },
      fontFamily: {
        sans: ['"Barlow"', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['"Barlow Condensed"', 'Barlow', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 rgba(28, 31, 38, 0.06)',
        lift: '0 8px 24px -12px rgba(28, 31, 38, 0.18)',
      },
      keyframes: {
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'draw-line': {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
      },
      animation: {
        'rise-in': 'rise-in 0.55s ease-out both',
        'fade-in': 'fade-in 0.45s ease-out both',
        'draw-line': 'draw-line 0.7s ease-out both',
      },
    },
  },
  plugins: [],
}
