/**
 * Smoke tests for the row renderers. These run the same template code the
 * browser runs, so a ReferenceError or a column-count drift fails here instead
 * of silently producing a broken table.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadFunctions, installBrowserStubs, REPO_ROOT } from './helpers/load-script.mjs';

function makePlayer(over = {}) {
    return {
        id: 1, rank: 7, web_name: 'Test', element_type: 3, team: 1, position_name: 'MID',
        team_name: 'Team A', minutes: 900, draft_score: 55.5, vorp: 1.2, replacement_score: 3,
        defcon_hit_rate: 40, rotation_risk: 0.9, availability_grade: 'available',
        availability_factor: 1, chance_of_playing_next_round: 100, news: '',
        stability_index: 60, predicted_points_1_gw: 5.4, next_3_fdr: 2.3, next_3_fdr_grade: 'easy',
        now_cost: 75, total_points: 90, points_per_game_90: 4.2, selected_by_percent: '12.5',
        dreamteam_count: 1, net_transfers_event: 1500, def_contrib_per90: 5.5,
        goals_scored: 4, assists: 6, xGI_per90: 0.52, xDiff: -1.8, ict_index_per90: 9.1,
        bonus_per90: 0.4, clean_sheets_per90: 0.2,
        set_piece_priority: { penalty: 1, corner: 2, free_kick: 99 },
        ...over
    };
}

function gwStats(over = {}) {
    return {
        total_points: 6, minutes: 90, expected_goals: '0.30', expected_assists: '0.20',
        bps: 24, bonus: 1, saves: 0, goals_scored: 1, assists: 0,
        defensive_contribution: 5, clearances_blocks_interceptions: 3, tackles: 2, recoveries: 4,
        ...over
    };
}

function load(players, over = {}) {
    installBrowserStubs();
    const state = {
        allPlayersData: {
            live: { processed: players, raw: null, fixtures: [
                { event: 8, team_h: 1, team_a: 2, team_h_difficulty: 2, team_a_difficulty: 4, finished: true }
            ] },
            historical: {}, demo: {}
        },
        currentDataSource: 'live',
        teamsData: { 1: { short_name: 'TMA' }, 2: { short_name: 'ARS' } },
        displayedData: players,
        percentileBase: null,
        watchlist: new Set(),
        watchlistOnly: false,
        rowMode: 'trend',
        trendWindow: 3,
        trendKey: 'live:3:8',
        trendGws: [6, 7, 8].map(gw => ({ gw, stats: new Map(players.map(p => [p.id, gwStats()])) })),
        trendPrevGws: [3, 4, 5].map(gw => ({ gw, stats: new Map(players.map(p => [p.id, gwStats({ total_points: 2 })])) })),
        trendScales: { pts: 12, xgi: 0.8, mins: 90, dc: 10, bps: 30, saves: 4 },
        openRowId: null,
        selectedForComparison: new Set(),
        draft: { ownedElementIds: new Set(), rostersByEntryId: new Map(), entryIdToTeamName: new Map() },
        ...over
    };
    globalThis.state = state;
    globalThis.config = { columnTooltips: {} };
    // Presentation helpers the row leans on; the row template is what is under
    // test here, not their formatting.
    globalThis.generatePlayerIcons = () => ({ icons: '' });
    globalThis.generateFixturesHTML = () => '<span class="fixture">ARS(H)</span>';
    globalThis.formatVorp = v => String(v ?? '-');
    globalThis.formatDefconRate = v => String(v ?? '-');
    globalThis.formatRotation = v => String(v ?? '-');
    globalThis.escapeHtml = String;

    const fns = loadFunctions([
        'createPlayerRowHtml', 'playerDetailRowHtml', 'trendCellHtml', 'buildPercentileBase',
        'getPercentileClass', 'signalFor', 'signalRank', 'invalidateSignals',
        'getTrendSeries', 'summariseTrend', 'trendDelta', 'gwDefensiveContribution',
        'fourthTrendMetric', 'fixtureForGw', 'getDraftTeamForPlayer', 'trendPlayerIndex',
        'pointsConcentration',
        'miniSparkHtml',
        'trendBarsHtml', 'roleTrend', 'trendBenchmark', 'benchmarkMedian',
        // the three stat boxes in the expanded row
        'boxAttack', 'boxDefence', 'boxValue'
    ], {}, [
        'WATCHLIST_KEY', 'TREND_BAR_ROW_LIMIT', 'SIGNAL_RULES', 'SIGNAL_SORT_ORDER',
        'HOLD_SIGNAL', '_signalCache', '_trendPlayerIndex', '_trendDeltaCache',
        'BENCH_TOP_N', 'BENCH_MIN_MINUTES', '_trendBenchCache', 'POSITION_LABELS',
        'gwNum', 'TREND_METRICS', 'ROLE_TREND',
        // arrow-function consts, so they load as declarations rather than names
        'num1', 'statLine', 'fmt', 'pct'
    ]);
    fns.invalidateSignals();
    return { fns, state };
}

/** Count top-level <td> in a single row's HTML. */
function countCells(html) {
    return (html.match(/<td\b/g) || []).length;
}

