# World Cup Fantasy

Fantasy game for the FIFA World Cup — built with NestJS, Next.js 14, and real-time drafts.

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 10, Prisma, PostgreSQL, Redis, BullMQ, Socket.IO |
| Frontend | Next.js 14 App Router, Tailwind CSS, shadcn/ui, Zustand |
| Infra | Docker Compose, GitHub Actions CI |

## Getting Started

```bash
# 1. Install dependencies
pnpm install

# 2. Copy and fill environment variables
cp .env.example .env

# 3. Start infrastructure (Postgres + Redis)
docker compose up -d

# 4. Start API in dev mode
pnpm --filter @wcf/api start:dev

# 5. Start web in dev mode
pnpm --filter @wcf/web dev
```

## Available Scripts

```bash
pnpm lint        # ESLint across all workspaces
pnpm typecheck   # TypeScript check across all workspaces
pnpm test        # Jest across all workspaces
pnpm format      # Prettier
```

## Branch Strategy

GitFlow — `feat/*` and `fix/*` branch from `develop`, merge back via PR.
`release/*` and `hotfix/*` target `main`.
