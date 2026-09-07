import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import './brand-experience.css';
import { Brand } from './brand';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'JE Oils | Operations',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a className="je-skip" href="#main-content">
          Skip to content
        </a>
        <header className="je-header">
          <Brand />
          <nav aria-label="Main navigation">
            <a
              className="je-company-link"
              href="https://jeoils.com"
              target="_blank"
              rel="noreferrer"
            >
              Company website ↗
            </a>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
