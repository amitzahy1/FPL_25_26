#!/usr/bin/env node
/**
 * Backtests the value index against what players actually went on to score.
 *
 * A composite that nobody has measured is a vibe with a number on it. This
 * replays the finished 2025/26 season: at each cutoff gameweek it builds every
 * player from the gameweeks *before* the cutoff only, ranks them with the very
 * functions the site runs (pulled out of script.js, not reimplemented), and
 * scores that ranking against the points they scored *after* it.
 *
 * Reported per cutoff and averaged, against three baselines anyone could use
 * instead — total points so far, points per appearance, and last-5 form:
 *
 *   ρ       Spearman rank correlation with actual future points
 *   top-20  how many of the index's top 20 landed in the actual top 20
 *
 * Usage: node scripts/backtest-value.mjs [cutoffs...]     (default 10 15 20 25 30)
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractDeclaration, extractFunction } from '../tests/helpers/load-script.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT = JSON.parse(readFileSync(join(ROOT, 'data', 'season-2025-26.json'), 'utf8'));
const CUTOFFS = process.argv.slice(2).map(Number).filter(Boolean);
const GWS = SNAPSHOT.totalGameweeks || 38;
const LEAGUE_SIZE = 8;
const REPLACEMENT_SLOTS = { GKP: 1, DEF: 4, MID: 4, FWD: 2 };
const POSITION = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const WINDOW = 5;

/* ------------------------------ the snapshot ------------------------------ */

const F = Object.fromEntries(SNAPSHOT.fields.map((f, i) => [f, i]));
const L = Object.fromEntries(SNAPSHOT.logFields.map((f, i) => [f, i]));
const STRIDE = SNAPSHOT.logStride;

/** Every gameweek row for one player, as objects, oldest first. */
function logsFor(id) {
    const flat = SNAPSHOT.gwLogs[id] || [];
    const out = [];
    for (let i = 0; i + STRIDE <= flat.length; i += STRIDE) {
        const rec = {};
        for (const [name, at] of Object.entries(L)) rec[name] = flat[i + at];
        out.push(rec);
    }
    return out.sort((a, b) => a.gw - b.gw);
}

const PLAYERS = SNAPSHOT.rows.map(r => ({
    id: r[F.id],
    web_name: r[F.web_name],
    element_type: r[F.element_type],
    position_name: POSITION[r[F.element_type]],
    logs: logsFor(r[F.id])
}));

/* --------------------------- the site's own code -------------------------- */

// The whole point of extracting rather than reimplementing: if the formula
// changes in script.js, this script measures the change.
const NEEDS = {
    decls: ['TREND_METRICS', 'DEFCON_THRESHOLD', '_windowStatsCache', '_trendPlayerIndex',
        'VALUE_TUNING', 'VALUE_HORIZONS', '_valueCache', 'gwNum', 'num1'],
    fns: ['windowStats', 'getTrendSeries', 'trendPlayerIndex', 'gwDefensiveContribution',
        'seasonMatchesLeft', 'seasonPointsPerApp', 'projectedLevel', 'expectedMatches',
        'fixtureTilt', 'draftValue', 'draftValueOf', 'getCompletedGWCount']
};
const body = [...NEEDS.decls.map(n => extractDeclaration(n)), ...NEEDS.fns.map(n => extractFunction(n))].join('\n');
// VALUE_HORIZONS comes back out too: the constants in it are hand-set, and the
// only honest way to keep them is to be able to sweep them here.
const site = new Function(`${body}\nreturn { ${NEEDS.fns.join(', ')}, VALUE_HORIZONS, VALUE_TUNING };`)();

/* ------------------------------- statistics ------------------------------- */

/** Ranks, averaging ties, so equal values cannot bias the correlation. */
function ranks(values) {
    const order = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const out = new Array(values.length);
    for (let i = 0; i < order.length;) {
        let j = i;
        while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
        const rank = (i + j) / 2 + 1;
        for (let k = i; k <= j; k++) out[order[k][1]] = rank;
        i = j + 1;
    }
    return out;
}

