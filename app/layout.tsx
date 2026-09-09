import type { Metadata } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const siteUrl = process.env.SITE_URL ?? "https://0xfrann.github.io/ethereum-tree-seams";
const description =
  "Ethereum's market history read as the annual rings of a tree: price shapes each ring, volume sets its weight, and protocol milestones sit in the grain as knots.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Ethereum Annual Rings",
  description,
  authors: [{ name: "Frann Dalmasso", url: "https://www.linkedin.com/in/franndalmasso" }],
  openGraph: {
    title: "Ethereum Annual Rings",
    description,
    type: "website",
    images: [{ url: `${basePath}/og.png`, width: 1731, height: 909, alt: "Ethereum Annual Rings" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ethereum Annual Rings",
    description,
    images: [`${basePath}/og.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href={`${basePath}/market-data.json`} as="fetch" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
