#!/usr/bin/env node
/**
 * Reorders the players-table columns from one list, moving each header and its
 * matching row cell together.
 *
 * Doing it by hand is how values end up under the wrong headers: the cell count
 * still matches, so nothing looks broken. This maps every header key to the row
 * fragment that renders it, rebuilds both from ORDER, and then re-reads the two
 * files to assert they agree key by key.
 *
 *   node scripts/reorder-columns.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const ORDER = [
    // who he is
    'select', 'rank', 'web_name', 'position_name', 'team_name', 'draft_team', 'availability_factor',
    // how good he is, and how the market sees him
    'draft_score', 'vorp', 'total_points', 'points_per_game_90',
    'net_transfers_event', 'selected_by_percent',
    // the read
    'signal_rank', 'trend_pts', 'trend_role',
    // then by how much each moves a decision
    'defcon_hit_rate', 'def_contrib_per90',
    'xGI_per90', 'goals_scored_assists',
    'next_3_fdr', 'fixtures',
    // off by default, so switching one on appends instead of splitting the table
    'stability_index', 'ict_index_per90', 'dreamteam_count',
    'xDiff', 'rotation_risk', 'minutes', 'bonus_per90', 'clean_sheets_per90', 'now_cost',
    'set_piece_priority.penalty', 'set_piece_priority.corner', 'set_piece_priority.free_kick',
];

/** Row fragment -> header key. The trend map emits two cells at once. */
const FRAGMENTS = {
    'player-select': 'select', 'rank-cell': 'rank', 'name-cell': 'web_name',
    'player.position_name': 'position_name', 'player.team_name': 'team_name',
    'draftTeamClass': 'draft_team', 'formatAvailability': 'availability_factor',
    'displayedValues.draft_score': 'draft_score', 'columnTooltips.vorp': 'vorp',
    'displayedValues.total_points': 'total_points',
    'displayedValues.points_per_game_90': 'points_per_game_90',
    'transfers-cell': 'net_transfers_event', 'displayedValues.selected': 'selected_by_percent',
    'signal-cell': 'signal_rank', 'trendKeys.map': 'TREND',
    'formatDefconRate': 'defcon_hit_rate', 'def_contrib_per90)': 'def_contrib_per90',
    'formatRotation': 'rotation_risk', 'displayedValues.xGI_per90': 'xGI_per90',
    'goals_assists': 'goals_scored_assists', 'xdiff-positive': 'xDiff',
    'fdr-cell': 'next_3_fdr', 'fixtures-cell': 'fixtures',
    'displayedValues.minutes': 'minutes', 'displayedValues.bonus_per90': 'bonus_per90',
    'displayedValues.clean_sheets_per90': 'clean_sheets_per90', 'now_cost.toFixed': 'now_cost',
    'stability-cell': 'stability_index', 'displayedValues.ict_index_per90': 'ict_index_per90',
    'displayedValues.dreamteam_count': 'dreamteam_count',
    'set_piece_priority.penalty ===': 'set_piece_priority.penalty',
    'set_piece_priority.corner >': 'set_piece_priority.corner',
    'set_piece_priority.free_kick >': 'set_piece_priority.free_kick',
};

const headerKey = th => {
    const m = th.match(/data-sort="([^"]+)"/);
    if (m) return m[1];
    return th.includes('fixtures-header') ? 'fixtures' : 'select';
};

const cellKey = chunk => {
    for (const [frag, key] of Object.entries(FRAGMENTS)) if (chunk.includes(frag)) return key;
    throw new Error('unrecognised row cell: ' + chunk.trim().slice(0, 80));
};

/** Split the row template into one chunk per cell, multi-line cells included. */
function rowChunks(body) {
    const chunks = [];
    let buf = [];
    for (const line of body.split('\n')) {
        if (!line.trim()) continue;
        buf.push(line);
        const joined = buf.join('\n');
        const opens = (joined.match(/<td/g) || []).length;
        const closes = (joined.match(/<\/td>/g) || []).length;
        if ((opens && closes >= opens) || line.includes('trendKeys.map')) {
            chunks.push(joined);
            buf = [];
        }
    }
    if (buf.length) throw new Error('unterminated row cell: ' + buf.join('\n').slice(0, 80));
    return chunks;
}

function reorder() {
    const indexPath = join(ROOT, 'index.html');
    const scriptPath = join(ROOT, 'script.js');
    let html = readFileSync(indexPath, 'utf8');
    let js = readFileSync(scriptPath, 'utf8');

    const m = html.match(/(<table id="playersTable">[\s\S]*?<thead>\s*<tr>\n)([\s\S]*?)(\s*<\/tr>\s*<\/thead>)/);
    if (!m) throw new Error('players table header not found');
    const ths = m[2].match(/\s*<th\b[\s\S]*?<\/th>/g) || [];
    const byKey = Object.fromEntries(ths.map(t => [headerKey(t), t]));

    const missing = ORDER.filter(k => !(k in byKey));
    const extra = Object.keys(byKey).filter(k => !ORDER.includes(k));
    if (missing.length || extra.length) {
        throw new Error(`ORDER does not match the header. missing: ${missing} · extra: ${extra}`);
    }

    const start = m.index + m[1].length;
    html = html.slice(0, start) + ORDER.map(k => byKey[k]).join('') + html.slice(start + m[2].length);

    const i = js.indexOf('return `<tr class="player-row');
    const j = js.indexOf('</tr>`;', i);
    const row = js.slice(i, j);
    const openEnd = row.indexOf('\n') + 1;
    const cells = {};
    for (const chunk of rowChunks(row.slice(openEnd))) cells[cellKey(chunk)] = chunk;

    const out = [];
    let trendDone = false;
    for (const key of ORDER) {
        if (key === 'trend_pts' || key === 'trend_role') {
            if (!trendDone) { out.push(cells.TREND); trendDone = true; }
            continue;
        }
        if (!(key in cells)) throw new Error(`no row cell renders ${key}`);
        out.push(cells[key]);
    }

    js = js.slice(0, i) + row.slice(0, openEnd) + out.join('\n') + '\n    ' + js.slice(j);
    writeFileSync(indexPath, html);
    writeFileSync(scriptPath, js);
    return ORDER.length;
}

const n = reorder();

// Re-read from disk and check the two agree position by position.
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const js = readFileSync(join(ROOT, 'script.js'), 'utf8');
const th = html.match(/<table id="playersTable">[\s\S]*?<\/thead>/)[0];
const hKeys = (th.match(/<th\b[\s\S]*?<\/th>/g) || []).map(headerKey);
const i = js.indexOf('return `<tr class="player-row');
const rKeys = rowChunks(js.slice(js.indexOf('\n', i) + 1, js.indexOf('</tr>`;', i)))
    .flatMap(c => (cellKey(c) === 'TREND' ? ['trend_pts', 'trend_role'] : [cellKey(c)]));

const bad = hKeys.map((k, n2) => [n2, k, rKeys[n2]]).filter(([, a, b]) => a !== b);
if (bad.length || hKeys.length !== rKeys.length) {
    console.error(`MISALIGNED (${hKeys.length} headers, ${rKeys.length} cells):`, bad);
    process.exit(1);
}
console.log(`${n} columns reordered; every cell verified under its own header.`);
