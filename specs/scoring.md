# Spec — Scoring (Pontuação)

Define como a pontuação de cada jogador e de cada time é calculada por rodada. Este é o módulo mais crítico do projeto: um cálculo errado afeta todos os usuários. Tudo aqui é desenhado para ser **idempotente, baseado em snapshot, auditável e reversível**.

## 1. Princípios inegociáveis

1. **Pontos como inteiro ×10.** Internamente, todo ponto é guardado como inteiro multiplicado por 10 (gol = `80`, nota≥8 = `+10`, gol contra = `-20`). Exibição divide por 10. Nunca usar float — soma de float acumula erro e quebra a igualdade de pontuação entre usuários.
2. **Idempotência por recomputação.** A pontuação é uma **função pura** dos fatos de uma partida + o snapshot da escalação. Reprocessar a mesma partida produz exatamente o mesmo resultado. Não há "somar pontos" incremental — há "recalcular a partir dos fatos".
3. **Snapshot por rodada.** Ao travar a rodada, a escalação de cada time é congelada. A pontuação lê do snapshot, nunca da escalação ao vivo. Edições posteriores só afetam rodadas futuras.
4. **Determinismo.** Mesma entrada → mesma saída, sempre. Sem dependência de ordem de chegada dos eventos, sem dependência de relógio.
5. **Classificação derivada.** Standings são sempre a soma de `PlayerRoundScore` → `TeamRoundScore`. Nunca um contador mutado incrementalmente. Assim a classificação se autocorrige quando um fato muda.

## 2. Régua de pontuação (v1)

Posições: `GOL`, `DEF`, `MEI`, `ATA`. Valores em pontos "humanos" (o sistema guarda ×10).

### Positivos

| Evento                                    | GOL | DEF | MEI | ATA |
| ----------------------------------------- | --- | --- | --- | --- |
| Gol                                       | +8  | +8  | +8  | +8  |
| Assistência                               | +5  | +5  | +5  | +5  |
| Clean sheet (jogou 60+ min)               | +5  | +5  | —   | —   |
| Defesa de pênalti                         | +5  | —   | —   | —   |
| A cada 3 defesas _(condicional — ver §4)_ | +1  | —   | —   | —   |

### Bônus por nota (em degraus, exclusivo — não soma os degraus)

| Nota do jogador no jogo | Bônus |
| ----------------------- | ----- |
| Sem nota no feed (null) | 0     |
| 8,0 – 8,9               | +1,0  |
| 9,0 – 9,9               | +1,5  |
| 10                      | +2,0  |

### Negativos

| Evento                 | GOL | DEF | MEI | ATA |
| ---------------------- | --- | --- | --- | --- |
| A cada 2 gols sofridos | −1  | −1  | —   | —   |
| Cartão amarelo         | −1  | −1  | −1  | −1  |
| Cartão vermelho        | −3  | −3  | −3  | −3  |
| Pênalti perdido        | −2  | −2  | −2  | −2  |
| Gol contra             | −2  | −2  | −2  | −2  |

### Capitão

Cada rodada, o usuário marca **1 jogador como capitão** no snapshot. A pontuação total daquele jogador na rodada é **multiplicada por 2** — incluindo total negativo (capitão expulso dobra o prejuízo; é o risco da escolha, igual ao FPL).

> **Não há pontos de presença/minutos.** O limiar de 60 min sobrevive apenas como **condição** do clean sheet.

## 3. Definição de rodada (World Cup)

A Copa não tem rodadas semanais como uma liga. Modelamos **rodadas como janelas administrativas** mapeadas às fases do torneio:

- Grupos — Rodada 1, Rodada 2, Rodada 3 (cada uma cobre o N-ésimo jogo de todas as seleções).
- Mata-mata — 32-avos, 16-avos, Quartas, Semis, Final.

Regras:

- Cada rodada tem `opensAt` e um **lock time = primeiro pontapé inicial da rodada** (ou um prazo definido antes dele).
- Dentro de uma rodada, cada jogador tem **no máximo uma partida** (a seleção dele joga uma vez). Logo `PlayerRoundScore` vem de uma única partida; se a seleção foi eliminada ou tem bye, o jogador pontua 0 na rodada.

## 4. Origem de cada dado e tier de confiabilidade

Implementar a v1 **só com Tier 1 + nota (Tier 2)**. Tier 3 fica como opcional desligável, ligado só após inspecionar um jogo real.

