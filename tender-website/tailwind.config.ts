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
        // Pixel palette
        void: "var(--px-void)",
        panel: "var(--px-panel)",
        well: "var(--px-well)",
        line: "var(--px-line)",
        body: "var(--px-text)",
        dim: "var(--px-dim)",
        gold: "var(--px-gold)",
        golddk: "var(--px-gold-dk)",
        green: "var(--px-green)",
        greendk: "var(--px-green-dk)",
        red: "var(--px-red)",
        reddk: "var(--px-red-dk)",
        blue: "var(--px-blue)",
        bluedk: "var(--px-blue-dk)",
        orange: "var(--px-orange)",
        // Legacy aliases from the previous world, repointed to pixel tokens.
        ink: "var(--px-void)",
        archive: "var(--px-panel)",
        plate: "var(--px-panel)",
        brass: "var(--px-gold)",
        brassdeep: "var(--px-gold-dk)",
        turmeric: "var(--px-gold)",
        onbrass: "var(--px-on-accent)",
        maroon: "var(--px-red-dk)",
        peacock: "var(--px-green)",
        parchment: "var(--px-text)",
        parchmentdim: "var(--px-dim)",
        sealred: "var(--px-red)",
        border: "var(--px-line)",
      },
      fontFamily: {
        sans: ["var(--font-body)", "monospace"],
        body: ["var(--font-body)", "monospace"],
        pixel: ["var(--font-pixel)", "monospace"],
        display: ["var(--font-pixel)", "monospace"],
        mono: ["var(--font-body)", "monospace"],
      },
      borderRadius: {
        lg: "0px",
        md: "0px",
        sm: "0px",
        DEFAULT: "0px",
      },
      boxShadow: {
        px: "4px 4px 0 var(--px-shadow)",
        seal: "4px 4px 0 var(--px-shadow)",
        plate: "4px 4px 0 var(--px-shadow)",
      },
    },
  },
  plugins: [],
};

export default config;
