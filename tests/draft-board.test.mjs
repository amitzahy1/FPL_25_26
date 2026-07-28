/**
 * The draft board's rules. Each panel answers one draft question with an
 * explicit, stated threshold, so these tests pin the thresholds and — more
 * importantly — the promise the board makes: a pick never appears without the
 * sentence that put it there, and a panel never recommends someone you cannot
 * have or should not want.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractDeclaration, extractFunction } from './helpers/load-script.mjs';

function makePlayer(over = {}) {
    return {
        id: 1, web_name: 'Test', element_type: 3, position_name: 'MID',
        team_name: 'Team A', minutes: 1800, availability_factor: 1,
        draft_score: 55, vorp: 1.2, replacement_score: 3.1,
        defcon_hit_rate: null, defcon_hits: 0, defcon_eligible_apps: 0,
        net_transfers_event: 0, transfers_in_event: 0, transfers_out_event: 0,
        xGI_per90: 0.5, xDiff: -2, points_per_game_90: 4.5,
        set_piece_priority: { penalty: 99, corner: 99, free_kick: 99 },
        ...over
    };
}

/** A gameweek in which the player started and returned 6 points. */
function gwStats(over = {}) {
    return {
        total_points: 6, minutes: 90, defensive_contribution: 4,
        clearances_blocks_interceptions: 2, tackles: 2, recoveries: 0,
        ...over
    };
}

const FUNCTIONS = [
    'windowStats', 'windowMinMatches', 'setPieceOrder', 'defconRateFor',
    'draftBoardPool', 'panelPicks', 'getTrendSeries', 'summariseTrend',
    'trendPlayerIndex', 'gwDefensiveContribution'
];

const DEPS = [
    'DEFCON_THRESHOLD', 'TREND_METRICS', 'DRAFT_PANELS',
    '_windowStatsCache', '_trendPlayerIndex', 'gwNum'
];

/**
 * DRAFT_PANELS and every helper its rules call, evaluated in one shared scope.
 * The panels close over windowStats and friends, so they cannot be pulled into
 * separate scopes — and DRAFT_PANELS itself has to come back out, which is why
 * this does not use loadFunctions().
 */
function loadBoard(players, over = {}) {
    const gws = [34, 35, 36, 37, 38];
    const state = {
        allPlayersData: { live: { processed: players }, historical: {}, demo: {} },
        currentDataSource: 'live',
        trendWindow: 5,
        trendKey: 'live:5:38',
        trendGws: gws.map(gw => ({ gw, stats: new Map(players.map(p => [p.id, gwStats()])) })),
        trendPrevGws: gws.map(gw => ({ gw, stats: new Map(players.map(p => [p.id, gwStats()])) })),
        draft: { ownedElementIds: new Set() },
        ...over
    };
    globalThis.state = state;
    // draftBoardPool() reads the position filter so the board follows the table.
    globalThis.document = { getElementById: () => null };

    const body = [
        ...DEPS.map(n => extractDeclaration(n)),
        ...FUNCTIONS.map(n => extractFunction(n))
    ].join('\n');
    const loaded = new Function(
        `${body}\nreturn { ${FUNCTIONS.join(', ')}, DRAFT_PANELS };`
    )();
    return { ...loaded, state };
}

const panel = (board, id) => board.DRAFT_PANELS.find(p => p.id === id);

describe('window aggregates', () => {
    test('counts matches played, not gameweeks in the window', () => {
        const p = makePlayer();
        const board = loadBoard([p]);
        // Two of the five gameweeks have him on the bench.
        board.state.trendGws[0].stats.set(p.id, gwStats({ minutes: 0, total_points: 0 }));
        board.state.trendGws[1].stats.set(p.id, gwStats({ minutes: 0, total_points: 0 }));

        const w = board.windowStats(p);
        assert.equal(w.matches, 3, 'a benched gameweek is not an appearance');
        assert.equal(w.gws, 5);
        assert.equal(w.points, 18);
        assert.equal(w.ppg, 6, 'points per match played, not per gameweek');
    });

    test('a goalkeeper has no DEFCON rate at all, which is not zero', () => {
        const gk = makePlayer({ element_type: 1, position_name: 'GKP' });
        const board = loadBoard([gk]);
        assert.equal(board.windowStats(gk).dcRate, null,
            'null keeps keepers out of the DEFCON panel; 0% would rank them last instead');
    });

    test('the DEFCON threshold is per position', () => {
        const def = makePlayer({ id: 1, element_type: 2, position_name: 'DEF' });
        const mid = makePlayer({ id: 2, element_type: 3 });
        const board = loadBoard([def, mid]);
        // 11 clears a defender's threshold of 10 but not a midfielder's 12.
        board.state.trendGws.forEach(g => {
            g.stats.set(1, gwStats({ defensive_contribution: 11 }));
            g.stats.set(2, gwStats({ defensive_contribution: 11 }));
        });

        assert.equal(board.windowStats(def).dcRate, 100);
        assert.equal(board.windowStats(mid).dcRate, 0);
    });
});

describe('the pool a panel picks from', () => {
    test('narrows to free agents once the league rosters are known', () => {
        const mine = makePlayer({ id: 1 });
        const free = makePlayer({ id: 2 });
        const board = loadBoard([mine, free], { draft: { ownedElementIds: new Set([1]) } });

        const pool = board.draftBoardPool();
        assert.equal(pool.freeAgentsOnly, true);
        assert.deepEqual(pool.players.map(p => p.id), [2],
            'recommending a player somebody already owns is not a recommendation');
    });

    test('before the draft everyone is available', () => {
        const board = loadBoard([makePlayer({ id: 1 }), makePlayer({ id: 2 })]);
        const pool = board.draftBoardPool();
        assert.equal(pool.freeAgentsOnly, false);
        assert.equal(pool.players.length, 2);
    });

    test('an injured or suspended player is never recommended', () => {
        const board = loadBoard([
            makePlayer({ id: 1, availability_factor: 0 }),
            makePlayer({ id: 2, availability_factor: 0.25 }),
            makePlayer({ id: 3 })
        ]);
        assert.deepEqual(board.draftBoardPool().players.map(p => p.id), [3]);
    });
});

