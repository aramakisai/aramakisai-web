import type { Metadata } from 'next';
import { Zen_Old_Mincho } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

const zenOldMincho = Zen_Old_Mincho({
  weight: '900',
  subsets: ['latin'],
  variable: '--font-zen-old-mincho',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '荒牧祭',
  description: '荒牧祭実行委員会',
  icons: {
    icon: '/images/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={zenOldMincho.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <Header />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
