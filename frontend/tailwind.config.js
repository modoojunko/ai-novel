/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
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
    ],
  },
};
