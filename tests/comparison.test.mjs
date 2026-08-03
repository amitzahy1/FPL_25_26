/**
 * The comparison page is where a pick gets made, so the claims it prints have to
 * be the ones the numbers support: the right spokes for the positions on screen,
 * a bar that says which season it came from, a row dropped rather than filled
 * with zeroes, and a bottom line that names the short-horizon answer when it
 * disagrees with the season one.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractFunction, extractDeclaration } from './helpers/load-script.mjs';

const FUNCTIONS = [
    // benchmarks
    'benchmarkMedian', 'benchMinMinutes', 'benchmarkFrom', 'resolveBenchmark',
    'getCompletedGWCount',
    // radar
    'axisBenchmark', 'radarValue', 'radarAxesFor', 'compareRadarConfig',
    'compareChartPlayers', 'compareColor', 'fadeHex', 'poolPercentile',
    'isAvailableToDraft',
    // trend
    'compareTrendConfig', 'compareSeries', 'compareSpanGws', 'compareAllGameweeks',
    'compareSpanNote', 'getTrendSeries', 'trendPlayerIndex',
    'gwDefensiveContribution', 'trendBenchmark', 'chartAxis', 'ltrTick',
    // table + verdict
    'comparisonRowsFor', 'compareVerdict', 'compareRankLabel', 'compareSections',
    'rowStanding', 'compareToneColor', 'rowSpread', 'isTightRow', 'compareLeaderboard',
    'seasonPointsPerApp', 'appearancesOf', 'compositeOf', 'compositeScore',
    'partBenchmark', 'partBenchmarkInfo', 'defconRateFor', 'windowStats',
    'dropOffFor', 'compareState'
];

const DEPS = [
    'BENCH_TOP_N', 'BENCH_MIN_MINUTES', '_partBenchCache', '_axisBenchCache',
    '_compositeCache', '_trendBenchCache', '_windowStatsCache', '_trendPlayerIndex',
    '_dropOff', '_compareSections', 'COMPOSITE_PARTS', 'COMPOSITE_CAP', 'RADAR_MAX_AXES',
    'COMPARE_CHART_LIMIT', 'COMPARE_SPANS', 'TREND_METRICS', 'DEFCON_THRESHOLD',
    'CHART_TOOLTIP', 'CHART_LINE_PALETTE', '_compareGwCache', 'COMPARE_TIGHT_SPREAD',
    'gwNum', 'num1'
];

/**
 * RADAR_AXES, COMPARE_SECTIONS and BOARD_COLS all have to come back out — the
 * registries are what the tests are about — so this builds the scope by hand
 * rather than going through loadFunctions().
 */
function load(players, over = {}) {
    // Two distinct five-gameweek windows, so a span that asks for more than the
    // momentum window has somewhere to get it from.
    const gws = [34, 35, 36, 37, 38];
    const prevGws = [29, 30, 31, 32, 33];
    const gwStats = (pts = 5) => ({
        total_points: pts, minutes: 90, goals_scored: 1, assists: 0,
        expected_goals: 0.4, expected_assists: 0.2, bps: 24, bonus: 1, saves: 0,
        clearances_blocks_interceptions: 4, tackles: 3, recoveries: 5
    });

    globalThis.state = {
        allPlayersData: {
            live: { processed: players, raw: null },
            historical: { processed: null },
            demo: {}
        },
        currentDataSource: 'live',
        trendWindow: 5,
        trendKey: 'live:5:38',
        trendGws: gws.map(gw => ({ gw, stats: new Map(players.map(p => [p.id, gwStats()])) })),
        trendPrevGws: prevGws.map(gw => ({ gw, stats: new Map(players.map(p => [p.id, gwStats(3)])) })),
        draft: { ownedElementIds: new Set(), draftHasHappened: false },
        ...over
    };
    globalThis.signalFor = () => ({ key: 'hold', label: 'ניטרלי', tone: 'muted', blurb: 'אין ממצא', why: [] });
    globalThis.projectedPointsOf = () => null;

    const body = [
        ...DEPS.map(n => extractDeclaration(n)),
        ...FUNCTIONS.map(n => extractFunction(n)),
        extractDeclaration('RADAR_AXES'),
        extractDeclaration('BOARD_COLS')
    ].join('\n');
    return new Function(
        `${body}\nreturn { ${FUNCTIONS.join(', ')}, RADAR_AXES };`
    )();
}

