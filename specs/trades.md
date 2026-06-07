# Spec — Trades (Trocas e Contratações)

Define como times alteram seus elencos após o draft: trocas 1-por-1 entre usuários e contratação de jogadores não-draftados. Mantém todas as invariantes de posse e país.

## 1. Objetivo

Depois do draft, seleções são eliminadas e jogadores param de pontuar. As trocas e contratações permitem aos times renovar o elenco — sem nunca quebrar a posse exclusiva nem a regra de país.

## 2. Janelas de troca

- A janela abre no início do mata-mata e fecha antes da primeira partida das oitavas; trocas e contratações de free agents acontecem na mesma janela. A janela é controlada por `opensAt`/`closesAt` definidos pelo comissário na criação; abre e fecha por data, sem ação manual. Autoridade do servidor — o client não decide.
- Fora da janela, qualquer tentativa retorna `409`.
- **Nunca durante uma rodada travada.** Janela de troca e trava de escalação são mutuamente exclusivas: a troca altera o elenco do futuro, jamais o snapshot de uma rodada já iniciada.

## 3. Troca entre usuários (1-por-1)

Versão v1: **um jogador por um jogador, mesma posição.**

Fluxo: `A` propõe "meu `X` pelo seu `Y`" → `B` aceita ou recusa.

- **Mesma posição** — `X` e `Y` têm a mesma posição (GOL/DEF/MEI/ATA). Assim o elenco continua com as quotas válidas de graça, sem quebrar a formação.
- Proposta tem estado: `PENDING → ACCEPTED | REJECTED | CANCELLED | EXPIRED`.
- `A` pode cancelar enquanto `PENDING`. A proposta expira ao fechar a janela.

### Validação no momento do ACEITE (crítico)

Entre propor e aceitar, o mundo muda. No aceite, **revalidar dentro da transação**:

1. Janela ainda aberta.
2. `X` ainda pertence a `A`; `Y` ainda pertence a `B` (proposta "rançosa" → rejeitar com `409`).
3. Após a troca, **regra de país** continua válida para ambos os times: `A` não pode ficar com dois jogadores do país de `Y`; `B` idem com o país de `X`. (Se `X` e `Y` forem do mesmo país, sempre ok.)
4. Posição de `X` == posição de `Y`.

Se tudo passa, em `prisma.$transaction`: `X` muda de `A` para `B`, `Y` muda de `B` para `A`, proposta vira `ACCEPTED`. Ou tudo, ou nada.

> As constraints `unique(league_id, player_id)` e `unique(roster_id, country_id)` continuam valendo durante a troca. A transação precisa respeitar a ordem das operações para não violar a constraint de país transitoriamente (remova antes de inserir, ou use update direto de `rosterId`).

## 4. Contratação de free agents

Jogadores não draftados (ou liberados) podem ser contratados dentro da janela.

- Um **free agent** é um jogador sem dono na liga: não existe `RosterPlayer` com aquele `playerId` naquela `leagueId`.
- Contratar exige **liberar um jogador da mesma posição** para manter as quotas (contrata 1 ATA → dispensa 1 ATA). v1 mantém o elenco sempre em 15.
- Validações: jogador é free agent, mesma posição do dispensado, **regra de país** após a operação (não pode entrar um jogador de país que o time já tenha), janela aberta.
- O jogador dispensado **volta a ser free agent** (vira elegível para outros).
- Operação atômica em transação.

> Isso resolve o "elenco apodrecendo": quando a seleção de um titular é eliminada, o usuário dispensa esse jogador e contrata um free agent de uma seleção ainda viva.

## 5. Endpoints

- `POST /api/v1/leagues/:id/trades` — criar proposta `{ offeredPlayerId, requestedPlayerId, toTeamId }`.
- `POST /api/v1/trades/:id/accept` — aceitar (revalida tudo).
- `POST /api/v1/trades/:id/reject` — recusar.
- `POST /api/v1/trades/:id/cancel` — cancelar (só o proponente, só se `PENDING`).
- `POST /api/v1/leagues/:id/signings` — contratar free agent `{ signPlayerId, releasePlayerId }`.
- `GET /api/v1/leagues/:id/free-agents` — listar disponíveis (filtra por posição/país).
- `GET /api/v1/leagues/:id/rosters/:rosterId` — retorna os jogadores do roster de um membro da liga (qualquer membro autenticado pode consultar rosters da mesma liga). Necessário para montar o formulário de proposta de troca (selecionar jogador do time adversário da mesma posição).

## 6. Edge cases

- **Proposta rançosa** (jogador já trocado) → `409` no aceite, nenhum efeito.
- **Tentativa fora da janela** → `409`.
- **Troca que viola país** → `409` com mensagem clara de qual time/país.
- **Aceitar proposta própria / propor para si mesmo** → `400`.
- **Free agent que deixou de existir** (foi contratado por outro entre listar e contratar) → `409`, re-busca.
- **Duas contratações concorrentes do mesmo free agent** → `unique(league_id, player_id)` garante que só uma vence.

## 7. Critérios de aceite (testes)

- Troca válida 1-por-1 mesma posição: posse dos dois jogadores inverte; quotas intactas.
- Aceite de proposta rançosa rejeitado, sem efeito colateral.
- Troca que deixaria um time com 2 jogadores do mesmo país: rejeitada.
- Troca de posições diferentes: rejeitada.
- Operação fora da janela: rejeitada.
- Contratação de free agent com dispensa de mesma posição: elenco permanece 2/5/4/4 e o dispensado vira free agent.
- Contratações concorrentes do mesmo free agent: exatamente uma persiste.
