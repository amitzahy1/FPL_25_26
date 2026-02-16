
lines = open('script.js').readlines()
# Check line 2702 (0-indexed) -> line 2703 in file
print(f"Line 2703: {lines[2702]}")
# Check line 2703 (0-indexed) -> line 2704 in file
print(f"Line 2704: {lines[2703]}")

# Insert '}' at index 2703 (line 2704)
lines.insert(2703, "}\n")

with open('script.js', 'w') as f:
    f.writelines(lines)

print("Inserted missing closing brace.")