/** A player good enough to clear every minutes floor and benchmark filter. */
function player(over = {}) {
    return {
        id: 1, code: 1, web_name: 'Test', first_name: 'Test', second_name: 'Player',
        team: 1, element_type: 3, position_name: 'MID',
        minutes: 2700, appearances: 30, starts: 30, total_points: 150,
        points_per_game: 5, goals_scored: 10, assists: 8,
        expected_goals_per_90: 0.35, expected_assists_per_90: 0.25,
        xGI_per90: 0.6, def_contrib_per90: 8, clean_sheets_per90: 0.3,
        saves_per_90: 0, bonus_per90: 0.4, ict_index_per90: 9, bps: 700,
        dreamteam_count: 2, xDiff: 1, selected_by_percent: 12, now_cost: 8,
        next_3_fdr: 2.8, next_5_fdr: 3, rotation_risk: 1, availability_factor: 1,
        defcon_hit_rate: 40, goals_conceded_per90: 1.1,
        ...over
    };
}

/** Enough bodies at a position that benchmarkMedian has five values to chew on. */
function squad(count, over = {}) {
    return Array.from({ length: count }, (_, i) => player({
        id: 100 + i, code: 100 + i, web_name: `P${i}`,
        total_points: 100 + i, points_per_game: 4 + i * 0.1,
        ...over
    }));
}

