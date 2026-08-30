/**
 * Reading two gameweeks as evidence rather than as a season.
 *
 * The draft is decided in August, when the current season has produced 180
 * minutes at the very most. Ranked on that alone the board is whoever scored on
 * the opening weekend; ignored entirely, the board is last season's and says
 * nothing about a player whose role has changed. The blend is the middle, and
 * these are the properties it has to hold to for the middle to be trustworthy:
 * it must converge on the current season, it must never invent a season a player
 * did not play, and turning it off must give back exactly the raw figures.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadFunctions, installBrowserStubs, extractDeclaration } from './helpers/load-script.mjs';

const FNS = ['attachSeasonPrior', 'fillFromPreviousSeason', 'applySeasonBlend',
    'seasonProfile', 'priorRate', 'priorAppearances', 'seasonBlendWeight',
    'positionPriorProfile', 'seasonBlendShare', 'seasonBlendActive',
    'sampleMinutes', 'scaleMinutes', 'playedGameweeks', 'finishedGameweekCount',
    'appearancesOf'];

const DEPS = ['BLEND_PER90', 'BLEND_ALIASES', '_median', '_positionPriors',
    'ARCHIVE_STAT_FIELDS', 'UNPLAYED_STAT_FIELDS', 'SEASON_CONFIG'];

// VALUE_TUNING is a global rather than a dep: the tests turn priorK up and down,
// and a dep is a const inside loadFunctions' own scope, out of reach. Read from
// the real source so the shipped default is what is being tested.
const REAL_TUNING = new Function(`${extractDeclaration('VALUE_TUNING')}
return VALUE_TUNING;`)();

function load({ played = 2, priorK } = {}) {
    installBrowserStubs();
    const events = Array.from({ length: 38 }, (_, i) => ({ id: i + 1, finished: i < played }));
    const state = {
        currentDataSource: 'live',
        allPlayersData: { live: { raw: { events }, fixtures: null, processed: [] }, historical: {} },
        draft: { replacementByPos: {} }
    };
    const tuning = { ...REAL_TUNING };
    if (priorK !== undefined) tuning.priorK = priorK;
    const fns = loadFunctions(FNS, { state, console, VALUE_TUNING: tuning }, DEPS);
    return { fns, state, tuning };
}

/** A returning player: an ordinary fortnight this season, a good season behind him. */
const live = (over = {}) => ({
    id: 5, code: 900, web_name: 'Returner', position_name: 'MID', element_type: 3,
    minutes: 180, starts: 2, total_points: 8, points_per_game: '4.0',
    goals_scored: 0, assists: 1, expected_goal_involvements: '0.6',
    expected_goal_involvements_per_90: 0.30, xGI_per90: 0.30,
    def_contrib_per90: 2.0, defensive_contribution_per_90: 2.0,
    bonus_per90: 0.5, ga_per90: 0.5, points_per_game_90: 4.0,
    rotation_risk: 1, ...over
});

const archive = (over = {}) => ({
    id: 71, code: 900, minutes: 2700, starts: 28, appearances: 30, total_points: 180,
    points_per_game: '6.0', goals_scored: 10, assists: 8,
    expected_goal_involvements: '16.0', expected_goal_involvements_per_90: 0.60,
    defensive_contribution_per_90: 4.0, bonus: 30, defcon_hit_rate: 40,
    defcon_hits: 12, defcon_eligible_apps: 30, team_code: 1, ...over
});

describe('attaching last season', () => {
    test('pre-season it still replaces the row, exactly as before', () => {
        const { fns } = load();
        const map = new Map([[900, archive()]]);
        const [both] = fns.attachSeasonPrior([live()], map, { overwrite: true });
        const [old] = fns.fillFromPreviousSeason([live()], map);
        assert.equal(both.minutes, 2700, "the archive's minutes become the row");
        assert.equal(old.minutes, both.minutes, 'and the old name is the same operation');
        assert.equal(both.no_history, false);
    });

    test('once the season is under way the row keeps its own numbers', () => {
        const { fns } = load();
        const [p] = fns.attachSeasonPrior([live()], new Map([[900, archive()]]), { overwrite: false });
        assert.equal(p.minutes, 180, 'this season, untouched — it is what the reader is looking at');
        assert.equal(p.total_points, 8);
        assert.equal(p.prior.minutes, 2700, 'last season rides along instead');
        assert.equal(p.prior_minutes, 2700);
    });

    test('a newcomer is marked, not zero-filled from a season he never played', () => {
        const { fns } = load();
        const [p] = fns.attachSeasonPrior([live({ code: 404 })], new Map(), { overwrite: false });
        assert.equal(p.no_history, true);
        assert.equal(p.prior, null);
        assert.equal(p.minutes, 180, 'his own fortnight survives');
    });

    test('a player who changed clubs is flagged, because his numbers were earned elsewhere', () => {
        const { fns } = load();
        const stay = fns.attachSeasonPrior([live({ team_code: 1 })],
            new Map([[900, archive({ team_code: 1 })]]), { overwrite: false })[0];
        const moved = fns.attachSeasonPrior([live({ team_code: 8 })],
            new Map([[900, archive({ team_code: 1 })]]), { overwrite: false })[0];
        assert.equal(stay.moved_club, false);
        assert.equal(moved.moved_club, true);
    });
});

