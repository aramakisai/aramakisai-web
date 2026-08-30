import type { Config } from 'tailwindcss';

const config: Config = {
  // Note: Since Tailwind v4 is being used via @tailwindcss/postcss,
  // this configuration file acts as a placeholder to easily extend theme tokens
  // (such as Figma design tokens for colors, spacing, fontFamily, etc.) in the future.
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#ffffff',
        text: '#231815',
        primary: '#ebb03c',
        secondary: '#7fc8ad',
        accent: '#ee7e84',
        'accent-alt': '#a18abf',
        info: '#80c1c6',
        success: '#8cb76b',
        warning: '#e86f30',
      },
      spacing: {},
      fontFamily: {},
    },
  },
  plugins: [],
};
export default config;
