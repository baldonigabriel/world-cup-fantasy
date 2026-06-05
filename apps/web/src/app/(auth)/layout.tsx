export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left panel — branding */}
      <div className="hidden flex-col justify-between bg-surface p-12 lg:flex">
        <span className="font-display text-2xl text-amber-400">WCF</span>
        <div>
          <p className="font-display text-5xl leading-tight text-text-primary">
            DRAFT YOUR SQUAD.
            <br />
            <span className="text-amber-400">OWN THE COPA.</span>
          </p>
          <p className="mt-4 text-text-secondary">
            Fantasy World Cup 2026 — posse exclusiva de jogadores, draft snake, pontuação real.
          </p>
        </div>
        <p className="text-sm text-text-secondary">© 2026 Fantasy World Cup</p>
      </div>

      {/* Right panel — form */}
      <div className="flex items-center justify-center px-6 py-12">{children}</div>
    </div>
  );
}
