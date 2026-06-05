import type { Metadata } from 'next';
import { Bebas_Neue, Barlow_Condensed } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
});

const barlowCondensed = Barlow_Condensed({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-barlow',
});

export const metadata: Metadata = {
  title: 'Fantasy World Cup 2026',
  description: 'Draft your squad. Own the Copa.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${bebasNeue.variable} ${barlowCondensed.variable} dark`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
