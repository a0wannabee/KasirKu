'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { getSession } from '@/lib/auth';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace('/login');
    } else {
      setMounted(true);
    }
  }, [router]);

  if (!mounted) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-dark-900 text-gray-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-sm">Memeriksa sesi pengguna...</p>
        </div>
      </div>
    );
  }

  // Get dynamic title based on path
  const getPageTitle = () => {
    if (pathname.includes('/dashboard')) return 'Dashboard Utama';
    if (pathname.includes('/kasir')) return 'Terminal Point of Sale (POS)';
    if (pathname.includes('/produk')) return 'Master Produk & HPP';
    if (pathname.includes('/inventori')) return 'Manajemen Inventori & Stok';
    if (pathname.includes('/pembelian')) return 'Pembelian & Ekstraksi Nota (OCR)';
    if (pathname.includes('/laporan')) return 'Laporan Penjualan & Finansial';
    if (pathname.includes('/users')) return 'Manajemen Pengguna & Role';
    return 'KasirKita POS';
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-dark-900 text-gray-100">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar title={getPageTitle()} />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
