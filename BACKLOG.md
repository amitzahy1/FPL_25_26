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
- [x] Every column of a panel's top-20 modal sorts by clicking its header, by the
      figure the cell holds rather than the string it prints (`sort` next to `get`
      in `BOARD_COLS`, so `#9` cannot order after `#10`). A column whose good end
      is the low one — the FPL rank, xDiff — opens ascending. 24 sortable columns
      across the six leaderboards are driven and checked by the smoke test.
- [x] Board headers were aligned by a different ruler than their values: one
      `text-align: end` resolving to opposite edges because the value cells are
      `direction: ltr` and the headers inherit the page's RTL. Up to 59px of
      drift, invisible to `table-layout: fixed` because the cell boxes agreed and
      only the text inside them was off.

- [x] **One free-agent switch for the whole tab.** In Draft a player belongs to
      exactly one manager, so after draft night a recommendation you cannot act
      on is not a recommendation. The board already narrowed to free agents, but
      silently and with no control; the table's only way to do the same was an
      option buried in a dropdown inside a collapsed filter panel. Now `🆓 רק
      חופשיים` sits in the always-visible toolbar row and governs the board, the
      table and (through `state.filteredData`) every chart from one flag —
      `state.freeAgentsOnly`, asked through `freeAgentFilterActive()` so no
      surface can read it without also checking whether a draft has been held.
      Off is kept, for scouting a rival's squad or pricing a trade; before the
      draft the switch is disabled rather than hidden, so it states the rule it
      will apply later. Measured with rosters injected: on → 387 free agents,
      top pick Donnarumma; off → 537 including owned, top pick Haaland, who
      belongs to somebody else.
      - The `שחקנים חופשיים` option is gone from the draft-team dropdown; two
        controls for one filter can only disagree. Choosing a rival's squad while
        the switch is on now says which one to turn off instead of silently
        emptying the table.
      - `renderCharts` no longer falls back to the whole league when
        `filteredData` is empty. An empty filter result is an answer, and the
        fallback drew owned players under a board that had just excluded them.
- [x] **Three cards for weekly decisions**, added to `CHART_SPECS`:
      - 💱 **לאן השוק זז השבוע** — net *classic-FPL* transfers this gameweek
        against points per match. There are no transfers in Draft at all, so this
        is the same crowd signal as price and ownership read weekly instead of
        once a season; the top-left corner (producing, and being dumped) is what
        it is for. `market_net_transfers` joins on `code` with the rest of the
        overlay. `displayNetTransfers` returns **null**, not 0, when there is no
        figure — a completed season has its transfer fields zeroed, and 0 there
        would read as "the market is indifferent". The card hides on null rather
        than drawing a vertical line at zero, which is its state today.
      - 🚦 **פיזור איכות לפי סיגנל** — the verdict is a category, so it is a
        column and not an axis: nine verdicts have no order and no spacing, and
        plotting their sort rank would invent both. Height is the draft score, so
        a column shows not just how many players got a verdict but at what
        quality. Horizontal spread is a hash of the player id, so a dot never
        moves between renders.
      - 🎯 **יצירת סיכויים מול ערך** — xGI/90 against VORP, *not* against the
        draft score: the draft score is a weighted sum of league-wide percentiles
        that already contains xGI, so that chart would draw a diagonal by
        construction. Goalkeepers excluded — a keeper's xGI is zero as a fact
        about the job.
- [x] Negative axis ticks were bidi-mangled on every chart that crosses zero:
      the canvas inherits the page's RTL, the minus sign is neutral punctuation,
      and `-25` rendered as `25-` on the opportunity board's momentum axis, on
      VORP and on the transfer flow. `ltrTick` wraps every numeric tick in a
      directional isolate — the same fix the point labels already had.
- [x] The signal card's colour key is built from the verdicts actually drawn.
      Tones are shared — `לא זמין` and `מימוש יתר` are both red, `למכור גבוה`
      and `סיכון סיבוב` both amber — so a key taking the first rule per tone
      named a verdict that was not on screen while the one that was went
      unnamed. `chartNote(spec, data)` now passes the chart's own rows to the
      caption for exactly this.

- [x] **A category chip row on every player chart.** 500 dots in one cloud is a
      shape, not a list of players. Each card now carries its own chips —
      position for the scatters, the verdict for the signal card — declared as
      `facet` on the spec and applied centrally in `renderCharts`, so no builder
      knows about it. Chart-local on purpose: narrowing one card to defenders
      should not empty the seven next to it, and the filter panel is still there
      when you do want that. Options are derived from the rows on screen, so a
      chip can never lead to an empty chart; a card that cannot draw a position
      (`facetOmit`) does not offer it — a keeper has no DEFCON and no xGI worth
      plotting. Clicking the live chip clears it.
      - The signal card **changes shape** when narrowed rather than just losing
        its other columns. One column redrawn in the same 80px strip is the same
        unreadable pile with white space around it, so x becomes rank within the
        verdict and the players spread across the full width, evenly spaced,
        with labels on four alternating bands. Measured: axis width 5 → 31, and
        10 names become 30.
      - The chip row takes a line of its own under the caption. Squeezed in
        beside the title, six chips stacked four rows deep and pushed the
        caption into a column two words wide.

