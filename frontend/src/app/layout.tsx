import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KasirKita - POS & Inventory Minimarket Modern',
  description: 'Sistem Manajemen Point of Sale & Inventori Grosir/Retail dengan HPP Weighted Average & OCR Nota',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="dark">
      <body className="antialiased min-h-screen selection:bg-blue-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
