# THE OFFICE: art wishlist

The sheets only have `idle(4) walk(8) run(8) jump(4)`, one frame each of
`interact talk think cheer hurt defeat emote` (Nimrod also has `present` and
`explain`), and 8 turnaround views. Everything else is faked through the
semantic pose registry (`OFFICE_POSES` in `src/constants/office.js`).

To swap in real art, add the frames to a sheet (or a new panel), extend
`scripts/build-sprites.mjs` with the panel rect, run `pnpm sprites`, and point
the pose at the new frame keys. No engine code changes.

Generate everything on the same presentation-board layout and the same
character scale as the existing sheets. Use a flat background with no
decorations, bubbles or shadows, keep feet on a shared baseline, and keep
cells ~120×170.

| Pose                             | Faked today with                        | Dedicated frames wanted                                           | Frames          |
| -------------------------------- | --------------------------------------- | ----------------------------------------------------------------- | --------------- |
| **sit** (couch, chess, bean bag) | `idle` lowered 28% behind the furniture | seated loop, front + 3/4 back + side                              | 4 per view (12) |
| **sit-down / stand-up**          | slide + sink                            | transition                                                        | 3 + 3           |
| **type** (computer)              | back view + 1 px jitter                 | seated from behind, arms on keyboard                              | 4               |
| **paddle swing**                 | `idle` ↔ `interact` + CSS paddle        | forehand/backhand with paddle in hand                             | 6               |
| **punch**                        | `interact` + 10 px lunge                | jab, cross (side-on)                                              | 4               |
| **kick**                         | `jump` apex rotated −12°                | roundhouse (side-on)                                              | 5               |
| **pull-up**                      | `cheer` hung at the bar + translateY    | hang → pull → chin over bar → lower                               | 6               |
| **lift**                         | `idle` ↔ `cheer` + CSS dumbbells        | overhead press with dumbbells                                     | 6               |
| **sleep**                        | `defeat` + breathing + Zzz              | slumped in the bean bag, breathing                                | 4               |
| **point**                        | `interact`                              | accusatory point (front + 3/4)                                    | 2               |
| **shrug**                        | `emote` (signature gesture)             | palms-up shrug                                                    | 2               |
| **facepalm**                     | (not faked)                             | hand to face, head down                                           | 3               |
| **walk** (front/back)            | front/back turnaround view + bob        | real front and back walk cycles                                   | 8 + 8           |
| **walk** (side)                  | existing cycle (barely travels)         | cycle with a real stride (planted foot travels ~45 sheet px/step) | 8               |
| **run** (front/back)             | turnaround view + bigger bob            | front and back run cycles                                         | 8 + 8           |
| **startle**                      | `jump_0` crouch + hop + "!"             | flinch / jump-scare                                               | 3               |
| **argue: shout**                 | `talk` ↔ `interact` + shake             | mouth wide, leaning in                                            | 3               |
| **turn their back**              | back turnaround view                    | arms-crossed huff, from behind                                    | 2               |

Nice-to-have prop sprites (CSS-drawn today): paddle (2), ping-pong ball (1),
dumbbell pair (2), paper ticket (2: flat and crumpled), laptop for Neal's
"present" (opening, 3).
