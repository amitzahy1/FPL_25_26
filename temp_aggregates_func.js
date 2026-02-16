function computeDraftTeamAggregates() {
    const processedById = getProcessedByElementId();
    const myTeam = findMyTeam();
    const matches = state.draft.details?.matches || [];
    
    // Verification Log
    let verificationLog = "📋 Draft Analytics Calculation Log\n";
    
    const results = (state.draft.details?.league_entries || []).filter(e => e && e.entry_name).map(e => {
        const teamName = e.entry_name;
        const playerIds = state.draft.rostersByEntryId.get(e.id) || [];
        const players = playerIds.map(id => processedById.get(id)).filter(Boolean);
        
        // 1. Points and Wins from MATCHES (Actual History)
        let totalPointsFor = 0;
        let totalPointsAgainst = 0;
        let wins = 0;
        
        matches.forEach(m => {
            if (m.finished) {
                if (String(m.league_entry_1) === String(e.id)) {
                    totalPointsFor += m.league_entry_1_points;
                    totalPointsAgainst += m.league_entry_2_points;
                    if (m.winner === 'league_entry_1') wins++;
                } else if (String(m.league_entry_2) === String(e.id)) {
                    totalPointsFor += m.league_entry_2_points;
                    totalPointsAgainst += m.league_entry_1_points;
                    if (m.winner === 'league_entry_2') wins++;
                }
            }
        });
        
        // 2. Squad Stats from CURRENT ROSTER (Best available proxy without fetching full history)
        // We sum the season totals of the current squad.
        // This represents the "Current Power" of the squad.
        const sumDraft = players.reduce((s,p)=>s+p.draft_score,0);
        const sumPred = players.reduce((s,p)=>s+(p.predicted_points_4_gw||0),0);
        const totalPrice = players.reduce((s,p)=>s+p.now_cost,0);
        const sumSelectedBy = players.reduce((s,p)=>s+parseFloat(p.selected_by_percent),0);
        const gaTotal = players.reduce((s,p)=>s+(p.goals_scored||0)+(p.assists||0),0);
        const totalCleanSheets = players.reduce((s,p)=>s+(p.clean_sheets||0),0);
        const totalXGI = players.reduce((s,p)=>s+(parseFloat(p.expected_goal_involvements)||0),0);
        const totalDefCon = players.reduce((s,p)=>s+(p.def_contrib_per90||0),0);

        if (myTeam && e.id === myTeam.id) {
            verificationLog += `Team: ${teamName}\n`;
            verificationLog += `  - Points (History): ${totalPointsFor}\n`;
            verificationLog += `  - Goals+Assists (Current Squad Season Total): ${gaTotal}\n`;
            verificationLog += `  - xGI (Current Squad Season Total): ${totalXGI.toFixed(2)}\n`;
        }

        return { 
            team: teamName, 
            metrics: { 
                sumDraft, 
                sumPred, 
                totalPrice, 
                sumSelectedBy, 
                gaTotal, 
                totalCleanSheets, 
                totalXGI, 
                totalDefCon,
                totalPointsFor, // From matches
                totalPointsAgainst,
                tablePoints: wins * 3, // Approx
                wins
            } 
        };
    });
    
    console.log(verificationLog);
    return results;
}

