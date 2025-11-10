// ============================================
// AUTHENTICATION & USER MANAGEMENT
// ============================================

const auth = {
    user: null,
    isDemo: false,
    googleClientId: 'YOUR_GOOGLE_CLIENT_ID', // Replace with your actual Google Client ID
    allowedEmail: 'amitzahy1@gmail.com', // Only this email can access real data
    
    init() {
        // Check if user is already logged in (from localStorage)
        const savedUser = localStorage.getItem('fpl_user');
        if (savedUser) {
            this.user = JSON.parse(savedUser);
            // Check if user is authorized
            if (this.user.email === this.allowedEmail) {
                this.showApp();
            } else {
                // Unauthorized user - force demo mode
                this.user.name = this.user.name || 'משתמש';
                this.isDemo = true;
                this.showApp();
            }
        } else {
            this.showLoginScreen();
        }
    },
    
    showLoginScreen() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        
        // Setup Google Sign-In button
        document.getElementById('googleSignInBtn').addEventListener('click', () => {
            this.googleSignIn();
        });
        
        // Setup Demo Mode button
        document.getElementById('demoModeBtn').addEventListener('click', () => {
            this.enterDemoMode();
        });
    },
    
    showApp() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        
        // Show user info
        if (this.user) {
            const userInfo = document.getElementById('userInfo');
            userInfo.style.display = 'flex';
            
            // Set user photo or create initial circle
            const userPhoto = document.getElementById('userPhoto');
            if (this.user.picture && this.user.picture !== 'https://via.placeholder.com/40') {
                userPhoto.src = this.user.picture;
                userPhoto.style.display = 'block';
                userPhoto.onerror = () => {
                    // If image fails to load, hide it and show initial
                    userPhoto.style.display = 'none';
                    this.createUserInitial(this.user.name);
                };
            } else {
                userPhoto.style.display = 'none';
                this.createUserInitial(this.user.name);
            }
            
            document.getElementById('userName').textContent = this.user.name;
            // Show appropriate mode badge
            if (this.isDemo && this.user.email === 'demo@fpl.com') {
                document.getElementById('userMode').textContent = '🎭 מצב דמו';
            } else if (this.isDemo) {
                document.getElementById('userMode').textContent = '👁️ תצוגה בלבד';
            } else {
                document.getElementById('userMode').textContent = '✅ גישה מלאה';
            }
            
            // Setup logout button
            document.getElementById('logoutBtn').addEventListener('click', () => {
                this.logout();
            });
        }
        
        // Load data based on mode
        if (this.isDemo) {
            // Demo mode: show fabricated data with real player names
            loadDemoData();
        } else {
            // Full access: show real data
            init();
        }
    },
    
    createUserInitial(name) {
        // Remove existing initial if any
        const existingInitial = document.querySelector('.user-initial');
        if (existingInitial) existingInitial.remove();
        
        // Create initial circle
        const initial = document.createElement('div');
        initial.className = 'user-initial';
        initial.textContent = name.charAt(0).toUpperCase();
        
        // Insert before user details
        const userInfo = document.getElementById('userInfo');
        const userDetails = userInfo.querySelector('.user-details');
        userInfo.insertBefore(initial, userDetails);
    },
    
    googleSignIn() {
        // For demo purposes, simulate Google Sign-In
        // In production, use Google Identity Services
        showToast('התחברות', 'מתחבר עם Google...', 'info', 2000);
        
        setTimeout(() => {
            // Simulate Google Sign-In response
            // In production, this will come from Google Identity Services
            const googleUser = {
                name: 'Amit Zahy',
                email: 'amitzahy1@gmail.com', // Change this to test different users
                picture: 'https://via.placeholder.com/40'
            };
            
            this.user = googleUser;
            
            // Check if user is authorized for real data
            if (this.user.email === this.allowedEmail) {
                this.isDemo = false;
                localStorage.setItem('fpl_user', JSON.stringify(this.user));
                showToast('הצלחה!', `ברוך הבא ${this.user.name}! גישה מלאה לנתונים אמיתיים`, 'success', 3000);
            } else {
                this.isDemo = true;
                localStorage.setItem('fpl_user', JSON.stringify(this.user));
                showToast('גישה מוגבלת', `שלום ${this.user.name}! תוצג תצוגה עם שמות אמיתיים ונתונים מפוברקים`, 'warning', 4000);
            }
            
            this.showApp();
        }, 1500);
    },
    
    enterDemoMode() {
        this.user = {
            name: 'משתמש דמו',
            email: 'demo@fpl.com',
            picture: 'https://via.placeholder.com/40'
        };
        this.isDemo = true;
        showToast('מצב דמו', 'נכנסת למצב דמו - שמות אמיתיים, נתונים מפוברקים', 'info', 3000);
        this.showApp();
    },
    
    logout() {
        localStorage.removeItem('fpl_user');
        this.user = null;
        this.isDemo = false;
        showToast('התנתקות', 'התנתקת בהצלחה', 'info', 2000);
        setTimeout(() => {
            location.reload();
        }, 1000);
    }
};

// ============================================
// DEMO DATA GENERATOR
// ============================================

