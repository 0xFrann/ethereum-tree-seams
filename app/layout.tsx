import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Ethereum Annual Rings',
  description: 'Ethereum market history remembered as growth.',
  openGraph: {
    title: 'Ethereum Annual Rings',
    description: 'Ethereum market history remembered as growth.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
