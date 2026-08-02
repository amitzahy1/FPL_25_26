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
            hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
            navActive: ([...document.querySelectorAll('.nav-item')]
                .find(b => b.classList.contains('active')) || {}).id || null,
            playersShown: document.getElementById('playersTabContent').style.display !== 'none'
        };
    });

    check(r.rows > 0, `players table rendered ${r.rows} rows with no network`);
    check(r.headers === r.cells, `header count ${r.headers} matches row cell count ${r.cells}`);
    check(r.dupeIds.length === 0, `no duplicate element ids${r.dupeIds.length ? `: ${r.dupeIds.join(', ')}` : ''}`);
    check(!r.conflictMarkers, 'no merge-conflict markers visible on the page');
    check(r.source === 'historical', `fell back to the committed snapshot (source: ${r.source})`);
    // The nav must name the tab you are actually looking at, from the first
    // paint — not only once init() has finished awaiting the draft fetches,
    // which between seasons is a full timeout chain.
    check(r.navActive === 'nav-players' && r.playersShown,
        `the nav highlights the tab that is on screen (${r.navActive})`);
    check(!r.hScroll, 'no horizontal page scroll at 1440px');
    check(pageErrors.length === 0, `no uncaught page errors${pageErrors.length ? `: ${pageErrors[0]}` : ''}`);

    // The draft board is the first thing on the page, and every panel is only as
    // good as the sentence explaining its pick — a panel rendering three names
    // with no "why" line is the regression worth catching.
    const board = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('#draftBoard .db-card')];
        const rows = [...document.querySelectorAll('#draftBoard .db-tbl tbody tr')];
        return {
            cards: cards.length,
            rows: rows.length,
            // The card explains a pick with its columns now, not with a sentence:
            // a key figure under a header that names it, plus supporting numbers.
            keyed: rows.filter(r => (r.querySelector('.db-td-key') || {}).textContent?.trim()).length,
            thinRows: rows.filter(r => r.children.length < 4).length,
            headers: [...document.querySelectorAll('#draftBoard .db-tbl thead th')]
                .filter(h => h.textContent.trim()).length,
            headless: [...document.querySelectorAll('#draftBoard .db-tbl')]
                .filter(t => t.querySelectorAll('thead th').length !== (t.querySelector('tbody tr') || { children: [] }).children.length).length,
            more: document.querySelectorAll('#draftBoard .db-more').length,
            heading: (document.querySelector('#draftBoard .db-heading') || {}).textContent || ''
        };
    });
    check(board.cards >= 4, `draft board rendered ${board.cards} panels`);

    // Header over value, measured on the text rather than the cell box — the
    // boxes are identical by construction under table-layout: fixed, so they
    // agreed while the text inside them was up to 59px apart. The cause was one
    // `text-align: end` read under two directions: the value cells are ltr (so a
    // minus sign leads and figures stay tabular), the headers inherit the page's
    // rtl, and `end` therefore meant opposite edges.
    const drift = await page.evaluate(() => {
        const textRight = el => {
            const r = document.createRange();
            r.selectNodeContents(el);
            const rects = [...r.getClientRects()];
            return rects.length ? Math.max(...rects.map(x => x.right)) : null;
        };
        const out = [];
        for (const tbl of document.querySelectorAll('#draftBoard .db-tbl')) {
            const ths = [...tbl.querySelectorAll('thead th')];
            const row = tbl.querySelector('tbody tr');
            if (!row) continue;
            const tds = [...row.querySelectorAll('td')];
            ths.forEach((th, i) => {
                if (!tds[i]) return;
                const h = textRight(th), v = textRight(tds[i]);
                if (h === null || v === null) return;
                out.push({ col: th.textContent.trim(), d: Math.abs(h - v) });
            });
        }
        return out;
    });
    const worst = drift.reduce((m, x) => x.d > m.d ? x : m, drift[0] || { col: 'none', d: 0 });
    check(drift.length > 0 && worst.d <= 1,
        `all ${drift.length} board headers sit over their own values`
        + ` (worst drift ${worst.d.toFixed(1)}px on "${worst.col}")`);
    check(board.rows > 0 && board.keyed === board.rows,
        `every one of ${board.rows} picks shows its figure`);
    check(board.rows > 0 && board.thinRows === 0,
        'every pick carries supporting columns, not one bare number');
    // A header count that disagrees with the cell count is the misalignment this
    // layout was built to fix, and it is invisible in a screenshot.
    check(board.headless === 0, 'every card table has one header per column');
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
        // [a-z0-9] — the panel ids include next5, and a class without digits
        // matched nothing, which is the same bug the quick-filter guard had.
        const ids = cards.map(c => (c.querySelector('.db-more') || {}).outerHTML || '')
            .join(' ').match(/openLeaderboard\('([a-z0-9]+)'/g) || [];
        const rows = [...document.querySelectorAll('#draftBoard .db-tbl tbody tr')];
        return {
            owned: owned.length,
            pool: draftBoardPool().players.length,
            cards: cards.length,
            rows: rows.length,
            // A post-draft pool is where a rule quietly stops matching, so every
            // surviving pick must still print its figure.
            blankFigures: rows.filter(r => !(r.querySelector('.db-td-key') || {}).textContent?.trim()).length,
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
    check(postDraft.rows > 0 && postDraft.blankFigures === 0,
        `every one of ${postDraft.rows} post-draft picks still prints its figure`);

    // The free-agent switch. In Draft a player belongs to exactly one manager,
    // so recommending an owned player is recommending something the user cannot
    // do — with the filter off the board's top pick is whoever is best outright,
    // which after a draft is somebody on a rival's roster.
    const faToggle = await page.evaluate(async () => {
        const top = () => [...document.querySelectorAll('#draftBoard .db-nm b')]
            .slice(0, 3).map(e => e.textContent);
        const owned = state.draft.ownedElementIds;
        const on = { top: top(), checked: document.getElementById('freeAgentsOnlyBtn').getAttribute('aria-pressed') === 'true' };
        const ownedShownWhileOn = top().filter(n => [...owned]
            .some(id => (state.allPlayersData[state.currentDataSource].processed
                .find(p => p.id === id) || {}).web_name === n)).length;

        // The table and the charts read the same switch, so they are measured
        // through it too — a board that has excluded owned players while the
        // table under it still lists them is two answers on one screen.
        //
        // Re-run through the switch first: the rosters above were injected
        // straight into state, so filteredData still holds the pre-draft answer
        // until something re-filters.
        const ownedInTable = () => (state.filteredData || [])
            .filter(p => owned.has(p.id)).length;
        setFreeAgentsOnly(true);
        await new Promise(r => setTimeout(r, 150));
        const onTable = { rows: (state.filteredData || []).length, owned: ownedInTable() };
        const btn = document.getElementById('freeAgentsOnlyBtn');
        const onBtn = { pressed: btn.getAttribute('aria-pressed'), disabled: btn.disabled };

        setFreeAgentsOnly(false);
        await new Promise(r => setTimeout(r, 150));
        const off = {
            top: top(), scope: document.querySelector('.db-scope').textContent,
            rows: (state.filteredData || []).length, owned: ownedInTable(),
            pressed: btn.getAttribute('aria-pressed')
        };

        setFreeAgentsOnly(true);
        await new Promise(r => setTimeout(r, 150));
        return {
            enabled: !document.getElementById('freeAgentsOnlyBtn').disabled,
            onChecked: on.checked,
            ownedShownWhileOn,
            changed: JSON.stringify(on.top) !== JSON.stringify(off.top),
            offSaysSo: /כולל תפוסים/.test(off.scope),
            restored: JSON.stringify(top()) === JSON.stringify(on.top),
            btnOn: onBtn, btnOffPressed: off.pressed,
            tableOwnedWhileOn: onTable.owned,
            tableGrewWhenOff: off.rows > onTable.rows && off.owned > 0
        };
    });
    check(faToggle.enabled && faToggle.onChecked,
        'the free-agent filter is live and on once the draft has been held');
    check(faToggle.ownedShownWhileOn === 0,
        `the board never recommends an owned player while the filter is on`);
    check(faToggle.changed && faToggle.offSaysSo,
        'turning it off widens the pool to owned players and the board says so');
    check(faToggle.restored, 'turning it back on restores the free-agent recommendations');
    check(faToggle.btnOn.pressed === 'true' && !faToggle.btnOn.disabled,
        'the one site-wide 🆓 button reports the live state');
    check(faToggle.btnOffPressed === 'false',
        'and follows a change made in code');
    check(faToggle.tableOwnedWhileOn === 0,
        'the table (and so the charts) drops owned players while the filter is on');
    check(faToggle.tableGrewWhenOff,
        'turning it off puts owned players back into the table');

    // Put it back, so the later checks see the state they expect.
    await page.evaluate(() => {
        state.draft.ownedElementIds = new Set();
        computeDraftMetrics(state.allPlayersData[state.currentDataSource].processed);
        invalidateSignals();
        renderDraftBoard();
    });

    // Hover explanations. The app had two kinds — [data-tooltip] with a styled
    // box, and plain `title` drawn by the browser after a second and never on a
    // touch screen — and the second kind is what most explanations used.
    const tips = await page.evaluate(async () => {
        const tip = document.getElementById('tooltip');
        const sample = sel => document.querySelector(sel);
        const results = {};
        for (const [name, sel] of [['title', '.signal-badge[title]'], ['data', 'td[data-tooltip]']]) {
            const el = sample(sel);
            if (!el) { results[name] = 'missing'; continue; }
            el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            await new Promise(r => setTimeout(r, 30));
            const r = tip.getBoundingClientRect();
            results[name] = {
                shown: tip.classList.contains('visible') && getComputedStyle(tip).display !== 'none',
                hasText: tip.textContent.trim().length > 10,
                inViewport: r.left >= 0 && r.right <= window.innerWidth
            };
            el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
        }
        return results;
    });
    check(tips.title && tips.title.shown && tips.title.hasText && tips.title.inViewport,
        `a native title renders as the styled tooltip (${JSON.stringify(tips.title)})`);
    check(tips.data && tips.data.shown && tips.data.hasText,
        `a data-tooltip still renders (${JSON.stringify(tips.data)})`);

    // Column *order*, not just column count.
    //
    // The structural check counts headers against cells, which passed while the
    // draft-rank and projection cells were emitted in the opposite order to their
    // headers — so the table showed a rank of "28.2" and a projection of "–", and
    // it read as random colouring rather than as swapped columns. This walks a few
    // headers and asserts the cell underneath actually belongs to them.
    const alignment = await page.evaluate(() => {
        const heads = [...document.querySelectorAll('#playersTable thead th')];
        const row = document.querySelector('#playersTable tbody tr.player-row');
        const p = state.displayedData[0];
        const at = key => {
            const i = heads.findIndex(h => h.dataset.sort === key);
            return i < 0 ? null : (row.children[i] || {}).textContent?.trim();
        };
        const checks = [
            ['draft_rank', p.draft_rank ? `#${p.draft_rank}` : '–'],
            ['points_next_5', Number.isFinite(p.points_next_5) ? p.points_next_5.toFixed(1) : '–'],
            ['total_points', String(p.total_points)],
            ['minutes', String(p.minutes)],
            ['web_name', null]
        ];
        return checks.filter(([key, want]) => want !== null)
            .map(([key, want]) => ({ key, want, got: at(key) }))
            .filter(c => c.got !== c.want);
    });
    check(alignment.length === 0,
        `every checked column holds its own value${alignment.length
            ? ': ' + alignment.map(c => `${c.key} wanted ${c.want} got ${c.got}`).join(', ') : ''}`);

    // Each panel's top-20 must open, fill, and close.
    const modal = await page.evaluate(() => {
        const btn = document.querySelector('#draftBoard .db-more');
        if (!btn) return { ok: false, why: 'no panel had a top-20 button' };
        btn.click();
        const m = document.getElementById('leaderboardModal');
        const rows = [...m.querySelectorAll('.db-tbl.is-modal tbody tr')];
        const shown = m.style.display === 'block';
        // The sentence that explains a pick lives here, where there is room for
        // it — so every one of the twenty must have one.
        const whys = rows.filter(r => (r.querySelector('.db-td-why') || {}).textContent?.trim()).length;
        window.closeModal();
        return { ok: true, shown, rows: rows.length, whys, closed: m.style.display === 'none' };
    });
    check(modal.ok && modal.shown && modal.rows > 1 && modal.closed,
        `top-20 modal opens with ${modal.rows} rows and closes`);
    check(modal.rows > 0 && modal.whys === modal.rows,
        `every one of ${modal.rows} rows in the modal carries a reason`);

    // Every column in the top-20 must be orderable by clicking its header, and
    // must order by the figure it prints rather than by the string it prints —
    // sorting '#9' after '#10' is the classic way this goes wrong. Direction is
    // not assumed: a rank and an xDiff open on their LOW end, because that is
    // their good end.
    const sorting = await page.evaluate(() => {
        const ids = [...new Set([...document.querySelectorAll('#draftBoard [onclick*="openLeaderboard"]')]
            .map(el => (el.getAttribute('onclick').match(/openLeaderboard\('([^']+)'\)/) || [])[1])
            .filter(Boolean))];
        const num = s => { const m = String(s).match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
        const mono = (a, dir) => a.every((v, i) => i === 0
            || (dir === 'desc' ? v <= a[i - 1] + 1e-9 : v >= a[i - 1] - 1e-9));
        const broken = [];
        let checked = 0, panels = 0;

        for (const id of ids) {
            window.openLeaderboard(id);
            panels++;
            const ths = [...document.querySelectorAll('#leaderboardContent thead th')];
            const sortable = ths.map((th, i) => [i, th.dataset.lbsort, th.textContent.trim()])
                .filter(([, token]) => token);
            if (!sortable.length) { broken.push(`${id}: no sortable header`); continue; }

            for (const [idx, token, label] of sortable) {
                if (token === 'spark' || token === 'name') continue;
                const read = () => [...document.querySelectorAll('#leaderboardContent tbody tr')]
                    .map(tr => num(tr.children[idx]?.innerText || '')).filter(v => v !== null);
                window.sortLeaderboard(token);
                const first = read();
                window.sortLeaderboard(token);
                const second = read();
                if (!first.length) continue;            // nothing to order (e.g. no draft_rank yet)
                checked++;
                const firstOk = mono(first, 'desc') || mono(first, 'asc');
                const secondOk = mono(second, 'desc') || mono(second, 'asc');
                const reversed = first.length < 2 || mono(first, 'desc') !== mono(second, 'desc');
                if (!firstOk || !secondOk || !reversed) broken.push(`${id}/${label}`);
            }
        }
        window.closeModal();
        return { panels, checked, broken };
    });
    check(sorting.checked > 0 && sorting.broken.length === 0,
        `all ${sorting.checked} sortable columns across ${sorting.panels} leaderboards order by value and reverse`
        + `${sorting.broken.length ? `: ${sorting.broken.join(', ')}` : ''}`);

    // The charts view: every card that stays visible must have drawn a chart, and
    // a card with nothing to plot must hide itself rather than show an empty axis.
    const chartsBefore = pageErrors.length;
    const chartsView = await page.evaluate(async () => {
        switchMainView('charts');
        await new Promise(r => setTimeout(r, 900));

        // The page leads with six managed slots and benches the rest behind
        // עוד גרפים. Capture the split, then open the fold so every card is
        // measurable below.
        const topSix = [...document.querySelectorAll('#chartsGrid .chart-card')]
            .map(c => c.id.replace(/^card-/, ''));
        const benched = [...document.querySelectorAll('#moreChartsGrid .chart-card')].length;
        const foldedDrawn = [...document.querySelectorAll('#moreChartsGrid canvas')]
            .filter(cv => charts[cv.id]).length;
        document.getElementById('moreCharts').open = true;
        renderCharts();
        await new Promise(r => setTimeout(r, 700));

        const cards = [...document.querySelectorAll('#mainChartsView .chart-card')];
        const visible = cards.filter(c => !c.hidden);
        const drawn = visible.filter(c => {
            const canvas = c.querySelector('canvas');
            return canvas && charts[canvas.id];
        });
        const notes = visible.filter(c => (c.querySelector('.chart-note') || {}).textContent);

        // Beyond "it drew": a chart can be technically alive and still tell the
        // reader nothing. Three ways that happened here — a canvas collapsed to
        // no height, NaN coordinates plotted as invisible points, and a caption
        // promising a colour code in front of a chart painted one colour (all
        // ~500 points green, because "green = free" was true of everybody before
        // the draft).
        const faults = [];
        for (const c of visible) {
            const canvas = c.querySelector('canvas');
            const chart = canvas && charts[canvas.id];
            if (!chart) continue;
            const name = (c.querySelector('.chart-title') || {}).textContent.trim();
            const note = c.querySelector('.chart-note');
            const noteText = (note && note.innerText) || '';
            const box = canvas.getBoundingClientRect();
            if (box.height < 120 || box.width < 120) {
                faults.push(`${name}: canvas ${Math.round(box.width)}x${Math.round(box.height)}`);
            }
            const ds = chart.data.datasets;
            const real = ds.reduce((n, d) => n + (d.data || []).filter(v => v !== null && v !== undefined).length, 0);
            if (!real) faults.push(`${name}: no values plotted`);
            const bad = ds.flatMap(d => (d.data || []).flatMap(v => {
                const nums = (v && typeof v === 'object') ? [v.x, v.y] : [v];
                return nums.filter(n => typeof n === 'number' && !Number.isFinite(n));
            })).length;
            if (bad) faults.push(`${name}: ${bad} NaN/Infinity values`);

            // Resolved per element, because these charts set backgroundColor as a
            // scriptable function — reading the config value counts every scatter
            // as one colour.
            const colours = new Set();
            ds.forEach((d, i) => {
                const meta = chart.getDatasetMeta(i);
                (meta.data || []).forEach(el => el.options
                    && el.options.backgroundColor && colours.add(String(el.options.backgroundColor)));
            });
            const claimsColourCode = /ירוק =|אפור =|צבע = עמדה|הצבע מסמן/.test(noteText);
            const hasKey = !!(note && note.querySelector('.chart-key i'));
            if (claimsColourCode && colours.size <= 1 && !hasKey) {
                faults.push(`${name}: caption describes a colour code but one colour is drawn`);
            }
            if (/צבע = עמדה|הצבע מסמן עמדה/.test(noteText) && !hasKey) {
                faults.push(`${name}: colour means position but no key is shown`);
            }
            if (/צבע = סיגנל/.test(noteText) && !hasKey) {
                faults.push(`${name}: colour means the signal but no key is shown`);
            }
        }

        // The signal spread is a category axis faked on a linear scale, so the
        // two ways it can quietly break are a tick callback that returns nothing
        // (dots hanging over a blank axis) and every verdict resolving to one
        // colour.
        const spread = charts['chart-signal-spread'];
        const spreadTicks = spread
            ? spread.scales.x.ticks.map(t => t.label).filter(Boolean) : [];
        const spreadColours = spread
            ? new Set((spread.getDatasetMeta(0).data || [])
                .map(el => String(el.options.backgroundColor))) : new Set();

        // A keeper's xGI is zero as a fact about the job, so one on this chart
        // would drag the crosshair and mislabel every outfielder.
        //
        // Matched on names that belong to keepers *only*. The league has a
        // Martinez and a Henderson in goal and another of each outfield, so a
        // plain name-to-keeper lookup reported two false keepers on a chart that
        // was excluding them correctly.
        const underlying = charts['chart-underlying'];
        const byName = new Map();
        for (const p of state.allPlayersData[state.currentDataSource].processed) {
            if (!byName.has(p.web_name)) byName.set(p.web_name, new Set());
            byName.get(p.web_name).add(p.position_name);
        }
        const keeperOnly = new Set([...byName]
            .filter(([, poss]) => poss.size === 1 && poss.has('GKP')).map(([n]) => n));
        const keepersPlotted = underlying
            ? (underlying.data.datasets[0].data || []).filter(d => keeperOnly.has(d.name)).length
            : 0;

        // Negative ticks on an RTL canvas. The bidi algorithm treats the minus as
        // neutral and moves it to the far end, so -25 was drawn as "25-" on every
        // axis that crosses zero. Counted, not just checked, so the assertion
        // cannot pass by finding no negatives at all.
        let negTicks = 0, unisolated = 0;
        for (const ch of Object.values(charts)) {
            if (!ch || !ch.scales) continue;
            for (const axis of ['x', 'y']) {
                for (const t of ((ch.scales[axis] || {}).ticks || [])) {
                    const raw = String(t.label ?? '');
                    const bare = raw.replace(/[⁦⁩]/g, '');
                    if (!/^-[\d.,]+$/.test(bare)) continue;
                    negTicks++;
                    if (!raw.includes('⁦')) unisolated++;
                }
            }
        }

        // The key on the signal card must name the verdicts that are drawn.
        // Tones are shared — "לא זמין" and "מימוש יתר" are both red — so a key
        // built per tone from the rule list named a verdict that was not there.
        const spreadNote = document.querySelector('#card-chart-signal-spread .chart-note');
        const legendLabels = [...(spreadNote ? spreadNote.querySelectorAll('.chart-key') : [])]
            .flatMap(el => el.textContent.split('/').map(s => s.trim()));

        // Switch the position matrix and make sure it rebuilds rather than leaking
        // the destroyed instance.
        setChartPosition('DEF');
        await new Promise(r => setTimeout(r, 300));
        const afterToggle = !!charts['chart-position'];

        // The per-card category chips. Two promises to keep: narrowing one card
        // leaves the others alone, and the narrowed card spreads out — the whole
        // reason to pick a category is to read the names, and one column redrawn
        // in the same strip is the same pile with white space around it.
        const cardsWithChips = [...document.querySelectorAll('.chart-facet .chart-seg')].length;
        const before = {
            spread: charts['chart-signal-spread'].data.datasets[0].data.length,
            spreadWidth: charts['chart-signal-spread'].scales.x.max
                - charts['chart-signal-spread'].scales.x.min,
            named: charts['chart-signal-spread'].data.datasets[0].data
                .filter(d => d.label).length,
            minutes: charts['chart-minutes'].data.datasets[0].data.length
        };
        const firstVerdict = [...document.querySelectorAll(
            '#facet-chart-signal-spread [data-facet-value]')]
            .map(b => b.dataset.facetValue).filter(Boolean)[0];
        setChartFacet('chart-signal-spread', firstVerdict);
        await new Promise(r => setTimeout(r, 350));
        // Focused, the card becomes a ranked bar list: the name is an axis tick,
        // which is the only layout where fifty of them cannot overlap.
        const fc = charts['chart-signal-spread'];
        const focusCard = document.getElementById('card-chart-signal-spread');
        const focused = {
            points: fc.data.datasets[0].data.length,
            type: fc.config.type,
            indexAxis: fc.options.indexAxis,
            // Every player named, and nothing thinned away by autoSkip.
            named: fc.data.labels.filter(Boolean).length,
            tickLabels: fc.scales.y.ticks.filter(t => t.label).length,
            autoSkip: fc.options.scales.y.ticks.autoSkip,
            // The list grows a row per player inside a card that keeps its slot,
            // so the measurement is the scrollable content, not the card.
            canvasHeight: Math.round(
                focusCard.querySelector('.chart-scroll').getBoundingClientRect().height),
            spansGrid: focusCard.querySelector('.chart-canvas').classList.contains('is-scroll'),
            othersUntouched: charts['chart-minutes'].data.datasets[0].data.length
                === before.minutes
        };

        // A position chip on a different card, and then both cleared.
        setChartFacet('chart-minutes', 'DEF');
        await new Promise(r => setTimeout(r, 350));
        const posFacet = {
            narrowed: charts['chart-minutes'].data.datasets[0].data.length < before.minutes,
            drew: charts['chart-minutes'].data.datasets[0].data.length > 0,
            spreadStillFocused: charts['chart-signal-spread'].data.datasets[0].data.length
                === focused.points
        };
        setChartFacet('chart-minutes', 'DEF');
        setChartFacet('chart-signal-spread', firstVerdict);
        await new Promise(r => setTimeout(r, 350));
        const cleared = charts['chart-signal-spread'].data.datasets[0].data.length
            === before.spread
            && charts['chart-minutes'].data.datasets[0].data.length === before.minutes;

        // The team card needs a fixture list, and this run has no network, so it
        // hides — the same honest empty state as the transfer card. Its ⚔️/🛡️
        // chips are a mode rather than a filter, and testing that needs a
        // schedule, so one is injected here and taken back out afterwards.
        const teamHiddenWithoutFixtures = !charts['chart-team-targets'];
        const rows = state.allPlayersData[state.currentDataSource].processed;
        const clubs = [...new Set(rows.map(p => p.team_name))];
        rows.forEach(p => {
            p.next_5_fdr = 2 + (clubs.indexOf(p.team_name) % 7) * 0.4;
            p.next_5_count = 5;
        });
        processChange();
        await new Promise(r => setTimeout(r, 400));

        const teamY = () => (charts['chart-team-targets'] || {}).scales
            ? charts['chart-team-targets'].scales.y.options.title.text : '';
        setChartFacet('chart-team-targets', 'att');
        await new Promise(r => setTimeout(r, 350));
        const attY = teamY();
        const attPoints = (charts['chart-team-targets'] || { data: { datasets: [{ data: [] }] } })
            .data.datasets[0].data.length;
        setChartFacet('chart-team-targets', 'def');
        await new Promise(r => setTimeout(r, 350));
        const defY = teamY();
        // Re-clicking the live chip: a filter would clear, a mode must not.
        setChartFacet('chart-team-targets', 'def');
        await new Promise(r => setTimeout(r, 350));
        const teamSide = {
            att: /התקפית/.test(attY), def: /ספיגות/.test(defY),
            changed: attY !== defY, clubs: attPoints,
            stillDrawn: !!charts['chart-team-targets'] && /ספיגות/.test(teamY()),
            hiddenWithoutFixtures: teamHiddenWithoutFixtures
        };

        setChartFacet('chart-team-targets', 'att');
        rows.forEach(p => { p.next_5_fdr = 0; p.next_5_count = 0; });
        processChange();
        await new Promise(r => setTimeout(r, 400));
        switchMainView('table');
        return { cards: cards.length, visible: visible.length, drawn: drawn.length,
            notes: notes.length, afterToggle, faults, topSix, benched, foldedDrawn,
            spreadTicks, spreadColours: spreadColours.size, legendLabels,
            hasUnderlying: !!underlying, keepersPlotted,
            underlyingPoints: underlying ? underlying.data.datasets[0].data.length : 0,
            negTicks, unisolated,
            cardsWithChips, before, focused, posFacet, cleared, teamSide,
            // No transfer churn exists on a completed season, so this card is
            // expected to hide itself rather than draw a vertical line at zero.
            marketFlowDrawn: !!charts['chart-market-flow'] };
    });
    check(chartsView.cards === 12, `charts view built ${chartsView.cards} cards from CHART_SPECS`);
    check(JSON.stringify(chartsView.topSix) === JSON.stringify(
        ['chart-opportunity', 'chart-position', 'chart-team-targets',
            'chart-defcon', 'chart-signal-spread', 'chart-underlying']),
        `the six lead slots hold the chosen defaults (${chartsView.topSix.join(', ')})`);
    check(chartsView.benched === 6 && chartsView.foldedDrawn === 0,
        `${chartsView.benched} benched cards stay undrawn until עוד גרפים opens`);
    check(chartsView.spreadTicks.length >= 2,
        `the signal spread labels its columns (${chartsView.spreadTicks.join(', ')})`);
    check(chartsView.spreadColours > 1,
        `the signal spread paints ${chartsView.spreadColours} verdicts in different ink`);
    check(chartsView.spreadTicks.length > 0
        && chartsView.spreadTicks.every(t => chartsView.legendLabels.includes(t))
        && chartsView.legendLabels.every(l => chartsView.spreadTicks.includes(l)),
        'the signal key names exactly the verdicts the chart drew'
        + ` (key: ${chartsView.legendLabels.join(', ')})`);
    check(chartsView.negTicks > 0 && chartsView.unisolated === 0,
        `all ${chartsView.negTicks} negative axis ticks read as -25, not 25-`);
    check(chartsView.hasUnderlying && chartsView.keepersPlotted === 0,
        `xGI vs value plots ${chartsView.underlyingPoints} outfielders and no keepers`);
    check(!chartsView.marketFlowDrawn,
        'the transfer-flow card hides itself when the season has no transfer data');
    check(chartsView.visible > 0 && chartsView.drawn === chartsView.visible,
        `all ${chartsView.visible} visible charts drew (${chartsView.cards - chartsView.visible} hid themselves)`);
    check(chartsView.notes === chartsView.visible, 'every visible chart says what it answers');
    check(chartsView.faults.length === 0,
        `every visible chart is legible and its caption matches what is drawn`
        + `${chartsView.faults.length ? ` — ${chartsView.faults.join('; ')}` : ''}`);
    check(chartsView.afterToggle, 'the position matrix rebuilds when the position changes');
    check(chartsView.cardsWithChips >= 8,
        `${chartsView.cardsWithChips} cards offer a category to narrow to`);
    check(chartsView.teamSide.hiddenWithoutFixtures,
        'the team-target card hides itself until a fixture list has loaded');
    check(chartsView.teamSide.att && chartsView.teamSide.def
        && chartsView.teamSide.changed,
        `given one, it rates ${chartsView.teamSide.clubs} clubs and the chips switch`
        + ' between attack and defence');
    check(chartsView.teamSide.stillDrawn,
        're-clicking a mode chip keeps the card measuring — a mode has no off position');
    check(chartsView.focused.points > 1
        && chartsView.focused.points < chartsView.before.spread,
        `picking a verdict narrows the card to ${chartsView.focused.points} of `
        + `${chartsView.before.spread} players`);
    check(chartsView.focused.type === 'bar' && chartsView.focused.indexAxis === 'y'
        && chartsView.focused.autoSkip === false,
        'and turns into a ranked bar list, with every name an axis tick');
    check(chartsView.focused.named === chartsView.focused.points
        && chartsView.focused.tickLabels === chartsView.focused.points,
        `which is the point: ${chartsView.before.named} readable names become `
        + `${chartsView.focused.tickLabels} of ${chartsView.focused.points}`);
    check(chartsView.focused.spansGrid
        && chartsView.focused.canvasHeight >= chartsView.focused.points * 14,
        `the list grows to ${chartsView.focused.canvasHeight}px inside a scrolling card`);
    check(chartsView.focused.othersUntouched && chartsView.posFacet.spreadStillFocused,
        'narrowing one card leaves the others alone');
    check(chartsView.posFacet.narrowed && chartsView.posFacet.drew,
        'a position chip narrows its own card and it still draws');
    check(chartsView.cleared, 'clicking the live chip again clears it');
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

    // Every network call is blocked in this run, so the draft tab is in exactly
    // the failed state that used to write its message into #draftTabContent's own
    // innerHTML — deleting the sub-navigation and every container below it. Once
    // that had happened the tab was broken for the rest of the session even if a
    // later load succeeded, and the page opened onto it looking like a dead site.
    const notice = await page.evaluate(async () => {
        showTab('draft');
        await new Promise(r => setTimeout(r, 400));
        const el = document.getElementById('draftNotice');
        return {
            noticeExists: !!el,
            shown: !!el && !el.hidden,
            hasWayOut: !!document.querySelector('#draftNotice button'),
            subNavSurvived: !!document.getElementById('draftSubNav'),
            childIds: document.querySelectorAll('#draftTabContent [id]').length
        };
    });
    check(notice.noticeExists && notice.shown, 'the draft tab explains itself when it cannot load');
    check(notice.subNavSurvived && notice.childIds > 5,
        `the notice leaves the tab's markup intact (${notice.childIds} elements still present)`);
    check(notice.hasWayOut, 'the notice offers a way back to the players tab');

    // And the players tab must still be fully usable afterwards.
    const stillFine = await page.evaluate(() => {
        showTab('players');
        return document.querySelectorAll('#playersTableBody tr.player-row').length;
    });
    check(stillFine > 0, `players table still renders ${stillFine} rows after a draft failure`);

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
    const mob = await page.evaluate(() => {
        const de = document.documentElement;
        const det = document.querySelector('details');
        if (det) det.open = true;

        // "The page does not pan" is not the same as "everything is reachable".
        // Content wider than its box inside overflow-x:hidden is invisible with
        // no way to scroll to it — which is how every board card was hiding four
        // of its five columns on a phone while the page measured clean.
        const reachable = el => {
            let a = el.parentElement;
            while (a && a !== document.body) {
                const ox = getComputedStyle(a).overflowX;
                if ((ox === 'auto' || ox === 'scroll') && a.scrollWidth > a.clientWidth + 1) return true;
                a = a.parentElement;
            }
            return false;
        };
        const unreachable = [...document.querySelectorAll('body *')]
            .filter(el => el.offsetParent !== null && el.getBoundingClientRect().width > window.innerWidth + 2)
            .filter(el => !reachable(el))
            .map(el => `${el.tagName}${el.id ? '#' + el.id : ''}=${Math.round(el.getBoundingClientRect().width)}`)
            .slice(0, 4);

        // Every board card must show its value column, not just the name.
        const clippedCards = [...document.querySelectorAll('#draftBoard .db-card')]
            .filter(c => c.scrollWidth > c.clientWidth + 1).length;

        const chips = [...document.querySelectorAll('.quick-filter-btn')];
        const group = document.querySelector('.quick-filters-group');
        const row = document.querySelector('.tb-row--filters');

        // The phone bar, and the reason it exists: the view switch used to live
        // inside the filter disclosure, which is closed by default on a phone —
        // so "table or charts" was hidden behind a control labelled "search and
        // filter". Both routes to it must work with the panel shut.
        const panel = document.querySelector('#filtersPanel');
        if (panel) panel.open = false;
        const bar = document.getElementById('mobileBar');
        const barBox = bar ? bar.getBoundingClientRect() : null;
        const visible = el => {
            if (!el) return false;
            const b = el.getBoundingClientRect();
            return b.width > 0 && b.height > 0 && getComputedStyle(el).display !== 'none';
        };
        const inViewport = el => {
            const b = el.getBoundingClientRect();
            return b.top < window.innerHeight && b.bottom > 0 && b.left < window.innerWidth;
        };
        const tableBar = document.querySelector('.table-bar');
        const viewBtns = [...document.querySelectorAll('.mb-btn')];

        return {
            hScroll: de.scrollWidth > de.clientWidth + 1,
            unreachable,
            clippedCards,
            chipCount: chips.length,
            barVisible: visible(bar) && !!barBox && inViewport(bar),
            barButtons: viewBtns.length,
            barTaps: viewBtns.filter(b => b.getBoundingClientRect().height < 44).length,
            // The page-wide switches live in the header, so they are reachable
            // with every fold shut; the table's own controls sit on the table.
            headerSwitches: ['watchlistOnlyBtn', 'freeAgentsOnlyBtn']
                .filter(id => visible(document.getElementById(id))).length,
            tableBarOnTable: !!tableBar && !!tableBar.closest('#mainTableView'),
            // ...and the quick-filter chips, which really are filters, stayed in.
            chipsInsidePanel: !!(row && row.closest('#filtersPanel')),
            sheetHiddenByDefault: !!(document.getElementById('mobileSheet') || {}).hidden,
            // The chips used to sit on one nowrap line inside a scroller, so the
            // last ones were simply off-screen.
            chipsScroll: !!(group && group.scrollWidth > group.clientWidth + 1)
                || !!(row && row.scrollWidth > row.clientWidth + 1),
            smallTaps: chips.filter(c => c.getBoundingClientRect().height < 30).length
        };
    });
    check(!mob.hScroll, 'no horizontal page scroll at 390px');
    check(mob.unreachable.length === 0,
        `nothing overflows into an unscrollable box${mob.unreachable.length ? `: ${mob.unreachable.join(', ')}` : ''}`);
    check(mob.clippedCards === 0,
        `all board cards fit their columns on a phone${mob.clippedCards ? ` (${mob.clippedCards} clipped)` : ''}`);
    check(mob.chipCount > 0 && !mob.chipsScroll,
        `the ${mob.chipCount} quick-filter chips wrap instead of scrolling out of reach`);
    check(mob.smallTaps === 0,
        `every chip is a usable tap target${mob.smallTaps ? ` (${mob.smallTaps} under 30px)` : ''}`);
    check(mob.headerSwitches === 2 && mob.chipsInsidePanel,
        'both site-wide switches are in the header, and the quick filters stay in the panel');
    check(mob.tableBarOnTable, "and the table's own controls sit on the table");
    check(mob.barVisible && mob.barButtons === 5 && mob.barTaps === 0,
        `the phone bar is on screen with ${mob.barButtons} thumb-sized actions`);
    check(mob.sheetHiddenByDefault, 'the עוד sheet stays shut until it is asked for');

    // The bar has to actually drive the page, not just look like it does.
    const barDrives = await page.evaluate(async () => {
        const pressed = id => document.getElementById(id).getAttribute('aria-pressed');
        switchMainView('charts', true);
        await new Promise(r => setTimeout(r, 500));
        const onCharts = {
            charts: document.getElementById('mainChartsView').style.display !== 'none',
            barSaysCharts: pressed('mbCharts') === 'true' && pressed('mbTable') === 'false',
            // The charts section unfolds rather than replacing the table.
            toolbarSaysCharts: document.getElementById('chartsPanel').open
        };
        toggleMobileSheet(true);
        await new Promise(r => setTimeout(r, 200));
        const sheetOpen = !document.getElementById('mobileSheet').hidden;
        // Opening the filter panel from the sheet must also shut the sheet.
        openFiltersPanel();
        await new Promise(r => setTimeout(r, 200));
        const afterFilters = {
            panelOpen: document.getElementById('filtersPanel').open,
            sheetShut: document.getElementById('mobileSheet').hidden
        };
        jumpToDraftBoard();
        await new Promise(r => setTimeout(r, 300));
        switchMainView('table', true);
        await new Promise(r => setTimeout(r, 400));
        return {
            ...onCharts, sheetOpen, ...afterFilters,
            backToTable: document.getElementById('mainTableView').style.display !== 'none'
        };
    });
    check(barDrives.charts && barDrives.barSaysCharts && barDrives.toolbarSaysCharts,
        'tapping גרפים switches the view and both copies of the switch agree');
    check(barDrives.sheetOpen, 'עוד opens the sheet');
    check(barDrives.panelOpen && barDrives.sheetShut,
        'and an action from the sheet runs it and gets the sheet out of the way');
    check(barDrives.backToTable, 'and the way back to the table works');

    // The one-page contract: the filters at the top govern the charts, the
    // board and the table together, and a slot swap moves cards without
    // rebuilding anything.
    const onePage = await page.evaluate(async () => {
        // Order down the page: filters → charts → board → table.
        const y = id => document.getElementById(id).getBoundingClientRect().top + window.scrollY;
        const ordered = y('filtersPanel') < y('chartsPanel')
            && y('chartsPanel') < y('draftBoard')
            && y('draftBoard') < y('mainTableView');

        // Filter to defenders and let the debounce fire.
        document.getElementById('positionFilter').value = 'DEF';
        processChange();
        await new Promise(r => setTimeout(r, 500));
        const boardRows = [...document.querySelectorAll('#draftBoard .db-tbl tbody tr')];
        const posOnBoard = new Set(state.filteredData.map(p => p.position_name));
        const scope = (document.querySelector('#draftBoard .db-scope') || {}).textContent || '';
        const oppPoints = charts['chart-opportunity']
            ? charts['chart-opportunity'].data.datasets[0].data.length : 0;
        const allDef = [...posOnBoard].every(p => p === 'DEF');
        document.getElementById('positionFilter').value = '';
        processChange();
        await new Promise(r => setTimeout(r, 500));

        // The six lead slots are pinned; the rest are behind the fold.
        const lead = [...document.querySelectorAll('#chartsGrid .chart-card')]
            .map(c => c.id.replace(/^card-/, ''));
        const noSwapControl = document.querySelectorAll('.chart-swap').length === 0;

        return { ordered, allDef, boardRows: boardRows.length, scope,
            oppPoints, lead, noSwapControl };
    });
    check(onePage.ordered, 'the page reads filters → charts → board → table');
    check(onePage.allDef && onePage.boardRows > 0,
        'filtering to defenders narrows the board to defenders, and it still recommends');
    check(/לפי הסינון/.test(onePage.scope),
        `and the board's scope line says it is filtered ("${onePage.scope.trim()}")`);
    check(onePage.oppPoints > 0, 'the lead chart redraws from the same filtered set');
    check(onePage.lead[0] === 'chart-opportunity' && onePage.lead.length === 6,
        'the six lead slots are pinned and survive a filter round-trip');
    check(onePage.noSwapControl, 'and carry no per-slot swap control');

    // Two things that were quietly wrong: the momentum window drove the table
    // alone, and a focused verdict grew its card to ~1200px and spanned the
    // grid — one chip click and the page jumped.
    const windowAndFocus = await page.evaluate(async () => {
        const cardH = () => Math.round(
            document.getElementById('card-chart-signal-spread').getBoundingClientRect().height);
        const canvasBox = () => document.querySelector('#card-chart-signal-spread .chart-canvas');

        const beforeH = cardH();
        const chip = [...document.querySelectorAll('#facet-chart-signal-spread [data-facet-value]')]
            .map(b => b.dataset.facetValue).filter(Boolean)[0];
        setChartFacet('chart-signal-spread', chip);
        await new Promise(r => setTimeout(r, 500));
        const focused = {
            cardGrew: cardH() - beforeH,
            spansGrid: document.getElementById('card-chart-signal-spread')
                .classList.contains('is-tall'),
            scrolls: canvasBox().classList.contains('is-scroll')
                && canvasBox().scrollHeight > canvasBox().clientHeight + 20,
            bars: charts['chart-signal-spread'].data.labels.length
        };
        setChartFacet('chart-signal-spread', chip);
        await new Promise(r => setTimeout(r, 400));

        // The momentum window has to reach the charts and the board, not just
        // the table: the opportunity board's y axis IS the window.
        const axis = () => charts['chart-opportunity'].options.scales.y.title.text;
        const scope = () => (document.querySelector('#draftBoard .db-scope') || {}).textContent || '';
        const at5 = { axis: axis(), scope: scope() };
        setTrendWindow(10);
        await new Promise(r => setTimeout(r, 2500));
        const at10 = { axis: axis(), scope: scope() };
        setTrendWindow(5);
        await new Promise(r => setTimeout(r, 2500));
        return { focused, at5, at10, restored: axis() === at5.axis };
    });
    check(windowAndFocus.focused.bars > 10 && !windowAndFocus.focused.spansGrid
        && windowAndFocus.focused.cardGrew < 40,
        `a focused verdict lists ${windowAndFocus.focused.bars} players without`
        + ` growing its card (${windowAndFocus.focused.cardGrew}px)`);
    check(windowAndFocus.focused.scrolls, 'it scrolls inside the card instead');
    check(/10/.test(windowAndFocus.at10.axis) && windowAndFocus.at10.axis !== windowAndFocus.at5.axis,
        `the momentum window reaches the charts ("${windowAndFocus.at10.axis}")`);
    check(/10 מחזורים/.test(windowAndFocus.at10.scope)
        && windowAndFocus.at10.scope !== windowAndFocus.at5.scope,
        'and the draft board');
    check(windowAndFocus.restored, 'and setting it back restores them');

    // The window reaches the per-90 metrics themselves, not only the axes that
    // were already deltas — and every axis states the span it was measured over,
    // because the archived snapshot logs no xGC and that one cannot follow.
    const spans = await page.evaluate(async () => {
        const axes = () => {
            const out = {};
            for (const [id, ch] of Object.entries(charts)) {
                if (!ch || !ch.options || !ch.options.scales) continue;
                out[id] = ['x', 'y']
                    .map(a => (((ch.options.scales[a] || {}).title || {}).text) || '')
                    .join(' | ');
            }
            return out;
        };
        setChartPosition('MID');
        await new Promise(r => setTimeout(r, 400));
        const at5 = axes();
        const midX = charts['chart-position'].data.datasets[0].data.map(d => d.x);
        setTrendWindow(10);
        await new Promise(r => setTimeout(r, 2500));
        const at10 = axes();
        const midX10 = charts['chart-position'].data.datasets[0].data.map(d => d.x);
        // The goalkeeper matrix: xGC has no per-gameweek record in the archive.
        setChartPosition('GKP');
        await new Promise(r => setTimeout(r, 400));
        const gk = ['x', 'y'].map(a =>
            charts['chart-position'].options.scales[a].title.text);
        setChartPosition('MID');
        setTrendWindow(5);
        await new Promise(r => setTimeout(r, 2500));
        return {
            labelled: Object.values(at5).filter(t => /מחזורים|כל העונה/.test(t)).length,
            total: Object.keys(at5).length,
            midMoved: JSON.stringify(midX) !== JSON.stringify(midX10),
            at5: at5['chart-position'], at10: at10['chart-position'],
            gkX: gk[0], gkY: gk[1]
        };
    });
    check(spans.midMoved,
        'the window reshapes the position matrix itself, not just its label');
    check(/5 מחזורים/.test(spans.at5) && /10 מחזורים/.test(spans.at10),
        `and the axes say which span (${spans.at5})`);
    check(/כל העונה/.test(spans.gkX) && /מחזורים/.test(spans.gkY),
        `xGC has no per-gameweek record, so that axis stays season-long`
        + ` while its partner follows the window (${spans.gkX})`);

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
