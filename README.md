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

A draft is decided in August, when the new season has produced 90 or 180 minutes
a player. Ranked on that alone the board is whoever happened to score on the
opening weekend; ignored entirely, it is last season's board and says nothing
about a player whose role has changed. `data/season-<id>.json` is a frozen
snapshot of the completed season, built from
[vaastav/Fantasy-Premier-League](https://github.com/vaastav/Fantasy-Premier-League),
and it is not a fallback — it is the prior the current season updates:

    w = minutes / (minutes + VALUE_TUNING.priorK)     priorK = 900 (ten matches)
    rate = w x (this season) + (1 - w) x (last season)

Standard empirical-Bayes shrinkage. At two gameweeks the current season carries
~17%, at GW10 half, at GW38 ~79% — so the prior fades on its own and nothing has
to be switched off in October. `applySeasonBlend` owns it, between
`preprocessPlayerData` (which computes this season's rates) and
`calculateAdvancedScores` (which ranks on them), so every consumer downstream
reads the blended figure without knowing that is what it is reading.

Only the derived *rates* are weighed. Minutes, goals, points and clean sheets on
the row stay this season's, because that is what the reader is looking at. `form`
is untouched, being the recent-signal term by construction.

Players who never appeared are omitted from the snapshot. Their absence is how
"no prior data" is represented — and a player with no prior is held near the
median regular at his position rather than left unshrunk, because otherwise a
promoted club's defender with two clean sheets simply takes over the top of the
board. `prior_is_baseline` marks them, and the `⬆️ קבוצות שעלו` / `🆕 חדשים בליגה`
chips still find them.

The blend is stated, never hidden: the banner gives the mix, the optional `משקל`
column and a per-row badge give each player's own weight, the expanded row prints
last season's figure in grey beside this season's on every blended rate, and
`רק העונה הנוכחית` in the header turns it off.

`sampleMinutes(p)` — this season plus the prior — is what every "has he played
enough to judge?" gate counts, and `scaleMinutes(floor)` shrinks a season-length
floor to the football actually played. Read as raw `p.minutes`, those gates were
unreachable in August: measured on the live API with one finished gameweek, 51 of
572 players had a draft score, none had a VORP, the verdict column was entirely
neutral and three charts hid themselves.

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

## The players page

Three blocks, in reading order:

1. **`את מי לקחת עכשיו`** — a wide answer card over six panels, each answering one draft question by an
   explicit rule, with the reason printed under every pick: VORP, form over the
   selected window, DEFCON hit-rate, market movement, underlying numbers, and
   set-piece duty. The pool is only players you can actually get — free agents
   once the league's rosters have loaded, everyone before the draft — and never
   anyone injured or suspended. Each panel opens a top 20.
   Every panel names the figure it ranks on above the value column, and each
   pick carries the grey `פי X מהעילית` — how it compares to the median of the
   twenty best players *at the same position* on that same metric.
   Defined by `DRAFT_PANELS` in `script.js`; a new question is one entry there.
   The card at the top is `הבחירה הכי שווה` — the value index, described below.
   Two of the chips beside the table, `⬆️ קבוצות שעלו` and `🆕 חדשים בליגה`, are
   for players with no previous-season data at all; both are derived by diffing
   this season's bootstrap against the committed snapshot, so nothing needs
   updating each August, and both only apply on the current-season tab.
2. **The table** — sortable and filterable, including by `סיגנל`, the one-verdict
   column. Thirteen columns are optional and remembered per browser, including
   `משקל` — how much of the row is this season.
3. **`גרפים`** — twelve cards, ordered by how directly each answers a decision,
   defined by `CHART_SPECS`. They read the filtered set *before* the "top 20"
   slice, and a card with nothing to plot hides itself rather than drawing an
   empty axis. Quadrant colouring follows `goodDirection`, so green means good
   even on the axes where lower is better (xGC, goals conceded). The `⤢` on any
   card opens it full screen beside a sortable table of every plotted player and
   both axis values; clicking a row activates that point through Chart.js's own
   hover state, so the highlight cannot disagree with the tooltip. The table is
   read back out of the built config, so it lists exactly what the chart drew and
   a thirteenth chart needs no work for it.

## The draft tab

`חדר הדראפט` is the board on the night and the waiver board after it: four ranked
columns, one per position, on `projectedPointsOf(p, 'season')` — the same index
the `הכי שווים` panel uses, so the board and the panel cannot recommend different
players. Tier breaks are drawn at the largest gaps rather than at gaps over a
threshold, because a threshold has to be expressed in points and the same number
of points means something different at every position.

During a draft it polls `draft/{league}/choices` every 15s — well inside the
90-second pick limit — and strikes players off in place, labelled with the
manager who took them. Taken players keep their position rather than
disappearing: the shape of what is gone is information, and a list that reflows
under you on every pick cannot be read at speed. The poll also writes
`ownedElementIds`, which the players table, the free-agent filter and the
`קח עכשיו` verdict already read, so the whole site follows the draft live.

The pick order is learned from round one rather than guessed — FPL publishes
`order_method: random` and nothing else beforehand — then snaked, so "your next
pick is #20, in 4 picks" is right for whatever order the randomiser gave. Before
round one completes it says it does not know.

Every other sub-tab is downstream of somebody owning somebody, so before the
draft they say why they are empty and point at the room.

## Notes

- **DEFCON** (defensive contribution): defenders need 10 CBIT per match,
  midfielders and forwards 12 CBIRT, for +2 points. Because it is a per-match
  threshold, the snapshot records a *hit-rate* — the share of appearances that
  cleared it — rather than a season average, which would misrepresent it.
- **The value index** (`draftValue`) answers "who is most worth taking" in the
  unit the question already has — points:

      שווי = (רמה חזויה − רמת החלפה בעמדה) × משחקים צפויים

  Position-relative by construction, which is what makes a defender and a
  forward comparable; a weighted sum of percentiles never is. Points are counted
  once, as the level, so the things that *produced* them (G+A, xGI, bonus,
  DEFCON) do not also get their own weights. Nothing that has no meaning in a
  draft goes in — not ownership (only one team can own anyone) and not price
  (there is no budget). Every term is printed next to the figure on the card.

  The constants live in `VALUE_TUNING` and `VALUE_HORIZONS`, and
  `npm run backtest` is what set them: it replays the finished season, ranks
  players from the gameweeks before a cutoff using the site's own functions, and
  scores that against what they actually scored after it. Two findings changed
  the formula:

  - **Five-match form makes the projection worse.** Monotonically, at every
    weight, on both horizons — ρ .295 ignoring it against .247 leaning on it. The
    weight is now small and kept only for the case the backtest cannot see: a
    player whose role changed.
  - **`rotation_risk` was the wrong volume term.** It is starts ÷ appearances, so
    a man who features in 12 of 20 gameweeks and starts all 12 scores the same
    1.0 as someone who starts every week. Appearances ÷ gameweeks is worth about
    +0.07 ρ over it.

  Where it ends up, against the three things you could sort by instead
  (mean over cutoffs GW15/20/25/30, target: points above replacement):

  | | value index | total points | points/app | last-5 form |
  |---|---|---|---|---|
  | next 5 GWs | **.293** | .148 | .196 | .067 |
  | rest of season | **.373** | .194 | .241 | .140 |

  On *raw* future points the baselines win by a distance (.51 for total points
  against .17), and that is the design: raw points rewards whoever accumulates,
  which is exactly the question a replacement level is there to remove.
- **The top-20 benchmark** (`benchmarkMedian`): the median of the twenty best
  players at a position on one metric. Median, so a single outlier cannot move
  the bar; twenty, because that is roughly how many players per position get
  drafted in an eight-team league. It appears as the grey ratio under a board
  figure, and as the dashed grey line across the per-gameweek bars, which is the
  same scale the bars are drawn on.
- Percentiles are oriented so 100 is best, including for metrics where lower is
  better (price).
- Cached API responses live in `localStorage`. Clear it from the settings
  dialog if data looks stale.

## Development

```bash
npm install          # eslint + puppeteer (dev only)
npm run verify       # lint + unit tests + structural checks + browser smoke test
npm run backtest     # score the value index against what players actually scored
SWEEP=1 npm run backtest   # sweep each hand-set constant in VALUE_TUNING
npm test             # unit tests only
npm run test:smoke   # loads the real page with the API and all proxies blocked
npm run build:season # regenerate data/season-<id>.json from vaastav's dataset
npm run stamp        # bump the ?v= cache-buster before committing
npm run serve        # static server on :8000
```

CI runs the same four gates on every push to `main`. The site deploys from the
repo root on `main`, so a red build means the broken commit is already live —
run `npm run verify` before pushing.

