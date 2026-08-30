/**
 * The draft room: the board on the night, and the arithmetic behind it.
 *
 * The pick order is the interesting part. FPL publishes `order_method: random`
 * and nothing else before a draft, so the order is not knowable until round one
 * has run — and once it has, it snakes. Getting that wrong points the reader at
 * the wrong pick number under a 90-second clock, which is the one failure this
 * view cannot have.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadFunctions, installBrowserStubs } from './helpers/load-script.mjs';

const FNS = ['draftStatus', 'draftDateTime', 'draftChoices', 'draftPickOrder',
    'myUpcomingPicks', 'myDraftEntryId', 'draftSquadGaps', 'draftRoomPlayer',
    'draftRoomBoard', 'draftRoomScarcity', 'scarcityWord', 'draftCountdownText'];

const DEPS = ['DRAFT_SQUAD', 'DRAFT_SQUAD_SIZE', 'DRAFT_MAX_TIERS', '_draftRoom',
    '_draftRoomIndex', 'POSITION_LABELS', 'POSITION_SINGULAR', '_median'];

/** Four managers, so the snake is visible without the fixture becoming a table. */
const ENTRIES = [
    { id: 11, entry_id: 111, entry_name: 'Alpha' },
    { id: 22, entry_id: 222, entry_name: 'Beta' },
    { id: 33, entry_id: 333, entry_name: 'Gamma' },
    { id: 44, entry_id: 444, entry_name: 'Delta' }
];

function load({ choices = [], processed = [], league = {}, myTeamId = null } = {}) {
    installBrowserStubs();
    const state = {
        currentDataSource: 'live',
        allPlayersData: { live: { processed }, historical: {} },
        draft: {
            leagueId: 932,
            myTeamId,
            details: { league: { draft_status: 'pre', max_entries: 4, ...league }, league_entries: ENTRIES },
            choices: { choices },
            entryIdToTeamName: new Map(ENTRIES.map(e => [e.id, e.entry_name])),
            ownedElementIds: new Set(),
            draftToFplIdMap: new Map(),
            replacementByPos: {}
        }
    };
    const fns = loadFunctions(FNS, { state }, DEPS);
    // The Draft/FPL id bridge and the value index both belong to other files'
    // subjects; here the ids are the same and the value is on the fixture.
    globalThis.toFplId = id => id;
    globalThis.projectedPointsOf = p => p.__value ?? null;
    return { fns, state };
}

/** A full round of picks, in the order given. */
const round = (entries, startPick, round_, elements) =>
    entries.map((entry, i) => ({ pick: startPick + i, round: round_, entry, element: elements[i] }));

describe('draft pick order', () => {
    test('is unknown until the first round has completed', () => {
        const { fns } = load({ choices: round([11, 22, 33], 1, 1, [1, 2, 3]) });
        assert.equal(fns.draftPickOrder(), null,
            'three of four picks in — the fourth seat is still unknown');
        assert.deepEqual(fns.myUpcomingPicks(11), [],
            'and with no order there is no honest answer about your next pick');
    });

    test('is read off round one once it is complete', () => {
        const { fns } = load({ choices: round([33, 11, 44, 22], 1, 1, [1, 2, 3, 4]) });
        assert.deepEqual(fns.draftPickOrder(), [33, 11, 44, 22]);
    });

    test('snakes: round two runs back up the order', () => {
        const { fns } = load({ choices: round([33, 11, 44, 22], 1, 1, [1, 2, 3, 4]) });
        // Seat 0 (id 33) picks 1st in round one and 8th in round two;
        // seat 3 (id 22) picks 4th and 5th — back-to-back, the turn.
        assert.deepEqual(fns.myUpcomingPicks(33, 2).map(p => p.pick), [8, 9]);
        assert.deepEqual(fns.myUpcomingPicks(22, 2).map(p => p.pick), [5, 12]);
    });

    test('only ever reports picks that have not happened', () => {
        const choices = [...round([33, 11, 44, 22], 1, 1, [1, 2, 3, 4]),
            ...round([22, 44, 11, 33], 5, 2, [5, 6, 7, 8])];
        const { fns } = load({ choices });
        const next = fns.myUpcomingPicks(33, 1)[0];
        assert.ok(next.pick > choices.length, `pick ${next.pick} is still ahead of ${choices.length}`);
    });

    test('a manager who is not in the league has no picks rather than seat -1', () => {
        const { fns } = load({ choices: round([33, 11, 44, 22], 1, 1, [1, 2, 3, 4]) });
        assert.deepEqual(fns.myUpcomingPicks(999), []);
    });
});

