/** @type {import('tailwindcss').Config} */
export default {
  // ../../docs/design-c/prototypes 是设计原型（仓库根 docs/，本地资产不入 git）：
  // 原型与应用共用本配置编译出同一套 CSS——类名相同即像素相同（design:css / design:check）
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../docs/design-c/prototypes/**/*.html",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Noto Serif SC"', "serif"],
        sans: ['"Noto Sans SC"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
        display: ['"EB Garamond"', '"Noto Serif SC"', "serif"],
      },
      colors: {
        "rate-limited": "#7c3aed",
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        novelforge: {
          /* 暖色调文学风 — 深夜书房 */
          primary: "#d4a373",
          "primary-content": "#1a1410",
          secondary: "#8a9b7a",
          "secondary-content": "#1a1410",
          accent: "#e8c87a",
          "accent-content": "#1a1410",
          neutral: "#2d2418",
          "neutral-content": "#d4c9b8",
          "base-100": "#14100b",
          "base-200": "#1d1812",
          "base-300": "#2a2118",
          "base-content": "#d4c9b8",
          info: "#7a9db8",
          success: "#7da87a",
          warning: "#c9a06b",
          error: "#c97a7a",
        },
      },
      {
        parchment: {
          /* 羊皮纸暖白风格 — 适合白天 */
          primary: "#8b6914",
          "primary-content": "#faf6ee",
          secondary: "#6b7a54",
          "secondary-content": "#faf6ee",
          accent: "#a67c52",
          "accent-content": "#faf6ee",
          neutral: "#3d352a",
          "neutral-content": "#e8ddd0",
          "base-100": "#faf6ee",
          "base-200": "#f0e8d8",
          "base-300": "#e0d5c0",
          "base-content": "#3d352a",
          info: "#7a9db8",
          success: "#5a8a5a",
          warning: "#b8944a",
          error: "#b85a5a",
        },
      },
    ],
  },
};
