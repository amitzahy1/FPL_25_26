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

## Steps

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

The Worker only forwards to `fantasy.premierleague.com` and
`draft.premierleague.com` and returns `403` for anything else, so publishing
the URL cannot turn it into an open proxy. It holds no credentials — both APIs
are public and read-only.

The free plan allows 100,000 requests/day. This site uses a few dozen per
page load, and responses are edge-cached for 5 minutes.
