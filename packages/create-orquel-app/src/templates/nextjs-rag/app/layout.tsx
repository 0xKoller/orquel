import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || '{{name}}',
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'AI-powered knowledge base built with Orquel',
  keywords: ['AI', 'RAG', 'knowledge base', 'search', 'Orquel'],
  authors: [{ name: 'Orquel Team' }],
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full antialiased`}>
        <div className="min-h-full bg-gradient-to-br from-gray-50 to-white">
          {children}
        </div>
      </body>
    </html>
  );
}