function generateDemoPlayer(id, name, teamName, position, price) {
    // Map team names to IDs (simple hash)
    const teamMap = {
        'Liverpool': 1, 'Man City': 2, 'Arsenal': 3, 'Spurs': 4,
        'Chelsea': 5, 'Man Utd': 6, 'Newcastle': 7, 'Aston Villa': 8,
        'Brighton': 9, 'Brentford': 10, 'West Ham': 11, 'Wolves': 12,
        'Crystal Palace': 13, 'Fulham': 14, 'Bournemouth': 15, 'Everton': 16,
        "Nott'm Forest": 17, 'Luton': 18, 'Burnley': 19, 'Sheffield Utd': 20
    };
    
    // Helper function to convert to number
    const toNum = (value) => parseFloat(value);
    
    return {
        id,
        web_name: name,
        team: teamMap[teamName] || id % 20 + 1,
        team_name: teamName,
        position_name: position,
        now_cost: price,
        total_points: Math.floor(Math.random() * 150) + 20,
        form: toNum((Math.random() * 8 + 2).toFixed(1)),
        points_per_game_90: toNum((Math.random() * 8 + 1).toFixed(1)),
        selected_by_percent: toNum((Math.random() * 40 + 5).toFixed(1)),
        minutes: Math.floor(Math.random() * 2000) + 500,
        goals_scored: Math.floor(Math.random() * 20),
        assists: Math.floor(Math.random() * 15),
        clean_sheets: Math.floor(Math.random() * 10),
        bonus: Math.floor(Math.random() * 20),
        ict_index: toNum((Math.random() * 30 + 5).toFixed(1)),
        expected_goal_involvements: toNum((Math.random() * 15 + 2).toFixed(2)),
        xGI_per90: toNum((Math.random() * 1.2 + 0.1).toFixed(2)),
        def_contrib_per90: toNum((Math.random() * 8 + 1).toFixed(1)),
        xDiff: toNum((Math.random() * 4 - 2).toFixed(2)),
        dreamteam_count: Math.floor(Math.random() * 8),
        net_transfers_event: Math.floor(Math.random() * 200) - 100,
        draft_score: toNum((Math.random() * 80 + 20).toFixed(1)),
        predicted_points_1_gw: toNum((Math.random() * 8 + 2).toFixed(1)),
        predicted_points_4_gw: toNum((Math.random() * 30 + 10).toFixed(1)),
        code: Math.floor(Math.random() * 100000),
        creativity: toNum((Math.random() * 100 + 10).toFixed(1)),
        threat: toNum((Math.random() * 100 + 10).toFixed(1)),
        influence: toNum((Math.random() * 100 + 10).toFixed(1)),
        saves: Math.floor(Math.random() * 50),
        goals_conceded: Math.floor(Math.random() * 30),
        // Additional fields that might be needed
        creativity_per_90: toNum((Math.random() * 10 + 2).toFixed(1)),
        threat_per_90: toNum((Math.random() * 10 + 2).toFixed(1)),
        influence_per_90: toNum((Math.random() * 10 + 2).toFixed(1)),
        saves_per_90: toNum((Math.random() * 5 + 1).toFixed(1)),
        clean_sheets_per_90: toNum((Math.random() * 0.5).toFixed(2)),
        expected_goals: toNum((Math.random() * 10 + 1).toFixed(2)),
        expected_assists: toNum((Math.random() * 8 + 1).toFixed(2)),
        expected_goals_per_90: toNum((Math.random() * 0.8).toFixed(2)),
        expected_assists_per_90: toNum((Math.random() * 0.6).toFixed(2)),
        // Component scores (will be recalculated but provide defaults)
        base_score: toNum((Math.random() * 50 + 20).toFixed(1)),
        quality_score: toNum((Math.random() * 50 + 20).toFixed(1)),
        performance_score: toNum((Math.random() * 50 + 20).toFixed(1)),
        ga_per_game: toNum((Math.random() * 1.5).toFixed(2)),
        xgi_per_game: toNum((Math.random() * 1.2).toFixed(2)),
        // Percentiles object (will be populated by calculateAdvancedScores)
        percentiles: {},
        set_piece_priority: {
            penalty: Math.random() > 0.8 ? 1 : 0,
            corner: Math.random() > 0.7 ? 1 : 0,
            free_kick: Math.random() > 0.7 ? 1 : 0
        }
    };
}

