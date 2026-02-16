
js_file = 'script.js'

diagnose_code = """
// ==========================================
// DIAGNOSTICS TOOL
// ==========================================
window.diagnoseApp = function() {
    console.group("🕵️ FPL Pro Analytics Diagnostics");
    
    console.log("📊 Data Source:", state.currentDataSource);
    console.log("📥 All Players Data:", state.allPlayersData[state.currentDataSource]);
    
    console.log("🏗️ Draft State:", {
        details: state.draft.details,
        standings: state.draft.standings,
        rosters: state.draft.rostersByEntryId,
        lineups: state.draft.lineupsByEntryId,
        myTeamId: state.draft.myTeamId
    });
    
    if (state.draft.details) {
        console.group("📅 Draft Matches Check");
        const matches = state.draft.details.matches;
        if (!matches) {
            console.error("❌ No matches found in draft details! (Is this a Classic league?)");
        } else {
            const currentGw = state.draft.details.league.current_event;
            const futureMatches = matches.filter(m => m.event >= currentGw);
            console.log(`Total Matches: ${matches.length}`);
            console.log(`Current GW: ${currentGw}`);
            console.log(`Future/Current Matches Found: ${futureMatches.length}`);
            if (futureMatches.length > 0) {
                console.log("Next Match Example:", futureMatches[0]);
            } else {
                console.warn("⚠️ No future matches found!");
            }
        }
        console.groupEnd();
    }

    console.log("📉 Charts State:", state.draft.charts);
    
    console.groupEnd();
    return "Diagnostics complete. Check console logs.";
};
"""

with open(js_file, 'a', encoding='utf-8') as f:
    f.write(diagnose_code)

print("Appended diagnoseApp to script.js")
