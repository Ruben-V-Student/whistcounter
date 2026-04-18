import { activeGame, getRunningTotals } from './state.js';
import { getGameType } from './scoring.js';

// ══════════════════════════════════════════
//  CSV HELPERS
// ══════════════════════════════════════════
function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function rowToCSV(arr) {
  return arr.map(escapeCSV).join(',');
}

function downloadCSV(filename, rows) {
  const name = (filename || 'whist-export').trim() || 'whist-export';
  const csv  = rows.map(rowToCSV).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = name.endsWith('.csv') ? name : name + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════
//  EXPORT FORMATS
// ══════════════════════════════════════════

/**
 * Full export: round meta (game type, callers, tricks) + two columns per player
 * (points won/lost that round and running total). Footer row with grand totals.
 * Tournament mode only — manual mode has no round meta.
 */
export function exportFull(filename) {
  const game         = activeGame();
  const names        = game.playerNames;
  const rounds       = game.rounds;
  const isTournament = game.mode === 'tournament';
  const { runningPerRound, totals } = getRunningTotals();

  // Row 1: player names — placed in first of their two sub-columns, second left blank
  const hdr1 = ['Round'];
  if (isTournament) hdr1.push('Game', 'Callers', 'Tricks');
  names.forEach(n => hdr1.push(n, ''));

  // Row 2: sub-column labels
  const hdr2 = [''];
  if (isTournament) hdr2.push('', '', '');
  names.forEach(() => hdr2.push('Points', 'Total'));

  const dataRows = rounds.map((rd, r) => {
    const row = [r + 1];
    if (isTournament) {
      const gt          = getGameType(rd.gameType);
      const callerNames = (rd.callers || []).map(i => names[i]).join('+');
      const tricks      = (rd.slagen !== null && rd.slagen !== undefined) ? rd.slagen : '';
      row.push(gt ? gt.abbr : '', callerNames, tricks);
    }
    names.forEach((_, p) => {
      const delta   = rd.scores ? rd.scores[p] : 0;
      const running = runningPerRound[r][p];
      row.push((delta > 0 ? '+' : '') + delta, running);
    });
    return row;
  });

  // Footer: blank in Points sub-column, final score in Total sub-column
  const totalRow = ['Total'];
  if (isTournament) totalRow.push('', '', '');
  names.forEach((_, p) => totalRow.push('', totals[p]));

  downloadCSV(filename, [hdr1, hdr2, ...dataRows, totalRow]);
}

/**
 * Scores only: round number + each player's running total per round.
 * Names on top, grand totals on the bottom.
 */
export function exportScores(filename) {
  const game   = activeGame();
  const names  = game.playerNames;
  const rounds = game.rounds;
  const { runningPerRound, totals } = getRunningTotals();

  const hdr      = ['Round', ...names];
  const dataRows = rounds.map((rd, r) => [r + 1, ...names.map((_, p) => runningPerRound[r][p])]);

  downloadCSV(filename, [hdr, ...dataRows, ['Total', ...totals]]);
}

/**
 * Summary: player names on row 1, final scores on row 2. 4 columns × 2 rows.
 */
export function exportSummary(filename) {
  const game       = activeGame();
  const { totals } = getRunningTotals();
  downloadCSV(filename, [game.playerNames, totals]);
}
