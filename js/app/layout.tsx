import type { Metadata } from "next";
import "./global.css";
import Providers from "@datarecce/ui/components/app/Providers";
import { GoogleTagManager } from "@next/third-parties/google";
import Script from "next/script";
import { ReactNode } from "react";

const GTM_ID = process.env.GTM_ID;
export const metadata: Metadata = {
  title: "recce",
  description: "Recce: Data validation toolkit for comprehensive PR review",
};

interface RootLayoutProps {
  children: ReactNode;
  /** Parallel route slot from @lineage folder */
  lineage: ReactNode;
}

export default function RootLayout({
  children,
  lineage,
}: RootLayoutProps): ReactNode {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      {GTM_ID != null && GTM_ID.trim().length > 0 && (
        <GoogleTagManager gtmId={GTM_ID} />
      )}
      {/* Handle legacy hashbang URL redirects */}
      <Script
        dangerouslySetInnerHTML={{
          __html: `
    (function() {
      const hash = window.location.hash;
      if (hash.startsWith('#!')) {
        const newLocation = window.location.origin + window.location.pathname;
        window.location.assign(newLocation);
      }
    })();
  `,
        }}
      />
      <body>
        <Providers lineage={lineage}>{children}</Providers>
      </body>
    </html>
  );
}
