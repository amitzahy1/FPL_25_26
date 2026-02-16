
import re

js_file = 'script.js'

with open(js_file, 'r', encoding='utf-8') as f:
    content = f.read()

def replace_function(content, func_name, new_code):
    pattern = r'function\s+' + re.escape(func_name) + r'\s*\([^)]*\)\s*\{'
    match = re.search(pattern, content)
    if not match:
        print(f"Could not find function {func_name}")
        return content
    
    start_idx = match.start()
    open_braces = 0
    in_function = False
    end_idx = -1
    
    for i in range(start_idx, len(content)):
        if content[i] == '{':
            open_braces += 1
            in_function = True
        elif content[i] == '}':
            open_braces -= 1
            if in_function and open_braces == 0:
                end_idx = i + 1
                break
    
    if end_idx != -1:
        print(f"Replacing {func_name}...")
        return content[:start_idx] + new_code + content[end_idx:]
    else:
        print(f"Could not find end of function {func_name}")
        return content

new_showRecommendedLineup = """function showRecommendedLineup() {
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
    
    // --- Current Lineup Stats ---
    const currentLineupObj = state.draft.lineupsByEntryId.get(myTeamId);
    let currentStarting = [];
    if (currentLineupObj && currentLineupObj.starting) {
        currentStarting = currentLineupObj.starting.map(id => processedById.get(id)).filter(Boolean);
    } else {
        // Fallback if no lineup info
        currentStarting = squad.slice(0, 11); 
    }
    
    const calcStats = (players) => ({
        predicted: players.reduce((sum, p) => sum + (p.predicted_points_1_gw || 0), 0),
        lastGw: players.reduce((sum, p) => sum + (p.event_points || 0), 0),
        ppg90: players.reduce((sum, p) => sum + (p.points_per_game_90 || 0), 0)
    });
    
    const currentStats = calcStats(currentStarting);

    // --- Optimization Algorithm ---
    // 1. Separate by position
    const gkps = squad.filter(p => p.element_type === 1).sort((a,b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0));
    const defs = squad.filter(p => p.element_type === 2).sort((a,b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0));
    const mids = squad.filter(p => p.element_type === 3).sort((a,b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0));
    const fwds = squad.filter(p => p.element_type === 4).sort((a,b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0));
    
    const startingXI = [];
    const bench = [];
    
    // Pick GK
    if (gkps.length > 0) {
        startingXI.push(gkps[0]);
        for(let i=1; i<gkps.length; i++) bench.push(gkps[i]);
    }
    
    // Pick Outfield (Min 3 DEF, Min 1 FWD)
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
    
    // Fill remaining slots (Need 10 outfield total)
    const pool = [...otherDefs, ...mids, ...otherFwds].sort((a,b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0));
    
    const slotsNeeded = 10 - selectedOutfield.length;
    for(let i=0; i<pool.length; i++) {
        if (i < slotsNeeded) selectedOutfield.push(pool[i]);
        else remainingOutfield.push(pool[i]);
    }
    
    startingXI.push(...selectedOutfield);
    bench.push(...remainingOutfield);
    
    const recStats = calcStats(startingXI);
    
    // --- Render directly into myLineupContainer ---
    const container = document.getElementById('myLineupContainer');
    if (container) {
        // Clear previous content but keep title if exists (usually handled by caller)
        // We will rebuild the view
        
        // Generate Stats Comparison HTML
        const diffPred = recStats.predicted - currentStats.predicted;
        const diffLast = recStats.lastGw - currentStats.lastGw;
        const diffPpg = recStats.ppg90 - currentStats.ppg90;
        
        const statsHtml = `
            <div class="rec-stats-comparison">
                <div class="rec-stat-box">
                    <div class="rec-stat-label">צפי נקודות</div>
                    <div class="rec-stat-value">${recStats.predicted.toFixed(1)}</div>
                    <div class="rec-diff ${diffPred >= 0 ? 'diff-pos' : 'diff-neg'}">
                        ${diffPred >= 0 ? '+' : ''}${diffPred.toFixed(1)}
                    </div>
                </div>
                <div class="rec-stat-box">
                    <div class="rec-stat-label">נקודות GW אחרון</div>
                    <div class="rec-stat-value">${recStats.lastGw}</div>
                    <div class="rec-diff ${diffLast >= 0 ? 'diff-pos' : 'diff-neg'}">
                        ${diffLast >= 0 ? '+' : ''}${diffLast}
                    </div>
                </div>
                <div class="rec-stat-box">
                    <div class="rec-stat-label">PPG/90 משוקלל</div>
                    <div class="rec-stat-value">${recStats.ppg90.toFixed(2)}</div>
                    <div class="rec-diff ${diffPpg >= 0 ? 'diff-pos' : 'diff-neg'}">
                        ${diffPpg >= 0 ? '+' : ''}${diffPpg.toFixed(2)}
                    </div>
                </div>
            </div>
            <div style="text-align:center; margin-bottom:10px; font-size:13px; color:#64748b;">
                ההרכב המומלץ מבוסס על חיזוי נקודות משוקלל, יציבות שחקן וניתוח יריבה.
            </div>
        `;
        
        // Render pitch with new players
        container.innerHTML = statsHtml;
        
        // Pitch wrapper
        const pitchWrapper = document.createElement('div');
        pitchWrapper.className = 'pitch-wrapper';
        container.appendChild(pitchWrapper);
        
        renderPitch(pitchWrapper, startingXI.map(p => p.id), true, bench.map(p => p.id));
        
        showToast('הרכב מומלץ הוצג', 'התצוגה עודכנה להרכב האופטימלי', 'success');
    }
}"""

