// ══════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════
export const POS_SCORES   = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 18, 21, 24, 28];
export const NEG_SCORES   = [-2, -3, -4, -5, -6, -7, -8, -10, -12, -14, -15, -16, -18, -21, -24, -28];
export const TOTAL_ROUNDS = 16;
export const NUM_PLAYERS  = 4;

// inputMode 'slagen' → numeric picker  |  'wl' → W/L per caller
// minCallers/maxCallers control which caller counts unlock this game type
export const GAME_TYPES = [
  { id: 'ask-accept',   label: 'Ask-Accept',      abbr: 'AA',   maxCallers: 2, inputMode: 'slagen' },
  { id: 'allone',       label: 'Allone',           abbr: 'Aln',  maxCallers: 1, inputMode: 'slagen' },
  { id: 'abondance9',   label: 'Abondance 9',      abbr: 'Ab9',  maxCallers: 1, inputMode: 'wl' },
  { id: 'abondance10',  label: 'Abondance 10',     abbr: 'Ab10', maxCallers: 1, inputMode: 'wl' },
  { id: 'abondance11',  label: 'Abondance 11',     abbr: 'Ab11', maxCallers: 1, inputMode: 'wl' },
  { id: 'abondance12',  label: 'Abondance 12',     abbr: 'Ab12', maxCallers: 1, inputMode: 'wl' },
  { id: 'misery1',      label: 'Misery',           abbr: 'Mis',  minCallers: 1, maxCallers: 3, inputMode: 'wl' },
  { id: 'misery-table', label: 'Misery on Table',  abbr: 'MisT', minCallers: 1, maxCallers: 3, inputMode: 'wl' },
  { id: 'troel',        label: 'Troel',            abbr: 'Trl',  maxCallers: 2, inputMode: 'slagen' },
  { id: 'troela',       label: 'Troela',           abbr: 'TrlA', maxCallers: 2, inputMode: 'slagen' },
  { id: 'solo',         label: 'Solo',             abbr: 'Solo', maxCallers: 1, inputMode: 'wl' },
  { id: 'solo-slim',    label: 'Solo Slim',        abbr: 'Slim', maxCallers: 1, inputMode: 'wl' },
];

export const GAME_LABELS = { tournament: 'Whist', simple: 'Manual' };

// Scores achievable in 2-caller games (Ask-Accept, Troel, Troela) per the scoring table
export const TWO_PLAYER_VALID = new Set([
  2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 24, 28,
  -2, -3, -4, -5, -6, -7, -8, -10, -12, -14, -16, -18,
]);

// ══════════════════════════════════════════
//  SCORING TABLES  (PUNTENTABEL IWWA 01-10-2025)
// ══════════════════════════════════════════

// Per-slagen value for each slagen-mode game type (index 0 = slagen 1, index 12 = slagen 13).
// Allone/Ab9-12/Solo/SoloSlim → SPLIT3:  caller gets value, each defender gets −value/3.
// Ask-Accept/Troel/Troela     → PER_PLAYER: each caller gets ±value, each defender gets ∓value.
export const SLAGEN_TABLE = {
  //                    1     2     3     4    5    6    7    8    9   10   11   12    13
  'allone':      [ -30,  -24,  -18,  -12,   6,   9,  12,  15,  18,  21,  24,  27,   60 ],
  'ask-accept':  [ -18,  -16,  -14,  -12, -10,  -8,  -6,   2,   3,   4,   5,   6,   14 ],
  'abondance9':  [ -15,  -15,  -15,  -15, -15, -15, -15, -15,  15,  15,  15,  15,   15 ],
  'abondance10': [ -18,  -18,  -18,  -18, -18, -18, -18, -18, -18,  18,  18,  18,   18 ],
  'abondance11': [ -24,  -24,  -24,  -24, -24, -24, -24, -24, -24, -24,  24,  24,   24 ],
  'abondance12': [ -27,  -27,  -27,  -27, -27, -27, -27, -27, -27, -27, -27,  27,   27 ],
  'troel':       [ -18,  -16,  -14,  -12, -10,  -8,  -6,   4,   6,   8,  10,  12,   28 ],
  'troela':      [ -20,  -18,  -16,  -14, -12, -10,  -8,  -6,   4,   6,   8,  10,   24 ],
  'solo':        [ -75,  -75,  -75,  -75, -75, -75, -75, -75, -75, -75, -75, -75,   75 ],
  'solo-slim':   [ -90,  -90,  -90,  -90, -90, -90, -90, -90, -90, -90, -90, -90,   90 ],
};

// Games where each caller individually gets ±value and each defender gets ∓value.
export const PER_PLAYER_GAMES = new Set(['ask-accept', 'troel', 'troela']);

// Fixed absolute values for WL-mode single-caller games (SPLIT3 distribution).
export const WL_VALUES = {
  'abondance9':  15,
  'abondance10': 18,
  'abondance11': 24,
  'abondance12': 27,
  'solo':        75,
  'solo-slim':   90,
};

// Miserie scoring per (numCallers, geslaagd).
// winner  = score for a calling player who won their contract.
// loser   = score for a calling player who lost their contract.
// defender = score for each non-calling player.
// Basis 21 (Misery). Misery on Table uses 2× these values (basis 42).
export const MISERIE_SCORES = {
  1: {
    0: { winner:  0, loser: -21, defender:   7 },
    1: { winner: 21, loser:   0, defender:  -7 },
  },
  2: {
    0: { winner:  0, loser: -14, defender:  14 },
    1: { winner: 28, loser: -28, defender:   0 },
    2: { winner: 14, loser:   0, defender: -14 },
  },
  3: {
    0: { winner:  0, loser:  -7, defender:  21 },
    1: { winner: 35, loser: -21, defender:   7 },
    2: { winner: 21, loser: -35, defender:  -7 },
    3: { winner:  7, loser:   0, defender: -21 },
  },
};
