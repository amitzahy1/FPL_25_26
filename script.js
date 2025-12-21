// ============================================
// AUTHENTICATION & USER MANAGEMENT
// ============================================

const auth = {
    user: null,
    isDemo: false,
    googleClientId: 'YOUR_GOOGLE_CLIENT_ID',
    allowedEmail: 'amitzahy1@gmail.com',
    
    init() {
        this.renderSubNav();
        const savedUser = localStorage.getItem('fpl_user');
        if (savedUser) {
            this.user = JSON.parse(savedUser);
            if (this.user.email === this.allowedEmail) {
                this.showApp();
            } else {
                this.user.name = this.user.name || 'משתמש';
                this.isDemo = true;
                this.showApp();
            }
        } else {
            this.showLoginScreen();
        }
    },
    
    renderSubNav() {
        const subNav = document.querySelector('.draft-sub-nav');
        if (subNav && !subNav.innerHTML.includes('overview')) {
             subNav.innerHTML = `
                <button class="draft-nav-btn active" onclick="switchDraftTab('overview')">📊 סקירה כללית</button>
                <button class="draft-nav-btn" onclick="switchDraftTab('rival')">⚔️ ניתוח יריבה</button>
                <button class="draft-nav-btn" onclick="switchDraftTab('h2h')">🕒 היסטוריית מפגשים</button>
                <button class="draft-nav-btn" onclick="switchDraftTab('lineup-analysis')">🧠 ניתוח הרכבים</button>
             `;
        }
    },

    showLoginScreen() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('appContent').style.display = 'none';
        this.renderGoogleButton();
    },

    showApp() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appContent').style.display = 'block';
        document.getElementById('userName').textContent = this.user.name;
        initApp();
    },

    renderGoogleButton() {
        if (typeof google !== 'undefined') {
            google.accounts.id.initialize({
                client_id: this.googleClientId,
                callback: (response) => this.handleCredentialResponse(response)
            });
            google.accounts.id.renderButton(document.getElementById('googleBtn'), { theme: 'outline', size: 'large' });
        }
    },

    handleCredentialResponse(response) {
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        this.user = { name: payload.name, email: payload.email };
        localStorage.setItem('fpl_user', JSON.stringify(this.user));
        this.isDemo = (this.user.email !== this.allowedEmail);
        this.showApp();
    }
};

// ============================================
// STATE & DATA
// ============================================

const state = {
    activeDraftTab: 'overview',
    draft: {
        leagueId: 30432,
        elements: {},
        teams: {},
        tableState: {
            sortKey: 'xgi_val', // ברירת מחדל למיון לפי xGI
            sortDir: 'desc',
            filterPos: 'all',
            search: '',
            range: 'all' 
        }
    }
};

async function initApp() {
    await fetchDraftData();
    renderDraftUI();
}

async function fetchDraftData() {
    try {
        const response = await fetch('https://draft.premierleague.com/api/bootstrap-static');
        const data = await response.json();
        
        state.draft.teams = {};
        data.teams.forEach(t => state.draft.teams[t.id] = t);

        state.draft.elements = {};
        data.elements.forEach(p => {
            const mins = p.minutes || 0;
            const factor = mins >= 45 ? (90 / mins) : 0;

            // חישוב מדדים מנורמלים ל-90 דקות
            p.xgi_p90 = factor > 0 ? (parseFloat(p.expected_goal_involvements) * factor).toFixed(2) : "0.00";
            p.ict_p90 = factor > 0 ? (parseFloat(p.ict_index) * factor).toFixed(2) : "0.00";
            p.influence_p90 = factor > 0 ? (parseFloat(p.influence) * factor).toFixed(2) : "0.00";
            p.creativity_p90 = factor > 0 ? (parseFloat(p.creativity) * factor).toFixed(2) : "0.00";
            p.threat_p90 = factor > 0 ? (parseFloat(p.threat) * factor).toFixed(2) : "0.00";
            p.gc_p90 = factor > 0 ? (parseFloat(p.goals_conceded) * factor).toFixed(2) : "0.00";
            p.cs_p90 = factor > 0 ? (parseFloat(p.clean_sheets) * factor).toFixed(2) : "0.00";

            // ערכים נומריים "נקיים" למיון
            p.xgi_val = parseFloat(p.expected_goal_involvements || 0);
            p.ict_val = parseFloat(p.ict_index || 0);
            p.total_points_val = parseInt(p.total_points || 0);
            p.influence_val = parseFloat(p.influence || 0);
            p.creativity_val = parseFloat(p.creativity || 0);
            p.threat_val = parseFloat(p.threat || 0);
            p.gc_val = parseInt(p.goals_conceded || 0);
            p.cs_val = parseInt(p.clean_sheets || 0);

            state.draft.elements[p.id] = p;
        });
    } catch (e) { console.error("Fetch error", e); }
}

// ============================================
// UI LOGIC
// ============================================

