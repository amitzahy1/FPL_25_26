# FPL Draft Analytics Hub

Analytics dashboard for a Fantasy Premier League **Draft** league: player
rankings, expected points, fixture difficulty, and league-specific tools
(rosters, waivers, head-to-head, lineup analysis).

Live: https://amitzahy1.github.io/FPL_25_26/

Hebrew, right-to-left. Vanilla JavaScript, no build step, hosted on GitHub Pages.

---

## Running locally

```bash
npm run serve       # python3 -m http.server 8000  ->  http://localhost:8000
```

Opening `index.html` directly with a `file://` URL will not work — the browser
blocks the API requests. Use the server.

Optional, to avoid the public CORS proxies while developing:

```bash
npm run proxy       # local proxy on :8010, picked up automatically
```

## Tests

```bash
npm test            # node --test tests/
```

No dependencies; uses Node's built-in test runner (Node 20+).

## Season rollover

Everything season-specific lives in `SEASON_CONFIG` at the top of `script.js`.

1. Update `seasonLabel`, `previousSeasonLabel`, `previousSeasonId`.
2. Build a snapshot of the season that just finished:
   ```bash
   npm run build:season -- 2026-27
   ```
3. Set the new draft league ID. **No code change needed** — open the site with
   `?league=<new id>` once, or set it in the settings dialog. It is stored
   locally from then on.

### Why two seasons

At draft time the new season's API reports every player at zero minutes and
zero points, so every computed metric collapses to zero — exactly when the tool
is most needed. `data/season-<id>.json` is a frozen snapshot of the completed
season, built from
[vaastav/Fantasy-Premier-League](https://github.com/vaastav/Fantasy-Premier-League).

Until the new season has five finished gameweeks, the app shows the completed
season automatically and says so in a banner. Either season can be selected
manually at any time.

Players who never appeared are omitted from the snapshot. Their absence is how
"no prior data" is represented, so promoted-team players and new signings are
not shown as zeros that would sort them last and read as bad picks.

## Data sources

| Source | Used for |
|---|---|
| `fantasy.premierleague.com/api/bootstrap-static/` | Players, teams, gameweeks |
| `fantasy.premierleague.com/api/fixtures/` | Fixture difficulty |
| `fantasy.premierleague.com/api/event/{gw}/live/` | Per-gameweek stats |
| `draft.premierleague.com/api/league/{id}/...` | League details, standings |
| `draft.premierleague.com/api/entry/{id}/event/{gw}` | Rosters and lineups |
| `data/season-<id>.json` | Completed-season snapshot (local, no network) |

Both APIs block cross-origin browser requests, so calls go through a proxy
chain: a local proxy if present, then a custom Cloudflare Worker if configured
in settings, then public fallbacks.

## Layout

```
index.html                        markup (single page, two tabs)
script.js                         all application logic
style.css / mobile.css            styles
data/season-2025-26.json          completed-season snapshot
scripts/build-season-snapshot.mjs snapshot generator
tests/                            regression tests
fpl-proxy-worker/                 Cloudflare Worker (domain-whitelisted proxy)
local_proxy.js                    dev-only CORS proxy
```

`script.js` is still one large file in a single global scope; splitting it into
ES modules is the top engineering item in [BACKLOG.md](BACKLOG.md).

## Notes

- **DEFCON** (defensive contribution): defenders need 10 CBIT per match,
  midfielders and forwards 12 CBIRT, for +2 points. Because it is a per-match
  threshold, the snapshot records a *hit-rate* — the share of appearances that
  cleared it — rather than a season average, which would misrepresent it.
- Percentiles are oriented so 100 is best, including for metrics where lower is
  better (price).
- Cached API responses live in `localStorage`. Clear it from the settings
  dialog if data looks stale.
