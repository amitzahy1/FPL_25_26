# Backlog

Single backlog for the project. Replaces `ROADMAP.md` and `docs/archive/FEATURES_TODO.md`,
which had drifted into two competing lists.

Status as of the 2026/27 pre-season overhaul. Items are ordered by value, not by date.

---

## Pre-draft (must land before the mid-August draft)

- [x] Resolve the committed merge conflict in `index.html`
- [x] Configurable draft league ID (`?league=` / settings / default)
- [x] Dual-season data: completed 2025/26 snapshot + live 2026/27
- [x] Fix inverted percentiles and the silently-zeroed metrics
- [x] Regression test suite
- [x] Remove the fake auth and the hardcoded personal email
- [x] Cache-layer rework: quota eviction, schema migration, request coalescing
- [x] New columns: VORP, DEFCON hit-rate, availability + rotation risk
- [x] Draft board panels ("who to pick and why")
- [x] Fix the smart filters (5 of 8 were no-ops; set-pieces matched everyone)
- [x] Snapshot-first startup so the page never waits on the CORS proxies
- [x] Cloudflare Worker deployed and wired as the default proxy
- [x] Prediction rebuilt for 2026/27 scoring: DEFCON term, availability
      multiplier, GK saves, xGC-based clean sheets, expected-minutes scaling
- [x] All four unused Draft endpoints wired: `element-status`,
      `entry/{id}/history`, `transactions`, `draft/{league}/choices`
- [x] xGC and `ep_next` surfaced (in the expanded row's stat boxes, which reads
      better than two more columns in an already wide table)
- [x] Scouting view: signal verdicts, per-gameweek trends, expandable match log
- [x] Cross-season ownership join on `code` rather than element id
- [x] Draft board restored and made the page's lead block, replacing the six KPI
      trivia cards. The cards answered questions the table already answers by
      sorting a column; the board answers "who should I take, and why", with a
      stated reason per pick and a top-20 behind each panel. (The
      market-movement panel added alongside it was dropped again in the variant-ב
      rework; its `emptyNote` hook is still wired and unused.)
- [x] Signal filter, so the most actionable column is filterable and not only
      sortable
- [x] Season selector moved to the page header — which season is on screen
      decides what every number means, so it does not belong in the table's
      toolbar. Toolbar collapsed to one row with a single button family.
- [x] `זמינות` column dropped: a green ✓ on every row whenever the squad was fit.
      The two informative cases already show as a badge on the שחקן cell.
- [x] Charts view reworked — four position matrices collapsed to one with a
      position toggle, two team charts to one quadrant, price-vs-points and the
      ICT stack dropped, and the per-gameweek history finally plotted (trend,
      opportunity board, positional VORP depth, minutes security)
- [x] **Draft API "Game Updating" handled as a state, not an error.** FPL takes
      the whole Draft game down between seasons and serves an HTML maintenance
      page with a 200 status, so every proxy returned the same non-JSON body and
      the page blamed the proxies ("run local_proxy.js") for an outage no proxy
      could fix. Detected explicitly, the chain stops walking, and the draft tab
      explains the state, what still works, and that the new league needs a new
      id when the game reopens — league 689 is last season's.
