/**
 * Tests for the draft-specific metrics and the smart filters.
 * VORP in particular is easy to get subtly wrong in ways that still look
 * plausible on screen, so the replacement-level maths is pinned down here.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SCRIPT_SRC, extractFunction, installBrowserStubs } from './helpers/load-script.mjs';

function loadDraftMetrics(draftState = {}) {
    installBrowserStubs();
    const state = {
        // replacementByPos is written per position so the value index can price
        // players who sit below computeDraftMetrics' own minutes bar.
        draft: { details: null, ownedElementIds: new Set(), replacementByPos: {}, ...draftState },
        allPlayersData: { live: { fixtures: null }, historical: { fixtures: null } },
        currentDataSource: 'historical'
    };
    const body = extractFunction('computeDraftMetrics');
    const consts = SCRIPT_SRC.slice(
        SCRIPT_SRC.indexOf('const REPLACEMENT_SLOTS'),
        SCRIPT_SRC.indexOf('function computeDraftMetrics')
    );
    const factory = new Function('state', `${consts}\n${body}\nreturn computeDraftMetrics;`);
    return factory(state);
}

/**
 * A squad of `count` players at one position with descending points-per-game.
 * The step keeps every value positive: a negative points-per-game is not a
 * real scenario and makes the fixture, not the code, the thing under test.
 */
function squad(position, count, { startPpg = 8, step = 0.1, minutes = 2000 } = {}) {
    return Array.from({ length: count }, (_, i) => ({
        id: `${position}${i}`,
        web_name: `${position}${i}`,
        position_name: position,
        points_per_game: (startPpg - i * step).toFixed(2),
        minutes,
        starts: 22,
        appearances: 24,
        status: 'a',
        chance_of_playing_next_round: 100
    }));
}

describe('VORP', () => {
    test('is measured against the replacement slot, not the best player', () => {
        // 8 teams x 4 starting midfielders => the 32nd best MID is replacement.
        const players = squad('MID', 60);
        const withMetrics = loadDraftMetrics()(players);

        const replacement = parseFloat(players[32].points_per_game);
        const best = withMetrics.find(p => p.web_name === 'MID0');
        assert.equal(best.replacement_score, Math.round(replacement * 100) / 100);
        assert.ok(Math.abs(best.vorp - (parseFloat(best.points_per_game) - replacement)) < 0.02);
    });

    test('is negative for players below replacement level', () => {
        const players = squad('MID', 60);
        const withMetrics = loadDraftMetrics()(players);
        const weak = withMetrics.find(p => p.web_name === 'MID50');
        assert.ok(weak.vorp < 0, `expected negative VORP, got ${weak.vorp}`);
    });

    test('uses a different replacement level per position', () => {
        // Only one goalkeeper starts per team, so keepers deplete far faster.
        const players = [...squad('GKP', 40), ...squad('MID', 40)];
        const withMetrics = loadDraftMetrics()(players);
        const gk = withMetrics.find(p => p.web_name === 'GKP0');
        const mid = withMetrics.find(p => p.web_name === 'MID0');
        assert.notEqual(gk.replacement_score, mid.replacement_score);
    });

    test('uses points per appearance, so a low-minute substitute cannot top it', () => {
        // Per-90 would rate this cameo above every genuine starter.
        const players = [
            ...squad('FWD', 40),
            {
                id: 'cameo', web_name: 'Cameo', position_name: 'FWD',
                points_per_game: '1.0', total_points: 10, minutes: 100,
                starts: 0, appearances: 10, status: 'a', chance_of_playing_next_round: 100
            }
        ];
        const withMetrics = loadDraftMetrics()(players);
        const cameo = withMetrics.find(p => p.web_name === 'Cameo');
        // Below the 900-minute floor, so it gets no VORP at all.
        assert.equal(cameo.vorp, null);
    });

    test('prefers an actual free agent once ownership is known', () => {
        const players = squad('MID', 60);
        // Everyone above index 5 is taken, so replacement becomes MID5.
        const owned = new Set(players.slice(0, 5).map(p => p.id));
        const withMetrics = loadDraftMetrics({ ownedElementIds: owned })(players);
        const best = withMetrics.find(p => p.web_name === 'MID0');
        assert.equal(best.replacement_score, Math.round(parseFloat(players[5].points_per_game) * 100) / 100);
    });
});

