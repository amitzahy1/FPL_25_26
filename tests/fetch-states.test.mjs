/**
 * The two upstream replies that are answers, not failures.
 *
 * Both used to fall through the proxy chain and surface as
 * "Could not fetch data. Please run 'node local_proxy.js'", which sends you to
 * debug a proxy that is working perfectly:
 *
 *   Game Updating  FPL takes the Draft game down between seasons and serves an
 *                  HTML maintenance page with a 200 status, so *every* proxy
 *                  returns the same non-JSON body.
 *   404 / 403      The league does not exist — what a league id from last season
 *                  looks like once the new game opens.
 *
 * Walking the rest of the chain cannot turn either into data, so both must stop
 * the walk and travel out with a code the callers can render.
 */

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadFunctions, installBrowserStubs, SCRIPT_SRC } from './helpers/load-script.mjs';

const OWN_PROXY = 'https://fpl-proxy.amitzahy1.workers.dev/?url=';
const TARGET = 'https://draft.premierleague.com/api/league/689/details';

const GAME_UPDATING_HTML =
    '<!DOCTYPE html><html><head><title>Game Updating</title></head><body>Game Updating</body></html>';

/** A fetch stub that answers per proxy prefix and counts what was attempted. */
function stubFetch(responder) {
    const calls = [];
    globalThis.fetch = async (url) => {
        calls.push(url);
        const answer = responder(url) || { status: 500, body: '' };
        return {
            ok: answer.status >= 200 && answer.status < 300,
            status: answer.status,
            text: async () => answer.body,
            json: async () => JSON.parse(answer.body)
        };
    };
    return calls;
}

function load() {
    installBrowserStubs();
    globalThis.IS_LOCAL_DEV = false;
    globalThis.DEBUG_LOGS = false;
    globalThis.dbg = () => {};
    globalThis.evictCacheEntries = () => false;
    globalThis.CACHE_SCHEMA = 'v1';

    const fns = loadFunctions(['_fetchWithCacheUncoalesced'], {
        config: {
            corsProxy: OWN_PROXY,
            corsProxyFallbacks: [
                'https://api.codetabs.com/v1/proxy?quest=',
                'https://corsproxy.io/?'
            ]
        }
    }, ['OWN_PROXY']);
    return fns._fetchWithCacheUncoalesced;
}

afterEach(() => { delete globalThis.fetch; });

describe('season-rollover maintenance', () => {
    test('a "Game Updating" page is reported as maintenance, not as a proxy failure', async () => {
        const fetchWithCache = load();
        stubFetch(() => ({ status: 200, body: GAME_UPDATING_HTML }));

        await assert.rejects(
            () => fetchWithCache(TARGET, 'k', 5),
            err => {
                assert.equal(err.code, 'GAME_UPDATING');
                assert.doesNotMatch(err.message, /local_proxy/,
                    'the old message sent the user to debug a healthy proxy');
                return true;
            });
    });

    test('it stops the walk instead of asking every proxy the same question', async () => {
        const fetchWithCache = load();
        const calls = stubFetch(() => ({ status: 200, body: GAME_UPDATING_HTML }));

        await assert.rejects(() => fetchWithCache(TARGET, 'k', 5));
        assert.equal(calls.length, 1, 'every proxy would return the same page, more slowly');
    });
});

describe('league not found', () => {
    test('a 404 from our own Worker is FPL answering, so it travels out as NOT_FOUND', async () => {
        // Our Worker forwards the upstream status untouched — that is what makes
        // its 404 trustworthy where a public proxy's would not be.
        const fetchWithCache = load();
        stubFetch(url => url.startsWith(OWN_PROXY) ? { status: 404, body: 'Not Found' } : null);

        await assert.rejects(
            () => fetchWithCache(TARGET, 'k', 5),
            err => {
                assert.equal(err.code, 'NOT_FOUND');
                assert.equal(err.status, 404);
                return true;
            });
    });

    test('403 is treated the same way', async () => {
        const fetchWithCache = load();
        stubFetch(url => url.startsWith(OWN_PROXY) ? { status: 403, body: '' } : null);
        await assert.rejects(() => fetchWithCache(TARGET, 'k', 5),
            err => err.code === 'NOT_FOUND');
    });

    test('a 404 from a public proxy is NOT trusted — it may be the proxy that is missing', async () => {
        const fetchWithCache = load();
        const payload = JSON.stringify({ league: { id: 1 } });
        // Our Worker is down; the first fallback 404s on its own account; the
        // second has the data. Trusting the fallback's 404 would have thrown away
        // a working answer.
        stubFetch(url => {
            if (url.startsWith(OWN_PROXY)) return { status: 502, body: '' };
            if (url.startsWith('https://api.codetabs.com')) return { status: 404, body: 'nope' };
            return { status: 200, body: payload };
        });

        const data = await fetchWithCache(TARGET, 'k', 5);
        assert.deepEqual(data, { league: { id: 1 } });
    });
});

