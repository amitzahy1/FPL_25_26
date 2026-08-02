/**
 * The three cards added for weekly decisions: where the classic market moved
 * this gameweek, how quality is spread inside each signal verdict, and chance
 * creation against position-relative value.
 *
 * These build Chart.js *configuration* — plain objects — so the interesting
 * parts are testable without a browser: which players are admitted, what the
 * axes carry, and the guards that make a card hide itself instead of drawing
 * something that says nothing. The smoke test covers the drawing.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadFunctions } from './helpers/load-script.mjs';

const FNS = [
    'getMatrixChartConfig', 'labelTop', 'chartAxis', 'ltrTick', 'displayNetTransfers',
    'buildMarketFlowChart', 'buildSignalSpreadChart', 'buildSignalFocusChart',
    'buildUnderlyingValueChart', 'buildTeamTargetsChart', 'signalLegendHtml',
    'barRowLabel', 'barRowTicks', 'signalFocusHeight',
    'scopeToFacet', 'chartFacetChipsHtml', 'setChartFacet', 'chartFacetValue'
];

const DEPS = ['CHART_TOOLTIP', 'SIGNAL_TONE_COLOR', 'SIGNAL_SORT_ORDER',
    'SIGNAL_RULES', 'HOLD_SIGNAL', 'CHART_FACETS', 'POSITION_COLOR', 'POSITION_LABELS'];

/** A processed row with everything all three builders read. */
function row(over = {}) {
    return {
        id: 1, web_name: 'Player', team_name: 'Team A', position_name: 'MID',
        element_type: 3, minutes: 1800, market_departed: false,
        points_per_game: '5.0', market_net_transfers: 0,
        xGI_per90: 0.45, vorp: 1.2, draft_score: 55,
        ...over
    };
}

/**
 * Verdicts are stubbed rather than derived. The rules have their own tests, and
 * what this file is checking is the chart's handling of them — the column order,
 * the colours, the jitter — which should not change if a threshold does.
 */
function load(verdicts = {}) {
    const state = { currentDataSource: 'historical', chartFacets: {} };
    const fns = loadFunctions(FNS, { state }, DEPS);
    globalThis.signalFor = p => verdicts[p.id]
        || { key: 'hold', label: 'ניטרלי', tone: 'muted', why: [] };
    // Stubbed: the real CHART_SPECS closes over every build function in the
    // file. setChartFacet only reads it to find out whether a card's facet is a
    // mode, so two entries are enough to test both branches.
    globalThis.CHART_SPECS = [
        { id: 'chart-a', facet: 'position' },
        { id: 'chart-mode', facet: 'teamSide' }
    ];
    globalThis.renderCharts = () => {};
    Object.assign(globalThis, fns);
    return { ...fns, state };
}

const points = config => config.data.datasets[0].data;

describe('transfer flow chart', () => {
    test('plots net transfers in thousands against points per match', () => {
        const { buildMarketFlowChart } = load();
        const config = buildMarketFlowChart([
            row({ id: 1, market_net_transfers: 250000, points_per_game: '6.4' }),
            row({ id: 2, market_net_transfers: -80000, points_per_game: '5.1' }),
            row({ id: 3, market_net_transfers: 12000, points_per_game: '3.0' }),
            row({ id: 4, market_net_transfers: -4000, points_per_game: '2.2' })
        ]);
        const pts = points(config);
        assert.equal(pts.length, 4);
        assert.equal(pts[0].x, 250, 'thousands, so the axis is readable');
        assert.equal(pts[0].y, 6.4);
        assert.equal(pts[1].x, -80, 'a player being sold sits left of zero');
    });

    test('hides itself when nobody has any transfer flow', () => {
        // The archived-season state: every figure zero. Drawing it would produce a
        // vertical line at x=0 that looks like a chart and answers nothing.
        const { buildMarketFlowChart } = load();
        const flat = [1, 2, 3, 4, 5].map(id => row({ id, market_net_transfers: 0 }));
        assert.equal(buildMarketFlowChart(flat), null);
    });

    test('hides itself when there is no figure at all', () => {
        const { buildMarketFlowChart } = load();
        const none = [1, 2, 3, 4, 5].map(id => row({ id, market_net_transfers: null }));
        assert.equal(buildMarketFlowChart(none), null);
    });

    test('a player who left the league is not on it', () => {
        const { buildMarketFlowChart } = load();
        const config = buildMarketFlowChart([
            row({ id: 1, market_net_transfers: 90000 }),
            row({ id: 2, market_net_transfers: 40000 }),
            row({ id: 3, market_net_transfers: -10000 }),
            row({ id: 4, market_net_transfers: 5000 }),
            row({ id: 5, web_name: 'Gone', market_net_transfers: 70000, market_departed: true })
        ]);
        assert.equal(points(config).filter(p => p.name === 'Gone').length, 0);
    });

    test('names both ends of the flow, not only the buys', () => {
        // The top-left corner — producing, and being dumped — is the reason the
        // card exists, so the label score has to be absolute in x.
        const { buildMarketFlowChart } = load();
        const many = Array.from({ length: 40 }, (_, i) =>
            row({ id: i + 1, web_name: `P${i}`, market_net_transfers: (i - 20) * 20000,
                points_per_game: '4.0' }));
        const named = points(buildMarketFlowChart(many)).filter(p => p.label);
        assert.ok(named.some(p => p.x < 0), 'a heavily sold player is named');
        assert.ok(named.some(p => p.x > 0), 'a heavily bought player is named');
    });
});

