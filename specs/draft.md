# Spec — Draft

Define o módulo de draft: como os times montam seus elencos a partir de um pool compartilhado, de forma assíncrona e verificável pelo sistema.

## 1. Objetivo

Cada time monta um elenco de 15 jogadores escolhendo, na sua vez, jogadores **ainda disponíveis** no pool. O draft acontece **dentro do sistema** — o sistema é a fonte da verdade da posse. Não existe "validar depois": a atribuição é o próprio resultado do draft.

## 2. Pré-draft: ordem de escolha

- Antes do draft, o sistema realiza um **sorteio** que define a ordem dos times (`draft_order`, de 1 a N).
- O sorteio é responsabilidade do servidor (autoridade do servidor). O resultado é persistido e imutável após o início do draft.

## 3. Ordem snake (serpentina)

A ordem **inverte a cada rodada** de picks, para justiça. Com N times e 15 rodadas:

- Rodada 1: time 1 → time N
- Rodada 2: time N → time 1
- Rodada 3: time 1 → time N
- ... (15 rodadas no total, pois cada time escolhe 15 jogadores)

Exemplo com 8 times — o pick global `p` (0-indexed) mapeia para:

```
round = floor(p / N)
pos   = p % N
pickingTeam = (round par)  ? order[pos]
                           : order[N - 1 - pos]
```

> **Por que snake e não linear:** em ordem linear, o time 1 pega o melhor jogador de toda rodada e o time N só pega sobras — injusto. No snake, quem escolhe por último numa rodada escolhe primeiro na próxima.

## 4. Modelo de posições

Quatro buckets apenas: **`GOL`, `DEF`, `MEI`, `ATA`**.

> Decisão de design: APIs de dados normalmente devolvem só "Defender" sem separar lateral/zagueiro de forma confiável. Não tente subdividir DEF na v1 — classificaria 120 jogadores na mão com dados ruins. Subdivisão fica para v2 se houver fonte confiável.

## 5. Composição do elenco (quotas)

Cada time deve terminar o draft com exatamente **15 jogadores**:

| Posição | Quantidade |
| ------- | ---------- |
| GOL     | 2          |
| DEF     | 5          |
| MEI     | 4          |
| ATA     | 4          |

(Titulares = 11, conforme a formação escolhida por rodada; reservas = 4. Ver `lineup`.)

## 6. Regras de elegibilidade de um pick

Um pick de `player` por `team` só é válido se TODAS forem verdadeiras:

1. **Disponível** — `player` não pertence a nenhum time desta liga.
2. **É a vez** — o ponteiro de vez aponta para `team`.
3. **Quota não estourada** — `team` ainda não atingiu a quota da posição de `player`.
4. **País único no time** — `team` ainda não possui jogador do país de `player`.
5. **(Salvaguarda) Completável** — o pick não pode tornar impossível completar as quotas restantes com os países ainda disponíveis. Na prática quase nunca dispara (48 seleções × 26 jogadores = pool enorme vs. 15×N draftados), mas o sistema deve bloquear o pick que inviabilize um elenco válido.

### Por que a regra de país é por TIME, e não global

A regra "uma seleção inteira fica bloqueada para todos após o primeiro pick" é **matematicamente impossível** aqui: são 48 seleções, mas N=8 times × 15 jogadores = **120 picks** necessários. Com 1 jogador por seleção no total, o teto seria 48 < 120 e o draft travaria.

A versão viável e fiel à intenção (diversidade): **no máximo 1 jogador por país por time.** Os 15 jogadores de um time vêm de 15 países distintos. Times diferentes podem ter jogadores do mesmo país (ex.: time A tem Messi, time B tem Di María), mas dentro de um time nunca há dois do mesmo país.

> Parâmetro configurável: se "15 países distintos por time" ficar apertado na prática, troque para "máximo K por país" relaxando a regra 4 e a constraint do banco.

## 7. Garantias no banco (não só na aplicação)

- `unique(league_id, player_id)` → **posse exclusiva**. Dois picks concorrentes do mesmo jogador: o banco rejeita o segundo atomicamente.
- `unique(roster_id, country_id)` → **1 país por time**.
- O pick roda dentro de `prisma.$transaction`: revalida elegibilidade, insere `RosterPlayer`, avança o ponteiro de vez — tudo ou nada.

## 8. Máquina de estados do draft

```
PENDING ──(sorteio + start)──▶ IN_PROGRESS ──(último pick válido)──▶ COMPLETED
```

- **PENDING** — liga formada, aguardando sorteio/início. Picks proibidos.
- **IN_PROGRESS** — ponteiro de vez ativo. Aceita picks válidos; cada pick avança o ponteiro.
- **COMPLETED** — todos os times com 15 jogadores. Picks proibidos. Libera a escalação da rodada 1.

Estado persistido em `DraftState` (liga, status, índice do pick atual, ordem sorteada).

## 9. Ação: realizar um pick

`POST /api/v1/leagues/:leagueId/draft/pick { playerId }`

1. Carrega `DraftState` da liga (lock pessimista da linha, ou confia nas constraints + transação).
2. Verifica `status === IN_PROGRESS`.
3. Resolve o time do usuário autenticado; verifica que é a vez dele.
4. Valida as regras da seção 6.
5. Em transação: insere `RosterPlayer`, incrementa o índice do pick, recalcula o próximo time. Se foi o último pick → `status = COMPLETED`.
6. Retorna o novo estado (próximo time, pool atualizado opcional).

Erros: `409` (jogador já tomado / não é a vez / país repetido / quota cheia), `404` (jogador ou liga), `400` (estado inválido).

## 10. Edge cases

- **Pick simultâneo do mesmo jogador** → a constraint `unique(league_id, player_id)` garante que só um vence; o outro recebe `409` e re-busca o pool.
- **Usuário some no meio do draft** → v1: draft fica parado na vez dele (aceitável com 8 amigos). v2 opcional: prazo de X horas + auto-pick do melhor disponível elegível.
- **Pool insuficiente para uma posição/país** → bloqueado pela regra 6.5 antes de chegar a um estado inválido.
- **Tentativa de pick fora da vez** → `409`, sem efeito colateral.

## 11. Esboço de dados (Prisma)

```prisma
model DraftState {
  id            String   @id @default(cuid())
  leagueId      String   @unique
  status        DraftStatus @default(PENDING)
  order         String[] // teamIds na ordem sorteada
  currentPick   Int      @default(0) // índice global do pick
  picks         DraftPick[]
}

model RosterPlayer {
  id        String @id @default(cuid())
  rosterId  String
  playerId  String
  leagueId  String
  countryId String
  // posse exclusiva por liga:
  @@unique([leagueId, playerId])
  // 1 país por time:
  @@unique([rosterId, countryId])
}
```

## 12. Critérios de aceite (testes)

- Snake mapeia corretamente picks → times (testar viradas de rodada com N=8, 15 rodadas).
- Pick de jogador já tomado retorna 409 e não altera estado.
- Pick fora da vez retorna 409.
- Pick que excede quota de posição é rejeitado.
- Pick de país já presente no time é rejeitado.
- Dois picks concorrentes do mesmo jogador: exatamente um persiste.
- Ao 15º pick de cada time, `status` vira `COMPLETED`.
- Elenco final de todo time: 2 GOL, 5 DEF, 4 MEI, 4 ATA, 15 países distintos.
