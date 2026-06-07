'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/cn';
import { NAV_ITEMS, isNavItemActive } from '@/components/nav/nav-items';

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/home" className="font-display text-2xl text-amber-400 hover:text-amber-300">
          WCF
        </Link>

        <nav className="hidden items-center gap-1 font-body text-sm md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 rounded px-3 py-1.5 transition-colors',
                  active ? 'text-amber-400' : 'text-text-secondary hover:text-text-primary',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className="flex items-center gap-4 font-body text-sm">
            <span className="hidden text-text-secondary sm:inline">
              <span className="text-text-primary">{user.teamName}</span>
            </span>
            <button
              onClick={handleLogout}
              className="cursor-pointer rounded border border-border px-3 py-1 text-text-secondary transition-colors hover:border-amber-500 hover:text-amber-400"
            >
              Sair
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
