import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AR Sharoduwi — живые парящие шары',
  description: 'Примерьте композиции из воздушных шаров в 3D и AR прямо в браузере.',
};

export const viewport: Viewport = {
  themeColor: '#0f0720',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // корректные safe-area insets на iPhone
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
