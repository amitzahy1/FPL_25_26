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
        const on = { top: top(), checked: document.querySelector('.db-toggle input').checked };
        const ownedShownWhileOn = top().filter(n => [...owned]
            .some(id => (state.allPlayersData[state.currentDataSource].processed
                .find(p => p.id === id) || {}).web_name === n)).length;

        toggleBoardFreeAgents(false);
        await new Promise(r => setTimeout(r, 150));
        const off = { top: top(), scope: document.querySelector('.db-scope').textContent };

        toggleBoardFreeAgents(true);
        await new Promise(r => setTimeout(r, 150));
        return {
            enabled: !document.querySelector('.db-toggle input').disabled,
            onChecked: on.checked,
            ownedShownWhileOn,
            changed: JSON.stringify(on.top) !== JSON.stringify(off.top),
            offSaysSo: /כולל תפוסים/.test(off.scope),
            restored: JSON.stringify(top()) === JSON.stringify(on.top)
        };
    });
    check(faToggle.enabled && faToggle.onChecked,
        'the free-agent filter is live and on once the draft has been held');
    check(faToggle.ownedShownWhileOn === 0,
        `the board never recommends an owned player while the filter is on`);
    check(faToggle.changed && faToggle.offSaysSo,
        'turning it off widens the pool to owned players and the board says so');
    check(faToggle.restored, 'turning it back on restores the free-agent recommendations');

    // Put it back, so the later checks see the state they expect.
    await page.evaluate(() => {
        state.draft.ownedElementIds = new Set();
        computeDraftMetrics(state.allPlayersData[state.currentDataSource].processed);
        invalidateSignals();
        renderDraftBoard();
    });

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
        const cards = [...document.querySelectorAll('#chartsGrid .chart-card')];
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
        }

        // Switch the position matrix and make sure it rebuilds rather than leaking
        // the destroyed instance.
        setChartPosition('DEF');
        await new Promise(r => setTimeout(r, 300));
        const afterToggle = !!charts['chart-position'];
        switchMainView('table');
        return { cards: cards.length, visible: visible.length, drawn: drawn.length,
            notes: notes.length, afterToggle, faults };
    });
    check(chartsView.cards === 8, `charts view built ${chartsView.cards} cards from CHART_SPECS`);
    check(chartsView.visible > 0 && chartsView.drawn === chartsView.visible,
        `all ${chartsView.visible} visible charts drew (${chartsView.cards - chartsView.visible} hid themselves)`);
    check(chartsView.notes === chartsView.visible, 'every visible chart says what it answers');
    check(chartsView.faults.length === 0,
        `every visible chart is legible and its caption matches what is drawn`
        + `${chartsView.faults.length ? ` — ${chartsView.faults.join('; ')}` : ''}`);
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
        return {
            hScroll: de.scrollWidth > de.clientWidth + 1,
            unreachable,
            clippedCards,
            chipCount: chips.length,
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
