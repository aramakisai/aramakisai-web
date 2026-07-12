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
      colors: {},
      spacing: {},
      fontFamily: {},
    },
  },
  plugins: [],
};
export default config;
