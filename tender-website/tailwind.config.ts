import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#0b0f17",
        surface: "#111827",
        border: "#1f2937",
        muted: "#1e293b",
        primary: "#f59e0b",
      },
    },
  },
  plugins: [],
};

export default config;
