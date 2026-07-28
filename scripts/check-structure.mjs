#!/usr/bin/env node
/**
 * Cheap structural checks on index.html, for the failure modes this project has
 * actually shipped to production:
 *   - a committed merge conflict (this was live for months)
 *   - duplicate element IDs (51 of them, from a duplicated <body>)
 *   - the table header count drifting away from the row builder
 *   - a stale cache-buster, which served old JS to returning users
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const js = readFileSync(join(ROOT, 'script.js'), 'utf8');

const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

// 1. merge conflict markers
for (const marker of ['<<<<<<<', '=======', '>>>>>>>']) {
    const n = html.split(`\n${marker}`).length - 1;
    check(n === 0, `index.html contains ${n} '${marker}' merge-conflict marker(s)`);
}

// 2. duplicate ids
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
check(dupes.length === 0, `duplicate element ids: ${dupes.join(', ')}`);

// 3. players table: header count must match the row builder's <td> count
const thead = html.match(/<table id="playersTable">[\s\S]*?<\/thead>/);
check(!!thead, 'players table header block not found');
if (thead) {
    const headers = [...thead[0].matchAll(/<th\b/g)].length;
    const rowFn = js.match(/function createPlayerRowHtml[\s\S]*?\n}/);
    check(!!rowFn, 'createPlayerRowHtml not found');
    if (rowFn) {
        // <td> written literally, plus the trend cells emitted from trendKeys
        const literal = [...rowFn[0].matchAll(/<td\b/g)].length;
        const trendKeys = (js.match(/const trendKeys = \[([^\]]*)\]/) || ['', ''])[1];
        const trendCount = trendKeys.split(',').filter(x => x.trim()).length;
        const cells = literal + trendCount;
        check(headers === cells,
            `players table has ${headers} headers but the row builder emits ${cells} cells`);
    }
}

// 4. cache-buster present and consistent across assets
const stamps = [...html.matchAll(/(?:script|style|mobile)\.(?:js|css)\?v=([\d.]+)/g)].map(m => m[1]);
check(stamps.length >= 2, 'assets are missing the ?v= cache-buster');
check(new Set(stamps).size <= 1, `assets carry mismatched cache-busters: ${[...new Set(stamps)].join(', ')}`);

// 5. no localhost-only proxy as the shipped default
const proxy = js.match(/corsProxy:\s*'([^']+)'/);
check(!!proxy, 'config.corsProxy not found');
if (proxy) {
    check(!/localhost|127\.0\.0\.1/.test(proxy[1]),
        `config.corsProxy points at a local address: ${proxy[1]}`);
}

// 6. the minutes floor is written in two places and they drifted apart, so איפוס
//    silently produced a different table from a fresh page load
const htmlMinutes = html.match(/id="minMinutes"[\s\S]{0,200}?value="(\d+)"/);
const jsMinutes = js.match(/const DEFAULT_MIN_MINUTES = '(\d+)'/);
check(!!htmlMinutes, 'the minMinutes input has no default value');
check(!!jsMinutes, 'DEFAULT_MIN_MINUTES not found in script.js');
if (htmlMinutes && jsMinutes) {
    check(htmlMinutes[1] === jsMinutes[1],
        `minMinutes opens on ${htmlMinutes[1]} but איפוס restores ${jsMinutes[1]}`);
}

// 7. every smart-filter chip has a rule, and every rule has a chip. Both
//    directions have shipped broken: five chips were once no-ops, and later three
//    rules had no chip and could never run.
const chips = [...html.matchAll(/toggleQuickFilter\(this,\s*'([a-z_]+)'\)/g)].map(m => m[1]);
const qf = js.match(/const QUICK_FILTERS = \{[\s\S]*?\n\};/);
check(chips.length > 0, 'no smart-filter chips found in index.html');
check(!!qf, 'QUICK_FILTERS not found in script.js');
if (chips.length && qf) {
    const rules = [...qf[0].matchAll(/^ {4}([a-z_]+): \{/gm)].map(m => m[1]);
    const orphanChips = chips.filter(c => !rules.includes(c));
    const unreachable = rules.filter(r => !chips.includes(r));
    check(orphanChips.length === 0,
        `smart-filter chip with no rule (highlights and does nothing): ${orphanChips.join(', ')}`);
    check(unreachable.length === 0,
        `smart-filter rule with no chip (unreachable): ${unreachable.join(', ')}`);
}

// 8. modals must not sit inside a tab. A tab is display:none when inactive, and a
//    hidden parent hides the modal with it — this took out השוואה once and הגדרות
//    from the draft tab for far longer.
//
//    Measured by <div> nesting depth, not by a text range: the modals now sit
//    between the two tabs in source order, which a start/end index test reads as
//    "inside the first one".
{
    // Comments are stripped first so prose mentioning a tag cannot skew the depth.
    const bare = html.replace(/<!--[\s\S]*?-->/g, '');
    const tags = [...bare.matchAll(/<(\/?)div\b[^>]*>/g)];
    const opensTab = t => /id="(players|draft)TabContent"/.test(t[0]);

    const nested = [];
    for (let i = 0; i < tags.length; i++) {
        if (!opensTab(tags[i])) continue;
        let depth = 0;
        for (let j = i; j < tags.length; j++) {
            depth += tags[j][1] ? -1 : 1;
            if (depth === 0) break;
            const id = tags[j][0].match(/id="(\w*[Mm]odal)"/);
            if (id) nested.push(id[1]);
        }
    }
    check(nested.length === 0,
        `modal(s) nested inside a tab, so they cannot open from the other one: ${nested.join(', ')}`);
}

if (failures.length) {
    console.error('Structural checks FAILED:');
    failures.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
}
console.log('Structural checks passed.');
