# Deploying the proxy Worker (5 minutes, no CLI)

Both FPL APIs block cross-origin browser requests, so the site needs a proxy.
It currently falls back to public ones, and **only one of them still works**:
`api.allorigins.win` is down, and `codetabs` / `corsproxy.io` return
`413 Payload Too Large` for the 1.5 MB bootstrap payload.

The players tab no longer depends on them (it renders from the local season
snapshot), but the **live season and the entire draft tab still do**. Your own
Worker fixes that permanently, is free, and is faster than any public proxy
because Cloudflare caches at the edge.

`wrangler deploy` needs Node 22 and a terminal login, so use the dashboard
instead — it is copy-paste only.

## ⚠️ If you already deployed this Worker — update it

The version deployed before 2026-07-28 gated requests with a string prefix, so
`https://fantasy.premierleague.com.attacker.example/…` passed the whitelist. It
was an open proxy. **Pushing to GitHub does not redeploy the Worker** — until you
paste the new code in, the old one is still running.

1. Open **https://dash.cloudflare.com/** → **Compute (Workers)** → `fpl-proxy`.
2. **Edit code**, select everything, paste the current
   [`worker.js`](worker.js) over it, **Deploy**.
3. Confirm it took: this should return `403`, not JSON —
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' \
     'https://fpl-proxy.<your-subdomain>.workers.dev/?url=https%3A%2F%2Ffantasy.premierleague.com.example.com%2Fx'
   ```
   and this should still return `200`:
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' \
     'https://fpl-proxy.<your-subdomain>.workers.dev/?url=https%3A%2F%2Ffantasy.premierleague.com%2Fapi%2Fbootstrap-static%2F'
   ```

Nothing else changes — same URL, same settings, no client change needed.

## First-time setup

1. Open **https://dash.cloudflare.com/** and sign in (free account is fine).
2. In the sidebar choose **Compute (Workers)** → **Create** → **Start with Hello World** → **Create Worker**.
   - Name it `fpl-proxy` (the name becomes part of the URL).
3. When it opens, click **Edit code**.
4. Select everything in the editor and replace it with the contents of
   [`worker.js`](worker.js) in this folder.
5. Click **Deploy**.
6. Copy the URL shown at the top. It looks like:
   `https://fpl-proxy.<your-subdomain>.workers.dev`

## Point the site at it

1. Open https://amitzahy1.github.io/FPL_25_26/
2. Click the **⚙️ gear icon** in the header.
3. Paste the Worker URL into **Custom FPL Proxy**.
4. Click **שמור הגדרות**.

It is stored in your browser, so do this once per device.

## Checking it works

Open DevTools → Network and reload. Requests to `fantasy.premierleague.com`
and `draft.premierleague.com` should now go through your `workers.dev` URL,
and the console should no longer show `413` or `ERR_NAME_NOT_RESOLVED`.

## Safety

The Worker forwards only to the hostnames `fantasy.premierleague.com` and
`draft.premierleague.com`, over https, by GET, and returns `403` for anything
else. It holds no credentials — both APIs are public and read-only.

That claim depends entirely on *how* the hostname is checked, which is why it is
checked on the parsed `URL.hostname` and not with `startsWith` on the raw string.
A prefix test also accepts `https://fantasy.premierleague.com.attacker.example/…`
and `https://fantasy.premierleague.com@attacker.example/…`, which is exactly an
open proxy — someone else's traffic on your IP and your quota. This file used to
claim publishing the URL "cannot turn it into an open proxy" while the code did
the prefix test; `tests/proxy-worker.test.mjs` now pins both lookalike hostnames
so the claim and the code cannot drift apart again.

The free plan allows 100,000 requests/day. This site uses a few dozen per
page load, and responses are edge-cached for 5 minutes.
