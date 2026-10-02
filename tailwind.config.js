/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1B2430',
          light: '#232D3B',
          dim: '#39424F',
        },
        paper: '#F6F3EC',
        surface: '#FFFFFF',
        brass: {
          DEFAULT: '#B8863B',
          dark: '#8F6A2C',
          light: '#D9B27C',
          50: '#FBF4E8',
        },
        burgundy: {
          DEFAULT: '#7A2E2E',
          light: '#9C4444',
          50: '#FBEEEE',
        },
        sage: {
          DEFAULT: '#4E6B4E',
          light: '#6C8C6C',
          50: '#EEF3EE',
        },
        muted: '#6B6255',
        line: '#E4DDCC',
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        card: '10px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(27,36,48,0.04), 0 4px 16px rgba(27,36,48,0.06)',
        pop: '0 8px 30px rgba(27,36,48,0.12)',
      },
      backgroundImage: {
        stitch: 'repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(184,134,59,0.35) 6px, rgba(184,134,59,0.35) 10px)',
      },
    },
  },
  plugins: [],
}
