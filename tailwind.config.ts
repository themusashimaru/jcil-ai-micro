import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        // Theme-aware colors mapped to CSS custom properties
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          glow: 'var(--primary-glow)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          elevated: 'var(--surface-elevated)',
        },
        glass: {
          DEFAULT: 'var(--glass-bg)',
          dark: 'rgba(0, 0, 0, 0.6)',
          light: 'rgba(255, 255, 255, 0.1)',
          border: 'var(--glass-border)',
        },
        'theme-border': 'var(--border)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'avatar-bg': 'var(--avatar-bg)',
        'btn-disabled': 'var(--button-disabled-bg)',
      },
      borderColor: {
        DEFAULT: 'var(--border)',
        theme: 'var(--border)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        marquee: 'marquee 40s linear infinite',
        fadeIn: 'fadeIn 0.8s ease-out forwards',
        fadeInUp: 'fadeInUp 0.8s ease-out forwards',
        fadeInDown: 'fadeInDown 0.6s ease-out forwards',
        scaleIn: 'scaleIn 0.6s ease-out forwards',
        slideInLeft: 'slideInLeft 0.6s ease-out forwards',
        slideInRight: 'slideInRight 0.6s ease-out forwards',
        float: 'float 6s ease-in-out infinite',
        glow: 'glow 4s ease-in-out infinite alternate',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { opacity: '0.5' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
