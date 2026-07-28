/**
 * Names other people in the league typed.
 *
 * `entry_name` and the manager names come from the Draft API, which means a
 * league-mate chose them — they are the only strings on the page authored by
 * someone other than the FPL API or this codebase. They were interpolated raw
 * into the standings tables' `innerHTML`, so a team called
 * `<img src=x onerror="…">` would have executed. Fifteen sites, added one at a
 * time over the life of the draft tab.
 *
 * `scripts/check-structure.mjs` guards the call sites. This guards the function
 * they all now go through.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadFunctions } from './helpers/load-script.mjs';

const { escapeHtml } = loadFunctions(['escapeHtml']);

/** What a hostile league-mate could plausibly put in a team name. */
const PAYLOADS = [
    '<img src=x onerror="alert(1)">',
    '<script>alert(1)</script>',
    '"><script>alert(1)</script>',
    "'><svg/onload=alert(1)>",
    '</td></tr><tr><td>injected',
    '<iframe src="javascript:alert(1)">',
    '&lt;already escaped&gt;'
];

describe('escapeHtml', () => {
    test('leaves no character that can open a tag or close an attribute', () => {
        for (const payload of PAYLOADS) {
            const out = escapeHtml(payload);
            for (const ch of ['<', '>', '"', "'"]) {
                assert.ok(!out.includes(ch),
                    `escaping ${JSON.stringify(payload)} left a bare ${ch}: ${out}`);
            }
        }
    });

    test('escapes the ampersand first, so the escaping cannot be undone', () => {
        // If & were escaped last, `&lt;` would come back out as `<` after a
        // round trip through an HTML parser.
        assert.equal(escapeHtml('&lt;script&gt;'), '&amp;lt;script&amp;gt;');
        assert.equal(escapeHtml('&'), '&amp;');
    });

    test('a payload in a table cell stays inert markup', () => {
        const row = `<td>${escapeHtml('<img src=x onerror="alert(1)">')}</td>`;
        assert.ok(!/<img/i.test(row), 'the tag must not survive as a tag');
        assert.ok(row.includes('&lt;img'), 'it should render as visible text instead');
        // One <td> open and one close, and nothing else structural.
        assert.equal((row.match(/<[a-z/]/gi) || []).length, 2);
    });

    test('a payload in an attribute cannot break out of the quotes', () => {
        const attr = `<span title="${escapeHtml('" onmouseover="alert(1)')}">x</span>`;
        assert.ok(!attr.includes('onmouseover="alert'),
            'the quote must be neutralised or the handler becomes real');
        assert.equal((attr.match(/"/g) || []).length, 2, 'exactly the two quotes we wrote');
    });

    test('ordinary names are untouched', () => {
        for (const name of ['Amit United', 'Los chicos', 'Nott’m Forest', 'קבוצה שלי', 'AEK Shemesh']) {
            assert.equal(escapeHtml(name), name, `${name} should pass through unchanged`);
        }
    });

    test('null and undefined become empty, not the strings "null"/"undefined"', () => {
        // A team with no name should render as blank, not as the word null.
        assert.equal(escapeHtml(null), '');
        assert.equal(escapeHtml(undefined), '');
        assert.equal(escapeHtml(0), '0', 'but a falsy number is still a value');
    });
});