describe('the ordinary paths still work', () => {
    test('good JSON from the first proxy is returned', async () => {
        const fetchWithCache = load();
        stubFetch(() => ({ status: 200, body: JSON.stringify({ ok: true }) }));
        assert.deepEqual(await fetchWithCache(TARGET, 'k', 5), { ok: true });
    });

    test('a genuinely dead chain still reports itself as one', async () => {
        const fetchWithCache = load();
        stubFetch(() => ({ status: 500, body: '' }));
        await assert.rejects(() => fetchWithCache(TARGET, 'k', 5),
            err => {
                assert.equal(err.code, undefined, 'no code: this one really is a fetch failure');
                assert.match(err.message, /Could not fetch data/);
                return true;
            });
    });

    test('non-JSON that is not the maintenance page falls through to the next proxy', async () => {
        const fetchWithCache = load();
        const payload = JSON.stringify({ recovered: true });
        stubFetch(url => url.startsWith(OWN_PROXY)
            ? { status: 200, body: '<html>some other error</html>' }
            : { status: 200, body: payload });

        assert.deepEqual(await fetchWithCache(TARGET, 'k', 5), { recovered: true });
    });
});

describe('our own Worker stays in the chain', () => {
    test('it is still tried after a fallback has been promoted', async () => {
        // config.corsProxy is reassigned to whichever fallback answered first.
        // When the chain was built from that field alone the Worker dropped out
        // for the rest of the session — and it is the only proxy that serves the
        // ~1.5 MB bootstrap without a 413, so the session never got it back.
        installBrowserStubs();
        globalThis.IS_LOCAL_DEV = false;
        globalThis.DEBUG_LOGS = false;
        globalThis.dbg = () => {};
        globalThis.evictCacheEntries = () => false;

        const promoted = 'https://api.codetabs.com/v1/proxy?quest=';
        const config = {
            corsProxy: promoted,             // a fallback won earlier this session
            corsProxyFallbacks: [promoted, 'https://corsproxy.io/?']
        };
        const { _fetchWithCacheUncoalesced: fetchWithCache } =
            loadFunctions(['_fetchWithCacheUncoalesced'], { config }, ['OWN_PROXY']);

        const calls = stubFetch(url => url.startsWith(OWN_PROXY)
            ? { status: 200, body: JSON.stringify({ big: 'payload' }) }
            : { status: 413, body: 'Payload Too Large' });

        const data = await fetchWithCache(TARGET, 'k', 5);
        assert.deepEqual(data, { big: 'payload' });
        assert.ok(calls.some(u => u.startsWith(OWN_PROXY)), 'the Worker must still be reachable');
    });

    test('and its 404 is therefore still trusted in that state', async () => {
        installBrowserStubs();
        globalThis.IS_LOCAL_DEV = false;
        globalThis.DEBUG_LOGS = false;
        globalThis.dbg = () => {};
        globalThis.evictCacheEntries = () => false;

        const promoted = 'https://api.codetabs.com/v1/proxy?quest=';
        const config = { corsProxy: promoted, corsProxyFallbacks: [promoted] };
        const { _fetchWithCacheUncoalesced: fetchWithCache } =
            loadFunctions(['_fetchWithCacheUncoalesced'], { config }, ['OWN_PROXY']);

        stubFetch(url => url.startsWith(OWN_PROXY)
            ? { status: 404, body: 'Not Found' }
            : { status: 500, body: '' });

        await assert.rejects(() => fetchWithCache(TARGET, 'k', 5),
            err => err.code === 'NOT_FOUND');
    });
});

describe('FPL Draft\'s own ranking does not depend on the league', () => {
    test('the ranks are applied where the draft bootstrap is read, not where the league is', () => {
        // The scenario this guards is the ordinary state of the days before a
        // draft: the Draft game is back up, but the league id in settings is
        // still last season's and no longer resolves. draft_rank rides on
        // draft.premierleague.com/api/bootstrap-static, which is
        // league-independent, so it is available in that state — but it used to
        // be applied only inside the league load's success block, so the most
        // draft-relevant column in the table stayed empty.
        const build = SCRIPT_SRC.slice(
            SCRIPT_SRC.indexOf('async function buildDraftToFplMapping('),
            SCRIPT_SRC.indexOf('function showLoading('));

        assert.match(build, /applyDraftRanks\(\)/,
            'buildDraftToFplMapping must apply the ranks it just downloaded');

        // And it must do so before returning, not behind a league-shaped guard.
        const applyAt = build.indexOf('applyDraftRanks()');
        const returnAt = build.indexOf('success: true');
        assert.ok(applyAt > 0 && applyAt < returnAt,
            'the ranks must be applied on the success path of the mapping itself');
        assert.doesNotMatch(build.slice(applyAt - 400, applyAt),
            /league_entries|state\.draft\.details/,
            'applying the ranks must not be conditional on league data');
    });
});

describe('the notices exist for both states', () => {
    test('each code has a renderer wired to it', () => {
        for (const [code, fn] of [
            ['GAME_UPDATING', 'renderDraftMaintenanceNotice'],
            ['NOT_FOUND', 'renderDraftLeagueNotFoundNotice']
        ]) {
            assert.match(SCRIPT_SRC, new RegExp(`code === '${code}'`),
                `${code} must be handled where the draft tab loads`);
            assert.match(SCRIPT_SRC, new RegExp(`function ${fn}\\(`),
                `${fn} must exist to explain ${code}`);
        }
    });
});
