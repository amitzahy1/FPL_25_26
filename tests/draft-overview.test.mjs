/**
 * The overview's two computed boards: power rankings and the league records.
 *
 * Both exist because a head-to-head table answers the wrong question. It tells
 * you who you were drawn against as much as how you played, and in a five-team
 * league drawn at random that gap is most of the table. Expected wins asks the
 * schedule-free version — what share of the league did you outscore each week —
 * and the difference between that and the wins actually banked is the luck.
 *
 * The arithmetic is worth pinning because it is the kind that looks right while
 * being wrong: ties, single-gameweek samples, and the difference between "best
 * average" and "most wins" all have to land the way the card claims they do.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadFunctions, installBrowserStubs } from './helpers/load-script.mjs';

const FNS = ['draftFinishedMatches', 'draftScoresByGw', 'computeDraftPowerRankings',
    'computeDraftRecords', '_fmtWins'];

const ENTRIES = [
    { id: 1, entry_name: 'Alpha' },
    { id: 2, entry_name: 'Beta' },
    { id: 3, entry_name: 'Gamma' },
    { id: 4, entry_name: 'Delta' }
];

/** One gameweek of two fixtures, written as the scores each manager posted. */
const gw = (event, [a, b, c, d], finished = true) => ([
    { event, finished, league_entry_1: 1, league_entry_2: 2, league_entry_1_points: a, league_entry_2_points: b },
    { event, finished, league_entry_1: 3, league_entry_2: 4, league_entry_1_points: c, league_entry_2_points: d }
]);

function load(matches, { myTeamId = null } = {}) {
    installBrowserStubs();
    const state = {
        currentDataSource: 'live',
        allPlayersData: { live: {}, historical: {} },
        draft: {
            myTeamId,
            details: { league: { current_event: 3 }, league_entries: ENTRIES, matches },
            entryIdToTeamName: new Map(ENTRIES.map(e => [e.id, e.entry_name])),
            lineupsByEntryId: new Map(),
            draftToFplIdMap: new Map()
        }
    };
    return loadFunctions(FNS, { state });
}

describe('reading the season off the scores', () => {
    test('unfinished gameweeks are not part of the record', () => {
        const fns = load([...gw(1, [50, 40, 30, 20]), ...gw(2, [90, 90, 90, 90], false)]);
        const events = fns.draftFinishedMatches().map(m => m.event);
        assert.deepEqual([...new Set(events)], [1],
            'a gameweek still being played says nothing yet');
    });

    test('every manager\'s score is indexed under its own gameweek', () => {
        const fns = load(gw(1, [50, 40, 30, 20]));
        const byGw = fns.draftScoresByGw(fns.draftFinishedMatches());
        assert.deepEqual([...byGw.get(1).entries()], [[1, 50], [2, 40], [3, 30], [4, 20]]);
    });
});

