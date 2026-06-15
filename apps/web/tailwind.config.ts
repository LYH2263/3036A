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
        },
        unlock: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '30%': { opacity: '0.8', transform: 'scale(1.15) rotate(-8deg)' },
          '60%': { opacity: '1', transform: 'scale(1.05) rotate(4deg)' },
          '100%': { opacity: '0', transform: 'scale(0.5) rotate(0deg)' }
        },
        progressGrow: {
          '0%': { width: '0%' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.7)' },
          '70%': { opacity: '1', transform: 'scale(1.08)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        }
      },
      animation: {
        fadeIn: 'fadeIn 200ms ease-out forwards',
        unlock: 'unlock 700ms var(--ease-emphasis) forwards',
        progressGrow: 'progressGrow 600ms var(--ease-emphasis) both',
        shimmer: 'shimmer 1.6s linear infinite',
        popIn: 'popIn 280ms var(--ease-emphasis) forwards'
      }
    }
  },
  plugins: []
};

export default config;
