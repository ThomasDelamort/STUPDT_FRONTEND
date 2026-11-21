# THE OFFICE: implementation notes

Decisions, calibrations and deviations made while building the feature, plus
how each acceptance criterion was verified. If something here reads like a
bug, it was a deliberate trade-off. The reason is next to it.

## Where things live

| Path                           | What it is                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `art/source/`                  | Original sheets + office image (not imported by the app)                                                                              |
| `scripts/build-sprites.mjs`    | `pnpm sprites`: extraction → atlases, QA images, WebP, prop patches                                                                   |
| `art/qa/contact-sheet.png`     | Every frame of every character on a checkerboard, pivots + baselines                                                                  |
| `src/assets/office/`           | `office.webp`, `patch-*.png`, `sprites/<name>.png + .json` (generated, committed)                                                     |
| `src/constants/office.js`      | Roster, personas, spots, scenes, nav polygons, occluders, pose registry, all dialogue                                                 |
| `src/utils/office/`            | Plain-JS simulation: `engine`, `actor`, `director`, `activities`, `pathing`, `props`, `bubbles`, `dialogue`, `atlas`, `rng`, `timing` |
| `src/hooks/useOfficeEngine.js` | Asset preload, engine lifecycle, scale, visibility                                                                                    |
| `src/components/office/`       | `OfficeScene` (card) and `OfficeDebug` (overlay + in-place player)                                                                    |

All durations and speeds live in `src/utils/office/timing.js`.

## Ambiguities and the defaults I picked

- **Branch.** The brief says to use an existing `Office` branch, but none existed. As instructed in the task, I created `office` from `main`. There was no uncommitted `vite.config.ts` change to protect.
- **Office image name.** The file was `Neon Gamer Lounge and City Nightscape.png` (with spaces). It is stored under the brief's name, `art/source/Neon_Gamer_Lounge_and_City_Nightscape.png`. Only the WebP (219 KB) ships in `src/assets/office/`; the 2 MB PNG master stays in `art/source` so it isn't committed twice.
- **Extra characters.** Two more sheets were attached: a fedora suit and a voxel fedora suit. They go through the same pipeline and sit in the roster as `suit` / `suitvoxel` with `enabled: false`, next to `nimrod`. Enabling any of them is a one-line change. Their baked ground shadows are only partly removed (see limitations).
- **Atlas format.** The brief's JSON shape is kept (`frames{x,y,w,h,pivot}`, `animations`, `views`, `anchors`). Every frame is a **uniform cell with one shared pivot**, so a frame change is a single `background-position` write and never a width or height change. `trim` (the drawn rect inside the cell) and `metrics` were added.
- **Reply timing.** The first speaker quotes the ticket while colleagues are still gathering. A reply lets the current speaker finish within a 2.4-second simulation deadline. The department verdict stays up for 2.4 seconds, followed by 1.5 seconds before the director starts a fresh scene.
- **Second prompt mid-argument.** The chat input is disabled while a transfer is running, so a real second prompt usually lands after the reply (verdict or disperse phase). Either way the staff stay put: the response is an "Another one?!" beat, a second ticket on the pile, and a new arc for the new topic. Prompts that arrive during Code Red are queued.
- **Slow replies and cancelled tickets.** A pending chat request keeps its huddle through long transfers. Staff use numbered addenda after exhausting their stall lines. Dismissing the Grand Finale with Escape sends the cast back to work. Choosing a department preserves the huddle until its transfer reply arrives.
- **Debug gating.** The overlay is on with `?office-debug` in any build. In dev it can also be toggled with the backtick key or the bug button in the card header. Both are compiled out of production (`import.meta.env.DEV`). `window.__office` and the `timeScale` fast-forward exist only in debug sessions, for automated QA.
- **z-index.** The scene container uses `isolation: isolate`, so sprite and occluder z-indexes (`feetY*2` and `sortY*2+1`) never reach the page's stacking order. The only element outside the scene is the offscreen chip, at `z-30` (below the sign-language widget at 40 and the toast at 50). Sprites also write `z-index`, but only when their feet cross a 1 px row. That is the y-sort; everything else is `transform`, `opacity` or `background-position`.

## Sprite extraction (beyond the brief's recipe)

