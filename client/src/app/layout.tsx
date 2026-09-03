import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Schneider Electric MSS - Fastest Finger First',
  description: 'Real-Time Cybersecurity MCQ Quiz Application for Schneider Electric Managed Security Services Team',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased selection:bg-schneider-green selection:text-white bg-slate-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
