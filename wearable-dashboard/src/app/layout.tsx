import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Industrial Safety Wearable Dashboard',
  description: 'Real-time safety monitoring dashboard for industrial workers with ESP32 wearable devices.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
