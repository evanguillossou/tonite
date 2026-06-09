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
        bg:      '#0A0A0A',
        card:    '#1A1A1A',
        border:  '#2A2A2A',
        subtle:  '#333333',
        muted:   '#666666',
        text:    '#F5F5F5',
        accent:  '#FF6B35',
        accent2: '#E91E8C',
      },
      backgroundImage: {
        'grad-accent': 'linear-gradient(135deg, #FF6B35, #E91E8C)',
        'grad-accent-h': 'linear-gradient(90deg, #FF6B35, #E91E8C)',
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
