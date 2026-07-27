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
        const trendKeys = (js.match(/const trendKeys = \[([^\]]*)\]/) || [, ''])[1];
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

if (failures.length) {
    console.error('Structural checks FAILED:');
    failures.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
}
console.log('Structural checks passed.');
