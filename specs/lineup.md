# Spec — Lineup

Define o módulo de escalação: como cada time configura a formação e os titulares/reservas para cada rodada, e como a escalação é congelada em snapshot no momento do lock.

## 1. Objetivo

Antes de cada rodada, cada time define quais 11 jogadores do seu elenco serão titulares, quais 4 serão reservas, qual a formação e quem é o capitão. Ao travar a rodada, o sistema congela esse estado em snapshot imutável — base de cálculo do scoring.

## 2. Rodadas

O dono da liga cria rodadas com `stage`, `opensAt` e `lockAt`. O campo `stage` segue o enum `RoundStage` (GROUP_1 … FINAL). Cada liga tem suas próprias rodadas.

Estado de uma rodada:

```
aberta (locked=false) ──(lock)──▶ travada (locked=true)
```

Uma vez travada, nenhum estado pode ser alterado.

## 3. Escalação (Lineup)

### 3.1 Pré-requisitos

- O usuário deve ser membro da liga (ter roster).
- O draft da liga deve estar `COMPLETED`. Antes disso, escalação é proibida.
- A rodada deve existir na liga e não estar travada.

### 3.2 Formação

A formação é uma string `DEF-MEI-ATA` onde:

- DEF + MEI + ATA = **10** (os outros 11 - 1 GOL)
- 1 ≤ DEF ≤ 5 (quota de DEF no elenco)
- 1 ≤ MEI ≤ 4 (quota de MEI no elenco)
- 1 ≤ ATA ≤ 4 (quota de ATA no elenco)

Exemplos válidos: `4-4-2`, `4-3-3`, `3-5-2`, `5-3-2`, `4-2-4`, `5-4-1`.

### 3.3 Regras dos slots

1. **Contagem exata** — exatamente 11 `isStarter=true` + 4 `isStarter=false` = 15 slots.
2. **Jogadores do elenco** — todos os `playerId` devem pertencer ao roster do usuário nesta liga.
3. **Sem duplicatas** — cada `playerId` e cada `slotIndex` únicos nos slots.
4. **1 GOL titular** — exatamente um dos 11 titulares tem posição `GOL`.
5. **Formação consistente** — a contagem de DEF/MEI/ATA titulares deve bater com a formação declarada.
6. **Capitão titular** — `captainId` deve ser um dos 11 titulares.

### 3.4 Upsert

`PUT /api/v1/leagues/:leagueId/rounds/:roundId/lineup`

A operação é idempotente: cria a escalação se não existir, substitui se já existir (apaga slots antigos, insere novos). Atômica via `prisma.$transaction`.

## 4. Trava de rodada (Lock)

`POST /api/v1/leagues/:leagueId/rounds/:roundId/lock`

Apenas o dono da liga pode travar. Ao travar:

1. Para cada `Lineup` submetida nessa rodada: cria um `LineupSnapshot` + `LineupSnapshotSlot` imutável.
2. Times sem escalação submetida são **ignorados** — não recebem pontos na rodada.
3. Seta `round.locked = true`.
4. Tudo em `prisma.$transaction`.

Após o lock, nenhum snapshot pode ser alterado. O scoring usa exclusivamente os snapshots.

## 5. Invariante de domínio (NUNCA violar)

> **Trava de rodada** — ao travar, a escalação e a posse são congeladas em snapshot. A pontuação é calculada sobre esse snapshot. Nada que aconteça depois altera o passado. (Invariante #3 do CLAUDE.md)

## 6. Endpoints

| Método | Rota                                   | Quem   | Descrição                   |
| ------ | -------------------------------------- | ------ | --------------------------- |
| POST   | `/leagues/:id/rounds`                  | dono   | Cria rodada                 |
| GET    | `/leagues/:id/rounds`                  | membro | Lista rodadas               |
| POST   | `/leagues/:id/rounds/:roundId/lock`    | dono   | Trava rodada + snapshot     |
| PUT    | `/leagues/:id/rounds/:roundId/lineup`  | membro | Upsert da própria escalação |
| GET    | `/leagues/:id/rounds/:roundId/lineup`  | membro | Lê própria escalação        |
| GET    | `/leagues/:id/rounds/:roundId/lineups` | membro | Lê todas as escalações      |

## 7. Erros

| Situação                          | Status |
| --------------------------------- | ------ |
| Liga ou rodada não encontrada     | 404    |
| Não é membro da liga              | 404    |
| Não é dono (lock / create round)  | 403    |
| Rodada travada (upsert)           | 409    |
| Draft não COMPLETED               | 409    |
| Rodada já travada (lock)          | 409    |
| Formação inválida                 | 400    |
| Contagem de titulares errada      | 400    |
| Jogador não no elenco             | 400    |
| Jogador duplicado                 | 400    |
| GOL ≠ 1 titular                   | 400    |
| Formação ≠ posições dos titulares | 400    |
| Capitão não é titular             | 400    |

## 8. Critérios de aceite (testes)

- `parseFormation("4-4-2")` → `{ def: 4, mei: 4, ata: 2 }`
- `parseFormation("3-3-5")` → `null` (ATA > 4)
- Upsert com jogador fora do elenco retorna 400.
- Upsert com rodada travada retorna 409.
- Upsert com draft não COMPLETED retorna 409.
- Upsert com formação inconsistente retorna 400.
- Upsert com capitão não-titular retorna 400.
- Segundo upsert substitui os slots sem duplicar.
- Lock com linhas de snapshot imutáveis criadas para cada escalação submetida.
- Lock por não-dono retorna 403.
- Lock de rodada já travada retorna 409.