describe('the weight', () => {
    test('is the share of evidence this season has produced', () => {
        const { fns } = load({ priorK: 900 });
        const withPrior = mins => {
            const [p] = fns.attachSeasonPrior([live({ minutes: mins })],
                new Map([[900, archive()]]), { overwrite: false });
            return fns.seasonBlendWeight(p);
        };
        assert.equal(withPrior(0), 0, 'nothing played yet is last season, not a blank');
        assert.ok(Math.abs(withPrior(180) - 0.1667) < 0.001, 'two gameweeks ~= 17%');
        assert.ok(Math.abs(withPrior(900) - 0.5) < 0.001, 'ten matches is even');
        assert.ok(withPrior(2700) > 0.74, 'and it keeps climbing');
    });

    test('converges on the current season without anything being switched off', () => {
        const { fns } = load({ priorK: 900 });
        const p = fns.attachSeasonPrior([live({ minutes: 3200 })],
            new Map([[900, archive()]]), { overwrite: false })[0];
        assert.ok(fns.seasonBlendWeight(p) > 0.78);
    });

    test('is 1 for a player with no previous season, whatever the constant says', () => {
        const { fns } = load({ priorK: 900 });
        const [p] = fns.attachSeasonPrior([live({ code: 404 })], new Map(), { overwrite: false });
        assert.equal(fns.seasonBlendWeight(p), 1);
    });

    test('priorK of 0 turns the whole thing off', () => {
        const { fns } = load({ priorK: 0 });
        const [p] = fns.attachSeasonPrior([live()], new Map([[900, archive()]]), { overwrite: false });
        assert.equal(fns.seasonBlendWeight(p), 1);
    });
});

describe('blending the rates', () => {
    const blend = (opts = {}) => {
        const { fns } = load({ priorK: opts.priorK ?? 900, played: opts.played ?? 2 });
        const players = fns.attachSeasonPrior(opts.players || [live()],
            opts.archive || new Map([[900, archive()]]), { overwrite: false });
        fns.applySeasonBlend(players);
        return { players, fns };
    };

    test('a rate lands between the two seasons, nearer the one with the evidence', () => {
        const { players: [p] } = blend();
        // 0.1667 x 0.30 + 0.8333 x 0.60
        assert.ok(Math.abs(p.xGI_per90 - 0.55) < 0.01, `got ${p.xGI_per90}`);
        assert.ok(p.xGI_per90 > 0.30 && p.xGI_per90 < 0.60, 'strictly between the two');
    });

    test('the underscored alias moves with it, or half the app reads the raw figure', () => {
        const { players: [p] } = blend();
        assert.equal(p.defensive_contribution_per_90, p.def_contrib_per90);
        assert.ok(p.def_contrib_per90 > 2.0 && p.def_contrib_per90 < 4.0);
    });

    test('the counting stats are left alone — they are what the table shows', () => {
        const { players: [p] } = blend();
        assert.equal(p.minutes, 180);
        assert.equal(p.total_points, 8);
        assert.equal(p.goals_scored, 0);
    });

    test('xDiff is re-expressed over a projected season, so its thresholds still mean something', () => {
        const { players: [p] } = blend();
        // Last season: (10 + 8 - 16) / 30 = +0.067 per appearance, over ~34 apps.
        assert.ok(p.xDiff > 1, `a season's worth of overperformance, not a fortnight's: ${p.xDiff}`);
        assert.ok(p.projected_apps_38 > 20 && p.projected_apps_38 <= 38);
    });

    test('DEFCON blends as a hit rate, never as an average', () => {
        const { players: [p] } = blend();
        assert.ok(p.defcon_hit_rate > 0 && p.defcon_hit_rate <= 40);
        assert.ok(p.defcon_eligible_apps >= 30, 'both seasons of eligible matches count toward the denominator');
    });

    test('with the blend off, every rate is exactly this season', () => {
        const { players: [p] } = blend({ priorK: 0 });
        assert.equal(p.xGI_per90, 0.30);
        assert.equal(p.def_contrib_per90, 2.0);
        assert.equal(p.points_per_game, '4.0', 'untouched, not even re-parsed');
    });
});

