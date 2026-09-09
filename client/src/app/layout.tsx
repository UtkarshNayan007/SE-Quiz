import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Schneider Electric MSS - Fastest Finger First',
  description: 'Real-Time Cybersecurity MCQ Quiz Application for Schneider Electric Managed Security Services Team',
  icons: {
    icon: '/se-logo.png',
  },
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
        <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Cinzel:wght@600;700;800;900&family=Great+Vibes&family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,600;1,700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased selection:bg-schneider-green selection:text-white bg-slate-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
