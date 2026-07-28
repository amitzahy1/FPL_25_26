/**
 * Tests for the scouting view: watchlist persistence, signal verdicts, and the
 * per-gameweek trend series that drives the micro-charts and the match log.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadFunctions, installBrowserStubs, extractDeclaration, extractFunction } from './helpers/load-script.mjs';

/** A processed player, the shape createPlayerRowHtml receives. */
function makePlayer(over = {}) {
    return {
        id: 1, web_name: 'Test', element_type: 3, team: 1, position_name: 'MID',
        minutes: 900, draft_score: 50, points_per_game_90: 4, predicted_points_1_gw: 5,
        xDiff: 0, xGI_per90: 0.5, next_3_fdr: 3, rotation_risk: 0.9,
        availability_grade: 'available', chance_of_playing_next_round: 100, news: '',
        set_piece_priority: { penalty: 99, corner: 99, free_kick: 99 },
        ...over
    };
}

/** Per-gameweek `stats` objects as /event/{gw}/live/ returns them. */
function gwStats(over = {}) {
    return {
        total_points: 2, minutes: 90, expected_goals: '0.10', expected_assists: '0.05',
        bps: 15, bonus: 0, saves: 0, goals_scored: 0, assists: 0,
        defensive_contribution: 4, clearances_blocks_interceptions: 3, tackles: 1, recoveries: 5,
        ...over
    };
}

function load(stateOver = {}) {
    installBrowserStubs();
    const state = {
        allPlayersData: { live: { processed: [], raw: null, fixtures: null }, historical: {}, demo: {} },
        currentDataSource: 'live',
        teamsData: {},
        watchlist: new Set(),
        watchlistOnly: false,
        trendWindow: 5,
        trendGws: [],
        trendPrevGws: [],
        trendScales: {},
        draft: { ownedElementIds: new Set(), rostersByEntryId: new Map(), entryIdToTeamName: new Map() },
        ...stateOver
    };
    globalThis.state = state;
    globalThis.console = console;
    const fns = loadFunctions([
        'loadWatchlist', 'saveWatchlist',
        'signalFor', 'signalRank', 'invalidateSignals',
        'gwDefensiveContribution', 'getTrendSeries', 'summariseTrend', 'trendDelta',
        'computeTrendScales', 'fourthTrendMetric', 'fixtureForGw',
        // Two signal rules call this; without it in scope signalFor's try/catch
        // swallows a ReferenceError and every rule silently fails to match.
        'pointsConcentration',
        'trendBarsHtml', 'trendBenchmark', 'benchmarkMedian',
        'trendPlayerIndex', 'getDraftTeamForPlayer'
    ], {}, [
        // Lookup tables and caches the above close over, pulled from the real
        // source so the tests cannot drift from it.
        'WATCHLIST_KEY', 'SIGNAL_RULES', 'SIGNAL_SORT_ORDER', 'HOLD_SIGNAL',
        '_signalCache', '_trendPlayerIndex', '_trendDeltaCache',
        'gwNum', 'TREND_METRICS'
    ]);
    // Verdicts are cached by player id; every load() starts from a clean slate.
    fns.invalidateSignals();
    return { fns, state };
}

describe('watchlist persistence', () => {
    test('round-trips through localStorage', () => {
        const { fns, state } = load();
        state.watchlist = new Set([11, 22]);
        fns.saveWatchlist();
        state.watchlist = new Set();
        fns.loadWatchlist();
        assert.deepEqual([...state.watchlist].sort(), [11, 22]);
    });

    test('survives a corrupted entry instead of throwing', () => {
        const { fns, state } = load();
        localStorage.setItem('fpl_watchlist', '{not json');
        fns.loadWatchlist();
        assert.equal(state.watchlist.size, 0);
    });

    test('drops non-numeric ids rather than poisoning has() checks', () => {
        const { fns, state } = load();
        localStorage.setItem('fpl_watchlist', '[1,"2","abc",null]');
        fns.loadWatchlist();
        assert.deepEqual([...state.watchlist].sort((a, b) => a - b), [1, 2]);
    });
});

