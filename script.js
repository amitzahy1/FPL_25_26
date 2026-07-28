// ============================================
// AUTHENTICATION & USER MANAGEMENT
// ============================================

// ============================================
// APP ENTRY
// ============================================
// This is a public, read-only analytics tool over public FPL endpoints.
//
// There was previously a "login" here, but it never contacted Google: it
// waited 1.5s and fabricated a user object hardcoded to one email address,
// which was also the entire access-control check. It gated nothing, and it
// published a personal email in a public repository. Removed rather than
// repaired, since there is nothing private to protect.

const auth = {
    user: null,
    isDemo: false,

    init() {
        const login = document.getElementById('loginScreen');
        const app = document.getElementById('mainApp');
        if (login) login.style.display = 'none';
        if (app) app.style.display = 'block';
        init();
    }
};

// ============================================
// SEASON CONFIG
// ============================================
// Single source of truth for everything that changes at season rollover.
// The draft league gets a brand-new ID every season, so it is resolved at
// runtime rather than hardcoded: ?league=NNN wins, then a saved setting,
// then the default below.

const SEASON_CONFIG = {
    seasonLabel: '2026/27',
    previousSeasonLabel: '2025/26',
    previousSeasonId: '2025-26',
    defaultLeagueId: 689,
    totalGameweeks: 38,
    cacheSchemaVersion: 5,
    settingsKey: 'fpl.settings'
};

function readSettings() {
    try {
        return JSON.parse(localStorage.getItem(SEASON_CONFIG.settingsKey)) || {};
    } catch (e) {
        return {};
    }
}

function writeSettings(patch) {
    const next = { ...readSettings(), ...patch };
    try {
        localStorage.setItem(SEASON_CONFIG.settingsKey, JSON.stringify(next));
    } catch (e) {
        console.error('Could not persist settings', e);
    }
    return next;
}

// Precedence: URL ?league= > saved setting > season default.
// A league id passed in the URL is persisted so the link only has to be used once.
function getLeagueId() {
    let fromUrl = null;
    try {
        fromUrl = new URLSearchParams(window.location.search).get('league');
    } catch (e) {
        fromUrl = null;
    }
    if (fromUrl && /^\d+$/.test(fromUrl)) {
        const id = parseInt(fromUrl, 10);
        if (readSettings().leagueId !== id) writeSettings({ leagueId: id });
        return id;
    }
    const saved = readSettings().leagueId;
    if (Number.isInteger(saved) && saved > 0) return saved;
    return SEASON_CONFIG.defaultLeagueId;
}

// ============================================
// ORIGINAL CONFIG
// ============================================

const config = {
    urls: {
        bootstrap: 'https://fantasy.premierleague.com/api/bootstrap-static/',
        fixtures: 'https://fantasy.premierleague.com/api/fixtures/',
        draftLeagueDetails: (leagueId) => `https://draft.premierleague.com/api/league/${leagueId}/details`,
        draftEntryPicks: (entryId, gw) => `https://draft.premierleague.com/api/entry/${entryId}/event/${gw}`,
        // Authoritative ownership for the league — replaces diffing rosters.
        draftElementStatus: (leagueId) => `https://draft.premierleague.com/api/league/${leagueId}/element-status`,
        // Real per-gameweek totals per manager.
        draftEntryHistory: (entryId) => `https://draft.premierleague.com/api/entry/${entryId}/history`,
        // Waiver / free-agent add-drop feed for the whole league.
        draftTransactions: (leagueId) => `https://draft.premierleague.com/api/draft/league/${leagueId}/transactions`,
        // The original draft board, pick by pick.
        draftChoices: (leagueId) => `https://draft.premierleague.com/api/draft/${leagueId}/choices`,
        playerImage: (code) => `https://resources.premierleague.com/premierleague/photos/players/110x140/p${code}.png`,
        missingPlayerImage: 'https://resources.premierleague.com/premierleague/photos/players/110x140/Photo-Missing.png'
    },
    // Our own Cloudflare Worker (source in fpl-proxy-worker/) is the default.
    // It is the only proxy that reliably serves the ~1.5 MB bootstrap: the
    // public ones return 413 Payload Too Large, and allorigins is down. It is
    // also edge-cached, so it is faster than all of them.
    //
    // Kept as one ordered list rather than the three divergent copies that
    // used to exist. A custom URL set in settings still overrides this.
    corsProxy: 'https://fpl-proxy.amitzahy1.workers.dev/?url=',
    corsProxyFallbacks: [
        'https://api.codetabs.com/v1/proxy?quest=',
        'https://corsproxy.io/?',
        'https://cors-get-proxy.sirjosh.workers.dev/?url=',
        'https://api.allorigins.win/raw?url='
    ],
    // Resolved per read so a league change in settings takes effect without a code edit.
    get draftLeagueId() { return getLeagueId(); },
    setPieceTakers: {}, // DEPRECATED: Now automated via API in preprocessPlayerData
    tableColumns: [
        'rank', 'web_name', 'draft_score', 'vorp', 'defcon_hit_rate', 'rotation_risk',
        'stability_index', 'predicted_points_1_gw', 'next_3_fdr', 'team_name', 'draft_team',
        'position_name', 'now_cost', 'total_points', 'points_per_game_90', 'selected_by_percent',
        'dreamteam_count', 'net_transfers_event', 'def_contrib_per90', 'goals_scored_assists',
        'xGI_per90', 'minutes', 'xDiff', 'ict_index_per90', 'bonus_per90', 'clean_sheets_per90',
        'set_piece_priority.penalty', 'set_piece_priority.corner', 'set_piece_priority.free_kick', 'fixtures'
    ],
    comparisonMetrics: {
        'ציון דראפט': { key: 'draft_score', format: v => v.toFixed(1), reversed: false },
        'xPts (4GW)': { key: 'predicted_points_4_gw', format: v => (v || 0).toFixed(1), reversed: false },
        'נקודות למשחק (90)': { key: 'points_per_game_90', format: v => v.toFixed(1), reversed: false },
        'xGI (90)': { key: 'xGI_per90', format: v => v.toFixed(2), reversed: false },
        'DC/90 (הגנה)': { key: 'def_contrib_per90', format: v => v.toFixed(1), reversed: false },
        'xDiff': { key: 'xDiff', format: v => v.toFixed(2), reversed: true },
        'מחיר': { key: 'now_cost', format: v => `£${v.toFixed(1)}m`, reversed: true },
        'אחוז בחירה': { key: 'selected_by_percent', format: v => `${v}%`, reversed: true },
        'דקות': { key: 'minutes', format: v => v.toLocaleString(), reversed: false },
    },
    visualizationSpecs: {
        midfielders: { title: 'מטריצת קשרים', pos: ['MID'], x: 'def_contrib_per90', y: 'xGI_per90', xLabel: 'תרומה הגנתית/90', yLabel: 'איום התקפי (xGI/90)', quadLabels: { topRight: 'קשר All-Round', topLeft: 'קשר התקפי', bottomRight: 'קשר הגנתי', bottomLeft: 'פחות תורם' } },
        forwards: { title: 'מטריצת חלוצים', pos: ['FWD'], x: 'points_per_game_90', y: 'xGI_per90', xLabel: 'נקודות/90', yLabel: 'איום התקפי (xGI/90)', quadLabels: { topRight: 'חלוץ עלית', topLeft: 'מאיים, לא יעיל', bottomRight: 'יעיל, איום נמוך', bottomLeft: 'להימנע' } },
        defenders: { title: 'מטריצת מגנים', pos: ['DEF'], x: 'def_contrib_per90', y: 'xGI_per90', xLabel: 'תרומה הגנתית/90', yLabel: 'איום התקפי (xGI/90)', quadLabels: { topRight: 'מגן שלם', topLeft: 'מגן התקפי', bottomRight: 'בלם סלע', bottomLeft: 'להימנע' } },
        goalkeepers: { title: 'מטריצת שוערים', pos: ['GKP'], x: 'saves_per_90', y: 'clean_sheets_per_90', xLabel: 'הצלות/90', yLabel: 'שערים נקיים/90', quadLabels: { topRight: 'שוער עלית', topLeft: 'עסוק, פחות CS', bottomRight: 'יעיל, פחות הצלות', bottomLeft: 'להימנע' } },
        defensive_offensive: { title: 'תרומה הגנתית מול איום התקפי', pos: ['DEF', 'MID', 'FWD'], x: 'def_contrib_per90', y: 'xGI_per90', xLabel: 'תרומה הגנתית (DC/90)', yLabel: 'איום התקפי (xGI/90)', quadLabels: { topRight: 'All-Around Threat', topLeft: 'Offensive Specialist', bottomRight: 'Defensive Anchor', bottomLeft: 'Limited Impact' } }
    },
    recommendationMetrics: {
        'ציון חכם': {
            key: 'smart_score', format: v => {
                const val = parseFloat(v) || 0;
                return val.toFixed(1);
            }
        },
        'יציבות': {
            key: 'stability_index', format: v => {
                const val = parseFloat(v) || 0;
                return val.toFixed(0);
            }
        },
        'xPts (הבא)': {
            key: 'predicted_points_1_gw', format: v => {
                const val = parseFloat(v) || 0;
                return val.toFixed(1);
            }
        },
        'ציון דראפט': {
            key: 'draft_score', format: v => {
                const val = parseFloat(v) || 0;
                return val.toFixed(1);
            }
        },
        'Form': {
            key: 'form', format: v => {
                const val = parseFloat(v) || 0;
                return val.toFixed(1);
            }
        },
        'הפרש העברות': {
            key: 'transfers_balance', format: v => {
                const val = parseInt(v) || 0;
                return val > 0 ? `+${val}` : `${val}`;
            }
        },
        '% בחירה': {
            key: 'selected_by_percent', format: v => {
                const val = parseFloat(v) || 0;
                return `${val.toFixed(1)}%`;
            }
        },
        'דקות': {
            key: 'minutes', format: v => {
                const val = parseInt(v) || 0;
                return Math.round(val);
            }
        },
    },
    draftAnalyticsDimensions: [
        { key: 'sumDraft', label: 'ציון דראפט סה"כ' },
        { key: 'sumPred', label: 'xPts (4GW) סה"כ' },
        { key: 'totalPrice', label: 'שווי סגל (M)' },
        { key: 'sumSelectedBy', label: 'אחוז בחירה סה"כ' },
        { key: 'gaTotal', label: 'שערים+בישולים סה"כ' },
        { key: 'totalCleanSheets', label: 'שערים נקיים סה"כ' },
        { key: 'totalXGI', label: 'xGI סה"כ' },
        { key: 'totalDefCon', label: 'תרומה הגנתית סה"כ' }
    ],
    draftMatrixSpecs: [
        { key: 'val_vs_pf', title: 'שווי קבוצה מול Points For', build: (aggregates) => aggregates.map(t => ({ team: t.team, x: t.metrics.totalPrice || 0, y: teamPointsFor(t.team) })), xLabel: 'שווי סגל (M)', yLabel: 'Points For', quads: { topRight: 'יקר וחזק', topLeft: 'זול וחזק', bottomRight: 'יקר וחלש', bottomLeft: 'זול וחלש' } },
        { key: 'xgi_vs_ga', title: 'xGI סה"כ מול G+A סה"כ', build: (aggregates) => aggregates.map(t => ({ team: t.team, x: t.metrics.totalXGI || 0, y: t.metrics.gaTotal || 0 })), xLabel: 'xGI סה"כ', yLabel: 'G+A סה"כ', quads: { topRight: 'מימוש גבוה', topLeft: 'פוטנציאל לא ממומש', bottomRight: 'מימוש יתר', bottomLeft: 'נמוך בשניהם' } },
        { key: 'ds_vs_xpts', title: 'ציון דראפט מול xPts(4GW)', build: (aggregates) => aggregates.map(t => ({ team: t.team, x: t.metrics.sumDraft || 0, y: t.metrics.sumPred || 0 })), xLabel: 'ציון דראפט סה"כ', yLabel: 'xPts (4GW) סה"כ', quads: { topRight: 'סגל איכותי וכושר טוב', topLeft: 'סגל איכותי אך תחזית נמוכה', bottomRight: 'סגל חלש אך תחזית טובה', bottomLeft: 'חלש בשניהם' } },
        { key: 'def_vs_cs', title: 'תרומה הגנתית מול קלין שיטס', build: (aggregates) => aggregates.map(t => ({ team: t.team, x: t.metrics.totalDefCon || 0, y: t.metrics.totalCleanSheets || 0 })), xLabel: 'תרומה הגנתית סה"כ', yLabel: 'קלין שיטס סה"כ', quads: { topRight: 'הגנה איכותית ומקבלת CS', topLeft: 'הגנה חזקה אך מעט CS', bottomRight: 'CS רבים אך תרומה נמוכה', bottomLeft: 'הגנה חלשה' } },
    ],
    columnTooltips: {
        'draft_score': 'ציון דראפט מושלם: 35% נקודות בפועל, 15% תרומה הגנתית, 12% G+A למשחק, 12% xG למשחק, 10% איכות משחק, 8% אחוז בעלות, 8% בונוס. מחושב לפי עמדה!',
        'next_3_fdr': 'קושי ממוצע של 3 המשחקים הקרובים (1=קל, 5=קשה)',
        'predicted_points_1_gw': 'חיזוי נקודות למחזור הבא - מודל מתקדם: 17% מומנטום העברות 🔥, 28% כושר 📈, 25% xGI/90 ⚽, 20% קושי יריבות 🎯, 10% חוזק קבוצה 💪',
        'predicted_points_4_gw': 'צפי נקודות ממוצע ל-4 המחזורים הקרובים (לשימוש פנימי).',
        'stability_index': 'מדד יציבות (0-100) 📊 - מודד עקביות השחקן: 40% כושר אחרון 📈, 30% דיוק xG ⚽, 20% זמן משחק קבוע ⏱️, 10% שונות נקודות 📉. ככל שגבוה יותר = שחקן יציב ויותר צפוי ✅',
        'def_contrib_per90': 'תרומה הגנתית ל-90 דקות (תיקולים, חטיפות, חילוצים).',
        'vorp': 'VORP — כמה נקודות למשחק השחקן טוב יותר מהחלופה הזמינה בחינם באותה עמדה. המדד המרכזי לדראפט: בדראפט אין מחירים, ולכן ה"ערך" הוא היתרון על פני מי שאפשר לקחת בלי לבזבז פיק.',
        'defcon_hit_rate': 'אחוז ההופעות שבהן השחקן עבר בפועל את סף ה-DEFCON (10 CBIT למגן, 12 CBIRT לקשר/חלוץ) וזכה ב-2 נקודות. זהו סף פר-משחק, ולכן ממוצע ל-90 דקות מטעה.',
        'rotation_risk': 'אחוז ההופעות שבהן השחקן פתח בהרכב. בדראפט אי אפשר פשוט להעביר שחקן, ולכן שחקן מסובב מסוכן יותר מאשר ב-FPL רגיל.',
        'xDiff': 'ההפרש בין שערים+בישולים בפועל לצפי (xGI). ערך חיובי מעיד על מימוש יתר.',
        'net_transfers_event': 'סה"כ העברות נכנסות פחות יוצאות במחזור הנוכחי - מדד למומנטום ביקוש לשחקן.'
    }
};

/**
 * Per-item logging is off unless asked for. A single page load emitted ~940
 * console lines — one per fetch, per proxy hop, and per player-name match — and
 * the ~125 "no match found" lines went out at warn level even though they are an
 * expected outcome (academy players and departed players are not in the current
 * FPL bootstrap). The volume buried anything genuinely wrong.
 *
 * Turn it on with ?debug=1, or localStorage.setItem('fpl_debug','1').
 */
const DEBUG_LOGS = (() => {
    try {
        return /[?&]debug=1\b/.test(window.location.search)
            || localStorage.getItem('fpl_debug') === '1';
    } catch (e) { return false; }
})();

function dbg(...args) { if (DEBUG_LOGS) console.log(...args); }

const state = {
    allPlayersData: {
        historical: { raw: null, processed: null, fixtures: null },
        live: { raw: null, processed: null, fixtures: null },
        demo: { raw: null, processed: null, fixtures: null }
    },
    currentDataSource: 'live',
    teamsData: {},
    teamStrengthData: {},
    aggregatedCache: {}, // { 3: [...], 5: [...] }
    historicalPoints: {}, // GW -> Map(elementId -> stats)
    displayedData: [],
    // The same rows before the "הצג: 20 הראשונים" slice. The charts read this:
    // plotting the visible slice meant every scatter had exactly 20 points on it,
    // so a league-wide distribution looked like a handful of dots.
    filteredData: [],
    chartPosition: 'MID',        // which position the matrix chart is showing
    // Percentile baselines are computed once per render from the whole filtered
    // league, BEFORE the top-N slice. Scoping them to the visible rows made
    // every cell in a top-20 view look average.
    percentileBase: [],
    sortKey: 'draft_score',
    sortDirection: 'desc',
    activeQuickFilterName: null,
    selectedForComparison: new Set(),
    // --- scouting view ---
    watchlist: new Set(),        // player ids, persisted in localStorage
    watchlistOnly: false,        // filter the table down to the watchlist
    rowMode: 'trend',
    shownOptional: new Set(),   // filled by loadOptionalColumns() once the DOM is up            // 'trend' = tall rows with per-GW micro-charts, 'compact' = classic
    trendWindow: 5,              // how many recent gameweeks each micro-chart covers
    trendGws: [],                // [{ gw, stats: Map(playerId -> gwStats) }] newest last
    trendPrevGws: [],            // the window before it, so deltas have a baseline
    trendScales: {},             // per-metric bar ceilings, league-wide
    trendKey: null,              // "<source>:<gws>" — what trendGws currently holds
    trendLoading: false,
    openRowId: null,             // the player whose match log is expanded
    // Advanced filters
    searchQuery: '',
    priceRange: { min: 4, max: 15 },
    selectedTeams: [],
    savedFilters: null,
    draft: {
        // Same resolved value as config.draftLeagueId — these were two
        // independent hardcoded copies that different code paths read.
        get leagueId() { return getLeagueId(); },
        set leagueId(id) { writeSettings({ leagueId: parseInt(id, 10) }); },
        details: null,
        standings: null,
        rostersByEntryId: new Map(),
        lineupsByEntryId: new Map(), // { entryId: { starting: [fplId1, ...], bench: [fplId12, ...] } }
        historicalLineups: new Map(), // { entryId: { gw1: { starting: [...], bench: [...] }, gw2: {...}, ... } }
        entryIdToTeamName: new Map(),
        allPicks: new Set(),
        ownedElementIds: new Set(),
        _standingsData: [],
        _standingsSort: null,
        charts: { analytics: {}, matrix: null, progress: null },
        // Player ID mapping between Draft API and Fantasy API
        draftToFplIdMap: new Map(), // Draft ID -> Fantasy ID
        fplToDraftIdMap: new Map(), // Fantasy ID -> Draft ID

        // --- endpoints wired in 2026-07 ---
        // league/{id}/element-status: the league's own answer to "who owns whom".
        // ownershipByFplId maps FPL id -> owning league_entry id (null = free).
        ownershipByFplId: new Map(),
        ownershipLoaded: false,   // false => fall back to diffing rosters
        draftHasHappened: false,  // element-status shows at least one owner
        // entry/{id}/history: real per-gameweek totals, replacing an estimate.
        historyByEntryId: new Map(),
        // draft/{league}/choices and draft/league/{id}/transactions.
        choices: null,
        transactions: null,
        // Draft element id -> web_name, straight from the draft bootstrap.
        draftElementNames: new Map(),
        // The draft endpoints identify a manager by `entry_id`, while
        // league_entries and the standings use `id`. Keeping both directions
        // explicit stopped the transaction feed labelling every row "unknown".
        entryEntryIdToTeamName: new Map(),
    }
};

/**
 * Live Chart instances, keyed by canvas id, so each render can destroy the
 * previous one before replacing it. `comparisonRadar` was seeded here too, left
 * behind when the radar chart was removed — nothing has written or read it since.
 */
const charts = {
    visualization: null
};

/**
 * Fetch with cache, retry logic, and rate limiting
 * 
 * Features:
 * - Cache with configurable duration
 * - Retry on failure with exponential backoff
 * - Rate limiting detection (429 status)
 * - Network error handling
 * 
 * @param {string} url - URL to fetch
 * @param {string} cacheKey - Cache key for localStorage
 * @param {number} cacheDurationMinutes - Cache validity duration
 * @param {Object} options - Fetch options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.retryDelay - Initial retry delay in ms (default: 1000)
 * @returns {Promise<Object>} - Fetched data
 */
// ============================================
// ROBUST FETCHING (Tiered Strategy)
// ============================================

// The local proxy tier only makes sense while developing.
const IS_LOCAL_DEV = typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1', ''].includes(window.location.hostname);

// Cache keys this app owns. Anything else in localStorage is left alone.
const CACHE_KEY_PREFIXES = ['fpl_', 'draft_', 'fpl.v'];

function isOwnedCacheKey(key) {
    return CACHE_KEY_PREFIXES.some(p => key.startsWith(p)) &&
        key !== 'fpl_custom_proxy' && key !== 'fpl_saved_filters' &&
        key !== 'fpl.settings' && key !== 'fplToolActiveTab';
}

/**
 * Drop the oldest cached payloads to make room. Returns true if anything was
 * freed. Entries without a parseable timestamp are evicted first.
 */
function evictCacheEntries(keepKey) {
    const entries = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || key === keepKey || !isOwnedCacheKey(key)) continue;
        let timestamp = 0;
        try {
            timestamp = JSON.parse(localStorage.getItem(key))?.timestamp || 0;
        } catch (e) { /* unparseable: evict first */ }
        entries.push({ key, timestamp });
    }
    if (!entries.length) return false;

    entries.sort((a, b) => a.timestamp - b.timestamp);
    // Free half the cache so we are not back here on the next write.
    const toRemove = Math.max(1, Math.ceil(entries.length / 2));
    entries.slice(0, toRemove).forEach(e => localStorage.removeItem(e.key));
    console.log(`🧹 Evicted ${toRemove} cached entr${toRemove === 1 ? 'y' : 'ies'} to free space`);
    return true;
}

/**
 * One-time sweep of caches written by an older schema. Without this, stale
 * multi-megabyte payloads sit in localStorage forever and keep the quota full.
 */
function migrateCacheSchema() {
    const versionKey = 'fpl.cacheSchemaVersion';
    const current = String(SEASON_CONFIG.cacheSchemaVersion);
    if (localStorage.getItem(versionKey) === current) return;

    const stale = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && isOwnedCacheKey(key)) stale.push(key);
    }
    stale.forEach(k => localStorage.removeItem(k));
    localStorage.setItem(versionKey, current);
    if (stale.length) console.log(`🧹 Cleared ${stale.length} cache entries from an older schema`);
}

/**
 * Robust Fetch with tiered strategy:
 * 1. Local Proxy (http://localhost:8010) - Perfect reliability
 * 2. Custom Proxy (if configured)
 * 3. Public Proxies (rotation)
 */
// Requests in flight, keyed by cache key. Several code paths ask for the same
// payload at once (league details was being fetched three times concurrently on
// every load); without this each one opens its own proxy walk.
const _inflightRequests = new Map();

function fetchWithCache(url, cacheKey, cacheDurationMinutes = 120, options = {}) {
    const pending = _inflightRequests.get(cacheKey);
    if (pending) return pending;

    const promise = _fetchWithCacheUncoalesced(url, cacheKey, cacheDurationMinutes, options)
        .finally(() => _inflightRequests.delete(cacheKey));
    _inflightRequests.set(cacheKey, promise);
    return promise;
}

/**
 * Run tasks with a bounded number in flight. Public proxies rate-limit, so this
 * stays modest -- but it is dramatically better than awaiting one at a time.
 */
async function mapWithConcurrency(items, limit, worker) {
    const results = new Array(items.length);
    let next = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
            const i = next++;
            if (i >= items.length) return;
            try {
                results[i] = await worker(items[i], i);
            } catch (e) {
                results[i] = null;
            }
        }
    });
    await Promise.all(runners);
    return results;
}

async function _fetchWithCacheUncoalesced(url, cacheKey, cacheDurationMinutes = 120, options = {}) {
    const { maxRetries = 3, retryDelay = 1000 } = options;

    // 1. Try Cache
    const cachedItem = localStorage.getItem(cacheKey);
    if (cachedItem) {
        try {
            const { timestamp, data } = JSON.parse(cachedItem);
            const isCacheValid = (new Date().getTime() - timestamp) / (1000 * 60) < cacheDurationMinutes;
            if (isCacheValid) {
                dbg(`✅ Returning cached data for ${cacheKey}`);
                return data;
            } else {
                dbg(`⏰ Cache expired for ${cacheKey}`);
                localStorage.removeItem(cacheKey);
            }
        } catch (e) {
            console.error('❌ Error parsing cache:', e);
            localStorage.removeItem(cacheKey);
        }
    }

    dbg(`🌐 Fetching fresh data for ${cacheKey}...`);

    const saveToCache = (data) => {
        const payload = JSON.stringify({ timestamp: new Date().getTime(), data });
        try {
            localStorage.setItem(cacheKey, payload);
        } catch (e) {
            // The bootstrap payload is over a megabyte, so the ~5 MB quota fills
            // quickly. When it does, every write fails and nothing is ever
            // cached again -- which is why the site refetched everything on
            // each load. Evict the oldest entries and retry once.
            if (evictCacheEntries(cacheKey)) {
                try {
                    localStorage.setItem(cacheKey, payload);
                    console.log(`💾 Cached ${cacheKey} after eviction`);
                    return;
                } catch (e2) {
                    console.warn(`⚠️ ${cacheKey} too large to cache; continuing without it`);
                    return;
                }
            }
            console.warn(`⚠️ Could not cache ${cacheKey}:`, e.name);
        }
    };

    // Callers pass URLs already prefixed with a proxy, so recover the real
    // target before choosing which proxy to use. The list is derived from the
    // live config rather than hardcoded: when it was a fixed list, adding our
    // own Worker meant its prefix was not stripped, and the request became
    // worker(worker(fpl-url)) -- which the Worker rejects as 403 because the
    // inner URL is not an FPL domain. That silently killed the fixtures fetch.
    let originalUrl = url;
    const knownProxies = [
        config.corsProxy,
        ...config.corsProxyFallbacks,
        localStorage.getItem('fpl_custom_proxy'),
        'https://cors-anywhere.herokuapp.com/',
        'https://thingproxy.freeboard.io/fetch/'
    ].filter(Boolean);

    for (const proxy of knownProxies) {
        if (url.startsWith(proxy)) {
            originalUrl = decodeURIComponent(url.substring(proxy.length));
            break;
        }
    }

    // A custom proxy may be stored as a bare origin; normalise that too.
    const customBase = localStorage.getItem('fpl_custom_proxy');
    if (customBase && originalUrl.startsWith(customBase)) {
        const q = originalUrl.indexOf('url=');
        if (q >= 0) originalUrl = decodeURIComponent(originalUrl.slice(q + 4));
    }

    // 🟢 Tier 1: Local Proxy — development only.
    // On the deployed site localhost:8010 can never resolve, so attempting it
    // cost a guaranteed failed request on every single fetch.
    if (IS_LOCAL_DEV) {
        try {
            const localProxyUrl = `http://localhost:8010/?url=${encodeURIComponent(originalUrl)}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1000); // Fast timeout check

            const response = await fetch(localProxyUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                console.log(`🚀 Using Local Proxy (Perfect Connection)!`);
                saveToCache(data);
                return data;
            }
        } catch (e) {
            // Local proxy not running, ignore and move on
        }
    }

    // 🟢 Tier 2: Custom User Proxy (Cloudflare Worker)
    const customProxy = localStorage.getItem('fpl_custom_proxy');
    if (customProxy) {
        try {
            const targetUrl = customProxy.includes('?')
                ? `${customProxy}&url=${encodeURIComponent(originalUrl)}`
                : `${customProxy}?url=${encodeURIComponent(originalUrl)}`;

            const response = await fetch(targetUrl);
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Custom Proxy success!`);
                saveToCache(data);
                return data;
            }
        } catch (e) {
            console.warn(`⚠️ Custom Proxy failed`);
        }
    }

    // 🟠 Tier 3: Public proxy rotation.
    // Kept in one ordered list (config.corsProxyFallbacks) instead of the three
    // divergent copies that used to exist. Proxies observed failing in
    // production have been removed: thingproxy.freeboard.io no longer resolves
    // and dummy-cors-proxy.herokuapp.com returns 404 without CORS headers.
    // Walking those cost several seconds before reaching a working one.
    const proxies = [config.corsProxy, ...config.corsProxyFallbacks]
        .filter(p => p && p !== customProxy);

    const uniqueProxies = [...new Set(proxies)];

    // Try sequentially but fail fast
    for (let i = 0; i < uniqueProxies.length; i++) {
        const currentProxy = uniqueProxies[i];

        try {
            const targetUrl = currentProxy + encodeURIComponent(originalUrl);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const response = await fetch(targetUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                const text = await response.text();
                try {
                    const data = JSON.parse(text); // Verify JSON
                    dbg(`✅ Proxy ${i + 1} success (${currentProxy})`);

                    // Prioritize this proxy for this session
                    if (i > 0 && i < 3) config.corsProxy = currentProxy;

                    saveToCache(data);
                    return data;
                } catch (jsonErr) {
                    console.warn(`⚠️ Proxy returned non-JSON`);
                }
            }
        } catch (e) {
            // Continue
        }
    }

    // 🔴 Final Fail
    throw new Error(`Could not fetch data. Please run 'node local_proxy.js' for 100% reliability.`);
}

// ============================================
// DRAFT TO FPL PLAYER ID MAPPING
// ============================================

/**
 * Normalize player name for comparison
 * Removes accents, converts to lowercase, removes extra spaces
 */
function normalizePlayerName(player) {
    const fullName = `${player.first_name} ${player.second_name}`.toLowerCase();
    // Remove accents and special characters
    return fullName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
}

/**
 * Check if two player names match (either first or second name)
 */
function namesMatch(player1, player2) {
    const name1Lower = player1.second_name.toLowerCase();
    const name2Lower = player2.second_name.toLowerCase();

    // Exact match on second name
    if (name1Lower === name2Lower) return true;

    // Check if one contains the other (for hyphenated names)
    if (name1Lower.includes(name2Lower) || name2Lower.includes(name1Lower)) return true;

    return false;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[str2.length][str1.length];
}

/**
 * Find fuzzy match for a player using Levenshtein distance
 */
function findFuzzyMatch(draftPlayer, fplPlayers) {
    const draftName = normalizePlayerName(draftPlayer);
    const draftPos = draftPlayer.element_type;

    let bestMatch = null;
    let bestSimilarity = 0;

    for (const fplPlayer of fplPlayers) {
        // Only compare players in the same position
        if (fplPlayer.element_type !== draftPos) continue;

        const fplName = normalizePlayerName(fplPlayer);
        const distance = levenshteinDistance(draftName, fplName);
        const maxLength = Math.max(draftName.length, fplName.length);
        const similarity = 1 - (distance / maxLength);

        if (similarity > bestSimilarity && similarity > 0.8) {
            bestSimilarity = similarity;
            bestMatch = fplPlayer;
        }
    }

    return bestMatch ? { player: bestMatch, similarity: bestSimilarity } : null;
}

/**
 * Build mapping between Draft API player IDs and Fantasy API player IDs
 * This solves the problem where IDs don't match between the two APIs
 */
async function buildDraftToFplMapping() {
    dbg('🔄 Building Draft to FPL ID mapping...');

    try {
        const fplUrl = config.corsProxy + encodeURIComponent(config.urls.bootstrap);
        const draftUrl = config.corsProxy + encodeURIComponent('https://draft.premierleague.com/api/bootstrap-static');

        const [fplData, draftData] = await Promise.all([
            fetchWithCache(fplUrl, 'fpl_bootstrap_mapping', 60),
            fetchWithCache(draftUrl, 'draft_bootstrap_mapping', 60)
        ]);

        // Create lookup maps
        const fplById = new Map(fplData.elements.map(p => [p.id, p]));
        const fplByName = new Map();

        // Build name-based lookup for FPL players
        for (const p of fplData.elements) {
            const key = normalizePlayerName(p);
            fplByName.set(key, p);
        }

        // Clear existing mappings
        state.draft.draftToFplIdMap.clear();
        state.draft.fplToDraftIdMap.clear();

        // Keep the Draft API's own name for every element. Players who left the
        // league have no FPL entry to map to, and the transaction feed was
        // rendering them as "#379" -- the draft bootstrap still knows the name.
        state.draft.draftElementNames.clear();
        for (const dp of draftData.elements) {
            if (dp && dp.id) state.draft.draftElementNames.set(dp.id, dp.web_name);
        }

        let exactMatches = 0;
        let nameMatches = 0;
        let fuzzyMatches = 0;
        let unmapped = 0;
        const unmappedNames = [];

        dbg('📋 Starting player mapping...');

        for (const draftPlayer of draftData.elements) {
            let fplPlayer = null;
            let matchType = null;

            // Step 1: Try exact ID match + name verification
            const candidate = fplById.get(draftPlayer.id);
            if (candidate && namesMatch(candidate, draftPlayer)) {
                fplPlayer = candidate;
                matchType = 'exact_id';
                exactMatches++;
            }

            // Step 2: Try name-based matching
            if (!fplPlayer) {
                const nameKey = normalizePlayerName(draftPlayer);
                fplPlayer = fplByName.get(nameKey);
                if (fplPlayer) {
                    matchType = 'name';
                    nameMatches++;
                    if (draftPlayer.id !== fplPlayer.id) {
                        dbg(`  🔗 Name match: ${draftPlayer.web_name} - Draft:${draftPlayer.id} → FPL:${fplPlayer.id}`);
                    }
                }
            }

            // Step 3: Try fuzzy matching (for name variations)
            if (!fplPlayer) {
                const fuzzyMatch = findFuzzyMatch(draftPlayer, fplData.elements);
                if (fuzzyMatch && fuzzyMatch.similarity > 0.85) {
                    fplPlayer = fuzzyMatch.player;
                    matchType = 'fuzzy';
                    fuzzyMatches++;
                    dbg(`  🔍 Fuzzy match: ${draftPlayer.web_name} → ${fplPlayer.web_name} (${(fuzzyMatch.similarity * 100).toFixed(0)}% similar, Draft:${draftPlayer.id} → FPL:${fplPlayer.id})`);
                }
            }

            if (fplPlayer) {
                state.draft.draftToFplIdMap.set(draftPlayer.id, fplPlayer.id);
                state.draft.fplToDraftIdMap.set(fplPlayer.id, draftPlayer.id);
            } else {
                unmapped++;
                // Expected for academy and departed players, so this is not a
                // warning; collected for the one-line summary below.
                unmappedNames.push(draftPlayer.web_name);
            }
        }

        const total = draftData.elements.length;
        console.log(`🔗 Draft→FPL mapping: ${state.draft.draftToFplIdMap.size}/${total} matched`
            + ` (${exactMatches} by id, ${nameMatches} by name, ${fuzzyMatches} fuzzy)`
            + `${unmapped ? ` · ${unmapped} unmatched — expected for academy/departed players` : ''}`
            + `${unmapped && !DEBUG_LOGS ? '. Add ?debug=1 for the list.' : ''}`);
        if (unmapped && DEBUG_LOGS) console.log('   unmatched:', unmappedNames.join(', '));

        return {
            success: true,
            mapped: state.draft.draftToFplIdMap.size,
            unmapped: unmapped
        };

    } catch (error) {
        console.error('❌ Failed to build Draft→FPL mapping:', error);
        return { success: false, error: error.message };
    }
}

function showLoading(message = 'טוען נתונים...') {
    const overlay = document.getElementById('loadingOverlay');
    overlay.querySelector('p').textContent = message;
    overlay.style.display = 'flex';
    showProgressBar();
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
    hideProgressBar();
}

// Progress Bar Functions
function showProgressBar() {
    const container = document.getElementById('progressBarContainer');
    const bar = document.getElementById('progressBar');
    if (!container || !bar) return;

    container.classList.add('active');
    bar.style.width = '0%';

    // Simulate progress
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90; // Never reach 100% until complete
        bar.style.width = `${progress}%`;
    }, 300);

    // Store interval for cleanup
    container.dataset.intervalId = interval;
}

function hideProgressBar() {
    const container = document.getElementById('progressBarContainer');
    const bar = document.getElementById('progressBar');
    if (!container || !bar) return;

    // Clear interval
    if (container.dataset.intervalId) {
        clearInterval(parseInt(container.dataset.intervalId));
    }

    // Complete to 100%
    bar.style.width = '100%';

    // Hide after animation
    setTimeout(() => {
        container.classList.remove('active');
        bar.style.width = '0%';
    }, 300);
}

// Toast Notification System
function showToast(title, message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons.info}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    // Auto-remove after duration
    if (duration > 0) {
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    return toast;
}

// ============================================
// MANUAL DATA & SETTINGS UI
// ============================================

function openSettings() {
    document.getElementById('customProxyInput').value = localStorage.getItem('fpl_custom_proxy') || '';
    const leagueInput = document.getElementById('leagueIdInput');
    if (leagueInput) leagueInput.value = getLeagueId();
    document.getElementById('settingsModal').style.display = 'block';
}

function saveSettings() {
    const url = document.getElementById('customProxyInput').value.trim();
    if (url) {
        localStorage.setItem('fpl_custom_proxy', url);
    } else {
        localStorage.removeItem('fpl_custom_proxy');
    }

    const leagueInput = document.getElementById('leagueIdInput');
    const previousLeagueId = getLeagueId();
    let leagueChanged = false;
    if (leagueInput) {
        const raw = leagueInput.value.trim();
        if (/^\d+$/.test(raw)) {
            const id = parseInt(raw, 10);
            if (id !== previousLeagueId) {
                writeSettings({ leagueId: id });
                leagueChanged = true;
            }
        } else if (raw !== '') {
            showToast('שגיאה', 'מזהה ליגה חייב להיות מספר', 'error');
            return;
        }
    }

    document.getElementById('settingsModal').style.display = 'none';

    if (leagueChanged) {
        // Cached draft data belongs to the old league — drop it before reloading.
        clearDraftCaches();
        showToast('הגדרות נשמרו', 'מזהה הליגה עודכן, טוען מחדש...', 'success');
        setTimeout(() => window.location.reload(), 800);
    } else {
        showToast('הגדרות נשמרו', 'ההגדרות עודכנו בהצלחה', 'success');
    }
}

// Remove every cached draft payload (league-scoped keys carry the league id,
// but picks/standings caches do not, so sweep them all).
function clearDraftCaches() {
    Object.keys(localStorage)
        .filter(k => k.startsWith('fpl_draft_') || k.startsWith('draft_'))
        .forEach(k => localStorage.removeItem(k));
}

// Season names are rendered from SEASON_CONFIG so a rollover is a one-line change.
function applySeasonLabels() {
    const live = document.getElementById('liveDataBtn');
    const prev = document.getElementById('historicalDataBtn');
    if (live) live.textContent = SEASON_CONFIG.seasonLabel;
    if (prev) prev.textContent = SEASON_CONFIG.previousSeasonLabel;
}

async function processManualData() {
    const input = document.getElementById('manualDataInput').value;
    try {
        const data = JSON.parse(input);

        // Validate basic structure
        if (!data.elements || !data.teams) {
            throw new Error('JSON לא תקין: חסרים שדות חובה (elements, teams)');
        }

        console.log('📦 Manual data parsed successfully');

        // Save to cache as if it was fetched
        localStorage.setItem('fpl_bootstrap_live', JSON.stringify({
            timestamp: new Date().getTime(),
            data: data
        }));

        state.allPlayersData.live.raw = data;

        document.getElementById('manualDataModal').style.display = 'none';
        showToast('הצלחה', 'נתונים נטענו ידנית בהצלחה!', 'success');

        // Re-run init process
        await fetchAndProcessData();

    } catch (e) {
        alert('שגיאה בפענוח הנתונים: ' + e.message);
    }
}


// Main init function for real data
async function init() {
    // Chart.js comes from a CDN. If that request fails the charts are gone, but
    // the table must not be: this line used to throw before a single row was
    // rendered, so a CDN blip took down the whole page.
    if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
    } else {
        console.warn('Chart.js unavailable — charts disabled, table unaffected');
    }

    applySeasonLabels();

    // Load data sources in sequence to ensure mapping works
    showLoading();
    try {
        // 1. Paint from the local completed-season snapshot immediately. It
        //    needs no network, so the page is usable in well under a second
        //    even when every public proxy is failing. The live season is then
        //    checked in the background and takes over only once it has real
        //    data. Blocking on the live API here left the page empty for 30s
        //    whenever the proxies were down, which is most of the time.
        state.currentDataSource = 'historical';
        syncDataSourceButtons();
        await fetchAndProcessData();
        // Explain the season being shown even if the live API never answers,
        // so the numbers are never presented without their context.
        showSeasonBanner(finishedGameweekCount());

        // 2. Now see whether the new season has actually started.
        ensureLiveBootstrap({ timeoutMs: 20000 })
            .then(async () => {
                if (!state.allPlayersData.live.raw) return;
                if (currentSeasonIsTooEarly()) {
                    showSeasonBanner(finishedGameweekCount());
                    return;
                }
                console.log('🔄 New season has data — switching to live');
                state.currentDataSource = 'live';
                syncDataSourceButtons();
                await fetchAndProcessData();
            })
            .catch(e => console.warn('Live season check failed:', e.message));

        // 3. Then build the Draft→FPL mapping
        await buildDraftToFplMapping();

        // 3. Finally load Draft data (now mapping is ready!)
        await loadDraftDataInBackground();

        showToast('טעינה הושלמה', 'כל הנתונים נטענו בהצלחה!', 'success', 3000);
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('שגיאה', 'שגיאה בטעינת הנתונים', 'error', 4000);
    } finally {
        hideLoading();
    }

    setupEventListeners();
    const lastTab = localStorage.getItem('fplToolActiveTab');
    if (lastTab) {
        showTab(lastTab);
    }
    initializeTooltips();
}

document.addEventListener('DOMContentLoaded', () => {
    // Clear caches written by an older schema before anything reads them.
    migrateCacheSchema();

    // Collapse the filter panel and pick a row density before anything paints.
    applyMobileDefaults();

    // Render season names immediately. init() runs only after sign-in, so
    // labelling there left the season toggle blank on the landing screen.
    applySeasonLabels();

    // Initialize authentication
    auth.init();

    // Ensure global functions are available
    console.log('✅ Global functions initialized:', {
        compareSelectedPlayers: typeof window.compareSelectedPlayers,
        closeModal: typeof window.closeModal
    });
});

// ============================================
// COMPLETED-SEASON SNAPSHOT
// ============================================
// Loads data/season-<id>.json (built by scripts/build-season-snapshot.mjs) and
// reshapes it into the same structure bootstrap-static returns, so every
// downstream consumer works unchanged.
//
// This is what makes the tool usable on draft day: the new season's API reports
// every player at zero until GW1 is played.

let _seasonSnapshotPromise = null;

async function loadSeasonSnapshot(seasonId = SEASON_CONFIG.previousSeasonId) {
    if (_seasonSnapshotPromise) return _seasonSnapshotPromise;

    _seasonSnapshotPromise = (async () => {
        const res = await fetch(`data/season-${seasonId}.json`);
        if (!res.ok) throw new Error(`Season snapshot ${seasonId} unavailable (HTTP ${res.status})`);
        const snap = await res.json();

        const idx = Object.fromEntries(snap.fields.map((f, i) => [f, i]));
        const elements = snap.rows.map(row => {
            const p = {};
            snap.fields.forEach((f, i) => { p[f] = row[i]; });
            // Fields that only exist for a live season. A finished season has no
            // transfer churn or injury news, and points-per-game is the honest
            // stand-in for "form" once every match has been played.
            p.status = 'a';
            p.news = '';
            p.news_added = null;
            p.chance_of_playing_next_round = 100;
            p.chance_of_playing_this_round = 100;
            p.form = p.points_per_game;
            p.event_points = 0;
            p.transfers_in_event = 0;
            p.transfers_out_event = 0;
            p.interceptions = 0; // already included inside clearances_blocks_interceptions
            p.photo = `${p.code}.jpg`;
            p.ep_next = null;
            return p;
        });

        const events = Array.from({ length: snap.totalGameweeks }, (_, i) => ({
            id: i + 1,
            finished: true,
            finished_provisional: true,
            data_checked: true,
            is_current: i + 1 === snap.totalGameweeks,
            is_next: false,
            is_previous: false
        }));

        console.log(`📚 Season ${seasonId} snapshot: ${elements.length} players, ${snap.totalGameweeks} GWs`);
        return { elements, teams: snap.teams, events, __snapshot: snap, __seasonId: seasonId };
    })();

    return _seasonSnapshotPromise;
}

// True while the current season has too little played data to be worth showing.
// Before that point the table must default to the completed season.
function currentSeasonIsTooEarly() {
    const live = state.allPlayersData.live.raw;
    if (!live || !live.events) return true;
    return live.events.filter(e => e.finished || e.finished_provisional).length < 5;
}

function finishedGameweekCount() {
    const live = state.allPlayersData.live.raw;
    if (!live || !live.events) return 0;
    return live.events.filter(e => e.finished || e.finished_provisional).length;
}

// Fetch the live bootstrap and fixtures without processing or rendering.
//
// This must never block the first paint. The bootstrap is well over a
// megabyte and the free proxies routinely reject it (413) or go down
// entirely, so waiting on it left the page empty for 30+ seconds. The
// completed-season snapshot is local and needs no proxy, so it renders first
// and this upgrades the view afterwards if the live data actually arrives.
async function ensureLiveBootstrap({ timeoutMs = 0 } = {}) {
    const withTimeout = (promise, label) => {
        if (!timeoutMs) return promise;
        return Promise.race([
            promise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs))
        ]);
    };

    const jobs = [];

    if (!state.allPlayersData.live.raw) {
        jobs.push(
            withTimeout(fetchWithCache(config.urls.bootstrap, 'fpl_bootstrap_live', 60), 'bootstrap')
                .then(data => { state.allPlayersData.live.raw = data; })
                .catch(e => console.warn('⚠️ Live bootstrap unavailable:', e.message))
        );
    }

    if (!state.allPlayersData.live.fixtures) {
        jobs.push(
            withTimeout(fetchWithCache(config.urls.fixtures, 'fpl_fixtures', 180), 'fixtures')
                .then(fixtures => {
                    state.allPlayersData.live.fixtures = fixtures;
                    state.allPlayersData.historical.fixtures = fixtures;
                })
                .catch(e => console.warn('⚠️ Fixtures unavailable:', e.message))
        );
    }

    await Promise.all(jobs);
}

// Fixtures arrive after the first paint, so backfill FDR and re-render once
// they land rather than making the user wait for them.
function applyFixturesToProcessedData(fixtures) {
    let updated = false;
    ['live', 'historical'].forEach(src => {
        const processed = state.allPlayersData[src]?.processed;
        if (!processed || !processed.length) return;
        calculateRealFDR(processed, fixtures);
        // Predictions need the fixture list too. Players are processed before
        // the fixtures arrive — they are deliberately not blocking the first
        // paint — so calculateAllPredictions found none and left every xPts
        // unset, which the table rendered as a column of 0.0.
        calculateAllPredictions(processed);
        updated = true;
    });
    if (!updated) return;
    console.log('🗓️ Fixtures arrived — FDR and xPts backfilled');
    processChange();
}

async function fetchAndProcessData() {
    showLoading('טוען נתוני שחקנים...');
    try {
        const needsData = !state.allPlayersData[state.currentDataSource].raw;
        const needsFixtures = !state.allPlayersData.live.fixtures;

        if (needsData || needsFixtures) {
            const dataUrl = config.corsProxy + encodeURIComponent(config.urls.bootstrap);
            const dataCacheKey = `fpl_bootstrap_${state.currentDataSource}`;

            const fixturesUrl = config.corsProxy + encodeURIComponent(config.urls.fixtures);
            const fixturesCacheKey = 'fpl_fixtures';

            if (needsData) {
                if (state.currentDataSource === 'live') {
                    // Main data fetch - Robust auto-retry
                    state.allPlayersData.live.raw = await fetchWithCache(dataUrl, dataCacheKey, 60);
                } else {
                    state.allPlayersData.historical.raw = await loadSeasonSnapshot();
                }
            }
            if (needsFixtures) {
                // Fixtures only feed the FDR column, so they must not hold up
                // the page. Awaiting them meant a dead proxy blanked the whole
                // table for 30 seconds even though the player data was local.
                fetchWithCache(fixturesUrl, fixturesCacheKey, 180)
                    .then(fixturesData => {
                        if (!Array.isArray(fixturesData)) return;
                        state.allPlayersData.live.fixtures = fixturesData;
                        state.allPlayersData.historical.fixtures = fixturesData;
                        applyFixturesToProcessedData(fixturesData);
                    })
                    .catch(e => console.warn('⚠️ Fixtures unavailable, FDR column disabled:', e.message));
            }
        }

        const data = state.allPlayersData[state.currentDataSource].raw;
        if (!data) throw new Error(`No data available for ${state.currentDataSource}.`);
        if (!state.allPlayersData[state.currentDataSource].processed) {
            state.teamsData = data.teams.reduce((acc, team) => {
                acc[team.id] = { name: team.name, short_name: team.short_name };
                return acc;
            }, {});
            state.teamStrengthData = data.teams.reduce((acc, team) => {
                acc[team.id] = { ...team };
                return acc;
            }, {});
            const setPieceTakers = config.setPieceTakers;
            let processedPlayers = preprocessPlayerData(data.elements.filter(p => p.status !== 'u'), setPieceTakers);

            // Calculate FDR if fixtures are available
            if (state.allPlayersData.live.fixtures) {
                processedPlayers = calculateRealFDR(processedPlayers, state.allPlayersData.live.fixtures);
            }

            processedPlayers = calculateAdvancedScores(processedPlayers);
            processedPlayers = computeDraftMetrics(processedPlayers);
            state.allPlayersData[state.currentDataSource].processed = processedPlayers;
        }

        document.getElementById('lastUpdated').textContent = `עדכון אחרון: ${new Date().toLocaleString('he-IL')}`;
        populateTeamFilter();
        populateSignalFilter();
        assertQuickFiltersReachable();
        loadWatchlist();
        state.shownOptional = loadOptionalColumns();
        invalidateSignals();
        renderDraftBoard();
        processChange();

        // The trend window is a handful of localStorage-cached gameweek fetches.
        // Paint the table first, then fill the micro-charts in when it resolves.
        // The table has always opened sorted by ציון, but no header showed it, so
        // it read as unsorted.
        updateSortIndicators(state.sortKey);

        ensureTrendWindow().then(() => {
            if (!state.trendGws.length) return;
            // Two signal rules read the gameweek window; drop verdicts decided
            // before it landed so they are recomputed with it.
            invalidateSignals();
            renderTable();
            renderDraftBoard();
        });

        // Load draft data in background (for team filter)
        loadDraftDataInBackground();

        // Show success toast
        showToast('נתונים נטענו בהצלחה', `${state.allPlayersData[state.currentDataSource].processed.length} שחקנים נטענו`, 'success', 3000);
    } catch (error) {
        console.error('Error in fetchAndProcessData:', error);

        const errorMsg = `
            <div style="text-align: center;">
                <h3>❌ שגיאה בטעינת נתונים</h3>
                <p>${error.message}</p>
                <div style="background: #fff3cd; padding: 10px; border-radius: 6px; margin-top: 10px; text-align: right; display: inline-block;">
                    <strong>פתרון מומלץ (100% הצלחה):</strong><br>
                    1. פתח טרמינל בתיקייה זו<br>
                    2. הרץ: <code>node local_proxy.js</code><br>
                    3. רענן את העמוד
                </div>
            </div>
        `;

        const tbody = document.getElementById('playersTableBody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="26" style="padding: 20px;">${errorMsg}</td></tr>`;
        showToast('שגיאה בטעינת נתונים', 'נסה להריץ את local_proxy.js', 'error', 10000);
    } finally {
        hideLoading();
    }
}

function switchDataSource(source) {
    if (source === state.currentDataSource) return;
    state.currentDataSource = source;
    syncDataSourceButtons();

    // Selecting a season that has not been played yet must show nothing and
    // say why. Leaving the previous season's charts on screen under the new
    // season's label is worse than an empty view.
    if (source === 'live' && currentSeasonIsTooEarly()) {
        showEmptySeasonState();
        return;
    }

    clearEmptySeasonState();
    fetchAndProcessData();
}

function showEmptySeasonState() {
    const played = finishedGameweekCount();
    state.displayedData = [];

    // Charts hold their own canvases; without destroying them the old
    // season's points stay visible.
    Object.keys(charts).forEach(key => {
        if (charts[key] && typeof charts[key].destroy === 'function') {
            charts[key].destroy();
            charts[key] = null;
        }
    });
    if (window.Chart && Chart.instances) {
        Object.values(Chart.instances).forEach(c => { try { c.destroy(); } catch (e) { } });
    }

    const body = document.getElementById('playersTableBody');
    if (body) {
        body.innerHTML = `<tr><td colspan="28" style="padding:28px; text-align:center; color:#475569;">
            <div style="font-size:15px; font-weight:700; margin-bottom:6px;">אין עדיין נתונים לעונת ${SEASON_CONFIG.seasonLabel}</div>
            <div style="font-size:13px;">${played === 0
                ? 'העונה טרם התחילה — לכל השחקנים 0 דקות ו-0 נקודות.'
                : `שוחקו ${played} מחזורים בלבד.`}
                לניתוח לקראת הדראפט עברו ל-${SEASON_CONFIG.previousSeasonLabel}.</div>
            <button class="control-button active" style="margin-top:14px;"
                onclick="switchDataSource('historical')">הצג נתוני ${SEASON_CONFIG.previousSeasonLabel}</button>
        </td></tr>`;
    }

    const board = document.getElementById('draftBoard');
    if (board) board.innerHTML = '';

    showSeasonBanner(played);
    showToast(`אין נתוני ${SEASON_CONFIG.seasonLabel}`, 'העונה החדשה טרם החלה', 'warning', 4000);
}

function clearEmptySeasonState() {
    const banner = document.getElementById('seasonBanner');
    if (banner && state.currentDataSource === 'live') banner.remove();
}

function syncDataSourceButtons() {
    const src = state.currentDataSource;
    const hist = document.getElementById('historicalDataBtn');
    const live = document.getElementById('liveDataBtn');
    if (hist) hist.classList.toggle('active', src === 'historical');
    if (live) live.classList.toggle('active', src === 'live');
}

// Before the new season has meaningful data, every metric derived from minutes
// or points is zero. Fall back to the completed season and say so, rather than
// presenting an empty table as though it were the truth.
function showSeasonBanner(playedGws) {
    const existing = document.getElementById('seasonBanner');
    if (existing) existing.remove();

    const showingPrevious = state.currentDataSource === 'historical';
    const msg = showingPrevious
        ? (playedGws === 0
            ? `מוצגים נתוני ${SEASON_CONFIG.previousSeasonLabel} המלאים — עונת ${SEASON_CONFIG.seasonLabel} טרם התחילה`
            : `מוצגים נתוני ${SEASON_CONFIG.previousSeasonLabel} המלאים — לעונת ${SEASON_CONFIG.seasonLabel} יש רק ${playedGws} מחזורים`)
        : `עונת ${SEASON_CONFIG.seasonLabel} — ${playedGws} מחזורים שוחקו`;

    const banner = document.createElement('div');
    banner.id = 'seasonBanner';
    banner.style.cssText = showingPrevious
        ? 'margin: 10px 0; padding: 10px 14px; border-radius: 8px; background: #fef3c7; border: 1px solid #fcd34d; color: #92400e; font-size: 13px; font-weight: 700;'
        : 'margin: 10px 0; padding: 10px 14px; border-radius: 8px; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; font-size: 13px; font-weight: 700;';
    banner.textContent = `📅 ${msg}`;

    const anchor = document.getElementById('playersTabContent');
    if (anchor) anchor.prepend(banner);
}

function getPositionName(elementTypeId) {
    switch (elementTypeId) {
        case 1: return 'GKP';
        case 2: return 'DEF';
        case 3: return 'MID';
        case 4: return 'FWD';
        default: return 'Unknown';
    }
}

function preprocessPlayerData(players, setPieceTakers) {
    return players.map(p => {
        // Basic calculations
        const mins = p.minutes || 0;
        const mins90 = mins / 90;

        // Prefer the API's own per-90 field; only derive from totals when it is
        // absent. Recomputing everything by hand was the source of several silent
        // zeros, and the API value is the authoritative one.
        const per90 = (nativeValue, total) => {
            const native = parseFloat(nativeValue);
            if (Number.isFinite(native) && native !== 0) return native;
            return mins > 0 ? (parseFloat(total) || 0) / mins90 : 0;
        };

        // Official DEFCON. The hand-rolled version double-counted interceptions
        // (clearances_blocks_interceptions already contains them) and never
        // counted recoveries, which MID/FWD need for the CBIRT threshold.
        p.defensive_contribution_per_90 = per90(
            p.defensive_contribution_per_90,
            p.defensive_contribution !== undefined && p.defensive_contribution !== null
                ? p.defensive_contribution
                : (p.clearances_blocks_interceptions || 0) + (p.tackles || 0) +
                  (p.element_type === 3 || p.element_type === 4 ? (p.recoveries || 0) : 0)
        );

        p.xGI_per90 = per90(p.expected_goal_involvements_per_90, p.expected_goal_involvements);
        p.expected_goals_per_90 = per90(p.expected_goals_per_90, p.expected_goals);
        p.expected_assists_per_90 = per90(p.expected_assists_per_90, p.expected_assists);
        p.expected_goals_conceded_per_90 = per90(p.expected_goals_conceded_per_90, p.expected_goals_conceded);
        p.saves_per_90 = per90(p.saves_per_90, p.saves);

        p.ict_index_per90 = mins > 0 ? (parseFloat(p.ict_index) || 0) / mins90 : 0;
        p.bonus_per90 = mins > 0 ? (p.bonus || 0) / mins90 : 0;
        p.influence_per90 = mins > 0 ? (parseFloat(p.influence) || 0) / mins90 : 0;
        p.creativity_per90 = mins > 0 ? (parseFloat(p.creativity) || 0) / mins90 : 0;
        p.threat_per90 = mins > 0 ? (parseFloat(p.threat) || 0) / mins90 : 0;
        p.goals_conceded_per90 = per90(p.goals_conceded_per_90, p.goals_conceded);
        p.clean_sheets_per90 = per90(p.clean_sheets_per_90, p.clean_sheets);
        p.def_contrib_per90 = p.defensive_contribution_per_90 || 0; // Alias for consistent naming

        // calculateAdvancedScores looks these up with an underscore before the 90.
        // Without the aliases they resolved to undefined, silently zeroing the
        // quality term of draft_score and breaking the goalkeeper matrix.
        p.creativity_per_90 = p.creativity_per90;
        p.threat_per_90 = p.threat_per90;
        p.clean_sheets_per_90 = p.clean_sheets_per90;
        p.influence_per_90 = p.influence_per90;
        p.goals_conceded_per_90 = p.goals_conceded_per90;

        p.net_transfers_event = (p.transfers_in_event || 0) - (p.transfers_out_event || 0);
        p.xDiff = ((p.goals_scored || 0) + (p.assists || 0)) - (parseFloat(p.expected_goal_involvements) || 0);
        // Guarded: this mutates in place, so running preprocess twice over the
        // same objects would divide the price again.
        if (!p.__costScaled) {
            p.now_cost = p.now_cost / 10;
            p.__costScaled = true;
        }
        p.team_name = state.teamsData[p.team] ? state.teamsData[p.team].name : 'Unknown';
        p.position_name = getPositionName(p.element_type);

        // --- AUTOMATED SET PIECES (API 2025) ---
        // Replacing manual 'setPieceTakers' config with direct API data
        // API provides: penalties_order, direct_freekicks_order, corners_and_indirect_freekicks_order
        // 1 = First choice, 2 = Second choice, etc. (null if not a taker)

        p.set_piece_priority = {
            penalty: p.penalties_order || 99,
            free_kick: p.direct_freekicks_order || 99,
            corner: p.corners_and_indirect_freekicks_order || 99,
        };

        // --- ENHANCED INJURY INTELLIGENCE ---
        // Using chance_of_playing_next_round for smarter status display
        // 100/null = Available (Green)
        // 75% = Slight Doubt (Yellow) - Valid Option
        // 50% = Doubtful (Orange) - Risky
        // 25% = Very Doubtful (Red) - Avoid
        // 0% = Injured/Suspended (Red) - Out

        p.availability_grade = 'available'; // Default
        const chance = p.chance_of_playing_next_round;

        if (chance === 0) p.availability_grade = 'out';
        else if (chance === 25) p.availability_grade = 'avoid';
        else if (chance === 50) p.availability_grade = 'risky';
        else if (chance === 75) p.availability_grade = 'flagged'; // But valid

        // Enrich news with timestamp if available (API: news_added)
        if (p.news && p.news_added) {
            const newsDate = new Date(p.news_added);
            const today = new Date();
            const diffDays = Math.floor((today - newsDate) / (1000 * 60 * 60 * 24));
            p.news_age_days = diffDays; // Can be used for "New!" badge
        }

        p.points_per_game_90 = p.minutes > 0 ? (p.total_points / mins90) : 0;
        p.goals_scored_assists = (p.goals_scored || 0) + (p.assists || 0);
        p.expected_goals_assists = parseFloat(p.expected_goal_involvements) || 0;

        // --- NEW METRICS 2025 ---
        // 1. Smart FDR (Next 3 Games Difficulty)
        // Requires 'fixtures' data which is now in state.allPlayersData[source].fixtures
        // We need to calculate it outside or pass fixtures here. 
        // For now, we'll initialize it to 0 and calculate in a separate pass if fixtures are available.
        p.next_3_fdr = 0;

        // 2. Defensive Workrate Badge (CBIT per 90)
        // High workrate for MIDs (important for new BPS)
        // Threshold: Top 20% estimated (~ 0.8 per 90 for MIDs)
        const cbitPer90 = p.defensive_contribution_per_90 || 0;
        p.is_defensive_workhorse = false;
        if (p.element_type === 3 && cbitPer90 > 0.8) p.is_defensive_workhorse = true; // High workrate MID
        if (p.element_type === 4 && cbitPer90 > 0.4) p.is_defensive_workhorse = true; // High workrate FWD (rare)

        return p;
    });
}

function calculateRealFDR(players, fixtures) {
    console.log('📊 Calculating FDR for next 3 games...');

    // A flaky public proxy can return an error object or HTML instead of the
    // fixture array. Losing the FDR column is acceptable; failing the entire
    // data load over it is not.
    if (!Array.isArray(fixtures)) {
        console.warn('⚠️ Fixtures unavailable or malformed — skipping FDR', fixtures);
        return players;
    }

    // Group fixtures by team
    const teamFixtures = {};
    const nextGameweek = fixtures.find(f => !f.finished && f.event)?.event || SEASON_CONFIG.totalGameweeks;

    // Pre-process fixtures to map by team
    fixtures.forEach(f => {
        if (f.event < nextGameweek) return; // Skip past

        // Home Team
        if (!teamFixtures[f.team_h]) teamFixtures[f.team_h] = [];
        teamFixtures[f.team_h].push({ event: f.event, difficulty: f.team_h_difficulty, opponent: f.team_a, isHome: true });

        // Away Team
        if (!teamFixtures[f.team_a]) teamFixtures[f.team_a] = [];
        teamFixtures[f.team_a].push({ event: f.event, difficulty: f.team_a_difficulty, opponent: f.team_h, isHome: false });
    });

    // Sort fixtures by event for each team
    Object.keys(teamFixtures).forEach(teamId => {
        teamFixtures[teamId].sort((a, b) => a.event - b.event);
    });

    return players.map(p => {
        const teamNextFixtures = teamFixtures[p.team] || [];
        const next3 = teamNextFixtures.slice(0, 3);

        if (next3.length === 0) {
            p.next_3_fdr = 0;
            p.next_3_fdr_grade = 'unknown';
            return p;
        }

        const avgDifficulty = next3.reduce((sum, f) => sum + f.difficulty, 0) / next3.length;
        p.next_3_fdr = Math.round(avgDifficulty * 10) / 10;

        // Grade: 1-2 (Easy/Green), 3 (Medium/Gray), 4-5 (Hard/Red)
        if (avgDifficulty <= 2.3) p.next_3_fdr_grade = 'easy';
        else if (avgDifficulty >= 4) p.next_3_fdr_grade = 'hard';
        else p.next_3_fdr_grade = 'medium';

        return p;
    });
}


function setupEventListeners() {
    ['searchName', 'priceRange', 'minPoints', 'minMinutes'].forEach(id => document.getElementById(id).addEventListener('keyup', processChange));
    ['positionFilter', 'teamFilter', 'xDiffFilter', 'showEntries'].forEach(id => document.getElementById(id).addEventListener('change', processChange));
    setupTableSorting();
}

function initializeTooltips() {
    const tooltipEl = document.getElementById('tooltip');

    document.body.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-tooltip]');
        if (!target) return;

        tooltipEl.textContent = target.dataset.tooltip;
        tooltipEl.style.display = 'block';
        tooltipEl.classList.add('visible');

        const rect = target.getBoundingClientRect();
        tooltipEl.style.left = `${rect.left + window.scrollX + (rect.width / 2) - (tooltipEl.offsetWidth / 2)}px`;
        tooltipEl.style.top = `${rect.top + window.scrollY - tooltipEl.offsetHeight - 5}px`;
    });

    document.body.addEventListener('mouseout', (e) => {
        if (e.target.closest('[data-tooltip]')) {
            tooltipEl.classList.remove('visible');
        }
    });
}

function populateTeamFilter() {
    const teamFilter = document.getElementById('teamFilter');
    teamFilter.innerHTML = '<option value="">כל הקבוצות</option>';
    if (!state.allPlayersData[state.currentDataSource].processed) return;

    const draftTeamFilterGroup = document.querySelector('#teamFilter').parentNode;
    let draftTeamFilter = document.getElementById('draftTeamFilter');
    if (!draftTeamFilter) {
        draftTeamFilter = document.createElement('select');
        draftTeamFilter.id = 'draftTeamFilter';
        draftTeamFilter.onchange = processChange;

        const draftLabel = document.createElement('label');
        draftLabel.textContent = '🛡️ קבוצת דראפט:';

        const draftGroup = document.createElement('div');
        draftGroup.className = 'filter-group';
        draftGroup.appendChild(draftLabel);
        draftGroup.appendChild(draftTeamFilter);

        draftTeamFilterGroup.parentNode.insertBefore(draftGroup, draftTeamFilterGroup.nextSibling);
    }

    draftTeamFilter.innerHTML = '<option value="">כל השחקנים</option><option value="free_agents">שחקנים חופשיים</option>';
    if (state.draft.details && state.draft.details.league_entries) {
        state.draft.details.league_entries.forEach(entry => {
            if (entry.entry_name) {
                const option = document.createElement('option');
                option.value = entry.id;
                option.textContent = entry.entry_name;
                draftTeamFilter.appendChild(option);
            }
        });
    }

    const uniqueTeams = [...new Set(state.allPlayersData[state.currentDataSource].processed.map(p => p.team_name))].sort();
    uniqueTeams.forEach(team => {
        const option = document.createElement('option');
        option.value = team;
        option.textContent = team;
        teamFilter.appendChild(option);
    });
}

function getPercentileClass(value, values, reversed = false) {
    // values = array of all values for this metric in displayed players
    if (values.length < 3) return 'percentile-middle';

    const sorted = [...values].sort((a, b) => a - b);
    const p33 = sorted[Math.floor(sorted.length * 0.33)];
    const p67 = sorted[Math.floor(sorted.length * 0.67)];

    if (reversed) {
        // For metrics where lower is better (e.g., goals_conceded)
        if (value <= p33) return 'percentile-high';  // green
        if (value >= p67) return 'percentile-low';   // red
        return 'percentile-middle';                  // gray
    } else {
        // For metrics where higher is better
        if (value >= p67) return 'percentile-high';  // green
        if (value <= p33) return 'percentile-low';   // red
        return 'percentile-middle';                  // gray
    }
}

/* ==========================================================================
   SCOUTING VIEW
   Watchlist, signal badges, and per-gameweek trend cells. The trend data is
   free: getGameweekPoints() already caches the full `stats` object per player
   per gameweek in localStorage, so nothing new is fetched from the API.
   ========================================================================== */

const WATCHLIST_KEY = 'fpl_watchlist';
// Micro-charts cost ~5 DOM nodes per cell. Past this many rows the trend cells
// keep the number and the delta but drop the bars, so "הצג: הכל" stays usable.
const TREND_BAR_ROW_LIMIT = 50;

function loadWatchlist() {
    try {
        const raw = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || '[]');
        // Element ids start at 1. Number(null) is 0 and Number.isFinite(0) is
        // true, so a plain finite check silently admitted a phantom id 0.
        state.watchlist = new Set(raw.map(Number).filter(n => Number.isInteger(n) && n > 0));
    } catch (e) {
        console.warn('watchlist: unreadable, starting empty', e);
        state.watchlist = new Set();
    }
    return state.watchlist;
}

function saveWatchlist() {
    try {
        localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...state.watchlist]));
    } catch (e) { console.warn('watchlist: could not save', e); }
}

function toggleWatch(playerId, ev) {
    if (ev) ev.stopPropagation();
    const id = Number(playerId);
    if (state.watchlist.has(id)) state.watchlist.delete(id); else state.watchlist.add(id);
    saveWatchlist();
    // Only re-filter when the watchlist filter is on; otherwise repaint so the
    // star flips without rebuilding the dataset.
    if (state.watchlistOnly) processChange();
    else { renderTable(); updateScoutingUi(); }
}

function toggleWatchlistOnly() {
    state.watchlistOnly = !state.watchlistOnly;
    processChange();
}

function setRowMode(mode) {
    state.rowMode = mode === 'compact' ? 'compact' : 'trend';
    // An explicit choice outranks the phone default for the rest of the session.
    state._rowModeChosen = true;
    applyRowMode();
    renderTable();
    updateScoutingUi();
}

/** Show/hide the trend columns and set the row-height class on the table. */
function applyRowMode() {
    const table = document.getElementById('playersTable');
    if (!table) return;
    // One class on the table; CSS hides `.trend-col` in compact mode. Setting
    // `hidden` on each cell from here instead would only ever reach the cells
    // that already exist — the rows are rebuilt after this runs, so the new
    // ones kept their trend cells while the headers stayed hidden, and the
    // columns drifted out of alignment.
    table.classList.toggle('trend-mode', state.rowMode === 'trend');
}

/**
 * The expanded row spans the table's full scroll width, so its panel is sized
 * to the visible part of the scroll container instead and pinned there by CSS.
 * Without this the recommendation column sat ~900px off-screen.
 */
function syncDetailWidth() {
    const container = document.querySelector('#mainTableView .table-container');
    if (!container) return;
    container.style.setProperty('--detail-width', `${container.clientWidth}px`);
}

window.addEventListener('resize', syncDetailWidth);

/** True on phone-sized screens — the same breakpoint mobile.css uses. */
function isNarrowScreen() {
    return window.matchMedia('(max-width: 768px)').matches;
}

/**
 * Phones open on the data, not on a screenful of dropdowns. The filter panel is
 * a <details open> so that desktop and no-JS both get it expanded; this closes
 * it on small screens, and only before the user has touched it.
 */
function applyMobileDefaults() {
    const panel = document.getElementById('filtersPanel');
    if (panel && !panel.dataset.userToggled) {
        panel.open = !isNarrowScreen();
        panel.addEventListener('toggle', () => { panel.dataset.userToggled = '1'; }, { once: true });
    }
    // Two micro-charts per row are unreadable at 390px and cost the width the
    // real columns need.
    if (isNarrowScreen() && state.rowMode === 'trend' && !state._rowModeChosen) {
        state.rowMode = 'compact';
    }
}

function updateScoutingUi() {
    const count = document.getElementById('watchlistCount');
    if (count) count.textContent = state.watchlist.size;
    const only = document.getElementById('watchlistOnlyBtn');
    if (only) only.setAttribute('aria-pressed', String(state.watchlistOnly));
    document.querySelectorAll('[data-row-mode]').forEach(btn => {
        btn.setAttribute('aria-pressed', String(btn.dataset.rowMode === state.rowMode));
    });
    const win = document.getElementById('trendWindowSelect');
    if (win) win.value = String(state.trendWindow);
}

/* ---------------------------- signal badges ------------------------------ */

/**
 * One headline verdict per player, with the numbers that earned it.
 * Ordered: the first match wins, so "unavailable" always beats "great form".
 * Every rule reads fields that preprocessPlayerData already computes.
 */
/**
 * How lopsided the recent points haul is: the share contributed by the single
 * best gameweek in the window. One 15-point return inside five games is
 * variance; the same total spread evenly is a level of performance.
 * Returns null when the gameweek window has not loaded yet.
 */
function pointsConcentration(player) {
    if (!state.trendGws.length) return null;
    const values = getTrendSeries(player.id, 'pts', 'recent').map(pt => pt.value);
    const total = values.reduce((a, b) => a + b, 0);
    if (total <= 0) return null;
    return Math.max(...values) / total;
}

/**
 * One headline verdict per player, with the numbers that earned it.
 * Ordered: the first match wins, so "unavailable" always beats "great form".
 *
 * On out-performing xG: scoring more than the model expects is not proof of
 * luck. A striker who converts half-chances is doing something real, and over a
 * full season of minutes that repeats. So the verdict splits in two — sustained
 * over-conversion with genuine volume reads as finishing ability (יעיל), while
 * a surplus built on thin underlying numbers or one big haul reads as a warning.
 */
const SIGNAL_RULES = [
    {
        key: 'out', label: 'לא זמין', tone: 'bad',
        test: p => p.availability_grade && p.availability_grade !== 'available',
        why: p => [p.chance_of_playing_next_round !== null && p.chance_of_playing_next_round < 100
            ? `סיכוי ${p.chance_of_playing_next_round}% לשחק במחזור הקרוב`
            : 'פציעה או הרחקה — לא לסמוך עליו למחזור הקרוב']
    },
    {
        key: 'clinical', label: 'יעיל', tone: 'clinical',
        test: p => p.xDiff >= 1.5 && p.minutes >= 900 && (parseFloat(p.xGI_per90) || 0) >= 0.35
            && (pointsConcentration(p) === null || pointsConcentration(p) < 0.5),
        why: p => [`מסיים טוב יותר מהצפוי, ובאופן עקבי לאורך ${Math.round(p.minutes / 90)} משחקים`]
    },
    {
        key: 'overperf', label: 'מימוש יתר', tone: 'bad',
        test: p => {
            if (p.xDiff < 1.5 || p.minutes < 270) return false;
            const thin = (parseFloat(p.xGI_per90) || 0) < 0.30;
            const conc = pointsConcentration(p);
            return thin || (conc !== null && conc >= 0.5);
        },
        why: p => {
            const conc = pointsConcentration(p);
            return [conc !== null && conc >= 0.5
                ? 'כמעט כל הנקודות שלו הגיעו ממחזור אחד — לא צפוי לחזור'
                : 'הנקודות שלו גבוהות ממה שהביצועים מצדיקים — צפוי לרדת'];
        }
    },
    {
        key: 'sell', label: 'למכור גבוה', tone: 'warn',
        test: p => p.xDiff >= 2 && p.next_3_fdr >= 3.4,
        why: p => ['הערך שלו בשיא ולו״ז קשה מחכה — הזמן להציע אותו בטרייד']
    },
    {
        key: 'buylow', label: 'קנייה בזול', tone: 'info',
        test: p => p.xDiff <= -1.5 && p.minutes >= 360,
        why: p => ['מגיע להזדמנויות אבל הנקודות לא באו — בדרך כלל זה מתיישר']
    },
    {
        key: 'claim', label: 'קח עכשיו', tone: 'good',
        // ownedElementIds is what the "שחקנים חופשיים" filter tests, so the verdict
        // and the filter cannot disagree about who is available. The roster walk it
        // used before could say "free" for a player the filter had already excluded.
        test: p => state.draft.ownedElementIds.size > 0 && !state.draft.ownedElementIds.has(p.id)
            && p.draft_score >= 45 && p.minutes >= 270,
        why: p => [p.set_piece_priority && p.set_piece_priority.penalty === 1
            ? 'חופשי, בועט את הפנדלים, ובאיכות של שחקן הרכב'
            : 'חופשי, ובאיכות של שחקן שפותח אצל רוב הקבוצות בליגה']
    },
    {
        key: 'swing', label: 'לו״ז מתהפך', tone: 'plum',
        test: p => p.next_3_fdr > 0 && p.next_3_fdr <= 2.4 && p.minutes >= 270,
        why: p => ['שלושת המשחקים הבאים שלו מהקלים בליגה']
    },
    {
        key: 'rotation', label: 'סיכון סיבוב', tone: 'warn',
        test: p => Number.isFinite(p.rotation_risk) && p.rotation_risk < 0.6 && p.minutes >= 180,
        why: p => [`לא מובטח בהרכב — פתח רק ב-${Math.round(p.rotation_risk * 100)}% מהמשחקים`]
    }
];

const HOLD_SIGNAL = { key: 'hold', label: 'ניטרלי', tone: 'muted', why: [] };

/**
 * Cached per player. Every rule reads fields that only change when the data is
 * reprocessed or the draft rosters arrive, so `invalidateSignals()` is called
 * from those two places rather than recomputing on every sort and render.
 */
const _signalCache = new Map();
function invalidateSignals() { _signalCache.clear(); }

function signalFor(player) {
    const hit = _signalCache.get(player.id);
    if (hit) return hit;

    let result = HOLD_SIGNAL;
    for (const rule of SIGNAL_RULES) {
        let matched = false;
        try { matched = !!rule.test(player); } catch (e) { matched = false; }
        if (!matched) continue;
        let why = [];
        try { why = (rule.why(player) || []).filter(Boolean).slice(0, 1); } catch (e) { why = []; }
        result = { key: rule.key, label: rule.label, tone: rule.tone, why };
        break;
    }
    _signalCache.set(player.id, result);
    return result;
}

/** Rank used when sorting by the סיגנל column: actionable buckets first. */
const SIGNAL_SORT_ORDER = ['claim', 'buylow', 'swing', 'clinical', 'hold',
    'rotation', 'sell', 'overperf', 'out'];
function signalRank(player) {
    const i = SIGNAL_SORT_ORDER.indexOf(signalFor(player).key);
    return i < 0 ? SIGNAL_SORT_ORDER.length : i;
}

/**
 * Fills the סיגנל filter from the rules themselves, in the same order the column
 * sorts, so adding a rule to SIGNAL_RULES also adds it to the filter and neither
 * can drift from the other.
 */
function populateSignalFilter() {
    const select = document.getElementById('signalFilter');
    if (!select) return;
    const byKey = new Map([...SIGNAL_RULES, HOLD_SIGNAL].map(r => [r.key, r]));
    const options = SIGNAL_SORT_ORDER
        .map(key => byKey.get(key))
        .filter(Boolean)
        .map(r => `<option value="${r.key}">${r.label}</option>`)
        .join('');
    select.innerHTML = `<option value="">כל הסיגנלים</option>${options}`;
}

/* ------------------------- per-gameweek trends --------------------------- */

const gwNum = v => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
};

/** Official DEFCON for a single gameweek, mirroring preprocessPlayerData. */
function gwDefensiveContribution(stats, elementType) {
    if (stats.defensive_contribution !== undefined && stats.defensive_contribution !== null) {
        return gwNum(stats.defensive_contribution);
    }
    return gwNum(stats.clearances_blocks_interceptions) + gwNum(stats.tackles) +
        (elementType === 3 || elementType === 4 ? gwNum(stats.recoveries) : 0);
}

/**
 * The metrics that get a micro-chart. `agg` is how the window is summarised:
 * 'sum' for things that accumulate (points, xGI), 'avg' for rates (minutes).
 */
const TREND_METRICS = {
    pts: {
        label: 'נק׳', agg: 'sum', fmt: v => v.toFixed(0), unit: '',
        read: s => gwNum(s.total_points)
    },
    // Sits directly above xG+xA in the expanded row: what he actually produced,
    // against what the chances were worth.
    ga: {
        label: 'G+A', agg: 'sum', fmt: v => v.toFixed(0), unit: '',
        read: s => gwNum(s.goals_scored) + gwNum(s.assists)
    },
    xgi: {
        label: 'xG+xA', agg: 'sum', fmt: v => v.toFixed(2), unit: '', showTotal: false,
        // One decimal above a 13px bar; two collide with the neighbour.
        barFmt: v => v.toFixed(1),
        read: s => gwNum(s.expected_goals) + gwNum(s.expected_assists)
    },
    mins: {
        label: 'דקות', agg: 'avg', fmt: v => v.toFixed(0), unit: 'ממוצע',
        read: s => gwNum(s.minutes)
    },
    dc: {
        label: 'DC', agg: 'avg', fmt: v => v.toFixed(1), unit: 'ממוצע', barFmt: v => v.toFixed(0),
        read: (s, p) => gwDefensiveContribution(s, p.element_type)
    },
    bps: {
        label: 'BPS', agg: 'avg', fmt: v => v.toFixed(0), unit: 'ממוצע',
        read: s => gwNum(s.bps)
    },
    saves: {
        label: 'הצלות', agg: 'avg', fmt: v => v.toFixed(1), unit: 'ממוצע', barFmt: v => v.toFixed(0),
        read: s => gwNum(s.saves)
    }
};

/** The fourth trend column depends on what the position is scored for. */
function fourthTrendMetric(player) {
    if (player.element_type === 1) return 'saves';
    if (player.element_type === 2) return 'dc';
    return 'bps';
}

/**
 * Load the last 2*n completed gameweeks: the recent n drive the bars, the n
 * before them give the delta something honest to compare against.
 *
 * Two sources, same output shape:
 *  - completed season (the snapshot) -> read straight out of the committed
 *    per-match logs. No network, and it is the only history that exists on
 *    draft day, when the new season has not played a single gameweek.
 *  - live season -> getGameweekPoints(), which is localStorage-cached, so this
 *    is one round of fetches per season rather than one per render.
 */
/**
 * Per-appearance log for one player out of the committed season snapshot.
 *
 * `gwLogs` is columnar: one flat array per player, `logStride` numbers per
 * appearance, named by `logFields`. Reading the stride and the field names out
 * of the file rather than hardcoding them is what lets an older snapshot with a
 * shorter layout keep decoding — a field the file never had reads as 0 instead
 * of silently picking up the next appearance's numbers.
 */
function getMatchLog(player) {
    const snap = state.allPlayersData[state.currentDataSource]?.raw?.__snapshot;
    if (!snap || !snap.gwLogs) return [];
    const flat = snap.gwLogs[player.id] || snap.gwLogs[String(player.id)];
    if (!flat || !flat.length) return [];

    const fields = snap.logFields || ['gw', 'points', 'minutes', 'xgi_x100', 'defcon_hit'];
    const stride = snap.logStride || fields.length;
    const at = (entry, name) => {
        const i = fields.indexOf(name);
        return i < 0 || i >= entry.length ? 0 : gwNum(entry[i]);
    };

    const log = [];
    for (let i = 0; i + stride <= flat.length; i += stride) {
        const e = flat.slice(i, i + stride);
        log.push({
            gw: at(e, 'gw'),
            points: at(e, 'points'),
            minutes: at(e, 'minutes'),
            // Stored as an integer percentage of a goal involvement to keep the
            // file small; 55 means 0.55 xGI.
            xgi: at(e, 'xgi_x100') / 100,
            defconHit: at(e, 'defcon_hit'),
            bps: at(e, 'bps'),
            saves: at(e, 'saves'),
            defcon: at(e, 'defcon'),
            goals: at(e, 'goals'),
            assists: at(e, 'assists'),
            bonus: at(e, 'bonus')
        });
    }
    // The builder writes in file order; the app always reads oldest first.
    return log.sort((a, b) => a.gw - b.gw);
}

/**
 * Reshape the snapshot's per-player logs into the same
 * `[{ gw, stats: Map(playerId -> gwStats) }]` shape the live gameweek fetches
 * produce, so everything downstream is source-agnostic.
 *
 * A player who did not appear in a gameweek is simply absent from that map.
 * Inserting a zero row would make "did not play" indistinguishable from "played
 * and did nothing", and would drag every average down.
 */
function snapshotGameweekStats() {
    const players = state.allPlayersData[state.currentDataSource]?.processed || [];
    const byGw = new Map();

    players.forEach(p => {
        getMatchLog(p).forEach(m => {
            if (!byGw.has(m.gw)) byGw.set(m.gw, new Map());
            // Split the combined xGI back into halves that add to it exactly.
            const half = m.xgi / 2;
            byGw.get(m.gw).set(p.id, {
                total_points: m.points,
                minutes: m.minutes,
                expected_goals: half,
                expected_assists: half,
                bps: m.bps,
                bonus: m.bonus,
                saves: m.saves,
                goals_scored: m.goals,
                assists: m.assists,
                defensive_contribution: m.defcon
            });
        });
    });

    return [...byGw.keys()].sort((a, b) => a - b).map(gw => ({ gw, stats: byGw.get(gw) }));
}

async function ensureTrendWindow(n = state.trendWindow) {
    const source = state.currentDataSource;

    // --- completed-season snapshot -------------------------------------
    if (state.allPlayersData[source]?.raw?.__snapshot) {
        const all = snapshotGameweekStats();
        if (!all.length) return state.trendGws;
        const recent = all.slice(-n);
        const prev = all.slice(Math.max(0, all.length - 2 * n), all.length - n);
        const wanted = `${source}:${[...prev, ...recent].map(t => t.gw).join(',')}`;
        if (state.trendKey === wanted) return state.trendGws;
        state.trendPrevGws = prev;
        state.trendGws = recent;
        state.trendKey = wanted;
        computeTrendScales();
        return state.trendGws;
    }

    // --- live season ----------------------------------------------------
    const completed = getCompletedGWCount();
    if (!completed) return state.trendGws;

    const recent = [];
    for (let gw = Math.max(1, completed - n + 1); gw <= completed; gw++) recent.push(gw);
    const prev = [];
    for (let gw = Math.max(1, completed - 2 * n + 1); gw < recent[0]; gw++) prev.push(gw);

    const wanted = `${source}:${[...prev, ...recent].join(',')}`;
    if (state.trendKey === wanted) return state.trendGws;
    if (state.trendLoading) return state.trendGws;

    state.trendLoading = true;
    try {
        const all = [...prev, ...recent];
        const maps = await Promise.all(all.map(gw => getGameweekPoints(gw)));
        const loaded = all.map((gw, i) => ({ gw, stats: maps[i] })).filter(t => t.stats);
        state.trendPrevGws = loaded.filter(t => prev.includes(t.gw));
        state.trendGws = loaded.filter(t => recent.includes(t.gw));
        state.trendKey = loaded.length ? wanted : null;
        computeTrendScales();
    } catch (e) {
        console.warn('trends: could not load the gameweek window', e);
    } finally {
        state.trendLoading = false;
    }
    return state.trendGws;
}

/**
 * Bar heights are scaled to a league-wide ceiling (95th percentile of all
 * single-gameweek values in the window), not to each player's own maximum —
 * otherwise a player who scored 2,1,2,1,2 looks identical to one on 12,9,11,8,10.
 */
function computeTrendScales() {
    const players = (state.allPlayersData[state.currentDataSource].processed) || [];
    const byId = new Map(players.map(p => [p.id, p]));
    const scales = {};
    Object.entries(TREND_METRICS).forEach(([key, def]) => {
        const values = [];
        state.trendGws.forEach(({ stats }) => {
            stats.forEach((s, id) => {
                const p = byId.get(id);
                if (!p) return;
                const v = def.read(s, p);
                if (v > 0) values.push(v);
            });
        });
        if (!values.length) { scales[key] = 1; return; }
        values.sort((a, b) => a - b);
        scales[key] = values[Math.floor(values.length * 0.95)] || values[values.length - 1] || 1;
    });
    scales.mins = 90; // minutes have a real ceiling
    state.trendScales = scales;
}

/**
 * Player lookup by element id for the active season, rebuilt only when the
 * season changes. getTrendSeries is called a few thousand times per sort, and
 * a linear .find() inside it made sorting quadratic.
 */
let _trendPlayerIndex = { source: null, size: 0, byId: new Map() };
function trendPlayerIndex() {
    const source = state.currentDataSource;
    const players = (state.allPlayersData[source] && state.allPlayersData[source].processed) || [];
    if (_trendPlayerIndex.source !== source || _trendPlayerIndex.size !== players.length) {
        _trendPlayerIndex = { source, size: players.length, byId: new Map(players.map(p => [p.id, p])) };
    }
    return _trendPlayerIndex.byId;
}

/** Per-gameweek values for one player and metric, oldest first. */
function getTrendSeries(playerId, metricKey, window = 'recent') {
    const def = TREND_METRICS[metricKey];
    if (!def) return [];
    const gws = window === 'prev' ? (state.trendPrevGws || []) : state.trendGws;
    const player = trendPlayerIndex().get(Number(playerId)) || { element_type: 3 };
    return gws.map(({ gw, stats }) => {
        const s = stats.get(Number(playerId));
        return { gw, value: s ? def.read(s, player) : 0, played: !!s };
    });
}

function summariseTrend(series, agg) {
    if (!series.length) return 0;
    const total = series.reduce((sum, pt) => sum + pt.value, 0);
    return agg === 'avg' ? total / series.length : total;
}

/**
 * How much a metric moved between the previous window and the current one.
 * This is what the trend columns sort on: the column exists to answer "who is
 * climbing", and the raw level is already in the season columns beside it.
 * Cached per (player, metric) because sorting asks for it O(n log n) times and
 * the answer cannot change until the window is rebuilt.
 */
let _trendDeltaCache = { key: null, values: new Map() };
function trendDelta(player, metricKey) {
    const def = TREND_METRICS[metricKey];
    if (!def || !state.trendGws.length) return null;
    if (_trendDeltaCache.key !== state.trendKey) {
        _trendDeltaCache = { key: state.trendKey, values: new Map() };
    }
    const cacheKey = `${player.id}:${metricKey}`;
    if (_trendDeltaCache.values.has(cacheKey)) return _trendDeltaCache.values.get(cacheKey);

    const now = summariseTrend(getTrendSeries(player.id, metricKey, 'recent'), def.agg);
    const before = summariseTrend(getTrendSeries(player.id, metricKey, 'prev'), def.agg);
    // A player with no history in either window has no trend to rank, which is
    // different from a trend of zero — nulls sort to the bottom.
    const value = (now === 0 && before === 0) ? null : now - before;
    _trendDeltaCache.values.set(cacheKey, value);
    return value;
}

/**
 * The bar strip. `labels` prints each gameweek's own figure above its bar, which
 * is what turns a shape into something you can read a number off.
 */
function trendBarsHtml(series, scale, def, { labels = false, cls = '' } = {}) {
    return `<span class="trend-bars ${cls}" dir="ltr">` + series.map((pt, i) => {
        const h = Math.max(Math.min(pt.value / (scale || 1), 1) * 100, pt.played ? 8 : 0);
        const c = ['trend-bar'];
        if (i === series.length - 1) c.push('is-last');
        if (!pt.played || pt.value === 0) c.push('is-blank');
        return `<i class="${c.join(' ')}" style="height:${h.toFixed(0)}%"
            title="מחזור ${pt.gw}: ${def.fmt(pt.value)}">${
            labels ? `<b>${(def.barFmt || def.fmt)(pt.value)}</b>` : ''}</i>`;
    }).join('') + '</span>';
}


/** One trend cell: window figure, delta vs the previous window, and the bars. */
function trendCellHtml(player, metricKey, index) {
    const def = TREND_METRICS[metricKey];
    if (!def) return '<td class="trend-cell trend-col">–</td>';
    if (!state.trendGws.length) {
        return `<td class="trend-cell trend-col trend-empty" title="נתוני המחזורים נטענים">…</td>`;
    }

    const recent = getTrendSeries(player.id, metricKey, 'recent');
    const now = summariseTrend(recent, def.agg);
    const before = summariseTrend(getTrendSeries(player.id, metricKey, 'prev'), def.agg);
    const scale = (state.trendScales && state.trendScales[metricKey]) || 1;
    const bars = index < TREND_BAR_ROW_LIMIT
        ? trendBarsHtml(recent, scale, def, { labels: true })
        : '';

    // No delta chip here. "▼ 5 קודם 41" needs the reader to hold a second,
    // invisible five-gameweek window in their head; the bars show the direction
    // on their own, and the expanded row states the comparison under a heading
    // that names both windows.
    return `<td class="trend-cell trend-col" data-metric="${metricKey}"
        title="${def.fmt(now)} ב-${recent.length} המחזורים האחרונים · ${def.fmt(before)} ב-${recent.length} שלפניהם. לחיצה על השורה פותחת את הפירוט">
        <span class="trend-main">
            ${def.showTotal === false ? '' : `<span class="trend-value">${def.fmt(now)}</span>`}
            ${bars}
        </span>
    </td>`;
}

/* --------------------- expanded row: the match log ---------------------- */

/** Which finished fixture a team played in a given gameweek, if we know. */
function fixtureForGw(teamId, gw) {
    const fixtures = state.allPlayersData.live.fixtures || state.allPlayersData.historical.fixtures;
    if (!fixtures) return null;
    const fix = fixtures.find(f => f.event === gw && (f.team_h === teamId || f.team_a === teamId));
    if (!fix) return null;
    const home = fix.team_h === teamId;
    const oppId = home ? fix.team_a : fix.team_h;
    return {
        home,
        opponent: (state.teamsData[oppId] && state.teamsData[oppId].short_name) || '—',
        difficulty: home ? fix.team_h_difficulty : fix.team_a_difficulty
    };
}

function toggleRowDetail(playerId, ev) {
    if (ev) {
        // Never hijack a click meant for a control inside the row.
        const t = ev.target;
        if (t.closest('button, input, a, select, label')) return;
    }
    const id = Number(playerId);
    state.openRowId = state.openRowId === id ? null : id;
    renderTable();
}

/* ------------------- the three stat boxes in the detail row ---------------- */

const num1 = v => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
};
/** One stat line. `null` renders as an em dash rather than a misleading 0. */
const statLine = (label, value, hint) =>
    `<div class="box-row"${hint ? ` title="${escapeHtml(hint)}"` : ''}>
        <dt>${label}</dt><dd>${value === null || value === undefined ? '—' : value}</dd>
    </div>`;

const fmt = (v, d = 2) => (num1(v) === null ? null : num1(v).toFixed(d));
const pct = v => (num1(v) === null ? null : `${Math.round(num1(v))}%`);

/**
 * Attacking output: what the player creates and finishes, and how far his
 * returns have run ahead of or behind the underlying numbers.
 */
function boxAttack(p) {
    const ga = (p.goals_scored || 0) + (p.assists || 0);
    return `<div class="stat-box">
        <h5><span>⚽</span> תפוקה התקפית</h5>
        <dl>
            ${statLine('שערים / בישולים', `${p.goals_scored || 0} / ${p.assists || 0}`)}
            ${statLine('מעורבות', ga)}
            ${statLine('xG / 90', fmt(p.expected_goals_per_90), 'שערים צפויים לכל 90 דקות')}
            ${statLine('xA / 90', fmt(p.expected_assists_per_90), 'בישולים צפויים לכל 90 דקות')}
            ${statLine('xGI / 90', fmt(p.xGI_per90), 'מעורבות צפויה בשערים לכל 90 דקות')}
            ${statLine('xDiff', (num1(p.xDiff) === null ? null :
                `<span class="${p.xDiff >= 0 ? 'xdiff-positive' : 'xdiff-negative'}">${
                    p.xDiff > 0 ? '+' : ''}${num1(p.xDiff).toFixed(2)}</span>`),
                'ההפרש בין התפוקה בפועל לצפויה — חיובי = מימוש מעל הצפי')}
            ${statLine('ICT / 90', fmt(p.ict_index_per90, 1))}
            ${statLine('בונוס / 90', fmt(p.bonus_per90))}
        </dl>
    </div>`;
}

/**
 * Defence, goalkeeping and playing time — the half of the game the attacking
 * box ignores, and the one that decides whether a defender is worth a slot.
 */
function boxDefence(p) {
    const isGk = p.element_type === 1;
    return `<div class="stat-box">
        <h5><span>${isGk ? '🧤' : '🛡️'}</span> ${isGk ? 'שוער והגנה' : 'הגנה ודקות'}</h5>
        <dl>
            ${statLine('דקות', p.minutes)}
            ${statLine('הופעות', p.appearances ?? null)}
            ${statLine('אחוז הרכב', pct(num1(p.rotation_risk) === null ? null : p.rotation_risk * 100),
                'אחוז המשחקים שבהם פתח בהרכב')}
            ${isGk
                ? statLine('הצלות / 90', fmt(p.saves_per_90, 1))
                : statLine('DEFCON', p.defcon_hit_rate === null || p.defcon_hit_rate === undefined
                    ? null : `${num1(p.defcon_hit_rate).toFixed(0)}%`,
                    'אחוז המשחקים שבהם עבר את הסף לנקודות הגנה')}
            ${isGk
                ? statLine('פנדלים שעצר', p.penalties_saved ?? null)
                : statLine('DC / 90', fmt(p.def_contrib_per90, 1), 'תרומה הגנתית לכל 90 דקות')}
            ${statLine('שערים נקיים / 90', fmt(p.clean_sheets_per90))}
            ${statLine('xGC / 90', fmt(p.expected_goals_conceded_per_90),
                'שערים צפויים נגד לכל 90 דקות — ככל שנמוך יותר, סיכוי גבוה יותר לשער נקי')}
            ${statLine('כרטיסים', `${p.yellow_cards || 0}🟨 ${p.red_cards || 0}🟥`)}
        </dl>
    </div>`;
}

/**
 * What the player is worth in a draft: the league-relative numbers, the
 * schedule, and FPL's own projection next to ours as a sanity check.
 */
function boxValue(p) {
    const owner = getDraftTeamForPlayer(p.id);
    const sp = p.set_piece_priority || {};
    const pieces = [
        sp.penalty === 1 ? 'פנדלים' : null,
        sp.corner > 0 && sp.corner < 99 ? 'קרנות' : null,
        sp.free_kick > 0 && sp.free_kick < 99 ? 'חופשיות' : null
    ].filter(Boolean);
    return `<div class="stat-box">
        <h5><span>🎯</span> ערך לדראפט</h5>
        <dl>
            ${statLine('ציון דראפט', fmt(p.draft_score, 1))}
            ${statLine('VORP', formatVorp(p.vorp), 'עדיפות על השחקן החופשי הטוב ביותר באותה עמדה')}
            ${statLine('רמת החלפה', fmt(p.replacement_score, 2),
                'נק׳ למשחק של השחקן שהיה מחליף אותו')}
            ${statLine('חיזוי FPL הרשמי', fmt(p.ep_next, 1),
                'ep_next — החיזוי של FPL עצמה, כנקודת ייחוס לחיזוי שלנו')}
            ${statLine('קושי 3 קרובים', num1(p.next_3_fdr) ? num1(p.next_3_fdr).toFixed(1) : null)}
            ${statLine('נק׳ למשחק', fmt(p.points_per_game_90, 1))}
            ${statLine('בעלות', owner ? escapeHtml(owner) : '🆓 חופשי')}
            ${statLine('מצבים נייחים', pieces.length ? pieces.join(' · ') : null)}
        </dl>
    </div>`;
}

/**
 * The gameweek-by-gameweek log for one player: opponent, minutes, points and
 * the underlying numbers, newest last, plus the trends that do not earn a
 * permanent column in the table.
 */
function playerDetailRowHtml(player, colSpan) {
    const gws = state.trendGws;
    const extraKey = fourthTrendMetric(player);
    const signal = signalFor(player);
    const watched = state.watchlist.has(player.id);
    const owner = getDraftTeamForPlayer(player.id);

    // The match log, oldest gameweek first so it reads the same direction as the
    // bars in the summary beside it. The most recent row is marked, because that
    // is the one being asked about.
    const rows = gws.map(({ gw, stats }, idx) => {
        const s = stats.get(player.id);
        const fix = fixtureForGw(player.team, gw);
        const opp = fix
            ? `<span class="log-opp fdr-${fix.difficulty}">${fix.opponent}<em>${fix.home ? 'ב' : 'ח'}</em></span>`
            : '<span class="log-opp">—</span>';
        const last = idx === gws.length - 1 ? ' is-latest' : '';
        if (!s || gwNum(s.minutes) === 0) {
            return `<tr class="log-blank${last}"><th scope="row">${gw}</th><td>${opp}</td>
                <td class="log-none" colspan="3">לא שיחק</td></tr>`;
        }
        return `<tr class="${last}">
            <th scope="row">${gw}</th>
            <td>${opp}</td>
            <td class="log-num">${gwNum(s.minutes)}</td>
            <td class="log-num log-pts">${gwNum(s.total_points)}</td>
            <td class="log-num">${gwNum(s.goals_scored)}<span class="log-sep">/</span>${gwNum(s.assists)}</td>
        </tr>`;
    }).join('');

    // One labelled line per metric: name, figure, change, shape. The floating
    // unlabelled mini-charts were the part nobody could read.
    const summary = ['pts', 'ga', 'xgi', 'mins', extraKey]
        .filter((k, i, a) => a.indexOf(k) === i)
        .map(k => {
            const def = TREND_METRICS[k];
            const series = getTrendSeries(player.id, k, 'recent');
            const now = summariseTrend(series, def.agg);
            const scale = (state.trendScales && state.trendScales[k]) || 1;
            return `<div class="sum-row">
                <span class="sum-label">${def.label}</span>
                <span class="sum-val"><b>${def.fmt(now)}</b>${def.unit ? `<em>${def.unit}</em>` : ''}</span>
                ${trendBarsHtml(series, scale, def, { labels: true, cls: 'is-large' })}
            </div>`;
        }).join('');

    return `<tr class="detail-row" data-detail-for="${player.id}">
        <td colspan="${colSpan}">
            <div class="detail-card">
                <header class="detail-bar">
                    <span class="detail-who">${player.web_name}</span>
                    <span class="detail-tags">
                        <span class="detail-tag">${player.position_name}</span>
                        <span class="detail-tag">${player.team_name}</span>
                        <span class="detail-tag ${owner ? 'is-owned' : 'is-free'}">${owner || '🆓 חופשי'}</span>
                    </span>
                    <span class="signal-badge signal-${signal.tone}">${signal.label}</span>
                    ${signal.why.length ? `<span class="detail-reason">${signal.why.join(' · ')}</span>` : ''}
                    <span class="detail-spacer"></span>
                    <button class="detail-btn ${watched ? 'is-on' : ''}"
                        onclick="toggleWatch(${player.id}, event)">${watched ? '★ במעקב' : '☆ הוסף למעקב'}</button>
                    <button class="detail-btn is-plain" onclick="toggleRowDetail(${player.id})">סגור ✕</button>
                </header>

                <div class="detail-body">
                    <section class="detail-log">
                        <h4>${gws.length} המחזורים האחרונים</h4>
                        ${gws.length ? `<table class="match-log">
                            <thead><tr>
                                <th>מח׳</th><th>יריב</th><th>דק׳</th><th>נק׳</th><th>ש/ב</th>
                            </tr></thead>
                            <tbody>${rows}</tbody>
                        </table>` : '<p class="detail-note">נתוני המחזורים נטענים…</p>'}
                    </section>

                    <section class="detail-sum">
                        <h4>${state.trendWindow} המחזורים האחרונים <span class="h4-note">(לא כל העונה)</span></h4>
                        ${summary}
                        <div class="detail-next">
                            <span class="detail-next-label">המשחקים הבאים</span>
                            <span class="detail-fixtures">${generateFixturesHTML(player)}</span>
                        </div>
                    </section>

                    <section class="detail-boxes">
                        <h4 class="boxes-heading">כל העונה עד כה
                            <span class="h4-note">${Math.round((player.minutes || 0) / 90)} משחקים · ${player.minutes || 0} דקות</span></h4>
                        ${boxAttack(player)}
                        ${boxDefence(player)}
                        ${boxValue(player)}
                    </section>
                </div>
            </div>
        </td>
    </tr>`;
}

/**
 * A bare bar strip, no numbers — for tight spots like the draft-board rows.
 * Returns '' before the gameweek window has loaded so nothing jumps around.
 */
function miniSparkHtml(playerId, metricKey = 'pts') {
    if (!state.trendGws.length) return '';
    const def = TREND_METRICS[metricKey];
    const series = getTrendSeries(playerId, metricKey, 'recent');
    if (!series.length) return '';
    const scale = (state.trendScales && state.trendScales[metricKey]) || 1;
    return trendBarsHtml(series, scale, def, { cls: 'is-mini' });
}

function setTrendWindow(n) {
    state.trendWindow = parseInt(n, 10) || 5;
    state.trendGws = [];
    state.trendPrevGws = [];
    ensureTrendWindow().then(() => { renderTable(); updateScoutingUi(); });
}

/** Percentile baselines for the whole filtered league, computed once. */
function buildPercentileBase(rows) {
    return {
        draft_score: rows.map(p => p.draft_score),
        stability_index: rows.map(p => p.stability_index || 0),
        predicted_points_1_gw: rows.map(p => p.predicted_points_1_gw),
        total_points: rows.map(p => p.total_points),
        points_per_game_90: rows.map(p => p.points_per_game_90),
        selected_by_percent: rows.map(p => parseFloat(p.selected_by_percent)),
        dreamteam_count: rows.map(p => p.dreamteam_count),
        def_contrib_per90: rows.map(p => p.def_contrib_per90),
        goals_assists: rows.map(p => (p.goals_scored || 0) + (p.assists || 0)),
        xGI_per90: rows.map(p => parseFloat(p.xGI_per90) || 0),
        minutes: rows.map(p => p.minutes),
        ict_index_per90: rows.map(p => parseFloat(p.ict_index_per90) || 0),
        bonus_per90: rows.map(p => parseFloat(p.bonus_per90) || 0),
        clean_sheets_per90: rows.map(p => parseFloat(p.clean_sheets_per90) || 0)
    };
}

function createPlayerRowHtml(player, index) {
    // Percentiles are measured against the whole filtered league (set in
    // processChange before the top-N slice), so a top-20 view still shows a
    // top-20 player as elite rather than as merely average among his peers.
    const displayedValues = state.percentileBase && state.percentileBase.draft_score
        ? state.percentileBase
        : buildPercentileBase(state.displayedData);

    const signal = signalFor(player);
    const watched = state.watchlist.has(player.id);
    // Points beside what earned them. The second metric depends on the position
    // being filtered — see roleTrend() — because xG+xA is meaningless for a keeper.
    const trendKeys = ['pts', roleTrend().metric];

    const icons = generatePlayerIcons(player);
    const fixturesHTML = generateFixturesHTML(player);
    const isChecked = state.selectedForComparison.has(player.id) ? 'checked' : '';

    const draftTeam = getDraftTeamForPlayer(player.id);
    const draftTeamDisplay = draftTeam || '🆓 חופשי';
    const draftTeamClass = draftTeam ? 'draft-owned' : 'draft-free';

    // Badge Logic
    let nameBadges = icons.icons;
    if (player.is_defensive_workhorse) {
        nameBadges += '<span title="High Defensive Workrate (Bonus Points Magnet)">🛡️</span>';
    }

    // FDR Logic
    let fdrBadge = '<span class="fdr-badge" style="background-color:#e0e0e0; color:#333;">-</span>';
    if (player.next_3_fdr > 0) {
        const grade = player.next_3_fdr_grade || 'medium';
        let color = '#9e9e9e'; // medium (gray)
        let textColor = 'white';
        if (grade === 'easy') { color = '#4caf50'; } // green
        else if (grade === 'hard') { color = '#f44336'; } // red
        else { color = '#fbbf24'; textColor = 'black'; } // medium (yellowish)

        fdrBadge = `<div class="fdr-badge" style="background-color:${color}; color:${textColor}; padding:2px 6px; border-radius:4px; font-weight:bold; display:inline-block; min-width:30px; text-align:center;">${player.next_3_fdr.toFixed(1)}</div>`;
    }

    return `<tr class="player-row ${state.openRowId === player.id ? 'is-open' : ''}"
        data-player-id="${player.id}" onclick="toggleRowDetail(${player.id}, event)"
        title="לחיצה פותחת את המשחקים האחרונים">
        <td><input type="checkbox" class="player-select" data-player-id="${player.id}" ${isChecked}></td>
        <td class="rank-cell" title="דירוג במאגר הדראפט כולו, לפי ציון">${player.rank || index + 1}</td>
        <td class="name-cell">
            <div class="player-name-wrapper">
                <button class="watch-star ${watched ? 'is-on' : ''}" onclick="toggleWatch(${player.id}, event)"
                    aria-pressed="${watched}" title="${watched ? 'הסר מהמעקב' : 'הוסף למעקב'}">${watched ? '★' : '☆'}</button>
                <span class="player-name-icon">${nameBadges}</span>
                <span class="player-name-text">${player.web_name}</span>
                ${player.availability_grade !== 'available' ?
            `<span class="status-badge status-${player.availability_grade}" title="${player.news || 'Status'}">${player.chance_of_playing_next_round !== null ? player.chance_of_playing_next_round + '%' : '!'}</span>`
            : ''}
            </div>
        </td>
        <td>${player.position_name}</td>
        <td>${player.team_name}</td>
        <td class="${draftTeamClass}" title="${draftTeamDisplay}">${draftTeamDisplay}</td>
        <td class="bold-cell ${getPercentileClass(player.draft_score, displayedValues.draft_score)}">${player.draft_score.toFixed(1)}</td>
        <td class="bold-cell" data-tooltip="${config.columnTooltips.vorp}" style="color:${player.vorp > 0 ? '#059669' : player.vorp < 0 ? '#dc2626' : '#94a3b8'};">${formatVorp(player.vorp)}</td>
        <td class="${getPercentileClass(player.total_points, displayedValues.total_points)}">${player.total_points}</td>
        <td class="${getPercentileClass(player.points_per_game_90, displayedValues.points_per_game_90)}">${player.points_per_game_90.toFixed(1)}</td>
        <td class="transfers-cell" data-tooltip="${config.columnTooltips.net_transfers_event}"><span class="${player.net_transfers_event >= 0 ? 'net-transfers-positive' : 'net-transfers-negative'}">${player.net_transfers_event.toLocaleString()}</span></td>
        <td class="${getPercentileClass(parseFloat(player.selected_by_percent), displayedValues.selected_by_percent)}">${player.selected_by_percent}%</td>
        <td class="signal-cell">
            <span class="signal-badge signal-${signal.tone}">${signal.label}</span>
            ${signal.why.length ? `<span class="signal-why">${signal.why.map(w => `<span>${w}</span>`).join('')}</span>` : ''}
        </td>
        ${trendKeys.map(key => trendCellHtml(player, key, index)).join('')}
        <td data-tooltip="${config.columnTooltips.defcon_hit_rate}">${formatDefconRate(player.defcon_hit_rate)}</td>
        <td class="${getPercentileClass(player.def_contrib_per90, displayedValues.def_contrib_per90)}" data-tooltip="${config.columnTooltips.def_contrib_per90}">${player.def_contrib_per90.toFixed(1)}</td>
        <td class="${getPercentileClass(parseFloat(player.xGI_per90) || 0, displayedValues.xGI_per90)}">${(parseFloat(player.xGI_per90) || 0).toFixed(2)}</td>
        <td class="${getPercentileClass((player.goals_scored || 0) + (player.assists || 0), displayedValues.goals_assists)}">${(player.goals_scored || 0) + (player.assists || 0)}</td>
        <td class="fdr-cell">${fdrBadge}</td>
        <td class="fixtures-cell">${fixturesHTML}</td>
        <td class="bold-cell stability-cell ${getPercentileClass(player.stability_index || 0, displayedValues.stability_index)}">${(player.stability_index || 0).toFixed(0)}</td>
        <td class="${getPercentileClass(parseFloat(player.ict_index_per90) || 0, displayedValues.ict_index_per90)}">${(parseFloat(player.ict_index_per90) || 0).toFixed(1)}</td>
        <td class="${getPercentileClass(player.dreamteam_count, displayedValues.dreamteam_count)}">${player.dreamteam_count}</td>
        <td class="${player.xDiff >= 0 ? 'xdiff-positive' : 'xdiff-negative'}" data-tooltip="${config.columnTooltips.xDiff}">${player.xDiff.toFixed(2)}</td>
        <td data-tooltip="${config.columnTooltips.rotation_risk}">${formatRotation(player.rotation_risk)}</td>
        <td class="${getPercentileClass(player.minutes, displayedValues.minutes)}">${player.minutes}</td>
        <td class="${getPercentileClass(parseFloat(player.bonus_per90) || 0, displayedValues.bonus_per90)}">${(parseFloat(player.bonus_per90) || 0).toFixed(2)}</td>
        <td class="${getPercentileClass(parseFloat(player.clean_sheets_per90) || 0, displayedValues.clean_sheets_per90)}">${(parseFloat(player.clean_sheets_per90) || 0).toFixed(2)}</td>
        <td>${player.now_cost.toFixed(1)}</td>
        <td class="${player.set_piece_priority.penalty === 1 ? 'set-piece-yes' : 'set-piece-no'}">${player.set_piece_priority.penalty === 1 ? '🎯 (1)' : '–'}</td>
        <td class="${player.set_piece_priority.corner > 0 ? 'set-piece-yes' : 'set-piece-no'}">${player.set_piece_priority.corner > 0 ? `(${player.set_piece_priority.corner})` : '–'}</td>
        <td class="${player.set_piece_priority.free_kick > 0 ? 'set-piece-yes' : 'set-piece-no'}">${player.set_piece_priority.free_kick > 0 ? `(${player.set_piece_priority.free_kick})` : '–'}</td>
    </tr>`;
}

/**
 * On a narrow screen the expanded panel is pinned to the scroll port (mobile.css)
 * so it can be read without scrolling sideways through 35 columns. Its width has
 * to match that scroll port, and only the layout knows how wide it is — 100vw
 * overshoots by the page padding.
 */
function fitDetailPanel() {
    const cards = document.querySelectorAll('#playersTable .detail-card');
    if (!cards.length) return;
    const pinned = window.innerWidth <= 768;
    cards.forEach(card => {
        // Walk up from the card rather than matching a fixed id, so this keeps
        // working if the table ever moves inside the page.
        const wrap = card.closest('.table-container');
        card.style.width = pinned && wrap ? `${wrap.clientWidth}px` : '';
    });
}

window.addEventListener('resize', fitDetailPanel);

/* ==========================================================================
   OPTIONAL COLUMNS
   Presets replaced: hiding two thirds of the table by default reads as columns
   having been deleted. Every column is present; these six are the ones that
   crowd the row without being consulted often, so they start off and go back on
   with one click. The choice is remembered.
   ========================================================================== */

const OPTIONAL_COLUMNS = [
    { key: 'stability_index', label: 'יציבות' },
    { key: 'ict_index_per90', label: 'ICT/90' },
    { key: 'dreamteam_count', label: 'דרימטים' },
    { key: 'set_piece_priority.penalty', label: 'פנדל' },
    { key: 'set_piece_priority.corner', label: 'קרן' },
    { key: 'set_piece_priority.free_kick', label: 'חופשית' },
    { key: 'xDiff', label: 'xDiff' },
    { key: 'rotation_risk', label: 'הרכב' },
    { key: 'minutes', label: 'דקות' },
    { key: 'bonus_per90', label: 'בונוס/90' },
    { key: 'clean_sheets_per90', label: 'CS/90' },
    { key: 'now_cost', label: 'מחיר' }
];

const OPTIONAL_COLUMNS_KEY = 'fpl_optional_columns';

function loadOptionalColumns() {
    try {
        const raw = JSON.parse(localStorage.getItem(OPTIONAL_COLUMNS_KEY) || '[]');
        return new Set(raw.filter(k => OPTIONAL_COLUMNS.some(c => c.key === k)));
    } catch (e) { return new Set(); }
}

function toggleOptionalColumn(key) {
    if (state.shownOptional.has(key)) state.shownOptional.delete(key);
    else state.shownOptional.add(key);
    try {
        localStorage.setItem(OPTIONAL_COLUMNS_KEY, JSON.stringify([...state.shownOptional]));
    } catch (e) { /* private mode */ }
    updateRoleTrendHeader();
    applyOptionalColumns();
    fitDetailPanel();
}

/** Hide the switched-off optional columns, in the header and in every row. */
function applyOptionalColumns() {
    const heads = [...document.querySelectorAll('#playersTable > thead > tr > th')];
    if (!heads.length) return;

    const hide = new Set();
    heads.forEach((th, i) => {
        const key = th.dataset.sort;
        if (key && OPTIONAL_COLUMNS.some(c => c.key === key) && !state.shownOptional.has(key)) {
            hide.add(i);
        }
    });

    heads.forEach((th, i) => { th.hidden = hide.has(i); });
    document.querySelectorAll('#playersTable > tbody > tr.player-row').forEach(tr => {
        [...tr.children].forEach((td, i) => { td.hidden = hide.has(i); });
    });

    // The expanded row spans the table, so it follows the visible count.
    const span = heads.length - hide.size;
    document.querySelectorAll('#playersTable .detail-row > td').forEach(td => { td.colSpan = span; });

    const count = document.getElementById('colsCount');
    if (count) {
        count.textContent = state.shownOptional.size ? `+${state.shownOptional.size}` : '';
    }

    const host = document.getElementById('optionalCols');
    if (host) {
        host.innerHTML = OPTIONAL_COLUMNS.map(c => {
            const on = state.shownOptional.has(c.key);
            return `<button class="optional-chip" aria-pressed="${on}"
                onclick="event.stopPropagation();toggleOptionalColumn('${c.key}')"
                title="${on ? 'הסתר' : 'הצג'} את עמודת ${c.label}">${on ? '✓ ' : '+ '}${c.label}</button>`;
        }).join('');
    }
}

/**
 * The second trend column follows the position filter. xG+xA is a column of
 * zeros for a goalkeeper and near-zeros for a centre-back, while saves mean
 * nothing for a forward — so the column shows whatever the selected position is
 * actually scored on, and the header says which.
 */
const ROLE_TREND = {
    GKP: { metric: 'saves', head: 'הצלות לפי מחזור', title: 'הצלות בכל אחד מהמחזורים האחרונים — מה ששוער מרוויח עליו נקודות' },
    DEF: { metric: 'dc', head: 'DEFCON לפי מחזור', title: 'תרומה הגנתית (CBIT) בכל מחזור — הסף שמזכה מגן בנקודות' },
    def: { metric: 'xgi', head: 'xG+xA לפי מחזור', title: 'xG+xA בכל אחד מהמחזורים האחרונים — מה שהיה אמור לצאת לו. קרא אותה מול הנקודות' }
};

function roleTrend() {
    // Guarded for the unit tests, which render rows without a document.
    const el = typeof document !== 'undefined' ? document.getElementById('positionFilter') : null;
    const pos = el ? el.value : '';
    return ROLE_TREND[pos] || ROLE_TREND.def;
}

/** Keep the header honest about which metric the column is currently showing. */
function updateRoleTrendHeader() {
    const th = document.getElementById('trendRoleHeader');
    if (!th) return;
    const role = roleTrend();
    const label = th.querySelector('.trend-head-label');
    if (label) label.textContent = role.head;
    th.title = role.title;
}

function renderTable() {
    const columnMapping = config.tableColumns;

    // Sorting logic moved to processChange() - sort before limiting to 50

    const tbody = document.getElementById('playersTableBody');
    const colCount = document.querySelectorAll('#playersTable thead th').length || 28;

    if (!state.displayedData.length) {
        // An empty table with no explanation reads as a broken page. Say which
        // filter emptied it, or why the data for it does not exist yet.
        const reason = state.quickFilterNotice
            || 'לא נמצאו שחקנים התואמים לסינון הנוכחי';
        tbody.innerHTML = `<tr><td colspan="${colCount}" style="padding:26px; text-align:center; color:#475569;">
            <div style="font-size:14px; font-weight:700; margin-bottom:4px;">אין תוצאות</div>
            <div style="font-size:12.5px;">${reason}</div>
        </td></tr>`;
        renderDraftBoard();
        return;
    }

    applyRowMode();
    tbody.innerHTML = state.displayedData.map((player, index) => {
        const row = createPlayerRowHtml(player, index);
        return state.openRowId === player.id
            ? row + playerDetailRowHtml(player, colCount)
            : row;
    }).join('');
    applyOptionalColumns();
    fitDetailPanel();
    updateScoutingUi();
    syncDetailWidth();

    // The board follows the position filter, so it is rebuilt with the table.
    renderDraftBoard();

    document.querySelectorAll('.player-select').forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            const playerId = parseInt(this.dataset.playerId);
            if (this.checked) {
                state.selectedForComparison.add(playerId);
            } else {
                state.selectedForComparison.delete(playerId);
            }
        });
    });

    // Add tooltips to headers
    // Add tooltips to headers
    document.querySelectorAll('#playersTable thead th[data-sort]').forEach(th => {
        const key = th.dataset.sort;
        if (config.columnTooltips[key]) {
            th.dataset.tooltip = config.columnTooltips[key];
        }
    });
}

function getDraftTeamForPlayer(fplId) {
    // Check if player is owned by any team
    for (const [entryId, roster] of state.draft.rostersByEntryId.entries()) {
        if (roster.includes(fplId)) {
            return state.draft.entryIdToTeamName.get(entryId) || 'Unknown';
        }
    }
    return null; // Free agent
}

function generatePlayerIcons(p) {
    const i = [];
    if (p.set_piece_priority.penalty === 1) i.push(`🎯`);
    if (p.set_piece_priority.corner > 0) i.push(`⚽`);
    if (p.set_piece_priority.free_kick > 0) i.push(`👟`);
    if (parseFloat(p.selected_by_percent) < 5) i.push(`💎`);
    if (p.price_tier === 'Budget' && p.points_per_game_90 > 3.5) i.push(`💰`);
    if (p.minutes === 0) i.push(`🌟`);
    if (p.dreamteam_count > 0) i.push(`🏆`);
    return {
        icons: i.map(e => `<span class='player-name-icon'>${e}</span>`).join(""),
        tooltip: i.join(' ')
    };
}

function generateFixturesHTML(player) {
    const teamId = player.team;
    const fixtures = state.allPlayersData.live.fixtures || state.allPlayersData.historical.fixtures;
    if (!fixtures) return 'N/A';

    const teamFixtures = fixtures
        .filter(fix => (fix.team_a === teamId || fix.team_h === teamId) && !fix.finished)
        .sort((a, b) => a.event - b.event)
        .slice(0, 5)
        .map(fix => {
            const opponentId = fix.team_h === teamId ? fix.team_a : fix.team_h;
            const opponent = state.teamsData[opponentId] ? state.teamsData[opponentId].short_name : 'N/A';
            const is_home = fix.team_h === teamId;
            const difficulty = is_home ? fix.team_h_difficulty : fix.team_a_difficulty;
            return `<span class="fixture fdr-${difficulty}" title="${opponent} (${is_home ? 'H' : 'A'})">${opponent}(${is_home ? 'H' : 'A'})</span>`;
        }).join(' ');

    return teamFixtures;
}

function processChange() {
    if (!state.allPlayersData[state.currentDataSource].processed) return;

    // Cleared once, here, by the only function that can decide the table is
    // empty. It used to be cleared inside applyQuickFilter, which meant a notice
    // written by any other filter was wiped by a quick filter that ran later,
    // and a stale notice survived when no quick filter was active at all.
    state.quickFilterNotice = null;

    // ... filters ...
    const nameFilter = document.getElementById('searchName').value.toLowerCase();
    const posFilter = document.getElementById('positionFilter').value;
    const teamFilter = document.getElementById('teamFilter').value;
    const priceInput = document.getElementById('priceRange').value;
    const pointsInput = document.getElementById('minPoints').value;
    const minutesInput = document.getElementById('minMinutes').value;
    const xDiffFilter = document.getElementById('xDiffFilter').value;
    const showEntries = document.getElementById('showEntries').value;
    const draftTeamFilter = document.getElementById('draftTeamFilter') ? document.getElementById('draftTeamFilter').value : '';

    let minPrice = 0, maxPrice = 20;
    if (priceInput) {
        const p = priceInput.split('-');
        if (p.length === 2) {
            minPrice = parseFloat(p[0]) || 0;
            maxPrice = parseFloat(p[1]) || 20;
        } else {
            const s = parseFloat(priceInput);
            if (!isNaN(s)) minPrice = maxPrice = s;
        }
    }

    const minPoints = parseInt(pointsInput) || 0;
    const minMinutes = parseInt(minutesInput) || 0;
    const statsRange = document.getElementById('statsRange') ? document.getElementById('statsRange').value : 'all';

    // CORRECT APPROACH:
    // Always start from a clean source of truth if possible, OR map carefully.
    // In v3/Root, state.allPlayersData.processed is the source.
    // We should create `displaySource` which is either processed (all) or aggregated (range).

    let sourceData = state.allPlayersData[state.currentDataSource].processed.map(p => ({
        ...p,
        draft_team: getDraftTeamForPlayer(p.id) || '' // Ensure string for sorting (empty string if free agent)
    }));

    if (statsRange !== 'all') {
        const lastN = parseInt(statsRange);
        if (!state.aggregatedCache[lastN]) {
            calculateAggregatedStats(lastN).then(aggData => {
                state.aggregatedCache[lastN] = aggData;
                processChange();
            });
            return;
        }

        // Merge: Use Aggregated stats for dynamic fields, Original for static.
        // We create a map of Aggregated Data for fast lookup
        const aggMap = new Map(state.aggregatedCache[lastN].map(p => [p.id, p]));

        sourceData = sourceData.map(p => {
            const agg = aggMap.get(p.id);
            if (!agg) return p;
            return {
                ...p,
                ...agg, // Overwrite points, goals, etc.
                // Keep static
                now_cost: p.now_cost,
                selected_by_percent: p.selected_by_percent,
                net_transfers_event: p.net_transfers_event,
                transfers_in_event: p.transfers_in_event,
                transfers_out_event: p.transfers_out_event,
                web_name: p.web_name,
                team_name: p.team_name,
                position_name: p.position_name,
                draft_team: p.draft_team,
                id: p.id
            };
        });
    }

    let filteredData = sourceData.filter(p =>
        (!nameFilter || p.web_name.toLowerCase().includes(nameFilter)) &&
        (!posFilter || p.position_name === posFilter) &&
        (!teamFilter || p.team_name === teamFilter) &&
        (p.now_cost >= minPrice && p.now_cost <= maxPrice) &&
        p.total_points >= minPoints &&
        p.minutes >= minMinutes &&
        (xDiffFilter === '' || (xDiffFilter === 'positive' && p.xDiff > 0) || (xDiffFilter === 'negative' && p.xDiff < 0))
    );

    if (draftTeamFilter) {
        if (draftTeamFilter === 'free_agents') {
            filteredData = filteredData.filter(p => !state.draft.ownedElementIds.has(p.id));
        } else {
            const entryId = parseInt(draftTeamFilter);
            if (state.draft.rostersByEntryId.has(entryId)) {
                const teamPlayerIds = new Set(state.draft.rostersByEntryId.get(entryId));
                filteredData = filteredData.filter(p => teamPlayerIds.has(p.id));
            }
        }
    }

    // The סיגנל column is the most actionable thing in the table, and until now
    // the only way to use it was to sort by it and read. signalFor() is cached
    // per player, so this is a map lookup per row.
    const signalFilter = (document.getElementById('signalFilter') || {}).value || '';
    if (signalFilter) {
        filteredData = filteredData.filter(p => signalFor(p).key === signalFilter);
        if (!filteredData.length) {
            const rule = [...SIGNAL_RULES, HOLD_SIGNAL].find(r => r.key === signalFilter);
            state.quickFilterNotice = `אין שחקן עם הסיגנל "${rule ? rule.label : signalFilter}" בסינון הנוכחי`;
        }
    }

    if (state.watchlistOnly) {
        filteredData = filteredData.filter(p => state.watchlist.has(p.id));
        if (!filteredData.length) {
            state.quickFilterNotice = state.watchlist.size
                ? 'אף שחקן מרשימת המעקב לא עובר את הסינון הנוכחי'
                : 'רשימת המעקב ריקה — לחץ על ☆ ליד שם של שחקן';
        }
    }

    state.displayedData = filteredData;
    if (state.activeQuickFilterName) applyQuickFilter(state.activeQuickFilterName);

    // Sort BEFORE limiting to 50
    // Sort BEFORE limiting to 50
    if (state.sortKey) {
        state.displayedData.sort((a, b) => {
            let aValue, bValue;

            if (state.sortKey === 'net_transfers_event') {
                aValue = parseFloat(a.transfers_balance || a.net_transfers_event || 0);
                bValue = parseFloat(b.transfers_balance || b.net_transfers_event || 0);
            } else if (state.sortKey === 'goals_scored_assists') {
                aValue = (a.goals_scored || 0) + (a.assists || 0);
                bValue = (b.goals_scored || 0) + (b.assists || 0);
            } else if (state.sortKey === 'xGI_per90') {
                aValue = parseFloat(a.xGI_per90 || 0);
                bValue = parseFloat(b.xGI_per90 || 0);
            } else if (state.sortKey === 'signal_rank') {
                // Ascending rank = most actionable first, so invert to keep the
                // "desc" default meaning "show me the opportunities".
                aValue = -signalRank(a);
                bValue = -signalRank(b);
            } else if (state.sortKey === 'trend_pts' || state.sortKey === 'trend_role') {
                // Sort by the figure the cell prints. It used to sort by the
                // change against the previous window — a number that is no longer
                // shown, so the ordering looked arbitrary.
                const key = state.sortKey === 'trend_pts' ? 'pts' : roleTrend().metric;
                const total = p => summariseTrend(getTrendSeries(p.id, key, 'recent'), TREND_METRICS[key].agg);
                aValue = total(a);
                bValue = total(b);
            } else {
                aValue = getNestedValue(a, state.sortKey);
                bValue = getNestedValue(b, state.sortKey);
                // Convert numeric strings to numbers for proper sorting
                if (typeof aValue === 'string' && !isNaN(aValue) && aValue.trim() !== '') aValue = parseFloat(aValue);
                if (typeof bValue === 'string' && !isNaN(bValue) && bValue.trim() !== '') bValue = parseFloat(bValue);
            }

            // Treat sentinel values as "no data" — push to bottom
            // Set piece 99 = not a taker, next_3_fdr 0 = no fixture data
            const isSetPieceCol = state.sortKey.startsWith('set_piece_priority.');
            const isFdrCol = state.sortKey === 'next_3_fdr';
            const aNoData = aValue === null || aValue === undefined
                || (isSetPieceCol && aValue === 99)
                || (isFdrCol && aValue === 0);
            const bNoData = bValue === null || bValue === undefined
                || (isSetPieceCol && bValue === 99)
                || (isFdrCol && bValue === 0);
            const aNull = aNoData;
            const bNull = bNoData;
            if (aNull && bNull) return 0;
            if (aNull) return 1;
            if (bNull) return -1;

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return state.sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            } else {
                return state.sortDirection === 'asc'
                    ? String(aValue).localeCompare(String(bValue))
                    : String(bValue).localeCompare(String(aValue));
            }
        });
    }

    // Percentile colouring is calibrated on the whole filtered league, captured
    // here BEFORE the top-N slice. Scoping it to the visible rows made a top-20
    // view paint its best players as merely average.
    state.percentileBase = buildPercentileBase(state.displayedData);
    // The charts read the same pre-slice set, for the same reason.
    state.filteredData = state.displayedData;

    // THEN limit to the requested number of rows
    if (showEntries !== 'all') state.displayedData = state.displayedData.slice(0, parseInt(showEntries));

    // An expanded row that got filtered out should not stay logically open.
    if (state.openRowId !== null && !state.displayedData.some(p => p.id === state.openRowId)) {
        state.openRowId = null;
    }

    renderTable();

    // If charts view is active, re-render charts with new data
    const chartsView = document.getElementById('mainChartsView');
    if (chartsView && getComputedStyle(chartsView).display !== 'none') {
        renderCharts();
    }
}

// Every chip rendered in the UI must appear here. Five of them previously fell
// through the switch and did nothing at all: the chip highlighted, the table
// did not change, and there was no error to notice.
const QUICK_FILTERS = {
    // set_piece_priority is 99 for a non-taker, so the old `> 0` test matched
    // every player in the league.
    set_pieces: {
        filter: p => Math.min(p.set_piece_priority.penalty, p.set_piece_priority.corner,
            p.set_piece_priority.free_kick) <= 3,
        sortKey: 'set_piece_priority.penalty', sortDirection: 'asc'
    },
    attacking_defenders: {
        filter: p => p.position_name === 'DEF' && p.minutes > 300,
        sortKey: 'xGI_per90'
    },
    differentials: {
        filter: p => parseFloat(p.selected_by_percent) < 10 && p.draft_score > 40,
        sortKey: 'draft_score'
    },
    bonus_magnets: {
        filter: p => p.minutes > 450 && p.bonus_per90 > 0.25,
        sortKey: 'bonus_per90'
    },
    // "form > 0" matched essentially the whole league. Require a genuinely
    // strong recent return from someone who is actually playing.
    form_kings: {
        filter: p => parseFloat(p.form) >= 4.5 && p.minutes > 450,
        sortKey: 'points_per_game_90'
    },
    // Good underlying numbers against a soft run of fixtures.
    easy_fixtures_ppg: {
        filter: p => p.next_3_fdr > 0 && p.next_3_fdr <= 2.7 && p.minutes > 450,
        sortKey: 'points_per_game_90'
    },
    // Creating more than they have converted: candidates to improve.
    underperformers: {
        filter: p => p.minutes > 600 && p.xDiff < -1.5,
        sortKey: 'xDiff', sortDirection: 'asc'
    },
    // Underperforming AND being bought — the market expects a correction.
    trending_underachievers: {
        filter: p => p.minutes > 450 && p.xDiff < 0 && p.net_transfers_event > 0,
        sortKey: 'net_transfers_event'
    },
    // nailed_starters, defcon_kings and best_value lived here. All three had no
    // chip in index.html, so nothing could ever call them — the mirror image of
    // the bug this list was written to prevent, and just as invisible. Two of the
    // three are now panels on the draft board (VORP and DEFCON hit-rate), and the
    // third sorts on rotation_risk, which is a column you can click.
};

// The chips and the rules must agree in both directions. A chip with no rule
// highlights and does nothing; a rule with no chip is dead weight that reads as a
// working feature. Both have shipped here before.
function assertQuickFiltersReachable() {
    const chips = [...document.querySelectorAll('.quick-filter-btn')]
        .map(b => (b.getAttribute('onclick') || '').match(/'([a-z_]+)'/))
        .filter(Boolean).map(m => m[1]);
    const rules = Object.keys(QUICK_FILTERS);
    const orphanChips = chips.filter(c => !rules.includes(c));
    const unreachable = rules.filter(r => !chips.includes(r));
    if (orphanChips.length) console.warn('⚠️ quick-filter chip with no rule:', orphanChips);
    if (unreachable.length) console.warn('⚠️ quick-filter rule with no chip:', unreachable);
}

// Filters whose inputs simply do not exist yet outside a live season, so an
// empty result is expected and should be explained rather than shown as a
// blank table.
const FILTER_PREREQS = {
    easy_fixtures_ppg: {
        available: () => (state.allPlayersData.live.fixtures || []).length > 0,
        reason: 'אין עדיין לוח משחקים לעונה החדשה — הפילטר הזה יעבוד כשהמשחקים יתפרסמו'
    },
    trending_underachievers: {
        available: () => state.currentDataSource === 'live',
        reason: 'נתוני העברות קיימים רק בעונה פעילה — לא זמין בנתוני עונה שהסתיימה'
    },
    differentials: {
        available: () => state.currentDataSource === 'live',
        reason: 'אחוזי בחירה משקפים את העונה שהסתיימה ולא את הדראפט הקרוב'
    }
};

function applyQuickFilter(filterName) {
    const spec = QUICK_FILTERS[filterName];
    if (!spec) {
        console.warn(`⚠️ Unknown quick filter: ${filterName}`);
        return;
    }

    const prereq = FILTER_PREREQS[filterName];
    if (prereq && !prereq.available()) {
        state.displayedData = [];
        state.quickFilterNotice = prereq.reason;
        return;
    }

    state.displayedData = state.displayedData.filter(spec.filter);
    // No sorting here: processChange() sorts by state.sortKey immediately after
    // this returns, which discarded whatever this used to do. Each filter names
    // a `sortKey` instead and toggleQuickFilter() applies it, so the order and
    // the header indicator finally agree.
}

/**
 * Set the sort explicitly, without the click-to-toggle behaviour.
 * Callers that are not a header click (quick filters, resets) must use this:
 * sortTable('draft_score') on a table already sorted by draft_score flips it to
 * ascending, which is how every quick filter used to open on the *worst*
 * players in its category.
 */
function setSort(key, direction) {
    state.sortKey = key;
    state.sortDirection = direction;
    updateSortIndicators(key);
    processChange();
}

function updateSortIndicators(key) {
    document.querySelectorAll('#playersTable thead th[data-sort]').forEach(th => {
        const indicator = th.querySelector('.sort-indicator');
        if (!indicator) return;
        indicator.textContent = '';
        if (th.dataset.sort === key) {
            th.classList.add('sorted');
            indicator.textContent = state.sortDirection === 'desc' ? '▼' : '▲';
        } else {
            th.classList.remove('sorted');
        }
    });
}

function sortTable(key) {
    if (state.sortKey === key) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        state.sortKey = key;
        // Default to DESC for performance metrics
        // ASC for text columns: rank, web_name, team_name, draft_team, position_name
        const ascColumns = ['rank', 'web_name', 'team_name', 'draft_team', 'position_name',
            'next_3_fdr', 'set_piece_priority.penalty', 'set_piece_priority.corner', 'set_piece_priority.free_kick',
            // Rank 0 is the most actionable verdict, so ascending puts the
            // players worth doing something about at the top.
            'signal_rank'];
        if (ascColumns.includes(key)) {
            state.sortDirection = 'asc';
        } else {
            state.sortDirection = 'desc';
        }
    }

    updateSortIndicators(key);

    // TRIGGER RE-SORT BY CALLING processChange()
    processChange();
}

function setupTableSorting() {
    const thead = document.querySelector('#playersTable thead');
    if (thead) {
        thead.addEventListener('click', (e) => {
            const th = e.target.closest('th[data-sort]');
            if (!th) return;
            const key = th.dataset.sort;
            if (key) sortTable(key);
        });
    }
}

function setActiveButton(button) {
    document.querySelectorAll('.control-button').forEach(btn => btn.classList.remove('active'));
    if (button) button.classList.add('active');
}

/**
 * The minutes floor the page opens on, and the one איפוס restores.
 *
 * There were three different "defaults": 120 in the markup, 30 here, and 0 in
 * toggleQuickFilter. Pressing איפוס therefore produced a *different* table from a
 * fresh page load, silently, and neither number was written down anywhere as the
 * intended one. A quick filter still drops it to zero on purpose — a chip carries
 * its own minutes threshold and should not be filtered twice.
 */
const DEFAULT_MIN_MINUTES = '120';
const QUICK_FILTER_MIN_MINUTES = '0';

function showAllPlayers(button) {
    setActiveButton(button);
    state.activeQuickFilterName = null;
    document.querySelectorAll('.quick-filter-btn.active').forEach(b => b.classList.remove('active'));
    ['searchName', 'positionFilter', 'teamFilter', 'priceRange', 'minPoints', 'xDiffFilter', 'signalFilter', 'draftTeamFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('minMinutes').value = DEFAULT_MIN_MINUTES;
    document.getElementById('showEntries').value = 'all';
    processChange();
    sortTable('draft_score');
}

function toggleQuickFilter(button, filterName) {
    // If already active, clear it
    if (state.activeQuickFilterName === filterName) {
        state.activeQuickFilterName = null;
        button.classList.remove('active');
        showAllPlayers(); // Reset to default view (clears filters and resets sort)
    } else {
        // Set new filter
        state.activeQuickFilterName = filterName;

        // Update UI
        document.querySelectorAll('.quick-filter-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Reset other inputs to avoid confusion, but keep quick filter active
        ['searchName', 'positionFilter', 'teamFilter', 'priceRange', 'minPoints', 'xDiffFilter', 'signalFilter', 'draftTeamFilter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        // Each chip carries its own minutes threshold; applying the page default
        // on top of it would filter the same thing twice.
        document.getElementById('minMinutes').value = QUICK_FILTER_MIN_MINUTES;

        // Open every quick filter on its best players. Each filter may name the
        // column that makes its own category legible; the rest fall back to
        // draft rank order (draft_score desc), which is what "the top 20 in this
        // category" means.
        const spec = QUICK_FILTERS[filterName] || {};
        setSort(spec.sortKey || 'draft_score', spec.sortDirection || 'desc');
    }
}

// exportToCsv: the earlier English-header definition was silently shadowed by
// the later one (last declaration wins for a classic script), so it was dead
// code. Removed; the live implementation is below.
function generateComparisonTableHTML(players) {
    // 🎨 ULTIMATE PLAYER COMPARISON - COMPLETE MAKEOVER

    const photoUrl = (p) => `https://resources.premierleague.com/premierleague/photos/players/110x140/p${p.code}.png`;
    const fallbackSVG = (name) => `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22110%22 height=%22140%22%3E%3Crect fill=%22%2394a3b8%22 width=%22110%22 height=%22140%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23fff%22 font-size=%2248%22 font-weight=%22bold%22%3E${name.charAt(0)}%3C/text%3E%3C/svg%3E`;

    let html = `
        <div class="ultimate-comparison-container">
            <!-- 🏆 HEADER -->
            <div class="comparison-hero-header">
                <div class="hero-title-wrapper">
                    <span class="hero-icon">⚔️</span>
                    <h2 class="hero-title">השוואת שחקנים</h2>
                    <span class="hero-badge">${players.length} שחקנים</span>
                </div>
                <p class="hero-subtitle">ניתוח מקיף לקבלת החלטה מושכלת</p>
            </div>
            
            <!-- 👥 PLAYER CARDS GRID -->
            <div class="ultimate-players-grid">
    `;

    // Player Cards with enhanced stats
    players.forEach((p, idx) => {
        // Same four hues the table's position badges use, so a colour means the
        // same thing everywhere in the app.
        const positionColors = {
            'GKP': '#7a3cb8',
            'DEF': '#1c6eb6',
            'MID': '#0d8a5e',
            'FWD': '#c0511a'
        };
        const posColor = positionColors[p.position_name] || '#6366f1';

        html += `
            <div class="ultimate-player-card" style="animation-delay: ${idx * 0.1}s; border-top: 4px solid ${posColor}">
                <div class="player-card-photo-wrapper">
                    <img src="${photoUrl(p)}" alt="${p.web_name}" class="player-card-photo-ultimate" onerror="this.src='${fallbackSVG(p.web_name)}'">
                    <div class="player-position-badge" style="background: ${posColor}">${p.position_name}</div>
                </div>
                <div class="player-card-info">
                    <h3 class="player-name-ultimate">${p.web_name}</h3>
                    <p class="player-team-ultimate">${p.team_name}</p>
                    <div class="cmp-tags">
                        ${(() => { const o = getDraftTeamForPlayer(p.id);
                            return `<span class="detail-tag ${o ? 'is-owned' : 'is-free'}">${o || '🆓 חופשי'}</span>`; })()}
                        ${(() => { const sig = signalFor(p);
                            return `<span class="signal-badge signal-${sig.tone}">${sig.label}</span>`; })()}
                    </div>
                    
                    <!-- Quick Stats Grid -->
                    <div class="quick-stats-grid">
                        <div class="quick-stat">
                            <span class="quick-stat-icon">💎</span>
                            <div class="quick-stat-content">
                                <span class="quick-stat-label">VORP</span>
                                <span class="quick-stat-value">${formatVorp(p.vorp)}</span>
                            </div>
                        </div>
                        <div class="quick-stat">
                            <span class="quick-stat-icon">⭐</span>
                            <div class="quick-stat-content">
                                <span class="quick-stat-label">ציון דראפט</span>
                                <span class="quick-stat-value">${p.draft_score.toFixed(1)}</span>
                            </div>
                        </div>
                        <div class="quick-stat">
                            <span class="quick-stat-icon">🎯</span>
                            <div class="quick-stat-content">
                                <span class="quick-stat-label">נק' כולל</span>
                                <span class="quick-stat-value">${p.total_points}</span>
                            </div>
                        </div>
                        <div class="quick-stat">
                            <span class="quick-stat-icon">🔥</span>
                            <div class="quick-stat-content">
                                <span class="quick-stat-label">כושר</span>
                                <span class="quick-stat-value">${parseFloat(p.form || 0).toFixed(1)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    html += `
            </div>
            
            <!-- 📊 COMPREHENSIVE METRICS COMPARISON -->
            <div class="ultimate-metrics-section">
                <h3 class="metrics-section-title">
                    <span class="metrics-icon">📊</span>
                    השוואה מפורטת
                </h3>
                
                <div class="metrics-comparison-table">
    `;

    // Define comprehensive metrics (ordered by importance)
    const comprehensiveMetrics = [
        { name: 'ציון דראפט', key: 'draft_score', format: v => v.toFixed(1), icon: '⭐', reversed: false },
        { name: 'העברות נטו', key: 'net_transfers_event', format: v => (v >= 0 ? '+' : '') + v, icon: '🔄', reversed: false , neutral: true },
        { name: 'חיזוי למחזור הבא', key: 'predicted_points_1_gw', format: v => v.toFixed(1), icon: '🔮', reversed: false },
        { name: 'כושר', key: 'form', format: v => parseFloat(v || 0).toFixed(1), icon: '🔥', reversed: false },
        { name: 'נקודות/90', key: 'points_per_game_90', format: v => v.toFixed(1), icon: '📈', reversed: false },
        { name: 'נקודות כולל', key: 'total_points', format: v => v, icon: '🎯', reversed: false },
        { name: 'יציבות', key: 'stability_index', format: v => v.toFixed(0), icon: '📊', reversed: false },
        { name: 'הרכב', key: 'rotation_risk', format: v => Math.round(v * 100) + '%', icon: '🔒', reversed: false },
        { name: 'xGI/90', key: 'xGI_per90', format: v => v.toFixed(2), icon: '⚽', reversed: false },
        { name: 'G+A', key: 'goals_scored_assists', format: v => v, icon: '🎯', reversed: false },
        { name: '% בעלות', key: 'selected_by_percent', format: v => v + '%', icon: '👥', reversed: false , neutral: true },
        { name: 'דקות', key: 'minutes', format: v => v.toLocaleString(), icon: '⏱️', reversed: false },
        { name: 'בונוס/90', key: 'bonus_per90', format: v => v.toFixed(2), icon: '⭐', reversed: false },
        { name: 'דרימטים', key: 'dreamteam_count', format: v => v, icon: '🏆', reversed: false },
        { name: 'ICT/90', key: 'ict_index_per90', format: v => v.toFixed(1), icon: '🧬', reversed: false },
        { name: 'DC/90', key: 'def_contrib_per90', format: v => v.toFixed(1), icon: '🛡️', reversed: false },
        { name: 'xDiff', key: 'xDiff', format: v => (v >= 0 ? '+' : '') + v.toFixed(2), icon: '📉', reversed: false , neutral: true },
        { name: 'CS/90', key: 'clean_sheets_per90', format: v => v.toFixed(2), icon: '🧤', reversed: false },
        { name: 'ספיגות/90', key: 'goals_conceded_per90', format: v => v.toFixed(2), icon: '🥅', reversed: true },
    ];

    comprehensiveMetrics.forEach((metric, idx) => {
        const values = players.map(p => {
            let val = getNestedValue(p, metric.key);
            if (metric.key === 'goals_scored_assists') {
                val = (p.goals_scored || 0) + (p.assists || 0);
            }
            return typeof val === 'number' ? val : parseFloat(val) || 0;
        });

        const maxVal = Math.max(...values);
        const minVal = Math.min(...values);
        // A tie has no winner. Marking both sides best put two trophies on most
        // rows of a two-player comparison, which reads as noise.
        const tied = maxVal === minVal;
        const competitive = !metric.neutral && !tied;

        html += `
            <div class="metric-comparison-row" style="animation-delay: ${idx * 0.03}s">
                <div class="metric-row-label">
                    <span class="metric-row-icon">${metric.icon}</span>
                    <span class="metric-row-name">${metric.name}</span>
                </div>
                <div class="metric-row-values">
        `;

        players.forEach((p, pIdx) => {
            const value = values[pIdx];
            const isBest = competitive && (metric.reversed ? value === minVal : value === maxVal);
            const isWorst = competitive && (metric.reversed ? value === maxVal : value === minVal);
            // Share of the leader, so the bar shows how big the gap actually is.
            // Normalising to (v-min)/(max-min) made every loser 0% and every
            // winner 100%, which said nothing that the trophy did not already.
            const ref = metric.reversed ? minVal : maxVal;
            const pct = metric.reversed
                ? (value !== 0 ? Math.abs(ref / value) * 100 : 100)
                : (ref !== 0 ? Math.abs(value / ref) * 100 : 100);
            const percentage = Math.max(Math.min(pct, 100), 4);

            html += `
                <div class="metric-value-box ${isBest ? 'best-value' : ''} ${isWorst ? 'worst-value' : ''}">
                    <div class="metric-value-number">${metric.format(value)}</div>
                    <div class="metric-value-bar-container">
                        <div class="metric-value-bar" style="width: ${percentage}%"></div>
                    </div>
                    ${isBest ? '<span class="best-badge">🏆</span>' : ''}
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    // Fixtures Row
    html += `
            <div class="metric-comparison-row fixtures-comparison-row">
                <div class="metric-row-label">
                    <span class="metric-row-icon">📅</span>
                    <span class="metric-row-name">משחקים קרובים</span>
                </div>
                <div class="metric-row-values">
    `;

    players.forEach(p => {
        const fixturesHTML = generateFixturesHTML(p);
        html += `
            <div class="metric-value-box fixtures-box">
                ${fixturesHTML || '<span class="no-fixtures">אין נתונים</span>'}
            </div>
        `;
    });

    html += `
                </div>
            </div>
        </div>
    </div>
</div>
    `;

    return html;
}

/**
 * The ticked checkboxes are the only selection the user can see, but the state
 * Set is what the comparison reads. They drift apart whenever the table
 * re-renders between ticking a box and pressing השוואה — which is why the
 * button reported "select at least two players" with two boxes visibly ticked.
 * Reconcile from the DOM first; off-screen selections stay in the Set.
 */
function syncComparisonSelection() {
    document.querySelectorAll('.player-select:checked').forEach(cb => {
        const id = parseInt(cb.dataset.playerId, 10);
        if (Number.isInteger(id)) state.selectedForComparison.add(id);
    });
    return state.selectedForComparison;
}

function compareSelectedPlayers() {
    syncComparisonSelection();

    if (state.selectedForComparison.size < 2) {
        showToast('בחר שחקנים',
            `יש לבחור לפחות שני שחקנים להשוואה (נבחרו ${state.selectedForComparison.size})`,
            'warning', 3000);
        return;
    }

    const source = state.allPlayersData[state.currentDataSource];
    if (!source || !source.processed) {
        showToast('שגיאה', 'נתוני השחקנים עוד לא נטענו', 'error', 3000);
        return;
    }

    // Look the players up in the full processed set, not in displayedData: a
    // selection made before filtering must still resolve.
    const players = source.processed.filter(p => state.selectedForComparison.has(p.id));
    if (players.length < 2) {
        showToast('שגיאה', 'לא ניתן למצוא את השחקנים שנבחרו בנתונים', 'error', 3000);
        return;
    }

    const contentDiv = document.getElementById('compareContent');
    const modal = document.getElementById('compareModal');
    if (!contentDiv || !modal) {
        showToast('שגיאה', 'חלון ההשוואה חסר בדף', 'error', 3000);
        return;
    }

    contentDiv.innerHTML = generateComparisonTableHTML(players);
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function getMetricValueClass(value, values, reversed) {
    const numericValues = values.filter(v => typeof v === 'number');
    if (numericValues.length < 2) return '';
    const max = Math.max(...numericValues);
    const min = Math.min(...numericValues);
    if (value === (reversed ? min : max)) return 'metric-value-best';
    if (value === (reversed ? max : min)) return 'metric-value-worst';
    return 'metric-value-mid';
}

// Radar chart removed - not needed for the new comparison design

window.closeModal = function () {
    // Closes by class, not by a list of ids: the previous version named two of
    // the four modals, so a modal added later stayed open with no way to dismiss
    // it and nothing in the code saying why.
    document.querySelectorAll('.modal').forEach(m => { m.style.display = 'none'; });

    document.body.style.overflow = ''; // Restore scrolling

    if (charts.visualization) {
        charts.visualization.destroy();
        charts.visualization = null;
    }

    console.log('✅ Modal closed');
};

// ============================================
// ADVANCED SEARCH & FILTERS
// ============================================

function handleSearch() {
    const query = document.getElementById('playerSearch').value.toLowerCase();
    state.searchQuery = query;
    applyFilters();
}

function clearSearch() {
    document.getElementById('playerSearch').value = '';
    state.searchQuery = '';
    applyFilters();
}

function updatePriceFilter() {
    const minEl = document.getElementById('priceMin');
    const maxEl = document.getElementById('priceMax');

    let min = parseFloat(minEl.value);
    let max = parseFloat(maxEl.value);

    // Ensure min <= max
    if (min > max) {
        [min, max] = [max, min];
        minEl.value = min;
        maxEl.value = max;
    }

    state.priceRange = { min, max };

    document.getElementById('priceMinVal').textContent = min.toFixed(1);
    document.getElementById('priceMaxVal').textContent = max.toFixed(1);

    applyFilters();
}

function applyFilters() {
    const select = document.getElementById('teamMultiSelect');
    if (!select) return;

    state.selectedTeams = Array.from(select.selectedOptions).map(opt => opt.value);

    let filtered = state.allPlayersData[state.currentDataSource].processed;

    // Search query
    if (state.searchQuery) {
        filtered = filtered.filter(p =>
            p.web_name.toLowerCase().includes(state.searchQuery) ||
            p.team_name.toLowerCase().includes(state.searchQuery) ||
            p.now_cost.toString().includes(state.searchQuery)
        );
    }

    // Price range
    filtered = filtered.filter(p =>
        p.now_cost >= state.priceRange.min &&
        p.now_cost <= state.priceRange.max
    );

    // Selected teams
    if (state.selectedTeams.length > 0) {
        filtered = filtered.filter(p => state.selectedTeams.includes(p.team_name));
    }

    state.displayedData = filtered;
    renderTable();

    // Update charts with filtered data
    const chartsView = document.getElementById('mainChartsView');
    if (chartsView && getComputedStyle(chartsView).display !== 'none') {
        renderCharts();
    }

    // Show results count
    showToast('תוצאות', `נמצאו ${filtered.length} שחקנים`, 'info', 2000);
}

function resetAllFilters() {
    // Reset search
    document.getElementById('playerSearch').value = '';
    state.searchQuery = '';

    // Reset price
    document.getElementById('priceMin').value = 4;
    document.getElementById('priceMax').value = 15;
    state.priceRange = { min: 4, max: 15 };
    document.getElementById('priceMinVal').textContent = '4.0';
    document.getElementById('priceMaxVal').textContent = '15.0';

    // Reset teams
    const select = document.getElementById('teamMultiSelect');
    if (select) {
        Array.from(select.options).forEach(opt => opt.selected = false);
    }
    state.selectedTeams = [];

    // Reset quick filters
    state.activeQuickFilterName = null;
    document.querySelectorAll('.control-button[data-filter-name]').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show all data
    state.displayedData = state.allPlayersData[state.currentDataSource].processed;
    renderTable();

    // Update charts with all data
    const chartsView = document.getElementById('mainChartsView');
    if (chartsView && getComputedStyle(chartsView).display !== 'none') {
        renderCharts();
    }

    showToast('אופס', 'כל הפילטרים אופסו', 'success', 2000);
}

function saveFilters() {
    const filters = {
        searchQuery: state.searchQuery,
        priceRange: state.priceRange,
        selectedTeams: state.selectedTeams
    };

    localStorage.setItem('fpl_saved_filters', JSON.stringify(filters));
    showToast('נשמר', 'העדפות הפילטרים נשמרו בהצלחה', 'success', 3000);
}

function loadSavedFilters() {
    const saved = localStorage.getItem('fpl_saved_filters');
    if (!saved) return;

    try {
        const filters = JSON.parse(saved);

        // Restore search
        if (filters.searchQuery) {
            const searchEl = document.getElementById('playerSearch');
            if (searchEl) {
                searchEl.value = filters.searchQuery;
                state.searchQuery = filters.searchQuery;
            }
        }

        // Restore price
        if (filters.priceRange) {
            const minEl = document.getElementById('priceMin');
            const maxEl = document.getElementById('priceMax');
            const minValEl = document.getElementById('priceMinVal');
            const maxValEl = document.getElementById('priceMaxVal');

            if (minEl && maxEl) {
                minEl.value = filters.priceRange.min;
                maxEl.value = filters.priceRange.max;
                state.priceRange = filters.priceRange;
                if (minValEl) minValEl.textContent = filters.priceRange.min.toFixed(1);
                if (maxValEl) maxValEl.textContent = filters.priceRange.max.toFixed(1);
            }
        }

        // Restore teams
        if (filters.selectedTeams && filters.selectedTeams.length > 0) {
            const select = document.getElementById('teamMultiSelect');
            if (select) {
                filters.selectedTeams.forEach(team => {
                    const option = Array.from(select.options).find(opt => opt.value === team);
                    if (option) option.selected = true;
                });
                state.selectedTeams = filters.selectedTeams;
            }
        }

        showToast('טעינה', 'העדפות הפילטרים נטענו', 'info', 2000);
    } catch (e) {
        console.error('Failed to load saved filters:', e);
    }
}

function populateTeamSelect() {
    const select = document.getElementById('teamMultiSelect');
    if (!select) return;

    const teams = [...new Set(state.allPlayersData[state.currentDataSource].processed.map(p => p.team_name))].sort();

    select.innerHTML = teams.map(team => `<option value="${team}">${team}</option>`).join('');
}

// ============================================
// EXPORT TO CSV
// ============================================

function exportToCsv() {
    const data = state.displayedData;
    if (!data || data.length === 0) {
        showToast('אין נתונים', 'אין נתונים לייצוא', 'warning', 3000);
        return;
    }

    // Define columns to export (all table columns)
    const columns = [
        { key: 'web_name', header: 'שם' },
        { key: 'draft_score', header: 'ציון דראפט' },
        { key: 'stability_index', header: 'יציבות' },
        { key: 'predicted_points_1_gw', header: 'חיזוי טכני' },
        { key: 'ml_prediction', header: 'ML חיזוי' },
        { key: 'team_name', header: 'קבוצה' },
        { key: 'draft_team', header: 'קבוצת דראפט', format: (player) => getDraftTeamForPlayer(player.id) || 'חופשי' },
        { key: 'position_name', header: 'עמדה' },
        { key: 'now_cost', header: 'מחיר' },
        { key: 'total_points', header: 'נקודות' },
        { key: 'points_per_game_90', header: 'נק/משחק' },
        { key: 'selected_by_percent', header: 'בחירה %' },
        { key: 'dreamteam_count', header: 'DreamTeam' },
        { key: 'net_transfers_event', header: 'העברות' },
        { key: 'def_contrib_per90', header: 'DC/90' },
        { key: 'goals_scored_assists', header: 'G+A', format: (player) => (player.goals_scored || 0) + (player.assists || 0) },
        { key: 'expected_goals_assists', header: 'xG+xA', format: (player) => parseFloat(player.expected_goal_involvements || 0).toFixed(2) },
        { key: 'minutes', header: 'דקות' },
        { key: 'xDiff', header: 'xDiff' },
        { key: 'ict_index', header: 'ICT' },
        { key: 'bonus', header: 'Bonus' },
        { key: 'clean_sheets', header: 'CS' },
        { key: 'penalty_priority', header: 'פנדל', format: (player) => player.set_piece_priority?.penalty === 1 ? 'כן' : 'לא' },
        { key: 'corner_priority', header: 'קרן', format: (player) => player.set_piece_priority?.corner || 0 },
        { key: 'free_kick_priority', header: 'בעיטה חופשית', format: (player) => player.set_piece_priority?.free_kick || 0 }
    ];

    // Create CSV header
    const csvHeader = columns.map(col => col.header).join(',');

    // Create CSV rows
    const csvRows = data.map(player => {
        return columns.map(col => {
            // Use custom format function if provided
            let value;
            if (col.format && typeof col.format === 'function') {
                value = col.format(player);
            } else {
                value = player[col.key];
            }

            // Format numbers
            if (typeof value === 'number') {
                value = value.toFixed(2);
            }

            // Handle undefined/null
            if (value === undefined || value === null) {
                value = '';
            }

            // Convert to string
            value = String(value);

            // Escape commas and quotes
            value = value.replace(/"/g, '""');
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                value = `"${value}"`;
            }

            return value;
        }).join(',');
    });

    // Combine header and rows
    const csv = [csvHeader, ...csvRows].join('\n');

    // Add BOM for Hebrew support in Excel
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csv;

    // Create blob and download
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `FPL_Players_${timestamp}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('הורדה הושלמה', `${data.length} שחקנים יוצאו בהצלחה`, 'success', 3000);
}

/**
 * Compare selected players in a modal
 */
// The second, never-reachable definition of compareSelectedPlayers() lived
// here: ~150 lines that built their own modal from scratch. Two declarations
// of the same name meant only one ever ran, and the dead one read fine, so a
// bug fixed in it changed nothing. The live implementation is above and uses
// the #compareModal markup already in index.html.
/* ==========================================================================
   DRAFT BOARD — "למי כדאי לקחת"
   ==========================================================================
   Replaces the six KPI trivia cards. They answered questions the table already
   answers by sorting a column (most goals, most assists, most points) and gave
   a bare number with no reason attached. Each panel here answers one concrete
   draft question with an explicit, stated rule, so a recommendation can be
   argued with rather than taken on trust — and every pick carries the sentence
   that put it there.

   The pool is the players you can actually get: free agents only, once the
   league's rosters are known. Before the draft everyone is available.
   ========================================================================== */

/** Per-match DEFCON threshold by element_type. Mirrors the snapshot builder. */
const DEFCON_THRESHOLD = { 1: null, 2: 10, 3: 12, 4: 12 };

/**
 * Recent-window aggregates for one player, over the gameweeks ensureTrendWindow()
 * has loaded. `matches` counts the gameweeks he actually played, not the
 * gameweeks in the window: three good games out of five is a different player
 * from three good games out of three.
 *
 * Cached on state.trendKey, which changes whenever the window is rebuilt.
 */
let _windowStatsCache = { key: null, byId: new Map() };
function windowStats(player) {
    if (_windowStatsCache.key !== state.trendKey) {
        _windowStatsCache = { key: state.trendKey, byId: new Map() };
    }
    const hit = _windowStatsCache.byId.get(player.id);
    if (hit) return hit;

    const mins = getTrendSeries(player.id, 'mins', 'recent');
    const pts = getTrendSeries(player.id, 'pts', 'recent');
    const dc = getTrendSeries(player.id, 'dc', 'recent');
    const threshold = DEFCON_THRESHOLD[player.element_type];

    let matches = 0, minutes = 0, points = 0, dcHits = 0;
    mins.forEach((m, i) => {
        if (m.value <= 0) return;
        matches++;
        minutes += m.value;
        points += pts[i] ? pts[i].value : 0;
        if (threshold !== null && dc[i] && dc[i].value >= threshold) dcHits++;
    });

    const out = {
        matches, minutes, points,
        gws: mins.length,
        ppg: matches ? points / matches : null,
        mpg: matches ? minutes / matches : null,
        // GKPs are not DEFCON-eligible at all, which is different from 0%.
        dcRate: (threshold !== null && matches) ? (dcHits / matches) * 100 : null,
        dcHits
    };
    _windowStatsCache.byId.set(player.id, out);
    return out;
}

/** Minimum appearances a player needs inside the window to be recommendable. */
function windowMinMatches() {
    return Math.max(2, Math.ceil((state.trendWindow || 5) * 0.6));
}

const DRAFT_PANELS = [
    {
        id: 'value',
        title: 'הערך הגדול ביותר',
        subtitle: 'VORP — יתרון על החלופה החופשית',
        icon: '💎',
        accent: '#6366f1',
        metric: p => p.vorp,
        display: p => `+${p.vorp.toFixed(2)}`,
        why: p => `חלופה בעמדה: ${p.replacement_score.toFixed(2)} נק׳ למשחק`,
        eligible: p => p.vorp !== null && p.vorp > 0 && p.replacement_score !== null,
        rank: (a, b) => b.vorp - a.vorp
    },
    {
        id: 'form',
        title: 'הכי חמים עכשיו',
        subtitle: 'נקודות למשחק בחלון הנבחר',
        icon: '🔥',
        accent: '#ea580c',
        metric: p => windowStats(p).ppg,
        display: p => windowStats(p).ppg.toFixed(1),
        why: p => {
            const w = windowStats(p);
            return `${Math.round(w.points)} נק׳ ב-${w.matches} משחקים`;
        },
        eligible: p => {
            const w = windowStats(p);
            return w.ppg !== null && w.matches >= windowMinMatches() && w.mpg >= 45;
        },
        rank: (a, b) => windowStats(b).ppg - windowStats(a).ppg,
        windowAware: true
    },
    {
        id: 'defcon',
        title: 'מכונות DEFCON',
        subtitle: 'עוברים את הסף בפועל, לא בממוצע',
        icon: '🛡️',
        accent: '#0891b2',
        // The season hit-rate is the better number where it exists (the snapshot
        // computes it per match). The window rate is the fallback for a live
        // season, which has no season-long hit-rate yet.
        metric: p => defconRateFor(p),
        display: p => `${defconRateFor(p).toFixed(0)}%`,
        why: p => {
            const w = windowStats(p);
            if (p.defcon_hit_rate !== null && p.defcon_hit_rate !== undefined && p.defcon_eligible_apps) {
                return `${p.defcon_hits}/${p.defcon_eligible_apps} משחקים מעל הסף בעונה`;
            }
            return `${w.dcHits}/${w.matches} משחקים מעל הסף בחלון`;
        },
        eligible: p => {
            const rate = defconRateFor(p);
            return rate !== null && rate >= 20 && windowStats(p).matches >= windowMinMatches();
        },
        rank: (a, b) => defconRateFor(b) - defconRateFor(a),
        windowAware: true
    },
    {
        id: 'market',
        title: 'תנועת שוק',
        subtitle: 'למי נכנסות העברות במחזור הזה',
        icon: '🔄',
        accent: '#0284c7',
        metric: p => p.net_transfers_event,
        display: p => `${p.net_transfers_event > 0 ? '+' : ''}${p.net_transfers_event.toLocaleString()}`,
        why: p => `${(p.transfers_in_event || 0).toLocaleString()} נכנס · ${(p.transfers_out_event || 0).toLocaleString()} יצא`,
        eligible: p => p.net_transfers_event > 0,
        rank: (a, b) => b.net_transfers_event - a.net_transfers_event,
        // net_transfers_event is 0 for every player until a gameweek closes, so
        // this panel would vanish with no explanation. A stated empty state
        // reads as "not yet", a missing card reads as a bug.
        emptyNote: 'אין עדיין נתוני העברות — יעבוד כשהמחזור הראשון ייסגר'
    },
    {
        id: 'underlying',
        title: 'המספרים מתחת לפני השטח',
        subtitle: 'מייצרים יותר ממה שהמירו',
        icon: '📈',
        accent: '#d97706',
        metric: p => parseFloat(p.xGI_per90) || 0,
        display: p => (parseFloat(p.xGI_per90) || 0).toFixed(2),
        why: p => `פער המרה ${p.xDiff.toFixed(1)} — צפוי לתקן`,
        eligible: p => (parseFloat(p.xGI_per90) || 0) > 0.35 && p.xDiff < -1 &&
            windowStats(p).matches >= windowMinMatches(),
        rank: (a, b) => (parseFloat(b.xGI_per90) || 0) - (parseFloat(a.xGI_per90) || 0),
        windowAware: true
    },
    {
        id: 'setpiece',
        title: 'בעלי כדורים נייחים',
        subtitle: 'פנדלים וקרנות = נקודות חוזרות',
        icon: '🎯',
        accent: '#be185d',
        metric: p => p.draft_score,
        display: p => `#${setPieceOrder(p)}`,
        why: p => {
            const bits = [];
            if (p.set_piece_priority.penalty <= 2) bits.push(`פנדל #${p.set_piece_priority.penalty}`);
            if (p.set_piece_priority.corner <= 2) bits.push(`קרן #${p.set_piece_priority.corner}`);
            if (p.set_piece_priority.free_kick <= 2) bits.push(`חופשית #${p.set_piece_priority.free_kick}`);
            return bits.join(' · ') || 'בעל כדורים נייחים';
        },
        eligible: p => setPieceOrder(p) <= 2 && p.minutes > 450,
        rank: (a, b) => b.draft_score - a.draft_score
    }
];

/** Best set-piece duty a player holds; 99 means he takes none of them. */
function setPieceOrder(p) {
    return Math.min(p.set_piece_priority.penalty, p.set_piece_priority.corner,
        p.set_piece_priority.free_kick);
}

function defconRateFor(p) {
    if (p.defcon_hit_rate !== null && p.defcon_hit_rate !== undefined) return p.defcon_hit_rate;
    return windowStats(p).dcRate;
}

/**
 * The pool every panel picks from. Narrowed by the position filter only: when
 * you have filtered the table to defenders you are shopping for a defender, and
 * a board still recommending forwards contradicts the table under it. The other
 * filters (price, minutes, form) describe how you want to *read* the league, not
 * what you are willing to draft, so the board ignores them.
 */
function draftBoardPool() {
    const players = (state.allPlayersData[state.currentDataSource] || {}).processed || [];
    const owned = state.draft.ownedElementIds;
    const freeAgentsOnly = owned && owned.size > 0;
    const pos = (document.getElementById('positionFilter') || {}).value || '';

    return {
        freeAgentsOnly,
        position: pos,
        players: players.filter(p =>
            (!freeAgentsOnly || !owned.has(p.id)) &&
            (!pos || p.position_name === pos) &&
            // Injured or suspended players are never a recommendation.
            p.availability_factor > 0.5)
    };
}

function panelPicks(panel, pool, limit) {
    return pool.filter(p => {
        try { return !!panel.eligible(p); } catch (e) { return false; }
    }).sort(panel.rank).slice(0, limit);
}

function renderDraftBoard() {
    const host = document.getElementById('draftBoard');
    if (!host) return;

    const { players, freeAgentsOnly, position } = draftBoardPool();
    if (!players.length) { host.innerHTML = ''; return; }

    const cards = DRAFT_PANELS.map((panel, cardIdx) => {
        const picks = panelPicks(panel, players, 3);
        if (!picks.length && !panel.emptyNote) return '';

        const rows = picks.map((p, i) => `
            <li class="db-row">
                <span class="db-rank">${i + 1}</span>
                <span class="db-player">
                    <span class="db-line">
                        <span class="db-name">${escapeHtml(p.web_name)}</span>
                        <span class="db-meta">${p.position_name} · ${escapeHtml(p.team_name)}</span>
                    </span>
                    <span class="db-why">${escapeHtml(panel.why(p))}</span>
                </span>
                ${miniSparkHtml(p.id, 'pts')}
                <span class="db-value">${escapeHtml(panel.display(p))}</span>
            </li>`).join('');

        const body = picks.length
            ? `<ul class="db-list">${rows}</ul>
               <button type="button" class="db-more" onclick="openLeaderboard('${panel.id}')">
                   כל ה-20 <span aria-hidden="true">←</span>
               </button>`
            : `<p class="db-empty">${panel.emptyNote}</p>`;

        return `
            <article class="db-card" style="--accent:${panel.accent}; --d:${cardIdx * 45}ms">
                <header class="db-head">
                    <span class="db-icon">${panel.icon}</span>
                    <span class="db-headings">
                        <span class="db-title">${panel.title}</span>
                        <span class="db-sub">${panel.subtitle}</span>
                    </span>
                </header>
                ${body}
            </article>`;
    }).filter(Boolean).join('');

    if (!cards) { host.innerHTML = ''; return; }

    const scope = [
        freeAgentsOnly ? `${players.length} שחקנים חופשיים` : `${players.length} שחקנים — לפני הדראפט`,
        position ? POSITION_LABELS[position] || position : null,
        state.trendGws.length ? `חלון ${state.trendWindow} מחזורים` : null
    ].filter(Boolean).join(' · ');

    host.innerHTML = `
        <div class="db-bar">
            <h2 class="db-heading"><span class="db-heading-icon">🎯</span>למי כדאי לקחת</h2>
            <span class="db-scope">${scope}</span>
        </div>
        <div class="db-grid">${cards}</div>`;
}

const POSITION_LABELS = { GKP: 'שוערים', DEF: 'מגנים', MID: 'קשרים', FWD: 'חלוצים' };

/* ---------------------------- top-20 leaderboard -------------------------- */

/**
 * The board shows three; the question "who else" is the whole reason to look at
 * it. Same rule, same pool, same "why" sentence — twenty deep, with the draft
 * team and the signal verdict alongside, so the answer does not need the table.
 */
function openLeaderboard(panelId) {
    const panel = DRAFT_PANELS.find(p => p.id === panelId);
    const modal = document.getElementById('leaderboardModal');
    const host = document.getElementById('leaderboardContent');
    if (!panel || !modal || !host) return;

    const { players, freeAgentsOnly } = draftBoardPool();
    const picks = panelPicks(panel, players, 20);

    const rows = picks.map((p, i) => {
        const signal = signalFor(p);
        const draftTeam = getDraftTeamForPlayer(p.id);
        return `<tr onclick="jumpToPlayer(${p.id})" title="הצג את ${escapeHtml(p.web_name)} בטבלה">
            <td class="lb-rank">${i + 1}</td>
            <td class="lb-name">
                ${escapeHtml(p.web_name)}
                ${p.availability_grade !== 'available'
                ? `<span class="status-badge status-${p.availability_grade}" title="${escapeHtml(p.news || '')}">${p.chance_of_playing_next_round !== null ? p.chance_of_playing_next_round + '%' : '!'}</span>`
                : ''}
            </td>
            <td>${p.position_name}</td>
            <td>${escapeHtml(p.team_name)}</td>
            <td class="${draftTeam ? 'draft-owned' : 'draft-free'}">${draftTeam ? escapeHtml(draftTeam) : '🆓 חופשי'}</td>
            <td class="lb-value">${escapeHtml(panel.display(p))}</td>
            <td class="lb-why">${escapeHtml(panel.why(p))}</td>
            <td><span class="signal-badge signal-${signal.tone}">${signal.label}</span></td>
        </tr>`;
    }).join('');

    // --accent goes on the wrapper, not the header: .lb-value in every row reads
    // it too, and a custom property set on a sibling does not inherit sideways.
    host.innerHTML = `
      <div class="lb" style="--accent:${panel.accent}">
        <header class="lb-head">
            <span class="lb-icon">${panel.icon}</span>
            <span>
                <h2>${panel.title}</h2>
                <p>${panel.subtitle} · ${freeAgentsOnly ? 'שחקנים חופשיים בלבד' : 'כל השחקנים'}</p>
            </span>
        </header>
        ${picks.length ? `<div class="lb-scroll"><table class="lb-table">
            <thead><tr>
                <th>#</th><th>שחקן</th><th>עמדה</th><th>קבוצה</th>
                <th>קבוצת דראפט</th><th>${panel.title}</th><th>למה</th><th>סיגנל</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table></div>` : `<p class="db-empty">${panel.emptyNote || 'אין מועמדים לפי הכלל הזה'}</p>`}
      </div>`;

    modal.style.display = 'block';
}

/** Open a player's row in the table, from anywhere. */
function jumpToPlayer(playerId) {
    window.closeModal();
    if (!state.displayedData.some(p => p.id === playerId)) {
        showToast('לא בטבלה', 'השחקן לא עובר את הסינון הנוכחי — נקה סינון כדי לראות אותו', 'info', 4000);
        return;
    }
    state.openRowId = playerId;
    renderTable();
    const row = document.querySelector(`#playersTable tr.player-row.is-open`);
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function getNestedValue(obj, path) {
    if (!path) return obj;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function showVisualization(type) {
    if (!state.allPlayersData[state.currentDataSource].processed) {
        showToast('המתן', 'יש להמתין לטעינת הנתונים', 'warning', 3000);
        return;
    }
    const specMap = config.visualizationSpecs;

    const spec = specMap[type];
    if (!spec) {
        console.error(`Visualization spec not found for type: ${type}`);
        showToast('שגיאה', 'סוג ויזואליזציה לא נמצא', 'error', 3000);
        return;
    }

    document.getElementById('visualizationTitle').textContent = spec.title;

    // If user filtered data, show all filtered players. Otherwise, filter by minutes
    const isFiltered = state.displayedData.length < state.allPlayersData[state.currentDataSource].processed.length;
    const players = isFiltered
        ? state.displayedData.filter(p => spec.pos.includes(p.position_name))
        : state.displayedData.filter(p => spec.pos.includes(p.position_name) && p.minutes > 300);
    if (players.length < 2) {
        showToast('אין מספיק נתונים', `לא נמצאו מספיק שחקנים (${spec.pos.join('/')}) להשוואה`, 'warning', 4000);
        return;
    }

    const chartConfig = getChartConfig(players, spec.x, spec.y, spec.xLabel, spec.yLabel, spec.quadLabels);
    const ctx = document.getElementById('visualizationChart').getContext('2d');
    if (charts.visualization) charts.visualization.destroy();
    charts.visualization = new Chart(ctx, chartConfig);
    document.getElementById('visualizationModal').style.display = 'block';
}

// showTeamDefenseChart, showTeamAttackChart, showPriceVsScoreChart and
// showIctBreakdownChart lived here: modal copies of four charts in the charts
// view, unreachable from the UI since nothing called them. Two of the four
// plotted metrics the charts view has since dropped (price in a league with no
// budget, and the ICT blend), so keeping them would have preserved exactly the
// reading the rework removed. See git history if a modal chart is wanted back.

function getChartConfig(data, xKey, yKey, xLabel, yLabel, quadLabels = {}, colorFunc = null, dataLabelFunc = null) {
    const dataPoints = data.map(d => ({ x: getNestedValue(d, xKey), y: getNestedValue(d, yKey), ...d }));
    const xValues = dataPoints.map(p => p.x);
    const yValues = dataPoints.map(p => p.y);
    const xMedian = xValues.sort((a, b) => a - b)[Math.floor(xValues.length / 2)];
    const yMedian = yValues.sort((a, b) => a - b)[Math.floor(yValues.length / 2)];

    return {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Players',
                data: dataPoints,
                pointRadius: 6,
                pointHoverRadius: 9,
                pointBorderWidth: 2,
                pointBorderColor: 'rgba(255, 255, 255, 0.9)',
                backgroundColor: colorFunc ? colorFunc : (context) => {
                    if (!context.raw) return 'rgba(156, 163, 175, 0.7)';
                    const point = context.raw;
                    if (point.x >= xMedian && point.y >= yMedian) {
                        return 'rgba(34, 197, 94, 0.85)'; // Green - Best
                    } else if (point.x < xMedian && point.y < yMedian) {
                        return 'rgba(239, 68, 68, 0.85)'; // Red - Worst
                    } else {
                        return 'rgba(251, 146, 60, 0.85)'; // Orange - Medium
                    }
                },
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 30, right: 20, bottom: 10, left: 10 }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: xLabel,
                        font: { size: 13.8, weight: '700' },
                        color: '#475569'
                    },
                    ticks: {
                        font: { size: 11.5, weight: '600' },
                        color: '#64748b'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: yLabel,
                        font: { size: 13.8, weight: '700' },
                        color: '#475569'
                    },
                    ticks: {
                        font: { size: 11.5, weight: '600' },
                        color: '#64748b'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#e2e8f0',
                    borderColor: 'rgba(2, 132, 199, 0.5)',
                    borderWidth: 2,
                    padding: 16,
                    displayColors: false,
                    titleFont: { size: 15, weight: '700' },
                    bodyFont: { size: 13.8 },
                    footerFont: { size: 14 },
                    callbacks: {
                        label: function (context) {
                            const d = context.raw;
                            const name = d.web_name || d.player || d.team || 'Point';
                            return `${name}: (${d.x.toFixed(2)}, ${d.y.toFixed(2)})`;
                        },
                        title: function (context) {
                            return ''; // Hide default title
                        },
                        footer: function (context) {
                            const d = context[0].raw;
                            if (d.position_name || d.pos) {
                                return `Position: ${d.position_name || d.pos}`;
                            }
                            if (d.team_name) {
                                return `Team: ${d.team_name}`;
                            }
                            return '';
                        }
                    }
                },
                datalabels: {
                    display: true,
                    align: 'top',
                    offset: 4,
                    color: '#1e293b',
                    font: { size: 9.7, weight: '700' },
                    backgroundColor: null,
                    borderWidth: 0,
                    formatter: (value, context) => {
                        const dataPoint = context.dataset.data[context.dataIndex];
                        if (dataLabelFunc) {
                            return dataLabelFunc(dataPoint);
                        }
                        // Return player name (web_name) or team name
                        return dataPoint.web_name || dataPoint.player || dataPoint.team || '';
                    },
                },
                annotation: {
                    annotations: {
                        xLine: {
                            type: 'line',
                            xMin: xMedian,
                            xMax: xMedian,
                            borderColor: 'rgba(0,0,0,0.2)',
                            borderWidth: 2,
                            borderDash: [6, 6]
                        },
                        yLine: {
                            type: 'line',
                            yMin: yMedian,
                            yMax: yMedian,
                            borderColor: 'rgba(0,0,0,0.2)',
                            borderWidth: 2,
                            borderDash: [6, 6]
                        },
                        ...(quadLabels.topRight && {
                            topRight: {
                                type: 'label',
                                xValue: xMedian * 1.01,
                                yValue: yMedian * 1.01,
                                content: quadLabels.topRight,
                                position: 'start',
                                xAdjust: 6,
                                yAdjust: -6,
                                font: { size: 10.4, weight: '700' },
                                color: 'rgba(34, 197, 94, 0.8)',
                                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                borderRadius: 3,
                                padding: 4
                            }
                        }),
                        ...(quadLabels.topLeft && {
                            topLeft: {
                                type: 'label',
                                xValue: xMedian * 0.99,
                                yValue: yMedian * 1.01,
                                content: quadLabels.topLeft,
                                position: 'end',
                                xAdjust: -6,
                                yAdjust: -6,
                                font: { size: 10.4, weight: '700' },
                                color: 'rgba(251, 146, 60, 0.8)',
                                backgroundColor: 'rgba(251, 146, 60, 0.1)',
                                borderRadius: 3,
                                padding: 4
                            }
                        }),
                        ...(quadLabels.bottomRight && {
                            bottomRight: {
                                type: 'label',
                                xValue: xMedian * 1.01,
                                yValue: yMedian * 0.99,
                                content: quadLabels.bottomRight,
                                position: 'start',
                                xAdjust: 6,
                                yAdjust: 6,
                                font: { size: 10.4, weight: '700' },
                                color: 'rgba(251, 146, 60, 0.8)',
                                backgroundColor: 'rgba(251, 146, 60, 0.1)',
                                borderRadius: 3,
                                padding: 4
                            }
                        }),
                        ...(quadLabels.bottomLeft && {
                            bottomLeft: {
                                type: 'label',
                                xValue: xMedian * 0.99,
                                yValue: yMedian * 0.99,
                                content: quadLabels.bottomLeft,
                                position: 'end',
                                xAdjust: -6,
                                yAdjust: 6,
                                font: { size: 10.4, weight: '700' },
                                color: 'rgba(239, 68, 68, 0.8)',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                borderRadius: 3,
                                padding: 4
                            }
                        })
                    }
                }
            }
        }
    };
}

// The "למי כדאי לקחת" panel grid lived here (FORM_WINDOWS, applyFormWindow,
// setFormWindow, DRAFT_PANELS, renderDraftBoard) and was removed on request.
// Everything it computed — window_ppg, window_defcon_rate, window_xgi90 — was
// read only by those panels, so it all went with them. The equivalent answers
// now come from the KPI cards below the toolbar and the table's own signal
// column. See git history if the panels are ever wanted back.

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

// --- Cell formatters for the draft metrics ---
// A dash means "not applicable / unknown". It must never render as 0, which
// would sort a player with no data alongside genuinely bad ones.

function formatVorp(v) {
    if (v === null || v === undefined) return '<span style="color:#cbd5e1;">–</span>';
    return (v > 0 ? '+' : '') + v.toFixed(2);
}

function formatDefconRate(rate) {
    if (rate === null || rate === undefined) return '<span style="color:#cbd5e1;">–</span>';
    const color = rate >= 40 ? '#059669' : rate >= 20 ? '#d97706' : '#94a3b8';
    return `<span style="color:${color}; font-weight:700;">${rate.toFixed(0)}%</span>`;
}

function formatRotation(r) {
    if (r === null || r === undefined) return '<span style="color:#cbd5e1;">–</span>';
    const pct = Math.round(r * 100);
    const color = pct >= 85 ? '#059669' : pct >= 65 ? '#d97706' : '#dc2626';
    return `<span style="color:${color}; font-weight:700;">${pct}%</span>`;
}

// formatAvailability() lived here. Its whole job was to render a green ✓ for the
// ~95% of players with nothing wrong with them, which is what made the זמינות
// column a column of constants. The two cases that carry information — flagged
// and out — are on the שחקן cell as a .status-badge, and in the "לא זמין" signal.

// ============================================
// DRAFT-SPECIFIC METRICS
// ============================================
// In a draft league every player costs the same (nothing), so "value for money"
// is meaningless. What matters is how much better a player is than whoever you
// could get for free at the same position. That is VORP, and it is the metric
// draft formats are actually decided on.

// Starters a typical FPL Draft lineup fields per position (GKP/DEF/MID/FWD).
// Replacement level sits at leagueSize x startersAtPosition: the point where
// the next player at that position is realistically available to anyone.
const REPLACEMENT_SLOTS = { GKP: 1, DEF: 4, MID: 4, FWD: 2 };

function computeDraftMetrics(players) {
    const leagueSize = state.draft.details?.league_entries?.length || 8;
    const ownedIds = state.draft.ownedElementIds;
    // Only treat ownership as known once the league says somebody owns somebody.
    // element-status answers this directly; before the draft it correctly
    // reports every player free, which is the pre-draft branch below, not a
    // mid-season league where the best free agent sets replacement level.
    const haveOwnership = state.draft.ownershipLoaded
        ? state.draft.draftHasHappened
        : !!(ownedIds && ownedIds.size > 0);

    // Points per APPEARANCE, not per 90 minutes. Per-90 divides by playing time,
    // so a substitute with 10 points in 100 minutes scores 9.0 -- higher than
    // any genuine starter -- and would top the VORP table on noise alone.
    const scoreOf = p => {
        const apps = p.appearances || (p.minutes > 0 ? Math.round(p.minutes / 70) : 0);
        if (!apps) return 0;
        const perApp = parseFloat(p.points_per_game);
        return Number.isFinite(perApp) && perApp > 0 ? perApp : (p.total_points || 0) / apps;
    };

    ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
        // Require roughly a third of a season. Below that the sample is too
        // small to describe anyone's true level.
        const atPos = players
            .filter(p => p.position_name === pos && p.minutes >= 900)
            .sort((a, b) => scoreOf(b) - scoreOf(a));
        if (!atPos.length) return;

        let replacementScore;
        if (haveOwnership) {
            // Mid-season: replacement level is literally the best free agent.
            const bestFreeAgent = atPos.find(p => !ownedIds.has(p.id));
            replacementScore = bestFreeAgent ? scoreOf(bestFreeAgent) : scoreOf(atPos[atPos.length - 1]);
        } else {
            // Pre-draft: nobody is owned yet, so replacement level is the first
            // player past the point where every team has filled that position.
            const idx = Math.min(leagueSize * (REPLACEMENT_SLOTS[pos] || 2), atPos.length - 1);
            replacementScore = scoreOf(atPos[idx]);
        }

        atPos.forEach(p => {
            p.replacement_score = Math.round(replacementScore * 100) / 100;
            p.vorp = Math.round((scoreOf(p) - replacementScore) * 100) / 100;
        });
    });

    players.forEach(p => {
        if (p.vorp === undefined) { p.vorp = null; p.replacement_score = null; }

        // Share of appearances that were starts. A high scorer who only starts
        // half the time is a very different proposition in a draft league,
        // where you cannot simply transfer them out.
        const apps = p.appearances || (p.minutes > 0 ? Math.round(p.minutes / 70) : 0);
        p.rotation_risk = apps > 0 && p.starts !== undefined
            ? Math.round(Math.min(p.starts / apps, 1) * 100) / 100
            : null;

        // Goalkeepers are not DEFCON-eligible, so null rather than zero.
        if (p.defcon_hit_rate === undefined) p.defcon_hit_rate = null;

        // Availability as a plain multiplier the projection can use.
        const chance = p.chance_of_playing_next_round;
        p.availability_factor = ['i', 's', 'u'].includes(p.status) ? 0
            : (chance === null || chance === undefined ? 1 : chance / 100);
    });

    return players;
}

function calculatePercentiles(players, metric, isAscending = false) {
    const sortedPlayers = [...players].sort((a, b) => {
        const valA = getNestedValue(a, metric) || 0;
        const valB = getNestedValue(b, metric) || 0;
        return isAscending ? valA - valB : valB - valA;
    });
    const n = sortedPlayers.length;
    sortedPlayers.forEach((p, i) => {
        if (!p.percentiles) p.percentiles = {};
        // The sort above puts the BEST value for this metric first (respecting
        // isAscending, where ascending means "lower is better", e.g. price).
        // A percentile of 100 must therefore go to index 0. Assigning i/(n-1)
        // gave the best player 0 and the worst 100, inverting every
        // percentile-driven term in draft_score.
        p.percentiles[metric] = n > 1 ? ((n - 1 - i) / (n - 1)) * 100 : 100;
    });
}

function calculateAllPredictions(players) {
    // Get fixtures based on current data source
    let fixtures = null;
    if (state.currentDataSource === 'demo') {
        fixtures = state.allPlayersData.demo?.fixtures || [];
    } else {
        fixtures = state.allPlayersData.live?.fixtures || state.allPlayersData.historical?.fixtures || [];
    }

    if (!fixtures || fixtures.length === 0) return players;

    const teamFixtures = {};
    fixtures.forEach(f => {
        if (!f.finished) {
            if (!teamFixtures[f.team_h]) teamFixtures[f.team_h] = [];
            if (!teamFixtures[f.team_a]) teamFixtures[f.team_a] = [];
            teamFixtures[f.team_h].push(f);
            teamFixtures[f.team_a].push(f);
        }
    });

    for (let teamId in teamFixtures) {
        teamFixtures[teamId].sort((a, b) => a.event - b.event);
    }

    players.forEach(p => {
        const upcomingFixtures = (teamFixtures[p.team] || []);

        // Calculate xPts for next gameweek only
        const nextFixture = upcomingFixtures.slice(0, 1);
        p.predicted_points_1_gw = nextFixture.length > 0
            ? predictPointsForFixture(p, nextFixture[0])
            : 0;

        // Keep old 4GW for backward compatibility (draft analytics)
        const next4Fixtures = upcomingFixtures.slice(0, 4);
        p.predicted_points_4_gw = next4Fixtures.length > 0
            ? next4Fixtures.reduce((total, fix) => total + predictPointsForFixture(p, fix), 0)
            : 0;

    });

    return players;
}

function predictPointsForFixture(player, fixture) {
    const isHome = player.team === fixture.team_h;
    const opponentTeamId = isHome ? fixture.team_a : fixture.team_h;

    const playerTeam = state.teamStrengthData[player.team];
    const opponentTeam = state.teamStrengthData[opponentTeamId];
    if (!playerTeam || !opponentTeam) return 0;

    const pos = player.position_name;
    const gamesPlayed = Math.max((player.minutes || 0) / 90, 0.1);

    // ============================================
    // 1️⃣ TRANSFER MOMENTUM (17%) 🔥
    // ============================================
    const netTransfers = (player.transfers_in_event || 0) - (player.transfers_out_event || 0);
    const transferMomentum = Math.min(Math.max(netTransfers / 50, -1), 1); // Normalize to [-1, 1]
    const transferScore = (transferMomentum + 1) * 50; // Convert to [0, 100]

    // ============================================
    // 2️⃣ FORM (28%) 📈
    // ============================================
    const form = parseFloat(player.form) || 0;
    const formScore = Math.min(form * 10, 100); // 10 form = 100

    // ============================================
    // 3️⃣ xGI PER 90 (25%) ⚽
    // ============================================
    const xgiScore = Math.min((player.xGI_per90 || 0) * 100, 100); // 1.0 xGI/90 = 100

    // ============================================
    // 4️⃣ FIXTURE DIFFICULTY (20%) 🎯
    // ============================================
    const attackScore = isHome ? playerTeam.strength_attack_home : playerTeam.strength_attack_away;
    const defenseScore = isHome ? opponentTeam.strength_defence_home : opponentTeam.strength_defence_away;
    const fixtureDifficulty = (attackScore / Math.max(defenseScore, 1)) * 50; // Normalize
    const fixtureScore = Math.min(fixtureDifficulty, 100);

    // ============================================
    // 5️⃣ TEAM ATTACK STRENGTH (10%) 💪
    // ============================================
    const teamAttackStrength = (attackScore / 1300) * 100; // Normalize (1300 is typical max)
    const teamScore = Math.min(teamAttackStrength, 100);

    // ============================================
    // 🎯 WEIGHTED PREDICTION MODEL
    // ============================================
    const baseScore = (
        transferScore * 0.17 +      // 17% Transfer Momentum
        formScore * 0.28 +           // 28% Form
        xgiScore * 0.25 +            // 25% xGI per 90
        fixtureScore * 0.20 +        // 20% Fixture Difficulty
        teamScore * 0.10             // 10% Team Attack Strength
    );

    // ============================================
    // ⏱️ EXPECTED MINUTES — everything below scales by it
    // ============================================
    // starts/appearances where we have it, minutes-per-game otherwise. A player
    // who plays 30 minutes off the bench cannot return a defender's clean sheet
    // or a striker's xG, so scaling the concrete terms by expected minutes
    // matters more than any weighting choice in the blend above.
    const minutesPerGame = (player.minutes || 0) / Math.max(gamesPlayed, 1);
    const startShare = Number.isFinite(player.rotation_risk) ? player.rotation_risk : null;
    const expectedMinutes = startShare !== null
        ? Math.min(90, startShare * 85 + (1 - startShare) * 20)
        : Math.min(90, minutesPerGame);
    const minuteShare = expectedMinutes / 90;

    // ============================================
    // 🚑 AVAILABILITY — injuries and suspensions
    // ============================================
    // The site computed availability_grade and then never used it here, so an
    // injured player kept a full projection. `status` letters: a=available,
    // d=doubtful, i=injured, s=suspended, u=unavailable, n=not in squad.
    let availability = 1;
    const status = player.status || 'a';
    if (status === 'i' || status === 's' || status === 'u' || status === 'n') {
        availability = 0;
    } else {
        const chance = player.chance_of_playing_next_round;
        if (chance !== null && chance !== undefined) availability = Math.max(0, Math.min(1, chance / 100));
        else if (status === 'd') availability = 0.6;
    }

    // ============================================
    // 🎯 FIXTURE MULTIPLIER — centred on 1.0
    // ============================================
    // attack/defence ratio, damped so a dream fixture is worth roughly +35% and
    // a nightmare roughly -25% rather than swinging the whole projection.
    const rawRatio = attackScore / Math.max(defenseScore, 1);
    const fixtureMultiplier = Math.max(0.75, Math.min(1.35, 1 + (rawRatio - 1) * 0.6));

    // ============================================
    // ⚽ GOALS AND ASSISTS
    // ============================================
    // expected_goals_per_90 is ALREADY per 90. The old code divided it by 90
    // again, which made this whole term ~1/90th of its true size — the goal and
    // assist contribution was effectively absent from every projection.
    const xg90 = parseFloat(player.expected_goals_per_90) || 0;
    const xa90 = parseFloat(player.expected_assists_per_90) || 0;
    const GOAL_POINTS = { GKP: 10, DEF: 6, MID: 5, FWD: 4 };
    const goalValueBonus = (
        xg90 * (GOAL_POINTS[pos] || 4) + xa90 * 3
    ) * minuteShare * fixtureMultiplier;

    // ============================================
    // 🛡️ CLEAN SHEET — from xGC where the API gives it
    // ============================================
    // Expected goals conceded is a far better clean-sheet estimate than a team
    // strength ratio: P(0 goals) under a Poisson with mean xGC is exp(-xGC).
    const CS_POINTS = { GKP: 4, DEF: 4, MID: 1, FWD: 0 };
    let cleanSheetBonus = 0;
    let concededPenalty = 0;
    if (CS_POINTS[pos]) {
        const xgc90 = parseFloat(player.expected_goals_conceded_per_90) || 0;
        let csProb;
        if (xgc90 > 0) {
            // Adjust the player's season-long xGC for this specific opponent.
            const oppAttack = isHome ? opponentTeam.strength_attack_home : opponentTeam.strength_attack_away;
            const defStrength = isHome ? playerTeam.strength_defence_home : playerTeam.strength_defence_away;
            const oppMultiplier = Math.max(0.7, Math.min(1.4, oppAttack / Math.max(defStrength, 1)));
            csProb = Math.exp(-xgc90 * oppMultiplier);
        } else {
            const defStrength = isHome ? playerTeam.strength_defence_home : playerTeam.strength_defence_away;
            const oppAttack = isHome ? opponentTeam.strength_attack_home : opponentTeam.strength_attack_away;
            csProb = Math.max(0.05, Math.min(0.6, (defStrength / Math.max(oppAttack, 1)) * 0.32));
        }
        // A clean sheet only pays if the player lasts 60 minutes.
        const sixtyPlus = Math.max(0, Math.min(1, (expectedMinutes - 45) / 30));
        cleanSheetBonus = csProb * CS_POINTS[pos] * sixtyPlus * (isHome ? 1.05 : 0.95);

        // -1 per 2 goals conceded, GKP/DEF only.
        if (pos === 'GKP' || pos === 'DEF') {
            const expectedConceded = (parseFloat(player.expected_goals_conceded_per_90) || 1.4) * minuteShare;
            concededPenalty = -(expectedConceded / 2);
        }
    }

    // ============================================
    // 🧱 DEFENSIVE CONTRIBUTION (new for 2025/26, unchanged for 2026/27)
    // ============================================
    // +2 when a defender reaches 10 CBIT or a mid/forward 12 CBIRT. It is a
    // per-match threshold, so the hit-rate is the expectation — and for a
    // defensive midfielder it is worth more than his goal threat.
    let defconBonus = 0;
    if (pos !== 'GKP') {
        const hitRate = player.defcon_hit_rate;
        if (hitRate !== null && hitRate !== undefined) {
            defconBonus = (hitRate / 100) * 2 * minuteShare;
        } else {
            // No per-match history: ramp off the per-90 rate around the threshold.
            const dc90 = parseFloat(player.def_contrib_per90) || 0;
            const threshold = pos === 'DEF' ? 10 : 12;
            defconBonus = Math.max(0, Math.min(1, (dc90 - threshold * 0.6) / (threshold * 0.7))) * 2 * minuteShare;
        }
    }

    // ============================================
    // 🧤 GOALKEEPER SAVES — buffed by the 2026/27 BPS rework
    // ============================================
    let savesBonus = 0;
    if (pos === 'GKP') {
        const saves90 = parseFloat(player.saves_per_90) || 0;
        savesBonus = (saves90 * minuteShare) / 3; // 1 point per 3 saves
    }

    // ============================================
    // ⭐ BONUS POINTS POTENTIAL
    // ============================================
    // Historical bonus is the best available prior, but 2026/27 reweighted BPS
    // (clearances/blocks/interceptions are worth less per point, goalkeeper
    // saves more), so last season's rate is a slightly biased estimate.
    const bonusPerGame = (player.bonus || 0) / Math.max(gamesPlayed, 1);
    const bonusPoints = bonusPerGame * 0.6 * minuteShare;

    // ============================================
    // 🎬 APPEARANCE POINTS
    // ============================================
    // 1 point for playing at all, 2 from 60 minutes.
    const playsAtAll = Math.max(0, Math.min(1, expectedMinutes / 25));
    const playsSixty = Math.max(0, Math.min(1, (expectedMinutes - 45) / 30));
    const appearancePoints = playsAtAll + playsSixty;

    // ============================================
    // 🎲 FINAL PREDICTION
    // ============================================
    // The blend above stays in as a form/momentum modifier, at a much smaller
    // weight than before: it is a sentiment signal, while everything else here
    // is an expected-points calculation.
    const formModifier = (baseScore / 100) * 1.6;

    const rawPrediction = appearancePoints
        + goalValueBonus
        + cleanSheetBonus
        + concededPenalty
        + defconBonus
        + savesBonus
        + bonusPoints
        + formModifier;

    const predictedPoints = rawPrediction * availability;

    return Math.max(0, Math.min(predictedPoints, 20)); // Cap at 20 points per game
}

/**
 * Calculate Stability Index for a player
 * Measures consistency/reliability (0-100, higher = more stable)
 * 
 * Based on:
 * 1. Form consistency (40%) - Higher form = more stable
 * 2. xG accuracy (30%) - xG close to actual goals = predictable
 * 3. Minutes consistency (20%) - Playing regularly = reliable
 * 4. Points variance (10%) - Points per game variation
 */
function calculateStabilityIndex(player) {
    const gamesPlayed = Math.max((player.minutes || 0) / 90, 0.1);

    // 1. Form Factor (40%) - Higher form = more stable recent performance
    const form = parseFloat(player.form) || 0;
    const formStability = Math.min(form * 10, 100); // 10 form = 100 stability

    // 2. xG Accuracy (30%) - How predictable are the player's returns?
    const actualGoals = player.goals_scored || 0;
    const expectedGoals = parseFloat(player.expected_goals) || 0;
    const goalsPerGame = actualGoals / gamesPlayed;
    const xGPerGame = expectedGoals / gamesPlayed;

    // Calculate how close actual is to expected (lower diff = more stable)
    const xGDiff = Math.abs(goalsPerGame - xGPerGame);
    const xGAccuracy = Math.max(0, 100 - (xGDiff * 100)); // Perfect match = 100

    // 3. Minutes Stability (20%) - Playing regularly
    const minutesPlayed = player.minutes || 0;
    const appearancesEstimate = Math.max((player.appearances || gamesPlayed), 1);
    const minutesPerAppearance = minutesPlayed / appearancesEstimate;
    const minutesStability = Math.min((minutesPerAppearance / 90) * 100, 100); // 90 min/game = 100

    // 4. Points Variance (10%) - Using coefficient of variation approach
    const totalPoints = player.total_points || 0;
    const pointsPerGame = totalPoints / gamesPlayed;

    // Estimate variance using form as proxy (form is avg last 5 GW)
    // If form is close to PPG, variance is low (stable)
    const formVsPPG = Math.abs(form - pointsPerGame);
    const pointsStability = Math.max(0, 100 - (formVsPPG * 20)); // Small diff = stable

    // Calculate weighted stability index
    const stabilityIndex = (
        formStability * 0.40 +      // 40% Form
        xGAccuracy * 0.30 +          // 30% xG Accuracy
        minutesStability * 0.20 +    // 20% Minutes
        pointsStability * 0.10       // 10% Points Variance
    );

    return Math.round(Math.max(0, Math.min(stabilityIndex, 100)));
}

function calculateAdvancedScores(players) {
    // Filter out players with less than 180 minutes (2 full games)
    const activePlayers = players.filter(p => (p.minutes || 0) >= 180);

    // Calculate percentiles for all metrics (only for active players)
    const metricsToPercentile = [
        { key: 'xGI_per90', asc: false },
        { key: 'def_contrib_per90', asc: false },
        { key: 'creativity_per_90', asc: false },
        { key: 'saves_per_90', asc: false },
        { key: 'clean_sheets_per_90', asc: false },
        { key: 'threat_per_90', asc: false },
        { key: 'now_cost', asc: true },
        { key: 'form', asc: false },
        { key: 'minutes', asc: false },
        { key: 'total_points', asc: false },
        { key: 'bonus', asc: false },
        { key: 'clean_sheets', asc: false },
        { key: 'selected_by_percent', asc: false },
        { key: 'dreamteam_count', asc: false }
    ];
    metricsToPercentile.forEach(m => calculatePercentiles(activePlayers, m.key, m.asc));

    // Calculate scores for active players
    activePlayers.forEach(p => {
        const pos = p.position_name;
        const minutes = p.minutes || 1; // Avoid division by zero
        const gamesPlayed = Math.max(minutes / 90, 0.1); // At least 0.1 to avoid division by zero

        // Calculate per-game metrics
        const goalsPerGame = (p.goals_scored || 0) / gamesPlayed;
        const assistsPerGame = (p.assists || 0) / gamesPlayed;
        const gaPerGame = goalsPerGame + assistsPerGame;
        const xgPerGame = (parseFloat(p.expected_goals) || 0) / gamesPlayed;
        const xaPerGame = (parseFloat(p.expected_assists) || 0) / gamesPlayed;
        const xgiPerGame = xgPerGame + xaPerGame;

        // 1. נקודות בפועל (35%) - הכי חשוב! 🏆
        const totalPoints = p.total_points || 0;
        const pointsScore = Math.min(totalPoints / 2, 100); // Normalize: 200 pts = 100

        // 2. תרומה הגנתית (15%) - DefCon 🛡️
        const defconScore = p.percentiles.def_contrib_per90 || 0;

        // 3. G+A per game (12%) ⚽
        const gaPerGameNorm = Math.min(gaPerGame * 50, 100); // 2 G+A per game = 100

        // 4. xG per game (12%) 📈
        const xgPerGameNorm = Math.min(xgiPerGame * 50, 100); // 2 xGI per game = 100

        // 5. איכות משחק (10%) - xGI/90, creativity 🎯
        let qualityScore = 0;
        if (pos === 'GKP') {
            qualityScore = (p.percentiles.saves_per_90 || 0) * 0.6 + (p.percentiles.clean_sheets_per_90 || 0) * 0.4;
        } else if (pos === 'DEF') {
            qualityScore = (p.percentiles.xGI_per90 || 0) * 0.3 + (p.percentiles.def_contrib_per90 || 0) * 0.4 + (p.percentiles.clean_sheets_per_90 || 0) * 0.3;
        } else if (pos === 'MID') {
            qualityScore = (p.percentiles.xGI_per90 || 0) * 0.5 + (p.percentiles.creativity_per_90 || 0) * 0.4 + (p.percentiles.def_contrib_per90 || 0) * 0.1;
        } else if (pos === 'FWD') {
            qualityScore = (p.percentiles.xGI_per90 || 0) * 0.7 + (p.percentiles.threat_per_90 || 0) * 0.3;
        }

        // 6. אחוז בעלות (8%) - inverted: lower is better for draft 💎
        const ownershipScore = 100 - (p.percentiles.selected_by_percent || 0);

        // 7. בונוס (8%) ⭐
        const bonusScore = p.percentiles.bonus || 0;

        // Calculate final draft score with weights
        p.draft_score = (
            pointsScore * 0.35 +          // 35% נקודות בפועל
            defconScore * 0.15 +          // 15% תרומה הגנתית
            gaPerGameNorm * 0.12 +        // 12% G+A למשחק
            xgPerGameNorm * 0.12 +        // 12% xG למשחק
            qualityScore * 0.10 +         // 10% איכות משחק
            ownershipScore * 0.08 +       // 8% אחוז בעלות (inverted)
            bonusScore * 0.08             // 8% בונוס
        );

        // Store component scores for debugging/display
        p.quality_score = qualityScore;
        p.base_score = pointsScore;
        p.performance_score = pointsScore;
        p.ga_per_game = gaPerGame;
        p.xgi_per_game = xgiPerGame;

        // ============================================
        // 📊 STABILITY INDEX - New!
        // ============================================
        // Measures player consistency (0-100, higher = more stable)
        p.stability_index = calculateStabilityIndex(p);

        // Calculate predictions for future reference
        p = calculateAllPredictions([p])[0];
    });

    // Set draft_score to 0 for inactive players (less than 180 minutes)
    players.forEach(p => {
        if ((p.minutes || 0) < 180) {
            p.draft_score = 0;
            p.quality_score = 0;
            p.base_score = 0;
            p.performance_score = 0;
            p.ga_per_game = 0;
            p.xgi_per_game = 0;
        }
    });

    players.sort((a, b) => b.draft_score - a.draft_score);

    // Assign rank based on draft_score order
    players.forEach((p, i) => p.rank = i + 1);

    return players;
}

function sortTableDraft(field) {
    const standingsData = state.draft._standingsData;
    if (!standingsData || !standingsData.length) return;

    const currentSort = state.draft._standingsSort;
    let direction = 'desc';

    if (currentSort && currentSort.field === field) {
        direction = currentSort.direction === 'desc' ? 'asc' : 'desc';
    }

    state.draft._standingsSort = { field, direction };

    standingsData.sort((a, b) => {
        const aVal = a[field];
        const bVal = b[field];
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return direction === 'desc' ? bVal - aVal : aVal - bVal;
        } else {
            return direction === 'desc' ? String(bVal).localeCompare(String(aVal)) : String(aVal).localeCompare(String(bVal));
        }
    });

    const tbody = document.querySelector('#draftStandingsTable tbody');
    if (tbody) {
        tbody.innerHTML = standingsData.map(s => `
            <tr>
                <td>${s.rank}</td>
                <td>${s.manager}</td>
                <td>${s.team}</td>
                <td>${s.wins}</td>
                <td>${s.draws}</td>
                <td>${s.losses}</td>
                <td>${s.pf}</td>
                <td>${s.pa}</td>
                <td>${s.diff > 0 ? '+' : ''}${s.diff}</td>
                <td>${s.total}</td>
            </tr>
        `).join('');
    }
}

// REMOVED: Duplicate showTab function - using the one at line ~4803 instead

function getProcessedByElementId() {
    // Check if we're in demo mode first
    if (state.currentDataSource === 'demo' && state.allPlayersData.demo && state.allPlayersData.demo.processed) {
        const map = new Map();
        state.allPlayersData.demo.processed.forEach(p => map.set(p.id, p));
        return map;
    }

    // Otherwise use live or historical data
    // Since rostersByEntryId now stores FPL IDs (not Draft IDs), 
    // we only need to map by FPL ID
    const processed = (state.allPlayersData.live && state.allPlayersData.live.processed) || (state.allPlayersData.historical && state.allPlayersData.historical.processed) || [];
    const map = new Map();

    processed.forEach(p => {
        map.set(p.id, p); // Map by FPL ID only
    });

    return map;
}

function pickStartingXI(playerIds) {
    const processedById = getProcessedByElementId();
    const players = playerIds.map(id => processedById.get(id)).filter(Boolean);

    const byPos = { GKP: [], DEF: [], MID: [], FWD: [] };
    players.forEach(p => byPos[p.position_name].push(p));

    const sortFn = (a, b) => b.draft_score - a.draft_score;
    Object.values(byPos).forEach(arr => arr.sort(sortFn));

    const gk = byPos.GKP.slice(0, 1);
    const def = byPos.DEF.slice(0, 4);
    const mid = byPos.MID.slice(0, 4);
    const fwd = byPos.FWD.slice(0, 2);

    let needed = 11 - (gk.length + def.length + mid.length + fwd.length);
    if (needed > 0) {
        const pool = [...byPos.DEF.slice(4), ...byPos.MID.slice(4), ...byPos.FWD.slice(2)].sort(sortFn);
        for (let i = 0; i < needed && i < pool.length; i++) mid.push(pool[i]);
    }

    return [...gk, ...def, ...mid, ...fwd].map(p => p.id);
}

function getCurrentEventId() {
    const data = (state.allPlayersData.live && state.allPlayersData.live.raw) || (state.allPlayersData.historical && state.allPlayersData.historical.raw);
    if (!data || !data.events) return 1;

    const current = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
    if (current) return current.id;

    const maxFinished = [...data.events].filter(e => e.finished || e.finished_provisional).sort((a, b) => b.id - a.id)[0];
    return maxFinished ? maxFinished.id : 1;
}

function getCompletedGWCount() {
    const data = (state.allPlayersData.live && state.allPlayersData.live.raw) || (state.allPlayersData.historical && state.allPlayersData.historical.raw);
    if (!data || !data.events) return 0;
    return data.events.filter(e => e.finished || e.finished_provisional).length;
}

function getPlayerImageUrl(player) {
    const base = 'https://resources.premierleague.com/premierleague/photos/players/110x140';
    const code = player && player.code ? player.code : null;
    if (code) return config.urls.playerImage(code);
    const photo = player && player.photo ? String(player.photo).split('.')[0] : null;
    if (photo) return `${base}/p${photo}.png`;
    return config.urls.missingPlayerImage;
}

function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(217, 217, 217, ${alpha})`; // Default grey for safety
    let c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length == 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return `rgba(${[(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',')},${alpha})`;
    }
    console.error('Bad Hex:', hex);
    return `rgba(217, 217, 217, ${alpha})`; // Fallback for bad hex
}

function getTeamColor(name) {
    // Pastel versions of the main 9 colors for consistency
    const palette = [
        '#93c5fd', // Light Blue (pastel version of #3b82f6)
        '#fca5a5', // Light Red (pastel version of #ef4444)
        '#86efac', // Light Green (pastel version of #10b981)
        '#fcd34d', // Light Orange (pastel version of #f59e0b)
        '#c4b5fd', // Light Purple (pastel version of #8b5cf6)
        '#f9a8d4', // Light Pink (pastel version of #ec4899)
        '#67e8f9', // Light Cyan (pastel version of #06b6d4)
        '#bef264', // Light Lime (pastel version of #84cc16)
        '#fdba74'  // Light Deep Orange (pastel version of #f97316)
    ];
    if (!name) return '#d9d9d9'; // Return grey for safety if name is falsy
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palette[Math.abs(hash) % palette.length];
}

let _draftBackgroundLoad = null;

/* ==========================================================================
   DRAFT LEAGUE ENDPOINTS
   Four endpoints the app used to ignore. Each replaces a guess with the
   league's own answer. All go through the same cached+proxied path.
   ========================================================================== */

/**
 * Draft element id -> the element id of the player in the dataset on screen.
 *
 * This is the cross-season join, and getting it wrong is silent: the draft
 * league is a 2026/27 league, so its elements map to 2026/27 FPL ids, while the
 * table before the season starts is showing the 2025/26 snapshot, whose ids are
 * last season's. FPL reassigns element ids every year, so joining on id across
 * that boundary attributes one player's ownership to an unrelated player. It
 * did: element-status and the rosters agreed on only 75 of ~134 players, and
 * Haaland came out unowned.
 *
 * `code` is the stable per-player key, so the hop is
 *     draft element -> live FPL element -> code -> displayed element.
 *
 * Returns null when the player cannot be resolved. Callers must treat that as
 * "unknown", never as an id — the previous fallback returned the draft id
 * itself, which then collided with whichever unrelated player happened to hold
 * that number.
 */
let _ownershipResolver = { key: null, codeByLiveId: null, idByCode: null };

function ownershipResolver() {
    const source = state.currentDataSource;
    const processed = state.allPlayersData[source]?.processed || [];
    const live = state.allPlayersData.live?.raw?.elements || [];
    const key = `${source}:${processed.length}:${live.length}`;
    if (_ownershipResolver.key !== key) {
        _ownershipResolver = {
            key,
            codeByLiveId: new Map(live.map(p => [p.id, p.code])),
            idByCode: new Map(processed.filter(p => p.code).map(p => [p.code, p.id]))
        };
    }
    return _ownershipResolver;
}

function toFplId(draftElementId) {
    const liveId = state.draft.draftToFplIdMap.get(draftElementId);
    if (!liveId) return null;

    const { codeByLiveId, idByCode } = ownershipResolver();
    // Same season on both sides: the live id is already the displayed id.
    if (state.currentDataSource === 'live') return liveId;

    const code = codeByLiveId.get(liveId);
    if (code === undefined) return null;
    return idByCode.get(code) ?? null;
}

/**
 * league/{id}/element-status — who owns whom, according to the league.
 *
 * The app used to derive this by diffing every roster, which broke whenever a
 * single picks request failed: those players silently became "free agents".
 * This is one request and it is authoritative.
 *
 * Before the draft every owner is null. That is a real answer, not a failure,
 * and it is what the API returns right now for the 2026/27 season — so
 * `draftHasHappened` distinguishes "nobody owns anyone yet" from "we do not
 * know", which are very different things to show a user.
 */
async function loadDraftElementStatus() {
    const leagueId = state.draft.leagueId;
    const url = config.corsProxy + encodeURIComponent(config.urls.draftElementStatus(leagueId));
    try {
        const data = await fetchWithCache(url, `fpl_draft_element_status_${leagueId}`, 5);
        if (!data || !Array.isArray(data.element_status)) return false;

        const owned = new Set();
        let unresolved = 0;
        state.draft.ownershipByFplId.clear();
        data.element_status.forEach(row => {
            const fplId = toFplId(row.element);
            // An element we cannot resolve to the dataset on screen is unknown,
            // not unowned and certainly not "owned under some other player's
            // id". Skipping keeps the set honest.
            if (fplId === null) { unresolved++; return; }
            state.draft.ownershipByFplId.set(fplId, row.owner ?? null);
            if (row.owner != null) owned.add(fplId);
        });
        if (unresolved) console.log(`   ${unresolved} draft elements not resolvable to the current season's data`);

        state.draft.ownershipLoaded = true;
        state.draft.draftHasHappened = owned.size > 0;
        if (owned.size > 0) {
            // Only replace the roster-derived set once there is something in it.
            state.draft.ownedElementIds = owned;
        }
        console.log(`🧾 element-status: ${data.element_status.length} players, ${owned.size} owned`);
        invalidateSignals();
        return true;
    } catch (e) {
        console.warn('element-status unavailable, falling back to roster diffing:', e.message);
        return false;
    }
}

/**
 * entry/{id}/history — real cumulative points per gameweek, per manager.
 * This is the data the progress chart used to invent.
 */
async function loadEntryHistories(entries) {
    const results = await mapWithConcurrency(entries, 4, async entry => {
        const url = config.corsProxy + encodeURIComponent(config.urls.draftEntryHistory(entry.entry_id));
        try {
            const data = await fetchWithCache(url, `fpl_draft_history_${entry.entry_id}`, 30);
            if (!data || !Array.isArray(data.history)) return null;
            return { entryId: entry.id, history: data.history };
        } catch (e) {
            console.warn(`history for entry ${entry.entry_id} unavailable:`, e.message);
            return null;
        }
    });

    results.filter(Boolean).forEach(r => state.draft.historyByEntryId.set(r.entryId, r.history));
    console.log(`📈 entry histories: ${state.draft.historyByEntryId.size}/${entries.length}`);
    return state.draft.historyByEntryId;
}

/** draft/{league}/choices — the original draft board, pick by pick. */
async function loadDraftChoices() {
    const leagueId = state.draft.leagueId;
    const url = config.corsProxy + encodeURIComponent(config.urls.draftChoices(leagueId));
    try {
        // Effectively immutable once the draft is done.
        const data = await fetchWithCache(url, `fpl_draft_choices_${leagueId}`, 1440);
        if (!data || !Array.isArray(data.choices)) return null;
        state.draft.choices = data.choices;
        console.log(`🎲 draft board: ${data.choices.length} picks`);
        return data.choices;
    } catch (e) {
        console.warn('draft choices unavailable:', e.message);
        return null;
    }
}

/** draft/league/{id}/transactions — the waiver and free-agent feed. */
async function loadDraftTransactions() {
    const leagueId = state.draft.leagueId;
    const url = config.corsProxy + encodeURIComponent(config.urls.draftTransactions(leagueId));
    try {
        const data = await fetchWithCache(url, `fpl_draft_transactions_${leagueId}`, 15);
        if (!data || !Array.isArray(data.transactions)) return null;
        state.draft.transactions = data.transactions;
        console.log(`🔁 transactions: ${data.transactions.length}`);
        return data.transactions;
    } catch (e) {
        console.warn('transactions unavailable:', e.message);
        return null;
    }
}

/* ---------------------- views over the new endpoints --------------------- */

/**
 * Team name for a manager id.
 *
 * The draft endpoints are inconsistent about which id they hand back:
 * league_entries and the standings key on `id`, while transactions and choices
 * use `entry_id`. Checking both is why the transaction feed stopped labelling
 * almost every row "unknown".
 */
function teamNameForEntry(entryId) {
    return state.draft.entryIdToTeamName.get(entryId)
        || state.draft.entryEntryIdToTeamName.get(entryId)
        || 'לא ידוע';
}

/**
 * Display name for a Draft API element id. Prefers the processed FPL player,
 * and falls back to the draft bootstrap's own name for players who have since
 * left the league and so have no FPL entry to map onto.
 */
function playerNameForDraftElement(draftElementId) {
    const fplId = toFplId(draftElementId);
    const p = fplId === null ? null : getProcessedByElementId().get(fplId);
    if (p) return p.web_name;
    return state.draft.draftElementNames.get(draftElementId) || `#${draftElementId}`;
}

/**
 * The league's waiver and free-agent activity, newest first, plus who has been
 * most active. Replaces guessing at market movement from ownership deltas.
 */
function renderTransactionsFeed() {
    const container = document.getElementById('transactionsFeed');
    if (!container) return;

    const all = state.draft.transactions;
    if (!Array.isArray(all)) {
        container.innerHTML = '<p class="feed-empty">יומן התנועות עוד נטען…</p>';
        return;
    }
    // 'a' = accepted. Denied waiver claims are noise in a market view.
    const accepted = all.filter(t => t.result === 'a');
    if (!accepted.length) {
        container.innerHTML = '<p class="feed-empty">עוד לא בוצעו תנועות בליגה העונה</p>';
        return;
    }

    const byEntry = new Map();
    accepted.forEach(t => byEntry.set(t.entry, (byEntry.get(t.entry) || 0) + 1));
    const busiest = [...byEntry.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

    const addCounts = new Map();
    accepted.forEach(t => {
        addCounts.set(t.element_in, (addCounts.get(t.element_in) || 0) + 1);
    });
    const trending = [...addCounts.entries()]
        .filter(([, n]) => n > 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const recent = [...accepted].sort((a, b) => (b.event - a.event) || (b.index - a.index)).slice(0, 25);

    container.innerHTML = `
        <div class="feed-summary">
            <div class="feed-stat"><span class="feed-stat-value">${accepted.length}</span>
                <span class="feed-stat-label">תנועות שאושרו</span></div>
            <div class="feed-stat"><span class="feed-stat-value">${byEntry.size}</span>
                <span class="feed-stat-label">קבוצות פעילות</span></div>
            ${busiest.length ? `<div class="feed-stat feed-stat-wide">
                <span class="feed-stat-label">הכי פעילות</span>
                <span class="feed-stat-value-sm">${busiest.map(([id, n]) =>
                    `${escapeHtml(teamNameForEntry(id))} (${n})`).join(' · ')}</span></div>` : ''}
        </div>

        ${trending.length ? `<div class="feed-trending">
            <h4>הכי מבוקשים</h4>
            <div class="feed-chips">${trending.map(([id, n]) =>
                `<span class="feed-chip">${escapeHtml(playerNameForDraftElement(id))}
                    <b>${n}×</b></span>`).join('')}</div>
        </div>` : ''}

        <ol class="feed-list">
            ${recent.map(t => `
                <li class="feed-item">
                    <span class="feed-gw">GW${t.event}</span>
                    <span class="feed-team">${escapeHtml(teamNameForEntry(t.entry))}</span>
                    <span class="feed-move">
                        <span class="feed-in">▲ ${escapeHtml(playerNameForDraftElement(t.element_in))}</span>
                        <span class="feed-out">▼ ${escapeHtml(playerNameForDraftElement(t.element_out))}</span>
                    </span>
                    <span class="feed-kind">${t.kind === 'w' ? 'וויוור' : 'שחקן חופשי'}</span>
                </li>`).join('')}
        </ol>`;
}

/**
 * The original draft board with what each pick actually returned. Points come
 * from the season the app is currently showing, so before a ball is kicked this
 * reads as "what last season says about the picks we made".
 */
function renderDraftBoardHistory() {
    const container = document.getElementById('draftBoardHistory');
    if (!container) return;

    const choices = state.draft.choices;
    if (!Array.isArray(choices)) {
        container.innerHTML = '<p class="feed-empty">לוח הדראפט עוד נטען…</p>';
        return;
    }
    if (!choices.length) {
        container.innerHTML = '<p class="feed-empty">הדראפט של העונה טרם התקיים</p>';
        return;
    }

    const processedById = getProcessedByElementId();
    const rows = choices.map(c => {
        const fplId = toFplId(c.element);
        const p = fplId === null ? null : processedById.get(fplId);
        return {
            round: c.round, pick: c.pick, wasAuto: c.was_auto,
            team: c.entry_name || teamNameForEntry(c.entry),
            name: playerNameForDraftElement(c.element),
            points: p ? (p.total_points || 0) : null,
            pos: p ? p.position_name : ''
        };
    });

    // Value over the pick slot: how a pick did against the others made near it.
    const scored = rows.filter(r => r.points !== null).sort((a, b) => b.points - a.points);
    const rankByPick = new Map(scored.map((r, i) => [`${r.round}:${r.pick}`, i + 1]));

    const rounds = [...new Set(rows.map(r => r.round))].sort((a, b) => a - b);
    const best = scored.slice(0, 3);
    const worstEarly = scored.filter(r => r.round <= 3).slice(-3).reverse();

    container.innerHTML = `
        <div class="feed-summary">
            <div class="feed-stat"><span class="feed-stat-value">${rows.length}</span>
                <span class="feed-stat-label">בחירות</span></div>
            <div class="feed-stat"><span class="feed-stat-value">${rounds.length}</span>
                <span class="feed-stat-label">סבבים</span></div>
            <div class="feed-stat"><span class="feed-stat-value">${rows.filter(r => r.wasAuto).length}</span>
                <span class="feed-stat-label">בחירות אוטומטיות</span></div>
        </div>

        <div class="board-highlights">
            <div class="board-col">
                <h4>הבחירות ששילמו</h4>
                <ol>${best.map(r => `<li><b>${escapeHtml(r.name)}</b> ${r.points} נק׳
                    <span class="board-meta">סבב ${r.round} · ${escapeHtml(r.team)}</span></li>`).join('')}</ol>
            </div>
            <div class="board-col">
                <h4>אכזבות הסבבים המוקדמים</h4>
                <ol>${worstEarly.map(r => `<li><b>${escapeHtml(r.name)}</b> ${r.points} נק׳
                    <span class="board-meta">סבב ${r.round} · ${escapeHtml(r.team)}</span></li>`).join('')}</ol>
            </div>
        </div>

        <div class="board-rounds">
            ${rounds.map(rd => `
                <details class="board-round" ${rd <= 2 ? 'open' : ''}>
                    <summary>סבב ${rd}</summary>
                    <ol class="board-picks">
                        ${rows.filter(r => r.round === rd).sort((a, b) => a.pick - b.pick).map(r => `
                            <li class="board-pick">
                                <span class="board-num">${r.pick}</span>
                                <span class="board-player"><b>${escapeHtml(r.name)}</b>
                                    <em>${escapeHtml(r.pos)}</em></span>
                                <span class="board-team">${escapeHtml(r.team)}</span>
                                <span class="board-points">${r.points === null ? '—' : `${r.points} נק׳`}</span>
                                <span class="board-rank">${rankByPick.has(`${r.round}:${r.pick}`)
                                    ? `#${rankByPick.get(`${r.round}:${r.pick}`)}` : ''}</span>
                                ${r.wasAuto ? '<span class="board-auto" title="נבחר אוטומטית">⏱</span>' : ''}
                            </li>`).join('')}
                    </ol>
                </details>`).join('')}
        </div>`;
}

async function loadDraftDataInBackground() {
    // Called from both init() and fetchAndProcessData(); without this the whole
    // draft load ran twice per page load, clearing each other's caches midway.
    if (_draftBackgroundLoad) return _draftBackgroundLoad;
    _draftBackgroundLoad = _loadDraftDataInBackground()
        .finally(() => { _draftBackgroundLoad = null; });
    return _draftBackgroundLoad;
}

async function _loadDraftDataInBackground() {
    // Load draft data silently in the background without showing loading overlay
    try {
        const detailsUrl = `${config.corsProxy}${encodeURIComponent(`https://draft.premierleague.com/api/league/${state.draft.leagueId}/details`)}`;
        const detailsCacheKey = `fpl_draft_details_${state.draft.leagueId}`;

        // Clear old picks cache for background load too
        const currentGW = getCurrentEventId();
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('fpl_draft_picks_') && key.includes(`_gw${currentGW}`)) {
                localStorage.removeItem(key);
            }
        });

        const details = await fetchWithCache(detailsUrl, detailsCacheKey, 30);

        if (details && details.league_entries) {
            state.draft.details = details;

            // Process draft data to get owned players
            const currentGW = details.league?.current_event || getCurrentEventId();

            // Build entryId to team name map
            state.draft.entryIdToTeamName.clear();
            state.draft.entryEntryIdToTeamName.clear();
            details.league_entries.forEach(entry => {
                if (entry && entry.id && entry.entry_name) {
                    state.draft.entryIdToTeamName.set(entry.id, entry.entry_name);
                    if (entry.entry_id) state.draft.entryEntryIdToTeamName.set(entry.entry_id, entry.entry_name);
                }
            });

            // Fetch all team rosters
            const rosterPromises = details.league_entries
                .filter(e => e && e.id && e.entry_id)
                .map(async entry => {
                    const picksUrl = `${config.corsProxy}${encodeURIComponent(`https://draft.premierleague.com/api/entry/${entry.entry_id}/event/${currentGW}`)}`;
                    const picksCacheKey = `fpl_draft_picks_bg_${entry.entry_id}_gw${currentGW}`;
                    try {
                        const picksData = await fetchWithCache(picksUrl, picksCacheKey, 30);
                        if (picksData && picksData.picks) {
                            // Resolve to the dataset on screen. `|| pick.element`
                            // used to stand in for a failed lookup, which quietly
                            // handed the slot to whichever player happened to hold
                            // that id -- see toFplId for why the seasons differ.
                            const picksWithFplIds = picksData.picks
                                .map(pick => ({ fplId: toFplId(pick.element), position: pick.position }))
                                .filter(p => p.fplId !== null);

                            // Extract all FPL IDs for roster
                            const fplPlayerIds = picksWithFplIds.map(p => p.fplId);

                            // Store FPL IDs (not Draft IDs!)
                            state.draft.rostersByEntryId.set(entry.id, fplPlayerIds);

                            // Store lineup info (starting vs bench)
                            const starting = picksWithFplIds.filter(p => p.position >= 1 && p.position <= 11).map(p => p.fplId);
                            const bench = picksWithFplIds.filter(p => p.position >= 12 && p.position <= 15).map(p => p.fplId);
                            state.draft.lineupsByEntryId.set(entry.id, { starting, bench });

                            // Add to owned set (already FPL IDs)
                            fplPlayerIds.forEach(fplId => {
                                state.draft.ownedElementIds.add(fplId);
                            });
                        }
                    } catch (err) {
                        console.log(`Could not load roster for ${entry.entry_name}`);
                    }
                });

            await Promise.all(rosterPromises);

            // The league's own ownership record. This belongs in the background
            // path, not just the draft tab: VORP's replacement level and the
            // "free agent" verdict both read it, and both are on the players
            // table the user sees first.
            await loadDraftElementStatus();

            // Populate team filter with draft teams
            populateTeamFilter();

            // Ownership feeds VORP, so the metrics have to be recomputed before
            // the table is repainted — otherwise the column keeps the pre-draft
            // positional baseline all session.
            const processed = state.allPlayersData[state.currentDataSource]?.processed;
            if (processed) computeDraftMetrics(processed);
            invalidateSignals();

            // Re-render table to update draft team column
            renderTable();

            console.log('✅ Draft data loaded in background:', state.draft.ownedElementIds.size, 'players owned');
        }
    } catch (error) {
        console.log('Draft data not available:', error.message);
        // Silently fail - not critical for main page
    }
}

// Duplicate function removed - see renderNextRoundFixtures() at line ~5182

async function loadDraftLeague() {
    showLoading('טוען ליגת דראפט...');
    const draftContainer = document.getElementById('draftTabContent');
    const sectionsToClear = ['draftStandingsContent', 'draftRecommendations', 'draftAnalytics', 'draftComparison', 'draftMatrices'];

    // Clear containers that will be rendered into
    const myLineupContainer = document.getElementById('myLineupContainer');
    const otherRostersContainer = document.getElementById('otherRosters');
    if (myLineupContainer) myLineupContainer.innerHTML = '';
    if (otherRostersContainer) otherRostersContainer.innerHTML = '';

    // Show mini loaders for sections that take time
    sectionsToClear.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = `<div class="mini-loader" style="display:block;"></div>`;
        }
    });

    try {
        // Make sure we have player data loaded (demo or real)
        if (state.currentDataSource === 'demo') {
            // In demo mode, ensure demo data is loaded
            if (!state.allPlayersData.demo || !state.allPlayersData.demo.processed) {
                showToast('שגיאה', 'נתוני דמו לא נטענו. אנא רענן את הדף.', 'error', 3000);
                hideLoading();
                return;
            }
        } else {
            // For live/historical, if data is missing, try to load it
            if (!state.allPlayersData.live.raw && !state.allPlayersData.historical.raw) {
                try {
                    await fetchAndProcessData();
                } catch (e) {
                    console.error("Failed to load player data before draft:", e);
                    // If player data fails, we can't really proceed with meaningful draft data
                    showToast('שגיאה', 'כשל בטעינת נתוני שחקנים, לא ניתן לטעון ליגת דראפט', 'error', 4000);
                    hideLoading();
                    return;
                }
            }
        }

        // CRITICAL: Ensure Draft→FPL mapping is built before processing rosters
        if (state.draft.draftToFplIdMap.size === 0) {
            console.log('⚠️ Mapping not found, building now...');
            await buildDraftToFplMapping();
        } else {
            console.log(`✅ Using existing mapping: ${state.draft.draftToFplIdMap.size} players mapped`);
        }

        const detailsCacheKey = `fpl_draft_details_${config.draftLeagueId}`;
        localStorage.removeItem(detailsCacheKey);

        // 🔧 CRITICAL FIX: Also clear ALL picks cache to ensure fresh roster data
        console.log("🧹 Clearing old picks cache...");
        const draftGwForCache = getCurrentEventId(); // Get current GW for cache key
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('fpl_draft_picks_') && key.includes(`_gw${draftGwForCache}`)) {
                console.log(`   Removing cached picks: ${key}`);
                localStorage.removeItem(key);
            }
        });

        // Don't add proxy here - fetchWithCache will handle it with fallbacks
        // There is no league/{id}/standings endpoint -- the Draft API 404s it.
        // The standings live inside /details, and every consumer already falls
        // back to details.standings, so the request was pure latency plus two
        // red 404s in the console on every draft load.
        const detailsUrl = config.urls.draftLeagueDetails(config.draftLeagueId);
        const detailsData = await fetchWithCache(
            config.corsProxy + encodeURIComponent(detailsUrl), detailsCacheKey, 5);

        state.draft.details = detailsData;
        state.draft.standings = null;

        console.log("--- Draft League Debug ---");
        console.log("1. Fetched Details Data:", JSON.parse(JSON.stringify(detailsData)));

        const namedEntries = (state.draft.details?.league_entries || []).filter(e => e && e.entry_name);
        state.draft.entryIdToTeamName = new Map(namedEntries.map(e => [e.id, e.entry_name]));
        state.draft.entryEntryIdToTeamName = new Map(
            namedEntries.filter(e => e.entry_id).map(e => [e.entry_id, e.entry_name]));

        // --- Final, reliable roster population method V4 ---
        try {
            state.draft.rostersByEntryId.clear();
            state.draft.ownedElementIds.clear();

            const leagueEntries = state.draft.details?.league_entries || [];
            const draftGw = state.draft.details?.league?.current_event || getCurrentEventId();
            console.log(`2. Determined Draft GW: ${draftGw}. Found ${leagueEntries.length} league entries.`);

            const picksPromises = leagueEntries.map(async (entry) => {
                if (!entry || !entry.entry_id || !entry.id) return;

                const url = config.corsProxy + encodeURIComponent(config.urls.draftEntryPicks(entry.entry_id, draftGw));
                const picksCacheKey = `fpl_draft_picks_final_v4_${entry.entry_id}_gw${draftGw}`;

                console.log(`📥 Fetching picks for ${entry.entry_name} (Entry ID: ${entry.entry_id}, GW: ${draftGw})`);

                try {
                    // 1. Fetch picks
                    const picksData = await fetchWithCache(url, picksCacheKey, 10); // Short cache to ensure fresh data

                    if (picksData && picksData.picks) {
                        console.log(`   ✅ Received ${picksData.picks.length} picks for ${entry.entry_name}`);

                        // 2. Resolve to the dataset on screen (see toFplId).
                        const picksWithFplIds = picksData.picks
                            .map(pick => ({
                                fplId: toFplId(pick.element),
                                position: pick.position,
                                originalDraftId: pick.element
                            }))
                            .filter(p => p.fplId !== null);

                        // 3. Extract roster
                        const fplPlayerIds = picksWithFplIds.map(p => p.fplId);
                        state.draft.rostersByEntryId.set(entry.id, fplPlayerIds);

                        // Log detailed roster info for user's team (Amit United)
                        if (entry.entry_name && entry.entry_name.includes('Amit')) {
                            console.log(`🏆 AMIT UNITED ROSTER (${fplPlayerIds.length} players):`);
                            const processedById = getProcessedByElementId();
                            picksWithFplIds.forEach((pick, idx) => {
                                const player = processedById.get(pick.fplId);
                                const playerName = player ? player.web_name : 'UNKNOWN';
                                const teamName = player ? player.team_name : 'UNKNOWN';
                                console.log(`   ${idx + 1}. ${playerName} (${teamName}) - FPL ID: ${pick.fplId}, Draft ID: ${pick.originalDraftId}, Position: ${pick.position}`);
                            });
                        }

                        // 4. Extract Lineup
                        const starting = picksWithFplIds.filter(p => p.position <= 11).map(p => p.fplId);
                        const bench = picksWithFplIds.filter(p => p.position > 11).map(p => p.fplId);
                        state.draft.lineupsByEntryId.set(entry.id, { starting, bench });

                        // 5. Mark as owned
                        fplPlayerIds.forEach(id => state.draft.ownedElementIds.add(id));

                    } else {
                        console.warn(`⚠️ No picks found for ${entry.entry_name}`);
                        state.draft.rostersByEntryId.set(entry.id, []);
                    }
                } catch (err) {
                    console.error(`❌ Failed to fetch picks for ${entry.entry_name}:`, err);
                    state.draft.rostersByEntryId.set(entry.id, []);
                }
            });

            await Promise.all(picksPromises);

            console.log("3. Rosters Populated:", state.draft.rostersByEntryId.size, "teams.");

            // The league's own ownership record. Overrides whatever the roster
            // diffing concluded, because a single failed picks request used to
            // turn a whole squad into "free agents".
            await loadDraftElementStatus();

            // Everything below is additive: the tabs that need it render when it
            // arrives, and nothing blocks on it.
            const entries = (state.draft.details?.league_entries || []).filter(e => e && e.id && e.entry_id);
            Promise.allSettled([
                loadEntryHistories(entries),
                loadDraftChoices(),
                loadDraftTransactions()
            ]).then(() => {
                renderProgressChart();
                renderDraftBoardHistory();
                renderTransactionsFeed();
            });

            // "Free agent" is a signal input, so verdicts computed before the
            // rosters landed are stale — every player looked unowned.
            invalidateSignals();
            if (state.displayedData && state.displayedData.length) renderTable();

        } catch (debugError) {
            console.error("CRITICAL ERROR during roster population:", debugError);
            // Don't return, try to render what we have
        }
        // --- End of Roster Population ---
        // --- End of Roster Population ---

        console.log("4. Starting UI Rendering...");

        // Load historical lineups for analytics (async, don't wait)
        console.log("4a. Loading historical lineups in background...");
        loadHistoricalLineups().catch(err => console.error('Failed to load historical lineups:', err));

        console.log("4b. Calling renderDraftStandings()...");
        renderDraftStandings();

        console.log("4c. Calling populateMyTeamSelector()...");
        populateMyTeamSelector();

        const myTeam = findMyTeam();
        console.log("4d. Found myTeam:", myTeam);

        if (myTeam) {
            console.log("4e. Calling renderMyLineup() for team:", myTeam.id);
            renderMyLineup(myTeam.id);

            console.log("4f. Calling renderNextRivalAnalysis()...");
            renderNextRivalAnalysis();
        } else {
            console.log("4e. No myTeam found, calling renderMyLineup(null)");
            renderMyLineup(null);
        }

        // Initialize Trend Chart
        if (state.draft.details) {
            console.log("4g. Calling renderAllTeamsTrendChart()...");

            // Render next round fixtures in dedicated container
            const fixturesContainer = document.getElementById('nextFixturesOverview');
            if (fixturesContainer) {
                const fixturesHtml = renderNextRoundFixtures();
                fixturesContainer.innerHTML = fixturesHtml || '';
                console.log("✅ Next fixtures rendered:", fixturesHtml ? 'Yes' : 'No matches');
            }

            const allIds = (state.draft.details.league_entries || []).map(e => String(e.id));
            renderAllTeamsTrendChart(null, 'cumulative', allIds);
        }

        console.log("4g. Calling renderRecommendations()...");
        renderRecommendations();

        console.log("4h. Computing aggregates...");
        const aggregates = computeDraftTeamAggregates();

        console.log("4i. Calling populateAnalyticsHighlight()...");
        populateAnalyticsHighlight();

        console.log("4j. Calling renderDraftAnalytics()...");
        renderDraftAnalytics(aggregates);

        console.log("4k. Calling renderDraftComparison()...");
        renderDraftComparison(aggregates);

        console.log("4l. Calling renderDraftRosters()...");
        renderDraftRosters();

        console.log("4m. Calling renderDraftMatrices()...");
        renderDraftMatrices(aggregates);

        console.log("4n. Calling populateTeamFilter()...");
        populateTeamFilter();

        // Show success toast
        const totalTeams = state.draft.rostersByEntryId.size;
        const totalPlayers = state.draft.ownedElementIds.size;
        showToast('ליגת דראפט נטענה בהצלחה', `${totalTeams} קבוצות, ${totalPlayers} שחקנים`, 'success', 3000);
    } catch (e) {
        console.error('loadDraftLeague error', e);
        draftContainer.innerHTML = `<div style="text-align:center; padding: 20px; color: red;">שגיאה בטעינת נתוני הליגה: ${e.message}</div>`;
        showToast('שגיאה בטעינת הליגה', e.message, 'error', 5000);
    } finally {
        hideLoading();
    }
}

/**
 * Load historical lineups for all teams across all gameweeks
 * This is used for accurate analytics calculations
 */

async function getGameweekPoints(gw) {
    if (state.historicalPoints[gw]) return state.historicalPoints[gw];

    // Check local storage
    const cacheKey = `fpl_gw_${gw}_stats`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            state.historicalPoints[gw] = new Map(parsed);
            return state.historicalPoints[gw];
        } catch (e) { console.error('Cache parse error', e); }
    }

    try {
        const response = await fetchWithCache(
            `https://fantasy.premierleague.com/api/event/${gw}/live/`,
            `fpl_event_${gw}_live`,
            30 // Cache for 30 mins
        );

        if (!response || !response.elements) return null;

        const statsMap = new Map();
        response.elements.forEach(el => {
            statsMap.set(el.id, el.stats);
        });

        // Fill in missing values from bootstrap if available
        // bootstrap-static returns an object; `.raw` is that object, not the
        // element array. Mapping over it threw, and the throw was swallowed by
        // the catch below — so every live gameweek fetch silently returned null.
        const bootstrapElements = state.allPlayersData.live.raw?.elements;
        if (statsMap.size > 0 && Array.isArray(bootstrapElements)) {
            const bootstrapMap = new Map(bootstrapElements.map(p => [p.id, p]));

            statsMap.forEach((stats, playerId) => {
                const bootstrapPlayer = bootstrapMap.get(playerId);
                if (bootstrapPlayer) {
                    // Fill in missing values from bootstrap if available
                    if (!stats.ict_index && bootstrapPlayer.ict_index) {
                        stats.ict_index = bootstrapPlayer.ict_index;
                    }
                    if (!stats.bonus && bootstrapPlayer.bonus) {
                        stats.bonus = bootstrapPlayer.bonus;
                    }
                    if (!stats.clean_sheets && bootstrapPlayer.clean_sheets) {
                        stats.clean_sheets = bootstrapPlayer.clean_sheets;
                    }
                }
            });
        }

        state.historicalPoints[gw] = statsMap;

        // Persist to local storage (map as array)
        localStorage.setItem(cacheKey, JSON.stringify(Array.from(statsMap.entries())));

        return statsMap;
    } catch (err) {
        console.error(`Failed to fetch GW ${gw} stats:`, err);
        return null;
    }
}

async function calculateAggregatedStats(lastN) {
    const completedGW = getCompletedGWCount();
    const startGW = Math.max(1, completedGW - lastN + 1);

    const aggregated = new Map(); // fplId -> { total_points, goals, minutes, ... }

    // Initialize map with current processed data to ensure we have all players
    // We use a clean slate for aggregation values but keep ID refs
    if (state.allPlayersData[state.currentDataSource].processed) {
        state.allPlayersData[state.currentDataSource].processed.forEach(p => {
            aggregated.set(p.id, {
                id: p.id,
                total_points: 0,
                goals_scored: 0,
                assists: 0,
                minutes: 0,
                clean_sheets: 0,
                goals_conceded: 0,
                own_goals: 0,
                penalties_saved: 0,
                penalties_missed: 0,
                yellow_cards: 0,
                red_cards: 0,
                saves: 0,
                bonus: 0,
                bps: 0,
                influence: 0,
                creativity: 0,
                threat: 0,
                ict_index: 0,
                expected_goals: 0,
                expected_assists: 0,
                expected_goal_involvements: 0,
                expected_goals_conceded: 0,
                transfers_in_event: 0,
                transfers_out_event: 0,
                match_count: 0
            });
        });
    }

    for (let gw = startGW; gw <= completedGW; gw++) {
        const gwData = await getGameweekPoints(gw);
        if (!gwData) continue;

        gwData.forEach((stats, fplId) => {
            const agg = aggregated.get(fplId);
            if (!agg) return; // Ignore players not in main list (unlikely)

            agg.total_points += (stats.total_points || 0);
            agg.goals_scored += (stats.goals_scored || 0);
            agg.assists += (stats.assists || 0);
            agg.minutes += (stats.minutes || 0);
            agg.clean_sheets += (stats.clean_sheets || 0);
            agg.goals_conceded += (stats.goals_conceded || 0);
            agg.own_goals += (stats.own_goals || 0);
            agg.penalties_saved += (stats.penalties_saved || 0);
            agg.penalties_missed += (stats.penalties_missed || 0);
            agg.yellow_cards += (stats.yellow_cards || 0);
            agg.red_cards += (stats.red_cards || 0);
            agg.saves += (stats.saves || 0);
            agg.bonus += (stats.bonus || 0);
            agg.bps += (stats.bps || 0);
            agg.influence += parseFloat(stats.influence || 0);
            agg.creativity += parseFloat(stats.creativity || 0);
            agg.threat += parseFloat(stats.threat || 0);
            agg.ict_index += parseFloat(stats.ict_index || 0);

            agg.expected_goals += parseFloat(stats.expected_goals || 0);
            agg.expected_assists += parseFloat(stats.expected_assists || 0);
            agg.expected_goal_involvements += parseFloat(stats.expected_goal_involvements || 0);
            agg.expected_goals_conceded += parseFloat(stats.expected_goals_conceded || 0);

            agg.transfers_in_event += (stats.transfers_in || 0);
            agg.transfers_out_event += (stats.transfers_out || 0);

            if (stats.minutes > 0) agg.match_count++;
        });
    }

    // Finalize: Calculate per 90s
    return Array.from(aggregated.values()).map(agg => {
        const mins = agg.minutes;
        const mins90 = mins / 90;

        return {
            ...agg,
            form: (agg.total_points / Math.max(1, agg.match_count)).toFixed(1),
            points_per_game: agg.match_count > 0 ? (agg.total_points / agg.match_count) : 0,

            // Per 90 Stats
            points_per_game_90: mins > 0 ? (agg.total_points / mins90) : 0,
            xGI_per90: mins > 0 ? (agg.expected_goal_involvements / mins90) : 0,
            def_contrib_per90: mins > 0 ? ((agg.clean_sheets * 4 + agg.saves / 3 - agg.goals_conceded) / mins90) : 0, // Approx formula

            ict_index_per90: mins > 0 ? (agg.ict_index / mins90) : 0,
            bonus_per90: mins > 0 ? (agg.bonus / mins90) : 0,
            influence_per90: mins > 0 ? (agg.influence / mins90) : 0,
            creativity_per90: mins > 0 ? (agg.creativity / mins90) : 0,
            threat_per90: mins > 0 ? (agg.threat / mins90) : 0,
            goals_conceded_per90: mins > 0 ? (agg.goals_conceded / mins90) : 0,
            clean_sheets_per90: mins > 0 ? (agg.clean_sheets / mins90) : 0,
            expected_goals_conceded_per_90: mins > 0 ? (agg.expected_goals_conceded / mins90) : 0,

            xDiff: (agg.goals_scored) - (agg.expected_goals),
            net_transfers_event: agg.transfers_in_event - agg.transfers_out_event
        };
    });
}

async function loadHistoricalLineups() {
    console.log('📚 Loading historical lineups for all teams...');

    if (!state.draft.details || !state.draft.details.league_entries) {
        console.warn('⚠️ No league entries found, skipping historical lineup loading');
        return;
    }

    const leagueEntries = state.draft.details.league_entries;
    const currentGW = state.draft.details.league?.current_event || getCurrentEventId();

    // Load lineups for GW 1 through current GW
    const gwsToLoad = Array.from({ length: currentGW }, (_, i) => i + 1);

    const validEntries = leagueEntries.filter(e => e && e.entry_id && e.id);

    // One task per (team, gameweek). Previously these ran in nested sequential
    // loops -- 8 teams x 38 gameweeks is over 300 round trips one after another,
    // each potentially walking the proxy chain. That was the single biggest
    // cause of the draft tab taking minutes to load.
    const tasks = [];
    for (const entry of validEntries) {
        for (const gw of gwsToLoad) tasks.push({ entry, gw });
    }
    console.log(`📊 Loading ${gwsToLoad.length} gameweeks x ${validEntries.length} teams (${tasks.length} requests, parallel)...`);

    const byEntry = new Map(validEntries.map(e => [e.id, {}]));

    await mapWithConcurrency(tasks, 6, async ({ entry, gw }) => {
        try {
            const url = config.corsProxy + encodeURIComponent(config.urls.draftEntryPicks(entry.entry_id, gw));
            const picksCacheKey = `fpl_draft_picks_historical_${entry.entry_id}_gw${gw}`;
            const picksData = await fetchWithCache(url, picksCacheKey, 1440); // Cache for 24 hours

            if (picksData && picksData.picks) {
                const picksWithFplIds = picksData.picks
                    .map(pick => ({
                        fplId: toFplId(pick.element),
                        position: pick.position,
                        originalDraftId: pick.element
                    }))
                    .filter(p => p.fplId !== null);

                byEntry.get(entry.id)[`gw${gw}`] = {
                    starting: picksWithFplIds.filter(p => p.position <= 11).map(p => p.fplId),
                    bench: picksWithFplIds.filter(p => p.position > 11).map(p => p.fplId)
                };
            }
        } catch (err) {
            console.warn(`⚠️ Failed to load GW${gw} for ${entry.entry_name}:`, err.message);
        }
    });

    byEntry.forEach((lineups, entryId) => state.draft.historicalLineups.set(entryId, lineups));
    console.log(`📚 Historical lineups loaded for ${state.draft.historicalLineups.size} teams`);
}

function renderDraftStandings() {
    console.log("🏆 renderDraftStandings() called");
    const container = document.getElementById('draftStandingsContent');
    if (!container) {
        console.error("❌ draftStandingsContent container not found!");
        return;
    }
    console.log("✅ Container found:", container);

    const standingsSource = (state.draft.standings?.standings) || (state.draft.details?.standings) || [];
    const leagueEntries = state.draft.details?.league_entries;

    console.log("📊 Standings source:", standingsSource);
    console.log("👥 League entries:", leagueEntries);
    console.log("🎮 Draft details:", state.draft.details);
    console.log("🏟️ Matches:", state.draft.details?.matches?.length || 0);

    // Fallback to creating a table from scratch if no standings data but we have matches
    let finalStandings = [];

    // Try to use existing standings if they seem valid
    if (standingsSource.length > 0) {
        finalStandings = standingsSource;
    }

    // If no valid standings from API, generate from matches
    if (finalStandings.length === 0 && leagueEntries && state.draft.details?.matches) {
        console.log('Generating standings from matches (Fallback)...');
        const stats = {};
        leagueEntries.forEach(e => {
            stats[e.id] = {
                league_entry: e.id,
                matches_won: 0, matches_drawn: 0, matches_lost: 0,
                points_for: 0, points_against: 0, total: 0
            };
        });

        const matches = state.draft.details.matches;
        matches.forEach(m => {
            if (m.finished) {
                const h = stats[m.league_entry_1];
                const a = stats[m.league_entry_2];
                if (h && a) {
                    h.points_for += m.league_entry_1_points;
                    h.points_against += m.league_entry_2_points;
                    a.points_for += m.league_entry_2_points;
                    a.points_against += m.league_entry_1_points;

                    if (m.league_entry_1_points > m.league_entry_2_points) { h.matches_won++; h.total += 3; a.matches_lost++; }
                    else if (m.league_entry_1_points < m.league_entry_2_points) { a.matches_won++; a.total += 3; h.matches_lost++; }
                    else { h.matches_drawn++; h.total += 1; a.matches_drawn++; a.total += 1; }
                }
            }
        });
        finalStandings = Object.values(stats).sort((a, b) => b.total - a.total || (b.points_for - b.points_against) - (a.points_for - a.points_against));
        finalStandings.forEach((s, i) => s.rank = i + 1);
    }

    if (finalStandings.length === 0 || !leagueEntries) {
        console.warn('renderDraftStandings: No standings data and no matches data to generate from.');
        container.innerHTML = '<p style="text-align:center; padding:20px;">לא נמצא מידע על טבלת הליגה.</p>';
        return;
    }

    const standingsData = finalStandings.map(s => {
        const entry = leagueEntries.find(le => le.id === s.league_entry);
        if (!entry || !entry.entry_name || entry.entry_name.toLowerCase() === 'average') {
            return null; // Filter out invalid or average entries
        }
        const pf = s.points_for || 0;
        const pa = s.points_against || 0;
        const total = s.total || 0;
        const diff = pf - pa;

        return {
            // computeDraftTeamAggregates looks rows up by entry id. Without it
            // that find() never matched, so every team's table points and wins
            // came through as 0.
            entry_id: s.league_entry,
            rank: s.rank,
            manager: entry.player_first_name + ' ' + entry.player_last_name,
            team: entry.entry_name,
            wins: s.matches_won || 0,
            draws: s.matches_drawn || 0,
            losses: s.matches_lost || 0,
            pf,
            pa,
            diff,
            total
        };
    }).filter(Boolean); // Remove nulls

    standingsData.sort((a, b) => a.rank - b.rank);
    state.draft._standingsData = standingsData; // Save for sorting

    const table = document.createElement('table');
    table.id = 'draftStandingsTable';
    table.className = 'styled-table draft-table';

    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th onclick="sortTableDraft('rank')">דירוג</th>
            <th onclick="sortTableDraft('manager')">מנהל</th>
            <th onclick="sortTableDraft('team')">קבוצה</th>
            <th onclick="sortTableDraft('wins')">נצ'</th>
            <th onclick="sortTableDraft('draws')">ת'</th>
            <th onclick="sortTableDraft('losses')">הפ'</th>
            <th onclick="sortTableDraft('pf')">בעד</th>
            <th onclick="sortTableDraft('pa')">נגד</th>
            <th onclick="sortTableDraft('diff')">+/-</th>
            <th onclick="sortTableDraft('total')">נק'</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    tbody.id = 'draftStandingsBody'; // Add ID for sorting
    tbody.innerHTML = standingsData.map(s => {
        const teamLogo = getTeamLogo(s.team);
        return `
        <tr>
            <td>${s.rank}</td>
            <td>${s.manager}</td>
            <td><span style="font-size: 18px; margin-left: 6px;">${teamLogo}</span>${s.team}</td>
            <td>${s.wins}</td>
            <td>${s.draws}</td>
            <td>${s.losses}</td>
            <td>${s.pf}</td>
            <td>${s.pa}</td>
            <td>${s.diff > 0 ? '+' : ''}${s.diff}</td>
            <td>${s.total}</td>
        </tr>
    `}).join('');
    table.appendChild(tbody);

    console.log("📋 Standings table created with", standingsData.length, "rows");
    console.log("🔄 Clearing container and appending table...");

    container.innerHTML = ''; // Clear loader
    container.appendChild(table);

    console.log("✅ Table appended. Container children:", container.children.length);
    console.log("✅ renderDraftStandings() completed!");

    const completed = getCompletedGWCount();
    const gwCountEl = document.getElementById('gwCount');
    if (gwCountEl) {
        gwCountEl.textContent = `לאחר ${completed} מחזורים`;
    }
}


function findFreeAgents() {
    // Check if we're in demo mode first
    let allPlayers = [];
    if (state.currentDataSource === 'demo' && state.allPlayersData.demo && state.allPlayersData.demo.processed) {
        allPlayers = state.allPlayersData.demo.processed;
    } else {
        allPlayers = (state.allPlayersData.live && state.allPlayersData.live.processed) || [];
    }
    return allPlayers.filter(p => !state.draft.ownedElementIds.has(p.id));
}

function getRecommendationData() {
    const myId = findMyTeam()?.id;
    if (!myId) return null;

    const myPlayerIds = new Set(state.draft.rostersByEntryId.get(myId) || []);
    if (!myPlayerIds.size) return null;

    const processedById = getProcessedByElementId();
    const myPlayers = Array.from(myPlayerIds).map(id => processedById.get(id)).filter(Boolean);

    // Get ONLY free agents (not owned by ANY team)
    const freeAgents = findFreeAgents();

    console.log(`DEBUG Recommendations: Found ${freeAgents.length} free agents out of ${processedById.size} total players`);
    console.log(`DEBUG: My team has ${myPlayers.length} players`);
    console.log(`DEBUG: Total owned players across all teams: ${state.draft.ownedElementIds.size}`);

    // Calculate Smart Score for a player
    const calculateSmartScore = (p) => {
        if (!p) return 0;

        // Base metrics (normalized to 0-100 scale)
        const xPts1GW = (p.predicted_points_1_gw || 0) * 10; // Weight: 0.30
        const draftScore = (p.draft_score || 0); // Weight: 0.25
        const form = parseFloat(p.form || 0) * 10; // Weight: 0.15

        // Transfers balance (difference between transfers_in and transfers_out)
        const transfersIn = parseInt(p.transfers_in_event || 0);
        const transfersOut = parseInt(p.transfers_out_event || 0);
        const transfersBalance = transfersIn - transfersOut;
        const transfersScore = Math.max(0, Math.min(100, transfersBalance * 2 + 50)); // Weight: 0.20

        // Ownership percentage (higher is better for comeback players)
        const ownership = parseFloat(p.selected_by_percent || 0);
        const ownershipScore = Math.min(100, ownership * 2); // Weight: 0.10

        // Comeback bonus: High ownership but low minutes = returning from injury
        let comebackBonus = 0;
        const minutes = p.minutes || 0;
        if (minutes < 270 && ownership > 30 && draftScore > 70) {
            comebackBonus = 20; // Significant bonus for comeback players
        } else if (minutes < 180 && ownership > 20 && draftScore > 60) {
            comebackBonus = 10; // Moderate bonus
        }

        // Calculate weighted smart score
        const smartScore = (
            (xPts1GW * 0.30) +
            (draftScore * 0.25) +
            (form * 0.15) +
            (transfersScore * 0.20) +
            (ownershipScore * 0.10) +
            comebackBonus
        );

        return smartScore;
    };

    // Add smart_score and transfers_balance to all players for display
    const enrichPlayer = (p) => {
        const transfersIn = parseInt(p.transfers_in_event || 0);
        const transfersOut = parseInt(p.transfers_out_event || 0);
        return {
            ...p,
            smart_score: calculateSmartScore(p),
            transfers_balance: transfersIn - transfersOut
        };
    };

    // Enrich my players and free agents
    const myPlayersEnriched = myPlayers.map(enrichPlayer);
    const freeAgentsEnriched = freeAgents.map(enrichPlayer);

    const myPlayersWithScore = myPlayersEnriched.map(p => ({ player: p, score: p.smart_score }));

    // Find 4 weakest players overall (not necessarily one per position)
    // EXCLUDE GOALKEEPERS - never recommend replacing them
    const weakestPlayers = myPlayersWithScore
        .filter(p => p.player.position_name !== 'GKP') // Exclude goalkeepers
        .sort((a, b) => a.score - b.score) // Sort by Smart Score (lowest first)
        .slice(0, 4); // Take 4 weakest

    console.log('=== SMART RECOMMENDATION LOGIC ===');
    console.log('Smart Score calculation:');
    console.log('  - xPts (1GW) × 30% - תחזית למחזור הבא');
    console.log('  - Draft Score × 25% - איכות כללית');
    console.log('  - Form × 15% - כושר אחרון');
    console.log('  - Transfers Balance × 20% - הפרש העברות (חכמת ההמונים)');
    console.log('  - Ownership × 10% - אחוז בעלות');
    console.log('  - Comeback Bonus - בונוס לשחקנים חוזרים מפציעה');
    console.log('');
    console.log('4 Weakest players (excluding GKP):');
    weakestPlayers.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.player.web_name} (${p.player.position_name}) - Smart Score: ${p.score.toFixed(1)}`);
    });

    const recommendations = {};

    // Track already recommended players to avoid duplicates across multiple recommendations
    const alreadyRecommended = new Set();

    weakestPlayers.forEach((playerToReplace, index) => {
        const pos = playerToReplace.player.position_name;

        // Find top free agents in same position with better smart score
        // We'll get more than 3 initially, then filter out already recommended ones
        const allCandidates = freeAgentsEnriched
            .filter(p => {
                // Must be same position
                if (p.position_name !== pos) return false;

                // Must have played at least 1 minute (to allow comeback players)
                if (p.minutes <= 0) return false;

                // CRITICAL: Double-check player is NOT in ownedElementIds
                if (state.draft.ownedElementIds.has(p.id)) {
                    console.warn(`Player ${p.web_name} (${p.id}) is marked as free agent but is actually owned!`);
                    return false;
                }

                // Must have better smart score
                if (p.smart_score <= playerToReplace.score) return false;

                // NEW: Must have transfers_balance > 1000 (high demand)
                if (Math.abs(p.transfers_balance) < 1000) return false;

                // CRITICAL: Exclude players already recommended for other positions
                if (alreadyRecommended.has(p.id)) return false;

                return true;
            })
            .sort((a, b) => b.smart_score - a.smart_score);

        // Take top 3 candidates
        const candidates = allCandidates.slice(0, 3);

        console.log(`DEBUG ${pos}: Found ${candidates.length} unique free agent candidates better than ${playerToReplace.player.web_name} (smart score: ${playerToReplace.score.toFixed(1)})`);

        if (candidates.length) {
            // Mark these candidates as recommended so they won't appear in future recommendations
            candidates.forEach(c => alreadyRecommended.add(c.id));

            // Use unique key based on player ID to avoid conflicts
            recommendations[`rec_${index}_${playerToReplace.player.id}`] = {
                player: playerToReplace.player,
                candidates,
                position: pos
            };
        }
    });

    return recommendations;
}

function renderRecommendations() {
    console.log("💡 renderRecommendations() called");
    const container = document.getElementById('draftRecommendations');
    if (!container) {
        console.error("❌ draftRecommendations container not found!");
        return;
    }
    container.innerHTML = ''; // Clear loader

    const recommendationData = getRecommendationData();
    if (!recommendationData || Object.keys(recommendationData).length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 20px;">🎉 כל השחקנים שלך מצוינים! אין המלצות להחלפה כרגע.</p>';
        return;
    }

    const tablesContainer = document.createElement('div');
    tablesContainer.className = 'recs-grid-tables';

    // Position names in Hebrew
    const posNames = {
        'GKP': '🧤 שוער',
        'DEF': '🛡️ מגן',
        'MID': '⚙️ קשר',
        'FWD': '⚽ חלוץ'
    };

    // Create recommendation reason for each candidate
    const getRecommendationReason = (candidate) => {
        const reasons = [];

        // Check comeback player
        if (candidate.minutes < 270 && candidate.selected_by_percent > 30 && candidate.draft_score > 70) {
            reasons.push('🔥 חוזר');
        } else if (candidate.minutes < 180 && candidate.selected_by_percent > 20 && candidate.draft_score > 60) {
            reasons.push('⚡ חוזר');
        }

        // Check high transfers balance
        if (candidate.transfers_balance > 50) {
            reasons.push('📈 גבוה');
        } else if (candidate.transfers_balance > 20) {
            reasons.push('📈 עולה');
        }

        // Check high xPts
        if (candidate.predicted_points_1_gw > 6) {
            reasons.push('⚽ תחזית');
        }

        // Check good form
        if (parseFloat(candidate.form) > 5) {
            reasons.push('💪 כושר');
        }

        // Check high draft score
        if (candidate.draft_score > 85) {
            reasons.push('⭐ עלית');
        }

        return reasons.length > 0 ? reasons.join(' • ') : 'איכותי';
    };

    Object.entries(recommendationData).forEach(([key, { player, candidates, position }]) => {
        if (candidates.length === 0) return;

        const allInvolved = [player, ...candidates];
        const metrics = config.recommendationMetrics;

        let tableHTML = `
            <div class="rec-card">
                <div class="rec-header">
                    <h4 style="font-size: 18px; font-weight: 800;">${player.web_name} <span style="color: rgba(158, 174, 255, 1); font-size: 15px;">(${posNames[position]})</span></h4>
                    <p class="rec-subtitle" style="font-size: 13px; font-weight: 600;">⚽ ${posNames[position]} • ציון: ${player.smart_score.toFixed(1)}</p>
                </div>
                <table class="rec-table">
                    <thead>
                        <tr>
                            <th style="width: 20%;">מדד</th>
                            <th style="width: 20%;">נוכחי</th>
                            <th style="width: 20%; font-size: 16px; font-weight: 800;">#1</th>
                            <th style="width: 20%; font-size: 16px; font-weight: 800;">#2</th>
                            <th style="width: 20%; font-size: 16px; font-weight: 800;">#3</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="rec-player-row">
                            <td><strong>שחקן</strong></td>
                            ${allInvolved.map(p => `
                                <td>
                                    <div class="rec-player-cell">
                                        <img src="${getPlayerImageUrl(p)}" class="rec-player-img" alt="${p.web_name}">
                                        <div class="rec-player-name">${p.web_name}</div>
                                    </div>
                                </td>
                            `).join('')}
                        </tr>
                        <tr class="rec-reason-row">
                            <td><strong>סיבה</strong></td>
                            <td>-</td>
                            ${candidates.map(c => `<td class="rec-reason" style="font-size: 12px; font-weight: 600;">${getRecommendationReason(c)}</td>`).join('')}
                        </tr>`;

        // Add metrics rows
        Object.entries(metrics).forEach(([name, { key, format }]) => {
            const values = allInvolved.map(p => {
                const val = getNestedValue(p, key);
                return val !== null && val !== undefined ? val : 0;
            });
            const bestValue = Math.max(...values);
            const worstValue = Math.min(...values);

            tableHTML += `<tr><td><strong>${name}</strong></td>`;
            allInvolved.forEach((p, i) => {
                const val = values[i];
                let cellClass = '';
                if (val === bestValue && bestValue !== worstValue) {
                    cellClass = 'rec-best';
                } else if (val === worstValue && bestValue !== worstValue) {
                    cellClass = 'rec-worst';
                }
                tableHTML += `<td class="${cellClass}">${format(val)}</td>`;
            });
            tableHTML += `</tr>`;
        });

        tableHTML += `
                    </tbody>
                </table>
            </div>`;

        tablesContainer.innerHTML += tableHTML;
    });

    container.appendChild(tablesContainer);
}

/**
 * Compute team aggregates based on ACTUAL STARTERS across all gameweeks
 * This uses historical lineups to calculate accurate stats
 */
function computeDraftTeamAggregates() {
    const processedById = getProcessedByElementId();
    const currentGW = state.draft.details?.league?.current_event || getCurrentEventId();

    return (state.draft.details?.league_entries || []).filter(e => e && e.entry_name).map(e => {
        const teamName = e.entry_name;
        const historicalLineups = state.draft.historicalLineups.get(e.id);

        // If no historical data yet, fall back to current roster
        if (!historicalLineups || Object.keys(historicalLineups).length === 0) {
            console.warn(`⚠️ No historical lineups for ${teamName}, using current roster`);
            const playerIds = state.draft.rostersByEntryId.get(e.id) || [];
            const players = playerIds.map(id => processedById.get(id)).filter(Boolean);

            if (!players.length) return { team: teamName, metrics: {} };

            const sumDraft = players.reduce((s, p) => s + p.draft_score, 0);
            const sumPred = players.reduce((s, p) => s + (p.predicted_points_4_gw || 0), 0);
            const totalPrice = players.reduce((s, p) => s + p.now_cost, 0);
            const sumSelectedBy = players.reduce((s, p) => s + parseFloat(p.selected_by_percent), 0);
            const gaTotal = players.reduce((s, p) => s + (p.goals_scored || 0) + (p.assists || 0), 0);
            const totalCleanSheets = players.reduce((s, p) => s + (p.clean_sheets || 0), 0);
            const totalXGI = players.reduce((s, p) => s + (parseFloat(p.expected_goal_involvements) || 0), 0);
            const totalDefCon = players.reduce((s, p) => s + (p.def_contrib_per90 || 0), 0);

            return { team: teamName, metrics: { sumDraft, sumPred, totalPrice, sumSelectedBy, gaTotal, totalCleanSheets, totalXGI, totalDefCon } };
        }

        // Calculate metrics from ACTUAL STARTERS across all GWs
        let sumDraft = 0, sumPred = 0, totalPrice = 0, sumSelectedBy = 0;
        let gaTotal = 0, totalCleanSheets = 0, totalXGI = 0, totalDefCon = 0;
        let totalPointsFor = 0, totalPointsAgainst = 0;
        let starterCount = 0;

        // Iterate through all gameweeks
        for (let gw = 1; gw <= currentGW; gw++) {
            const gwKey = `gw${gw}`;
            const lineup = historicalLineups[gwKey];

            if (!lineup || !lineup.starting) continue;

            // Get only the STARTING 11 players
            const starters = lineup.starting
                .map(id => processedById.get(id))
                .filter(p => p && p.minutes > 0); // Only players who actually played

            starters.forEach(p => {
                sumDraft += p.draft_score || 0;
                sumPred += p.predicted_points_4_gw || 0;
                totalPrice += p.now_cost || 0;
                sumSelectedBy += parseFloat(p.selected_by_percent) || 0;
                gaTotal += (p.goals_scored || 0) + (p.assists || 0);
                totalCleanSheets += p.clean_sheets || 0;
                totalXGI += parseFloat(p.expected_goal_involvements) || 0;
                totalDefCon += p.def_contrib_per90 || 0;
                totalPointsFor += p.event_points || 0; // Actual points scored in that GW
                starterCount++;
            });
        }

        // Average out metrics that should be averaged (not summed)
        const gwCount = Math.max(1, currentGW);
        sumDraft = sumDraft / gwCount;
        sumPred = sumPred / gwCount;
        totalPrice = totalPrice / gwCount;
        sumSelectedBy = sumSelectedBy / gwCount;

        // Get table points from standings
        const standingsEntry = state.draft._standingsData.find(s => s.entry_id === e.id);
        const tablePoints = standingsEntry ? standingsEntry.total : 0;
        // _standingsData normalises this to `wins`; `matches_won` is the raw
        // API field name and is not present on these rows.
        const wins = standingsEntry ? (standingsEntry.wins || 0) : 0;

        return {
            team: teamName,
            metrics: {
                sumDraft,
                sumPred,
                totalPrice,
                sumSelectedBy,
                gaTotal,
                totalCleanSheets,
                totalXGI,
                totalDefCon,
                // The per-gameweek loop sums `event_points`, which is a single
                // live-season snapshot and is 0 throughout the completed-season
                // data — so this was 0 for every team. The league standings
                // carry the real season total, exactly as they do for pa.
                totalPointsFor: standingsEntry ? (standingsEntry.pf || 0) : totalPointsFor,
                // The league standings already carry this; it never needed
                // recomputing from the match list.
                totalPointsAgainst: standingsEntry ? (standingsEntry.pa || 0) : 0,
                tablePoints,
                wins
            }
        };
    });
}

function populateAnalyticsHighlight() {
    const select = document.getElementById('analyticsHighlight');
    if (!select) return;

    select.innerHTML = '<option value="">כל הקבוצות (ללא הדגשה)</option>';

    if (state.draft.details && state.draft.details.league_entries) {
        state.draft.details.league_entries
            .filter(e => e && e.entry_name && e.entry_name.toLowerCase() !== 'average')
            .forEach(entry => {
                const option = document.createElement('option');
                option.value = entry.entry_name;
                option.textContent = entry.entry_name;
                select.appendChild(option);
            });
    }
}

function updateAnalyticsHighlight() {
    const aggregates = computeDraftTeamAggregates();
    renderDraftAnalytics(aggregates);

    const selectedTeam = document.getElementById('analyticsHighlight')?.value;
    if (selectedTeam) {
        showToast('הדגשה', `מדגיש את ${selectedTeam}`, 'info', 2000);
    } else {
        showToast('הדגשה', 'הוסרה ההדגשה', 'info', 2000);
    }
}

function renderH2HCalendar() {
    const container = document.getElementById('h2hCalendar');
    if (!container) return;

    const matches = state.draft.details?.matches || [];
    if (matches.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">אין נתוני משחקים זמינים</p>';
        return;
    }

    const currentGW = state.draft.details?.league?.current_event || getCurrentEventId();

    // Group matches by gameweek and sort
    const matchesByGW = {};
    matches.forEach(m => {
        const gw = m.event;
        if (!matchesByGW[gw]) matchesByGW[gw] = [];
        matchesByGW[gw].push(m);
    });

    // Show only last 3 GWs and next 3 GWs
    const gwsToShow = [];
    for (let i = Math.max(1, currentGW - 2); i <= Math.min(currentGW + 3, SEASON_CONFIG.totalGameweeks); i++) {
        if (matchesByGW[i]) gwsToShow.push(i);
    }

    let html = '<div class="h2h-grid">';

    gwsToShow.forEach(gw => {
        matchesByGW[gw].forEach((match, idx) => {
            const team1Name = state.draft.entryIdToTeamName.get(match.league_entry_1) || 'Unknown';
            const team2Name = state.draft.entryIdToTeamName.get(match.league_entry_2) || 'Unknown';
            const score1 = match.league_entry_1_points || 0;
            const score2 = match.league_entry_2_points || 0;
            const isFinished = match.finished || gw < currentGW;
            const winner = isFinished && score1 !== score2 ? (score1 > score2 ? 1 : 2) : 0;

            html += `
                <div class="h2h-match ${winner ? 'h2h-winner' : ''}" style="animation-delay: ${idx * 0.05}s;">
                    <div class="h2h-match-header">
                        <span class="h2h-gw">GW${gw}</span>
                        <span class="h2h-status ${isFinished ? 'finished' : 'upcoming'}">
                            ${isFinished ? '✓ הסתיים' : '⏳ עתידי'}
                        </span>
                    </div>
                    <div class="h2h-teams">
                        <div class="h2h-team ${winner === 1 ? 'winner' : ''}">
                            <div class="h2h-team-name">${team1Name}</div>
                            <div class="h2h-team-score">${isFinished ? score1 : '-'}</div>
                        </div>
                        <div class="h2h-vs">VS</div>
                        <div class="h2h-team ${winner === 2 ? 'winner' : ''}">
                            <div class="h2h-team-name">${team2Name}</div>
                            <div class="h2h-team-score">${isFinished ? score2 : '-'}</div>
                        </div>
                    </div>
                </div>
            `;
        });
    });

    html += '</div>';
    container.innerHTML = html;
}

/**
 * Cumulative points per manager, gameweek by gameweek.
 *
 * This used to plot `points_for / currentGW * (i+1) + random(±10)` — a straight
 * line with noise sprinkled on it, presented as league history. Every "comeback"
 * and "collapse" a reader saw in it was invented by Math.random(). It now reads
 * entry/{id}/history, and shows an honest empty state when that is unavailable
 * rather than falling back to a plausible-looking fabrication.
 */
function renderProgressChart() {
    const canvas = document.getElementById('progressChartCanvas');
    if (!canvas) return;

    const histories = state.draft.historyByEntryId;
    const entries = state.draft.details?.league_entries || [];

    const series = entries
        .map(e => ({ entryId: e.id, name: e.entry_name, history: histories.get(e.id) }))
        .filter(s => s.name && Array.isArray(s.history) && s.history.length);

    const empty = document.getElementById('progressChartEmpty');
    const setEmpty = msg => {
        if (state.draft.charts.progress) {
            state.draft.charts.progress.destroy();
            state.draft.charts.progress = null;
        }
        canvas.style.display = 'none';
        if (empty) { empty.style.display = 'block'; empty.textContent = msg; }
    };

    if (!series.length) {
        setEmpty(state.draft.details
            ? 'היסטוריית המחזורים עוד נטענת — או שהעונה טרם התחילה'
            : 'נתוני הליגה עוד נטענים');
        return;
    }
    canvas.style.display = '';
    if (empty) empty.style.display = 'none';

    const lastGw = Math.max(...series.flatMap(s => s.history.map(h => h.event)));
    const labels = Array.from({ length: lastGw }, (_, i) => `GW${i + 1}`);

    const datasets = series.map(s => {
        const byEvent = new Map(s.history.map(h => [h.event, h.total_points]));
        // A manager missing a gameweek keeps the previous cumulative total
        // rather than dropping to zero and drawing a cliff that never happened.
        let running = 0;
        const data = labels.map((_, i) => {
            const v = byEvent.get(i + 1);
            if (v !== undefined) running = v;
            return running;
        });
        const color = getTeamColor(s.name);
        return {
            label: s.name,
            data,
            borderColor: color,
            backgroundColor: hexToRgba(color, 0.1),
            borderWidth: 3,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: false
        };
    });

    const ctx = canvas.getContext('2d');

    if (state.draft.charts.progress) {
        state.draft.charts.progress.destroy();
    }

    state.draft.charts.progress = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: 'התקדמות נקודות לאורך העונה',
                    font: {
                        size: 18,
                        weight: 'bold'
                    },
                    color: '#0f172a'
                },
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 11,
                            weight: '600'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#e2e8f0',
                    borderColor: 'rgba(2, 132, 199, 0.5)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function (context) {
                            return `${context.dataset.label}: ${context.parsed.y} נקודות`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'נקודות מצטברות',
                        font: {
                            size: 13,
                            weight: '600'
                        }
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.15)'
                    },
                    ticks: {
                        color: '#64748b',
                        font: { size: 11 }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'מחזור',
                        font: {
                            size: 13,
                            weight: '600'
                        }
                    },
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#475569',
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}

function renderDraftAnalytics(teamAggregates) {
    console.log("📊 renderDraftAnalytics() called with", teamAggregates?.length, "teams");
    const host = document.getElementById('draftAnalytics');
    if (!host) {
        console.error("❌ draftAnalytics container not found!");
        return;
    }
    host.innerHTML = '';
    if (!teamAggregates.length) {
        console.warn("⚠️ No team aggregates data");
        return;
    }

    const highlightTeam = document.getElementById('analyticsHighlight')?.value || '';
    const colorMap = {};
    teamAggregates.forEach(t => colorMap[t.team] = getTeamColor(t.team));

    const dims = config.draftAnalyticsDimensions;

    dims.forEach((dim, index) => {
        const card = document.createElement('div');
        card.className = 'analytics-card';
        card.style.animationDelay = `${index * 0.1}s`;

        // Header with icon
        const header = document.createElement('div');
        header.className = 'analytics-card-header';

        const iconMap = {
            'sumDraft': '🏆',
            'sumPred': '📈',
            'totalPrice': '💰',
            'sumSelectedBy': '👥',
            'gaTotal': '⚽',
            'totalCleanSheets': '🛡️',
            'totalXGI': '🎯',
            'totalDefCon': '🔒'
        };

        const icon = document.createElement('span');
        icon.className = 'analytics-icon';
        icon.textContent = iconMap[dim.key] || '📊';

        const title = document.createElement('h3');
        title.className = 'analytics-title';
        title.textContent = dim.label;

        header.appendChild(icon);
        header.appendChild(title);

        // Canvas container
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'analytics-canvas-container';

        const canvas = document.createElement('canvas');
        canvas.id = `draftAnalytic_${dim.key}`;
        canvasContainer.appendChild(canvas);

        card.appendChild(header);
        card.appendChild(canvasContainer);
        host.appendChild(card);

        // Sort teams by the metric desc
        const sorted = teamAggregates.map(t => ({ name: t.team, value: t.metrics[dim.key] || 0 }))
            .sort((a, b) => b.value - a.value);

        const labels = sorted.map(s => s.name);
        const values = sorted.map(s => s.value);

        if (state.draft.charts.analytics[dim.key]) { state.draft.charts.analytics[dim.key].destroy(); }

        const ctx = canvas.getContext('2d');
        state.draft.charts.analytics[dim.key] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: dim.label,
                    data: values,
                    borderRadius: 12,
                    barThickness: 'flex',
                    maxBarThickness: 60,
                    backgroundColor: labels.map(n => {
                        const c = colorMap[n];
                        const isHi = highlightTeam && n === highlightTeam;
                        // Highlighted: full opacity with glow, Others: faded
                        if (highlightTeam) {
                            return isHi ? c : hexToRgba(c, 0.25);
                        }
                        return hexToRgba(c, 0.75);
                    }),
                    borderColor: labels.map(n => {
                        const c = colorMap[n];
                        const isHi = highlightTeam && n === highlightTeam;
                        return isHi ? '#ffffff' : 'transparent';
                    }),
                    borderWidth: labels.map(n => {
                        const isHi = highlightTeam && n === highlightTeam;
                        return isHi ? 5 : 0;
                    }),
                    hoverBackgroundColor: labels.map(n => {
                        const c = colorMap[n];
                        return hexToRgba(c, 0.95);
                    }),
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(148, 163, 184, 0.15)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#64748b',
                            font: { size: 14, weight: '600' },
                            padding: 8
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#475569',
                            font: { size: 11, weight: '600' },
                            padding: 6,
                            maxRotation: 45,
                            minRotation: 0
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(255, 255, 255, 0.98)',
                        titleColor: '#1e293b',
                        bodyColor: '#334155',
                        footerColor: '#64748b',
                        borderColor: 'rgba(2, 132, 199, 0.8)',
                        borderWidth: 2,
                        padding: 11,
                        displayColors: false,
                        titleFont: { size: 12.1, weight: '700' },
                        bodyFont: { size: 9.9, family: 'system-ui, -apple-system' },
                        footerFont: { size: 8.8, weight: '500' },
                        bodySpacing: 3.3,
                        footerSpacing: 4.4,
                        footerMarginTop: 6.6,
                        cornerRadius: 8,
                        caretSize: 5.5,
                        caretPadding: 6.6,
                        callbacks: {
                            title: function (context) {
                                const teamName = context[0].label;
                                const value = context[0].parsed.y;
                                const formattedValue = typeof value === 'number' ?
                                    (value % 1 === 0 ? Math.round(value) : value.toFixed(1)) : value;
                                return `${teamName} - סה"כ: ${formattedValue}`;
                            },
                            beforeBody: function (context) {
                                return ''; // Remove separator
                            },
                            label: function (context) {
                                // Get team name and find its players
                                const teamName = context.label;
                                const teamEntry = (state.draft.details?.league_entries || []).find(e => e.entry_name === teamName);
                                if (!teamEntry) return ['לא נמצאו נתונים'];

                                const playerIds = state.draft.rostersByEntryId.get(teamEntry.id) || [];
                                const processedById = getProcessedByElementId();
                                const players = playerIds.map(id => processedById.get(id)).filter(Boolean);

                                if (players.length === 0) return ['אין שחקנים'];

                                // Calculate player contributions based on metric
                                const metricKey = dim.key;
                                let playerContributions = [];

                                players.forEach(p => {
                                    let contribution = 0;
                                    let displayValue = 0;

                                    switch (metricKey) {
                                        case 'sumDraft':
                                            contribution = p.draft_score || 0;
                                            displayValue = Math.round(contribution);
                                            break;
                                        case 'sumPred':
                                            contribution = p.predicted_points_4_gw || 0;
                                            displayValue = Math.round(contribution);
                                            break;
                                        case 'totalPrice':
                                            contribution = p.now_cost || 0;
                                            displayValue = contribution.toFixed(1);
                                            break;
                                        case 'sumSelectedBy':
                                            contribution = parseFloat(p.selected_by_percent) || 0;
                                            displayValue = contribution.toFixed(1);
                                            break;
                                        case 'gaTotal':
                                            contribution = (p.goals_scored || 0) + (p.assists || 0);
                                            displayValue = contribution;
                                            break;
                                        case 'totalCleanSheets':
                                            contribution = p.clean_sheets || 0;
                                            displayValue = contribution;
                                            break;
                                        case 'totalXGI':
                                            contribution = parseFloat(p.expected_goal_involvements) || 0;
                                            displayValue = contribution.toFixed(1);
                                            break;
                                        case 'totalDefCon':
                                            contribution = p.def_contrib_per90 || 0;
                                            displayValue = contribution.toFixed(1);
                                            break;
                                    }

                                    if (contribution > 0) {
                                        playerContributions.push({
                                            name: p.web_name,
                                            value: contribution,
                                            display: displayValue,
                                            position: p.position_name
                                        });
                                    }
                                });

                                // Sort by contribution (descending)
                                playerContributions.sort((a, b) => b.value - a.value);

                                // Return all players (up to 15) - simple format: Position | Name | Value
                                // Top 3 will be marked with a special prefix and bold name
                                const posMap = {
                                    'GKP': 'GK',
                                    'DEF': 'DF',
                                    'MID': 'MF',
                                    'FWD': 'ST'
                                };

                                // Helper function to convert text to bold (Unicode Mathematical Bold)
                                const toBold = (text) => {
                                    const boldMap = {
                                        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝',
                                        'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧',
                                        'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
                                        'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶', 'j': '𝗷',
                                        'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁',
                                        'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
                                        '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵'
                                    };
                                    return text.split('').map(char => boldMap[char] || char).join('');
                                };

                                return playerContributions.slice(0, 15).map((pc, idx) => {
                                    const pos = posMap[pc.position] || pc.position;
                                    // Mark top 3 with green indicator and bold name
                                    const prefix = idx < 3 ? '🟢 ' : '   ';
                                    const playerName = idx < 3 ? toBold(pc.name) : pc.name;
                                    return `${prefix}${pos} | ${playerName} | ${pc.display}`;
                                });
                            },
                            footer: function (context) {
                                const teamName = context[0].label;
                                const teamEntry = (state.draft.details?.league_entries || []).find(e => e.entry_name === teamName);
                                if (!teamEntry) return '';

                                const playerIds = state.draft.rostersByEntryId.get(teamEntry.id) || [];
                                const total = playerIds.length;

                                return total > 15 ? `מציג 15 מתוך ${total} שחקנים` : `${total} שחקנים`;
                            }
                        }
                    },
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        clamp: true,
                        offset: 6,
                        color: function (context) {
                            const isHighlighted = highlightTeam && labels[context.dataIndex] === highlightTeam;
                            return isHighlighted ? '#ffffff' : '#475569';
                        },
                        backgroundColor: function (context) {
                            const isHighlighted = highlightTeam && labels[context.dataIndex] === highlightTeam;
                            return isHighlighted ? '#0284c7' : 'transparent';
                        },
                        borderRadius: function (context) {
                            const isHighlighted = highlightTeam && labels[context.dataIndex] === highlightTeam;
                            return isHighlighted ? 6 : 0;
                        },
                        padding: function (context) {
                            const isHighlighted = highlightTeam && labels[context.dataIndex] === highlightTeam;
                            return isHighlighted ? { top: 6, bottom: 6, left: 10, right: 10 } : 0;
                        },
                        font: function (context) {
                            const isHighlighted = highlightTeam && labels[context.dataIndex] === highlightTeam;
                            return {
                                size: isHighlighted ? 18 : 14,
                                weight: isHighlighted ? '900' : '700'
                            };
                        },
                        textAlign: 'center',
                        formatter: (v, context) => {
                            const isHighlighted = highlightTeam && labels[context.dataIndex] === highlightTeam;
                            const value = typeof v === 'number' ? Math.round(v) : v;
                            return isHighlighted ? `⭐ ${value}` : value;
                        }
                    }
                }
            }
        });
    });
}

function teamPointsFor(teamName) {
    const standings = (state.draft.standings && state.draft.standings.standings) || (state.draft.details && state.draft.details.standings) || [];
    const teamEntry = (state.draft.details?.league_entries || []).find(e => e.entry_name === teamName);
    if (!teamEntry) return 0;
    const teamStanding = standings.find(s => s.league_entry === teamEntry.id);
    return teamStanding ? (teamStanding.points_for || teamStanding.points_for_total || 0) : 0;
}

function renderDraftMatrices(teamAggregates) {
    const host = document.getElementById('draftMatrices');
    if (!host) return;
    host.innerHTML = '';
    const specs = config.draftMatrixSpecs;

    specs.forEach(spec => {
        const card = document.createElement('div');
        card.className = 'matrix-card';
        const titleEl = document.createElement('div');
        titleEl.className = 'title';
        titleEl.textContent = spec.title;
        card.appendChild(titleEl);

        const chartHost = document.createElement('div');
        chartHost.className = 'chart-host';
        const canvas = document.createElement('canvas');
        canvas.id = `draftMatrix_${spec.key}`;
        chartHost.appendChild(canvas);
        card.appendChild(chartHost);

        host.appendChild(card);

        const data = spec.build(teamAggregates);

        if (state.draft.charts.matrix && state.draft.charts.matrix[spec.key]) {
            state.draft.charts.matrix[spec.key].destroy();
        }
        if (!state.draft.charts.matrix) state.draft.charts.matrix = {};

        // Create improved matrix chart
        const configChart = getMatrixChartConfig(data, spec.xLabel, spec.yLabel, spec.quads);
        state.draft.charts.matrix[spec.key] = new Chart(canvas.getContext('2d'), configChart);
    });
}


function renderDraftComparison(aggregates) {
    console.log("🆚 renderDraftComparison() called with", aggregates?.length, "teams");
    const container = document.getElementById('draftComparison');
    if (!container) {
        console.error("❌ draftComparison container not found!");
        return;
    }
    container.innerHTML = ''; // Clear loader

    // Get standings data for additional metrics
    const standingsData = state.draft._standingsData || [];

    // Enhanced metrics including standings data with icons
    const enhancedMetrics = [
        { key: 'sumDraft', label: '🏆 ציון דראפט', format: (v) => v.toFixed(1) },
        { key: 'sumPred', label: '📈 צפי 4GW', format: (v) => v.toFixed(1) },
        { key: 'totalPoints', label: '⚽ נק\' בעד', format: (v) => v.toFixed(0), source: 'standings' },
        { key: 'pointsAgainst', label: '🛡️ נק\' נגד', format: (v) => v.toFixed(0), source: 'standings' },
        { key: 'tablePoints', label: '🏅 נק\' טבלה', format: (v) => v.toFixed(0), source: 'standings' },
        { key: 'wins', label: '✅ נצחונות', format: (v) => v.toFixed(0), source: 'standings' },
        { key: 'totalXGI', label: '🎯 xGI', format: (v) => v.toFixed(1) }
    ];

    let tableHTML = `
        <div style="margin-bottom: 20px;">
            <h2 style="text-align: center; color: #0f172a; font-size: 20px; margin-bottom: 15px; font-weight: 800;">📊 השוואת קבוצות</h2>
            <div style="overflow-x: auto; overflow-y: auto; max-height: 600px;">
                <table class="styled-table draft-comparison-table" style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); font-size: 11px;">
                    <thead style="position: sticky; top: 0; z-index: 10;">
                        <tr style="background: linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 100%);">
                            <th style="padding: 10px 8px; text-align: right; color: #4338ca; font-weight: 800; font-size: 11px; border-bottom: 2px solid #e2e8f0; position: sticky; right: 0; background: linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 100%); z-index: 11;">מדד</th>`;

    aggregates.forEach((agg, idx) => {
        const teamLogo = getTeamLogo(agg.team);
        // Shorten team names
        const shortName = agg.team.replace('Amit United🏆🏆', 'Amit U.').replace('Francis Bodega FC', 'Bodega').replace('Torpedo Eshel', 'Torpedo').replace('Los chicos 🌟', 'Los chicos');
        tableHTML += `<th style="padding: 8px 4px; text-align: center; color: #4338ca; font-weight: 700; font-size: 12px; border-bottom: 2px solid #e2e8f0; min-width: 70px;">
            <div style="font-size: 16px; margin-bottom: 2px;">${teamLogo}</div>
            <div style="font-size: 10px; line-height: 1.2; font-weight: 700;">${shortName}</div>
        </th>`;
    });
    tableHTML += '</tr></thead><tbody>';

    enhancedMetrics.forEach((metric, metricIdx) => {
        const bgColor = metricIdx % 2 === 0 ? '#ffffff' : '#f8fafc';

        let values;
        if (metric.source === 'standings') {
            // Get values from standings data
            values = aggregates.map(agg => {
                const standing = standingsData.find(s => s.team === agg.team);
                if (!standing) return 0;

                switch (metric.key) {
                    case 'totalPoints': return standing.pf || 0;
                    case 'pointsAgainst': return standing.pa || 0;
                    case 'tablePoints': return standing.total || 0;
                    case 'wins': return standing.wins || 0;
                    default: return 0;
                }
            });
        } else {
            values = aggregates.map(agg => agg.metrics[metric.key] || 0);
        }

        const maxVal = Math.max(...values);
        const minVal = Math.min(...values);

        tableHTML += `<tr style="background: ${bgColor}; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='${bgColor}'">
            <td style="padding: 8px 8px; font-weight: 600; color: #475569; font-size: 10px; border-bottom: 1px solid #e2e8f0; position: sticky; right: 0; background: ${bgColor}; z-index: 5;">${metric.label}</td>`;

        aggregates.forEach((agg, idx) => {
            const val = values[idx];
            let cellStyle = 'padding: 8px 4px; text-align: center; font-weight: 700; font-size: 11px; border-bottom: 1px solid #e2e8f0;';

            if (val === maxVal && maxVal !== minVal) {
                cellStyle += ' background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); color: #065f46;';
            } else if (val === minVal && maxVal !== minVal) {
                cellStyle += ' background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); color: #991b1b;';
            } else {
                cellStyle += ' color: #334155;';
            }

            tableHTML += `<td style="${cellStyle}">${metric.format(val)}</td>`;
        });
        tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table></div></div>';
    container.innerHTML = tableHTML;
}

function renderPitch(containerEl, playerIds, isMyLineup = false, benchIds = null) {
    if (!containerEl) {
        console.error('renderPitch: containerEl is null or undefined');
        return;
    }

    containerEl.innerHTML = ''; // Clear loader

    if (!playerIds || playerIds.length === 0) {
        containerEl.innerHTML = '<p style="text-align:center; padding: 20px; color: #666;">אין שחקנים בסגל.</p>';
        return;
    }

    const processedById = getProcessedByElementId();

    let startingXI, benchPlayers;

    if (benchIds) {
        // Use provided lineup (starting + bench)
        startingXI = playerIds.map(id => processedById.get(id)).filter(Boolean);
        benchPlayers = benchIds.map(id => processedById.get(id)).filter(Boolean);
        console.log(`🎯 Using actual lineup: ${startingXI.length} starting, ${benchPlayers.length} bench`);
    } else {
        // Fallback: auto-select best 11
        const players = playerIds.map(id => processedById.get(id)).filter(Boolean);
        const startingXI_ids = pickStartingXI(playerIds);
        startingXI = startingXI_ids.map(id => processedById.get(id)).filter(Boolean);
        benchPlayers = players.filter(p => !startingXI_ids.includes(p.id));
        console.log(`⚙️ Auto-selected lineup: ${startingXI.length} starting, ${benchPlayers.length} bench`);
    }

    if (startingXI.length === 0) {
        console.warn(`renderPitch: Could not find any player data for IDs:`, playerIds.slice(0, 5));
        containerEl.innerHTML = '<p style="text-align:center; padding: 20px; color: #e74c3c;">לא נמצאו נתוני שחקנים.</p>';
        return;
    }

    const pitch = document.createElement('div');
    pitch.className = isMyLineup ? 'pitch-container my-lineup' : 'pitch-container other-team';

    // Add pitch lines
    pitch.innerHTML = `
        <div class="pitch-lines">
            <div class="pitch-half"></div>
            <div class="pitch-circle"></div>
            <div class="penalty-top"></div>
            <div class="penalty-bottom"></div>
            <div class="goal-top"></div>
            <div class="goal-bottom"></div>
        </div>
    `;

    const byPos = { GKP: [], DEF: [], MID: [], FWD: [] };
    startingXI.forEach(p => byPos[p.position_name].push(p));

    // Sort players within position by name for consistent layout
    for (const pos in byPos) {
        byPos[pos].sort((a, b) => a.web_name.localeCompare(b.web_name));
    }

    const rowsY = { GKP: 92, DEF: 75, MID: 50, FWD: 25 };

    const placeRow = (players, y) => {
        const count = players.length;
        if (count === 0) return;
        players.forEach((p, i) => {
            const spot = document.createElement('div');
            spot.className = 'player-spot';
            spot.style.top = `${y}%`;
            spot.style.left = `${(i + 1) * 100 / (count + 1)}%`;

            spot.innerHTML = `
                <img class="player-photo" src="${getPlayerImageUrl(p)}" alt="${p.web_name}" 
                     onerror="this.src='${config.urls.missingPlayerImage}'">
                <div class="player-name">${p.web_name}</div>
            `;
            pitch.appendChild(spot);
        });
    };

    placeRow(byPos.GKP, rowsY.GKP);
    placeRow(byPos.DEF, rowsY.DEF);
    placeRow(byPos.MID, rowsY.MID);
    placeRow(byPos.FWD, rowsY.FWD);

    containerEl.appendChild(pitch);

    // Bench
    if (benchPlayers.length > 0) {
        const bench = document.createElement('div');
        bench.className = 'bench-strip';
        bench.innerHTML = benchPlayers.map(p => `
            <div class="bench-item">
                <img src="${getPlayerImageUrl(p)}" alt="${p.web_name}" 
                     onerror="this.src='${config.urls.missingPlayerImage}'">
                <div>${p.web_name}</div>
            </div>
        `).join('');
        containerEl.appendChild(bench);
    }
}

function renderDraftRosters() {
    console.log("📋 renderDraftRosters() called");
    const container = document.getElementById('otherRosters');
    if (!container) {
        console.error('❌ renderDraftRosters: otherRosters container not found');
        return;
    }

    container.innerHTML = '';
    const myTeamId = findMyTeam()?.id;

    if (!state.draft.rostersByEntryId || state.draft.rostersByEntryId.size === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 40px; color: #666;">לא נמצאו סגלים להצגה.</p>';
        console.warn('renderDraftRosters: No rosters found in state');
        return;
    }

    let rosteredCount = 0;
    for (const [teamId, playerIds] of state.draft.rostersByEntryId.entries()) {
        if (teamId === myTeamId) continue;

        const teamName = state.draft.entryIdToTeamName.get(teamId);
        if (!teamName || teamName.toLowerCase() === 'average') continue;

        const rosterContainer = document.createElement('div');
        rosterContainer.className = 'roster-container';

        const title = document.createElement('h3');
        title.className = 'roster-title';
        title.textContent = teamName;
        rosterContainer.appendChild(title);

        const pitchHost = document.createElement('div');
        rosterContainer.appendChild(pitchHost);

        // Append container first, then render pitch
        container.appendChild(rosterContainer);
        renderPitch(pitchHost, playerIds, false);
        rosteredCount++;
    }

    console.log(`renderDraftRosters: Successfully rendered ${rosteredCount} team rosters`);

    if (rosteredCount === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 40px; color: #666;">לא נמצאו סגלים להצגה.</p>';
    }
}

// ============================================
// MY LINEUP UPDATES (With Last GW Points)
// ============================================

function updateMyLineup(entryId) {
    const container = document.getElementById('myLineupContainer');
    if (!container) return;

    container.innerHTML = '';

    // Create Lineup Controls (Toggles)
    const controls = document.createElement('div');
    controls.className = 'draft-lineup-controls';
    controls.innerHTML = `
        <div class="lineup-toggles">
            <button id="btnShowMyLineup" class="lineup-toggle active" onclick="updateMyLineup('${entryId}')">ההרכב שלי</button>
            <button id="btnShowRecLineup" class="lineup-toggle" onclick="showRecommendedLineup()">הרכב מומלץ</button>
        </div>
    `;
    container.appendChild(controls);

    const lineup = state.draft.lineupsByEntryId.get(parseInt(entryId));
    const rosterIds = state.draft.rostersByEntryId.get(parseInt(entryId));
    const processedById = getProcessedByElementId();

    let starters = [];
    let bench = [];

    if (lineup && lineup.starting && lineup.starting.length > 0) {
        starters = lineup.starting.map(id => processedById.get(id)).filter(Boolean);
        bench = lineup.bench.map(id => processedById.get(id)).filter(Boolean);
    } else if (rosterIds && rosterIds.length > 0) {
        const roster = rosterIds.map(id => processedById.get(id)).filter(Boolean);
        starters = roster.slice(0, 11);
        bench = roster.slice(11);
    } else {
        const pitchWrapper = document.createElement('div');
        pitchWrapper.className = 'pitch-wrapper';
        pitchWrapper.innerHTML = '<div class="alert alert-info">לא נמצא הרכב לקבוצה זו.</div>';
        container.appendChild(pitchWrapper);
        return;
    }

    // Calc Stats
    const calcStats = (players) => ({
        predicted: players.reduce((sum, p) => sum + (parseFloat(p.predicted_points_1_gw) || 0), 0),
        lastGw: players.reduce((sum, p) => sum + (p.event_points || 0), 0),
        ppg90: players.reduce((sum, p) => sum + (parseFloat(p.points_per_game_90) || 0), 0) / (players.length || 1),
        form: players.reduce((sum, p) => sum + (parseFloat(p.form) || 0), 0) / (players.length || 1)
    });
    const stats = calcStats(starters);

    // Render Stats
    const statsDiv = document.createElement('div');
    statsDiv.innerHTML = renderLineupStats(stats);
    container.appendChild(statsDiv);

    // Render Pitch
    const pitchWrapper = document.createElement('div');
    pitchWrapper.className = 'pitch-wrapper';
    container.appendChild(pitchWrapper);

    renderPitch(pitchWrapper, starters.map(p => p.id), true, bench.map(p => p.id));
}


// ============================================
// TAB SWITCHING
// ============================================
// switchMainView lived here too. Two declarations of the same name in a classic
// script means the later one wins, so this copy never ran — and it had drifted
// (it set display:grid, which the charts view no longer uses). The live one sits
// with renderCharts, next to the thing it triggers.

function showTab(tabName) {
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`nav-${tabName}`);
    if (activeBtn) activeBtn.classList.add('active');

    const playersView = document.getElementById('playersTabContent');
    const draftView = document.getElementById('draftTabContent');

    if (tabName === 'players') {
        // Only reset to the table when arriving from somewhere else. init() calls
        // showTab(lastTab) after the draft data finishes loading — seconds after
        // the table is already interactive — so an unconditional reset here threw
        // away a גרפים click made during that window, with nothing to explain it.
        const alreadyHere = playersView && playersView.style.display !== 'none';
        if (playersView) playersView.style.display = 'block';
        if (draftView) draftView.style.display = 'none';
        if (!alreadyHere) switchMainView('table');
        localStorage.setItem('fplToolActiveTab', 'players');
    } else if (tabName === 'draft') {
        if (playersView) playersView.style.display = 'none';
        if (draftView) draftView.style.display = 'block';
        localStorage.setItem('fplToolActiveTab', 'draft');

        console.log("🎯 Draft tab activated, calling loadDraftLeague()...");

        // Always load draft league data when switching to this tab
        loadDraftLeague().catch(err => {
            console.error("❌ Failed to load draft league:", err);
            showToast('שגיאה', 'לא ניתן לטעון את ליגת הדראפט כרגע', 'error');
        });
    }
}


// ============================================
// RENDER CHARTS (From Backup Style)
// ============================================

/**
 * The shared scatter-with-quadrants config.
 *
 * `opts.goodDirection` says which way is *better* on each axis, defaulting to
 * high/high. Without it the green quadrant was hardcoded to "high x, high y",
 * which painted the best goalkeepers red (a low xGC/90 is what you want) and put
 * a green tint behind a quadrant literally labelled "הגנה חלשה".
 *
 * `opts.colorFor` overrides the quadrant colouring entirely, for charts that
 * colour by category (owned vs free) rather than by position in the grid.
 */
function getMatrixChartConfig(data, xLabel, yLabel, quadLabels = {}, opts = {}) {
    const dataPoints = data.map(d => ({ ...d }));
    const xValues = dataPoints.map(p => p.x);
    const yValues = dataPoints.map(p => p.y);
    // Mean, not median: deliberately, so the crosshair sits at the league average.
    const xMean = xValues.length ? xValues.reduce((a, b) => a + b, 0) / xValues.length : 0;
    const yMean = yValues.length ? yValues.reduce((a, b) => a + b, 0) / yValues.length : 0;

    const good = { x: 'high', y: 'high', ...(opts.goodDirection || {}) };
    const isGood = (v, mean, dir) => dir === 'low' ? v <= mean : v >= mean;

    const GREEN = 'rgba(34, 197, 94, 0.85)';
    const RED = 'rgba(239, 68, 68, 0.85)';
    const AMBER = 'rgba(251, 146, 60, 0.85)';

    const getPointColor = (point) => {
        if (opts.colorFor) return opts.colorFor(point);
        const gx = isGood(point.x, xMean, good.x);
        const gy = isGood(point.y, yMean, good.y);
        if (gx && gy) return GREEN;
        if (!gx && !gy) return RED;
        return AMBER;
    };

    // Quadrant labels are placed by grid corner, but which corner is "good"
    // depends on goodDirection — so the tint follows the caller's own wording.
    const cornerTone = (cx, cy) => {
        const gx = isGood(cx === 'right' ? xMean + 1 : xMean - 1, xMean, good.x);
        const gy = isGood(cy === 'top' ? yMean + 1 : yMean - 1, yMean, good.y);
        if (gx && gy) return { color: 'rgba(21, 128, 61, 0.95)', bg: 'rgba(34, 197, 94, 0.12)' };
        if (!gx && !gy) return { color: 'rgba(185, 28, 28, 0.95)', bg: 'rgba(239, 68, 68, 0.12)' };
        return { color: 'rgba(180, 83, 9, 0.95)', bg: 'rgba(251, 146, 60, 0.12)' };
    };

    // Anchored to the outer corners of the plot, not to the crosshair. Four labels
    // hung off the centre point collided into an unreadable pile as soon as the
    // card was narrow — which is every card in a three-column grid.
    const xLo = xValues.length ? Math.min(...xValues) : 0;
    const xHi = xValues.length ? Math.max(...xValues) : 1;
    const yLo = yValues.length ? Math.min(...yValues) : 0;
    const yHi = yValues.length ? Math.max(...yValues) : 1;

    const cornerLabel = (content, cx, cy) => {
        const tone = cornerTone(cx, cy);
        return {
            type: 'label',
            xValue: cx === 'right' ? xHi : xLo,
            yValue: cy === 'top' ? yHi : yLo,
            content: content || '',
            position: { x: cx === 'right' ? 'end' : 'start', y: cy === 'top' ? 'start' : 'end' },
            xAdjust: cx === 'right' ? -4 : 4,
            yAdjust: cy === 'top' ? 4 : -4,
            color: tone.color, backgroundColor: tone.bg,
            font: { weight: 'bold', size: 10.5 }, padding: 4, borderRadius: 4
        };
    };

    const diagonal = opts.diagonal && dataPoints.length
        ? (() => {
            const hi = Math.min(Math.max(...xValues), Math.max(...yValues));
            return {
                type: 'line', xMin: 0, yMin: 0, xMax: hi, yMax: hi,
                borderColor: 'rgba(100, 116, 139, 0.45)', borderWidth: 2, borderDash: [4, 4]
            };
        })()
        : null;

    return {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Items',
                data: dataPoints,
                pointRadius: ctx => (opts.radiusFor && ctx.raw ? opts.radiusFor(ctx.raw) : 6),
                pointHoverRadius: 9,
                pointBorderWidth: 2,
                pointBorderColor: 'rgba(255, 255, 255, 0.9)',
                backgroundColor: (context) => {
                    if (!context.raw) return 'rgba(156, 163, 175, 0.7)';
                    return getPointColor(context.raw);
                },
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 30, right: 20, bottom: 10, left: 10 }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: xLabel,
                        font: { weight: 'bold', size: 13 },
                        color: '#64748b'
                    },
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                y: {
                    title: {
                        display: true,
                        text: yLabel,
                        font: { weight: 'bold', size: 13 },
                        color: '#64748b'
                    },
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                }
            },
            plugins: {
                legend: { display: false },
                datalabels: {
                    display: 'auto',
                    align: 'top',
                    // `label` when the caller decided which points to name (see
                    // labelTop); player-or-club otherwise, for the team matrices
                    // where every point is worth naming.
                    formatter: (value, context) => {
                        const d = context.dataset.data[context.dataIndex];
                        return d.label !== undefined ? d.label : (d.player || d.team || '');
                    },
                    font: { size: 10, weight: 'bold' },
                    color: '#1e293b',
                    clip: true,
                    clamp: true
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#e2e8f0',
                    borderColor: 'rgba(59, 130, 246, 0.5)',
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: function (context) {
                            const d = context.raw;
                            if (opts.tooltipFor) return opts.tooltipFor(d);
                            return `${d.player || d.team}: (${d.x.toFixed(2)}, ${d.y.toFixed(2)})`;
                        }
                    }
                },
                annotation: {
                    annotations: {
                        xLine: {
                            type: 'line',
                            xMin: xMean, xMax: xMean,
                            borderColor: 'rgba(0,0,0,0.2)', borderWidth: 2, borderDash: [6, 6]
                        },
                        yLine: {
                            type: 'line',
                            yMin: yMean, yMax: yMean,
                            borderColor: 'rgba(0,0,0,0.2)', borderWidth: 2, borderDash: [6, 6]
                        },
                        ...(diagonal ? { diagonal } : {}),
                        labelTopRight: cornerLabel(quadLabels.topRight, 'right', 'top'),
                        labelBottomLeft: cornerLabel(quadLabels.bottomLeft, 'left', 'bottom'),
                        labelTopLeft: cornerLabel(quadLabels.topLeft, 'left', 'top'),
                        labelBottomRight: cornerLabel(quadLabels.bottomRight, 'right', 'bottom')
                    }
                }
            }
        }
    };
}

/* ==========================================================================
   CHARTS VIEW
   ==========================================================================
   Eight cards, ordered by how directly each answers a draft decision, and
   rendered from CHART_SPECS — a new chart is one entry in that list rather than
   a block of markup plus a call site.

   What changed and why:
   - The four positional matrices were the same chart four times. They are one
     card with a position toggle, which leaves room for the charts below.
   - The two team charts were one question split in half ("who attacks well" and
     "who defends well" are only useful together). They are one quadrant.
   - Price-vs-points is gone. There is no budget in a draft league, so an axis
     of £m cannot answer anything; the card's own heading had already drifted to
     describing a different metric than the code plotted.
   - The ICT stacked bar is gone. ICT is a blend the API derives from inputs
     these charts now plot directly.
   - Added the per-gameweek trend, the opportunity board and positional depth:
     the gameweek history was already loaded for the table's micro-charts and no
     chart here had ever used it.
   ========================================================================== */

const POSITION_COLOR = { GKP: '#0891b2', DEF: '#059669', MID: '#6366f1', FWD: '#ea580c' };

/**
 * What "elite" means depends on the position, so each gets its own x axis — and
 * for a goalkeeper the good direction is *down*, which is why the matrix used to
 * paint the best keepers in the league red.
 */
const POSITION_MATRIX = {
    GKP: {
        key: 'expected_goals_conceded_per_90', label: 'xGC ל-90 (נמוך = טוב)',
        good: 'low', minMinutes: 450,
        quads: {
            topLeft: 'הטובים בעמדה', bottomRight: 'החלשים בעמדה',
            topRight: 'נקודות למרות הגנה פרוצה', bottomLeft: 'הגנה טובה, מעט נקודות'
        }
    },
    DEF: {
        key: 'def_contrib_per90', label: 'תרומה הגנתית ל-90',
        good: 'high', minMinutes: 450,
        quads: {
            topRight: 'הטובים בעמדה', bottomLeft: 'החלשים בעמדה',
            topLeft: 'נקודות בלי בסיס הגנתי', bottomRight: 'בסיס הגנתי בלי נקודות'
        }
    },
    MID: {
        key: 'xGI_per90', label: 'xGI ל-90',
        good: 'high', minMinutes: 450,
        quads: {
            topRight: 'הטובים בעמדה', bottomLeft: 'החלשים בעמדה',
            topLeft: 'נקודות בלי הזדמנויות', bottomRight: 'הזדמנויות בלי נקודות'
        }
    },
    FWD: {
        key: 'xGI_per90', label: 'xGI ל-90',
        good: 'high', minMinutes: 360,
        quads: {
            topRight: 'הטובים בעמדה', bottomLeft: 'החלשים בעמדה',
            topLeft: 'נקודות בלי הזדמנויות', bottomRight: 'הזדמנויות בלי נקודות'
        }
    }
};

const CHART_LINE_PALETTE = ['#6366f1', '#ea580c', '#059669', '#0891b2',
    '#be185d', '#d97706', '#7c3aed', '#dc2626'];

/**
 * Names only the points worth naming.
 *
 * The datalabels plugin drops labels that collide, so a 500-player scatter does
 * not print 500 names — but it does print every name it can fit, which came out
 * as a solid mat of text across the middle of the chart. The tooltip still
 * identifies every point; the printed labels are reserved for the ones the chart
 * exists to surface.
 *
 * Every point keeps `name` for the tooltip; only the chosen ones get `player`,
 * which is what the label formatter reads.
 */
function labelTop(points, count, score) {
    const chosen = new Set([...points]
        .sort((a, b) => score(b) - score(a))
        .slice(0, count));
    // An explicit empty `label` rather than just omitting the name: the formatter
    // falls back to the club when there is no player name, so leaving it off
    // printed a chart labelled with twenty repetitions of "Arsenal".
    return points.map(pt => ({ ...pt, label: chosen.has(pt) ? pt.name : '' }));
}

/** Axis and tooltip chrome shared by the non-scatter charts. */
function chartAxis(text) {
    return {
        title: { display: true, text, font: { weight: 'bold', size: 12 }, color: '#64748b' },
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: { color: '#94a3b8', font: { size: 11 } }
    };
}

const CHART_TOOLTIP = {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    titleColor: '#fff',
    bodyColor: '#e2e8f0',
    borderColor: 'rgba(59, 130, 246, 0.5)',
    borderWidth: 1,
    padding: 10
};

/* ----------------------------- 1. opportunity ----------------------------- */

function buildOpportunityChart(data) {
    if (!state.trendGws.length) return null;
    const owned = state.draft.ownedElementIds;
    const rosterKnown = owned.size > 0;

    const raw = data.map(p => {
        const delta = trendDelta(p, 'pts');
        if (delta === null || p.minutes < 450) return null;
        return {
            x: p.draft_score, y: delta, name: p.web_name, team: p.team_name,
            free: !rosterKnown || !owned.has(p.id)
        };
    }).filter(Boolean);
    if (raw.length < 4) return null;

    // Named: the free agents who are both good and climbing. That is the whole
    // question the card asks, and nothing else on it needs a printed name.
    const points = labelTop(raw, 12, pt => (pt.free ? 1000 : 0) + pt.x + pt.y * 3);

    return getMatrixChartConfig(points, 'ציון דראפט',
        `שינוי נקודות מול ${state.trendWindow} המחזורים שלפני`, {
        topRight: 'איכות ומומנטום', topLeft: 'מתחמם אבל חלש',
        bottomRight: 'איכות שמתקררת', bottomLeft: 'לא עכשיו'
    }, {
        // Colour by availability, not by quadrant: the best player on the chart is
        // usually already on someone's roster, so "can I have him" outranks
        // "is he good" as the first thing to see.
        colorFor: pt => pt.free ? 'rgba(34, 197, 94, 0.85)' : 'rgba(148, 163, 184, 0.35)',
        radiusFor: pt => pt.free ? 5.5 : 3.5,
        tooltipFor: d => `${d.name} · ${d.team}${d.free ? ' · 🆓 חופשי' : ' · תפוס'} — `
            + `ציון ${d.x.toFixed(1)}, ${d.y > 0 ? '+' : ''}${d.y.toFixed(1)} נק׳`
    });
}

/* --------------------------- 2. position matrix --------------------------- */

function buildPositionMatrix(data) {
    const pos = POSITION_MATRIX[state.chartPosition] ? state.chartPosition : 'MID';
    const spec = POSITION_MATRIX[pos];
    const players = data.filter(p => p.position_name === pos && p.minutes > spec.minMinutes);
    if (players.length < 3) return null;

    const raw = players.map(p => ({
        x: parseFloat(p[spec.key]) || 0,
        y: parseFloat(p.points_per_game_90) || 0,
        name: p.web_name, team: p.team_name
    }));

    // Named: the ones in the good quadrant, by output.
    const dir = spec.good === 'low' ? -1 : 1;
    const points = labelTop(raw, 14, pt => pt.y * 2 + pt.x * dir);

    return getMatrixChartConfig(points, spec.label, 'נקודות ל-90 דקות', spec.quads, {
        goodDirection: { x: spec.good, y: 'high' },
        radiusFor: () => 5,
        tooltipFor: d => `${d.name} · ${d.team} — ${spec.label}: ${d.x.toFixed(2)}, `
            + `${d.y.toFixed(1)} נק׳/90`
    });
}

function setChartPosition(pos) {
    state.chartPosition = POSITION_MATRIX[pos] ? pos : 'MID';
    renderCharts();
}

/* ------------------------------- 3. trend -------------------------------- */

function buildTrendChart(data) {
    if (state.trendGws.length < 2) return null;

    const ranked = data
        .map(p => ({ p, total: summariseTrend(getTrendSeries(p.id, 'pts', 'recent'), 'sum') }))
        .filter(x => x.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 8);
    if (ranked.length < 2) return null;

    return {
        type: 'line',
        data: {
            labels: state.trendGws.map(g => `מחזור ${g.gw}`),
            datasets: ranked.map((x, i) => ({
                label: x.p.web_name,
                data: getTrendSeries(x.p.id, 'pts', 'recent').map(pt => pt.value),
                borderColor: CHART_LINE_PALETTE[i % CHART_LINE_PALETTE.length],
                backgroundColor: CHART_LINE_PALETTE[i % CHART_LINE_PALETTE.length],
                borderWidth: 2, tension: 0.3, pointRadius: 3, pointHoverRadius: 6
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: chartAxis(''),
                y: { ...chartAxis('נקודות במחזור'), beginAtZero: true }
            },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 }, color: '#475569' } },
                datalabels: { display: false },
                tooltip: CHART_TOOLTIP
            }
        }
    };
}

/* ---------------------------- 4. conversion ------------------------------ */

function buildConversionChart(data) {
    const raw = data.map(p => {
        const xgi = parseFloat(p.expected_goal_involvements) || 0;
        if (p.minutes < 450 || xgi < 2) return null;
        return {
            x: xgi, y: (p.goals_scored || 0) + (p.assists || 0),
            name: p.web_name, team: p.team_name
        };
    }).filter(Boolean);
    if (raw.length < 4) return null;

    // Distance from the diagonal is the whole point of this chart, so it is not
    // coloured by quadrant: above the line means converting more than the chances
    // were worth (expect a fall), below means the opposite (expect a correction).
    const GAP = 1.5;
    // Named: the ones furthest off the line in either direction — the only points
    // on this chart that are telling you to do something.
    const points = labelTop(raw, 14, pt => Math.abs(pt.y - pt.x));

    return getMatrixChartConfig(points, 'צפי מעורבות (xGI)', 'מעורבות בפועל (G+A)', {}, {
        diagonal: true,
        colorFor: pt => pt.y - pt.x >= GAP ? 'rgba(251, 146, 60, 0.9)'
            : pt.x - pt.y >= GAP ? 'rgba(59, 130, 246, 0.9)'
                : 'rgba(148, 163, 184, 0.4)',
        radiusFor: pt => Math.abs(pt.y - pt.x) >= GAP ? 6 : 3.5,
        tooltipFor: d => {
            const gap = d.y - d.x;
            const verdict = gap >= GAP ? 'מימוש יתר — צפוי לרדת'
                : gap <= -GAP ? 'מימוש חסר — צפוי לתקן' : 'ממש לפי הצפי';
            return `${d.name} · ${d.team} — xGI ${d.x.toFixed(1)}, G+A ${d.y} (${verdict})`;
        }
    });
}

/* ------------------------------- 5. teams -------------------------------- */

function buildTeamChart(data) {
    const teams = new Map();
    data.forEach(p => {
        if (!teams.has(p.team_name)) {
            teams.set(p.team_name, { attMins: 0, defMins: 0, xgi: 0, xgc: 0, fdr: 0, fdrN: 0 });
        }
        const t = teams.get(p.team_name);
        if (['MID', 'FWD'].includes(p.position_name)) {
            t.attMins += p.minutes;
            t.xgi += parseFloat(p.expected_goal_involvements) || 0;
        } else {
            t.defMins += p.minutes;
            t.xgc += parseFloat(p.expected_goals_conceded) || 0;
        }
        if (p.next_3_fdr > 0) { t.fdr += p.next_3_fdr; t.fdrN++; }
    });

    const points = [...teams.entries()].map(([team, t]) => {
        // Per 90 minutes of the players who make up that half of the team, so a
        // squad the filters happened to trim to three players is not compared
        // against one with eleven.
        if (t.attMins < 900 || t.defMins < 900) return null;
        return {
            x: t.xgi / (t.attMins / 90),
            y: t.xgc / (t.defMins / 90),
            fdr: t.fdrN ? t.fdr / t.fdrN : 0,
            team
        };
    }).filter(Boolean);
    if (points.length < 4) return null;

    return getMatrixChartConfig(points, 'צפי מעורבות התקפית ל-90', 'צפי ספיגות ל-90', {
        bottomRight: 'הקבוצה שאתה רוצה', topLeft: 'להתרחק',
        topRight: 'התקפה חזקה, הגנה פרוצה', bottomLeft: 'הגנה טובה, התקפה חלשה'
    }, {
        // Conceding less is better, so "good" is down on this axis. Without this
        // the green tint sat behind the quadrant labelled "הגנה חלשה".
        goodDirection: { x: 'high', y: 'low' },
        radiusFor: pt => pt.fdr > 0 ? Math.max(4, Math.min(11, 4 + (5 - pt.fdr) * 1.8)) : 6,
        tooltipFor: d => `${d.team} — xGI ${d.x.toFixed(2)}, xGC ${d.y.toFixed(2)}`
            + (d.fdr > 0 ? `, קושי 3 הבאים ${d.fdr.toFixed(1)}` : '')
    });
}

/* ---------------------------- 6. positional depth ------------------------ */

function buildDepthChart(data) {
    const owned = state.draft.ownedElementIds;
    const rosterKnown = owned.size > 0;
    const DEPTH = 10;

    const datasets = Object.keys(POSITION_COLOR).map(pos => {
        const values = data
            .filter(p => p.position_name === pos && p.vorp !== null && p.vorp !== undefined
                && (!rosterKnown || !owned.has(p.id)))
            .map(p => p.vorp)
            .sort((a, b) => b - a)
            .slice(0, DEPTH);
        return {
            label: POSITION_LABELS[pos],
            // Shorter than DEPTH means the position runs dry before the tenth
            // pick, which is exactly the scarcity this chart is about.
            data: Array.from({ length: DEPTH }, (_, i) => i < values.length ? values[i] : null),
            borderColor: POSITION_COLOR[pos],
            backgroundColor: POSITION_COLOR[pos],
            borderWidth: 2, tension: 0.25, pointRadius: 3, spanGaps: false
        };
    }).filter(d => d.data.some(v => v !== null));

    if (!datasets.length) return null;

    return {
        type: 'line',
        data: {
            labels: Array.from({ length: DEPTH }, (_, i) => `#${i + 1}`),
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: chartAxis(rosterKnown ? 'הפנוי ה-N הטוב בעמדה' : 'השחקן ה-N הטוב בעמדה'),
                y: chartAxis('VORP')
            },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 }, color: '#475569' } },
                datalabels: { display: false },
                tooltip: {
                    ...CHART_TOOLTIP,
                    callbacks: {
                        label: c => `${c.dataset.label}: VORP ${Number(c.parsed.y).toFixed(2)}`
                    }
                },
                annotation: {
                    annotations: {
                        replacement: {
                            type: 'line', yMin: 0, yMax: 0,
                            borderColor: 'rgba(100, 116, 139, 0.5)', borderWidth: 2, borderDash: [5, 5],
                            label: {
                                display: true, content: 'רמת החלופה', position: 'start',
                                color: '#64748b', backgroundColor: 'rgba(241,245,249,.9)',
                                font: { size: 10, weight: 'bold' }
                            }
                        }
                    }
                }
            }
        }
    };
}

/* --------------------------- 7. minutes security ------------------------- */

function buildMinutesChart(data) {
    const raw = data.map(p => {
        if (p.rotation_risk === null || p.rotation_risk === undefined || p.minutes < 600) return null;
        return {
            x: Math.round(p.rotation_risk * 100),
            y: parseFloat(p.points_per_game_90) || 0,
            name: p.web_name, team: p.team_name
        };
    }).filter(Boolean);
    if (raw.length < 4) return null;

    // Named: nailed and productive, plus the productive-but-rotated risks.
    const points = labelTop(raw, 12, pt => pt.y * 2 + pt.x / 25);

    return getMatrixChartConfig(points, 'אחוז ההופעות שבהן פתח בהרכב', 'נקודות ל-90 דקות', {
        topRight: 'קבוע ומייצר', bottomLeft: 'מסובב ולא מייצר',
        topLeft: 'מייצר אבל מסובב', bottomRight: 'קבוע אבל לא מייצר'
    }, {
        radiusFor: () => 4.5,
        tooltipFor: d => `${d.name} · ${d.team} — ${d.x}% פתיחות, ${d.y.toFixed(1)} נק׳/90`
    });
}

/* -------------------------------- 8. DEFCON ------------------------------ */

function buildDefconChart(data) {
    const top = data
        .filter(p => p.defcon_hit_rate !== null && p.defcon_hit_rate !== undefined
            && p.position_name !== 'GKP')
        .sort((a, b) => b.defcon_hit_rate - a.defcon_hit_rate)
        .slice(0, 15);
    // The live API has no per-match DEFCON history, so this is snapshot-only —
    // the card hides itself rather than drawing an empty axis.
    if (top.length < 3) return null;

    return {
        type: 'bar',
        data: {
            labels: top.map(p => p.web_name),
            datasets: [{
                label: 'אחוז משחקים מעל הסף',
                data: top.map(p => p.defcon_hit_rate),
                backgroundColor: top.map(p => POSITION_COLOR[p.position_name] || '#64748b'),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                x: { ...chartAxis('% מההופעות'), beginAtZero: true, max: 100 },
                y: { ...chartAxis(''), grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                datalabels: {
                    // 'right', not 'end': on a horizontal bar 'end' resolved to the
                    // bar's own end and the figure straddled the edge of the fill.
                    anchor: 'end', align: 'right', offset: 4, clamp: true,
                    formatter: v => `${Math.round(v)}%`,
                    font: { size: 10, weight: 'bold' }, color: '#475569'
                },
                tooltip: {
                    ...CHART_TOOLTIP,
                    callbacks: {
                        label: c => `${Math.round(c.parsed.x)}% מההופעות מעל הסף`
                    }
                }
            }
        }
    };
}

/* -------------------------------- the list ------------------------------- */

const CHART_SPECS = [
    {
        id: 'chart-opportunity', title: '🎯 לוח הזדמנויות',
        note: 'ציון דראפט מול המומנטום בחלון הנבחר. ירוק = פנוי, אפור = תפוס.',
        build: buildOpportunityChart
    },
    {
        id: 'chart-position', title: '📊 מטריצת עמדה',
        note: 'מי מייצר יותר ממה שהעמדה שלו דורשת. הצירים משתנים לפי העמדה.',
        build: buildPositionMatrix, positions: true
    },
    {
        id: 'chart-trend', title: '📈 טרנד נקודות',
        note: 'הנקודות מחזור-מחזור של שמונת החמים בסינון הנוכחי — מי בעלייה ומי דועך.',
        build: buildTrendChart
    },
    {
        id: 'chart-conversion', title: '⚖️ מימוש מול צפי',
        note: 'מעל הקו — מימוש יתר, צפוי לרדת. מתחת לקו — מימוש חסר, צפוי לתקן.',
        build: buildConversionChart
    },
    {
        id: 'chart-teams', title: '🏟️ קבוצות: התקפה מול הגנה',
        note: 'למי כדאי להחזיק שחקנים. נקודה גדולה = לוח משחקים קל יותר בשלושת הבאים.',
        build: buildTeamChart
    },
    {
        id: 'chart-depth', title: '📉 עומק לפי עמדה',
        note: 'כמה מהר נגמרים השחקנים הטובים בכל עמדה — סדר העדיפויות בדראפט ובטרייד.',
        build: buildDepthChart
    },
    {
        id: 'chart-minutes', title: '🔒 ביטחון דקות מול תפוקה',
        note: 'בדראפט אי אפשר פשוט להעביר שחקן, ולכן שחקן מסובב מסוכן גם אם הוא טוב.',
        build: buildMinutesChart
    },
    {
        id: 'chart-defcon', title: '🛡️ מכונות DEFCON',
        note: 'אחוז ההופעות שבהן עברו בפועל את הסף. ממוצע ל-90 דקות מטעה כאן.',
        build: buildDefconChart
    }
];

/** Builds the card scaffolding once, from CHART_SPECS. */
function ensureChartCards() {
    const grid = document.getElementById('chartsGrid');
    if (!grid || grid.dataset.built === '1') return grid;

    grid.innerHTML = CHART_SPECS.map(spec => `
        <section class="chart-card" id="card-${spec.id}">
            <header class="chart-head">
                <div>
                    <h3 class="chart-title">${spec.title}</h3>
                    <p class="chart-note">${spec.note}</p>
                </div>
                ${spec.positions ? `<div class="chart-seg" role="group" aria-label="עמדה">
                    ${Object.keys(POSITION_MATRIX).map(pos => `
                        <button type="button" data-chart-pos="${pos}"
                            onclick="setChartPosition('${pos}')">${POSITION_LABELS[pos]}</button>`).join('')}
                </div>` : ''}
            </header>
            <div class="chart-canvas"><canvas id="${spec.id}"></canvas></div>
        </section>`).join('');

    grid.dataset.built = '1';
    return grid;
}

function renderCharts() {
    if (!state.allPlayersData[state.currentDataSource].processed) return;

    const chartsView = document.getElementById('mainChartsView');
    if (!chartsView || getComputedStyle(chartsView).display === 'none') return;

    ensureChartCards();

    // Pre-slice, so a "top 20" table does not reduce every scatter to 20 points.
    const data = (state.filteredData && state.filteredData.length)
        ? state.filteredData
        : (state.displayedData || state.allPlayersData[state.currentDataSource].processed);

    document.querySelectorAll('#chartsGrid [data-chart-pos]').forEach(btn => {
        btn.setAttribute('aria-pressed', String(btn.dataset.chartPos === state.chartPosition));
    });

    CHART_SPECS.forEach(spec => {
        const card = document.getElementById(`card-${spec.id}`);
        const canvas = document.getElementById(spec.id);
        if (!card || !canvas) return;

        let config = null;
        try {
            config = spec.build(data);
        } catch (e) {
            console.warn(`⚠️ chart ${spec.id} failed to build`, e);
        }

        if (charts[spec.id]) {
            charts[spec.id].destroy();
            charts[spec.id] = null;
        }

        // A card with nothing to plot hides itself. Leaving an empty axis behind
        // reads as a broken chart rather than as "this needs data you don't have
        // yet" — which is the normal state before a season has been played.
        card.hidden = !config;
        if (!config) return;

        charts[spec.id] = new Chart(canvas.getContext('2d'), config);
    });
}

// ============================================
// VIEW SWITCHING
// ============================================
// One definition. There used to be two: a plain one here and an IIFE lower down
// that replaced it, so the version being read was not the version running.

function switchMainView(viewName) {
    const tableDiv = document.getElementById('mainTableView');
    const chartsDiv = document.getElementById('mainChartsView');
    const btnTable = document.getElementById('btnViewTable');
    const btnCharts = document.getElementById('btnViewCharts');

    const charting = viewName === 'charts';
    if (tableDiv) tableDiv.style.display = charting ? 'none' : 'block';
    if (chartsDiv) chartsDiv.style.display = charting ? 'block' : 'none';
    if (btnTable) btnTable.classList.toggle('active', !charting);
    if (btnCharts) btnCharts.classList.toggle('active', charting);

    // renderCharts() bails while the view is display:none, so it has to run after
    // the switch — and after a frame, so the canvases have a measured size.
    if (charting) setTimeout(renderCharts, 50);
}


// ============================================
// DRAFT FEATURE RESTORATION - NAVIGATION & UI
// ============================================

/**
 * Calculate xPts for a team using only the top 11 players by predicted points
 * This gives a more realistic prediction than using all 15 players
 */
function calculateTeamXPts(roster, processedById) {
    const squad = roster.map(id => processedById.get(id)).filter(Boolean);

    // Sort by predicted points and take top 11
    const top11 = squad
        .sort((a, b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0))
        .slice(0, 11);

    return top11.reduce((sum, p) => sum + (parseFloat(p.predicted_points_1_gw) || 0), 0);
}

/**
 * Calculate form factor - average points from last 5 gameweeks
 * @param {Array} roster - Array of player IDs
 * @param {Map} processedById - Map of player data
 * @param {number} entryId - Team entry ID
 * @returns {number} Average points from last 5 GWs
 */
function calculateFormFactor(roster, processedById, entryId) {
    const historicalLineups = state.draft.historicalLineups.get(entryId);
    if (!historicalLineups) return 0;

    const currentGW = state.draft.details?.league?.current_event || getCurrentEventId();
    const gwsToCheck = Math.min(5, currentGW); // Last 5 GWs or less
    let totalPoints = 0;
    let gwCount = 0;

    for (let i = 0; i < gwsToCheck; i++) {
        const gw = currentGW - i;
        if (gw < 1) break;

        const gwKey = `gw${gw}`;
        const lineup = historicalLineups[gwKey];

        if (lineup && lineup.starting) {
            const starters = lineup.starting
                .map(id => processedById.get(id))
                .filter(p => p && p.minutes > 0);

            const gwPoints = starters.reduce((sum, p) => sum + (p.event_points || 0), 0);
            totalPoints += gwPoints;
            gwCount++;
        }
    }

    return gwCount > 0 ? totalPoints / gwCount : 0;
}

/**
 * Calculate head-to-head history between two teams
 * @param {number} team1Id - First team entry ID
 * @param {number} team2Id - Second team entry ID
 * @returns {Object} { team1Wins, team2Wins, draws }
 */
function calculateH2HHistory(team1Id, team2Id) {
    const matches = state.draft.details?.matches || [];
    let team1Wins = 0, team2Wins = 0, draws = 0;

    matches.forEach(m => {
        if (m.finished &&
            ((m.league_entry_1 === team1Id && m.league_entry_2 === team2Id) ||
                (m.league_entry_1 === team2Id && m.league_entry_2 === team1Id))) {

            const score1 = m.league_entry_1 === team1Id ? m.league_entry_1_points : m.league_entry_2_points;
            const score2 = m.league_entry_1 === team1Id ? m.league_entry_2_points : m.league_entry_1_points;

            if (score1 > score2) team1Wins++;
            else if (score2 > score1) team2Wins++;
            else draws++;
        }
    });

    return { team1Wins, team2Wins, draws };
}

/**
 * Calculate injury impact - reduction for injured/suspended players
 * @param {Array} roster - Array of player IDs
 * @param {Map} processedById - Map of player data
 * @returns {number} Percentage reduction (0-1)
 */
function calculateInjuryImpact(roster, processedById) {
    const squad = roster.map(id => processedById.get(id)).filter(Boolean);
    const top11 = squad
        .sort((a, b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0))
        .slice(0, 11);

    let injuredCount = 0;
    top11.forEach(p => {
        // Check if player is injured, suspended, or doubtful
        const status = p.status || '';
        if (['i', 's', 'd', 'u'].includes(status.toLowerCase())) {
            injuredCount++;
        }
    });

    // Each injured player reduces team strength by ~8%
    return injuredCount * 0.08;
}

/**
 * Calculate advanced win probability using multiple factors
 * @param {number} team1Id - First team entry ID
 * @param {number} team2Id - Second team entry ID
 * @param {Array} roster1 - First team roster
 * @param {Array} roster2 - Second team roster
 * @param {Map} processedById - Map of player data
 * @returns {Object} { winProb1, winProb2 }
 */
function calculateAdvancedWinProbability(team1Id, team2Id, roster1, roster2, processedById) {
    // 1. Base xPts (55% weight) - only top 11 players
    const xPts1 = calculateTeamXPts(roster1, processedById);
    const xPts2 = calculateTeamXPts(roster2, processedById);

    // 2. Form Factor (20% weight) - average of last 5 GWs
    const form1 = calculateFormFactor(roster1, processedById, team1Id);
    const form2 = calculateFormFactor(roster2, processedById, team2Id);

    // 3. Head-to-Head History (15% weight)
    const h2h = calculateH2HHistory(team1Id, team2Id);
    const totalH2H = h2h.team1Wins + h2h.team2Wins + h2h.draws;
    const h2hFactor1 = totalH2H > 0 ? h2h.team1Wins / totalH2H : 0.5;
    const h2hFactor2 = totalH2H > 0 ? h2h.team2Wins / totalH2H : 0.5;

    // 4. Injury Impact (10% weight)
    const injuryImpact1 = calculateInjuryImpact(roster1, processedById);
    const injuryImpact2 = calculateInjuryImpact(roster2, processedById);

    // Combine all factors with weights
    const score1 = (xPts1 * 0.55) + (form1 * 0.20) + (h2hFactor1 * 100 * 0.15) - (injuryImpact1 * 100 * 0.10);
    const score2 = (xPts2 * 0.55) + (form2 * 0.20) + (h2hFactor2 * 100 * 0.15) - (injuryImpact2 * 100 * 0.10);

    // Calculate win probability using sigmoid function
    const diff = score1 - score2;
    const scaleFactor = 0.08; // Adjust for desired curve steepness

    let winProb1 = 50 + (50 * Math.tanh(diff * scaleFactor));
    let winProb2 = 100 - winProb1;

    // Ensure range is 25%-75%
    if (winProb1 < 25) {
        winProb1 = 25;
        winProb2 = 75;
    } else if (winProb1 > 75) {
        winProb1 = 75;
        winProb2 = 25;
    }

    return { winProb1, winProb2 };
}

function renderNextRoundFixtures() {
    if (!state.draft.details || !state.draft.details.matches) return '';

    const currentGW = state.draft.details.league?.current_event || getCurrentEventId();
    const nextGW = currentGW + 1;
    const nextMatches = state.draft.details.matches.filter(m => m.event === nextGW);

    if (nextMatches.length === 0) return '';

    const processedById = getProcessedByElementId();

    let html = `
        <div class="next-fixtures-card" style="background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); margin-bottom: 16px; border: 1px solid #e2e8f0;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                <span style="font-size: 24px;">⚔️</span>
                <h3 style="margin: 0; font-size: 18px; color: #0f172a; font-weight: 800;">משחקי מחזור ${nextGW}</h3>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px;">
    `;

    nextMatches.forEach(match => {
        const team1 = state.draft.entryIdToTeamName.get(match.league_entry_1) || 'Unknown';
        const team2 = state.draft.entryIdToTeamName.get(match.league_entry_2) || 'Unknown';
        const logo1 = getTeamLogo(team1);
        const logo2 = getTeamLogo(team2);

        // Calculate win probability with ADVANCED algorithm
        const roster1 = state.draft.rostersByEntryId.get(match.league_entry_1) || [];
        const roster2 = state.draft.rostersByEntryId.get(match.league_entry_2) || [];

        // Handle "null" team (average team)
        const isTeam1Null = team1.toLowerCase().includes('null') || team1 === 'Unknown';
        const isTeam2Null = team2.toLowerCase().includes('null') || team2 === 'Unknown';

        let winProb1, winProb2, xPts1, xPts2;

        if (isTeam1Null || isTeam2Null) {
            // If playing against "null" (average), it's 50-50
            winProb1 = 50;
            winProb2 = 50;
            xPts1 = calculateTeamXPts(roster1, processedById);
            xPts2 = calculateTeamXPts(roster2, processedById);
        } else {
            // Use advanced algorithm with form, history, and injuries
            const result = calculateAdvancedWinProbability(
                match.league_entry_1,
                match.league_entry_2,
                roster1,
                roster2,
                processedById
            );
            winProb1 = result.winProb1;
            winProb2 = result.winProb2;
            xPts1 = calculateTeamXPts(roster1, processedById);
            xPts2 = calculateTeamXPts(roster2, processedById);
        }

        html += `
            <div style="background: white; padding: 14px; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 36px; margin-bottom: 6px;">${logo1}</div>
                        <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;">${team1}</div>
                        <div style="background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; display: inline-block;">
                            ${xPts1.toFixed(1)}
                        </div>
                    </div>
                    
                    <div style="text-align: center; padding: 0 10px;">
                        <div style="font-weight: 900; font-size: 18px; color: #64748b;">VS</div>
                    </div>
                    
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 36px; margin-bottom: 6px;">${logo2}</div>
                        <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;">${team2}</div>
                        <div style="background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; display: inline-block;">
                            ${xPts2.toFixed(1)}
                        </div>
                    </div>
                </div>
                
                <div style="margin-top: 8px;">
                    <div style="display: flex; height: 28px; background: #f1f5f9; border-radius: 14px; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.08);">
                        <div style="width: ${winProb1}%; background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 12px; transition: width 0.5s ease;">
                            ${winProb1.toFixed(0)}%
                        </div>
                        <div style="width: ${winProb2}%; background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 12px; transition: width 0.5s ease;">
                            ${winProb2.toFixed(0)}%
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    return html;
}

function switchDraftTab(tabId) {
    // Update Nav Buttons
    document.querySelectorAll('.draft-nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabId)) {
            btn.classList.add('active');
        }
    });

    // Update Content Areas
    document.querySelectorAll('.draft-sub-content').forEach(div => {
        div.classList.remove('active');
        div.style.display = 'none';
    });

    const activeDiv = document.getElementById(`draft-${tabId}`);
    if (activeDiv) {
        activeDiv.classList.add('active');
        activeDiv.style.display = 'block';
    }

    // Specific logic for tabs
    if (tabId === 'rival') {
        renderNextRivalAnalysis();
    } else if (tabId === 'overview') {
        // Ensure overview components are rendered if data exists
        if (state.draft.details) {
            renderAllTeamsTrendChart(null, window.currentTrendState?.mode || 'cumulative', window.currentTrendState?.highlightTeamIds || []);
        }
    } else if (tabId === 'nextround') {
        // Render next round fixtures
        const fixturesContainer = document.getElementById('nextFixturesOverview');
        if (fixturesContainer && state.draft.details) {
            const fixturesHtml = renderNextRoundFixtures();
            fixturesContainer.innerHTML = fixturesHtml || '<div style="text-align: center; padding: 40px; color: #64748b;">אין משחקים קרובים</div>';
        }
    } else if (tabId === 'h2h') {
        // Render head-to-head history
        renderH2HHistory();
    } else if (tabId === 'lineup-analysis') {
        // Render lineup decisions analysis
        renderLineupAnalysis();
    }
}

// ============================================
// HEAD-TO-HEAD HISTORY & LINEUP ANALYSIS
// ============================================

/**
 * Render head-to-head match history between two teams
 */
function renderH2HHistory() {
    const container = document.getElementById('h2hHistoryContainer');
    if (!container) return;

    const myTeam = findMyTeam();
    if (!myTeam) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;">אנא בחר את הקבוצה שלך תחילה</div>';
        return;
    }

    const entries = state.draft.details?.league_entries || [];
    const matches = state.draft.details?.matches || [];

    // Create team selectors
    let html = `
        <div style="background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); padding: 24px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 24px; border: 2px solid #e2e8f0;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="margin: 0 0 8px 0; font-size: 24px; color: #0f172a; font-weight: 900;">📜 היסטוריית מפגשים</h2>
                <p style="margin: 0; color: #64748b; font-size: 14px;">בחר שתי קבוצות כדי לראות את כל המשחקים ביניהן</p>
            </div>
            <div style="display: flex; justify-content: center; align-items: center; gap: 15px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label style="font-size: 14px; font-weight: 600; color: #3b82f6;">קבוצה 1:</label>
                    <select id="h2hTeam1" onchange="renderH2HHistory()" style="padding: 10px 16px; border-radius: 8px; border: 2px solid #3b82f6; font-size: 14px; font-weight: 600; color: #334155; cursor: pointer; background: white;">
                        ${entries.map(e => `<option value="${e.id}" ${e.id === myTeam.id ? 'selected' : ''}>${e.entry_name}</option>`).join('')}
                    </select>
                </div>
                <span style="font-size: 24px; color: #cbd5e1;">⚔️</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label style="font-size: 14px; font-weight: 600; color: #ef4444;">קבוצה 2:</label>
                    <select id="h2hTeam2" onchange="renderH2HHistory()" style="padding: 10px 16px; border-radius: 8px; border: 2px solid #ef4444; font-size: 14px; font-weight: 600; color: #334155; cursor: pointer; background: white;">
                        ${entries.filter(e => e.id !== myTeam.id).map(e => `<option value="${e.id}">${e.entry_name}</option>`).join('')}
                    </select>
                </div>
            </div>
        </div>
    `;

    // Get selected teams
    const team1Select = document.getElementById('h2hTeam1');
    const team2Select = document.getElementById('h2hTeam2');
    const team1Id = team1Select ? parseInt(team1Select.value) : myTeam.id;
    const team2Id = team2Select ? parseInt(team2Select.value) : (entries.find(e => e.id !== myTeam.id)?.id || 0);

    const team1 = entries.find(e => e.id === team1Id);
    const team2 = entries.find(e => e.id === team2Id);

    if (!team1 || !team2) {
        container.innerHTML = html + '<div style="text-align: center; padding: 40px; color: #64748b;">לא נמצאו קבוצות</div>';
        return;
    }

    // Filter matches between these two teams
    const h2hMatches = matches.filter(m =>
        m.finished &&
        ((m.league_entry_1 === team1Id && m.league_entry_2 === team2Id) ||
            (m.league_entry_1 === team2Id && m.league_entry_2 === team1Id))
    ).sort((a, b) => b.event - a.event); // Most recent first

    if (h2hMatches.length === 0) {
        html += '<div style="text-align: center; padding: 60px; background: white; border-radius: 12px; border: 2px dashed #e2e8f0;"><div style="font-size: 48px; margin-bottom: 16px;">🤷</div><h3 style="margin: 0 0 8px 0; color: #475569;">אין משחקים קודמים</h3><p style="margin: 0; color: #94a3b8;">שתי הקבוצות עדיין לא התמודדו זו מול זו</p></div>';
        container.innerHTML = html;
        return;
    }

    // Calculate stats
    let team1Wins = 0, team2Wins = 0, draws = 0;
    let team1TotalPoints = 0, team2TotalPoints = 0;

    h2hMatches.forEach(m => {
        const score1 = m.league_entry_1 === team1Id ? m.league_entry_1_points : m.league_entry_2_points;
        const score2 = m.league_entry_1 === team1Id ? m.league_entry_2_points : m.league_entry_1_points;

        team1TotalPoints += score1;
        team2TotalPoints += score2;

        if (score1 > score2) team1Wins++;
        else if (score2 > score1) team2Wins++;
        else draws++;
    });

    // Summary stats
    html += `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%); padding: 20px; border-radius: 12px; text-align: center; color: white;">
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">נצחונות ${team1.entry_name}</div>
                <div style="font-size: 36px; font-weight: 900;">${team1Wins}</div>
            </div>
            <div style="background: linear-gradient(135deg, #64748b 0%, #94a3b8 100%); padding: 20px; border-radius: 12px; text-align: center; color: white;">
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">תיקו</div>
                <div style="font-size: 36px; font-weight: 900;">${draws}</div>
            </div>
            <div style="background: linear-gradient(135deg, #ef4444 0%, #f87171 100%); padding: 20px; border-radius: 12px; text-align: center; color: white;">
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">נצחונות ${team2.entry_name}</div>
                <div style="font-size: 36px; font-weight: 900;">${team2Wins}</div>
            </div>
        </div>
    `;

    // Matches table
    html += `
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
            <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 16px; border-bottom: 2px solid #e2e8f0;">
                <h3 style="margin: 0; font-size: 18px; color: #0f172a; font-weight: 800;">📋 כל המשחקים (${h2hMatches.length})</h3>
            </div>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 12px; text-align: center; font-weight: 700; color: #475569; font-size: 13px;">מחזור</th>
                            <th style="padding: 12px; text-align: right; font-weight: 700; color: #475569; font-size: 13px;">${team1.entry_name}</th>
                            <th style="padding: 12px; text-align: center; font-weight: 700; color: #475569; font-size: 13px;">תוצאה</th>
                            <th style="padding: 12px; text-align: left; font-weight: 700; color: #475569; font-size: 13px;">${team2.entry_name}</th>
                            <th style="padding: 12px; text-align: center; font-weight: 700; color: #475569; font-size: 13px;">מנצח</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    h2hMatches.forEach((m, idx) => {
        const score1 = m.league_entry_1 === team1Id ? m.league_entry_1_points : m.league_entry_2_points;
        const score2 = m.league_entry_1 === team1Id ? m.league_entry_2_points : m.league_entry_1_points;
        const winner = score1 > score2 ? team1.entry_name : score2 > score1 ? team2.entry_name : 'תיקו';
        const winnerColor = score1 > score2 ? '#3b82f6' : score2 > score1 ? '#ef4444' : '#64748b';

        html += `
            <tr style="border-bottom: 1px solid #f1f5f9; ${idx % 2 === 0 ? 'background: #fafafa;' : 'background: white;'}">
                <td style="padding: 14px; text-align: center; font-weight: 700; color: #3b82f6; font-size: 15px;">GW${m.event}</td>
                <td style="padding: 14px; text-align: right; font-weight: 600; color: #334155; font-size: 14px;">${getTeamLogo(team1.entry_name)} ${team1.entry_name}</td>
                <td style="padding: 14px; text-align: center; font-weight: 900; color: #0f172a; font-size: 16px;">${score1} - ${score2}</td>
                <td style="padding: 14px; text-align: left; font-weight: 600; color: #334155; font-size: 14px;">${team2.entry_name} ${getTeamLogo(team2.entry_name)}</td>
                <td style="padding: 14px; text-align: center;">
                    <span style="background: ${winnerColor}; color: white; padding: 4px 12px; border-radius: 12px; font-weight: 700; font-size: 12px; white-space: nowrap;">
                        ${winner === 'תיקו' ? '🤝 תיקו' : '🏆 ' + winner}
                    </span>
                </td>
            </tr>
        `;
    });

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

/**
 * Render lineup decisions analysis - shows points lost due to benching
 */
function renderLineupAnalysis() {
    const container = document.getElementById('lineupAnalysisContainer');
    if (!container) return;

    const myTeam = findMyTeam();
    if (!myTeam) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;">אנא בחר את הקבוצה שלך תחילה</div>';
        return;
    }

    const historicalLineups = state.draft.historicalLineups.get(myTeam.id);
    if (!historicalLineups || Object.keys(historicalLineups).length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;">טוען נתונים היסטוריים...</div>';
        return;
    }

    const processedById = getProcessedByElementId();
    const currentGW = state.draft.details?.league?.current_event || getCurrentEventId();

    let html = `
        <div style="background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); padding: 24px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 24px; border: 2px solid #e2e8f0; text-align: center;">
            <h2 style="margin: 0 0 8px 0; font-size: 24px; color: #0f172a; font-weight: 900;">🔍 ניתוח החלטות הרכב</h2>
            <p style="margin: 0; color: #64748b; font-size: 14px;">כמה נקודות הפסדת בגלל שחקנים שהשארת על הספסל?</p>
        </div>
    `;

    let totalPointsLost = 0;
    let gwAnalysis = [];

    for (let gw = 1; gw <= currentGW; gw++) {
        const gwKey = `gw${gw}`;
        const lineup = historicalLineups[gwKey];

        if (!lineup) continue;

        const starters = lineup.starting.map(id => processedById.get(id)).filter(Boolean);
        const bench = lineup.bench.map(id => processedById.get(id)).filter(Boolean);

        const startersPoints = starters.reduce((sum, p) => sum + (p.event_points || 0), 0);
        const benchPoints = bench.reduce((sum, p) => sum + (p.event_points || 0), 0);

        // Find optimal lineup (top 11 by actual points)
        const allPlayers = [...starters, ...bench];
        const optimal = allPlayers
            .sort((a, b) => (b.event_points || 0) - (a.event_points || 0))
            .slice(0, 11);
        const optimalPoints = optimal.reduce((sum, p) => sum + (p.event_points || 0), 0);

        const pointsLost = optimalPoints - startersPoints;
        totalPointsLost += pointsLost;

        if (pointsLost > 0) {
            gwAnalysis.push({ gw, startersPoints, optimalPoints, pointsLost, bench, starters, optimal });
        }
    }

    // Summary
    html += `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <div style="background: linear-gradient(135deg, #ef4444 0%, #f87171 100%); padding: 24px; border-radius: 12px; text-align: center; color: white; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);">
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">סה"כ נקודות שהפסדת</div>
                <div style="font-size: 48px; font-weight: 900; margin-bottom: 4px;">${totalPointsLost.toFixed(1)}</div>
                <div style="font-size: 12px; opacity: 0.8;">בגלל החלטות הרכב לא אופטימליות</div>
            </div>
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); padding: 24px; border-radius: 12px; text-align: center; color: white; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">מחזורים עם טעויות</div>
                <div style="font-size: 48px; font-weight: 900; margin-bottom: 4px;">${gwAnalysis.length}</div>
                <div style="font-size: 12px; opacity: 0.8;">מתוך ${currentGW} מחזורים</div>
            </div>
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%); padding: 24px; border-radius: 12px; text-align: center; color: white; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">ממוצע נקודות לאיבוד</div>
                <div style="font-size: 48px; font-weight: 900; margin-bottom: 4px;">${gwAnalysis.length > 0 ? (totalPointsLost / gwAnalysis.length).toFixed(1) : '0'}</div>
                <div style="font-size: 12px; opacity: 0.8;">למחזור עם טעות</div>
            </div>
        </div>
    `;

    if (gwAnalysis.length === 0) {
        html += '<div style="text-align: center; padding: 60px; background: white; border-radius: 12px; border: 2px dashed #e2e8f0;"><div style="font-size: 48px; margin-bottom: 16px;">🎯</div><h3 style="margin: 0 0 8px 0; color: #475569;">מושלם!</h3><p style="margin: 0; color: #94a3b8;">לא הפסדת נקודות בגלל החלטות הרכב</p></div>';
        container.innerHTML = html;
        return;
    }

    // Detailed analysis
    html += `
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
            <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 16px; border-bottom: 2px solid #e2e8f0;">
                <h3 style="margin: 0; font-size: 18px; color: #0f172a; font-weight: 800;">📊 פירוט לפי מחזור</h3>
            </div>
            <div style="padding: 16px;">
    `;

    // Sort by GW ascending (most recent first)
    gwAnalysis.sort((a, b) => b.gw - a.gw).forEach((analysis, idx) => {
        // Find players who should have started but were benched
        const benchedHighScorers = analysis.bench
            .filter(p => {
                const gwData = p.history?.find(h => h.round === analysis.gw);
                return gwData && gwData.total_points > 0;
            })
            .sort((a, b) => {
                const aGwData = a.history?.find(h => h.round === analysis.gw);
                const bGwData = b.history?.find(h => h.round === analysis.gw);
                return (bGwData?.total_points || 0) - (aGwData?.total_points || 0);
            });

        // Find starters who underperformed
        const underperformers = analysis.starters
            .map(p => {
                const gwData = p.history?.find(h => h.round === analysis.gw);
                return { player: p, points: gwData?.total_points || 0 };
            })
            .sort((a, b) => a.points - b.points)
            .slice(0, benchedHighScorers.length);

        html += `
            <div style="background: ${idx % 2 === 0 ? '#fafafa' : 'white'}; padding: 20px; border-radius: 12px; margin-bottom: 16px; border: 2px solid ${analysis.pointsLost > 5 ? '#fca5a5' : '#e2e8f0'};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div>
                        <span style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 6px 16px; border-radius: 10px; font-weight: 800; font-size: 16px; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);">מחזור ${analysis.gw}</span>
                    </div>
                    <div style="text-align: left;">
                        <div style="font-size: 13px; color: #64748b; margin-bottom: 4px; font-weight: 600;">💔 נקודות שהפסדת</div>
                        <div style="font-size: 32px; font-weight: 900; color: #ef4444; text-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);">-${analysis.pointsLost.toFixed(1)}</div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; padding: 12px; background: #f8fafc; border-radius: 8px;">
                    <div style="text-align: center;">
                        <div style="font-size: 12px; color: #64748b; margin-bottom: 4px; font-weight: 600;">ההרכב שבחרת</div>
                        <div style="font-size: 24px; font-weight: 800; color: #475569;">${analysis.startersPoints.toFixed(1)} נק'</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 12px; color: #10b981; margin-bottom: 4px; font-weight: 600;">הרכב אופטימלי</div>
                        <div style="font-size: 24px; font-weight: 800; color: #10b981;">${analysis.optimalPoints.toFixed(1)} נק'</div>
                    </div>
                </div>
                
                ${benchedHighScorers.length > 0 ? `
                    <div style="background: white; padding: 16px; border-radius: 10px; border: 1px solid #e2e8f0;">
                        <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #0f172a; font-weight: 700;">⚠️ טעויות הרכב:</h4>
                        ${benchedHighScorers.map((benchPlayer, i) => {
            const benchGwData = benchPlayer.history?.find(h => h.round === analysis.gw);
            const benchPoints = benchGwData?.total_points || 0;
            const benchMinutes = benchGwData?.minutes || 0;

            const replacedPlayer = underperformers[i]?.player;
            const replacedPoints = underperformers[i]?.points || 0;
            const replacedGwData = replacedPlayer?.history?.find(h => h.round === analysis.gw);
            const replacedMinutes = replacedGwData?.minutes || 0;

            const pointsDiff = benchPoints - replacedPoints;

            return `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; margin-bottom: 8px; background: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
                                    <div style="flex: 1;">
                                        <div style="font-weight: 700; color: #0f172a; font-size: 13px; margin-bottom: 2px;">
                                            ❌ השארת על הספסל: <span style="color: #ef4444;">${benchPlayer.web_name}</span>
                                        </div>
                                        <div style="font-size: 11px; color: #64748b;">
                                            ${benchPlayer.position_short} • ${benchPoints.toFixed(1)} נק' • ${benchMinutes} דקות
                                        </div>
                                    </div>
                                    <div style="text-align: center; padding: 0 12px;">
                                        <div style="font-size: 18px; color: #94a3b8;">↔️</div>
                                    </div>
                                    <div style="flex: 1; text-align: left;">
                                        <div style="font-weight: 700; color: #0f172a; font-size: 13px; margin-bottom: 2px;">
                                            ✅ במקום: <span style="color: #64748b;">${replacedPlayer?.web_name || 'N/A'}</span>
                                        </div>
                                        <div style="font-size: 11px; color: #64748b;">
                                            ${replacedPlayer?.position_short || 'N/A'} • ${replacedPoints.toFixed(1)} נק' • ${replacedMinutes} דקות
                                        </div>
                                    </div>
                                    <div style="background: #fee2e2; padding: 8px 12px; border-radius: 8px; margin-right: 12px;">
                                        <div style="font-size: 11px; color: #991b1b; font-weight: 600;">עלות</div>
                                        <div style="font-size: 18px; font-weight: 900; color: #dc2626;">-${pointsDiff.toFixed(1)}</div>
                                    </div>
                                </div>
                            `;
        }).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// ============================================
// MY TEAM & LINEUP MANAGEMENT
// ============================================

function populateMyTeamSelector() {
    console.log("📋 populateMyTeamSelector() called");
    const select = document.getElementById('myTeamSelect');
    if (!select) {
        console.error("❌ myTeamSelect element not found!");
        return;
    }
    select.innerHTML = '<option value="">-- בחר קבוצה --</option>';
    const entries = state.draft.details?.league_entries || [];
    entries.forEach(entry => {
        if (!entry.entry_name) return;
        const option = document.createElement('option');
        option.value = entry.id;
        option.textContent = `${entry.player_first_name} ${entry.player_last_name} (${entry.entry_name})`;
        select.appendChild(option);
    });

    // Set the selected value to myTeamId (which should be Amit Zahy by default)
    if (state.draft.myTeamId) {
        select.value = state.draft.myTeamId;
        console.log("✅ Selected team:", state.draft.myTeamId);
    } else {
        console.warn("⚠️ No myTeamId set");
    }
}

function setMyTeam(teamId) {
    if (!teamId) return;
    state.draft.myTeamId = parseInt(teamId);
    localStorage.setItem('draft_my_team_id', teamId);
    renderMyLineup(teamId);
    renderRecommendations();
    renderNextRivalAnalysis(); // Update Rival Analysis
    renderAllTeamsTrendChart(null, 'cumulative', [teamId]); // Default to showing my team
    showToast('הקבוצה עודכנה', 'הנתונים וההמלצות עודכנו בהתאם לקבוצה שנבחרה', 'success');
}

function findMyTeam() {
    // Try from local storage first
    const storedId = localStorage.getItem('draft_my_team_id');
    if (storedId) {
        const entry = state.draft.details?.league_entries.find(e => e.id == storedId);
        if (entry) {
            state.draft.myTeamId = entry.id;
            return { id: entry.id, name: entry.entry_name };
        }
    }

    // Default to Amit Zahy if not found in localStorage
    const amitEntry = state.draft.details?.league_entries.find(e =>
        e.player_first_name === 'Amit' && e.player_last_name === 'Zahy'
    );

    if (amitEntry) {
        state.draft.myTeamId = amitEntry.id;
        localStorage.setItem('draft_my_team_id', amitEntry.id); // Save for next time
        return { id: amitEntry.id, name: amitEntry.entry_name };
    }

    return null;
}

function renderLineupStats(stats, diffs = null) {
    const renderBox = (label, value, colorClass, diffVal) => {
        let diffHtml = '';
        if (diffs && diffVal !== undefined) {
            const isPos = diffVal >= 0;
            const sign = isPos ? '+' : '';
            const displayVal = typeof diffVal === 'number' ? diffVal.toFixed(1) : diffVal;
            diffHtml = `<div style="font-size: 10px; color: ${isPos ? '#10b981' : '#ef4444'}; font-weight: 700; margin-top: 2px;">
                ${sign}${displayVal}
            </div>`;
        }
        return `
            <div style="text-align: center; padding: 10px; background: #fff; border-radius: 12px; border: 1px solid #f1f5f9; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div style="font-size: 11px; color: #64748b; font-weight: 700; margin-bottom: 4px;">${label}</div>
                <div style="font-size: 20px; font-weight: 800; color: ${colorClass}; line-height: 1;">${typeof value === 'number' ? value.toFixed(1) : value}</div>
                ${diffHtml}
            </div>
        `;
    };

    return `
        <div class="lineup-stats-card" style="margin-bottom: 20px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border: 2px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
                ${renderBox('צפי (GW הבא)', stats.predicted, '#3b82f6', diffs?.predicted)}
                ${renderBox('נקודות (GW אחרון)', stats.lastGw, '#10b981', diffs?.lastGw)}
                ${renderBox('PPG/90', stats.ppg90, '#f59e0b', diffs?.ppg90)}
                ${renderBox('כושר (Form)', stats.form, '#8b5cf6', diffs?.form)}
            </div>
            ${diffs ? '<div style="text-align: center; margin-top: 12px; font-size: 11px; color: #64748b; font-weight: 600;">📊 השוואה להרכב הנוכחי</div>' : ''}
        </div>
    `;
}

function renderMyLineup(teamId) {
    console.log("👥 renderMyLineup() called with teamId:", teamId);
    const container = document.getElementById('myLineupContainer');
    if (!container) {
        console.error("❌ myLineupContainer not found!");
        return;
    }

    if (!teamId) {
        container.innerHTML = '<p style="text-align:center; padding: 20px;">לא נבחרה קבוצה. אנא בחר קבוצה מהתפריט למעלה.</p>';
        return;
    }

    // Try both as integer and as string to handle any type mismatches
    let rosterIds = state.draft.rostersByEntryId.get(parseInt(teamId));
    if (!rosterIds) {
        rosterIds = state.draft.rostersByEntryId.get(teamId);
    }
    if (!rosterIds) {
        rosterIds = state.draft.rostersByEntryId.get(String(teamId));
    }
    rosterIds = rosterIds || [];

    console.log("📋 Roster IDs for team", teamId, "(type:", typeof teamId, "):", rosterIds.length, "players");
    console.log("🗺️ Total rosters in map:", state.draft.rostersByEntryId.size);
    console.log("🔑 Map keys:", Array.from(state.draft.rostersByEntryId.keys()));
    console.log("🎯 Roster data:", rosterIds);

    // DEBUG: Check why roster might be empty
    if (!rosterIds.length) {
        console.warn(`⚠️ renderMyLineup: Roster for team ${teamId} is empty. Rosters map size: ${state.draft.rostersByEntryId.size}`);

        // Try to re-fetch roster if it's the user's team and empty
        if (parseInt(teamId) === state.draft.myTeamId) {
            container.innerHTML = `
                <div style="text-align:center; padding: 20px;">
                    <p>מנסה לטעון את הסגל מחדש...</p>
                    <div class="mini-loader" style="display:inline-block;"></div>
                </div>`;
            // We could trigger a re-fetch here but avoid infinite loops.
            // For now just show better error.
        }

        container.innerHTML = `
            <div style="text-align:center; padding: 20px;">
                <p>לא נמצא סגל לקבוצה זו.</p>
                <small style="color: #94a3b8;">ייתכן שהנתונים עדיין נטענים או שיש בעיית חיבור לשרת.</small>
            </div>`;
        return;
    }

    let starters = [];
    let bench = [];

    const lineupData = state.draft.lineupsByEntryId ? state.draft.lineupsByEntryId.get(parseInt(teamId)) : null;
    const processedById = getProcessedByElementId();

    console.log("📋 Lineup data:", lineupData);
    console.log("🗺️ ProcessedById map size:", processedById.size);

    if (lineupData && lineupData.starting && lineupData.starting.length > 0) {
        console.log("✅ Using lineup data from API");
        starters = lineupData.starting.map(id => processedById.get(id)).filter(Boolean);
        bench = lineupData.bench.map(id => processedById.get(id)).filter(Boolean);
        console.log("   Starters:", starters.length, "Bench:", bench.length);
    } else {
        console.log("⚠️ No lineup data, using roster fallback");
        const roster = rosterIds.map(id => {
            const player = processedById.get(id);
            if (!player) {
                console.warn(`   ❌ Player not found for ID: ${id}`);
            }
            return player;
        }).filter(Boolean);
        console.log("   Total roster players found:", roster.length, "out of", rosterIds.length);
        starters = roster.slice(0, 11);
        bench = roster.slice(11);
    }

    const calculateStats = (players) => {
        return {
            predicted: players.reduce((sum, p) => sum + (parseFloat(p.predicted_points_1_gw) || 0), 0),
            lastGw: players.reduce((sum, p) => sum + (p.event_points || 0), 0),
            ppg90: players.reduce((sum, p) => sum + (parseFloat(p.points_per_game_90) || 0), 0) / (players.length || 1),
            form: players.reduce((sum, p) => sum + (parseFloat(p.form) || 0), 0) / (players.length || 1)
        };
    };

    const stats = calculateStats(starters);

    container.innerHTML = '';

    const controls = document.createElement('div');
    controls.className = 'draft-lineup-controls';
    controls.style.cssText = 'display: flex; justify-content: center; gap: 10px; margin-bottom: 15px;';
    controls.innerHTML = `
        <button id="btnShowMyLineup" class="lineup-toggle active" style="padding: 8px 16px; border-radius: 8px; border: none; background: #3b82f6; color: white; font-weight: 600; cursor: pointer;" onclick="renderMyLineup('${teamId}')">ההרכב שלי</button>
        <button id="btnShowRecLineup" class="lineup-toggle" style="padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: white; color: #64748b; font-weight: 600; cursor: pointer;" onclick="showRecommendedLineup()">הרכב אופטימלי</button>
        `;
    container.appendChild(controls);

    const statsDiv = document.createElement('div');
    statsDiv.innerHTML = renderLineupStats(stats);
    container.appendChild(statsDiv);

    const pitchWrapper = document.createElement('div');
    pitchWrapper.className = 'pitch-wrapper';
    container.appendChild(pitchWrapper);

    console.log("🎨 About to render pitch with starters:", starters.length, "bench:", bench.length);

    if (starters.length === 0) {
        console.error("❌ No starters to render! Roster IDs:", rosterIds);
        container.innerHTML += '<div style="text-align:center; padding: 20px; color: red;">שגיאה: לא נמצאו שחקנים להצגה</div>';
    } else {
        renderPitch(pitchWrapper, starters.map(p => p.id), true, bench.map(p => p.id));
    }

    console.log("✅ renderMyLineup() completed! Starters:", starters.length, "Bench:", bench.length);
}

function showRecommendedLineup() {
    const myTeamId = state.draft.myTeamId;
    if (!myTeamId) {
        showToast('שגיאה', 'אנא בחר את הקבוצה שלך קודם', 'error');
        return;
    }

    const rosterIds = state.draft.rostersByEntryId.get(myTeamId);
    if (!rosterIds || rosterIds.length === 0) {
        showToast('שגיאה', 'לא נמצא סגל לקבוצה זו', 'error');
        return;
    }

    const processedById = getProcessedByElementId();
    const squad = rosterIds.map(id => processedById.get(id)).filter(Boolean);

    // Current Stats for Diff
    const currentLineupObj = state.draft.lineupsByEntryId.get(myTeamId);
    let currentStarting = [];
    if (currentLineupObj && currentLineupObj.starting) {
        currentStarting = currentLineupObj.starting.map(id => processedById.get(id)).filter(Boolean);
    } else {
        currentStarting = squad.slice(0, 11);
    }

    const calcStats = (players) => ({
        predicted: players.reduce((sum, p) => sum + (parseFloat(p.predicted_points_1_gw) || 0), 0),
        lastGw: players.reduce((sum, p) => sum + (p.event_points || 0), 0),
        ppg90: players.reduce((sum, p) => sum + (parseFloat(p.points_per_game_90) || 0), 0) / (players.length || 1),
        form: players.reduce((sum, p) => sum + (parseFloat(p.form) || 0), 0) / (players.length || 1)
    });

    const currentStats = calcStats(currentStarting);

    // Optimization
    const gkps = squad.filter(p => p.element_type === 1).sort((a, b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0));
    const defs = squad.filter(p => p.element_type === 2).sort((a, b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0));
    const mids = squad.filter(p => p.element_type === 3).sort((a, b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0));
    const fwds = squad.filter(p => p.element_type === 4).sort((a, b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0));

    const startingXI = [];
    const bench = [];

    // GK
    if (gkps.length > 0) { startingXI.push(gkps[0]); for (let i = 1; i < gkps.length; i++) bench.push(gkps[i]); }

    // Outfield (Min 3 DEF, Min 1 FWD)
    const selectedOutfield = [];
    const remainingOutfield = [];

    const bestDefs = defs.slice(0, 3);
    bestDefs.forEach(p => selectedOutfield.push(p));
    const otherDefs = defs.slice(3);

    let bestFwds = [];
    let otherFwds = [...fwds];
    if (fwds.length > 0) {
        bestFwds = fwds.slice(0, 1);
        bestFwds.forEach(p => selectedOutfield.push(p));
        otherFwds = fwds.slice(1);
    }

    const pool = [...otherDefs, ...mids, ...otherFwds].sort((a, b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0));
    const slotsNeeded = 10 - selectedOutfield.length;
    for (let i = 0; i < pool.length; i++) {
        if (i < slotsNeeded) selectedOutfield.push(pool[i]);
        else remainingOutfield.push(pool[i]);
    }

    startingXI.push(...selectedOutfield);
    bench.push(...remainingOutfield);

    const recStats = calcStats(startingXI);

    const container = document.getElementById('myLineupContainer');
    if (container) {
        container.innerHTML = '';
        const controls = document.createElement('div');
        controls.className = 'draft-lineup-controls';
        controls.style.cssText = 'display: flex; justify-content: center; gap: 10px; margin-bottom: 15px;';
        controls.innerHTML = `
            <button id="btnShowMyLineup" class="lineup-toggle" style="padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: white; color: #64748b; font-weight: 600; cursor: pointer;" onclick="renderMyLineup('${myTeamId}')">ההרכב שלי</button>
            <button id="btnShowRecLineup" class="lineup-toggle active" style="padding: 8px 16px; border-radius: 8px; border: none; background: #3b82f6; color: white; font-weight: 600; cursor: pointer;" onclick="showRecommendedLineup()">הרכב אופטימלי</button>
        `;
        container.appendChild(controls);

        // Diffs
        const diffs = {
            predicted: recStats.predicted - currentStats.predicted,
            lastGw: recStats.lastGw - currentStats.lastGw,
            ppg90: recStats.ppg90 - currentStats.ppg90,
            form: recStats.form - currentStats.form
        };

        const statsDiv = document.createElement('div');
        statsDiv.innerHTML = renderLineupStats(recStats, diffs);
        container.appendChild(statsDiv);

        const pitchWrapper = document.createElement('div');
        pitchWrapper.className = 'pitch-wrapper';
        container.appendChild(pitchWrapper);

        renderPitch(pitchWrapper, startingXI.map(p => p.id), true, bench.map(p => p.id));

        showToast('הרכב מומלץ הוצג', 'התצוגה עודכנה להרכב האופטימלי', 'success');
    }
}

// ============================================
// RIVAL ANALYSIS
// ============================================

function getNextOpponent(myEntryId) {
    const details = state.draft.details;
    if (!details || !details.matches) return null;
    const currentEvent = details.league.current_event;

    // Try to find next match (current or future)
    let nextMatch = details.matches.find(m =>
        m.event === currentEvent &&
        !m.finished &&
        (m.league_entry_1 === myEntryId || m.league_entry_2 === myEntryId)
    );

    if (!nextMatch) {
        // Look for future matches
        const futureMatches = details.matches.filter(m =>
            m.event >= currentEvent &&
            !m.finished &&
            (m.league_entry_1 === myEntryId || m.league_entry_2 === myEntryId)
        ).sort((a, b) => a.event - b.event);
        if (futureMatches.length > 0) nextMatch = futureMatches[0];
    }

    // If no future matches, show the last match
    if (!nextMatch) {
        const pastMatches = details.matches.filter(m =>
            m.finished &&
            (m.league_entry_1 === myEntryId || m.league_entry_2 === myEntryId)
        ).sort((a, b) => b.event - a.event);
        if (pastMatches.length > 0) {
            nextMatch = pastMatches[0];
            nextMatch._isLastMatch = true; // Flag to show it's a past match
        }
    }

    if (!nextMatch) return null;

    const isEntry1 = nextMatch.league_entry_1 === myEntryId;
    const opponentId = isEntry1 ? nextMatch.league_entry_2 : nextMatch.league_entry_1;
    return {
        match: nextMatch,
        opponentId: opponentId,
        opponentName: state.draft.entryIdToTeamName.get(opponentId) || 'Unknown',
        isHome: isEntry1,
        isLastMatch: nextMatch._isLastMatch || false
    };
}

// Helper function to get team logo emoji based on team name
function getTeamLogo(teamName) {
    const logos = {
        'Amit United': '🦁',
        'The Gingers': '🦊',
        'Hamalik': '👑',
        'PSV Nivey': '⚡',
        'Francis Bodega FC': '🍷',
        'AEK Shemesh': '☀️',
        'Merkaz Klita': '🏰',
        'Torpedo Eshel': '🚀',
        'Los chicos': '🌟'
    };

    // Try to find exact match or partial match
    for (const [name, logo] of Object.entries(logos)) {
        if (teamName && teamName.includes(name)) {
            return logo;
        }
    }
    return '⚽'; // Default
}

// Helper function to get player photo URL
function getPlayerPhotoUrl(playerCode) {
    return `https://resources.premierleague.com/premierleague/photos/players/250x250/p${playerCode}.png`;
}

function updateMyTeamForRival(newMyTeamId) {
    // Update the selected team temporarily for rival analysis
    const oldTeamId = state.draft.myTeamId;
    state.draft.myTeamId = parseInt(newMyTeamId);

    // Re-render with the new "my team"
    renderNextRivalAnalysis();

    // Note: This doesn't permanently change the team selection, just for this analysis
}

function renderNextRivalAnalysis(selectedOpponentId = null) {
    const container = document.getElementById('rivalAnalysisContainer');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;"><div class="spinner"></div> מחשב סיכויים ומנתח הרכבים...</div>';
    try {
        const myTeam = findMyTeam();
        if (!myTeam) {
            container.innerHTML = '<div class="alert alert-warning">לא נבחרה קבוצה. אנא בחר את הקבוצה שלך בתפריט ההגדרות.</div>';
            return;
        }

        // If opponent is manually selected, use it; otherwise get next opponent
        let opponentData;
        if (selectedOpponentId) {
            const entries = state.draft.details?.league_entries || [];
            const oppEntry = entries.find(e => String(e.id) === String(selectedOpponentId));
            if (oppEntry) {
                opponentData = {
                    opponentId: oppEntry.id,
                    opponentName: oppEntry.entry_name,
                    match: { event: state.draft.details?.league?.current_event || 0 },
                    isLastMatch: false,
                    isManual: true
                };
            }
        }

        if (!opponentData) {
            opponentData = getNextOpponent(myTeam.id);
        }
        if (!opponentData) {
            container.innerHTML = `
                <div class="alert alert-info" style="text-align:center; padding:30px; border: 2px dashed #cbd5e1; border-radius: 12px; background: #f8fafc;">
                    <div style="font-size:40px; margin-bottom:10px;">🏖️</div>
                    <h3 style="margin:0; color:#475569;">אין משחקים קרובים</h3>
                    <p style="margin:5px 0 0; color:#64748b;">העונה הסתיימה או שאין משחקים מתוכננים בלוח השנה.</p>
                </div>`;
            return;
        }
        const myRosterIds = state.draft.rostersByEntryId.get(myTeam.id) || [];
        const oppRosterIds = state.draft.rostersByEntryId.get(opponentData.opponentId) || [];
        const processedById = getProcessedByElementId();
        const mySquad = myRosterIds.map(id => processedById.get(id)).filter(Boolean);
        const oppSquad = oppRosterIds.map(id => processedById.get(id)).filter(Boolean);

        // Calculate stats using only top 11 players for xPts
        const calcStats = (squad) => {
            // Sort by predicted points and take top 11 for xPts
            const top11 = squad
                .sort((a, b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0))
                .slice(0, 11);

            const totalXPts = top11.reduce((sum, p) => sum + (parseFloat(p.predicted_points_1_gw) || 0), 0);
            const totalXGI = squad.reduce((sum, p) => sum + (parseFloat(p.expected_goal_involvements) || 0), 0);
            const totalForm = squad.reduce((sum, p) => sum + (parseFloat(p.form) || 0), 0);
            return { xPts: totalXPts, xGI: totalXGI, form: totalForm };
        };
        const myStats = calcStats(mySquad);
        const oppStats = calcStats(oppSquad);
        const formTotal = (myStats.form + oppStats.form) || 1;
        const xgiTotal = (myStats.xGI + oppStats.xGI) || 1;

        // Calculate win probability using ADVANCED algorithm
        const winProbResult = calculateAdvancedWinProbability(
            myTeam.id,
            opponentData.opponentId,
            myRosterIds,
            oppRosterIds,
            processedById
        );
        const myWinProb = winProbResult.winProb1;
        const oppWinProb = winProbResult.winProb2;

        // Calculate additional stats
        const myAvgPrice = mySquad.reduce((sum, p) => sum + (p.now_cost || 0), 0) / (mySquad.length || 1) / 10;
        const oppAvgPrice = oppSquad.reduce((sum, p) => sum + (p.now_cost || 0), 0) / (oppSquad.length || 1) / 10;

        const myPPG = mySquad.reduce((sum, p) => sum + (parseFloat(p.points_per_game) || 0), 0) / (mySquad.length || 1);
        const oppPPG = oppSquad.reduce((sum, p) => sum + (parseFloat(p.points_per_game) || 0), 0) / (oppSquad.length || 1);

        // Get team logos
        const myLogo = getTeamLogo(myTeam.name);
        const oppLogo = getTeamLogo(opponentData.opponentName);

        // Create team selectors
        const entries = state.draft.details?.league_entries || [];
        const opponentSelector = `
            <div style="display: flex; justify-content: center; align-items: center; gap: 15px; margin-bottom: 15px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label style="font-size: 13px; font-weight: 600; color: #3b82f6;">הקבוצה שלי:</label>
                    <select id="rivalMyTeamSelect" onchange="updateMyTeamForRival(this.value)" style="padding: 8px 16px; border-radius: 8px; border: 2px solid #3b82f6; font-size: 13px; font-weight: 600; color: #334155; cursor: pointer; background: white;">
                        ${entries.map(e => `
                            <option value="${e.id}" ${String(e.id) === String(myTeam.id) ? 'selected' : ''}>
                                ${e.entry_name}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <span style="font-size: 20px; color: #cbd5e1;">⚔️</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label style="font-size: 13px; font-weight: 600; color: #ef4444;">היריב:</label>
                    <select id="rivalOpponentSelect" onchange="renderNextRivalAnalysis(this.value)" style="padding: 8px 16px; border-radius: 8px; border: 2px solid #ef4444; font-size: 13px; font-weight: 600; color: #334155; cursor: pointer; background: white;">
                        ${entries.filter(e => e.id !== myTeam.id).map(e => `
                            <option value="${e.id}" ${String(e.id) === String(opponentData.opponentId) ? 'selected' : ''}>
                                ${e.entry_name}
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>
        `;

        // Show different title if it's a past match
        const matchTitle = opponentData.isManual ?
            `<div style="text-align: center; background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%); padding: 12px; border-radius: 12px; margin-bottom: 20px; color: #3730a3; font-weight: 700; font-size: 14px; box-shadow: 0 2px 8px rgba(79, 70, 229, 0.2);">🎯 ניתוח מותאם אישית</div>` :
            opponentData.isLastMatch ?
                `<div style="text-align: center; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 12px; border-radius: 12px; margin-bottom: 20px; color: #92400e; font-weight: 700; font-size: 14px; box-shadow: 0 2px 8px rgba(251, 191, 36, 0.2);">📊 המשחק הבא שלך</div>` :
                `<div style="text-align: center; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); padding: 12px; border-radius: 12px; margin-bottom: 20px; color: #1e40af; font-weight: 700; font-size: 14px; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);">🔜 המשחק הבא שלך</div>`;

        let html = opponentSelector + matchTitle + `
            <div class="rival-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 16px; box-shadow: 0 8px 16px rgba(102, 126, 234, 0.3); margin: 0 auto 20px; max-width: 800px; position: relative; overflow: hidden;">
                <div style="position: relative; z-index: 1; text-align: center;">
                    <!-- Teams Row - All in one line -->
                    <div style="display: flex; justify-content: center; align-items: center; gap: 40px; margin-bottom: 20px;">
                        <div class="team-badge my-team" style="display: flex; align-items: center; gap: 12px;">
                            <div style="font-size: 48px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">${myLogo}</div>
                            <div>
                                <div style="font-weight: 800; color: white; font-size: 15px; margin-bottom: 6px; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">${myTeam.name}</div>
                                <div style="display: inline-block; background: rgba(255,255,255,0.25); backdrop-filter: blur(10px); color: white; padding: 6px 16px; border-radius: 15px; font-size: 14px; font-weight: 800; border: 1px solid rgba(255,255,255,0.3);">
                                    ${myStats.xPts.toFixed(1)} נק'
                                </div>
                            </div>
                        </div>
                        
                        <div class="versus-badge" style="text-align: center;">
                            <div style="font-weight: 900; font-size: 28px; color: white; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); margin-bottom: 6px;">VS</div>
                            <div style="font-size: 12px; background: rgba(255,255,255,0.25); backdrop-filter: blur(10px); padding: 4px 12px; border-radius: 12px; color: white; font-weight: 700; border: 1px solid rgba(255,255,255,0.3);">
                                GW ${opponentData.match.event || '?'}
                            </div>
                        </div>
                        
                        <div class="team-badge opp-team" style="display: flex; align-items: center; gap: 12px; flex-direction: row-reverse;">
                            <div style="font-size: 48px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">${oppLogo}</div>
                            <div style="text-align: right;">
                                <div style="font-weight: 800; color: white; font-size: 15px; margin-bottom: 6px; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">${opponentData.opponentName}</div>
                                <div style="display: inline-block; background: rgba(255,255,255,0.25); backdrop-filter: blur(10px); color: white; padding: 6px 16px; border-radius: 15px; font-size: 14px; font-weight: 800; border: 1px solid rgba(255,255,255,0.3);">
                                    ${oppStats.xPts.toFixed(1)} נק'
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Win Probability Bar - Compact -->
                    <div>
                        <div style="text-align: center; font-size: 13px; color: white; font-weight: 800; margin-bottom: 10px; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">🎯 סיכוי לניצחון</div>
                        <div style="display: flex; height: 45px; background: rgba(0,0,0,0.25); border-radius: 22px; overflow: hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.3); border: 2px solid rgba(255,255,255,0.25);">
                            <div style="width: ${myWinProb}%; background: linear-gradient(90deg, #10b981 0%, #34d399 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 22px; transition: width 0.5s ease; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">
                                ${myWinProb.toFixed(0)}%
                            </div>
                            <div style="width: ${oppWinProb}%; background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 22px; transition: width 0.5s ease; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">
                                ${oppWinProb.toFixed(0)}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        const analyzeSquadComposition = (squad) => {
            const composition = {};
            squad.forEach(p => {
                const key = `${p.team_name} ${p.position_name}`;
                if (!composition[key]) {
                    composition[key] = { count: 0, players: [] };
                }
                composition[key].count++;
                composition[key].players.push(p.web_name);
            });
            return composition;
        };
        const myComp = analyzeSquadComposition(mySquad);
        const oppComp = analyzeSquadComposition(oppSquad);
        let overlapsHtml = '';
        const allKeys = new Set([...Object.keys(myComp), ...Object.keys(oppComp)]);
        allKeys.forEach(key => {
            const myData = myComp[key];
            const oppData = oppComp[key];
            if (myData && oppData) {
                const myCount = myData.count;
                const oppCount = oppData.count;
                const total = myCount + oppCount;
                const myPercent = (myCount / total * 100).toFixed(0);
                const oppPercent = (oppCount / total * 100).toFixed(0);
                // Get player objects for photos
                const myPlayers = myData.players.map(name => mySquad.find(p => p.web_name === name)).filter(Boolean);
                const oppPlayers = oppData.players.map(name => oppSquad.find(p => p.web_name === name)).filter(Boolean);

                overlapsHtml += `
                    <div class="overlap-item" style="padding: 18px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border-radius: 12px; margin-bottom: 12px; border: 2px solid #e2e8f0; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <div class="overlap-label" style="font-weight: 800; font-size: 15px; color: #0f172a;">${key}</div>
                            <div class="overlap-values" style="font-family: monospace; font-weight: 900; font-size: 18px;">
                                <span style="color:#3b82f6">${myCount}</span>
                                <span style="color:#94a3b8; font-size: 16px; margin: 0 10px;">⚔️</span>
                                <span style="color:#ef4444">${oppCount}</span>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 15px; margin-bottom: 12px; align-items: center;">
                            <div style="display: flex; flex-direction: column; gap: 8px; align-items: flex-end;">
                                ${myPlayers.map(p => `
                                    <div style="display: flex; align-items: center; gap: 8px; justify-content: flex-end;">
                                        <span style="color: #3b82f6; font-weight: 700; font-size: 13px;">${p.web_name}</span>
                                        <img src="${p.code ? getPlayerPhotoUrl(p.code) : ''}" 
                                             onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2235%22 height=%2235%22 viewBox=%220 0 35 35%22%3E%3Ccircle cx=%2217.5%22 cy=%2217.5%22 r=%2217.5%22 fill=%22%23dbeafe%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2214%22 fill=%22%233b82f6%22 font-weight=%22700%22%3E${p.web_name.charAt(0)}%3C/text%3E%3C/svg%3E'" 
                                             style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 2px solid #3b82f6; background: #f8fafc;">
                                    </div>
                                `).join('')}
                            </div>
                            <div style="color: #cbd5e1; font-weight: 700; font-size: 14px;">VS</div>
                            <div style="display: flex; flex-direction: column; gap: 8px; align-items: flex-start;">
                                ${oppPlayers.map(p => `
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <img src="${p.code ? getPlayerPhotoUrl(p.code) : ''}" 
                                             onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2235%22 height=%2235%22 viewBox=%220 0 35 35%22%3E%3Ccircle cx=%2217.5%22 cy=%2217.5%22 r=%2217.5%22 fill=%22%23fee2e2%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2214%22 fill=%22%23ef4444%22 font-weight=%22700%22%3E${p.web_name.charAt(0)}%3C/text%3E%3C/svg%3E'" 
                                             style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; border: 2px solid #ef4444; background: #f8fafc;">
                                        <span style="color: #ef4444; font-weight: 700; font-size: 13px;">${p.web_name}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <div style="display: flex; height: 10px; background: #f1f5f9; border-radius: 5px; overflow: hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
                            <div style="width: ${myPercent}%; background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);"></div>
                            <div style="width: ${oppPercent}%; background: linear-gradient(90deg, #fca5a5 0%, #ef4444 100%);"></div>
                        </div>
                    </div>
                `;
            }
        });
        if (overlapsHtml) {
            html += `
                <div class="overlap-section" style="background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); padding: 20px; border-radius: 12px; border: 2px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                        <span style="font-size: 24px;">🤝</span>
                        <h3 style="margin: 0; font-size: 16px; color: #0f172a; font-weight: 800;">חפיפות ונטרולים</h3>
                    </div>
                    <div class="overlap-grid" style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; max-width: 800px; margin: 0 auto;">${overlapsHtml}</div>
                    <div style="margin-top: 12px; padding: 10px; background: #fef3c7; border-radius: 8px; font-size: 12px; color: #92400e; text-align: center; font-weight: 600;">
                        💡 שחקנים מאותה קבוצה ואותה עמדה מנטרלים זה את זה
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="overlap-section" style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 20px; border-radius: 12px; border: 2px solid #86efac; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 10px;">✨</div>
                    <h3 style="margin: 0 0 8px; font-size: 16px; color: #065f46; font-weight: 800;">אין חפיפות!</h3>
                    <p style="margin: 0; font-size: 13px; color: #047857;">שני הסגלים שונים לחלוטין - כל נקודה תספור!</p>
                </div>
            `;
        }

        // Top Players Comparison
        const myTop3 = [...mySquad].sort((a, b) => (parseFloat(b.predicted_points_1_gw) || 0) - (parseFloat(a.predicted_points_1_gw) || 0)).slice(0, 3);
        const oppTop3 = [...oppSquad].sort((a, b) => (parseFloat(b.predicted_points_1_gw) || 0) - (parseFloat(a.predicted_points_1_gw) || 0)).slice(0, 3);

        html += `
            <div class="top-players-section" style="background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); padding: 20px; border-radius: 12px; border: 2px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-top: 20px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                    <span style="font-size: 24px;">⭐</span>
                    <h3 style="margin: 0; font-size: 16px; color: #0f172a; font-weight: 800;">שחקנים מובילים (צפי GW הבא)</h3>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <div style="text-align: center; font-weight: 700; color: #3b82f6; margin-bottom: 10px; font-size: 14px;">הסגל שלך</div>
                        ${myTop3.map((p, idx) => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: ${idx === 0 ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' : 'white'}; border-radius: 8px; margin-bottom: 8px; border: 1px solid ${idx === 0 ? '#3b82f6' : '#e2e8f0'};">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <img src="${getPlayerPhotoUrl(p.code)}" 
                                         onerror="this.style.display='none'" 
                                         style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid ${idx === 0 ? '#3b82f6' : '#e2e8f0'}; background: #f8fafc;">
                                    <div>
                                        <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${idx + 1}. ${p.web_name}</div>
                                        <div style="font-size: 11px; color: #64748b;">${p.team_name} • ${p.position_name}</div>
                                    </div>
                                </div>
                                <div style="font-weight: 800; color: #3b82f6; font-size: 16px;">${(parseFloat(p.predicted_points_1_gw) || 0).toFixed(1)}</div>
                            </div>
                        `).join('')}
                    </div>
                    <div>
                        <div style="text-align: center; font-weight: 700; color: #ef4444; margin-bottom: 10px; font-size: 14px;">הסגל של היריב</div>
                        ${oppTop3.map((p, idx) => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: ${idx === 0 ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)' : 'white'}; border-radius: 8px; margin-bottom: 8px; border: 1px solid ${idx === 0 ? '#ef4444' : '#e2e8f0'};">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <img src="${getPlayerPhotoUrl(p.code)}" 
                                         onerror="this.style.display='none'" 
                                         style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid ${idx === 0 ? '#ef4444' : '#e2e8f0'}; background: #f8fafc;">
                                    <div>
                                        <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${idx + 1}. ${p.web_name}</div>
                                        <div style="font-size: 11px; color: #64748b;">${p.team_name} • ${p.position_name}</div>
                                    </div>
                                </div>
                                <div style="font-weight: 800; color: #ef4444; font-size: 16px;">${(parseFloat(p.predicted_points_1_gw) || 0).toFixed(1)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // ============================================
        // POSITION-BY-POSITION ANALYSIS
        // ============================================
        const analyzeByPosition = (squad) => {
            const positions = { GKP: [], DEF: [], MID: [], FWD: [] };
            squad.forEach(p => {
                const pos = p.element_type === 1 ? 'GKP' : p.element_type === 2 ? 'DEF' : p.element_type === 3 ? 'MID' : 'FWD';
                positions[pos].push(p);
            });
            return positions;
        };

        const myPositions = analyzeByPosition(mySquad);
        const oppPositions = analyzeByPosition(oppSquad);

        const positionNames = { GKP: 'שוערים', DEF: 'מגנים', MID: 'קשרים', FWD: 'חלוצים' };
        const positionIcons = { GKP: '🧤', DEF: '🛡️', MID: '⚽', FWD: '🎯' };

        let positionAnalysisHtml = '';
        ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
            const myPlayers = myPositions[pos];
            const oppPlayers = oppPositions[pos];

            const myAvgXPts = myPlayers.length > 0 ? myPlayers.reduce((sum, p) => sum + (parseFloat(p.predicted_points_1_gw) || 0), 0) / myPlayers.length : 0;
            const oppAvgXPts = oppPlayers.length > 0 ? oppPlayers.reduce((sum, p) => sum + (parseFloat(p.predicted_points_1_gw) || 0), 0) / oppPlayers.length : 0;

            const myAvgForm = myPlayers.length > 0 ? myPlayers.reduce((sum, p) => sum + (parseFloat(p.form) || 0), 0) / myPlayers.length : 0;
            const oppAvgForm = oppPlayers.length > 0 ? oppPlayers.reduce((sum, p) => sum + (parseFloat(p.form) || 0), 0) / oppPlayers.length : 0;

            const advantage = myAvgXPts > oppAvgXPts ? 'you' : oppAvgXPts > myAvgXPts ? 'opp' : 'equal';
            const advantageColor = advantage === 'you' ? '#10b981' : advantage === 'opp' ? '#ef4444' : '#94a3b8';
            const advantageText = advantage === 'you' ? '✓ יתרון לך' : advantage === 'opp' ? '✗ יתרון ליריב' : '= שווה';

            positionAnalysisHtml += `
                <div style="background: white; padding: 15px; border-radius: 10px; border: 2px solid ${advantageColor}20; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 24px;">${positionIcons[pos]}</span>
                            <h4 style="margin: 0; font-size: 15px; color: #0f172a; font-weight: 800;">${positionNames[pos]}</h4>
                        </div>
                        <div style="font-size: 12px; font-weight: 700; color: ${advantageColor}; background: ${advantageColor}15; padding: 4px 10px; border-radius: 12px;">
                            ${advantageText}
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center;">
                        <div style="text-align: center;">
                            <div style="font-size: 20px; font-weight: 800; color: #3b82f6;">${myAvgXPts.toFixed(1)}</div>
                            <div style="font-size: 11px; color: #64748b;">ממוצע צפי</div>
                            <div style="font-size: 12px; font-weight: 600; color: #64748b; margin-top: 4px;">Form: ${myAvgForm.toFixed(1)}</div>
                        </div>
                        <div style="font-size: 18px; color: #cbd5e0;">vs</div>
                        <div style="text-align: center;">
                            <div style="font-size: 20px; font-weight: 800; color: #ef4444;">${oppAvgXPts.toFixed(1)}</div>
                            <div style="font-size: 11px; color: #64748b;">ממוצע צפי</div>
                            <div style="font-size: 12px; font-weight: 600; color: #64748b; margin-top: 4px;">Form: ${oppAvgForm.toFixed(1)}</div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
            <div class="position-analysis-section" style="background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); padding: 20px; border-radius: 12px; border: 2px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-top: 20px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                    <span style="font-size: 24px;">🎯</span>
                    <h3 style="margin: 0; font-size: 16px; color: #0f172a; font-weight: 800;">ניתוח לפי עמדות - איפה היתרון?</h3>
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                    ${positionAnalysisHtml}
                </div>
            </div>
        `;

        // ============================================
        // STRATEGIC RECOMMENDATIONS
        // ============================================
        const allAvailablePlayers = Array.from(processedById.values())
            .filter(p => !state.draft.ownedElementIds.has(p.id)); // Only free agents

        // Find weak positions
        const weakPositions = [];
        ['GKP', 'DEF', 'MID', 'FWD'].forEach(pos => {
            const myPlayers = myPositions[pos];
            const oppPlayers = oppPositions[pos];
            const myAvg = myPlayers.length > 0 ? myPlayers.reduce((sum, p) => sum + (parseFloat(p.predicted_points_1_gw) || 0), 0) / myPlayers.length : 0;
            const oppAvg = oppPlayers.length > 0 ? oppPlayers.reduce((sum, p) => sum + (parseFloat(p.predicted_points_1_gw) || 0), 0) / oppPlayers.length : 0;

            if (oppAvg > myAvg) {
                weakPositions.push({ pos, gap: oppAvg - myAvg, posName: positionNames[pos] });
            }
        });
        weakPositions.sort((a, b) => b.gap - a.gap);

        // Get recommendations for weakest position
        let recommendationsHtml = '';
        if (weakPositions.length > 0 && allAvailablePlayers.length > 0) {
            const weakestPos = weakPositions[0];
            const posType = weakestPos.pos === 'GKP' ? 1 : weakestPos.pos === 'DEF' ? 2 : weakestPos.pos === 'MID' ? 3 : 4;

            const topAvailable = allAvailablePlayers
                .filter(p => p.element_type === posType)
                .sort((a, b) => (parseFloat(b.predicted_points_1_gw) || 0) - (parseFloat(a.predicted_points_1_gw) || 0))
                .slice(0, 5);

            recommendationsHtml = `
                <div class="recommendations-section" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 12px; border: 2px solid #fbbf24; box-shadow: 0 4px 12px rgba(251, 191, 36, 0.2); margin-top: 20px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                        <span style="font-size: 24px;">💡</span>
                        <h3 style="margin: 0; font-size: 16px; color: #92400e; font-weight: 800;">המלצות אסטרטגיות - חזק את ${weakestPos.posName}</h3>
                    </div>
                    <div style="background: white; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                        <div style="font-size: 13px; color: #92400e; font-weight: 600; margin-bottom: 10px;">
                            🎯 זיהינו פער של ${weakestPos.gap.toFixed(1)} נקודות ב${weakestPos.posName} - זה המקום החלש ביותר שלך!
                        </div>
                        <div style="font-size: 12px; color: #78350f;">
                            שחקנים זמינים מומלצים (לא בבעלות):
                        </div>
                    </div>
                    <div style="display: grid; gap: 10px;">
                        ${topAvailable.map((p, idx) => {
                const xPts = parseFloat(p.predicted_points_1_gw) || 0;
                const form = parseFloat(p.form) || 0;
                const price = (p.now_cost || 0) / 10;
                return `
                                <div style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 12px; border-radius: 10px; border: 2px solid ${idx === 0 ? '#fbbf24' : '#e2e8f0'}; box-shadow: ${idx === 0 ? '0 4px 12px rgba(251, 191, 36, 0.3)' : '0 2px 4px rgba(0,0,0,0.05)'};">
                                    <div style="flex: 1;">
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            ${idx === 0 ? '<span style="font-size: 20px;">🌟</span>' : `<span style="font-size: 16px; color: #94a3b8; font-weight: 700;">${idx + 1}</span>`}
                                            <img src="${p.code ? getPlayerPhotoUrl(p.code) : ''}" 
                                                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2245%22 height=%2245%22 viewBox=%220 0 45 45%22%3E%3Ccircle cx=%2222.5%22 cy=%2222.5%22 r=%2222.5%22 fill=%22%23f1f5f9%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2218%22 fill=%22%2394a3b8%22%3E${p.web_name.charAt(0)}%3C/text%3E%3C/svg%3E'" 
                                                 style="width: 45px; height: 45px; border-radius: 50%; object-fit: cover; border: 2px solid ${idx === 0 ? '#fbbf24' : '#e2e8f0'}; background: #f8fafc;">
                                            <div>
                                                <div style="font-weight: 800; color: #0f172a; font-size: 16px;">${p.web_name} <span style="font-size: 13px; color: #8b5cf6; font-weight: 700;">(${p.position_name})</span></div>
                                                <div style="font-size: 12px; color: #64748b; font-weight: 600;">${p.team_name}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div style="display: flex; gap: 18px; align-items: center;">
                                        <div style="text-align: center;">
                                            <div style="font-size: 18px; font-weight: 900; color: #10b981;">${xPts.toFixed(1)}</div>
                                            <div style="font-size: 11px; color: #64748b; font-weight: 600;">צפי</div>
                                        </div>
                                        <div style="text-align: center;">
                                            <div style="font-size: 16px; font-weight: 800; color: #f59e0b;">${form.toFixed(1)}</div>
                                            <div style="font-size: 11px; color: #64748b; font-weight: 600;">Form</div>
                                        </div>
                                        <div style="text-align: center;">
                                            <div style="font-size: 16px; font-weight: 800; color: #3b82f6;">£${price.toFixed(1)}</div>
                                            <div style="font-size: 11px; color: #64748b; font-weight: 600;">מחיר</div>
                                        </div>
                                    </div>
                                </div>
                            `;
            }).join('')}
                    </div>
                </div>
            `;
        }

        html += recommendationsHtml;

        // ============================================
        // KEY INSIGHTS SUMMARY
        // ============================================
        const insights = [];

        // Win probability insight
        if (myWinProb > 60) {
            insights.push({ icon: '🎯', text: `סיכוי גבוה לניצחון (${myWinProb.toFixed(0)}%)`, type: 'success' });
        } else if (myWinProb < 40) {
            insights.push({ icon: '⚠️', text: `סיכוי נמוך לניצחון (${myWinProb.toFixed(0)}%)`, type: 'warning' });
        }

        // Form insight
        if (myStats.form > oppStats.form * 1.15) {
            insights.push({ icon: '🔥', text: 'הכושר שלך מצוין - השחקנים שלך בפורמה!', type: 'success' });
        } else if (oppStats.form > myStats.form * 1.15) {
            insights.push({ icon: '❄️', text: 'הכושר של היריב טוב יותר - שחקניו בפורמה', type: 'warning' });
        }

        // xGI insight
        if (myStats.xGI > oppStats.xGI * 1.2) {
            insights.push({ icon: '⚡', text: 'יש לך פוטנציאל התקפי גבוה משמעותית!', type: 'success' });
        } else if (oppStats.xGI > myStats.xGI * 1.2) {
            insights.push({ icon: '🛡️', text: 'ליריב יש פוטנציאל התקפי גבוה - היזהר!', type: 'warning' });
        }


        // Position weakness insight
        if (weakPositions.length > 0) {
            insights.push({ icon: '🎯', text: `נקודה חלשה: ${weakPositions[0].posName} (פער של ${weakPositions[0].gap.toFixed(1)} נק')`, type: 'info' });
        }

        if (insights.length > 0) {
            html += `
                <div class="insights-summary-section" style="background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%); padding: 20px; border-radius: 12px; border: 2px solid #8b5cf6; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2); margin-top: 20px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                        <span style="font-size: 24px;">🧠</span>
                        <h3 style="margin: 0; font-size: 16px; color: #5b21b6; font-weight: 800;">תובנות מפתח - מה חשוב לדעת</h3>
                    </div>
                    <div style="display: grid; gap: 10px;">
                        ${insights.map(insight => {
                const bgColor = insight.type === 'success' ? '#d1fae5' : insight.type === 'warning' ? '#fee2e2' : '#dbeafe';
                const borderColor = insight.type === 'success' ? '#10b981' : insight.type === 'warning' ? '#ef4444' : '#3b82f6';
                const textColor = insight.type === 'success' ? '#065f46' : insight.type === 'warning' ? '#991b1b' : '#1e40af';
                return `
                                <div style="display: flex; align-items: center; gap: 12px; background: ${bgColor}; padding: 12px 15px; border-radius: 10px; border: 2px solid ${borderColor};">
                                    <span style="font-size: 24px;">${insight.icon}</span>
                                    <div style="font-size: 13px; font-weight: 700; color: ${textColor};">${insight.text}</div>
                                </div>
                            `;
            }).join('')}
                    </div>
                </div>
            `;
        }

        // Add compact stats at the bottom
        const squadSize = mySquad.length;
        const oppSquadSize = oppSquad.length;
        const myTopScorer = mySquad.reduce((max, p) => (parseFloat(p.total_points) || 0) > (parseFloat(max.total_points) || 0) ? p : max, mySquad[0]);
        const oppTopScorer = oppSquad.reduce((max, p) => (parseFloat(p.total_points) || 0) > (parseFloat(max.total_points) || 0) ? p : max, oppSquad[0]);

        html += `
            <div class="compact-stats-footer" style="background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%); padding: 20px 25px; border-radius: 12px; border: 2px solid #e2e8f0; margin-top: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; font-size: 13px;">
                    <div style="text-align: center;">
                        <div style="color: #64748b; margin-bottom: 6px; font-weight: 600; font-size: 12px;">🔥 כושר</div>
                        <div style="display: flex; justify-content: center; gap: 10px; align-items: center;">
                            <span style="font-weight: 900; color: #3b82f6; font-size: 18px;">${myStats.form.toFixed(1)}</span>
                            <span style="color: #cbd5e1; font-size: 14px;">vs</span>
                            <span style="font-weight: 900; color: #ef4444; font-size: 18px;">${oppStats.form.toFixed(1)}</span>
                        </div>
                    </div>
                    <div style="text-align: center;">
                        <div style="color: #64748b; margin-bottom: 6px; font-weight: 600; font-size: 12px;">⚡ xGI</div>
                        <div style="display: flex; justify-content: center; gap: 10px; align-items: center;">
                            <span style="font-weight: 900; color: #3b82f6; font-size: 18px;">${myStats.xGI.toFixed(1)}</span>
                            <span style="color: #cbd5e1; font-size: 14px;">vs</span>
                            <span style="font-weight: 900; color: #ef4444; font-size: 18px;">${oppStats.xGI.toFixed(1)}</span>
                        </div>
                    </div>
                    <div style="text-align: center;">
                        <div style="color: #64748b; margin-bottom: 6px; font-weight: 600; font-size: 12px;">👥 גודל סגל</div>
                        <div style="display: flex; justify-content: center; gap: 10px; align-items: center;">
                            <span style="font-weight: 900; color: #3b82f6; font-size: 18px;">${squadSize}</span>
                            <span style="color: #cbd5e1; font-size: 14px;">vs</span>
                            <span style="font-weight: 900; color: #ef4444; font-size: 18px;">${oppSquadSize}</span>
                        </div>
                    </div>
                    <div style="text-align: center;">
                        <div style="color: #64748b; margin-bottom: 6px; font-weight: 600; font-size: 12px;">⭐ מלך השערים</div>
                        <div style="display: flex; justify-content: center; gap: 10px; align-items: center; font-size: 11px;">
                            <span style="font-weight: 800; color: #3b82f6;">${myTopScorer?.web_name || '-'}</span>
                            <span style="color: #cbd5e1; font-size: 12px;">vs</span>
                            <span style="font-weight: 800; color: #ef4444;">${oppTopScorer?.web_name || '-'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    } catch (err) {
        console.error('CRITICAL ERROR in renderNextRivalAnalysis:', err);
        container.innerHTML = `<div class="alert alert-danger">
            <strong>שגיאה בטעינת הנתונים:</strong><br>
            ${err.message}
            <br><small>בדוק את הקונסול לפרטים נוספים.</small>
        </div>`;
    }
}

// ============================================
// TREND CHART RESTORATION
// ============================================

function renderAllTeamsTrendChart(teamAggregates, mode = 'cumulative', highlightTeamIds = []) {
    console.log("📈 renderAllTeamsTrendChart() called with mode:", mode, "highlightTeamIds:", highlightTeamIds);

    if (!state.draft.details) {
        console.error("❌ No draft details available for trend chart!");
        return;
    }

    // Define matches and entries FIRST
    const matches = state.draft.details?.matches || [];
    const entries = state.draft.details?.league_entries || [];

    // Determine which teams to highlight
    if (!Array.isArray(highlightTeamIds)) highlightTeamIds = highlightTeamIds ? [highlightTeamIds] : [];

    // If no teams are selected, default to the top 4 teams by total points from standings
    if (highlightTeamIds.length === 0) {
        // Use standings data if available (from state.draft._standingsData)
        if (state.draft._standingsData && state.draft._standingsData.length > 0) {
            // Sort by total points (descending) and take top 4
            const sortedStandings = [...state.draft._standingsData]
                .sort((a, b) => b.total - a.total)
                .slice(0, 4);

            // Map team names back to entry IDs
            highlightTeamIds = sortedStandings.map(s => {
                const entry = entries.find(e => e.entry_name === s.team);
                return entry ? String(entry.id) : null;
            }).filter(Boolean);

            console.log("📊 Top 4 teams by standings:", sortedStandings.map(s => `${s.team} (${s.total} pts)`));
        } else {
            // Fallback: Calculate total points from matches
            const teamPoints = [];
            entries.forEach(e => {
                let total = 0;
                matches.forEach(m => {
                    if (m.finished) {
                        if (String(m.league_entry_1) === String(e.id)) total += m.league_entry_1_points;
                        if (String(m.league_entry_2) === String(e.id)) total += m.league_entry_2_points;
                    }
                });
                teamPoints.push({ id: e.id, total });
            });

            // Sort descending and take top 4 IDs
            teamPoints.sort((a, b) => b.total - a.total);
            highlightTeamIds = teamPoints.slice(0, 4).map(t => String(t.id));
        }
    } else {
        highlightTeamIds = highlightTeamIds.map(id => String(id));
    }

    const container = document.getElementById('chart-progress');
    if (!container) {
        console.error("❌ chart-progress container not found!");
        return;
    }

    if (!matches.length || !entries.length) {
        container.innerHTML = '<div class="alert alert-info">אין נתונים להצגת גרף מגמה.</div>';
        return;
    }

    // Get current metric from state or select element or default to table_points
    let currentMetric = window.currentTrendState?.metric || document.getElementById('trendMetricSelect')?.value || 'table_points';
    const currentSpeed = window.trendAnimationSpeed || 800;

    container.innerHTML = `
        <div class="chart-controls-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 15px; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0;">
            <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                <span style="font-weight: 700; color: #475569; font-size: 14px;">מצב מצטבר:</span>
                
                <div class="chart-toggles" style="display: flex; background: white; border-radius: 8px; padding: 3px; border: 2px solid #e2e8f0;">
                    <button onclick="updateTrendChartMetric('table_points')" style="padding: 7px 14px; border: none; background: ${currentMetric === 'table_points' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent'}; color: ${currentMetric === 'table_points' ? 'white' : '#64748b'}; font-weight: 700; border-radius: 6px; cursor: pointer; font-size: 12px; transition: all 0.2s;">נקודות בטבלה</button>
                    <button onclick="updateTrendChartMetric('points')" style="padding: 7px 14px; border: none; background: ${currentMetric === 'points' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent'}; color: ${currentMetric === 'points' ? 'white' : '#64748b'}; font-weight: 700; border-radius: 6px; cursor: pointer; font-size: 12px; transition: all 0.2s;">נקודות בעד</button>
                </div>

                <div style="display: flex; gap: 5px; background: white; padding: 3px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <button onclick="setTrendSpeed(1500)" style="padding: 5px 10px; font-size: 11px; border: none; border-radius: 6px; background: ${currentSpeed === 1500 ? '#dbeafe' : 'transparent'}; color: ${currentSpeed === 1500 ? '#1e40af' : '#64748b'}; cursor: pointer; font-weight: 600;">⏱️ איטי</button>
                    <button onclick="setTrendSpeed(800)" style="padding: 5px 10px; font-size: 11px; border: none; border-radius: 6px; background: ${currentSpeed === 800 ? '#dbeafe' : 'transparent'}; color: ${currentSpeed === 800 ? '#1e40af' : '#64748b'}; cursor: pointer; font-weight: 600;">⏱️ רגיל</button>
                    <button onclick="setTrendSpeed(300)" style="padding: 5px 10px; font-size: 11px; border: none; border-radius: 6px; background: ${currentSpeed === 300 ? '#dbeafe' : 'transparent'}; color: ${currentSpeed === 300 ? '#1e40af' : '#64748b'}; cursor: pointer; font-weight: 600;">⚡ מהיר</button>
                </div>
            </div>

            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <button onclick="selectTopTeams()" style="padding: 8px 14px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); color: #059669; border: 2px solid #10b981; border-radius: 10px; font-size: 13px; font-weight: 800; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.15);">🔝 צמרת (4)</button>
                <button onclick="selectBottomTeams()" style="padding: 8px 14px; background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%); color: #e11d48; border: 2px solid #f43f5e; border-radius: 10px; font-size: 13px; font-weight: 800; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 4px rgba(225, 29, 72, 0.15);">📉 תחתית (4)</button>
                
                <div style="width: 2px; height: 28px; background: #cbd5e1; margin: 0 5px;"></div>

                <button id="playTrendBtn" onclick="playTrendProgression()" style="padding: 10px 18px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 800; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3); transition: all 0.2s; font-size: 13px;">
                    <span id="playIcon">▶️</span> <span id="playText">נגן התקדמות</span>
                </button>
            </div>
        </div>

        <div class="trend-chart-grid" style="display: grid; grid-template-columns: 1fr 220px; gap: 20px; align-items: start;">
            <div class="chart-area" style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 10px; height: 450px; position: relative;">
            <canvas id="trendCanvas"></canvas>
            </div>
            <div class="team-selector-sidebar" style="background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; padding: 15px; max-height: 450px; overflow-y: auto;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">השוואת קבוצות</h4>
                <div class="team-checkbox-list" id="trendTeamList" style="display: flex; flex-direction: column; gap: 8px;"></div>
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; text-align: center;">
                    <button onclick="selectAllTrendTeams()" style="font-size: 11px; color: #3b82f6; background: none; border: none; cursor: pointer;">בחר הכל</button>
                    <span style="color: #cbd5e1;">|</span>
                    <button onclick="clearAllTrendTeams()" style="font-size: 11px; color: #64748b; background: none; border: none; cursor: pointer;">נקה הכל</button>
                </div>
            </div>
        </div>
    `;

    const teamList = document.getElementById('trendTeamList');
    // 9 distinct colors - pastel versions for better visibility
    const colors = [
        '#3b82f6', // Blue
        '#ef4444', // Red
        '#10b981', // Green
        '#f59e0b', // Orange
        '#8b5cf6', // Purple
        '#ec4899', // Pink
        '#06b6d4', // Cyan
        '#84cc16', // Lime
        '#f97316'  // Deep Orange
    ];

    entries.forEach((e, index) => {
        const isChecked = highlightTeamIds.includes(String(e.id));
        const isMyTeam = String(e.id) === String(state.draft.myTeamId);
        const teamColor = isMyTeam ? '#0f172a' : colors[index % colors.length];
        const teamLogo = getTeamLogo(e.entry_name);

        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155; cursor: pointer; padding: 6px 8px; border-radius: 8px; transition: all 0.2s;';
        if (isChecked) {
            label.style.background = '#eef2ff';
            label.style.border = '1px solid #c7d2fe';
        }

        // Add color indicator circle
        const colorCircle = `<span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${teamColor}; border: 2px solid white; box-shadow: 0 0 0 1px #e2e8f0;"></span>`;

        label.innerHTML = `<input type="checkbox" value="${e.id}" ${isChecked ? 'checked' : ''} onchange="toggleTrendTeam('${e.id}')" style="accent-color: #3b82f6;">${colorCircle}<span style="font-size: 18px;">${teamLogo}</span><span style="${isMyTeam ? 'font-weight: 700; color: #0f172a;' : ''}">${isMyTeam ? '👤 ' : ''}${e.entry_name}</span>`;
        teamList.appendChild(label);
    });

    const historyMap = new Map();
    entries.forEach(e => historyMap.set(String(e.id), { name: e.entry_name, points: [], cumulative: [] }));
    const finishedMatches = matches.filter(m => m.finished).sort((a, b) => a.event - b.event);
    const maxGW = finishedMatches.length ? finishedMatches[finishedMatches.length - 1].event : 0;
    entries.forEach(e => { for (let gw = 1; gw <= maxGW; gw++) historyMap.get(String(e.id)).points.push(0); });

    finishedMatches.forEach(m => {
        const gwIdx = m.event - 1;
        const id1 = String(m.league_entry_1), id2 = String(m.league_entry_2);
        let p1 = 0, p2 = 0;
        if (currentMetric === 'points') { p1 = m.league_entry_1_points; p2 = m.league_entry_2_points; }
        else {
            if (m.league_entry_1_points > m.league_entry_2_points) { p1 = 3; p2 = 0; }
            else if (m.league_entry_1_points < m.league_entry_2_points) { p1 = 0; p2 = 3; }
            else { p1 = 1; p2 = 1; }
        }
        if (historyMap.has(id1)) historyMap.get(id1).points[gwIdx] = p1;
        if (historyMap.has(id2)) historyMap.get(id2).points[gwIdx] = p2;
    });

    historyMap.forEach((data, id) => { let sum = 0; data.points.forEach(p => { sum += p; data.cumulative.push(sum); }); });

    // Add significant offsets to separate lines visually (especially for 'points' metric)
    const useOffset = currentMetric === 'points';

    const datasets = Array.from(historyMap.entries())
        .filter(([entryId, team]) => highlightTeamIds.includes(entryId))
        .map(([entryId, team], index) => {
            // 9 distinct colors matching the sidebar
            const chartColors = [
                '#3b82f6', // Blue
                '#ef4444', // Red
                '#10b981', // Green
                '#f59e0b', // Orange
                '#8b5cf6', // Purple
                '#ec4899', // Pink
                '#06b6d4', // Cyan
                '#84cc16', // Lime
                '#f97316'  // Deep Orange
            ];
            const isMyTeam = String(entryId) === String(state.draft.myTeamId);

            // Find the correct color index based on the entry's position in the full entries list
            const fullIndex = entries.findIndex(e => String(e.id) === entryId);
            const color = isMyTeam ? '#9333ea' : chartColors[fullIndex % chartColors.length]; // Purple for my team instead of black

            // Make lines varied for better visibility
            const lineWidth = isMyTeam ? 5.5 : 4;
            const pointSize = isMyTeam ? 7 : 5.5;

            // Add LARGER offset for visual separation - create clear vertical spacing
            const offset = useOffset ? index * 8 : 0;
            const dataWithOffset = team.cumulative.map(v => v + offset);

            return {
                label: team.name,
                data: dataWithOffset,
                borderColor: color,
                backgroundColor: color,
                borderWidth: lineWidth,
                pointRadius: pointSize,
                pointHoverRadius: pointSize + 3,
                tension: 0.4,
                spanGaps: false,  // Don't connect null points
                fill: false,
                order: isMyTeam ? 100 : 1
            };
        });

    const labels = Array.from({ length: maxGW }, (_, i) => `GW${i + 1}`);
    const canvas = document.getElementById('trendCanvas');
    if (window.trendChartInstance) window.trendChartInstance.destroy();

    // Calculate max value for better Y-axis scaling with more space
    const allValues = datasets.flatMap(d => d.data);
    const maxValue = Math.max(...allValues);
    const minValue = Math.min(...allValues.filter(v => v !== null && v !== undefined));

    // Add padding: 10% below min, 25% above max for better visibility and label space
    const range = maxValue - minValue;
    const suggestedMin = Math.max(0, Math.floor(minValue - range * 0.1));
    const suggestedMax = Math.ceil(maxValue + range * 0.25);

    // Custom plugin to draw team names at end of lines
    const endLabelsPlugin = {
        id: 'endLabels',
        afterDatasetsDraw(chart) {
            const ctx = chart.ctx;
            const meta = chart.getDatasetMeta(0);
            if (!meta) return;

            chart.data.datasets.forEach((dataset, i) => {
                const meta = chart.getDatasetMeta(i);
                if (!meta.data || meta.data.length === 0) return;

                // Find last non-null point
                let lastIndex = -1;
                for (let j = dataset.data.length - 1; j >= 0; j--) {
                    if (dataset.data[j] !== null && dataset.data[j] !== undefined) {
                        lastIndex = j;
                        break;
                    }
                }

                if (lastIndex === -1) return;

                const point = meta.data[lastIndex];
                if (!point) return;

                const x = point.x;
                const y = point.y;

                // Draw team name
                ctx.save();
                ctx.font = 'bold 11px Arial';
                ctx.fillStyle = dataset.borderColor;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';

                // Add background for better readability
                const text = dataset.label;
                const textWidth = ctx.measureText(text).width;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.fillRect(x + 8, y - 8, textWidth + 8, 16);

                ctx.fillStyle = dataset.borderColor;
                ctx.fillText(text, x + 12, y);
                ctx.restore();
            });
        }
    };

    window.trendChartInstance = new Chart(canvas, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        plugins: [endLabelsPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0  // Disable default animations
            },
            layout: {
                padding: {
                    right: 80  // Add space for team name labels
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'center',
                    labels: {
                        padding: 15,
                        font: { size: 12, weight: '600' },
                        usePointStyle: true,
                        pointStyle: 'line'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    padding: 12,
                    borderColor: 'rgba(59, 130, 246, 0.5)',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: suggestedMin,
                    max: suggestedMax,
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        font: { size: 12, weight: '600' },
                        color: '#64748b',
                        padding: 8
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 11, weight: '600' },
                        color: '#64748b'
                    }
                }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        }
    });
    window.currentTrendState = { mode: 'cumulative', highlightTeamIds, metric: currentMetric };
}

window.updateTrendChartMode = (mode) => {
    const current = window.currentTrendState || {};
    renderAllTeamsTrendChart(null, 'cumulative', current.highlightTeamIds);
}
window.updateTrendChartMetric = (metric) => {
    const current = window.currentTrendState || {};
    // Force re-render by clearing the container first
    const container = document.getElementById('chart-progress');
    if (container) {
        window.currentTrendState = { ...current, metric };
        renderAllTeamsTrendChart(null, 'cumulative', current.highlightTeamIds);
    }
}
window.toggleTrendTeam = (teamId) => {
    const current = window.currentTrendState || {};
    let ids = current.highlightTeamIds || [];
    if (ids.includes(String(teamId))) ids = ids.filter(id => id !== String(teamId));
    else ids.push(String(teamId));
    renderAllTeamsTrendChart(null, 'cumulative', ids);
}
window.selectAllTrendTeams = () => {
    const ids = (state.draft.details?.league_entries || []).map(e => String(e.id));
    renderAllTeamsTrendChart(null, 'cumulative', ids);
}
window.clearAllTrendTeams = () => {
    const ids = state.draft.myTeamId ? [String(state.draft.myTeamId)] : [];
    renderAllTeamsTrendChart(null, 'cumulative', ids);
}

window.setTrendSpeed = (ms) => {
    window.trendAnimationSpeed = ms;
    // Re-render to update button states
    renderAllTeamsTrendChart(null, 'cumulative', window.currentTrendState?.highlightTeamIds);
}

window.selectTopTeams = () => {
    const standings = state.draft._standingsData || [];
    const entries = state.draft.details?.league_entries || [];
    const top4Names = standings.slice(0, 4).map(s => s.team);
    const ids = entries.filter(e => top4Names.includes(e.entry_name)).map(e => String(e.id));
    renderAllTeamsTrendChart(null, 'cumulative', ids);
}

window.selectBottomTeams = () => {
    const standings = state.draft._standingsData || [];
    const entries = state.draft.details?.league_entries || [];
    const bottom4Names = standings.slice(-4).map(s => s.team);
    const ids = entries.filter(e => bottom4Names.includes(e.entry_name)).map(e => String(e.id));
    renderAllTeamsTrendChart(null, 'cumulative', ids);
}

let isTrendAnimating = false;
let animationTimeout = null;

window.playTrendProgression = async () => {
    const btn = document.getElementById('playTrendBtn');
    const icon = document.getElementById('playIcon');
    const text = document.getElementById('playText');

    if (isTrendAnimating) {
        stopTrendAnimation();
        return;
    }

    if (!window.trendChartInstance) return;

    // Save full data and labels
    const fullLabels = [...window.trendChartInstance.data.labels];
    const fullDatasets = window.trendChartInstance.data.datasets.map(ds => ({
        ...ds,
        fullData: [...ds.data]
    }));

    if (fullLabels.length === 0) return;

    isTrendAnimating = true;
    if (icon) icon.innerText = '⏹️';
    if (text) text.innerText = 'עצור';
    if (btn) btn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';

    // Initialize with all labels but empty data points (null)
    window.trendChartInstance.data.labels = fullLabels;
    window.trendChartInstance.data.datasets.forEach((ds, idx) => {
        ds.data = new Array(fullLabels.length).fill(null);
    });
    window.trendChartInstance.update('none');

    const speed = window.trendAnimationSpeed || 800;

    // Animate step by step - add one point at a time with smooth drawing effect
    for (let i = 0; i < fullLabels.length; i++) {
        if (!isTrendAnimating) break;

        window.trendChartInstance.data.datasets.forEach((ds, idx) => {
            ds.data[i] = fullDatasets[idx].fullData[i];
        });

        // Smooth, gradual animation - longer duration for smoother effect
        window.trendChartInstance.update({
            duration: Math.min(speed * 0.7, 500),
            easing: 'easeOutCubic'  // Smooth deceleration
        });

        // Shorter delay between steps so animation overlaps for fluid motion
        await new Promise(resolve => {
            animationTimeout = setTimeout(resolve, Math.max(speed * 0.4, 200));
        });
    }

    if (isTrendAnimating) stopTrendAnimation();
};

function stopTrendAnimation() {
    isTrendAnimating = false;
    if (animationTimeout) clearTimeout(animationTimeout);

    const btn = document.getElementById('playTrendBtn');
    const icon = document.getElementById('playIcon');
    const text = document.getElementById('playText');

    if (btn) {
        if (icon) icon.innerText = '▶️';
        if (text) text.innerText = 'נגן התקדמות';
        btn.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
    }
}

// Helper to call when draft data is loaded
function onDraftDataLoaded() {
    populateMyTeamSelector();
    const myTeam = findMyTeam();
    if (state.draft.details) {
        const allIds = (state.draft.details.league_entries || []).map(e => String(e.id));
        renderAllTeamsTrendChart(null, 'cumulative', allIds);
    }
}

// Hook into existing loadDraftLeague (search for where it finishes and call onDraftDataLoaded)
// Or simply call populateMyTeamSelector inside loadDraftLeague if possible.

