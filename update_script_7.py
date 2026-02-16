
js_file = 'script.js'

# Chart functions to be restored
chart_funcs = """
function renderMatrixChart(positionType, canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    // Map position type to Element Type ID
    const typeMap = { 'goalkeepers': 1, 'defenders': 2, 'midfielders': 3, 'forwards': 4 };
    const typeId = typeMap[positionType];
    
    const players = getProcessedPlayers().filter(p => p.element_type === typeId && p.minutes > 0);
    
    if (players.length < 2) {
        showNoData(ctx, 'אין מספיק נתונים להצגה');
        return;
    }
    
    // Get Config
    const spec = config.visualizationSpecs[positionType];
    const chartConfig = getChartConfig(
        players, 
        spec.xKey, 
        spec.yKey, 
        spec.xLabel, 
        spec.yLabel, 
        spec.quadrants,
        (context) => { // Color Function
             if (!context.raw) return 'rgba(156, 163, 175, 0.7)';
             // Highlight My Team
             if (state.draft.ownedElementIds.has(context.raw.id)) {
                 if (state.draft.myTeamId && state.draft.rostersByEntryId.get(state.draft.myTeamId)?.includes(context.raw.id)) {
                     return '#8b5cf6'; // Purple for MY player
                 }
                 return '#ef4444'; // Red for Owned by others
             }
             return 'rgba(156, 163, 175, 0.7)'; // Grey for Free Agents
        }
    );
    
    if (charts.dashboard[canvasId]) charts.dashboard[canvasId].destroy();
    charts.dashboard[canvasId] = new Chart(ctx, chartConfig);
}

function renderTeamAttackChart(canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    const teams = calculateTeamAggregates(); 
    if (teams.length < 2) {
         showNoData(ctx, 'אין מספיק נתונים');
         return;
    }

    const chartConfig = getChartConfig(
        teams,
        'xGI',
        'goals',
        'צפי מעורבות שערים (xGI)',
        'שערים בפועל',
        { topRight: 'יעילים', topLeft: 'מבקיעים', bottomRight: 'יוצרים', bottomLeft: 'חלשים' }
    );
    
    if (charts.dashboard[canvasId]) charts.dashboard[canvasId].destroy();
    charts.dashboard[canvasId] = new Chart(ctx, chartConfig);
}

function renderTeamDefenseChart(canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    const teams = calculateTeamAggregates();
    if (teams.length < 2) {
         showNoData(ctx, 'אין מספיק נתונים');
         return;
    }

    const chartConfig = getChartConfig(
        teams,
        'xGC',
        'conceded',
        'צפי ספיגה (xGC)',
        'ספיגות בפועל',
        { topRight: 'חדירים', topLeft: 'סופגים', bottomRight: 'מזליסטים', bottomLeft: 'חזקים' }
    );
    
    if (charts.dashboard[canvasId]) charts.dashboard[canvasId].destroy();
    charts.dashboard[canvasId] = new Chart(ctx, chartConfig);
}

function renderPriceVsScoreChart(canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    const players = getProcessedPlayers().filter(p => p.selected_by_percent > 2); // Filter low ownership
    if (players.length < 5) {
         showNoData(ctx, 'אין מספיק נתונים');
         return;
    }

    const chartConfig = getChartConfig(
        players,
        'selected_by_percent',
        'total_points',
        'אחוז בחירה (%)',
        'סך נקודות',
        { topRight: 'פופולריים וטובים', topLeft: 'הפתעות', bottomRight: 'אכזבות', bottomLeft: 'לא רלוונטיים' }
    );
    
    if (charts.dashboard[canvasId]) charts.dashboard[canvasId].destroy();
    charts.dashboard[canvasId] = new Chart(ctx, chartConfig);
}

function renderIctBreakdownChart(canvasId) {
   const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    const players = getProcessedPlayers().filter(p => p.ict_index > 50);
     if (players.length < 5) {
         showNoData(ctx, 'אין מספיק נתונים');
         return;
    }

    const chartConfig = getChartConfig(
        players,
        'influence',
        'creativity',
        'השפעה (Influence)',
        'יצירתיות (Creativity)',
        { topRight: 'מנהלי משחק', topLeft: 'יצירתיים', bottomRight: 'משפיעים', bottomLeft: 'בינוניים' }
    );
    
    if (charts.dashboard[canvasId]) charts.dashboard[canvasId].destroy();
    charts.dashboard[canvasId] = new Chart(ctx, chartConfig);
}

function showNoData(canvas, msg) {
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px Segoe UI';
    ctx.fillText(msg, canvas.width / 2, canvas.height / 2);
    ctx.restore();
}

function calculateTeamAggregates() {
    const players = getProcessedPlayers();
    const teamMap = {};
    
    players.forEach(p => {
        if (!teamMap[p.team_name]) {
            teamMap[p.team_name] = { team: p.team_name, xGI: 0, goals: 0, xGC: 0, conceded: 0, count: 0 };
        }
        teamMap[p.team_name].xGI += (parseFloat(p.expected_goal_involvements) || 0);
        teamMap[p.team_name].goals += ((p.goals_scored || 0) + (p.assists || 0));
        
        if (p.element_type === 1 || p.element_type === 2) {
             teamMap[p.team_name].conceded += (p.goals_conceded || 0);
             teamMap[p.team_name].xGC += (parseFloat(p.expected_goals_conceded) || 0);
        }
    });
    
    return Object.values(teamMap);
}
"""

# Read content
with open(js_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the spot before switchMainView to insert functions
insert_point = content.find('function switchMainView(view)')

if insert_point != -1:
    new_content = content[:insert_point] + chart_funcs + "\n\n" + content[insert_point:]
    with open(js_file, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Restored chart functions to script.js")
else:
    print("Could not find insertion point")