describe('signal verdicts', () => {
    test('unavailability outranks every other verdict', () => {
        const { fns } = load();
        // Also a "buy low" candidate: the injury must still win.
        const p = makePlayer({ availability_grade: 'injured', xDiff: -3, minutes: 900 });
        assert.equal(fns.signalFor(p).key, 'out');
    });

    test('over-performance on thin underlying numbers is a warning', () => {
        const { fns } = load();
        const p = makePlayer({ xDiff: 2.5, xGI_per90: 0.2, minutes: 900, next_3_fdr: 2 });
        assert.equal(fns.signalFor(p).key, 'overperf');
    });

    test('beating xG over a full sample with real volume reads as finishing, not luck', () => {
        // The distinction the single "trap" rule got wrong: a striker who buries
        // half-chances across 13 games is good at finishing, not lucky.
        const { fns } = load();
        const p = makePlayer({ xDiff: 2.5, xGI_per90: 0.55, minutes: 1200, next_3_fdr: 2 });
        assert.equal(fns.signalFor(p).key, 'clinical');
    });

    test('a surplus resting on one gameweek stays a warning even with volume', () => {
        const player = makePlayer({ id: 9, xDiff: 2.5, xGI_per90: 0.55, minutes: 1200 });
        const mk = (gw, pts) => ({ gw, stats: new Map([[9, gwStats({ total_points: pts })]]) });
        const { fns } = load({
            allPlayersData: { live: { processed: [player], raw: null, fixtures: null }, historical: {}, demo: {} },
            // 16 of 20 points came from a single gameweek.
            trendGws: [mk(6, 2), mk(7, 16), mk(8, 2)],
            trendPrevGws: [mk(3, 2), mk(4, 2), mk(5, 2)]
        });
        assert.equal(fns.signalFor(player).key, 'overperf');
    });

    test('a big negative xDiff on a regular starter is a buy-low', () => {
        const { fns } = load();
        const p = makePlayer({ xDiff: -2.4, minutes: 900 });
        const sig = fns.signalFor(p);
        assert.equal(sig.key, 'buylow');
        assert.ok(sig.why.length, 'a verdict must carry the numbers that earned it');
    });

    test('a free agent with a real score is a claim, an owned one is not', () => {
        const { fns, state } = load();
        const p = makePlayer({ id: 7, draft_score: 60, minutes: 900, xDiff: 0, next_3_fdr: 3 });
        state.allPlayersData.live.processed = [p];

        // Before the league's rosters load nothing is known to be owned, so
        // "free agent" is not a claim anyone can act on.
        assert.notEqual(fns.signalFor(p).key, 'claim');

        // Rosters landing is exactly when production calls invalidateSignals().
        state.draft.ownedElementIds.add(99);
        state.draft.rostersByEntryId.set(1, [99]);
        state.draft.entryIdToTeamName.set(1, 'Rivals');
        fns.invalidateSignals();
        assert.equal(fns.signalFor(p).key, 'claim');

        state.draft.ownedElementIds.add(7);
        fns.invalidateSignals();
        assert.notEqual(fns.signalFor(p).key, 'claim');
    });

    test('never returns without a verdict', () => {
        const { fns } = load();
        const sig = fns.signalFor(makePlayer({ draft_score: 10, minutes: 300, rotation_risk: 0.95 }));
        assert.equal(sig.key, 'hold');
        assert.ok(sig.label);
    });

    test('a thrown rule does not take the whole row down', () => {
        const { fns } = load();
        // set_piece_priority missing: the claim rule reads into it.
        const broken = makePlayer({ draft_score: 60, set_piece_priority: undefined });
        assert.doesNotThrow(() => fns.signalFor(broken));
    });

    test('actionable buckets sort ahead of the rest', () => {
        const { fns, state } = load();
        const claim = makePlayer({ id: 2, draft_score: 60 });
        state.allPlayersData.live.processed = [claim];
        const out = makePlayer({ id: 3, availability_grade: 'injured' });
        assert.ok(fns.signalRank(claim) < fns.signalRank(out));
    });
});

