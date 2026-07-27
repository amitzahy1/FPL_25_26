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
- [ ] **Deploy the Cloudflare Worker and make it the primary proxy.** Now the
      highest-value item left: of the public proxies only
      `cors-get-proxy.sirjosh.workers.dev` still works. allorigins is down and
      codetabs/corsproxy return 413 for the 1.5 MB bootstrap. The live season
      and the whole draft tab depend on this. `cd fpl-proxy-worker && npx
      wrangler deploy`, then paste the URL into the settings dialog.
- [ ] Prediction heuristic updated for 2026/27 (DEFCON term, availability
      multiplier, GK saves, BPS rework recalibration)
- [ ] Wire the unused Draft endpoints: `element-status`, `entry/{id}/history`,
      `transactions`, `draft/{league}/choices`
- [ ] Add xGC and `ep_next` columns

## Post-draft

- [ ] **Live Match Center** — 2026/27 adds live in-match points including DEFCON,
      plus projected bonus after 20 minutes. Feasible from `fixtures.stats`,
      `event/{gw}/live` and `pl/event-status`.
- [ ] Waiver / market activity feed from the transactions endpoint
- [ ] Draft board retrospective (pick-by-pick ROI) from `choices`
- [ ] Monte Carlo playoff odds over the remaining H2H fixtures
- [ ] Points-against / luck index — closes the `totalPointsAgainst: 0` TODO
- [ ] Goalkeeper dashboard (saves/90, xGC, CS%)
- [ ] DEFCON explorer with the CBIT/CBIRT component breakdown
- [ ] Prediction calibration backtest against 2025/26 to tune weights by MAE
      instead of by intuition

## Engineering

- [ ] Split `script.js` (8k lines, one global scope) into ES modules + Vite
- [ ] GitHub Actions CI gating the Pages deploy (lint, test, build)
- [ ] Replace the 97 inline `onclick` handlers with event delegation
- [ ] `escapeHtml()` across the ~70 interpolated `innerHTML` writes
- [ ] Put the ~118 `console.log` calls behind a DEBUG flag
- [ ] Git history rewrite to drop the vendored dataset from the ~198 MB `.git`
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
- **Native mobile app / push notifications / community features.** Listed as
  competitive gaps in the old roadmap; out of scope for a single-maintainer
  personal tool.

## Competitive notes (2026/27)

The paid draft tools (DraftFC, Drafthound, The Draft Society) build on the same
official FPL and Draft APIs this project uses. Their real edges are betting-odds
clean-sheet probabilities, injury feeds, and cross-league draft trend data.
Nothing about the data source is out of reach; the differentiators worth
targeting are VORP and DEFCON hit-rate, which none of them present well.
