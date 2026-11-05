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
        bg:      '#FBF4EC', // crème : canvas de contenu
        card:    '#FFFFFF',
        border:  '#E6DCCB',
        subtle:  '#CFC5B4',
        muted:   '#6E7B74',
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
