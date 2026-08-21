import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ethereum Annual Rings",
  description: "Seven years of Ethereum price and volume recast as the rings of a tree.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="theme-dark">
      <body>{children}</body>
    </html>
  );
}
