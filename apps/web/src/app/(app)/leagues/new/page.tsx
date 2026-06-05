'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { api, ApiError } from '@/lib/api';
import type { LeagueResponseDto } from '../types';

export default function NewLeaguePage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [maxTeams, setMaxTeams] = useState(8);

  const mutation = useMutation({
    mutationFn: (data: { name: string; maxTeams: number }) =>
      api.post<LeagueResponseDto>('/leagues', data, accessToken ?? undefined),
    onSuccess: (league) => {
      queryClient.invalidateQueries({ queryKey: ['my-leagues'] });
      router.push(`/leagues/${league.id}`);
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({ name, maxTeams });
  }

  const error =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? 'Erro inesperado.'
        : '';

  return (
    <div className="mx-auto max-w-md space-y-8">
      <h1 className="font-display text-5xl text-text-primary">NOVA LIGA</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1">
          <label
            htmlFor="name"
            className="text-xs font-semibold uppercase tracking-wider text-text-secondary"
          >
            Nome da liga
          </label>
          <input
            id="name"
            type="text"
            required
            minLength={3}
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-border bg-surface-2 px-4 py-3 font-body text-text-primary outline-none transition-colors focus:border-amber-500"
            placeholder="Liga dos Brabos"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="maxTeams"
            className="text-xs font-semibold uppercase tracking-wider text-text-secondary"
          >
            Máximo de times
          </label>
          <select
            id="maxTeams"
            value={maxTeams}
            onChange={(e) => setMaxTeams(Number(e.target.value))}
            className="w-full rounded border border-border bg-surface-2 px-4 py-3 font-body text-text-primary outline-none transition-colors focus:border-amber-500"
          >
            {[2, 4, 6, 8, 10, 12, 16].map((n) => (
              <option key={n} value={n}>
                {n} times
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded bg-amber-500 py-3 font-body font-semibold text-background transition-colors hover:bg-amber-400 disabled:opacity-50"
        >
          {mutation.isPending ? 'Criando...' : 'Criar liga'}
        </button>
      </form>
    </div>
  );
}
