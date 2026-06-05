'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

export function Navbar() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/leagues" className="font-display text-2xl text-amber-400 hover:text-amber-300">
          WCF
        </Link>

        <nav className="flex items-center gap-6 font-body text-sm">
          <Link
            href="/leagues"
            className="text-text-secondary transition-colors hover:text-text-primary"
          >
            Minhas Ligas
          </Link>

          {user && (
            <div className="flex items-center gap-4">
              <span className="text-text-secondary">
                <span className="text-text-primary">{user.teamName}</span>
              </span>
              <button
                onClick={handleLogout}
                className="rounded border border-border px-3 py-1 text-text-secondary transition-colors hover:border-amber-500 hover:text-amber-400"
              >
                Sair
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