- [x] **📅 את מי לטרגט ל-5 הבאים** — club quality against the club's own
      schedule, with ⚔️/🛡️ chips. Two things decide whether a club is worth
      raiding and neither answers it alone: a great attack with three away trips
      to the top four is not a target this month. Five gameweeks rather than the
      existing three, because three answers "start him this week" while five
      answers "is this club worth holding through", which in a draft league —
      no free transfers — is what decides a waiver claim. `next_5_fdr` comes off
      the same fixture walk as `next_3_fdr`, so the two cannot disagree.
      - The chips here are a **mode**, not a filter: an attack rating comes from
        the attackers and a defence rating from the defenders, so filtering the
        rows by side would leave each half with nothing to measure. A mode has
        no "הכל" chip and no off position — re-clicking the live one keeps it.
      - Conceding less is better, so the defence view flips the y direction and
        the green corner is bottom-left. Without that the tint sat behind the
        clubs shipping the most goals.
- [x] `ltrTick` was formatting the raw axis value. A tick callback *replaces*
      Chart.js's numeric formatter, and the values it receives are the unrounded
      results of the axis's own arithmetic — so the team chart printed
      `1.8000000000000003` and `0.6000000000000001`. It formats through the
      scale's `getLabelForValue` now and only wraps the result.

- [x] **Mobile: the toolbar was inside the filter disclosure.** `<details
      id="filtersPanel">` wrapped the view switch, the free-agent toggle, the
      watchlist, compare, columns and CSV as well as the filters — and on a phone
      that disclosure is closed by default, so every one of them was hidden
      behind a control labelled 🔍 חיפוש וסינון. The quick-filter chips stay
      inside it (they are filters); everything else moved out into a sticky view
      toolbar above the content.
      - **A phone action bar**, fixed at the thumb end: טבלה · גרפים · דירוג ·
        חופשיים · עוד, with the rest one tap behind עוד. It owns no state — every
        button calls the same function the desktop control calls, so the two can
        differ in appearance but never in behaviour. Above 768px it is not
        rendered at all.
      - Switching the view on a phone now scrolls to it. The draft board and the
        filter panel both sit above the table and the charts, so tapping גרפים
        used to leave the board on screen and look like nothing had happened.
        Only on a real tap — a page that scrolls itself on load is worse.
      - The toolbar hides its own copies of the actions that are in the sheet;
        repeating them was only height.
- [x] The nav highlighted ליגת דראפט while #playersTabContent was the element
      shipping with `display:block`, so every first-time visitor saw the players
      tab with the draft tab lit up. It was corrected by `init()`, but only after
      it finished awaiting the draft fetches — between seasons, a full timeout
      chain. Fixed in the markup, where the inconsistency was.

- [x] Charts capped at **three per row** above 1120px. `auto-fill` at 440px put
      four on a wide monitor, and 500 players in a 420px box is a smudge — the
      names are the value of these cards and a narrow card drops them first.
- [x] The focused verdict view is a **ranked bar list**, not a scatter. As a
      scatter sorted by score the points sit on a monotone curve, so consecutive
      players are close in *both* axes and their names collide however the
      labels are staggered: 53 players, 18 readable names. A bar per player
      makes the name an axis tick, which cannot overlap anything — 53 of 53. The
      card asks for its own height (`config.cardHeight`, read and removed by
      `renderCharts`) and spans the grid so a tall one does not stretch its
      neighbours.
- [x] Both horizontal bar charts printed their figure *on* the fill — 10px grey
      on saturated green. The cause: chartjs-plugin-datalabels mirrors horizontal
      alignment on an RTL canvas, so `align: 'right'` resolved inward. Every
      value of `align` was measured and all of them landed inside, so the figure
      moved into the axis tick instead ("Senesi · 70%"), where it is ordinary
      axis text that cannot be overlapped, clipped or collision-dropped.
- [x] DC/90, xGI and G+A moved to sit directly after % בחירה.

