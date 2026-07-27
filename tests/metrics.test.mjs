/**
 * Regression tests for the metric bugs that silently corrupted the rankings.
 * Each test names the defect it prevents from coming back.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadFunctions, installBrowserStubs } from './helpers/load-script.mjs';

function makePlayer(over = {}) {
    return {
        id: 1, code: 1, web_name: 'Test', element_type: 3, team: 1,
        minutes: 1800, starts: 20, total_points: 100, points_per_game: 5,
        goals_scored: 5, assists: 5, clean_sheets: 4, goals_conceded: 10,
        saves: 0, bonus: 10, bps: 300, form: 5,
        influence: 500, creativity: 500, threat: 500, ict_index: 150,
        expected_goals: 5, expected_assists: 5, expected_goal_involvements: 10,
        expected_goals_conceded: 12,
        clearances_blocks_interceptions: 60, tackles: 30, recoveries: 90,
        transfers_in_event: 0, transfers_out_event: 0,
        selected_by_percent: 10, now_cost: 75, dreamteam_count: 0,
        status: 'a', chance_of_playing_next_round: 100,
        ...over
    };
}

function loadPipeline() {
    installBrowserStubs();
    const state = {
        teamsData: { 1: { name: 'Team A', short_name: 'TMA' } },
        teamStrengthData: { 1: { strength_attack_home: 1200, strength_attack_away: 1150, strength_defence_home: 1200, strength_defence_away: 1150 } },
        allPlayersData: { live: { raw: null, fixtures: null }, historical: { raw: null, fixtures: null } },
        currentDataSource: 'live'
    };
    return loadFunctions(
        ['calculatePercentiles', 'getNestedValue', 'getPositionName', 'preprocessPlayerData'],
        { state, config: { setPieceTakers: {} }, SEASON_CONFIG: { totalGameweeks: 38 } }
    );
}

describe('calculatePercentiles', () => {
    test('best value gets 100, worst gets 0 (was inverted: best got 0)', () => {
        const { calculatePercentiles } = loadPipeline();
        const players = [{ v: 1 }, { v: 5 }, { v: 3 }];
        calculatePercentiles(players, 'v', false); // descending: higher is better

        const byV = Object.fromEntries(players.map(p => [p.v, p.percentiles.v]));
        assert.equal(byV[5], 100, 'highest value must be the 100th percentile');
        assert.equal(byV[1], 0, 'lowest value must be the 0th percentile');
        assert.equal(byV[3], 50);
    });

    test('ascending metrics treat the lowest value as best (e.g. price)', () => {
        const { calculatePercentiles } = loadPipeline();
        const players = [{ cost: 4 }, { cost: 13 }, { cost: 8 }];
        calculatePercentiles(players, 'cost', true);

        const byCost = Object.fromEntries(players.map(p => [p.cost, p.percentiles.cost]));
        assert.equal(byCost[4], 100, 'cheapest is best when ascending');
        assert.equal(byCost[13], 0);
    });

    test('single player does not divide by zero', () => {
        const { calculatePercentiles } = loadPipeline();
        const players = [{ v: 7 }];
        calculatePercentiles(players, 'v', false);
        assert.equal(players[0].percentiles.v, 100);
        assert.ok(Number.isFinite(players[0].percentiles.v));
    });
});

describe('preprocessPlayerData per-90 fields', () => {
    test('emits the *_per_90 aliases that calculateAdvancedScores reads', () => {
        const { preprocessPlayerData } = loadPipeline();
        const [p] = preprocessPlayerData([makePlayer()], {});

        // These four resolved to undefined, zeroing the quality term of
        // draft_score and leaving the goalkeeper matrix without axes.
        for (const key of ['saves_per_90', 'clean_sheets_per_90', 'creativity_per_90', 'threat_per_90']) {
            assert.notEqual(p[key], undefined, `${key} must be defined`);
            assert.ok(Number.isFinite(p[key]), `${key} must be numeric`);
        }
    });

    test('prefers the API native per-90 value over recomputing from totals', () => {
        const { preprocessPlayerData } = loadPipeline();
        const [p] = preprocessPlayerData([makePlayer({
            expected_goals: 5,             // would derive to 0.25 per 90
            expected_goals_per_90: 0.99    // authoritative
        })], {});
        assert.equal(p.expected_goals_per_90, 0.99);
    });

    test('derives per-90 from totals when the native field is absent', () => {
        const { preprocessPlayerData } = loadPipeline();
        const [p] = preprocessPlayerData([makePlayer({ minutes: 900, expected_goals: 5 })], {});
        assert.ok(Math.abs(p.expected_goals_per_90 - 0.5) < 1e-9);
    });

    test('DEFCON counts recoveries for MID/FWD and excludes them for DEF', () => {
        const { preprocessPlayerData } = loadPipeline();
        const base = { minutes: 900, clearances_blocks_interceptions: 20, tackles: 10, recoveries: 30 };

        const [mid] = preprocessPlayerData([makePlayer({ ...base, element_type: 3 })], {});
        const [def] = preprocessPlayerData([makePlayer({ ...base, element_type: 2 })], {});

        // MID uses CBIRT = 20+10+30 = 60 over 10x90 => 6.0
        assert.ok(Math.abs(mid.defensive_contribution_per_90 - 6) < 1e-9, `mid got ${mid.defensive_contribution_per_90}`);
        // DEF uses CBIT = 20+10 = 30 over 10x90 => 3.0
        assert.ok(Math.abs(def.defensive_contribution_per_90 - 3) < 1e-9, `def got ${def.defensive_contribution_per_90}`);
    });

    test('does not double-count interceptions already inside CBI', () => {
        const { preprocessPlayerData } = loadPipeline();
        const [p] = preprocessPlayerData([makePlayer({
            minutes: 900, element_type: 2,
            clearances_blocks_interceptions: 20, tackles: 10,
            interceptions: 15 // legacy field; must be ignored
        })], {});
        assert.ok(Math.abs(p.defensive_contribution_per_90 - 3) < 1e-9);
    });

    test('price is scaled once even if preprocessing runs twice', () => {
        const { preprocessPlayerData } = loadPipeline();
        const player = makePlayer({ now_cost: 75 });
        preprocessPlayerData([player], {});
        preprocessPlayerData([player], {});
        assert.equal(player.now_cost, 7.5);
    });
});
