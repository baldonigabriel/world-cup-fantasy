// Shared nav structure for the top navbar (desktop) and bottom tab bar (mobile).

export interface NavItem {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactElement;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/home', label: 'Início', icon: HomeIcon },
  { href: '/leagues', label: 'Ligas', icon: ShieldIcon },
  { href: '/standings', label: 'Classificação', icon: TrophyIcon },
  { href: '/market', label: 'Mercado', icon: ExchangeIcon },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// ─── Inline icon components (SVG — no emoji) ──────────────────────────────────

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h3a1 1 0 001-1v-3h2v3a1 1 0 001 1h3a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.351-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path d="M5 2a1 1 0 00-1 1v1H3a1 1 0 00-1 1v2a3 3 0 003 3 4.002 4.002 0 003.18 3.92A4.013 4.013 0 019 15.07V17H7a1 1 0 100 2h6a1 1 0 100-2h-2v-1.93a4.013 4.013 0 011.82-2.15A4.002 4.002 0 0015 10a3 3 0 003-3V5a1 1 0 00-1-1h-1V3a1 1 0 00-1-1H5zm-1 4V5h1v3.83A2.002 2.002 0 014 7V6zm12 0v1a2.002 2.002 0 01-1 1.83V5h1v1z" />
    </svg>
  );
}

function ExchangeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path d="M3 7a1 1 0 011-1h9.586l-2.293-2.293a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L13.586 8H4a1 1 0 01-1-1zm14 6a1 1 0 01-1 1H6.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 111.414 1.414L6.414 12H16a1 1 0 011 1z" />
    </svg>
  );
}
