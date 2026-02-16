
with open('script.js', 'a', encoding='utf-8') as f:
    f.write("\nwindow.handleManualPlayerSelect = handleManualPlayerSelect;\n")
    f.write("window.getBestReplacements = getBestReplacements;\n")
    f.write("window.getProcessedPlayers = getProcessedPlayers;\n")

print("Attached functions to window object")

