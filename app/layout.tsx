import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: "Ethereum Annual Rings",
  description: "A living market archive: Ethereum price, volume, protocol milestones, and security incidents rendered as annual rings.",
  openGraph: {
    title: "Ethereum Annual Rings",
    description: "A living market archive.",
    images: [{ url: "/og.png", width: 1717, height: 899, alt: "Ethereum Annual Rings — A living market archive" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ethereum Annual Rings",
    description: "A living market archive.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
