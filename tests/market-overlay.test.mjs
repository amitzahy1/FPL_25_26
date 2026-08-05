/**
 * The pre-season market overlay: this season's price and ownership joined onto
 * last season's rows.
 *
 * The join is the part worth guarding. `id` is reassigned every season — the
 * ownership join learned that the hard way (see toFplId) — so every test here
 * deliberately gives the two seasons conflicting ids and matching codes.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadFunctions, installBrowserStubs } from './helpers/load-script.mjs';

const MARKET_FNS = [
    'marketIndex', 'marketOverlayActive', 'clearMarketFields', 'percentileRanker',
    'applyMarketOverlay', 'displayCost', 'displayOwnership', 'displayNetTransfers'
];

const CELL_FNS = ['priceCellHtml', 'ownershipCellHtml', 'ownershipCellTitle', 'marketBadgesHtml'];

/**
 * A processed row as it exists on the previous-season tab: the snapshot's own
 * id, the snapshot's price already divided by ten by preprocessPlayerData.
 */
function snapshotRow(over = {}) {
    return {
        id: 1, code: 100, web_name: 'Player', team: 5, team_code: 43,
        now_cost: 7.5, selected_by_percent: '12.0',
        points_per_game_90: 4.0, minutes: 2000,
        ...over
    };
}

/** A live bootstrap element: same code, different id, new price. */
function liveElement(over = {}) {
    return {
        id: 777, code: 100, web_name: 'Player', team: 9, team_code: 43,
        now_cost: 90, selected_by_percent: '31.5', status: 'a', news: '',
        ...over
    };
}

