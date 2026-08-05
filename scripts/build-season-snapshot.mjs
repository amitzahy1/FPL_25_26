#!/usr/bin/env node
/**
 * Builds a compact, self-contained snapshot of a COMPLETED FPL season.
 *
 * Why this exists: at draft time the new season's API reports every player at
 * zero minutes and zero points, so every metric the app computes collapses to
 * 0. The finished season is the only usable data on draft day, and the live
 * API no longer serves it once it rolls over. So we freeze it into a file.
 *
 * Source: vaastav/Fantasy-Premier-League (raw.githubusercontent, CORS-open).
 * Output: data/season-<id>.json  — committed, no runtime dependency.
 *
 * Usage: node scripts/build-season-snapshot.mjs [seasonId]     (default 2025-26)
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEASON = process.argv[2] || '2025-26';
const BASE = `https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data/${SEASON}`;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', `season-${SEASON}.json`);

// DEFCON: defenders need 10 CBIT, midfielders/forwards 12 CBIRT. Goalkeepers
// are not eligible. Thresholds are unchanged for 2026/27.
const DEFCON_THRESHOLD = { 1: null, 2: 10, 3: 12, 4: 12 };

// Kept deliberately narrow — this ships to the browser.
const NUMERIC_FIELDS = [
    'total_points', 'minutes', 'starts', 'goals_scored', 'assists', 'clean_sheets',
    'goals_conceded', 'own_goals', 'penalties_saved', 'penalties_missed',
    'yellow_cards', 'red_cards', 'saves', 'bonus', 'bps',
    'influence', 'creativity', 'threat', 'ict_index',
    'expected_goals', 'expected_assists', 'expected_goal_involvements', 'expected_goals_conceded',
    // The API's own per-90s. Using these instead of recomputing from totals
    // avoids the divide-by-minutes drift that broke several columns.
    'expected_goals_per_90', 'expected_assists_per_90', 'expected_goal_involvements_per_90',
    'expected_goals_conceded_per_90', 'saves_per_90', 'starts_per_90',
    'clean_sheets_per_90', 'goals_conceded_per_90', 'defensive_contribution_per_90',
    'defensive_contribution', 'clearances_blocks_interceptions', 'recoveries', 'tackles',
    'points_per_game', 'selected_by_percent', 'now_cost', 'dreamteam_count',
    'penalties_order', 'corners_and_indirect_freekicks_order', 'direct_freekicks_order'
];

/** Minimal RFC4180-ish CSV parser (handles quoted fields and embedded commas/newlines). */
function parseCsv(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else field += c;
        } else if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c !== '\r') field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    const header = rows.shift();
    return rows
        .filter(r => r.length === header.length)
        .map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const num = v => {
    if (v === undefined || v === null || v === '') return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

async function fetchCsv(name) {
    const url = `${BASE}/${name}`;
    process.stdout.write(`  fetching ${name} ... `);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    const text = await res.text();
    const rows = parseCsv(text);
    console.log(`${rows.length} rows`);
    return rows;
}

async function main() {
    console.log(`Building snapshot for season ${SEASON}`);

    const [playersRaw, teamsRaw, mergedGw] = await Promise.all([
        fetchCsv('players_raw.csv'),
        fetchCsv('teams.csv'),
        fetchCsv('gws/merged_gw.csv')
    ]);

    const teams = teamsRaw.map(t => ({
        id: num(t.id),
        code: num(t.code),
        name: t.name,
        short_name: t.short_name,
        strength: num(t.strength),
        strength_overall_home: num(t.strength_overall_home),
        strength_overall_away: num(t.strength_overall_away),
        strength_attack_home: num(t.strength_attack_home),
        strength_attack_away: num(t.strength_attack_away),
        strength_defence_home: num(t.strength_defence_home),
        strength_defence_away: num(t.strength_defence_away),
        position: num(t.position),
        points: num(t.points)
    }));

    // Per-GW pass: DEFCON is a per-match binary threshold, so a season-average
    // per-90 misrepresents it. Hit-rate over appearances is the correct summary.
    const positionByElement = new Map(playersRaw.map(p => [num(p.id), num(p.element_type)]));
    const perPlayer = new Map();
    let maxGw = 0;

    // One appearance per player per FIXTURE, not per gameweek.
    //
    // Both halves of that matter. merged_gw.csv ships a handful of rows twice —
    // ten in 2025-26, nine of them one player — and summing them gave him six
    // extra appearances and 27 points his own season row did not have, so every
    // per-appearance rate on the site was computed against an inflated
    // denominator. Deduping on the gameweek instead would have been worse: a
    // double gameweek is two real fixtures in one round, and one player's two
    // GW33 cameos were a minute each with byte-identical stats, so "identical
    // rows in the same round" cannot tell the artefact from the real thing. The
    // fixture id can, and it is in the file.
    const seenFixtures = new Set();
    let duplicateRows = 0;

    for (const r of mergedGw) {
        const el = num(r.element);
        const gw = num(r.GW);
        if (gw > maxGw) maxGw = gw;

        const fixtureKey = `${el}:${num(r.fixture)}`;
        if (seenFixtures.has(fixtureKey)) { duplicateRows++; continue; }
        seenFixtures.add(fixtureKey);

        const minutes = num(r.minutes);
        if (minutes <= 0) {
            // Not an appearance, so it stays out of the log — every window and
            // rate the app computes is per match played, and a row for a match he
            // watched would drag all of them down. It can still carry points
            // though: a card shown to an unused substitute is a real -1 in his
            // season total. Kept here so the reconciliation below knows the log is
            // *meant* to be short by that much, rather than reporting it as drift.
            const benched = num(r.total_points);
            if (benched) {
                let acc = perPlayer.get(el);
                if (!acc) {
                    acc = { appearances: 0, defconHits: 0, defconEligible: 0, log: [], benchPoints: 0 };
                    perPlayer.set(el, acc);
                }
                acc.benchPoints += benched;
            }
            continue;
        }

        let acc = perPlayer.get(el);
        if (!acc) {
            acc = { appearances: 0, defconHits: 0, defconEligible: 0, log: [], benchPoints: 0 };
            perPlayer.set(el, acc);
        }
        acc.appearances++;

        const threshold = DEFCON_THRESHOLD[positionByElement.get(el)];
        let hitDefcon = 0;
        if (threshold !== null && threshold !== undefined) {
            acc.defconEligible++;
            if (num(r.defensive_contribution) >= threshold) { acc.defconHits++; hitDefcon = 1; }
        }

        // Flat per-appearance log, LOG_STRIDE values per appearance:
        // [gw, points, minutes, xGI(x100), defconHit, bps, saves, defCon,
        //  goals, assists, bonus].
        // Flat rather than objects because the key names would otherwise repeat
        // roughly 20,000 times. This is what powers the "last N matches"
        // window and the per-gameweek trend charts -- during a season, form
        // over recent matches matters far more than a season-long average, and
        // on draft day this file is the ONLY source of per-match history,
        // because the new season has not played a gameweek yet.
        acc.log.push(
            gw,
            num(r.total_points),
            minutes,
            Math.round(num(r.expected_goal_involvements) * 100),
            hitDefcon,
            num(r.bps),
            num(r.saves),
            num(r.defensive_contribution),
            num(r.goals_scored),
            num(r.assists),
            num(r.bonus)
        );
    }

    const players = playersRaw.map(p => {
        const id = num(p.id);
        const acc = perPlayer.get(id);
        const out = {
            id,
            // `code` is stable across seasons; `id` is reassigned every year.
            // Any cross-season join MUST use this.
            code: num(p.code),
            web_name: p.web_name,
            first_name: p.first_name,
            second_name: p.second_name,
            team: num(p.team),
            team_code: num(p.team_code),
            element_type: num(p.element_type)
        };
        for (const f of NUMERIC_FIELDS) out[f] = num(p[f]);

        out.appearances = acc ? acc.appearances : 0;
        out.defcon_hits = acc ? acc.defconHits : 0;
        out.defcon_eligible_apps = acc ? acc.defconEligible : 0;
        out.defcon_hit_rate = acc && acc.defconEligible > 0
            ? Math.round((acc.defconHits / acc.defconEligible) * 1000) / 10
            : null;
        return out;
    });

    // Players who never appeared carry no signal, and their absence is exactly
    // how the app should represent "no prior data" for promoted-team players
    // and new signings too — one consistent rule instead of zeros that would
    // sort them last and read as bad picks.
    const withMinutes = players.filter(p => p.minutes > 0);

    // Columnar layout: field names are written once instead of ~540 times.
    // Floats are rounded to 2dp; the source has no meaningful precision beyond that.
    const fields = Object.keys(withMinutes[0]);
    const round2 = v => (typeof v === 'number' && !Number.isInteger(v))
        ? Math.round(v * 100) / 100 : v;
    const rows = withMinutes.map(p => fields.map(f => round2(p[f])));
    // Per-appearance logs, keyed by player id. LOG_STRIDE fields per entry.
    const gwLogs = Object.fromEntries(
        withMinutes.map(p => [p.id, (perPlayer.get(p.id) || {}).log || []])
    );

    const snapshot = {
        seasonId: SEASON,
        // Generated-at is intentionally omitted: it would churn the committed
        // file on every rebuild without conveying anything the season id doesn't.
        source: 'vaastav/Fantasy-Premier-League',
        totalGameweeks: maxGw,
        teams,
        fields,
        rows,
        logStride: 11,
        logFields: ['gw', 'points', 'minutes', 'xgi_x100', 'defcon_hit', 'bps', 'saves',
            'defcon', 'goals', 'assists', 'bonus'],
        gwLogs
    };

    // Does each player's own match log add up to his own season row?
    //
    // Nothing checked this, which is how a player shipped with 27 points in his
    // log that his season total did not have. The two halves of this file come
    // from two different upstream files, and they are read by different parts of
    // the app — season totals by the table, the log by every window, rate and
    // trend — so a disagreement between them shows up as two panels quietly
    // contradicting each other with no error anywhere.
    //
    // The invariant is not "the log sums to the season total": the log holds
    // appearances, and points can be earned without one (see benchPoints above).
    // Getting that wrong reports a correct file as broken, which is its own way of
    // hiding the real thing.
    //
    // Reported rather than thrown. If upstream ever does publish two files that
    // disagree, refusing to build would leave the app with no snapshot at all —
    // far worse than a named discrepancy. Naming it is what stops the next one
    // being a mystery.
    const pAt = snapshot.logFields.indexOf('points');
    const mAt = snapshot.logFields.indexOf('minutes');
    const drift = [];
    for (const p of withMinutes) {
        const flat = gwLogs[p.id] || [];
        const benchPoints = (perPlayer.get(p.id) || {}).benchPoints || 0;
        let pts = 0, mins = 0;
        for (let i = 0; i < flat.length; i += snapshot.logStride) {
            pts += flat[i + pAt];
            mins += flat[i + mAt];
        }
        if (pts + benchPoints !== p.total_points || mins !== p.minutes) {
            drift.push(`${p.web_name}: row ${p.total_points}pts/${p.minutes}min,`
                + ` log ${pts}pts/${mins}min`
                + (benchPoints ? ` (+${benchPoints} off the bench)` : ''));
        }
    }

    mkdirSync(dirname(OUT), { recursive: true });
    const json = JSON.stringify(snapshot);
    writeFileSync(OUT, json);
    const kb = Math.round(Buffer.byteLength(json) / 1024);

    console.log(`\nWrote ${OUT}`);
    console.log(`  season ${SEASON}: ${maxGw} gameweeks, ${teams.length} teams`);
    console.log(`  players: ${players.length} (${withMinutes.length} with minutes)`);
    console.log(`  size: ${kb} KB`);

    const top = [...withMinutes].sort((a, b) => b.total_points - a.total_points).slice(0, 5);
    console.log('  top scorers:', top.map(p => `${p.web_name} ${p.total_points}`).join(', '));
    const defcon = withMinutes
        .filter(p => p.defcon_eligible_apps >= 15 && p.defcon_hit_rate !== null)
        .sort((a, b) => b.defcon_hit_rate - a.defcon_hit_rate).slice(0, 5);
    console.log('  best DEFCON hit-rate:', defcon.map(p => `${p.web_name} ${p.defcon_hit_rate}%`).join(', '));

    console.log(`  duplicate fixture rows skipped: ${duplicateRows}`);
    if (drift.length) {
        console.log(`  ⚠️ ${drift.length} of ${withMinutes.length} players: log does not sum to the season row`);
        drift.forEach(d => console.log(`      ${d}`));
    } else {
        console.log(`  ✓ all ${withMinutes.length} match logs sum to their season rows`);
    }
}

main().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