describe('the radar spokes', () => {
    test('only draws a spoke every compared position can be measured on', () => {
        const mids = squad(8);
        const keepers = squad(8, { position_name: 'GKP', element_type: 1, saves_per_90: 3 })
            .map((p, i) => ({ ...p, id: 200 + i, code: 200 + i }));
        const cmp = load([...mids, ...keepers]);

        const midAxes = cmp.radarAxesFor([mids[0], mids[1]]).map(a => a.key);
        assert.ok(midAxes.includes('shooting'), 'a midfielder is scored for xG');
        assert.ok(!midAxes.includes('saves'), 'a midfielder is not scored for saves');

        const gkpAxes = cmp.radarAxesFor([keepers[0], keepers[1]]).map(a => a.key);
        assert.ok(gkpAxes.includes('saves'), 'a keeper is');
        assert.ok(!gkpAxes.includes('shooting'), 'and is not scored for xG');

        // Mixed: only what both share survives, rather than scoring somebody zero
        // on a measure he does not play in.
        const mixed = cmp.radarAxesFor([mids[0], keepers[0]]).map(a => a.key);
        assert.ok(!mixed.includes('saves') && !mixed.includes('shooting'));
        assert.ok(mixed.includes('output') && mixed.includes('minutes'));
    });

    test('never draws more spokes than fit', () => {
        const cmp = load(squad(10, { position_name: 'DEF', element_type: 2 }));
        const axes = cmp.radarAxesFor([player({ position_name: 'DEF', element_type: 2 })]);
        assert.ok(axes.length <= 8, `got ${axes.length} spokes`);
    });

    test('a spoke is a percentage of the elite bar, capped at 150', () => {
        // Nine ordinary midfielders plus one who is three times better than any
        // of them: uncapped he would draw at ~300%, off the chart.
        const pool = squad(9, { expected_goals_per_90: 0.2 });
        const freak = player({ id: 999, code: 999, expected_goals_per_90: 3 });
        const cmp = load([...pool, freak]);
        const axis = cmp.RADAR_AXES.find(a => a.key === 'shooting');

        assert.equal(Math.round(cmp.radarValue(pool[0], axis)), 100,
            'the median of the elite bar sits exactly on 100');
        assert.equal(cmp.radarValue(freak, axis), 150, 'and nobody draws past the cap');
    });

    test('a measure with no elite bar has no spoke rather than a zero', () => {
        // Three players is below benchmarkMedian's five-value floor, so there is
        // no bar at all.
        const cmp = load(squad(3));
        const axis = cmp.RADAR_AXES.find(a => a.key === 'shooting');
        assert.equal(cmp.radarValue(player(), axis), null);
        assert.deepEqual(cmp.radarAxesFor([player()]), []);
    });

    test('the config carries one dataset per player and one label per spoke', () => {
        const pool = squad(8);
        const cmp = load(pool);
        const config = cmp.compareRadarConfig([pool[0], pool[1], pool[2]]);
        assert.equal(config.type, 'radar');
        assert.equal(config.data.datasets.length, 3);
        assert.equal(config.data.labels.length, config.data.datasets[0].data.length);
        // Three or fewer are filled; more and the overlaps stop being readable.
        assert.equal(config.data.datasets[0].fill, true);
        assert.equal(config.options.scales.r.suggestedMax, 150);
    });

    test('the spokes are named after the metrics, not after invented categories', () => {
        const cmp = load(squad(8));
        const labels = cmp.RADAR_AXES.map(a => a.label);
        for (const real of ['xG/90', 'xA/90', 'DEFCON/90', 'ICT/90', 'CS/90', 'G+A/90']) {
            assert.ok(labels.includes(real), `${real} should be on a spoke`);
        }
        // Every spoke still carries its definition for the hover.
        for (const axis of cmp.RADAR_AXES) {
            assert.ok(axis.title && axis.title.length > 10, `${axis.key} needs a definition`);
        }
    });

    test('the radar names its colours', () => {
        const pool = squad(8);
        const cmp = load(pool);
        const config = cmp.compareRadarConfig([pool[0], pool[1], pool[2]]);
        assert.equal(config.options.plugins.legend.display, true,
            'three translucent polygons and no legend is a puzzle');
        assert.deepEqual(config.data.datasets.map(d => d.label),
            [pool[0].web_name, pool[1].web_name, pool[2].web_name]);
    });

    test('caps the polygons at six and stops filling them past three', () => {
        const pool = squad(12);
        const cmp = load(pool);
        const config = cmp.compareRadarConfig(pool.slice(0, 9));
        assert.equal(config.data.datasets.length, 6, 'six polygons, not nine');
        assert.equal(config.data.datasets[0].fill, false, 'outline only');
    });

    test('no radar at all when the players share fewer than three measures', () => {
        // One keeper and one midfielder share output/minutes/bonus/impact — but
        // strip the bar off two of those and the shape stops being drawable.
        const cmp = load(squad(8));
        assert.equal(cmp.compareRadarConfig([player({ position_name: 'GKP', element_type: 1 })]), null,
            'a position with no pool has no bar, so no radar');
    });
});

