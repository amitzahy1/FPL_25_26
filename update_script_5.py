
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

# --- New Function Codes ---

new_updateMyLineup = """function updateMyLineup(entryId) {
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

    // Check if we have lineup info (starting/bench)
    const lineup = state.draft.lineupsByEntryId.get(parseInt(entryId));
    const roster = state.draft.rostersByEntryId.get(parseInt(entryId));
    
    const pitchWrapper = document.createElement('div');
    pitchWrapper.className = 'pitch-wrapper';
    
    if (lineup && lineup.starting && lineup.starting.length > 0) {
        // We have detailed lineup info (starting XI + Bench)
        renderPitch(pitchWrapper, lineup.starting, true, lineup.bench);
    } else if (roster && roster.length > 0) {
        // Fallback to just roster
        renderPitch(pitchWrapper, roster, true);
    } else {
        pitchWrapper.innerHTML = '<div class="alert alert-info">לא נמצא הרכב לקבוצה זו.</div>';
    }
    container.appendChild(pitchWrapper);
}"""

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
        currentStarting = squad.slice(0, 11); 
    }
    
    const calcStats = (players) => ({
        predicted: players.reduce((sum, p) => sum + (p.predicted_points_1_gw || 0), 0),
        lastGw: players.reduce((sum, p) => sum + (p.event_points || 0), 0),
        ppg90: players.reduce((sum, p) => sum + (p.points_per_game_90 || 0), 0)
    });
    
    const currentStats = calcStats(currentStarting);

    // --- Optimization Algorithm ---
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
    
    // Fill remaining slots
    const pool = [...otherDefs, ...mids, ...otherFwds].sort((a,b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0));
    const slotsNeeded = 10 - selectedOutfield.length;
    for(let i=0; i<pool.length; i++) {
        if (i < slotsNeeded) selectedOutfield.push(pool[i]);
        else remainingOutfield.push(pool[i]);
    }
    
    startingXI.push(...selectedOutfield);
    bench.push(...remainingOutfield);
    
    const recStats = calcStats(startingXI);
    
    const container = document.getElementById('myLineupContainer');
    if (container) {
        container.innerHTML = '';

        // Create Lineup Controls (Toggles) - Set Recommended as Active
        const controls = document.createElement('div');
        controls.className = 'draft-lineup-controls';
        controls.innerHTML = `
            <div class="lineup-toggles">
                <button id="btnShowMyLineup" class="lineup-toggle" onclick="updateMyLineup('${myTeamId}')">ההרכב שלי</button>
                <button id="btnShowRecLineup" class="lineup-toggle active" onclick="showRecommendedLineup()">הרכב מומלץ</button>
            </div>
        `;
        container.appendChild(controls);

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
            <div class="rec-tooltip-container" title="ההרכב המומלץ מבוסס על שקלול של חיזוי נקודות (ML + הוריסטי), יציבות שחקן לאורך זמן וניתוח קושי היריבה במחזור הקרוב.">
                ℹ️ איך זה מחושב?
            </div>
        `;
        
        // Insert stats after controls
        const statsDiv = document.createElement('div');
        statsDiv.innerHTML = statsHtml;
        container.appendChild(statsDiv);
        
        const pitchWrapper = document.createElement('div');
        pitchWrapper.className = 'pitch-wrapper';
        container.appendChild(pitchWrapper);
        
        renderPitch(pitchWrapper, startingXI.map(p => p.id), true, bench.map(p => p.id));
        
        showToast('הרכב מומלץ הוצג', 'התצוגה עודכנה להרכב האופטימלי', 'success');
    }
}"""

new_handleManualPlayerSelect = """function handleManualPlayerSelect() {
    const name = document.getElementById('manualPlayerSearch').value;
    if (!name) {
        showToast('שגיאה', 'אנא בחר שחקן', 'error');
        return;
    }
    
    let allPlayers = [];
    const myTeamId = state.draft.myTeamId;
    
    if (myTeamId) {
        // Filter to My Team Only
        const rosterIds = state.draft.rostersByEntryId.get(parseInt(myTeamId)) || [];
        const processedById = getProcessedByElementId();
        allPlayers = rosterIds.map(id => processedById.get(id)).filter(Boolean);
    } else {
        // Fallback to all players if no team selected
        allPlayers = getProcessedPlayers();
    }

    const player = allPlayers.find(p => p.web_name === name || p.first_name + ' ' + p.second_name === name);
    
    if (!player) {
        showToast('שגיאה', 'שחקן לא נמצא בקבוצה שלך', 'error');
        return;
    }
    
    // Calculate smart score for selected player too (for display)
    const calculateSmartScoreLocal = (p) => {
        if (!p) return 0;
        const xPts1GW = (p.predicted_points_1_gw || 0) * 10; 
        const draftScore = (p.draft_score || 0); 
        const form = parseFloat(p.form || 0) * 10; 
        const transfersIn = parseInt(p.transfers_in_event || 0);
        const transfersOut = parseInt(p.transfers_out_event || 0);
        const transfersBalance = transfersIn - transfersOut;
        const transfersScore = Math.max(0, Math.min(100, transfersBalance * 2 + 50));
        const ownership = parseFloat(p.selected_by_percent || 0);
        const ownershipScore = Math.min(100, ownership * 2);
        let comebackBonus = 0;
        const minutes = p.minutes || 0;
        if (minutes < 270 && ownership > 30 && draftScore > 70) comebackBonus = 20;
        else if (minutes < 180 && ownership > 20 && draftScore > 60) comebackBonus = 10;
        return (xPts1GW * 0.30) + (draftScore * 0.25) + (form * 0.15) + (transfersScore * 0.20) + (ownershipScore * 0.10) + comebackBonus;
    };
    
    player.smart_score = calculateSmartScoreLocal(player);
    
    // Get Replacements from FREE AGENTS (Global Pool)
    const allGlobalPlayers = getProcessedPlayers();
    const candidates = getBestReplacements(player, allGlobalPlayers, 3);
    
    const resultsContainer = document.getElementById('manualRecResults');
    resultsContainer.innerHTML = '';
    
    const dummyData = {};
    const posMap = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
    dummyData[player.id] = { player, candidates, position: posMap[player.element_type] };
    
    const tempContainer = document.createElement('div');
    
    // Temporarily override metrics
    const originalMetrics = { ...config.recommendationMetrics };
    config.recommendationMetrics = {
        ...originalMetrics,
        'xGI/90': { key: 'expected_goal_involvements_per_90', format: v => parseFloat(v).toFixed(2) },
        'PPG/90': { key: 'points_per_game_90', format: v => parseFloat(v).toFixed(2) },
        'DC/90': { key: 'def_contrib_per90', format: v => parseFloat(v).toFixed(2) }
    };
    
    renderAutoRecommendationsTables(tempContainer, dummyData);
    config.recommendationMetrics = originalMetrics;
    
    resultsContainer.appendChild(tempContainer);
}"""

new_renderDraftAnalytics = """function renderDraftAnalytics(aggregates) {
    if (!aggregates || aggregates.length === 0) {
        const host = document.getElementById('draftAnalytics');
        if (host) host.innerHTML = '<p style="text-align:center; padding:30px; color:#64748b;">אין נתונים זמינים לאנליטיקה (ייתכן שהליגה חדשה או שיש בעיית חיבור)</p>';
        return;
    }
    
    if (!state.draft.charts) return;
    
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
                        grid: { color: '#e2e8f0' },
                        pointLabels: { font: { size: 12, weight: 'bold' } }
                    }
                }
            }
        });
    }
    
    // 3. Progress Chart (Line)
    renderProgressChart(); 
}"""

# Apply replacements
content = replace_function(content, 'updateMyLineup', new_updateMyLineup)
content = replace_function(content, 'showRecommendedLineup', new_showRecommendedLineup)
content = replace_function(content, 'handleManualPlayerSelect', new_handleManualPlayerSelect)
content = replace_function(content, 'renderDraftAnalytics', new_renderDraftAnalytics)

# Fix renderRecommendations manual search list population
# Find: const allPlayers = getProcessedPlayers();
# Replace with dynamic population based on myTeamId
manual_list_logic = """
    const dataList = manualSection.querySelector('#allPlayersList');
    
    let playersForSearch = [];
    if (state.draft.myTeamId) {
        const rosterIds = state.draft.rostersByEntryId.get(parseInt(state.draft.myTeamId)) || [];
        const processedById = getProcessedByElementId();
        playersForSearch = rosterIds.map(id => processedById.get(id)).filter(Boolean);
    } else {
        playersForSearch = getProcessedPlayers();
    }

    // Sort alphabetically
    playersForSearch.sort((a,b) => a.web_name.localeCompare(b.web_name)).forEach(p => {
        const option = document.createElement('option');
        option.value = p.web_name;
        dataList.appendChild(option);
    });
"""

# Regex to find the specific block in renderRecommendations
block_pattern = r'const dataList = manualSection.querySelector\(\'#allPlayersList\'\);\s+const allPlayers = getProcessedPlayers\(\);\s+// Sort alphabetically\s+allPlayers.sort\(\(a,b\) => a.web_name.localeCompare\(b.web_name\)\).forEach\(p => \{\s+const option = document.createElement\(\'option\'\);\s+option.value = p.web_name;\s+dataList.appendChild\(option\);\s+\}\);'

match = re.search(block_pattern, content)
if match:
    print("Replacing manual search list population logic...")
    content = content[:match.start()] + manual_list_logic + content[match.end():]
else:
    print("Could not find manual search list population logic")

with open(js_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated script.js with feature requests")

