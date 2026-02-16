with open('v3_nov24/script.js', 'r') as f:
    lines = f.readlines()

with open('temp_rival_func.js', 'r') as f:
    new_func = f.readlines()

# Replace lines 6641 to 7224 (0-indexed: 6640 to 7224)
# Line 6641 is index 6640.
# Line 7224 is index 7223.
# So we want to replace lines[6640:7224]

# Verify start line
if 'function renderNextRivalAnalysis' not in lines[6640]:
    print(f"Error: Start line mismatch. Expected function definition, got: {lines[6640]}")
    exit(1)

# Verify end line
if '}' not in lines[7223]:
    print(f"Error: End line mismatch. Expected closing brace, got: {lines[7223]}")
    # Try to find the closing brace nearby
    for i in range(7220, 7230):
        if lines[i].strip() == '}':
            print(f"Found closing brace at line {i+1}")
            break

# Actually we should look for the end of the function.
# The `read_file` output showed line 7224 was `}`.
# Python slice is [start:end] where end is exclusive.
# So lines[6640:7224] covers lines 6641 to 7224.

lines[6640:7224] = new_func

with open('v3_nov24/script.js', 'w') as f:
    f.writelines(lines)

print("Successfully patched script.js")

