import type { Config } from "tailwindcss";

const config: Omit<Config, "content"> = {
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#111118",
          2: "#1B1B26",
        },
      },
      fontFamily: {
        heading: ["Syne", "sans-serif"],
        body: ["DM Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
