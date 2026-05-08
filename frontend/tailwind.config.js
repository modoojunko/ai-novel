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
          primary: "#3b82f6",
          "primary-content": "#ffffff",
          secondary: "#60a5fa",
          accent: "#6366f1",
          neutral: "#1e293b",
          "base-100": "#0a0e17",
          "base-200": "#111827",
          "base-300": "#1e293b",
          info: "#3b82f6",
          success: "#22c55e",
          warning: "#f59e0b",
          error: "#ef4444",
        },
      },
    ],
  },
};