describe('player row renders', () => {
    test('produces one cell per header in index.html', () => {
        const players = [makePlayer(), makePlayer({ id: 2, rank: 8, web_name: 'Other' })];
        const { fns, state } = load(players);
        state.percentileBase = fns.buildPercentileBase(players);

        const html = fns.createPlayerRowHtml(players[0], 0);

        const indexHtml = readFileSync(join(REPO_ROOT, 'index.html'), 'utf8');
        const thead = indexHtml.match(/<table id="playersTable">[\s\S]*?<\/thead>/)[0];
        const headers = (thead.match(/<th\b/g) || []).length;

        assert.equal(countCells(html), headers,
            'a row with a different cell count than the header shifts every column');
    });

    test('shows FPL Draft\'s own ranking, and only that one', () => {
        // There used to be two columns called "דירוג": this app's own place-by-
        // internal-score, and FPL Draft's published pre-draft rank. Two rankings
        // side by side under near-identical names was unreadable, and the
        // internal one was derived from draft_score — the composite the value
        // index exists to replace. Only the external ranking survives.
        const players = [makePlayer({ rank: 42, draft_rank: 7 })];
        const { fns, state } = load(players);
        state.percentileBase = fns.buildPercentileBase(players);
        const html = fns.createPlayerRowHtml(players[0], 0);
        assert.match(html, /class="rank-badge rank-elite">#7</, 'the FPL draft rank is shown');
        assert.doesNotMatch(html, /class="rank-cell"/, 'the internal rank column is gone');
    });

    test('an unranked player says so rather than borrowing a number', () => {
        const players = [makePlayer({ draft_rank: null })];
        const { fns, state } = load(players);
        state.percentileBase = fns.buildPercentileBase(players);
        const html = fns.createPlayerRowHtml(players[0], 0);
        assert.match(html, /class="rank-none"/,
            'academy and departed players have no FPL draft rank at all');
    });

    test('marks watched players and carries a verdict', () => {
        const players = [makePlayer({ xDiff: -2.5 })];
        const { fns, state } = load(players);
        state.watchlist.add(1);
        state.percentileBase = fns.buildPercentileBase(players);
        const html = fns.createPlayerRowHtml(players[0], 0);
        assert.match(html, /watch-star is-on/);
        assert.match(html, /signal-badge/);
    });

    test('survives a player with null draft metrics', () => {
        const players = [makePlayer({ vorp: null, defcon_hit_rate: null, rotation_risk: null, stability_index: null })];
        const { fns, state } = load(players);
        state.percentileBase = fns.buildPercentileBase(players);
        assert.doesNotThrow(() => fns.createPlayerRowHtml(players[0], 0));
    });

    test('renders without a precomputed percentile base', () => {
        const players = [makePlayer()];
        const { fns } = load(players);
        // percentileBase stays null: the row must fall back, not throw.
        assert.doesNotThrow(() => fns.createPlayerRowHtml(players[0], 0));
    });

    test('drops the bars but keeps the number past the row limit', () => {
        const players = [makePlayer()];
        const { fns, state } = load(players);
        state.percentileBase = fns.buildPercentileBase(players);
        const deep = fns.createPlayerRowHtml(players[0], 999);
        assert.ok(!deep.includes('trend-bars'), 'no micro-charts this far down the table');
        assert.match(deep, /trend-value/, 'the window figure still shows');
    });

    test('the cell prints each gameweek and their total, and nothing it cannot explain', () => {
        const players = [makePlayer()];
        const { fns } = load(players);
        const cell = fns.trendCellHtml(players[0], 'pts', 0);
        assert.match(cell, /<b>6<\/b>/, 'each bar carries its own gameweek figure');
        assert.match(cell, /trend-value">18</, '3 gameweeks of 6 points');
        // A delta against a window that is not on screen cannot be read, so the
        // cell must not print one.
        assert.ok(!cell.includes('trend-delta'), 'no unexplainable change chip');
        assert.ok(!cell.includes('סה״כ'), 'no unit word anywhere on this page');
        assert.match(cell, /title="18 ב-3/, 'both windows are named in the tooltip');
    });

    test('trend cells wait for data instead of rendering zeros', () => {
        const players = [makePlayer()];
        const { fns } = load(players, { trendGws: [], trendPrevGws: [] });
        assert.match(fns.trendCellHtml(players[0], 'pts', 0), /trend-empty/);
    });
});

describe('expanded match log', () => {
    test('lists one row per gameweek with the opponent resolved', () => {
        const players = [makePlayer()];
        const { fns } = load(players);
        const html = fns.playerDetailRowHtml(players[0], 35);
        assert.equal((html.match(/<tr\b/g) || []).length - 1, 3 + 1,
            '3 gameweeks plus the header row');
        assert.match(html, /ARS/, 'the opponent comes from the finished fixture list');
        assert.match(html, /detail-row/);
    });

    test('says so when a player did not feature', () => {
        const players = [makePlayer()];
        const { fns, state } = load(players);
        state.trendGws[1] = { gw: 7, stats: new Map() };
        const html = fns.playerDetailRowHtml(players[0], 35);
        assert.match(html, /לא שיחק/);
    });

    test('spans the full width so the layout does not break', () => {
        const players = [makePlayer()];
        const { fns } = load(players);
        assert.match(fns.playerDetailRowHtml(players[0], 35), /colspan="35"/);
    });

    test('a goalkeeper is judged on saves, a defender on DEFCON', () => {
        const gk = makePlayer({ id: 3, element_type: 1 });
        const def = makePlayer({ id: 4, element_type: 2 });
        const { fns } = load([gk, def]);
        assert.match(fns.playerDetailRowHtml(gk, 35), /הצלות/);
        assert.match(fns.playerDetailRowHtml(def, 35), />DC</);
    });
});

describe('draft-board sparkline', () => {
    test('renders one bar per gameweek in the window', () => {
        const players = [makePlayer()];
        const { fns } = load(players);
        const html = fns.miniSparkHtml(1, 'pts');
        assert.equal((html.match(/<i\b/g) || []).length, 3);
    });

    test('renders nothing before the window has loaded', () => {
        const players = [makePlayer()];
        const { fns } = load(players, { trendGws: [], trendPrevGws: [] });
        assert.equal(fns.miniSparkHtml(1, 'pts'), '');
    });
});

describe('sorting the trend column', () => {
    /**
     * The chain had two branches testing the same sort key, so the second was
     * unreachable: clicking "נקודות לפי מחזור" ordered by movement against the
     * previous window instead of by the total printed in the cell.
     */
    test('exactly one branch handles each computed sort key', () => {
        const src = readFileSync(join(REPO_ROOT, 'script.js'), 'utf8');
        for (const key of ['trend_pts', 'signal_rank']) {
            // Only `if (...)` conditions count as branches; the same comparison
            // also appears in a ternary inside a branch body.
            const branches = (src.match(new RegExp(`if \\(state\\.sortKey === '${key}'`, 'g')) || []).length;
            assert.equal(branches, 1,
                `${key} is tested ${branches} times in the sort chain; only the first can ever run`);
        }
    });

    test('the column sorts by the figure the cell prints', () => {
        const src = readFileSync(join(REPO_ROOT, 'script.js'), 'utf8');
        const i = src.indexOf("state.sortKey === 'trend_pts'");
        const branch = src.slice(i, i + 600);
        assert.ok(branch.includes('summariseTrend'), 'sorts by the window total');
        assert.ok(!branch.includes('trendDelta'), 'not by a change the cell no longer shows');
    });
});

describe('expanded row states its time spans', () => {
    test('actual G+A sits with the expected figure it should be read against', () => {
        const players = [makePlayer()];
        const { fns } = load(players);
        const html = fns.playerDetailRowHtml(players[0], 35);
        const ga = html.indexOf('>G+A<');
        const xgi = html.indexOf('>xG+xA<');
        assert.ok(ga > 0 && xgi > 0, 'both rows are present');
        assert.ok(ga < xgi, 'G+A comes first, so the pair reads together');
    });

    test('the season boxes and the gameweek window each name their span', () => {
        const players = [makePlayer()];
        const { fns } = load(players);
        const html = fns.playerDetailRowHtml(players[0], 35);
        assert.match(html, /כל העונה עד כה/, 'the season-to-date boxes say so');
        assert.match(html, /המחזורים האחרונים/, 'the window says so');
        // 3065 season minutes beside a 90-minute average with neither labelled was
        // the reason this was unreadable.
        assert.match(html, /10 משחקים · 900 דקות/);
    });

    test('no unexplainable change line survives in the summary', () => {
        const players = [makePlayer()];
        const { fns } = load(players);
        const html = fns.playerDetailRowHtml(players[0], 35);
        assert.ok(!html.includes('קודם'), 'no "previously N" against an off-screen window');
        assert.ok(!html.includes('ללא שינוי'), 'no "no change" line');
    });
});
