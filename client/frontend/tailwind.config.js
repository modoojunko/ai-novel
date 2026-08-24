/** @type {import('tailwindcss').Config} */
// daisyUI 已退役：视觉一律走 src/design/*.css（oklch token + 组件类，
// 自包含不进 tailwind 编译）；tailwind 只服务布局工具类（flex/grid/间距/字号）。
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Noto Serif SC"', "serif"],
        sans: ['"Noto Sans SC"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
        display: ['"EB Garamond"', '"Noto Serif SC"', "serif"],
      },
    },
  },
};