- [x] **Pre-season market overlay.** Before GW1 the new season's API reports
      every player at zero, so the table shows the completed season — but two of
      its numbers are live from day one and belong to the season ahead: price and
      ownership. In Draft neither is a cost, so both are pure crowd signal. They
      now overwrite the two cells they belong in (sorting, percentile shading and
      the banner all follow), with the summer price move printed beside the price.
      - `hype_gap`: ownership percentile minus points-per-90 percentile, **within
        position**. League-wide it ranked position rather than expectation —
        a keeper scores about half a forward's points per 90 however good he is,
        so every nailed keeper came out at +85.
      - Departed players (133 of the snapshot's 537 are not in 2026/27) are
        flagged and excluded from the board pool. Salah, Bowen, Casemiro and
        Trossard all ranked top-20 for a league they are no longer in.
      - Three chips: 🔺 השוק מצפה לקפיצה, 🔻 מתחת לרדאר, 💸 עלו במחיר.

## Pre-draft, still open

- [ ] Steals-vs-ADP column: `draft_rank` is FPL Draft's own published ranking, so
      players our `draft_score` rates far above it are the ones available a round
      later than they should be. Blocked until the Draft API reopens.
- [ ] Draft-day assistant — explicitly dropped for 2026/27 (2026-08-02).

## Post-draft

- [ ] **Live Match Center** — 2026/27 adds live in-match points including DEFCON,
      plus projected bonus after 20 minutes. Feasible from `fixtures.stats`,
      `event/{gw}/live` and `pl/event-status`.
- [x] Waiver / market activity feed from the transactions endpoint
- [x] Draft board retrospective (pick-by-pick ROI) from `choices`
- [ ] Monte Carlo playoff odds over the remaining H2H fixtures
- [x] Points-against / luck index — the `totalPointsAgainst: 0` TODO is closed
- [ ] Goalkeeper dashboard (saves/90, xGC, CS%)
- [ ] DEFCON explorer with the CBIT/CBIRT component breakdown
- [ ] Prediction calibration backtest against 2025/26 to tune weights by MAE
      instead of by intuition

## Engineering

- [x] CI gate on every push: ESLint, 132 unit tests, 8 structural checks, and a
      headless-browser smoke test that loads the page with the API and every
      proxy blocked
- [x] **Proxy worker was an open proxy.** The whitelist tested
      `endpoint.startsWith('https://fantasy.premierleague.com')`, which also
      accepts `https://fantasy.premierleague.com.attacker.example/…` and
      `https://fantasy.premierleague.com@attacker.example/…` — anyone could route
      arbitrary traffic through the Worker on its IP and quota. Now matched on the
      parsed hostname, https-only, GET-only, with the upstream's `Set-Cookie` and
      CORS headers no longer forwarded and upstream failures returned as a 502
      *with* CORS headers (a bare throw reached the page as a CORS error, so the
      client's proxy fallback could not tell an outage from a blocked request).
      Ten tests cover it.
- [x] `הגדרות` did nothing on the draft tab — the modal lived inside
      `#playersTabContent`, and a `display:none` parent hides the modal with it,
      while its ⚙️ button is in the always-visible page header. All four modals
      moved to page level; a structural check measures `<div>` nesting depth and
      fails if one moves back inside a tab.
- [x] `דקות` had three different defaults (120 in the markup, 30 on איפוס, 0 on a
      chip), so איפוס silently produced a different table from a fresh page load.
      One named constant each for the page default and the quick-filter override,
      with a structural check that the markup and the constant agree.
- [x] Deleted three unreachable smart filters (`nailed_starters`, `defcon_kings`,
      `best_value`) — defined but with no chip, so nothing could call them. A
      structural check now enforces chip↔rule parity in both directions; five
      chips were once no-ops, and then three rules had no chip.
- [x] איפוס now clears the active chip's highlight, which it left behind
- [x] Git history rewrite — 195 MB to 2.2 MB, personal email scrubbed from all
      author metadata, HEAD tree byte-identical
- [x] Mobile layout: zero horizontal overflow at 390px, collapsible filters
- [ ] Replace the 34 inline `onclick` handlers with event delegation
- [ ] `escapeHtml()` across the ~70 interpolated `innerHTML` writes
- [ ] Put the ~118 `console.log` calls behind a DEBUG flag
- [ ] Batch `loadHistoricalLineups` with chunked `Promise.allSettled`
- [ ] Mobile: render the table as cards on small screens

## Considered and rejected

- **Rebuilding the ML model.** The previous decision-tree pipeline scored
  R² 0.085 and its features referenced API fields removed after 2018/19. The
  hand-tuned heuristic is both more accurate and far cheaper to maintain.
  Revisit only with a proper backtest harness.
- **Framework migration (React/Vue).** Recommended by the old roadmap, but the
  monolith is the actual problem, not the absence of a framework. Modularising
  gets most of the benefit without a rewrite before the season.
- **Vite + ES modules, for now (decided 2026-07-27).** The payoff is small here:
  the page already loads in ~1.4s from a 118 KB gzipped snapshot, cache-busting
  is handled by `scripts/stamp-version.mjs`, and CI now catches the regressions
  that modularising was meant to prevent. The cost is not small: `data/` moves
  under `public/`, `index.html` is rewritten, the 34 inline handlers need a
  `window` shim, the stamp script and structural checks both need rewriting, and
  GitHub Pages has to switch from branch deploy to Actions — three weeks before
  the draft, with the site going down if that flip misbehaves. Worth doing once
  the season is under way, not before it starts.
- **Native mobile app / push notifications / community features.** Listed as
  competitive gaps in the old roadmap; out of scope for a single-maintainer
  personal tool.

## Competitive notes (2026/27)

The paid draft tools (DraftFC, Drafthound, The Draft Society) build on the same
official FPL and Draft APIs this project uses. Their real edges are betting-odds
clean-sheet probabilities, injury feeds, and cross-league draft trend data.
Nothing about the data source is out of reach; the differentiators worth
targeting are VORP and DEFCON hit-rate, which none of them present well.