function getFilteredPlayers() {
    let players = Object.values(state.draft.elements);
    const { filterPos, search } = state.draft.tableState;

    if (filterPos !== 'all') players = players.filter(p => p.element_type === parseInt(filterPos));
    if (search) players = players.filter(p => p.web_name.toLowerCase().includes(search.toLowerCase()));
    
    return players;
}

function sortPlayers(players) {
    const { sortKey, sortDir } = state.draft.tableState;
    players.sort((a, b) => {
        let aV = a[sortKey];
        let bV = b[sortKey];
        
        // אם זה מספר (כולל מחרוזת של מספר), נמיין מתמטית
        const aNum = parseFloat(aV);
        const bNum = parseFloat(bV);
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
            return sortDir === 'desc' ? bNum - aNum : aNum - bNum;
        }
        
        // מיון טקסטואלי לשמות
        return sortDir === 'desc' 
            ? String(bV).localeCompare(String(aV)) 
            : String(aV).localeCompare(String(bV));
    });
}

function renderDraftUI() {
    if (state.activeDraftTab !== 'overview') return;
    
    const players = getFilteredPlayers();
    sortPlayers(players);
    
    const container = document.getElementById('draftAnalytics');
    if (!container) return;

    container.innerHTML = `
        <div class="table-container">
            <table class="player-table">
                <thead>
                    <tr>
                        <th onclick="setSort('web_name')">שחקן</th>
                        <th onclick="setSort('total_points_val')">נק'</th>
                        <th onclick="setSort('xgi_val')">xGI</th>
                        <th onclick="setSort('xgi_p90')">xGI/90</th>
                        <th onclick="setSort('ict_p90')">ICT/90</th>
                        <th onclick="setSort('influence_p90')">השפעה/90</th>
                        <th onclick="setSort('gc_p90')">ספיגות/90</th>
                        <th onclick="setSort('cs_p90')">נקיים/90</th>
                    </tr>
                </thead>
                <tbody>
                    ${players.slice(0, 40).map(p => `
                        <tr>
                            <td><b>${p.web_name}</b></td>
                            <td>${p.total_points}</td>
                            <td>${p.expected_goal_involvements}</td>
                            <td class="stat-highlight">${p.xgi_p90}</td>
                            <td>${p.ict_p90}</td>
                            <td>${p.influence_p90}</td>
                            <td style="color:#ef4444">${p.gc_p90}</td>
                            <td style="color:#10b981">${p.cs_p90}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    renderMatrices();
}

function renderMatrices() {
    const container = document.getElementById('draftMatrices');
    if (!container) return;
    container.innerHTML = '';

    const filtered = getFilteredPlayers();

    // 1. ICT Matrix (מכבד פילטרים)
    const ictTop = [...filtered].sort((a,b) => b.ict_val - a.ict_val).slice(0, 15);
    createMatrixCard(container, "⚡ מדד ICT (טופ 15 מפלטר)", "ict-chart", ictTop);

    // 2. Goalkeeper Matrix (רק שוערים)
    const gks = Object.values(state.draft.elements).filter(p => p.element_type === 1).sort((a,b) => b.total_points_val - a.total_points_val).slice(0, 10);
    createMatrixCard(container, "🧤 שוערים מובילים", "gk-chart", gks);

    // 3. Defense Matrix (קבוצות)
    createMatrixCard(container, "🛡️ הגנת קבוצות", "def-chart", []);
}

function createMatrixCard(parent, title, id, data) {
    const div = document.createElement('div');
    div.className = 'matrix-card';
    div.innerHTML = `<h4>${title}</h4><div id="${id}" style="height:200px; display:flex; align-items:center; justify-content:center; color:var(--text-secondary); font-size:12px;">גרף ייטען כאן...</div>`;
    parent.appendChild(div);
}

// פונקציות גלובליות לאירועים
window.setSort = (key) => {
    if (state.draft.tableState.sortKey === key) {
        state.draft.tableState.sortDir = state.draft.tableState.sortDir === 'desc' ? 'asc' : 'desc';
    } else {
        state.draft.tableState.sortKey = key;
        state.draft.tableState.sortDir = 'desc';
    }
    renderDraftUI();
};

window.updateDraftFilters = () => {
    state.draft.tableState.filterPos = document.getElementById('posFilter').value;
    state.draft.tableState.search = document.getElementById('playerSearch').value;
    renderDraftUI();
};

window.setRange = (range) => {
    state.draft.tableState.range = range;
    document.querySelectorAll('.range-btn').forEach(b => b.classList.toggle('active', b.dataset.range === range));
    // כאן אפשר להוסיף קריאת API לנתוני מחזורים ספציפיים אם תרצה בעתיד
    renderDraftUI();
};

window.switchDraftTab = (tab) => {
    state.activeDraftTab = tab;
    document.querySelectorAll('.draft-nav-btn').forEach(b => b.classList.toggle('active', b.getAttribute('onclick').includes(tab)));
    renderDraftUI();
};

window.onload = () => auth.init();