function loadDemoData() {
    showLoading('טוען נתוני דמו...');
    
    setTimeout(() => {
        // Create comprehensive demo dataset with real names but fake stats
        const demoPlayers = [
            // Liverpool
            generateDemoPlayer(1, 'Salah', 'Liverpool', 'MID', 13.0),
            generateDemoPlayer(2, 'Alexander-Arnold', 'Liverpool', 'DEF', 7.5),
            generateDemoPlayer(3, 'Van Dijk', 'Liverpool', 'DEF', 6.5),
            generateDemoPlayer(4, 'Alisson', 'Liverpool', 'GKP', 5.5),
            generateDemoPlayer(5, 'Díaz', 'Liverpool', 'MID', 8.0),
            generateDemoPlayer(6, 'Núñez', 'Liverpool', 'FWD', 7.5),
            generateDemoPlayer(7, 'Szoboszlai', 'Liverpool', 'MID', 7.0),
            generateDemoPlayer(8, 'Robertson', 'Liverpool', 'DEF', 6.5),
            
            // Man City
            generateDemoPlayer(9, 'Haaland', 'Man City', 'FWD', 15.0),
            generateDemoPlayer(10, 'De Bruyne', 'Man City', 'MID', 12.5),
            generateDemoPlayer(11, 'Foden', 'Man City', 'MID', 9.5),
            generateDemoPlayer(12, 'Ederson', 'Man City', 'GKP', 5.5),
            generateDemoPlayer(13, 'Walker', 'Man City', 'DEF', 6.0),
            generateDemoPlayer(14, 'Rodri', 'Man City', 'MID', 6.5),
            generateDemoPlayer(15, 'Grealish', 'Man City', 'MID', 7.0),
            generateDemoPlayer(16, 'Dias', 'Man City', 'DEF', 6.0),
            
            // Arsenal
            generateDemoPlayer(17, 'Saka', 'Arsenal', 'MID', 9.5),
            generateDemoPlayer(18, 'Ødegaard', 'Arsenal', 'MID', 8.5),
            generateDemoPlayer(19, 'Martinelli', 'Arsenal', 'MID', 7.5),
            generateDemoPlayer(20, 'Gabriel', 'Arsenal', 'DEF', 6.0),
            generateDemoPlayer(21, 'Saliba', 'Arsenal', 'DEF', 6.0),
            generateDemoPlayer(22, 'Raya', 'Arsenal', 'GKP', 5.0),
            generateDemoPlayer(23, 'Jesus', 'Arsenal', 'FWD', 8.0),
            generateDemoPlayer(24, 'Rice', 'Arsenal', 'MID', 6.5),
            
            // Spurs
            generateDemoPlayer(25, 'Son', 'Spurs', 'MID', 10.0),
            generateDemoPlayer(26, 'Maddison', 'Spurs', 'MID', 7.5),
            generateDemoPlayer(27, 'Richarlison', 'Spurs', 'FWD', 7.0),
            generateDemoPlayer(28, 'Vicario', 'Spurs', 'GKP', 5.0),
            generateDemoPlayer(29, 'Romero', 'Spurs', 'DEF', 5.5),
            generateDemoPlayer(30, 'Pedro Porro', 'Spurs', 'DEF', 5.5),
            
            // Chelsea
            generateDemoPlayer(31, 'Palmer', 'Chelsea', 'MID', 11.0),
            generateDemoPlayer(32, 'Jackson', 'Chelsea', 'FWD', 7.5),
            generateDemoPlayer(33, 'Enzo', 'Chelsea', 'MID', 6.0),
            generateDemoPlayer(34, 'Sánchez', 'Chelsea', 'GKP', 4.5),
            generateDemoPlayer(35, 'James', 'Chelsea', 'DEF', 6.0),
            generateDemoPlayer(36, 'Gallagher', 'Chelsea', 'MID', 5.5),
            
            // Man Utd
            generateDemoPlayer(37, 'B.Fernandes', 'Man Utd', 'MID', 8.5),
            generateDemoPlayer(38, 'Rashford', 'Man Utd', 'MID', 7.0),
            generateDemoPlayer(39, 'Højlund', 'Man Utd', 'FWD', 7.0),
            generateDemoPlayer(40, 'Onana', 'Man Utd', 'GKP', 5.0),
            generateDemoPlayer(41, 'Martínez', 'Man Utd', 'DEF', 5.5),
            
            // Newcastle
            generateDemoPlayer(42, 'Isak', 'Newcastle', 'FWD', 8.5),
            generateDemoPlayer(43, 'Gordon', 'Newcastle', 'MID', 7.5),
            generateDemoPlayer(44, 'Trippier', 'Newcastle', 'DEF', 6.5),
            generateDemoPlayer(45, 'Pope', 'Newcastle', 'GKP', 5.0),
            generateDemoPlayer(46, 'Bruno G.', 'Newcastle', 'MID', 6.5),
            
            // Aston Villa
            generateDemoPlayer(47, 'Watkins', 'Aston Villa', 'FWD', 9.0),
            generateDemoPlayer(48, 'Bailey', 'Aston Villa', 'MID', 6.5),
            generateDemoPlayer(49, 'Martínez', 'Aston Villa', 'GKP', 5.0),
            generateDemoPlayer(50, 'Digne', 'Aston Villa', 'DEF', 5.0),
            
            // Brighton
            generateDemoPlayer(51, 'Mitoma', 'Brighton', 'MID', 6.5),
            generateDemoPlayer(52, 'Ferguson', 'Brighton', 'FWD', 6.0),
            generateDemoPlayer(53, 'Steele', 'Brighton', 'GKP', 4.5),
            
            // Brentford
            generateDemoPlayer(54, 'Mbeumo', 'Brentford', 'MID', 7.0),
            generateDemoPlayer(55, 'Toney', 'Brentford', 'FWD', 7.5),
            generateDemoPlayer(56, 'Flekken', 'Brentford', 'GKP', 4.5),
            
            // West Ham
            generateDemoPlayer(57, 'Bowen', 'West Ham', 'MID', 7.5),
            generateDemoPlayer(58, 'Paquetá', 'West Ham', 'MID', 6.5),
            generateDemoPlayer(59, 'Antonio', 'West Ham', 'FWD', 6.0),
            
            // Wolves
            generateDemoPlayer(60, 'Cunha', 'Wolves', 'MID', 6.5),
            generateDemoPlayer(61, 'Hwang', 'Wolves', 'FWD', 5.5),
            
            // Crystal Palace
            generateDemoPlayer(62, 'Eze', 'Crystal Palace', 'MID', 7.0),
            generateDemoPlayer(63, 'Olise', 'Crystal Palace', 'MID', 6.5),
            
            // Fulham
            generateDemoPlayer(64, 'Willian', 'Fulham', 'MID', 6.0),
            generateDemoPlayer(65, 'Jiménez', 'Fulham', 'FWD', 6.0),
            
            // Bournemouth
            generateDemoPlayer(66, 'Solanke', 'Bournemouth', 'FWD', 7.5),
            generateDemoPlayer(67, 'Kluivert', 'Bournemouth', 'MID', 5.5),
            
            // Everton
            generateDemoPlayer(68, 'Calvert-Lewin', 'Everton', 'FWD', 6.0),
            generateDemoPlayer(69, 'McNeil', 'Everton', 'MID', 5.5),
            
            // Nott'm Forest
            generateDemoPlayer(70, 'Gibbs-White', "Nott'm Forest", 'MID', 6.0),
            generateDemoPlayer(71, 'Wood', "Nott'm Forest", 'FWD', 6.5),
            
            // Luton
            generateDemoPlayer(72, 'Adebayo', 'Luton', 'FWD', 5.5),
            generateDemoPlayer(73, 'Townsend', 'Luton', 'MID', 5.0),
            
            // Burnley
            generateDemoPlayer(74, 'Foster', 'Burnley', 'FWD', 5.5),
            generateDemoPlayer(75, 'Brownhill', 'Burnley', 'MID', 5.0),
            
            // Sheffield Utd
            generateDemoPlayer(76, 'McBurnie', 'Sheffield Utd', 'FWD', 5.5),
            generateDemoPlayer(77, 'Hamer', 'Sheffield Utd', 'MID', 5.5),
        ];
        
        // Process demo data
        state.allPlayersData.demo = {
            raw: demoPlayers,
            processed: demoPlayers,
            fixtures: []
        };
        state.currentDataSource = 'demo';
        state.displayedData = demoPlayers;
        
        // Create fake teams data
        const teams = [...new Set(demoPlayers.map(p => p.team_name))];
        state.teamsData = {};
        teams.forEach((team, idx) => {
            state.teamsData[idx + 1] = {
                id: idx + 1,
                name: team,
                short_name: team.substring(0, 3).toUpperCase()
            };
        });
        
        // Create fake team strength data
        state.teamStrengthData = {};
        teams.forEach((team, idx) => {
            state.teamStrengthData[idx + 1] = {
                attack: Math.random() * 1000 + 500,
                defense: Math.random() * 1000 + 500
            };
        });
        
        // Calculate scores with fake data
        calculateAdvancedScores(demoPlayers);
        
        // Update UI
        renderTable();
        updateDashboardKPIs(demoPlayers);
        
        // Setup event listeners and tooltips
        setupEventListeners();
        initializeTooltips();
        
        hideLoading();
        
        showToast('מצב דמו', 'נתוני דמו נטענו בהצלחה - כל המספרים מפוברקים!', 'success', 3000);
        
        // Show demo banner
        const header = document.querySelector('.header');
        const demoBanner = document.createElement('div');
        demoBanner.style.cssText = `
            background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            margin-top: 16px;
            text-align: center;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        `;
        demoBanner.innerHTML = '🎭 מצב דמו - כל הנתונים מפוברקים לחלוטין! | התחבר עם Google לגישה לנתונים אמיתיים';
        header.appendChild(demoBanner);
    }, 1000);
}

