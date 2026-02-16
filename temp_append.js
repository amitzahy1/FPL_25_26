
// ============================================
// MY TEAM SELECTOR (Added)
// ============================================
function populateMyTeamSelector() {
    const select = document.getElementById('myTeamSelect');
    if (!select) return;
    
    // Clear existing
    select.innerHTML = '<option value="">-- בחר קבוצה --</option>';
    
    // Get league entries
    const entries = state.draft.details?.league_entries || [];
    
    entries.forEach(entry => {
        if (!entry.entry_name) return;
        const option = document.createElement('option');
        option.value = entry.id;
        option.textContent = `${entry.player_first_name} ${entry.player_last_name} (${entry.entry_name})`;
        select.appendChild(option);
    });
    
    // Set current value if exists
    if (state.draft.myTeamId) {
        select.value = state.draft.myTeamId;
    }
}

function setMyTeam(teamId) {
    if (!teamId) return;
    
    state.draft.myTeamId = parseInt(teamId);
    
    // Save to local storage for persistence
    localStorage.setItem('draft_my_team_id', teamId);
    
    // Update UI components that depend on My Team
    renderMyLineup(teamId);
    renderRecommendations();
    renderNextRivalAnalysis(); // Update Rival Analysis
    
    // Update Chart Highlight
    renderAllTeamsTrendChart(null, 'cumulative', teamId);
    
    showToast('הקבוצה עודכנה', 'הנתונים וההמלצות עודכנו בהתאם לקבוצה שנבחרה', 'success');
}

// ============================================
// RIVAL ANALYSIS & SQUAD COMPARISON
// ============================================
function getNextOpponent(myEntryId) {
    const details = state.draft.details;
    if (!details || !details.matches) return null;

    const currentEvent = details.league.current_event; 
    
    // 1. Try Current Event Match (Exact Match)
    let nextMatch = details.matches.find(m => 
        m.event === currentEvent && 
        (m.league_entry_1 === myEntryId || m.league_entry_2 === myEntryId)
    );

    // 2. If not found, try Next Event Match (Current + 1)
    if (!nextMatch) {
        nextMatch = details.matches.find(m => 
            m.event === currentEvent + 1 && 
            (m.league_entry_1 === myEntryId || m.league_entry_2 === myEntryId)
        );
    }
    
    // 3. Fallback: Find first unfinished/future match (Event >= Current)
    if (!nextMatch) {
         const futureMatches = details.matches.filter(m => 
            m.event >= currentEvent && 
            (m.league_entry_1 === myEntryId || m.league_entry_2 === myEntryId)
         ).sort((a,b) => a.event - b.event);
         
         if (futureMatches.length > 0) nextMatch = futureMatches[0];
    }

    if (!nextMatch) return null;

    const isEntry1 = nextMatch.league_entry_1 === myEntryId;
    const opponentId = isEntry1 ? nextMatch.league_entry_2 : nextMatch.league_entry_1;
    
    return {
        match: nextMatch,
        opponentId: opponentId,
        opponentName: state.draft.entryIdToTeamName.get(opponentId) || 'Unknown',
        isHome: isEntry1 
    };
}

