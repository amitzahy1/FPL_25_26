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
    'fillFromPreviousSeason', 'applyDefaultSortForSeason', 'defaultMinMinutes',
    'gwWord', 'activeSnapshot'
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
        extractDeclaration('ARCHIVE_STAT_FIELDS'),
        extractDeclaration('DEFAULT_MIN_MINUTES'),
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

describe('the previous season fills the new squad', () => {
    const live = () => ([
        // A returning player: this season's price, last season's numbers to come.
        { id: 1, code: 100, web_name: 'Haaland', now_cost: 155, selected_by_percent: '75.0',
          status: 'a', team: 13, minutes: 0, total_points: 0, expected_goals: 0, points_per_game: '0.0' },
        // A genuine newcomer — nothing in the archive at all.
        { id: 2, code: 999, web_name: 'Newboy', now_cost: 65, selected_by_percent: '1.2',
          status: 'a', team: 4, minutes: 0, total_points: 0, expected_goals: 0, points_per_game: '0.0' }
    ]);
    const archive = () => new Map([[100, {
        id: 430, code: 100, team_code: 43,
        minutes: 2953, total_points: 239, goals_scored: 30, assists: 5,
        expected_goals: 28.4, expected_goals_per_90: 0.86, bps: 900, appearances: 35,
        defcon_hit_rate: 12, points_per_game: '6.8', now_cost: 147, selected_by_percent: '62.5'
    }]]);

    test('a returning player gets last season\'s numbers and this season\'s price', () => {
        const gate = load(played(0));
        const [returning] = gate.fillFromPreviousSeason(live(), archive());
        assert.equal(returning.minutes, 2953);
        assert.equal(returning.total_points, 239);
        assert.equal(returning.expected_goals_per_90, 0.86);
        assert.equal(returning.appearances, 35);
        assert.equal(returning.defcon_hit_rate, 12);
        // form has no meaning in a finished season; points per game stands in for
        // it, the same substitution the previous-season tab makes.
        assert.equal(returning.form, '6.8');
        assert.equal(returning.no_history, false);
        // The market must stay this season's — that is the whole point of the join.
        assert.equal(returning.now_cost, 155, 'this season\'s price, not the archive\'s 147');
        assert.equal(returning.selected_by_percent, '75.0');
    });

    test('a newcomer is left empty and flagged, never invented', () => {
        const gate = load(played(0));
        const [, newcomer] = gate.fillFromPreviousSeason(live(), archive());
        assert.equal(newcomer.no_history, true);
        assert.equal(newcomer.minutes, 0);
        assert.equal(newcomer.total_points, 0);
        // He still has the one thing that is genuinely his.
        assert.equal(newcomer.now_cost, 65);
    });

    test('the live objects are not mutated', () => {
        const gate = load(played(0));
        const input = live();
        gate.fillFromPreviousSeason(input, archive());
        assert.equal(input[0].minutes, 0, 'the raw is what the market overlay reads');
    });

    test('an empty archive leaves everyone flagged rather than throwing', () => {
        const gate = load(played(0));
        const out = gate.fillFromPreviousSeason(live(), new Map());
        assert.deepEqual(out.map(p => p.no_history), [true, true]);
    });
});

describe('the minutes floor the season can reach', () => {
    test('scales with a young season and sits at the default otherwise', () => {
        // 120 is unreachable after one gameweek, which emptied the whole table.
        assert.equal(load(played(1)).defaultMinMinutes(), '45');
        assert.equal(load(played(2)).defaultMinMinutes(), '90');
        assert.equal(load(played(3)).defaultMinMinutes(), '120');
        assert.equal(load(played(20)).defaultMinMinutes(), '120');
        // Pre-season the minutes shown are last season's, so the full floor is
        // right — and it doubles as the newcomer filter.
        assert.equal(load(played(0)).defaultMinMinutes(), '120');
        assert.equal(load(played(0), { currentDataSource: 'historical' }).defaultMinMinutes(), '120');
    });
});

describe('counting gameweeks in Hebrew', () => {
    test('one gameweek is a word, not a digit', () => {
        const gate = load(played(1));
        assert.equal(gate.gwWord(1), 'מחזור אחד');
        assert.equal(gate.gwWord(3), '3 מחזורים');
        assert.equal(gate.gwWord(0), '0 מחזורים');
    });
});

describe('the archive join carries its own keys', () => {
    const liveOne = over => ([{
        id: 411, code: 100, web_name: 'Haaland', now_cost: 155,
        selected_by_percent: '75.0', status: 'a', team: 13, team_code: 43,
        minutes: 0, total_points: 0, ...over
    }]);
    const archive = new Map([[100, {
        id: 430, code: 100, team_code: 43, minutes: 2953, total_points: 239,
        points_per_game: '6.8'
    }]]);

    test('the per-match logs are keyed by last season\'s id, not this season\'s', () => {
        // Player ids are reassigned every season: this one is 411 now and was 430.
        // getMatchLog reads history_id, so without it the trend chart would have
        // drawn somebody else's matches under his name.
        const gate = load(played(0));
        const [p] = gate.fillFromPreviousSeason(liveOne(), archive);
        assert.equal(p.id, 411, 'the row is still this season\'s player');
        assert.equal(p.history_id, 430, 'his logs are filed under last season\'s id');
    });

    test('a player who changed clubs is flagged, with the club he left', () => {
        // A defender's clean sheets belong to his old back four, so a number that
        // moved with him predicts something different from one that did not.
        const gate = load(played(0));
        const [stayed] = gate.fillFromPreviousSeason(liveOne(), archive);
        assert.equal(stayed.moved_club, false, 'same club code, no flag');

        const [moved] = gate.fillFromPreviousSeason(liveOne({ team_code: 8 }), archive);
        assert.equal(moved.moved_club, true);
        assert.equal(moved.history_team_code, 43, 'the club the numbers were earned at');
    });

    test('a missing club code on either side is not a transfer', () => {
        const gate = load(played(0));
        const [noCode] = gate.fillFromPreviousSeason(liveOne({ team_code: null }), archive);
        assert.equal(noCode.moved_club, false, 'unknown is not the same as moved');
    });
});

describe('which season\'s match logs are in force', () => {
    const snap = { gwLogs: {}, logFields: ['gw'], logStride: 1 };

    test('the source being viewed, when it has its own', () => {
        const gate = load(played(0), {
            currentDataSource: 'historical',
            allPlayersData: { live: { raw: null }, historical: { raw: { __snapshot: snap } } }
        });
        assert.equal(gate.activeSnapshot(), snap);
    });

    test('pre-season on the new tab falls back to the archive', () => {
        // Every total on that page is last season's, so the per-gameweek breakdown
        // behind those totals has to be last season's too. Without this the trend
        // chart and every windowed metric sat blank on a page full of figures.
        const gate = load(played(0), {
            currentDataSource: 'live',
            allPlayersData: {
                live: { raw: { events: played(0) } },
                historical: { raw: { __snapshot: snap } }
            }
        });
        assert.equal(gate.activeSnapshot(), snap);
    });

    test('but not once the season has started', () => {
        // From GW1 the live season keeps its own record and must not borrow.
        const gate = load(played(1), {
            currentDataSource: 'live',
            allPlayersData: {
                live: { raw: { events: played(1) } },
                historical: { raw: { __snapshot: snap } }
            }
        });
        assert.equal(gate.activeSnapshot(), null);
    });
});