// ============================================
// ORIGINAL CONFIG
// ============================================

const config = {
    urls: {
        bootstrap: 'https://fantasy.premierleague.com/api/bootstrap-static/',
        draftBootstrap: 'https://draft.premierleague.com/api/bootstrap-static',
        // Add other URLs as needed
    },
    corsProxy: 'https://corsproxy.io/?',
    // corsProxy: 'http://127.0.0.1:8080/',
    // corsProxy: 'https://fpl-proxy-seven.vercel.app/api/proxy?url=',
    myTeamId: 1774, // Amit Zahy's FPL team ID
    draftLeagueId: 44670, // Replace with your Draft League ID
    draftMyEntryId: 58635, // Replace with your Draft Entry ID
};

const state = {
    players: [],
    teams: [],
    gameweeks: [],
    events: [],
    processedById: new Map(),
    processedByTeam: new Map(),
    comparison: [],
    draft: {
        details: null,
        standings: null,
        rosters: new Map(), // leagueId -> roster
        rostersByEntryId: new Map(),
        myEntryId: config.draftMyEntryId,
        leagueId: config.draftLeagueId,
        draftToFplIdMap: new Map(),
        fplToDraftIdMap: new Map(),
    },
    ui: {
        sortColumn: 'total_points',
        sortDirection: 'desc',
        activeTab: 'playerData',
        loading: false,
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    init();
    await fetchAndProcessData();
    // Initially load draft league if it's the default view or based on some condition
    if (state.ui.activeTab === 'draft') {
        loadDraftLeague(state.draft.leagueId, state.draft.myEntryId);
    }
});
function init() {
    console.log("Welcome to Advanced FPL Tool!");
    setupEventListeners();
    showTab('playerData'); // Show the main player data tab by default
}

