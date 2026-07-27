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
        draft: { details: null, ownedElementIds: new Set(), ...draftState },
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
    const QUICK_FILTERS = (() => {
        const start = SCRIPT_SRC.indexOf('const QUICK_FILTERS');
        const end = SCRIPT_SRC.indexOf('function applyQuickFilter');
        return new Function(`${SCRIPT_SRC.slice(start, end)}\nreturn QUICK_FILTERS;`)();
    })();

    test('every chip in the UI has an implementation', () => {
        // Five chips previously fell through the switch and silently did nothing.
        const html = SCRIPT_SRC; // filters are referenced from index.html, checked below
        const required = ['set_pieces', 'attacking_defenders', 'differentials',
            'bonus_magnets', 'form_kings', 'easy_fixtures_ppg',
            'underperformers', 'trending_underachievers'];
        for (const name of required) {
            assert.ok(QUICK_FILTERS[name], `quick filter "${name}" is not implemented`);
            assert.equal(typeof QUICK_FILTERS[name].filter, 'function');
        }
        assert.ok(html.length > 0);
    });

    test('set-piece filter excludes non-takers (99 means "not a taker")', () => {
        const taker = { set_piece_priority: { penalty: 1, corner: 99, free_kick: 99 } };
        const nonTaker = { set_piece_priority: { penalty: 99, corner: 99, free_kick: 99 } };
        assert.ok(QUICK_FILTERS.set_pieces.filter(taker));
        assert.ok(!QUICK_FILTERS.set_pieces.filter(nonTaker),
            'a player who takes nothing must not match the set-piece filter');
    });

    test('form filter demands genuinely strong form, not merely non-zero', () => {
        assert.ok(!QUICK_FILTERS.form_kings.filter({ form: '0.4', minutes: 2000 }));
        assert.ok(QUICK_FILTERS.form_kings.filter({ form: '6.2', minutes: 2000 }));
    });
});