describe('signal spread chart', () => {
    const verdict = (key, label, tone) => ({ key, label, tone, why: [] });

    test('one column per verdict, in the order the table sorts them', () => {
        const { buildSignalSpreadChart } = load({
            1: verdict('rotation', 'סיכון סיבוב', 'warn'),
            2: verdict('claim', 'קח עכשיו', 'good'),
            3: verdict('buylow', 'קנייה בזול', 'info')
        });
        const config = buildSignalSpreadChart([row({ id: 1 }), row({ id: 2 }), row({ id: 3 })]);
        const labels = [0, 1, 2].map(i => config.options.scales.x.ticks.callback(i));
        assert.deepEqual(labels, ['קח עכשיו', 'קנייה בזול', 'סיכון סיבוב'],
            'most actionable first, matching SIGNAL_SORT_ORDER');
    });

    test('a verdict nobody has gets no empty column', () => {
        const { buildSignalSpreadChart } = load({
            1: verdict('claim', 'קח עכשיו', 'good'),
            2: verdict('out', 'לא זמין', 'bad')
        });
        const config = buildSignalSpreadChart([row({ id: 1 }), row({ id: 2 })]);
        assert.equal(config.options.scales.x.max, 1.6, 'two columns, not nine');
        assert.equal(config.options.scales.x.ticks.callback(2), '',
            'nothing is labelled past the last column');
    });

    test('the colour is the verdict, in the same ink as the badge', () => {
        const { buildSignalSpreadChart } = load({
            1: verdict('claim', 'קח עכשיו', 'good'),
            2: verdict('out', 'לא זמין', 'bad')
        });
        const config = buildSignalSpreadChart([row({ id: 1 }), row({ id: 2 })]);
        const colour = config.data.datasets[0].backgroundColor;
        assert.equal(colour({ raw: points(config)[0] }), '#0e7a45cc');
        assert.equal(colour({ raw: points(config)[1] }), '#b93229cc');
    });

    test('the horizontal spread is a function of the id, so it never moves', () => {
        const verdicts = {
            1: verdict('claim', 'קח עכשיו', 'good'),
            2: verdict('claim', 'קח עכשיו', 'good'),
            3: verdict('out', 'לא זמין', 'bad'),
            4: verdict('out', 'לא זמין', 'bad')
        };
        const players = [1, 2, 3, 4].map(id => row({ id }));
        const first = points(load(verdicts).buildSignalSpreadChart(players)).map(p => p.x);
        const second = points(load(verdicts).buildSignalSpreadChart(players)).map(p => p.x);
        assert.deepEqual(first, second, 'the same player lands in the same place');
        assert.equal(new Set(first).size, 4, 'and the dots do not stack into one line');
        // Column centres are the integers, so the offset from the nearest one is
        // the jitter — it must never carry a dot into the neighbouring verdict.
        assert.ok(first.every(x => Math.abs(x - Math.round(x)) <= 0.31),
            'inside its own column');
        assert.deepEqual(first.map(x => Math.round(x)), [0, 0, 1, 1]);
    });

    test('height is the draft score, and a player without one is left off', () => {
        const { buildSignalSpreadChart } = load({
            1: verdict('claim', 'קח עכשיו', 'good'),
            2: verdict('out', 'לא זמין', 'bad')
        });
        const config = buildSignalSpreadChart([
            row({ id: 1, draft_score: 62 }),
            row({ id: 2, draft_score: 30 }),
            row({ id: 3, draft_score: null }),
            row({ id: 4, draft_score: 50, market_departed: true })
        ]);
        assert.deepEqual(points(config).map(p => p.y), [62, 30]);
    });

    test('the value is in the tick, where the bar cannot cover it', () => {
        // chartjs-plugin-datalabels mirrors horizontal align on an RTL canvas, so
        // every value of `align` put the figure inside the fill. Measured, then
        // moved out of the plugin's hands entirely.
        const { buildSignalSpreadChart } = load();
        const config = buildSignalSpreadChart(
            [1, 2, 3].map(id => row({ id, web_name: `P${id}`, draft_score: 40 + id })));
        assert.deepEqual(config.data.labels,
            ['⁦P3 · 43.0⁩', '⁦P2 · 42.0⁩', '⁦P1 · 41.0⁩']);
        assert.equal(config.options.plugins.datalabels.display, false,
            'and no floating label competing with it');
    });

    test('one verdict is a ranked list, not a strip', () => {
        // Sorted by score, a scatter puts consecutive players close in *both*
        // axes, and their names collide however the labels are staggered —
        // fifty-three players came out with eighteen readable names. A bar per
        // player makes the name an axis tick, which cannot overlap anything.
        const { buildSignalSpreadChart } = load();
        const players = [1, 2, 3, 4, 5].map(id => row({ id, draft_score: 40 + id }));
        const config = buildSignalSpreadChart(players);

        assert.equal(config.type, 'bar');
        assert.equal(config.options.indexAxis, 'y');
        assert.equal(config.data.labels.length, 5);
        assert.deepEqual(config.data.datasets[0].data, [45, 44, 43, 42, 41], 'best first');
    });

    test('every name is an axis tick and none are thinned away', () => {
        const { buildSignalSpreadChart } = load();
        const config = buildSignalSpreadChart(
            Array.from({ length: 50 }, (_, i) => row({ id: i + 1, draft_score: 60 - i })));
        assert.equal(config.data.labels.length, 50);
        assert.equal(config.options.scales.y.ticks.autoSkip, false,
            'autoSkip turns a list of fifty into a list of twelve, silently');
    });

    test('the card asks for a height that fits one row per player', () => {
        const { buildSignalSpreadChart } = load();
        const small = buildSignalSpreadChart([1, 2, 3].map(id => row({ id })));
        const big = buildSignalSpreadChart(
            Array.from({ length: 50 }, (_, i) => row({ id: i + 1, draft_score: 60 - i })));
        assert.ok(big.cardHeight > small.cardHeight);
        assert.ok(small.cardHeight >= 300, 'a three-player list is not a strip either');
        assert.ok(big.cardHeight >= 50 * 15, `50 players need room, got ${big.cardHeight}`);
    });

    test('the focused axis says which verdict and how many', () => {
        const { buildSignalSpreadChart } = load({
            1: verdict('claim', 'קח עכשיו', 'good'),
            2: verdict('claim', 'קח עכשיו', 'good'),
            3: verdict('claim', 'קח עכשיו', 'good')
        });
        const config = buildSignalSpreadChart([1, 2, 3].map(id => row({ id })));
        assert.match(config.options.scales.x.title.text, /קח עכשיו/);
        assert.match(config.options.scales.x.title.text, /3 שחקנים/);
    });

    test('nobody at all is still nothing to draw', () => {
        const { buildSignalSpreadChart } = load();
        assert.equal(buildSignalSpreadChart([]), null);
        assert.equal(buildSignalSpreadChart([row({ id: 1 })]), null, 'one dot is not a spread');
    });
});

