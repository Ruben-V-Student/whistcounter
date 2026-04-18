import { NUM_PLAYERS } from './constants.js';
import { getGameType } from './scoring.js';

// ══════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════
// simple round:     { scores: [n,n,n,n] }
// tournament round: { callers, gameType, slagen, callerResults, result, scores }
// Game object:      { id, name, mode, playerNames, rounds }
export let state = {
  theme: 'system',
  showDealer: true,
  activeGameId: null,
  games: [],
};

export function genId() {
  return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

export function createNewGame(mode) {
  return {
    id: genId(),
    name: 'Game ' + (state.games.length + 1),
    mode: mode || 'tournament',
    playerNames: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
    rounds: [],
  };
}

export function activeGame() {
  return state.games.find(g => g.id === state.activeGameId) || state.games[0] || null;
}

export function currentMode() {
  const g = activeGame();
  return g ? g.mode : 'tournament';
}

export function modeState() { return activeGame(); }

export function shortName(n) { return n; }

// ══════════════════════════════════════════
//  DERIVED HELPERS
// ══════════════════════════════════════════

/** True when a round has had its result fully entered. */
export function isRoundComplete(rd) {
  if (currentMode() !== 'tournament') return true;
  const gt = getGameType(rd.gameType);
  if (!gt) return rd.slagen !== null;
  if (gt.inputMode === 'wl') {
    if (!rd.callerResults) return false;
    return (rd.callers || []).every(c => rd.callerResults[c] !== undefined);
  }
  return rd.slagen !== null;
}

export function getRunningTotals() {
  const totals = [0, 0, 0, 0];
  const runningPerRound = [];
  for (const round of modeState().rounds) {
    if (isRoundComplete(round)) {
      for (let i = 0; i < 4; i++) totals[i] += round.scores[i];
    }
    runningPerRound.push([...totals]);
  }
  return { totals, runningPerRound };
}

// ══════════════════════════════════════════
//  PERSISTENCE
// ══════════════════════════════════════════
export function saveState() {
  try { localStorage.setItem('whist_state', JSON.stringify(state)); } catch (e) {}
}

export function initFreshState() {
  const game = createNewGame('tournament');
  game.name = 'Game 1';
  state.games = [game];
  state.activeGameId = game.id;
}

export function loadState() {
  try {
    const s = localStorage.getItem('whist_state');
    if (!s) { initFreshState(); return; }
    const saved = JSON.parse(s);

    // Already in new multi-game format
    if (saved.games && Array.isArray(saved.games)) {
      state.theme      = saved.theme      || 'system';
      state.showDealer = saved.showDealer !== undefined ? saved.showDealer : true;
      state.games      = saved.games;
      state.activeGameId = saved.activeGameId || (saved.games[0] && saved.games[0].id) || null;
      if (!state.games.length) initFreshState();
      return;
    }

    // ── Migrate old format ──────────────────────────────────────────────
    state.theme = saved.theme || 'system';
    const games = [];

    // Very old flat format: playerNames/rounds at top level
    if (saved.playerNames || saved.rounds) {
      const game = createNewGame(saved.mode || 'simple');
      game.name = 'Game 1';
      game.playerNames = saved.playerNames || game.playerNames;
      game.rounds      = saved.rounds      || [];
      games.push(game);
    }

    // Newer format: state.simple / state.tournament sub-objects
    if ((saved.simple || saved.tournament) && games.length === 0) {
      const activeMode = saved.mode || 'tournament';
      ['tournament', 'simple'].forEach(mode => {
        const data = saved[mode];
        if (data && data.rounds && data.rounds.length > 0) {
          const game = createNewGame(mode);
          game.name = games.length === 0 ? 'Game 1' : 'Game 2';
          game.playerNames = data.playerNames || game.playerNames;
          game.rounds      = data.rounds;
          games.push(game);
        } else if (data && mode === activeMode) {
          const game = createNewGame(mode);
          game.name = 'Game 1';
          game.playerNames = data.playerNames || game.playerNames;
          game.rounds      = data.rounds || [];
          games.push(game);
        }
      });
    }

    if (games.length === 0) {
      initFreshState();
    } else {
      state.games = games;
      const activeMode = saved.mode || 'tournament';
      const match = games.find(g => g.mode === activeMode) || games[0];
      state.activeGameId = match.id;
    }
  } catch (e) { initFreshState(); }
}
