/**
 * When the app is allowed to believe the new season.
 *
 * The gate used to demand five finished gameweeks, so on the morning after the
 * opening weekend the page still opened on last season with no hint that
 * anything had changed. It now flips the moment a ball has been kicked — and
 * because one gameweek of per-90 rates is not five, the thinness of the sample
 * has to be stated rather than waited out.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractFunction, extractDeclaration } from './helpers/load-script.mjs';

const FUNCTIONS = [
    'currentSeasonIsTooEarly', 'seasonSampleIsThin', 'finishedGameweekCount',
    'getCompletedGWCount', 'benchMinMinutes', 'stripUnplayedSeasonStats',
    'applyDefaultSortForSeason'
];

function load(events, over = {}) {
    globalThis.state = {
        allPlayersData: { live: { raw: events ? { events } : null }, historical: {} },
        currentDataSource: 'live',
        userSorted: false,
        sortKey: 'draft_score',
        sortDirection: 'desc',
        ...over
    };
    const body = [
        extractDeclaration('SEASON_CONFIG'),
        extractDeclaration('UNPLAYED_STAT_FIELDS'),
        extractDeclaration('BENCH_MIN_MINUTES'),
        ...FUNCTIONS.map(n => extractFunction(n))
    ].join('\n');
    return new Function(`${body}\nreturn { ${FUNCTIONS.join(', ')}, SEASON_CONFIG };`)();
}

const played = n => Array.from({ length: 38 }, (_, i) => ({ finished: i < n }));

describe('the season gate', () => {
    test('holds only while nothing has been played', () => {
        const none = load(played(0));
        assert.equal(none.currentSeasonIsTooEarly(), true);

        // One finished gameweek is enough. It used to take five, which is why the
        // page still opened on last season the day after the season started.
        const one = load(played(1));
        assert.equal(one.currentSeasonIsTooEarly(), false);
        assert.equal(one.finishedGameweekCount(), 1);
    });

    test('a provisional finish counts, because the points are already in', () => {
        const gate = load([{ finished: false, finished_provisional: true }]);
        assert.equal(gate.currentSeasonIsTooEarly(), false);
        assert.equal(gate.finishedGameweekCount(), 1);
    });

    test('no bootstrap at all is treated as not started', () => {
        const gate = load(null);
        assert.equal(gate.currentSeasonIsTooEarly(), true);
        assert.equal(gate.finishedGameweekCount(), 0);
    });

    test('a young season is shown but flagged as thin', () => {
        for (const n of [1, 2, 3, 4]) {
            const gate = load(played(n));
            assert.equal(gate.seasonSampleIsThin(), true, `${n} gameweeks is thin`);
            assert.equal(gate.currentSeasonIsTooEarly(), false, `${n} gameweeks is still shown`);
        }
        // Five is where the app stops apologising for the sample.
        assert.equal(load(played(5)).seasonSampleIsThin(), false);
        // And nothing played is not "thin" — it is a different state with its own
        // message, so the two must not both be true.
        assert.equal(load(played(0)).seasonSampleIsThin(), false);
    });

    test('the benchmark floor comes down with a young season and back up after', () => {
        // Nobody can have 270 minutes after two gameweeks, so the elite bar would
        // have no pool at all and every % column would silently blank.
        assert.equal(load(played(2)).benchMinMinutes(), 120);
        assert.equal(load(played(1)).benchMinMinutes(), 90, 'never below one full match');
        assert.equal(load(played(5)).benchMinMinutes(), 270);
    });
});

describe('the carried-over stats', () => {
    test('last season\'s numbers are stripped from an unplayed season', () => {
        const gate = load(played(0));
        // This is the real shape of the FPL bootstrap between seasons: the squad
        // and the price are new, every performance field is last season's.
        const [clean] = gate.stripUnplayedSeasonStats([{
            id: 1, web_name: 'Haaland', now_cost: 155, selected_by_percent: '75.0',
            status: 'a', team_code: 43,
            minutes: 2953, total_points: 239, goals_scored: 30, assists: 5,
            expected_goals: 28.4, expected_goals_per_90: 0.86, bps: 900,
            ict_index: 400, points_per_game: '6.8', form: '5.0'
        }]);
        for (const f of ['minutes', 'total_points', 'goals_scored', 'assists',
            'expected_goals', 'expected_goals_per_90', 'bps', 'ict_index',
            'points_per_game', 'form']) {
            assert.equal(clean[f], 0, `${f} must not carry over`);
        }
        // The market is genuinely this season's and must survive untouched.
        assert.equal(clean.now_cost, 155);
        assert.equal(clean.selected_by_percent, '75.0');
        assert.equal(clean.status, 'a');
        assert.equal(clean.web_name, 'Haaland');
    });

    test('the raw player objects are not mutated', () => {
        const gate = load(played(0));
        const original = { id: 1, minutes: 2953, total_points: 239 };
        gate.stripUnplayedSeasonStats([original]);
        assert.equal(original.minutes, 2953, 'the market overlay still reads the raw');
        assert.equal(original.total_points, 239);
    });
});

describe('the opening sort', () => {
    test('pre-season opens on draft rank, since nothing else exists yet', () => {
        // draft_score is built from points and minutes, so before a ball is kicked
        // it is zero for all 567 players and the order would be whatever the API
        // happened to return.
        const gate = load(played(0));
        gate.applyDefaultSortForSeason();
        assert.equal(globalThis.state.sortKey, 'draft_rank');
        assert.equal(globalThis.state.sortDirection, 'asc', 'rank 1 is the best');
    });

    test('a played season opens on the draft score', () => {
        const gate = load(played(6));
        gate.applyDefaultSortForSeason();
        assert.equal(globalThis.state.sortKey, 'draft_score');
        assert.equal(globalThis.state.sortDirection, 'desc');
    });

    test('and a reader who has sorted keeps their order across a season switch', () => {
        const gate = load(played(0), { userSorted: true, sortKey: 'xGI_per90', sortDirection: 'desc' });
        gate.applyDefaultSortForSeason();
        assert.equal(globalThis.state.sortKey, 'xGI_per90');
    });

    test('the archive is never pre-season, whatever the live gate says', () => {
        const gate = load(played(0), { currentDataSource: 'historical' });
        gate.applyDefaultSortForSeason();
        assert.equal(globalThis.state.sortKey, 'draft_score');
    });
});