describe('the early-season benchmark', () => {
    test('the minutes floor scales with how much football has been played', () => {
        const cmp = load(squad(8));
        assert.equal(cmp.benchMinMinutes(), 270, 'no gameweek data means the full bar');

        // Two gameweeks finished: 270 is unreachable, so the floor comes down.
        globalThis.state.allPlayersData.live.raw = {
            events: [{ finished: true }, { finished: true }]
        };
        assert.equal(cmp.benchMinMinutes(), 120);

        globalThis.state.allPlayersData.live.raw = {
            events: Array.from({ length: 6 }, () => ({ finished: true }))
        };
        assert.equal(cmp.benchMinMinutes(), 270, 'and back to the full bar once it is reachable');
    });

    test('falls back to last season when this one cannot produce a bar', () => {
        // Three players on screen is under the five-value floor; last season's
        // snapshot has plenty.
        const thin = squad(3);
        const full = squad(9, { points_per_game: 6 }).map((p, i) => ({ ...p, id: 500 + i }));
        const cmp = load(thin, { allPlayersData: {
            live: { processed: thin, raw: null },
            historical: { processed: full },
            demo: {}
        } });

        const bench = cmp.resolveBenchmark(p => p.points_per_game, 'MID');
        assert.equal(bench.from, 'lastSeason');
        assert.ok(bench.value > 0);
    });

    test('does not fall back when this season can answer for itself', () => {
        const cmp = load(squad(9), { allPlayersData: {
            live: { processed: squad(9), raw: null },
            historical: { processed: squad(9, { points_per_game: 99 }) },
            demo: {}
        } });
        const bench = cmp.resolveBenchmark(p => p.points_per_game, 'MID');
        assert.equal(bench.from, 'season');
        assert.ok(bench.value < 50, 'last season is not consulted at all');
    });

    test('reports no bar rather than a made-up one', () => {
        const cmp = load(squad(2));
        assert.deepEqual(cmp.resolveBenchmark(p => p.points_per_game, 'MID'),
            { value: null, from: null });
        assert.deepEqual(cmp.resolveBenchmark(p => p.points_per_game, ''),
            { value: null, from: null });
    });
});

describe('the metric table', () => {
    test('drops a row nobody has a figure for', () => {
        // net_transfers_event does not exist in the committed snapshot at all,
        // which is exactly the case that used to print a row of zeroes.
        const pool = squad(8).map(p => ({ ...p, net_transfers_event: undefined }));
        const cmp = load(pool);
        const sections = cmp.comparisonRowsFor([pool[0], pool[1]]);
        const market = sections.find(s => s.key === 'market');
        assert.ok(market, 'the section itself survives on its other rows');
        assert.ok(!market.rows.some(r => r.key === 'transfers'),
            'but the row with nothing in it is gone');
    });

    test('drops a row where every figure is zero', () => {
        // preprocessPlayerData turns a missing transfers field into 0, so a null
        // check alone still printed "0 · 0 · 0" and implied it was measured.
        // Saves for three midfielders is the same shape.
        const pool = squad(8).map(p => ({ ...p, net_transfers_event: 0, saves_per_90: 0 }));
        const cmp = load(pool);
        const sections = cmp.comparisonRowsFor([pool[0], pool[1]]);
        const rowKeys = sections.flatMap(s => s.rows.map(r => r.key));
        assert.ok(!rowKeys.includes('transfers'), 'all-zero transfers row is gone');
        assert.ok(!rowKeys.includes('saves90'), 'and so is a keeper metric on midfielders');
    });

    test('keeps a row where only one player is at zero', () => {
        // That is a comparison, not an absence.
        const pool = squad(8);
        pool[0].dreamteam_count = 0;
        pool[1].dreamteam_count = 3;
        const cmp = load(pool);
        const output = cmp.comparisonRowsFor([pool[0], pool[1]]).find(s => s.key === 'output');
        const row = output.rows.find(r => r.key === 'dreamteam');
        assert.deepEqual(row.values, [0, 3]);
    });

    test('keeps a row one player can answer', () => {
        const pool = squad(8);
        pool[0].net_transfers_event = 4200;
        pool[1].net_transfers_event = undefined;
        const cmp = load(pool);
        const market = cmp.comparisonRowsFor([pool[0], pool[1]]).find(s => s.key === 'market');
        const row = market.rows.find(r => r.key === 'transfers');
        assert.ok(row, 'one real figure is enough to be worth showing');
        assert.deepEqual(row.values, [4200, null]);
    });

    test('drops a whole section when none of its rows can be read', () => {
        const bare = [
            { id: 1, web_name: 'A', position_name: 'MID', element_type: 3, minutes: 0 },
            { id: 2, web_name: 'B', position_name: 'MID', element_type: 3, minutes: 0 }
        ];
        const cmp = load(bare);
        const keys = cmp.comparisonRowsFor(bare).map(s => s.key);
        assert.ok(!keys.includes('underlying'),
            'no xG on either of them means no underlying section');
    });

    test('every row states its own definition', () => {
        const cmp = load(squad(8));
        for (const section of cmp.compareSections()) {
            for (const row of section.rows) {
                assert.ok(row.title && row.title.length > 8,
                    `${section.key}.${row.key} needs a definition, not a label`);
                assert.equal(typeof row.read, 'function');
                assert.equal(typeof row.fmt, 'function');
            }
        }
    });

    test('a cell knows where it stands in the row', () => {
        const cmp = load(squad(8));
        assert.equal(cmp.compareRankLabel([9, 5, 7], 9, false), '1/3');
        assert.equal(cmp.compareRankLabel([9, 5, 7], 5, false), '3/3');
        // Ascending: low is the win.
        assert.equal(cmp.compareRankLabel([9, 5, 7], 5, true), '1/3');
        // Nulls do not count toward the denominator, and a lone figure has no
        // standing to state.
        assert.equal(cmp.compareRankLabel([9, null, 7], 7, false), '2/2');
        assert.equal(cmp.compareRankLabel([9, null], null, false), '');
        assert.equal(cmp.compareRankLabel([9], 9, false), '');
    });
});