describe('per-card categories', () => {
    const squad = () => [
        row({ id: 1, position_name: 'DEF' }), row({ id: 2, position_name: 'DEF' }),
        row({ id: 3, position_name: 'MID' }), row({ id: 4, position_name: 'FWD' })
    ];

    test('a card narrows to the chosen category and nothing else does', () => {
        const { scopeToFacet, state } = load();
        const a = { id: 'chart-a', facet: 'position' };
        const b = { id: 'chart-b', facet: 'position' };
        state.chartFacets['chart-a'] = 'DEF';

        assert.equal(scopeToFacet(a, squad()).length, 2);
        assert.equal(scopeToFacet(b, squad()).length, 4,
            'the card next to it keeps the whole league');
    });

    test('a card with no category declared is never narrowed', () => {
        const { scopeToFacet, state } = load();
        state.chartFacets['chart-teams'] = 'DEF';
        assert.equal(scopeToFacet({ id: 'chart-teams' }, squad()).length, 4);
    });

    test('chips are offered only for categories that are in the data', () => {
        const { chartFacetChipsHtml } = load();
        const html = chartFacetChipsHtml({ id: 'c', facet: 'position' },
            [row({ id: 1, position_name: 'DEF' }), row({ id: 2, position_name: 'MID' })]);
        assert.match(html, /מגנים/);
        assert.match(html, /קשרים/);
        assert.doesNotMatch(html, /שוערים/, 'a chip that empties its own card');
        assert.match(html, /הכל/, 'and a way back');
    });

    test('a position the card cannot draw is not offered', () => {
        // The keeper chip on the xGI card, which excludes keepers by design.
        const { chartFacetChipsHtml } = load();
        const html = chartFacetChipsHtml(
            { id: 'c', facet: 'position', facetOmit: ['GKP'] },
            [row({ id: 1, position_name: 'GKP' }), row({ id: 2, position_name: 'MID' }),
                row({ id: 3, position_name: 'DEF' })]);
        assert.doesNotMatch(html, /שוערים/);
        assert.match(html, /קשרים/);
    });

    test('one category is no choice at all, so no chips are drawn', () => {
        const { chartFacetChipsHtml } = load();
        assert.equal(chartFacetChipsHtml({ id: 'c', facet: 'position' },
            [row({ id: 1 }), row({ id: 2 })]), '');
    });

    test('clicking the live chip clears it', () => {
        const { setChartFacet, state } = load();
        setChartFacet('chart-a', 'DEF');
        assert.equal(state.chartFacets['chart-a'], 'DEF');
        setChartFacet('chart-a', 'DEF');
        assert.equal(state.chartFacets['chart-a'], null, 'the chip row is its own way back');
    });

    test('a mode has no off position', () => {
        // Clearing a filter shows everything; clearing a mode would leave the
        // card measuring nothing at all.
        const { setChartFacet, chartFacetValue, state } = load();
        const spec = { id: 'chart-mode', facet: 'teamSide' };
        assert.equal(chartFacetValue(spec), 'att', 'the first option is the default');
        setChartFacet('chart-mode', 'def');
        assert.equal(state.chartFacets['chart-mode'], 'def');
        setChartFacet('chart-mode', 'def');
        assert.equal(chartFacetValue(spec), 'def', 'still measuring something');
    });

    test('a mode picks what is measured, not which rows are read', () => {
        // The team card computes an attack rating from the attackers and a
        // defence rating from the defenders, so filtering by side would leave
        // one half with nothing to measure.
        const { scopeToFacet, state } = load();
        state.chartFacets['chart-mode'] = 'def';
        assert.equal(scopeToFacet({ id: 'chart-mode', facet: 'teamSide' }, squad()).length, 4);
    });

    test('a stale selection falls back to everything rather than an empty card', () => {
        const { scopeToFacet, state } = load();
        state.chartFacets['chart-a'] = 'GKP';
        const scoped = scopeToFacet({ id: 'chart-a', facet: 'position' }, squad());
        assert.equal(scoped.length, 4, 'no keeper in the data, so the card still draws');
    });
});

