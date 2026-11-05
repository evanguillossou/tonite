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
        // Suivent le thème clair / sombre (variables définies dans globals.css)
        bg:      'var(--bg)',     // fond de page
        card:    'var(--card)',   // cartes / champs
        border:  'var(--border)', // contours
        subtle:  'var(--subtle)',
        muted:   'var(--muted)',  // texte secondaire
        text:    'var(--text)',   // encre
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