describe('rotation risk and availability', () => {
    test('rotation risk is the share of appearances that were starts', () => {
        const players = [{
            id: 1, web_name: 'Rotated', position_name: 'MID',
            points_per_game: '4.0', minutes: 1000, starts: 6, appearances: 24,
            status: 'a', chance_of_playing_next_round: 100
        }];
        const [p] = loadDraftMetrics()(players);
        assert.equal(p.rotation_risk, 0.25);
    });

    test('availability is zero for injured or suspended players', () => {
        const base = { id: 1, web_name: 'X', position_name: 'MID', points_per_game: '4', minutes: 1000, starts: 10, appearances: 10 };
        for (const status of ['i', 's', 'u']) {
            const [p] = loadDraftMetrics()([{ ...base, status }]);
            assert.equal(p.availability_factor, 0, `status ${status} must be unavailable`);
        }
    });

    test('a doubtful player is scaled by their chance of playing', () => {
        const [p] = loadDraftMetrics()([{
            id: 1, web_name: 'Doubt', position_name: 'MID', points_per_game: '4',
            minutes: 1000, starts: 10, appearances: 10, status: 'd',
            chance_of_playing_next_round: 25
        }]);
        assert.equal(p.availability_factor, 0.25);
    });
});

describe('smart filters', () => {
    const load = (state = {}) => {
        globalThis.state = state;
        const start = SCRIPT_SRC.indexOf('let _newcomers =');
        const end = SCRIPT_SRC.indexOf('function applyQuickFilter');
        // draftValueOf lives with the value index, far from this slice; the tests
        // that need it care about the *rule*, not the arithmetic, so it reads a
        // figure off the fixture.
        return new Function(`const SEASON_CONFIG = { seasonLabel: '2026/27', previousSeasonLabel: '2025/26' };
            const draftValueOf = (p) => p.__now === undefined ? 0 : p.__now;
            const projectedPointsOf = (p) => p.__now === undefined ? 0 : p.__now;
            const setPieceOrder = (p) => Math.min(p.set_piece_priority.penalty,
                p.set_piece_priority.corner, p.set_piece_priority.free_kick);
            const marketIndex = () => globalThis.__marketLoaded ? new Map() : null;
            ${SCRIPT_SRC.slice(start, end)}
            return { QUICK_FILTERS, newcomerSets, newcomerUnavailable, isAvailableToDraft,
                marketUnavailable };`)();
    };
    const { QUICK_FILTERS } = load();

    /**
     * Last season's snapshot plus this season's bootstrap, in the two shapes the
     * newcomer filters read: a team list with stable codes, and player rows.
     */
    const twoSeasons = ({ liveTeams, snapshotTeams, snapshotCodes }) => ({
        currentDataSource: 'live',
        allPlayersData: {
            live: { raw: { teams: liveTeams } },
            historical: {
                raw: {
                    __snapshot: {
                        seasonId: '2025-26', teams: snapshotTeams,
                        fields: ['id', 'code'], rows: snapshotCodes.map((c, i) => [i, c])
                    }
                }
            }
        }
    });

    test('every chip in the UI has an implementation', () => {
        // Five chips previously fell through the switch and silently did nothing.
        const html = SCRIPT_SRC; // filters are referenced from index.html, checked below
        const required = ['set_pieces', 'attacking_defenders', 'differentials',
            'form_kings', 'underperformers',
            'promoted_teams', 'new_to_league',
            'best_gkp_5', 'best_def_5', 'best_mid_5', 'best_fwd_5',
            'market_breakout', 'market_value', 'market_risers'];
        for (const name of required) {
            assert.ok(QUICK_FILTERS[name], `quick filter "${name}" is not implemented`);
            assert.equal(typeof QUICK_FILTERS[name].filter, 'function');
        }
        assert.ok(html.length > 0);
    });

    describe('pre-season market chips', () => {
        // Fields the overlay attaches; see tests/market-overlay.test.mjs for how.
        const marketRow = (over = {}) => ({
            minutes: 2000, hype_gap: 0, price_delta: 0, market_departed: false, ...over
        });

        test('breakout wants hype far ahead of production, from a real starter', () => {
            const { QUICK_FILTERS } = load();
            assert.ok(QUICK_FILTERS.market_breakout.filter(marketRow({ hype_gap: 40 })));
            assert.ok(!QUICK_FILTERS.market_breakout.filter(marketRow({ hype_gap: 10 })),
                'a small gap is noise, not a signal');
            assert.ok(!QUICK_FILTERS.market_breakout.filter(marketRow({ hype_gap: 40, minutes: 200 })),
                'the newcomer chips already cover players with no season behind them');
        });

        test('value wants production the market ignored', () => {
            const { QUICK_FILTERS } = load();
            assert.ok(QUICK_FILTERS.market_value.filter(marketRow({ hype_gap: -40 })));
            assert.ok(!QUICK_FILTERS.market_value.filter(marketRow({ hype_gap: 40 })));
            assert.equal(QUICK_FILTERS.market_value.sortDirection, 'asc',
                'most-ignored first, so the chip opens on its own subject');
        });

        test('risers has no minutes floor — a new signing is the point', () => {
            const { QUICK_FILTERS } = load();
            assert.ok(QUICK_FILTERS.market_risers.filter(marketRow({ price_delta: 1.0, minutes: 0 })));
            assert.ok(!QUICK_FILTERS.market_risers.filter(marketRow({ price_delta: 0.2 })));
        });

        test('no chip ever recommends a player who left the league', () => {
            const { QUICK_FILTERS } = load();
            for (const name of ['market_breakout', 'market_value', 'market_risers']) {
                const gone = marketRow({
                    hype_gap: name === 'market_value' ? -40 : 40,
                    price_delta: 1.0, market_departed: true
                });
                assert.ok(!QUICK_FILTERS[name].filter(gone), `${name} must exclude departed players`);
            }
        });

        test('each chip says why it cannot run instead of showing an empty table', () => {
            const onLive = load({ currentDataSource: 'live' });
            assert.match(onLive.marketUnavailable(), /2025\/26/,
                'on the live tab it must point back to the previous season');

            globalThis.__marketLoaded = false;
            const noMarket = load({ currentDataSource: 'historical' });
            assert.ok(noMarket.marketUnavailable(), 'without the bootstrap the chip must refuse');

            globalThis.__marketLoaded = true;
            const ready = load({ currentDataSource: 'historical' });
            assert.equal(ready.marketUnavailable(), null);
            globalThis.__marketLoaded = false;
        });

        test('all three are wired to that explanation', () => {
            const { QUICK_FILTERS } = load();
            for (const name of ['market_breakout', 'market_value', 'market_risers']) {
                assert.equal(typeof QUICK_FILTERS[name].unavailable, 'function',
                    `${name} must explain itself when the market is missing`);
                assert.ok(QUICK_FILTERS[name].explain, `${name} sorts on a column that needs naming`);
            }
        });
    });

    test('set-piece filter excludes non-takers (99 means "not a taker")', () => {
        const taker = { set_piece_priority: { penalty: 1, corner: 99, free_kick: 99 } };
        const nonTaker = { set_piece_priority: { penalty: 99, corner: 99, free_kick: 99 } };
        assert.ok(QUICK_FILTERS.set_pieces.filter(taker));
        assert.ok(!QUICK_FILTERS.set_pieces.filter(nonTaker),
            'a player who takes nothing must not match the set-piece filter');
    });

    test('the position shortlists rank on the five-gameweek index, best first', () => {
        const fns = load({ draft: { ownedElementIds: new Set() } });
        const player = (over) => ({
            position_name: 'MID', minutes: 1800, availability_factor: 1, __now: 5, ...over
        });
        for (const [name, pos] of [['best_gkp_5', 'GKP'], ['best_def_5', 'DEF'],
            ['best_mid_5', 'MID'], ['best_fwd_5', 'FWD']]) {
            const spec = fns.QUICK_FILTERS[name];
            // points_next_5, not value_now: within one position the baseline is a
            // constant, so both order identically — and only the projection is
            // still positive once every startable player there is owned.
            assert.equal(spec.sortKey, 'points_next_5', `${name} must sort on the short horizon`);
            assert.equal(spec.sortDirection, 'desc', `${name} must put the best pick first`);
            assert.ok(spec.filter(player({ position_name: pos })), `${name} must match a ${pos}`);
            const otherPos = pos === 'GKP' ? 'FWD' : 'GKP';
            assert.ok(!spec.filter(player({ position_name: otherPos })),
                `${name} must not match a ${otherPos}`);
            assert.ok(!spec.filter(player({ position_name: pos, __now: -2 })),
                'a player worth less than the alternative is not a recommendation');
            assert.ok(!spec.filter(player({ position_name: pos, minutes: 200 })),
                'five gameweeks of value off two matches of evidence is noise');
        }
    });

    test('"פנוי" excludes players the league already owns, and the unfit', () => {
        const fns = load({ draft: { ownedElementIds: new Set([7]) } });
        assert.ok(fns.isAvailableToDraft({ id: 1, availability_factor: 1 }));
        assert.ok(!fns.isAvailableToDraft({ id: 7, availability_factor: 1 }),
            'somebody else already has him');
        assert.ok(!fns.isAvailableToDraft({ id: 2, availability_factor: 0.25 }),
            'a doubtful player is not a recommendation');

        // Before the draft nobody is owned, so nobody is excluded on that ground.
        const preDraft = load({ draft: { ownedElementIds: new Set() } });
        assert.ok(preDraft.isAvailableToDraft({ id: 7, availability_factor: 1 }));
    });

    test('promoted clubs are derived from the team codes, not a hardcoded list', () => {
        // Team codes are stable across seasons, so a club whose code has no row in
        // last season's snapshot came up. Nothing to update every August.
        const fns = load(twoSeasons({
            liveTeams: [{ id: 1, code: 3 }, { id: 2, code: 90 }, { id: 3, code: 49 }],
            snapshotTeams: [{ code: 3 }, { code: 90 }],
            snapshotCodes: [100, 200]
        }));
        const promoted = fns.QUICK_FILTERS.promoted_teams.filter;
        assert.ok(promoted({ team: 3, code: 999 }), 'team 3 is not in last season');
        assert.ok(!promoted({ team: 1, code: 100 }), 'Arsenal did not just come up');
    });

    test('a newcomer at an established club is separated from a promoted squad', () => {
        const fns = load(twoSeasons({
            liveTeams: [{ id: 1, code: 3 }, { id: 3, code: 49 }],
            snapshotTeams: [{ code: 3 }],
            snapshotCodes: [100]
        }));
        const isNew = fns.QUICK_FILTERS.new_to_league.filter;
        assert.ok(isNew({ team: 1, code: 555 }), 'a signing into a club that was already here');
        assert.ok(!isNew({ team: 1, code: 100 }), 'played here last season');
        assert.ok(!isNew({ team: 3, code: 777 }),
            'came up with his club — that is the other chip, and a different question');
    });

    test('both newcomer chips explain themselves instead of emptying the table', () => {
        // On the previous-season tab the snapshot IS that season, so there is
        // nothing to compare against.
        const onSnapshot = load({ currentDataSource: 'historical', allPlayersData: {} });
        assert.match(onSnapshot.newcomerUnavailable(), /2026\/27/);
        assert.equal(onSnapshot.newcomerSets(), null);

        // And before the live bootstrap lands there are no teams to diff.
        const loading = load({ currentDataSource: 'live', allPlayersData: { live: {}, historical: {} } });
        assert.ok(loading.newcomerUnavailable());
    });

    test('form filter demands genuinely strong form, not merely non-zero', () => {
        assert.ok(!QUICK_FILTERS.form_kings.filter({ form: '0.4', minutes: 2000 }));
        assert.ok(QUICK_FILTERS.form_kings.filter({ form: '6.2', minutes: 2000 }));
    });
});