function spearman(xs, ys) {
    const rx = ranks(xs), ry = ranks(ys), n = xs.length;
    if (n < 3) return NaN;
    const mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
        num += (rx[i] - mx) * (ry[i] - my);
        dx += (rx[i] - mx) ** 2;
        dy += (ry[i] - my) ** 2;
    }
    return dx && dy ? num / Math.sqrt(dx * dy) : NaN;
}

/** Of the top N by score, how many are in the top N by outcome. */
function topN(rows, scoreKey, n = 20, truthKey = 'future') {
    const byScore = [...rows].sort((a, b) => b[scoreKey] - a[scoreKey]).slice(0, n).map(r => r.id);
    const byTruth = new Set([...rows].sort((a, b) => b[truthKey] - a[truthKey]).slice(0, n).map(r => r.id));
    return byScore.filter(id => byTruth.has(id)).length;
}

/* ------------------------------- one cutoff ------------------------------- */

/**
 * Rebuild each player as he looked at the cutoff — nothing after it — in the
 * shape script.js expects, then let the site's own functions price him.
 */
function evaluate(cutoff, horizonId, futureSpan) {
    const built = PLAYERS.map(p => {
        const before = p.logs.filter(l => l.gw <= cutoff);
        const played = before.filter(l => l.minutes > 0);
        const minutes = played.reduce((s, l) => s + l.minutes, 0);
        const points = played.reduce((s, l) => s + l.points, 0);
        const apps = played.length;
        const starts = played.filter(l => l.minutes >= 60).length;
        const ga = played.reduce((s, l) => s + l.goals + l.assists, 0);
        const xgi = played.reduce((s, l) => s + l.xgi_x100 / 100, 0);
        const futureLogs = p.logs
            .filter(l => l.gw > cutoff && l.gw <= Math.min(GWS, cutoff + futureSpan));
        const future = futureLogs.reduce((s, l) => s + l.points, 0);
        const futureApps = futureLogs.filter(l => l.minutes > 0).length;
        return {
            ...p, minutes, appearances: apps, starts, total_points: points,
            points_per_game: apps ? (points / apps).toFixed(2) : '0',
            rotation_risk: apps ? starts / apps : null,
            // The snapshot carries no per-gameweek injury status, so everyone is
            // assumed available; this measures the level and minutes terms only.
            availability_factor: 1,
            xDiff: ga - xgi,
            next_3_fdr: 0,
            future, futureApps,
            formPpg: (() => {
                const w = played.filter(l => l.gw > cutoff - WINDOW);
                return w.length ? w.reduce((s, l) => s + l.points, 0) / w.length : 0;
            })()
        };
    });

    // Replacement level, pre-draft rule: the first player past the point where
    // every team in the league has filled that position.
    const replacementByPos = {};
    for (const pos of Object.keys(REPLACEMENT_SLOTS)) {
        const atPos = built
            .filter(p => p.position_name === pos && p.minutes >= cutoff * 90 / 3)
            .sort((a, b) => parseFloat(b.points_per_game) - parseFloat(a.points_per_game));
        if (!atPos.length) continue;
        const idx = Math.min(LEAGUE_SIZE * REPLACEMENT_SLOTS[pos], atPos.length - 1);
        replacementByPos[pos] = parseFloat(atPos[idx].points_per_game);
    }
    built.forEach(p => { p.replacement_score = replacementByPos[p.position_name] ?? null; });

    // The state the extracted functions close over: the trend window is the five
    // gameweeks ending at the cutoff, exactly as the site builds it.
    const windowGws = [];
    for (let gw = Math.max(1, cutoff - WINDOW + 1); gw <= cutoff; gw++) {
        const stats = new Map();
        for (const p of built) {
            const rec = p.logs.find(l => l.gw === gw);
            if (rec && rec.minutes > 0) {
                stats.set(p.id, {
                    total_points: rec.points, minutes: rec.minutes, bps: rec.bps,
                    saves: rec.saves, defensive_contribution: rec.defcon,
                    goals_scored: rec.goals, assists: rec.assists,
                    expected_goals: rec.xgi_x100 / 200, expected_assists: rec.xgi_x100 / 200
                });
            }
        }
        windowGws.push({ gw, stats });
    }
    globalThis.state = {
        // getCompletedGWCount reads the event list, and both the play rate and the
        // season span depend on it — the harness has to be honest about how much
        // of the season has happened at the cutoff.
        allPlayersData: {
            live: { processed: built, raw: { events: Array.from({ length: cutoff }, () => ({ finished: true })) } },
            historical: {}, demo: {}
        },
        currentDataSource: 'live',
        trendWindow: WINDOW,
        trendKey: `bt:${cutoff}`,
        trendGws: windowGws,
        trendPrevGws: [],
        draft: { replacementByPos, ownedElementIds: new Set(), draftHasHappened: false }
    };

    // Only players with a real sample at the cutoff: below that nobody would be
    // reading a recommendation off them anyway.
    const rows = built
        .filter(p => p.appearances >= 3 && p.replacement_score !== null)
        .map(p => ({
            id: p.id, name: p.web_name, pos: p.position_name, future: p.future,
            futureApps: p.futureApps, replacement: p.replacement_score, apps: p.appearances,
            index: site.draftValueOf(p, horizonId) ?? 0,
            totalPoints: p.total_points,
            perApp: parseFloat(p.points_per_game),
            form: p.formPpg
        }));

    const cols = ['index', 'totalPoints', 'perApp', 'form'];
    // Two targets, because they ask different questions. Raw future points is
    // what the naive baselines are built for. Future points *above what the
    // replacement would have scored in the same matches* is what the index
    // actually claims to estimate — comparing it only against the first would be
    // grading it on someone else's exam.
    const withTargets = rows.map(r => ({ ...r, edgeFuture: r.future - r.replacement * r.futureApps }));
    const score = (pop, target) => ({
        rho: Object.fromEntries(cols.map(c =>
            [c, spearman(pop.map(r => r[c]), pop.map(r => r[target]))])),
        top: Object.fromEntries(cols.map(c => [c, topN(pop, c, 20, target)]))
    });
    const regulars = withTargets.filter(r => r.apps >= 10);
    return {
        cutoff, n: withTargets.length, nRegulars: regulars.length,
        all: score(withTargets, 'future'),
        allEdge: score(withTargets, 'edgeFuture'),
        regulars: score(regulars, 'future'),
        regularsEdge: score(regulars, 'edgeFuture'),
        best: [...withTargets].sort((a, b) => b.index - a.index).slice(0, 5)
            .map(r => `${r.name} (${r.pos}) index ${Math.round(r.index)} → ${r.future} נק׳`)
    };
}