describe('the signal key', () => {
    // The real labels, because the point of the test is that the key names the
    // verdict that is drawn and these two pairs share an ink.
    const verdict = (key, label, tone) => ({ key, label, tone, why: [] });

    test('two verdicts sharing a colour are both named on that swatch', () => {
        const { signalLegendHtml } = load({
            1: verdict('out', 'לא זמין', 'bad'),
            2: verdict('overperf', 'מימוש יתר', 'bad')
        });
        const html = signalLegendHtml([row({ id: 1 }), row({ id: 2 })]);
        // "chart-key" not "chart-keys": the wrapper span carries the plural.
        assert.equal((html.match(/class="chart-key"/g) || []).length, 1,
            'one swatch, one colour');
        // In SIGNAL_SORT_ORDER, so the names run in the same order as the columns.
        assert.match(html, /מימוש יתר \/ לא זמין/);
    });

    test('a verdict nobody has is not in the key', () => {
        const { signalLegendHtml } = load({ 1: verdict('claim', 'קח עכשיו', 'good') });
        const html = signalLegendHtml([row({ id: 1 })]);
        assert.match(html, /קח עכשיו/);
        assert.doesNotMatch(html, /לא זמין/, 'a key to a column that is not drawn');
    });

    test('a player left off the chart is left out of the key too', () => {
        const { signalLegendHtml } = load({
            1: verdict('claim', 'קח עכשיו', 'good'),
            2: verdict('out', 'לא זמין', 'bad')
        });
        // Same two exclusions the chart applies: no score, and gone from the league.
        const html = signalLegendHtml([
            row({ id: 1 }), row({ id: 2, market_departed: true })
        ]);
        assert.match(html, /קח עכשיו/);
        assert.doesNotMatch(html, /לא זמין/);
    });

    test('nothing to draw means no key rather than an empty one', () => {
        const { signalLegendHtml } = load();
        assert.equal(signalLegendHtml([]), '');
        assert.equal(signalLegendHtml(undefined), '');
    });
});

