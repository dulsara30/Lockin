import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: {
    template: '%s | Lockin',
    default: 'Lockin - Turn Big Tasks Into a Daily Pipeline',
  },
  description:
    'Premium work-planning web app. Turn messy goals into structured day-by-day pipelines with capacity forecasting and lock-in focus.',
  icons: {
    icon: '/logo-icon.svg',
    shortcut: '/logo-icon.svg',
    apple: '/logo-icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
