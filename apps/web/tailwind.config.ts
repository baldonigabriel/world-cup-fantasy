import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0F',
        surface: '#13131A',
        'surface-2': '#1C1C27',
        border: '#2A2A3A',
        'text-primary': '#F0F0F5',
        'text-secondary': '#8888A0',
        amber: {
          400: '#FBBF24',
          500: '#F59E0B',
        },
        emerald: {
          400: '#34D399',
          500: '#10B981',
        },
        sky: {
          400: '#38BDF8',
          500: '#0EA5E9',
        },
      },
      fontFamily: {
        display: ['var(--font-bebas)', 'sans-serif'],
        body: ['var(--font-barlow)', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-dark': 'linear-gradient(135deg, #0A0A0F 0%, #13131A 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