describe('the signal filter', () => {
    /**
     * Fills the <select> the filter reads. SIGNAL_SORT_ORDER comes back out with
     * it so the assertions compare against the real list rather than a copy that
     * can drift from it.
     */
    function withSelect() {
        const select = { innerHTML: '', value: '' };
        globalThis.document = { getElementById: id => (id === 'signalFilter' ? select : null) };
        const body = [
            extractDeclaration('SIGNAL_RULES'),
            extractDeclaration('SIGNAL_SORT_ORDER'),
            extractDeclaration('HOLD_SIGNAL'),
            extractFunction('populateSignalFilter')
        ].join('\n');
        const { populateSignalFilter, order } = new Function(
            `${body}\nreturn { populateSignalFilter, order: SIGNAL_SORT_ORDER };`
        )();
        populateSignalFilter();
        return { select, order };
    }

    const optionValues = html => [...html.matchAll(/value="([^"]*)"/g)].map(m => m[1]);

    test('offers one option per rule, plus a clear-all', () => {
        const { select, order } = withSelect();
        const values = optionValues(select.innerHTML);
        assert.equal(values[0], '', 'the first option must clear the filter');
        assert.equal(new Set(values).size, values.length, 'no duplicated option');
        assert.equal(values.length, order.length + 1,
            'a rule with no option is unreachable from the UI, which is how three quick '
            + 'filters ended up defined but unusable');
    });

    test('lists them in the order the column sorts', () => {
        const { select, order } = withSelect();
        assert.deepEqual(optionValues(select.innerHTML).filter(Boolean), order,
            'the filter and the sorted column should read top-to-bottom the same way');
    });

    test('every option is labelled in Hebrew, not by its key', () => {
        const { select } = withSelect();
        const labels = [...select.innerHTML.matchAll(/>([^<]+)</g)].map(m => m[1].trim());
        assert.ok(labels.length > 1);
        for (const label of labels) {
            assert.ok(/[֐-׿]/.test(label), `option "${label}" is not readable`);
        }
    });
});

describe('per-gameweek DEFCON', () => {
    test('prefers the API field when present', () => {
        const { fns } = load();
        assert.equal(fns.gwDefensiveContribution({ defensive_contribution: 9 }, 2), 9);
    });

    test('falls back to CBIT for defenders and adds recoveries for MID/FWD', () => {
        const { fns } = load();
        const s = { clearances_blocks_interceptions: 6, tackles: 2, recoveries: 7 };
        assert.equal(fns.gwDefensiveContribution(s, 2), 8, 'defender: CBI + tackles only');
        assert.equal(fns.gwDefensiveContribution(s, 3), 15, 'midfielder: + recoveries');
    });

    test('treats a zero contribution as zero, not as missing', () => {
        const { fns } = load();
        assert.equal(fns.gwDefensiveContribution({ defensive_contribution: 0 }, 2), 0);
    });
});

describe('trend series', () => {
    function withWindow() {
        const player = makePlayer({ id: 5 });
        const mk = (gw, over) => ({ gw, stats: new Map([[5, gwStats(over)]]) });
        return load({
            allPlayersData: { live: { processed: [player], raw: null, fixtures: null }, historical: {}, demo: {} },
            trendGws: [mk(6, { total_points: 2 }), mk(7, { total_points: 8 }), mk(8, { total_points: 5 })],
            trendPrevGws: [mk(3, { total_points: 1 }), mk(4, { total_points: 1 }), mk(5, { total_points: 1 })]
        });
    }

    test('returns one point per gameweek, oldest first', () => {
        const { fns } = withWindow();
        const series = fns.getTrendSeries(5, 'pts');
        assert.deepEqual(series.map(p => p.gw), [6, 7, 8]);
        assert.deepEqual(series.map(p => p.value), [2, 8, 5]);
    });

    test('a gameweek with no entry is marked unplayed rather than scoring zero', () => {
        const { fns, state } = withWindow();
        state.trendGws.push({ gw: 9, stats: new Map() });
        const series = fns.getTrendSeries(5, 'pts');
        assert.equal(series.at(-1).played, false);
        assert.equal(series.at(-1).value, 0);
    });

    test('sums accumulating metrics and averages rate metrics', () => {
        const { fns } = withWindow();
        const pts = fns.getTrendSeries(5, 'pts');
        assert.equal(fns.summariseTrend(pts, 'sum'), 15);
        assert.equal(fns.summariseTrend(pts, 'avg'), 5);
    });

    test('xG+xA parses the API strings instead of concatenating them', () => {
        const { fns } = withWindow();
        const series = fns.getTrendSeries(5, 'xgi');
        assert.ok(series.every(p => Math.abs(p.value - 0.15) < 1e-9), JSON.stringify(series));
    });

    test('an empty window summarises to zero, not NaN', () => {
        const { fns } = load();
        assert.equal(fns.summariseTrend([], 'avg'), 0);
    });

    test('bar scale comes from the league, and minutes are pinned to 90', () => {
        const { fns, state } = withWindow();
        fns.computeTrendScales();
        assert.equal(state.trendScales.mins, 90);
        assert.ok(state.trendScales.pts > 0);
    });

    test('the fourth trend column follows what the position is scored for', () => {
        const { fns } = load();
        assert.equal(fns.fourthTrendMetric({ element_type: 1 }), 'saves');
        // DEFCON for every outfield position: a midfielder clearing 12 CBIRT is
        // paid the same +2 as a defender, and BPS — which sat here — is a number
        // nobody is paid for at all.
        assert.equal(fns.fourthTrendMetric({ element_type: 2 }), 'dc');
        assert.equal(fns.fourthTrendMetric({ element_type: 3 }), 'dc');
        assert.equal(fns.fourthTrendMetric({ element_type: 4 }), 'dc');
    });
});