The brief's recipe (median background, key > 8, 8 px closing, fill holes) works for the Idle row. The other rows needed more:

1. **Weak key.** Janus's and Neal's trousers sit only 4–6 levels from the background in the turnaround, walk and run rows, so their legs vanished. Pixels that are _lighter_ than the background (summed RGB ≥ +6) count as weak foreground after a 2×2 opening, which removes ±3 noise.
2. **Floor discs and shadows.** Some boards bake a soft disc under the feet that is the same colour as near-black trousers, so it is removed by **position**. Below the soles, and outside the feet's horizontal span in the 16 rows above the soles, weak and shadow-like pixels are stripped.
3. **Decorations.** Sparks (saturated yellow) are always removed. Hurt marks (saturated red, not warm skin) are removed when they barely touch the body. Speech bubbles (near-white blobs above the head) and DEFEAT lines (thin, tall, grey) are removed too. The test is against a reference body built from _strong_ pixels with all decoration-coloured pixels removed, then closed and filled. Embedded features (collars, ties, Drake's stripes, Gab's headphones) overlap that body and survive. Removed regions are dilated by 3 px, plus 8 px for weak-only glow.
4. **Gaps the closing can't bridge.** Feet under black trousers are bridged column-wise. A black turtleneck between hair and shoulders (Neal's back views) is filled only where the gap spans a wide run of columns, so thin slivers beside the hair are left alone.
5. **Merged frames.** Nimrod's walk frames touch after closing, so a component that spans two slot centres is cut at its narrowest column.
6. **Edge guard.** The red frame's anti-aliased edge bleeds into the last column of some rects, so 3 px along each inner edge is ignored.
7. **Scale.** Rows are normalised on **idle head width**, as the brief asks. Front-view heights disagree with head widths by 3–8%, because the boards draw slightly longer bodies in some rows, and on a chibi the eye tracks the head. Walk and run are compared against the turnaround's side-view head. All factors are printed by `pnpm sprites` and stored in `metrics.rowScale`, and post-normalisation head widths are in `metrics.headWidthByRow`.
8. **Pivots.** Grounded poses anchor x on the feet band (idle feet never move), and locomotion anchors on the head band, limited to ±1.5 px around the cycle mean. y is the sole of the shoes. The residual rounding in the uniform cells is ≤ 0.5 sheet px.

## Calibration (eyeballed values that moved)

All values are world px and were checked with `?office-debug` and with `nav` and pathing checks (every spot, approach and wander point is walkable and mutually reachable).

| Thing            | Brief                 | Final                                        | Why                                                                                                                                                                      |
| ---------------- | --------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Nav grid         | ~32 px                | 16 px                                        | The desk/couch corridor is ~50 px wide; at 32 px it disappears                                                                                                           |
| Floor            | the image             | extends to y≈1000 (below the frame)          | The couch is a cul-de-sac in the art (its arm touches a chess chair), so its front is only reachable through the foreground, where walkers are cropped by the frame edge |
| Huddle           | (900,580) rx130 ry55  | (970,535) rx178 ry52                         | The original slots overlapped sprites, sat inside the chess table, and one walled off the desk/couch corridor (an actor could freeze behind it)                          |
| Weights          | ≈(730,455)            | (912,450), facing left                       | (730,455) is on top of the punching-bag stance                                                                                                                           |
| Bag stance       | (770,440)             | (774,458)                                    | Off the rack post's footprint                                                                                                                                            |
| Pull-up          | hang x≈705, bar y≈160 | x 708, feet 392, bar 186                     | The orange-grip bar is at y≈186                                                                                                                                          |
| Chess B approach | n/a                   | (1078,590) diagonal                          | A straight-up exit collides with a huddle slot                                                                                                                           |
| Couch approaches | n/a                   | 4 distinct points in the foreground corridor | Four sitters standing up onto one point overlapped                                                                                                                       |

**Seats entered from the front** (desk chair, chess chair A, near couch seats) pin the actor's depth just behind the seat occluder from ENTER to EXIT, so nobody pops from in front of the chair to behind it.

