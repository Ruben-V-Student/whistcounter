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
let state = {
  playerNames: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
  rounds: [],
  theme: 'system',
  mode: 'simple', // 'simple' | 'tournament'
};

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

// ══════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════
function getGameType(id) {
  return GAME_TYPES.find(g => g.id === id);
}

function shortName(n) {
  return n.length <= 7 ? n : n.slice(0, 6) + '…';
}

/** True when a round has had its result fully entered. */
function isRoundComplete(rd) {
  if (state.mode !== 'tournament') return true;
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

function loadState() {
  try {
    const s = localStorage.getItem('whist_state');
    if (s) state = { ...state, ...JSON.parse(s) };
  } catch (e) {}
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
//  MODE TOGGLE
// ══════════════════════════════════════════
function applyMode(mode) {
  const isTournament = mode === 'tournament';
  document.getElementById('simpleModeLabel').classList.toggle('active', !isTournament);
  document.getElementById('tournModeLabel').classList.toggle('active', isTournament);
  document.getElementById('modeSwitchInput').checked = isTournament;
  document.getElementById('scoreTable').classList.toggle('tournament-mode', isTournament);
}

// ══════════════════════════════════════════
//  RENDER
// ══════════════════════════════════════════
function getRunningTotals() {
  const totals = [0, 0, 0, 0];
  const runningPerRound = [];
  for (const round of state.rounds) {
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
  const isTournament = state.mode === 'tournament';
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

  const currentDealer = state.rounds.length % NUM_PLAYERS;
  state.playerNames.forEach((name, i) => {
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
  const isTournament = state.mode === 'tournament';

  for (let r = 0; r < TOTAL_ROUNDS; r++) {
    const row      = document.createElement('div');
    row.className  = 'round-row';
    const isFilled  = r < state.rounds.length;
    const isCurrent = r === state.rounds.length;

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
        const rd = state.rounds[r];
        const gt = getGameType(rd.gameType);
        const abbrEl       = document.createElement('div');
        abbrEl.className   = 'game-type-abbr';
        abbrEl.textContent = gt ? gt.abbr : '?';
        const callersEl       = document.createElement('div');
        callersEl.className   = 'game-type-callers';
        const callerCount     = (rd.callers || []).length;
        const callerTrunc     = callerCount > 2 ? 3 : 4;
        callersEl.textContent = (rd.callers || [])
          .map(i => state.playerNames[i].slice(0, callerTrunc)).join('+');
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
        const rd       = state.rounds[r];
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
          const ck           = document.createElement('div');
          ck.style.cssText   = 'font-size:13px;color:var(--text3)';
          ck.textContent     = '✓';
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
      if (isFilled) {
        const rd = state.rounds[r];
        const gt = getGameType(rd.gameType);
        if (gt && gt.inputMode === 'wl' && rd.callerResults) {
          const results = (rd.callers || [])
            .map(c => rd.callerResults[c]).filter(Boolean);
          if (results.length === 1) {
            const badge       = document.createElement('div');
            badge.className   = 'result-badge ' + (results[0] === 'W' ? 'win' : 'loss');
            badge.textContent = results[0];
            resCell.appendChild(badge);
          } else if (results.length > 1) {
            const badgePx       = results.length > 2 ? 9 : 13;
            const wrap          = document.createElement('div');
            wrap.style.cssText  = 'display:flex;flex-direction:row;gap:1px;align-items:center;justify-content:center';
            results.forEach(rv => {
              const mini          = document.createElement('div');
              mini.className      = 'result-badge ' + (rv === 'W' ? 'win' : 'loss');
              mini.style.cssText  = `width:${badgePx}px;height:${badgePx}px;font-size:${badgePx - 4}px;border-radius:2px;padding:0`;
              mini.textContent    = rv;
              wrap.appendChild(mini);
            });
            resCell.appendChild(wrap);
          }
        } else if (rd.result) {
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
        const rd       = state.rounds[r];
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

  document.getElementById('hint').classList.toggle('show', state.rounds.length > 0);
}

function renderTotals() {
  const { totals }   = getRunningTotals();
  const totalRow      = document.getElementById('totalRow');
  const isTournament  = state.mode === 'tournament';
  totalRow.innerHTML  = '<div class="total-cell"></div>';

  if (isTournament) {
    totalRow.appendChild(document.createElement('div')); // game type
    totalRow.appendChild(document.createElement('div')); // slagen
    totalRow.appendChild(document.createElement('div')); // result
  }

  const allDone  = state.rounds.length === TOTAL_ROUNDS && state.rounds.every(r => isRoundComplete(r));
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
  const r = state.rounds.length;
  document.getElementById('roundIndicator').textContent  = r + ' / 16';
  document.getElementById('dealerIndicator').textContent = shortName(state.playerNames[r % NUM_PLAYERS]);
  const lastIncomplete = r > 0 && !isRoundComplete(state.rounds[r - 1]);
  document.getElementById('addRoundBtn').disabled = r >= TOTAL_ROUNDS || lastIncomplete;
}

function renderGameOver() {
  const banner = document.getElementById('gameOverBanner');
  if (state.rounds.length < TOTAL_ROUNDS || !state.rounds.every(r => isRoundComplete(r))) { banner.classList.remove('show'); return; }
  banner.classList.add('show');
  const { totals } = getRunningTotals();
  const max     = Math.max(...totals);
  const winners = state.playerNames.filter((_, i) => totals[i] === max);
  document.getElementById('gameOverTitle').textContent = winners.join(' & ') + ' wins!';
  document.getElementById('gameOverSub').textContent   =
    state.playerNames.map((n, i) => shortName(n) + ': ' + totals[i]).join('  ·  ');
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

  const isEdit       = roundIndex < state.rounds.length;
  const displayRound = isEdit ? roundIndex + 1 : state.rounds.length + 1;

  document.getElementById('sheetTitle').textContent    = 'Round ' + displayRound;
  document.getElementById('sheetSubtitle').textContent = isEdit
    ? 'Editing round ' + displayRound + ' — changes will be saved'
    : 'Select who played and enter their score';

  if (isEdit) {
    const scores     = state.rounds[roundIndex].scores;
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
  state.playerNames.forEach((name, i) => {
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
  state.playerNames.forEach((name, i) => {
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
  state.playerNames.forEach((name, i) => {
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
  state.playerNames.forEach((name, i) => {
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
  if (editingRound < state.rounds.length) {
    state.rounds[editingRound] = { scores };
  } else {
    state.rounds.push({ scores });
  }
  saveState();
  closeOverlay('roundOverlay');
  renderAll();
}

// ══════════════════════════════════════════
//  SETTINGS & RENAME SHEETS
// ══════════════════════════════════════════
function openSettingsSheet() { openOverlay('settingsOverlay'); }

function openRenameSheet() {
  const inputs    = document.getElementById('renameInputs');
  inputs.innerHTML = '';
  state.playerNames.forEach((name, i) => {
    const row    = document.createElement('div');
    row.className = 'rename-row';
    const lbl       = document.createElement('label');
    lbl.className   = 'rename-label';
    lbl.textContent = 'Player ' + (i + 1);
    const inp    = document.createElement('input');
    inp.className = 'rename-input';
    inp.type      = 'text';
    inp.value     = name;
    inp.maxLength = 20;
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
    if (val) state.playerNames[i] = val;
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
  state.rounds = [];
  saveState();
  closeOverlay('confirmOverlay');
  renderAll();
}

// ══════════════════════════════════════════
//  OVERLAY HELPERS
// ══════════════════════════════════════════
function openOverlay(id)  { document.getElementById(id).classList.add('open'); }
function closeOverlay(id) { document.getElementById(id).classList.remove('open'); }

// ══════════════════════════════════════════
//  TOURNAMENT — ROUND SHEET
// ══════════════════════════════════════════
function openTournRoundSheet(roundIndex) {
  tournEditingRound = roundIndex;
  const isEdit       = roundIndex < state.rounds.length;
  const displayRound = isEdit ? roundIndex + 1 : state.rounds.length + 1;

  document.getElementById('tournSheetTitle').textContent = 'Round ' + displayRound;
  document.getElementById('tournSheetSub').textContent   = isEdit
    ? 'Editing round ' + displayRound + ' — changes will be saved'
    : 'Select the caller(s) and game type';

  if (isEdit) {
    const rd      = state.rounds[roundIndex];
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
  state.playerNames.forEach((name, i) => {
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
  const isEdit   = tournEditingRound < state.rounds.length;
  const prev     = isEdit ? state.rounds[tournEditingRound] : null;
  const sameType = prev && prev.gameType === tournGameType;
  const newRound = {
    callers:       [...tournCallers],
    gameType:      tournGameType,
    slagen:        sameType ? prev.slagen        : null,
    callerResults: sameType ? prev.callerResults : null,
    result:        sameType ? prev.result        : null,
    scores:        sameType ? prev.scores        : [0, 0, 0, 0],
  };
  if (isEdit) state.rounds[tournEditingRound] = newRound;
  else        state.rounds.push(newRound);
  saveState();
  closeOverlay('tournRoundOverlay');
  renderAll();
}

// ══════════════════════════════════════════
//  TOURNAMENT — SLAGEN PICKER  (numeric)
// ══════════════════════════════════════════
function openSlagenPicker(roundIndex) {
  slagenRoundIndex = roundIndex;
  const rd = state.rounds[roundIndex];
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
  const rd       = state.rounds[slagenRoundIndex];
  rd.slagen      = slagenSelected;
  rd.result      = calcResultFromSlagen(rd.gameType, slagenSelected);
  rd.callerResults = null;
  rd.scores      = calcTournScores(rd.gameType, rd.callers, slagenSelected, null);
  saveState();
  closeOverlay('slagenOverlay');
  renderAll();
}

// ══════════════════════════════════════════
//  TOURNAMENT — W/L PICKER  (per caller)
// ══════════════════════════════════════════
function openWLPicker(roundIndex) {
  wlRoundIndex = roundIndex;
  const rd     = state.rounds[roundIndex];
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
    nameEl.textContent = state.playerNames[idx];
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
  const rd         = state.rounds[wlRoundIndex];
  rd.callerResults = { ...wlResults };
  rd.slagen        = null;
  rd.result        = combinedResult(rd.callerResults, rd.callers || []);
  rd.scores        = calcTournScores(rd.gameType, rd.callers, null, rd.callerResults);
  saveState();
  closeOverlay('slagenOverlay');
  renderAll();
}

// ══════════════════════════════════════════
//  EVENT LISTENERS
// ══════════════════════════════════════════

// Backdrop tap closes sheet
document.querySelectorAll('.overlay').forEach(ov => {
  ov.addEventListener('click', e => { if (e.target === ov) closeOverlay(ov.id); });
});

// Header
document.getElementById('modeSwitchInput').addEventListener('change', e => {
  state.mode = e.target.checked ? 'tournament' : 'simple';
  applyMode(state.mode);
  saveState();
  renderAll();
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
  if (state.mode === 'tournament') openTournRoundSheet(state.rounds.length);
  else                             openRoundSheet(state.rounds.length);
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
applyMode(state.mode);
renderAll();
