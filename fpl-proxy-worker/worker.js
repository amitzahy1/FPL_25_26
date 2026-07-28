/**
 * CORS proxy for the two FPL APIs, on a domain whitelist.
 *
 * The whitelist is matched on the parsed hostname, not on a string prefix. A
 * `startsWith('https://fantasy.premierleague.com')` test also accepts
 * `https://fantasy.premierleague.com.attacker.example/…`, which turned this into
 * an open proxy: anyone could route arbitrary traffic through the Worker, on its
 * IP and its quota, by registering a subdomain of their own.
 */

const ALLOWED_HOSTS = new Set([
    'fantasy.premierleague.com',
    'draft.premierleague.com'
]);

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

/** Errors need the CORS headers too, or the browser reports them as CORS failures. */
function fail(status, message) {
    return new Response(message, {
        status,
        headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' }
    });
}

export default {
    async fetch(request) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: CORS });
        }
        if (request.method !== 'GET') {
            return fail(405, 'Method Not Allowed: this proxy is read-only.');
        }

        const endpoint = new URL(request.url).searchParams.get('url');
        if (!endpoint) return fail(400, 'Bad Request: missing ?url= parameter.');

        let target;
        try {
            target = new URL(endpoint);
        } catch {
            return fail(400, 'Bad Request: ?url= is not a valid URL.');
        }

        if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
            return fail(403, 'Forbidden: this proxy only allows access to the FPL APIs.');
        }

        let response;
        try {
            response = await fetch(target.toString(), {
                cf: { cacheTtl: 300, cacheEverything: true }
            });
        } catch (e) {
            // Without this the Worker throws a bare 1101 with no CORS headers, so
            // an upstream outage reached the page as a CORS error and the client's
            // proxy-chain fallback could not tell the two apart.
            return fail(502, `Bad Gateway: upstream request failed (${e.message}).`);
        }

        // Rebuilt from a known set rather than copied: the upstream response
        // carries its own CORS and Set-Cookie headers, and forwarding those
        // through a wildcard-origin proxy is not something to do by accident.
        const headers = new Headers(CORS);
        headers.set('Content-Type', response.headers.get('Content-Type') || 'application/json');
        headers.set('Cache-Control', 'public, max-age=300');

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers
        });
    }
};
