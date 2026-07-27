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
