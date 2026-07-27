#!/usr/bin/env node
/**
 * Stamps a fresh cache-busting version onto the script tag in index.html.
 *
 * The version query sat at 4.0.0 for months while script.js changed
 * repeatedly, so returning visitors kept executing a cached copy and did not
 * receive fixes. Run this whenever script.js changes:
 *
 *   npm run stamp
 *
 * Uses the current git commit count so the value always moves forward and is
 * reproducible, falling back to a timestamp outside a git checkout.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(ROOT, 'index.html');

function nextVersion() {
    try {
        const count = execSync('git rev-list --count HEAD', { cwd: ROOT }).toString().trim();
        const date = execSync('git log -1 --format=%cd --date=format:%Y.%m.%d', { cwd: ROOT }).toString().trim();
        return `${date}.${count}`;
    } catch {
        return new Date().toISOString().slice(0, 10).replace(/-/g, '.');
    }
}

const version = nextVersion();
let html = readFileSync(INDEX, 'utf8');

// The stylesheets need this as much as the script does: a release that changes
// both shipped new markup against cached CSS, which looks like a layout bug
// rather than a caching one. `?v=` is optional in the pattern so a first run
// adds it.
const ASSETS = [
    { name: 'script.js', tag: /(<script src="script\.js)(\?v=[^"]*)?(")/ },
    { name: 'style.css', tag: /(<link rel="stylesheet" href="style\.css)(\?v=[^"]*)?(")/ },
    { name: 'mobile.css', tag: /(<link rel="stylesheet" href="mobile\.css)(\?v=[^"]*)?(")/ }
];

const stamped = [];
const missing = [];

for (const asset of ASSETS) {
    const match = html.match(asset.tag);
    if (!match) { missing.push(asset.name); continue; }
    if (match[2] === `?v=${version}`) continue;   // already current
    html = html.replace(asset.tag, `$1?v=${version}$3`);
    stamped.push(`${asset.name} ${match[2] ? match[2].slice(3) : '(none)'} -> ${version}`);
}

if (missing.length === ASSETS.length) {
    console.error('No asset tags found in index.html — nothing stamped.');
    process.exit(1);
}
if (missing.length) console.warn(`Not found in index.html, skipped: ${missing.join(', ')}`);

// Re-running on the same commit yields the same version. That is a no-op, not
// a failure -- treating it as one made the script look broken.
if (!stamped.length) {
    console.log(`All assets already at v=${version}`);
    process.exit(0);
}

writeFileSync(INDEX, html);
stamped.forEach(line => console.log(`Stamped ${line}`));
