import type { Config } from "tailwindcss";
import { join } from "path";

export default {
  content: [join(__dirname, "{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}")],
  theme: {
    extend: {
      colors: {
        brand: "rgb(253,104,62)",
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plugins: [require("tailwindcss"), require("autoprefixer")],
} satisfies Config;
