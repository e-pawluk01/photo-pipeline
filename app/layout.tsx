import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'x', description: 'x' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, themeColor: '#0B0B0C' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body className="font-body antialiased">{children}</body></html>);
}
