/**
 * Loads individual functions out of the (still monolithic, non-module)
 * script.js so they can be unit-tested against the real source rather than a
 * copy that can drift.
 *
 * Once script.js is split into ES modules this file goes away and the tests
 * import directly.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SCRIPT_SRC = readFileSync(join(ROOT, 'script.js'), 'utf8');
export const REPO_ROOT = ROOT;

/** Extract a top-level `function name(...) { ... }` by brace matching. */
export function extractFunction(name, src = SCRIPT_SRC) {
    const start = src.indexOf(`function ${name}(`);
    if (start < 0) throw new Error(`function ${name} not found in script.js`);
    let depth = 0;
    for (let i = src.indexOf('{', start); i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') {
            depth--;
            if (depth === 0) return src.slice(start, i + 1);
        }
    }
    throw new Error(`unbalanced braces while extracting ${name}`);
}

/**
 * Evaluate the named functions in one shared scope and return them.
 * `globals` are installed on globalThis first (state, config, ...).
 */
export function loadFunctions(names, globals = {}) {
    Object.assign(globalThis, globals);
    const body = names.map(n => extractFunction(n)).join('\n');
    const factory = new Function(`${body}\nreturn { ${names.join(', ')} };`);
    return factory();
}

/** Minimal in-memory localStorage + window for browser-facing helpers. */
export function installBrowserStubs(search = '') {
    const store = new Map();
    globalThis.localStorage = {
        getItem: k => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: k => store.delete(k),
        clear: () => store.clear(),
        get length() { return store.size; },
        key: i => [...store.keys()][i]
    };
    globalThis.window = { location: { search } };
    return { store, setSearch: s => { globalThis.window.location.search = s; } };
}
