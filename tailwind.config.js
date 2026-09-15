/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          active: 'var(--color-primary-active)',
          soft: 'var(--color-primary-soft)',
          foreground: 'var(--color-primary-foreground)',
        },
        background: 'var(--color-page-background)',
        foreground: 'var(--color-text-primary)',
        card: 'var(--color-white)',
        muted: 'var(--color-text-muted)',
        border: 'var(--color-border)',
        'near-black': 'var(--color-near-black)',
        'dark-surface': 'var(--color-dark-surface)',
        'dark-border': 'var(--color-dark-border)',
        'page-background': 'var(--color-page-background)',
        'light-surface': 'var(--color-light-surface)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        info: 'var(--color-info)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Cinematic display scale
        'display-2xl': ['clamp(3.5rem,8vw,7rem)', { lineHeight: '0.95', fontWeight: '700', letterSpacing: '-0.03em' }],
        'display-xl': ['clamp(2.8rem,6vw,5.5rem)', { lineHeight: '0.97', fontWeight: '700', letterSpacing: '-0.025em' }],
        display: ['clamp(2rem,4vw,3.5rem)', { lineHeight: '1.05', fontWeight: '700', letterSpacing: '-0.02em' }],
        h1: ['clamp(1.75rem,3vw,2.5rem)', { lineHeight: '1.15', fontWeight: '700', letterSpacing: '-0.015em' }],
        h2: ['clamp(1.4rem,2.5vw,1.875rem)', { lineHeight: '1.25', fontWeight: '600', letterSpacing: '-0.01em' }],
        h3: ['1.375rem', { lineHeight: '1.3', fontWeight: '600', letterSpacing: '-0.005em' }],
        h4: ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],
        'body-large': ['1.125rem', { lineHeight: '1.6', fontWeight: '400' }],
        body: ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-small': ['0.875rem', { lineHeight: '1.55', fontWeight: '400' }],
        caption: ['0.75rem', { lineHeight: '1.4', fontWeight: '400' }],
        label: ['0.875rem', { lineHeight: '1.4', fontWeight: '500' }],
        button: ['0.9375rem', { lineHeight: '1', fontWeight: '600', letterSpacing: '0.01em' }],
        eyebrow: ['0.6875rem', { lineHeight: '1', fontWeight: '600', letterSpacing: '0.16em' }],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        lg: '10px',
        xl: '14px',
        pill: '9999px',
      },
      maxWidth: {
        content: '72rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
        'card-hover': '0 2px 4px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)',
        'dark-card': '0 0 0 1px rgba(255,255,255,0.06)',
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        26: '6.5rem',
        30: '7.5rem',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.25,0.46,0.45,0.94) both',
        'fade-in': 'fade-in 0.5s ease both',
      },
    },
  },
  plugins: [],
}
