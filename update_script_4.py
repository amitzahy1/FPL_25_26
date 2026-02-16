
import re

js_file = 'script.js'

with open(js_file, 'r', encoding='utf-8') as f:
    content = f.read()

# New functions to append
new_functions = """
function getProcessedPlayers() {
    if (state.currentDataSource === 'demo') {
        return state.allPlayersData.demo?.processed || [];
    }
    return state.allPlayersData[state.currentDataSource]?.processed || [];
}

function getBestReplacements(playerToReplace, allPlayers, count) {
    const type = playerToReplace.element_type;
    
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

    const enrichPlayerLocal = (p) => {
        const transfersIn = parseInt(p.transfers_in_event || 0);
        const transfersOut = parseInt(p.transfers_out_event || 0);
        return { ...p, smart_score: calculateSmartScoreLocal(p), transfers_balance: transfersIn - transfersOut };
    };

    const freeAgents = allPlayers.filter(p => !state.draft.ownedElementIds.has(p.id));
    const freeAgentsEnriched = freeAgents.map(enrichPlayerLocal);

    return freeAgentsEnriched
        .filter(p => p.element_type === type && p.minutes > 0)
        .sort((a, b) => b.smart_score - a.smart_score)
        .slice(0, count);
}

function renderAutoRecommendationsTables(container, recommendationData) {
    const tablesContainer = document.createElement('div');
    tablesContainer.className = 'recs-grid-tables';
    const posNames = { 'GKP': '🧤 שוער', 'DEF': '🛡️ מגן', 'MID': '⚙️ קשר', 'FWD': '⚽ חלוץ' };
    
    const getRecommendationReason = (candidate) => {
        const reasons = [];
        if (candidate.minutes < 270 && candidate.selected_by_percent > 30 && candidate.draft_score > 70) reasons.push('🔥 חוזר');
        else if (candidate.minutes < 180 && candidate.selected_by_percent > 20 && candidate.draft_score > 60) reasons.push('⚡ חוזר');
        if (candidate.transfers_balance > 50) reasons.push('📈 גבוה');
        else if (candidate.transfers_balance > 20) reasons.push('📈 עולה');
        if (candidate.predicted_points_1_gw > 6) reasons.push('⚽ תחזית');
        if (parseFloat(candidate.form) > 5) reasons.push('💪 כושר');
        if (candidate.draft_score > 85) reasons.push('⭐ עלית');
        return reasons.length > 0 ? reasons.join(' • ') : 'איכותי';
    };

    Object.entries(recommendationData).forEach(([key, { player, candidates, position }]) => {
        if (candidates.length === 0) return;
        const allInvolved = [player, ...candidates];
        const metrics = config.recommendationMetrics;
        
        let tableHTML = `
            <div class="rec-card">
                <div class="rec-header">
                    <h4>${player.web_name}</h4>
                    <p class="rec-subtitle">${posNames[position] || position} • ציון: ${player.smart_score ? player.smart_score.toFixed(1) : 'N/A'}</p>
                </div>
                <table class="rec-table">
                    <thead>
                        <tr>
                            <th style="width: 20%;">מדד</th>
                            <th style="width: 20%;">נוכחי</th>
                            <th style="width: 20%;">#1</th>
                            <th style="width: 20%;">#2</th>
                            <th style="width: 20%;">#3</th>
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
                            ${candidates.map(c => `<td class="rec-reason">${getRecommendationReason(c)}</td>`).join('')}
                        </tr>`;
        
        Object.entries(metrics).forEach(([name, {key, format}]) => {
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
                if (val === bestValue && bestValue !== worstValue) cellClass = 'rec-best';
                else if (val === worstValue && bestValue !== worstValue) cellClass = 'rec-worst';
                tableHTML += `<td class="${cellClass}">${format(val)}</td>`;
            });
            tableHTML += `</tr>`;
        });
        tableHTML += `</tbody></table></div>`;
        tablesContainer.innerHTML += tableHTML;
    });
    container.appendChild(tablesContainer);
}

function handleManualPlayerSelect() {
    const name = document.getElementById('manualPlayerSearch').value;
    if (!name) {
        showToast('שגיאה', 'אנא בחר שחקן', 'error');
        return;
    }
    
    const allPlayers = getProcessedPlayers();
    const player = allPlayers.find(p => p.web_name === name || p.first_name + ' ' + p.second_name === name);
    
    if (!player) {
        showToast('שגיאה', 'שחקן לא נמצא', 'error');
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
    
    const candidates = getBestReplacements(player, allPlayers, 3);
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
}
"""

# Replacement for renderRecommendations
new_renderRecommendations = """function renderRecommendations() {
    const container = document.getElementById('draftRecommendations');
    if (!container) return;
    container.innerHTML = '';

    // --- Manual Recommendation Section ---
    const manualSection = document.createElement('div');
    manualSection.className = 'manual-recommendation-section';
    manualSection.innerHTML = `
        <div class="manual-rec-controls">
            <h3>🔎 חיפוש שחקן ספציפי</h3>
            <div class="manual-rec-input-group">
                <input type="text" id="manualPlayerSearch" placeholder="הקלד שם שחקן..." list="allPlayersList">
                <datalist id="allPlayersList"></datalist>
                <button class="btn-primary" onclick="handleManualPlayerSelect()">קבל המלצות</button>
            </div>
        </div>
        <div id="manualRecResults" class="manual-rec-results"></div>
    `;
    container.appendChild(manualSection);
    
    const dataList = manualSection.querySelector('#allPlayersList');
    const allPlayers = getProcessedPlayers();
    // Sort alphabetically
    allPlayers.sort((a,b) => a.web_name.localeCompare(b.web_name)).forEach(p => {
        const option = document.createElement('option');
        option.value = p.web_name;
        dataList.appendChild(option);
    });

    // --- Auto Recommendations ---
    const autoSection = document.createElement('div');
    autoSection.className = 'auto-recommendations-section';
    autoSection.innerHTML = `<h3>💡 המלצות אוטומטיות לקבוצה שלך</h3>`;
    
    const recommendationData = getRecommendationData();
    if (!recommendationData || Object.keys(recommendationData).length === 0) {
        autoSection.innerHTML += '<p style="text-align:center; padding: 20px;">🎉 כל השחקנים שלך מצוינים! אין המלצות להחלפה כרגע.</p>';
    } else {
        renderAutoRecommendationsTables(autoSection, recommendationData);
    }
    
    container.appendChild(autoSection);
}"""

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

content = replace_function(content, 'renderRecommendations', new_renderRecommendations)

# Append new functions to the end of the file
content += "\\n\\n" + new_functions

with open(js_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated script.js with manual recommendations")