function load({ source = 'historical', live = [liveElement()] } = {}) {
    installBrowserStubs();
    const state = {
        currentDataSource: source,
        allPlayersData: {
            live: { raw: live ? { elements: live } : null, processed: null },
            historical: { raw: null, processed: null }
        }
    };
    // _marketIndex is the module-level cache marketIndex() memoises into. Pulling
    // it in per load() also gives each test its own, so one test's bootstrap
    // cannot be served to the next.
    const fns = loadFunctions(MARKET_FNS.concat(CELL_FNS), { state },
        ['SEASON_CONFIG', '_marketIndex']);
    // escapeHtml lives with the rendering helpers, far from this slice; the
    // title test cares that the text is escaped at all, not how.
    globalThis.escapeHtml = v => String(v).replace(/[&<>"]/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    Object.assign(globalThis, fns);
    return { ...fns, state };
}

describe('market overlay join', () => {
    test('joins on code, not on id (ids are reassigned every season)', () => {
        const { applyMarketOverlay } = load();
        const rows = [snapshotRow({ id: 1, code: 100 })];
        const matched = applyMarketOverlay(rows);

        assert.equal(matched, 1);
        assert.equal(rows[0].market_cost, 9.0, "must take the live element's price");
        assert.equal(rows[0].market_ownership, 31.5);
        assert.equal(rows[0].market_departed, false);
    });

    test('a player missing from the new bootstrap is marked as having left', () => {
        const { applyMarketOverlay } = load({ live: [liveElement({ code: 999 })] });
        const rows = [snapshotRow({ code: 100 })];
        applyMarketOverlay(rows);

        assert.equal(rows[0].market_departed, true, 'not in the new season = not draftable');
        assert.equal(rows[0].market_cost, null);
        assert.equal(rows[0].hype_gap, null);
    });

    test('a stub left behind for a departed player counts as having left', () => {
        // FPL does not always remove the row: it keeps status 'u' with news like
        // "has departed the club as a free agent", still carrying a club and a
        // price. Read literally that is a summer transfer to a team he will never
        // play for — which is exactly how one turned up under the 🔁 chip.
        const { applyMarketOverlay } = load({
            live: [liveElement({ code: 100, team_code: 99, status: 'u', news: 'has departed the club as a free agent.' })]
        });
        const rows = [snapshotRow({ code: 100, team_code: 43 })];
        applyMarketOverlay(rows);

        assert.equal(rows[0].market_departed, true);
        assert.equal(rows[0].market_moved_club, false, 'not a transfer — he is out of the league');
        assert.equal(rows[0].market_cost, null);
    });

    test('price delta is this season minus last, to one decimal', () => {
        const { applyMarketOverlay } = load();
        const rows = [snapshotRow({ now_cost: 7.5 })]; // live is 9.0
        applyMarketOverlay(rows);
        assert.equal(rows[0].price_delta, 1.5);
    });

    test('a summer transfer is flagged by team code, not team id', () => {
        // Team ids shift every season as the promoted clubs move the alphabetical
        // order, so a stayer would look like a mover if ids were compared.
        const { applyMarketOverlay } = load({
            live: [liveElement({ code: 100, team: 9, team_code: 43 })]
        });
        const stayed = snapshotRow({ code: 100, team: 5, team_code: 43 });
        applyMarketOverlay([stayed]);
        assert.equal(stayed.market_moved_club, false, 'same club, different id, must not flag');

        const { applyMarketOverlay: overlay2 } = load({
            live: [liveElement({ code: 100, team_code: 8 })]
        });
        const moved = snapshotRow({ code: 100, team_code: 43 });
        overlay2([moved]);
        assert.equal(moved.market_moved_club, true);
    });

    test('the live tab clears the overlay instead of leaving it stale', () => {
        // The same player objects are reused when the season flips; an overlay
        // that outlived the historical tab would put last season's delta on a
        // row whose own numbers are already this season's.
        const { applyMarketOverlay, state } = load();
        const rows = [snapshotRow()];
        applyMarketOverlay(rows);
        assert.equal(rows[0].market_cost, 9.0);

        state.currentDataSource = 'live';
        assert.equal(applyMarketOverlay(rows), 0);
        assert.equal(rows[0].market_cost, null);
        assert.equal(rows[0].price_delta, null);
    });

    test('no live bootstrap yet means no overlay and no crash', () => {
        const { applyMarketOverlay, marketOverlayActive } = load({ live: null });
        const rows = [snapshotRow()];
        assert.equal(applyMarketOverlay(rows), 0);
        assert.equal(marketOverlayActive(), false);
    });
});

describe('hype gap', () => {
    /** Ten players, ownership ascending, production descending. */
    const mirrored = () => {
        const rows = [], live = [];
        for (let i = 0; i < 10; i++) {
            rows.push(snapshotRow({
                id: i, code: 100 + i, points_per_game_90: 10 - i, minutes: 2000
            }));
            live.push(liveElement({ code: 100 + i, selected_by_percent: String(i * 5) }));
        }
        return { rows, live };
    };

    test('most-owned least-productive player scores near +100', () => {
        const { rows, live } = mirrored();
        const { applyMarketOverlay } = load({ live });
        applyMarketOverlay(rows);

        const hyped = rows[9]; // highest ownership, lowest production
        assert.ok(hyped.hype_gap >= 80, `expected a large positive gap, got ${hyped.hype_gap}`);
    });

    test('the productive player nobody has picked scores near -100', () => {
        const { rows, live } = mirrored();
        const { applyMarketOverlay } = load({ live });
        applyMarketOverlay(rows);

        const ignored = rows[0]; // lowest ownership, highest production
        assert.ok(ignored.hype_gap <= -80, `expected a large negative gap, got ${ignored.hype_gap}`);
    });

    test('ranks within position, not across the league', () => {
        // The defect this prevents: a goalkeeper scores roughly half the points
        // per 90 a forward does however good he is, so ranking league-wide put
        // every nailed keeper at +85 and the chip read "the market expects a leap
        // from Dúbravka" when it only meant "Dúbravka is a goalkeeper".
        //
        // Here each position holds one modest keeper and one prolific forward on
        // identical ownership. Within position both are alone, so both gaps are
        // zero; league-wide the keeper would show a large positive gap.
        const rows = [
            snapshotRow({ id: 1, code: 100, element_type: 1, points_per_game_90: 2.5 }),
            snapshotRow({ id: 2, code: 200, element_type: 4, points_per_game_90: 6.5 })
        ];
        const { applyMarketOverlay } = load({
            live: [
                liveElement({ code: 100, selected_by_percent: '25' }),
                liveElement({ code: 200, selected_by_percent: '25' })
            ]
        });
        applyMarketOverlay(rows);

        assert.equal(rows[0].hype_gap, 0, 'the keeper is only ranked against keepers');
        assert.equal(rows[1].hype_gap, 0);
    });

    test('the gap still separates players inside one position', () => {
        const rows = [
            snapshotRow({ id: 1, code: 100, element_type: 2, points_per_game_90: 2.0 }),
            snapshotRow({ id: 2, code: 200, element_type: 2, points_per_game_90: 5.0 })
        ];
        const { applyMarketOverlay } = load({
            live: [
                liveElement({ code: 100, selected_by_percent: '40' }), // owned, unproductive
                liveElement({ code: 200, selected_by_percent: '2' })   // productive, ignored
            ]
        });
        applyMarketOverlay(rows);

        assert.ok(rows[0].hype_gap > 0, 'the owned but unproductive defender is the hyped one');
        assert.ok(rows[1].hype_gap < 0, 'the productive one nobody picked is under the radar');
    });

    test('departed players are excluded from the ranking population', () => {
        // A departed player is not competing for anyone's attention, so leaving
        // him in would shift every surviving player's percentile.
        const live = [liveElement({ code: 100, selected_by_percent: '50' })];
        const rows = [snapshotRow({ code: 100 }), snapshotRow({ id: 2, code: 200 })];
        const { applyMarketOverlay } = load({ live });

        assert.equal(applyMarketOverlay(rows), 1, 'only the surviving player counts');
        assert.equal(rows[1].hype_gap, null);
    });
});

describe('displayed price and ownership follow the overlay', () => {
    test('the overlay wins when present, the row falls back when not', () => {
        const { applyMarketOverlay, displayCost, displayOwnership } = load();
        const row = snapshotRow();
        assert.equal(displayCost(row), 7.5, 'before the overlay: last season');
        assert.equal(displayOwnership(row), 12.0);

        applyMarketOverlay([row]);
        assert.equal(displayCost(row), 9.0, 'after the overlay: this season');
        assert.equal(displayOwnership(row), 31.5);
    });

    test('a departed player falls back rather than printing null', () => {
        const { applyMarketOverlay, displayCost } = load({ live: [liveElement({ code: 999 })] });
        const row = snapshotRow({ code: 100, now_cost: 7.5 });
        applyMarketOverlay([row]);
        assert.equal(displayCost(row), 7.5);
    });
});

describe('market cells', () => {
    test('the price cell shows the summer move beside the new price', () => {
        const { applyMarketOverlay, priceCellHtml } = load();
        const row = snapshotRow({ now_cost: 7.5 });
        applyMarketOverlay([row]);

        const html = priceCellHtml(row);
        assert.match(html, /£9\.0/);
        assert.match(html, /\+1\.5/);
        assert.match(html, /price-up/);
    });

    test('a price cut is marked as such', () => {
        const { applyMarketOverlay, priceCellHtml } = load({
            live: [liveElement({ now_cost: 60 })]
        });
        const row = snapshotRow({ now_cost: 7.5 });
        applyMarketOverlay([row]);
        assert.match(priceCellHtml(row), /price-down/);
    });

    test('an unmoved price shows no delta chip at all', () => {
        const { applyMarketOverlay, priceCellHtml } = load({
            live: [liveElement({ now_cost: 75 })]
        });
        const row = snapshotRow({ now_cost: 7.5 });
        applyMarketOverlay([row]);

        const html = priceCellHtml(row);
        assert.equal(html, '£7.5', 'a zero delta is noise, not a signal');
    });

    test('off-overlay the price cell is the plain number it always was', () => {
        const { priceCellHtml } = load({ source: 'live' });
        assert.equal(priceCellHtml(snapshotRow({ now_cost: 7.5 })), '£7.5');
    });

    test('the departed badge is the one that must never be missed', () => {
        const { applyMarketOverlay, marketBadgesHtml } = load({
            live: [liveElement({ code: 999 })]
        });
        const row = snapshotRow({ code: 100 });
        applyMarketOverlay([row]);
        assert.match(marketBadgesHtml(row), /עזב/);
    });

    test('no market badges outside the pre-season overlay', () => {
        const { marketBadgesHtml, state } = load();
        const row = snapshotRow({ market_departed: true });
        state.currentDataSource = 'live';
        assert.equal(marketBadgesHtml(row), '');
    });

    test('the ownership title explains the flag in place', () => {
        const { rows, live } = (() => {
            const rows = [], live = [];
            for (let i = 0; i < 10; i++) {
                rows.push(snapshotRow({ id: i, code: 100 + i, points_per_game_90: 10 - i }));
                live.push(liveElement({ code: 100 + i, selected_by_percent: String(i * 5) }));
            }
            return { rows, live };
        })();
        const { applyMarketOverlay, ownershipCellTitle, ownershipCellHtml } = load({ live });
        applyMarketOverlay(rows);

        assert.match(ownershipCellHtml(rows[9]), /🔺/);
        assert.match(ownershipCellTitle(rows[9]), /title="/);
        assert.match(ownershipCellHtml(rows[0]), /🔻/);
    });

    test('a player the market agrees with gets no flag', () => {
        const { applyMarketOverlay, ownershipCellHtml } = load();
        const row = snapshotRow();
        applyMarketOverlay([row]);
        // One player is his own whole population, so both percentiles are 0.
        assert.equal(row.hype_gap, 0);
        assert.equal(ownershipCellHtml(row), '31.5%');
    });
});

describe('transfer flow', () => {
    test('net transfers come across with the rest of the overlay', () => {
        const { applyMarketOverlay, displayNetTransfers } = load({
            live: [liveElement({ transfers_in_event: 180000, transfers_out_event: 25000 })]
        });
        const row = snapshotRow();
        applyMarketOverlay([row]);
        assert.equal(row.market_net_transfers, 155000);
        assert.equal(displayNetTransfers(row), 155000);
    });

    test('a player being sold reads negative, not absent', () => {
        const { applyMarketOverlay, displayNetTransfers } = load({
            live: [liveElement({ transfers_in_event: 4000, transfers_out_event: 90000 })]
        });
        const row = snapshotRow();
        applyMarketOverlay([row]);
        assert.equal(displayNetTransfers(row), -86000);
    });

    test('no figure at all is null, which is not the same as zero flow', () => {
        // A completed season has its transfer fields zeroed by
        // preprocessPlayerData, and 0 there would read as "the market is
        // indifferent" rather than "there is nothing to read". The chart hides on
        // null; it would draw a vertical line at zero.
        const { displayNetTransfers, state } = load();
        state.currentDataSource = 'historical';
        assert.equal(displayNetTransfers(snapshotRow({ net_transfers_event: 0 })), null);
    });

    test('on the live tab the row carries its own flow', () => {
        const { displayNetTransfers, state } = load({ source: 'live' });
        state.currentDataSource = 'live';
        assert.equal(displayNetTransfers({ net_transfers_event: -1200 }), -1200);
        assert.equal(displayNetTransfers({}), null, 'missing is null, not zero');
    });

    test('the live tab clears the transfer overlay with everything else', () => {
        const { applyMarketOverlay, state } = load();
        const row = snapshotRow();
        applyMarketOverlay([row]);
        assert.equal(row.market_net_transfers, 0);

        state.currentDataSource = 'live';
        applyMarketOverlay([row]);
        assert.equal(row.market_net_transfers, null);
    });
});

describe('percentileRanker', () => {
    test('ranks by position within the sample', () => {
        const { percentileRanker } = load();
        const rank = percentileRanker([10, 20, 30, 40]);
        assert.equal(rank(10), 0);
        assert.equal(rank(30), 50);
        assert.equal(rank(40), 75);
    });

    test('an empty sample ranks everything at zero rather than dividing by it', () => {
        const { percentileRanker } = load();
        assert.equal(percentileRanker([])(5), 0);
    });
});
