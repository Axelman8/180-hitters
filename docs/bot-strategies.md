# BOT strategy checks

BOT 40 and BOT 50 share the rules used by human input, cameras and online matches. Target selection and physical throwing accuracy are separate. A sensible aim can still miss, hit a neighbour or land in a different ring. The level names refer to complete 501 double-out averages; positional games and training drills do not have an equivalent points average.

Comparable tactical choices vary between games, players and visits. The same visible draft keeps the same intended target across redraws and controller handovers. Variation uses public match identity and thrown darts, without reading unrevealed ships or changing the score. A legal immediate win takes priority over variety.

| Game | Decision checks |
| --- | --- |
| X01 | Legal opening, direct finishes, checkout/setup routes, and varied high-scoring targets when no finish is available. Broad singles for straight-out finishes. |
| 121 | The X01 route logic follows the player's current remainder and available darts in the attempt. |
| Cricket | Build points, catch a deficit, deny opposing scoring routes and close the final target when the score permits a win. |
| Tactics | The same scoring/defence checks for its larger target set; Standard, Cut Throat and No Score are handled separately. A closing single is used when only one mark is needed. |
| Gotcha | Take a direct legal win, otherwise reset the most advanced reachable rival. Recompute a low-cost route after each dart and vary equally good routes. |
| 4 in a Row | Win before blocking; block an immediate opposing line before developing another line. Use marks from the current visit and avoid claimed cells. A single bull selects a useful available corner. |
| Killer | Select a varied unused number, build Killer status, finish vulnerable rivals and skip eliminated players. Reassess after every dart, including activation during the visit. Saved six-letter matches retain their rules. |
| Sea Battle | Ignore known water/destroyed cells unless another living fleet can still be damaged there. Finish exposed damage, follow observable ship orientation, stop hunting around sunk ships and vary useful searches. Prefer fresh exploration to repeating another player's unsuccessful search. Hidden enemy positions never influence the choice. |
| Scram | Stoppers close useful open targets; scorers attack open scoring numbers. Both account for targets closed earlier in the visit. Mandatory unused darts after the final target still follow the existing visit rules. |
| Bull / 41 | Bull phase collects bull marks, using the outer bull when one mark remains. Scoring phase attacks high-value numbers to exceed 41. |
| Dartgolf | Aim at the current hole. Best-of-three keeps the best stroke; last-dart mode banks a useful result unless it guarantees a loss on the final hole. |
| Shanghai | Complete the required single/double/triple combination while achievable, otherwise maximize points on the round's target. |
| 21 | Advance from the current target, use the triple-20 bonus and finish the bull stage with a broad bull. |
| Bob's 27 | All darts address the current double, including double bull. |
| Hitters Challenge | Follow the current player's required double/triple and finish at inner bull. Every physical dart is committed separately. |

The inner and outer bull have distinct aiming positions. Scattering uses the same geometric model on every game; strategy never converts a miss into a hit.

## Validation

- `tests/bot-audit.mjs`: varied opening distributions, public knowledge, ship hunting, single-bull corner choices and per-dart tactical invariants across all fifteen games, both levels and two to four players.
- `tests/bot-strategy.mjs`: targeted winning, blocking, elimination, scoring and banking fixtures, plus complete Sea Battle matches.
- `tests/bot-engine.mjs`: complete legal games and measured 501 averages over 1,500 legs per level.
- `tests/bot-adaptive.mjs`: scoring variants, human-skill adaptation, full Cricket/Tactics games and measured adaptive 501 averages.
- `tests/gotcha-bot.mjs`: reachable resets, preferred broad routes, direct wins and actual scatter.
- `tests/test_bots.py`: visible per-dart input, executor leases, reload, controller takeover and camera handover.