describe('the bottom line', () => {
    test('names the leader and the gap to the runner-up', () => {
        const pool = squad(8);
        const strong = player({ id: 900, code: 900, web_name: 'Strong', points_per_game: 9 });
        const weak = player({ id: 901, code: 901, web_name: 'Weak', points_per_game: 2 });
        const cmp = load([...pool, strong, weak]);

        const verdict = cmp.compareVerdict([weak, strong]);
        assert.equal(verdict.lead.player.web_name, 'Strong');
        assert.equal(verdict.runnerUp.player.web_name, 'Weak');
        assert.ok(verdict.gap > 0);
    });

    test('says so when the five-gameweek answer is a different player', () => {
        const pool = squad(8);
        const seasonPick = player({ id: 900, code: 900, web_name: 'Season', points_per_game: 9 });
        const shortPick = player({ id: 901, code: 901, web_name: 'Short', points_per_game: 4 });
        const cmp = load([...pool, seasonPick, shortPick]);
        // The horizons disagree: the weaker season player has the better run.
        globalThis.projectedPointsOf = p => (p.id === 901 ? 34 : 21);

        const verdict = cmp.compareVerdict([seasonPick, shortPick]);
        assert.equal(verdict.lead.player.web_name, 'Season');
        assert.equal(verdict.shortLead.player.web_name, 'Short');
        assert.equal(verdict.shortDiffers, true);
    });

    test('stays quiet about the horizon when both agree', () => {
        const pool = squad(8);
        const best = player({ id: 900, code: 900, web_name: 'Best', points_per_game: 9 });
        const rest = player({ id: 901, code: 901, web_name: 'Rest', points_per_game: 3 });
        const cmp = load([...pool, best, rest]);
        globalThis.projectedPointsOf = p => (p.id === 900 ? 40 : 20);
        assert.equal(cmp.compareVerdict([best, rest]).shortDiffers, false);
    });

    test('names an unavailable player separately from the ranking', () => {
        const pool = squad(8);
        const hurt = player({ id: 902, code: 902, web_name: 'Hurt' });
        const cmp = load([...pool, hurt]);
        globalThis.signalFor = p => (p.id === 902
            ? { key: 'out', label: 'לא זמין', tone: 'bad', blurb: 'פצוע', why: [] }
            : { key: 'hold', label: 'ניטרלי', tone: 'muted', blurb: 'אין ממצא', why: [] });

        const verdict = cmp.compareVerdict([pool[0], hurt]);
        assert.equal(verdict.warnings.length, 1);
        assert.equal(verdict.warnings[0].player.web_name, 'Hurt');
    });

    test('reports no leader rather than a false one when nothing can be scored', () => {
        const bare = [
            { id: 1, web_name: 'A', position_name: 'MID', element_type: 3, minutes: 0 },
            { id: 2, web_name: 'B', position_name: 'MID', element_type: 3, minutes: 0 }
        ];
        const cmp = load(bare);
        const verdict = cmp.compareVerdict(bare);
        assert.equal(verdict.lead, null);
        assert.equal(verdict.gap, null);
    });
});

