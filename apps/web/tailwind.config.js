/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        brand: {
          DEFAULT: '#2563eb',
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          dark: '#1e40af',
        },
        accent: {
          DEFAULT: '#38bdf8',
          400: '#38bdf8',
          500: '#0ea5e9',
        },
        sidebar: {
          DEFAULT: '#0b1220',
          accent: '#111c30',
        },
        ink: '#0f172a',
      },
      boxShadow: {
        soft: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
        card: '0 4px 24px -8px rgba(15, 23, 42, 0.12)',
        glow: '0 0 0 1px rgba(37, 99, 235, 0.1), 0 8px 30px -12px rgba(37, 99, 235, 0.35)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
        'sidebar-gradient': 'linear-gradient(180deg, #0b1220 0%, #0d1729 100%)',
        'login-gradient':
          'radial-gradient(1200px 600px at 10% 10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(1000px 500px at 90% 90%, rgba(37,99,235,0.25), transparent 60%), linear-gradient(160deg, #0b1220 0%, #0f1e38 100%)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.7' },
          '70%, 100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease-out',
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [],
};
