import { GAME_TYPES, SLAGEN_TABLE, PER_PLAYER_GAMES, WL_VALUES, MISERIE_SCORES } from './constants.js';

export function getGameType(id) {
  return GAME_TYPES.find(g => g.id === id);
}

/** Combine per-caller results into a single W / L / WL display value. */
export function combinedResult(callerResults, callers) {
  if (!callerResults || !callers.length) return null;
  const results = callers.map(c => callerResults[c]).filter(Boolean);
  if (!results.length) return null;
  if (results.every(r => r === 'W')) return 'W';
  if (results.every(r => r === 'L')) return 'L';
  return 'WL';
}

/** Return 'W' or 'L' based on the slagen value for slagen-mode games. */
export function calcResultFromSlagen(gameType, slagen) {
  const table = SLAGEN_TABLE[gameType];
  if (!table || slagen === null) return null;
  return table[slagen - 1] > 0 ? 'W' : 'L';
}

/** Compute the 4-player score array for a completed tournament round. */
export function calcTournScores(gameType, callers, slagen, callerResults) {
  const scores = [0, 0, 0, 0];
  const gt = getGameType(gameType);
  if (!gt) return scores;

  // ── Slagen-mode games ──────────────────────────────────────────────
  if (gt.inputMode === 'slagen') {
    if (slagen === null) return scores;
    const table = SLAGEN_TABLE[gameType];
    if (!table) return scores;
    const value = table[slagen - 1];

    if (PER_PLAYER_GAMES.has(gameType)) {
      // Each caller: +value, each defender: −value  (sum = 0 with 2+2)
      for (let i = 0; i < 4; i++)
        scores[i] = callers.includes(i) ? value : -value;
    } else {
      // SPLIT3: caller gets full value, 3 defenders each pay −value/3
      const caller = callers[0];
      for (let i = 0; i < 4; i++)
        scores[i] = i === caller ? value : -value / 3;
    }
    return scores;
  }

  // ── WL-mode games ──────────────────────────────────────────────────
  if (!callerResults) return scores;

  if (gameType === 'misery1' || gameType === 'misery-table') {
    const basis    = gameType === 'misery-table' ? 42 : 21;
    const mult     = basis / 21;
    const nCallers = callers.length;
    const geslaagd = callers.filter(c => callerResults[c] === 'W').length;
    const entry    = (MISERIE_SCORES[nCallers] || {})[geslaagd];
    if (!entry) return scores;
    for (let i = 0; i < 4; i++) {
      if (callers.includes(i))
        scores[i] = (callerResults[i] === 'W' ? entry.winner : entry.loser) * mult;
      else
        scores[i] = entry.defender * mult;
    }
    return scores;
  }

  // Abondance / Solo / Solo Slim: single caller, SPLIT3
  const base = WL_VALUES[gameType];
  if (base === undefined) return scores;
  const caller = callers[0];
  const value  = callerResults[caller] === 'W' ? base : -base;
  for (let i = 0; i < 4; i++)
    scores[i] = i === caller ? value : -value / 3;
  return scores;
}