function setupEventListeners() {
    document.getElementById('position-filter').addEventListener('change', filterAndSortPlayers);
    document.getElementById('team-filter').addEventListener('change', filterAndSortPlayers);
    document.getElementById('sort-metric').addEventListener('change', filterAndSortPlayers);
    document.getElementById('search-player').addEventListener('input', filterAndSortPlayers);
    document.getElementById('show-all').addEventListener('click', () => {
        document.getElementById('position-filter').value = 'all';
        document.getElementById('team-filter').value = 'all';
        document.getElementById('search-player').value = '';
        filterAndSortPlayers();
    });

    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            showTab(tabName);
        });
    });

    document.getElementById('playersTable').querySelector('thead').addEventListener('click', (e) => {
        if (e.target.tagName === 'TH') {
            const newSortColumn = e.target.getAttribute('data-sort');
            if (state.ui.sortColumn === newSortColumn) {
                state.ui.sortDirection = state.ui.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                state.ui.sortColumn = newSortColumn;
                state.ui.sortDirection = 'desc';
            }
            filterAndSortPlayers();
        }
    });
}
async function fetchWithCache(url, key, expiryMinutes = 60) {
    const cachedItem = localStorage.getItem(key);
    if (cachedItem) {
        const { timestamp, data } = JSON.parse(cachedItem);
        if (Date.now() - timestamp < expiryMinutes * 60 * 1000) {
            console.log(`[Cache] HIT for ${key}`);
            return data;
        } else {
            console.log(`[Cache] EXPIRED for ${key}`);
        }
    }

    console.log(`[Cache] MISS for ${key}, fetching from network...`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Network response was not ok for ${url}`);
        }
        const data = await response.json();
        const itemToCache = {
            timestamp: Date.now(),
            data: data
        };
        localStorage.setItem(key, JSON.stringify(itemToCache));
        return data;
    } catch (error) {
        console.error(`Failed to fetch data for ${key}:`, error);
        // Fallback to cache if network fails, even if expired
        if (cachedItem) {
            console.warn(`[Cache] Using expired cache for ${key} due to network failure.`);
            return JSON.parse(cachedItem).data;
        }
        throw error;
    }
}

async function fetchAndProcessData() {
    console.log("⏳ Starting data fetch and processing...");
    showLoading('טוען נתונים חיים משרתי FPL...');
    try {
        const url = config.corsProxy + encodeURIComponent(config.urls.bootstrap);
        const data = await fetchWithCache(url, 'bootstrap_static', 5); // Cache for 5 minutes
        
        state.players = data.elements;
        state.teams = data.teams;
        state.gameweeks = data.events;

        const teamMap = new Map(state.teams.map(t => [t.id, t]));

        state.players.forEach(p => {
            p.team_name = teamMap.get(p.team)?.name || 'Unknown';
            p.team_short_name = teamMap.get(p.team)?.short_name || 'UNK';
            p.total_points = p.total_points || 0;
            p.points_per_game = parseFloat(p.points_per_game) || 0;
            p.form = parseFloat(p.form) || 0;
            p.ep_this = parseFloat(p.ep_this) || 0;
            p.ep_next = parseFloat(p.ep_next) || 0;
            p.now_cost = p.now_cost / 10;
            p.value = p.total_points / p.now_cost;
            p.minutes = p.minutes || 0;

            state.processedById.set(p.id, p);
            
            if (!state.processedByTeam.has(p.team)) {
                state.processedByTeam.set(p.team, []);
            }
            state.processedByTeam.get(p.team).push(p);
        });

        populateFilters();
        filterAndSortPlayers();
        console.log("✅ Data processed successfully.");
        
    } catch (error) {
        console.error("❌ Failed to fetch or process data:", error);
        showToast('שגיאה בטעינת הנתונים. ייתכן שה-API של FPL או שרת ה-Proxy אינם זמינים.', 'error');
    } finally {
        hideLoading();
    }
}


function populateFilters() {
    const teamFilter = document.getElementById('team-filter');
    const sortedTeams = [...state.teams].sort((a, b) => a.name.localeCompare(b.name));
    
    sortedTeams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name;
        teamFilter.appendChild(option);
    });
}

function filterAndSortPlayers() {
    const position = document.getElementById('position-filter').value;
    const team = document.getElementById('team-filter').value;
    const sortMetric = document.getElementById('sort-metric').value;
    const searchTerm = document.getElementById('search-player').value.toLowerCase();

    state.ui.sortColumn = sortMetric;
    
    let filteredPlayers = state.players.filter(p => {
        const nameMatch = p.web_name.toLowerCase().includes(searchTerm) || p.first_name.toLowerCase().includes(searchTerm) || p.second_name.toLowerCase().includes(searchTerm);
        const positionMatch = position === 'all' || p.element_type == position;
        const teamMatch = team === 'all' || p.team == team;
        return nameMatch && positionMatch && teamMatch;
    });

    filteredPlayers.sort((a, b) => {
        let valA = a[state.ui.sortColumn];
        let valB = b[state.ui.sortColumn];

        if (state.ui.sortDirection === 'asc') {
            return valA > valB ? 1 : -1;
        } else {
            return valA < valB ? 1 : -1;
        }
    });

    renderPlayersTable(filteredPlayers);
    updateSortIndicators();
}


function renderPlayersTable(players) {
    const tableBody = document.getElementById('playersTable').querySelector('tbody');
    const myTeamId = state.draft?.myEntryId;
    const myPlayerDraftIds = myTeamId ? (state.draft.rostersByEntryId.get(myTeamId) || []) : [];
    const myPlayerFplIds = new Set(myPlayerDraftIds.map(draftId => getFplIdFromDraft(draftId)));
    
    const positionMap = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };

    const rows = players.map(p => {
        const isMyPlayer = myPlayerFplIds.has(p.id);
        const rowClass = isMyPlayer ? 'my-player-row' : '';

        return `
            <tr class="${rowClass}" data-player-id="${p.id}">
                <td class="name-cell">${p.web_name} <span class="text-muted">(${p.team_short_name})</span></td>
                <td>${positionMap[p.element_type]}</td>
                <td>${p.now_cost.toFixed(1)}</td>
                <td>${p.total_points}</td>
                <td>${p.points_per_game}</td>
                <td>${p.form}</td>
                <td>${p.minutes}</td>
                <td>${p.goals_scored}</td>
                <td>${p.assists}</td>
                <td>${p.clean_sheets}</td>
                <td>${(p.goals_conceded)}</td>
                <td>${p.saves}</td>
                <td>${p.bonus}</td>
                <td>${p.bps}</td>
                <td>${p.influence}</td>
                <td>${p.creativity}</td>
                <td>${p.threat}</td>
                <td>${p.ict_index}</td>
            </tr>
        `;
    }).join('');

    tableBody.innerHTML = rows;
}


function updateSortIndicators() {
    document.querySelectorAll('#playersTable th').forEach(th => {
        th.classList.remove('sorted', 'asc', 'desc');
        const sortIndicator = th.querySelector('.sort-indicator');
        if (sortIndicator) {
            sortIndicator.textContent = '';
        }

        if (th.getAttribute('data-sort') === state.ui.sortColumn) {
            th.classList.add('sorted', state.ui.sortDirection);
            if (sortIndicator) {
                sortIndicator.textContent = state.ui.sortDirection === 'asc' ? '▲' : '▼';
            }
        }
    });
}
async function buildDraftToFplMapping() {
    if (state.draft.draftToFplIdMap.size > 0) {
        console.log('ℹ️ Draft to FPL ID map already built.');
        return;
    }
    console.log('[Draft] ⏳ Building Draft-to-FPL player ID mapping...');
    showToast('ממפה שחקני דראפט לשחקני פנטזי...', 'info');

    try {
        const fplUrl = config.corsProxy + encodeURIComponent(config.urls.bootstrap);
        const draftUrl = config.corsProxy + encodeURIComponent(config.urls.draftBootstrap);

        const [fplData, draftData] = await Promise.all([
            fetchWithCache(fplUrl, 'bootstrap_static', 1440), // Cache FPL bootstrap for a day
            fetchWithCache(draftUrl, 'draft_bootstrap_static', 1440) // Cache Draft bootstrap for a day
        ]);

        const fplPlayers = fplData.elements;
        const draftPlayers = draftData.elements;

        const fplPlayerMapByName = new Map();
        fplPlayers.forEach(p => {
            const fullName = `${p.first_name} ${p.second_name}`.toLowerCase();
            fplPlayerMapByName.set(fullName, p);
        });

        draftPlayers.forEach(draftPlayer => {
            const draftFullName = `${draftPlayer.first_name} ${draftPlayer.second_name}`.toLowerCase();
            const matchingFplPlayer = fplPlayerMapByName.get(draftFullName);

            if (matchingFplPlayer) {
                state.draft.draftToFplIdMap.set(draftPlayer.id, matchingFplPlayer.id);
                state.draft.fplToDraftIdMap.set(matchingFplPlayer.id, draftPlayer.id);
            } else {
                console.warn(`[Draft] ⚠️ No FPL match found for Draft player: ${draftPlayer.web_name} (Draft ID: ${draftPlayer.id})`);
            }
        });

        console.log(`[Draft] ✅ Mapping complete. Mapped ${state.draft.draftToFplIdMap.size} of ${draftPlayers.length} players.`);
        showToast('מיפוי שחקנים הושלם בהצלחה!', 'success');

    } catch (error) {
        console.error('[Draft] ❌ Error building player ID mapping:', error);
        showToast('שגיאה במיפוי שחקנים.', 'error');
    }
}
function getDraftIdFromFpl(fplId) {
    return state.draft.fplToDraftIdMap.get(fplId);
}

function getFplIdFromDraft(draftId) {
    return state.draft.draftToFplIdMap.get(draftId);
}

async function loadDraftLeague(leagueId, entryId) {
    if (state.draft.details) {
        console.log('ℹ️ Draft details already loaded.');
        return;
    }
    console.log(`[Draft] ⏳ Loading league ${leagueId} for entry ${entryId}...`);
    showLoading('טוען נתוני ליגת דראפט...');
    
    try {
        await buildDraftToFplMapping();

        const urls = {
            details: `https://draft.premierleague.com/api/league/${leagueId}/details`,
            standings: `https://draft.premierleague.com/api/league/${leagueId}/standings`
        };

        const [details, standings] = await Promise.all([
            fetchWithCache(config.corsProxy + encodeURIComponent(urls.details), `draft_details_${leagueId}`, 5),
            fetchWithCache(config.corsProxy + encodeURIComponent(urls.standings), `draft_standings_${leagueId}`, 5)
        ]);
        
        state.draft.details = details;
        state.draft.standings = standings;
        state.draft.myEntryId = entryId;

        // Process rosters
        details.league_entries.forEach(entry => {
            state.draft.rostersByEntryId.set(entry.id, []);
        });

        details.element_status.forEach(status => {
            if (status.owner) {
                const entryRoster = state.draft.rostersByEntryId.get(status.owner);
                if (entryRoster) {
                    entryRoster.push(status.element);
                }
            }
        });
        
        console.log("[Draft] ✅ Draft data loaded and processed.");
        
        renderDraftTab();
        filterAndSortPlayers(); // Re-render main table to highlight players
        
    } catch (error) {
        console.error('[Draft] ❌ Failed to load draft league:', error);
        showToast('שגיאה בטעינת ליגת הדראפט.', 'error');
    } finally {
        hideLoading();
    }
}