At the computer, the seated sprite anchor is (424, 428). The back-left view faces the monitors. Separate polygons trace the upholstery and the caster base, leaving the keyboard and the open area beside the backrest visible behind the worker. The lower-body crop eases in on approach and out on departure. The name tag stays below the casters.

**Baked props that move** get runtime cover patches generated by the build script; `office.png` itself is never edited. `patch-bag.png` is a row-wise blend of the columns beside the bag, shown only while it swings. `patch-dumbbells.png` is mat texture cloned along the mat-edge slope, clipped to the dumbbells' silhouette, and shown only while they are lifted.

## Motion

- **Walk cycles barely travel.** The generated cycles are nearly in place: a planted foot drifts only 8–35 sheet px per cycle, so a truly skate-free speed would be about 20 px/s. Animation fps is therefore derived from speed so the leg cadence matches the leg spread (`WALK_CYCLE_PX` 92, `RUN_CYCLE_PX` 190). The phase never resets on turns. Dedicated stride frames are on the wishlist.
- **Separation.** Every proposed step checks the other three footprints, including on a run. A blocked actor tries a sidestep and periodically requests a new route. Scripted chair and bar transitions allow a short detour alongside their entry path.
- **Sprints.** Long dashes sprint (up to +45%), so far-away staff still make the huddle.
- **Speed limit.** Direct movement, perspective scaling and sprinting share a 420 world-pixel/second ceiling. A step exceeding that ceiling increments `debugStats.teleports`. Reduced-motion relocations use a fade.

## Acceptance checks (how they were verified)

The original sprite measurements used Puppeteer. The current scene and chat checks used local Chromium with Playwright at 1440×900 and 390×844. Huddle timings use simulation seconds. Activity coverage uses accelerated fixed steps.

| Criterion                          | Result                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| First idle minute | Six or seven activities across the latest two runs. Group activities count once the entire group is in position. |
| Five-minute activity coverage | Both runs included all nine activities. |
| No teleports                       | 0 in every run (idle watches, huddles, Code Red, reduced motion)                      |
| Actor separation | The four footprints stayed at least 54 perspective-adjusted world pixels apart over ten simulated minutes at each viewport size. |
| Stopped within 400 ms              | All four switch to startle on the first sim step (0–200 ms stagger)                   |
| First bubble ≤ 1.2 s after startle | 0.93–1.05 s after the send                                                            |
| Huddle arrival | Typically about 1.6–3.2 seconds in the nine-scene sweep. The foreground couch route took about four seconds. |
| Reply and dispersal | The verdict appeared within 2.44 seconds of a fast or delayed reply. The idle director resumed 3.9 seconds after the verdict. |
| No line repeats across 5 prompts   | 0 repeats (5 identical prompts, and a mixed sliding window)                           |
| Dialogue length | More than 150 authored argument lines. The worst-case placeholder length check passed. |
| StrictMode                         | 4 sprites, 1 sprite layer, exactly 60 rAF callbacks/s                                 |
| Frame time | Chromium rendered at 60 fps. The 95th percentile for scene JavaScript was 0.2 ms on desktop and 0.3 ms at phone width over 180 frames each. |
| Memory | After ten accelerated minutes, both views had 63 scene elements. Heap size after garbage collection changed by less than 0.2 MB in each session. |
| Phones (390 px)                    | no horizontal scroll; bubbles legible; caption strip mirrors every line               |
| Dark/light, Braille                | frame follows the theme; bubbles, caption and chrome all go through `tx()`            |
| Reduced motion                     | no wandering; fade relocation; 1.5 fps idle; static bubbles                           |
| `pnpm lint` / `pnpm build`         | pass                                                                                  |

## Known limitations

- **Couch summit.** The route from the couch goes around the foreground chess furniture. Gathering can take about four seconds from those seats.
- **Skating feet.** Walking feet skate a little, which is inherent to the near-in-place cycles (see Motion).
- **Fake poses.** Sitting, typing, pull-ups and similar are faked from the existing frames (`OFFICE_POSES`). `docs/OFFICE_ART_WISHLIST.md` lists the frames that would replace them with data-only changes.
- **Suit shadows.** The two disabled suit characters keep part of their baked ground shadows in some frames.
- **Chess.** The chess pieces are baked into the art; play is conveyed through think and move poses.
