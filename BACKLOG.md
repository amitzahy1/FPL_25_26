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
      better than two more columns in a 34-column table)
- [x] Scouting view: signal verdicts, per-gameweek trends, expandable match log
- [x] Cross-season ownership join on `code` rather than element id

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

- [x] CI gate on every push: ESLint, 104 unit tests, structural checks, and a
      headless-browser smoke test that loads the page with the API and every
      proxy blocked
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
