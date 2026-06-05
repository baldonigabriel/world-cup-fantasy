# CLAUDE.md — Fantasy World Cup (@wcf)

Guia operacional para o Claude Code. Leia antes de qualquer tarefa. As regras de domínio detalhadas ficam em `/specs` — este arquivo é o índice e o resumo de alto sinal.

## O que é

Fantasy game da Copa do Mundo 2026 (estilo Cartola FC) com **posse exclusiva de jogadores por liga**, **draft turn-based assíncrono (snake)**, gestão de elenco e formação por rodada, **trocas entre usuários** e **pontuação por eventos**. Monorepo pnpm com 3 packages.

## Stack

- **`apps/api` (@wcf/api)** — NestJS 10, Prisma, PostgreSQL 16, JWT (access 15min / refresh 7d), Swagger em `/api/docs`, class-validator/transformer, Helmet, CORS dinâmico. Prefixo global `api/v1`.
- **`apps/web` (@wcf/web)** — Next.js 14 App Router, Tailwind + shadcn/ui (customizado, ver skills de design), Zustand (estado de UI), TanStack Query (estado de servidor).
- **`packages/shared` (@wcf/shared)** — tipos TS compartilhados: DTOs, enums de posição (`GOL | DEF | MEI | ATA`), contratos de evento de jogo. Front e back importam daqui.
- **Infra** — Docker Compose (postgres:16-alpine, redis:7-alpine), GitHub Actions (lint → typecheck → test, em sequência). Node >=20, pnpm >=9.

> **Redis/BullMQ e Socket.IO: NÃO usar na v1.** O scaffold já os registra, mas a v1 não tem draft ao vivo nem scoring em tempo real. A pontuação roda em **batch após cada rodada**. Só introduza fila/realtime quando uma feature realmente exigir (decisão documentada em spec, não improvisada).

## Comandos

> Confirme os scripts reais em cada `package.json` antes de assumir. Estes são os esperados.

- Instalar: `pnpm install`
- Subir infra local: `docker compose up -d`
- API (dev): `pnpm --filter @wcf/api start:dev`
- Web (dev): `pnpm --filter @wcf/web dev`
- Migrations: `pnpm --filter @wcf/api prisma migrate dev`
- Prisma Studio: `pnpm --filter @wcf/api prisma studio`
- Testes: `pnpm test` — de um package: `pnpm --filter @wcf/api test`
- Lint: `pnpm lint` • Typecheck: `pnpm typecheck`

## Convenções (inegociáveis)

- TypeScript `strict: true`. **Proibido `any` explícito.**
- **Proibido `console.log`** em código de produção — use o `Logger` do Nest.
- Conventional Commits (commitlint + husky): `feat/fix/docs/style/refactor/test/chore/perf`, lowercase, `<=72` chars no header.
- GitFlow: branches saem de `develop`, merge via PR. Prefixos `feat/*`, `fix/*`, `release/*`, `hotfix/*`.
- **Todo módulo novo tem teste unitário (Jest).** Sem teste, o PR não fecha.
- **Todo endpoint novo ou alterado atualiza o Swagger** no mesmo PR.
- Toda entrada validada por DTO + class-validator. Nunca confie no client.
- ESLint/Prettier: `semi`, `singleQuote`, `tabWidth 2`, `printWidth 100`.

## Invariantes de domínio (NUNCA violar)

Estas regras protegem a corretude do jogo. Detalhe completo em `/specs`.

1. **Posse exclusiva** — um jogador pertence a no máximo um time por liga. Garantido por `unique(league_id, player_id)` **no banco**, não apenas na aplicação.
2. **Diversidade de país** — no máximo 1 jogador por país por time. Garantido por `unique(roster_id, country_id)` **no banco**.
3. **Trava de rodada** — ao iniciar uma rodada, a escalação e a posse são congeladas em snapshot. A pontuação é calculada sobre esse snapshot. Nada que aconteça depois altera o passado.
4. **Idempotência do scoring** — todo evento de jogo carrega uma chave de idempotência. Reprocessar o mesmo evento jamais duplica pontos.
5. **Atomicidade** — pick de draft, troca e contratação são transações (`prisma.$transaction`). Ou tudo acontece, ou nada.
6. **Autoridade do servidor** — ordem do draft, janelas de troca e trava de rodada são decididas pelo servidor. O client nunca é fonte da verdade.

## Workflow esperado do Claude Code

- **Spec-first.** Antes de implementar um módulo, leia a spec correspondente em `/specs`. Se ela não existir, escreva/proponha a spec **antes** do código.
- Para mudanças não-triviais: apresente diagnóstico + plano **antes** de aplicar. Aplique direto só one-liners ou ajustes triviais.
- Mapeie a superfície afetada (módulos, banco, contratos em `@wcf/shared`) antes de mexer.
- Mudou um contrato? Atualize `packages/shared` **e** o Swagger no mesmo PR.

## Ordem de implementação (v1)

1. **Schema Prisma + migrations** — User, League, Membership, Country, Player, Roster, RosterPlayer, DraftState, DraftPick, Round, Lineup, LineupSlot, Trade, TradeItem.
2. **auth** — register / login / refresh, guards JWT.
3. **players** — importação do dataset da API de dados (catálogo + países + posição em 4 buckets).
4. **leagues** — criar liga, entrar, sortear ordem do draft.
5. **draft** — máquina de estados turn-based snake (ver `specs/draft.md`).
6. **lineup** — escalação/formação por rodada + trava.
7. **scoring** — batch pós-rodada (ver `specs/scoring.md`, a escrever).
8. **standings** — ranking sobre snapshots.
9. **trades** — janelas + 1-por-1 + free agents (ver `specs/trades.md`).

## Specs

- `specs/draft.md` — ordem snake, quotas de elenco, posse exclusiva, regra de país, máquina de estados.
- `specs/trades.md` — janelas, troca 1-por-1 mesma posição, contratação de free agents.
- `specs/scoring.md` — pontuação por evento, idempotência, rollback. **(A escrever — depende da API de dados escolhida.)**
