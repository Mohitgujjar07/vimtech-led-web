import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import Navbar from '@/components/Navbar';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#6b21a8',
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Lab Ledger — Computer Lab Digitization',
  description: 'Digitize your college computer lab usage ledger with AI-powered handwriting extraction.',
  icons: {
    icon: '/logo.png',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-gray-50/70 antialiased`}>
        <Navbar />
        <main className="mx-auto max-w-7xl px-3.5 pt-3 pb-24 sm:px-6 sm:py-6 lg:px-8 md:pb-8">
          {children}
        </main>
        <Toaster position="top-right" richColors closeButton />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
