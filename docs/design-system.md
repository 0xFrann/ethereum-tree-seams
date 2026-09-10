# The specimen sheet

The page is one sheet of warm paper with a drawing on it: a transverse section of a tree whose rings are market years, whose ring shape is price, whose ring weight is volume, and whose knots are protocol milestones. Everything else on the sheet is the writing a specimen sheet carries: a label, a reading, a note and a few links. This note records the system the sheet is set in. The stylesheet, `app/globals.css`, is the source of truth and carries its own reasoning in comments; this is the map of it.

## Material

- **Paper and ink.** `--paper #f3f0e8`, lifted to `--paper-lift #f8f6f0` at the centre of the page and shaded to `--paper-shade #e2ddce` at its edges by one fixed radial gradient. Ink is `--ink #1e1b16`; the softer voices are `--ink-soft #443f34`, `--ink-faint #6b6454` and the title's `--ink-title #3a352b`. Rules are `--rule #d5cec0`, `--rule-soft #e5e0d3` and, for the one rule that is a control, `--rule-firm #b6b1a6`. The accent is the ink itself.
- **The plate's inks.** The canvas reads its own palette from custom properties on the canvas element: grain `#57503f`, ring ink `#4a4235`, muted `#6b6454`, marks `#585044`, bark `#857c6b`, and the ink for the selected month.
- **Tooth.** One deterministic SVG noise tile, greyed, stretched to full contrast and warmed, is laid over the whole page with `hard-light` at 12% opacity. Its dark half prints as fibre and its light half lifts the ink, so type and rings sit in the sheet rather than on it. It is decoration only: `prefers-contrast: more` and forced colours remove it, and nothing depends on it.
- **Corner marks.** Four 14 px registration marks in `--rule`, one frame inset (`--frame-inset`, 1rem) from the edges of the sheet.

## Type

One face throughout: Courier Prime, self-hosted at build time, with `"Courier New", monospace` behind it. Hierarchy comes from size, weight and tracking, never from a second face.

| Line | Size and leading | Tracking and case |
|---|---|---|
| Kicker, "Specimen" | 14px | .52em, uppercase, faint ink |
| Title, "ETH_TREE_01" | `clamp(1.9rem, 3.2vw, 3.4rem)` / .95 | .01em |
| Labels (dates, readings, links, byline) | 12px / 1.5 | .06em; section labels .13em uppercase |
| Month and year | `clamp(1.5rem, 2.2vw, 2.2rem)` / 1.05 | tabular numerals |
| Price range | 19px / 1.3 | tabular numerals, soft ink |
| Note title | `clamp(1.25rem, 1.7vw, 1.6rem)` / 1.15 | |
| Note summary and dialog body | 14–15px / 1.5–1.6 | soft ink |

Where a browser supports `text-box: trim-both cap alphabetic`, every line of writing is trimmed to its caps and baseline, so the gaps below are measured between ink rather than between line boxes.

## Spacing

A 4px scale, `--space-1` through `--space-7` (.25, .5, .75, 1, 1.5 and 2rem; there is no `--space-5`). Every gap, margin and padding on the sheet is one of these.

Two gaps set every block of writing:

- **Pair**, `--gap-pair`: a label and what it names. `--space-1`, or `--space-3` when the line boxes are trimmed.
- **Item**, `--gap-item`: everything else. `--space-4`, or `--space-6` trimmed. The entries of a list, and the rows of the narrow sheet, stand two items apart.

The gaps are judged by the ink, not by the CSS numbers, and they move with the type: whenever a breakpoint changes the type size, the two gaps step the same way, so the ratio of gap to type is the same everywhere on the sheet.

The sheet has two margins: `--sheet-margin` (2.5rem), which every block of writing sets against, and the frame inset for the corner marks. Each edge takes the larger of the margin and the device's safe-area inset.

## Layout

**The corner sheet** (landscape, 720px and wider). One viewport, no scroll. The label sits in the top-left corner: kicker, title, byline, then the sheet's dates (origin, first market data, updated). The reading sits top-right, right-aligned: month and year, price range, average and volatility. The note sits bottom-left with its height reserved at the worst case, and the four links sit bottom-right. The plate is centred at `clamp(760px, 68vmin, 920px)`; the drawing reaches 0.39 of the square, so the paper it keeps around itself is its own margin. Under the plate, a caption teaches the arrow keys; it is withdrawn on touch screens and on sheets shorter than 880px.

**The compact sheet** (under 720px wide or 620px tall). Both margins and both gaps step down one stop, the type with them, and the plate is held to `min(82vw, 58dvh)`.

**The narrow sheet** (portrait up to 1023px, or any width under 720px). Five rows in reading order: label, reading, plate, note, links. The plate runs past the writing margin to the corner marks and takes whatever height its square comes to; the sheet is as tall as what is written on it and scrolls. The dates and the two figures under the price range are left off. The type is set at the desktop's size and above, and the gaps take the desktop's stops with it.

**The short sheet** (under 500px tall). Keeps the corners and gives writing up to do so: the two readings, the note's label and two of the links go, and the screen scrolls to the sheet's foot.

Every block that changes with the data holds the same space with data and without it: the readout reserves a counter's cell on every line, the note reserves three lines of a summary, and a missing reading is written as a dash in a counter's slot.

## Controls

A control is never given a circle, a pill or a drawn container. Its affordance is type size, ink weight and an underline. Links are underlined in `--rule` and darken to the ink on hover; the buttons that open the sheets are plain text that underline on hover; the one link that leaves the page from the note is an arrow at the size of the reading it belongs to. Focus is a 1px outline in the ink, 4px off the control. The plate itself is a drawing: not a tab stop, no focus ring; the arrow keys are read from the document.

The dialogs are sheets laid on the paper: a `38rem` column as tall as what is written on it, a 2px scrollbar drawn as a measure in two rules, and a fade at the foot only when there is more below.

## Motion

Motion is reserved for arrival and for commitment. Reading the plate with the pointer is deliberately still.

**Arrival** is one score, `app/components/eth-rings/motion.ts`, that every beat on the page reads from:

| Beat | Starts at | What happens |
|---|---:|---|
| Header | 0 ms | The label is struck as a chain: the two identity lines at 32 ms a character with a 260 ms hold, then the byline and dates rattled at 11 ms a character. |
| Plate | 1232 ms | The rings are drawn line by line by one growth front, slowly at first and gathering pace, grain and ink riding the same front. |
| Readout | 2641 ms | The reading's lines wipe in 150 ms apart, and its counters roll with the front. |
| Index | 7932 ms | The month index sweeps the calendar closed. |
| Wash and note | 9232 ms, 9832 ms | The plate resolves into the selection, and the note and links arrive. |

Incidental pointer movement never cancels the entrance; only deliberate input does. **Commitment** is a wipe of 190 ms on the note and a one-way roll of the digit reels; the month and year tapes turn whichever way the reading moved. The only loop is the growth frontier's breath at the outer edge, 4.2 s, because the outer ring is unfinished. Under `prefers-reduced-motion`, the entrance renders its final state in one frame and every CSS duration collapses.

## Never

- A second typeface, or a box, card, pill or circle around anything.
- Softening the paper's tooth or any drawn shape with blur or a gradient edge.
- A decorative coordinate, sample count, scan status, Latin name, checksum or measurement the application did not produce.
- A knot whose size encodes importance, a price where the source has none, or a label placed by eye where it implies an exact date.
- An empty state that is smaller than the same state with data.

Related: [knot geometry](./knot-geometry.md) for how a milestone becomes a point on the plate.
