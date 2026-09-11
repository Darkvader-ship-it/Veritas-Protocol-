/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // These extend the CSS custom properties from index.css
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        'surface-raised': 'var(--color-surface-raised)',
        border: 'var(--color-border)',
        primary: 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        secondary: 'var(--color-secondary)',
        success: 'var(--color-success)',
        destructive: 'var(--color-destructive)',
        warning: 'var(--color-warning)',
        muted: 'var(--color-text-muted)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        // Tier colors
        'tier-diamond': 'var(--color-tier-diamond)',
        'tier-platinum': 'var(--color-tier-platinum)',
        'tier-gold': 'var(--color-tier-gold)',
        'tier-silver': 'var(--color-tier-silver)',
        'tier-bronze': 'var(--color-tier-bronze)',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'SF Mono', 'Consolas', 'Liberation Mono', 'Menlo', 'monospace'],
      },
      animation: {
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'slide-in': 'slide-in 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
