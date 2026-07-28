#!/usr/bin/env node
/**
 * Browser smoke test. Serves the repo statically, blocks the network so the
 * page must render from the committed season snapshot, and asserts the things
 * that have actually broken in production before: an empty table, a page-wide
 * JS error, duplicate ids, and the table drifting out of column alignment.
 *
 * No live API: every external request is aborted, which is also the worst case
 * on draft day if the proxies are down.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
    try {
        const path = decodeURIComponent(req.url.split('?')[0]);
        const file = join(ROOT, path === '/' ? 'index.html' : path);
        if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
        const body = await readFile(file);
        res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
        res.end(body);
    } catch {
        res.writeHead(404).end('not found');
    }
});

const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); else console.log(`  ✓ ${msg}`); };

await new Promise(r => server.listen(0, r));
const port = server.address().port;

const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));

// Block the FPL APIs and every proxy: this is draft day with the proxies down,
// and the committed snapshot has to carry the page on its own. CDN assets are
// allowed through so the test exercises the real page rather than a crippled one.
const BLOCKED = [/premierleague\.com/, /workers\.dev/, /corsproxy/, /allorigins/,
    /codetabs/, /thingproxy/, /herokuapp/];
await page.setRequestInterception(true);
page.on('request', req => {
    const url = req.url();
    if (url.startsWith(`http://127.0.0.1:${port}`)) return req.continue();
    if (BLOCKED.some(re => re.test(url))) return req.abort();
    req.continue();
});

let ok = true;
try {
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
        () => document.querySelectorAll('#playersTableBody tr.player-row').length > 0,
        { timeout: 45000 }
    );

    const r = await page.evaluate(() => {
        const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
        const rows = [...document.querySelectorAll('#playersTableBody tr.player-row')];
        const headers = document.querySelectorAll('#playersTable > thead > tr > th').length;
        return {
            rows: rows.length,
            headers,
            cells: rows[0] ? rows[0].querySelectorAll('td').length : 0,
            dupeIds: [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))],
            conflictMarkers: /<<<<<<<|>>>>>>>/.test(document.body.innerText),
            source: typeof state !== 'undefined' ? state.currentDataSource : null,
            withPoints: rows.filter(t => {
                const n = parseFloat(t.querySelectorAll('td')[0]?.textContent);
                return Number.isFinite(n);
            }).length,
            hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
        };
    });

    check(r.rows > 0, `players table rendered ${r.rows} rows with no network`);
    check(r.headers === r.cells, `header count ${r.headers} matches row cell count ${r.cells}`);
    check(r.dupeIds.length === 0, `no duplicate element ids${r.dupeIds.length ? `: ${r.dupeIds.join(', ')}` : ''}`);
    check(!r.conflictMarkers, 'no merge-conflict markers visible on the page');
    check(r.source === 'historical', `fell back to the committed snapshot (source: ${r.source})`);
    check(!r.hScroll, 'no horizontal page scroll at 1440px');
    check(pageErrors.length === 0, `no uncaught page errors${pageErrors.length ? `: ${pageErrors[0]}` : ''}`);

    // The draft board is the first thing on the page, and every panel is only as
    // good as the sentence explaining its pick — a panel rendering three names
    // with no "why" line is the regression worth catching.
    const board = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('#draftBoard .db-card')];
        return {
            cards: cards.length,
            rows: document.querySelectorAll('#draftBoard .db-row').length,
            whys: document.querySelectorAll('#draftBoard .db-why').length,
            emptyWhys: [...document.querySelectorAll('#draftBoard .db-why')]
                .filter(e => !e.textContent.trim()).length,
            more: document.querySelectorAll('#draftBoard .db-more').length,
            heading: (document.querySelector('#draftBoard .db-heading') || {}).textContent || ''
        };
    });
    check(board.cards >= 4, `draft board rendered ${board.cards} panels`);
    check(board.rows > 0 && board.whys === board.rows,
        `every one of ${board.rows} picks carries a reason`);
    check(board.emptyWhys === 0, 'no pick has a blank reason line');
    check(board.heading.includes('את מי לקחת'), 'board names the question it answers');

    // THE POST-DRAFT PATH.
    //
    // This test blocks the network, so the draft rosters never load and
    // `ownedElementIds` is always empty — which means every assertion above runs
    // against the pre-draft branch only. The whole post-draft code path was
    // untested in a browser, and that is precisely where the value panel had
    // become impossible to satisfy: replacement level is the best free agent, so
    // in a free-agent pool every VORP is <= 0, and the panel gated on `vorp > 0`.
    // It rendered nothing, in the one situation the board exists for.
    //
    // Injecting rosters reproduces that branch without the network — but only if
    // computeDraftMetrics is re-run too. Ownership is an *input* to VORP: with
    // rosters known, replacement level becomes the best free agent, which is the
    // step that drives every free agent's VORP to <= 0. Setting ownedElementIds
    // alone leaves the pre-draft baseline in place, and this assertion then passes
    // against the very gate it exists to catch. loadDraftDataInBackground does the
    // same two calls in the same order (script.js:5739).
    const postDraft = await page.evaluate(() => {
        const all = state.allPlayersData[state.currentDataSource].processed;
        // Take the strongest third by draft rank, so the free-agent pool is the
        // leftovers — the realistic shape, and the one that broke.
        const owned = [...all].sort((a, b) => b.draft_score - a.draft_score)
            .slice(0, Math.floor(all.length / 3)).map(p => p.id);
        state.draft.ownedElementIds = new Set(owned);
        computeDraftMetrics(all);
        invalidateSignals();
        renderDraftBoard();

        const cards = [...document.querySelectorAll('#draftBoard .db-card')];
        const ids = cards.map(c => (c.querySelector('.db-more') || {}).outerHTML || '')
            .join(' ').match(/openLeaderboard\('([a-z]+)'/g) || [];
        return {
            owned: owned.length,
            pool: draftBoardPool().players.length,
            cards: cards.length,
            rows: document.querySelectorAll('#draftBoard .db-row').length,
            emptyWhys: [...document.querySelectorAll('#draftBoard .db-why')]
                .filter(e => !e.textContent.trim()).length,
            panelsWithPicks: ids.length,
            // The panel this exists to protect.
            valuePicks: panelPicks(DRAFT_PANELS.find(p => p.id === 'value'),
                draftBoardPool().players, 3).length,
            scope: (document.querySelector('#draftBoard .db-scope') || {}).textContent || ''
        };
    });
    check(postDraft.pool > 0 && postDraft.pool < postDraft.owned + postDraft.pool,
        `rosters injected: ${postDraft.owned} owned, ${postDraft.pool} free agents`);
    check(postDraft.scope.includes('חופשיים'),
        'board says it is showing free agents once rosters exist');
    check(postDraft.valuePicks > 0,
        `the value panel still recommends somebody post-draft (${postDraft.valuePicks} picks)`);
    check(postDraft.panelsWithPicks >= 4,
        `${postDraft.panelsWithPicks} panels still have picks against a free-agent pool`);
    check(postDraft.emptyWhys === 0, 'no post-draft pick has a blank reason line');

    // Put it back, so the later checks see the state they expect.
    await page.evaluate(() => {
        state.draft.ownedElementIds = new Set();
        computeDraftMetrics(state.allPlayersData[state.currentDataSource].processed);
        invalidateSignals();
        renderDraftBoard();
    });

    // Each panel's top-20 must open, fill, and close.
    const modal = await page.evaluate(() => {
        const btn = document.querySelector('#draftBoard .db-more');
        if (!btn) return { ok: false, why: 'no panel had a top-20 button' };
        btn.click();
        const m = document.getElementById('leaderboardModal');
        const rows = m.querySelectorAll('.lb-table tbody tr').length;
        const shown = m.style.display === 'block';
        window.closeModal();
        return { ok: true, shown, rows, closed: m.style.display === 'none' };
    });
    check(modal.ok && modal.shown && modal.rows > 1 && modal.closed,
        `top-20 modal opens with ${modal.rows} rows and closes`);

    // The charts view: every card that stays visible must have drawn a chart, and
    // a card with nothing to plot must hide itself rather than show an empty axis.
    const chartsBefore = pageErrors.length;
    const chartsView = await page.evaluate(async () => {
        switchMainView('charts');
        await new Promise(r => setTimeout(r, 900));
        const cards = [...document.querySelectorAll('#chartsGrid .chart-card')];
        const visible = cards.filter(c => !c.hidden);
        const drawn = visible.filter(c => {
            const canvas = c.querySelector('canvas');
            return canvas && charts[canvas.id];
        });
        const notes = visible.filter(c => (c.querySelector('.chart-note') || {}).textContent);
        // Switch the position matrix and make sure it rebuilds rather than leaking
        // the destroyed instance.
        setChartPosition('DEF');
        await new Promise(r => setTimeout(r, 300));
        const afterToggle = !!charts['chart-position'];
        switchMainView('table');
        return { cards: cards.length, visible: visible.length, drawn: drawn.length,
            notes: notes.length, afterToggle };
    });
    check(chartsView.cards === 8, `charts view built ${chartsView.cards} cards from CHART_SPECS`);
    check(chartsView.visible > 0 && chartsView.drawn === chartsView.visible,
        `all ${chartsView.visible} visible charts drew (${chartsView.cards - chartsView.visible} hid themselves)`);
    check(chartsView.notes === chartsView.visible, 'every visible chart says what it answers');
    check(chartsView.afterToggle, 'the position matrix rebuilds when the position changes');
    check(pageErrors.length === chartsBefore,
        `no errors from the charts view${pageErrors.length > chartsBefore ? `: ${pageErrors[chartsBefore]}` : ''}`);

    // Sub-tabs must switch without throwing.
    const tabs = await page.evaluate(() => {
        const out = [];
        for (const t of ['overview', 'standings', 'market', 'analytics', 'h2h']) {
            try { switchDraftTab(t); out.push([t, true]); } catch { out.push([t, false]); }
        }
        showTab('players');
        return out;
    });
    check(tabs.every(([, okTab]) => okTab),
        `draft sub-tabs switch cleanly (${tabs.filter(([, o]) => o).length}/${tabs.length})`);

    // הגדרות is in the always-visible page header, so it has to work from either
    // tab. It used to live inside #playersTabContent and did nothing at all from
    // the draft tab — a hidden parent hides the modal with it.
    const settings = await page.evaluate(() => {
        const m = document.getElementById('settingsModal');
        const seen = [];
        for (const tab of ['draft', 'players']) {
            showTab(tab);
            openSettings();
            // checkVisibility() walks the ancestors, which is the whole point here.
            // offsetParent does not work for this: .modal is position:fixed, and
            // that returns null for a fixed element however visible it is.
            seen.push([tab, m.style.display === 'block' && m.checkVisibility()]);
            window.closeModal();
        }
        showTab('players');
        return seen;
    });
    check(settings.every(([, vis]) => vis),
        `settings opens from both tabs (${settings.filter(([, v]) => v).map(([t]) => t).join(', ') || 'neither'})`);

    // Mobile: the layout must not overflow.
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await new Promise(res => setTimeout(res, 600));
    const mob = await page.evaluate(() => ({
        hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    }));
    check(!mob.hScroll, 'no horizontal page scroll at 390px');

    check(pageErrors.length === 0, 'still no page errors after interaction');
} catch (e) {
    failures.push(`smoke run threw: ${e.message}`);
} finally {
    await browser.close();
    server.close();
}

if (failures.length) {
    console.error('\nSmoke test FAILED:');
    failures.forEach(f => console.error(`  ✗ ${f}`));
    ok = false;
}
console.log(ok ? '\nSmoke test passed.' : '');
process.exit(ok ? 0 : 1);
