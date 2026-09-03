/**
 * The comparison card's block A and block B, and the swap board.
 *
 * Three things went wrong on these surfaces in ways a screenshot caught and a
 * test had not, so each of them is pinned here.
 *
 * 1. Block A went wrong twice. First it was the single card's rails with a
 *    coloured dot per player laid over each: a dot carries no name, three of
 *    them overlap, and only the leader's figure was printed, so the block
 *    answered "who wins" and refused to say what anyone scored. Then it was a
 *    cell per player — which named everybody but made each cell its own little
 *    chart, so comparing two players meant comparing two bars that started
 *    100px apart with a number between them. It is a grouped horizontal bar
 *    chart now, and the property worth pinning is the one both earlier versions
 *    lacked: within a panel every bar starts at the same zero and runs on the
 *    same scale, so length alone is the comparison.
 *
 * 2. Block B drew raw per-gameweek lines, five deep. Per-gameweek points are the
 *    spikiest series the game produces, so every line crossed the full height of
 *    a 40px box every third week and five of them were a solid block of ink.
 *    The rolling mean is what makes them separable, and its window has to count
 *    appearances rather than gameweeks or a month out injured reads as a month of
 *    zeroes.
 *
 * 3. The swap board printed four naked figures per candidate with no sign of the
 *    figure they were supposed to beat, which is what made it read as unfinished.
 *    Every measure is drawn against the incumbent now, and a measure neither
 *    player has must say so rather than drawing an empty track.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadFunctions, installBrowserStubs, SCRIPT_SRC } from './helpers/load-script.mjs';

const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

describe('the rolling mean under block B', () => {
    const load = () => {
        installBrowserStubs();
        return loadFunctions(['rollingMean']);
    };

    test('smooths the spikes that made five raw lines one block of ink', () => {
        const { rollingMean } = load();
        // The shape the game actually produces: two points a week, then a haul.
        const raw = [2, 2, 12, 2, 2, 2, 15, 2];
        const out = rollingMean(raw, raw.map(() => true), 4);
        const spread = a => Math.max(...a) - Math.min(...a);
        assert.ok(spread(out) < spread(raw) / 2,
            `smoothing must cut the range that filled the box (${spread(raw)} → ${spread(out)})`);
        // And it stays anchored: the last point is the mean of the last four.
        assert.equal(out[7].toFixed(2), ((2 + 2 + 15 + 2) / 4).toFixed(2));
    });

    test('the window expands rather than starting empty', () => {
        const { rollingMean } = load();
        const out = rollingMean([4, 6, 8], [true, true, true], 4);
        // A line that only began at appearance four would leave three quarters of
        // a two-gameweek season blank, which is the live season today.
        assert.deepEqual(out.map(v => v.toFixed(1)), ['4.0', '5.0', '6.0']);
    });

    test('counts appearances, not gameweeks', () => {
        const { rollingMean } = load();
        const values = [10, null, null, 10];
        const played = [true, false, false, true];
        const out = rollingMean(values, played, 4);
        assert.deepEqual(out, [10, null, null, 10],
            'two weeks out must not drag the mean down as if he had played and scored nothing');
    });

    test('a player who never appeared has no line at all', () => {
        const { rollingMean } = load();
        assert.deepEqual(rollingMean([0, 0], [false, false], 4), [null, null]);
    });
});

describe('block A: a bar chart per metric', () => {
    // railFor is stubbed so the values under test are the ones being asserted.
    // The real one walks the league for a median and is covered by its own cache
    // tests; what matters here is what the matrix does with what it is handed.
    const RAILS = {
        'pts:חלוצים': { value: 6.7, med: 3.1, elite: 5.2 },
        'mins:חלוצים': { value: 64, med: 70, elite: 85 }
    };

    function load(values) {
        installBrowserStubs();
        Object.assign(globalThis, {
            escapeHtml: esc,
            teamShort: p => p.team_short,
            appearancesOf: () => 10,
            playedGameweeks: () => 10,
            resolveBenchmark: () => null,
            state: { currentDataSource: 'live' },
            railFor: (p, k) => values[`${k}:${p.id}`] || RAILS[`${k}:${p.position_name}`]
                || { value: null, med: null, elite: null }
        });
        return loadFunctions(['cmpBarsHtml', 'cmpBarSvg'], {}, ['PROFILE_METRICS']);
    }

    const PLAYERS = [
        { id: 1, web_name: 'Alpha', team_short: 'AAA', position_name: 'חלוצים', _hue: '#0f56d9' },
        { id: 2, web_name: 'Beta', team_short: 'BBB', position_name: 'חלוצים', _hue: '#0e9f5d' }
    ];

    test('every bar is named and prints its own value — the failure the dots had', () => {
        const { cmpBarsHtml } = load({
            'pts:1': { value: 6.7, med: 3.1, elite: 5.2 },
            'pts:2': { value: 2.1, med: 3.1, elite: 5.2 }
        });
        const html = cmpBarsHtml(PLAYERS, ['pts']);
        const names = [...html.matchAll(/class="cmp-bar-name"[^>]*>([^<]*)</g)].map(m => m[1].trim());
        const vals = [...html.matchAll(/class="cmp-bar-val"[^>]*>([\d.]+)/g)].map(m => m[1]);
        assert.deepEqual(names, ['Alpha', 'Beta']);
        assert.deepEqual(vals, ['6.7', '2.1']);
        assert.ok(!/<circle/.test(html), 'and no unlabelled dot survives');
    });

    test('each row carries the player\'s own colour', () => {
        const { cmpBarsHtml } = load({});
        const html = cmpBarsHtml(PLAYERS, ['pts']);
        assert.match(html, /class="cmp-bar-name" style="color:#0f56d9"\s*>Alpha/);
        assert.match(html, /class="cmp-bar-name" style="color:#0e9f5d"\s*>Beta/);
        assert.match(html, /fill="#0f56d9"/);
        assert.match(html, /fill="#0e9f5d"/);
    });

    test('bars in a panel share a zero and a scale — the whole point of the block', () => {
        const { cmpBarsHtml } = load({
            'pts:1': { value: 10, med: null, elite: null },
            'pts:2': { value: 5, med: null, elite: null }
        });
        const html = cmpBarsHtml(PLAYERS, ['pts']);
        const bars = [...html.matchAll(/<rect x="0" y="3\.5" width="([\d.]+)" height="6"\s*\n?\s*rx="3" fill="#/g)]
            .map(m => parseFloat(m[1]));
        assert.equal(bars.length, 2);
        assert.ok(Math.abs(bars[0] / bars[1] - 2) < 0.02,
            `twice the value must be twice the bar (${bars.join(' vs ')})`);
        assert.equal([...html.matchAll(/<rect x="0"/g)].length, 4,
            'every bar starts at the panel zero: two tracks and two bars, all x="0"');
    });

    test('each metric is its own panel, on its own scale', () => {
        // Minutes and xGI on one axis would flatten xGI into the floor.
        const { cmpBarsHtml } = load({
            'pts:1': { value: 6, med: null, elite: null },
            'pts:2': { value: 3, med: null, elite: null },
            'mins:1': { value: 90, med: null, elite: null },
            'mins:2': { value: 45, med: null, elite: null }
        });
        const html = cmpBarsHtml(PLAYERS, ['pts', 'mins']);
        assert.equal([...html.matchAll(/class="cmp-bar-panel"/g)].length, 2);
        const bars = [...html.matchAll(/rx="3" fill="#[0-9a-f]{6}" opacity="([\d.]+)"\/>/g)];
        assert.equal(bars.length, 4);
        // The 6-vs-3 panel and the 90-vs-45 panel must draw identical widths.
        const widths = [...html.matchAll(/<rect x="0" y="3\.5" width="([\d.]+)" height="6"\s*\n?\s*rx="3" fill="#/g)]
            .map(m => parseFloat(m[1]));
        assert.deepEqual(widths.slice(0, 2), widths.slice(2, 4),
            'the same ratio must draw the same bars whatever the units');
    });

    test('the player order is the same in every panel', () => {
        const { cmpBarsHtml } = load({
            'pts:1': { value: 1, med: null, elite: null },
            'pts:2': { value: 9, med: null, elite: null },
            'mins:1': { value: 90, med: null, elite: null },
            'mins:2': { value: 10, med: null, elite: null }
        });
        const html = cmpBarsHtml(PLAYERS, ['pts', 'mins']);
        const names = [...html.matchAll(/class="cmp-bar-name"[^>]*>([^<]*)</g)].map(m => m[1].trim());
        assert.deepEqual(names, ['Alpha', 'Beta', 'Alpha', 'Beta'],
            'sorting each panel by value would make one panel faster to read and '
            + 'eight of them impossible to read as a set');
    });

    test('each player is marked against his OWN position, not the first player\'s', () => {
        // The old block read list[0]'s median for everybody, which quietly
        // mismarked every mixed-position comparison.
        const mixed = [
            { ...PLAYERS[0], position_name: 'חלוצים' },
            { ...PLAYERS[1], position_name: 'שוערים' }
        ];
        const { cmpBarsHtml } = load({
            'pts:1': { value: 6, med: 3, elite: 5 },
            'pts:2': { value: 6, med: 1, elite: 2 }
        });
        const ticks = [...cmpBarsHtml(mixed, ['pts'])
            .matchAll(/stroke="#8e9bb1"/g)].length;
        assert.equal(ticks, 2, 'both rows carry a median tick');
        const html = cmpBarsHtml(mixed, ['pts']);
        // Same value, different medians: one reads above the median, one further
        // above it, and the tooltips must say so with different numbers.
        assert.match(html, /מעל חציון העמדה \(3\.0\)/);
        assert.match(html, /מעל חציון העמדה \(1\.0\)/);
    });

    test('the highest bar is marked, in ink as well as on the row', () => {
        const { cmpBarsHtml } = load({
            'pts:1': { value: 10, med: null, elite: null },
            'pts:2': { value: 5, med: null, elite: null }
        });
        const two = cmpBarsHtml(PLAYERS, ['pts']);
        assert.equal([...two.matchAll(/cmp-bar-row is-lead/g)].length, 1);
        assert.match(two, /cmp-bar-lead/, 'and says which one out loud');
        // Rank rides on weight, not hue: the leader's bar is solid and the
        // others are half ink, so both players keep the colour that identifies
        // them in the panels below and in the heat map.
        const op = [...two.matchAll(/opacity="([\d.]+)"/g)].map(m => parseFloat(m[1]));
        assert.deepEqual(op, [1, 0.45]);

        const one = cmpBarsHtml([PLAYERS[0]], ['pts']);
        assert.ok(!/is-lead/.test(one), 'one player leading himself is not information');
        assert.deepEqual([...one.matchAll(/opacity="([\d.]+)"/g)].map(m => parseFloat(m[1])), [1],
            'and a lone bar is not drawn at half ink');
    });

    test('a metric no one on screen has is dropped, not printed as a panel of dashes', () => {
        const { cmpBarsHtml } = load({
            'pts:1': { value: 6, med: 3, elite: 5 },
            'pts:2': { value: 4, med: 3, elite: 5 },
            'saves:1': { value: null, med: null, elite: null },
            'saves:2': { value: null, med: null, elite: null }
        });
        const html = cmpBarsHtml(PLAYERS, ['pts', 'saves']);
        assert.equal([...html.matchAll(/class="cmp-bar-panel"/g)].length, 1);
        assert.ok(!html.includes('הצלות ל-90'));
    });

    test('five players are five bars in the same panel, not five columns', () => {
        // The matrix version widened with the player count and needed a scroll
        // wrapper to survive a phone. Bars grow downwards, which nothing has to
        // scroll sideways for.
        const five = [1, 2, 3, 4, 5].map(id => ({
            id, web_name: `P${id}`, team_short: 'AAA',
            position_name: 'חלוצים', _hue: '#0f56d9'
        }));
        const vals = Object.fromEntries(five.map(p =>
            [`pts:${p.id}`, { value: p.id, med: 2, elite: 4 }]));
        const { cmpBarsHtml } = load(vals);
        const html = cmpBarsHtml(five, ['pts']);
        assert.equal([...html.matchAll(/class="cmp-bar-row/g)].length, 5);
        assert.equal([...html.matchAll(/class="cmp-bar-panel"/g)].length, 1);
        assert.ok(!html.includes('pp-log-wrap'), 'and needs no horizontal scroller');
    });
});

describe('the swap board', () => {
    const CUR = {
        id: 100, web_name: 'Weak', team_name: 'Old Town', position_name: 'חלוצים',
        smart_score: 17.6, predicted_points_1_gw: 2.0, stability_index: 40, form: 1.2,
        minutes: 430, selected_by_percent: 3, draft_score: 30, transfers_balance: 0
    };
    const cand = (id, name, score, over) => ({
        id, web_name: name, team_name: 'New City', position_name: 'חלוצים',
        smart_score: score, predicted_points_1_gw: over ? 3.5 : 1.0,
        stability_index: 61, form: 5.0, minutes: 900, selected_by_percent: 20,
        draft_score: 70, transfers_balance: 100
    });

    // Two hosts: the cards, and the panel header band the counts and the legend
    // are written into. They used to be one — a summary band of its own above
    // the first card, which put two near-empty strips between the tab and the
    // content.
    function render(group) {
        installBrowserStubs();
        const host = { innerHTML: '' };
        const aside = { innerHTML: '', hidden: true };
        Object.assign(globalThis, {
            escapeHtml: esc,
            appearancesOf: () => 5,
            miniSparkHtml: () => '<span class="trend-bars"></span>',
            getRecommendationData: () => group,
            document: {
                getElementById: id => (id === 'draftRecommendations' ? host
                    : id === 'recHeadAside' ? aside : null)
            }
        });
        loadFunctions(['renderRecommendations']).renderRecommendations();
        return { html: host.innerHTML, aside };
    }

    const GROUP = {
        r0: {
            player: CUR, position: 'FWD',
            candidates: [cand(1, 'Best', 49.8, true), cand(2, 'Mid', 43.8, true),
                cand(3, 'Third', 39.0, true)]
        }
    };

    test('the card groups the four players it is arguing about, incumbent first', () => {
        const { html } = render(GROUP);
        const ids = html.match(/data-compare-ids="([^"]+)"/)[1];
        assert.equal(ids, '100,1,2,3',
            'the click that opens the comparison must not have to be assembled by the reader');
    });

    test('every measure is drawn against the incumbent, with its direction named', () => {
        const { html } = render(GROUP);
        assert.equal([...html.matchAll(/class="mk-stat"/g)].length, 12,
            'four measures on each of three candidates');
        assert.equal([...html.matchAll(/mk-bullet/g)].length, 12,
            'and each one carries its bar');
        assert.ok([...html.matchAll(/mk-stat-val is-up/g)].length >= 9,
            'a candidate better on a measure reads as better on it');
        // The bar is the candidate and the tick is the incumbent, so both must
        // appear in the same svg.
        assert.match(html, /<rect x="0" y="2\.5" width="[\d.]+" height="4" rx="2" fill="#[0-9a-f]{6}"\/>\s*<line/);
    });

    test('a candidate worse on one measure admits it', () => {
        const worse = {
            r0: {
                player: { ...CUR, form: 9.0 },
                position: 'FWD',
                candidates: [cand(1, 'Best', 49.8, true)]
            }
        };
        const { html } = render(worse);
        assert.match(html, /mk-stat-val is-down/,
            'an upgrade overall can still lose a measure, and the card should say so');
    });

    test('a measure neither player has draws a hairline, not an empty track', () => {
        const none = {
            r0: {
                player: { ...CUR, smart_score: 0, predicted_points_1_gw: 0 },
                position: 'FWD',
                candidates: [{ ...cand(1, 'Best', 0, false), predicted_points_1_gw: 0 }]
            }
        };
        const { html } = render(none);
        assert.equal([...html.matchAll(/mk-bullet is-empty/g)].length, 2,
            'smart score and the next-gameweek projection are both absent from the archive');
        assert.match(html, /mk-stat-val is-flat">–</,
            'and the figure reads as missing rather than as zero');
    });

    test('the best candidate is named in the head band and marked in the grid', () => {
        const { html } = render(GROUP);
        assert.match(html, /class="mk-best-name">Best</);
        assert.match(html, /class="mk-best-gain">\+32\.2 ציון</);
        assert.equal([...html.matchAll(/mk-cand is-top/g)].length, 1);
    });

    test('the counts ride in the panel header, not in a band of their own', () => {
        const { html, aside } = render(GROUP);
        assert.equal(aside.hidden, false);
        assert.match(aside.innerHTML, /<b>1<\/b> חוליה חלשה/);
        assert.match(aside.innerHTML, /<b>3<\/b> מועמדים פנויים/);
        assert.match(aside.innerHTML, /הקו האפור/, 'and the legend is named once');
        assert.ok(!html.includes('mk-summary'),
            'the second band above the cards is gone');
        assert.match(html, /^\s*<section class="mk-swap/);
    });

    test('nothing to recommend says so, and takes the counts off the header', () => {
        const empty = render({});
        assert.match(empty.html, /אין המלצות להחלפה/);
        assert.equal(empty.aside.hidden, true);
        assert.equal(empty.aside.innerHTML, '',
            'a stale "4 weak links" beside an empty panel is worse than no count');
        assert.match(render({ r0: { player: CUR, candidates: [], position: 'FWD' } }).html,
            /אין המלצות להחלפה/);
    });
});

describe('the dead dot path is gone from the source', () => {
    test('railSvg takes one player and draws no circles', () => {
        // Leaving the branch in would leave the exact bug being fixed one
        // argument away from coming back.
        const rail = SCRIPT_SRC.slice(SCRIPT_SRC.indexOf('function railSvg('));
        const body = rail.slice(0, rail.indexOf('\n}\n'));
        assert.match(body, /^function railSvg\(rail\)/);
        assert.ok(!body.includes('<circle'), 'no dot may be drawn on a rail');
        assert.ok(!body.includes('dots'), 'and the parameter that drew them is gone');
    });
});
