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
    },
  },
  plugins: [],
};

export default config;
