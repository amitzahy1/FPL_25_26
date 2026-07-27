/**
 * The draft league gets a new ID every season. These tests cover the
 * resolution order so draft day needs no code change.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SCRIPT_SRC, installBrowserStubs } from './helpers/load-script.mjs';

/** Evaluate the SEASON_CONFIG block (config through getLeagueId). */
function loadSeasonConfig(search = '') {
    const stubs = installBrowserStubs(search);
    globalThis.URLSearchParams = URLSearchParams;

    const start = SCRIPT_SRC.indexOf('const SEASON_CONFIG');
    const end = SCRIPT_SRC.indexOf('// ORIGINAL CONFIG');
    assert.ok(start >= 0 && end > start, 'SEASON_CONFIG block not found');

    const factory = new Function(
        `${SCRIPT_SRC.slice(start, end)}
         return { SEASON_CONFIG, getLeagueId, readSettings, writeSettings };`
    );
    return { ...factory(), ...stubs };
}

describe('SEASON_CONFIG', () => {
    test('declares the current season and its predecessor', () => {
        const { SEASON_CONFIG } = loadSeasonConfig();
        assert.equal(SEASON_CONFIG.seasonLabel, '2026/27');
        assert.equal(SEASON_CONFIG.previousSeasonLabel, '2025/26');
        assert.equal(SEASON_CONFIG.previousSeasonId, '2025-26');
        assert.equal(SEASON_CONFIG.totalGameweeks, 38);
    });
});

describe('getLeagueId precedence', () => {
    let ctx;
    beforeEach(() => { ctx = loadSeasonConfig(); });

    test('falls back to the season default', () => {
        assert.equal(ctx.getLeagueId(), ctx.SEASON_CONFIG.defaultLeagueId);
    });

    test('a URL parameter wins', () => {
        ctx.setSearch('?league=12345');
        assert.equal(ctx.getLeagueId(), 12345);
    });

    test('a URL parameter persists, so the link is only needed once', () => {
        ctx.setSearch('?league=12345');
        ctx.getLeagueId();
        ctx.setSearch('');
        assert.equal(ctx.getLeagueId(), 12345);
    });

    test('a saved setting beats the default', () => {
        ctx.writeSettings({ leagueId: 777 });
        assert.equal(ctx.getLeagueId(), 777);
    });

    test('a non-numeric URL parameter is ignored rather than breaking lookups', () => {
        ctx.writeSettings({ leagueId: 777 });
        ctx.setSearch('?league=not-a-number');
        assert.equal(ctx.getLeagueId(), 777);
    });

    test('survives corrupted settings in localStorage', () => {
        globalThis.localStorage.setItem('fpl.settings', '{not valid json');
        assert.equal(ctx.getLeagueId(), ctx.SEASON_CONFIG.defaultLeagueId);
    });
});