describe('panel rules', () => {
    test('every panel that picks someone can explain the pick', () => {
        const board = loadBoard([
            makePlayer({ id: 1, vorp: 3.4 }),
            makePlayer({ id: 2, element_type: 2, position_name: 'DEF', defcon_hit_rate: 55,
                defcon_hits: 20, defcon_eligible_apps: 36 }),
            makePlayer({ id: 3, net_transfers_event: 12400, transfers_in_event: 15500,
                transfers_out_event: 3100 }),
            makePlayer({ id: 4, xGI_per90: 0.62, xDiff: -3.1 }),
            makePlayer({ id: 5, set_piece_priority: { penalty: 1, corner: 2, free_kick: 99 } })
        ]);
        const pool = board.draftBoardPool().players;

        let picked = 0;
        for (const p of board.DRAFT_PANELS) {
            for (const pick of board.panelPicks(p, pool, 3)) {
                picked++;
                assert.ok((p.why(pick) || '').trim(),
                    `panel ${p.id} picked ${pick.web_name} with no reason`);
                assert.ok((p.display(pick) || '').trim(),
                    `panel ${p.id} picked ${pick.web_name} with no figure`);
            }
        }
        assert.ok(picked > 0, 'the fixture should satisfy at least one panel');
    });

    test('the market panel stays empty until a gameweek has transfer numbers', () => {
        const board = loadBoard([makePlayer({ net_transfers_event: 0 })]);
        const market = panel(board, 'market');
        assert.equal(board.panelPicks(market, board.draftBoardPool().players, 3).length, 0);
        assert.ok(market.emptyNote,
            'a panel that legitimately has nothing must say so; a missing card reads as a bug');
    });

    test('the value panel needs a replacement level to compare against', () => {
        const board = loadBoard([
            makePlayer({ id: 1, vorp: 2, replacement_score: null }),
            makePlayer({ id: 2, vorp: 2, replacement_score: 3 })
        ]);
        assert.deepEqual(
            board.panelPicks(panel(board, 'value'), board.draftBoardPool().players, 3)
                .map(p => p.id),
            [2],
            'the reason line prints replacement_score, so a pick without one cannot be explained');
    });

    test('a non-taker is not a set-piece specialist', () => {
        // 99 means "takes none of them"; a `> 0` test would match the whole league.
        const board = loadBoard([
            makePlayer({ id: 1 }),
            makePlayer({ id: 2, set_piece_priority: { penalty: 1, corner: 99, free_kick: 99 } })
        ]);
        const pool = board.draftBoardPool().players;
        assert.equal(board.setPieceOrder(pool[0]), 99);
        assert.equal(board.setPieceOrder(pool[1]), 1);
        assert.deepEqual(
            board.panelPicks(panel(board, 'setpiece'), pool, 3).map(p => p.id), [2]);
    });

    test('the season DEFCON rate wins over the window rate where it exists', () => {
        const withSeason = makePlayer({ element_type: 2, position_name: 'DEF', defcon_hit_rate: 42 });
        assert.equal(loadBoard([withSeason]).defconRateFor(withSeason), 42,
            'the snapshot measures it per match across a whole season');

        const liveOnly = makePlayer({ id: 2, element_type: 2, position_name: 'DEF' });
        assert.equal(loadBoard([liveOnly]).defconRateFor(liveOnly), 0,
            'with no season figure it falls back to the window, which is a number not a null');
    });

    test('a panel never returns more than it was asked for', () => {
        const board = loadBoard(Array.from({ length: 30 }, (_, i) =>
            makePlayer({ id: i + 1, vorp: 5 - i * 0.1 })));
        const value = panel(board, 'value');
        const pool = board.draftBoardPool().players;
        assert.equal(board.panelPicks(value, pool, 3).length, 3);
        assert.equal(board.panelPicks(value, pool, 20).length, 20);
    });

    test('picks come back best-first', () => {
        const board = loadBoard([
            makePlayer({ id: 1, vorp: 1.0 }),
            makePlayer({ id: 2, vorp: 3.0 }),
            makePlayer({ id: 3, vorp: 2.0 })
        ]);
        assert.deepEqual(
            board.panelPicks(panel(board, 'value'), board.draftBoardPool().players, 3)
                .map(p => p.id),
            [2, 3, 1]);
    });

    test('a rule that throws drops the player instead of the panel', () => {
        // A player missing set_piece_priority made the whole board disappear before
        // panelPicks caught per-player failures.
        const board = loadBoard([
            makePlayer({ id: 1, set_piece_priority: undefined }),
            makePlayer({ id: 2, set_piece_priority: { penalty: 1, corner: 99, free_kick: 99 } })
        ]);
        assert.deepEqual(
            board.panelPicks(panel(board, 'setpiece'), board.draftBoardPool().players, 3)
                .map(p => p.id),
            [2]);
    });
});

describe('window minimums scale with the window', () => {
    test('a three-gameweek window asks for fewer appearances than a ten', () => {
        const board = loadBoard([makePlayer()]);
        board.state.trendWindow = 3;
        const short = board.windowMinMatches();
        board.state.trendWindow = 10;
        const long = board.windowMinMatches();
        assert.ok(short < long, 'a fixed minimum either excludes everyone or nobody');
        assert.ok(short >= 2, 'one good game is not a trend');
    });
});
