
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

# --- Improved getChartConfig (Safe Parsing) ---
new_getChartConfig = """function getChartConfig(data, xKey, yKey, xLabel, yLabel, quadLabels = {}, colorFunc = null, dataLabelFunc = null) {
    const dataPoints = data.map(d => {
        // Safely parse values to numbers, default to 0 if NaN/Invalid
        const rawX = getNestedValue(d, xKey);
        const rawY = getNestedValue(d, yKey);
        const x = parseFloat(rawX) || 0;
        const y = parseFloat(rawY) || 0;
        
        return { x, y, ...d };
    });

    const xValues = dataPoints.map(p => p.x);
    const yValues = dataPoints.map(p => p.y);
    
    // Calculate medians safely
    xValues.sort((a,b) => a-b);
    yValues.sort((a,b) => a-b);
    const xMedian = xValues.length > 0 ? xValues[Math.floor(xValues.length / 2)] : 0;
    const yMedian = yValues.length > 0 ? yValues[Math.floor(yValues.length / 2)] : 0;

    return {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Players',
                data: dataPoints,
                pointRadius: 6,
                pointHoverRadius: 9,
                pointBorderWidth: 2,
                pointBorderColor: 'rgba(255, 255, 255, 0.9)',
                backgroundColor: colorFunc ? colorFunc : (context) => {
                    if (!context.raw) return 'rgba(156, 163, 175, 0.7)';
                    const point = context.raw;
                    if (point.x >= xMedian && point.y >= yMedian) {
                        return 'rgba(34, 197, 94, 0.85)'; // Green - Best
                    } else if (point.x < xMedian && point.y < yMedian) {
                        return 'rgba(239, 68, 68, 0.85)'; // Red - Worst
                    } else {
                        return 'rgba(251, 146, 60, 0.85)'; // Orange - Medium
                    }
                },
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 30, right: 20, bottom: 10, left: 10 }
            },
            scales: {
                x: { 
                    title: { 
                        display: true, 
                        text: xLabel, 
                        font: { size: 13.8, weight: '700' },
                        color: '#475569'
                    },
                    ticks: {
                        font: { size: 11.5, weight: '600' },
                        color: '#64748b'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                y: { 
                    title: { 
                        display: true, 
                        text: yLabel, 
                        font: { size: 13.8, weight: '700' },
                        color: '#475569'
                    },
                    ticks: {
                        font: { size: 11.5, weight: '600' },
                        color: '#64748b'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#e2e8f0',
                    borderColor: 'rgba(2, 132, 199, 0.5)',
                    borderWidth: 2,
                    padding: 16,
                    displayColors: false,
                    titleFont: { size: 15, weight: '700' },
                    bodyFont: { size: 13.8 },
                    footerFont: { size: 14 },
                    callbacks: {
                        label: function(context) {
                            const d = context.raw;
                            // Ensure d.x and d.y are numbers before calling toFixed
                            const xVal = typeof d.x === 'number' ? d.x : parseFloat(d.x);
                            const yVal = typeof d.y === 'number' ? d.y : parseFloat(d.y);
                            const name = d.web_name || d.player || d.team || 'Point';
                            
                            return `${name}: (${!isNaN(xVal) ? xVal.toFixed(2) : '?'}, ${!isNaN(yVal) ? yVal.toFixed(2) : '?'})`;
                        },
                        title: function(context) {
                            return ''; // Hide default title
                        },
                        footer: function(context) {
                            const d = context[0].raw;
                            if (d.position_name || d.pos) {
                                 return `Position: ${d.position_name || d.pos}`;
                            }
                            if (d.team_name) {
                                return `Team: ${d.team_name}`;
                            }
                            return '';
                        }
                    }
                },
                datalabels: {
                    display: 'auto', // Prevent overlap
                    align: 'top',
                    offset: 4,
                    color: '#1e293b',
                    font: { size: 9.7, weight: '700' },
                    backgroundColor: null,
                    borderWidth: 0,
                    formatter: (value, context) => {
                        const dataPoint = context.dataset.data[context.dataIndex];
                        if (dataLabelFunc) {
                            return dataLabelFunc(dataPoint);
                        }
                        // Return player name (web_name) or team name
                        return dataPoint.web_name || dataPoint.player || dataPoint.team || '';
                    },
                },
                annotation: {
                    annotations: {
                        xLine: { 
                            type: 'line', 
                            xMin: xMedian, 
                            xMax: xMedian, 
                            borderColor: 'rgba(0,0,0,0.2)', 
                            borderWidth: 2, 
                            borderDash: [6, 6] 
                        },
                        yLine: { 
                            type: 'line', 
                            yMin: yMedian, 
                            yMax: yMedian, 
                            borderColor: 'rgba(0,0,0,0.2)', 
                            borderWidth: 2, 
                            borderDash: [6, 6] 
                        },
                        ...(quadLabels.topRight && {
                            topRight: { 
                                type: 'label', 
                                xValue: xMedian, // Align relative to median, adjust with offset
                                yValue: yMedian, 
                                content: quadLabels.topRight, 
                                position: 'center',
                                xAdjust: 40, // Hardcoded offset for Top-Right relative to center
                                yAdjust: -20,
                                font: { size: 10.4, weight: '700' }, 
                                color: 'rgba(34, 197, 94, 0.8)',
                                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                borderRadius: 3,
                                padding: 4
                            }
                        }),
                        ...(quadLabels.topLeft && {
                            topLeft: { 
                                type: 'label', 
                                xValue: xMedian, 
                                yValue: yMedian, 
                                content: quadLabels.topLeft, 
                                position: 'center',
                                xAdjust: -40,
                                yAdjust: -20,
                                font: { size: 10.4, weight: '700' }, 
                                color: 'rgba(251, 146, 60, 0.8)',
                                backgroundColor: 'rgba(251, 146, 60, 0.1)',
                                borderRadius: 3,
                                padding: 4
                            }
                        }),
                        ...(quadLabels.bottomRight && {
                            bottomRight: { 
                                type: 'label', 
                                xValue: xMedian, 
                                yValue: yMedian, 
                                content: quadLabels.bottomRight, 
                                position: 'center',
                                xAdjust: 40, 
                                yAdjust: 20, 
                                font: { size: 10.4, weight: '700' }, 
                                color: 'rgba(251, 146, 60, 0.8)',
                                backgroundColor: 'rgba(251, 146, 60, 0.1)',
                                borderRadius: 3,
                                padding: 4
                            }
                        }),
                        ...(quadLabels.bottomLeft && {
                            bottomLeft: { 
                                type: 'label', 
                                xValue: xMedian, 
                                yValue: yMedian, 
                                content: quadLabels.bottomLeft, 
                                position: 'center',
                                xAdjust: -40,
                                yAdjust: 20,
                                font: { size: 10.4, weight: '700' }, 
                                color: 'rgba(239, 68, 68, 0.8)',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                borderRadius: 3,
                                padding: 4
                            }
                        })
                    }
                }
            }
        }
    };
}"""

content = replace_function(content, 'getChartConfig', new_getChartConfig)

with open(js_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated getChartConfig in script.js with safe parsing and updated annotations")

