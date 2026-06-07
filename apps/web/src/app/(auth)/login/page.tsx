'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { ApiError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      router.push('/home');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Usuário ou senha inválidos.');
      } else {
        setError('Erro inesperado. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-8">
      <div>
        <h1 className="font-display text-4xl text-text-primary">ENTRAR</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Não tem conta?{' '}
          <Link href="/register" className="text-amber-400 hover:text-amber-300">
            Criar agora
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label
            htmlFor="username"
            className="text-xs font-semibold uppercase tracking-wider text-text-secondary"
          >
            Login
          </label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded border border-border bg-surface-2 px-4 py-3 font-body text-text-primary placeholder-text-secondary outline-none transition-colors focus:border-amber-500"
            placeholder="seu_login"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="password"
            className="text-xs font-semibold uppercase tracking-wider text-text-secondary"
          >
            Senha
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-border bg-surface-2 px-4 py-3 font-body text-text-primary placeholder-text-secondary outline-none transition-colors focus:border-amber-500"
            placeholder="••••••••"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-amber-500 py-3 font-body font-semibold text-background transition-colors hover:bg-amber-400 disabled:opacity-50"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
