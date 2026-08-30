/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f0f0f",
        panel: "#141414",
        muted: "rgba(255,255,255,0.55)",
        line: "rgba(255,255,255,0.1)",
        mark: "#d9d9d9",
        accent: "#7dd493",
        warn: "#e2b34c",
        danger: "#fb8989",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
