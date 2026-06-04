import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        // Game palette
        game: {
          purple:  '#8b5cf6',
          violet:  '#7c3aed',
          pink:    '#ec4899',
          cyan:    '#06b6d4',
          teal:    '#14b8a6',
          green:   '#22c55e',
          yellow:  '#eab308',
          orange:  '#f97316',
          red:     '#ef4444',
          indigo:  '#6366f1',
        },
        // UI tokens
        primary: {
          DEFAULT: '#7c3aed',
          foreground: '#ffffff',
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        surface: {
          DEFAULT: '#1a1a2e',
          card: '#16213e',
          elevated: '#0f3460',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      backgroundImage: {
        'gradient-game': 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        'gradient-card': 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(236,72,153,0.08) 100%)',
        'gradient-success': 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(20,184,166,0.08) 100%)',
        'gradient-danger': 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(249,115,22,0.08) 100%)',
      },
      boxShadow: {
        glow: '0 0 20px rgba(124,58,237,0.4)',
        'glow-pink': '0 0 20px rgba(236,72,153,0.4)',
        'glow-green': '0 0 20px rgba(34,197,94,0.4)',
        card: '0 4px 24px rgba(0,0,0,0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.35s ease-out',
        'bounce-subtle': 'bounceSubtle 2s infinite',
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { from: { opacity: '0', transform: 'translateX(24px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        bounceSubtle: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        pulseGlow: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [animate],
};

export default config;
