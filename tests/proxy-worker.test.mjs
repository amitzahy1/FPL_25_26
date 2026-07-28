/**
 * The Cloudflare Worker is a public CORS proxy, so its domain whitelist is a
 * security boundary and not a convenience. It was previously matched with
 * `endpoint.startsWith('https://fantasy.premierleague.com')`, which also accepts
 * `https://fantasy.premierleague.com.attacker.example/…` — anyone could register
 * that subdomain and route arbitrary traffic through the Worker on its IP and its
 * quota. These tests exist to keep the check on the parsed hostname.
 *
 * Runs against the real worker.js. `Request`/`Response` come from Node's built-in
 * fetch globals, which are close enough to workerd for this surface.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../fpl-proxy-worker/worker.js';

const WORKER_ORIGIN = 'https://fpl-proxy.example.workers.dev';

/** Whatever the Worker forwarded upstream, per call. */
let upstreamCalls = [];
const realFetch = globalThis.fetch;

beforeEach(() => {
    upstreamCalls = [];
    globalThis.fetch = async (url) => {
        upstreamCalls.push(String(url));
        return new Response('{"ok":true}', {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                // The upstream's own headers must not be forwarded blindly.
                'Set-Cookie': 'pl_profile=secret; Path=/',
                'Access-Control-Allow-Origin': 'https://fantasy.premierleague.com'
            }
        });
    };
});

afterEach(() => { globalThis.fetch = realFetch; });

const call = (target, method = 'GET') => worker.fetch(new Request(
    `${WORKER_ORIGIN}/?url=${encodeURIComponent(target)}`, { method }
));

describe('the proxy whitelist', () => {
    test('allows the two FPL API hosts', async () => {
        for (const target of [
            'https://fantasy.premierleague.com/api/bootstrap-static/',
            'https://fantasy.premierleague.com/api/event/12/live/',
            'https://draft.premierleague.com/api/bootstrap-static',
            'https://draft.premierleague.com/api/league/689/details'
        ]) {
            const res = await call(target);
            assert.equal(res.status, 200, `${target} should be proxied`);
        }
        assert.equal(upstreamCalls.length, 4);
    });

    test('rejects a hostname that merely starts with an allowed one', async () => {
        for (const target of [
            'https://fantasy.premierleague.com.attacker.example/steal',
            'https://draft.premierleague.com.evil.io/x',
            'https://fantasy.premierleague.competitor.net/y',
            'https://fantasy.premierleague.com@attacker.example/z'
        ]) {
            const res = await call(target);
            assert.equal(res.status, 403, `${target} must not be proxied`);
        }
        assert.deepEqual(upstreamCalls, [], 'nothing should have reached the network');
    });

    test('rejects plain http, so the proxy cannot be used to downgrade a request', async () => {
        const res = await call('http://fantasy.premierleague.com/api/bootstrap-static/');
        assert.equal(res.status, 403);
        assert.deepEqual(upstreamCalls, []);
    });

    test('rejects a missing or unparseable target', async () => {
        assert.equal((await worker.fetch(new Request(`${WORKER_ORIGIN}/`))).status, 400);
        assert.equal((await call('not-a-url')).status, 400);
        assert.deepEqual(upstreamCalls, []);
    });

    test('is read-only', async () => {
        const res = await call('https://fantasy.premierleague.com/api/bootstrap-static/', 'POST');
        assert.equal(res.status, 405);
        assert.deepEqual(upstreamCalls, []);
    });
});

describe('the proxy response', () => {
    test('answers a preflight without touching the network', async () => {
        const res = await worker.fetch(new Request(`${WORKER_ORIGIN}/?url=x`, { method: 'OPTIONS' }));
        assert.equal(res.status, 204);
        assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
        assert.deepEqual(upstreamCalls, []);
    });

    test('does not forward the upstream Set-Cookie or its CORS header', async () => {
        const res = await call('https://fantasy.premierleague.com/api/bootstrap-static/');
        assert.equal(res.headers.get('Set-Cookie'), null,
            'forwarding a cookie through a wildcard-origin proxy is not something to do by accident');
        assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*',
            'the upstream sets its own origin; ours has to win');
    });

    test('an upstream failure is a 502 with CORS headers, not a bare throw', async () => {
        globalThis.fetch = async () => { throw new Error('upstream down'); };
        const res = await call('https://fantasy.premierleague.com/api/bootstrap-static/');
        assert.equal(res.status, 502);
        // Without the headers the browser reports an outage as a CORS error, and
        // the client's proxy-chain fallback cannot tell the two apart.
        assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
    });

    test('passes an upstream 404 through rather than masking it', async () => {
        globalThis.fetch = async () => new Response('nope', { status: 404 });
        const res = await call('https://fantasy.premierleague.com/api/entry/999999/');
        assert.equal(res.status, 404, 'the client retries on 5xx; a 404 is a real answer');
    });

    test('forwards the exact target, query string included', async () => {
        const target = 'https://fantasy.premierleague.com/api/fixtures/?event=7';
        await call(target);
        assert.deepEqual(upstreamCalls, [target]);
    });
});
