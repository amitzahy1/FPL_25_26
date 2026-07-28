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
    'trendPlayerIndex', 'gwDefensiveContribution',
    'playerScore', 'buildDropOffLadder', 'dropOffFor',
    'benchmarkMedian', 'panelBenchmark',
    'seasonMatchesLeft', 'seasonPointsPerApp', 'projectedLevel', 'expectedMatches',
    'fixtureTilt', 'draftValue', 'draftValueOf', 'getCompletedGWCount'
];

const DEPS = [
    'DEFCON_THRESHOLD', 'TREND_METRICS', 'DRAFT_PANELS',
    '_windowStatsCache', '_trendPlayerIndex', '_dropOff', 'gwNum',
    'BENCH_TOP_N', 'BENCH_MIN_MINUTES', '_panelBenchCache',
    'VALUE_TUNING', 'VALUE_HORIZONS', '_valueCache',
    // fixtureTilt reads next_3_fdr through it; it is an arrow-function const.
    'num1'
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
        // The value index prices everyone against the slot-rule baseline for his
        // position — never against p.replacement_score, which becomes "the best
        // free agent" post-draft and would make every free agent non-positive.
        draft: {
            ownedElementIds: new Set(), draftHasHappened: false,
            replacementByPos: { GKP: 3, DEF: 3, MID: 3, FWD: 3 }
        },
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

/**
 * A player the value index can actually price: it needs a season rate, an
 * appearance count to shrink by, and a start share to convert a level into
 * matches.
 */
function valuePlayer(over = {}) {
    return makePlayer({
        points_per_game: '6.0', appearances: 30, minutes: 2700, starts: 30,
        rotation_risk: 1, availability_factor: 1,
        xDiff: 0, next_3_fdr: 3,
        ...over
    });
}

describe('the value index', () => {
    test('is points over replacement times matches, and says so', () => {
        const p = valuePlayer();
        const board = loadBoard([p]);
        const v = board.draftValue(p, 'season');

        assert.equal(v.replacement, 3);
        // Season rate 6 and window rate 6 agree, so the blend is 6 either way.
        assert.equal(Math.round(v.level * 100) / 100, 6);
        // 38 matches: a finished season prices a full one rather than zero.
        assert.equal(v.span, 38);
        assert.equal(v.matches, 38, 'starts every match and is fully available');
        assert.equal(Math.round(v.value), Math.round(v.edge * v.matches),
            'the headline number is the edge times the matches, nothing else');
        assert.ok(v.value > 90 && v.value < 100, `expected ~96 points, got ${v.value}`);
    });

    test('a small sample is shrunk toward zero rather than trusted', () => {
        const veteran = valuePlayer({ id: 1 });
        const cameo = valuePlayer({ id: 2, appearances: 3, minutes: 270 });
        const board = loadBoard([veteran, cameo]);

        const a = board.draftValue(veteran, 'season');
        const b = board.draftValue(cameo, 'season');
        assert.ok(a.edge > b.edge * 2,
            'three matches at the same rate is not the same evidence as thirty');
        assert.ok(b.value > 0, 'shrunk, not erased');
    });

    test('a rotation risk costs matches, not level', () => {
        const nailed = valuePlayer({ id: 1, rotation_risk: 1 });
        const rotated = valuePlayer({ id: 2, rotation_risk: 0.5 });
        const board = loadBoard([nailed, rotated]);

        const a = board.draftValue(nailed, 'season');
        const b = board.draftValue(rotated, 'season');
        assert.equal(Math.round(a.level * 100), Math.round(b.level * 100),
            'the level is what he does when he plays');
        assert.equal(Math.round(b.matches), Math.round(a.matches / 2));
        assert.ok(b.value < a.value * 0.55);
    });

    test('volume is how often he features, not whether he starts when he does', () => {
        // The bug this pins: rotation_risk is starts/appearances, so a player who
        // features in half the gameweeks and starts every one of them scores 1.0
        // on it — identical to a man who starts all 20. Ranking on it cost 0.07
        // Spearman in the backtest; appearances/gameweeks is the term that works.
        const everyWeek = valuePlayer({ id: 1, appearances: 20, rotation_risk: 1 });
        const halfTheWeeks = valuePlayer({ id: 2, appearances: 10, rotation_risk: 1 });
        const benchedOften = valuePlayer({ id: 3, appearances: 20, rotation_risk: 0.5 });
        const board = loadBoard([everyWeek, halfTheWeeks, benchedOften], {});
        // 20 finished gameweeks, which is what getCompletedGWCount reads.
        board.state.allPlayersData.live.raw = { events: Array.from({ length: 20 }, () => ({ finished: true })) };

        const full = board.draftValue(everyWeek, 'now');
        const half = board.draftValue(halfTheWeeks, 'now');
        const benched = board.draftValue(benchedOften, 'now');

        assert.equal(full.playRate, 1);
        assert.equal(half.playRate, 0.5);
        assert.equal(Math.round(half.matches * 100), Math.round(full.matches * 50),
            'appearing half the weeks halves the matches');
        assert.equal(benched.matches, full.matches,
            'coming off the bench sometimes is not the same as missing gameweeks');
    });

    test('an injured player is worth nothing, however good his rate', () => {
        const p = valuePlayer({ availability_factor: 0 });
        const board = loadBoard([p]);
        assert.equal(board.draftValue(p, 'season').value, 0);
    });

    test('is measured against the replacement level of his own position', () => {
        // Identical rates; the scarce position is the one worth spending on.
        const mid = valuePlayer({ id: 1, position_name: 'MID' });
        const fwd = valuePlayer({ id: 2, position_name: 'FWD', element_type: 4 });
        const board = loadBoard([mid, fwd], {
            draft: {
                ownedElementIds: new Set(), draftHasHappened: false,
                replacementByPos: { MID: 5, FWD: 2 }
            }
        });

        assert.ok(board.draftValueOf(fwd, 'season') > board.draftValueOf(mid, 'season'),
            'the same six points a match are worth more where the alternative is worse');
    });

    test('ignores p.replacement_score, which means something else post-draft', () => {
        // The bug this pins: once the rosters load, replacement_score is the best
        // *free agent* at the position, so no free agent can be above it — the
        // best one is exactly zero and the rest are negative. Every shortlist
        // emptied itself the moment the league's data arrived.
        const p = valuePlayer({ replacement_score: 6.0 });
        const board = loadBoard([p]);
        const v = board.draftValue(p, 'season');
        assert.equal(v.replacement, 3, 'the slot-rule baseline, not the best free agent');
        assert.ok(v.value > 0, 'a genuinely good free agent must still read as worth taking');
    });

    test('projects points outright as well as above the baseline', () => {
        const p = valuePlayer();
        const board = loadBoard([p]);
        const v = board.draftValue(p, 'now');
        // Same level, same matches; the projection just keeps the baseline in.
        assert.ok(v.points > v.value, 'the projection includes what the baseline scores too');
        assert.equal(Math.round(v.points - v.value), Math.round(v.replacement * v.matches));
        assert.ok(v.points > 0, 'a projection is a positive number in every roster state');
    });

    test('the short horizon leans on form, the season horizon on the season', () => {
        const p = valuePlayer();
        const board = loadBoard([p]);
        // A hot window: 12 points a match against a season rate of 6.
        board.state.trendGws.forEach(g => g.stats.set(p.id, gwStats({ total_points: 12 })));

        const now = board.draftValue(p, 'now');
        const season = board.draftValue(p, 'season');
        assert.ok(now.level > season.level,
            'five matches of form move the short horizon more than the long one');
        assert.equal(now.span, 5, 'and it only spans five matches');
        assert.ok(now.value < season.value, 'five matches cannot outweigh a season of them');
    });

    test('fixture difficulty tilts the short horizon only', () => {
        const easy = valuePlayer({ id: 1, next_3_fdr: 2 });
        const hard = valuePlayer({ id: 2, next_3_fdr: 4 });
        const board = loadBoard([easy, hard]);

        assert.ok(board.draftValue(easy, 'now').value > board.draftValue(hard, 'now').value);
        assert.equal(board.draftValue(easy, 'season').tilt, 1,
            'over a season every schedule evens out; applying it there invents precision');
    });

    test('says nothing rather than something wrong with no appearances', () => {
        const p = valuePlayer({ appearances: 0, minutes: 0, points_per_game: '0.0' });
        const board = loadBoard([p]);
        assert.equal(board.draftValue(p, 'season'), null);
        assert.equal(board.draftValueOf(p, 'season'), null);
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

    test('every panel names the figure it puts in the value column', () => {
        // The card title says what the panel is for ("מכונות DEFCON"); it does not
        // say what "67%" counts. Both the board caption and the leaderboard's
        // value column header read this, so a missing one leaves a bare number.
        for (const p of loadBoard([makePlayer({})]).DRAFT_PANELS) {
            assert.ok((p.valueLabel || '').trim(), `panel ${p.id} has no valueLabel`);
            assert.notEqual(p.valueLabel, p.title,
                `panel ${p.id} repeats its title instead of naming the metric`);
        }
    });

    test('the benchmark is the median of the best twenty, not the mean', () => {
        const board = loadBoard([makePlayer({})]);
        // 1..30. The top twenty are 11..30, whose median is 20.5 — a mean would
        // be dragged around by whatever sits at the extreme.
        const values = Array.from({ length: 30 }, (_, i) => i + 1);
        assert.equal(board.benchmarkMedian(values), 20.5);
        // One absurd value pushes the window by a single rank and nothing more;
        // a mean of the same twenty would come out near 500.
        assert.equal(board.benchmarkMedian([...values, 10000]), 21.5);
    });

    test('too small a pool has no elite bar to speak of', () => {
        const board = loadBoard([makePlayer({})]);
        assert.equal(board.benchmarkMedian([9, 8, 7, 6]), null);
        assert.equal(board.benchmarkMedian([]), null);
    });

    test('the benchmark is measured per position, and skips small samples', () => {
        // Ten midfielders on 60% DEFCON, ten defenders on 20%, plus a defender
        // with an elite rate off 90 minutes — three matches is the floor.
        const players = [];
        for (let i = 0; i < 10; i++) {
            players.push(makePlayer({ id: 100 + i, element_type: 3, position_name: 'MID',
                minutes: 2000, defcon_hit_rate: 60 }));
            players.push(makePlayer({ id: 200 + i, element_type: 2, position_name: 'DEF',
                minutes: 2000, defcon_hit_rate: 20 }));
        }
        players.push(makePlayer({ id: 999, element_type: 2, position_name: 'DEF',
            minutes: 90, defcon_hit_rate: 99 }));
        const board = loadBoard(players);
        const defcon = panel(board, 'defcon');
        assert.equal(board.panelBenchmark(defcon, 'MID'), 60);
        assert.equal(board.panelBenchmark(defcon, 'DEF'), 20,
            'the 90-minute outlier is below the minutes floor and cannot set the bar');
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
            makePlayer({ id: 2, vorp: 2, replacement_score: 3 }),
            makePlayer({ id: 3, vorp: 1, replacement_score: 3 })
        ]);
        assert.deepEqual(
            board.panelPicks(panel(board, 'value'), board.draftBoardPool().players, 3)
                .map(p => p.id),
            [2],
            'the reason line prints a score, so a pick without one cannot be explained');
    });

    /**
     * The bug this whole panel was rewritten for. computeDraftMetrics sets
     * replacement level to the best free agent at each position, so in a
     * free-agent pool every VORP is <= 0 and the best is exactly 0. The panel
     * used to gate on `vorp > 0`, which in that pool can never match — the most
     * important card on the board vanished the moment the draft data loaded.
     */
    test('the value panel survives a pool where every VORP is zero or negative', () => {
        // Exactly the post-draft shape: the best free agent sits at replacement
        // level, everyone behind him is worse.
        const board = loadBoard([
            makePlayer({ id: 1, position_name: 'MID', vorp: 0, replacement_score: 4.0 }),
            makePlayer({ id: 2, position_name: 'MID', vorp: -0.8, replacement_score: 4.0 }),
            makePlayer({ id: 3, position_name: 'MID', vorp: -1.5, replacement_score: 4.0 }),
            makePlayer({ id: 4, position_name: 'FWD', vorp: 0, replacement_score: 3.5 }),
            makePlayer({ id: 5, position_name: 'FWD', vorp: -2.0, replacement_score: 3.5 })
        ], { draft: { ownedElementIds: new Set([99]) } });

        const pool = board.draftBoardPool().players;
        assert.ok(pool.every(p => p.vorp <= 0), 'fixture must reproduce the real shape');

        const picks = board.panelPicks(panel(board, 'value'), pool, 3);
        assert.ok(picks.length > 0,
            'the panel must still recommend somebody when no VORP is positive');
        // FWD gap is 2.0, MID gap is 0.8 — the biggest drop-off leads.
        assert.deepEqual(picks.map(p => p.id), [4, 1, 2]);
        for (const p of picks) {
            assert.ok(board.dropOffFor(p) > 0, `${p.id} should have a real gap`);
            assert.ok(/\d/.test(panel(board, 'value').display(p)), 'the figure must be a number');
        }
    });

    test('the drop-off is measured against the next player at the same position', () => {
        const board = loadBoard([
            makePlayer({ id: 1, position_name: 'DEF', element_type: 2, vorp: 2, replacement_score: 3 }), // 5.0
            makePlayer({ id: 2, position_name: 'DEF', element_type: 2, vorp: 1, replacement_score: 3 }), // 4.0
            makePlayer({ id: 3, position_name: 'MID', vorp: 0.5, replacement_score: 3 })                // 3.5
        ]);
        board.draftBoardPool();
        assert.equal(board.playerScore({ vorp: 2, replacement_score: 3 }), 5);
        assert.equal(board.dropOffFor({ id: 1 }), 1, 'DEF 5.0 over the next DEF at 4.0');
        assert.equal(board.dropOffFor({ id: 2 }), null, 'last man at his position has no fallback');
        assert.equal(board.dropOffFor({ id: 3 }), null, 'the only MID has no fallback');
    });

    test('the ladder is rebuilt when the pool changes, not cached per player', () => {
        // Same player, two different pools: his fallback is whoever else is there.
        const shallow = loadBoard([
            makePlayer({ id: 1, vorp: 2, replacement_score: 3 }),
            makePlayer({ id: 2, vorp: 0, replacement_score: 3 })
        ]);
        shallow.draftBoardPool();
        assert.equal(shallow.dropOffFor({ id: 1 }), 2);

        const deep = loadBoard([
            makePlayer({ id: 1, vorp: 2, replacement_score: 3 }),
            makePlayer({ id: 2, vorp: 1.8, replacement_score: 3 })
        ]);
        deep.draftBoardPool();
        assert.ok(Math.abs(deep.dropOffFor({ id: 1 }) - 0.2) < 1e-9,
            'a deeper position means a smaller gap, so the ladder must follow the pool');
    });

    test('a non-taker is not a set-piece specialist', () => {
        // 99 means "takes none of them"; a `> 0` test would match the whole
        // league. The board panel that used this is gone — the set-piece chip
        // beside the table now shares the helper rather than copying the rule.
        const board = loadBoard([
            makePlayer({ id: 1 }),
            makePlayer({ id: 2, set_piece_priority: { penalty: 1, corner: 99, free_kick: 99 } })
        ]);
        const pool = board.draftBoardPool().players;
        assert.equal(board.setPieceOrder(pool[0]), 99);
        assert.equal(board.setPieceOrder(pool[1]), 1);
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
        // Scores 6.1 / 5.1 / 4.6 / 4.1 at one position, so the gaps are
        // 1.0 / 0.5 / 0.5 / none. Ordered by gap, id 1 leads and id 4 — the last
        // man, with nothing behind him to be better than — drops out.
        const board = loadBoard([
            makePlayer({ id: 1, vorp: 3.0 }),
            makePlayer({ id: 2, vorp: 2.0 }),
            makePlayer({ id: 3, vorp: 1.5 }),
            makePlayer({ id: 4, vorp: 1.0 })
        ]);
        const picks = board.panelPicks(panel(board, 'value'), board.draftBoardPool().players, 4);
        assert.equal(picks[0].id, 1, 'the biggest drop-off leads');
        assert.ok(!picks.some(p => p.id === 4), 'the last man at a position has no fallback');
        const gaps = picks.map(p => board.dropOffFor(p));
        assert.deepEqual([...gaps].sort((a, b) => b - a), gaps, 'sorted by gap, descending');
    });

    test('a rule that throws drops the player instead of the panel', () => {
        // A player missing a field its rule reads made the whole board disappear
        // before panelPicks caught per-player failures.
        const board = loadBoard([makePlayer({ id: 1 }), makePlayer({ id: 2 })]);
        const brittle = {
            id: 'brittle',
            eligible: p => { if (p.id === 1) throw new Error('missing field'); return true; },
            rank: (a, b) => a.id - b.id
        };
        assert.deepEqual(
            board.panelPicks(brittle, board.draftBoardPool().players, 3).map(p => p.id), [2],
            'one broken player must not take the panel down with him');
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
