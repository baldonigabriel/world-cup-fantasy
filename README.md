# Fantasy World Cup ⚽

A fantasy football game for the **2026 FIFA World Cup**, in the spirit of Cartola FC — with one twist: **exclusive player ownership per league.** Each athlete belongs to a single team within your league, which is what gives the draft and player-to-player trades real meaning.

> Status: **in development** (implementation phase). v1 targets the World Cup group stage (kickoff June 11, 2026).

## How it works

1. **League** — a group of friends (up to ~8 teams) creates or joins a league.
2. **Draft** — a random draw sets the order; the draft is **asynchronous, turn-based (snake)**: everyone picks in their own time, but in order. A picked player leaves the pool for everyone.
3. **Squad** — 15 players per team: 2 goalkeepers, 5 defenders, 4 midfielders, 4 forwards. At most **1 player per country** per team.
4. **Lineup** — before each round you set a formation and your starting XI plus 4 substitutes. The lineup locks at the start of the round.
5. **Scoring** — computed from real match events (goals, assists, etc.) after each round, knockout stage included.
6. **Trades** — within specific windows (e.g. before the knockouts), one-for-one trades between users and signings of undrafted players.
7. **Champion** — highest cumulative score at the end of the tournament wins.

## Tech stack

| Workspace         | npm name      | Technology                                       |
| ----------------- | ------------- | ------------------------------------------------ |
| `apps/api`        | `@wcf/api`    | NestJS 10 · Prisma · PostgreSQL 16 · JWT         |
| `apps/web`        | `@wcf/web`    | Next.js 14 · Tailwind · Zustand · TanStack Query |
| `packages/shared` | `@wcf/shared` | Shared TypeScript types                          |

Monorepo via **pnpm workspaces** · Docker Compose · GitHub Actions (lint → typecheck → test) · Node >=20 · pnpm >=9.

## Running locally

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # fill in the variables
docker compose up -d                     # postgres + redis
pnpm --filter @wcf/api prisma migrate dev
pnpm --filter @wcf/api start:dev         # API at http://localhost:3000/api/v1
pnpm --filter @wcf/web dev               # Web at http://localhost:3001
```

API documentation (Swagger): `http://localhost:3000/api/docs`.

## Data source

Scoring is driven by match events from a sports-data API with official 2026 World Cup coverage (API-Football), **not** by scraping Sofascore/Flashscore. The scoring rules are our own and based on discrete, auditable events (see `specs/scoring.md`).

## Roadmap

- **v1 (World Cup 2026)** — auth, snake draft, squads, per-round lineups, batch scoring, standings, windowed trades.
- **v2** — live draft (server-authoritative timer, Socket.IO), automatic substitutions, real-time scoring (BullMQ), multiple and private leagues.

## Repository layout

```
.
├── apps/
│   ├── api/        # NestJS backend
│   └── web/        # Next.js frontend
├── packages/
│   └── shared/     # shared types and contracts
├── specs/          # domain specs (draft, trades, scoring)
├── CLAUDE.md       # operational guide for Claude Code
└── docker-compose.yml
```

## Contributing

Conventional Commits + GitFlow. Branches come off `develop` and merge via PR with a checklist. Every new module ships with tests; every endpoint ships with up-to-date Swagger docs.