function showTab(tabName) {
    console.log(`Switching to tab: ${tabName}`);
    state.ui.activeTab = tabName;

    // Hide all tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });

    // Deactivate all tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });

    // Show the selected tab content and activate the button
    const activeContent = document.getElementById(tabName + 'TabContent');
    const activeButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
    
    if (activeContent) {
        activeContent.style.display = 'block';
    }
    if (activeButton) {
        activeButton.classList.add('active');
    }

    // Special handling for draft tab
    if (tabName === 'draft') {
        if (!state.draft.details) {
            loadDraftLeague(state.draft.leagueId, state.draft.myEntryId);
        } else {
            // If data is already loaded, just ensure it's rendered
            renderDraftTab();
        }
    }
}
function renderDraftTab() {
    if (!state.draft.details) {
        console.warn("[Draft] No draft details to render.");
        return;
    }
    console.log("[Draft] 🎨 Rendering Draft Tab...");

    // Render my lineup
    const myRosterIds = state.draft.rostersByEntryId.get(state.draft.myEntryId) || [];
    renderMyLineup(myRosterIds);

    // Render league standings
    renderDraftStandings();
    
    // Render all team rosters
    renderAllRosters();

    // Render other components that might need draft data
    renderRecommendations(myRosterIds);

    const teamAggregates = computeDraftTeamAggregates();
    renderDraftMatrices(teamAggregates);

    console.log("[Draft] ✅ Draft Tab rendered.");
}

