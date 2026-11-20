import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'News Share // Admin & Moderation Console',
  description: 'Enterprise moderation, security administration, and audit telemetry portal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0A0B0E] text-[#F8F9FA] antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
