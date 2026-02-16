
import re

js_file = 'script.js'

with open(js_file, 'r', encoding='utf-8') as f:
    content = f.read()

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

new_getNextOpponent = """function getNextOpponent(myEntryId) {
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
}"""

content = replace_function(content, 'getNextOpponent', new_getNextOpponent)

with open(js_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated getNextOpponent in script.js")

