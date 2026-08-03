/**
 * The search box is also the comparison picker, so its matching is the whole
 * interaction: type a fragment, recognise the player you meant in the first row
 * or two, tick him. A match list that buries the obvious answer is the same as
 * no match list.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadFunctions } from './helpers/load-script.mjs';

const { playerSearchMatches, playerSearchBrowse, normalizeSearch } = loadFunctions(
    ['playerSearchMatches', 'playerSearchBrowse', 'normalizeSearch'],
    {}, ['PLAYER_SEARCH_LIMIT', 'PLAYER_SEARCH_BROWSE_LIMIT']);

const p = (over = {}) => ({
    id: 1, web_name: 'Test', first_name: 'Test', second_name: 'Player',
    position_name: 'MID', total_points: 50, ...over
});

const SQUAD = [
    p({ id: 1, web_name: 'B.Fernandes', first_name: 'Bruno', second_name: 'Fernandes', total_points: 235 }),
    p({ id: 2, web_name: 'Bruno G.', first_name: 'Bruno', second_name: 'Guimarães', total_points: 140 }),
    p({ id: 3, web_name: 'Mbeumo', first_name: 'Bryan', second_name: 'Mbeumo', total_points: 180 }),
    p({ id: 4, web_name: 'Haaland', first_name: 'Erling', second_name: 'Haaland', total_points: 239 }),
    p({ id: 5, web_name: 'Ekitiké', first_name: 'Hugo', second_name: 'Ekitiké', total_points: 125 }),
    p({ id: 6, web_name: 'Aaronson', first_name: 'Brenden', second_name: 'Aaronson', total_points: 60 }),
    // Contains "br" in the middle of a word and nowhere at the start, with more
    // points than most of the squad: the ordering claim is only worth making if
    // a high-scoring contains-match still loses to a low-scoring starts-match.
    p({ id: 7, web_name: 'Cabral', first_name: 'Ze', second_name: 'Cabral', total_points: 200 })
];
const names = rows => rows.map(r => r.web_name);

describe('the player search', () => {
    test('puts the names that start with the query first', () => {
        // "br" must not bury Bruno under everyone who merely contains those two
        // letters somewhere.
        const hits = names(playerSearchMatches('br', SQUAD));
        // Every name that *starts* with "br" first — on the shirt name or on any
        // word of the full name, so Bryan Mbeumo belongs here — ordered by
        // points. Cabral merely contains it, and comes last despite outscoring
        // three of them.
        assert.deepEqual(hits,
            ['B.Fernandes', 'Mbeumo', 'Bruno G.', 'Aaronson', 'Cabral']);
    });

    test('searches the full name, not only the name on the shirt', () => {
        // "B.Fernandes" contains no "bruno" at all.
        assert.deepEqual(names(playerSearchMatches('bruno', SQUAD)), ['B.Fernandes', 'Bruno G.']);
        assert.deepEqual(names(playerSearchMatches('guim', SQUAD)), ['Bruno G.']);
    });

    test('ignores case and accents, because keyboards do', () => {
        assert.deepEqual(names(playerSearchMatches('EKITIKE', SQUAD)), ['Ekitiké']);
        assert.deepEqual(names(playerSearchMatches('ekitiké', SQUAD)), ['Ekitiké']);
        assert.equal(normalizeSearch('Ekitiké'), 'ekitike');
    });

    test('an empty query opens the list rather than closing it', () => {
        // Browsing is a real way to use this: pick goalkeepers in the filter
        // panel and the list should already be the goalkeepers, no typing needed.
        // It used to return nothing at all, so the menu simply never opened.
        assert.equal(playerSearchMatches('', SQUAD).length, SQUAD.length);
        assert.equal(playerSearchMatches('   ', SQUAD).length, SQUAD.length);
    });

    test('the browse list is ordered by FPL Draft rank, best first', () => {
        const ranked = [
            p({ id: 1, web_name: 'Third', draft_rank: 30, total_points: 300 }),
            p({ id: 2, web_name: 'First', draft_rank: 4, total_points: 40 }),
            p({ id: 3, web_name: 'Second', draft_rank: 11, total_points: 100 })
        ];
        // Rank, not points: the highest scorer of last season is third here.
        assert.deepEqual(names(playerSearchBrowse(ranked)), ['First', 'Second', 'Third']);
        assert.deepEqual(names(playerSearchMatches('', ranked)), ['First', 'Second', 'Third']);
    });

    test('unranked players fall to the bottom instead of to the top', () => {
        // A newcomer has no draft rank at all, and a missing rank must not sort
        // as zero — that would put every unknown player ahead of the field.
        const mixed = [
            p({ id: 1, web_name: 'Newcomer', draft_rank: undefined, total_points: 0 }),
            p({ id: 2, web_name: 'Ranked', draft_rank: 90, total_points: 10 }),
            p({ id: 3, web_name: 'AlsoNew', draft_rank: null, total_points: 55 })
        ];
        assert.deepEqual(names(playerSearchBrowse(mixed)), ['Ranked', 'AlsoNew', 'Newcomer'],
            'ranked first, then the unranked by what they actually scored');
    });

    test('the browse list is capped too, but higher than a search', () => {
        const many = Array.from({ length: 200 }, (_, i) =>
            p({ id: 500 + i, web_name: `B${i}`, draft_rank: i + 1 }));
        assert.equal(playerSearchBrowse(many).length, 60);
        assert.equal(playerSearchBrowse(many, 5).length, 5);
        assert.deepEqual(names(playerSearchBrowse(many, 3)), ['B0', 'B1', 'B2']);
    });

    test('caps the list, so the menu never becomes the table', () => {
        const many = Array.from({ length: 60 }, (_, i) =>
            p({ id: 100 + i, web_name: `Brown${i}`, second_name: `Brown${i}` }));
        assert.equal(playerSearchMatches('brown', many).length, 20);
        assert.equal(playerSearchMatches('brown', many, 5).length, 5);
    });

    test('survives players with missing name fields', () => {
        const rows = [p({ id: 9, web_name: 'Ghost', first_name: undefined, second_name: null })];
        assert.deepEqual(names(playerSearchMatches('gho', rows)), ['Ghost']);
    });
});
