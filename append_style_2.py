
css_file = 'style.css'

new_css = """
/* Lineup Toggles */
.draft-lineup-controls {
    margin-bottom: 15px;
    display: flex;
    justify-content: center;
}

.lineup-toggles {
    background: #f1f5f9;
    padding: 4px;
    border-radius: 10px;
    display: inline-flex;
    gap: 4px;
    border: 1px solid #e2e8f0;
}

.lineup-toggle {
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: #64748b;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.lineup-toggle.active {
    background: white;
    color: #3b82f6;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.lineup-toggle:hover:not(.active) {
    background: rgba(255,255,255,0.5);
    color: #475569;
}

/* Remove xDiff column header if rendered accidentally */
/* This is a CSS fix if HTML update fails, but HTML update is better */
.players-table th:nth-child(20), 
.players-table td:nth-child(20) {
    display: none;
}
"""

with open(css_file, 'a', encoding='utf-8') as f:
    f.write(new_css)

print("Appended to style.css")