describe('squad gaps', () => {
    const squad = [
        { id: 1, position_name: 'DEF', __value: 100 },
        { id: 2, position_name: 'DEF', __value: 90 },
        { id: 3, position_name: 'MID', __value: 80 }
    ];

    test('counts what I have taken and names what is missing', () => {
        const { fns } = load({
            processed: squad,
            choices: [
                { pick: 1, round: 1, entry: 11, element: 1 },
                { pick: 2, round: 1, entry: 22, element: 2 },
                { pick: 3, round: 1, entry: 11, element: 3 }
            ]
        });
        const gaps = Object.fromEntries(fns.draftSquadGaps(11).map(g => [g.pos, g]));
        assert.equal(gaps.DEF.have, 1, "Beta's defender is not mine");
        assert.equal(gaps.MID.have, 1);
        assert.equal(gaps.GKP.missing, 2, 'a full squad needs two keepers');
        assert.equal(gaps.DEF.missing, 4);
    });

    test('with no team chosen, nothing is claimed to be mine', () => {
        const { fns } = load({ processed: squad, choices: [{ pick: 1, round: 1, entry: 11, element: 1 }] });
        assert.deepEqual(fns.draftSquadGaps(null).map(g => g.have), [0, 0, 0, 0]);
    });
});

describe('the board', () => {
    /** Two clear bands with a chasm between them, then a flat tail. */
    const players = [
        ...[100, 98, 96].map((v, i) => ({ id: i + 1, position_name: 'MID', web_name: `Top${i}`, __value: v })),
        ...[60, 59, 58, 57].map((v, i) => ({ id: i + 10, position_name: 'MID', web_name: `Mid${i}`, __value: v }))
    ];

    test('ranks by the value index and marks the drop', () => {
        const { fns } = load({ processed: players });
        const board = fns.draftRoomBoard('MID');
        assert.deepEqual(board.map(r => r.p.web_name).slice(0, 3), ['Top0', 'Top1', 'Top2']);
        const breaks = board.filter(r => r.tierBreak);
        assert.equal(breaks.length, 1, 'one chasm, one line');
        assert.equal(breaks[0].p.web_name, 'Mid0', 'drawn at the top of the lower band');
    });

    test('never draws more lines than a reader can hold', () => {
        // A ladder where every gap is a step: without a cap this is 19 tiers.
        const ladder = Array.from({ length: 20 }, (_, i) =>
            ({ id: i + 1, position_name: 'FWD', web_name: `F${i}`, __value: 100 - i * 7 }));
        const { fns } = load({ processed: ladder });
        const breaks = fns.draftRoomBoard('FWD').filter(r => r.tierBreak).length;
        assert.ok(breaks <= 5, `at most five lines, got ${breaks}`);
    });

    test('a smooth position gets no lines at all rather than five arbitrary ones', () => {
        const flat = Array.from({ length: 12 }, (_, i) =>
            ({ id: i + 1, position_name: 'GKP', web_name: `G${i}`, __value: 50 - i * 0.1 }));
        const { fns } = load({ processed: flat });
        assert.equal(fns.draftRoomBoard('GKP').filter(r => r.tierBreak).length, 0);
    });

    test('a taken player keeps his place, and says who took him', () => {
        const { fns } = load({
            processed: players,
            choices: [{ pick: 1, round: 1, entry: 22, element: 2 }]
        });
        const board = fns.draftRoomBoard('MID');
        assert.equal(board[1].p.id, 2, 'still second — the shape of what is gone is information');
        assert.equal(board[1].owner, 22);
        assert.equal(board[0].owner, null);
    });

    test('players with no value are left off rather than ranked at zero', () => {
        const { fns } = load({
            processed: [...players, { id: 99, position_name: 'MID', web_name: 'Unknown', __value: null }]
        });
        assert.ok(!fns.draftRoomBoard('MID').some(r => r.p.web_name === 'Unknown'));
    });
});

describe('scarcity', () => {
    const players = [
        ...[100, 98, 96].map((v, i) => ({ id: i + 1, position_name: 'MID', web_name: `T${i}`, __value: v })),
        ...[60, 59].map((v, i) => ({ id: i + 10, position_name: 'MID', web_name: `M${i}`, __value: v }))
    ];

    test('says nothing before the first pick', () => {
        const { fns } = load({ processed: players });
        assert.deepEqual(fns.draftRoomScarcity(), [],
            'an alarm already sounding when you sit down is one you stop reading');
    });

    test('counts down the top tier as it empties', () => {
        const { fns } = load({
            processed: players,
            choices: [{ pick: 1, round: 1, entry: 22, element: 1 }]
        });
        const mid = fns.draftRoomScarcity().find(s => s.pos === 'MID');
        assert.equal(mid.size, 3);
        assert.equal(mid.left, 2);
    });

    test('counts and nouns agree in Hebrew', () => {
        const { fns } = load();
        assert.equal(fns.scarcityWord('DEF', 1), 'נשאר מגן אחד');
        assert.equal(fns.scarcityWord('DEF', 3), 'נשארו 3 מגנים');
    });
});
