function renderNextRivalAnalysis(selectedOpponentId = null) {
    const container = document.getElementById('rivalAnalysisContainer');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;"><div class="spinner"></div> מחשב סיכויים ומנתח הרכבים...</div>';
    
    try {
        const myTeam = findMyTeam();
        if (!myTeam) {
            container.innerHTML = '<div class="alert alert-warning">לא נבחרה קבוצה. אנא בחר את הקבוצה שלך בתפריט ההגדרות.</div>';
            return;
        }

        // If opponent is manually selected, use it; otherwise get next opponent
        let opponentData;
        if (selectedOpponentId) {
            const entries = state.draft.details?.league_entries || [];
            const oppEntry = entries.find(e => String(e.id) === String(selectedOpponentId));
            if (oppEntry) {
                opponentData = {
                    opponentId: oppEntry.id,
                    opponentName: oppEntry.entry_name,
                    match: { event: state.draft.details?.league?.current_event || 0 },
                    isLastMatch: false,
                    isManual: true
                };
            }
        }
        
        if (!opponentData) {
            opponentData = getNextOpponent(myTeam.id);
        }
        
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
        
        // Calculate stats using only top 11 players for xPts
        const calcStats = (squad) => {
            const top11 = squad
                .sort((a, b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0))
                .slice(0, 11);
            
            const totalXPts = top11.reduce((sum, p) => sum + (parseFloat(p.predicted_points_1_gw) || 0), 0);
            const totalXGI = squad.reduce((sum, p) => sum + (parseFloat(p.expected_goal_involvements) || 0), 0);
            const totalForm = squad.reduce((sum, p) => sum + (parseFloat(p.form) || 0), 0);
            return { xPts: totalXPts, xGI: totalXGI, form: totalForm };
        };
        
        const myStats = calcStats(mySquad);
        const oppStats = calcStats(oppSquad);
        
        // Calculate win probability using ADVANCED algorithm
        const winProbResult = calculateAdvancedWinProbability(
            myTeam.id,
            opponentData.opponentId,
            myRosterIds,
            oppRosterIds,
            processedById
        );
        const myWinProb = winProbResult.winProb1;
        const oppWinProb = winProbResult.winProb2;
        
        // Get team logos
        const myLogo = getTeamLogo(myTeam.name);
        const oppLogo = getTeamLogo(opponentData.opponentName);
        
        // Create team selectors
        const entries = state.draft.details?.league_entries || [];
        const opponentSelector = `
            <div class="rival-selector-container" style="display: flex; justify-content: center; align-items: center; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; background: white; padding: 15px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                    <label style="font-size: 12px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.5px;">הקבוצה שלי</label>
                    <select id="rivalMyTeamSelect" onchange="updateMyTeamForRival(this.value)" style="padding: 8px 12px; border-radius: 8px; border: 2px solid #e0e7ff; font-size: 14px; font-weight: 600; color: #1e293b; cursor: pointer; background: #f8fafc; min-width: 160px; outline: none;">
                        ${entries.map(e => `
                            <option value="${e.id}" ${String(e.id) === String(myTeam.id) ? 'selected' : ''}>
                                ${e.entry_name}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <div style="font-size: 24px; color: #94a3b8; margin-top: 18px;">⚡</div>
                
                <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                    <label style="font-size: 12px; font-weight: 700; color: #ef4444; text-transform: uppercase; letter-spacing: 0.5px;">היריב</label>
                    <select id="rivalOpponentSelect" onchange="renderNextRivalAnalysis(this.value)" style="padding: 8px 12px; border-radius: 8px; border: 2px solid #fee2e2; font-size: 14px; font-weight: 600; color: #1e293b; cursor: pointer; background: #fff1f2; min-width: 160px; outline: none;">
                        ${entries.filter(e => e.id !== myTeam.id).map(e => `
                            <option value="${e.id}" ${String(e.id) === String(opponentData.opponentId) ? 'selected' : ''}>
                                ${e.entry_name}
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>
        `;
        
        // Match Title
        const matchTitle = opponentData.isManual ? 
            `<div style="text-align: center; margin-bottom: 15px; display: flex; align-items: center; justify-content: center; gap: 8px; color: #6366f1; font-weight: 700; font-size: 14px; background: #e0e7ff; padding: 8px 16px; border-radius: 20px; display: inline-flex;">
                <span>🔍</span> ניתוח מותאם אישית
            </div>` :
            opponentData.isLastMatch ? 
            `<div style="text-align: center; margin-bottom: 15px; display: flex; align-items: center; justify-content: center; gap: 8px; color: #d97706; font-weight: 700; font-size: 14px; background: #fef3c7; padding: 8px 16px; border-radius: 20px; display: inline-flex;">
                <span>📊</span> תוצאת משחק אחרון
            </div>` : 
            `<div style="text-align: center; margin-bottom: 15px; display: flex; align-items: center; justify-content: center; gap: 8px; color: #0284c7; font-weight: 700; font-size: 14px; background: #e0f2fe; padding: 8px 16px; border-radius: 20px; display: inline-flex;">
                <span>🔜</span> המשחק הבא שלך (GW${opponentData.match.event})
            </div>`;
        
        // Main Comparison Card
        let html = `
            <div style="text-align: center;">${matchTitle}</div>
            ${opponentSelector}
            
            <div class="rival-header" style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 30px; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.4); margin-bottom: 24px; color: white; position: relative; overflow: hidden;">
                <!-- Background Pattern -->
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: radial-gradient(circle at 20% 150%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% -50%, rgba(255,255,255,0.15) 0%, transparent 50%); pointer-events: none;"></div>
                
                <div style="position: relative; z-index: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center; max-width: 600px; margin: 0 auto;">
                        <!-- My Team -->
                        <div style="text-align: center; flex: 1;">
                            <div style="font-size: 56px; margin-bottom: 10px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2)); transition: transform 0.3s ease;">${myLogo}</div>
                            <div style="font-weight: 800; font-size: 18px; margin-bottom: 8px; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${myTeam.name}</div>
                            <div style="display: inline-block; background: rgba(255,255,255,0.2); backdrop-filter: blur(8px); padding: 6px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.3); font-weight: 700;">
                                ${myStats.xPts.toFixed(1)} xPts
                            </div>
                        </div>
                        
                        <!-- VS & Prob -->
                        <div style="text-align: center; padding: 0 20px; flex: 0 0 140px;">
                            <div style="font-weight: 900; font-size: 32px; margin-bottom: 15px; opacity: 0.9;">VS</div>
                            
                            <!-- Win Prob Circle/Bar -->
                            <div style="position: relative; height: 8px; background: rgba(0,0,0,0.3); border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
                                <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${myWinProb}%; background: #34d399; border-radius: 4px;"></div>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.9);">
                                <span>${myWinProb.toFixed(0)}%</span>
                                <span>${oppWinProb.toFixed(0)}%</span>
                            </div>
                        </div>
                        
                        <!-- Opponent -->
                        <div style="text-align: center; flex: 1;">
                            <div style="font-size: 56px; margin-bottom: 10px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2)); transition: transform 0.3s ease;">${oppLogo}</div>
                            <div style="font-weight: 800; font-size: 18px; margin-bottom: 8px; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${opponentData.opponentName}</div>
                            <div style="display: inline-block; background: rgba(255,255,255,0.2); backdrop-filter: blur(8px); padding: 6px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.3); font-weight: 700;">
                                ${oppStats.xPts.toFixed(1)} xPts
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Compact Analysis Grid
        html += `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; max-width: 1000px; margin: 0 auto;">
                <!-- Form Comparison -->
                <div style="background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; color: #64748b;">
                        <span style="font-size: 20px;">🔥</span>
                        <h3 style="margin: 0; font-size: 15px; font-weight: 700;">כושר נוכחי (Form)</h3>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: 800; color: #3b82f6;">${myStats.form.toFixed(1)}</div>
                            <div style="font-size: 12px; color: #94a3b8;">שלך</div>
                        </div>
                        <div style="padding-bottom: 8px; font-size: 12px; color: #cbd5e1;">VS</div>
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: 800; color: #ef4444;">${oppStats.form.toFixed(1)}</div>
                            <div style="font-size: 12px; color: #94a3b8;">יריב</div>
                        </div>
                    </div>
                    <div style="margin-top: 12px; height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden;">
                        <div style="width: ${(myStats.form / (myStats.form + oppStats.form || 1) * 100)}%; height: 100%; background: #3b82f6;"></div>
                    </div>
                </div>

                <!-- Attack Potential (xGI) -->
                <div style="background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; color: #64748b;">
                        <span style="font-size: 20px;">⚡</span>
                        <h3 style="margin: 0; font-size: 15px; font-weight: 700;">פוטנציאל התקפי (xGI)</h3>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: 800; color: #8b5cf6;">${myStats.xGI.toFixed(1)}</div>
                            <div style="font-size: 12px; color: #94a3b8;">שלך</div>
                        </div>
                        <div style="padding-bottom: 8px; font-size: 12px; color: #cbd5e1;">VS</div>
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: 800; color: #f59e0b;">${oppStats.xGI.toFixed(1)}</div>
                            <div style="font-size: 12px; color: #94a3b8;">יריב</div>
                        </div>
                    </div>
                    <div style="margin-top: 12px; height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden;">
                        <div style="width: ${(myStats.xGI / (myStats.xGI + oppStats.xGI || 1) * 100)}%; height: 100%; background: #8b5cf6;"></div>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
    } catch (err) {
        console.error('CRITICAL ERROR in renderNextRivalAnalysis:', err);
        container.innerHTML = `<div class="alert alert-danger">
            <strong>שגיאה בטעינת הנתונים:</strong><br>
            ${err.message}
        </div>`;
    }
}
