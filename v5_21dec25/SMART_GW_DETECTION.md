# 🎯 Smart GW Detection - Version 4.1
## December 2, 2025

---

## 🔧 Problem Statement

**Original Issue:**
- User wanted to see the **most up-to-date roster** (including players bought after current GW ended)
- But Draft API doesn't create GW14 endpoint until the gameweek officially starts
- This caused 404 errors and prevented roster updates from showing

**User's Request:**
> "תמצא דרך לזהות מה השחקנים במחזור הכי גבוה, ולהשתמש בהם כדי להבין מה השחקנים של כל קבוצה"

---

## 💡 Solution: Smart GW Detection

Instead of blindly trying `is_next` or `is_current`, we now:

1. **Query bootstrap-static API** to get `is_next` and `is_current` GWs
2. **Test both GWs** (starting with `is_next`) by making a real API call to the Draft API
3. **Use the highest GW that actually returns data** (200 OK)
4. **Apply this verified GW to all teams** - no per-team fallback needed

---

## 📝 Implementation Details

### Main Function: `loadDraftLeague()`

```javascript
// 🔧 SMART GW DETECTION: Find the highest GW with actual draft data available
let draftGw = getCurrentEventId(); // Start with fallback
let actualDataGw = null;

try {
    const bootstrapUrl = 'https://fantasy.premierleague.com/api/bootstrap-static/';
    const bootstrapResponse = await fetch(config.corsProxy + encodeURIComponent(bootstrapUrl));
    const bootstrapData = await bootstrapResponse.json();
    
    if (bootstrapData && bootstrapData.events) {
        const currentEvent = bootstrapData.events.find(e => e.is_current);
        const nextEvent = bootstrapData.events.find(e => e.is_next);
        
        // 🎯 Build priority list: try next GW first (for latest roster), then current
        const gwsToTry = [];
        if (nextEvent) gwsToTry.push({ id: nextEvent.id, label: 'NEXT' });
        if (currentEvent) gwsToTry.push({ id: currentEvent.id, label: 'CURRENT' });
        
        console.log(`🔍 Testing GW availability (priority order): ${gwsToTry.map(g => `GW${g.id} (${g.label})`).join(', ')}`);
        
        // 🧪 Test which GW actually has data by trying first team
        const testEntry = leagueEntries[0];
        if (testEntry && testEntry.entry_id) {
            for (const gw of gwsToTry) {
                try {
                    const testUrl = config.urls.draftEntryPicks(testEntry.entry_id, gw.id);
                    const testResponse = await fetch(config.corsProxy + encodeURIComponent(testUrl));
                    if (testResponse.ok) {
                        actualDataGw = gw.id;
                        console.log(`✅ GW${gw.id} (${gw.label}) has data available! Using this for all teams.`);
                        break;
                    } else {
                        console.log(`⚠️ GW${gw.id} (${gw.label}) returned ${testResponse.status}, trying next...`);
                    }
                } catch (err) {
                    console.log(`⚠️ GW${gw.id} (${gw.label}) test failed: ${err.message}`);
                }
            }
        }
        
        // Use the verified GW, or fallback to current event
        draftGw = actualDataGw || currentEvent?.id || draftGw;
        console.log(`📅 FINAL DECISION: Using GW${draftGw} (verified with actual Draft API data)`);
    }
} catch (err) {
    console.warn('⚠️ Could not fetch bootstrap-static, using fallback:', err.message);
}
```

### Background Load: `loadDraftInBackground()`

Same logic applied to background loading for the main players page.

---

## ✅ Benefits

1. **Always shows latest roster** - Tries GW14 first if it exists
2. **Graceful fallback** - Falls back to GW13 if GW14 not available yet
3. **Single verification** - Tests once, applies to all teams (efficient!)
4. **Future-proof** - Works for GW18, GW25, any future gameweek
5. **No hardcoded values** - Fully dynamic based on FPL API state

---

## 🎯 Expected Console Output

### Scenario 1: GW14 Not Available Yet (Current State)
```
🔍 Testing GW availability (priority order): GW14 (NEXT), GW13 (CURRENT)
⚠️ GW14 (NEXT) returned 404, trying next...
✅ GW13 (CURRENT) has data available! Using this for all teams.
📅 FINAL DECISION: Using GW13 (verified with actual Draft API data)
📥 Fetching picks for Amit United (Entry ID: 1889, GW: 13)
   ⏳ Fetching from verified GW13...
   ✅ Received 15 picks for Amit United
🏆 AMIT UNITED ROSTER (15 players):
   1. Hall (Newcastle) - FPL ID: XXX ← Updated roster!
   ...
```

### Scenario 2: GW14 Available (After Deadline)
```
🔍 Testing GW availability (priority order): GW14 (NEXT), GW13 (CURRENT)
✅ GW14 (NEXT) has data available! Using this for all teams.
📅 FINAL DECISION: Using GW14 (verified with actual Draft API data)
📥 Fetching picks for Amit United (Entry ID: 1889, GW: 14)
   ⏳ Fetching from verified GW14...
   ✅ Received 15 picks for Amit United
🏆 AMIT UNITED ROSTER (15 players):
   1. Hall (Newcastle) - FPL ID: XXX
   ...
```

---

## 📊 Files Changed

- `v4_26nov25/script.js`:
  - Lines 3537-3584: `loadDraftLeague()` - Smart GW detection
  - Lines 3606-3614: Removed per-team fallback (no longer needed)
  - Lines 3322-3368: `loadDraftInBackground()` - Same smart detection

---

## 🚀 Testing Instructions

1. **Clear cache and reload:**
   ```javascript
   localStorage.clear();
   location.reload();
   ```

2. **Navigate to Draft page** and check console for:
   - `🔍 Testing GW availability...`
   - `✅ GW13 (CURRENT) has data available!`
   - `🏆 AMIT UNITED ROSTER` with correct players (Hall, not Robertson)

3. **Verify roster updates:**
   - Check "נתוני שחקנים" page filtered by "Amit United"
   - Check Draft page roster display
   - Confirm Hall appears instead of Robertson

---

## 🎉 Result

**User now sees the most up-to-date roster available**, with the system intelligently detecting which gameweek has actual data, regardless of whether the next gameweek has officially started or not!