describe('match-log opponents', () => {
    test('resolves home and away from the finished fixture list', () => {
        const { fns, state } = load();
        state.teamsData = { 2: { short_name: 'ARS' } };
        state.allPlayersData.live.fixtures = [
            { event: 8, team_h: 1, team_a: 2, team_h_difficulty: 3, team_a_difficulty: 4, finished: true }
        ];
        const home = fns.fixtureForGw(1, 8);
        assert.deepEqual(home, { home: true, opponent: 'ARS', difficulty: 3 });

        state.teamsData[1] = { short_name: 'TMA' };
        const away = fns.fixtureForGw(2, 8);
        assert.deepEqual(away, { home: false, opponent: 'TMA', difficulty: 4 });
    });

    test('a blank gameweek returns null instead of inventing a fixture', () => {
        const { fns, state } = load();
        state.allPlayersData.live.fixtures = [];
        assert.equal(fns.fixtureForGw(1, 8), null);
    });
});

/* --------------------------------------------------------------------------
   The snapshot path. This is the one that runs on draft day: the new season
   has played nothing, so the committed completed-season logs are the only
   per-match history that exists.
   -------------------------------------------------------------------------- */

/** Loads the snapshot-backed half of the trend engine against a fake snapshot. */
function loadSnapshot(snapshot, processed) {
    installBrowserStubs();
    const state = {
        allPlayersData: {
            live: { processed: [], raw: null, fixtures: null },
            historical: { processed, raw: { __snapshot: snapshot }, fixtures: null },
            demo: {}
        },
        currentDataSource: 'historical',
        teamsData: {},
        watchlist: new Set(),
        trendWindow: 2,
        trendGws: [], trendPrevGws: [], trendScales: {}, trendKey: null,
        draft: { ownedElementIds: new Set(), rostersByEntryId: new Map(), entryIdToTeamName: new Map() }
    };
    globalThis.state = state;
    const fns = loadFunctions(
        ['getMatchLog', 'snapshotGameweekStats', 'getTrendSeries', 'summariseTrend',
            'trendDelta', 'trendPlayerIndex', 'computeTrendScales'],
        {},
        ['gwNum', 'TREND_METRICS', '_trendPlayerIndex', '_trendDeltaCache']
    );
    return { fns, state };
}

const LOG_FIELDS = ['gw', 'points', 'minutes', 'xgi_x100', 'defcon_hit', 'bps', 'saves',
    'defcon', 'goals', 'assists', 'bonus'];

