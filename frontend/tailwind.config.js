/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Noto Serif SC"', "serif"],
        sans: ['"Noto Sans SC"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        novelforge: {
          primary: "#4da6e8",
          secondary: "#6b7a8f",
          accent: "#7eb8da",
          neutral: "#1e2430",
          "base-100": "#141820",
          "base-200": "#1a1f2e",
          "base-300": "#222838",
          info: "#4da6e8",
          success: "#34d399",
          warning: "#fbbf24",
          error: "#f87171",
        },
      },
    ],
  },
};
