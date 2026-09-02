/**
 * Rebuilding the squads from the league's ownership record.
 *
 * The rosters normally come from entry/{id}/event/{gw} — the picks endpoint —
 * which answers 404 "No pick history" until the league has actually played a
 * gameweek. Between draft night and the first kick-off that is every request
 * for every team, so a completed draft rendered six empty squads and a
 * "no squad found" panel wherever a squad belonged, while element-status held
 * all ninety picks the whole time.
 *
 * The join is the part worth pinning. element-status keys `owner` by
 * `entry_id`; the rosters are keyed by the league_entry `id`. They are
 * different numbers for the same manager and they look interchangeable, which
 * is exactly how a silent mis-assignment would get written.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadFunctions, installBrowserStubs } from './helpers/load-script.mjs';

// The shape the real league has: id and entry_id differ by one, and neither is
// derivable from the other in general.
const ENTRIES = [
    { id: 2286, entry_id: 2285, entry_name: 'Alpha' },
    { id: 3582, entry_id: 3581, entry_name: 'Beta' },
    { id: 64230, entry_id: 64105, entry_name: 'Gamma' }
];

function load({ ownership, rosters = new Map(), entries = ENTRIES } = {}) {
    installBrowserStubs();
    const state = {
        currentDataSource: 'live',
        allPlayersData: { live: {}, historical: {} },
        draft: {
            details: { league_entries: entries },
            ownershipByFplId: new Map(ownership),
            rostersByEntryId: rosters
        }
    };
    const fns = loadFunctions(['fillRostersFromOwnership'], { state });
    return { fns, state };
}

/** owner is the entry_id, which is what the API actually sends. */
const owned = (pairs) => pairs.flatMap(([entryId, ids]) => ids.map(id => [id, entryId]));

describe('filling squads from element-status', () => {
    test('each squad lands under its league_entry id, not its entry_id', () => {
        const { fns, state } = load({
            ownership: owned([[2285, [11, 12]], [3581, [21, 22]], [64105, [31]]])
        });
        assert.equal(fns.fillRostersFromOwnership(), 3);

        const r = state.draft.rostersByEntryId;
        assert.deepEqual([...r.get(2286)].sort((a, b) => a - b), [11, 12]);
        assert.deepEqual([...r.get(3582)].sort((a, b) => a - b), [21, 22]);
        assert.deepEqual([...r.get(64230)], [31]);
        assert.ok(!r.has(2285), 'the entry_id must never become a roster key');
        assert.ok(!r.has(3581));
    });

    test('unowned players are not a squad', () => {
        const { fns, state } = load({
            ownership: [...owned([[2285, [11]]]), [99, null], [98, null]]
        });
        fns.fillRostersFromOwnership();
        assert.deepEqual([...state.draft.rostersByEntryId.get(2286)], [11]);
        assert.equal(state.draft.rostersByEntryId.size, 1,
            'a null owner is "free agent", not a team of its own');
    });

    test('a roster the picks endpoint did return is left alone', () => {
        // That one carries the starting/bench positions and this one cannot, so
        // overwriting it would lose the lineup for a team whose picks worked.
        const existing = new Map([[2286, [1, 2, 3]]]);
        const { fns, state } = load({
            ownership: owned([[2285, [11, 12]], [3581, [21]]]),
            rosters: existing
        });
        assert.equal(fns.fillRostersFromOwnership(), 1, 'only the empty one is filled');
        assert.deepEqual([...state.draft.rostersByEntryId.get(2286)], [1, 2, 3]);
        assert.deepEqual([...state.draft.rostersByEntryId.get(3582)], [21]);
    });

    test('an empty roster from a failed request is replaced', () => {
        // The picks path writes [] on failure, which is what made every squad
        // read as "drafted nobody" rather than "not known".
        const { fns, state } = load({
            ownership: owned([[2285, [11, 12]]]),
            rosters: new Map([[2286, []]])
        });
        assert.equal(fns.fillRostersFromOwnership(), 1);
        assert.deepEqual([...state.draft.rostersByEntryId.get(2286)].sort((a, b) => a - b), [11, 12]);
    });

    test('an owner nobody in the league matches is skipped, not guessed at', () => {
        const { fns, state } = load({ ownership: owned([[999999, [11, 12]]]) });
        assert.equal(fns.fillRostersFromOwnership(), 0);
        assert.equal(state.draft.rostersByEntryId.size, 0);
    });

    test('nothing to go on is not an error', () => {
        assert.equal(load({ ownership: [] }).fns.fillRostersFromOwnership(), 0,
            'before the draft every owner is null and there is simply no squad yet');
        assert.equal(load({ ownership: owned([[2285, [11]]]), entries: [] })
            .fns.fillRostersFromOwnership(), 0,
            'without league_entries the join cannot be made at all');
    });
});
