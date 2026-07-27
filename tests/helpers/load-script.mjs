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

    // Step over the parameter list before looking for the body. A destructured
    // parameter — `function f(a, { flag = false } = {})` — puts a brace inside
    // the parentheses, and matching from the first `{` in the file truncated the
    // function at the end of that parameter instead of the end of the body.
    let paren = 0, i = src.indexOf('(', start);
    for (; i < src.length; i++) {
        if (src[i] === '(') paren++;
        else if (src[i] === ')') {
            paren--;
            if (paren === 0) { i++; break; }
        }
    }

    let depth = 0;
    for (let j = src.indexOf('{', i); j < src.length; j++) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') {
            depth--;
            if (depth === 0) return src.slice(start, j + 1);
        }
    }
    throw new Error(`unbalanced braces while extracting ${name}`);
}

/**
 * Extract a top-level `const name = <expr>;` by scanning to the semicolon at
 * bracket depth 0, skipping strings, template literals and comments so a `;`
 * inside any of them does not end the declaration early.
 */
export function extractDeclaration(name, src = SCRIPT_SRC) {
    const decl = new RegExp(`^(?:const|let|var)\\s+${name}\\s*=`, 'm');
    const at = src.search(decl);
    if (at < 0) throw new Error(`declaration ${name} not found in script.js`);

    let depth = 0;
    for (let i = src.indexOf('=', at) + 1; i < src.length; i++) {
        const c = src[i], next = src[i + 1];
        if (c === '/' && next === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
        if (c === '/' && next === '*') { i = src.indexOf('*/', i) + 1; continue; }
        if (c === '"' || c === "'" || c === '`') {
            const quote = c;
            for (i++; i < src.length; i++) {
                if (src[i] === '\\') { i++; continue; }
                if (src[i] === quote) break;
                // A `${...}` in a template can itself contain the quote char.
                if (quote === '`' && src[i] === '$' && src[i + 1] === '{') {
                    let d = 1;
                    for (i += 2; i < src.length && d > 0; i++) {
                        if (src[i] === '{') d++;
                        else if (src[i] === '}') d--;
                    }
                    i--;
                }
            }
            continue;
        }
        if (c === '{' || c === '[' || c === '(') depth++;
        else if (c === '}' || c === ']' || c === ')') depth--;
        else if (c === ';' && depth === 0) return src.slice(at, i + 1);
    }
    throw new Error(`unterminated declaration ${name}`);
}

/**
 * Evaluate the named functions in one shared scope and return them.
 * `globals` are installed on globalThis first (state, config, ...).
 * `deps` names top-level consts the functions close over (lookup tables, keys);
 * they are pulled from the same source so the tests cannot drift from it.
 */
export function loadFunctions(names, globals = {}, deps = []) {
    Object.assign(globalThis, globals);
    const body = [
        ...deps.map(n => extractDeclaration(n)),
        ...names.map(n => extractFunction(n))
    ].join('\n');
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
