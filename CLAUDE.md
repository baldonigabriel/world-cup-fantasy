# World Cup Fantasy — CLAUDE.md

> Read this file entirely before any implementation.

## Project

World Cup Fantasy is a World Cup fantasy game in the style of Cartola FC.
pnpm workspaces monorepo with a NestJS backend and Next.js 14 frontend.

## Stack

### Backend (`apps/api`)
- **Framework:** NestJS 10
- **ORM:** Prisma
- **Database:** PostgreSQL 16
- **Cache / Queues:** Redis 7 + BullMQ
- **Realtime:** Socket.IO
- **Auth:** JWT (access 15min + refresh 7d)
- **Docs:** Swagger (OpenAPI)

### Frontend (`apps/web`)
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **Global state:** Zustand
- **Async data:** TanStack Query
- **Realtime:** Socket.IO client

### Shared (`packages/shared`)
- TypeScript types used by both `api` and `web`

## Structure

    apps/
      api/    → NestJS backend
      web/    → Next.js frontend
    packages/
      shared/ → shared TypeScript types

## Backend Modules

| Module       | Responsibility                                       |
|--------------|------------------------------------------------------|
| `auth`       | Login, register, refresh token, JWT guards           |
| `users`      | User profile and settings                            |
| `leagues`    | League creation and management                       |
| `draft`      | Live draft room, countdown timer, real-time picks    |
| `players`    | Player catalog, World Cup stats                      |
| `matches`    | World Cup fixtures, schedule, results                |
| `scoring`    | Real-time score calculation via BullMQ               |
| `trades`     | Player trades between participants                   |
| `standings`  | League standings and rankings                        |

## Code Standards

- TypeScript `strict: true` on all apps
- Conventional Commits enforced (commitlint + husky)
- GitFlow: `feat/*`, `fix/*`, `release/*`, `hotfix/*`
- Unit tests required for every new module (Jest)
- Swagger updated on every new or modified endpoint
- **Never commit `.env`** — use only `.env.example`
- No `console.log` in production code
- No explicit `any` in TypeScript

## Design — Read before any frontend work

**Load BOTH skills before any component or page:**

1. `.claude/skills/ui-ux-pro-max/SKILL.md`
2. `.claude/skills/frontend-design.md`

### Aesthetic Direction

**Dark premium sports.**
Visual references: Sorare, ESPN Fantasy, FIFA+.

**Central unforgettable feature:**
Live draft room with animated countdown timer and real-time picks.

### Hard Rules (never break)

- Never use Inter, Roboto, or generic system fonts
- Never use purple gradients
- Never use generic symmetric layouts
- Never use shadcn components without custom visual overrides
- Never produce layouts that look AI-generated or template-like

### Style Guidelines

- Expressive typography: sports fonts (Bebas Neue, Oswald, Barlow Condensed)
- Color base: `#0A0A0F` dark, vibrant accents in amber, emerald, or sky — never purple
- Micro-animations on critical interactions (picks, score updates, draft timer)
- Mobile-first on every component
- Intentional asymmetry: grids that break symmetry, strong visual hierarchy

## Environment Variables

See `.env.example` at the root. Never hardcode secrets.

## Useful Commands

    # Install all dependencies
    pnpm install

    # Lint all workspaces
    pnpm lint

    # Type check all workspaces
    pnpm typecheck

    # Format all code
    pnpm format

    # Run all tests
    pnpm test

    # Start local infrastructure
    docker compose up -d
