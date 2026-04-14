// ══════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════
const POS_SCORES   = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 18, 21, 24, 28];
const NEG_SCORES   = [-2, -3, -4, -5, -6, -7, -8, -10, -12, -14, -15, -16, -18, -21, -24, -28];
const TOTAL_ROUNDS = 16;
const NUM_PLAYERS  = 4;

// inputMode 'slagen' → numeric picker  |  'wl' → W/L per caller
// minCallers/maxCallers control which caller counts unlock this game type
const GAME_TYPES = [
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

// ══════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════
// simple round:     { scores: [n,n,n,n] }
// tournament round: { callers, gameType, slagen, callerResults, result, scores }
// Game object:      { id, name, mode, playerNames, rounds }
let state = {
  theme: 'system',
  activeGameId: null,
  games: [],
};

function genId() {
  return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function createNewGame(mode) {
  return {
    id: genId(),
    name: 'Game ' + (state.games.length + 1),
    mode: mode || 'tournament',
    playerNames: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
    rounds: [],
  };
}

function activeGame() {
  return state.games.find(g => g.id === state.activeGameId) || state.games[0] || null;
}

function currentMode() {
  const g = activeGame();
  return g ? g.mode : 'tournament';
}

// Returns the data object for the active game
function modeState() { return activeGame(); }

// Simple-mode sheet state
let editingRound  = -1;
let selectedPlayers = [];
let selectedScore   = null;
let manualMode      = false;
let manualValues    = ['', '', '', ''];
let longPressTimer  = null;

// Tournament sheet state
let tournEditingRound = -1;
let tournCallers      = [];
let tournGameType     = null;

// Slagen picker state
let slagenRoundIndex = -1;
let slagenSelected   = null;

// W/L picker state
let wlRoundIndex = -1;
let wlResults    = {};

// Auto-scroll: true when the current empty row is visible in #roundRows
let autoScrollEnabled = true;

// ══════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════
function getGameType(id) {
  return GAME_TYPES.find(g => g.id === id);
}

function shortName(n) {
  return n;
}

/** True when a round has had its result fully entered. */
function isRoundComplete(rd) {
  if (currentMode() !== 'tournament') return true;
  const gt = getGameType(rd.gameType);
  if (!gt) return rd.slagen !== null;
  if (gt.inputMode === 'wl') {
    if (!rd.callerResults) return false;
    return (rd.callers || []).every(c => rd.callerResults[c] !== undefined);
  }
  return rd.slagen !== null;
}

/** Combine per-caller results into a single W / L / WL display value. */
function combinedResult(callerResults, callers) {
  if (!callerResults || !callers.length) return null;
  const results = callers.map(c => callerResults[c]).filter(Boolean);
  if (!results.length) return null;
  if (results.every(r => r === 'W')) return 'W';
  if (results.every(r => r === 'L')) return 'L';
  return 'WL';
}

// ══════════════════════════════════════════
//  SCORING TABLES  (PUNTENTABEL IWWA 01-10-2025)
// ══════════════════════════════════════════

// Per-slagen value for each slagen-mode game type (index 0 = slagen 1, index 12 = slagen 13).
// Allone/Ab9-12/Solo/SoloSlim → SPLIT3:  caller gets value, each defender gets −value/3.
// Ask-Accept/Troel/Troela     → PER_PLAYER: each caller gets ±value, each defender gets ∓value.
// Notable: slagen=13 is already the doubled value where applicable (30→60, 7→14, 14→28, 12→24).
const SLAGEN_TABLE = {
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
const PER_PLAYER_GAMES = new Set(['ask-accept', 'troel', 'troela']);

// Fixed absolute values for WL-mode single-caller games (SPLIT3 distribution).
const WL_VALUES = {
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
const MISERIE_SCORES = {
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

// ══════════════════════════════════════════
//  SCORING FUNCTIONS
// ══════════════════════════════════════════

/** Return 'W' or 'L' based on the slagen value for slagen-mode games. */
function calcResultFromSlagen(gameType, slagen) {
  const table = SLAGEN_TABLE[gameType];
  if (!table || slagen === null) return null;
  return table[slagen - 1] > 0 ? 'W' : 'L';
}

/** Compute the 4-player score array for a completed tournament round. */
function calcTournScores(gameType, callers, slagen, callerResults) {
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

// ══════════════════════════════════════════
//  PERSISTENCE
// ══════════════════════════════════════════
function saveState() {
  try { localStorage.setItem('whist_state', JSON.stringify(state)); } catch (e) {}
}

function initFreshState() {
  const game = createNewGame('tournament');
  game.name = 'Game 1';
  state.games = [game];
  state.activeGameId = game.id;
}

function loadState() {
  try {
    const s = localStorage.getItem('whist_state');
    if (!s) { initFreshState(); return; }
    const saved = JSON.parse(s);

    // Already in new multi-game format
    if (saved.games && Array.isArray(saved.games)) {
      state.theme      = saved.theme      || 'system';
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
          // Active mode even if empty
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

// ══════════════════════════════════════════
//  THEME
// ══════════════════════════════════════════
function applyTheme(pref) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (pref === 'dark' || (pref === 'system' && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  ['themeSystem', 'themeLight', 'themeDark'].forEach(id =>
    document.getElementById(id).classList.remove('active')
  );
  const map = { system: 'themeSystem', light: 'themeLight', dark: 'themeDark' };
  document.getElementById(map[pref]).classList.add('active');
}

// ══════════════════════════════════════════
//  GAME SELECTOR
// ══════════════════════════════════════════
const GAME_LABELS = { tournament: 'Whist', simple: 'Manual' };

function applyMode(mode) {
  document.getElementById('gameSelectorTitle').textContent = GAME_LABELS[mode] || 'Whist';
  document.getElementById('checkTournament').textContent = mode === 'tournament' ? '✓' : '';
  document.getElementById('checkSimple').textContent = mode === 'simple' ? '✓' : '';
  document.querySelectorAll('.game-selector-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  document.getElementById('scoreTable').classList.toggle('tournament-mode', mode === 'tournament');
}

// ══════════════════════════════════════════
//  RENDER
// ══════════════════════════════════════════
function getRunningTotals() {
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

function renderAll() {
  renderHeader();
  renderRows();
  renderTotals();
  renderGameBar();
  renderGameOver();
}

function renderHeader() {
  const header       = document.getElementById('playerHeader');
  const isTournament = currentMode() === 'tournament';
  header.innerHTML   = '<div class="player-header-cell"></div>';

  if (isTournament) {
    const gtHdr = document.createElement('div');
    gtHdr.className   = 'game-type-hdr';
    gtHdr.textContent = 'Game';
    header.appendChild(gtHdr);

    const slHdr       = document.createElement('div');
    slHdr.className   = 'slagen-hdr';
    slHdr.textContent = 'Slgn';
    header.appendChild(slHdr);

    const resHdr       = document.createElement('div');
    resHdr.className   = 'result-hdr';
    resHdr.textContent = 'R';
    header.appendChild(resHdr);
  }

  const currentDealer = modeState().rounds.length % NUM_PLAYERS;
  modeState().playerNames.forEach((name, i) => {
    const cell    = document.createElement('div');
    cell.className = 'player-header-cell';
    const btn     = document.createElement('button');
    btn.className  = 'player-name-btn';
    btn.onclick    = () => openRenameSheet();

    const nameSpan       = document.createElement('span');
    nameSpan.className   = 'player-name-short';
    nameSpan.textContent = shortName(name);

    const dot       = document.createElement('span');
    dot.className   = 'dealer-dot' + (i === currentDealer ? ' active' : '');
    dot.title       = 'Dealer';

    btn.appendChild(nameSpan);
    btn.appendChild(dot);
    cell.appendChild(btn);
    header.appendChild(cell);
  });
}

function renderRows() {
  const container    = document.getElementById('roundRows');
  container.innerHTML = '';
  const { runningPerRound } = getRunningTotals();
  const isTournament = currentMode() === 'tournament';

  for (let r = 0; r < TOTAL_ROUNDS; r++) {
    const row      = document.createElement('div');
    row.className  = 'round-row';
    const isFilled  = r < modeState().rounds.length;
    const isCurrent = r === modeState().rounds.length;

    if (isFilled)       row.classList.add('filled');
    else if (isCurrent) row.classList.add('current');
    else                row.classList.add('empty');

    // Round number
    const numCell       = document.createElement('div');
    numCell.className   = 'round-num';
    numCell.textContent = r + 1;
    row.appendChild(numCell);

    // Tournament: game-type cell
    if (isTournament) {
      const gtCell    = document.createElement('div');
      gtCell.className = 'game-type-cell';
      if (isFilled) {
        const rd = modeState().rounds[r];
        const gt = getGameType(rd.gameType);
        const abbrEl       = document.createElement('div');
        abbrEl.className   = 'game-type-abbr';
        abbrEl.textContent = gt ? gt.abbr : '?';
        const callersEl       = document.createElement('div');
        callersEl.className   = 'game-type-callers';
        const callerCount     = (rd.callers || []).length;
        const callerTrunc     = callerCount > 2 ? 3 : 4;
        callersEl.textContent = (rd.callers || [])
          .map(i => modeState().playerNames[i].slice(0, callerTrunc)).join('+');
        gtCell.appendChild(abbrEl);
        gtCell.appendChild(callersEl);
      }
      row.appendChild(gtCell);
    }

    // Tournament: slagen cell + result cell (before player scores)
    if (isTournament) {
      const slCell    = document.createElement('div');
      slCell.className = 'slagen-cell';
      if (isFilled) {
        const rd       = modeState().rounds[r];
        const gt       = getGameType(rd.gameType);
        const isWLMode = gt && gt.inputMode === 'wl';
        const complete = isRoundComplete(rd);

        if (!isWLMode && rd.slagen !== null) {
          const valEl       = document.createElement('div');
          valEl.className   = 'slagen-val';
          valEl.textContent = rd.slagen;
          slCell.appendChild(valEl);
        } else if (!complete) {
          const dot    = document.createElement('div');
          dot.className = 'slagen-dot';
          slCell.appendChild(dot);
        } else if (isWLMode) {
          const callerRes = rd.callerResults || {};
          const wlResults2 = (rd.callers || []).map(c => callerRes[c]).filter(Boolean);
          const allW2 = wlResults2.length > 0 && wlResults2.every(rv => rv === 'W');
          const allL2 = wlResults2.length > 0 && wlResults2.every(rv => rv === 'L');
          const ck         = document.createElement('div');
          const ckSymbol   = allW2 ? '✓' : allL2 ? '✗' : '–';
          ck.style.cssText = 'font-size:13px;font-weight:600;color:var(--text2)';
          ck.textContent   = ckSymbol;
          slCell.appendChild(ck);
        }

        slCell.addEventListener('click', () => {
          if (isWLMode) openWLPicker(r);
          else          openSlagenPicker(r);
        });
      }
      row.appendChild(slCell);

      const resCell    = document.createElement('div');
      resCell.className = 'result-cell';
      if (isFilled && isRoundComplete(modeState().rounds[r])) {
        resCell.classList.add('clickable');
        resCell.addEventListener('click', () => openRoundResultSheet(r));
      }
      if (isFilled) {
        const rd = modeState().rounds[r];
        const gt = getGameType(rd.gameType);
        if (gt && gt.inputMode === 'wl' && rd.callerResults) {
          const results = (rd.callers || [])
            .map(c => rd.callerResults[c]).filter(Boolean);
          if (results.length === 1) {
            const allW = results[0] === 'W';
            if (allW) resCell.classList.add('result-win');
            else      resCell.classList.add('result-loss');
            const badge       = document.createElement('div');
            badge.className   = 'result-badge ' + (results[0] === 'W' ? 'win' : 'loss');
            badge.textContent = results[0];
            resCell.appendChild(badge);
          } else if (results.length > 1) {
            resCell.style.position = 'relative';
            resCell.style.padding  = '0';
            const wrap         = document.createElement('div');
            wrap.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:row;overflow:hidden;gap:1px;background:var(--border)';
            const fs           = results.length > 2 ? '9px' : '11px';
            results.forEach(rv => {
              const isW            = rv === 'W';
              const sliver         = document.createElement('div');
              sliver.style.cssText = `flex:1;height:100%;display:flex;align-items:center;justify-content:center;font-size:${fs};font-weight:700;background:${isW ? 'var(--accent-light)' : 'var(--neg-light)'};color:${isW ? 'var(--accent)' : 'var(--neg)'}`;
              sliver.textContent   = rv;
              wrap.appendChild(sliver);
            });
            resCell.appendChild(wrap);
          }
        } else if (rd.result) {
          resCell.classList.add(rd.result === 'W' ? 'result-win' : 'result-loss');
          const badge       = document.createElement('div');
          badge.className   = 'result-badge ' + (rd.result === 'W' ? 'win' : 'loss');
          badge.textContent = rd.result;
          resCell.appendChild(badge);
        }
      }
      row.appendChild(resCell);
    }

    // Score cells
    for (let p = 0; p < NUM_PLAYERS; p++) {
      const cell    = document.createElement('div');
      cell.className = 'score-cell';
      if (isFilled) {
        const rd       = modeState().rounds[r];
        const hasScore = !isTournament || isRoundComplete(rd);
        if (hasScore) {
          const delta   = rd.scores[p];
          const running = runningPerRound[r][p];

          const deltaEl       = document.createElement('div');
          deltaEl.className   = 'score-delta ' + (delta > 0 ? 'pos' : delta < 0 ? 'neg' : 'zero');
          deltaEl.textContent = (delta > 0 ? '+' : '') + delta;

          const runEl       = document.createElement('div');
          runEl.className   = 'score-running';
          runEl.textContent = running;

          cell.appendChild(deltaEl);
          cell.appendChild(runEl);
        }
      }
      row.appendChild(cell);
    }

    // Long-press to edit filled rows
    if (isFilled) {
      const openEdit = () => {
        if (isTournament) openTournRoundSheet(r);
        else              openRoundSheet(r);
      };
      row.addEventListener('touchstart', () => {
        longPressTimer = setTimeout(() => {
          row.classList.add('long-press-highlight');
          openEdit();
          setTimeout(() => row.classList.remove('long-press-highlight'), 300);
        }, 600);
      });
      row.addEventListener('touchend',  () => clearTimeout(longPressTimer));
      row.addEventListener('touchmove', () => clearTimeout(longPressTimer));
      row.addEventListener('mousedown', () => {
        longPressTimer = setTimeout(() => openEdit(), 600);
      });
      row.addEventListener('mouseup',   () => clearTimeout(longPressTimer));
    }

    container.appendChild(row);
  }

  document.getElementById('hint').classList.toggle('show', modeState().rounds.length > 0);
}

function renderTotals() {
  const { totals }   = getRunningTotals();
  const totalRow      = document.getElementById('totalRow');
  const isTournament  = currentMode() === 'tournament';
  totalRow.innerHTML  = '<div class="total-cell"></div>';

  if (isTournament) {
    totalRow.appendChild(document.createElement('div')); // game type
    totalRow.appendChild(document.createElement('div')); // slagen
    totalRow.appendChild(document.createElement('div')); // result
  }

  const allDone  = modeState().rounds.length === TOTAL_ROUNDS && modeState().rounds.every(r => isRoundComplete(r));
  const maxScore = Math.max(...totals);
  totals.forEach(t => {
    const cell    = document.createElement('div');
    cell.className = 'total-cell';

    const lbl       = document.createElement('div');
    lbl.className   = 'total-label';
    lbl.textContent = 'Total';

    const isWinner = allDone && t === maxScore;
    const isLoser  = allDone && t < maxScore;
    const val       = document.createElement('div');
    val.className   = 'total-score' + (isWinner ? ' winner' : isLoser ? ' loser' : '');
    val.textContent = t;

    cell.appendChild(lbl);
    cell.appendChild(val);
    totalRow.appendChild(cell);
  });
}

function renderGameBar() {
  const r              = modeState().rounds.length;
  const completedCount = modeState().rounds.filter(rd => isRoundComplete(rd)).length;
  document.getElementById('roundIndicator').textContent  = r + ' / 16';
  document.getElementById('dealerIndicator').textContent = shortName(modeState().playerNames[completedCount % NUM_PLAYERS]);
  const lastIncomplete = r > 0 && !isRoundComplete(modeState().rounds[r - 1]);
  const allDone = r >= TOTAL_ROUNDS && modeState().rounds.every(rd => isRoundComplete(rd));
  document.getElementById('addRoundBtn').disabled = r >= TOTAL_ROUNDS || lastIncomplete;
  document.querySelector('.bottom-bar').style.display = allDone ? 'none' : '';
}

function renderGameOver() {
  const banner = document.getElementById('gameOverBanner');
  const newGameBtn = document.getElementById('newGameBtn');
  if (modeState().rounds.length < TOTAL_ROUNDS || !modeState().rounds.every(r => isRoundComplete(r))) {
    banner.classList.remove('show');
    newGameBtn.classList.remove('highlight');
    return;
  }
  banner.classList.add('show');
  newGameBtn.classList.add('highlight');
  const { totals } = getRunningTotals();
  const max     = Math.max(...totals);
  const winners = modeState().playerNames.filter((_, i) => totals[i] === max);
  document.getElementById('gameOverTitle').textContent = winners.join(' & ') + ' wins!';
  document.getElementById('gameOverSub').textContent   =
    modeState().playerNames.map((n, i) => shortName(n) + ': ' + totals[i]).join('  ·  ');
}

// ══════════════════════════════════════════
//  SIMPLE MODE — ROUND SHEET
// ══════════════════════════════════════════
function openRoundSheet(roundIndex) {
  editingRound   = roundIndex;
  selectedPlayers = [];
  selectedScore   = null;
  manualMode      = false;
  manualValues    = ['', '', '', ''];

  const isEdit       = roundIndex < modeState().rounds.length;
  const displayRound = isEdit ? roundIndex + 1 : modeState().rounds.length + 1;

  document.getElementById('sheetTitle').textContent    = 'Round ' + displayRound;
  document.getElementById('sheetSubtitle').textContent = isEdit
    ? 'Editing round ' + displayRound + ' — changes will be saved'
    : 'Select who played and enter their score';

  if (isEdit) {
    const scores     = modeState().rounds[roundIndex].scores;
    const posPlayers = scores.map((s, i) => s > 0 ? i : -1).filter(i => i >= 0);
    if (posPlayers.length >= 1 && posPlayers.length <= 2) {
      selectedPlayers = posPlayers;
      selectedScore   = scores[posPlayers[0]];
    }
  }

  buildPlayerSelectGrid();
  buildScoreButtons();
  document.getElementById('scoreSection').style.visibility    = 'visible';
  document.getElementById('overrideToggleRow').style.visibility = 'visible';
  document.getElementById('manualGrid').style.display          = 'none';
  document.getElementById('previewBox').style.visibility       = 'hidden';
  document.getElementById('overrideCheckbox').checked          = false;
  document.getElementById('sumWarning').classList.remove('show');
  document.getElementById('confirmBtn').disabled               = true;
  document.getElementById('customScoreInput').value            = '';

  updateScoreSection();
  openOverlay('roundOverlay');
}

function buildPlayerSelectGrid() {
  const grid    = document.getElementById('playerSelectGrid');
  grid.innerHTML = '';
  modeState().playerNames.forEach((name, i) => {
    const btn       = document.createElement('button');
    btn.className   = 'player-select-btn' + (selectedPlayers.includes(i) ? ' selected' : '');
    btn.textContent = name;
    btn.onclick     = () => togglePlayerSelect(i);
    grid.appendChild(btn);
  });
}

function togglePlayerSelect(idx) {
  if (selectedPlayers.includes(idx)) {
    selectedPlayers = selectedPlayers.filter(i => i !== idx);
  } else if (selectedPlayers.length < 2) {
    selectedPlayers.push(idx);
  } else {
    selectedPlayers.shift();
    selectedPlayers.push(idx);
  }
  buildPlayerSelectGrid();
  buildScoreButtons();
  updateScoreSection();
}

function updateScoreSection() {
  document.getElementById('scoreSection').style.visibility    = 'visible';
  document.getElementById('overrideToggleRow').style.visibility = 'visible';
  updatePreview();
  validateConfirm();
}

// Scores achievable in 2-caller games (Ask-Accept, Troel, Troela) per the scoring table
const TWO_PLAYER_VALID = new Set([
  2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 24, 28,
  -2, -3, -4, -5, -6, -7, -8, -10, -12, -14, -16, -18,
]);

function isScoreValid(v) {
  if (selectedPlayers.length === 0) return false;
  if (selectedPlayers.length === 1) return Math.abs(v) % 3 === 0;
  if (selectedPlayers.length === 2) return TWO_PLAYER_VALID.has(v);
  return true;
}

function buildScoreButtons() {
  const posGrid    = document.getElementById('scorePosGrid');
  const negGrid    = document.getElementById('scoreNegGrid');
  posGrid.innerHTML = '';
  negGrid.innerHTML = '';

  if (selectedScore !== null && !isScoreValid(selectedScore)) selectedScore = null;

  POS_SCORES.forEach(v => {
    const valid = isScoreValid(v);
    const btn   = document.createElement('button');
    btn.className   = 'score-quick-btn pos-btn' + (selectedScore === v ? ' selected-pos' : '');
    btn.textContent = '+' + v;
    btn.style.opacity = valid ? '1' : '0.2';
    btn.style.cursor  = valid ? 'pointer' : 'not-allowed';
    btn.disabled      = !valid;
    if (valid) btn.onclick = () => selectScore(v);
    posGrid.appendChild(btn);
  });

  NEG_SCORES.forEach(v => {
    const valid = isScoreValid(v);
    const btn   = document.createElement('button');
    btn.className   = 'score-quick-btn neg-btn' + (selectedScore === v ? ' selected-neg' : '');
    btn.textContent = v;
    btn.style.opacity = valid ? '1' : '0.2';
    btn.style.cursor  = valid ? 'pointer' : 'not-allowed';
    btn.disabled      = !valid;
    if (valid) btn.onclick = () => selectScore(v);
    negGrid.appendChild(btn);
  });
}

function selectScore(v) {
  selectedScore = v;
  document.getElementById('customScoreInput').value = '';
  buildScoreButtons();
  updatePreview();
  validateConfirm();
}

function computeAutoScores() {
  const scores = [0, 0, 0, 0];
  if (selectedPlayers.length === 0 || selectedScore === null) return scores;
  const numOthers = NUM_PLAYERS - selectedPlayers.length;
  selectedPlayers.forEach(i => { scores[i] = selectedScore; });
  const eachOther = -(selectedScore * selectedPlayers.length) / numOthers;
  for (let i = 0; i < NUM_PLAYERS; i++) {
    if (!selectedPlayers.includes(i)) scores[i] = eachOther;
  }
  return scores;
}

function updatePreview() {
  if (manualMode) { updateManualPreview(); return; }
  if (selectedPlayers.length === 0 || selectedScore === null) {
    document.getElementById('previewBox').style.visibility = 'hidden';
    return;
  }
  document.getElementById('previewBox').style.visibility = 'visible';
  const grid    = document.getElementById('previewGrid');
  grid.innerHTML = '';
  const scores  = computeAutoScores();
  modeState().playerNames.forEach((name, i) => {
    const cell       = document.createElement('div');
    cell.className   = 'preview-player';
    const nameEl       = document.createElement('div');
    nameEl.className   = 'preview-name';
    nameEl.textContent = shortName(name);
    const v            = scores[i];
    const valEl        = document.createElement('div');
    valEl.className    = 'preview-val ' + (v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero');
    valEl.textContent  = (v > 0 ? '+' : '') + v;
    cell.appendChild(nameEl);
    cell.appendChild(valEl);
    grid.appendChild(cell);
  });
}

function updateManualPreview() {
  document.getElementById('previewBox').style.visibility = 'visible';
  const grid    = document.getElementById('previewGrid');
  grid.innerHTML = '';
  modeState().playerNames.forEach((name, i) => {
    const cell       = document.createElement('div');
    cell.className   = 'preview-player';
    const nameEl       = document.createElement('div');
    nameEl.className   = 'preview-name';
    nameEl.textContent = shortName(name);
    const raw = manualValues[i];
    const v   = raw === '' ? null : parseFloat(raw);
    const valEl = document.createElement('div');
    if (v === null || isNaN(v)) {
      valEl.className   = 'preview-val unset';
      valEl.textContent = '—';
    } else {
      valEl.className   = 'preview-val ' + (v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero');
      valEl.textContent = (v > 0 ? '+' : '') + v;
    }
    cell.appendChild(nameEl);
    cell.appendChild(valEl);
    grid.appendChild(cell);
  });
  const sum  = manualValues.reduce((a, v) => a + (parseFloat(v) || 0), 0);
  document.getElementById('sumWarning').classList.toggle('show', Math.abs(sum) > 0.001);
}

function buildManualGrid() {
  const grid    = document.getElementById('manualGrid');
  grid.innerHTML = '';
  modeState().playerNames.forEach((name, i) => {
    const cell    = document.createElement('div');
    cell.className = 'manual-cell';
    const lbl       = document.createElement('div');
    lbl.className   = 'manual-player-label';
    lbl.textContent = shortName(name);
    const inp    = document.createElement('input');
    inp.className = 'manual-input';
    inp.type      = 'number';
    inp.placeholder = '0';
    inp.value     = manualValues[i];
    inp.addEventListener('input', () => {
      manualValues[i] = inp.value;
      updateManualPreview();
      validateConfirm();
    });
    cell.appendChild(lbl);
    cell.appendChild(inp);
    grid.appendChild(cell);
  });
}

function validateConfirm() {
  let valid = false;
  if (manualMode) {
    const allFilled = manualValues.every(v => v !== '' && !isNaN(parseFloat(v)));
    const sum       = manualValues.reduce((a, v) => a + (parseFloat(v) || 0), 0);
    valid = allFilled && Math.abs(sum) < 0.001;
  } else if (selectedPlayers.length > 0 && selectedScore !== null) {
    valid = computeAutoScores().every(s => Number.isInteger(s));
  }
  document.getElementById('confirmBtn').disabled = !valid;
}

function confirmRound() {
  const scores = manualMode ? manualValues.map(v => parseFloat(v)) : computeAutoScores();
  if (editingRound < modeState().rounds.length) {
    modeState().rounds[editingRound] = { scores };
  } else {
    modeState().rounds.push({ scores });
  }
  saveState();
  closeOverlay('roundOverlay');
  renderAll();
  if (autoScrollEnabled) scrollToCurrentRound();
}

// ══════════════════════════════════════════
//  SETTINGS & RENAME SHEETS
// ══════════════════════════════════════════
function openSettingsSheet() { openOverlay('settingsOverlay'); }

function openRenameSheet() {
  const inputs    = document.getElementById('renameInputs');
  inputs.innerHTML = '';
  modeState().playerNames.forEach((name, i) => {
    const row    = document.createElement('div');
    row.className = 'rename-row';
    const lbl       = document.createElement('label');
    lbl.className   = 'rename-label';
    lbl.textContent = 'Player ' + (i + 1);
    const inp    = document.createElement('input');
    inp.className = 'rename-input';
    inp.type      = 'text';
    inp.value     = name;
    inp.maxLength = 14;
    row.appendChild(lbl);
    row.appendChild(inp);
    inputs.appendChild(row);
  });
  closeOverlay('settingsOverlay');
  openOverlay('renameOverlay');
}

function saveNames() {
  document.querySelectorAll('#renameInputs .rename-input').forEach((inp, i) => {
    const val = inp.value.trim();
    if (val) modeState().playerNames[i] = val;
  });
  saveState();
  closeOverlay('renameOverlay');
  renderAll();
}

// ══════════════════════════════════════════
//  NEW GAME
// ══════════════════════════════════════════
function newGame()   { openOverlay('confirmOverlay'); }
function doNewGame() {
  const cur     = activeGame();
  const newGame = createNewGame(cur ? cur.mode : 'tournament');
  if (cur) newGame.playerNames = [...cur.playerNames];
  state.games.push(newGame);
  state.activeGameId = newGame.id;
  saveState();
  closeOverlay('confirmOverlay');
  applyMode(currentMode());
  renderAll();
  renderSidebar();
}

// ══════════════════════════════════════════
//  OVERLAY HELPERS
// ══════════════════════════════════════════
function openOverlay(id)  { document.getElementById(id).classList.add('open'); }
function closeOverlay(id) { document.getElementById(id).classList.remove('open'); }

function scrollToCurrentRound() {
  const container = document.getElementById('roundRows');
  const current   = container.querySelector('.round-row.current');
  if (current) current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function openRoundResultSheet(roundIndex) {
  const rd  = modeState().rounds[roundIndex];
  if (!rd || !isRoundComplete(rd)) return;
  const gt  = getGameType(rd.gameType);
  const { runningPerRound } = getRunningTotals();

  document.getElementById('rrTitle').textContent = 'Round ' + (roundIndex + 1) + ' result';

  const callerNames = (rd.callers || []).map(i => shortName(modeState().playerNames[i])).join(' + ');
  let sub = gt ? gt.label : '';
  if (callerNames) sub += ' · ' + callerNames;
  if (rd.slagen !== null && rd.slagen !== undefined) sub += ' · ' + rd.slagen + ' tricks';
  document.getElementById('rrSub').textContent = sub;

  const scoresEl = document.getElementById('rrScores');
  scoresEl.innerHTML = '';
  const running = runningPerRound[roundIndex] || [0, 0, 0, 0];
  modeState().playerNames.forEach((name, i) => {
    const delta   = rd.scores[i];
    const cell    = document.createElement('div');
    cell.className = 'rr-player';

    const nameEl       = document.createElement('div');
    nameEl.className   = 'rr-name';
    nameEl.textContent = shortName(name);

    const deltaEl       = document.createElement('div');
    deltaEl.className   = 'rr-delta ' + (delta > 0 ? 'pos' : delta < 0 ? 'neg' : 'zero');
    deltaEl.textContent = (delta > 0 ? '+' : '') + delta;

    const totalEl       = document.createElement('div');
    totalEl.className   = 'rr-total';
    totalEl.textContent = running[i];

    cell.appendChild(nameEl);
    cell.appendChild(deltaEl);
    cell.appendChild(totalEl);
    scoresEl.appendChild(cell);
  });

  openOverlay('roundResultOverlay');
}

// ══════════════════════════════════════════
//  TOURNAMENT — ROUND SHEET
// ══════════════════════════════════════════
function openTournRoundSheet(roundIndex) {
  tournEditingRound = roundIndex;
  const isEdit       = roundIndex < modeState().rounds.length;
  const displayRound = isEdit ? roundIndex + 1 : modeState().rounds.length + 1;

  document.getElementById('tournSheetTitle').textContent = 'Round ' + displayRound;
  document.getElementById('tournSheetSub').textContent   = isEdit
    ? 'Editing round ' + displayRound + ' — changes will be saved'
    : 'Select the caller(s) and game type';

  if (isEdit) {
    const rd      = modeState().rounds[roundIndex];
    tournCallers  = [...(rd.callers || [])];
    tournGameType = rd.gameType || null;
  } else {
    tournCallers  = [];
    tournGameType = null;
  }

  buildTournCallerGrid();
  buildTournGameTypeGrid();
  validateTournConfirm();
  openOverlay('tournRoundOverlay');
}

function buildTournCallerGrid() {
  const grid    = document.getElementById('tournCallerGrid');
  grid.innerHTML = '';
  modeState().playerNames.forEach((name, i) => {
    const btn       = document.createElement('button');
    btn.className   = 'caller-btn' + (tournCallers.includes(i) ? ' selected' : '');
    btn.textContent = name;
    btn.onclick     = () => toggleTournCaller(i);
    grid.appendChild(btn);
  });
}

function toggleTournCaller(idx) {
  if (tournCallers.includes(idx)) {
    tournCallers = tournCallers.filter(i => i !== idx);
  } else if (tournCallers.length < 3) {
    tournCallers.push(idx);
  } else {
    tournCallers.shift();
    tournCallers.push(idx);
  }
  // Deselect game type if caller count no longer fits
  if (tournGameType) {
    const gt  = getGameType(tournGameType);
    if (gt) {
      const min = gt.minCallers || gt.maxCallers;
      if (tournCallers.length < min || tournCallers.length > gt.maxCallers) tournGameType = null;
    }
  }
  buildTournCallerGrid();
  buildTournGameTypeGrid();
  validateTournConfirm();
}

function buildTournGameTypeGrid() {
  const grid    = document.getElementById('tournGameTypeGrid');
  grid.innerHTML = '';
  GAME_TYPES.forEach(gt => {
    const min          = gt.minCallers || gt.maxCallers;
    const callerCountOk = tournCallers.length >= min && tournCallers.length <= gt.maxCallers;
    const btn          = document.createElement('button');
    btn.className      = 'gt-btn' + (tournGameType === gt.id ? ' selected' : '');
    if (!callerCountOk) {
      btn.disabled        = true;
      btn.style.opacity   = '0.25';
      btn.style.cursor    = 'not-allowed';
    } else {
      btn.onclick = () => {
        tournGameType = gt.id;
        buildTournGameTypeGrid();
        validateTournConfirm();
      };
    }
    const abbrSpan       = document.createElement('span');
    abbrSpan.className   = 'gt-abbr';
    abbrSpan.textContent = gt.abbr;
    btn.appendChild(abbrSpan);
    btn.appendChild(document.createTextNode(gt.label));
    grid.appendChild(btn);
  });
}

function validateTournConfirm() {
  const gt        = getGameType(tournGameType);
  const callersOk = gt
    ? tournCallers.length >= (gt.minCallers || gt.maxCallers) && tournCallers.length <= gt.maxCallers
    : tournCallers.length >= 1;
  document.getElementById('tournConfirmBtn').disabled = !(tournGameType && callersOk);
}

function confirmTournRound() {
  const isEdit   = tournEditingRound < modeState().rounds.length;
  const prev     = isEdit ? modeState().rounds[tournEditingRound] : null;
  const sameType = prev && prev.gameType === tournGameType;
  const newRound = {
    callers:       [...tournCallers],
    gameType:      tournGameType,
    slagen:        sameType ? prev.slagen        : null,
    callerResults: sameType ? prev.callerResults : null,
    result:        sameType ? prev.result        : null,
    scores:        sameType ? prev.scores        : [0, 0, 0, 0],
  };
  if (isEdit) modeState().rounds[tournEditingRound] = newRound;
  else        modeState().rounds.push(newRound);
  saveState();
  closeOverlay('tournRoundOverlay');
  renderAll();
  // For new rounds, jump straight into slagen/WL entry
  if (!isEdit) {
    const newIdx = modeState().rounds.length - 1;
    const gt     = getGameType(tournGameType);
    if (gt && gt.inputMode === 'wl') openWLPicker(newIdx);
    else                             openSlagenPicker(newIdx);
  }
}

// ══════════════════════════════════════════
//  TOURNAMENT — SLAGEN PICKER  (numeric)
// ══════════════════════════════════════════
function openSlagenPicker(roundIndex) {
  slagenRoundIndex = roundIndex;
  const rd = modeState().rounds[roundIndex];
  slagenSelected   = rd.slagen;
  const gt         = getGameType(rd.gameType);
  document.getElementById('slagenTitle').textContent    = 'Slagen — Round ' + (roundIndex + 1);
  document.getElementById('slagenSubtitle').textContent =
    (gt ? gt.label : '') + '  ·  Tap the number of tricks won';
  document.getElementById('slagenPickerGrid').style.display = '';
  document.getElementById('wlPickerContent').style.display  = 'none';
  buildSlagenGrid();
  document.getElementById('slagenConfirmBtn').disabled = slagenSelected === null;
  openOverlay('slagenOverlay');
}

function buildSlagenGrid() {
  const grid    = document.getElementById('slagenPickerGrid');
  grid.innerHTML = '';
  for (let i = 1; i <= 13; i++) {
    const btn       = document.createElement('button');
    btn.className   = 'slagen-num-btn' + (slagenSelected === i ? ' selected' : '');
    btn.textContent = i;
    btn.onclick     = () => {
      slagenSelected = i;
      buildSlagenGrid();
      document.getElementById('slagenConfirmBtn').disabled = false;
    };
    grid.appendChild(btn);
  }
}

function confirmSlagen() {
  const rd       = modeState().rounds[slagenRoundIndex];
  rd.slagen      = slagenSelected;
  rd.result      = calcResultFromSlagen(rd.gameType, slagenSelected);
  rd.callerResults = null;
  rd.scores      = calcTournScores(rd.gameType, rd.callers, slagenSelected, null);
  saveState();
  closeOverlay('slagenOverlay');
  renderAll();
  if (autoScrollEnabled) scrollToCurrentRound();
}

// ══════════════════════════════════════════
//  TOURNAMENT — W/L PICKER  (per caller)
// ══════════════════════════════════════════
function openWLPicker(roundIndex) {
  wlRoundIndex = roundIndex;
  const rd     = modeState().rounds[roundIndex];
  wlResults    = rd.callerResults ? { ...rd.callerResults } : {};
  const gt     = getGameType(rd.gameType);
  document.getElementById('slagenTitle').textContent    = 'Result — Round ' + (roundIndex + 1);
  document.getElementById('slagenSubtitle').textContent = (gt ? gt.label : '') + '  ·  Won or lost?';
  document.getElementById('slagenPickerGrid').style.display = 'none';
  document.getElementById('wlPickerContent').style.display  = '';
  buildWLPickerContent(rd.callers || []);
  validateWLConfirm(rd.callers || []);
  openOverlay('slagenOverlay');
}

function buildWLPickerContent(callers) {
  const wrap    = document.getElementById('wlPickerContent');
  wrap.innerHTML = '';
  callers.forEach(idx => {
    const row    = document.createElement('div');
    row.className = 'wl-caller-row';
    const nameEl       = document.createElement('div');
    nameEl.className   = 'wl-caller-name';
    nameEl.textContent = modeState().playerNames[idx];
    const pair    = document.createElement('div');
    pair.className = 'wl-btn-pair';
    ['W', 'L'].forEach(val => {
      const btn       = document.createElement('button');
      btn.className   = 'wl-btn ' + (val === 'W' ? 'w-btn' : 'l-btn') +
        (wlResults[idx] === val ? ' sel' : '');
      btn.textContent = val;
      btn.onclick     = () => {
        wlResults[idx] = val;
        buildWLPickerContent(callers);
        validateWLConfirm(callers);
      };
      pair.appendChild(btn);
    });
    row.appendChild(nameEl);
    row.appendChild(pair);
    wrap.appendChild(row);
  });
}

function validateWLConfirm(callers) {
  document.getElementById('slagenConfirmBtn').disabled =
    !callers.every(c => wlResults[c] !== undefined);
}

function confirmWL() {
  const rd         = modeState().rounds[wlRoundIndex];
  rd.callerResults = { ...wlResults };
  rd.slagen        = null;
  rd.result        = combinedResult(rd.callerResults, rd.callers || []);
  rd.scores        = calcTournScores(rd.gameType, rd.callers, null, rd.callerResults);
  saveState();
  closeOverlay('slagenOverlay');
  renderAll();
  if (autoScrollEnabled) scrollToCurrentRound();
}

// ══════════════════════════════════════════
//  SIDEBAR — GAME HISTORY
// ══════════════════════════════════════════
function openSidebar() {
  renderSidebar();
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

function renderSidebar() {
  const list = document.getElementById('sidebarList');
  list.innerHTML = '';

  state.games.forEach(game => {
    const isActive       = game.id === state.activeGameId;
    const completedRounds = game.mode === 'tournament'
      ? game.rounds.filter(r => {
          if (!r.gameType) return false;
          const gt = getGameType(r.gameType);
          if (!gt) return r.slagen !== null;
          if (gt.inputMode === 'wl') return r.callerResults && (r.callers||[]).every(c => r.callerResults[c] !== undefined);
          return r.slagen !== null;
        }).length
      : game.rounds.length;

    const item       = document.createElement('div');
    item.className   = 'sidebar-game' + (isActive ? ' active' : '');
    item.dataset.id  = game.id;

    item.addEventListener('click', e => {
      if (e.target.closest('.sidebar-game-delete') ||
          e.target.closest('.sidebar-game-name-wrap')) return;
      switchToGame(game.id);
    });

    // Info block
    const info       = document.createElement('div');
    info.className   = 'sidebar-game-info';

    const nameWrap       = document.createElement('div');
    nameWrap.className   = 'sidebar-game-name-wrap';

    const nameEl         = document.createElement('span');
    nameEl.className     = 'sidebar-game-name';
    nameEl.textContent   = game.name;
    nameEl.title         = 'Tap to rename';
    nameEl.addEventListener('click', e => {
      e.stopPropagation();
      startRenameGame(game.id, nameWrap);
    });

    nameWrap.appendChild(nameEl);

    const meta         = document.createElement('div');
    meta.className     = 'sidebar-game-meta';
    meta.textContent   = completedRounds + ' / 16 rounds';

    info.appendChild(nameWrap);
    info.appendChild(meta);

    // Mode badge
    const badge       = document.createElement('span');
    badge.className   = 'sidebar-game-badge ' + (game.mode === 'tournament' ? 'badge-w' : 'badge-m');
    badge.textContent = game.mode === 'tournament' ? 'Whist' : 'Manual';

    // Delete button
    const del       = document.createElement('button');
    del.className   = 'sidebar-game-delete';
    del.title       = 'Delete game';
    del.innerHTML   = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 3h12M5 3V2h4v1M3 3l1 9h6l1-9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    del.addEventListener('click', e => { e.stopPropagation(); deleteGame(game.id); });

    if (state.games.length <= 1) {
      del.disabled    = true;
      del.style.opacity = '0.3';
      del.title       = 'Cannot delete the only game';
    }

    item.appendChild(info);
    item.appendChild(badge);
    item.appendChild(del);
    list.appendChild(item);
  });
}

function switchToGame(gameId) {
  state.activeGameId = gameId;
  applyMode(currentMode());
  saveState();
  renderAll();
  closeSidebar();
}

function startRenameGame(gameId, nameWrap) {
  const game = state.games.find(g => g.id === gameId);
  if (!game) return;

  const input       = document.createElement('input');
  input.className   = 'sidebar-game-name-input';
  input.value       = game.name;
  input.maxLength   = 30;
  nameWrap.innerHTML = '';
  nameWrap.appendChild(input);
  input.focus();
  input.select();

  const save = () => {
    const val = input.value.trim();
    if (val) game.name = val;
    saveState();
    renderSidebar();
  };
  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  input.blur();
    if (e.key === 'Escape') { game.name = game.name; renderSidebar(); }
  });
}

function deleteGame(gameId) {
  if (state.games.length <= 1) return;
  const wasActive = state.activeGameId === gameId;
  state.games = state.games.filter(g => g.id !== gameId);
  if (wasActive) {
    state.activeGameId = state.games[0].id;
    applyMode(currentMode());
    renderAll();
  }
  saveState();
  renderSidebar();
}

// ══════════════════════════════════════════
//  EVENT LISTENERS
// ══════════════════════════════════════════

// Backdrop tap closes sheet
document.querySelectorAll('.overlay').forEach(ov => {
  ov.addEventListener('click', e => { if (e.target === ov) closeOverlay(ov.id); });
});

// Sidebar
document.getElementById('sidebarBtn').addEventListener('click', openSidebar);
document.getElementById('sidebarCloseBtn').addEventListener('click', closeSidebar);
document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);
document.getElementById('sidebarNewGameBtn').addEventListener('click', () => {
  closeSidebar();
  newGame();
});

// Header — game selector
function closeGameSelector() {
  document.getElementById('gameSelectorMenu').classList.remove('open');
  document.getElementById('gameSelectorBtn').classList.remove('open');
}

document.getElementById('gameSelectorBtn').addEventListener('click', e => {
  e.stopPropagation();
  const isOpen = document.getElementById('gameSelectorMenu').classList.toggle('open');
  document.getElementById('gameSelectorBtn').classList.toggle('open', isOpen);
});

document.getElementById('gameSelectorMenu').addEventListener('click', e => {
  const btn = e.target.closest('.game-selector-option');
  if (!btn) return;
  activeGame().mode = btn.dataset.mode;
  applyMode(btn.dataset.mode);
  saveState();
  renderAll();
  closeSidebar();
  closeGameSelector();
});

document.addEventListener('mousedown', e => {
  if (!document.getElementById('gameSelectorWrap').contains(e.target)) {
    closeGameSelector();
  }
});
document.getElementById('settingsBtn').addEventListener('click', openSettingsSheet);

// Fit-to-screen toggle
let compactMode = false;
document.getElementById('fitBtn').addEventListener('click', () => {
  compactMode = !compactMode;
  document.getElementById('scoreTable').classList.toggle('compact', compactMode);
  document.getElementById('fitBtn').classList.toggle('active', compactMode);
  document.getElementById('fitBtn').title = compactMode ? 'Default view' : 'Fit to screen';
});

// Game bar
document.getElementById('newGameBtn').addEventListener('click', newGame);
document.getElementById('addRoundBtn').addEventListener('click', () => {
  if (currentMode() === 'tournament') openTournRoundSheet(modeState().rounds.length);
  else                                openRoundSheet(modeState().rounds.length);
});

// Simple round sheet
document.getElementById('confirmBtn').addEventListener('click', confirmRound);
document.getElementById('cancelBtn').addEventListener('click', () => closeOverlay('roundOverlay'));

document.getElementById('customScoreInput').addEventListener('input', e => {
  const v = parseFloat(e.target.value);
  selectedScore = isNaN(v) ? null : v;
  buildScoreButtons();
  updatePreview();
  validateConfirm();
});

document.getElementById('overrideCheckbox').addEventListener('change', e => {
  manualMode = e.target.checked;
  document.getElementById('manualGrid').style.display          = manualMode ? 'grid' : 'none';
  document.getElementById('scoreSection').style.visibility     = manualMode ? 'hidden' : 'visible';
  if (manualMode) {
    const auto  = computeAutoScores();
    manualValues = auto.map(v => v !== 0 ? String(v) : '');
    buildManualGrid();
    updateManualPreview();
  } else {
    document.getElementById('sumWarning').classList.remove('show');
    updatePreview();
  }
  validateConfirm();
});

// Settings sheet
document.getElementById('settingsCloseBtn').addEventListener('click', () => closeOverlay('settingsOverlay'));
document.getElementById('renamePlayersBtn').addEventListener('click', openRenameSheet);
document.getElementById('clearDataBtn').addEventListener('click', () => {
  if (confirm('Clear all saved data?')) {
    localStorage.removeItem('whist_state');
    location.reload();
  }
});

document.querySelectorAll('.theme-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    state.theme = btn.dataset.theme;
    applyTheme(state.theme);
    saveState();
  });
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.theme === 'system') applyTheme('system');
});

// Rename sheet
document.getElementById('renameConfirmBtn').addEventListener('click', saveNames);
document.getElementById('renameCancelBtn').addEventListener('click', () => closeOverlay('renameOverlay'));

// New game confirm
document.getElementById('confirmNewGameBtn').addEventListener('click', doNewGame);
document.getElementById('cancelNewGameBtn').addEventListener('click', () => closeOverlay('confirmOverlay'));

// Tournament round sheet
document.getElementById('tournConfirmBtn').addEventListener('click', confirmTournRound);
document.getElementById('tournCancelBtn').addEventListener('click', () => closeOverlay('tournRoundOverlay'));

// Round result sheet
document.getElementById('rrCloseBtn').addEventListener('click', () => closeOverlay('roundResultOverlay'));

// Auto-scroll: track whether the current empty row is visible
document.getElementById('roundRows').addEventListener('scroll', () => {
  const container  = document.getElementById('roundRows');
  const currentRow = container.querySelector('.round-row.current');
  if (!currentRow) { autoScrollEnabled = true; return; }
  const rr = currentRow.getBoundingClientRect();
  const cr = container.getBoundingClientRect();
  autoScrollEnabled = rr.top >= cr.top - 5 && rr.bottom <= cr.bottom + 5;
}, { passive: true });

// Slagen / W·L picker — route confirm based on active panel
document.getElementById('slagenConfirmBtn').addEventListener('click', () => {
  if (document.getElementById('wlPickerContent').style.display === 'none') confirmSlagen();
  else confirmWL();
});
document.getElementById('slagenCancelBtn').addEventListener('click', () => closeOverlay('slagenOverlay'));

// ══════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════
loadState();
applyTheme(state.theme);
applyMode(currentMode());
renderAll();
