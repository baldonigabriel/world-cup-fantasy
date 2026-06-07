# Spec — Auth

Define os campos da conta de usuário, as regras de cadastro e login, e as garantias de unicidade. Cobre a introdução do campo `email` (obrigatório) no cadastro.

## 1. Objetivo

Toda conta tem `username` (login), `email`, `teamName` e senha. `username` e `email` são identificadores únicos no sistema — qualquer um dos dois pode ser usado para autenticar.

## 2. Modelo de conta (`User`)

| Campo          | Tipo   | Regra                                                                          |
| -------------- | ------ | ------------------------------------------------------------------------------ |
| `username`     | string | único, 3–30 chars, login                                                       |
| `email`        | string | único, formato de e-mail válido, normalizado para lowercase antes de persistir |
| `teamName`     | string | 2–50 chars                                                                     |
| `passwordHash` | string | bcrypt, nunca exposto em respostas                                             |

`unique(email)` é garantido **no banco** (constraint), não apenas na aplicação — mesmo padrão já usado para `username` (princípio de posse exclusiva do projeto se estende a unicidade de identidade).

## 3. Cadastro (Register)

`POST /api/v1/auth/register`

Campos obrigatórios: `username`, `email`, `teamName`, `password`.

Validações (DTO + class-validator):

- `username` — string, 3–30 chars
- `email` — `@IsEmail`, obrigatório; normalizado para lowercase no service antes de checar unicidade e persistir
- `teamName` — string, 2–50 chars
- `password` — string, 6–100 chars

Checagem de unicidade: o service verifica `username` **e** `email` antes de criar a conta. Conflito em qualquer um dos dois retorna `409 Conflict` com mensagem que identifica qual campo colidiu (`username already taken` / `email already in use`).

Sem fluxo de verificação por e-mail na v1 — não há envio de e-mail de confirmação nem conta "pendente". Isso exigiria fila/e-mail transacional, fora do escopo da v1 (ver CLAUDE.md: não introduzir fila/realtime sem necessidade documentada).

## 4. Login

`POST /api/v1/auth/login`

O campo de identificação aceita **username OU e-mail** no mesmo input (`identifier` + `password`). O service decide qual é:

- Se o valor contém `@`, trata como e-mail (normaliza para lowercase e busca por `email`).
- Caso contrário, trata como `username`.

Em ambos os casos, falha de usuário não encontrado ou senha inválida retorna `401 Unauthorized` com a mesma mensagem genérica (`invalid credentials`) — não revelar qual campo falhou, para não vazar quais contas existem.

## 5. Migração

`email` é `NOT NULL UNIQUE` no schema final. Como a tabela `User` já existe (coluna nova em tabela com possíveis linhas), a migration precisa de uma estratégia de backfill para linhas existentes antes de aplicar a constraint `NOT NULL` — ex.: gerar um placeholder único por linha (`<id>@placeholder.local`) na própria migration SQL, e então tornar a coluna obrigatória. Em ambiente local/dev isso normalmente significa resetar o banco (`prisma migrate reset`) já que não há usuários reais — confirmar antes de rodar a migration se há dados a preservar.

## 6. Superfície afetada

- `apps/api/prisma/schema.prisma` — campo `email` em `User`
- `apps/api/src/modules/auth/dto/register.dto.ts` — campo `email`
- `apps/api/src/modules/auth/dto/login.dto.ts` — campo `identifier` substitui `username`
- `apps/api/src/modules/auth/auth.service.ts` — lógica de detecção username/e-mail no login, checagem dupla de unicidade no register, normalização de e-mail
- `apps/api/src/modules/auth/auth.service.spec.ts` — testes para os novos caminhos
- `packages/shared` — DTOs/contratos compartilhados de register/login, se existirem
- `apps/web/src/app/(auth)/register/page.tsx` — campo de e-mail no formulário
- `apps/web/src/app/(auth)/login/page.tsx` — label/placeholder ajustado para "username ou e-mail"
- `apps/web/src/store/auth.store.ts` (ou equivalente) — assinatura de `register`/`login`
- Swagger — exemplos e descrições dos DTOs atualizados no mesmo PR
