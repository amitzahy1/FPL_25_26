
// ============================================
// DRAFT FEATURE RESTORATION - NAVIGATION & UI
// ============================================

function switchDraftTab(tabId) {
    // Update Nav Buttons
    document.querySelectorAll('.draft-nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if(btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabId)) {
            btn.classList.add('active');
        }
    });

    // Update Content Areas
    document.querySelectorAll('.draft-sub-content').forEach(div => {
        div.classList.remove('active');
        div.style.display = 'none';
    });
    
    const activeDiv = document.getElementById(`draft-${tabId}`);
    if(activeDiv) {
        activeDiv.classList.add('active');
        activeDiv.style.display = 'block';
    }

    // Specific logic for tabs
    if (tabId === 'rival') {
        renderNextRivalAnalysis();
    } else if (tabId === 'overview') {
        // Ensure overview components are rendered if data exists
        if(state.draft.details) {
             renderAllTeamsTrendChart(null, window.currentTrendState?.mode || 'cumulative', window.currentTrendState?.highlightTeamIds || []);
        }
    }
}

// ============================================
// MY TEAM & LINEUP MANAGEMENT
// ============================================

function populateMyTeamSelector() {
    const select = document.getElementById('myTeamSelect');
    if (!select) return;
    select.innerHTML = '<option value="">-- בחר קבוצה --</option>';
    const entries = state.draft.details?.league_entries || [];
    entries.forEach(entry => {
        if (!entry.entry_name) return;
        const option = document.createElement('option');
        option.value = entry.id;
        option.textContent = `${entry.player_first_name} ${entry.player_last_name} (${entry.entry_name})`;
        select.appendChild(option);
    });
    if (state.draft.myTeamId) {
        select.value = state.draft.myTeamId;
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
        <div class="lineup-stats-card" style="margin-bottom: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 12px;">
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
                ${renderBox('צפי (GW הבא)', stats.predicted, '#3b82f6', diffs?.predicted)}
                ${renderBox('נקודות (GW אחרון)', stats.lastGw, '#10b981', diffs?.lastGw)}
                ${renderBox('PPG/90', stats.ppg90, '#f59e0b', diffs?.ppg90)}
                ${renderBox('כושר (Form)', stats.form, '#8b5cf6', diffs?.form)}
            </div>
        </div>
    `;
}

function renderMyLineup(teamId) {
    const container = document.getElementById('myLineupContainer');
    if (!container) return;
    
    if (!teamId) {
        container.innerHTML = '<p style="text-align:center; padding: 20px;">לא נמצאה קבוצה</p>';
        return;
    }

    const rosterIds = state.draft.rostersByEntryId.get(parseInt(teamId)) || [];
    if (!rosterIds.length) {
        container.innerHTML = '<p style="text-align:center; padding: 20px;">אין סגל להצגה</p>';
        return;
    }

    let starters = [];
    let bench = [];
    
    const lineupData = state.draft.lineupsByEntryId ? state.draft.lineupsByEntryId.get(parseInt(teamId)) : null;
    const processedById = getProcessedByElementId();

    if (lineupData && lineupData.starting && lineupData.starting.length > 0) {
        starters = lineupData.starting.map(id => processedById.get(id)).filter(Boolean);
        bench = lineupData.bench.map(id => processedById.get(id)).filter(Boolean);
    } else {
        const roster = rosterIds.map(id => processedById.get(id)).filter(Boolean);
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

    renderPitch(pitchWrapper, starters.map(p => p.id), true, bench.map(p => p.id));
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
    const gkps = squad.filter(p => p.element_type === 1).sort((a,b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0));
    const defs = squad.filter(p => p.element_type === 2).sort((a,b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0));
    const mids = squad.filter(p => p.element_type === 3).sort((a,b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0));
    const fwds = squad.filter(p => p.element_type === 4).sort((a,b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0));
    
    const startingXI = [];
    const bench = [];
    
    // GK
    if (gkps.length > 0) { startingXI.push(gkps[0]); for(let i=1; i<gkps.length; i++) bench.push(gkps[i]); }
    
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
    let nextMatch = details.matches.find(m => 
        m.event === currentEvent && 
        (m.league_entry_1 === myEntryId || m.league_entry_2 === myEntryId)
    );
    if (!nextMatch) {
        nextMatch = details.matches.find(m => 
            m.event === currentEvent + 1 && 
            (m.league_entry_1 === myEntryId || m.league_entry_2 === myEntryId)
        );
    }
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
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;"><div class="spinner"></div> מחשב סיכויים ומנתח הרכבים...</div>';
    try {
        const myTeam = findMyTeam();
        if (!myTeam) {
            container.innerHTML = '<div class="alert alert-warning">לא נבחרה קבוצה. אנא בחר את הקבוצה שלך בתפריט ההגדרות.</div>';
            return;
        }
        const opponentData = getNextOpponent(myTeam.id);
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
        const calcStats = (squad) => {
            const totalXPts = squad.reduce((sum, p) => sum + (parseFloat(p.predicted_points_1_gw) || 0), 0);
            const totalXGI = squad.reduce((sum, p) => sum + (parseFloat(p.expected_goal_involvements) || 0), 0);
            const totalForm = squad.reduce((sum, p) => sum + (parseFloat(p.form) || 0), 0);
            return { xPts: totalXPts, xGI: totalXGI, form: totalForm };
        };
        const myStats = calcStats(mySquad);
        const oppStats = calcStats(oppSquad);
        const formTotal = (myStats.form + oppStats.form) || 1;
        const xgiTotal = (myStats.xGI + oppStats.xGI) || 1;
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
        const analyzeSquadComposition = (squad) => {
            const composition = {};
            squad.forEach(p => {
                const key = `${p.team_name} ${p.position_name}`;
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
// TREND CHART RESTORATION
// ============================================

window.renderAllTeamsTrendChart = function(teamAggregates, mode = 'cumulative', highlightTeamIds = []) {
    if (!Array.isArray(highlightTeamIds)) highlightTeamIds = highlightTeamIds ? [highlightTeamIds] : [];
    if (highlightTeamIds.length === 0 && state.draft.myTeamId) highlightTeamIds = [String(state.draft.myTeamId)];
    highlightTeamIds = highlightTeamIds.map(id => String(id));

    const container = document.getElementById('chart-progress');
    if (!container) return;

    const matches = state.draft.details?.matches || [];
    const entries = state.draft.details?.league_entries || [];
    
    if (!matches.length || !entries.length) {
        container.innerHTML = '<div class="alert alert-info">אין נתונים להצגת גרף מגמה.</div>';
        return;
    }

    let currentMetric = document.getElementById('trendMetricSelect')?.value || 'points';

    container.innerHTML = `
        <div class="chart-controls-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <div class="chart-toggles" style="display: flex; background: #f1f5f9; border-radius: 8px; padding: 2px;">
                    <button onclick="updateTrendChartMode('cumulative')" class="${mode === 'cumulative' ? 'active' : ''}" style="padding: 6px 12px; border: none; background: ${mode === 'cumulative' ? 'white' : 'transparent'}; color: ${mode === 'cumulative' ? '#3b82f6' : '#64748b'}; font-weight: 600; border-radius: 6px; cursor: pointer;">מצטבר</button>
                    <button onclick="updateTrendChartMode('weekly')" class="${mode === 'weekly' ? 'active' : ''}" style="padding: 6px 12px; border: none; background: ${mode === 'weekly' ? 'white' : 'transparent'}; color: ${mode === 'weekly' ? '#3b82f6' : '#64748b'}; font-weight: 600; border-radius: 6px; cursor: pointer;">מחזורי</button>
                </div>
                
                <select id="trendMetricSelect" onchange="updateTrendChartMetric(this.value)" style="padding: 6px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 13px;">
                    <option value="points" ${currentMetric === 'points' ? 'selected' : ''}>נקודות</option>
                    <option value="table_points" ${currentMetric === 'table_points' ? 'selected' : ''}>נקודות בטבלה (נצחונות)</option>
                </select>
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
    entries.forEach(e => {
        const isChecked = highlightTeamIds.includes(String(e.id));
        const isMyTeam = String(e.id) === String(state.draft.myTeamId);
        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155; cursor: pointer; padding: 4px; border-radius: 6px; transition: background 0.2s;';
        if (isChecked) label.style.background = '#eef2ff';
        label.innerHTML = `<input type="checkbox" value="${e.id}" ${isChecked ? 'checked' : ''} onchange="toggleTrendTeam('${e.id}')" style="accent-color: #3b82f6;"><span style="${isMyTeam ? 'font-weight: 700; color: #0f172a;' : ''}">${isMyTeam ? '👤 ' : ''}${e.entry_name}</span>`;
        teamList.appendChild(label);
    });

    const historyMap = new Map(); 
    entries.forEach(e => historyMap.set(String(e.id), { name: e.entry_name, points: [], cumulative: [] }));
    const finishedMatches = matches.filter(m => m.finished).sort((a, b) => a.event - b.event);
    const maxGW = finishedMatches.length ? finishedMatches[finishedMatches.length-1].event : 0;
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

    const datasets = Array.from(historyMap.entries())
        .filter(([entryId, team]) => highlightTeamIds.includes(entryId))
        .map(([entryId, team], index) => {
            const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#06b6d4', '#84cc16', '#d946ef'];
            const isMyTeam = String(entryId) === String(state.draft.myTeamId);
            const color = isMyTeam ? '#0f172a' : colors[index % colors.length];
            return {
                label: team.name,
                data: mode === 'cumulative' ? team.cumulative : team.points,
                borderColor: color,
                backgroundColor: color,
                borderWidth: isMyTeam ? 4 : 2.5,
                pointRadius: isMyTeam ? 4 : 3,
                tension: 0.3,
                fill: false,
                order: isMyTeam ? 100 : 1
            };
    });

    const labels = Array.from({length: maxGW}, (_, i) => `GW${i+1}`);
    const canvas = document.getElementById('trendCanvas');
    if (window.trendChartInstance) window.trendChartInstance.destroy();

    window.trendChartInstance = new Chart(canvas, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' }, tooltip: { mode: 'index', intersect: false } },
            scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        }
    });
    window.currentTrendState = { mode, highlightTeamIds };
}

