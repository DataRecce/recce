import type { Metadata } from "next";
import "./global.css";

export const metadata: Metadata = {
  title: "recce",
  description: "Recce: Data validation toolkit for comprehensive PR review",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  );
}
