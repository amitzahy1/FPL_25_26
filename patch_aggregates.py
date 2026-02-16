with open('v3_nov24/script.js', 'r') as f:
    lines = f.readlines()

with open('temp_aggregates_func.js', 'r') as f:
    new_func = f.readlines()

# Find function computeDraftTeamAggregates
start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if 'function computeDraftTeamAggregates() {' in line:
        start_idx = i
        break

if start_idx != -1:
    # Find end
    brace_count = 0
    for j in range(start_idx, len(lines)):
        brace_count += lines[j].count('{')
        brace_count -= lines[j].count('}')
        if brace_count == 0:
            end_idx = j
            break
            
    if end_idx != -1:
        print(f"Replacing function at {start_idx+1}-{end_idx+1}")
        lines[start_idx:end_idx+1] = new_func
    else:
        print("End of function not found")
else:
    print("Start of function not found")

with open('v3_nov24/script.js', 'w') as f:
    f.writelines(lines)

print("Successfully patched computeDraftTeamAggregates")