describe('who to target next', () => {
    /** A club with `n` attackers and `n` defenders, all with enough minutes. */
    function club(team, { fdr, xgi = 3, xgc = 3, n = 12, mins = 1000 } = {}) {
        const out = [];
        for (let i = 0; i < n; i++) {
            out.push(row({
                id: `${team}-a${i}`, team_name: team, position_name: 'MID',
                minutes: mins, next_5_fdr: fdr, expected_goal_involvements: xgi
            }));
            out.push(row({
                id: `${team}-d${i}`, team_name: team, position_name: 'DEF',
                minutes: mins, next_5_fdr: fdr, expected_goals_conceded: xgc
            }));
        }
        return out;
    }

    test('x is the five-game fixture run, y is the side being measured', () => {
        const { buildTeamTargetsChart } = load();
        const data = [
            ...club('Easy Attack', { fdr: 2.0, xgi: 6, xgc: 5 }),
            ...club('Hard Attack', { fdr: 4.4, xgi: 6, xgc: 5 }),
            ...club('Easy Wall', { fdr: 2.2, xgi: 1, xgc: 1 }),
            ...club('Hard Leak', { fdr: 4.2, xgi: 1, xgc: 9 })
        ];
        const att = buildTeamTargetsChart(data, 'att');
        const byTeam = Object.fromEntries(points(att).map(p => [p.team, p]));
        assert.equal(byTeam['Easy Attack'].x, 2.0, 'the club fixture run, not a per-player mean');
        assert.ok(byTeam['Easy Attack'].y > byTeam['Easy Wall'].y, 'attack rating on y');

        const def = buildTeamTargetsChart(data, 'def');
        const defByTeam = Object.fromEntries(points(def).map(p => [p.team, p]));
        assert.ok(defByTeam['Hard Leak'].y > defByTeam['Easy Wall'].y,
            'defence view measures what is conceded');
    });

    test('easy fixtures are the good end of x on both views', () => {
        const { buildTeamTargetsChart } = load();
        const data = ['A', 'B', 'C', 'D'].flatMap((t, i) => club(t, { fdr: 2 + i * 0.5 }));
        for (const side of ['att', 'def']) {
            const config = buildTeamTargetsChart(data, side);
            // Low difficulty must be the tinted-good side, or the green quadrant
            // sits behind the clubs facing the title race.
            assert.match(config.options.scales.x.title.text, /נמוך = קל/, side);
        }
    });

    test('conceding less is better, so the defence view flips the y direction', () => {
        const { buildTeamTargetsChart } = load();
        const data = ['A', 'B', 'C', 'D'].flatMap((t, i) =>
            club(t, { fdr: 2 + i * 0.4, xgc: 1 + i }));
        const config = buildTeamTargetsChart(data, 'def');
        const notes = config.options.plugins.annotation.annotations;
        // Bottom-left is easy fixtures + fewest conceded: the corner to buy from.
        assert.match(notes.labelBottomLeft.content, /לטרגט/);
        assert.match(String(notes.labelBottomLeft.backgroundColor), /34, 197, 94/,
            'and it is the green one');
    });

    test('a club with no fixture list yet is left off rather than plotted at zero', () => {
        const { buildTeamTargetsChart } = load();
        const data = [
            ...club('A', { fdr: 2 }), ...club('B', { fdr: 3 }),
            ...club('C', { fdr: 4 }), ...club('D', { fdr: 2.5 }),
            ...club('No fixtures', { fdr: 0 })
        ];
        const teams = points(buildTeamTargetsChart(data, 'att')).map(p => p.team);
        assert.ok(!teams.includes('No fixtures'));
        assert.equal(teams.length, 4);
    });

    test('half a squad is not a rating', () => {
        const { buildTeamTargetsChart } = load();
        // Two attackers is not an attack: the per-90 would be a rate for two
        // players compared against clubs rated on eleven.
        const data = [
            ...club('A', { fdr: 2 }), ...club('B', { fdr: 3 }),
            ...club('C', { fdr: 4 }), ...club('D', { fdr: 2.5 }),
            ...club('Thin', { fdr: 2, n: 1, mins: 400 })
        ];
        const teams = points(buildTeamTargetsChart(data, 'att')).map(p => p.team);
        assert.ok(!teams.includes('Thin'));
    });

    test('too few clubs to compare is nothing to draw', () => {
        const { buildTeamTargetsChart } = load();
        assert.equal(buildTeamTargetsChart(club('A', { fdr: 2 }), 'att'), null);
    });
});