/* --------------------------------- report -------------------------------- */

const NAMES = { index: 'value index', totalPoints: 'total points', perApp: 'points/app', form: 'last-5 form' };

const CELL = 15;
function table(runs, which, caption) {
    console.log(`\n  ${caption}`);
    console.log(['  cutoff', 'n', ...Object.values(NAMES)].map(h => String(h).padEnd(CELL)).join(''));
    for (const r of runs) {
        const s = r[which];
        console.log([`  GW${r.cutoff}`, which.startsWith('regulars') ? r.nRegulars : r.n,
            ...Object.keys(NAMES).map(k => `${s.rho[k].toFixed(3)} (${s.top[k]}/20)`)]
            .map(c => String(c).padEnd(CELL)).join(''));
    }
    const mean = k => runs.reduce((s, r) => s + r[which].rho[k], 0) / runs.length;
    const meanTop = k => runs.reduce((s, r) => s + r[which].top[k], 0) / runs.length;
    console.log(['  mean', '', ...Object.keys(NAMES).map(k =>
        `${mean(k).toFixed(3)} (${meanTop(k).toFixed(1)}/20)`)].map(c => String(c).padEnd(CELL)).join(''));
    return mean('index');
}

function report(label, cutoffs, horizonId, futureSpan) {
    console.log(`\n=== ${label} — next ${futureSpan} gameweeks ===`);
    const runs = cutoffs.map(c => evaluate(c, horizonId, futureSpan));
    table(runs, 'all', 'target: raw future points · population: 3+ appearances');
    table(runs, 'allEdge', 'target: future points above replacement · population: 3+ appearances');
    table(runs, 'regulars', 'target: raw future points · population: 10+ appearances');
    const m = table(runs, 'regularsEdge', 'target: future points above replacement · population: 10+ appearances');
    return { mean: m, runs };
}