window.updateTrendChartMode = (mode) => {
    const current = window.currentTrendState || {};
    renderAllTeamsTrendChart(null, mode, current.highlightTeamIds);
}
window.updateTrendChartMetric = (metric) => {
    const current = window.currentTrendState || {};
    renderAllTeamsTrendChart(null, current.mode, current.highlightTeamIds);
}
window.toggleTrendTeam = (teamId) => {
    const current = window.currentTrendState || {};
    let ids = current.highlightTeamIds || [];
    if (ids.includes(String(teamId))) ids = ids.filter(id => id !== String(teamId));
    else ids.push(String(teamId));
    renderAllTeamsTrendChart(null, current.mode, ids);
}
window.selectAllTrendTeams = () => {
    const ids = (state.draft.details?.league_entries || []).map(e => String(e.id));
    renderAllTeamsTrendChart(null, window.currentTrendState?.mode, ids);
}
window.clearAllTrendTeams = () => {
    const ids = state.draft.myTeamId ? [String(state.draft.myTeamId)] : [];
    renderAllTeamsTrendChart(null, window.currentTrendState?.mode, ids);
}

// Helper to call when draft data is loaded
function onDraftDataLoaded() {
    populateMyTeamSelector();
    const myTeam = findMyTeam();
    if(myTeam && state.draft.details) {
        renderAllTeamsTrendChart(null, 'cumulative', [String(myTeam.id)]);
    }
}

// Hook into existing loadDraftLeague (search for where it finishes and call onDraftDataLoaded)
// Or simply call populateMyTeamSelector inside loadDraftLeague if possible.