- [x] **One colour language for the table.** Six systems answered "is this
      value good" six different ways — percentile tint on 15 columns, coloured
      digits on VORP, soft pills on xDiff/העברות, a solid inline-styled badge on
      קושי, a gradient pill on the draft team, faded dashes on set pieces. Now
      three, and the shape says what kind of statement the cell makes:
      `scale` (green/grey/red tint, direction declared per column in
      `CELL_TONE`), `diverge` (amber/blue tint — notable, no verdict), `badge`
      (a pill, for labels only). The real bug underneath: the old helper assumed
      high = good everywhere, so a high xDiff was painted green while the סיגנל
      column called the same number מימוש יתר. xDiff, העברות and % בחירה are
      diverging now — they report, they do not rank. DEFCON and הרכב stopped
      carrying fixed thresholds in their text colour that could disagree with
      the cell tint. An undeclared column gets no tone rather than a guess.

- [x] **One page, one pipeline.** The players tab reads top-to-bottom: filters →
      six lead charts → את מי לקחת עכשיו → the table, and all three surfaces
      read the same filtered set — the filters (smart and regular) govern
      everything below them. What changed to make that true:
      - The six lead slots (`DEFAULT_TOP_CHARTS`, per the user: הזדמנויות,
        מטריצת עמדה, לטרגט ל-5, DEFCON, פיזור סיגנל, סיכויים מול ערך), each
        swappable from a ⇄ menu on the card itself, persisted per slot; a saved
        id that no longer exists falls back to the default set rather than
        leaving a five-slot page. The other six sit behind עוד גרפים, undrawn
        until opened — a canvas in a closed fold has no size, and drawing there
        produces zero-height layouts.
      - The board joined the filter pipeline. It used to ignore the filters on
        the theory that they describe how you read the league; on one page that
        made it contradict the table under it. The scope line now appends
        "לפי הסינון (מתוך N)" whenever the pool is narrower than the league, so
        a filtered board is visibly filtered — the stated cost is that a
        minMinutes filter can hide a breakout starter from the board, by choice.
      - The table/charts toggle is gone as a toggle; switchMainView keeps its
        name and callers but now opens the section if folded and scrolls to it.
        On a phone both the filters and the charts sections ship folded
        (applyMobileDefaults), so the board is not three screens down.
      - Chart + board refresh is debounced 180ms behind the table — the filters
        run per keystroke and twelve canvases per keystroke stutters.

- [x] **The toolbar row deleted, its controls sent where they belong.** With one
      page there is no table-or-charts choice to make, so those two buttons went
      first; then the row had nothing holding it together. The page-wide
      switches (★ מעקב, 🆓 רק חופשיים) moved to the header — one button each for
      the whole site, governing charts, board and table alike — and 📅 חלון
      joined the filters, where it now scopes every surface rather than only the
      table's micro-charts. What is left is table-only (density, איפוס, השוואה,
      עמודות, CSV) and sits in a slim bar on the table. `.user-actions` wraps on
      a phone; without it the two new header buttons pushed the season toggle
      off the right edge.
- [x] Chart cards 330px → 250px, and the per-slot ⇄ swap removed — עוד גרפים
      already answers "where is the rest".
- [x] Hover on a chart is the player's name and position, nothing else. The
      axes already print the numbers, and a tooltip that repeats them is a
      paragraph where a glance was wanted.
- [x] `labelTop` stopped enforcing a quota. It ranked points by interest and
      then labelled the top 22 — so 22 was the ceiling however much room there
      was. Every point is a candidate now, sorted best-first, and the collision
      pass decides; since 'auto' keeps the earlier label of a colliding pair,
      sorting by score means the survivors are the ones worth naming.
- [x] The סיגנל cell prints the badge only. The sentence that earned it made
      every row three lines tall; it is the badge's hover now, and the expanded
      row still prints it in full.
- [x] Quick filters on one row: יהלומים deleted (ownership is a classic-game
      signal and the chip earned its place the least), the other thirteen
      relabelled short, and the ✨ label moved above the chips so they get the
      container's full width. Measured at 1400px and 1600px: one row at both.

- [x] 📅 חלון did nothing outside the table. `setTrendWindow` re-rendered the
      table and stopped, so the opportunity board's Δpoints axis, the trend
      lines and every board form figure kept drawing the old window with no
      sign that they had — which made moving the control into the filters (where
      it reads as page-wide) a lie. It renders the charts and the board now.
      Both neighbouring 📅 controls were also renamed, because they read as the
      same thing: **חלון מומנטום** is the width of the trend measurement,
      **טווח נתונים** is which matches the numbers themselves come from.
- [x] Picking a verdict chip turned a 250px card into a ~1200px one that spanned
      the grid — one click and the page jumped. The self-sizing list grows
      *inside* the card now (`.chart-scroll` in a scrolling `.chart-canvas`), so
      the card keeps its slot and its height and all 53 names are still there.

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
