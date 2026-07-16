import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0B0B0C',
        graphite: '#1C1D20',
        steel: '#4A4D55',
        mist: '#9AA0AA',
        silver: '#C9CDD4',
        platinum: '#E7E9EC',
        paper: '#EFF0F2',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      backgroundImage: {
        'brushed-steel':
          'linear-gradient(180deg, #FAFAF9 0%, #E7E9EC 45%, #C9CDD4 100%)',
        'ink-fade': 'linear-gradient(160deg, #26282D 0%, #3A3D45 100%)',
      },
      boxShadow: {
        rim: 'inset 0 1px 0 0 rgba(255,255,255,0.6), 0 1px 2px rgba(0,0,0,0.06)',
        lift: '0 8px 24px -8px rgba(11,11,12,0.25)',
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '1' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        pulseDot: 'pulseDot 1.4s ease-in-out infinite',
        slideIn: 'slideIn 0.35s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