describe('power rankings', () => {
    test('rank follows the average score, not the win column', () => {
        // Beta wins twice against the weakest opponents; Alpha scores far more
        // and loses once. A head-to-head table has Beta top; this one does not.
        const fns = load([
            ...gw(1, [100, 30, 40, 20]),
            ...gw(2, [10, 30, 40, 20])
        ]);
        const rows = fns.computeDraftPowerRankings();
        assert.equal(rows[0].name, 'Alpha', 'highest average is first');
        assert.equal(rows[0].avg, 55);
        assert.equal(rows[0].wins, 1, 'and it is not because of the win column');
    });

    test('expected wins measure you against the whole league, not your fixture', () => {
        // Gamma posts the top score in both weeks: it beat all three others each
        // time, so two expected wins — regardless of who it was drawn against.
        const fns = load([
            ...gw(1, [10, 20, 90, 30]),
            ...gw(2, [10, 20, 90, 30])
        ]);
        const gamma = fns.computeDraftPowerRankings().find(t => t.name === 'Gamma');
        assert.equal(gamma.xWins, 2);
        assert.equal(gamma.wins, 2);
        assert.equal(gamma.luck, 0, 'top scorer beating everyone is not luck');
    });

    test('luck is positive when the wins outrun the scoring', () => {
        // Alpha is the second-worst scorer both weeks but is drawn against the
        // worst, so it banks two wins its scoring did not earn.
        const fns = load([
            ...gw(1, [20, 10, 90, 80]),
            ...gw(2, [20, 10, 90, 80])
        ]);
        const alpha = fns.computeDraftPowerRankings().find(t => t.name === 'Alpha');
        assert.equal(alpha.wins, 2);
        // Beat one of three others, twice over.
        assert.ok(Math.abs(alpha.xWins - 2 / 3) < 1e-9, `xWins was ${alpha.xWins}`);
        assert.ok(alpha.luck > 1, 'the draw has been kind, and the card should say so');
    });

    test('a tie is half a win on both sides of the ledger', () => {
        const fns = load(gw(1, [50, 50, 10, 20]));
        const rows = fns.computeDraftPowerRankings();
        const alpha = rows.find(t => t.name === 'Alpha');
        assert.equal(alpha.wins, 0.5, 'a drawn fixture is half a win');
        // Beat two of three, tied with one: (2 + 0.5) / 3.
        assert.ok(Math.abs(alpha.xWins - 2.5 / 3) < 1e-9, `xWins was ${alpha.xWins}`);
    });

    test('half-wins print as 0.5 rather than as floating-point noise', () => {
        const fns = load(gw(1, [50, 50, 10, 20]));
        assert.equal(fns._fmtWins(2), '2');
        assert.equal(fns._fmtWins(2.5), '2.5');
    });

    test('an empty season produces no ranking at all', () => {
        assert.deepEqual(load([]).computeDraftPowerRankings(), [],
            'nothing has happened, so there is nothing to rank');
    });
});

describe('league records', () => {
    test('the honours board names the holder of each record', () => {
        const fns = load([
            ...gw(1, [80, 40, 30, 20]),
            ...gw(2, [70, 40, 31, 5])
        ]);
        const byLabel = Object.fromEntries(fns.computeDraftRecords().map(r => [r.label, r]));

        assert.equal(byLabel['הציון הגבוה בעונה'].value, '80');
        assert.equal(byLabel['הציון הגבוה בעונה'].who, 'Alpha');

        // Gamma beat Delta by 26 in GW2; Alpha's best margin is 40 in GW1.
        assert.equal(byLabel['הניצחון הגדול'].value, '+40');
        assert.equal(byLabel['הניצחון הגדול'].who, 'Alpha');

        assert.equal(byLabel['הכפית של העונה'].value, '5');
        assert.equal(byLabel['הכפית של העונה'].who, 'Delta');
    });

    test('a streak is only a record once it is longer than a single win', () => {
        const one = load(gw(1, [80, 40, 30, 20])).computeDraftRecords();
        assert.ok(!one.some(r => r.label.includes('רצף')),
            'one win each is not a streak worth printing');

        const two = load([...gw(1, [80, 40, 30, 20]), ...gw(2, [80, 40, 30, 20])])
            .computeDraftRecords();
        const streak = two.find(r => r.label.includes('רצף'));
        assert.equal(streak.value, '2');
        assert.equal(streak.who, 'Alpha');
    });

    test('a loss resets the streak rather than pausing it', () => {
        // Both fixtures alternate, so nobody wins twice running. Note the second
        // pair flips too: leaving Gamma ahead of Delta every week gave *Gamma* a
        // three-week streak while the test was only watching Alpha.
        const fns = load([
            ...gw(1, [80, 40, 30, 20]),
            ...gw(2, [10, 40, 20, 30]),
            ...gw(3, [80, 40, 30, 20])
        ]);
        const streak = fns.computeDraftRecords().find(r => r.label.includes('רצף'));
        assert.equal(streak, undefined,
            'every manager won, lost, won — the longest run is still one');
    });

    test('nothing played, nothing claimed', () => {
        assert.deepEqual(load([]).computeDraftRecords(), []);
    });
});
