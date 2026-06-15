import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f4f8ff',
          100: '#e8f1ff',
          200: '#c7ddff',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
          800: '#1e3a8a'
        },
        ink: {
          950: '#0f172a',
          700: '#334155',
          500: '#64748b'
        },
        success: {
          50: '#ecfdf3',
          500: '#16a34a',
          700: '#15803d'
        },
        warning: {
          50: '#fffbeb',
          500: '#d97706',
          700: '#b45309'
        },
        danger: {
          50: '#fef2f2',
          500: '#dc2626',
          700: '#b91c1c'
        }
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)'
      },
      borderRadius: {
        card: 'var(--radius-card)',
        control: 'var(--radius-control)'
      },
      transitionTimingFunction: {
        emphasis: 'var(--ease-emphasis)'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        fadeIn: 'fadeIn 200ms ease-out forwards'
      }
    }
  },
  plugins: []
};

export default config;
