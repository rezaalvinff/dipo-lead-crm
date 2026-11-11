import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fef2f2",
          100: "#fee2e2",
          500: "#dc2626",
          600: "#c81e1e",
          700: "#a51818",
        },
      },
    },
  },
  plugins: [],
};
export default config;