describe('negative axis ticks on an RTL page', () => {
    test('a negative number is wrapped so it does not render as "25-"', () => {
        const { ltrTick, chartAxis } = load();
        assert.equal(ltrTick(-25), '⁦-25⁩');
        assert.equal(chartAxis('x').ticks.callback(-25), '⁦-25⁩');
    });

    test('the number is formatted by the scale, not stringified raw', () => {
        // A tick callback replaces Chart.js's numeric formatter, and the values
        // it receives are unrounded axis arithmetic — the first version printed
        // 1.8000000000000003 on the team chart.
        const { ltrTick } = load();
        const scale = { getLabelForValue: v => v.toFixed(1) };
        assert.equal(ltrTick.call(scale, 1.8000000000000003), '⁦1.8⁩');
    });

    test('both axes of every quadrant chart carry it', () => {
        const { buildUnderlyingValueChart } = load();
        const config = buildUnderlyingValueChart([1, 2, 3, 4].map(id => row({ id })));
        for (const axis of ['x', 'y']) {
            assert.equal(config.options.scales[axis].ticks.callback(-3),
                '⁦-3⁩', `${axis} axis`);
        }
    });
});

describe('xGI vs value chart', () => {
    test('plots the rate against VORP', () => {
        const { buildUnderlyingValueChart } = load();
        const config = buildUnderlyingValueChart([
            row({ id: 1, xGI_per90: 0.62, vorp: 1.8 }),
            row({ id: 2, xGI_per90: 0.10, vorp: 1.4 }),
            row({ id: 3, xGI_per90: 0.55, vorp: -0.3 }),
            row({ id: 4, xGI_per90: 0.08, vorp: -0.9 })
        ]);
        assert.deepEqual(points(config).map(p => [p.x, p.y]),
            [[0.62, 1.8], [0.10, 1.4], [0.55, -0.3], [0.08, -0.9]]);
        assert.match(config.options.scales.y.title.text, /VORP/);
    });

    test('goalkeepers are left out — their xGI is the job, not the player', () => {
        const { buildUnderlyingValueChart } = load();
        const config = buildUnderlyingValueChart([
            row({ id: 1 }), row({ id: 2 }), row({ id: 3 }), row({ id: 4 }),
            row({ id: 5, web_name: 'Keeper', position_name: 'GKP', element_type: 1, xGI_per90: 0 })
        ]);
        assert.equal(points(config).filter(p => p.name === 'Keeper').length, 0);
    });

    test('a thin sample is not a rate', () => {
        const { buildUnderlyingValueChart } = load();
        const thin = [1, 2, 3, 4, 5].map(id => row({ id, minutes: 120 }));
        assert.equal(buildUnderlyingValueChart(thin), null);
    });

    test('a player with no VORP is left off rather than plotted at zero', () => {
        const { buildUnderlyingValueChart } = load();
        const config = buildUnderlyingValueChart([
            row({ id: 1 }), row({ id: 2 }), row({ id: 3 }), row({ id: 4 }),
            row({ id: 5, web_name: 'Unknown', vorp: null })
        ]);
        assert.equal(points(config).filter(p => p.name === 'Unknown').length, 0);
    });
});
