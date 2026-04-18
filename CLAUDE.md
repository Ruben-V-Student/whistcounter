# Whist Counter — Project Guide

## What this app is

A scorekeeper for the Belgian card game Whist, built as a mobile-first PWA-style single-page app. Supports tournament (Whist) mode with proper game-type/caller/slagen tracking and manual mode for simple score entry. Used at tournaments where multiple tables play simultaneously — the CSV export is designed for organisers to collect results by table name.

---

## Tech stack

| Thing | Detail |
|---|---|
| Build tool | Vite (`npm run dev` / `npm run build`) |
| Deploy | `npm run deploy` → gh-pages branch |
| Base URL | `/whistcounter/` (set in `vite.config.js`) |
| Styling | Vanilla CSS with CSS custom properties (design tokens in `:root`) |
| JS | Vanilla ES modules, no framework |
| Fonts | Cormorant Garamond (headings/scores) + DM Sans (UI), loaded from Google Fonts |
| Storage | `localStorage` key `whist_state` |

No npm runtime dependencies — Vite and gh-pages are dev-only.

---

## File structure

```
index.html      — markup, all overlays/sheets declared here
styles.css      — all styling, single file
constants.js    — game type definitions, scoring tables, score arrays
scoring.js      — pure calculation functions (no DOM, no state)
state.js        — state object, persistence, derived helpers
export.js       — CSV export formats
app.js          — render, sheets, sidebar, event listeners, init
```

### Dependency order (no circular imports)

```
constants.js
    └── scoring.js
            └── state.js
                    └── export.js
                            └── app.js  (imports all of the above)
```

---

## Where to make changes

| Task | File(s) |
|---|---|
| Add a new game type | `constants.js` → add to `GAME_TYPES` and `SLAGEN_TABLE` (or `WL_VALUES` for WL-mode games) |
| Add scoring logic for a new game type | `scoring.js` → extend `calcTournScores` |
| Add a new CSV export format | `export.js` → add a new exported function, wire up button in `index.html` + `app.js` |
| Change score tables / point values | `constants.js` → `SLAGEN_TABLE`, `WL_VALUES`, `MISERIE_SCORES` |
| Change UI layout or add an overlay/sheet | `index.html` + `styles.css` |
| Change render logic | `app.js` → `render*` functions |
| Change state shape | `state.js` → update `state` object + `loadState` migration block |

---

## Game modes

### Tournament (Whist)
Full round tracking: caller(s), game type, slagen or W/L result, computed scores.  
Grid columns: Round | Game | Slgn | R | P1 | P2 | P3 | P4

### Manual (Simple)
Score-only entry. Select 1 or 2 players who played, pick their score, others get the negative split automatically. Override toggle unlocks manual entry for each player (used for Misère with multiple callers, Solo Slim, etc.).

---

## State shape (`localStorage`)

```js
{
  theme: 'system' | 'light' | 'dark',
  showDealer: true | false,
  activeGameId: string,
  games: [
    {
      id: string,
      name: string,
      mode: 'tournament' | 'simple',
      playerNames: [string, string, string, string],
      rounds: [
        // simple:     { scores: [n, n, n, n] }
        // tournament: { callers, gameType, slagen, callerResults, result, scores }
      ]
    }
  ]
}
```

`loadState` in `state.js` handles two older migration formats transparently.

---

## Game types

Defined in `constants.js → GAME_TYPES`. Key fields:

| Field | Meaning |
|---|---|
| `id` | Internal key, matches keys in `SLAGEN_TABLE` / `WL_VALUES` |
| `abbr` | Short label shown in the table |
| `inputMode` | `'slagen'` (numeric tricks picker) or `'wl'` (W/L per caller) |
| `maxCallers` | Max number of callers allowed |
| `minCallers` | Min callers (defaults to `maxCallers` if absent) |

Current game types: Ask-Accept, Allone, Abondance 9–12, Misery, Misery on Table, Troel, Troela, Solo, Solo Slim.  
Scoring reference: **PUNTENTABEL IWWA 01-10-2025**.

---

## Scoring distribution

- **PER_PLAYER** games (Ask-Accept, Troel, Troela): each caller gets ±value, each defender gets ∓value.
- **SPLIT3** games (all others): caller gets full value, each of 3 defenders pays −value/3.
- **Misère**: special table in `MISERIE_SCORES` keyed by `(numCallers, numWinners)`.

---

## CSV export

Available when all 16 rounds are complete. Button appears next to "New game" in the game bar.  
Three formats:

| Format | Content |
|---|---|
| **Full** | Game type + callers + tricks per round, two columns per player (points delta + running total). Tournament mode only. |
| **Scores only** | Round number + running total per player per round. |
| **Summary** | Player names row + final scores row. 4 × 2. |

Filename is pre-filled with the game name (e.g. `Game 1`) and editable — intended for tournament use like `Table12Round1`.

---

## Settings

- **Theme**: System / Light / Dark (persisted in state)
- **Show dealer in table**: toggles the `D` badge and cell shade on the dealer's score cell (persisted in state)
- **Player names**: rename all four players
- **Reset all data**: clears `localStorage` and reloads

---

## UI conventions

- All bottom sheets use `.overlay` + `.sheet` pattern. Open/close via `openOverlay(id)` / `closeOverlay(id)`.
- Long-press (600 ms) on a filled row opens its edit sheet.
- The current round row gets class `current` (accent background); past rows get `filled`; future rows get `empty` (faded).
- Compact/fit-to-screen mode toggled by the ⊞ button — adds `.compact` class to `#scoreTable`.
- Tournament table is wider than the viewport and offset with a negative left margin to use full screen width.

---

## Things to keep updated in this file

- New game types added to `constants.js`
- New export formats added to `export.js`
- Any new persisted state fields added to `state.js`
- New settings added to the settings sheet
- New files added to the project
