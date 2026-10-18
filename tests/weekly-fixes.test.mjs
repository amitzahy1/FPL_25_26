/**
 * Guards for the 2026-10 review fixes:
 *  - market-flow chart: evidence floor (cameos cannot headline a production
 *    chart) and Draft ownership dimming, matching the opportunity board.
 *  - historicalPicksCacheTtl: played gameweeks cache for a day, the current
 *    (still editable) one for minutes.
 *  - structural: the removed ML export column stays removed, the
 *    projected-lineup fallback in renderMyLineup carries its visible marker,
 *    and the phone-specific pitch readability rules in mobile.css keep the
 *    specificity they need to win over style.css.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadFunctions, extractFunction, SCRIPT_SRC } from './helpers/load-script.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const MOBILE_CSS = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'mobile.css'), 'utf8');

const FNS = ['getMatrixChartConfig', 'labelTop', 'labelBudget', 'chartAxis', 'ltrTick',
    'displayNetTransfers', 'buildMarketFlowChart', 'historicalPicksCacheTtl',
    'sampleMinutes', 'displayMinutes'];
const DEPS = ['CHART_TOOLTIP', 'LABEL_CANDIDATES', 'POSITION_COLOR'];

function row(over = {}) {
    return {
        id: 1, web_name: 'Player', team_name: 'Team A', position_name: 'MID',
        element_type: 3, minutes: 1800, market_departed: false,
        points_per_game: '5.0', market_net_transfers: 0,
        ...over
    };
}

function load(over = {}) {
    const state = { currentDataSource: 'historical', chartFacets: {},
        trendWindow: 5, trendGws: [], draft: { ownedElementIds: new Set() }, ...over };
    const fns = loadFunctions(FNS, { state }, DEPS);
    globalThis.scaleMinutes = target => target;
    globalThis.playedGameweeks = () => 38;
    // sampleMinutes/displayMinutes load real: stubbing the sample to current
    // minutes is what hid the prior-backed cameo from the gate's tests.
    Object.assign(globalThis, fns);
    return { ...fns, state };
}

const points = config => config.data.datasets[0].data;

describe('market-flow evidence floor', () => {
    test('a cameo with a huge PPG is excluded, the regulars stay', () => {
        const { buildMarketFlowChart } = load();
        const config = buildMarketFlowChart([
            row({ id: 1, market_net_transfers: 90000, points_per_game: '6.0' }),
            row({ id: 2, market_net_transfers: 40000 }),
            row({ id: 3, market_net_transfers: -10000 }),
            row({ id: 4, market_net_transfers: 5000 }),
            // One match, one goal: 16.0 PPG on 45 minutes. Without the floor
            // this is the top of the chart; with it, it never enters.
            row({ id: 5, web_name: 'Cameo', minutes: 45, market_net_transfers: 80000, points_per_game: '16.0' })
        ]);
        assert.equal(points(config).filter(p => p.name === 'Cameo').length, 0);
        assert.equal(points(config).length, 4);
    });

    test('the floor hides the card rather than draw three players', () => {
        const { buildMarketFlowChart } = load();
        const few = [1, 2, 3, 4].map(id =>
            row({ id, minutes: 100, market_net_transfers: id * 10000 }));
        assert.equal(buildMarketFlowChart(few), null);
    });
});

describe('market-flow ownership dimming', () => {
    test('owned players are faded, free agents are not', () => {
        const { buildMarketFlowChart, state } = load();
        state.draft.ownedElementIds = new Set([1, 2]);
        const config = buildMarketFlowChart([
            row({ id: 1, market_net_transfers: 90000 }),
            row({ id: 2, market_net_transfers: 40000 }),
            row({ id: 3, market_net_transfers: -10000 }),
            row({ id: 4, market_net_transfers: 5000 })
        ]);
        const ds = config.data.datasets[0];
        const alphaOf = i => {
            const color = ds.backgroundColor({ raw: ds.data[i] });
            return parseFloat(color.match(/,\s*([\d.]+)\)$/)[1]);
        };
        assert.equal(alphaOf(0), 0.18, 'owned player recedes');
        assert.equal(alphaOf(2), 0.85, 'free agent keeps prominence');
    });

    test('before the draft, nobody is faded', () => {
        const { buildMarketFlowChart } = load();
        const config = buildMarketFlowChart([
            row({ id: 1, market_net_transfers: 90000 }),
            row({ id: 2, market_net_transfers: 40000 }),
            row({ id: 3, market_net_transfers: -10000 }),
            row({ id: 4, market_net_transfers: 5000 })
        ]);
        const ds = config.data.datasets[0];
        const alphas = ds.data.map(p => parseFloat(ds.backgroundColor({ raw: p }).match(/,\s*([\d.]+)\)$/)[1]));
        assert.ok(alphas.every(a => a === 0.85), 'no roster known, nobody fades');
    });

    test('a missing draft state does not break the chart', () => {
        const { buildMarketFlowChart } = load({ draft: undefined });
        const config = buildMarketFlowChart([
            row({ id: 1, market_net_transfers: 90000 }),
            row({ id: 2, market_net_transfers: 40000 }),
            row({ id: 3, market_net_transfers: -10000 }),
            row({ id: 4, market_net_transfers: 5000 })
        ]);
        assert.ok(config, 'chart still builds');
    });
});

describe('historical picks cache TTL', () => {
    test('played gameweeks cache for a day, the current one for minutes', () => {
        const { historicalPicksCacheTtl } = load();
        assert.equal(historicalPicksCacheTtl(3, 8), 1440);
        assert.equal(historicalPicksCacheTtl(8, 8), 10);
    });
});

describe('structural regression guards', () => {
    test('the dead ML export column stays removed', () => {
        assert.ok(!SCRIPT_SRC.includes('ml_prediction'),
            'ml_prediction is referenced again — the predictor module was removed, nothing assigns it');
    });

    test('the projected-lineup fallback carries a visible marker', () => {
        const fnSrc = extractFunction('renderMyLineup');
        assert.ok(fnSrc.includes('lineup-projected-notice'),
            'renderMyLineup falls back to a computed eleven with no visible marker');
        assert.ok(fnSrc.includes('isProjectedLineup'));
    });

    test('phone pitch labels keep the specificity to beat the desktop rule', () => {
        // style.css sizes .pitch-container .player-name for desktop with a
        // more specific selector; a plain .player-name override in mobile.css
        // loses to it and long names clip (Anderson -> nderson). The mobile
        // rule must stay scoped to .pitch-container to win.
        assert.ok(MOBILE_CSS.includes('.pitch-container .player-name'),
            'mobile.css player-name override lost its .pitch-container scope — phone labels clip again');
    });

    test('bench strip wraps on phones', () => {
        // Four bench pills in a nowrap strip overflow a phone-width container
        // and the edge names clip (Thiago -> hiago).
        const block = MOBILE_CSS.match(/\.bench-strip\s*\{[^}]*\}/);
        assert.ok(block && /flex-wrap:\s*wrap/.test(block[0]),
            'mobile.css .bench-strip no longer wraps — bench names clip on phones');
    });
});
