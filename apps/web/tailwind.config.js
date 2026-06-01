/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#f5a623',
        background: '#0c0c16',
        surface: 'rgba(var(--color-bg-surface-rgb), <alpha-value>)',
        card: 'rgba(var(--color-bg-card-rgb), <alpha-value>)',
        elevated: 'rgba(var(--color-bg-elevated-rgb), <alpha-value>)',
        accent: 'rgba(var(--color-accent-rgb), <alpha-value>)',
        secondary: 'rgba(var(--color-text-secondary-rgb), <alpha-value>)',
        muted: 'rgba(var(--color-text-muted-rgb), <alpha-value>)',
        success: 'rgba(var(--color-success-rgb), <alpha-value>)',
        danger: 'rgba(var(--color-danger-rgb), <alpha-value>)',
        warning: 'rgba(var(--color-warning-rgb), <alpha-value>)',
        info: 'rgba(var(--color-info-rgb), <alpha-value>)',
        border: 'rgba(var(--color-border-rgb), <alpha-value>)',
      },
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px) translateX(-50%)' },
          '100%': { opacity: '1', transform: 'translateY(0) translateX(-50%)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out',
      }
    },
  },
  plugins: [],
}
