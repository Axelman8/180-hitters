# Bot strategies

BOT 40 and BOT 50 use the same game rules and planning. Their physical accuracy
differs: a planned target is passed through the shared dartboard scatter model.
A miss can therefore still land on a number with no tactical value. The bots do
not move a physical miss to a more useful number.

Plans are recalculated after each actual dart, including pending darts in the
current visit. The game engine decides when a visit or game is complete. Shared
execution leases prevent a NUC and its controllers from throwing duplicate bot
visits. Human-based difficulty adjustment remains separate from planning.

| Game | Strategy and checked situations |
| --- | --- |
| X01 | Open with the required double/master segment, follow legal checkouts and prepare a useful finish when the remaining darts cannot finish. |
| 121 | Use each player's remaining checkout attempt and respect alternating three-dart visits and the nine-dart limit. |
| Cricket / Tactics | Close legal targets, score against open opponents, repair a points deficit and defend against opposing scoring routes. No Score avoids point farming; Cut Throat attacks opponents whose low scores threaten the bot. Never deliberately score on a target closed by everyone. |
| Gotcha | Take a direct legal win, otherwise plan a reachable reset of an advanced opponent. Recalculate after misses and resets; do not chase a score below the current score. |
| Four in a Row | Take an immediate win before blocking a threat, then build promising lines. Use current-visit marks to finish a claim and ignore expired marks from old visits. Bull claims and the winning dart use the shared rules. |
| Killer | Choose an unused number, activate KILLER and attack surviving opponents. Prefer a broad single for one remaining activation mark or victim life. Skip a victim eliminated earlier in the same visit. Saved six-letter games retain their older one-hit rules. |
| Zeeslag Darts | Search unknown cells, pursue observed ships that have not sunk, and finish damaged cells. Do not deliberately select known water or destroyed cells unless the same number is still useful against another opponent. Do not keep hunting around a fully sunk ship. Ignore eliminated fleets. Unhit enemy fleet positions never influence a plan. |
| Dartgolf | Aim at the current hole's double for one stroke. Best-of-three plays a full visit. Last-dart mode banks a valid target rather than risking five strokes; on the final hole it keeps trying when banking would certainly lose to an already finished opponent. |
| Shanghai | Pursue the missing single, double and triple while the combination is still reachable this visit. Once too few darts remain, aim for triple points instead. |
| Scram | Stop open numbers with singles as stopper; score on still-open numbers as scorer. Count closures made earlier in the visit. |
| Bull / 41 | Aim at double bull in the bull role; aim for high trebles to score above 41 in the scoring role. |
| 21 | Follow the current target after every hit, use triples to advance and exploit the triple-20 finish bonus. |
| Bob's 27 | Use all darts on the current double or final double bull. |
| Hitters Challenge | Aim at the current personal target with the selected double/triple requirement; bull requires double bull. |

The Zeeslag bot banner shows its intended number and whether it is searching or
finishing a damaged cell. This distinguishes its plan from an actual miss.

## Verification

`tests/bot-strategy.mjs` checks these tactical situations for both levels and
observes every intended dart in 60 complete two-, three- and four-player Zeeslag
matches. It also changes hidden fleet positions to verify that plans do not peek.
`tests/bot-engine.mjs` runs all fifteen games with four bot seats and calibrates
both levels over 1,500 complete 501 legs each. `tests/bot-adaptive.mjs` covers
scoring variants, complete Cricket/Tactics matches and adaptive accuracy.
`tests/gotcha-bot.mjs` checks reset routes and winning priorities.
`tests/test_bots.py` exercises the actual application driver, visible individual
darts, shared leases, reconnect recovery and camera exclusion.
