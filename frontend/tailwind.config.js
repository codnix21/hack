/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1e6',
          100: '#ffd9b8',
          200: '#ffb570',
          300: '#ff8f33',
          400: '#f07316',
          500: '#e55f0a',
          600: '#c44e08',
          700: '#9a3d07',
          800: '#7a320c',
          900: '#642a0e',
          950: '#351505',
        },
        signal: {
          DEFAULT: '#f07316',
          soft: 'rgba(240, 115, 22, 0.14)',
          line: 'rgba(240, 115, 22, 0.45)',
        },
        lime: {
          DEFAULT: '#b8f000',
          dim: '#8bb800',
          soft: 'rgba(184, 240, 0, 0.12)',
        },
        cyan: {
          DEFAULT: '#2dd4bf',
          soft: 'rgba(45, 212, 191, 0.12)',
        },
        steel: {
          50: '#f2f4f8',
          100: '#e2e6ef',
          200: '#c5ccd9',
          300: '#9aa3b5',
          400: '#6f7a90',
          500: '#555e72',
          600: '#434a5c',
          700: '#353b4a',
          800: '#282d39',
          900: '#1c2029',
          950: '#0f1218',
        },
        ink: {
          DEFAULT: '#0a0c10',
          soft: '#12151c',
          mute: '#1a1f2a',
          raised: '#222836',
        },
      },
      fontFamily: {
        sans: [
          'IBM Plex Sans',
          'Segoe UI',
          'system-ui',
          'sans-serif',
        ],
        display: [
          'Space Grotesk',
          'Bahnschrift',
          'Segoe UI Variable Display',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        panel: '0 0 0 1px rgba(255,255,255,0.04), 0 12px 40px -20px rgba(0,0,0,0.65)',
        lift: '0 18px 50px -24px rgba(0,0,0,0.7)',
        glow: '0 0 0 1px rgba(240,115,22,0.35), 0 0 24px -6px rgba(240,115,22,0.35)',
      },
      backgroundImage: {
        'tech-grid':
          'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        'hero-wash':
          'radial-gradient(120% 80% at 100% 0%, rgba(240,115,22,0.18), transparent 55%), radial-gradient(80% 60% at 0% 100%, rgba(45,212,191,0.08), transparent 50%)',
      },
      backgroundSize: {
        'tech-grid': '32px 32px',
      },
      keyframes: {
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
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
        'pulse-signal': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        'rise-in': 'rise-in 0.55s ease-out both',
        'fade-in': 'fade-in 0.45s ease-out both',
        'draw-line': 'draw-line 0.7s ease-out both',
        'pulse-signal': 'pulse-signal 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