describe('snapshot match logs', () => {
    test('decodes the flat log using the field order the file declares', () => {
        const snap = {
            logStride: 11, logFields: LOG_FIELDS,
            gwLogs: { 5: [7, 9, 90, 55, 1, 28, 0, 12, 1, 0, 3] }
        };
        const { fns } = loadSnapshot(snap, [{ id: 5, element_type: 2 }]);
        const log = fns.getMatchLog({ id: 5 });
        assert.equal(log.length, 1);
        assert.deepEqual(log[0], {
            gw: 7, points: 9, minutes: 90, xgi: 0.55, defconHit: 1,
            bps: 28, saves: 0, defcon: 12, goals: 1, assists: 0, bonus: 3
        });
    });

    test('an older short-stride snapshot still decodes rather than misaligning', () => {
        // The 5-field layout this file shipped with first. Fields it never had
        // must come back as 0, not as another gameweek's numbers.
        const snap = {
            logStride: 5, logFields: ['gw', 'points', 'minutes', 'xgi_x100', 'defcon_hit'],
            gwLogs: { 5: [1, 6, 90, 40, 0, 2, 2, 45, 10, 1] }
        };
        const { fns } = loadSnapshot(snap, [{ id: 5, element_type: 2 }]);
        const log = fns.getMatchLog({ id: 5 });
        assert.deepEqual(log.map(m => m.gw), [1, 2]);
        assert.equal(log[0].points, 6);
        assert.equal(log[0].bps, 0, 'a field the snapshot lacks reads as 0');
        assert.equal(log[1].points, 2);
    });

    test('logs are ordered oldest first regardless of file order', () => {
        const snap = {
            logStride: 11, logFields: LOG_FIELDS,
            gwLogs: { 5: [9, 2, 90, 0, 0, 10, 0, 4, 0, 0, 0, 3, 6, 90, 0, 0, 20, 0, 8, 1, 0, 1] }
        };
        const { fns } = loadSnapshot(snap, [{ id: 5, element_type: 2 }]);
        assert.deepEqual(fns.getMatchLog({ id: 5 }).map(m => m.gw), [3, 9]);
    });
});

describe('snapshot-backed trends', () => {
    const snap = {
        logStride: 11, logFields: LOG_FIELDS,
        gwLogs: {
            // gw1..gw4, points 2,3,8,10 — a clear upward trend.
            5: [1, 2, 90, 10, 0, 12, 0, 3, 0, 0, 0,
                2, 3, 90, 20, 0, 14, 0, 4, 0, 0, 0,
                3, 8, 90, 60, 1, 30, 0, 11, 1, 0, 1,
                4, 10, 90, 80, 1, 34, 0, 13, 1, 1, 2]
        }
    };
    const players = [{ id: 5, element_type: 3 }];

    test('reshapes the logs into one stats map per gameweek', () => {
        const { fns } = loadSnapshot(snap, players);
        const gws = fns.snapshotGameweekStats();
        assert.deepEqual(gws.map(g => g.gw), [1, 2, 3, 4]);
        const g3 = gws[2].stats.get(5);
        assert.equal(g3.total_points, 8);
        assert.equal(g3.bps, 30);
        // xGI is stored combined; the halves must add back to it exactly.
        assert.equal(g3.expected_goals + g3.expected_assists, 0.6);
    });

    test('a player absent from a gameweek is missing from that map, not zeroed', () => {
        const { fns } = loadSnapshot(snap, [...players, { id: 9, element_type: 3 }]);
        const gws = fns.snapshotGameweekStats();
        assert.equal(gws[0].stats.has(9), false);
    });

    test('the delta compares the recent window against the one before it', () => {
        const { fns, state } = loadSnapshot(snap, players);
        const all = fns.snapshotGameweekStats();
        state.trendPrevGws = all.slice(0, 2);   // gw1-2: 2 + 3 = 5 points
        state.trendGws = all.slice(2);          // gw3-4: 8 + 10 = 18 points
        state.trendKey = 'historical:1,2,3,4';
        assert.equal(fns.trendDelta({ id: 5 }, 'pts'), 13);
    });

    test('a player with no history in either window has no trend to rank', () => {
        const { fns, state } = loadSnapshot(snap, [...players, { id: 9, element_type: 3 }]);
        const all = fns.snapshotGameweekStats();
        state.trendPrevGws = all.slice(0, 2);
        state.trendGws = all.slice(2);
        state.trendKey = 'historical:1,2,3,4';
        // null, not 0 — the sort pushes "no data" to the bottom either way it is
        // sorted, while a real 0 delta belongs in the middle.
        assert.equal(fns.trendDelta({ id: 9 }, 'pts'), null);
    });

    test('the delta cache is keyed on the window, so changing it recomputes', () => {
        const { fns, state } = loadSnapshot(snap, players);
        const all = fns.snapshotGameweekStats();
        state.trendPrevGws = all.slice(0, 2);
        state.trendGws = all.slice(2);
        state.trendKey = 'historical:1,2,3,4';
        assert.equal(fns.trendDelta({ id: 5 }, 'pts'), 13);

        state.trendPrevGws = all.slice(1, 2);   // gw2: 3
        state.trendGws = all.slice(3);          // gw4: 10
        state.trendKey = 'historical:2,4';
        assert.equal(fns.trendDelta({ id: 5 }, 'pts'), 7);
    });
});
