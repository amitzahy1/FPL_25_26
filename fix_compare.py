with open('v3_nov24/script.js', 'r') as f:
    lines = f.readlines()

# Remove old window.compareSelectedPlayers at 1755
# Lines 1755 to 1805 (approx)
start_old = -1
end_old = -1

for i, line in enumerate(lines):
    if 'window.compareSelectedPlayers = function() {' in line and i < 2000:
        start_old = i
    if start_old != -1 and '};' in line and i > start_old and i < 1820:
        end_old = i
        break

if start_old != -1 and end_old != -1:
    print(f"Removing old function at {start_old+1}-{end_old+1}")
    # Replace with comment
    lines[start_old:end_old+1] = ['// Old compare function removed\n']
else:
    print("Old function not found or bounds unclear")

# Find the new compareSelectedPlayers at 2127 (might have shifted due to previous edit if I did it in place, but I'm doing it on loaded lines)
# Since I modified `lines` list, indices shift. I should search again.

# It's safer to write the content to a new list.
new_lines = []
skip = False
for i, line in enumerate(lines):
    if 'window.compareSelectedPlayers = function() {' in line and i < 2000:
        new_lines.append('// Old compare function removed\n')
        skip = True
    elif skip and '};' in line and i < 1820:
        skip = False
    elif not skip:
        new_lines.append(line)

lines = new_lines

# Now find function compareSelectedPlayers()
start_new = -1
end_new = -1

for i, line in enumerate(lines):
    if 'function compareSelectedPlayers() {' in line:
        start_new = i
        break

if start_new != -1:
    # Find end
    brace_count = 0
    for j in range(start_new, len(lines)):
        brace_count += lines[j].count('{')
        brace_count -= lines[j].count('}')
        if brace_count == 0:
            end_new = j
            break
            
    if end_new != -1:
        print(f"Replacing function at {start_new+1}-{end_new+1}")
        
        new_func_code = """function compareSelectedPlayers() {
    console.log("⚖️ compareSelectedPlayers() called");
    try {
        // Get all checked checkboxes
        const checkboxes = document.querySelectorAll('.player-select:checked');
        console.log(`Found ${checkboxes.length} selected players`);
        
        if (checkboxes.length === 0) {
            showToast('לא נבחרו שחקנים', 'אנא בחר לפחות שחקן אחד להשוואה', 'warning', 3000);
            return;
        }
        
        if (checkboxes.length > 5) {
            showToast('יותר מדי שחקנים', 'ניתן להשוות עד 5 שחקנים בו-זמנית', 'warning', 3000);
            return;
        }
        
        // Get player IDs
        const playerIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.playerId));
        console.log("Selected IDs:", playerIds);
        
        // Get player data - try both displayedData and allPlayersData
        let players = [];
        if (state.displayedData && state.displayedData.length > 0) {
            players = playerIds.map(id => state.displayedData.find(p => p.id === id)).filter(Boolean);
        }
        
        // Fallback to all data if not found in displayed (e.g. after filter clear)
        if (players.length < playerIds.length) {
            const allPlayers = state.allPlayersData[state.currentDataSource]?.processed || [];
            const foundIds = players.map(p => p.id);
            const missingIds = playerIds.filter(id => !foundIds.includes(id));
            const foundMissing = missingIds.map(id => allPlayers.find(p => p.id === id)).filter(Boolean);
            players = [...players, ...foundMissing];
        }
        
        if (players.length === 0) {
            console.error("❌ No player data found for IDs:", playerIds);
            showToast('שגיאה', 'לא נמצאו נתוני שחקנים. נסה לרענן את הדף.', 'error', 3000);
            return;
        }
        
        // Create modal
        const existingModal = document.getElementById('compareModal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'compareModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(4px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            padding: 20px;
        `;
        
        // Comparison metrics
        const metrics = [
            { key: 'draft_score', label: '🏆 ציון דראפט', format: (v) => v?.toFixed(1) || '0' },
            { key: 'predicted_points_1_gw', label: '📈 חיזוי GW הבא', format: (v) => v?.toFixed(1) || '0' },
            { key: 'total_points', label: '⚽ סה"כ נקודות', format: (v) => v || '0' },
            { key: 'points_per_game', label: '📊 נק\\'/משחק', format: (v) => (typeof v === 'number' ? v.toFixed(1) : v) || '0' },
            { key: 'form', label: '🔥 כושר', format: (v) => v || '0' },
            { key: 'now_cost', label: '💰 מחיר', format: (v) => `£${(v / 10).toFixed(1)}m` },
            { key: 'selected_by_percent', label: '👥 נבחר %', format: (v) => `${v}%` },
            { key: 'expected_goal_involvements', label: '🎯 xGI', format: (v) => parseFloat(v || 0).toFixed(2) },
            { key: 'goals_scored', label: '⚽ שערים', format: (v) => v || '0' },
            { key: 'assists', label: '🅰️ בישולים', format: (v) => v || '0' },
            { key: 'clean_sheets', label: '🛡️ משחקי אפס', format: (v) => v || '0' },
            { key: 'bonus', label: '⭐ בונוס', format: (v) => v || '0' },
            { key: 'minutes', label: '⏱️ דקות', format: (v) => v || '0' },
            { key: 'ict_index', label: '📈 ICT', format: (v) => v || '0' }
        ];
        
        let tableHTML = `
            <div class="modal-content" style="background: white; border-radius: 16px; max-width: 1000px; width: 100%; max-height: 90vh; overflow: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3); display: flex; flex-direction: column;">
                <div style="position: sticky; top: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 16px 16px 0 0; z-index: 100; flex-shrink: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h2 style="margin: 0; color: white; font-size: 24px; font-weight: 900;">⚖️ השוואת שחקנים</h2>
                        <button onclick="closeModal()" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 24px; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">✕</button>
                    </div>
                </div>
                
                <div style="padding: 24px; overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                                <th style="padding: 16px; text-align: right; font-weight: 800; color: #0f172a; position: sticky; right: 0; background: #f8fafc; z-index: 10;">מדד</th>
                                ${players.map(p => `
                                    <th style="padding: 16px; text-align: center; min-width: 150px;">
                                        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                                            <img src="${getPlayerPhotoUrl(p.code)}" 
                                                 onerror="this.src='https://resources.premierleague.com/premierleague/photos/players/110x140/p144485.png'" 
                                                 style="width: 60px; height: 60px; border-radius: 50%; border: 3px solid #e2e8f0; object-fit: cover;">
                                            <div style="font-weight: 800; color: #0f172a; font-size: 14px;">${p.web_name}</div>
                                            <div style="font-size: 12px; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 10px;">${p.team_name}</div>
                                        </div>
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${metrics.map(metric => `
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 16px; font-weight: 700; color: #64748b; position: sticky; right: 0; background: white; z-index: 10;">${metric.label}</td>
                                    ${players.map(p => `
                                        <td style="padding: 16px; text-align: center; color: #0f172a; font-weight: 600;">
                                            ${metric.format(p[metric.key])}
                                        </td>
                                    `).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        modal.innerHTML = tableHTML;
        
        // Close on click outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        
    } catch (err) {
        console.error("Error in compareSelectedPlayers:", err);
        showToast('שגיאה', 'אירעה שגיאה בטעינת ההשוואה', 'error', 3000);
    }
}

window.compareSelectedPlayers = compareSelectedPlayers;
"""
        lines[start_new:end_new+1] = [new_func_code + '\n']

with open('v3_nov24/script.js', 'w') as f:
    f.writelines(lines)

print("Successfully fixed compareSelectedPlayers")

