
// ============================================
// ULTIMATE COMPARISON FIXES
// ============================================

function generateComparisonTableHTML(players, activeRange = 'all') {
    // 🎨 ULTIMATE PLAYER COMPARISON - COMPLETE MAKEOVER
    
    const photoUrl = (p) => `https://resources.premierleague.com/premierleague/photos/players/110x140/p${p.code}.png`;
    const fallbackSVG = (name) => `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22110%22 height=%22140%22%3E%3Crect fill=%22%2394a3b8%22 width=%22110%22 height=%22140%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23fff%22 font-size=%2248%22 font-weight=%22bold%22%3E${name.charAt(0)}%3C/text%3E%3C/svg%3E`;
    
    // Range Filter Buttons HTML
    const ranges = [
        { value: '1', label: 'משחק אחרון' },
        { value: '3', label: '3 אחרונים' },
        { value: '5', label: '5 אחרונים' },
        { value: '10', label: '10 אחרונים' },
        { value: 'all', label: 'כל העונה' }
    ];
    
    const filtersHTML = `
        <div class="comparison-filters" style="display: flex; justify-content: center; gap: 8px; margin-bottom: 20px; padding: 10px;">
            ${ranges.map(r => `
                <button 
                    onclick="updateComparisonRange('${r.value}')" 
                    class="range-btn ${activeRange === r.value ? 'active' : ''}"
                    style="
                        padding: 8px 16px;
                        border-radius: 20px;
                        border: 1px solid ${activeRange === r.value ? '#4f46e5' : '#e2e8f0'};
                        background: ${activeRange === r.value ? '#4f46e5' : 'white'};
                        color: ${activeRange === r.value ? 'white' : '#64748b'};
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 14px;
                        transition: all 0.2s;
                    "
                >
                    ${r.label}
                </button>
            `).join('')}
        </div>
    `;

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
                ${filtersHTML}
            </div>
            
            <!-- 👥 PLAYER CARDS GRID -->
            <div class="ultimate-players-grid">
    `;
    
    // Player Cards with enhanced stats
    players.forEach((p, idx) => {
        const positionColors = {
            'GKP': '#f59e0b',
            'DEF': '#3b82f6',
            'MID': '#10b981',
            'FWD': '#ef4444'
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
                    
                    <!-- Quick Stats Grid -->
                    <div class="quick-stats-grid">
                        <div class="quick-stat">
                            <span class="quick-stat-icon">💰</span>
                            <div class="quick-stat-content">
                                <span class="quick-stat-label">מחיר</span>
                                <span class="quick-stat-value">£${p.now_cost.toFixed(1)}M</span>
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
                                <span class="quick-stat-label">נק' (טווח)</span>
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
                    השוואה מפורטת (מנורמל ל-90 דקות)
                </h3>
                
                <div class="metrics-comparison-table">
    `;
    
    // Define comprehensive metrics (Updated with Per 90s)
    const comprehensiveMetrics = [
        { name: 'ציון דראפט', key: 'draft_score', format: v => v.toFixed(1), icon: '⭐', reversed: false },
        { name: 'העברות נטו', key: 'net_transfers_event', format: v => (v >= 0 ? '+' : '') + v.toLocaleString(), icon: '🔄', reversed: false },
        { name: 'חיזוי (GW הבא)', key: 'predicted_points_1_gw', format: v => v.toFixed(1), icon: '🔮', reversed: false },
        { name: 'כושר', key: 'form', format: v => parseFloat(v || 0).toFixed(1), icon: '🔥', reversed: false },
        { name: 'נקודות/90', key: 'points_per_game_90', format: v => v.toFixed(1), icon: '📈', reversed: false },
        { name: 'נקודות (סה"כ)', key: 'total_points', format: v => v, icon: '🎯', reversed: false },
        { name: 'xGI/90', key: 'xGI_per90', format: v => v.toFixed(2), icon: '⚽', reversed: false },
        { name: 'G+A (סה"כ)', key: 'goals_scored_assists', format: v => v, icon: '🎯', reversed: false },
        { name: 'מחיר', key: 'now_cost', format: v => '£' + v.toFixed(1) + 'M', icon: '💰', reversed: true },
        { name: '% בעלות', key: 'selected_by_percent', format: v => v + '%', icon: '👥', reversed: false },
        { name: 'דקות (טווח)', key: 'minutes', format: v => v.toLocaleString(), icon: '⏱️', reversed: false },
        { name: 'בונוס/90', key: 'bonus_per90', format: v => v.toFixed(2), icon: '⭐', reversed: false },
        { name: 'ICT/90', key: 'ict_index_per90', format: v => v.toFixed(1), icon: '🧬', reversed: false },
        { name: 'השפעה/90', key: 'influence_per90', format: v => v.toFixed(1), icon: '💪', reversed: false },
        { name: 'יצירתיות/90', key: 'creativity_per90', format: v => v.toFixed(1), icon: '🎨', reversed: false },
        { name: 'איום/90', key: 'threat_per90', format: v => v.toFixed(1), icon: '🔫', reversed: false },
        { name: 'DefCon/90', key: 'def_contrib_per90', format: v => v.toFixed(2), icon: '🛡️', reversed: false },
        { name: 'xDiff', key: 'xDiff', format: v => (v >= 0 ? '+' : '') + v.toFixed(2), icon: '📉', reversed: false },
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
            const isBest = metric.reversed ? (value === minVal) : (value === maxVal);
            const isWorst = metric.reversed ? (value === maxVal) : (value === minVal);
            const percentage = (maxVal > minVal && !isNaN(value)) ? ((value - minVal) / (maxVal - minVal) * 100) : (value > 0 ? 100 : 0);
            
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

window.updateComparisonRange = async function(range) {
    // Show loading style
    const container = document.querySelector('.ultimate-comparison-container');
    if(container) container.style.opacity = '0.5';
    
    let playersData;
    
    if (range === 'all') {
        // Use main processed data filtered by selection
        const allP = state.allPlayersData[state.currentDataSource].processed;
        playersData = allP.filter(p => state.selectedForComparison.has(p.id));
    } else {
        const lastN = parseInt(range);
        
        // Check cache or calculate
        let aggData = state.aggregatedCache[lastN];
        if (!aggData) {
            aggData = await calculateAggregatedStats(lastN);
            state.aggregatedCache[lastN] = aggData;
        }
        
        // Map aggregated data to selected players
        const allP = state.allPlayersData[state.currentDataSource].processed;
        const selectedP = allP.filter(p => state.selectedForComparison.has(p.id));
        
        // Convert aggregated array to map for fast lookup
        const aggMap = new Map(aggData.map(p => [p.id, p]));
        
        playersData = selectedP.map(p => {
            const agg = aggMap.get(p.id);
            if (!agg) return p; 
            
            return {
                ...p,     // Keep original static props
                ...agg,   // Override with aggregated dynamic props
                
                // Explicitly keep static fields that might be zeroed in aggregation
                now_cost: p.now_cost,
                selected_by_percent: p.selected_by_percent,
                net_transfers_event: p.net_transfers_event,
                web_name: p.web_name,
                team_name: p.team_name,
                position_name: p.position_name,
                draft_score: p.draft_score, // Keep original draft score
                predicted_points_1_gw: p.predicted_points_1_gw
            };
        });
    }
    
    // Re-render
    const contentDiv = document.getElementById('compareContent');
    contentDiv.innerHTML = generateComparisonTableHTML(playersData, range);
    
    if(container) container.style.opacity = '1';
};

window.compareSelectedPlayers = function() {
    console.log('🔍 compareSelectedPlayers called');
    console.log('📊 Selected players:', state.selectedForComparison);
    
    if (state.selectedForComparison.size < 2) {
        showToast('בחר שחקנים', 'יש לבחור לפחות שני שחקנים להשוואה', 'warning', 3000);
        return;
    }
    
    if (!state.allPlayersData[state.currentDataSource] || !state.allPlayersData[state.currentDataSource].processed) {
        showToast('שגיאה', 'לא נמצאו נתוני שחקנים', 'error', 3000);
        return;
    }
    
    const players = state.allPlayersData[state.currentDataSource].processed.filter(p => state.selectedForComparison.has(p.id));
    
    if (players.length < 2) {
        showToast('שגיאה', 'לא ניתן למצוא את השחקנים שנבחרו', 'error', 3000);
        return;
    }
    
    // Remove existing modal if any (legacy check)
    const existingModal = document.getElementById('compareModal');
    if (existingModal) existingModal.remove();

    // Create new modal structure
    const modal = document.createElement('div');
    modal.id = 'compareModal';
    modal.className = 'modal active';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px);
        display: flex; justify-content: center; align-items: center; z-index: 10000;
        padding: 20px; animation: fadeIn 0.3s ease-out;
    `;
    
    // Content Container
    const contentDiv = document.createElement('div');
    contentDiv.id = 'compareContent';
    contentDiv.style.cssText = `
        background: white; width: 100%; max-width: 1200px; max-height: 90vh;
        border-radius: 24px; overflow: auto; display: flex; flex-direction: column;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); position: relative;
    `;
    
    // Close Button (Fixed)
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.onclick = closeModal;
    closeBtn.style.cssText = `
        position: absolute; top: 20px; left: 20px; z-index: 100;
        background: rgba(255,255,255,0.2); border: none; color: white;
        width: 36px; height: 36px; border-radius: 50%; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        font-size: 18px; transition: all 0.2s; backdrop-filter: blur(4px);
    `;
    closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255,255,255,0.3)';
    closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(255,255,255,0.2)';
    
    // Generate initial HTML (All Season default)
    contentDiv.innerHTML = generateComparisonTableHTML(players, 'all');
    
    modal.appendChild(contentDiv);
    
    // Add external close button for safety
    const floatingClose = document.createElement('div');
    floatingClose.innerHTML = '✕';
    floatingClose.onclick = closeModal;
    floatingClose.style.cssText = `
        position: absolute; top: 20px; left: 20px; color: white; font-size: 24px; cursor: pointer; z-index: 10001;
    `;
    modal.appendChild(floatingClose);

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
};

