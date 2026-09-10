import type { Metadata } from "next";
import { Courier_Prime } from "next/font/google";
import "./globals.css";

// Self-hosted at build time, so the sheet's type never waits on a third party.
const courierPrime = Courier_Prime({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-courier",
});

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
    images: [{ url: `${basePath}/og.jpg`, width: 1200, height: 630, alt: "The specimen sheet: ten annual rings with their milestone knots, the month index, and the readout for the latest month" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ethereum Annual Rings",
    description,
    images: [`${basePath}/og.jpg`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={courierPrime.variable}>
      <head>
        <link rel="preload" href={`${basePath}/market-data.json`} as="fetch" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