/* --------------------------------- sweeps -------------------------------- */

/**
 * The constants are hand-set, so they have to be answerable. Each sweep changes
 * one of them and reports the same score, on the index's own target and on the
 * population that actually gets drafted.
 */
function sweep() {
    const cutoffs = [15, 20, 25, 30];
    const score = (label) => {
        const runs = cutoffs.map(c => evaluate(c, 'now', 5));
        const m = k => runs.reduce((s, r) => s + r[k].rho.index, 0) / runs.length;
        const t = k => runs.reduce((s, r) => s + r[k].top.index, 0) / runs.length;
        console.log(`  ${label.padEnd(34)} edge ρ ${m('allEdge').toFixed(3)} / regulars ${m('regularsEdge').toFixed(3)} · top-20 ${t('allEdge').toFixed(1)}`);
    };

    console.log('\n=== sweep: how much window form belongs in the projection ===');
    console.log('  (formK is the number of matches of form it takes to equal the season)');
    const formK0 = site.VALUE_HORIZONS.now.formK;
    for (const k of [1, 3, 8, 20, 1e6]) {
        site.VALUE_HORIZONS.now.formK = k;
        score(k >= 1e6 ? 'formK = ∞ (ignore form entirely)' : `formK = ${k}`);
    }
    site.VALUE_HORIZONS.now.formK = formK0;

    console.log('\n=== sweep: small-sample shrinkage ===');
    const shrink0 = site.VALUE_TUNING.shrinkK;
    for (const k of [0, 3, 6, 12, 30]) {
        site.VALUE_TUNING.shrinkK = k;
        score(k === 0 ? 'shrinkK = 0 (no shrinkage)' : `shrinkK = ${k}`);
    }
    site.VALUE_TUNING.shrinkK = shrink0;

    console.log('\n=== sweep: the conversion-luck correction ===');
    const luck0 = site.VALUE_TUNING.luckWeight;
    for (const w of [0, 0.25, 0.5, 1]) {
        site.VALUE_TUNING.luckWeight = w;
        score(w === 0 ? 'luckWeight = 0 (no correction)' : `luckWeight = ${w}`);
    }
    site.VALUE_TUNING.luckWeight = luck0;

    console.log('\n=== sweep: which volume term turns a level into matches ===');
    for (const v of ['none', 'startShare', 'playRate', 'both']) {
        site.VALUE_TUNING.volume = v;
        score(`volume = ${v}`);
    }
    site.VALUE_TUNING.volume = 'playRate';
}

if (process.env.SWEEP) { sweep(); process.exit(0); }

const cutoffs = CUTOFFS.length ? CUTOFFS : [10, 15, 20, 25, 30];
console.log(`Backtest on ${SNAPSHOT.seasonId}: ${PLAYERS.length} players, cutoffs ${cutoffs.join(', ')}`);
const short = report('short horizon (now)', cutoffs, 'now', 5);
report('season horizon', cutoffs.filter(c => c <= GWS - 10), 'season', GWS);

console.log('\nTop 5 by the index at the last cutoff, and what they actually scored:');
for (const line of short.runs[short.runs.length - 1].best) console.log(`  ${line}`);
console.log('\nCaveat: the snapshot has no per-gameweek availability or fixture difficulty,');
console.log('so the availability multiplier and the fixture tilt are inert here.');
