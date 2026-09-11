/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,md,mdx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './theme.config.tsx',
  ],
  theme: {
    extend: {
      colors: {
        // Veritas brand colors
        'brand-blue': '#3B82F6',
        'brand-gold': '#F59E0B',
        'brand-success': '#10B981',
        'brand-error': '#EF4444',
        // Tier colors
        'tier-bronze': '#CC8033',
        'tier-silver': '#9CA3AF',
        'tier-gold': '#EAB308',
        'tier-platinum': '#7DD3E8',
        'tier-diamond': '#22D3EE',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