describe('the trend chart', () => {
    test('one line per player, over the gameweeks in the window', () => {
        const pool = squad(8);
        const cmp = load(pool);
        const config = cmp.compareTrendConfig([pool[0], pool[1]], 'pts', false, 'window');
        assert.equal(config.type, 'line');
        const players = config.data.datasets.filter(d => d.label !== 'רמת העילית');
        assert.equal(players.length, 2);
        assert.deepEqual(config.data.labels, ['GW34', 'GW35', 'GW36', 'GW37', 'GW38']);
    });

    test('cumulative mode never goes down', () => {
        const pool = squad(8);
        const cmp = load(pool);
        const config = cmp.compareTrendConfig([pool[0]], 'pts', true, 'window');
        const data = config.data.datasets[0].data;
        for (let i = 1; i < data.length; i++) {
            assert.ok(data[i] >= data[i - 1], `dropped at ${i}: ${data}`);
        }
        assert.equal(data[data.length - 1], 25, 'five gameweeks at five points each');
    });

    test('the elite line is drawn for one position and withheld for two', () => {
        const mids = squad(8);
        const keepers = squad(8, { position_name: 'GKP', element_type: 1 })
            .map((p, i) => ({ ...p, id: 300 + i }));
        const cmp = load([...mids, ...keepers]);

        const same = cmp.compareTrendConfig([mids[0], mids[1]], 'pts', false, 'window');
        assert.ok(same.data.datasets.some(d => d.label === 'רמת העילית'),
            'one position has one bar');

        const mixed = cmp.compareTrendConfig([mids[0], keepers[0]], 'pts', false, 'window');
        assert.ok(!mixed.data.datasets.some(d => d.label === 'רמת העילית'),
            'two positions have two bars, and one line would be wrong for one of them');
    });

    test('the span picks how far back the chart looks', () => {
        const pool = squad(8);
        const cmp = load(pool);
        // The momentum window is five gameweeks; ten reaches back into the
        // previous window; the season takes everything loaded.
        assert.deepEqual(cmp.compareSpanGws('window').map(t => t.gw), [34, 35, 36, 37, 38]);
        assert.deepEqual(cmp.compareSpanGws('ten').map(t => t.gw),
            [29, 30, 31, 32, 33, 34, 35, 36, 37, 38]);
        assert.equal(cmp.compareSpanGws('season').length, 10);
        // An unknown span falls back to the window rather than drawing nothing.
        assert.deepEqual(cmp.compareSpanGws('nonsense').map(t => t.gw), [34, 35, 36, 37, 38]);
    });

    test('the caption counts the gameweeks it actually drew', () => {
        const cmp = load(squad(8));
        // Not "all season" — the number of gameweeks that turned out to exist,
        // which on a live season is only what has been fetched so far.
        assert.match(cmp.compareSpanNote('ten'), /^10 מחזורים/);
        assert.match(cmp.compareSpanNote('ten'), /GW29–GW38/);
        assert.match(cmp.compareSpanNote('window'), /^5 מחזורים/);
    });

    test('a wider span draws more points per player', () => {
        const pool = squad(8);
        const cmp = load(pool);
        const win = cmp.compareTrendConfig([pool[0]], 'pts', false, 'window');
        const ten = cmp.compareTrendConfig([pool[0]], 'pts', false, 'ten');
        assert.equal(win.data.labels.length, 5);
        assert.equal(ten.data.labels.length, 10);
    });

    test('the elite line is withheld outside the window it measures', () => {
        // trendBenchmark measures the site-wide window, so beside a ten-gameweek
        // series it would be comparing two different spans.
        const pool = squad(8);
        const cmp = load(pool);
        const win = cmp.compareTrendConfig([pool[0], pool[1]], 'pts', false, 'window');
        const ten = cmp.compareTrendConfig([pool[0], pool[1]], 'pts', false, 'ten');
        assert.ok(win.data.datasets.some(d => d.label === 'רמת העילית'));
        assert.ok(!ten.data.datasets.some(d => d.label === 'רמת העילית'));
    });

    test('no window, no chart', () => {
        const cmp = load(squad(8), { trendGws: [] });
        assert.equal(cmp.compareTrendConfig([player()], 'pts', false, 'window'), null);
        assert.equal(cmp.compareTrendConfig([player()], 'nonsense', false, 'window'), null);
    });
});

