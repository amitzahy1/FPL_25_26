/**
 * Guards the Draft→Classic identity rules in matchDraftPlayers: the shared
 * `code` is the join of trust, and every id- or name-based candidate must
 * also agree on the club (team_code). The failures this prevents are silent
 * wrong-player mappings — two players who share a surname, or a Draft id
 * colliding with a different Classic player.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadFunctions } from './helpers/load-script.mjs';

const FNS = ['matchDraftPlayers', 'normalizePlayerName', 'namesMatch',
    'findFuzzyMatch', 'levenshteinDistance'];

function load() {
    const fns = loadFunctions(FNS, {});
    Object.assign(globalThis, fns);
    return fns;
}

const classic = (over = {}) => ({
    id: 1, code: 100, web_name: 'Player', first_name: 'John', second_name: 'Player',
    element_type: 3, team: 9, team_code: 43, ...over
});
const draft = (over = {}) => ({
    id: 1, code: 100, web_name: 'Player', first_name: 'John', second_name: 'Player',
    element_type: 3, team: 5, team_code: 43, ...over
});

describe('Draft→Classic identity mapping', () => {
    test('code joins exactly even when the numeric ids differ', () => {
        const { matchDraftPlayers } = load();
        // The documented divergence: Draft 555 is Silva, Classic 555 is someone
        // else entirely — only the code (100) is shared.
        const fpl = [classic({ id: 700, code: 100 }), classic({ id: 555, code: 999, first_name: 'Other', second_name: 'Person', web_name: 'Person' })];
        const dr = [draft({ id: 555, code: 100 })];
        const { matches, stats } = matchDraftPlayers(fpl, dr);
        assert.equal(matches.get(555).fplId, 700);
        assert.equal(matches.get(555).matchType, 'code');
        assert.equal(stats.code, 1);
    });

    test('numeric id + surname is rejected when the club disagrees', () => {
        const { matchDraftPlayers } = load();
        // No code on the draft side: the id collides with a same-surname player
        // at another club. That is a collision, not a match — stay unmapped.
        const fpl = [classic({ id: 42, code: 200, team_code: 7 })];
        const dr = [draft({ id: 42, code: null, team_code: 43 })];
        const { matches, stats } = matchDraftPlayers(fpl, dr);
        assert.equal(matches.size, 0);
        assert.equal(stats.club_rejected, 1);
        assert.equal(stats.unmapped, 1);
    });

    test('after a club rejection the right club can still win by name', () => {
        const { matchDraftPlayers } = load();
        // Draft 42 (no code) collides with Classic 42 = Marcos Silva at club 7,
        // but Classic 77 = Bernardo Silva at club 43 is the real match.
        const fpl = [
            classic({ id: 42, code: 200, first_name: 'Marcos', second_name: 'Silva', web_name: 'Silva', team_code: 7 }),
            classic({ id: 77, code: 201, first_name: 'Bernardo', second_name: 'Silva', web_name: 'B.Silva', team_code: 43 })
        ];
        const dr = [draft({ id: 42, code: null, first_name: 'Bernardo', second_name: 'Silva', web_name: 'B.Silva', team_code: 43 })];
        const { matches, stats } = matchDraftPlayers(fpl, dr);
        assert.equal(matches.get(42).fplId, 77);
        assert.equal(stats.club_rejected, 1, 'the Marcos Silva id-collision was refused first');
    });

    test('numeric id + surname + same club is accepted', () => {
        const { matchDraftPlayers } = load();
        const fpl = [classic({ id: 42, code: null })];
        const dr = [draft({ id: 42, code: null })];
        const { matches } = matchDraftPlayers(fpl, dr);
        assert.equal(matches.get(42).fplId, 42);
        assert.equal(matches.get(42).matchType, 'id_name');
    });

    test('fuzzy name match is refused across clubs', () => {
        const { matchDraftPlayers } = load();
        const fpl = [classic({ id: 9, code: null, first_name: 'Jordan', second_name: 'Henderson', team_code: 7 })];
        const dr = [draft({ id: 5, code: null, first_name: 'Jordan', second_name: 'Hendersen', team_code: 43 })];
        const { matches, stats } = matchDraftPlayers(fpl, dr);
        assert.equal(matches.size, 0);
        assert.equal(stats.club_rejected, 1);
    });

    test('a missing team_code on either side skips the club check', () => {
        const { matchDraftPlayers } = load();
        const fpl = [classic({ id: 42, code: null, team_code: null })];
        const dr = [draft({ id: 42, code: null, team_code: 43 })];
        const { matches } = matchDraftPlayers(fpl, dr);
        assert.equal(matches.get(42).fplId, 42, 'no club evidence is not a club conflict');
    });

    test('same surname is not an identity: two Silvas stay distinct', () => {
        const { matchDraftPlayers } = load();
        const fpl = [
            classic({ id: 10, code: 300, first_name: 'Bernardo', second_name: 'Silva', team_code: 43 }),
            classic({ id: 11, code: 301, first_name: 'Marcos', second_name: 'Silva', team_code: 7 })
        ];
        const dr = [
            draft({ id: 20, code: 300, first_name: 'Bernardo', second_name: 'Silva', team_code: 43 }),
            draft({ id: 21, code: 301, first_name: 'Marcos', second_name: 'Silva', team_code: 7 })
        ];
        const { matches } = matchDraftPlayers(fpl, dr);
        assert.equal(matches.get(20).fplId, 10);
        assert.equal(matches.get(21).fplId, 11);
    });
});