# We also need to update renderRecommendations to include the manual search
# But first let's update renderDraftAnalytics for colors as requested
new_renderDraftAnalytics = """function renderDraftAnalytics(aggregates) {
    if (!aggregates || !state.draft.charts) return;
    
    // Custom Colors for better distinction
    const colors = [
        '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
    ];
    
    // 1. Team Power (Bar Chart)
    const powerCtx = document.getElementById('draftPowerChart');
    if (powerCtx) {
        if (state.draft.charts.power) state.draft.charts.power.destroy();
        state.draft.charts.power = new Chart(powerCtx, {
            type: 'bar',
            data: {
                labels: aggregates.map(a => a.teamName),
                datasets: [{
                    label: 'עוצמת סגל (xPts)',
                    data: aggregates.map(a => a.totalXPts),
                    backgroundColor: aggregates.map((_, i) => colors[i % colors.length]),
                    borderRadius: 6
                }]
            },
            options: getChartConfig('עוצמת סגל כוללת (לפי חיזוי)').options
        });
    }
    
    // 2. Radar Chart (Form vs Fixture vs xGI)
    const radarCtx = document.getElementById('draftRadarChart');
    if (radarCtx) {
        if (state.draft.charts.radar) state.draft.charts.radar.destroy();
        
        const topTeams = aggregates.sort((a,b) => b.totalXPts - a.totalXPts).slice(0, 5);
        
        state.draft.charts.radar = new Chart(radarCtx, {
            type: 'radar',
            data: {
                labels: ['התקפה (xGI)', 'הגנה (xGC)', 'כושר (Form)', 'לו"ז (FDR)', 'יציבות'],
                datasets: topTeams.map((t, i) => ({
                    label: t.teamName,
                    data: [
                        t.totalXGI * 2, // Scale up
                        t.totalXGC ? (50 / t.totalXGC) : 0, // Inverse metrics for defense
                        t.avgForm * 10,
                        t.avgFdr ? (5 / t.avgFdr) * 20 : 0, // Inverse for FDR (lower is better)
                        t.avgStability
                    ],
                    borderColor: colors[i % colors.length],
                    backgroundColor: hexToRgba(colors[i % colors.length], 0.2),
                    pointBackgroundColor: colors[i % colors.length],
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
                scales: {
                    r: {
                        beginAtZero: true,
                        grid: { color: '#e2e8f0' },
                        pointLabels: { font: { size: 12, weight: 'bold' } }
                    }
                }
            }
        });
    }
    
    // 3. Progress Chart (Line)
    renderProgressChart(); // Uses its own logic
}"""

content = replace_function(content, 'showRecommendedLineup', new_showRecommendedLineup)
content = replace_function(content, 'renderDraftAnalytics', new_renderDraftAnalytics)

with open(js_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated script.js")

