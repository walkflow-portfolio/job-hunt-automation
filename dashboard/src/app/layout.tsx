import type { Metadata } from 'next';
import { Manrope, Unbounded } from 'next/font/google';
import './globals.css';

// Unbounded for headings and big numbers, Manrope for everything else.
const unbounded = Unbounded({ subsets: ['latin'], variable: '--font-unbounded', display: 'swap' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

export const metadata: Metadata = {
  title: 'JobHunt',
  description: 'Your job search in one place',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${unbounded.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
