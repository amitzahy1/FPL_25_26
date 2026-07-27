/**
 * Guards the committed completed-season snapshot. If this file is wrong the
 * table is empty or misleading on draft day, which is the one day it matters.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './helpers/load-script.mjs';

const SEASON_ID = '2025-26';
const SNAPSHOT_PATH = join(REPO_ROOT, 'data', `season-${SEASON_ID}.json`);

const snap = existsSync(SNAPSHOT_PATH)
    ? JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'))
    : null;

/** Rebuild player objects the same way the browser does. */
function hydrate(s) {
    return s.rows.map(row => Object.fromEntries(s.fields.map((f, i) => [f, row[i]])));
}

describe('season snapshot', () => {
    test('exists (the historical toggle previously pointed at a missing file)', () => {
        assert.ok(snap, `missing ${SNAPSHOT_PATH} — run: node scripts/build-season-snapshot.mjs`);
    });

    test('covers a full 38-gameweek season with 20 teams', () => {
        assert.equal(snap.totalGameweeks, 38);
        assert.equal(snap.teams.length, 20);
    });

    test('carries a usable squad of players', () => {
        const players = hydrate(snap);
        assert.ok(players.length > 400, `only ${players.length} players`);
        assert.ok(players.every(p => p.minutes > 0), 'zero-minute players must be omitted');
    });

    test('every player has the stable cross-season code, not just an id', () => {
        // FPL reassigns `id` each season; joining on it silently attributes one
        // player's history to another.
        const players = hydrate(snap);
        assert.ok(players.every(p => Number.isInteger(p.code) && p.code > 0));
        const codes = new Set(players.map(p => p.code));
        assert.equal(codes.size, players.length, 'player codes must be unique');
    });

    test('native per-90 fields are populated', () => {
        const players = hydrate(snap);
        for (const field of ['expected_goals_per_90', 'expected_assists_per_90',
            'expected_goals_conceded_per_90', 'saves_per_90',
            'clean_sheets_per_90', 'defensive_contribution_per_90']) {
            assert.ok(snap.fields.includes(field), `${field} missing from snapshot`);
            assert.ok(players.some(p => p[field] > 0), `${field} is zero for every player`);
        }
    });

    test('season totals are real, not zeros', () => {
        const players = hydrate(snap);
        const top = players.sort((a, b) => b.total_points - a.total_points)[0];
        assert.ok(top.total_points > 150, `top scorer only had ${top.total_points} points`);
        assert.ok(top.minutes > 1500);
    });

    describe('DEFCON hit-rate', () => {
        test('is null for goalkeepers, who are not DEFCON-eligible', () => {
            const keepers = hydrate(snap).filter(p => p.element_type === 1);
            assert.ok(keepers.length > 0);
            assert.ok(keepers.every(p => p.defcon_hit_rate === null),
                'goalkeepers must not receive a DEFCON hit-rate');
        });

        test('is a sane percentage for outfielders', () => {
            const outfield = hydrate(snap)
                .filter(p => p.element_type !== 1 && p.defcon_hit_rate !== null);
            assert.ok(outfield.length > 300);
            assert.ok(outfield.every(p => p.defcon_hit_rate >= 0 && p.defcon_hit_rate <= 100));
        });

        test('never claims more hits than eligible appearances', () => {
            for (const p of hydrate(snap)) {
                assert.ok(p.defcon_hits <= p.defcon_eligible_apps,
                    `${p.web_name}: ${p.defcon_hits} hits > ${p.defcon_eligible_apps} apps`);
                assert.ok(p.defcon_eligible_apps <= p.appearances);
            }
        });

        test('defensive midfielders out-rate forwards', () => {
            const players = hydrate(snap).filter(p => p.defcon_eligible_apps >= 15);
            const avg = t => {
                const g = players.filter(p => p.element_type === t);
                return g.reduce((s, p) => s + p.defcon_hit_rate, 0) / g.length;
            };
            assert.ok(avg(2) > avg(4), 'defenders should hit DEFCON more often than forwards');
        });
    });

    test('stays small enough to ship to a browser', () => {
        const bytes = readFileSync(SNAPSHOT_PATH).length;
        assert.ok(bytes < 400 * 1024, `snapshot is ${Math.round(bytes / 1024)} KB`);
    });
});
