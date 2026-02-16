
import re

js_file = 'script.js'

with open(js_file, 'r', encoding='utf-8') as f:
    content = f.read()

def replace_function(content, func_name, new_code):
    # Pattern to find function and its arguments
    pattern = r'function\s+' + re.escape(func_name) + r'\s*\(([^)]*)\)\s*\{'
    match = re.search(pattern, content)
    if not match:
        print(f"Could not find function {func_name}")
        return content
    
    start_idx = match.start()
    
    # Find the matching closing brace
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

# 1. Update renderMatrixChart to use filtered data
new_renderMatrixChart = """function renderMatrixChart(positionType, canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    // Map position type to Element Type ID
    const typeMap = { 'goalkeepers': 1, 'defenders': 2, 'midfielders': 3, 'forwards': 4 };
    const typeId = typeMap[positionType];
    
    // Use state.displayedData to respect filters, fallback to full data if empty (initial load)
    const sourceData = (state.displayedData && state.displayedData.length > 0) ? state.displayedData : getProcessedPlayers();
    
    const players = sourceData.filter(p => p.element_type === typeId && p.minutes > 0);
    
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
             if (state.draft && state.draft.ownedElementIds && state.draft.ownedElementIds.has(context.raw.id)) {
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
}"""

# 2. Update renderPriceVsScoreChart to use filtered data
new_renderPriceVsScoreChart = """function renderPriceVsScoreChart(canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    // Use state.displayedData to respect filters, fallback to full data if empty
    const sourceData = (state.displayedData && state.displayedData.length > 0) ? state.displayedData : getProcessedPlayers();

    const players = sourceData.filter(p => p.selected_by_percent > 0); // Removed restrictive > 2 filter to show more data
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
}"""

# 3. Update renderIctBreakdownChart to use filtered data
new_renderIctBreakdownChart = """function renderIctBreakdownChart(canvasId) {
   const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    // Use state.displayedData to respect filters, fallback to full data if empty
    const sourceData = (state.displayedData && state.displayedData.length > 0) ? state.displayedData : getProcessedPlayers();

    const players = sourceData.filter(p => p.ict_index > 0); // Removed restrictive > 50 filter
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
}"""

content = replace_function(content, 'renderMatrixChart', new_renderMatrixChart)
content = replace_function(content, 'renderPriceVsScoreChart', new_renderPriceVsScoreChart)
content = replace_function(content, 'renderIctBreakdownChart', new_renderIctBreakdownChart)

with open(js_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated chart rendering functions to use state.displayedData (respecting filters)")

