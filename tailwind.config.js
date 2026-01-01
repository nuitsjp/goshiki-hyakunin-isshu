/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 五色百人一首の色
        'ruri-kon': '#223a70',  // 瑠璃紺（青）
        'sakura': '#d4a1a4',     // 淡紅色（ピンク）
        'yamabuki': '#dcb879',   // 山吹色（黄）
        'matcha': '#7b9262',     // 抹茶色（緑）
        'kaki': '#ea5506',       // 柿色（オレンジ）

        // フィードバック色
        'uguisu': '#6c8c2d',     // 鶯色（正解）
        'akane': '#b7282e',      // 茜色（不正解）

        // 背景・テキスト
        'washi': '#fcfaf2',      // 和紙（背景）
        'sumi': '#333333',       // 墨（テキスト）
        'border-base': '#e0dcd0', // ボーダー
      },
      fontFamily: {
        serif: ['Zen Old Mincho', 'serif'],
        sans: ['Zen Kaku Gothic New', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