| Item                                                             | Origem (API-Football)                          | Tier                                              |
| ---------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------- |
| Gol, assistência, cartão, gol contra, pênalti perdido/convertido | `fixtures/events`                              | 1 (sólido)                                        |
| Minutos jogados                                                  | `fixtures/players`                             | 1 (sólido)                                        |
| Clean sheet, gols sofridos                                       | **derivado** do placar final + minutos         | 1 (você calcula)                                  |
| Defesa de pênalti                                                | `fixtures/events`                              | 2 (confirmar)                                     |
| Nota do jogador (0–10)                                           | `fixtures/players` (`statistics.games.rating`) | 2 (confirmar; pode vir null → bônus 0)            |
| Defesas do goleiro (`saves`)                                     | `fixtures/players`                             | 2 (confirmar antes de ligar a regra de 3 defesas) |
| Desarme, falta, finalização                                      | `fixtures/players`                             | 3 (arriscado na Copa — **fora da v1**)            |

> Clean sheet e gols sofridos são **derivados**, não campos crus: a seleção do jogador sofreu 0 gols e ele jogou 60+ min → clean sheet. Isso é robusto porque depende só do placar (Tier 1) e dos minutos (Tier 1).

## 5. Modelo de dados

```prisma
model Round {
  id        String   @id @default(cuid())
  leagueId  String
  stage     RoundStage // GROUP_1, GROUP_2, GROUP_3, R32, R16, QF, SF, FINAL
  opensAt   DateTime
  lockAt    DateTime
  locked    Boolean  @default(false)
}

// Cópia imutável da escalação no momento da trava
model LineupSnapshot {
  id         String @id @default(cuid())
  roundId    String
  teamId     String
  formation  String
  captainId  String          // playerId do capitão
  slots      LineupSlot[]     // 11 titulares (posição + playerId)
  @@unique([roundId, teamId]) // um snapshot por time por rodada
}

// Fatos normalizados de uma partida — a fonte do cálculo
model FixtureFacts {
  id         String @id @default(cuid())
  fixtureId  Int    @unique   // ID estável da API-Football = chave de idempotência
  status     FixtureStatus    // FINISHED, CANCELLED, ...
  payload    Json             // eventos + stats por jogador, normalizados
  fetchedAt  DateTime
}

// Resultado calculado — recomputável a qualquer momento
model PlayerRoundScore {
  id         String @id @default(cuid())
  roundId    String
  teamId     String           // time de fantasy dono do jogador no snapshot
  playerId   String
  points     Int              // ×10
  isCaptain  Boolean
  breakdown  Json             // itens que somaram, para auditoria/explicação
  @@unique([roundId, teamId, playerId])
}

model TeamRoundScore {
  id       String @id @default(cuid())
  roundId  String
  teamId   String
  points   Int    // ×10 — soma dos PlayerRoundScore do time na rodada
  @@unique([roundId, teamId])
}
```

## 6. Idempotência — por que e como

API-Football não garante IDs estáveis por _evento_ entre puxadas. Então **não** acumulamos evento a evento. Em vez disso:

1. Ao terminar uma partida, puxamos os fatos completos e gravamos em `FixtureFacts`, chaveado por `fixtureId` (este **é** estável → é a chave de idempotência). Re-puxar **sobrescreve** os fatos daquela partida; não acumula.
2. O cálculo é uma **função pura** `score(jogador, fixtureFacts, snapshot, ruleset) -> pontos`. Recalcular regrava `PlayerRoundScore` por `(roundId, teamId, playerId)` via upsert.

Resultado: puxar a mesma partida 1 ou 100 vezes dá o mesmo total. Eventos fora de ordem ou duplicados não importam — o que vale é o estado final dos fatos, não a sequência de chegada.

> Idempotência por evento (chave `fixtureId + playerId + tipo + detalhe + minuto + sequência`) só vira necessária na **v2**, se houver ingestão ao vivo incremental. Na v1 (batch pós-jogo), o `fixtureId` é a âncora e é estritamente mais simples e mais forte.

## 7. Snapshot da rodada (fairness)