function renderMyLineup(playerIds) {
    const container = document.getElementById('myLineup');
    if (!container) return;
    
    const myEntry = state.draft.details.league_entries.find(e => e.id === state.draft.myEntryId);
    const teamName = myEntry ? myEntry.entry_name : 'My Team';
    
    container.innerHTML = `
        <h3 class="section-title">ההרכב שלי (${teamName})</h3>
        <div id="myLineupPitch" class="pitch-container"></div>
        <div id="myLineupBench" class="bench-strip"></div>
    `;

    renderPitch(
        document.getElementById('myLineupPitch'),
        document.getElementById('myLineupBench'),
        playerIds
    );
}

function renderDraftStandings() {
    const tableBody = document.getElementById('draftStandingsTable')?.querySelector('tbody');
    if (!tableBody || !state.draft.standings) return;
    
    const standings = state.draft.standings.standings;
    
    tableBody.innerHTML = standings.map(s => `
        <tr>
            <td>${s.rank}</td>
            <td>${s.entry_name}</td>
            <td>${s.event_total}</td>
            <td>${s.total}</td>
            <td>${s.last_rank}</td>
        </tr>
    `).join('');
}
function renderAllRosters() {
    const container = document.getElementById('otherRosters');
    if (!container) return;

    let html = '<div class="roster-cards">';
    
    // Sort league entries based on standings rank
    const sortedEntries = [...state.draft.details.league_entries].sort((a, b) => {
        const rankA = state.draft.standings.standings.find(s => s.league_entry === a.id)?.rank || 99;
        const rankB = state.draft.standings.standings.find(s => s.league_entry === b.id)?.rank || 99;
        return rankA - rankB;
    });

    for (const entry of sortedEntries) {
        // Skip my own team as it's displayed separately
        if (entry.id === state.draft.myEntryId) continue;

        const playerIds = state.draft.rostersByEntryId.get(entry.id) || [];
        
        html += `
            <div class="roster-container card">
                <h4 class="roster-title">${entry.entry_name}</h4>
                <div id="pitch_for_${entry.id}" class="pitch-container"></div>
                <div id="bench_for_${entry.id}" class="bench-strip"></div>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
    
    // Now that the containers are in the DOM, render the pitches
    for (const entry of sortedEntries) {
        if (entry.id === state.draft.myEntryId) continue;
        const playerIds = state.draft.rostersByEntryId.get(entry.id) || [];
        renderPitch(
            document.getElementById(`pitch_for_${entry.id}`),
            document.getElementById(`bench_for_${entry.id}`),
            playerIds
        );
    }
}
function pickStartingXI(playerIds) {
    const players = playerIds.map(draftId => {
        const fplId = getFplIdFromDraft(draftId);
        return state.processedById.get(fplId);
    }).filter(Boolean); // Filter out any players not found in the FPL data

    // Separate players by position
    const goalkeepers = players.filter(p => p.element_type === 1);
    const defenders = players.filter(p => p.element_type === 2);
    const midfielders = players.filter(p => p.element_type === 3);
    const forwards = players.filter(p => p.element_type === 4);
    
    // Sort by a metric, e.g., form or total_points. Let's use form.
    const sortFn = (a, b) => b.form - a.form;
    goalkeepers.sort(sortFn);
    defenders.sort(sortFn);
    midfielders.sort(sortFn);
    forwards.sort(sortFn);

    let startingXI = [];
    let bench = [];

    // Always pick 1 GK
    startingXI.push(...goalkeepers.slice(0, 1));
    bench.push(...goalkeepers.slice(1));

    // Basic formation logic: try to fill 3-4-3 or similar, then adjust
    let remainingDef = 3;
    let remainingMid = 4;
    let remainingFwd = 1; // Start with a minimal forward line

    startingXI.push(...defenders.slice(0, remainingDef));
    startingXI.push(...midfielders.slice(0, remainingMid));
    startingXI.push(...forwards.slice(0, remainingFwd));

    let remainingPlayers = [
        ...defenders.slice(remainingDef),
        ...midfielders.slice(remainingMid),
        ...forwards.slice(remainingFwd)
    ].sort(sortFn);

    // Fill remaining 2 spots in starting XI with best remaining players
    const spotsToFill = 10 - startingXI.length;
    startingXI.push(...remainingPlayers.slice(0, spotsToFill));
    
    bench.push(...remainingPlayers.slice(spotsToFill));
    
    // Formation validation and adjustment (simplified)
    const startingDefs = startingXI.filter(p => p.element_type === 2).length;
    const startingMids = startingXI.filter(p => p.element_type === 3).length;
    const startingFwds = startingXI.filter(p => p.element_type === 4).length;

    // This is a simplified validation. A real one would be more complex.
    if (startingDefs < 3 || startingMids < 2 || startingFwds < 1) {
       // A more robust algorithm would swap players here.
       // For now, this is a basic selection.
    }
    
    // Return FPL IDs of the starting XI
    return new Set(startingXI.map(p => p.id));
}
function renderPitch(pitchEl, benchEl, playerIds) {
    if (!pitchEl || !benchEl) return;
    
    const fplIds = playerIds.map(draftId => getFplIdFromDraft(draftId)).filter(Boolean);
    const players = fplIds.map(id => state.processedById.get(id)).filter(Boolean);

    // Clear previous content
    pitchEl.innerHTML = '';
    benchEl.innerHTML = '';

    const startingXI_FplIds = pickStartingXI(playerIds);
    
    const startingXI = players.filter(p => startingXI_FplIds.has(p.id));
    const benchPlayers = players.filter(p => !startingXI_FplIds.has(p.id));

    // Sort bench players: GK, DEF, MID, FWD
    benchPlayers.sort((a,b) => a.element_type - b.element_type);

    const positionCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const formation = {
        1: startingXI.filter(p => p.element_type === 1).length,
        2: startingXI.filter(p => p.element_type === 2).length,
        3: startingXI.filter(p => p.element_type === 3).length,
        4: startingXI.filter(p => p.element_type === 4).length,
    };
    
    startingXI.forEach(player => {
        const pos = player.element_type;
        positionCounts[pos]++;
        
        let top, left;
        const totalInPos = formation[pos];
        const- i = positionCounts[pos];

        switch(pos) {
            case 1: // GK
                top = '5%'; left = '50%'; break;
            case 2: // DEF
                top = '25%'; left = `${(100 / (totalInPos + 1)) * i}%`; break;
            case 3: // MID
                top = '50%'; left = `${(100 / (totalInPos + 1)) * i}%`; break;
            case 4: // FWD
                top = '75%'; left = `${(100 / (totalInPos + 1)) * i}%`; break;
        }

        pitchEl.innerHTML += `
            <div class="player-spot" style="top: ${top}; left: ${left};">
                <img src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${player.code}.png" alt="${player.web_name}" class="player-photo">
                <span class="player-name">${player.web_name}</span>
            </div>
        `;
    });
    
    benchEl.innerHTML = benchPlayers.map(p => `
        <div class="bench-item">
            <img src="https://resources.premierleague.com/premierleague/photos/players/40x40/p${p.code}.png" alt="${p.web_name}">
            <span>${p.web_name}</span>
        </div>
    `).join('');
}


function renderRecommendations(myRosterIds) {
    const container = document.getElementById('recommendations');
    if (!container) return;

    // This is a placeholder for a real recommendation engine.
    // For now, let's find the top 5 players by form not in my roster.
    
    const myFplIds = new Set(myRosterIds.map(draftId => getFplIdFromDraft(draftId)));
    
    const topPlayers = [...state.players]
        .filter(p => !myFplIds.has(p.id) && p.status === 'a') // Available and not on my team
        .sort((a, b) => b.form - a.form)
        .slice(0, 5);

    container.innerHTML = `
        <h3 class="section-title">המלצות להעברות</h3>
        <div class="rec-list">
            ${topPlayers.map(p => `
                <div class="rec-item">
                    <img src="https://resources.premierleague.com/premierleague/photos/players/40x40/p${p.code}.png" alt="${p.web_name}">
                    <div>
                        <strong>${p.web_name}</strong> (${p.team_short_name})
                        <div class="rec-metrics">
                            <span>Form: ${p.form}</span>
                            <span>Cost: £${p.now_cost.toFixed(1)}m</span>
                            <span>Pts: ${p.total_points}</span>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function computeDraftTeamAggregates() {
    const teamAggregates = new Map();

    for (const [entryId, draftIds] of state.draft.rostersByEntryId.entries()) {
        const fplIds = draftIds.map(id => getFplIdFromDraft(id)).filter(Boolean);
        const players = fplIds.map(id => state.processedById.get(id)).filter(Boolean);
        
        const aggregates = {
            total_points: 0,
            total_cost: 0,
            avg_form: 0,
            player_count: players.length
        };

        if (players.length > 0) {
            aggregates.total_points = players.reduce((sum, p) => sum + p.total_points, 0);
            aggregates.total_cost = players.reduce((sum, p) => sum + p.now_cost, 0);
            aggregates.avg_form = players.reduce((sum, p) => sum + p.form, 0) / players.length;
        }
        
        const entryDetails = state.draft.details.league_entries.find(e => e.id === entryId);
        teamAggregates.set(entryDetails.entry_name, aggregates);
    }
    
    return teamAggregates;
}


function renderDraftMatrices(teamAggregates) {
    const costVPointsContainer = document.getElementById('costVPointsChart');
    const formVPointsContainer = document.getElementById('formVPointsChart');
    if (!costVPointsContainer || !formVPointsContainer) return;
    
    const labels = Array.from(teamAggregates.keys());
    const costData = Array.from(teamAggregates.values()).map(a => ({ x: a.total_cost, y: a.total_points, r: 8 }));
    const formData = Array.from(teamAggregates.values()).map(a => ({ x: a.avg_form, y: a.total_points, r: 8 }));
    
    // Destroy previous charts if they exist
    if (Chart.getChart(costVPointsContainer)) {
        Chart.getChart(costVPointsContainer).destroy();
    }
    if (Chart.getChart(formVPointsContainer)) {
        Chart.getChart(formVPointsContainer).destroy();
    }

    new Chart(costVPointsContainer, {
        type: 'bubble',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cost vs. Points',
                data: costData,
                backgroundColor: 'rgba(2, 132, 199, 0.7)',
                borderColor: 'rgba(2, 132, 199, 1)',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return labels[context.dataIndex];
                        }
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: 'Total Squad Cost (£m)' } },
                y: { title: { display: true, text: 'Total Points' } }
            }
        }
    });

    new Chart(formVPointsContainer, {
        type: 'bubble',
        data: {
            labels: labels,
            datasets: [{
                label: 'Avg Form vs. Points',
                data: formData,
                backgroundColor: 'rgba(13, 148, 136, 0.7)',
                borderColor: 'rgba(13, 148, 136, 1)',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return labels[context.dataIndex];
                        }
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: 'Average Player Form' } },
                y: { title: { display: true, text: 'Total Points' } }
            }
        }
    });
}
function showLoading(message = 'טוען...') {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.querySelector('p').textContent = message;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) {
        console.warn('Toast container not found!');
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌'
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-content">
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close">&times;</button>
    `;

    container.appendChild(toast);

    const closeButton = toast.querySelector('.toast-close');
    closeButton.addEventListener('click', () => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    });

    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}
