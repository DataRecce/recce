import type { Config } from "tailwindcss";
import { join } from "path";

export default {
  content: [join(__dirname, "{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}")],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plugins: [require("tailwindcss"), require("autoprefixer")],
} satisfies Config;