- Ao atingir `lockAt`, o sistema marca `Round.locked = true` e grava um `LineupSnapshot` por time (titulares + formação + capitão), copiando a escalação ativa naquele instante.
- A partir daí, qualquer edição de escalação do usuário afeta **rodadas futuras**, nunca a travada.
- O scoring lê **exclusivamente** do `LineupSnapshot`. Todos os times são pontuados contra o mesmo congelamento.
- **Leitura durante recálculo:** a classificação exibida vem sempre de `TeamRoundScore` já commitado. O recálculo de uma rodada roda numa transação; nada parcial fica visível. (Sem dirty read; sem necessidade de Redis na v1.)

## 8. Rollback e correções (de graça, por design)

Como tudo é recomputação a partir de `FixtureFacts`:

- **Partida cancelada após começar** → marca `FixtureFacts.status = CANCELLED`, fatos viram vazios/nulos → recálculo zera a contribuição daquela partida → `TeamRoundScore` cai sozinho.
- **Resultado corrigido** (gol anulado pelo VAR depois, assistência reatribuída, cartão revisto) → re-puxa os fatos → recalcula. Sem migração manual de pontos.
- **Classificação** nunca é mutada na mão; é sempre a soma dos scores → autocorrige.
- Guardar `breakdown` em `PlayerRoundScore` permite explicar ao usuário _por que_ a pontuação dele mudou.

## 9. Algoritmo (pseudocódigo)

```
funcao calcularRodada(round):
  para cada snapshot in LineupSnapshot(round):
    para cada slot in snapshot.slots (11 titulares):
      player = slot.player
      facts  = FixtureFacts da partida do player nessa rodada
      base   = pontuarJogador(player, slot.position, facts)   // §2, em ×10
      se player.id == snapshot.captainId:
        base = base * 2                                        // dobra inclusive negativo
      upsert PlayerRoundScore(round, snapshot.team, player, base, breakdown)
    TeamRoundScore(round, team) = soma dos PlayerRoundScore do time
  // tudo dentro de uma transação por rodada

funcao pontuarJogador(player, pos, facts):
  se facts ausente ou player nao entrou em campo: retorna 0
  p  = 0
  p += 80 * gols
  p += 50 * assistencias
  p -= 30 * vermelhos ; p -= 10 * amarelos
  p -= 20 * golsContra ; p -= 20 * penaltisPerdidos
  se pos in (GOL, DEF):
    se cleanSheet(facts, player): p += 50            // exige 60+ min
    p -= 10 * floor(golsSofridos / 2)
  se pos == GOL:
    p += 50 * penaltisDefendidos
    se SAVES_HABILITADO: p += 10 * floor(defesas / 3)
  p += bonusPorNota(facts.rating)                    // 0 / 10 / 15 / 20
  retorna p
```

## 10. Casos de borda

- **Eventos duplicados / fora de ordem** → irrelevantes (recomputação a partir do estado final).
- **Dado chegando tarde** → recalcula quando chegar; classificação ajusta.
- **Capitão não jogou** (banco/seleção eliminada) → `base = 0`, e `0 × 2 = 0`: o bônus de capitão simplesmente se perde. _(Opcional v2: vice-capitão como fallback.)_
- **Nota null** → bônus por nota = 0 (nunca trava o cálculo).
- **Jogador de seleção eliminada** → não tem partida na rodada → 0; o usuário deveria tê-lo trocado na janela (ver `specs/trades.md`).
- **Troca no meio da rodada** → impossível: trocas travam durante rodada travada; o dono no snapshot é fixo.
- **Gol contra** → atribuído ao jogador que marcou contra (−2), distinto de gol normal; o feed marca a flag.

## 11. Critérios de aceite (testes)

- Recalcular a mesma `FixtureFacts` duas vezes produz `PlayerRoundScore` e `TeamRoundScore` idênticos (idempotência).
- Cancelar uma partida zera a contribuição dela e reduz `TeamRoundScore` correspondente.
- Capitão dobra a pontuação do jogador, inclusive quando negativa.
- Clean sheet só conta com 60+ min jogados; com 59 min e 0 gols sofridos → sem clean sheet.
- Gols sofridos: 0–1 sofridos → 0 de punição; 2–3 → −1; 4–5 → −2 (floor de /2).
- Bônus por nota nos limites: 7,9 → 0; 8,0 → +1,0; 8,9 → +1,0; 9,0 → +1,5; 10 → +2,0; null → 0.
- Editar a escalação após o lock não altera a pontuação da rodada travada.
- `TeamRoundScore` é sempre igual à soma dos `PlayerRoundScore` daquele time/rodada.
- Todos os pontos persistidos são inteiros (×10); nenhuma operação usa float.

```

```
