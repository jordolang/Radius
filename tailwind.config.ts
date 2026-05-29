import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui"],
      },
      colors: {
        ember: { DEFAULT: "#e8915b", deep: "#d6713f" },
        ink: "#0e0b0a",
      },
    },
  },
  plugins: [],
} satisfies Config;
