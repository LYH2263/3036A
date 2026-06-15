import './globals.css';

import type { Metadata } from 'next';
import { Noto_Sans_SC, Noto_Serif_SC } from 'next/font/google';

import { AppProviders } from './providers';

const bodyFont = Noto_Sans_SC({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
  weight: ['400', '500', '600', '700']
});

const headingFont = Noto_Serif_SC({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-heading',
  weight: ['500', '600', '700']
});

export const metadata: Metadata = {
  title: '词跃学习',
  description: '词汇与语法学习工具'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${bodyFont.variable} ${headingFont.variable}`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
