
css_file = 'style.css'

new_css = """
/* Manual Recommendation Styles */
.manual-recommendation-section {
    background: var(--card-bg);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 30px;
    box-shadow: var(--card-shadow);
    border: 1px solid var(--border-color);
}

.manual-rec-controls h3 {
    margin-bottom: 15px;
    color: var(--text-primary);
}

.manual-rec-input-group {
    display: flex;
    gap: 10px;
    max-width: 600px;
}

.manual-rec-input-group input {
    flex: 1;
    padding: 10px 15px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-primary);
}

.manual-rec-results {
    margin-top: 20px;
}

/* Pitch Size Reduction */
.pitch-wrapper {
    transform: scale(0.9); /* Reduce by 10% */
    transform-origin: top center;
    margin-bottom: -40px; /* Compensate for scale space */
}

.player-pitch-img {
    width: 45px; /* Increase form 35px */
    height: 45px;
    object-fit: cover;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    background: #fff;
    margin-bottom: 2px;
    /* Center face roughly */
    object-position: center 20%; 
}

/* Draft League Table Widths */
.draftStandingsTable th:nth-child(2), /* Manager */
.draftStandingsTable td:nth-child(2),
.draftStandingsTable th:nth-child(3), /* Team */
.draftStandingsTable td:nth-child(3) {
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.draftStandingsTable {
    width: 95%; /* Reduce overall width */
    margin: 0 auto;
}

/* Analytics Comparison Table */
.comparison-table {
    width: 90%;
    margin: 0 auto;
    font-size: 1.1em; /* Increase font size */
}

.comparison-table th, .comparison-table td {
    padding: 12px 15px;
}

/* Chart Colors Separation */
canvas {
    background: transparent; 
}
"""

with open(css_file, 'a', encoding='utf-8') as f:
    f.write(new_css)

print("Appended to style.css")

