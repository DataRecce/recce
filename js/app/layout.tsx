import type { Metadata } from "next";
import "./global.css";
import Providers from "app/Providers";
import { ReactNode } from "react";
import { GoogleTagManager } from "@next/third-parties/google";

const GTM_ID = process.env.GTM_ID;
export const metadata: Metadata = {
  title: "recce",
  description: "Recce: Data validation toolkit for comprehensive PR review",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      {GTM_ID != null && String(GTM_ID).trim().length > 0 && <GoogleTagManager gtmId={GTM_ID} />}
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
