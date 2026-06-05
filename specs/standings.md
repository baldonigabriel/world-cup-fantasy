# Spec — Standings (Classificação)

Define como a classificação da liga é calculada e exposta.

## 1. Princípio

Standings são **sempre derivados** de `TeamRoundScore` — nunca mantidos como contador incremental. Se um score for recalculado (correção de fatos), a classificação se autocorrige na próxima consulta. (Invariante §5 do spec de scoring.)

## 2. Endpoints

| Método | Rota                                     | Descrição                                                 |
| ------ | ---------------------------------------- | --------------------------------------------------------- |
| GET    | `/leagues/:id/standings`                 | Classificação geral — total acumulado de todas as rodadas |
| GET    | `/leagues/:id/standings/rounds/:roundId` | Classificação de uma rodada específica                    |

Ambos exigem JWT e que o usuário seja membro da liga.

## 3. Classificação geral

- Agrega `TeamRoundScore.points` de **todas** as rodadas por time.
- Times sem nenhum score aparecem com `totalPoints = 0` (inclui times que ainda não jogaram nenhuma rodada).
- Ordenação: `totalPoints` descrescente.
- Empates recebem o mesmo rank; o próximo rank pula (ex.: 1, 1, 3).
- Retorna `roundPoints: Record<roundId, points>` para auditoria e exibição por rodada.

## 4. Classificação por rodada

- Usa `TeamRoundScore.points` da rodada específica.
- Times sem score na rodada (não submeteram escalação) aparecem com `totalPoints = 0`.
- Ordenação: `totalPoints` descrescente.

## 5. Formato de resposta

Todos os valores de pontos são **×10 inteiros** — cliente divide por 10 para exibir.

```json
[
  {
    "rank": 1,
    "rosterId": "...",
    "teamName": "Flamengo FC",
    "username": "joao",
    "totalPoints": 1450,
    "roundPoints": { "round-abc": 800, "round-xyz": 650 }
  }
]
```

## 6. Critérios de aceite

- Retorna todos os membros da liga, mesmo com 0 pontos.
- Empate: dois times com mesmo total recebem o mesmo rank.
- Remoção de um `TeamRoundScore` (recálculo) é refletida na próxima consulta.
- Não-membro recebe 404.
- `totalPoints` sempre = soma dos valores de `roundPoints`.
