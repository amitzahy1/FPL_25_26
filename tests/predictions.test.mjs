/**
 * Golden tests for predictPointsForFixture.
 *
 * The projection is the single most load-bearing number in the table, and every
 * defect it has had was silent: a term quietly evaluating to zero still produces
 * a plausible-looking column. Each test here pins one term to a value that is
 * wrong by an order of magnitude if the term breaks again.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadFunctions, installBrowserStubs } from './helpers/load-script.mjs';

const TEAMS = {
    1: { strength_attack_home: 1200, strength_attack_away: 1150,
         strength_defence_home: 1200, strength_defence_away: 1150 },
    2: { strength_attack_home: 1100, strength_attack_away: 1050,
         strength_defence_home: 1100, strength_defence_away: 1050 }
};

/** Home fixture for team 1 against team 2. */
const FIXTURE = { team_h: 1, team_a: 2, event: 1, finished: false };

function makePlayer(over = {}) {
    return {
        id: 1, team: 1, position_name: 'MID', element_type: 3,
        minutes: 1800, rotation_risk: 1, form: 5,
        expected_goals_per_90: 0.4, expected_assists_per_90: 0.2,
        expected_goals_conceded_per_90: 1.2,
        xGI_per90: 0.6, def_contrib_per90: 6, defcon_hit_rate: null,
        saves_per_90: 0, bonus: 10, total_points: 100,
        transfers_in_event: 0, transfers_out_event: 0,
        status: 'a', chance_of_playing_next_round: 100,
        ...over
    };
}

function load() {
    installBrowserStubs();
    const state = { teamStrengthData: TEAMS };
    return loadFunctions(['predictPointsForFixture'], { state });
}

const predict = (over = {}) => load().predictPointsForFixture(makePlayer(over), FIXTURE);

describe('prediction: goals and assists', () => {
    test('the xG term is per-90 already and is NOT divided by 90 again', () => {
        // The regression: `expected_goals_per_90 / 90` made this term ~1/90th of
        // its size, so goal threat contributed essentially nothing.
        const none = predict({ expected_goals_per_90: 0, expected_assists_per_90: 0 });
        const prolific = predict({ expected_goals_per_90: 0.8, expected_assists_per_90: 0.4 });
        // 0.8 xG x 5pts + 0.4 xA x 3pts = 5.2 before the fixture multiplier.
        assert.ok(prolific - none > 3,
            `a prolific attacker must gain multiple points, gained ${(prolific - none).toFixed(2)}`);
    });

    test('a defender is worth more per goal than a forward', () => {
        const def = predict({ position_name: 'DEF', expected_goals_per_90: 0.3 });
        const fwd = predict({ position_name: 'FWD', expected_goals_per_90: 0.3 });
        // Same xG, but 6 points a goal against 4 — before other positional terms.
        assert.ok(def > fwd - 2, 'defender goals are scored higher');
    });
});

describe('prediction: availability', () => {
    test('an injured player projects zero, however good his numbers', () => {
        assert.equal(predict({ status: 'i', expected_goals_per_90: 1.2 }), 0);
    });

    test('a suspended player projects zero', () => {
        assert.equal(predict({ status: 's' }), 0);
    });

    test('a 25% chance of playing scales the projection down', () => {
        const full = predict({});
        const doubt = predict({ chance_of_playing_next_round: 25 });
        assert.ok(doubt < full * 0.4 && doubt > 0,
            `expected roughly a quarter of ${full.toFixed(2)}, got ${doubt.toFixed(2)}`);
    });

    test('a flagged-but-unquantified doubt is discounted, not ignored', () => {
        const full = predict({});
        const doubtful = predict({ status: 'd', chance_of_playing_next_round: null });
        assert.ok(doubtful < full && doubtful > full * 0.4);
    });
});

describe('prediction: defensive contribution', () => {
    test('a high DEFCON hit-rate is worth close to the full 2 points', () => {
        const never = predict({ defcon_hit_rate: 0 });
        const always = predict({ defcon_hit_rate: 100 });
        assert.ok(Math.abs((always - never) - 2) < 0.35,
            `expected ~2 points of DEFCON, got ${(always - never).toFixed(2)}`);
    });

    test('goalkeepers get no DEFCON term — they are not eligible', () => {
        const gk = makePlayer({ position_name: 'GKP', element_type: 1, defcon_hit_rate: 100 });
        const gkNone = makePlayer({ position_name: 'GKP', element_type: 1, defcon_hit_rate: 0 });
        const f = load().predictPointsForFixture;
        assert.equal(f(gk, FIXTURE), f(gkNone, FIXTURE));
    });

    test('without per-match history it falls back to the per-90 rate', () => {
        const low = predict({ defcon_hit_rate: null, def_contrib_per90: 2 });
        const high = predict({ defcon_hit_rate: null, def_contrib_per90: 14 });
        assert.ok(high > low, 'a high DC/90 midfielder must out-project a low one');
    });
});

describe('prediction: goalkeepers', () => {
    test('saves are worth a point per three', () => {
        const quiet = predict({ position_name: 'GKP', element_type: 1, saves_per_90: 0 });
        const busy = predict({ position_name: 'GKP', element_type: 1, saves_per_90: 6 });
        assert.ok(Math.abs((busy - quiet) - 2) < 0.3,
            `6 saves should be ~2 points, got ${(busy - quiet).toFixed(2)}`);
    });

    test('a low xGC keeper out-projects a leaky one', () => {
        const solid = predict({ position_name: 'GKP', element_type: 1, expected_goals_conceded_per_90: 0.7 });
        const leaky = predict({ position_name: 'GKP', element_type: 1, expected_goals_conceded_per_90: 2.4 });
        assert.ok(solid > leaky, 'clean-sheet probability and the conceded penalty both favour the solid keeper');
    });
});

describe('prediction: playing time', () => {
    test('a bench player projects far below a nailed starter', () => {
        const starter = predict({ rotation_risk: 1, minutes: 1800 });
        const fringe = predict({ rotation_risk: 0.1, minutes: 300 });
        assert.ok(fringe < starter * 0.55,
            `fringe ${fringe.toFixed(2)} should be well under starter ${starter.toFixed(2)}`);
    });

    test('appearance points alone keep a nailed starter above two', () => {
        const bare = predict({
            expected_goals_per_90: 0, expected_assists_per_90: 0, bonus: 0,
            def_contrib_per90: 0, defcon_hit_rate: 0, form: 0
        });
        assert.ok(bare >= 2, `a starter who does nothing still appears: ${bare.toFixed(2)}`);
    });
});

describe('prediction: sanity bounds', () => {
    test('never negative and never absurd', () => {
        const extreme = predict({
            expected_goals_per_90: 3, expected_assists_per_90: 2, bonus: 100,
            defcon_hit_rate: 100, form: 15
        });
        assert.ok(extreme > 0 && extreme <= 20, `got ${extreme}`);
        const nothing = predict({
            expected_goals_per_90: 0, expected_assists_per_90: 0, bonus: 0, form: 0,
            minutes: 0, rotation_risk: 0, def_contrib_per90: 0, defcon_hit_rate: 0
        });
        assert.ok(nothing >= 0, `got ${nothing}`);
    });

    test('a missing team strength entry returns 0 rather than NaN', () => {
        const f = load().predictPointsForFixture;
        assert.equal(f(makePlayer({ team: 99 }), FIXTURE), 0);
    });
});
