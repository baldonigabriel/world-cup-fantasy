import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-6xl text-amber-400 md:text-8xl">Fantasy World Cup</h1>
        <p className="mt-3 text-lg text-text-secondary">Draft your squad. Own the Copa. 2026.</p>
      </div>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded border border-border bg-surface px-8 py-3 font-body font-semibold text-text-primary transition-colors hover:border-amber-500 hover:text-amber-400"
        >
          Entrar
        </Link>
        <Link
          href="/register"
          className="rounded bg-amber-500 px-8 py-3 font-body font-semibold text-background transition-colors hover:bg-amber-400"
        >
          Criar conta
        </Link>
      </div>
    </main>
  );
}
