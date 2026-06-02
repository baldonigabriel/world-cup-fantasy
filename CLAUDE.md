# World Cup Fantasy — CLAUDE.md

> Leia este arquivo inteiro antes de qualquer implementação.

## Projeto

World Cup Fantasy é um fantasy game da Copa do Mundo estilo Cartola FC.
Monorepo pnpm workspaces com backend NestJS e frontend Next.js 14.

## Stack

### Backend (`apps/api`)
- **Framework:** NestJS 10
- **ORM:** Prisma
- **Banco de dados:** PostgreSQL 16
- **Cache / Filas:** Redis 7 + BullMQ
- **Realtime:** Socket.IO
- **Auth:** JWT (access + refresh tokens)
- **Docs:** Swagger (OpenAPI)

### Frontend (`apps/web`)
- **Framework:** Next.js 14 (App Router)
- **Estilização:** Tailwind CSS + shadcn/ui
- **Estado global:** Zustand
- **Dados assíncronos:** TanStack Query
- **Realtime:** Socket.IO client

### Compartilhado (`packages/shared`)
- Tipos TypeScript utilizados por `api` e `web`

## Estrutura

    apps/
      api/    → backend NestJS
      web/    → frontend Next.js
    packages/
      shared/ → tipos TypeScript compartilhados

## Módulos do backend

| Módulo       | Responsabilidade                                    |
|--------------|-----------------------------------------------------|
| `auth`       | Login, registro, refresh token, guards JWT          |
| `users`      | Perfil, configurações de usuário                    |
| `leagues`    | Criação e gestão de ligas                           |
| `draft`      | Sala de draft ao vivo, timer, picks em tempo real   |
| `players`    | Catálogo de jogadores, stats da Copa                |
| `matches`    | Partidas da Copa, agenda, resultados                |
| `scoring`    | Cálculo de pontuação em tempo real via BullMQ       |
| `trades`     | Trocas de jogadores entre participantes             |
| `standings`  | Classificação das ligas                             |

## Padrões de código

- TypeScript `strict: true` em todos os apps
- Conventional Commits obrigatórios (commitlint + husky)
- GitFlow: `feat/*`, `fix/*`, `release/*`, `hotfix/*`
- Testes unitários obrigatórios em todo módulo novo (Jest)
- Swagger atualizado em todo endpoint novo ou alterado
- **Nunca commitar `.env`** — usar apenas `.env.example`
- Sem `console.log` em código de produção
- Sem `any` explícito no TypeScript

## Design — Leia antes de qualquer trabalho de frontend

**Aplique AMBAS as skills antes de qualquer componente ou página:**

1. `.claude/skills/ui-ux-pro-max/SKILL.md`
2. `.claude/skills/frontend-design.md`

### Direção estética

**Dark premium esportivo.**
Referências visuais: Sorare, ESPN Fantasy, FIFA+.

**Elemento central e inesquecível:**
Sala de draft ao vivo com timer animado e picks em tempo real.

### Restrições absolutas (nunca fazer)

- Nunca usar Inter, Roboto ou fontes genéricas similares
- Nunca usar purple gradients
- Nunca usar layouts simétricos genéricos
- Nunca usar componentes shadcn sem customização visual própria
- Nunca gerar layouts que pareçam templates de IA

### Diretrizes de estilo

- Tipografia expressiva: fontes esportivas (Bebas Neue, Oswald, Barlow Condensed)
- Cores: dark base `#0A0A0F`, accents vibrantes em amber, emerald ou sky — nunca purple
- Micro-animações em interações críticas (picks, pontuação, timer de draft)
- Mobile-first em todos os componentes
- Assimetria intencional: grids que quebram a simetria, hierarquia visual forte

## Variáveis de ambiente

Ver `.env.example` na raiz. Nunca hardcodar secrets no código.

## Comandos úteis

    # Instalar todas as dependências
    pnpm install

    # Rodar lint em todos os workspaces
    pnpm lint

    # Formatar todo o código
    pnpm format

    # Rodar todos os testes
    pnpm test

    # Subir infraestrutura local
    docker compose up -d

    # Derrubar infra
    docker compose down