describe('a player with no previous season', () => {
    /** Three established midfielders to set a baseline, and one newcomer. */
    const squad = () => ([
        live({ id: 1, code: 901 }), live({ id: 2, code: 902 }), live({ id: 3, code: 903 }),
        live({ id: 9, code: 404, minutes: 180, points_per_game: '9.0', xGI_per90: 1.4, ga_per90: 1.5 })
    ]);
    const priors = () => new Map([
        [901, archive({ code: 901, minutes: 2700, expected_goal_involvements_per_90: 0.50, points_per_game: '5.0' })],
        [902, archive({ code: 902, minutes: 2700, expected_goal_involvements_per_90: 0.60, points_per_game: '6.0' })],
        [903, archive({ code: 903, minutes: 2700, expected_goal_involvements_per_90: 0.70, points_per_game: '7.0' })]
    ]);

    const run = () => {
        const { fns } = load({ priorK: 900 });
        const players = fns.attachSeasonPrior(squad(), priors(), { overwrite: false });
        fns.applySeasonBlend(players);
        return players;
    };

    test('is held near his position, not left to top the board off two matches', () => {
        const newcomer = run().find(p => p.code === 404);
        assert.equal(newcomer.prior_is_baseline, true);
        assert.ok(newcomer.xGI_per90 < 1.4, 'his fortnight does not stand alone');
        assert.ok(Math.abs(newcomer.xGI_per90 - 0.74) < 0.05,
            `pulled toward the positional median: ${newcomer.xGI_per90}`);
    });

    test('but is not held at zero either — the baseline is an ordinary regular', () => {
        const newcomer = run().find(p => p.code === 404);
        assert.ok(newcomer.xGI_per90 > 0.5);
        assert.ok(parseFloat(newcomer.points_per_game) > 4);
    });

    test('is still distinguishable from a player with a real history', () => {
        const players = run();
        assert.equal(players.find(p => p.code === 404).prior_is_baseline, true);
        assert.equal(players.find(p => p.code === 901).prior_is_baseline, false);
        assert.equal(players.find(p => p.code === 404).blend_minutes, 180,
            'a baseline is a stand-in, not evidence — it adds nothing to his sample');
    });
});

describe('the sample gates', () => {
    test('count both seasons, because that is what the rates were built from', () => {
        const { fns } = load();
        const [p] = fns.attachSeasonPrior([live()], new Map([[900, archive()]]), { overwrite: false });
        assert.equal(fns.sampleMinutes(p), 2880);
        assert.equal(fns.sampleMinutes({ minutes: 180 }), 180, 'and a newcomer only has his own');
    });

    test('a season-long floor shrinks to the football that has been played', () => {
        assert.equal(load({ played: 2 }).fns.scaleMinutes(900), 90);
        assert.equal(load({ played: 10 }).fns.scaleMinutes(900), 450);
        assert.equal(load({ played: 30 }).fns.scaleMinutes(900), 900, 'and stops at the real floor');
    });

    test('gameweeks played counts kicked-off fixtures, not only checked ones', () => {
        const { fns, state } = load({ played: 1 });
        assert.equal(fns.playedGameweeks(), 1);
        // GW2's matches are being played; FPL will not mark it finished until Tuesday.
        state.allPlayersData.live.fixtures = [
            { event: 1, started: true, finished: true }, { event: 2, started: true, finished: false }
        ];
        assert.equal(fns.finishedGameweekCount(), 1, 'the finished count is honest about being behind');
        assert.equal(fns.playedGameweeks(), 2, 'the floors follow the football instead');
    });
});

describe('what the page says about itself', () => {
    test('reports the mix a full-time player would have', () => {
        const { fns } = load({ played: 2, priorK: 900 });
        assert.ok(Math.abs(fns.seasonBlendShare() - 0.1667) < 0.001);
        assert.equal(load({ played: 2, priorK: 0 }).fns.seasonBlendShare(), 1, 'off means off');
    });

    test('the current season takes over as it is played, and keeps a real share of the prior', () => {
        const share = played => load({ played, priorK: 900 }).fns.seasonBlendShare();
        assert.ok(share(2) < share(10) && share(10) < share(38), 'monotonic');
        assert.ok(Math.abs(share(10) - 0.5) < 0.01, 'ten gameweeks is the even point');
        // Deliberately not zero by May. A finished prior season is 38 matches of
        // evidence and is worth about a fifth of the estimate even against a full
        // current one; pretending otherwise would be throwing information away to
        // make a switch turn itself off.
        assert.ok(share(38) > 0.75 && share(38) < 0.85, `got ${share(38)}`);
    });

    test('says nothing about a blend where there is none', () => {
        assert.equal(load({ played: 2, priorK: 900 }).fns.seasonBlendActive(), true);
        assert.equal(load({ played: 2, priorK: 0 }).fns.seasonBlendActive(), false,
            'switched off');
        assert.equal(load({ played: 0, priorK: 900 }).fns.seasonBlendActive(), false,
            'pre-season the archive IS the row, which is a different statement');
    });
});