describe('the colour identity', () => {
    test('a player keeps one hue across the cards, the radar and the bars', () => {
        const pool = squad(8);
        const cmp = load(pool);
        const config = cmp.compareRadarConfig([pool[0], pool[1]]);
        assert.equal(config.data.datasets[0].borderColor, cmp.compareColor(0));
        assert.equal(config.data.datasets[1].borderColor, cmp.compareColor(1));
        const trend = cmp.compareTrendConfig([pool[0], pool[1]], 'pts', false, 'window');
        assert.equal(trend.data.datasets[0].borderColor, cmp.compareColor(0));
        assert.equal(trend.data.datasets[1].borderColor, cmp.compareColor(1));
    });

    test('the palette wraps rather than running out', () => {
        const cmp = load(squad(8));
        assert.equal(cmp.compareColor(0), cmp.compareColor(8));
        assert.ok(cmp.compareColor(3).startsWith('#'));
    });
});

describe('the comparison matrix', () => {
    test('a cell knows where it stands in its row, spaced by value', () => {
        const cmp = load(squad(8));
        const row = [93, 74, 72];
        assert.equal(cmp.rowStanding(93, row, false), 1, 'the best is 1');
        assert.equal(cmp.rowStanding(72, row, false), 0, 'the worst is 0');
        // Spaced by value, not by rank: 74 of [93, 74, 72] is nearly the bottom,
        // and a rank-based scale would have drawn it in the middle.
        assert.ok(cmp.rowStanding(74, row, false) < 0.1);
        // Evenly spread values land where you would expect.
        assert.equal(cmp.rowStanding(5, [0, 5, 10], false), 0.5);
    });

    test('a row where low wins is inverted, not re-sorted', () => {
        const cmp = load(squad(8));
        // Goals conceded: 0.9 is the best of the three.
        assert.equal(cmp.rowStanding(0.9, [0.9, 1.4, 1.9], true), 1);
        assert.equal(cmp.rowStanding(1.9, [0.9, 1.4, 1.9], true), 0);
    });

    test('nothing to stand against has no standing', () => {
        const cmp = load(squad(8));
        assert.equal(cmp.rowStanding(5, [5], false), null, 'one figure');
        assert.equal(cmp.rowStanding(5, [5, 5, 5], false), null, 'every figure identical');
        assert.equal(cmp.rowStanding(null, [1, 2], false), null);
        assert.equal(cmp.rowStanding(5, [5, null], false), null, 'nulls do not count as rivals');
    });

    test('the tint is green at the top, red at the bottom, nothing in the middle', () => {
        const cmp = load(squad(8));
        assert.match(cmp.compareToneColor(1), /^rgba\(14, 122, 69, 0\.22/);
        assert.match(cmp.compareToneColor(0), /^rgba\(185, 50, 41, 0\.12/);
        // The middle of a row is deliberately uncoloured, so the eye only goes to
        // the ends — that is the point of tinting instead of drawing bars.
        assert.match(cmp.compareToneColor(0.5), /rgba\(14, 122, 69, 0\.000\)/);
        assert.equal(cmp.compareToneColor(null), 'transparent');
        // Green reaches further than red: finding the leader is the job.
        const green = parseFloat(/,\s([\d.]+)\)$/.exec(cmp.compareToneColor(1))[1]);
        const red = parseFloat(/,\s([\d.]+)\)$/.exec(cmp.compareToneColor(0))[1]);
        assert.ok(green > red, `${green} should carry further than ${red}`);
    });

    test('spread is relative to the size of the figures', () => {
        const cmp = load(squad(8));
        // 220 against 214 is a narrow gap; 0.78 against 0.10 is a wide one, even
        // though the absolute difference is the other way round.
        assert.ok(cmp.rowSpread([220, 214]) < 0.05);
        assert.ok(cmp.rowSpread([0.78, 0.10]) > 0.8);
        assert.equal(cmp.rowSpread([5, 5, 5]), 0);
        assert.equal(cmp.rowSpread([7]), 0, 'one figure has no spread');
        assert.equal(cmp.rowSpread([0, 0]), 0, 'and neither does nothing at all');
        assert.equal(cmp.rowSpread([3, null]), 0, 'a lone real figure is not a spread');
    });

    test('a row that does not separate anybody is folded away', () => {
        const cmp = load(squad(8));
        assert.equal(cmp.isTightRow({ values: [100, 100] }), true);
        assert.equal(cmp.isTightRow({ values: [220, 214] }), true);
        assert.equal(cmp.isTightRow({ values: [93, 74] }), false);
    });

    test('the leaderboard counts who wins what, and what it left out', () => {
        const cmp = load(squad(8));
        const a = player({ id: 1, web_name: 'A' });
        const b = player({ id: 2, web_name: 'B' });
        const sections = [{
            title: 'group', rows: [
                { values: [9, 4] },                     // A
                { values: [1, 8] },                     // B
                { values: [3, 7] },                     // B
                { values: [2, 6], neutral: true },      // nobody: no winner exists
                { values: [5, 5] },                     // nobody: a tie
                { values: [1, 9], asc: true }           // A, because low wins
            ]
        }];
        const board = cmp.compareLeaderboard([a, b], sections);
        assert.equal(board.total, 4, 'neutral rows and ties are not metrics anyone won');
        assert.equal(board.wins[0].wins, 2);
        assert.equal(board.wins[1].wins, 2);
        assert.deepEqual(board.leaders.map(w => w.player.web_name), ['A', 'B'],
            'a dead heat names both');
        assert.equal(board.bySection[0].total, 4);
    });

    test('a joint-best row credits everyone who tied for it', () => {
        const cmp = load(squad(8));
        const trio = ['A', 'B', 'C'].map((n, i) => player({ id: i + 1, web_name: n }));
        const board = cmp.compareLeaderboard(trio, [{
            title: 'g', rows: [{ values: [9, 9, 2] }]
        }]);
        assert.equal(board.total, 1);
        assert.deepEqual(board.wins.map(w => w.wins), [1, 1, 0]);
    });

    test('a group nobody could win is left out of the summary entirely', () => {
        const cmp = load(squad(8));
        const two = ['A', 'B'].map((n, i) => player({ id: i + 1, web_name: n }));
        const board = cmp.compareLeaderboard(two, [
            { title: 'real', rows: [{ values: [4, 2] }] },
            { title: 'all neutral', rows: [{ values: [4, 2], neutral: true }] }
        ]);
        assert.deepEqual(board.bySection.map(s => s.title), ['real']);
        assert.equal(board.total, 1);
    });
});
