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
const html = readFileSync(INDEX, 'utf8');
const updated = html.replace(
    /(<script src="script\.js\?v=)[^"]*(")/,
    `$1${version}$2`
);

if (updated === html) {
    console.error('No script.js version tag found in index.html — nothing stamped.');
    process.exit(1);
}

writeFileSync(INDEX, updated);
console.log(`Stamped script.js?v=${version}`);
