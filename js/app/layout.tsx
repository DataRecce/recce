import type { Metadata } from "next";
import "./global.css";
import Providers from "app/Providers";

export const metadata: Metadata = {
  title: "recce",
  description: "Recce: Data validation toolkit for comprehensive PR review",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
