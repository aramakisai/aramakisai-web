import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '荒牧祭',
  description: '荒牧祭実行委員会',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
