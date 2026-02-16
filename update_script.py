
import re

js_file = 'script.js'

with open(js_file, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix createPlayerRowHtml
# Regex to find the function block. Using a simple start marker and assuming balanced braces is hard in regex,
# so we'll just replace the known bad block if we can find it, OR replace the whole function by finding its start and end.
# Given the file size, exact string replacement is safer if we construct the regex carefully.

# We'll use a more robust approach: locate the function start, find the matching closing brace, and replace.
def replace_function(content, func_name, new_code):
    pattern = r'function\s+' + re.escape(func_name) + r'\s*\([^)]*\)\s*\{'
    match = re.search(pattern, content)
    if not match:
        print(f"Could not find function {func_name}")
        return content
    
    start_idx = match.start()
    # Find matching brace
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

new_createPlayerRowHtml = """function createPlayerRowHtml(player, index) {
    const icons = generatePlayerIcons(player);
    const fixturesHTML = generateFixturesHTML(player);
    const isChecked = state.selectedForComparison.has(player.id) ? 'checked' : '';
    
    // Get draft team
    const draftTeam = getDraftTeamForPlayer(player.id);
    const draftTeamDisplay = draftTeam || '🆓 חופשי';
    const draftTeamClass = draftTeam ? 'draft-owned' : 'draft-free';

    return `<tr>
        <td><input type="checkbox" class="player-select" data-player-id="${player.id}" ${isChecked}></td>
        <td>${index + 1}</td>
        <td class="name-cell"><span class="player-name-icon">${icons.icons}</span>${player.web_name}</td>
        <td class="bold-cell stability-cell">${(player.stability_index || 0).toFixed(0)}</td>
        <td class="bold-cell" title="חיזוי טכני: ${(player.predicted_points_1_gw || 0).toFixed(1)} נקודות">${(player.predicted_points_1_gw || 0).toFixed(1)}</td>
        <td>${player.team_name}</td>
        <td class="${draftTeamClass}" title="${draftTeamDisplay}">${draftTeamDisplay}</td>
        <td>${player.position_name}</td>
        <td>${player.now_cost.toFixed(1)}</td>
        <td>${player.total_points}</td>
        <td>${player.points_per_game_90.toFixed(1)}</td>
        <td>${player.selected_by_percent}%</td>
        <td>${player.dreamteam_count}</td>
        <td class="transfers-cell" data-tooltip="${config.columnTooltips.net_transfers_event}"><span class="${player.net_transfers_event >= 0 ? 'net-transfers-positive' : 'net-transfers-negative'}">${player.net_transfers_event.toLocaleString()}</span></td>
        <td data-tooltip="${config.columnTooltips.def_contrib_per90}">${player.def_contrib_per90.toFixed(1)}</td>
        <td>${(player.goals_scored || 0) + (player.assists || 0)}</td>
        <td>${(parseFloat(player.expected_goal_involvements) || 0).toFixed(1)}</td>
        <td>${player.minutes}</td>
        <td class="${player.xDiff >= 0 ? 'xdiff-positive' : 'xdiff-negative'}" data-tooltip="${config.columnTooltips.xDiff}">${player.xDiff.toFixed(2)}</td>
        <td>${player.bonus}</td>
        <td>${player.clean_sheets}</td>
        <td class="${player.set_piece_priority.penalty === 1 ? 'set-piece-yes' : 'set-piece-no'}">${player.set_piece_priority.penalty === 1 ? '🎯 (1)' : '–'}</td>
        <td class="${player.set_piece_priority.corner > 0 ? 'set-piece-yes' : 'set-piece-no'}">${player.set_piece_priority.corner > 0 ? `(${player.set_piece_priority.corner})` : '–'}</td>
        <td class="${player.set_piece_priority.free_kick > 0 ? 'set-piece-yes' : 'set-piece-no'}">${player.set_piece_priority.free_kick > 0 ? `(${player.set_piece_priority.free_kick})` : '–'}</td>
        <td class="fixtures-cell">${fixturesHTML}</td>
    </tr>`;
}"""

new_loadDraftLeague = """async function loadDraftLeague() {
    showLoading('טוען ליגת דראפט...');
    const draftContainer = document.getElementById('draftTabContent');
    
    // Clear containers
    const myLineupContainer = document.getElementById('myLineupContainer');
    const otherRostersContainer = document.getElementById('otherRosters');
    if (myLineupContainer) myLineupContainer.innerHTML = '';
    if (otherRostersContainer) otherRostersContainer.innerHTML = '';

    try {
        // Ensure base data
        if (state.currentDataSource === 'demo') {
            if (!state.allPlayersData.demo || !state.allPlayersData.demo.processed) {
                showToast('שגיאה', 'נתוני דמו לא נטענו.', 'error', 3000);
                hideLoading();
                return;
            }
        } else if (!state.allPlayersData.live.raw && !state.allPlayersData.historical.raw) {
            await fetchAndProcessData();
        }
        
        if (state.draft.draftToFplIdMap.size === 0) {
            await buildDraftToFplMapping();
        }

        const detailsCacheKey = `fpl_draft_details_${config.draftLeagueId}`;
        const standingsCacheKey = `fpl_draft_standings_${config.draftLeagueId}`;
        
        const encodedDetails = config.corsProxy + encodeURIComponent(config.urls.draftLeagueDetails(config.draftLeagueId));
        const encodedStandings = config.corsProxy + encodeURIComponent(config.urls.draftLeagueStandings(config.draftLeagueId));

        // Fetch Details (Critical)
        const detailsData = await fetchWithCache(encodedDetails, detailsCacheKey, 5);
        state.draft.details = detailsData;
        
        // Fetch Standings (Non-Critical - Handle 404)
        try {
            const standingsData = await fetchWithCache(encodedStandings, standingsCacheKey, 5);
            state.draft.standings = standingsData;
        } catch (e) {
            console.warn("Standings fetch failed (likely 404), proceeding with mock/empty standings", e);
            state.draft.standings = { standings: [] };
        }
        
        state.draft.entryIdToTeamName = new Map((state.draft.details?.league_entries || []).filter(e=>e && e.entry_name).map(e => [e.id, e.entry_name]));
        
        // Fetch Rosters (Robust V4)
        try {
            state.draft.rostersByEntryId.clear();
            state.draft.ownedElementIds.clear();
            const leagueEntries = state.draft.details?.league_entries || [];
            const draftGw = state.draft.details?.league?.current_event || getCurrentEventId();

            const picksPromises = leagueEntries.map(async (entry) => {
                if (!entry || !entry.entry_id || !entry.id) return;
                const url = config.corsProxy + encodeURIComponent(config.urls.draftEntryPicks(entry.entry_id, draftGw));
                const picksCacheKey = `fpl_draft_picks_final_v4_${entry.entry_id}_gw${draftGw}`;
                try {
                    const picksData = await fetchWithCache(url, picksCacheKey, 5);
                    if (picksData && picksData.picks) {
                        const picksWithFplIds = picksData.picks.map(pick => ({
                            fplId: state.draft.draftToFplIdMap.get(pick.element) || pick.element,
                            position: pick.position
                        }));
                        const fplPlayerIds = picksWithFplIds.map(p => p.fplId);
                        state.draft.rostersByEntryId.set(entry.id, fplPlayerIds);
                        
                        const starting = picksWithFplIds.filter(p => p.position >= 1 && p.position <= 11).map(p => p.fplId);
                        const bench = picksWithFplIds.filter(p => p.position >= 12 && p.position <= 15).map(p => p.fplId);
                        state.draft.lineupsByEntryId.set(entry.id, { starting, bench });
                    } else {
                         state.draft.rostersByEntryId.set(entry.id, []);
                         state.draft.lineupsByEntryId.set(entry.id, { starting: [], bench: [] });
                    }
                } catch (err) {
                    console.error(`Failed to fetch picks for ${entry.id}`, err);
                    state.draft.rostersByEntryId.set(entry.id, []);
                    state.draft.lineupsByEntryId.set(entry.id, { starting: [], bench: [] });
                }
            });
            await Promise.all(picksPromises);

            for (const fplPlayerIds of state.draft.rostersByEntryId.values()) {
                fplPlayerIds.forEach(fplId => state.draft.ownedElementIds.add(fplId));
            }
        } catch (rosterErr) {
            console.error("Error fetching rosters:", rosterErr);
        }

        updateDraftHeroSection();
        renderDraftStandings();
        renderDraftAnalytics();
        renderDraftMatrices([]); 
        renderRecommendations();
        renderDraftComparison([]);
        renderDraftRosters();
        
        populateMyTeamSelector();
        if (!state.draft.myTeamId && state.draft.details?.league_entries?.length > 0) {
             const myEntry = state.draft.details.league_entries.find(e => e.player_first_name.includes('Amit') || e.entry_name.includes('Amit')) || state.draft.details.league_entries[0];
             if (myEntry) {
                 setMyTeam(myEntry.id);
                 const select = document.getElementById('myTeamSelect');
                 if(select) select.value = myEntry.id;
             }
        }

    } catch (error) {
        console.error('Error loading draft league data:', error);
        showToast('שגיאה', 'לא ניתן לטעון נתונים אמיתיים. טוען דמו.', 'warning');
        const mockData = generateMockDraftData();
        state.draft.details = mockData.details;
        state.draft.standings = mockData.standings;
        updateDraftHeroSection();
        renderDraftStandings();
        renderDraftAnalytics();
        renderDraftMatrices([]);
        renderRecommendations();
        renderDraftComparison([]);
        renderDraftRosters();
        populateMyTeamSelector();
        if (state.draft.details.league_entries.length > 0) {
             setMyTeam(state.draft.details.league_entries[0].id);
             const select = document.getElementById('myTeamSelect');
             if(select) select.value = state.draft.details.league_entries[0].id;
        }
    } finally {
        hideLoading();
    }
}"""

content = replace_function(content, 'createPlayerRowHtml', new_createPlayerRowHtml)
content = replace_function(content, 'loadDraftLeague', new_loadDraftLeague)

with open(js_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated script.js")

