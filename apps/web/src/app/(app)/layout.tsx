'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { Navbar } from '@/components/navbar';
import { BottomNav } from '@/components/bottom-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const refreshToken = useAuthStore((s) => s.refreshToken);

  useEffect(() => {
    if (!refreshToken) {
      router.replace('/login');
    }
  }, [refreshToken, router]);

  if (!refreshToken) return null;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 md:pb-8">{children}</main>
      <BottomNav />
    </div>
  );
}
