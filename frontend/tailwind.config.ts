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
        background: '#fbf8f3',
        // 既存コードの `gray-*` クラス名は据え置き、値だけ暖色寄り (Tailwind stone 相当) に差し替える。
        // extend は既定パレットとの深いマージなので、上書きしなかった階調は寒色の既定値が残る。
        // 実際に使われている 9 階調をすべて列挙しているのはそのため。
        gray: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
        },
        text: '#231815',
        primary: '#ebb03c',
        secondary: '#7fc8ad',
        accent: '#ee7e84',
        'accent-alt': '#a18abf',
        info: '#80c1c6',
        success: '#8cb76b',
        warning: '#e86f30',
        // 背景の図形装飾専用 (要件 23.4)。文字色や他の UI 部品には用いない。bansai-sage のみフッターの地の例外
        'bansai-ochre': '#e4ab53',
        'bansai-olive': '#c9bf86',
        'bansai-sage': '#aeb49c',
        'bansai-salmon': '#dd9b8c',
        'bansai-rose': '#e0666d',
        'bansai-wisteria': '#d2c6da',
        'bansai-aqua': '#a2c2c6',
      },
      // Figma の共有スタイル shadow/card (AreaPanel・MapZoomControl で共用)。
      // Leaflet が生成する DOM は className が届かないため globals.css 側で同じ値を複製している
      boxShadow: {
        card: '0px 8px 10px -6px rgba(156, 163, 176, 0.2), 0px 20px 25px -5px rgba(156, 163, 176, 0.2)',
      },
      spacing: {},
      fontFamily: {
        mincho: ['var(--font-zen-old-mincho)', 'serif'],
      },
      // 既定の `text-xs` (12px) を上書きせず、下部ナビゲーション専用の 10px を別名で追加する (要件 21.11)
      fontSize: {
        'body-xs': ['10px', { lineHeight: '1.6', fontWeight: '400' }],
      },
    },
  },
  plugins: [],
};
export default config;
