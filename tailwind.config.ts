import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      colors: {
        bg:      '#F4BCD8', // rose : canvas (comme l'accueil)
        card:    '#FBF4EC', // crème : cartes / champs
        border:  '#1A2C2A', // contours vert encre
        subtle:  'rgba(26,44,42,0.35)',
        muted:   'rgba(26,44,42,0.7)', // vert encre atténué (pas de gris)
        text:    '#1A2C2A', // vert encre
        accent:  '#F4BCD8', // rose
        accent2: '#F9D56E', // jaune
      },
      backgroundImage: {
        'grad-accent': 'linear-gradient(135deg, #1A2C2A, #1A2C2A)',
        'grad-accent-h': 'linear-gradient(90deg, #1A2C2A, #1A2C2A)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
      },
    },
  },
  plugins: [],
}
export default config
