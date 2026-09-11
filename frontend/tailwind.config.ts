import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Background layers
        background: "hsl(var(--background))",
        "background-subtle": "hsl(var(--background-subtle))",
        surface: "hsl(var(--surface))",
        "surface-raised": "hsl(var(--surface-raised))",
        "surface-overlay": "hsl(var(--surface-overlay))",

        // Foreground/Text
        foreground: "hsl(var(--foreground))",

        // Primary (Trust Blue)
        primary: {
          DEFAULT: "hsl(var(--primary))",
          hover: "hsl(var(--primary-hover))",
          foreground: "hsl(var(--primary-foreground))",
        },

        // Secondary (Achievement Gold)
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          hover: "hsl(var(--secondary-hover))",
          foreground: "hsl(var(--secondary-foreground))",
        },

        // Semantic colors
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        info: "hsl(var(--info))",
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },

        // UI colors
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        // Tier colors
        tier: {
          bronze: "hsl(var(--tier-bronze))",
          silver: "hsl(var(--tier-silver))",
          gold: "hsl(var(--tier-gold))",
          platinum: "hsl(var(--tier-platinum))",
          diamond: "hsl(var(--tier-diamond))",
        },

        // Chart colors
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "monospace"],
      },
      fontSize: {
        // Custom type scale based on design system
        "display": ["3rem", { lineHeight: "1.1", fontWeight: "700" }],
        "h1": ["2.25rem", { lineHeight: "1.2", fontWeight: "700" }],
        "h2": ["1.5rem", { lineHeight: "1.3", fontWeight: "600" }],
        "h3": ["1.25rem", { lineHeight: "1.4", fontWeight: "600" }],
        "h4": ["1rem", { lineHeight: "1.4", fontWeight: "600" }],
        "body-lg": ["1rem", { lineHeight: "1.5", fontWeight: "400" }],
        "body": ["0.875rem", { lineHeight: "1.5", fontWeight: "400" }],
        "small": ["0.8125rem", { lineHeight: "1.5", fontWeight: "400" }],
        "caption": ["0.75rem", { lineHeight: "1.4", fontWeight: "500" }],
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
      },
      maxWidth: {
        "8xl": "88rem",
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out",
        "slide-in": "slide-in 0.2s ease-out",
        "scale-in": "scale-in 0.15s ease-out",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      transitionDuration: {
        "250": "250ms",
      },
      transitionTimingFunction: {
        // Custom easing curves - never linear!
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "out-quart": "cubic-bezier(0.25, 1, 0.5, 1)",
        "in-out-custom": "cubic-bezier(0.4, 0, 0.2, 1)",
        "spring": "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
