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
    'buildMarketFlowChart', 'buildSignalSpreadChart', 'buildUnderlyingValueChart',
    'signalLegendHtml'
];

const DEPS = ['CHART_TOOLTIP', 'SIGNAL_TONE_COLOR', 'SIGNAL_SORT_ORDER',
    'SIGNAL_RULES', 'HOLD_SIGNAL'];

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
    const state = { currentDataSource: 'historical' };
    const fns = loadFunctions(FNS, { state }, DEPS);
    globalThis.signalFor = p => verdicts[p.id]
        || { key: 'hold', label: 'ניטרלי', tone: 'muted', why: [] };
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

    test('one verdict is not a spread', () => {
        const { buildSignalSpreadChart } = load();
        assert.equal(buildSignalSpreadChart([row({ id: 1 }), row({ id: 2 })]), null,
            'every player neutral means there is nothing to compare');
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

describe('negative axis ticks on an RTL page', () => {
    test('a negative number is wrapped so it does not render as "25-"', () => {
        const { ltrTick, chartAxis } = load();
        assert.equal(ltrTick(-25), '⁦-25⁩');
        assert.equal(chartAxis('x').ticks.callback(-25), '⁦-25⁩');
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
