import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import './brand-experience.css';
import { ClerkProvider } from '@clerk/nextjs';
import { AuthControls } from './auth-controls';

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
  const publishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
    process.env.VITE_CLERK_PUBLISHABLE_KEY;
  const content = (
    <>
      <a className="je-skip" href="#main-content">
        Skip to content
      </a>
      <AuthControls />
      {children}
    </>
  );
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {publishableKey ? (
          <ClerkProvider
            publishableKey={publishableKey}
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            signInFallbackRedirectUrl="/"
            signUpFallbackRedirectUrl="/"
            appearance={{
              variables: {
                colorPrimary: '#b49a50',
                colorPrimaryForeground: '#171914',
                colorForeground: '#20231d',
                colorMutedForeground: '#686b60',
                colorBackground: '#ffffff',
                borderRadius: '0.375rem',
                fontFamily: 'var(--font-geist-sans), Arial, sans-serif',
              },
              elements: {
                rootBox: 'je-clerk-root',
                cardBox: 'je-clerk-card-box',
                card: 'je-clerk-card',
                header: 'je-clerk-header',
                headerTitle: 'je-clerk-title',
                headerSubtitle: 'je-clerk-subtitle',
                formButtonPrimary: 'je-clerk-submit',
                footer: 'je-clerk-footer',
              },
            }}
          >
            {content}
          </ClerkProvider>
        ) : (
          content
        )}
      </body>
    </html>
  );
}
