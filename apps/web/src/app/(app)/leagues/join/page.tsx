'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { api, ApiError } from '@/lib/api';
import type { LeagueResponseDto } from '../types';

export default function JoinLeaguePage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const [code, setCode] = useState('');

  const mutation = useMutation({
    mutationFn: (inviteCode: string) =>
      api.post<LeagueResponseDto>('/leagues/join', { inviteCode }, accessToken ?? undefined),
    onSuccess: (league) => {
      queryClient.invalidateQueries({ queryKey: ['my-leagues'] });
      router.push(`/leagues/${league.id}`);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(code.toUpperCase());
  }

  const errorMsg =
    mutation.error instanceof ApiError
      ? mutation.error.status === 404
        ? 'Código inválido. Verifique e tente novamente.'
        : mutation.error.status === 409
          ? 'Você já está nessa liga ou ela está cheia.'
          : mutation.error.message
      : mutation.error
        ? 'Erro inesperado.'
        : '';

  return (
    <div className="mx-auto max-w-md space-y-8">
      <h1 className="font-display text-5xl text-text-primary">ENTRAR NA LIGA</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1">
          <label
            htmlFor="code"
            className="text-xs font-semibold uppercase tracking-wider text-text-secondary"
          >
            Código da liga
          </label>
          <input
            id="code"
            type="text"
            required
            minLength={8}
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full rounded border border-border bg-surface-2 px-4 py-3 font-body font-semibold tracking-widest text-amber-400 outline-none transition-colors focus:border-amber-500"
            placeholder="ABC12345"
          />
        </div>

        {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}

        <button
          type="submit"
          disabled={mutation.isPending || code.length !== 8}
          className="w-full rounded bg-amber-500 py-3 font-body font-semibold text-background transition-colors hover:bg-amber-400 disabled:opacity-50"
        >
          {mutation.isPending ? 'Entrando...' : 'Entrar na liga'}
        </button>
      </form>
    </div>
  );
}