function renderNextRivalAnalysis() {
    const container = document.getElementById('rivalAnalysisContainer');
    if (!container) return;
    
    // Initial Loading State
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;"><div class="spinner"></div> מחשב סיכויים ומנתח הרכבים...</div>';

    try {
        const myTeam = findMyTeam();
        if (!myTeam) {
            container.innerHTML = '<div class="alert alert-warning">לא נבחרה קבוצה. אנא בחר את הקבוצה שלך בתפריט ההגדרות.</div>';
            return;
        }

        const opponentData = getNextOpponent(myTeam.id);
        
        // Handle "No Match Found" cleanly
        if (!opponentData) {
            container.innerHTML = `
                <div class="alert alert-info" style="text-align:center; padding:30px; border: 2px dashed #cbd5e1; border-radius: 12px; background: #f8fafc;">
                    <div style="font-size:40px; margin-bottom:10px;">🏖️</div>
                    <h3 style="margin:0; color:#475569;">אין משחקים קרובים</h3>
                    <p style="margin:5px 0 0; color:#64748b;">העונה הסתיימה או שאין משחקים מתוכננים בלוח השנה.</p>
                </div>`;
            return;
        }

        // Get Squads
        const myRosterIds = state.draft.rostersByEntryId.get(myTeam.id) || [];
        const oppRosterIds = state.draft.rostersByEntryId.get(opponentData.opponentId) || [];
        
        const processedById = getProcessedByElementId();
        const mySquad = myRosterIds.map(id => processedById.get(id)).filter(Boolean);
        const oppSquad = oppRosterIds.map(id => processedById.get(id)).filter(Boolean);

        // Helper: Calculate Stats
        const calcStats = (squad) => {
            const totalXPts = squad.reduce((sum, p) => sum + (parseFloat(p.predicted_points_1_gw) || 0), 0);
            const totalXGI = squad.reduce((sum, p) => sum + (parseFloat(p.expected_goal_involvements) || 0), 0);
            const totalForm = squad.reduce((sum, p) => sum + (parseFloat(p.form) || 0), 0);
            return { xPts: totalXPts, xGI: totalXGI, form: totalForm };
        };

        const myStats = calcStats(mySquad);
        const oppStats = calcStats(oppSquad);
        
        // Prevent division by zero for charts
        const formTotal = (myStats.form + oppStats.form) || 1;
        const xgiTotal = (myStats.xGI + oppStats.xGI) || 1;

        // Build HTML
        let html = `
            <div class="rival-header" style="display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 15px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); margin-bottom: 20px;">
                <div class="team-badge my-team" style="text-align: center;">
                    <div style="font-size: 24px;">🦁</div>
                    <div style="font-weight: 800; color: #0f172a;">${myTeam.name}</div>
                    <div style="font-size: 12px; color: #3b82f6; font-weight: 700;">xPts: ${myStats.xPts.toFixed(1)}</div>
                </div>
                
                <div class="versus-badge" style="text-align: center;">
                    <span style="display: block; font-weight: 900; font-size: 18px; color: #94a3b8;">VS</span>
                    <span style="display: block; font-size: 11px; background: #f1f5f9; padding: 2px 8px; border-radius: 10px; color: #64748b;">GW${opponentData.match.event || '?'}</span>
                </div>
                
                <div class="team-badge opp-team" style="text-align: center;">
                    <div style="font-size: 24px;">🛡️</div>
                    <div style="font-weight: 800; color: #0f172a;">${opponentData.opponentName}</div>
                    <div style="font-size: 12px; color: #ef4444; font-weight: 700;">xPts: ${oppStats.xPts.toFixed(1)}</div>
                </div>
            </div>

            <div class="rival-stats-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <div class="stat-box" style="background: #fff; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <h4 style="margin: 0 0 10px; font-size: 13px; color: #64748b;">כושר נוכחי (Form)</h4>
                    <div class="stat-bar-container" style="display: flex; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; margin-bottom: 5px;">
                        <div class="stat-bar my-bar" style="width: ${(myStats.form / formTotal * 100)}%; background: #3b82f6;"></div>
                        <div class="stat-bar opp-bar" style="width: ${(oppStats.form / formTotal * 100)}%; background: #ef4444;"></div>
                    </div>
                    <div class="stat-values" style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 700;">
                        <span style="color:#3b82f6">${myStats.form.toFixed(1)}</span>
                        <span style="color:#ef4444">${oppStats.form.toFixed(1)}</span>
                    </div>
                </div>

                <div class="stat-box" style="background: #fff; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <h4 style="margin: 0 0 10px; font-size: 13px; color: #64748b;">פוטנציאל התקפי (xGI)</h4>
                    <div class="stat-bar-container" style="display: flex; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; margin-bottom: 5px;">
                        <div class="stat-bar my-bar" style="width: ${(myStats.xGI / xgiTotal * 100)}%; background: #3b82f6;"></div>
                        <div class="stat-bar opp-bar" style="width: ${(oppStats.xGI / xgiTotal * 100)}%; background: #ef4444;"></div>
                    </div>
                    <div class="stat-values" style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 700;">
                        <span style="color:#3b82f6">${myStats.xGI.toFixed(2)}</span>
                        <span style="color:#ef4444">${oppStats.xGI.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;

        // === SQUAD OVERLAPS LOGIC ===
        const analyzeSquadComposition = (squad) => {
            const composition = {};
            squad.forEach(p => {
                const key = `${p.team_name} ${p.position_name}`; // e.g. "Arsenal DEF"
                composition[key] = (composition[key] || 0) + 1;
            });
            return composition;
        };
        
        const myComp = analyzeSquadComposition(mySquad);
        const oppComp = analyzeSquadComposition(oppSquad);
        
        let overlapsHtml = '';
        const allKeys = new Set([...Object.keys(myComp), ...Object.keys(oppComp)]);
        
        allKeys.forEach(key => {
            const myCount = myComp[key] || 0;
            const oppCount = oppComp[key] || 0;
            
            if (myCount > 0 && oppCount > 0) {
                overlapsHtml += `
                    <div class="overlap-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px dashed #e2e8f0;">
                        <div class="overlap-label" style="font-weight: 600; font-size: 13px; color: #334155;">${key}</div>
                        <div class="overlap-values" style="font-family: monospace; font-weight: 700;">
                            <span style="color:#3b82f6">${myCount}</span>
                            <span style="color:#94a3b8; font-size: 11px; margin: 0 4px;">vs</span>
                            <span style="color:#ef4444">${oppCount}</span>
                        </div>
                    </div>
                `;
            }
        });
        
        if (overlapsHtml) {
            html += `
                <div class="overlap-section" style="background: #fff; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <h3 style="margin: 0 0 10px; font-size: 14px; color: #0f172a; font-weight: 700;">🤝 חפיפות ונטרולים (Squad Overlaps)</h3>
                    <div class="overlap-grid">${overlapsHtml}</div>
                    <div style="margin-top: 8px; font-size: 11px; color: #64748b; text-align: right;">* שחקנים מאותה קבוצה ואותה עמדה מנטרלים זה את זה</div>
                </div>
            `;
        }

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
// TREND CHART (Updated)
// ============================================

window.renderAllTeamsTrendChart = function(teamAggregates, mode = 'cumulative', highlightTeamIds = []) {
    // Note: highlightTeamIds can be a single ID (string/number) or array of IDs.
    if (!Array.isArray(highlightTeamIds)) {
        highlightTeamIds = highlightTeamIds ? [highlightTeamIds] : [];
    }

    // Default to including My Team if not specified
    if (highlightTeamIds.length === 0 && state.draft.myTeamId) {
        highlightTeamIds = [state.draft.myTeamId];
    }
    
    // Ensure all are strings for comparison
    highlightTeamIds = highlightTeamIds.map(id => String(id));

    console.log('📈 renderAllTeamsTrendChart called', { mode, highlightTeamIds });
    const container = document.getElementById('chart-progress');
    if (!container) return;

    // Data Preparation
    const matches = state.draft.details?.matches || [];
    const entries = state.draft.details?.league_entries || [];
    
    if (!matches.length || !entries.length) {
        container.innerHTML = '<div class="alert alert-info">אין נתונים להצגת גרף מגמה.</div>';
        return;
    }

    let currentMetric = document.getElementById('trendMetricSelect')?.value || 'points';

    const teamsOptions = entries.map(e => {
        const isSelected = highlightTeamIds.includes(String(e.id));
        return `<option value="${e.id}" ${isSelected ? 'selected' : ''}>${e.entry_name}</option>`;
    }).join('');

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; gap: 10px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <div class="chart-toggles" style="display: flex; background: #f1f5f9; border-radius: 8px; padding: 2px;">
                    <button onclick="renderAllTeamsTrendChart(null, 'cumulative', getSelectedTeamsForTrend())" class="${mode === 'cumulative' ? 'active' : ''}" style="padding: 6px 12px; border: none; background: ${mode === 'cumulative' ? 'white' : 'transparent'}; color: ${mode === 'cumulative' ? '#3b82f6' : '#64748b'}; font-weight: 600; border-radius: 6px; cursor: pointer;">מצטבר</button>
                    <button onclick="renderAllTeamsTrendChart(null, 'weekly', getSelectedTeamsForTrend())" class="${mode === 'weekly' ? 'active' : ''}" style="padding: 6px 12px; border: none; background: ${mode === 'weekly' ? 'white' : 'transparent'}; color: ${mode === 'weekly' ? '#3b82f6' : '#64748b'}; font-weight: 600; border-radius: 6px; cursor: pointer;">מחזורי</button>
                </div>
                
                <select id="trendMetricSelect" onchange="renderAllTeamsTrendChart(null, '${mode}', getSelectedTeamsForTrend())" style="padding: 6px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 13px;">
                    <option value="points" ${currentMetric === 'points' ? 'selected' : ''}>נקודות</option>
                    <option value="table_points" ${currentMetric === 'table_points' ? 'selected' : ''}>נקודות בטבלה (נצחונות)</option>
                </select>
            </div>
            
            <div style="display: flex; align-items: center; gap: 8px;">
                <label for="chartHighlightSelect" style="font-size: 13px; color: #64748b; font-weight: 600;">השוואת קבוצות:</label>
                <select id="chartHighlightSelect" multiple onchange="renderAllTeamsTrendChart(null, '${mode}', getSelectedTeamsForTrend())" style="padding: 6px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 13px; color: #334155; cursor: pointer; background: white; max-width: 200px; height: 35px;">
                    ${teamsOptions}
                </select>
            </div>
        </div>
        <div style="height: 400px; position: relative; width: 100%;">
            <canvas id="trendCanvas"></canvas>
        </div>
        <div style="text-align: right; font-size: 11px; color: #94a3b8; margin-top: 5px;">* החזק Ctrl כדי לבחור מספר קבוצות</div>
    `;

    const historyMap = new Map(); 
    
    entries.forEach(e => {
        historyMap.set(String(e.id), { 
            name: e.entry_name, 
            points: [],
            cumulative: [] 
        });
    });

    const finishedMatches = matches.filter(m => m.finished).sort((a, b) => a.event - b.event);
    const maxGW = finishedMatches.length ? finishedMatches[finishedMatches.length-1].event : 0;
    
    entries.forEach(e => {
        for (let gw = 1; gw <= maxGW; gw++) {
            historyMap.get(String(e.id)).points.push(0);
        }
    });

    finishedMatches.forEach(m => {
        const gwIdx = m.event - 1;
        const id1 = String(m.league_entry_1);
        const id2 = String(m.league_entry_2);
        
        let p1 = 0, p2 = 0;
        
        if (currentMetric === 'points') {
            p1 = m.league_entry_1_points;
            p2 = m.league_entry_2_points;
        } else {
            if (m.league_entry_1_points > m.league_entry_2_points) { p1 = 3; p2 = 0; }
            else if (m.league_entry_1_points < m.league_entry_2_points) { p1 = 0; p2 = 3; }
            else { p1 = 1; p2 = 1; }
        }

        if (historyMap.has(id1)) historyMap.get(id1).points[gwIdx] = p1;
        if (historyMap.has(id2)) historyMap.get(id2).points[gwIdx] = p2;
    });

    historyMap.forEach((data, id) => {
        let sum = 0;
        data.points.forEach(p => {
            sum += p;
            data.cumulative.push(sum);
        });
    });

    const datasets = Array.from(historyMap.entries())
        .filter(([entryId, team]) => highlightTeamIds.includes(entryId))
        .map(([entryId, team], index) => {
            const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'];
            const color = colors[index % colors.length];
            
            return {
                label: team.name,
                data: mode === 'cumulative' ? team.cumulative : team.points,
                borderColor: color,
                backgroundColor: color,
                borderWidth: 3,
                pointRadius: 4,
                tension: 0.4,
                fill: false
            };
    });

    const labels = Array.from({length: maxGW}, (_, i) => `GW${i+1}`);
    const canvas = document.getElementById('trendCanvas');
    
    if (window.trendChartInstance) {
        window.trendChartInstance.destroy();
    }

    window.trendChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', align: 'end' },
                tooltip: { 
                    mode: 'index', 
                    intersect: false,
                    callbacks: { title: (items) => `מחזור ${items[0].label}` }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' },
                    title: { display: true, text: currentMetric === 'points' ? 'נקודות' : 'נקודות ליגה' }
                }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        }
    });
}

window.getSelectedTeamsForTrend = function() {
    const select = document.getElementById('chartHighlightSelect');
    if (!select) return [];
    return Array.from(select.selectedOptions).map(opt => opt.value);
}

function switchDraftTab(tabId) {
    const contents = document.querySelectorAll('.draft-sub-content');
    contents.forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });
    
    const selected = document.getElementById(`draft-${tabId}`);
    if (selected) {
        selected.classList.add('active');
        selected.style.display = 'block';
    }
    
    const buttons = document.querySelectorAll('.draft-nav-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.color = '#64748b';
        btn.style.boxShadow = 'none';
        
        if (btn.getAttribute('onclick').includes(tabId)) {
            btn.classList.add('active');
            btn.style.background = '#eff6ff';
            btn.style.color = '#3b82f6';
            btn.style.boxShadow = '0 2px 4px rgba(59,130,246,0.1)';
        }
    });
    
    if (tabId === 'overview' && window.trendChartInstance) {
        setTimeout(() => window.trendChartInstance.resize(), 100);
    }
    
    if (tabId === 'rivals') {
        renderNextRivalAnalysis();
    }
}

