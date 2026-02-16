// ============================================
// AUTHENTICATION & USER MANAGEMENT
// ============================================

const auth = {
    user: null,
    isDemo: false,
    googleClientId: 'YOUR_GOOGLE_CLIENT_ID', // Replace with your actual Google Client ID
    allowedEmail: 'amitzahy1@gmail.com', // Only this email can access real data
    
    init() {
        // Render sub-nav buttons initially just to be sure
        this.renderSubNav();

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
    
    renderSubNav() {
        const subNav = document.querySelector('.draft-sub-nav');
        if (subNav && !subNav.innerHTML.includes('overview')) {
             console.log("Restoring Draft Sub-Nav content...");
             subNav.innerHTML = `
                <button class="draft-nav-btn active" onclick="switchDraftTab('overview')" style="padding: 12px 24px; border-radius: 12px; border: none; font-weight: 700; font-size: 16px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; background: #eff6ff; color: #3b82f6; box-shadow: 0 2px 4px rgba(59,130,246,0.1);">
                    <span style="font-size: 18px;">📊</span> מבט על
                </button>
                <button class="draft-nav-btn" onclick="switchDraftTab('nextround')" style="padding: 12px 24px; border-radius: 12px; border: none; font-weight: 700; font-size: 16px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; background: transparent; color: #64748b;">
                    <span style="font-size: 18px;">⚔️</span> המחזור הבא
                </button>
                <button class="draft-nav-btn" onclick="switchDraftTab('standings')" style="padding: 12px 24px; border-radius: 12px; border: none; font-weight: 700; font-size: 16px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; background: transparent; color: #64748b;">
                    <span style="font-size: 18px;">📋</span> טבלה וסגלים
                </button>
                <button class="draft-nav-btn" onclick="switchDraftTab('market')" style="padding: 12px 24px; border-radius: 12px; border: none; font-weight: 700; font-size: 16px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; background: transparent; color: #64748b;">
                    <span style="font-size: 18px;">💡</span> שוק והמלצות
                </button>
                <button class="draft-nav-btn" onclick="switchDraftTab('analytics')" style="padding: 12px 24px; border-radius: 12px; border: none; font-weight: 700; font-size: 16px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; background: transparent; color: #64748b;">
                    <span style="font-size: 18px;">📈</span> אנליטיקס
                </button>
                <button class="draft-nav-btn" onclick="switchDraftTab('rival')" style="padding: 12px 24px; border-radius: 12px; border: none; font-weight: 700; font-size: 16px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; background: transparent; color: #64748b;">
                    <span style="font-size: 18px;">🎯</span> השוואת יריב
                </button>
                <button class="draft-nav-btn" onclick="switchDraftTab('h2h')" style="padding: 12px 24px; border-radius: 12px; border: none; font-weight: 700; font-size: 16px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; background: transparent; color: #64748b;">
                    <span style="font-size: 18px;">📜</span> היסטוריית מפגשים
                </button>
                <button class="draft-nav-btn" onclick="switchDraftTab('lineup-analysis')" style="padding: 12px 24px; border-radius: 12px; border: none; font-weight: 700; font-size: 16px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; background: transparent; color: #64748b;">
                    <span style="font-size: 18px;">🔍</span> ניתוח החלטות הרכב
                </button>
             `;
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
        showToast('מצב דמו', 'נכנסת למצב דמו - נתונים אמיתיים בדף הדראפט בלבד', 'info', 3000);
        this.showApp();
        // Force navigate to draft tab in demo mode and load data
        setTimeout(() => {
            showTab('draft');
            // Ensure draft data is loaded
            if (!state.draft.details || !state.draft.details.league_entries) {
                loadDraftLeague();
            }
        }, 500);
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
        fixtures: 'https://fantasy.premierleague.com/api/fixtures/',
        draftLeagueDetails: (leagueId) => `https://draft.premierleague.com/api/league/${leagueId}/details`,
        draftLeagueStandings: (leagueId) => `https://draft.premierleague.com/api/league/${leagueId}/standings`,
        draftEntryPicks: (entryId, gw) => `https://draft.premierleague.com/api/entry/${entryId}/event/${gw}`,
        playerImage: (code) => `https://resources.premierleague.com/premierleague/photos/players/110x140/p${code}.png`,
        missingPlayerImage: 'https://resources.premierleague.com/premierleague/photos/players/110x140/Photo-Missing.png'
    },
    corsProxy: 'https://corsproxy.io/?',
    corsProxyFallbacks: [
        'https://corsproxy.io/?',
        'https://api.allorigins.win/raw?url=',
        'https://api.codetabs.com/v1/proxy?quest='
    ],
    draftLeagueId: 689,
    setPieceTakers: {"Arsenal":{"penalties":["Saka","Havertz"],"freekicks":["Ødegaard","Rice","Martinelli"],"corners":["Martinelli","Saka","Ødegaard"]},"Aston Villa":{"penalties":["Watkins","Tielemans"],"freekicks":["Digne","Douglas Luiz","Bailey"],"corners":["Douglas Luiz","McGinn"]},"Bournemouth":{"penalties":["Solanke","Kluivert"],"freekicks":["Tavernier","Scott"],"corners":["Tavernier","Scott"]},"Brentford":{"penalties":["Toney","Mbeumo"],"freekicks":["Jensen","Mbeumo","Damsgaard"],"corners":["Jensen","Mbeumo"]},"Brighton":{"penalties":["João Pedro","Gross"],"freekicks":["Gross","Estupiñán"],"corners":["Gross","March"]},"Chelsea":{"penalties":["Palmer","Nkunku"],"freekicks":["Palmer","James","Enzo"],"corners":["Gallagher","Chilwell","Palmer"]},"Crystal Palace":{"penalties":["Eze","Olise"],"freekicks":["Eze","Olise"],"corners":["Eze","Olise"]},"Everton":{"penalties":["Calvert-Lewin","McNeil"],"freekicks":["McNeil","Garner"],"corners":["McNeil","Garner"]},"Fulham":{"penalties":["Andreas","Jiménez"],"freekicks":["Andreas","Willian","Wilson"],"corners":["Andreas","Willian"]},"Ipswich":{"penalties":["Chaplin","Hirst"],"freekicks":["Davis","Morsy"],"corners":["Davis","Chaplin"]},"Leicester":{"penalties":["Vardy","Dewsbury-Hall"],"freekicks":["Dewsbury-Hall","Fatawu"],"corners":["Dewsbury-Hall","Fatawu"]},"Liverpool":{"penalties":["M.Salah","Szoboszlai"],"freekicks":["Alexander-Arnold","Szoboszlai","Robertson"],"corners":["Alexander-Arnold","Robertson"]},"Man City":{"penalties":["Haaland","Alvarez"],"freekicks":["De Bruyne","Foden","Alvarez"],"corners":["Foden","De Bruyne"]},"Man Utd":{"penalties":["B.Fernandes","Rashford"],"freekicks":["B.Fernandes","Eriksen","Rashford"],"corners":["B.Fernandes","Shaw"]},"Newcastle":{"penalties":["Isak","Wilson"],"freekicks":["Trippier","Gordon"],"corners":["Trippier","Gordon"]},"Nott'm Forest":{"penalties":["Gibbs-White","Wood"],"freekicks":["Gibbs-White","Elanga"],"corners":["Gibbs-White","Elanga"]},"Southampton":{"penalties":["A. Armstrong","Ward-Prowse"],"freekicks":["Ward-Prowse","Smallbone"],"corners":["Ward-Prowse","Aribo"]},"Spurs":{"penalties":["Son","Maddison"],"freekicks":["Maddison","Pedro Porro"],"corners":["Maddison","Pedro Porro","Son"]},"West Ham":{"penalties":["Ward-Prowse","Bowen"],"freekicks":["Ward-Prowse","Emerson"],"corners":["Ward-Prowse","Bowen"]},"Wolves":{"penalties":["Cunha","Hwang"],"freekicks":["Sarabia","Bellegarde"],"corners":["Sarabia","Aït-Nouri"]}},
    tableColumns: [
        'rank', 'web_name', 'draft_score', 'stability_index', 'predicted_points_1_gw', 'team_name', 'draft_team',
        'position_name', 'now_cost', 'total_points', 'points_per_game_90', 'selected_by_percent', 
        'dreamteam_count', 'net_transfers_event', 'def_contrib_per90', 'goals_scored_assists', 
        'expected_goals_assists', 'minutes', 'xDiff', 'ict_index', 'bonus', 'clean_sheets', 
        'set_piece_priority.penalty', 'set_piece_priority.corner', 'set_piece_priority.free_kick', 'fixtures'
    ],
    comparisonMetrics: {
        'ציון דראפט': { key: 'draft_score', format: v => v.toFixed(1), reversed: false },
        'xPts (4GW)': { key: 'predicted_points_4_gw', format: v => (v || 0).toFixed(1), reversed: false },
        'נקודות למשחק (90)': { key: 'points_per_game_90', format: v => v.toFixed(1), reversed: false },
        'xGI (90)': { key: 'xGI_per90', format: v => v.toFixed(2), reversed: false },
        'DC/90 (הגנה)': { key: 'def_contrib_per90', format: v => v.toFixed(1), reversed: false },
        'xDiff': { key: 'xDiff', format: v => v.toFixed(2), reversed: true },
        'מחיר': { key: 'now_cost', format: v => `£${v.toFixed(1)}m`, reversed: true },
        'אחוז בחירה': { key: 'selected_by_percent', format: v => `${v}%`, reversed: true },
        'דקות': { key: 'minutes', format: v => v.toLocaleString(), reversed: false },
    },
    visualizationSpecs: {
        midfielders:{title:'מטריצת קשרים',pos:['MID'],x:'def_contrib_per90',y:'xGI_per90',xLabel:'תרומה הגנתית/90',yLabel:'איום התקפי (xGI/90)', quadLabels: {topRight: 'קשר All-Round', topLeft: 'קשר התקפי', bottomRight: 'קשר הגנתי', bottomLeft: 'פחות תורם'}},
        forwards:{title:'מטריצת חלוצים',pos:['FWD'],x:'points_per_game_90',y:'xGI_per90',xLabel:'נקודות/90',yLabel:'איום התקפי (xGI/90)', quadLabels: {topRight: 'חלוץ עלית', topLeft: 'מאיים, לא יעיל', bottomRight: 'יעיל, איום נמוך', bottomLeft: 'להימנע'}},
        defenders:{title:'מטריצת מגנים',pos:['DEF'],x:'def_contrib_per90',y:'xGI_per90',xLabel:'תרומה הגנתית/90',yLabel:'איום התקפי (xGI/90)', quadLabels: {topRight: 'מגן שלם', topLeft: 'מגן התקפי', bottomRight: 'בלם סלע', bottomLeft: 'להימנע'}},
        goalkeepers:{title:'מטריצת שוערים',pos:['GKP'],x:'saves_per_90',y:'clean_sheets_per_90',xLabel:'הצלות/90',yLabel:'שערים נקיים/90', quadLabels: {topRight: 'שוער עלית', topLeft: 'עסוק, פחות CS', bottomRight: 'יעיל, פחות הצלות', bottomLeft: 'להימנע'}},
        defensive_offensive: {title:'תרומה הגנתית מול איום התקפי', pos:['DEF', 'MID', 'FWD'], x:'def_contrib_per90', y:'xGI_per90', xLabel:'תרומה הגנתית (DC/90)', yLabel:'איום התקפי (xGI/90)', quadLabels: {topRight: 'All-Around Threat', topLeft: 'Offensive Specialist', bottomRight: 'Defensive Anchor', bottomLeft: 'Limited Impact'}}
    },
    recommendationMetrics: {
        'ציון חכם': { key: 'smart_score', format: v => {
            const val = parseFloat(v) || 0;
            return val.toFixed(1);
        }},
        'יציבות': { key: 'stability_index', format: v => {
            const val = parseFloat(v) || 0;
            return val.toFixed(0);
        }},
        'xPts (הבא)': { key: 'predicted_points_1_gw', format: v => {
            const val = parseFloat(v) || 0;
            return val.toFixed(1);
        }},
        'ציון דראפט': { key: 'draft_score', format: v => {
            const val = parseFloat(v) || 0;
            return val.toFixed(1);
        }},
        'Form': { key: 'form', format: v => {
            const val = parseFloat(v) || 0;
            return val.toFixed(1);
        }},
        'הפרש העברות': { key: 'transfers_balance', format: v => {
            const val = parseInt(v) || 0;
            return val > 0 ? `+${val}` : `${val}`;
        }},
        '% בחירה': { key: 'selected_by_percent', format: v => {
            const val = parseFloat(v) || 0;
            return `${val.toFixed(1)}%`;
        }},
        'דקות': { key: 'minutes', format: v => {
            const val = parseInt(v) || 0;
            return Math.round(val);
        }},
    },
    draftAnalyticsDimensions: [
        { key:'sumDraft', label:'ציון דראפט סה"כ' },
        { key:'sumPred', label:'xPts (4GW) סה"כ' },
        { key:'totalPrice', label:'שווי סגל (M)' },
        { key:'sumSelectedBy', label:'אחוז בחירה סה"כ' },
        { key:'gaTotal', label:'שערים+בישולים סה"כ' },
        { key:'totalCleanSheets', label:'שערים נקיים סה"כ' },
        { key:'totalXGI', label:'xGI סה"כ' },
        { key:'totalDefCon', label:'תרומה הגנתית סה"כ' }
    ],
    draftMatrixSpecs: [
        { key: 'val_vs_pf', title: 'שווי קבוצה מול Points For', build: (aggregates) => aggregates.map(t => ({ team:t.team, x: t.metrics.totalPrice||0, y: teamPointsFor(t.team) })) , xLabel:'שווי סגל (M)', yLabel:'Points For', quads: { topRight:'יקר וחזק', topLeft:'זול וחזק', bottomRight:'יקר וחלש', bottomLeft:'זול וחלש' } },
        { key: 'xgi_vs_ga', title: 'xGI סה"כ מול G+A סה"כ', build: (aggregates) => aggregates.map(t => ({ team:t.team, x: t.metrics.totalXGI||0, y: t.metrics.gaTotal||0 })), xLabel:'xGI סה"כ', yLabel:'G+A סה"כ', quads: { topRight:'מימוש גבוה', topLeft:'פוטנציאל לא ממומש', bottomRight:'מימוש יתר', bottomLeft:'נמוך בשניהם' } },
        { key: 'ds_vs_xpts', title: 'ציון דראפט מול xPts(4GW)', build: (aggregates) => aggregates.map(t => ({ team:t.team, x: t.metrics.sumDraft||0, y: t.metrics.sumPred||0 })), xLabel:'ציון דראפט סה"כ', yLabel:'xPts (4GW) סה"כ', quads: { topRight:'סגל איכותי וכושר טוב', topLeft:'סגל איכותי אך תחזית נמוכה', bottomRight:'סגל חלש אך תחזית טובה', bottomLeft:'חלש בשניהם' } },
        { key: 'def_vs_cs', title: 'תרומה הגנתית מול קלין שיטס', build: (aggregates) => aggregates.map(t => ({ team:t.team, x: t.metrics.totalDefCon||0, y: t.metrics.totalCleanSheets||0 })), xLabel:'תרומה הגנתית סה"כ', yLabel:'קלין שיטס סה"כ', quads: { topRight:'הגנה איכותית ומקבלת CS', topLeft:'הגנה חזקה אך מעט CS', bottomRight:'CS רבים אך תרומה נמוכה', bottomLeft:'הגנה חלשה' } },
    ],
    columnTooltips: {
        'draft_score': 'ציון דראפט מושלם: 35% נקודות בפועל, 15% תרומה הגנתית, 12% G+A למשחק, 12% xG למשחק, 10% איכות משחק, 8% אחוז בעלות, 8% בונוס. מחושב לפי עמדה!',
        'predicted_points_1_gw': 'חיזוי נקודות למחזור הבא - מודל מתקדם: 17% מומנטום העברות 🔥, 28% כושר 📈, 25% xGI/90 ⚽, 20% קושי יריבות 🎯, 10% חוזק קבוצה 💪',
        'predicted_points_4_gw': 'צפי נקודות ממוצע ל-4 המחזורים הקרובים (לשימוש פנימי).',
        'stability_index': 'מדד יציבות (0-100) 📊 - מודד עקביות השחקן: 40% כושר אחרון 📈, 30% דיוק xG ⚽, 20% זמן משחק קבוע ⏱️, 10% שונות נקודות 📉. ככל שגבוה יותר = שחקן יציב ויותר צפוי ✅',
        'def_contrib_per90': 'תרומה הגנתית ל-90 דקות (תיקולים, חטיפות, חילוצים).',
        'xDiff': 'ההפרש בין שערים+בישולים בפועל לצפי (xGI). ערך חיובי מעיד על מימוש יתר.',
        'net_transfers_event': 'סה"כ העברות נכנסות פחות יוצאות במחזור הנוכחי - מדד למומנטום ביקוש לשחקן.'
    }
};

const state = {
    allPlayersData: {
        historical: { raw: null, processed: null, fixtures: null },
        live: { raw: null, processed: null, fixtures: null },
        demo: { raw: null, processed: null, fixtures: null }
    },
    currentDataSource: 'live',
    teamsData: {},
    teamStrengthData: {},
    displayedData: [],
    sortColumn: 2,
    sortDirection: 'desc',
    activeQuickFilterName: null,
    selectedForComparison: new Set(),
    // Advanced filters
    searchQuery: '',
    priceRange: { min: 4, max: 15 },
    selectedTeams: [],
    savedFilters: null,
    draft: {
        leagueId: 689,
        details: null,
        standings: null,
        rostersByEntryId: new Map(),
        lineupsByEntryId: new Map(), // { entryId: { starting: [fplId1, ...], bench: [fplId12, ...] } }
        historicalLineups: new Map(), // { entryId: { gw1: { starting: [...], bench: [...] }, gw2: {...}, ... } }
        entryIdToTeamName: new Map(),
        allPicks: new Set(),
        ownedElementIds: new Set(),
        teamAggregates: [],
        _standingsData: [],
        _standingsSort: null,
        charts: { analytics: {}, matrix: null, progress: null },
        // Player ID mapping between Draft API and Fantasy API
        draftToFplIdMap: new Map(), // Draft ID -> Fantasy ID
        fplToDraftIdMap: new Map(), // Fantasy ID -> Draft ID
    }
};

const charts = {
    visualization: null,
    comparisonRadar: null
};

/**
 * Fetch with cache, retry logic, and rate limiting
 * 
 * Features:
 * - Cache with configurable duration
 * - Retry on failure with exponential backoff
 * - Rate limiting detection (429 status)
 * - Network error handling
 * 
 * @param {string} url - URL to fetch
 * @param {string} cacheKey - Cache key for localStorage
 * @param {number} cacheDurationMinutes - Cache validity duration
 * @param {Object} options - Fetch options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.retryDelay - Initial retry delay in ms (default: 1000)
 * @returns {Promise<Object>} - Fetched data
 */
async function fetchWithCache(url, cacheKey, cacheDurationMinutes = 120, options = {}) {
    const { maxRetries = 3, retryDelay = 1000 } = options;
    
    // Try cache first
    const cachedItem = localStorage.getItem(cacheKey);
    if (cachedItem) {
        try {
            const { timestamp, data } = JSON.parse(cachedItem);
            const isCacheValid = (new Date().getTime() - timestamp) / (1000 * 60) < cacheDurationMinutes;
            if (isCacheValid) {
                console.log(`✅ Returning cached data for ${cacheKey}`);
                return data;
            } else {
                localStorage.removeItem(cacheKey);
                 console.log(`⏰ Cache expired for ${cacheKey}`);
            }
        } catch (e) {
            console.error('❌ Error parsing cache, removing item:', e);
            localStorage.removeItem(cacheKey);
        }
    }

    // Fetch with retry logic and proxy fallback
    console.log(`🌐 Fetching fresh data for ${cacheKey}`);
    
    // Extract original URL from proxy URL (if it's already proxied)
    let originalUrl = url;
    const proxies = config.corsProxyFallbacks || [config.corsProxy];
    
    // Check if URL is already proxied and extract the real URL
    for (const proxy of proxies) {
        if (url.startsWith(proxy)) {
            // URL is already proxied, extract the original URL
            originalUrl = decodeURIComponent(url.substring(proxy.length));
            break;
        }
    }
    
    // Try each proxy
    for (let proxyIndex = 0; proxyIndex < proxies.length; proxyIndex++) {
        const currentProxy = proxies[proxyIndex];
        
        // Build new URL with current proxy
        const proxyUrl = currentProxy + encodeURIComponent(originalUrl);
        
        if (proxyIndex > 0) {
            console.log(`🔄 Trying fallback proxy ${proxyIndex + 1}/${proxies.length}: ${currentProxy}`);
        }
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(proxyUrl);
                
                // Handle rate limiting (429)
                if (response.status === 429) {
                    const waitTime = retryDelay * Math.pow(2, attempt - 1);
                    console.warn(`⚠️ Rate limited (429), waiting ${waitTime}ms before retry ${attempt}/${maxRetries}...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
                
                // Handle 403 - try next proxy
                if (response.status === 403) {
                    console.warn(`⚠️ Proxy blocked (403), trying next proxy...`);
                    break; // Break retry loop, try next proxy
                }
                
                // Handle other HTTP errors
        if (!response.ok) {
                    if (attempt === maxRetries) {
                        console.warn(`⚠️ HTTP ${response.status} after ${maxRetries} attempts with proxy ${proxyIndex + 1}`);
                        break; // Try next proxy
                    }
                    console.warn(`⚠️ HTTP ${response.status}, retry ${attempt}/${maxRetries}...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    continue;
                }
                
                // Success - parse and cache
        const data = await response.json();
        
                // Save to cache
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ timestamp: new Date().getTime(), data }));
                    console.log(`💾 Cached data for ${cacheKey}`);
            } catch(e) {
                    console.error("⚠️ Failed to write to localStorage. Cache might be full.", e);
                }
                
                // Update config to use successful proxy for future requests
                if (proxyIndex > 0) {
                    config.corsProxy = currentProxy;
                    console.log(`✅ Switched to working proxy: ${currentProxy}`);
                }
                
                return data;
                
            } catch (error) {
                if (attempt === maxRetries) {
                    console.warn(`⚠️ All attempts failed with proxy ${proxyIndex + 1}: ${error.message}`);
                    break; // Try next proxy
                }
                
                console.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    }
    
    // All proxies failed
    console.error(`❌ All proxies failed for ${cacheKey}`);
    throw new Error(`Failed to fetch ${originalUrl} - all CORS proxies failed`);
}

// ============================================
// DRAFT TO FPL PLAYER ID MAPPING
// ============================================

/**
 * Normalize player name for comparison
 * Removes accents, converts to lowercase, removes extra spaces
 */
function normalizePlayerName(player) {
    const fullName = `${player.first_name} ${player.second_name}`.toLowerCase();
    // Remove accents and special characters
    return fullName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
}

/**
 * Check if two player names match (either first or second name)
 */
function namesMatch(player1, player2) {
    const name1Lower = player1.second_name.toLowerCase();
    const name2Lower = player2.second_name.toLowerCase();
    
    // Exact match on second name
    if (name1Lower === name2Lower) return true;
    
    // Check if one contains the other (for hyphenated names)
    if (name1Lower.includes(name2Lower) || name2Lower.includes(name1Lower)) return true;
    
    return false;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

/**
 * Find fuzzy match for a player using Levenshtein distance
 */
function findFuzzyMatch(draftPlayer, fplPlayers) {
    const draftName = normalizePlayerName(draftPlayer);
    const draftPos = draftPlayer.element_type;
    
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const fplPlayer of fplPlayers) {
        // Only compare players in the same position
        if (fplPlayer.element_type !== draftPos) continue;
        
        const fplName = normalizePlayerName(fplPlayer);
        const distance = levenshteinDistance(draftName, fplName);
        const maxLength = Math.max(draftName.length, fplName.length);
        const similarity = 1 - (distance / maxLength);
        
        if (similarity > bestSimilarity && similarity > 0.8) {
            bestSimilarity = similarity;
            bestMatch = fplPlayer;
        }
    }
    
    return bestMatch ? { player: bestMatch, similarity: bestSimilarity } : null;
}

/**
 * Build mapping between Draft API player IDs and Fantasy API player IDs
 * This solves the problem where IDs don't match between the two APIs
 */
async function buildDraftToFplMapping() {
    console.log('🔄 Building Draft to FPL ID mapping...');
    
    try {
        const fplUrl = config.corsProxy + encodeURIComponent(config.urls.bootstrap);
        const draftUrl = config.corsProxy + encodeURIComponent('https://draft.premierleague.com/api/bootstrap-static');
        
        const [fplData, draftData] = await Promise.all([
            fetchWithCache(fplUrl, 'fpl_bootstrap_mapping', 60),
            fetchWithCache(draftUrl, 'draft_bootstrap_mapping', 60)
        ]);
        
        // Create lookup maps
        const fplById = new Map(fplData.elements.map(p => [p.id, p]));
        const fplByName = new Map();
        
        // Build name-based lookup for FPL players
        for (const p of fplData.elements) {
            const key = normalizePlayerName(p);
            fplByName.set(key, p);
        }
        
        // Clear existing mappings
        state.draft.draftToFplIdMap.clear();
        state.draft.fplToDraftIdMap.clear();
        
        let exactMatches = 0;
        let nameMatches = 0;
        let fuzzyMatches = 0;
        let unmapped = 0;
        
        console.log('📋 Starting player mapping...');
        
        for (const draftPlayer of draftData.elements) {
            let fplPlayer = null;
            let matchType = null;
            
            // Step 1: Try exact ID match + name verification
            const candidate = fplById.get(draftPlayer.id);
            if (candidate && namesMatch(candidate, draftPlayer)) {
                fplPlayer = candidate;
                matchType = 'exact_id';
                exactMatches++;
            }
            
            // Step 2: Try name-based matching
            if (!fplPlayer) {
                const nameKey = normalizePlayerName(draftPlayer);
                fplPlayer = fplByName.get(nameKey);
                if (fplPlayer) {
                    matchType = 'name';
                    nameMatches++;
                    if (draftPlayer.id !== fplPlayer.id) {
                        console.log(`  🔗 Name match: ${draftPlayer.web_name} - Draft:${draftPlayer.id} → FPL:${fplPlayer.id}`);
                    }
                }
            }
            
            // Step 3: Try fuzzy matching (for name variations)
            if (!fplPlayer) {
                const fuzzyMatch = findFuzzyMatch(draftPlayer, fplData.elements);
                if (fuzzyMatch && fuzzyMatch.similarity > 0.85) {
                    fplPlayer = fuzzyMatch.player;
                    matchType = 'fuzzy';
                    fuzzyMatches++;
                    console.log(`  🔍 Fuzzy match: ${draftPlayer.web_name} → ${fplPlayer.web_name} (${(fuzzyMatch.similarity * 100).toFixed(0)}% similar, Draft:${draftPlayer.id} → FPL:${fplPlayer.id})`);
                }
            }
            
            if (fplPlayer) {
                state.draft.draftToFplIdMap.set(draftPlayer.id, fplPlayer.id);
                state.draft.fplToDraftIdMap.set(fplPlayer.id, draftPlayer.id);
            } else {
                unmapped++;
                console.warn(`  ❌ No match found for: ${draftPlayer.web_name} (Draft ID: ${draftPlayer.id}, Position: ${draftPlayer.element_type})`);
            }
        }
        
        console.log('✅ Mapping complete:');
        console.log(`  - Exact ID matches: ${exactMatches}`);
        console.log(`  - Name matches: ${nameMatches}`);
        console.log(`  - Fuzzy matches: ${fuzzyMatches}`);
        console.log(`  - Unmapped: ${unmapped}`);
        console.log(`  - Total mapped: ${state.draft.draftToFplIdMap.size} / ${draftData.elements.length}`);
        
        return {
            success: true,
            mapped: state.draft.draftToFplIdMap.size,
            unmapped: unmapped
        };
        
    } catch (error) {
        console.error('❌ Failed to build Draft→FPL mapping:', error);
        return { success: false, error: error.message };
    }
}

function showLoading(message = 'טוען נתונים...') {
    const overlay = document.getElementById('loadingOverlay');
    overlay.querySelector('p').textContent = message;
    overlay.style.display = 'flex';
    showProgressBar();
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
    hideProgressBar();
}

// Progress Bar Functions
function showProgressBar() {
    const container = document.getElementById('progressBarContainer');
    const bar = document.getElementById('progressBar');
    if (!container || !bar) return;
    
    container.classList.add('active');
    bar.style.width = '0%';
    
    // Simulate progress
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90; // Never reach 100% until complete
        bar.style.width = `${progress}%`;
    }, 300);
    
    // Store interval for cleanup
    container.dataset.intervalId = interval;
}

function hideProgressBar() {
    const container = document.getElementById('progressBarContainer');
    const bar = document.getElementById('progressBar');
    if (!container || !bar) return;
    
    // Clear interval
    if (container.dataset.intervalId) {
        clearInterval(parseInt(container.dataset.intervalId));
    }
    
    // Complete to 100%
    bar.style.width = '100%';
    
    // Hide after animation
    setTimeout(() => {
        container.classList.remove('active');
        bar.style.width = '0%';
    }, 300);
}

// Toast Notification System
function showToast(title, message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons.info}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after duration
    if (duration > 0) {
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    return toast;
}

// Main init function for real data
async function init() {
    Chart.register(ChartDataLabels);
    
    // Load data sources in sequence to ensure mapping works
    showLoading();
    try {
        // 1. First load FPL data
        await fetchAndProcessData();
        
        // 2. Then build the Draft→FPL mapping
        await buildDraftToFplMapping();
        
        // 3. Finally load Draft data (now mapping is ready!)
        await loadDraftDataInBackground();
        
        showToast('טעינה הושלמה', 'כל הנתונים נטענו בהצלחה!', 'success', 3000);
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('שגיאה', 'שגיאה בטעינת הנתונים', 'error', 4000);
    } finally {
        hideLoading();
    }
    
    setupEventListeners();
    const lastTab = localStorage.getItem('fplToolActiveTab');
    if (lastTab) {
        showTab(lastTab);
    }
    initializeTooltips();
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize authentication
    auth.init();
    
    // Ensure global functions are available
    console.log('✅ Global functions initialized:', {
        compareSelectedPlayers: typeof window.compareSelectedPlayers,
        closeModal: typeof window.closeModal
    });
});

async function fetchAndProcessData() {
    showLoading('טוען נתוני שחקנים...');
    try {
        const needsData = !state.allPlayersData[state.currentDataSource].raw;
        const needsFixtures = !state.allPlayersData.live.fixtures;

        if (needsData || needsFixtures) {
            const dataUrl = state.currentDataSource === 'live'
                ? config.corsProxy + encodeURIComponent(config.urls.bootstrap)
                : 'FPL_Bootstrap_static.json';
            const dataCacheKey = `fpl_bootstrap_${state.currentDataSource}`;
            
            const fixturesUrl = config.corsProxy + encodeURIComponent(config.urls.fixtures);
            const fixturesCacheKey = 'fpl_fixtures';

            if (needsData) {
                 if (state.currentDataSource === 'live') {
                    state.allPlayersData.live.raw = await fetchWithCache(dataUrl, dataCacheKey, 60);
                 } else {
                    const response = await fetch(dataUrl); // Local file, no cache
                    state.allPlayersData.historical.raw = await response.json();
                 }
            }
            if (needsFixtures) {
                const fixturesData = await fetchWithCache(fixturesUrl, fixturesCacheKey, 180);
                state.allPlayersData.live.fixtures = fixturesData;
                state.allPlayersData.historical.fixtures = fixturesData;
            }
        }
        
        const data = state.allPlayersData[state.currentDataSource].raw;
        if (!data) throw new Error(`No data available for ${state.currentDataSource}.`);
        if (!state.allPlayersData[state.currentDataSource].processed) {
            state.teamsData = data.teams.reduce((acc, team) => {
                acc[team.id] = { name: team.name, short_name: team.short_name };
                return acc;
            }, {});
            state.teamStrengthData = data.teams.reduce((acc, team) => {
                acc[team.id] = { ...team };
                return acc;
            }, {});
            const setPieceTakers = config.setPieceTakers;
            let processedPlayers = preprocessPlayerData(data.elements.filter(p => p.status !== 'u'), setPieceTakers);
            processedPlayers = calculateAdvancedScores(processedPlayers);
            state.allPlayersData[state.currentDataSource].processed = processedPlayers;
        }
        
        document.getElementById('lastUpdated').textContent = `עדכון אחרון: ${new Date().toLocaleString('he-IL')}`;
        populateTeamFilter();
        updateDashboardKPIs(); // Update dashboard KPIs
        processChange();
        
        // Load draft data in background (for team filter)
        loadDraftDataInBackground();
        
        // Show success toast
        showToast('נתונים נטענו בהצלחה', `${state.allPlayersData[state.currentDataSource].processed.length} שחקנים נטענו`, 'success', 3000);
    } catch (error) {
        console.error('Error in fetchAndProcessData:', error);
        document.getElementById('playersTableBody').innerHTML = `<tr><td colspan="26" style="text-align:center; padding: 20px; color: red;">שגיאה בטעינת נתונים: ${error.message}</td></tr>`;
        showToast('שגיאה בטעינת נתונים', error.message, 'error', 5000);
    } finally {
        hideLoading();
    }
}

function switchDataSource(source) {
    if (source === state.currentDataSource) return;
    state.currentDataSource = source;
    document.getElementById('historicalDataBtn').classList.toggle('active', source === 'historical');
    document.getElementById('liveDataBtn').classList.toggle('active', source === 'live');
    fetchAndProcessData();
}

function getPositionName(elementTypeId) {
    switch (elementTypeId) {
        case 1: return 'GKP';
        case 2: return 'DEF';
        case 3: return 'MID';
        case 4: return 'FWD';
        default: return 'Unknown';
    }
}

function preprocessPlayerData(players, setPieceTakers) {
    return players.map(p => {
        p.defensive_contribution_per_90 = p.minutes > 0 ? ((p.interceptions || 0) + (p.tackles || 0) + (p.clearances_blocks_interceptions || 0)) / (p.minutes / 90) : 0;
        p.xGI_per90 = p.minutes > 0 ? (parseFloat(p.expected_goal_involvements_per_90) || 0) : 0;
        p.def_contrib_per90 = p.defensive_contribution_per_90 || 0;
        p.net_transfers_event = (p.transfers_in_event || 0) - (p.transfers_out_event || 0);
        p.xDiff = ((p.goals_scored || 0) + (p.assists || 0)) - (parseFloat(p.expected_goal_involvements) || 0);
        p.now_cost = p.now_cost / 10;
        p.team_name = state.teamsData[p.team] ? state.teamsData[p.team].name : 'Unknown';
        p.position_name = getPositionName(p.element_type);
        
        const normalizedPlayerName = p.web_name.toLowerCase();
        const teamSetPieces = setPieceTakers[p.team_name] || { penalties: [], freekicks: [], corners: [] };
        
        p.set_piece_priority = {
            penalty: teamSetPieces.penalties.findIndex(name => normalizedPlayerName.includes(name.toLowerCase())) + 1,
            free_kick: teamSetPieces.freekicks.findIndex(name => normalizedPlayerName.includes(name.toLowerCase())) + 1,
            corner: teamSetPieces.corners.findIndex(name => normalizedPlayerName.includes(name.toLowerCase())) + 1,
        };
        
        p.points_per_game_90 = p.minutes > 0 ? (p.total_points / (p.minutes / 90)) : 0;
        p.goals_scored_assists = (p.goals_scored || 0) + (p.assists || 0);
        p.expected_goals_assists = parseFloat(p.expected_goal_involvements) || 0;
        return p;
    });
}

function setupEventListeners() {
    ['searchName', 'priceRange', 'minPoints', 'minMinutes'].forEach(id => document.getElementById(id).addEventListener('keyup', processChange));
    ['positionFilter', 'teamFilter', 'xDiffFilter', 'showEntries'].forEach(id => document.getElementById(id).addEventListener('change', processChange));
}

function initializeTooltips() {
    const tooltipEl = document.getElementById('tooltip');
    
    document.body.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-tooltip]');
        if (!target) return;
        
        tooltipEl.textContent = target.dataset.tooltip;
        tooltipEl.style.display = 'block';
        tooltipEl.classList.add('visible');

        const rect = target.getBoundingClientRect();
        tooltipEl.style.left = `${rect.left + window.scrollX + (rect.width / 2) - (tooltipEl.offsetWidth / 2)}px`;
        tooltipEl.style.top = `${rect.top + window.scrollY - tooltipEl.offsetHeight - 5}px`;
    });

    document.body.addEventListener('mouseout', (e) => {
        if (e.target.closest('[data-tooltip]')) {
            tooltipEl.classList.remove('visible');
        }
    });
}

function populateTeamFilter() {
    const teamFilter = document.getElementById('teamFilter');
    teamFilter.innerHTML = '<option value="">כל הקבוצות</option>';
    if (!state.allPlayersData[state.currentDataSource].processed) return;
    
    const draftTeamFilterGroup = document.querySelector('#teamFilter').parentNode;
    let draftTeamFilter = document.getElementById('draftTeamFilter');
    if (!draftTeamFilter) {
        draftTeamFilter = document.createElement('select');
        draftTeamFilter.id = 'draftTeamFilter';
        draftTeamFilter.onchange = processChange;
        
        const draftLabel = document.createElement('label');
        draftLabel.textContent = '🛡️ קבוצת דראפט:';
        
        const draftGroup = document.createElement('div');
        draftGroup.className = 'filter-group';
        draftGroup.appendChild(draftLabel);
        draftGroup.appendChild(draftTeamFilter);
        
        draftTeamFilterGroup.parentNode.insertBefore(draftGroup, draftTeamFilterGroup.nextSibling);
    }
    
    draftTeamFilter.innerHTML = '<option value="">כל השחקנים</option><option value="free_agents">שחקנים חופשיים</option>';
    if (state.draft.details && state.draft.details.league_entries) {
        state.draft.details.league_entries.forEach(entry => {
            if(entry.entry_name) {
                const option = document.createElement('option');
                option.value = entry.id;
                option.textContent = entry.entry_name;
                draftTeamFilter.appendChild(option);
            }
        });
    }

    const uniqueTeams = [...new Set(state.allPlayersData[state.currentDataSource].processed.map(p => p.team_name))].sort();
    uniqueTeams.forEach(team => {
        const option = document.createElement('option');
        option.value = team;
        option.textContent = team;
        teamFilter.appendChild(option);
    });
}

function createPlayerRowHtml(player, index) {
    const icons = generatePlayerIcons(player);
    const fixturesHTML = generateFixturesHTML(player);
    const isChecked = state.selectedForComparison.has(player.id) ? 'checked' : '';
    

    const draftTeam = getDraftTeamForPlayer(player.id);
    const draftTeamDisplay = draftTeam || '🆓 חופשי';
    const draftTeamClass = draftTeam ? 'draft-owned' : 'draft-free';

    return `<tr>
        <td><input type="checkbox" class="player-select" data-player-id="${player.id}" ${isChecked}></td>
        <td>${index + 1}</td>
        <td class="name-cell"><span class="player-name-icon">${icons.icons}</span>${player.web_name}</td>
        <td class="bold-cell">${player.draft_score.toFixed(1)}</td>
        <td class="bold-cell stability-cell">${(player.stability_index || 0).toFixed(0)}</td>
        <td class="bold-cell" title="חיזוי טכני: ${(player.predicted_points_1_gw || 0).toFixed(1)} נקודות">${(player.predicted_points_1_gw || 0).toFixed(1)}</td>
        <td>${player.team_name}</td>
        <td class="${draftTeamClass}" title="${draftTeamDisplay}">${draftTeamDisplay}</td>
        <td>${player.position_name}</td>
        <td>${player.now_cost.toFixed(1)}</td>
        <td>${player.total_points}</td>
        <td>${player.points_per_game_90.toFixed(1)}</td>
        <td>${player.selected_by_percent}%</td>
        <td>${player.dreamteam_count}</td>
        <td class="transfers-cell" data-tooltip="${config.columnTooltips.net_transfers_event}"><span class="${player.net_transfers_event >= 0 ? 'net-transfers-positive' : 'net-transfers-negative'}">${player.net_transfers_event.toLocaleString()}</span></td>
        <td data-tooltip="${config.columnTooltips.def_contrib_per90}">${player.def_contrib_per90.toFixed(1)}</td>
        <td>${(player.goals_scored || 0) + (player.assists || 0)}</td>
        <td>${(player.xGI_per90 || 0).toFixed(2)}</td>
        <td>${player.minutes}</td>
        <td class="${player.xDiff >= 0 ? 'xdiff-positive' : 'xdiff-negative'}" data-tooltip="${config.columnTooltips.xDiff}">${player.xDiff.toFixed(2)}</td>
        <td>${player.ict_index}</td>
        <td>${player.bonus}</td>
        <td>${player.clean_sheets}</td>
        <td class="${player.set_piece_priority.penalty === 1 ? 'set-piece-yes' : 'set-piece-no'}">${player.set_piece_priority.penalty === 1 ? '🎯 (1)' : '–'}</td>
        <td class="${player.set_piece_priority.corner > 0 ? 'set-piece-yes' : 'set-piece-no'}">${player.set_piece_priority.corner > 0 ? `(${player.set_piece_priority.corner})` : '–'}</td>
        <td class="${player.set_piece_priority.free_kick > 0 ? 'set-piece-yes' : 'set-piece-no'}">${player.set_piece_priority.free_kick > 0 ? `(${player.set_piece_priority.free_kick})` : '–'}</td>
        <td class="fixtures-cell">${fixturesHTML}</td>
    </tr>`;
}

function renderTable() {
    const columnMapping = config.tableColumns;

    state.displayedData.sort((a, b) => {
        let aValue, bValue;
        const field = columnMapping[state.sortColumn];

        if (state.sortColumn === 13) { // Transfers column (transfers_balance)
            aValue = parseFloat(a.transfers_balance || a.net_transfers_event || 0);
            bValue = parseFloat(b.transfers_balance || b.net_transfers_event || 0);
        } else if (state.sortColumn === 15) { // G+A column (goals_scored_assists)
            aValue = (a.goals_scored || 0) + (a.assists || 0);
            bValue = (b.goals_scored || 0) + (b.assists || 0);
        } else if (state.sortColumn === 16) { // xGI column (expected_goals_assists)
            aValue = parseFloat(a.expected_goal_involvements || 0);
            bValue = parseFloat(b.expected_goal_involvements || 0);
        } else {
            aValue = getNestedValue(a, field);
            bValue = getNestedValue(b, field);
            if (typeof aValue === 'string' && !isNaN(aValue)) aValue = parseFloat(aValue);
            if (typeof bValue === 'string' && !isNaN(bValue)) bValue = parseFloat(bValue);
        }
        
        if (aValue === null || aValue === undefined) aValue = -Infinity;
        if (bValue === null || bValue === undefined) bValue = -Infinity;
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            return state.sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        } else {
            return state.sortDirection === 'asc' ? String(aValue).localeCompare(String(bValue)) : String(bValue).localeCompare(String(aValue));
        }
    });

    const tbody = document.getElementById('playersTableBody');
    tbody.innerHTML = state.displayedData.map((player, index) => createPlayerRowHtml(player, index)).join('');

    // Update KPIs based on displayed/filtered data
    updateDashboardKPIs(state.displayedData);

    document.querySelectorAll('.player-select').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const playerId = parseInt(this.dataset.playerId);
            if (this.checked) {
                state.selectedForComparison.add(playerId);
            } else {
                state.selectedForComparison.delete(playerId);
            }
        });
    });

    // Add tooltips to headers
    const headers = document.querySelectorAll('#playersTable thead th');
    const columnKeys = ['rank', 'web_name', 'draft_score', 'stability_index', 'predicted_points_1_gw', 'team_name', 'draft_team', 'position_name', 'now_cost', 'total_points', 'points_per_game_90', 'selected_by_percent', 'dreamteam_count', 'net_transfers_event', 'def_contrib_per90', 'goals_scored_assists', 'expected_goals_assists', 'minutes', 'xDiff', 'ict_index', 'bonus', 'clean_sheets', 'set_piece_priority.penalty', 'set_piece_priority.corner', 'set_piece_priority.free_kick', 'fixtures'];

    headers.forEach((th, i) => {
        const key = columnKeys[i-1];
        if (config.columnTooltips[key]) {
            th.dataset.tooltip = config.columnTooltips[key];
        }
    });
}

function getDraftTeamForPlayer(fplId) {
    // Check if player is owned by any team
    for (const [entryId, roster] of state.draft.rostersByEntryId.entries()) {
        if (roster.includes(fplId)) {
            return state.draft.entryIdToTeamName.get(entryId) || 'Unknown';
        }
    }
    return null; // Free agent
}

function generatePlayerIcons(p) {
    const i = [];
    if (p.set_piece_priority.penalty === 1) i.push(`🎯`);
    if (p.set_piece_priority.corner > 0) i.push(`⚽`);
    if (p.set_piece_priority.free_kick > 0) i.push(`👟`);
    if (parseFloat(p.selected_by_percent) < 5) i.push(`💎`);
    if (p.price_tier === 'Budget' && p.points_per_game_90 > 3.5) i.push(`💰`);
    if (p.minutes === 0) i.push(`🌟`);
    if (p.dreamteam_count > 0) i.push(`🏆`);
    return {
        icons: i.map(e => `<span class='player-name-icon'>${e}</span>`).join(""),
        tooltip: i.join(' ')
    };
}

function generateFixturesHTML(player) {
    const teamId = player.team;
    const fixtures = state.allPlayersData.live.fixtures || state.allPlayersData.historical.fixtures;
    if (!fixtures) return 'N/A';
    
    const teamFixtures = fixtures
        .filter(fix => (fix.team_a === teamId || fix.team_h === teamId) && !fix.finished)
        .sort((a,b) => a.event - b.event)
        .slice(0, 5)
        .map(fix => {
            const opponentId = fix.team_h === teamId ? fix.team_a : fix.team_h;
            const opponent = state.teamsData[opponentId] ? state.teamsData[opponentId].short_name : 'N/A';
            const is_home = fix.team_h === teamId;
            const difficulty = is_home ? fix.team_h_difficulty : fix.team_a_difficulty;
            return `<span class="fixture fdr-${difficulty}" title="${opponent} (${is_home ? 'H' : 'A'})">${opponent}(${is_home ? 'H' : 'A'})</span>`;
        }).join(' ');

    return teamFixtures;
}

async function processChange() {
    if (!state.allPlayersData[state.currentDataSource].processed) return;
    
    // Range Logic
    const statsRange = document.getElementById('statsRange') ? document.getElementById('statsRange').value : 'all';
    
    let sourceData = state.allPlayersData[state.currentDataSource].processed;
    
    if (statsRange !== 'all') {
        const lastN = parseInt(statsRange);
        if (!state.aggregatedCache[lastN]) {
            state.aggregatedCache[lastN] = await calculateAggregatedStats(lastN);
        }
        
        const aggMap = state.aggregatedCache[lastN];
        // Overlay aggregation on source data (create new objects)
        sourceData = sourceData.map(p => {
            const agg = aggMap.get(p.id);
            // If no data in range (e.g. didn't play), return zeroed stats but keep static info
            if (!agg) return { 
                ...p, 
                total_points: 0, 
                goals_scored: 0, 
                assists: 0, 
                minutes: 0, 
                clean_sheets: 0, 
                expected_goal_involvements: 0,
                transfers_in_event: 0, 
                transfers_out_event: 0,
                net_transfers_event: 0,
                form: '0.0', 
                points_per_game: 0, 
                points_per_game_90: 0, 
                xGI_per90: 0, 
                xDiff: 0,
                bonus: 0
            };
            
            return {
                ...p,
                total_points: agg.total_points,
                goals_scored: agg.goals_scored,
                assists: agg.assists,
                minutes: agg.minutes,
                clean_sheets: agg.clean_sheets,
                goals_conceded: agg.goals_conceded,
                saves: agg.saves,
                own_goals: agg.own_goals,
                penalties_saved: agg.penalties_saved,
                penalties_missed: agg.penalties_missed,
                yellow_cards: agg.yellow_cards,
                red_cards: agg.red_cards,
                bonus: agg.bonus,
                bps: agg.bps,
                influence: agg.influence,
                creativity: agg.creativity,
                threat: agg.threat,
                ict_index: agg.ict_index,
                
                expected_goals: agg.expected_goals,
                expected_assists: agg.expected_assists,
                expected_goal_involvements: agg.expected_goal_involvements,
                expected_goals_conceded: agg.expected_goals_conceded,
                
                transfers_in_event: agg.transfers_in_event,
                transfers_out_event: agg.transfers_out_event,
                net_transfers_event: agg.transfers_in_event - agg.transfers_out_event,
                
                form: (agg.total_points / Math.max(1, agg.match_count)).toFixed(1),
                points_per_game: agg.match_count > 0 ? (agg.total_points / agg.match_count) : 0,
                
                // Per 90 Stats
                points_per_game_90: agg.minutes > 0 ? (agg.total_points / agg.minutes) * 90 : 0,
                xGI_per90: agg.minutes > 0 ? (agg.expected_goal_involvements / agg.minutes) * 90 : 0,
                expected_goal_involvements_per_90: agg.minutes > 0 ? (agg.expected_goal_involvements / agg.minutes) * 90 : 0,
                expected_goals_conceded_per_90: agg.minutes > 0 ? (agg.expected_goals_conceded / agg.minutes) * 90 : 0,
                
                // Calculated Metrics
                xDiff: (agg.goals_scored || 0) - (agg.expected_goals || 0),
                // Note: def_contrib_per90 is complex and requires interceptions etc. which we lack in live data.
                // We leave it as static (p.def_contrib_per90) or zero if we want to be strict.
                // Keeping static allows filtering by "general defensive ability" even when viewing recent form.
            };
        });
    }
    
    // Store active range for other functions (like charts)
    state.activeRange = statsRange;

    const nameFilter = document.getElementById('searchName').value.toLowerCase();
    const posFilter = document.getElementById('positionFilter').value;
    const teamFilter = document.getElementById('teamFilter').value;
    const priceInput = document.getElementById('priceRange').value;
    const pointsInput = document.getElementById('minPoints').value;
    const minutesInput = document.getElementById('minMinutes').value;
    const xDiffFilter = document.getElementById('xDiffFilter').value;
    const showEntries = document.getElementById('showEntries').value;
    const draftTeamFilter = document.getElementById('draftTeamFilter') ? document.getElementById('draftTeamFilter').value : '';

    let minPrice = 0, maxPrice = 20;
    if (priceInput) {
        const p = priceInput.split('-');
        if (p.length === 2) {
            minPrice = parseFloat(p[0]) || 0;
            maxPrice = parseFloat(p[1]) || 20;
        } else {
            const s = parseFloat(priceInput);
            if (!isNaN(s)) minPrice = maxPrice = s;
        }
    }

    const minPoints = parseInt(pointsInput) || 0;
    const minMinutes = parseInt(minutesInput) || 0;

    let filteredData = sourceData.filter(p => 
        (!nameFilter || p.web_name.toLowerCase().includes(nameFilter)) &&
        (!posFilter || p.position_name === posFilter) &&
        (!teamFilter || p.team_name === teamFilter) &&
        (p.now_cost >= minPrice && p.now_cost <= maxPrice) &&
        p.total_points >= minPoints &&
        p.minutes >= minMinutes &&
        (xDiffFilter === '' || (xDiffFilter === 'positive' && p.xDiff > 0) || (xDiffFilter === 'negative' && p.xDiff < 0))
    );

    if (draftTeamFilter) {
        if (draftTeamFilter === 'free_agents') {
            filteredData = filteredData.filter(p => !state.draft.ownedElementIds.has(p.id));
        } else {
            const entryId = parseInt(draftTeamFilter);
            if (state.draft.rostersByEntryId.has(entryId)) {
                const teamPlayerIds = new Set(state.draft.rostersByEntryId.get(entryId));
                filteredData = filteredData.filter(p => teamPlayerIds.has(p.id));
            }
        }
    }

    state.displayedData = filteredData;
    if (state.activeQuickFilterName) applyQuickFilter(state.activeQuickFilterName);
    if (showEntries !== 'all') state.displayedData = state.displayedData.slice(0, parseInt(showEntries));
    
    renderTable();
    
    // If charts view is active, re-render charts with new data
    const chartsView = document.getElementById('mainChartsView');
    if (chartsView && getComputedStyle(chartsView).display !== 'none') {
        renderCharts();
    }
}

function getNextFixtures(teamId, count = 3) {
    const fixtures = state.allPlayersData.live.fixtures || state.allPlayersData.historical.fixtures;
    if (!fixtures) return [];
    
    return fixtures
        .filter(fix => (fix.team_a === teamId || fix.team_h === teamId) && !fix.finished)
        .sort((a,b) => a.event - b.event)
        .slice(0, count)
        .map(fix => {
            const is_home = fix.team_h === teamId;
            return {
                opponentId: is_home ? fix.team_a : fix.team_h,
                difficulty: is_home ? fix.team_h_difficulty : fix.team_a_difficulty,
                event: fix.event,
                is_home
            };
        });
}

function applyQuickFilter(filterName) {
    // Note: processChange already set state.displayedData based on range & filters
    // We apply quick filter ON TOP of that
    switch(filterName) {
        case 'set_pieces':
            state.displayedData = state.displayedData.filter(p => p.set_piece_priority.penalty > 0 || p.set_piece_priority.corner > 0 || p.set_piece_priority.free_kick > 0);
            break;
        case 'attacking_defenders':
            state.displayedData = state.displayedData.filter(p => p.position_name === 'DEF' && p.minutes > 300).sort((a,b) => b.xGI_per90 - a.xGI_per90);
            break;
        case 'differentials':
            state.displayedData = state.displayedData.filter(p => parseFloat(p.selected_by_percent) < 5);
            break;
        case 'bonus_magnets':
            state.displayedData = state.displayedData.sort((a,b) => b.bonus - a.bonus).slice(0, 50);
            break;
        case 'form_kings':
            state.displayedData = state.displayedData.sort((a,b) => parseFloat(b.form) - parseFloat(a.form)).slice(0, 50);
            break;
        case 'trending_underachievers': // High transfers IN + Negative xDiff (Unlucky)
            // Sort by transfers_in desc, take top 100 most transferred in, then filter by negative xDiff
            state.displayedData = state.displayedData
                .sort((a,b) => b.transfers_in_event - a.transfers_in_event)
                .slice(0, 150)
                .filter(p => p.xDiff < -0.2) // Underperforming xG
                .sort((a,b) => a.xDiff - b.xDiff); // Most unlucky first (most negative xDiff)
            break;
        case 'easy_fixtures_ppg':
            // Easy fixtures (Avg difficulty < 3) AND Good PPG (> 3.5)
            state.displayedData = state.displayedData.filter(p => {
                const fixtures = getNextFixtures(p.team, 3);
                if (fixtures.length === 0) return false;
                const avgFDR = fixtures.reduce((sum, f) => sum + f.difficulty, 0) / fixtures.length;
                return avgFDR <= 2.8 && p.points_per_game > 3.0;
            }).sort((a,b) => b.points_per_game - a.points_per_game);
            break;
    }
}

function sortTable(columnIndex) {
    if (state.sortColumn === columnIndex) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        state.sortColumn = columnIndex;
        // Default to DESC for score/points columns (draft_score, xPts 1GW, total_points, transfers, etc.)
        if ([2, 3, 4, 7, 8, 9, 10, 13, 14, 15, 16, 17, 18, 19].includes(columnIndex)) {
            state.sortDirection = 'desc';
        } else {
            state.sortDirection = 'asc';
        }
    }
    
    document.querySelectorAll('#playersTable thead th').forEach((th, i) => {
        const indicator = th.querySelector('.sort-indicator');
        if (indicator) {
            indicator.textContent = '';
            if (i - 1 === columnIndex) {
                th.classList.add('sorted');
                indicator.textContent = state.sortDirection === 'desc' ? '▼' : '▲';
            } else {
                th.classList.remove('sorted');
            }
        }
    });
    
    renderTable();
}

function setActiveButton(button) {
    document.querySelectorAll('.control-button').forEach(btn => btn.classList.remove('active'));
    if (button) button.classList.add('active');
}

function showAllPlayers(button) {
    setActiveButton(button);
    state.activeQuickFilterName = null;
    ['searchName','positionFilter','teamFilter','priceRange','minPoints','xDiffFilter', 'draftTeamFilter'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    document.getElementById('minMinutes').value='30';
    document.getElementById('showEntries').value='all';
    processChange();
    sortTable(2);
}

function toggleQuickFilter(button, filterName) {
    // If already active, clear it
    if (state.activeQuickFilterName === filterName) {
        state.activeQuickFilterName = null;
        button.classList.remove('active');
        showAllPlayers(); // Reset to default view (clears filters and resets sort)
    } else {
        // Set new filter
    state.activeQuickFilterName = filterName;
        
        // Update UI
        document.querySelectorAll('.quick-filter-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Reset other inputs to avoid confusion, but keep quick filter active
        ['searchName','positionFilter','teamFilter','priceRange','minPoints','xDiffFilter', 'draftTeamFilter'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.value = '';
        });
        document.getElementById('minMinutes').value='0'; // Often quick filters need low minutes
        
    processChange();
        sortTable(2); // Sort by Draft Score/Quality by default when filtering
    }
}

function exportToCsv() {
    const headers = ['Rank','Player','Draft Score','Stability','Prediction Score','Quality Score','xPts (4GW)','Team','Pos','Price','Pts','PPG','Sel %','DreamTeam','Net TF (GW)','DC/90','G+A','xGI','Mins','xDiff','ICT','Bonus','CS','Pen','Cor','FK'];
    let csvContent = headers.join(',') + '\n';
    
    state.displayedData.forEach((p, i) => {
        const row = [
            i + 1,
            p.web_name.replace(/,/g, ''),
            p.draft_score.toFixed(2),
            (p.stability_index || 0).toFixed(0),
            p.base_score.toFixed(2),
            p.quality_score.toFixed(2),
            (p.predicted_points_4_gw || 0).toFixed(2),
            p.team_name,
            p.position_name,
            p.now_cost,
            p.total_points,
            p.points_per_game_90.toFixed(2),
            p.selected_by_percent,
            p.dreamteam_count,
            p.net_transfers_event,
            p.def_contrib_per90.toFixed(2),
            (p.goals_scored || 0) + (p.assists || 0),
            (p.expected_goal_involvements || 0).toFixed(2),
            p.minutes,
            p.xDiff.toFixed(2),
            p.ict_index,
            p.bonus,
            p.clean_sheets,
            p.set_piece_priority.penalty,
            p.set_piece_priority.corner,
            p.set_piece_priority.free_kick,
        ];
        csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'fpl_players_data.csv';
    link.click();
}

function generateComparisonTableHTML(players) {
    // 🎨 ULTIMATE PLAYER COMPARISON - COMPLETE MAKEOVER
    
    const photoUrl = (p) => `https://resources.premierleague.com/premierleague/photos/players/110x140/p${p.code}.png`;
    const fallbackSVG = (name) => `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22110%22 height=%22140%22%3E%3Crect fill=%22%2394a3b8%22 width=%22110%22 height=%22140%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23fff%22 font-size=%2248%22 font-weight=%22bold%22%3E${name.charAt(0)}%3C/text%3E%3C/svg%3E`;
    
    let html = `
        <div class="ultimate-comparison-container">
            <!-- 🏆 HEADER -->
            <div class="comparison-hero-header">
                <div class="hero-title-wrapper">
                    <span class="hero-icon">⚔️</span>
                    <h2 class="hero-title">השוואת שחקנים</h2>
                    <span class="hero-badge">${players.length} שחקנים</span>
                </div>
                <p class="hero-subtitle">ניתוח מקיף לקבלת החלטה מושכלת</p>
            </div>
            
            <!-- 👥 PLAYER CARDS GRID -->
            <div class="ultimate-players-grid">
    `;
    
    // Player Cards with enhanced stats
    players.forEach((p, idx) => {
        const positionColors = {
            'GKP': '#f59e0b',
            'DEF': '#3b82f6',
            'MID': '#10b981',
            'FWD': '#ef4444'
        };
        const posColor = positionColors[p.position_name] || '#6366f1';
        
        html += `
            <div class="ultimate-player-card" style="animation-delay: ${idx * 0.1}s; border-top: 4px solid ${posColor}">
                <div class="player-card-photo-wrapper">
                    <img src="${photoUrl(p)}" alt="${p.web_name}" class="player-card-photo-ultimate" onerror="this.src='${fallbackSVG(p.web_name)}'">
                    <div class="player-position-badge" style="background: ${posColor}">${p.position_name}</div>
                </div>
                <div class="player-card-info">
                    <h3 class="player-name-ultimate">${p.web_name}</h3>
                    <p class="player-team-ultimate">${p.team_name}</p>
                    
                    <!-- Quick Stats Grid -->
                    <div class="quick-stats-grid">
                        <div class="quick-stat">
                            <span class="quick-stat-icon">💰</span>
                            <div class="quick-stat-content">
                                <span class="quick-stat-label">מחיר</span>
                                <span class="quick-stat-value">£${p.now_cost.toFixed(1)}M</span>
                            </div>
                        </div>
                        <div class="quick-stat">
                            <span class="quick-stat-icon">⭐</span>
                            <div class="quick-stat-content">
                                <span class="quick-stat-label">ציון דראפט</span>
                                <span class="quick-stat-value">${p.draft_score.toFixed(1)}</span>
                            </div>
                        </div>
                        <div class="quick-stat">
                            <span class="quick-stat-icon">🎯</span>
                            <div class="quick-stat-content">
                                <span class="quick-stat-label">נק' כולל</span>
                                <span class="quick-stat-value">${p.total_points}</span>
                            </div>
                        </div>
                        <div class="quick-stat">
                            <span class="quick-stat-icon">🔥</span>
                            <div class="quick-stat-content">
                                <span class="quick-stat-label">כושר</span>
                                <span class="quick-stat-value">${parseFloat(p.form || 0).toFixed(1)}</span>
                            </div>
                        </div>
                        <div class="quick-stat">
                            <span class="quick-stat-icon">🔄</span>
                            <div class="quick-stat-content">
                                <span class="quick-stat-label">העברות נטו</span>
                                <span class="quick-stat-value" style="color: ${(p.net_transfers_event || 0) >= 0 ? '#10b981' : '#ef4444'}">
                                    ${(p.net_transfers_event || 0) >= 0 ? '+' : ''}${(p.net_transfers_event || 0).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
            
            <!-- 📊 COMPREHENSIVE METRICS COMPARISON -->
            <div class="ultimate-metrics-section">
                <h3 class="metrics-section-title">
                    <span class="metrics-icon">📊</span>
                    השוואה מפורטת
                </h3>
                
                <div class="metrics-comparison-table">
    `;
    
    // Define comprehensive metrics (ordered by importance)
    const comprehensiveMetrics = [
        { name: 'ציון דראפט', key: 'draft_score', format: v => v.toFixed(1), icon: '⭐', reversed: false },
        { name: 'העברות נטו', key: 'net_transfers_event', format: v => (v >= 0 ? '+' : '') + v, icon: '🔄', reversed: false },
        { name: 'חיזוי למחזור הבא', key: 'predicted_points_1_gw', format: v => v.toFixed(1), icon: '🔮', reversed: false },
        { name: 'כושר', key: 'form', format: v => parseFloat(v || 0).toFixed(1), icon: '🔥', reversed: false },
        { name: 'נקודות/90', key: 'points_per_game_90', format: v => v.toFixed(1), icon: '📈', reversed: false },
        { name: 'נקודות כולל', key: 'total_points', format: v => v, icon: '🎯', reversed: false },
        { name: 'יציבות', key: 'stability_index', format: v => v.toFixed(0), icon: '📊', reversed: false },
        { name: 'xGI/90', key: 'xGI_per90', format: v => v.toFixed(2), icon: '⚽', reversed: false },
        { name: 'G+A', key: 'goals_scored_assists', format: v => v, icon: '🎯', reversed: false },
        { name: 'מחיר', key: 'now_cost', format: v => '£' + v.toFixed(1) + 'M', icon: '💰', reversed: true },
        { name: '% בעלות', key: 'selected_by_percent', format: v => v + '%', icon: '👥', reversed: false },
        { name: 'דקות', key: 'minutes', format: v => v.toLocaleString(), icon: '⏱️', reversed: false },
        { name: 'בונוס', key: 'bonus', format: v => v, icon: '⭐', reversed: false },
        { name: 'דרימטים', key: 'dreamteam_count', format: v => v, icon: '🏆', reversed: false },
        { name: 'ICT Index', key: 'ict_index', format: v => v.toFixed(1), icon: '🧬', reversed: false },
        { name: 'DC/90', key: 'def_contrib_per90', format: v => v.toFixed(1), icon: '🛡️', reversed: false },
        { name: 'xDiff', key: 'xDiff', format: v => (v >= 0 ? '+' : '') + v.toFixed(2), icon: '📉', reversed: false },
        { name: 'CS', key: 'clean_sheets', format: v => v, icon: '🧤', reversed: false },
    ];
    
    comprehensiveMetrics.forEach((metric, idx) => {
        const values = players.map(p => {
            let val = getNestedValue(p, metric.key);
            if (metric.key === 'goals_scored_assists') {
                val = (p.goals_scored || 0) + (p.assists || 0);
            }
            return typeof val === 'number' ? val : parseFloat(val) || 0;
        });
        
        const maxVal = Math.max(...values);
        const minVal = Math.min(...values);
        
        html += `
            <div class="metric-comparison-row" style="animation-delay: ${idx * 0.03}s">
                <div class="metric-row-label">
                    <span class="metric-row-icon">${metric.icon}</span>
                    <span class="metric-row-name">${metric.name}</span>
                </div>
                <div class="metric-row-values">
        `;
        
        players.forEach((p, pIdx) => {
            const value = values[pIdx];
            const isBest = metric.reversed ? (value === minVal) : (value === maxVal);
            const isWorst = metric.reversed ? (value === maxVal) : (value === minVal);
            const percentage = maxVal > minVal ? ((value - minVal) / (maxVal - minVal) * 100) : 50;
            
            html += `
                <div class="metric-value-box ${isBest ? 'best-value' : ''} ${isWorst ? 'worst-value' : ''}">
                    <div class="metric-value-number">${metric.format(value)}</div>
                    <div class="metric-value-bar-container">
                        <div class="metric-value-bar" style="width: ${percentage}%"></div>
                    </div>
                    ${isBest ? '<span class="best-badge">🏆</span>' : ''}
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    // Fixtures Row
    html += `
            <div class="metric-comparison-row fixtures-comparison-row">
                <div class="metric-row-label">
                    <span class="metric-row-icon">📅</span>
                    <span class="metric-row-name">משחקים קרובים</span>
                </div>
                <div class="metric-row-values">
    `;
    
    players.forEach(p => {
        const fixturesHTML = generateFixturesHTML(p);
        html += `
            <div class="metric-value-box fixtures-box">
                ${fixturesHTML || '<span class="no-fixtures">אין נתונים</span>'}
            </div>
        `;
    });
    
    html += `
                </div>
            </div>
        </div>
    </div>
</div>
    `;
    
    return html;
}

// Old compare function removed

function getMetricValueClass(value, values, reversed) {
    const numericValues = values.filter(v => typeof v === 'number');
    if (numericValues.length < 2) return '';
    const max = Math.max(...numericValues);
    const min = Math.min(...numericValues);
    if (value === (reversed ? min : max)) return 'metric-value-best';
    if (value === (reversed ? max : min)) return 'metric-value-worst';
    return 'metric-value-mid';
}

// Radar chart removed - not needed for the new comparison design

window.closeModal = function() {
    const compareModal = document.getElementById('compareModal');
    const vizModal = document.getElementById('visualizationModal');
    
    if (compareModal) compareModal.style.display = 'none';
    if (vizModal) vizModal.style.display = 'none';
    
    document.body.style.overflow = ''; // Restore scrolling
    
    if(charts.visualization){
        charts.visualization.destroy();
        charts.visualization=null;
    }
    
    console.log('✅ Modal closed');
};

// ============================================
// ADVANCED SEARCH & FILTERS
// ============================================

function handleSearch() {
    const query = document.getElementById('playerSearch').value.toLowerCase();
    state.searchQuery = query;
    applyFilters();
}

function clearSearch() {
    document.getElementById('playerSearch').value = '';
    state.searchQuery = '';
    applyFilters();
}

function updatePriceFilter() {
    const minEl = document.getElementById('priceMin');
    const maxEl = document.getElementById('priceMax');
    
    let min = parseFloat(minEl.value);
    let max = parseFloat(maxEl.value);
    
    // Ensure min <= max
    if (min > max) {
        [min, max] = [max, min];
        minEl.value = min;
        maxEl.value = max;
    }
    
    state.priceRange = { min, max };
    
    document.getElementById('priceMinVal').textContent = min.toFixed(1);
    document.getElementById('priceMaxVal').textContent = max.toFixed(1);
    
    applyFilters();
}

function applyFilters() {
    const select = document.getElementById('teamMultiSelect');
    if (!select) return;
    
    state.selectedTeams = Array.from(select.selectedOptions).map(opt => opt.value);
    
    let filtered = state.allPlayersData[state.currentDataSource].processed;
    
    // Search query
    if (state.searchQuery) {
        filtered = filtered.filter(p => 
            p.web_name.toLowerCase().includes(state.searchQuery) ||
            p.team_name.toLowerCase().includes(state.searchQuery) ||
            p.now_cost.toString().includes(state.searchQuery)
        );
    }
    
    // Price range
    filtered = filtered.filter(p => 
        p.now_cost >= state.priceRange.min && 
        p.now_cost <= state.priceRange.max
    );
    
    // Selected teams
    if (state.selectedTeams.length > 0) {
        filtered = filtered.filter(p => state.selectedTeams.includes(p.team_name));
    }
    
    state.displayedData = filtered;
    renderTable();
    
    // Update charts with filtered data
    const chartsView = document.getElementById('mainChartsView');
    if (chartsView && getComputedStyle(chartsView).display !== 'none') {
        renderCharts();
    }
    
    // Show results count
    showToast('תוצאות', `נמצאו ${filtered.length} שחקנים`, 'info', 2000);
}

function resetAllFilters() {
    // Reset search
    document.getElementById('playerSearch').value = '';
    state.searchQuery = '';
    
    // Reset price
    document.getElementById('priceMin').value = 4;
    document.getElementById('priceMax').value = 15;
    state.priceRange = { min: 4, max: 15 };
    document.getElementById('priceMinVal').textContent = '4.0';
    document.getElementById('priceMaxVal').textContent = '15.0';
    
    // Reset teams
    const select = document.getElementById('teamMultiSelect');
    if (select) {
        Array.from(select.options).forEach(opt => opt.selected = false);
    }
    state.selectedTeams = [];
    
    // Reset quick filters
    state.activeQuickFilterName = null;
    document.querySelectorAll('.control-button[data-filter-name]').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show all data
    state.displayedData = state.allPlayersData[state.currentDataSource].processed;
    renderTable();
    
    // Update charts with all data
    const chartsView = document.getElementById('mainChartsView');
    if (chartsView && getComputedStyle(chartsView).display !== 'none') {
        renderCharts();
    }
    
    showToast('אופס', 'כל הפילטרים אופסו', 'success', 2000);
}

function saveFilters() {
    const filters = {
        searchQuery: state.searchQuery,
        priceRange: state.priceRange,
        selectedTeams: state.selectedTeams
    };
    
    localStorage.setItem('fpl_saved_filters', JSON.stringify(filters));
    showToast('נשמר', 'העדפות הפילטרים נשמרו בהצלחה', 'success', 3000);
}

function loadSavedFilters() {
    const saved = localStorage.getItem('fpl_saved_filters');
    if (!saved) return;
    
    try {
        const filters = JSON.parse(saved);
        
        // Restore search
        if (filters.searchQuery) {
            const searchEl = document.getElementById('playerSearch');
            if (searchEl) {
                searchEl.value = filters.searchQuery;
                state.searchQuery = filters.searchQuery;
            }
        }
        
        // Restore price
        if (filters.priceRange) {
            const minEl = document.getElementById('priceMin');
            const maxEl = document.getElementById('priceMax');
            const minValEl = document.getElementById('priceMinVal');
            const maxValEl = document.getElementById('priceMaxVal');
            
            if (minEl && maxEl) {
                minEl.value = filters.priceRange.min;
                maxEl.value = filters.priceRange.max;
                state.priceRange = filters.priceRange;
                if (minValEl) minValEl.textContent = filters.priceRange.min.toFixed(1);
                if (maxValEl) maxValEl.textContent = filters.priceRange.max.toFixed(1);
            }
        }
        
        // Restore teams
        if (filters.selectedTeams && filters.selectedTeams.length > 0) {
            const select = document.getElementById('teamMultiSelect');
            if (select) {
                filters.selectedTeams.forEach(team => {
                    const option = Array.from(select.options).find(opt => opt.value === team);
                    if (option) option.selected = true;
                });
                state.selectedTeams = filters.selectedTeams;
            }
        }
        
        showToast('טעינה', 'העדפות הפילטרים נטענו', 'info', 2000);
    } catch (e) {
        console.error('Failed to load saved filters:', e);
    }
}

function populateTeamSelect() {
    const select = document.getElementById('teamMultiSelect');
    if (!select) return;
    
    const teams = [...new Set(state.allPlayersData[state.currentDataSource].processed.map(p => p.team_name))].sort();
    
    select.innerHTML = teams.map(team => `<option value="${team}">${team}</option>`).join('');
}

// ============================================
// EXPORT TO CSV
// ============================================

function exportToCsv() {
    const data = state.displayedData;
    if (!data || data.length === 0) {
        showToast('אין נתונים', 'אין נתונים לייצוא', 'warning', 3000);
        return;
    }
    
    // Define columns to export (all table columns)
    const columns = [
        { key: 'web_name', header: 'שם' },
        { key: 'draft_score', header: 'ציון דראפט' },
        { key: 'stability_index', header: 'יציבות' },
        { key: 'predicted_points_1_gw', header: 'חיזוי טכני' },
        { key: 'ml_prediction', header: 'ML חיזוי' },
        { key: 'team_name', header: 'קבוצה' },
        { key: 'draft_team', header: 'קבוצת דראפט', format: (player) => getDraftTeamForPlayer(player.id) || 'חופשי' },
        { key: 'position_name', header: 'עמדה' },
        { key: 'now_cost', header: 'מחיר' },
        { key: 'total_points', header: 'נקודות' },
        { key: 'points_per_game_90', header: 'נק/משחק' },
        { key: 'selected_by_percent', header: 'בחירה %' },
        { key: 'dreamteam_count', header: 'DreamTeam' },
        { key: 'net_transfers_event', header: 'העברות' },
        { key: 'def_contrib_per90', header: 'DC/90' },
        { key: 'goals_scored_assists', header: 'G+A', format: (player) => (player.goals_scored || 0) + (player.assists || 0) },
        { key: 'expected_goals_assists', header: 'xG+xA', format: (player) => parseFloat(player.expected_goal_involvements || 0).toFixed(2) },
        { key: 'minutes', header: 'דקות' },
        { key: 'xDiff', header: 'xDiff' },
        { key: 'ict_index', header: 'ICT' },
        { key: 'bonus', header: 'Bonus' },
        { key: 'clean_sheets', header: 'CS' },
        { key: 'penalty_priority', header: 'פנדל', format: (player) => player.set_piece_priority?.penalty === 1 ? 'כן' : 'לא' },
        { key: 'corner_priority', header: 'קרן', format: (player) => player.set_piece_priority?.corner || 0 },
        { key: 'free_kick_priority', header: 'בעיטה חופשית', format: (player) => player.set_piece_priority?.free_kick || 0 }
    ];
    
    // Create CSV header
    const csvHeader = columns.map(col => col.header).join(',');
    
    // Create CSV rows
    const csvRows = data.map(player => {
        return columns.map(col => {
            // Use custom format function if provided
            let value;
            if (col.format && typeof col.format === 'function') {
                value = col.format(player);
            } else {
                value = player[col.key];
            }
            
            // Format numbers
            if (typeof value === 'number') {
                value = value.toFixed(2);
            }
            
            // Handle undefined/null
            if (value === undefined || value === null) {
                value = '';
            }
            
            // Convert to string
            value = String(value);
            
            // Escape commas and quotes
                value = value.replace(/"/g, '""');
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    value = `"${value}"`;
            }
            
            return value;
        }).join(',');
    });
    
    // Combine header and rows
    const csv = [csvHeader, ...csvRows].join('\n');
    
    // Add BOM for Hebrew support in Excel
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csv;
    
    // Create blob and download
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `FPL_Players_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('הורדה הושלמה', `${data.length} שחקנים יוצאו בהצלחה`, 'success', 3000);
}

/**
 * Compare selected players in a modal
 */
function getNextOpponent(player) {
    if (!state.teamsData || !player.team) return '-';
    
    let fixtures = [];
    if (state.currentDataSource === 'demo') {
        fixtures = state.allPlayersData.demo?.fixtures || [];
    } else {
        fixtures = state.allPlayersData.live?.fixtures || state.allPlayersData.historical?.fixtures || [];
    }
    
    const currentGW = state.draft.details?.league?.current_event || 1;
    const nextGW = currentGW + 1;
    
    const nextFixture = fixtures.find(f => 
        !f.finished && 
        f.event === nextGW && 
        (f.team_h === player.team || f.team_a === player.team)
    );
    
    if (nextFixture) {
        const oppTeamId = nextFixture.team_h === player.team ? nextFixture.team_a : nextFixture.team_h;
        const oppTeam = state.teamsData[oppTeamId];
        const isHome = nextFixture.team_h === player.team;
        return oppTeam ? `${isHome ? 'vs' : '@'} ${oppTeam.short_name}` : '-';
    }
    
    return '-';
}

function compareSelectedPlayers() {
    console.log("⚖️ compareSelectedPlayers() called");
    try {
    const checkboxes = document.querySelectorAll('.player-select:checked');
    
    if (checkboxes.length === 0) {
        showToast('לא נבחרו שחקנים', 'אנא בחר לפחות שחקן אחד להשוואה', 'warning', 3000);
        return;
    }
    
    if (checkboxes.length > 5) {
        showToast('יותר מדי שחקנים', 'ניתן להשוות עד 5 שחקנים בו-זמנית', 'warning', 3000);
        return;
    }
    
    const playerIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.playerId));
    
        let players = [];
        if (state.displayedData && state.displayedData.length > 0) {
            players = playerIds.map(id => state.displayedData.find(p => p.id === id)).filter(Boolean);
        }
        
        if (players.length < playerIds.length) {
            const allPlayers = state.allPlayersData[state.currentDataSource]?.processed || [];
            const foundIds = players.map(p => p.id);
            const missingIds = playerIds.filter(id => !foundIds.includes(id));
            const foundMissing = missingIds.map(id => allPlayers.find(p => p.id === id)).filter(Boolean);
            players = [...players, ...foundMissing];
        }
    
    if (players.length === 0) {
            showToast('שגיאה', 'לא נמצאו נתוני שחקנים. נסה לרענן את הדף.', 'error', 3000);
        return;
    }
    
        // Remove existing modal
        const existingModal = document.getElementById('compareModal');
        if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'compareModal';
        modal.className = 'modal active'; // Use existing modal class for base styles
    modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px);
            display: flex; justify-content: center; align-items: center; z-index: 10000;
            padding: 20px; animation: fadeIn 0.3s ease-out;
        `;
        
        // Metrics definition
    const metrics = [
            { key: 'draft_score', label: '🏆 ציון דראפט', format: (v) => v?.toFixed(1) || '0.0', highlight: 'high' },
            { key: 'predicted_points_1_gw', label: '🔮 חיזוי GW הבא', format: (v) => v?.toFixed(1) || '0.0', highlight: 'high' },
            { key: 'points_per_game', label: '📊 נק\'/משחק', format: (v) => (typeof v === 'number' ? v.toFixed(1) : v) || '0.0', highlight: 'high' },
            { key: 'total_points', label: '⚽ סה"כ נקודות', format: (v) => v || '0', highlight: 'high' },
            { key: 'form', label: '🔥 כושר (Form)', format: (v) => v || '0.0', highlight: 'high' },
            { key: 'net_transfers_event', label: '🔄 העברות נטו', format: (v) => (v > 0 ? '+' : '') + (v || '0').toLocaleString(), highlight: 'high' },
            { key: 'now_cost', label: '💰 מחיר', format: (v) => `£${(v / 10).toFixed(1)}m`, highlight: 'low' },
            { key: 'selected_by_percent', label: '👥 % בעלות', format: (v) => `${v}%`, highlight: 'high' },
            { key: 'expected_goal_involvements', label: '🎯 xGI', format: (v) => parseFloat(v || 0).toFixed(2), highlight: 'high' },
            { key: 'goals_scored', label: '⚽ שערים', format: (v) => v || '0', highlight: 'high' },
            { key: 'assists', label: '🅰️ בישולים', format: (v) => v || '0', highlight: 'high' },
            { key: 'def_contrib_per90', label: '🛡️ DefCon (הגנה)', format: (v) => (v * 100).toFixed(1) + '%', highlight: 'high' },
            { key: 'clean_sheets', label: '🧼 שערים נקיים (CS)', format: (v) => v || '0', highlight: 'high', tooltip: 'מספר המשחקים בהם הקבוצה לא ספגה שערים (רלוונטי למגנים ושוערים)' },
            { key: 'starts', label: '🔛 פתח בהרכב', format: (v) => v || '0', highlight: 'high' },
            { key: 'goals_conceded', label: '🥅 ספיגות', format: (v) => v || '0', highlight: 'low' },
            { key: 'threat', label: '🔫 איום (Threat)', format: (v) => parseFloat(v || 0).toFixed(0), highlight: 'high' },
            { key: 'creativity', label: '🎨 יצירתיות', format: (v) => parseFloat(v || 0).toFixed(0), highlight: 'high' },
            { key: 'influence', label: '💪 השפעה', format: (v) => parseFloat(v || 0).toFixed(0), highlight: 'high' },
            { key: 'bonus', label: '⭐ בונוס', format: (v) => v || '0', highlight: 'high' },
            { key: 'ict_index', label: '📈 ICT Index', format: (v) => v || '0.0', highlight: 'high' }
        ];

        // Find max values for highlighting
        const maxValues = {};
        metrics.forEach(m => {
            const values = players.map(p => parseFloat(p[m.key]) || 0);
            maxValues[m.key] = Math.max(...values);
        });

        const content = `
            <div style="
                background: white; width: 100%; max-width: 1100px; max-height: 90vh;
                border-radius: 24px; overflow: hidden; display: flex; flex-direction: column;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            ">
                <!-- Header -->
                <div style="
                    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                    padding: 24px 32px; display: flex; justify-content: space-between; align-items: center;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                ">
                    <div>
                        <h2 style="margin: 0; color: white; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">⚖️ ראש בראש</h2>
                        <p style="margin: 4px 0 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">השוואת נתונים מעמיקה</p>
                </div>
                    <button onclick="closeModal()" style="
                        background: rgba(255,255,255,0.15); border: none; color: white;
                        width: 40px; height: 40px; border-radius: 12px; cursor: pointer;
                        display: flex; align-items: center; justify-content: center;
                        font-size: 20px; transition: all 0.2s;
                    " onmouseover="this.style.background='rgba(255,255,255,0.25)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">✕</button>
            </div>
            
                <!-- Scrollable Content -->
                <div style="overflow: auto; flex: 1; padding: 32px; background: #f8fafc;">
                    <div style="display: grid; grid-template-columns: auto repeat(${players.length}, 1fr); gap: 0; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                        
                        <!-- Header Row: Players -->
                        <div style="padding: 20px; background: #f8fafc; border-bottom: 2px solid #e2e8f0;"></div>
                                ${players.map(p => `
                            <div style="padding: 24px 16px; text-align: center; background: #fff; border-bottom: 2px solid #e2e8f0; border-right: 1px solid #f1f5f9;">
                                <div style="position: relative; display: inline-block; margin-bottom: 12px;">
                                    <img src="${getPlayerPhotoUrl(p.code)}" 
                                         onerror="this.src='https://resources.premierleague.com/premierleague/photos/players/110x140/p144485.png'" 
                                         style="width: 80px; height: 80px; border-radius: 50%; border: 4px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.1); object-fit: cover;">
                                    <div style="position: absolute; bottom: 0; right: 0; background: #3b82f6; color: white; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 10px; border: 2px solid white;">${p.position_name}</div>
                                        </div>
                                <div style="font-weight: 800; color: #0f172a; font-size: 16px; margin-bottom: 4px;">${p.web_name}</div>
                                <div style="font-size: 12px; color: #64748b; background: #f1f5f9; padding: 4px 10px; border-radius: 20px; display: inline-block; margin-bottom: 8px;">${p.team_name}</div>
                                <div style="font-size: 11px; color: #0f172a; font-weight: 700; margin-top: 8px;">
                                    <span style="color: #10b981;">GW נוכחי:</span> ${p.event_points || 0} נק'
                                </div>
                                <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
                                    <span style="font-weight: 600;">משחק הבא:</span> ${getNextOpponent(p)}
                                </div>
                            </div>
                                `).join('')}

                        <!-- Metrics Rows -->
                        ${metrics.map((m, i) => `
                            <div style="
                                padding: 16px 24px; font-weight: 600; color: #64748b; display: flex; align-items: center;
                                background: ${i % 2 === 0 ? '#ffffff' : '#fcfcfc'}; border-bottom: 1px solid #f1f5f9;
                            ">${m.label}</div>
                ${players.map(p => {
                                const val = parseFloat(p[m.key]) || 0;
                                const isMax = m.highlight === 'high' && val === maxValues[m.key] && val > 0;
                    return `
                                    <div style="
                                        padding: 16px; text-align: center; font-weight: ${isMax ? '800' : '500'}; 
                                        color: ${isMax ? '#15803d' : '#334155'};
                                        background: ${isMax ? '#dcfce7' : (i % 2 === 0 ? '#ffffff' : '#fcfcfc')};
                                        border-bottom: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9;
                                        font-size: 15px; position: relative;
                                    ">
                                        ${m.format(p[m.key])}
                                        ${isMax ? '<span style="position: absolute; top: 50%; right: 10px; transform: translateY(-50%); color: #16a34a; font-size: 10px;">👑</span>' : ''}
                                    </div>
                    `;
                }).join('')}
                        `).join('')}
                </div>
            </div>
        </div>
    `;
    
        modal.innerHTML = content;
    
        // Close on click outside
    modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
    });
    
    document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
        
    } catch (err) {
        console.error("Error in compareSelectedPlayers:", err);
        showToast('שגיאה', 'אירעה שגיאה בטעינת ההשוואה', 'error', 3000);
    }
}

window.compareSelectedPlayers = compareSelectedPlayers;


function closeModal() {
    const modal = document.getElementById('compareModal');
    if (modal) modal.remove();
    document.body.style.overflow = '';
}

// ============================================
// DASHBOARD KPIs
// ============================================

function updateDashboardKPIs(dataToUse = null) {
    // Use filtered/displayed data if available, otherwise use all processed data
    const data = dataToUse || state.displayedData || state.allPlayersData[state.currentDataSource].processed;
    if (!data || data.length === 0) {
        // Show "no data" state
        document.getElementById('kpiHotPlayer').textContent = '-';
        document.getElementById('kpiHotPlayerForm').textContent = 'אין נתונים';
        document.getElementById('kpiBestDraft').textContent = '-';
        document.getElementById('kpiBestDraftScore').textContent = 'אין נתונים';
        document.getElementById('kpiTopScorer').textContent = '-';
        document.getElementById('kpiTopScorerGoals').textContent = 'אין נתונים';
        document.getElementById('kpiTopAssister').textContent = '-';
        document.getElementById('kpiTopAssisterAssists').textContent = 'אין נתונים';
        document.getElementById('kpiTopPoints').textContent = '-';
        document.getElementById('kpiTopPointsValue').textContent = 'אין נתונים';
        document.getElementById('kpiBestValue').textContent = '-';
        document.getElementById('kpiBestValueRatio').textContent = 'אין נתונים';
        return;
    }
    
    // Hot player (best form - last 5 games average)
    const withMinutes = data.filter(p => p.minutes > 450);
    if (withMinutes.length > 0) {
        const hotPlayer = withMinutes.reduce((max, p) => {
            const form = parseFloat(p.form) || 0;
            const maxForm = parseFloat(max.form) || 0;
            return form > maxForm ? p : max;
        }, withMinutes[0]);
        
        document.getElementById('kpiHotPlayer').textContent = hotPlayer.web_name;
        document.getElementById('kpiHotPlayerForm').textContent = `כושר: ${parseFloat(hotPlayer.form).toFixed(1)} נק'/משחק`;
    }
    
    // Best draft score
    const bestDraft = data.reduce((max, p) => p.draft_score > max.draft_score ? p : max, data[0]);
    document.getElementById('kpiBestDraft').textContent = bestDraft.web_name;
    document.getElementById('kpiBestDraftScore').textContent = `ציון: ${bestDraft.draft_score.toFixed(1)}`;
    
    // Top scorer
    const topScorer = data.reduce((max, p) => p.goals_scored > max.goals_scored ? p : max, data[0]);
    document.getElementById('kpiTopScorer').textContent = topScorer.web_name;
    document.getElementById('kpiTopScorerGoals').textContent = `${topScorer.goals_scored} שערים`;
    
    // Top assister
    const topAssister = data.reduce((max, p) => p.assists > max.assists ? p : max, data[0]);
    document.getElementById('kpiTopAssister').textContent = topAssister.web_name;
    document.getElementById('kpiTopAssisterAssists').textContent = `${topAssister.assists} בישולים`;
    
    // Top points
    const topPoints = data.reduce((max, p) => p.total_points > max.total_points ? p : max, data[0]);
    document.getElementById('kpiTopPoints').textContent = topPoints.web_name;
    document.getElementById('kpiTopPointsValue').textContent = `${topPoints.total_points} נקודות`;
    
    // Best value (points per million)
    const withValue = data.filter(p => p.now_cost > 0 && p.total_points > 0);
    if (withValue.length > 0) {
        const bestValue = withValue.reduce((max, p) => {
            const ratio = p.total_points / p.now_cost;
            const maxRatio = max.total_points / max.now_cost;
            return ratio > maxRatio ? p : max;
        }, withValue[0]);
        
        const ratio = (bestValue.total_points / bestValue.now_cost).toFixed(1);
        document.getElementById('kpiBestValue').textContent = bestValue.web_name;
        document.getElementById('kpiBestValueRatio').textContent = `${ratio} נק'/M`;
    }
}

function getNestedValue(obj, path) {
    if (!path) return obj;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function showVisualization(type) {
    if (!state.allPlayersData[state.currentDataSource].processed) {
        showToast('המתן', 'יש להמתין לטעינת הנתונים', 'warning', 3000);
        return;
    }
    const specMap = config.visualizationSpecs;

    const spec = specMap[type];
    if (!spec) {
        console.error(`Visualization spec not found for type: ${type}`);
        showToast('שגיאה', 'סוג ויזואליזציה לא נמצא', 'error', 3000);
        return;
    }
    
    document.getElementById('visualizationTitle').textContent = spec.title;
    
    // If user filtered data, show all filtered players. Otherwise, filter by minutes
    const isFiltered = state.displayedData.length < state.allPlayersData[state.currentDataSource].processed.length;
    const players = isFiltered 
        ? state.displayedData.filter(p => spec.pos.includes(p.position_name))
        : state.displayedData.filter(p => spec.pos.includes(p.position_name) && p.minutes > 300);
    if(players.length < 2) {
        showToast('אין מספיק נתונים', `לא נמצאו מספיק שחקנים (${spec.pos.join('/')}) להשוואה`, 'warning', 4000);
        return;
    }
    
    const chartConfig = getChartConfig(players, spec.x, spec.y, spec.xLabel, spec.yLabel, spec.quadLabels);
    const ctx = document.getElementById('visualizationChart').getContext('2d');
    if (charts.visualization) charts.visualization.destroy();
    charts.visualization = new Chart(ctx, chartConfig);
    document.getElementById('visualizationModal').style.display = 'block';
}

function showTeamDefenseChart() {
    if (!state.allPlayersData[state.currentDataSource].processed) {
        showToast('המתן', 'יש להמתין לטעינת הנתונים', 'warning', 3000);
        return;
    }
    document.getElementById('visualizationTitle').textContent = 'הגנת קבוצות (צפוי ספיגות מול ספיגות בפועל)';
    
    // Use filtered data if available, otherwise use all data
    const dataToUse = state.displayedData || state.allPlayersData[state.currentDataSource].processed;
    
    const teamStats = {};
    dataToUse.forEach(p => {
        if (!teamStats[p.team_name]) teamStats[p.team_name] = { xGC: 0, GC: 0, minutes: 0 };
        teamStats[p.team_name].xGC += parseFloat(p.expected_goals_conceded) || 0;
        teamStats[p.team_name].GC += p.goals_conceded || 0;
        if (p.element_type === 1 || p.element_type === 2) { // GKP or DEF
             teamStats[p.team_name].minutes += p.minutes;
        }
    });

    const dataPoints = Object.entries(teamStats).map(([team, stats]) => {
        const gamesPlayed = stats.minutes > 0 ? (stats.minutes / 90) / 11 : 0;
        return {
            x: gamesPlayed > 0 ? stats.xGC / gamesPlayed : 0,
            y: gamesPlayed > 0 ? stats.GC / gamesPlayed : 0,
            team: team
        };
    }).filter(d => d.x > 0 || d.y > 0);
    
    const quadLabels = {topRight: 'הגנה חלשה', topLeft: 'חוסר מזל', bottomRight: 'בר מזל', bottomLeft: 'הגנת ברזל'};
    const getPointColor = (c) => { const {x, y} = c.raw; return y > x ? 'rgba(255, 99, 132, 0.7)' : 'rgba(75, 192, 192, 0.7)'; };
    const config = getChartConfig(dataPoints, 'x', 'y', 'צפי ספיגות / 90 (xGC) - שמאלה זה טוב', 'ספיגות בפועל / 90 - למטה זה טוב', quadLabels, getPointColor, (v) => v.team);

    const ctx = document.getElementById('visualizationChart').getContext('2d');
    if (charts.visualization) charts.visualization.destroy();
    charts.visualization = new Chart(ctx, config);
    document.getElementById('visualizationModal').style.display = 'block';
}

function showTeamAttackChart() {
    if (!state.allPlayersData[state.currentDataSource].processed) {
        showToast('המתן', 'יש להמתין לטעינת הנתונים', 'warning', 3000);
        return;
    }
    document.getElementById('visualizationTitle').textContent = 'התקפת קבוצות (צפי מעורבות בשערים מול מעורבות בפועל)';
    
    // Use filtered data if available, otherwise use all data
    const dataToUse = state.displayedData || state.allPlayersData[state.currentDataSource].processed;
    
    const teamStats = {};
    dataToUse.forEach(p => {
        if (!teamStats[p.team_name]) teamStats[p.team_name] = { xGI: 0, GI: 0, minutes: 0 };
        teamStats[p.team_name].xGI += parseFloat(p.expected_goal_involvements) || 0;
        teamStats[p.team_name].GI += (p.goals_scored || 0) + (p.assists || 0);
        if (p.element_type === 3 || p.element_type === 4) { // MID or FWD
             teamStats[p.team_name].minutes += p.minutes;
        }
    });

    const dataPoints = Object.entries(teamStats).map(([team, stats]) => {
        const gamesPlayed = stats.minutes > 0 ? (stats.minutes / 90) / 11 : 0;
        return {
            x: gamesPlayed > 0 ? stats.xGI / gamesPlayed : 0,
            y: gamesPlayed > 0 ? stats.GI / gamesPlayed : 0,
            team: team
        };
    }).filter(d => d.x > 0 || d.y > 0);

    const quadLabels = {topRight: 'התקפה קטלנית', topLeft: 'חוסר מימוש', bottomRight: 'מימוש יתר', bottomLeft: 'התקפה חלשה'};
    const getPointColor = (c) => { const {x, y} = c.raw; return y > x ? 'rgba(75, 192, 192, 0.7)' : 'rgba(255, 99, 132, 0.7)'; };
    const config = getChartConfig(dataPoints, 'x', 'y', 'צפי מעורבות בשערים / 90 (xGI) - ימינה זה טוב', 'שערים+בישולים / 90 - למעלה זה טוב', quadLabels, getPointColor, (v) => v.team);

    const ctx = document.getElementById('visualizationChart').getContext('2d');
    if (charts.visualization) charts.visualization.destroy();
    charts.visualization = new Chart(ctx, config);
    document.getElementById('visualizationModal').style.display = 'block';
}

function showPriceVsScoreChart() {
    if (!state.allPlayersData[state.currentDataSource].processed) {
        showToast('המתן', 'יש להמתין לטעינת הנתונים', 'warning', 3000);
        return;
    }
    document.getElementById('visualizationTitle').textContent = 'תמורה למחיר (ציון דראפט מול מחיר)';
    
    // If user filtered data, show all filtered players. Otherwise, filter by minutes
    const isFiltered = state.displayedData.length < state.allPlayersData[state.currentDataSource].processed.length;
    const players = isFiltered ? state.displayedData : state.displayedData.filter(p => p.minutes > 300);
    if(players.length < 2) {
        showToast('אין מספיק נתונים', 'לא נמצאו מספיק שחקנים להשוואה', 'warning', 3000);
        return;
    }
    
    const dataPoints=players.map(p=>({x:p.now_cost,y:p.draft_score,player:p.web_name,team:p.team_name,pos:p.position_name}));
    const colorMap={DEF:'rgba(100,149,237,0.7)',MID:'rgba(60,179,113,0.7)',FWD:'rgba(255,99,132,0.7)',GKP:'rgba(255,159,64,0.7)'};
    const ctx = document.getElementById('visualizationChart').getContext('2d');
    if (charts.visualization) charts.visualization.destroy();
    charts.visualization = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Players',
                data: dataPoints,
                backgroundColor: dataPoints.map(p => colorMap[p.pos])
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: { display: false },
                tooltip:{callbacks:{label: c => {const p = c.raw; return `${p.player} (${p.team}): ציון ${p.y.toFixed(1)} ב-${p.x.toFixed(1)}M`} }}
            },
            scales: {
                x: { title: { display: true, text: 'מחיר' } },
                y: { title: { display: true, text: 'ציון דראפט' } }
            }
        }
    });
    document.getElementById('visualizationModal').style.display = 'block';
}

function showIctBreakdownChart() {
    if (!state.allPlayersData[state.currentDataSource].processed) {
        showToast('המתן', 'יש להמתין לטעינת הנתונים', 'warning', 3000);
        return;
    }
    
    // If user filtered data, show all filtered players. Otherwise, filter by minutes
    const isFiltered = state.displayedData.length < state.allPlayersData[state.currentDataSource].processed.length;
    const filteredPlayers = isFiltered ? state.displayedData : state.displayedData.filter(p => p.minutes > 300);
    const topPlayers = filteredPlayers.sort((a,b) => b.ict_index - a.ict_index).slice(0, 15);
    if(topPlayers.length < 2) {
        showToast('אין מספיק נתונים', 'לא נמצאו מספיק שחקנים להשוואה', 'warning', 3000);
        return;
    }
    document.getElementById('visualizationTitle').textContent = 'פרופיל שחקן (פירוק ICT)';
    
    const chartData = {
        labels: topPlayers.map(p => p.web_name),
        datasets: [
            { label: 'השפעה (Influence)', data: topPlayers.map(p => parseFloat(p.influence)), backgroundColor: 'rgba(54, 162, 235, 0.7)' },
            { label: 'יצירתיות (Creativity)', data: topPlayers.map(p => parseFloat(p.creativity)), backgroundColor: 'rgba(75, 192, 192, 0.7)' },
            { label: 'איום (Threat)', data: topPlayers.map(p => parseFloat(p.threat)), backgroundColor: 'rgba(255, 99, 132, 0.7)' }
        ]
    };
    
    const ctx = document.getElementById('visualizationChart').getContext('2d');
    if (charts.visualization) charts.visualization.destroy();
    charts.visualization = new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: { x: { stacked: true }, y: { stacked: true } },
            plugins: { legend: { position: 'bottom' } }
        }
    });
    document.getElementById('visualizationModal').style.display = 'block';
}

function getChartConfig(data, xKey, yKey, xLabel, yLabel, quadLabels = {}, colorFunc = null, dataLabelFunc = null) {
    const dataPoints = data.map(d => ({ x: getNestedValue(d, xKey), y: getNestedValue(d, yKey), ...d }));
    const xValues = dataPoints.map(p => p.x);
    const yValues = dataPoints.map(p => p.y);
    const xMedian = xValues.sort((a,b) => a-b)[Math.floor(xValues.length / 2)];
    const yMedian = yValues.sort((a,b) => a-b)[Math.floor(yValues.length / 2)];

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
                            const name = d.web_name || d.player || d.team || 'Point';
                            return `${name}: (${d.x.toFixed(2)}, ${d.y.toFixed(2)})`;
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
                    display: true,
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
                                xValue: xMedian * 1.01, 
                                yValue: yMedian * 1.01, 
                                content: quadLabels.topRight, 
                                position: 'start', 
                                xAdjust: 6, 
                                yAdjust: -6, 
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
                                xValue: xMedian * 0.99, 
                                yValue: yMedian * 1.01, 
                                content: quadLabels.topLeft, 
                                position: 'end', 
                                xAdjust: -6, 
                                yAdjust: -6, 
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
                                xValue: xMedian * 1.01, 
                                yValue: yMedian * 0.99, 
                                content: quadLabels.bottomRight, 
                                position: 'start', 
                                xAdjust: 6, 
                                yAdjust: 6, 
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
                                xValue: xMedian * 0.99, 
                                yValue: yMedian * 0.99, 
                                content: quadLabels.bottomLeft, 
                                position: 'end', 
                                xAdjust: -6, 
                                yAdjust: 6, 
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
}

function calculatePercentiles(players, metric, isAscending = false) {
    const sortedPlayers = [...players].sort((a, b) => {
        const valA = getNestedValue(a, metric) || 0;
        const valB = getNestedValue(b, metric) || 0;
        return isAscending ? valA - valB : valB - valA;
    });
    const n = sortedPlayers.length;
    sortedPlayers.forEach((p, i) => {
        if (!p.percentiles) p.percentiles = {};
        const percentile = (i / (n - 1)) * 100;
        p.percentiles[metric] = percentile;
    });
}

function calculateAllPredictions(players) {
    // Get fixtures based on current data source
    let fixtures = null;
    if (state.currentDataSource === 'demo') {
        fixtures = state.allPlayersData.demo?.fixtures || [];
    } else {
        fixtures = state.allPlayersData.live?.fixtures || state.allPlayersData.historical?.fixtures || [];
    }
    
    if (!fixtures || fixtures.length === 0) return players;
    
    const teamFixtures = {};
    fixtures.forEach(f => {
        if (!f.finished) {
            if (!teamFixtures[f.team_h]) teamFixtures[f.team_h] = [];
            if (!teamFixtures[f.team_a]) teamFixtures[f.team_a] = [];
            teamFixtures[f.team_h].push(f);
            teamFixtures[f.team_a].push(f);
        }
    });

    for (let teamId in teamFixtures) {
        teamFixtures[teamId].sort((a, b) => a.event - b.event);
    }
    
    players.forEach(p => {
        const upcomingFixtures = (teamFixtures[p.team] || []);
        
        // Calculate xPts for next gameweek only
        const nextFixture = upcomingFixtures.slice(0, 1);
        p.predicted_points_1_gw = nextFixture.length > 0 
            ? predictPointsForFixture(p, nextFixture[0])
            : 0;
        
        // Keep old 4GW for backward compatibility (draft analytics)
        const next4Fixtures = upcomingFixtures.slice(0, 4);
        p.predicted_points_4_gw = next4Fixtures.length > 0
            ? next4Fixtures.reduce((total, fix) => total + predictPointsForFixture(p, fix), 0)
            : 0;
        
        // ============================================
        // 🤖 ML PREDICTION
        // ============================================
        // Calculate ML prediction using the trained model
        if (typeof predictPlayerPoints === 'function') {
            try {
                const prediction = predictPlayerPoints(p);
                // If model not ready yet (returns null), keep existing value or 0
                p.ml_prediction = (prediction !== null && prediction !== undefined) ? prediction : (p.ml_prediction || 0);
            } catch (error) {
                console.warn('ML prediction failed for player:', p.web_name, error);
                p.ml_prediction = 0;
            }
        } else {
            p.ml_prediction = 0;
        }
    });
    
    return players;
}

function predictPointsForFixture(player, fixture) {
    const isHome = player.team === fixture.team_h;
    const opponentTeamId = isHome ? fixture.team_a : fixture.team_h;
    
    const playerTeam = state.teamStrengthData[player.team];
    const opponentTeam = state.teamStrengthData[opponentTeamId];
    if (!playerTeam || !opponentTeam) return 0;
    
    const pos = player.position_name;
    const gamesPlayed = Math.max((player.minutes || 0) / 90, 0.1);
    
    // ============================================
    // 1️⃣ TRANSFER MOMENTUM (17%) 🔥
    // ============================================
    const netTransfers = (player.transfers_in_event || 0) - (player.transfers_out_event || 0);
    const transferMomentum = Math.min(Math.max(netTransfers / 50, -1), 1); // Normalize to [-1, 1]
    const transferScore = (transferMomentum + 1) * 50; // Convert to [0, 100]
    
    // ============================================
    // 2️⃣ FORM (28%) 📈
    // ============================================
    const form = parseFloat(player.form) || 0;
    const formScore = Math.min(form * 10, 100); // 10 form = 100
    
    // ============================================
    // 3️⃣ xGI PER 90 (25%) ⚽
    // ============================================
    const xgiScore = Math.min((player.xGI_per90 || 0) * 100, 100); // 1.0 xGI/90 = 100
    
    // ============================================
    // 4️⃣ FIXTURE DIFFICULTY (20%) 🎯
    // ============================================
    const attackScore = isHome ? playerTeam.strength_attack_home : playerTeam.strength_attack_away;
    const defenseScore = isHome ? opponentTeam.strength_defence_home : opponentTeam.strength_defence_away;
    const fixtureDifficulty = (attackScore / Math.max(defenseScore, 1)) * 50; // Normalize
    const fixtureScore = Math.min(fixtureDifficulty, 100);
    
    // ============================================
    // 5️⃣ TEAM ATTACK STRENGTH (10%) 💪
    // ============================================
    const teamAttackStrength = (attackScore / 1300) * 100; // Normalize (1300 is typical max)
    const teamScore = Math.min(teamAttackStrength, 100);
    
    // ============================================
    // 🎯 WEIGHTED PREDICTION MODEL
    // ============================================
    const baseScore = (
        transferScore * 0.17 +      // 17% Transfer Momentum
        formScore * 0.28 +           // 28% Form
        xgiScore * 0.25 +            // 25% xGI per 90
        fixtureScore * 0.20 +        // 20% Fixture Difficulty
        teamScore * 0.10             // 10% Team Attack Strength
    );
    
    // ============================================
    // 🛡️ CLEAN SHEET BONUS (DEF/GKP)
    // ============================================
    let cleanSheetBonus = 0;
    if (pos === 'GKP' || pos === 'DEF') {
        const defStrength = isHome ? playerTeam.strength_defence_home : playerTeam.strength_defence_away;
        const oppAttack = isHome ? opponentTeam.strength_attack_home : opponentTeam.strength_attack_away;
        const csProb = (defStrength / Math.max(oppAttack, 1)) * 0.5; // Normalize
        cleanSheetBonus = csProb * (pos === 'GKP' ? 4 : 4) * (isHome ? 1.1 : 0.9);
    }
    
    // ============================================
    // ⚽ GOAL/ASSIST SCORING ADJUSTMENT
    // ============================================
    // Defenders and Midfielders get MORE points for goals!
    // DEF goal = 6pts, MID goal = 5pts, FWD goal = 4pts
    let goalValueBonus = 0;
    const expectedGoals = (player.expected_goals_per_90 || 0) / 90;
    const expectedAssists = (player.expected_assists_per_90 || 0) / 90;
    
    if (pos === 'DEF') {
        goalValueBonus = expectedGoals * 6 + expectedAssists * 3; // DEF: 6pts goal, 3pts assist
    } else if (pos === 'MID') {
        goalValueBonus = expectedGoals * 5 + expectedAssists * 3; // MID: 5pts goal, 3pts assist
    } else if (pos === 'FWD') {
        goalValueBonus = expectedGoals * 4 + expectedAssists * 3; // FWD: 4pts goal, 3pts assist
    } else if (pos === 'GKP') {
        goalValueBonus = expectedGoals * 6 + expectedAssists * 3; // GKP: 6pts goal (rare!), 3pts assist
    }
    
    // ============================================
    // ⭐ BONUS POINTS POTENTIAL
    // ============================================
    const bonusPerGame = (player.bonus || 0) / Math.max(gamesPlayed, 1);
    const bonusPoints = bonusPerGame * 0.6; // Conservative estimate
    
    // ============================================
    // 🎯 PLAYING TIME PROBABILITY (Realistic Adjustment)
    // ============================================
    // Only count players likely to start (minutes > 60 per game on average)
    const minutesPerGame = (player.minutes || 0) / Math.max(gamesPlayed, 1);
    let playingTimeFactor = 1.0;
    
    if (minutesPerGame < 30) {
        playingTimeFactor = 0.1; // Rarely plays - very low chance
    } else if (minutesPerGame < 60) {
        playingTimeFactor = 0.4; // Rotation risk - reduced chance
    } else if (minutesPerGame < 75) {
        playingTimeFactor = 0.7; // Occasional starter
    } else {
        playingTimeFactor = 1.0; // Regular starter
    }
    
    // ============================================
    // 🎲 FINAL PREDICTION
    // ============================================
    // Reduced baseScore divisor from 10 to 20 to make predictions more realistic (avg ~5.0)
    // baseScore (0-100) / 20 = 0-5 points from form/xGI/etc.
    // + 2 (appearance)
    // + goalValueBonus (xG/xA points)
    // + cleanSheetBonus
    const rawPrediction = (baseScore / 20) + cleanSheetBonus + goalValueBonus + bonusPoints + 2; 
    const predictedPoints = rawPrediction * playingTimeFactor;
    
    return Math.max(0, Math.min(predictedPoints, 20)); // Cap at 20 points per game
}

/**
 * Calculate Stability Index for a player
 * Measures consistency/reliability (0-100, higher = more stable)
 * 
 * Based on:
 * 1. Form consistency (40%) - Higher form = more stable
 * 2. xG accuracy (30%) - xG close to actual goals = predictable
 * 3. Minutes consistency (20%) - Playing regularly = reliable
 * 4. Points variance (10%) - Points per game variation
 */
function calculateStabilityIndex(player) {
    const gamesPlayed = Math.max((player.minutes || 0) / 90, 0.1);
    
    // 1. Form Factor (40%) - Higher form = more stable recent performance
    const form = parseFloat(player.form) || 0;
    const formStability = Math.min(form * 10, 100); // 10 form = 100 stability
    
    // 2. xG Accuracy (30%) - How predictable are the player's returns?
    const actualGoals = player.goals_scored || 0;
    const expectedGoals = parseFloat(player.expected_goals) || 0;
    const goalsPerGame = actualGoals / gamesPlayed;
    const xGPerGame = expectedGoals / gamesPlayed;
    
    // Calculate how close actual is to expected (lower diff = more stable)
    const xGDiff = Math.abs(goalsPerGame - xGPerGame);
    const xGAccuracy = Math.max(0, 100 - (xGDiff * 100)); // Perfect match = 100
    
    // 3. Minutes Stability (20%) - Playing regularly
    const minutesPlayed = player.minutes || 0;
    const appearancesEstimate = Math.max((player.appearances || gamesPlayed), 1);
    const minutesPerAppearance = minutesPlayed / appearancesEstimate;
    const minutesStability = Math.min((minutesPerAppearance / 90) * 100, 100); // 90 min/game = 100
    
    // 4. Points Variance (10%) - Using coefficient of variation approach
    const totalPoints = player.total_points || 0;
    const pointsPerGame = totalPoints / gamesPlayed;
    
    // Estimate variance using form as proxy (form is avg last 5 GW)
    // If form is close to PPG, variance is low (stable)
    const formVsPPG = Math.abs(form - pointsPerGame);
    const pointsStability = Math.max(0, 100 - (formVsPPG * 20)); // Small diff = stable
    
    // Calculate weighted stability index
    const stabilityIndex = (
        formStability * 0.40 +      // 40% Form
        xGAccuracy * 0.30 +          // 30% xG Accuracy
        minutesStability * 0.20 +    // 20% Minutes
        pointsStability * 0.10       // 10% Points Variance
    );
    
    return Math.round(Math.max(0, Math.min(stabilityIndex, 100)));
}

function calculateAdvancedScores(players) {
    // Filter out players with less than 180 minutes (2 full games)
    const activePlayers = players.filter(p => (p.minutes || 0) >= 180);
    
    // Calculate percentiles for all metrics (only for active players)
    const metricsToPercentile = [
        { key: 'xGI_per90', asc: false }, 
        { key: 'def_contrib_per90', asc: false }, 
        { key: 'creativity_per_90', asc: false }, 
        { key: 'saves_per_90', asc: false }, 
        { key: 'clean_sheets_per_90', asc: false }, 
        { key: 'threat_per_90', asc: false },
        { key: 'now_cost', asc: true }, 
        { key: 'form', asc: false }, 
        { key: 'minutes', asc: false },
        { key: 'total_points', asc: false },
        { key: 'bonus', asc: false },
        { key: 'clean_sheets', asc: false },
        { key: 'selected_by_percent', asc: false },
        { key: 'dreamteam_count', asc: false }
    ];
    metricsToPercentile.forEach(m => calculatePercentiles(activePlayers, m.key, m.asc));

    // Calculate scores for active players
    activePlayers.forEach(p => {
        const pos = p.position_name;
        const minutes = p.minutes || 1; // Avoid division by zero
        const gamesPlayed = Math.max(minutes / 90, 0.1); // At least 0.1 to avoid division by zero
        
        // Calculate per-game metrics
        const goalsPerGame = (p.goals_scored || 0) / gamesPlayed;
        const assistsPerGame = (p.assists || 0) / gamesPlayed;
        const gaPerGame = goalsPerGame + assistsPerGame;
        const xgPerGame = (parseFloat(p.expected_goals) || 0) / gamesPlayed;
        const xaPerGame = (parseFloat(p.expected_assists) || 0) / gamesPlayed;
        const xgiPerGame = xgPerGame + xaPerGame;
        
        // 1. נקודות בפועל (35%) - הכי חשוב! 🏆
        const totalPoints = p.total_points || 0;
        const pointsScore = Math.min(totalPoints / 2, 100); // Normalize: 200 pts = 100
        
        // 2. תרומה הגנתית (15%) - DefCon 🛡️
        const defconScore = p.percentiles.def_contrib_per90 || 0;
        
        // 3. G+A per game (12%) ⚽
        const gaPerGameNorm = Math.min(gaPerGame * 50, 100); // 2 G+A per game = 100
        
        // 4. xG per game (12%) 📈
        const xgPerGameNorm = Math.min(xgiPerGame * 50, 100); // 2 xGI per game = 100
        
        // 5. איכות משחק (10%) - xGI/90, creativity 🎯
        let qualityScore = 0;
        if (pos === 'GKP') {
            qualityScore = (p.percentiles.saves_per_90 || 0) * 0.6 + (p.percentiles.clean_sheets_per_90 || 0) * 0.4;
        } else if (pos === 'DEF') {
            qualityScore = (p.percentiles.xGI_per90 || 0) * 0.3 + (p.percentiles.def_contrib_per90 || 0) * 0.4 + (p.percentiles.clean_sheets_per_90 || 0) * 0.3;
        } else if (pos === 'MID') {
            qualityScore = (p.percentiles.xGI_per90 || 0) * 0.5 + (p.percentiles.creativity_per_90 || 0) * 0.4 + (p.percentiles.def_contrib_per90 || 0) * 0.1;
        } else if (pos === 'FWD') {
            qualityScore = (p.percentiles.xGI_per90 || 0) * 0.7 + (p.percentiles.threat_per_90 || 0) * 0.3;
        }
        
        // 6. אחוז בעלות (8%) - inverted: lower is better for draft 💎
        const ownershipScore = 100 - (p.percentiles.selected_by_percent || 0);
        
        // 7. בונוס (8%) ⭐
        const bonusScore = p.percentiles.bonus || 0;
        
        // Calculate final draft score with weights
        p.draft_score = (
            pointsScore * 0.35 +          // 35% נקודות בפועל
            defconScore * 0.15 +          // 15% תרומה הגנתית
            gaPerGameNorm * 0.12 +        // 12% G+A למשחק
            xgPerGameNorm * 0.12 +        // 12% xG למשחק
            qualityScore * 0.10 +         // 10% איכות משחק
            ownershipScore * 0.08 +       // 8% אחוז בעלות (inverted)
            bonusScore * 0.08             // 8% בונוס
        );
        
        // Store component scores for debugging/display
        p.quality_score = qualityScore;
        p.base_score = pointsScore;
        p.performance_score = pointsScore;
        p.ga_per_game = gaPerGame;
        p.xgi_per_game = xgiPerGame;
        
        // ============================================
        // 📊 STABILITY INDEX - New!
        // ============================================
        // Measures player consistency (0-100, higher = more stable)
        p.stability_index = calculateStabilityIndex(p);
        
        // Calculate predictions for future reference
        p = calculateAllPredictions([p])[0];
    });
    
    // Set draft_score to 0 for inactive players (less than 180 minutes)
    players.forEach(p => {
        if ((p.minutes || 0) < 180) {
            p.draft_score = 0;
            p.quality_score = 0;
            p.base_score = 0;
            p.performance_score = 0;
            p.ga_per_game = 0;
            p.xgi_per_game = 0;
        }
    });
    
    return players.sort((a,b) => b.draft_score - a.draft_score);
}

function sortTableDraft(field) {
    const standingsData = state.draft._standingsData;
    if (!standingsData || !standingsData.length) return;

    const currentSort = state.draft._standingsSort;
    let direction = 'desc';
    
    if (currentSort && currentSort.field === field) {
        direction = currentSort.direction === 'desc' ? 'asc' : 'desc';
    }

    state.draft._standingsSort = { field, direction };

    standingsData.sort((a, b) => {
        const aVal = a[field];
        const bVal = b[field];
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return direction === 'desc' ? bVal - aVal : aVal - bVal;
        } else {
            return direction === 'desc' ? String(bVal).localeCompare(String(aVal)) : String(aVal).localeCompare(String(bVal));
        }
    });

    const tbody = document.querySelector('#draftStandingsTable tbody');
    if (tbody) {
        tbody.innerHTML = standingsData.map(s => `
            <tr>
                <td>${s.rank}</td>
                <td>${s.manager}</td>
                <td>${s.team}</td>
                <td>${s.wins}</td>
                <td>${s.draws}</td>
                <td>${s.losses}</td>
                <td>${s.pf}</td>
                <td>${s.pa}</td>
                <td>${s.diff > 0 ? '+' : ''}${s.diff}</td>
                <td>${s.total}</td>
            </tr>
        `).join('');
    }
}

// REMOVED: Duplicate showTab function - using the one at line ~4803 instead

function getProcessedByElementId() {
    // Check if we're in demo mode first
    if (state.currentDataSource === 'demo' && state.allPlayersData.demo && state.allPlayersData.demo.processed) {
        const map = new Map();
        state.allPlayersData.demo.processed.forEach(p => map.set(p.id, p));
        return map;
    }
    
    // Otherwise use live or historical data
    // Since rostersByEntryId now stores FPL IDs (not Draft IDs), 
    // we only need to map by FPL ID
    const processed = (state.allPlayersData.live && state.allPlayersData.live.processed) || (state.allPlayersData.historical && state.allPlayersData.historical.processed) || [];
    const map = new Map();
    
    processed.forEach(p => {
        map.set(p.id, p); // Map by FPL ID only
    });
    
    return map;
}

function pickStartingXI(playerIds) {
    const processedById = getProcessedByElementId();
    const players = playerIds.map(id => processedById.get(id)).filter(Boolean);

    const byPos = { GKP: [], DEF: [], MID: [], FWD: [] };
    players.forEach(p => byPos[p.position_name].push(p));

    const sortFn = (a, b) => b.draft_score - a.draft_score;
    Object.values(byPos).forEach(arr => arr.sort(sortFn));

    const gk = byPos.GKP.slice(0, 1);
    const def = byPos.DEF.slice(0, 4);
    const mid = byPos.MID.slice(0, 4);
    const fwd = byPos.FWD.slice(0, 2);
    
    let needed = 11 - (gk.length + def.length + mid.length + fwd.length);
    if (needed > 0) {
        const pool = [...byPos.DEF.slice(4), ...byPos.MID.slice(4), ...byPos.FWD.slice(2)].sort(sortFn);
        for (let i=0; i<needed && i<pool.length; i++) mid.push(pool[i]);
    }
    
    return [...gk, ...def, ...mid, ...fwd].map(p=>p.id);
}

function getCurrentEventId() {
    const data = (state.allPlayersData.live && state.allPlayersData.live.raw) || (state.allPlayersData.historical && state.allPlayersData.historical.raw);
    if (!data || !data.events) return 1;
    
    const current = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
    if (current) return current.id;

    const maxFinished = [...data.events].filter(e => e.finished || e.finished_provisional).sort((a,b)=>b.id-a.id)[0];
    return maxFinished ? maxFinished.id : 1;
}

function getCompletedGWCount() {
    const data = (state.allPlayersData.live && state.allPlayersData.live.raw) || (state.allPlayersData.historical && state.allPlayersData.historical.raw);
    if (!data || !data.events) return 0;
    return data.events.filter(e => e.finished || e.finished_provisional).length;
}

function getPlayerImageUrl(player) {
    const base = 'https://resources.premierleague.com/premierleague/photos/players/110x140';
    const code = player && player.code ? player.code : null;
    if (code) return config.urls.playerImage(code);
    const photo = player && player.photo ? String(player.photo).split('.')[0] : null;
    if (photo) return `${base}/p${photo}.png`;
    return config.urls.missingPlayerImage;
}

function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(217, 217, 217, ${alpha})`; // Default grey for safety
    let c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length == 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c = '0x' + c.join('');
        return `rgba(${[(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',')},${alpha})`;
    }
    console.error('Bad Hex:', hex);
    return `rgba(217, 217, 217, ${alpha})`; // Fallback for bad hex
}

function getTeamColor(name) {
    // Pastel versions of the main 9 colors for consistency
    const palette = [
        '#93c5fd', // Light Blue (pastel version of #3b82f6)
        '#fca5a5', // Light Red (pastel version of #ef4444)
        '#86efac', // Light Green (pastel version of #10b981)
        '#fcd34d', // Light Orange (pastel version of #f59e0b)
        '#c4b5fd', // Light Purple (pastel version of #8b5cf6)
        '#f9a8d4', // Light Pink (pastel version of #ec4899)
        '#67e8f9', // Light Cyan (pastel version of #06b6d4)
        '#bef264', // Light Lime (pastel version of #84cc16)
        '#fdba74'  // Light Deep Orange (pastel version of #f97316)
    ];
    if (!name) return '#d9d9d9'; // Return grey for safety if name is falsy
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palette[Math.abs(hash) % palette.length];
}

// 🔧 Helper to fetch transactions and update rosters
// async function fetchAndApplyTransactions(leagueId, currentGw) { ... } // Removed as API is 404

async function loadDraftDataInBackground() {
    // Load draft data silently in the background without showing loading overlay
    try {
        const detailsUrl = `${config.corsProxy}${encodeURIComponent(`https://draft.premierleague.com/api/league/${state.draft.leagueId}/details`)}`;
        const detailsCacheKey = `fpl_draft_details_${state.draft.leagueId}`;
        
        // 🔧 SMART GW DETECTION: Find the highest GW with actual draft data available
        let currentGW = getCurrentEventId(); // Fallback
        let actualDataGw = null;
        
        try {
            const bootstrapUrl = 'https://fantasy.premierleague.com/api/bootstrap-static/';
            const bootstrapResponse = await fetch(config.corsProxy + encodeURIComponent(bootstrapUrl));
            const bootstrapData = await bootstrapResponse.json();
            
            if (bootstrapData && bootstrapData.events) {
                const currentEvent = bootstrapData.events.find(e => e.is_current);
                const nextEvent = bootstrapData.events.find(e => e.is_next);
                
                // 🎯 Try next GW first (latest roster), then current
                const gwsToTry = [];
                if (nextEvent) gwsToTry.push(nextEvent.id);
                if (currentEvent) gwsToTry.push(currentEvent.id);
                
                // 🧪 Quick test to find which GW has data
                for (const testGw of gwsToTry) {
                    try {
                        const testUrl = `${config.corsProxy}${encodeURIComponent(`https://draft.premierleague.com/api/league/${state.draft.leagueId}/details`)}`;
                        const testResponse = await fetch(testUrl);
                        if (testResponse.ok) {
                            const testData = await testResponse.json();
                            if (testData && testData.league_entries && testData.league_entries[0]) {
                                const testEntryId = testData.league_entries[0].entry_id;
                                const picksTestUrl = `${config.corsProxy}${encodeURIComponent(`https://draft.premierleague.com/api/entry/${testEntryId}/event/${testGw}`)}`;
                                const picksResponse = await fetch(picksTestUrl);
                                if (picksResponse.ok) {
                                    actualDataGw = testGw;
                                    console.log(`✅ Background: GW${testGw} has data available`);
                                    break;
                                }
                            }
                        }
                    } catch (err) {
                        console.log(`⚠️ Background: GW${testGw} test failed`);
                    }
                }
                
                currentGW = actualDataGw || currentEvent?.id || currentGW;
                console.log(`📅 Background: Using GW${currentGW}`);
            }
        } catch (err) {
            console.warn('⚠️ Background load: Could not fetch bootstrap-static');
        }
        
        // Clear old picks cache for background load too
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('fpl_draft_picks_')) {
                localStorage.removeItem(key);
            }
        });
        
        const details = await fetchWithCache(detailsUrl, detailsCacheKey, 30);
        
        if (details && details.league_entries) {
            state.draft.details = details;
            
            // Build entryId to team name map
            state.draft.entryIdToTeamName.clear();
            details.league_entries.forEach(entry => {
                if (entry && entry.id && entry.entry_name) {
                    state.draft.entryIdToTeamName.set(entry.id, entry.entry_name);
                }
            });
            
            // Fetch all team rosters
            const rosterPromises = details.league_entries
                .filter(e => e && e.id && e.entry_id)
                .map(async entry => {
                    const picksUrl = `${config.corsProxy}${encodeURIComponent(`https://draft.premierleague.com/api/entry/${entry.entry_id}/event/${currentGW}`)}`;
                    const picksCacheKey = `fpl_draft_picks_bg_${entry.entry_id}_gw${currentGW}`;
                    
                    try {
                        const picksData = await fetchWithCache(picksUrl, picksCacheKey, 30);
                        if (picksData && picksData.picks) {
                            // Convert picks to FPL IDs and preserve position info
                            const picksWithFplIds = picksData.picks.map(pick => ({
                                fplId: state.draft.draftToFplIdMap.get(pick.element) || pick.element,
                                position: pick.position
                            }));
                            
                            // Extract all FPL IDs for roster
                            const fplPlayerIds = picksWithFplIds.map(p => p.fplId);
                            
                            // Store FPL IDs (not Draft IDs!)
                            state.draft.rostersByEntryId.set(entry.id, fplPlayerIds);
                            
                            // Store lineup info (starting vs bench)
                            const starting = picksWithFplIds.filter(p => p.position >= 1 && p.position <= 11).map(p => p.fplId);
                            const bench = picksWithFplIds.filter(p => p.position >= 12 && p.position <= 15).map(p => p.fplId);
                            state.draft.lineupsByEntryId.set(entry.id, { starting, bench });
                            
                            // Add to owned set (already FPL IDs)
                            fplPlayerIds.forEach(fplId => {
                                state.draft.ownedElementIds.add(fplId);
                            });
                        }
                    } catch (err) {
                        console.log(`Could not load roster for ${entry.entry_name}`);
                    }
                });
            
            await Promise.all(rosterPromises);
            
            // Populate team filter with draft teams
            populateTeamFilter();
            
            // Re-render table to update draft team column
            renderTable();
            
            console.log('✅ Draft data loaded in background:', state.draft.ownedElementIds.size, 'players owned');
        }
    } catch (error) {
        console.log('Draft data not available:', error.message);
        // Silently fail - not critical for main page
    }
}

// Duplicate function removed - see renderNextRoundFixtures() at line ~5182

async function loadDraftLeague() {
    showLoading('טוען ליגת דראפט...');
    const draftContainer = document.getElementById('draftTabContent');
    const sectionsToClear = ['draftStandingsContent', 'draftRecommendations', 'draftAnalytics', 'draftComparison', 'draftMatrices'];
    
    // Clear containers that will be rendered into
    const myLineupContainer = document.getElementById('myLineupContainer');
    const otherRostersContainer = document.getElementById('otherRosters');
    if (myLineupContainer) myLineupContainer.innerHTML = '';
    if (otherRostersContainer) otherRostersContainer.innerHTML = '';

    // Show mini loaders for sections that take time
    sectionsToClear.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.innerHTML = `<div class="mini-loader" style="display:block;"></div>`;
        }
    });

    try {
        // Make sure we have player data loaded (demo or real)
        if (state.currentDataSource === 'demo') {
            // In demo mode, ensure demo data is loaded
            if (!state.allPlayersData.demo || !state.allPlayersData.demo.processed) {
                showToast('שגיאה', 'נתוני דמו לא נטענו. אנא רענן את הדף.', 'error', 3000);
                hideLoading();
                return;
            }
        } else {
            // For live/historical, if data is missing, try to load it
            if (!state.allPlayersData.live.raw && !state.allPlayersData.historical.raw) {
                try {
            await fetchAndProcessData();
                } catch (e) {
                    console.error("Failed to load player data before draft:", e);
                    // If player data fails, we can't really proceed with meaningful draft data
                    showToast('שגיאה', 'כשל בטעינת נתוני שחקנים, לא ניתן לטעון ליגת דראפט', 'error', 4000);
                    hideLoading();
                    return;
                }
            }
        }
        
        // CRITICAL: Ensure Draft→FPL mapping is built before processing rosters
        if (state.draft.draftToFplIdMap.size === 0) {
            console.log('⚠️ Mapping not found, building now...');
            await buildDraftToFplMapping();
        } else {
            console.log(`✅ Using existing mapping: ${state.draft.draftToFplIdMap.size} players mapped`);
        }

        const detailsCacheKey = `fpl_draft_details_${config.draftLeagueId}`;
        const standingsCacheKey = `fpl_draft_standings_${config.draftLeagueId}`;
        localStorage.removeItem(detailsCacheKey);
        localStorage.removeItem(standingsCacheKey);
        
        // 🔧 CRITICAL FIX: Aggressively clear ALL draft picks cache to ensure fresh roster data
        console.log("🧹 Clearing ALL old picks cache...");
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('fpl_draft_picks_') || key.startsWith('fpl_draft_details_')) {
                console.log(`   Removing cached data: ${key}`);
                localStorage.removeItem(key);
            }
        });
        
        // Don't add proxy here - fetchWithCache will handle it with fallbacks
        // Add timestamp to force fresh fetch from FPL servers
        const timestamp = new Date().getTime();
        const detailsUrl = config.urls.draftLeagueDetails(config.draftLeagueId) + `?t=${timestamp}`;
        const standingsUrl = config.urls.draftLeagueStandings(config.draftLeagueId) + `?t=${timestamp}`;
        
        // Use 0 cache duration to force fresh fetch
        const [detailsData, standingsData] = await Promise.all([
            fetchWithCache(config.corsProxy + encodeURIComponent(detailsUrl), detailsCacheKey, 0),
            fetchWithCache(config.corsProxy + encodeURIComponent(standingsUrl), standingsCacheKey, 0).catch(() => null)
        ]);
        
        state.draft.details = detailsData;
        state.draft.standings = standingsData;
        
        console.log("--- Draft League Debug ---");
        console.log("1. Fetched Details Data:", JSON.parse(JSON.stringify(detailsData)));
        
        state.draft.entryIdToTeamName = new Map((state.draft.details?.league_entries || []).filter(e=>e && e.entry_name).map(e => [e.id, e.entry_name]));
        
        // --- Final, reliable roster population method V4 ---
        try {
            state.draft.rostersByEntryId.clear();
            state.draft.ownedElementIds.clear();

            const leagueEntries = state.draft.details?.league_entries || [];
            
            // 🔧 SMART GW DETECTION: Find the highest GW with actual draft data available
            let draftGw = getCurrentEventId(); // Start with fallback
            let actualDataGw = null;
            
            // Try to get the REAL current GW from bootstrap-static and verify which has data
            try {
                const bootstrapUrl = 'https://fantasy.premierleague.com/api/bootstrap-static/';
                const bootstrapResponse = await fetch(config.corsProxy + encodeURIComponent(bootstrapUrl));
                const bootstrapData = await bootstrapResponse.json();
                
                if (bootstrapData && bootstrapData.events) {
                    const currentEvent = bootstrapData.events.find(e => e.is_current);
                    const nextEvent = bootstrapData.events.find(e => e.is_next);
                    
                    // 🎯 Build priority list: try next GW first (for latest roster), then current
                    const gwsToTry = [];
                    if (nextEvent) gwsToTry.push({ id: nextEvent.id, label: 'NEXT' });
                    if (currentEvent) gwsToTry.push({ id: currentEvent.id, label: 'CURRENT' });
                    
                    console.log(`🔍 Testing GW availability (priority order): ${gwsToTry.map(g => `GW${g.id} (${g.label})`).join(', ')}`);
                    
                    // 🧪 Test which GW actually has data by trying first team
                    const testEntry = leagueEntries[0];
                    if (testEntry && testEntry.entry_id) {
                        for (const gw of gwsToTry) {
                            try {
                                const testUrl = config.urls.draftEntryPicks(testEntry.entry_id, gw.id);
                                const testResponse = await fetch(config.corsProxy + encodeURIComponent(testUrl));
                                if (testResponse.ok) {
                                    actualDataGw = gw.id;
                                    console.log(`✅ GW${gw.id} (${gw.label}) has data available! Using this for all teams.`);
                                    break;
                                } else {
                                    console.log(`⚠️ GW${gw.id} (${gw.label}) returned ${testResponse.status}, trying next...`);
                                }
                            } catch (err) {
                                console.log(`⚠️ GW${gw.id} (${gw.label}) test failed: ${err.message}`);
                            }
                        }
                    }
                    
                    // Use the verified GW, or fallback to current event
                    draftGw = actualDataGw || currentEvent?.id || draftGw;
                    console.log(`📅 FINAL DECISION: Using GW${draftGw} (verified with actual Draft API data)`);
                }
            } catch (err) {
                console.warn('⚠️ Could not fetch bootstrap-static, using fallback:', err.message);
            }
            
            console.log(`2. Determined Draft GW: ${draftGw}. Found ${leagueEntries.length} league entries.`);
            console.log(`📅 League current_event from draft API (OUTDATED):`, state.draft.details?.league?.current_event);
            console.log(`📅 getCurrentEventId() returns:`, getCurrentEventId());
            console.log(`📅 FINAL GW being used:`, draftGw);

            const picksPromises = leagueEntries.map(async (entry) => {
                if (!entry || !entry.entry_id || !entry.id) return;
                
                const timestamp = new Date().getTime();
                const baseUrl = config.urls.draftEntryPicks(entry.entry_id, draftGw);
                const urlWithTimestamp = `${baseUrl}?_t=${timestamp}`;
                const url = config.corsProxy + encodeURIComponent(urlWithTimestamp);
                // Use a unique cache key that includes timestamp to ensure uniqueness
                const picksCacheKey = `fpl_draft_picks_v4_${entry.entry_id}_gw${draftGw}_${timestamp}`;
                
                console.log(`📥 Fetching picks for ${entry.entry_name} (Entry ID: ${entry.entry_id}, GW: ${draftGw})`);
                console.log(`   🔗 Base URL: ${baseUrl}`);
                console.log(`   🔗 Full URL with timestamp: ${urlWithTimestamp}`);
                console.log(`   🔗 Proxied URL: ${url.substring(0, 100)}...`);
                
                try {
                // 1. Fetch picks - We already verified this GW has data, so no fallback needed
                console.log(`   ⏳ Fetching from verified GW${draftGw}...`);
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const picksData = await response.json();
                
                console.log(`   📦 Raw picks data:`, picksData ? `${picksData.picks?.length} picks` : 'NULL'); 
                    
                    if (picksData && picksData.picks) {
                        console.log(`   ✅ Received ${picksData.picks.length} picks for ${entry.entry_name}`);
                        
                        // 2. Map to FPL IDs
                        const picksWithFplIds = picksData.picks.map(pick => {
                            // Try mapping, fallback to original if no map
                            const fplId = state.draft.draftToFplIdMap.size > 0 
                                ? state.draft.draftToFplIdMap.get(pick.element) 
                                : pick.element;
                                
                            return {
                                fplId: fplId || pick.element,
                                position: pick.position,
                                originalDraftId: pick.element
                            };
                        });
                        
                        // 3. Extract roster
                        const fplPlayerIds = picksWithFplIds.map(p => p.fplId);
                        state.draft.rostersByEntryId.set(entry.id, fplPlayerIds);
                        
                        // Log detailed roster info for user's team (Amit United)
                        if (entry.entry_name && entry.entry_name.includes('Amit')) {
                            console.log(`🏆 AMIT UNITED ROSTER (${fplPlayerIds.length} players):`);
                            console.log(`   📋 Raw picks from API (first 3):`, picksData.picks.slice(0, 3));
                            console.log(`   🗺️ Draft→FPL mapping size:`, state.draft.draftToFplIdMap.size);
                            const processedById = getProcessedByElementId();
                            picksWithFplIds.forEach((pick, idx) => {
                                const player = processedById.get(pick.fplId);
                                const playerName = player ? player.web_name : 'UNKNOWN';
                                const teamName = player ? player.team_name : 'UNKNOWN';
                                const mappedFrom = state.draft.draftToFplIdMap.get(pick.originalDraftId);
                                console.log(`   ${idx + 1}. ${playerName} (${teamName}) - FPL ID: ${pick.fplId}, Draft ID: ${pick.originalDraftId}, Mapped: ${mappedFrom ? 'YES' : 'NO'}, Position: ${pick.position}`);
                            });
                        }
                        
                        // 4. Extract Lineup
                        const starting = picksWithFplIds.filter(p => p.position <= 11).map(p => p.fplId);
                        const bench = picksWithFplIds.filter(p => p.position > 11).map(p => p.fplId);
                        state.draft.lineupsByEntryId.set(entry.id, { starting, bench });

                        // 5. Mark as owned
                        fplPlayerIds.forEach(id => state.draft.ownedElementIds.add(id));
                        
                    } else {
                        console.warn(`⚠️ No picks found for ${entry.entry_name}`);
                        state.draft.rostersByEntryId.set(entry.id, []);
                    }
                } catch (err) {
                    console.error(`❌ Failed to fetch picks for ${entry.entry_name}:`, err);
                    state.draft.rostersByEntryId.set(entry.id, []);
                }
            });

            await Promise.all(picksPromises);
            
            // 🔧 Apply recent transactions to update rosters manually
            await fetchAndApplyTransactions(state.draft.leagueId, draftGw);
            
            console.log(`3. Rosters Populated: ${state.draft.rostersByEntryId.size} teams.`);

        } catch (debugError) {
            console.error("CRITICAL ERROR during roster population:", debugError);
            // Don't return, try to render what we have
        }
        // --- End of Roster Population ---
        // --- End of Roster Population ---
        
        console.log("4. Starting UI Rendering...");
        
        // Load historical lineups for analytics (WAIT for completion - needed for bench points)
        console.log("4a. Loading historical lineups...");
        try {
            await loadHistoricalLineups();
            console.log("✅ Historical lineups loaded successfully");
        } catch (err) {
            console.error('Failed to load historical lineups:', err);
        }
        
        console.log("4b. Calling renderDraftStandings()...");
        renderDraftStandings();
        
        console.log("4c. Calling populateMyTeamSelector()...");
        populateMyTeamSelector();
        
        const myTeam = findMyTeam();
        console.log("4d. Found myTeam:", myTeam);

        if (myTeam) {
            console.log("4e. Calling renderMyLineup() for team:", myTeam.id);
            renderMyLineup(myTeam.id);
            
            console.log("4f. Calling renderNextRivalAnalysis()...");
            renderNextRivalAnalysis();
        } else {
            console.log("4e. No myTeam found, calling renderMyLineup(null)");
            renderMyLineup(null);
        }

        // Initialize Trend Chart
        if(state.draft.details) {
            console.log("4g. Calling renderAllTeamsTrendChart()...");
            
            // Render next round fixtures in dedicated container
            const fixturesContainer = document.getElementById('nextFixturesOverview');
            if (fixturesContainer) {
                const fixturesHtml = renderNextRoundFixtures();
                fixturesContainer.innerHTML = fixturesHtml || '';
                console.log("✅ Next fixtures rendered:", fixturesHtml ? 'Yes' : 'No matches');
            }
            
            renderAllTeamsTrendChart(null, 'cumulative', []);
        }
        
        console.log("4g. Calling renderRecommendations()...");
        renderRecommendations();

        console.log("4h. Computing aggregates...");
        const aggregates = computeDraftTeamAggregates();
        
        console.log("4i. Calling populateAnalyticsHighlight()...");
        populateAnalyticsHighlight();
        
        console.log("4j. Calling renderDraftAnalytics()...");
        renderDraftAnalytics(aggregates);
        
        console.log("4k. Calling renderDraftComparison()...");
        renderDraftComparison(aggregates);
        
        console.log("4l. Calling renderDraftRosters()...");
        renderDraftRosters();
        
        console.log("4m. Calling renderDraftMatrices()...");
        renderDraftMatrices(aggregates);
        
        console.log("4n. Calling populateTeamFilter()...");
        populateTeamFilter();
        
        // Show success toast
        const totalTeams = state.draft.rostersByEntryId.size;
        const totalPlayers = state.draft.ownedElementIds.size;
        showToast('ליגת דראפט נטענה בהצלחה', `${totalTeams} קבוצות, ${totalPlayers} שחקנים`, 'success', 3000);
    } catch (e) {
        console.error('loadDraftLeague error', e);
        draftContainer.innerHTML = `<div style="text-align:center; padding: 20px; color: red;">שגיאה בטעינת נתוני הליגה: ${e.message}</div>`;
        showToast('שגיאה בטעינת הליגה', e.message, 'error', 5000);
    } finally {
        hideLoading();
    }
}

/**
 * Load historical lineups for all teams across all gameweeks
 * This is used for accurate analytics calculations
 */
// New global state for historical points
state.historicalPoints = {};
state.aggregatedCache = {}; // Cache for aggregated range stats

/**
 * Calculate aggregated stats for the last N gameweeks
 */
async function calculateAggregatedStats(lastN) {
    const currentGW = getCurrentEventId();
    // We want completed gameweeks, or current? User said "Last 3 games".
    // Usually implies completed. But if current is live, maybe include it?
    // "Last 3 GWs" usually means current + previous 2.
    // Let's use currentGW down to (currentGW - lastN + 1).
    const startGW = Math.max(1, currentGW - lastN + 1);
    const endGW = currentGW;
    
    console.log(`📊 Aggregating stats from GW${startGW} to GW${endGW} (Last ${lastN})`);
    
    // Ensure data is loaded
    const gwsToLoad = [];
    for (let gw = startGW; gw <= endGW; gw++) {
        if (!state.historicalPoints[gw]) {
            gwsToLoad.push(gw);
        }
    }
    
    if (gwsToLoad.length > 0) {
        document.getElementById('loadingOverlay').style.display = 'flex';
        await Promise.all(gwsToLoad.map(gw => getGameweekPoints(gw)));
        document.getElementById('loadingOverlay').style.display = 'none';
    }
    
    const aggregated = new Map(); // fplId -> stats object
    
    for (let gw = startGW; gw <= endGW; gw++) {
        const gwStats = state.historicalPoints[gw];
        if (!gwStats) continue;
        
        gwStats.forEach((stats, fplId) => {
            if (!aggregated.has(fplId)) {
                aggregated.set(fplId, {
                    total_points: 0,
                    goals_scored: 0,
                    assists: 0,
                    minutes: 0,
                    clean_sheets: 0,
                    expected_goals: 0,
                    expected_assists: 0,
                    expected_goal_involvements: 0,
                    transfers_in_event: 0, 
                    transfers_out_event: 0,
                    bonus: 0,
                    bps: 0,
                    match_count: 0
                });
            }
            
            const agg = aggregated.get(fplId);
            agg.total_points += (stats.total_points || 0);
            agg.goals_scored += (stats.goals_scored || 0);
            agg.assists += (stats.assists || 0);
            agg.minutes += (stats.minutes || 0);
            agg.clean_sheets += (stats.clean_sheets || 0);
            agg.goals_conceded += (stats.goals_conceded || 0);
            agg.own_goals += (stats.own_goals || 0);
            agg.penalties_saved += (stats.penalties_saved || 0);
            agg.penalties_missed += (stats.penalties_missed || 0);
            agg.yellow_cards += (stats.yellow_cards || 0);
            agg.red_cards += (stats.red_cards || 0);
            agg.saves += (stats.saves || 0);
            agg.bonus += (stats.bonus || 0);
            agg.bps += (stats.bps || 0);
            agg.influence += parseFloat(stats.influence || 0);
            agg.creativity += parseFloat(stats.creativity || 0);
            agg.threat += parseFloat(stats.threat || 0);
            agg.ict_index += parseFloat(stats.ict_index || 0);
            
            // FPL Live stats often don't have xG/xA. If missing, we can't aggregate them accurately.
            // We use 0 to avoid misleading "season total" data.
            agg.expected_goals += parseFloat(stats.expected_goals || 0);
            agg.expected_assists += parseFloat(stats.expected_assists || 0);
            agg.expected_goal_involvements += parseFloat(stats.expected_goal_involvements || 0);
            agg.expected_goals_conceded += parseFloat(stats.expected_goals_conceded || 0);
            
            // transfers_in is typically "for the event".
            agg.transfers_in_event += (stats.transfers_in || 0); 
            agg.transfers_out_event += (stats.transfers_out || 0);
            
            if (stats.minutes > 0) agg.match_count++;
        });
    }
    
    return aggregated;
}

/**
 * Fetch live points data for a specific gameweek
 * Used for accurate bench points calculation
 */
async function getGameweekPoints(gw) {
    if (state.historicalPoints[gw]) {
        return state.historicalPoints[gw];
    }
    
    try {
        const url = `https://fantasy.premierleague.com/api/event/${gw}/live/`;
        // console.log(`📡 Fetching live points for GW${gw}...`);
        const data = await fetchWithCache(config.corsProxy + encodeURIComponent(url), `fpl_live_gw${gw}`, 60 * 24 * 7); // Cache for a week
        
        // Transform to simple map: elementId -> stats object
        const pointsMap = new Map();
        if (data && data.elements) {
            data.elements.forEach(el => {
                pointsMap.set(el.id, el.stats);
            });
        }
        
        state.historicalPoints[gw] = pointsMap;
        return pointsMap;
    } catch (e) {
        console.error(`Failed to fetch points for GW${gw}`, e);
        return new Map();
    }
}

async function loadHistoricalLineups() {
    console.log('📚 Loading historical lineups for all teams...');
    
    if (!state.draft.details || !state.draft.details.league_entries) {
        console.warn('⚠️ No league entries found, skipping historical lineup loading');
        return;
    }
    
    // 🔧 Clear historical lineup cache for fresh data
    console.log("🧹 Clearing historical lineup cache...");
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('fpl_draft_picks_historical_')) {
            localStorage.removeItem(key);
        }
    });
    
    const leagueEntries = state.draft.details.league_entries;
    const currentGW = state.draft.details.league?.current_event || getCurrentEventId();
    
    // Load lineups for GW 1 through current GW
    const gwsToLoad = Array.from({ length: currentGW }, (_, i) => i + 1);
    
    // Pre-fetch all historical points data needed (Critical for bench points calculation)
    console.log("📊 Pre-fetching historical points data for points calculation...");
    await Promise.all(gwsToLoad.map(gw => getGameweekPoints(gw)));
    
    console.log(`📊 Loading ${gwsToLoad.length} gameweeks for ${leagueEntries.length} teams...`);
    
    // Process teams in parallel (but limit concurrency slightly if needed, though browser handles it)
    await Promise.all(leagueEntries.map(async (entry) => {
        if (!entry || !entry.entry_id || !entry.id) return;
        
        const teamHistoricalLineups = {};
        
        // Split GWs into chunks to avoid overwhelming the proxy/API
        const chunkSize = 5; 
        for (let i = 0; i < gwsToLoad.length; i += chunkSize) {
            const chunk = gwsToLoad.slice(i, i + chunkSize);
            
            await Promise.all(chunk.map(async (gw) => {
                try {
                    const url = config.urls.draftEntryPicks(entry.entry_id, gw);
                const picksCacheKey = `fpl_draft_picks_historical_${entry.entry_id}_gw${gw}`;
                
                    // fetchWithCache handles proxy logic internally now
                    // Use shorter cache for historical data to ensure freshness
                const picksData = await fetchWithCache(url, picksCacheKey, 60); // Cache for 1 hour only
                
                if (picksData && picksData.picks) {
                    // Retrieve pre-fetched points map for this GW
                    const gwPointsMap = state.historicalPoints[gw];
                    
                    const picksWithFplIds = picksData.picks.map(pick => {
                        const fplId = state.draft.draftToFplIdMap.size > 0 
                            ? state.draft.draftToFplIdMap.get(pick.element) 
                            : pick.element;
                            
                        // Get actual points from history map (Best source), fallback to pick.points, fallback to 0
                        let actualPoints = 0;
                        if (gwPointsMap && gwPointsMap.has(fplId)) {
                            const stats = gwPointsMap.get(fplId);
                            actualPoints = stats.total_points;
                        } else if (pick.points !== undefined) {
                            actualPoints = pick.points;
                        }

                        return {
                            fplId: fplId || pick.element,
                            position: pick.position,
                            originalDraftId: pick.element,
                            points: actualPoints // Store confirmed actual points
                        };
                    });
                    
                    // Store lineup for this GW
                    const starting = picksWithFplIds.filter(p => p.position <= 11);
                    const bench = picksWithFplIds.filter(p => p.position > 11);
                    
                    teamHistoricalLineups[`gw${gw}`] = { starting, bench };
                }
            } catch (err) {
                console.warn(`⚠️ Failed to load GW${gw} for ${entry.entry_name}:`, err.message);
            }
            }));
            
            // Small delay between chunks to be nice to API
            await new Promise(r => setTimeout(r, 100));
        }
        
        state.draft.historicalLineups.set(entry.id, teamHistoricalLineups);
        console.log(`✅ Loaded ${Object.keys(teamHistoricalLineups).length} GWs for ${entry.entry_name}`);
    }));
    
    console.log(`📚 Historical lineups loaded for ${state.draft.historicalLineups.size} teams`);
}

function renderDraftStandings() {
    console.log("🏆 renderDraftStandings() called");
    const container = document.getElementById('draftStandingsContent');
    if (!container) {
        console.error("❌ draftStandingsContent container not found!");
        return;
    }
    console.log("✅ Container found:", container);

    const standingsSource = (state.draft.standings?.standings) || (state.draft.details?.standings) || [];
    const leagueEntries = state.draft.details?.league_entries;

    console.log("📊 Standings source:", standingsSource);
    console.log("👥 League entries:", leagueEntries);
    console.log("🎮 Draft details:", state.draft.details);
    console.log("🏟️ Matches:", state.draft.details?.matches?.length || 0);

    // Fallback to creating a table from scratch if no standings data but we have matches
    let finalStandings = [];
    
    // Try to use existing standings if they seem valid
    if (standingsSource.length > 0) {
        finalStandings = standingsSource;
    }
    
    // If no valid standings from API, generate from matches
    if (finalStandings.length === 0 && leagueEntries && state.draft.details?.matches) {
        console.log('Generating standings from matches (Fallback)...');
        const stats = {};
        leagueEntries.forEach(e => {
            stats[e.id] = { 
                league_entry: e.id, 
                matches_won: 0, matches_drawn: 0, matches_lost: 0, 
                points_for: 0, points_against: 0, total: 0 
            };
        });
        
        const matches = state.draft.details.matches;
        matches.forEach(m => {
            if(m.finished) {
                const h = stats[m.league_entry_1];
                const a = stats[m.league_entry_2];
                if(h && a) {
                    h.points_for += m.league_entry_1_points;
                    h.points_against += m.league_entry_2_points;
                    a.points_for += m.league_entry_2_points;
                    a.points_against += m.league_entry_1_points;
                    
                    if(m.league_entry_1_points > m.league_entry_2_points) { h.matches_won++; h.total += 3; a.matches_lost++; }
                    else if(m.league_entry_1_points < m.league_entry_2_points) { a.matches_won++; a.total += 3; h.matches_lost++; }
                    else { h.matches_drawn++; h.total += 1; a.matches_drawn++; a.total += 1; }
                }
            }
        });
        finalStandings = Object.values(stats).sort((a,b) => b.total - a.total || (b.points_for - b.points_against) - (a.points_for - a.points_against));
        finalStandings.forEach((s, i) => s.rank = i + 1);
    }

    if (finalStandings.length === 0 || !leagueEntries) {
        console.warn('renderDraftStandings: No standings data and no matches data to generate from.');
        container.innerHTML = '<p style="text-align:center; padding:20px;">לא נמצא מידע על טבלת הליגה.</p>';
        return;
    }

    const standingsData = finalStandings.map(s => {
        const entry = leagueEntries.find(le => le.id === s.league_entry);
        if (!entry || !entry.entry_name || entry.entry_name.toLowerCase() === 'average') {
            return null; // Filter out invalid or average entries
        }
        const pf = s.points_for || 0;
        const pa = s.points_against || 0;
        const total = s.total || 0;
        const diff = pf - pa;
        
        return {
            rank: s.rank,
            manager: entry.player_first_name + ' ' + entry.player_last_name,
            team: entry.entry_name,
            wins: s.matches_won || 0,
            draws: s.matches_drawn || 0,
            losses: s.matches_lost || 0,
            pf,
            pa,
            diff,
            total
        };
    }).filter(Boolean); // Remove nulls

    standingsData.sort((a, b) => a.rank - b.rank);
    state.draft._standingsData = standingsData; // Save for sorting

    const table = document.createElement('table');
    table.id = 'draftStandingsTable';
    table.className = 'styled-table draft-table';

    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th onclick="sortTableDraft('rank')">דירוג</th>
            <th onclick="sortTableDraft('manager')">מנהל</th>
            <th onclick="sortTableDraft('team')">קבוצה</th>
            <th onclick="sortTableDraft('wins')">נצ'</th>
            <th onclick="sortTableDraft('draws')">ת'</th>
            <th onclick="sortTableDraft('losses')">הפ'</th>
            <th onclick="sortTableDraft('pf')">בעד</th>
            <th onclick="sortTableDraft('pa')">נגד</th>
            <th onclick="sortTableDraft('diff')">+/-</th>
            <th onclick="sortTableDraft('total')">נק'</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    tbody.id = 'draftStandingsBody'; // Add ID for sorting
    tbody.innerHTML = standingsData.map(s => {
        const teamLogo = getTeamLogo(s.team);
        return `
        <tr>
            <td>${s.rank}</td>
            <td>${s.manager}</td>
            <td><span style="font-size: 18px; margin-left: 6px;">${teamLogo}</span>${s.team}</td>
            <td>${s.wins}</td>
            <td>${s.draws}</td>
            <td>${s.losses}</td>
            <td>${s.pf}</td>
            <td>${s.pa}</td>
            <td>${s.diff > 0 ? '+' : ''}${s.diff}</td>
            <td>${s.total}</td>
        </tr>
    `}).join('');
    table.appendChild(tbody);
    
    console.log("📋 Standings table created with", standingsData.length, "rows");
    console.log("🔄 Clearing container and appending table...");
    
    container.innerHTML = ''; // Clear loader
    container.appendChild(table);
    
    console.log("✅ Table appended. Container children:", container.children.length);
    console.log("✅ renderDraftStandings() completed!");

    const completed = getCompletedGWCount();
    const gwCountEl = document.getElementById('gwCount');
    if (gwCountEl) {
        gwCountEl.textContent = `לאחר ${completed} מחזורים`;
    }
}


function findFreeAgents() {
    // Check if we're in demo mode first
    let allPlayers = [];
    if (state.currentDataSource === 'demo' && state.allPlayersData.demo && state.allPlayersData.demo.processed) {
        allPlayers = state.allPlayersData.demo.processed;
    } else {
        allPlayers = (state.allPlayersData.live && state.allPlayersData.live.processed) || [];
    }
    return allPlayers.filter(p => !state.draft.ownedElementIds.has(p.id));
}

function getRecommendationData() {
    const myId = findMyTeam()?.id;
    if (!myId) return null;

    const myPlayerIds = new Set(state.draft.rostersByEntryId.get(myId) || []);
    if (!myPlayerIds.size) return null;

    const processedById = getProcessedByElementId();
    const myPlayers = Array.from(myPlayerIds).map(id => processedById.get(id)).filter(Boolean);
    
    // Get ONLY free agents (not owned by ANY team)
    const freeAgents = findFreeAgents();
    
    console.log(`DEBUG Recommendations: Found ${freeAgents.length} free agents out of ${processedById.size} total players`);
    console.log(`DEBUG: My team has ${myPlayers.length} players`);
    console.log(`DEBUG: Total owned players across all teams: ${state.draft.ownedElementIds.size}`);

    // Calculate Smart Score for a player
    const calculateSmartScore = (p) => {
        if (!p) return 0;
        
        // Base metrics (normalized to 0-100 scale)
        const xPts1GW = (p.predicted_points_1_gw || 0) * 10; // Weight: 0.30
        const draftScore = (p.draft_score || 0); // Weight: 0.25
        const form = parseFloat(p.form || 0) * 10; // Weight: 0.15
        
        // Transfers balance (difference between transfers_in and transfers_out)
        const transfersIn = parseInt(p.transfers_in_event || 0);
        const transfersOut = parseInt(p.transfers_out_event || 0);
        const transfersBalance = transfersIn - transfersOut;
        const transfersScore = Math.max(0, Math.min(100, transfersBalance * 2 + 50)); // Weight: 0.20
        
        // Ownership percentage (higher is better for comeback players)
        const ownership = parseFloat(p.selected_by_percent || 0);
        const ownershipScore = Math.min(100, ownership * 2); // Weight: 0.10
        
        // Comeback bonus: High ownership but low minutes = returning from injury
        let comebackBonus = 0;
        const minutes = p.minutes || 0;
        if (minutes < 270 && ownership > 30 && draftScore > 70) {
            comebackBonus = 20; // Significant bonus for comeback players
        } else if (minutes < 180 && ownership > 20 && draftScore > 60) {
            comebackBonus = 10; // Moderate bonus
        }
        
        // Calculate weighted smart score
        const smartScore = (
            (xPts1GW * 0.30) +
            (draftScore * 0.25) +
            (form * 0.15) +
            (transfersScore * 0.20) +
            (ownershipScore * 0.10) +
            comebackBonus
        );
        
        return smartScore;
    };

    // Add smart_score and transfers_balance to all players for display
    const enrichPlayer = (p) => {
        const transfersIn = parseInt(p.transfers_in_event || 0);
        const transfersOut = parseInt(p.transfers_out_event || 0);
        return {
            ...p,
            smart_score: calculateSmartScore(p),
            transfers_balance: transfersIn - transfersOut
        };
    };

    // Enrich my players and free agents
    const myPlayersEnriched = myPlayers.map(enrichPlayer);
    const freeAgentsEnriched = freeAgents.map(enrichPlayer);

    const myPlayersWithScore = myPlayersEnriched.map(p => ({ player: p, score: p.smart_score }));

    // Find 4 weakest players overall (not necessarily one per position)
    // EXCLUDE GOALKEEPERS - never recommend replacing them
    const weakestPlayers = myPlayersWithScore
        .filter(p => p.player.position_name !== 'GKP') // Exclude goalkeepers
        .sort((a, b) => a.score - b.score) // Sort by Smart Score (lowest first)
        .slice(0, 4); // Take 4 weakest
    
    console.log('=== SMART RECOMMENDATION LOGIC ===');
    console.log('Smart Score calculation:');
    console.log('  - xPts (1GW) × 30% - תחזית למחזור הבא');
    console.log('  - Draft Score × 25% - איכות כללית');
    console.log('  - Form × 15% - כושר אחרון');
    console.log('  - Transfers Balance × 20% - הפרש העברות (חכמת ההמונים)');
    console.log('  - Ownership × 10% - אחוז בעלות');
    console.log('  - Comeback Bonus - בונוס לשחקנים חוזרים מפציעה');
    console.log('');
    console.log('4 Weakest players (excluding GKP):');
    weakestPlayers.forEach((p, i) => {
        console.log(`  ${i+1}. ${p.player.web_name} (${p.player.position_name}) - Smart Score: ${p.score.toFixed(1)}`);
    });
    
    const recommendations = {};
    
    // Track already recommended players to avoid duplicates across multiple recommendations
    const alreadyRecommended = new Set();
    
    weakestPlayers.forEach((playerToReplace, index) => {
        const pos = playerToReplace.player.position_name;
        
        // Find top free agents in same position with better smart score
        // We'll get more than 3 initially, then filter out already recommended ones
        const allCandidates = freeAgentsEnriched
            .filter(p => {
                // Must be same position
                if (p.position_name !== pos) return false;
                
                // Must have played at least 1 minute (to allow comeback players)
                if (p.minutes <= 0) return false;
                
                // CRITICAL: Double-check player is NOT in ownedElementIds
                if (state.draft.ownedElementIds.has(p.id)) {
                    console.warn(`Player ${p.web_name} (${p.id}) is marked as free agent but is actually owned!`);
                    return false;
                }
                
                // Must have better smart score
                if (p.smart_score <= playerToReplace.score) return false;
                
                // NEW: Must have transfers_balance > 1000 (high demand)
                if (Math.abs(p.transfers_balance) < 1000) return false;
                
                // CRITICAL: Exclude players already recommended for other positions
                if (alreadyRecommended.has(p.id)) return false;
                
                return true;
            })
            .sort((a, b) => b.smart_score - a.smart_score);
        
        // Take top 3 candidates
        const candidates = allCandidates.slice(0, 3);

        console.log(`DEBUG ${pos}: Found ${candidates.length} unique free agent candidates better than ${playerToReplace.player.web_name} (smart score: ${playerToReplace.score.toFixed(1)})`);
        
        if (candidates.length) {
            // Mark these candidates as recommended so they won't appear in future recommendations
            candidates.forEach(c => alreadyRecommended.add(c.id));
            
            // Use unique key based on player ID to avoid conflicts
            recommendations[`rec_${index}_${playerToReplace.player.id}`] = { 
                player: playerToReplace.player, 
                candidates,
                position: pos
            };
        }
    });

    return recommendations;
}

function renderRecommendations() {
    console.log("💡 renderRecommendations() called");
    const container = document.getElementById('draftRecommendations');
    if (!container) {
        console.error("❌ draftRecommendations container not found!");
        return;
    }
    container.innerHTML = ''; // Clear loader

    const recommendationData = getRecommendationData();
    if (!recommendationData || Object.keys(recommendationData).length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 20px;">🎉 כל השחקנים שלך מצוינים! אין המלצות להחלפה כרגע.</p>';
        return;
    }

    const tablesContainer = document.createElement('div');
    tablesContainer.className = 'recs-grid-tables';

    // Position names in Hebrew
    const posNames = {
        'GKP': '🧤 שוער',
        'DEF': '🛡️ מגן',
        'MID': '⚙️ קשר',
        'FWD': '⚽ חלוץ'
    };
    
    // Create recommendation reason for each candidate
    const getRecommendationReason = (candidate) => {
        const reasons = [];
        
        // Check comeback player
        if (candidate.minutes < 270 && candidate.selected_by_percent > 30 && candidate.draft_score > 70) {
            reasons.push('🔥 חוזר');
        } else if (candidate.minutes < 180 && candidate.selected_by_percent > 20 && candidate.draft_score > 60) {
            reasons.push('⚡ חוזר');
        }
        
        // Check high transfers balance
        if (candidate.transfers_balance > 50) {
            reasons.push('📈 גבוה');
        } else if (candidate.transfers_balance > 20) {
            reasons.push('📈 עולה');
        }
        
        // Check high xPts
        if (candidate.predicted_points_1_gw > 6) {
            reasons.push('⚽ תחזית');
        }
        
        // Check good form
        if (parseFloat(candidate.form) > 5) {
            reasons.push('💪 כושר');
        }
        
        // Check high draft score
        if (candidate.draft_score > 85) {
            reasons.push('⭐ עלית');
        }
        
        return reasons.length > 0 ? reasons.join(' • ') : 'איכותי';
    };

    Object.entries(recommendationData).forEach(([key, { player, candidates, position }]) => {
        if (candidates.length === 0) return;
        
        const allInvolved = [player, ...candidates];
        const metrics = config.recommendationMetrics;
        
        let tableHTML = `
            <div class="rec-card">
                <div class="rec-header">
                    <h4 style="font-size: 18px; font-weight: 800;">${player.web_name} <span style="color: rgba(158, 174, 255, 1); font-size: 15px;">(${posNames[position]})</span></h4>
                    <p class="rec-subtitle" style="font-size: 13px; font-weight: 600;">⚽ ${posNames[position]} • ציון: ${player.smart_score.toFixed(1)}</p>
                </div>
                <table class="rec-table">
                    <thead>
                        <tr>
                            <th style="width: 20%;">מדד</th>
                            <th style="width: 20%;">נוכחי</th>
                            <th style="width: 20%; font-size: 16px; font-weight: 800;">#1</th>
                            <th style="width: 20%; font-size: 16px; font-weight: 800;">#2</th>
                            <th style="width: 20%; font-size: 16px; font-weight: 800;">#3</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="rec-player-row">
                            <td><strong>שחקן</strong></td>
                            ${allInvolved.map(p => `
                                <td>
                                    <div class="rec-player-cell">
                                        <img src="${getPlayerImageUrl(p)}" class="rec-player-img" alt="${p.web_name}">
                                        <div class="rec-player-name">${p.web_name}</div>
                                    </div>
                                </td>
                            `).join('')}
                        </tr>
                        <tr class="rec-reason-row">
                            <td><strong>סיבה</strong></td>
                            <td>-</td>
                            ${candidates.map(c => `<td class="rec-reason" style="font-size: 12px; font-weight: 600;">${getRecommendationReason(c)}</td>`).join('')}
                        </tr>`;
        
        // Add metrics rows
        Object.entries(metrics).forEach(([name, {key, format}]) => {
            const values = allInvolved.map(p => {
                const val = getNestedValue(p, key);
                return val !== null && val !== undefined ? val : 0;
            });
            const bestValue = Math.max(...values);
            const worstValue = Math.min(...values);
            
            tableHTML += `<tr><td><strong>${name}</strong></td>`;
            allInvolved.forEach((p, i) => {
                const val = values[i];
                let cellClass = '';
                if (val === bestValue && bestValue !== worstValue) {
                    cellClass = 'rec-best';
                } else if (val === worstValue && bestValue !== worstValue) {
                    cellClass = 'rec-worst';
                }
                tableHTML += `<td class="${cellClass}">${format(val)}</td>`;
            });
            tableHTML += `</tr>`;
        });
        
        tableHTML += `
                    </tbody>
                </table>
            </div>`;
        
        tablesContainer.innerHTML += tableHTML;
    });

    container.appendChild(tablesContainer);
}

/**
 * Compute team aggregates based on ACTUAL STARTERS across all gameweeks
 * This uses historical lineups to calculate accurate stats
 */
function computeDraftTeamAggregates() {
    const processedById = getProcessedByElementId();
    const myTeam = findMyTeam();
    const matches = state.draft.details?.matches || [];
    
    // Verification Log
    let verificationLog = "📋 Draft Analytics Calculation Log\n";
        
    const results = (state.draft.details?.league_entries || []).filter(e => e && e.entry_name).map(e => {
        const teamName = e.entry_name;
        const playerIds = state.draft.rostersByEntryId.get(e.id) || [];
        const players = playerIds.map(id => processedById.get(id)).filter(Boolean);
            
        // 1. Points and Wins from MATCHES (Actual History)
        let totalPointsFor = 0;
        let totalPointsAgainst = 0;
        let wins = 0;
        
        matches.forEach(m => {
            if (m.finished) {
                if (String(m.league_entry_1) === String(e.id)) {
                    totalPointsFor += m.league_entry_1_points;
                    totalPointsAgainst += m.league_entry_2_points;
                    if (m.winner === 'league_entry_1') wins++;
                } else if (String(m.league_entry_2) === String(e.id)) {
                    totalPointsFor += m.league_entry_2_points;
                    totalPointsAgainst += m.league_entry_1_points;
                    if (m.winner === 'league_entry_2') wins++;
                }
            }
        });
        
        // 2. Squad Stats from CURRENT ROSTER (Best available proxy without fetching full history)
        // We sum the season totals of the current squad.
        // This represents the "Current Power" of the squad.
        const sumDraft = players.reduce((s,p)=>s+p.draft_score,0);
        const sumPred = players.reduce((s,p)=>s+(p.predicted_points_4_gw||0),0);
        const totalPrice = players.reduce((s,p)=>s+p.now_cost,0);
        const sumSelectedBy = players.reduce((s,p)=>s+parseFloat(p.selected_by_percent),0);
        const gaTotal = players.reduce((s,p)=>s+(p.goals_scored||0)+(p.assists||0),0);
        const totalCleanSheets = players.reduce((s,p)=>s+(p.clean_sheets||0),0);
        const totalXGI = players.reduce((s,p)=>s+(parseFloat(p.expected_goal_involvements)||0),0);
        const totalDefCon = players.reduce((s,p)=>s+(p.def_contrib_per90||0),0);

        if (myTeam && e.id === myTeam.id) {
            verificationLog += `Team: ${teamName}\n`;
            verificationLog += `  - Points (History): ${totalPointsFor}\n`;
            verificationLog += `  - Goals+Assists (Current Squad Season Total): ${gaTotal}\n`;
            verificationLog += `  - xGI (Current Squad Season Total): ${totalXGI.toFixed(2)}\n`;
        }
        
        return { 
            team: teamName, 
            metrics: { 
                sumDraft, 
                sumPred, 
                totalPrice, 
                sumSelectedBy, 
                gaTotal, 
                totalCleanSheets, 
                totalXGI, 
                totalDefCon,
                totalPointsFor, // From matches
                totalPointsAgainst,
                tablePoints: wins * 3, // Approx
                wins
            } 
        };
    });
    
    console.log(verificationLog);
    return results;
}


function populateAnalyticsHighlight() {
    const select = document.getElementById('analyticsHighlight');
    if (!select) return;
    
    select.innerHTML = '<option value="">כל הקבוצות (ללא הדגשה)</option>';
    
    if (state.draft.details && state.draft.details.league_entries) {
        state.draft.details.league_entries
            .filter(e => e && e.entry_name && e.entry_name.toLowerCase() !== 'average')
            .forEach(entry => {
                const option = document.createElement('option');
                option.value = entry.entry_name;
                option.textContent = entry.entry_name;
                select.appendChild(option);
            });
    }
}

function updateAnalyticsHighlight() {
    const aggregates = computeDraftTeamAggregates();
    renderDraftAnalytics(aggregates);
    
    const selectedTeam = document.getElementById('analyticsHighlight')?.value;
    if (selectedTeam) {
        showToast('הדגשה', `מדגיש את ${selectedTeam}`, 'info', 2000);
    } else {
        showToast('הדגשה', 'הוסרה ההדגשה', 'info', 2000);
    }
}

function renderH2HCalendar() {
    const container = document.getElementById('h2hCalendar');
    if (!container) return;
    
    const matches = state.draft.details?.matches || [];
    if (matches.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">אין נתוני משחקים זמינים</p>';
        return;
    }
    
    const currentGW = state.draft.details?.league?.current_event || 10;
    
    // Group matches by gameweek and sort
    const matchesByGW = {};
    matches.forEach(m => {
        const gw = m.event;
        if (!matchesByGW[gw]) matchesByGW[gw] = [];
        matchesByGW[gw].push(m);
    });
    
    // Show only last 3 GWs and next 3 GWs
    const gwsToShow = [];
    for (let i = Math.max(1, currentGW - 2); i <= Math.min(currentGW + 3, 38); i++) {
        if (matchesByGW[i]) gwsToShow.push(i);
    }
    
    let html = '<div class="h2h-grid">';
    
    gwsToShow.forEach(gw => {
        matchesByGW[gw].forEach((match, idx) => {
            const team1Name = state.draft.entryIdToTeamName.get(match.league_entry_1) || 'Unknown';
            const team2Name = state.draft.entryIdToTeamName.get(match.league_entry_2) || 'Unknown';
            const score1 = match.league_entry_1_points || 0;
            const score2 = match.league_entry_2_points || 0;
            const isFinished = match.finished || gw < currentGW;
            const winner = isFinished && score1 !== score2 ? (score1 > score2 ? 1 : 2) : 0;
            
            html += `
                <div class="h2h-match ${winner ? 'h2h-winner' : ''}" style="animation-delay: ${idx * 0.05}s;">
                    <div class="h2h-match-header">
                        <span class="h2h-gw">GW${gw}</span>
                        <span class="h2h-status ${isFinished ? 'finished' : 'upcoming'}">
                            ${isFinished ? '✓ הסתיים' : '⏳ עתידי'}
                        </span>
                    </div>
                    <div class="h2h-teams">
                        <div class="h2h-team ${winner === 1 ? 'winner' : ''}">
                            <div class="h2h-team-name">${team1Name}</div>
                            <div class="h2h-team-score">${isFinished ? score1 : '-'}</div>
                        </div>
                        <div class="h2h-vs">VS</div>
                        <div class="h2h-team ${winner === 2 ? 'winner' : ''}">
                            <div class="h2h-team-name">${team2Name}</div>
                            <div class="h2h-team-score">${isFinished ? score2 : '-'}</div>
                        </div>
                    </div>
                </div>
            `;
        });
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function renderProgressChart() {
    const canvas = document.getElementById('progressChartCanvas');
    if (!canvas) return;
    
    const standings = state.draft.standings?.standings || state.draft.details?.standings || [];
    if (standings.length === 0) return;
    
    // Get current gameweek
    const currentGW = state.draft.details?.league?.current_event || 10;
    
    // Create gameweek labels
    const labels = Array.from({length: currentGW}, (_, i) => `GW${i + 1}`);
    
    // Get team colors
    const colorMap = {};
    standings.forEach(s => {
        const teamName = s.entry_name || s.league_entry?.entry_name;
        if (teamName) colorMap[teamName] = getTeamColor(teamName);
    });
    
    // Create datasets (one per team)
    const datasets = standings
        .filter(s => s.entry_name && s.entry_name.toLowerCase() !== 'average')
        .map(s => {
            const teamName = s.entry_name;
            const color = colorMap[teamName];
            
            // Simulate cumulative points over gameweeks
            // In real implementation, you'd fetch actual gameweek-by-gameweek data
            const totalPoints = s.points_for || 0;
            const pointsPerGW = totalPoints / currentGW;
            const data = Array.from({length: currentGW}, (_, i) => 
                Math.round(pointsPerGW * (i + 1) + (Math.random() * 20 - 10)) // Add some variance
            );
            
            return {
                label: teamName,
                data: data,
                borderColor: color,
                backgroundColor: hexToRgba(color, 0.1),
                borderWidth: 3,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: false
            };
        });
    
    const ctx = canvas.getContext('2d');
    
    if (state.draft.charts.progress) {
        state.draft.charts.progress.destroy();
    }
    
    state.draft.charts.progress = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: 'התקדמות נקודות לאורך העונה',
                    font: {
                        size: 18,
                        weight: 'bold'
                    },
                    color: '#0f172a'
                },
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 11,
                            weight: '600'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#e2e8f0',
                    borderColor: 'rgba(2, 132, 199, 0.5)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y} נקודות`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'נקודות מצטברות',
                        font: {
                            size: 13,
                            weight: '600'
                        }
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.15)'
                    },
                    ticks: {
                        color: '#64748b',
                        font: { size: 11 }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'מחזור',
                        font: {
                            size: 13,
                            weight: '600'
                        }
                    },
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#475569',
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}

function renderDraftAnalytics(teamAggregates) {
    console.log("📊 renderDraftAnalytics() called with", teamAggregates?.length, "teams");
    const host = document.getElementById('draftAnalytics');
    if (!host) {
        console.error("❌ draftAnalytics container not found!");
        return;
    }
    host.innerHTML = '';
    if (!teamAggregates.length) {
        console.warn("⚠️ No team aggregates data");
        return;
    }

    const highlightTeam = document.getElementById('analyticsHighlight')?.value || '';
    const colorMap = {};
    teamAggregates.forEach(t => colorMap[t.team] = getTeamColor(t.team));

    const dims = config.draftAnalyticsDimensions;

    dims.forEach((dim, index) => {
        const card = document.createElement('div');
        card.className = 'analytics-card';
        card.style.animationDelay = `${index * 0.1}s`;
        
        // Header with icon
        const header = document.createElement('div');
        header.className = 'analytics-card-header';
        
        const iconMap = {
            'sumDraft': '🏆',
            'sumPred': '📈',
            'totalPrice': '💰',
            'sumSelectedBy': '👥',
            'gaTotal': '⚽',
            'totalCleanSheets': '🛡️',
            'totalXGI': '🎯',
            'totalDefCon': '🔒'
        };
        
        const icon = document.createElement('span');
        icon.className = 'analytics-icon';
        icon.textContent = iconMap[dim.key] || '📊';
        
        const title = document.createElement('h3');
        title.className = 'analytics-title';
        title.textContent = dim.label;
        
        header.appendChild(icon);
        header.appendChild(title);
        
        // Canvas container
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'analytics-canvas-container';
        
        const canvas = document.createElement('canvas');
        canvas.id = `draftAnalytic_${dim.key}`;
        canvasContainer.appendChild(canvas);
        
        card.appendChild(header);
        card.appendChild(canvasContainer);
        host.appendChild(card);
        
        // Sort teams by the metric desc
        const sorted = teamAggregates.map(t => ({ name: t.team, value: t.metrics[dim.key] || 0 }))
            .sort((a,b)=> b.value - a.value);
            
        const labels = sorted.map(s=>s.name);
        const values = sorted.map(s=>s.value);
        
        if (state.draft.charts.analytics[dim.key]) { state.draft.charts.analytics[dim.key].destroy(); }

        const ctx = canvas.getContext('2d');
        state.draft.charts.analytics[dim.key] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: dim.label,
                    data: values,
                    borderRadius: 12,
                    barThickness: 'flex',
                    maxBarThickness: 60,
                    backgroundColor: labels.map(n => {
                        const c = colorMap[n];
                        const isHi = highlightTeam && n === highlightTeam;
                        // Highlighted: full opacity with glow, Others: faded
                        if (highlightTeam) {
                            return isHi ? c : hexToRgba(c, 0.25);
                        }
                        return hexToRgba(c, 0.75);
                    }),
                    borderColor: labels.map(n => {
                        const c = colorMap[n];
                        const isHi = highlightTeam && n === highlightTeam;
                        return isHi ? '#ffffff' : 'transparent';
                    }),
                    borderWidth: labels.map(n => {
                        const isHi = highlightTeam && n === highlightTeam;
                        return isHi ? 5 : 0;
                    }),
                    hoverBackgroundColor: labels.map(n => {
                        const c = colorMap[n];
                        return hexToRgba(c, 0.95);
                    }),
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        grid: { 
                            color: 'rgba(148, 163, 184, 0.15)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#64748b',
                            font: { size: 14, weight: '600' },
                            padding: 8
                        }
                    },
                    x: { 
                        grid: { display: false },
                        ticks: {
                            color: '#475569',
                            font: { size: 11, weight: '600' },
                            padding: 6,
                            maxRotation: 45,
                            minRotation: 0
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(255, 255, 255, 0.98)',
                        titleColor: '#1e293b',
                        bodyColor: '#334155',
                        footerColor: '#64748b',
                        borderColor: 'rgba(2, 132, 199, 0.8)',
                        borderWidth: 2,
                    padding: 14,
                        displayColors: false,
                    titleFont: { size: 15, weight: '700' },
                    bodyFont: { size: 13, family: 'system-ui, -apple-system' },
                    footerFont: { size: 11, weight: '500' },
                    bodySpacing: 4,
                    footerSpacing: 5,
                    footerMarginTop: 8,
                        cornerRadius: 8,
                    caretSize: 6,
                    caretPadding: 8,
                        callbacks: {
                            title: function(context) {
                                const teamName = context[0].label;
                                const value = context[0].parsed.y;
                                const formattedValue = typeof value === 'number' ? 
                                    (value % 1 === 0 ? Math.round(value) : value.toFixed(1)) : value;
                                return `${teamName} - סה"כ: ${formattedValue}`;
                            },
                            beforeBody: function(context) {
                                return ''; // Remove separator
                            },
                            label: function(context) {
                                // Get team name and find its players
                                const teamName = context.label;
                                const teamEntry = (state.draft.details?.league_entries || []).find(e => e.entry_name === teamName);
                                if (!teamEntry) return ['לא נמצאו נתונים'];
                                
                                const playerIds = state.draft.rostersByEntryId.get(teamEntry.id) || [];
                                const processedById = getProcessedByElementId();
                                const players = playerIds.map(id => processedById.get(id)).filter(Boolean);
                                
                                if (players.length === 0) return ['אין שחקנים'];
                                
                                // Calculate player contributions based on metric
                                const metricKey = dim.key;
                                let playerContributions = [];
                                
                                players.forEach(p => {
                                    let contribution = 0;
                                    let displayValue = 0;
                                    
                                    switch(metricKey) {
                                        case 'sumDraft':
                                            contribution = p.draft_score || 0;
                                            displayValue = Math.round(contribution);
                                            break;
                                        case 'sumPred':
                                            contribution = p.predicted_points_4_gw || 0;
                                            displayValue = Math.round(contribution);
                                            break;
                                        case 'totalPrice':
                                            contribution = p.now_cost || 0;
                                            displayValue = contribution.toFixed(1);
                                            break;
                                        case 'sumSelectedBy':
                                            contribution = parseFloat(p.selected_by_percent) || 0;
                                            displayValue = contribution.toFixed(1);
                                            break;
                                        case 'gaTotal':
                                            contribution = (p.goals_scored || 0) + (p.assists || 0);
                                            displayValue = contribution;
                                            break;
                                        case 'totalCleanSheets':
                                            contribution = p.clean_sheets || 0;
                                            displayValue = contribution;
                                            break;
                                        case 'totalXGI':
                                            contribution = parseFloat(p.expected_goal_involvements) || 0;
                                            displayValue = contribution.toFixed(1);
                                            break;
                                        case 'totalDefCon':
                                            contribution = p.def_contrib_per90 || 0;
                                            displayValue = contribution.toFixed(1);
                                            break;
                                    }
                                    
                                    if (contribution > 0) {
                                        playerContributions.push({
                                            name: p.web_name,
                                            value: contribution,
                                            display: displayValue,
                                            position: p.position_name
                                        });
                                    }
                                });
                                
                                // Sort by contribution (descending)
                                playerContributions.sort((a, b) => b.value - a.value);
                                
                                // Return all players (up to 15) - simple format: Position | Name | Value
                                // Top 3 will be marked with a special prefix and bold name
                                const posMap = {
                                    'GKP': 'GK',
                                    'DEF': 'DF',
                                    'MID': 'MF',
                                    'FWD': 'ST'
                                };
                                
                                // Helper function to convert text to bold (Unicode Mathematical Bold)
                                const toBold = (text) => {
                                    const boldMap = {
                                        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝',
                                        'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧',
                                        'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
                                        'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶', 'j': '𝗷',
                                        'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁',
                                        'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
                                        '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵'
                                    };
                                    return text.split('').map(char => boldMap[char] || char).join('');
                                };
                                
                                return playerContributions.slice(0, 15).map((pc, idx) => {
                                    const pos = posMap[pc.position] || pc.position;
                                    // Mark top 3 with green indicator and bold name
                                    const prefix = idx < 3 ? '🟢 ' : '   ';
                                    const playerName = idx < 3 ? toBold(pc.name) : pc.name;
                                    return `${prefix}${pos} | ${playerName} | ${pc.display}`;
                                });
                            },
                            footer: function(context) {
                                const teamName = context[0].label;
                                const teamEntry = (state.draft.details?.league_entries || []).find(e => e.entry_name === teamName);
                                if (!teamEntry) return '';
                                
                                const playerIds = state.draft.rostersByEntryId.get(teamEntry.id) || [];
                                const total = playerIds.length;
                                
                                return total > 15 ? `מציג 15 מתוך ${total} שחקנים` : `סה"כ ${total} שחקנים`;
                            }
                        }
                    },
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        clamp: true,
                        offset: 6,
                        color: function(context) {
                            const isHighlighted = highlightTeam && labels[context.dataIndex] === highlightTeam;
                            return isHighlighted ? '#ffffff' : '#475569';
                        },
                        backgroundColor: function(context) {
                            const isHighlighted = highlightTeam && labels[context.dataIndex] === highlightTeam;
                            return isHighlighted ? '#0284c7' : 'transparent';
                        },
                        borderRadius: function(context) {
                            const isHighlighted = highlightTeam && labels[context.dataIndex] === highlightTeam;
                            return isHighlighted ? 6 : 0;
                        },
                        padding: function(context) {
                            const isHighlighted = highlightTeam && labels[context.dataIndex] === highlightTeam;
                            return isHighlighted ? { top: 6, bottom: 6, left: 10, right: 10 } : 0;
                        },
                        font: function(context) {
                            const isHighlighted = highlightTeam && labels[context.dataIndex] === highlightTeam;
                            return { 
                                size: isHighlighted ? 18 : 14, 
                                weight: isHighlighted ? '900' : '700' 
                            };
                        },
                        textAlign: 'center',
                        formatter: (v, context) => {
                            const isHighlighted = highlightTeam && labels[context.dataIndex] === highlightTeam;
                            const value = typeof v === 'number' ? Math.round(v) : v;
                            return isHighlighted ? `⭐ ${value}` : value;
                        }
                    }
                }
            }
        });
    });
}

function teamPointsFor(teamName) {
    const standings = (state.draft.standings && state.draft.standings.standings) || (state.draft.details && state.draft.details.standings) || [];
    const teamEntry = (state.draft.details?.league_entries || []).find(e => e.entry_name === teamName);
    if (!teamEntry) return 0;
    const teamStanding = standings.find(s => s.league_entry === teamEntry.id);
    return teamStanding ? (teamStanding.points_for || teamStanding.points_for_total || 0) : 0;
}

function renderDraftMatrices(teamAggregates) {
    const host = document.getElementById('draftMatrices');
    if (!host) return;
    host.innerHTML = '';
    const specs = config.draftMatrixSpecs;

    specs.forEach(spec => {
        const card = document.createElement('div');
        card.className='matrix-card';
        const titleEl = document.createElement('div');
        titleEl.className = 'title';
        titleEl.textContent = spec.title;
        card.appendChild(titleEl);
        
        const chartHost = document.createElement('div');
        chartHost.className = 'chart-host';
        const canvas = document.createElement('canvas');
        canvas.id = `draftMatrix_${spec.key}`;
        chartHost.appendChild(canvas);
        card.appendChild(chartHost);

        host.appendChild(card);
        
        const data = spec.build(teamAggregates);
        
        if (state.draft.charts.matrix && state.draft.charts.matrix[spec.key]) {
             state.draft.charts.matrix[spec.key].destroy();
        }
        if (!state.draft.charts.matrix) state.draft.charts.matrix = {};
        
        // Create improved matrix chart
        const configChart = getMatrixChartConfig(data, spec.xLabel, spec.yLabel, spec.quads);
        state.draft.charts.matrix[spec.key] = new Chart(canvas.getContext('2d'), configChart);
    });
}


function renderDraftComparison(aggregates) {
    console.log("🆚 renderDraftComparison() called with", aggregates?.length, "teams");
    const container = document.getElementById('draftComparison');
    if (!container) {
        console.error("❌ draftComparison container not found!");
        return;
    }
    container.innerHTML = ''; // Clear loader
    
    // Get standings data for additional metrics
    const standingsData = state.draft._standingsData || [];
    
    // Enhanced metrics including standings data with icons
    const enhancedMetrics = [
        { key: 'sumDraft', label: '🏆 ציון דראפט', format: (v) => v.toFixed(1) },
        { key: 'sumPred', label: '📈 צפי GW הבא', format: (v) => v.toFixed(1) }, // Changed from 4GW to next GW
        { key: 'totalPoints', label: '⚽ נק\' בעד', format: (v) => v.toFixed(0), source: 'standings' },
        { key: 'pointsAgainst', label: '🛡️ נק\' נגד', format: (v) => v.toFixed(0), source: 'standings' },
        { key: 'tablePoints', label: '🏅 נק\' טבלה', format: (v) => v.toFixed(0), source: 'standings' },
        { key: 'wins', label: '✅ נצחונות', format: (v) => v.toFixed(0), source: 'standings' },
        { key: 'totalXGI', label: '🎯 xGI', format: (v) => v.toFixed(1) },
        { key: 'avgPrice', label: '💰 ממוצע מחיר', format: (v) => v.toFixed(1) },
        { key: 'gaTotal', label: '⚽ שערים+בישולים', format: (v) => v.toFixed(0) },
        { key: 'csTotal', label: '🧼 משחקי אפס', format: (v) => v.toFixed(0) },
        { key: 'defTotal', label: '🛡️ תרומה הגנתית', format: (v) => v.toFixed(1) }
    ];
    
    let tableHTML = `
        <div style="margin-bottom: 20px;">
            <h2 style="text-align: center; color: #0f172a; font-size: 20px; margin-bottom: 15px; font-weight: 800;">📊 השוואת קבוצות</h2>
            <div style="overflow-x: auto; overflow-y: auto; max-height: 600px;">
                <table class="styled-table draft-comparison-table" style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); font-size: 11px;">
                    <thead style="position: sticky; top: 0; z-index: 10;">
                        <tr style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);">
                            <th style="padding: 10px 8px; text-align: right; color: #0f172a; font-weight: 800; font-size: 11px; border-bottom: 2px solid #e2e8f0; position: sticky; right: 0; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); z-index: 11;">מדד</th>`;
    
    aggregates.forEach((agg, idx) => {
        const teamLogo = getTeamLogo(agg.team);
        // Shorten team names
        const shortName = agg.team.replace('Amit United🏆🏆', 'Amit U.').replace('Francis Bodega FC', 'Bodega').replace('Torpedo Eshel', 'Torpedo').replace('Los chicos 🌟', 'Los chicos');
        tableHTML += `<th style="padding: 8px 4px; text-align: center; color: #0f172a; font-weight: 700; font-size: 11px; border-bottom: 2px solid #e2e8f0; min-width: 70px; background: #ffffff;">
            <div style="font-size: 16px; margin-bottom: 2px;">${teamLogo}</div>
            <div style="font-size: 11px; line-height: 1.2; font-weight: 700; color: #475569;">${shortName}</div>
        </th>`;
    });
    tableHTML += '</tr></thead><tbody>';
    
    enhancedMetrics.forEach((metric, metricIdx) => {
        const bgColor = metricIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
        
        let values;
        if (metric.source === 'standings') {
            // Get values from standings data
            values = aggregates.map(agg => {
                const standing = standingsData.find(s => s.team === agg.team);
                if (!standing) return 0;
                
                switch(metric.key) {
                    case 'totalPoints': return standing.pf || 0;
                    case 'pointsAgainst': return standing.pa || 0;
                    case 'tablePoints': return standing.total || 0;
                    case 'wins': return standing.wins || 0;
                    default: return 0;
                }
            });
        } else {
            values = aggregates.map(agg => agg.metrics[metric.key] || 0);
        }
        
        const maxVal = Math.max(...values);
        const minVal = Math.min(...values);

        tableHTML += `<tr style="background: ${bgColor}; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='${bgColor}'">
            <td style="padding: 8px 8px; font-weight: 600; color: #475569; font-size: 10px; border-bottom: 1px solid #e2e8f0; position: sticky; right: 0; background: ${bgColor}; z-index: 5;">${metric.label}</td>`;
        
        aggregates.forEach((agg, idx) => {
            const val = values[idx];
            let cellStyle = 'padding: 8px 4px; text-align: center; font-weight: 700; font-size: 11px; border-bottom: 1px solid #e2e8f0;';
            
            if (val === maxVal && maxVal !== minVal) {
                cellStyle += ' background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); color: #065f46;';
            } else if (val === minVal && maxVal !== minVal) {
                cellStyle += ' background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); color: #991b1b;';
            } else {
                cellStyle += ' color: #334155;';
            }
            
            tableHTML += `<td style="${cellStyle}">${metric.format(val)}</td>`;
        });
        tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table></div></div>';
    container.innerHTML = tableHTML;
}

function renderPitch(containerEl, playerIds, isMyLineup = false, benchIds = null) {
    if (!containerEl) {
        console.error('renderPitch: containerEl is null or undefined');
        return;
    }
    
    containerEl.innerHTML = ''; // Clear loader
    
    if (!playerIds || playerIds.length === 0) {
        containerEl.innerHTML = '<p style="text-align:center; padding: 20px; color: #666;">אין שחקנים בסגל.</p>';
        return;
    }
    
    const processedById = getProcessedByElementId();
    
    let startingXI, benchPlayers;
    
    if (benchIds) {
        // Use provided lineup (starting + bench)
        startingXI = playerIds.map(id => processedById.get(id)).filter(Boolean);
        benchPlayers = benchIds.map(id => processedById.get(id)).filter(Boolean);
        console.log(`🎯 Using actual lineup: ${startingXI.length} starting, ${benchPlayers.length} bench`);
            } else {
        // Fallback: auto-select best 11
    const players = playerIds.map(id => processedById.get(id)).filter(Boolean);
        const startingXI_ids = pickStartingXI(playerIds);
        startingXI = startingXI_ids.map(id => processedById.get(id)).filter(Boolean);
        benchPlayers = players.filter(p => !startingXI_ids.includes(p.id));
        console.log(`⚙️ Auto-selected lineup: ${startingXI.length} starting, ${benchPlayers.length} bench`);
    }
    
    if (startingXI.length === 0) {
        console.warn(`renderPitch: Could not find any player data for IDs:`, playerIds.slice(0, 5));
        containerEl.innerHTML = '<p style="text-align:center; padding: 20px; color: #e74c3c;">לא נמצאו נתוני שחקנים.</p>';
        return;
    }

    const pitch = document.createElement('div');
    pitch.className = isMyLineup ? 'pitch-container my-lineup' : 'pitch-container other-team';
    
    // Add pitch lines
    pitch.innerHTML = `
        <div class="pitch-lines">
            <div class="pitch-half"></div>
            <div class="pitch-circle"></div>
            <div class="penalty-top"></div>
            <div class="penalty-bottom"></div>
            <div class="goal-top"></div>
            <div class="goal-bottom"></div>
        </div>
    `;

    const byPos = { GKP: [], DEF: [], MID: [], FWD: [] };
    startingXI.forEach(p => byPos[p.position_name].push(p));
    
    // Sort players within position by name for consistent layout
    for (const pos in byPos) {
        byPos[pos].sort((a,b) => a.web_name.localeCompare(b.web_name));
    }

    const rowsY = { GKP: 92, DEF: 75, MID: 50, FWD: 25 };

    const placeRow = (players, y) => {
        const count = players.length;
        if (count === 0) return;
        players.forEach((p, i) => {
            const spot = document.createElement('div');
            spot.className = 'player-spot';
            spot.style.top = `${y}%`;
            spot.style.left = `${(i + 1) * 100 / (count + 1)}%`;
            
            // Extra info for my lineup
            let extraInfo = '';
            let opponentName = '';
            if (isMyLineup) {
                const points = p.event_points || 0;
                const proj = (parseFloat(p.predicted_points_1_gw) || 0).toFixed(1);
                
                // Use the getNextOpponent helper function to get opponent team name
                const nextOppInfo = getNextOpponent(p);
                let opp = '-';
                if (nextOppInfo && nextOppInfo !== '-') {
                    // Extract team name from string like "vs ARS" or "@ ARS"
                    const match = nextOppInfo.match(/(?:vs|@)\s*(.+)/);
                    opp = match ? match[1] : nextOppInfo;
                    opponentName = opp;
                }
                
                extraInfo = `
                    <div class="player-data">
                        <div><span class="player-points">${points}</span> <span class="player-proj">(${proj})</span></div>
                        <div class="player-opp">${opp}</div>
                    </div>
                `;
            } else {
                // For other teams, also get opponent info
                const nextOpp = getNextOpponent(p);
                if (nextOpp && nextOpp !== '-') {
                    const match = nextOpp.match(/(?:vs|@)\s*(.+)/);
                    opponentName = match ? match[1] : nextOpp;
                }
            }
            
            // Add next opponent info below player name (for all lineups)
            let nextOppInfoHtml = '';
            if (opponentName && opponentName !== '-') {
                nextOppInfoHtml = `<div style="font-size: 10px; color: #94a3b8; margin-top: 2px; font-weight: 600; text-transform: uppercase;">${opponentName}</div>`;
            }
            
            // Add injury indicator - ENHANCED DESIGN (Larger & More Visible)
            let injuryBadge = '';
            if (p.chance_of_playing_next_round !== null && p.chance_of_playing_next_round !== undefined) {
                const chancePercent = parseInt(p.chance_of_playing_next_round);
                
                // Styles for injury badge - Much larger and more prominent
                const badgeStyle = `
                    position: absolute; 
                    top: -8px; 
                    right: -8px; 
                    width: 32px; 
                    height: 32px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    font-size: 18px; 
                    box-shadow: 0 3px 8px rgba(0,0,0,0.4);
                    border: 3px solid white;
                    border-radius: 50%;
                    z-index: 20;
                    animation: pulse 2s ease-in-out infinite;
                `;
                
                if (chancePercent === 0 || p.status === 'u') {
                    // Red ambulance for unavailable/0% chance
                    injuryBadge = `<div style="${badgeStyle} background: #dc2626;">🚑</div>`;
                } else if (chancePercent <= 50 || p.status === 'd') {
                    // Yellow ambulance for doubtful/low chance
                    injuryBadge = `<div style="${badgeStyle} background: #eab308;">🚑</div>`;
                } else if (chancePercent === 75) {
                     // Orange warning for 75% chance
                     injuryBadge = `<div style="${badgeStyle} background: #ea580c;">⚠️</div>`;
                }
            }
            
            spot.innerHTML = `
                <div style="position: relative; display: inline-block;">
                <img class="player-photo" src="${getPlayerImageUrl(p)}" alt="${p.web_name}" 
                     onerror="this.src='${config.urls.missingPlayerImage}'">
                    ${injuryBadge}
                </div>
                <div class="player-name">${p.web_name}</div>
                ${nextOppInfoHtml}
                ${extraInfo}
            `;
            pitch.appendChild(spot);
        });
    };

    placeRow(byPos.GKP, rowsY.GKP);
    placeRow(byPos.DEF, rowsY.DEF);
    placeRow(byPos.MID, rowsY.MID);
    placeRow(byPos.FWD, rowsY.FWD);
    
    containerEl.appendChild(pitch);

    // Bench
    if (benchPlayers.length > 0) {
        const bench = document.createElement('div');
        bench.className = 'bench-strip';
        bench.innerHTML = benchPlayers.map(p => {
            let extraInfo = '';
            if (isMyLineup) {
                const points = p.event_points || 0;
                const proj = (parseFloat(p.predicted_points_1_gw) || 0).toFixed(1);
                extraInfo = `<div style="font-size:9px; color:#cbd5e1;">${points} (${proj})</div>`;
            }
            return `
            <div class="bench-item">
                <img src="${getPlayerImageUrl(p)}" alt="${p.web_name}" 
                     onerror="this.src='${config.urls.missingPlayerImage}'">
                <div>${p.web_name}</div>
                ${extraInfo}
            </div>
            `;
        }).join('');
        containerEl.appendChild(bench);
    }
}

function renderDraftRosters() {
    console.log("📋 renderDraftRosters() called");
    const container = document.getElementById('otherRosters');
    if (!container) {
        console.error('❌ renderDraftRosters: otherRosters container not found');
        return;
    }
    
    container.innerHTML = '';
    const myTeamId = findMyTeam()?.id;

    if (!state.draft.rostersByEntryId || state.draft.rostersByEntryId.size === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 40px; color: #666;">לא נמצאו סגלים להצגה.</p>';
        console.warn('renderDraftRosters: No rosters found in state');
        return;
    }

    let rosteredCount = 0;
    for (const [teamId, playerIds] of state.draft.rostersByEntryId.entries()) {
        if (teamId === myTeamId) continue;
        
        const teamName = state.draft.entryIdToTeamName.get(teamId);
        if (!teamName || teamName.toLowerCase() === 'average') continue;

        const rosterContainer = document.createElement('div');
        rosterContainer.className = 'roster-container';
        
        const title = document.createElement('h3');
        title.className = 'roster-title';
        title.textContent = teamName;
        rosterContainer.appendChild(title);
        
        const pitchHost = document.createElement('div');
        rosterContainer.appendChild(pitchHost);

        // Append container first, then render pitch
        container.appendChild(rosterContainer);
        renderPitch(pitchHost, playerIds, false);
        rosteredCount++;
    }
    
    console.log(`renderDraftRosters: Successfully rendered ${rosteredCount} team rosters`);
    
    if (rosteredCount === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 40px; color: #666;">לא נמצאו סגלים להצגה.</p>';
    }
}

// ============================================
// MY LINEUP UPDATES (With Last GW Points)
// ============================================

function updateMyLineup(entryId) {
    const container = document.getElementById('myLineupContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Create Lineup Controls (Toggles)
    const controls = document.createElement('div');
    controls.className = 'draft-lineup-controls';
    controls.innerHTML = `
        <div class="lineup-toggles">
            <button id="btnShowMyLineup" class="lineup-toggle active" onclick="updateMyLineup('${entryId}')">ההרכב שלי</button>
            <button id="btnShowRecLineup" class="lineup-toggle" onclick="showRecommendedLineup()">הרכב מומלץ</button>
        </div>
    `;
    container.appendChild(controls);

    const lineup = state.draft.lineupsByEntryId.get(parseInt(entryId));
    const rosterIds = state.draft.rostersByEntryId.get(parseInt(entryId));
    const processedById = getProcessedByElementId();
    
    let starters = [];
    let bench = [];

    if (lineup && lineup.starting && lineup.starting.length > 0) {
        starters = lineup.starting.map(id => processedById.get(id)).filter(Boolean);
        bench = lineup.bench.map(id => processedById.get(id)).filter(Boolean);
    } else if (rosterIds && rosterIds.length > 0) {
        const roster = rosterIds.map(id => processedById.get(id)).filter(Boolean);
        starters = roster.slice(0, 11);
        bench = roster.slice(11);
    } else {
        const pitchWrapper = document.createElement('div');
        pitchWrapper.className = 'pitch-wrapper';
        pitchWrapper.innerHTML = '<div class="alert alert-info">לא נמצא הרכב לקבוצה זו.</div>';
        container.appendChild(pitchWrapper);
        return;
    }

    // Calc Stats
    const calcStats = (players) => ({
        predicted: players.reduce((sum, p) => sum + (parseFloat(p.predicted_points_1_gw) || 0), 0),
        lastGw: players.reduce((sum, p) => sum + (p.event_points || 0), 0),
        ppg90: players.reduce((sum, p) => sum + (parseFloat(p.points_per_game_90) || 0), 0) / (players.length || 1),
        form: players.reduce((sum, p) => sum + (parseFloat(p.form) || 0), 0) / (players.length || 1)
    });
    const stats = calcStats(starters);

    // Render Stats
    const statsDiv = document.createElement('div');
    statsDiv.innerHTML = renderLineupStats(stats);
    container.appendChild(statsDiv);

    // Render Pitch
    const pitchWrapper = document.createElement('div');
    pitchWrapper.className = 'pitch-wrapper';
    container.appendChild(pitchWrapper);
    
    renderPitch(pitchWrapper, starters.map(p=>p.id), true, bench.map(p=>p.id));
}


// ============================================
// VIEW SWITCHING & NAV FIXES
// ============================================

function switchMainView(viewName) {
    const tableDiv = document.getElementById('mainTableView');
    const chartsDiv = document.getElementById('mainChartsView');
    const btnTable = document.getElementById('btnViewTable');
    const btnCharts = document.getElementById('btnViewCharts');

    if (viewName === 'table') {
        if(tableDiv) tableDiv.style.display = 'block';
        if(chartsDiv) chartsDiv.style.display = 'none';
        if(btnTable) btnTable.classList.add('active');
        if(btnCharts) btnCharts.classList.remove('active');
    } else if (viewName === 'charts') {
        if(tableDiv) tableDiv.style.display = 'none';
        if(chartsDiv) chartsDiv.style.display = 'grid'; 
        if(btnTable) btnTable.classList.remove('active');
        if(btnCharts) btnCharts.classList.add('active');
        Object.values(Chart.instances).forEach(chart => chart.resize());
    }
}

function showTab(tabName) {
    // In demo mode, only allow draft tab
    if (auth.isDemo && tabName === 'players') {
        showToast('מצב דמו', 'דף נתוני שחקנים זמין רק למשתמשים רשומים', 'warning', 3000);
        return;
    }
    
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`nav-${tabName}`);
    if (activeBtn) activeBtn.classList.add('active');

    const playersView = document.getElementById('playersTabContent'); 
    const draftView = document.getElementById('draftTabContent'); 
    
    if (tabName === 'players') {
        if(playersView) playersView.style.display = 'block';
        if(draftView) draftView.style.display = 'none';
        switchMainView('table');
        localStorage.setItem('fplToolActiveTab', 'players');
    } else if (tabName === 'draft') {
        if(playersView) playersView.style.display = 'none';
        if(draftView) draftView.style.display = 'block';
        localStorage.setItem('fplToolActiveTab', 'draft');
        
        console.log("🎯 Draft tab activated, calling loadDraftLeague()...");
        
        // Always load draft league data when switching to this tab
        loadDraftLeague().catch(err => {
            console.error("❌ Failed to load draft league:", err);
            showToast('שגיאה', 'לא ניתן לטעון את ליגת הדראפט כרגע', 'error');
        });
    }
}


// ============================================
// RENDER CHARTS (From Backup Style)
// ============================================

function getMatrixChartConfig(data, xLabel, yLabel, quadLabels = {}) {
    const dataPoints = data.map(d => ({ x: d.x, y: d.y, team: d.team, player: d.player }));
    const xValues = dataPoints.map(p => p.x);
    const yValues = dataPoints.map(p => p.y);
    // Use mean (average) instead of median for consistent center point
    const xMedian = xValues.length ? xValues.reduce((a, b) => a + b, 0) / xValues.length : 0;
    const yMedian = yValues.length ? yValues.reduce((a, b) => a + b, 0) / yValues.length : 0;
    
    // Color function based on quadrant - Green (top-right), Red (bottom-left), Orange (others)
    const getPointColor = (point) => {
        if (point.x >= xMedian && point.y >= yMedian) {
            return 'rgba(34, 197, 94, 0.85)'; // Green - Best
        } else if (point.x < xMedian && point.y < yMedian) {
            return 'rgba(239, 68, 68, 0.85)'; // Red - Worst
        } else {
            return 'rgba(251, 146, 60, 0.85)'; // Orange - Medium
        }
    };

    return {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Items',
                data: dataPoints,
                pointRadius: 6,
                pointHoverRadius: 9,
                pointBorderWidth: 2,
                pointBorderColor: 'rgba(255, 255, 255, 0.9)',
                backgroundColor: (context) => {
                    if (!context.raw) return 'rgba(156, 163, 175, 0.7)';
                    return getPointColor(context.raw);
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
                        font: { weight: 'bold', size: 13 },
                        color: '#64748b'
                    },
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                y: { 
                    title: { 
                        display: true, 
                        text: yLabel,
                        font: { weight: 'bold', size: 13 },
                        color: '#64748b'
                    },
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                }
            },
            plugins: {
                legend: { display: false },
                datalabels: {
                    display: 'auto',
                    align: 'top',
                    formatter: (value, context) => {
                        return context.dataset.data[context.dataIndex].player || context.dataset.data[context.dataIndex].team || '';
                    },
                    font: { size: 10, weight: 'bold' },
                    color: '#1e293b',
                    clip: true,
                    clamp: true
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#e2e8f0',
                    borderColor: 'rgba(59, 130, 246, 0.5)',
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            const d = context.raw;
                            return `${d.player || d.team}: (${d.x.toFixed(2)}, ${d.y.toFixed(2)})`;
                        }
                    }
                },
                annotation: {
                    annotations: {
                        xLine: { 
                            type: 'line', 
                            xMin: xMedian, xMax: xMedian, 
                            borderColor: 'rgba(0,0,0,0.2)', borderWidth: 2, borderDash: [6, 6] 
                        },
                        yLine: { 
                            type: 'line', 
                            yMin: yMedian, yMax: yMedian, 
                            borderColor: 'rgba(0,0,0,0.2)', borderWidth: 2, borderDash: [6, 6] 
                        },
                        labelTopRight: { type: 'label', xValue: xMedian, yValue: yMedian, content: quadLabels.topRight || '', position: {x: 'start', y: 'start'}, xAdjust: 15, yAdjust: -15, color: 'rgba(34, 197, 94, 0.9)', font: {weight: 'bold', size: 11}, backgroundColor: 'rgba(34, 197, 94, 0.1)', padding: 4, borderRadius: 4 },
                        labelBottomLeft: { type: 'label', xValue: xMedian, yValue: yMedian, content: quadLabels.bottomLeft || '', position: {x: 'end', y: 'end'}, xAdjust: -15, yAdjust: 15, color: 'rgba(239, 68, 68, 0.9)', font: {weight: 'bold', size: 11}, backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 4, borderRadius: 4 },
                        labelTopLeft: { type: 'label', xValue: xMedian, yValue: yMedian, content: quadLabels.topLeft || '', position: {x: 'end', y: 'start'}, xAdjust: -15, yAdjust: -15, color: 'rgba(251, 146, 60, 0.9)', font: {weight: 'bold', size: 11}, backgroundColor: 'rgba(251, 146, 60, 0.1)', padding: 4, borderRadius: 4 },
                        labelBottomRight: { type: 'label', xValue: xMedian, yValue: yMedian, content: quadLabels.bottomRight || '', position: {x: 'start', y: 'end'}, xAdjust: 15, yAdjust: 15, color: 'rgba(251, 146, 60, 0.9)', font: {weight: 'bold', size: 11}, backgroundColor: 'rgba(251, 146, 60, 0.1)', padding: 4, borderRadius: 4 }
                    }
                }
            }
        }
    };
}

function renderCharts() {
    console.log('📊 Rendering Main Charts (Backup Style)...');
    if (!state.allPlayersData[state.currentDataSource].processed) return;

    const chartsView = document.getElementById('mainChartsView');
    if (!chartsView || getComputedStyle(chartsView).display === 'none') return;

    const data = state.displayedData || state.allPlayersData[state.currentDataSource].processed;

    // 1. Render Matrices (Positional)
    const renderPosMatrix = (canvasId, pos, xKey, xLabel, title) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        // Determine minute threshold based on range
        // For 'all' we use 300 (~3-4 games). For 'Last 3' (270 mins max), we use 90 (1 game).
        // For 'Last 5' (450 max), we use 200 (~2 games).
        let minMinutes = 300;
        if (state.activeRange === '3') minMinutes = 90;
        else if (state.activeRange === '5') minMinutes = 200;
        else if (state.activeRange === '10') minMinutes = 400;
        
        const players = data.filter(p => p.position_name === pos && p.minutes > minMinutes);
        if (players.length < 2) return;

        const chartData = players.map(p => ({
            x: parseFloat(p[xKey] || 0),
            y: parseFloat(p.points_per_game_90),
            player: p.web_name,
            team: p.team_name
        }));

        const config = getMatrixChartConfig(chartData, xLabel, 'נקודות ל-90 דק\'', {
            topRight: `גבוה/${title}`,
            topLeft: 'גבוה/נמוך',
            bottomRight: `נמוך/${title}`,
            bottomLeft: 'נמוך/נמוך'
        });
        
        const ctx = canvas.getContext('2d');
        if (charts[canvasId]) charts[canvasId].destroy();
        charts[canvasId] = new Chart(ctx, config);
    };

    renderPosMatrix('chart-mid', 'MID', 'expected_goal_involvements_per_90', 'xGI/90', 'קשרים');
    renderPosMatrix('chart-fwd', 'FWD', 'expected_goal_involvements_per_90', 'xGI/90', 'חלוצים');
    renderPosMatrix('chart-def', 'DEF', 'def_contrib_per90', 'תרומה הגנתית/90', 'מגנים');
    renderPosMatrix('chart-gkp', 'GKP', 'expected_goals_conceded_per_90', 'xGC/90', 'שוערים');

    // 2. Team Charts (Attack/Defense)
    const renderTeamChart = (canvasId, type, xKey, yKey, xLabel, yLabel, quadLabels) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const teamStats = {};
        data.forEach(p => {
            if (!teamStats[p.team_name]) teamStats[p.team_name] = { x: 0, y: 0, mins: 0 };
            // For Attack chart, we use 'expected_goal_involvements' (mapped to expected_goals_assists in preprocess)
            // But raw field is expected_goal_involvements. preprocessPlayerData makes p.expected_goals_assists = parseFloat(p.expected_goal_involvements) || 0;
            // So we should use the key that works on the processed object.
            
            let valX = 0;
            if (xKey === 'expected_goal_involvements') {
                valX = parseFloat(p.expected_goal_involvements) || 0;
            } else if (xKey === 'expected_goals_conceded') {
                valX = parseFloat(p.expected_goals_conceded) || 0;
            } else {
                valX = parseFloat(p[xKey] || 0);
            }

            const valY = type === 'attack' ? ((p.goals_scored||0)+(p.assists||0)) : (p.goals_conceded||0);
            
            if ((type === 'attack' && ['MID','FWD'].includes(p.position_name)) || 
                (type === 'defense' && ['DEF','GKP'].includes(p.position_name))) {
                teamStats[p.team_name].x += valX;
                teamStats[p.team_name].y += valY;
                teamStats[p.team_name].mins += p.minutes;
            }
        });

        const points = Object.entries(teamStats).map(([team, stats]) => {
             // Normalize to per 90 mins for approx 5-6 players?
             // Actually user asked for team attack/defense. If we sum stats for relevant positions, we get total output.
             // Normalizing by players minutes gives "per player per 90".
             // Let's keep previous logic but ensure it's robust.
             const playersCount = type === 'attack' ? 6 : 5; // Approx mids+fwds vs defs+gkp
             const norm = stats.mins > 0 ? (stats.mins/90) / playersCount : 1;
             
             // Avoid division by zero or very small numbers
             if (stats.mins < 450) return null; // Need meaningful minutes

             return { x: stats.x/norm, y: stats.y/norm, team: team };
        }).filter(d => d !== null && (d.x > 0 || d.y > 0));

        const config = getMatrixChartConfig(points, xLabel, yLabel, quadLabels);
        const ctx = canvas.getContext('2d');
        if (charts[canvasId]) charts[canvasId].destroy();
        charts[canvasId] = new Chart(ctx, config);
    };

    renderTeamChart('chart-attack', 'attack', 'expected_goal_involvements', 'GI', 'צפי מעורבות (xGI)', 'מעורבות בפועל (G+A)', {topRight: 'התקפה קטלנית', bottomLeft: 'התקפה חלשה'});
    renderTeamChart('chart-defense', 'defense', 'expected_goals_conceded', 'GC', 'צפי ספיגות (xGC)', 'ספיגות בפועל (GC)', {topRight: 'הגנה חלשה', bottomLeft: 'הגנת ברזל'});

    // 3. Price vs Score (Value Chart)
    const renderPriceScore = () => {
        const canvas = document.getElementById('chart-price-score');
        if (!canvas) return;
        
        const points = data.filter(p => p.minutes > 500).map(p => ({
            x: parseFloat(p.now_cost),
            y: parseFloat(p.total_points),
            player: p.web_name,
            team: p.team_name
        }));

        const config = getMatrixChartConfig(points, 'מחיר (£m)', 'סה״כ נקודות', {
            topRight: 'יהלומים (זול וטוב)',
            bottomLeft: 'יקר ולא יעיל'
        });

        const ctx = canvas.getContext('2d');
        if (charts['chart-price-score']) charts['chart-price-score'].destroy();
        charts['chart-price-score'] = new Chart(ctx, config);
    };
    renderPriceScore();

    // 4. ICT Chart
    const renderICT = () => {
        const canvas = document.getElementById('chart-ict');
        if (!canvas) return;
        
        const topICT = [...data].sort((a,b) => b.ict_index - a.ict_index).slice(0, 15);
        
        const ctx = canvas.getContext('2d');
        if (charts['chart-ict']) charts['chart-ict'].destroy();

        charts['chart-ict'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topICT.map(p => p.web_name),
                datasets: [
                    { label: 'Influence', data: topICT.map(p => p.influence), backgroundColor: '#3b82f6' },
                    { label: 'Creativity', data: topICT.map(p => p.creativity), backgroundColor: '#10b981' },
                    { label: 'Threat', data: topICT.map(p => p.threat), backgroundColor: '#ef4444' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { x: { stacked: true }, y: { stacked: true } },
                plugins: {
                    legend: { position: 'bottom' },
                    datalabels: { display: false } // Disable datalabels for this bar chart to reduce clutter
                }
            }
        });
    };
    renderICT();
}

// Override switchMainView to call renderCharts
// We use a self-invoking function or just overwrite to avoid infinite recursion if we re-run this script
(function() {
    const originalSwitchMainView = window.switchMainView;
    window.switchMainView = function(viewName) {
        // Handle UI toggling explicitly if original is missing or just as redundancy
        const tableDiv = document.getElementById('mainTableView');
        const chartsDiv = document.getElementById('mainChartsView');
        const btnTable = document.getElementById('btnViewTable');
        const btnCharts = document.getElementById('btnViewCharts');

        if (viewName === 'table') {
            if(tableDiv) tableDiv.style.display = 'block';
            if(chartsDiv) chartsDiv.style.display = 'none';
            if(btnTable) btnTable.classList.add('active');
            if(btnCharts) btnCharts.classList.remove('active');
        } else if (viewName === 'charts') {
            if(tableDiv) tableDiv.style.display = 'none';
            if(chartsDiv) chartsDiv.style.display = 'grid';
            if(btnTable) btnTable.classList.remove('active');
            if(btnCharts) btnCharts.classList.add('active');
            setTimeout(renderCharts, 50);
        }
        
        // If we wanted to keep original logic (e.g. resize), we could call originalSwitchMainView(viewName)
        // But we just reimplemented the core logic above.
    };
})();


// ============================================
// DRAFT FEATURE RESTORATION - NAVIGATION & UI
// ============================================

/**
 * Calculate xPts for a team using only the top 11 players by predicted points
 * This gives a more realistic prediction than using all 15 players
 */
function calculateTeamXPts(roster, processedById) {
    const squad = roster.map(id => processedById.get(id)).filter(Boolean);
    
    // Sort by predicted points and take top 11
    const top11 = squad
        .sort((a, b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0))
        .slice(0, 11);
    
    return top11.reduce((sum, p) => sum + (parseFloat(p.predicted_points_1_gw) || 0), 0);
}

/**
 * Calculate form factor - average points from last 5 gameweeks
 * @param {Array} roster - Array of player IDs
 * @param {Map} processedById - Map of player data
 * @param {number} entryId - Team entry ID
 * @returns {number} Average points from last 5 GWs
 */
function calculateFormFactor(roster, processedById, entryId) {
    const historicalLineups = state.draft.historicalLineups.get(entryId);
    if (!historicalLineups) return 0;
    
    const currentGW = state.draft.details?.league?.current_event || getCurrentEventId();
    const gwsToCheck = Math.min(5, currentGW); // Last 5 GWs or less
    let totalPoints = 0;
    let gwCount = 0;
    
    for (let i = 0; i < gwsToCheck; i++) {
        const gw = currentGW - i;
        if (gw < 1) break;
        
        const gwKey = `gw${gw}`;
        const lineup = historicalLineups[gwKey];
        
        if (lineup && lineup.starting) {
            const starters = lineup.starting
                .map(id => processedById.get(id))
                .filter(p => p && p.minutes > 0);
            
            const gwPoints = starters.reduce((sum, p) => sum + (p.event_points || 0), 0);
            totalPoints += gwPoints;
            gwCount++;
        }
    }
    
    return gwCount > 0 ? totalPoints / gwCount : 0;
}

/**
 * Calculate head-to-head history between two teams
 * @param {number} team1Id - First team entry ID
 * @param {number} team2Id - Second team entry ID
 * @returns {Object} { team1Wins, team2Wins, draws }
 */
function calculateH2HHistory(team1Id, team2Id) {
    const matches = state.draft.details?.matches || [];
    let team1Wins = 0, team2Wins = 0, draws = 0;
    
    matches.forEach(m => {
        if (m.finished && 
            ((m.league_entry_1 === team1Id && m.league_entry_2 === team2Id) ||
             (m.league_entry_1 === team2Id && m.league_entry_2 === team1Id))) {
            
            const score1 = m.league_entry_1 === team1Id ? m.league_entry_1_points : m.league_entry_2_points;
            const score2 = m.league_entry_1 === team1Id ? m.league_entry_2_points : m.league_entry_1_points;
            
            if (score1 > score2) team1Wins++;
            else if (score2 > score1) team2Wins++;
            else draws++;
        }
    });
    
    return { team1Wins, team2Wins, draws };
}

/**
 * Calculate injury impact - reduction for injured/suspended players
 * @param {Array} roster - Array of player IDs
 * @param {Map} processedById - Map of player data
 * @returns {number} Percentage reduction (0-1)
 */
function calculateInjuryImpact(roster, processedById) {
    const squad = roster.map(id => processedById.get(id)).filter(Boolean);
    const top11 = squad
        .sort((a, b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0))
        .slice(0, 11);
    
    let injuredCount = 0;
    top11.forEach(p => {
        // Check if player is injured, suspended, or doubtful
        const status = p.status || '';
        if (['i', 's', 'd', 'u'].includes(status.toLowerCase())) {
            injuredCount++;
        }
    });
    
    // Each injured player reduces team strength by ~8%
    return injuredCount * 0.08;
}

/**
 * Calculate advanced win probability using multiple factors
 * @param {number} team1Id - First team entry ID
 * @param {number} team2Id - Second team entry ID
 * @param {Array} roster1 - First team roster
 * @param {Array} roster2 - Second team roster
 * @param {Map} processedById - Map of player data
 * @returns {Object} { winProb1, winProb2 }
 */
function calculateAdvancedWinProbability(team1Id, team2Id, roster1, roster2, processedById) {
    // 1. Base xPts (55% weight) - only top 11 players
    const xPts1 = calculateTeamXPts(roster1, processedById);
    const xPts2 = calculateTeamXPts(roster2, processedById);
    
    // 2. Form Factor (25% weight) - average of last 5 GWs
    const form1 = calculateFormFactor(roster1, processedById, team1Id);
    const form2 = calculateFormFactor(roster2, processedById, team2Id);
    
    // 3. Injury Impact (20% weight)
    const injuryImpact1 = calculateInjuryImpact(roster1, processedById);
    const injuryImpact2 = calculateInjuryImpact(roster2, processedById);
    
    // Combine all factors with weights (NO H2H HISTORY)
    const score1 = (xPts1 * 0.55) + (form1 * 0.25) - (injuryImpact1 * 100 * 0.20);
    const score2 = (xPts2 * 0.55) + (form2 * 0.25) - (injuryImpact2 * 100 * 0.20);
    
    // Calculate win probability using sigmoid function
    const diff = score1 - score2;
    const scaleFactor = 0.08; // Adjust for desired curve steepness
    
    let winProb1 = 50 + (50 * Math.tanh(diff * scaleFactor));
    let winProb2 = 100 - winProb1;
    
    // Ensure range is 25%-75%
    if (winProb1 < 25) {
        winProb1 = 25;
        winProb2 = 75;
    } else if (winProb1 > 75) {
        winProb1 = 75;
        winProb2 = 25;
    }
    
    return { winProb1, winProb2 };
}

function renderNextRoundFixtures() {
    if (!state.draft.details || !state.draft.details.matches) return '';
    
    const currentGW = state.draft.details.league?.current_event || getCurrentEventId();
    const nextGW = currentGW + 1;
    const nextMatches = state.draft.details.matches.filter(m => m.event === nextGW);
    
    if (nextMatches.length === 0) return '';
    
    const processedById = getProcessedByElementId();
    
    let html = `
        <div class="next-fixtures-card" style="background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); margin-bottom: 16px; border: 1px solid #e2e8f0;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                <span style="font-size: 24px;">⚔️</span>
                <h3 style="margin: 0; font-size: 18px; color: #0f172a; font-weight: 800;">משחקי מחזור ${nextGW}</h3>
            </div>
            
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 12px; color: #0369a1; line-height: 1.5;">
                <strong>💡 איך מחושב הסיכוי לניצחון?</strong><br>
                האלגוריתם משקלל: 
                <span style="display:inline-block; margin: 0 4px;">• <strong>נקודות צפויות (xPts):</strong> 55%</span>
                <span style="display:inline-block; margin: 0 4px;">• <strong>כושר (Form):</strong> 25%</span>
                <span style="display:inline-block; margin: 0 4px;">• <strong>פציעות:</strong> -20%</span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px;">
    `;
    
    nextMatches.forEach(match => {
        const team1 = state.draft.entryIdToTeamName.get(match.league_entry_1) || 'Unknown';
        const team2 = state.draft.entryIdToTeamName.get(match.league_entry_2) || 'Unknown';
        const logo1 = getTeamLogo(team1);
        const logo2 = getTeamLogo(team2);
        
        // Calculate win probability with ADVANCED algorithm
        const roster1 = state.draft.rostersByEntryId.get(match.league_entry_1) || [];
        const roster2 = state.draft.rostersByEntryId.get(match.league_entry_2) || [];
        
        // Handle "null" team (average team)
        const isTeam1Null = team1.toLowerCase().includes('null') || team1 === 'Unknown';
        const isTeam2Null = team2.toLowerCase().includes('null') || team2 === 'Unknown';
        
        let winProb1, winProb2, xPts1, xPts2;
        
        if (isTeam1Null || isTeam2Null) {
            // If playing against "null" (average), it's 50-50
            winProb1 = 50;
            winProb2 = 50;
            xPts1 = calculateTeamXPts(roster1, processedById);
            xPts2 = calculateTeamXPts(roster2, processedById);
        } else {
            // Use advanced algorithm with form, history, and injuries
            const result = calculateAdvancedWinProbability(
                match.league_entry_1, 
                match.league_entry_2, 
                roster1, 
                roster2, 
                processedById
            );
            winProb1 = result.winProb1;
            winProb2 = result.winProb2;
            xPts1 = calculateTeamXPts(roster1, processedById);
            xPts2 = calculateTeamXPts(roster2, processedById);
        }
        
        html += `
            <div style="background: white; padding: 14px; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 36px; margin-bottom: 6px;">${logo1}</div>
                        <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;">${team1}</div>
                        <div style="background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; display: inline-block;">
                            ${xPts1.toFixed(1)}
                        </div>
                    </div>
                    
                    <div style="text-align: center; padding: 0 10px;">
                        <div style="font-weight: 900; font-size: 18px; color: #64748b;">VS</div>
                    </div>
                    
                    <div style="flex: 1; text-align: center;">
                        <div style="font-size: 36px; margin-bottom: 6px;">${logo2}</div>
                        <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;">${team2}</div>
                        <div style="background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; display: inline-block;">
                            ${xPts2.toFixed(1)}
                        </div>
                    </div>
                </div>
                
                <div style="margin-top: 8px;">
                    <div style="display: flex; height: 28px; background: #f1f5f9; border-radius: 14px; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.08);">
                        <div style="width: ${winProb1}%; background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 12px; transition: width 0.5s ease;" title="סיכוי לניצחון: ${winProb1.toFixed(1)}%">
                            ${winProb1.toFixed(0)}%
                        </div>
                        <div style="width: ${winProb2}%; background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 12px; transition: width 0.5s ease;" title="סיכוי לניצחון: ${winProb2.toFixed(1)}%">
                            ${winProb2.toFixed(0)}%
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

function switchDraftTab(tabId) {
    // Update Nav Buttons
    document.querySelectorAll('.draft-nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if(btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabId)) {
            btn.classList.add('active');
        }
    });

    // Update Content Areas
    document.querySelectorAll('.draft-sub-content').forEach(div => {
        div.classList.remove('active');
        div.style.display = 'none';
    });
    
    const activeDiv = document.getElementById(`draft-${tabId}`);
    if(activeDiv) {
        activeDiv.classList.add('active');
        activeDiv.style.display = 'block';
    }

    // Specific logic for tabs
    if (tabId === 'rival') {
        renderNextRivalAnalysis();
    } else if (tabId === 'overview') {
        // Ensure overview components are rendered if data exists
        if(state.draft.details) {
             renderAllTeamsTrendChart(null, window.currentTrendState?.mode || 'cumulative', window.currentTrendState?.highlightTeamIds || []);
        }
    } else if (tabId === 'nextround') {
        // Render next round fixtures
        const fixturesContainer = document.getElementById('nextFixturesOverview');
        if (fixturesContainer && state.draft.details) {
            const fixturesHtml = renderNextRoundFixtures();
            fixturesContainer.innerHTML = fixturesHtml || '<div style="text-align: center; padding: 40px; color: #64748b;">אין משחקים קרובים</div>';
        }
    } else if (tabId === 'h2h') {
        // Render head-to-head history
        renderH2HHistory();
    } else if (tabId === 'lineup-analysis') {
        // Render lineup decisions analysis
        renderLineupAnalysis();
    }
}

// ============================================
// HEAD-TO-HEAD HISTORY & LINEUP ANALYSIS
// ============================================

/**
 * Render head-to-head match history between two teams
 */
function renderH2HHistory() {
    const container = document.getElementById('h2hHistoryContainer');
    if (!container) return;
    
    const myTeam = findMyTeam();
    if (!myTeam) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;">אנא בחר את הקבוצה שלך תחילה</div>';
        return;
    }
    
    const entries = state.draft.details?.league_entries || [];
    const matches = state.draft.details?.matches || [];
    
    // Create team selectors
    let html = `
        <div style="background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); padding: 24px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 24px; border: 2px solid #e2e8f0;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="margin: 0 0 8px 0; font-size: 24px; color: #0f172a; font-weight: 900;">📜 היסטוריית מפגשים</h2>
                <p style="margin: 0; color: #64748b; font-size: 14px;">בחר שתי קבוצות כדי לראות את כל המשחקים ביניהן</p>
            </div>
            <div style="display: flex; justify-content: center; align-items: center; gap: 15px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label style="font-size: 14px; font-weight: 600; color: #3b82f6;">קבוצה 1:</label>
                    <select id="h2hTeam1" onchange="renderH2HHistory()" style="padding: 10px 16px; border-radius: 8px; border: 2px solid #3b82f6; font-size: 14px; font-weight: 600; color: #334155; cursor: pointer; background: white;">
                        ${entries.map(e => `<option value="${e.id}" ${e.id === myTeam.id ? 'selected' : ''}>${e.entry_name}</option>`).join('')}
                    </select>
                </div>
                <span style="font-size: 24px; color: #cbd5e1;">⚔️</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label style="font-size: 14px; font-weight: 600; color: #ef4444;">קבוצה 2:</label>
                    <select id="h2hTeam2" onchange="renderH2HHistory()" style="padding: 10px 16px; border-radius: 8px; border: 2px solid #ef4444; font-size: 14px; font-weight: 600; color: #334155; cursor: pointer; background: white;">
                        ${entries.filter(e => e.id !== myTeam.id).map(e => `<option value="${e.id}">${e.entry_name}</option>`).join('')}
                    </select>
                </div>
            </div>
        </div>
    `;
    
    // Get selected teams
    const team1Select = document.getElementById('h2hTeam1');
    const team2Select = document.getElementById('h2hTeam2');
    const team1Id = team1Select ? parseInt(team1Select.value) : myTeam.id;
    const team2Id = team2Select ? parseInt(team2Select.value) : (entries.find(e => e.id !== myTeam.id)?.id || 0);
    
    const team1 = entries.find(e => e.id === team1Id);
    const team2 = entries.find(e => e.id === team2Id);
    
    if (!team1 || !team2) {
        container.innerHTML = html + '<div style="text-align: center; padding: 40px; color: #64748b;">לא נמצאו קבוצות</div>';
        return;
    }
    
    // Filter matches between these two teams
    const h2hMatches = matches.filter(m => 
        m.finished &&
        ((m.league_entry_1 === team1Id && m.league_entry_2 === team2Id) ||
         (m.league_entry_1 === team2Id && m.league_entry_2 === team1Id))
    ).sort((a, b) => b.event - a.event); // Most recent first
    
    if (h2hMatches.length === 0) {
        html += '<div style="text-align: center; padding: 60px; background: white; border-radius: 12px; border: 2px dashed #e2e8f0;"><div style="font-size: 48px; margin-bottom: 16px;">🤷</div><h3 style="margin: 0 0 8px 0; color: #475569;">אין משחקים קודמים</h3><p style="margin: 0; color: #94a3b8;">שתי הקבוצות עדיין לא התמודדו זו מול זו</p></div>';
        container.innerHTML = html;
        return;
    }
    
    // Calculate stats
    let team1Wins = 0, team2Wins = 0, draws = 0;
    let team1TotalPoints = 0, team2TotalPoints = 0;
    
    h2hMatches.forEach(m => {
        const score1 = m.league_entry_1 === team1Id ? m.league_entry_1_points : m.league_entry_2_points;
        const score2 = m.league_entry_1 === team1Id ? m.league_entry_2_points : m.league_entry_1_points;
        
        team1TotalPoints += score1;
        team2TotalPoints += score2;
        
        if (score1 > score2) team1Wins++;
        else if (score2 > score1) team2Wins++;
        else draws++;
    });
    
    // Summary stats
    html += `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%); padding: 20px; border-radius: 12px; text-align: center; color: white;">
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">נצחונות ${team1.entry_name}</div>
                <div style="font-size: 36px; font-weight: 900;">${team1Wins}</div>
            </div>
            <div style="background: linear-gradient(135deg, #64748b 0%, #94a3b8 100%); padding: 20px; border-radius: 12px; text-align: center; color: white;">
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">תיקו</div>
                <div style="font-size: 36px; font-weight: 900;">${draws}</div>
            </div>
            <div style="background: linear-gradient(135deg, #ef4444 0%, #f87171 100%); padding: 20px; border-radius: 12px; text-align: center; color: white;">
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">נצחונות ${team2.entry_name}</div>
                <div style="font-size: 36px; font-weight: 900;">${team2Wins}</div>
            </div>
        </div>
    `;
    
    // Matches table
    html += `
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
            <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 16px; border-bottom: 2px solid #e2e8f0;">
                <h3 style="margin: 0; font-size: 18px; color: #0f172a; font-weight: 800;">📋 כל המשחקים (${h2hMatches.length})</h3>
            </div>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 12px; text-align: center; font-weight: 700; color: #475569; font-size: 13px;">מחזור</th>
                            <th style="padding: 12px; text-align: right; font-weight: 700; color: #475569; font-size: 13px;">${team1.entry_name}</th>
                            <th style="padding: 12px; text-align: center; font-weight: 700; color: #475569; font-size: 13px;">תוצאה</th>
                            <th style="padding: 12px; text-align: left; font-weight: 700; color: #475569; font-size: 13px;">${team2.entry_name}</th>
                            <th style="padding: 12px; text-align: center; font-weight: 700; color: #475569; font-size: 13px;">מנצח</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    h2hMatches.forEach((m, idx) => {
        const score1 = m.league_entry_1 === team1Id ? m.league_entry_1_points : m.league_entry_2_points;
        const score2 = m.league_entry_1 === team1Id ? m.league_entry_2_points : m.league_entry_1_points;
        const winner = score1 > score2 ? team1.entry_name : score2 > score1 ? team2.entry_name : 'תיקו';
        const winnerColor = score1 > score2 ? '#3b82f6' : score2 > score1 ? '#ef4444' : '#64748b';
        
        html += `
            <tr style="border-bottom: 1px solid #f1f5f9; ${idx % 2 === 0 ? 'background: #fafafa;' : 'background: white;'}">
                <td style="padding: 14px; text-align: center; font-weight: 700; color: #3b82f6; font-size: 15px;">GW${m.event}</td>
                <td style="padding: 14px; text-align: right; font-weight: 600; color: #334155; font-size: 14px;">${getTeamLogo(team1.entry_name)} ${team1.entry_name}</td>
                <td style="padding: 14px; text-align: center; font-weight: 900; color: #0f172a; font-size: 16px;">${score1} - ${score2}</td>
                <td style="padding: 14px; text-align: left; font-weight: 600; color: #334155; font-size: 14px;">${team2.entry_name} ${getTeamLogo(team2.entry_name)}</td>
                <td style="padding: 14px; text-align: center;">
                    <span style="background: ${winnerColor}; color: white; padding: 4px 12px; border-radius: 12px; font-weight: 700; font-size: 12px; white-space: nowrap;">
                        ${winner === 'תיקו' ? '🤝 תיקו' : '🏆 ' + winner}
                    </span>
                </td>
            </tr>
        `;
    });
    
    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

/**
 * Calculate bench points for all teams
 */
function calculateAllTeamsBenchPoints(currentGW) {
    const processedById = getProcessedByElementId();
    const entries = state.draft.details?.league_entries || [];
    const myTeamId = findMyTeam()?.id;
    
    const results = [];
    
    entries.forEach(entry => {
        // Skip null/invalid entries
        if (!entry || !entry.entry_name || entry.entry_name === 'null' || entry.entry_name.toLowerCase() === 'null') {
            console.log(`⏭️ Skipping invalid entry:`, entry);
            return;
        }
        
        const historicalLineups = state.draft.historicalLineups.get(entry.id);
        if (!historicalLineups || Object.keys(historicalLineups).length === 0) {
            console.log(`⚠️ No historical lineups for ${entry.entry_name}`);
            results.push({
                teamName: entry.entry_name,
                totalBenchPoints: 0,
                avgPerGW: 0,
                gwWithMistakes: 0,
                isMyTeam: entry.id === myTeamId
            });
            return;
        }
        
        let totalBenchPoints = 0;
        let gwsWithBenchPoints = new Set();
        
        console.log(`💰 Calculating bench points for ${entry.entry_name}...`);
        
        for (let gw = 1; gw <= currentGW; gw++) {
            const gwKey = `gw${gw}`;
            const lineup = historicalLineups[gwKey];
            if (!lineup || !lineup.bench) {
                console.log(`   ⏭️ GW${gw}: No lineup data`);
                continue;
            }
            
            // Handle new structure (array of objects) or old structure (array of IDs)
            // Ensure we handle both cases for backward compatibility if data is mixed
            const benchItems = lineup.bench;
            const benchPlayers = benchItems.map(item => {
                // If item is object, use item.fplId and item.points
                // If item is ID (number/string), fetch player but we won't have points directly
                const id = (typeof item === 'object' && item !== null) ? item.fplId : item;
                const player = processedById.get(id);
                if (!player) return null;
                
                // If we have points directly from the pick, use them!
                if (typeof item === 'object' && item.points !== undefined) {
                    return { ...player, event_points: item.points };
                }
                
                return player;
            }).filter(Boolean);

            console.log(`   📋 GW${gw}: ${benchPlayers.length} bench players`);
            
            let gwBenchPoints = 0;
            benchPlayers.forEach(player => {
                // Priority: 1. Points from Pick (stored in loadHistoricalLineups)
                //           2. History array (unlikely to exist for all)
                //           3. 0 as fallback
                
                let points = 0;
                
                if (player.event_points !== undefined) {
                    // This comes from the pick object we just mapped
                    points = player.event_points;
                } else {
                    const gwData = player.history?.find(h => h.round === gw);
                    if (gwData) points = gwData.total_points;
                }
                
                if (points > 0) {
                    totalBenchPoints += points;
                    gwBenchPoints += points;
                    console.log(`      ✅ ${player.web_name}: ${points} pts`);
                } else {
                    console.log(`      ⭕ ${player.web_name}: 0 pts`);
                }
            });
            
            if (gwBenchPoints > 0) {
                gwsWithBenchPoints.add(gw);
            }
        }
        
        console.log(`   📊 Total: ${totalBenchPoints} pts across ${gwsWithBenchPoints.size} GWs`);
        
        results.push({
            teamName: entry.entry_name,
            totalBenchPoints,
            avgPerGW: totalBenchPoints / currentGW,
            gwWithMistakes: gwsWithBenchPoints.size,
            isMyTeam: entry.id === myTeamId
        });
    });
    
    // Sort by total bench points descending (worst first)
    return results.sort((a, b) => b.totalBenchPoints - a.totalBenchPoints);
}

/**
 * Render lineup analysis for a specific team
 */
window.renderLineupAnalysisForTeam = function(teamId) {
    const selectedTeam = state.draft.details?.league_entries?.find(e => e.id === parseInt(teamId));
    if (selectedTeam) {
        renderLineupAnalysisInternal(selectedTeam);
    }
};

/**
 * Render lineup decisions analysis - shows points lost due to benching
 */
function renderLineupAnalysis() {
    console.log('🔍 renderLineupAnalysis called');
    const myTeam = findMyTeam();
    console.log('🔍 myTeam:', myTeam);
    if (myTeam) {
        renderLineupAnalysisInternal(myTeam);
    } else {
        const container = document.getElementById('lineupAnalysisContainer');
        if (container) {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: #ef4444; background: #fee2e2; border-radius: 12px; border: 2px solid #fca5a5;"><h3 style="margin: 0 0 8px 0;">⚠️ לא נמצאה קבוצה</h3><p style="margin: 0;">אנא בחר את הקבוצה שלך בהגדרות</p></div>';
        }
    }
}

function renderLineupAnalysisInternal(team) {
    const container = document.getElementById('lineupAnalysisContainer');
    if (!container) return;
    
    if (!team) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;">אנא בחר את הקבוצה שלך תחילה</div>';
        return;
    }
    
    const historicalLineups = state.draft.historicalLineups.get(team.id);
    if (!historicalLineups || Object.keys(historicalLineups).length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;">טוען נתונים היסטוריים...</div>';
        return;
    }
    
    const processedById = getProcessedByElementId();
    const currentGW = state.draft.details?.league?.current_event || getCurrentEventId();
    
    // Calculate bench points for ALL teams
    const allTeamsBenchPoints = calculateAllTeamsBenchPoints(currentGW);
    
    // Team selector
    const entries = state.draft.details?.league_entries || [];
    const teamOptions = entries.map(e => `
        <option value="${e.id}" ${e.id === team.id ? 'selected' : ''}>${e.entry_name}</option>
    `).join('');
    
    const teamName = team.entry_name || team.name || 'Unknown Team';
    
    let html = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 16px 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h2 style="margin: 0 0 4px 0; font-size: 18px; color: #ffffff; font-weight: 900;">🔍 ניתוח החלטות הרכב - ${teamName}</h2>
                <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 12px;">כמה נקודות הפסדת בגלל שחקנים שהשארת על הספסל?</p>
            </div>
            <select onchange="renderLineupAnalysisForTeam(this.value)" style="padding: 8px 12px; border-radius: 8px; border: 2px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.15); color: white; font-weight: 700; font-size: 13px; cursor: pointer;">
                ${teamOptions}
            </select>
        </div>
        
        <!-- All Teams Bench Points Table -->
        <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-bottom: 20px; border: 1px solid #e2e8f0;">
            <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #0f172a; font-weight: 800; display: flex; align-items: center; gap: 8px;">
                <span>📊</span> נקודות שהושארו על הספסל - כל הקבוצות
            </h3>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                        <tr style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 10px 12px; text-align: right; font-weight: 700; color: #475569;">#</th>
                            <th style="padding: 10px 12px; text-align: right; font-weight: 700; color: #475569;">קבוצה</th>
                            <th style="padding: 10px 12px; text-align: center; font-weight: 700; color: #475569;">סה"כ נק' ספסל</th>
                            <th style="padding: 10px 12px; text-align: center; font-weight: 700; color: #475569;">ממוצע למחזור</th>
                            <th style="padding: 10px 12px; text-align: center; font-weight: 700; color: #475569;">מחזורים עם טעויות</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allTeamsBenchPoints.map((team, idx) => `
                            <tr style="border-bottom: 1px solid #f1f5f9; ${team.isMyTeam ? 'background: #eff6ff;' : ''}">
                                <td style="padding: 10px 12px; font-weight: 600; color: #64748b;">${idx + 1}</td>
                                <td style="padding: 10px 12px; font-weight: 700; color: ${team.isMyTeam ? '#3b82f6' : '#0f172a'};">
                                    ${team.isMyTeam ? '🎯 ' : ''}${team.teamName}
                                </td>
                                <td style="padding: 10px 12px; text-align: center; font-weight: 800; color: #ef4444; font-size: 14px;">
                                    ${team.totalBenchPoints.toFixed(1)}
                                </td>
                                <td style="padding: 10px 12px; text-align: center; font-weight: 700; color: #64748b;">
                                    ${team.avgPerGW.toFixed(1)}
                                </td>
                                <td style="padding: 10px 12px; text-align: center; font-weight: 700; color: #64748b;">
                                    ${team.gwWithMistakes} / ${currentGW}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    let totalPointsLost = 0;
    let gwAnalysis = [];
    
    for (let gw = 1; gw <= currentGW; gw++) {
        const gwKey = `gw${gw}`;
        const lineup = historicalLineups[gwKey];
        
        if (!lineup) continue;
        
        // Helper to map player and inject historical points
        const mapPlayer = (item) => {
            const id = (typeof item === 'object' && item !== null) ? item.fplId : item;
            const player = processedById.get(id);
            if (!player) return null;
            
            // Inject correct points for this GW
            let gwPoints = 0;
            if (typeof item === 'object' && item.points !== undefined) {
                gwPoints = item.points;
            } else {
                // Fallback to history (likely undefined/0)
                const gwData = player.history?.find(h => h.round === gw);
                if (gwData) gwPoints = gwData.total_points;
            }
            
            return { ...player, event_points: gwPoints }; // Override event_points with historical
        };

        const starters = lineup.starting.map(mapPlayer).filter(Boolean);
        const bench = lineup.bench.map(mapPlayer).filter(Boolean);
        
        const startersPoints = starters.reduce((sum, p) => sum + (p.event_points || 0), 0);
        const benchPoints = bench.reduce((sum, p) => sum + (p.event_points || 0), 0);
        
        // Find optimal lineup (top 11 by actual points)
        const allPlayers = [...starters, ...bench];
        const optimal = allPlayers
            .sort((a, b) => (b.event_points || 0) - (a.event_points || 0))
            .slice(0, 11);
        const optimalPoints = optimal.reduce((sum, p) => sum + (p.event_points || 0), 0);
        
        const pointsLost = optimalPoints - startersPoints;
        totalPointsLost += pointsLost;
        
        if (pointsLost > 0) {
            gwAnalysis.push({ gw, startersPoints, optimalPoints, pointsLost, bench, starters, optimal });
        }
    }
    
    // Summary - COMPACT VERSION
    html += `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px;">
            <div style="background: linear-gradient(135deg, #ef4444 0%, #f87171 100%); padding: 16px; border-radius: 10px; text-align: center; color: white; box-shadow: 0 2px 8px rgba(239, 68, 68, 0.25);">
                <div style="font-size: 11px; opacity: 0.9; margin-bottom: 6px;">סה"כ נקודות שהפסדת</div>
                <div style="font-size: 32px; font-weight: 900; margin-bottom: 2px;">${totalPointsLost.toFixed(1)}</div>
                <div style="font-size: 10px; opacity: 0.8;">החלטות הרכב לא אופטימליות</div>
            </div>
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); padding: 16px; border-radius: 10px; text-align: center; color: white; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.25);">
                <div style="font-size: 11px; opacity: 0.9; margin-bottom: 6px;">מחזורים עם טעויות</div>
                <div style="font-size: 32px; font-weight: 900; margin-bottom: 2px;">${gwAnalysis.length}</div>
                <div style="font-size: 10px; opacity: 0.8;">מתוך ${currentGW} מחזורים</div>
            </div>
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%); padding: 16px; border-radius: 10px; text-align: center; color: white; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);">
                <div style="font-size: 11px; opacity: 0.9; margin-bottom: 6px;">ממוצע נקודות לאיבוד</div>
                <div style="font-size: 32px; font-weight: 900; margin-bottom: 2px;">${gwAnalysis.length > 0 ? (totalPointsLost / gwAnalysis.length).toFixed(1) : '0'}</div>
                <div style="font-size: 10px; opacity: 0.8;">למחזור עם טעות</div>
            </div>
        </div>
    `;
    
    if (gwAnalysis.length === 0) {
        html += '<div style="text-align: center; padding: 60px; background: white; border-radius: 12px; border: 2px dashed #e2e8f0;"><div style="font-size: 48px; margin-bottom: 16px;">🎯</div><h3 style="margin: 0 0 8px 0; color: #475569;">מושלם!</h3><p style="margin: 0; color: #94a3b8;">לא הפסדת נקודות בגלל החלטות הרכב</p></div>';
        container.innerHTML = html;
        return;
    }
    
    // Detailed analysis - COMPACT VERSION
    html += `
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
            <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 12px 16px; border-bottom: 2px solid #e2e8f0;">
                <h3 style="margin: 0; font-size: 16px; color: #0f172a; font-weight: 800;">📊 פירוט לפי מחזור (רק מחזורים עם טעויות)</h3>
            </div>
            <div style="padding: 12px; max-height: 600px; overflow-y: auto;">
    `;
    
    // Sort by GW ascending (most recent first)
    gwAnalysis.sort((a, b) => b.gw - a.gw).forEach((analysis, idx) => {
        // Find players who should have started but were benched
        const benchedHighScorers = analysis.bench
            .filter(p => {
                const gwData = p.history?.find(h => h.round === analysis.gw);
                return gwData && gwData.total_points > 0;
            })
            .sort((a, b) => {
                const aGwData = a.history?.find(h => h.round === analysis.gw);
                const bGwData = b.history?.find(h => h.round === analysis.gw);
                return (bGwData?.total_points || 0) - (aGwData?.total_points || 0);
            });
        
        // Find starters who underperformed
        const underperformers = analysis.starters
            .map(p => {
                const gwData = p.history?.find(h => h.round === analysis.gw);
                return { player: p, points: gwData?.total_points || 0 };
            })
            .sort((a, b) => a.points - b.points)
            .slice(0, benchedHighScorers.length);
        
        html += `
            <div style="background: ${idx % 2 === 0 ? '#fafafa' : 'white'}; padding: 12px; border-radius: 8px; margin-bottom: 10px; border: 1px solid ${analysis.pointsLost > 5 ? '#fca5a5' : '#e2e8f0'};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 4px 12px; border-radius: 8px; font-weight: 800; font-size: 13px;">מחזור ${analysis.gw}</span>
                    <div style="text-align: left;">
                        <span style="font-size: 10px; color: #64748b; font-weight: 600;">💔 הפסד: </span>
                        <span style="font-size: 20px; font-weight: 900; color: #ef4444;">-${analysis.pointsLost.toFixed(1)}</span>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; padding: 8px; background: #f8fafc; border-radius: 6px;">
                    <div style="text-align: center;">
                        <div style="font-size: 10px; color: #64748b; margin-bottom: 2px; font-weight: 600;">ההרכב שבחרת</div>
                        <div style="font-size: 18px; font-weight: 800; color: #475569;">${analysis.startersPoints.toFixed(1)}</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 10px; color: #10b981; margin-bottom: 2px; font-weight: 600;">הרכב אופטימלי</div>
                        <div style="font-size: 18px; font-weight: 800; color: #10b981;">${analysis.optimalPoints.toFixed(1)}</div>
                    </div>
                </div>
                
                ${benchedHighScorers.length > 0 ? `
                    <div style="background: white; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #0f172a; font-weight: 700;">⚠️ טעויות:</h4>
                        ${benchedHighScorers.map((benchPlayer, i) => {
                            const benchGwData = benchPlayer.history?.find(h => h.round === analysis.gw);
                            const benchPoints = benchGwData?.total_points || 0;
                            const benchMinutes = benchGwData?.minutes || 0;
                            
                            const replacedPlayer = underperformers[i]?.player;
                            const replacedPoints = underperformers[i]?.points || 0;
                            const replacedGwData = replacedPlayer?.history?.find(h => h.round === analysis.gw);
                            const replacedMinutes = replacedGwData?.minutes || 0;
                            
                            const pointsDiff = benchPoints - replacedPoints;
                            
                            return `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; margin-bottom: 6px; background: #fef2f2; border-radius: 6px; border-left: 3px solid #ef4444; font-size: 11px;">
                                    <div style="flex: 1;">
                                        <span style="font-weight: 700; color: #ef4444;">${benchPlayer.web_name}</span>
                                        <span style="color: #64748b;"> (${benchPoints.toFixed(1)}נק')</span>
                                        </div>
                                    <div style="color: #94a3b8; padding: 0 6px;">↔️</div>
                                    <div style="flex: 1; text-align: left;">
                                        <span style="font-weight: 600; color: #64748b;">${replacedPlayer?.web_name || 'N/A'}</span>
                                        <span style="color: #94a3b8;"> (${replacedPoints.toFixed(1)}נק')</span>
                                        </div>
                                    <div style="background: #fee2e2; padding: 4px 8px; border-radius: 6px; margin-right: 8px;">
                                        <span style="font-size: 14px; font-weight: 900; color: #dc2626;">-${pointsDiff.toFixed(1)}</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// ============================================
// MY TEAM & LINEUP MANAGEMENT
// ============================================

function populateMyTeamSelector() {
    console.log("📋 populateMyTeamSelector() called");
    const select = document.getElementById('myTeamSelect');
    if (!select) {
        console.error("❌ myTeamSelect element not found!");
        return;
    }
    select.innerHTML = '<option value="">-- בחר קבוצה --</option>';
    const entries = state.draft.details?.league_entries || [];
    entries.forEach(entry => {
        if (!entry.entry_name) return;
        const option = document.createElement('option');
        option.value = entry.id;
        option.textContent = `${entry.player_first_name} ${entry.player_last_name} (${entry.entry_name})`;
        select.appendChild(option);
    });
    
    // Set the selected value to myTeamId (which should be Amit Zahy by default)
    if (state.draft.myTeamId) {
        select.value = state.draft.myTeamId;
        console.log("✅ Selected team:", state.draft.myTeamId);
    } else {
        console.warn("⚠️ No myTeamId set");
    }
}

function setMyTeam(teamId) {
    if (!teamId) return;
    state.draft.myTeamId = parseInt(teamId);
    localStorage.setItem('draft_my_team_id', teamId);
    renderMyLineup(teamId);
    renderRecommendations();
    renderNextRivalAnalysis(); // Update Rival Analysis
    renderAllTeamsTrendChart(null, 'cumulative', [teamId]); // Default to showing my team
    showToast('הקבוצה עודכנה', 'הנתונים וההמלצות עודכנו בהתאם לקבוצה שנבחרה', 'success');
}

function findMyTeam() {
    // Try from local storage first
    const storedId = localStorage.getItem('draft_my_team_id');
    if (storedId) {
        const entry = state.draft.details?.league_entries.find(e => e.id == storedId);
        if (entry) {
            state.draft.myTeamId = entry.id;
            return { id: entry.id, name: entry.entry_name };
        }
    }
    
    // Default to Amit Zahy if not found in localStorage
    const amitEntry = state.draft.details?.league_entries.find(e => 
        e.player_first_name === 'Amit' && e.player_last_name === 'Zahy'
    );
    
    if (amitEntry) {
        state.draft.myTeamId = amitEntry.id;
        localStorage.setItem('draft_my_team_id', amitEntry.id); // Save for next time
        return { id: amitEntry.id, name: amitEntry.entry_name };
    }
    
    return null;
}

function renderLineupStats(stats, diffs = null) {
    const renderBox = (label, value, colorClass, diffVal) => {
        let diffHtml = '';
        if (diffs && diffVal !== undefined) {
            const isPos = diffVal >= 0;
            const sign = isPos ? '+' : '';
            const displayVal = typeof diffVal === 'number' ? diffVal.toFixed(1) : diffVal;
            diffHtml = `<div style="font-size: 10px; color: ${isPos ? '#10b981' : '#ef4444'}; font-weight: 700; margin-top: 2px;">
                ${sign}${displayVal}
            </div>`;
        }
        return `
            <div style="text-align: center; padding: 10px; background: #fff; border-radius: 12px; border: 1px solid #f1f5f9; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div style="font-size: 11px; color: #64748b; font-weight: 700; margin-bottom: 4px;">${label}</div>
                <div style="font-size: 20px; font-weight: 800; color: ${colorClass}; line-height: 1;">${typeof value === 'number' ? value.toFixed(1) : value}</div>
                ${diffHtml}
            </div>
        `;
    };

    return `
        <div class="lineup-stats-card" style="margin-bottom: 20px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border: 2px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
                ${renderBox('צפי (GW הבא)', stats.predicted, '#3b82f6', diffs?.predicted)}
                ${renderBox('נקודות (GW אחרון)', stats.lastGw, '#10b981', diffs?.lastGw)}
                ${renderBox('PPG/90', stats.ppg90, '#f59e0b', diffs?.ppg90)}
                ${renderBox('כושר (Form)', stats.form, '#8b5cf6', diffs?.form)}
            </div>
            ${diffs ? '<div style="text-align: center; margin-top: 12px; font-size: 11px; color: #64748b; font-weight: 600;">📊 השוואה להרכב הנוכחי</div>' : ''}
        </div>
    `;
}

function renderMyLineup(teamId) {
    console.log("👥 renderMyLineup() called with teamId:", teamId);
    const container = document.getElementById('myLineupContainer');
    if (!container) {
        console.error("❌ myLineupContainer not found!");
        return;
    }
    
    if (!teamId) {
        container.innerHTML = '<p style="text-align:center; padding: 20px;">לא נבחרה קבוצה. אנא בחר קבוצה מהתפריט למעלה.</p>';
        return;
    }

    // Try both as integer and as string to handle any type mismatches
    let rosterIds = state.draft.rostersByEntryId.get(parseInt(teamId));
    if (!rosterIds) {
        rosterIds = state.draft.rostersByEntryId.get(teamId);
    }
    if (!rosterIds) {
        rosterIds = state.draft.rostersByEntryId.get(String(teamId));
    }
    rosterIds = rosterIds || [];
    
    console.log("📋 Roster IDs for team", teamId, "(type:", typeof teamId, "):", rosterIds.length, "players");
    console.log("🗺️ Total rosters in map:", state.draft.rostersByEntryId.size);
    console.log("🔑 Map keys:", Array.from(state.draft.rostersByEntryId.keys()));
    console.log("🎯 Roster data:", rosterIds);
    
    // DEBUG: Check why roster might be empty
    if (!rosterIds.length) {
        console.warn(`⚠️ renderMyLineup: Roster for team ${teamId} is empty. Rosters map size: ${state.draft.rostersByEntryId.size}`);
        
        // Try to re-fetch roster if it's the user's team and empty
        if(parseInt(teamId) === state.draft.myTeamId) {
             container.innerHTML = `
                <div style="text-align:center; padding: 20px;">
                    <p>מנסה לטעון את הסגל מחדש...</p>
                    <div class="mini-loader" style="display:inline-block;"></div>
                </div>`;
             // We could trigger a re-fetch here but avoid infinite loops.
             // For now just show better error.
        }
        
        container.innerHTML = `
            <div style="text-align:center; padding: 30px;">
                <div class="mini-loader" style="display: inline-block; margin-bottom: 12px;"></div>
                <h3 style="color: #64748b; margin: 0 0 8px 0; font-size: 16px;">טוען סגל...</h3>
                <p style="margin: 0; color: #94a3b8; font-size: 13px;">הנתונים מתעדכנים, אנא המתן.</p>
                <button onclick="loadDraftDataInBackground().then(() => renderMyLineup(${teamId}))" style="margin-top: 16px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px;">
                    🔄 נסה לטעון שוב
                </button>
            </div>`;
        return;
    }

    let starters = [];
    let bench = [];
    
    const lineupData = state.draft.lineupsByEntryId ? state.draft.lineupsByEntryId.get(parseInt(teamId)) : null;
    const processedById = getProcessedByElementId();
    
    console.log("📋 Lineup data:", lineupData);
    console.log("🗺️ ProcessedById map size:", processedById.size);

    if (lineupData && lineupData.starting && lineupData.starting.length > 0) {
        console.log("✅ Using lineup data from API");
        starters = lineupData.starting.map(id => processedById.get(id)).filter(Boolean);
        bench = lineupData.bench.map(id => processedById.get(id)).filter(Boolean);
        console.log("   Starters:", starters.length, "Bench:", bench.length);
    } else {
        console.log("⚠️ No lineup data, using roster fallback");
        const roster = rosterIds.map(id => {
            const player = processedById.get(id);
            if (!player) {
                console.warn(`   ❌ Player not found for ID: ${id}`);
            }
            return player;
        }).filter(Boolean);
        console.log("   Total roster players found:", roster.length, "out of", rosterIds.length);
        starters = roster.slice(0, 11);
        bench = roster.slice(11);
    }

    const calculateStats = (players) => {
        return {
            predicted: players.reduce((sum, p) => sum + (parseFloat(p.predicted_points_1_gw) || 0), 0),
            lastGw: players.reduce((sum, p) => sum + (p.event_points || 0), 0), 
            ppg90: players.reduce((sum, p) => sum + (parseFloat(p.points_per_game_90) || 0), 0) / (players.length || 1),
            form: players.reduce((sum, p) => sum + (parseFloat(p.form) || 0), 0) / (players.length || 1)
        };
    };

    const stats = calculateStats(starters);
    
        container.innerHTML = '';
        
        const controls = document.createElement('div');
        controls.className = 'draft-lineup-controls';
    controls.style.cssText = 'display: flex; justify-content: center; gap: 10px; margin-bottom: 15px;';
        controls.innerHTML = `
        <button id="btnShowMyLineup" class="lineup-toggle active" style="padding: 8px 16px; border-radius: 8px; border: none; background: #3b82f6; color: white; font-weight: 600; cursor: pointer;" onclick="renderMyLineup('${teamId}')">ההרכב שלי</button>
        <button id="btnShowRecLineup" class="lineup-toggle" style="padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: white; color: #64748b; font-weight: 600; cursor: pointer;" onclick="showRecommendedLineup()">הרכב אופטימלי</button>
        `;
        container.appendChild(controls);

        const statsDiv = document.createElement('div');
        statsDiv.innerHTML = renderLineupStats(stats);
        container.appendChild(statsDiv);

        const pitchWrapper = document.createElement('div');
        pitchWrapper.className = 'pitch-wrapper';
        container.appendChild(pitchWrapper);

        console.log("🎨 About to render pitch with starters:", starters.length, "bench:", bench.length);
        
        if (starters.length === 0) {
            console.error("❌ No starters to render! Roster IDs:", rosterIds);
            container.innerHTML += '<div style="text-align:center; padding: 20px; color: red;">שגיאה: לא נמצאו שחקנים להצגה</div>';
        } else {
        renderPitch(pitchWrapper, starters.map(p => p.id), true, bench.map(p => p.id));
    }
        
        console.log("✅ renderMyLineup() completed! Starters:", starters.length, "Bench:", bench.length);
}

function showRecommendedLineup() {
    const myTeamId = state.draft.myTeamId;
    if (!myTeamId) {
        showToast('שגיאה', 'אנא בחר את הקבוצה שלך קודם', 'error');
        return;
    }
    
    const rosterIds = state.draft.rostersByEntryId.get(myTeamId);
    if (!rosterIds || rosterIds.length === 0) {
        showToast('שגיאה', 'לא נמצא סגל לקבוצה זו', 'error');
        return;
    }
    
    const processedById = getProcessedByElementId();
    const squad = rosterIds.map(id => processedById.get(id)).filter(Boolean);
    
    // Current Stats for Diff
    const currentLineupObj = state.draft.lineupsByEntryId.get(myTeamId);
    let currentStarting = [];
    if (currentLineupObj && currentLineupObj.starting) {
        currentStarting = currentLineupObj.starting.map(id => processedById.get(id)).filter(Boolean);
    } else {
        currentStarting = squad.slice(0, 11); 
    }
    
    const calcStats = (players) => ({
        predicted: players.reduce((sum, p) => sum + (parseFloat(p.predicted_points_1_gw) || 0), 0),
        lastGw: players.reduce((sum, p) => sum + (p.event_points || 0), 0),
            ppg90: players.reduce((sum, p) => sum + (parseFloat(p.points_per_game_90) || 0), 0) / (players.length || 1),
            form: players.reduce((sum, p) => sum + (parseFloat(p.form) || 0), 0) / (players.length || 1)
    });
    
    const currentStats = calcStats(currentStarting);

    // Optimization
    const gkps = squad.filter(p => p.element_type === 1).sort((a,b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0));
    const defs = squad.filter(p => p.element_type === 2).sort((a,b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0));
    const mids = squad.filter(p => p.element_type === 3).sort((a,b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0));
    const fwds = squad.filter(p => p.element_type === 4).sort((a,b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0));
    
    const startingXI = [];
    const bench = [];
    
    // GK
    if (gkps.length > 0) { startingXI.push(gkps[0]); for(let i=1; i<gkps.length; i++) bench.push(gkps[i]); }
    
    // Outfield (Min 3 DEF, Min 1 FWD)
    const selectedOutfield = [];
    const remainingOutfield = [];
    
    const bestDefs = defs.slice(0, 3);
    bestDefs.forEach(p => selectedOutfield.push(p));
    const otherDefs = defs.slice(3);
    
    let bestFwds = []; 
    let otherFwds = [...fwds];
    if (fwds.length > 0) {
        bestFwds = fwds.slice(0, 1);
        bestFwds.forEach(p => selectedOutfield.push(p));
        otherFwds = fwds.slice(1);
    }
    
    const pool = [...otherDefs, ...mids, ...otherFwds].sort((a,b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0));
    const slotsNeeded = 10 - selectedOutfield.length;
    for(let i=0; i<pool.length; i++) {
        if (i < slotsNeeded) selectedOutfield.push(pool[i]);
        else remainingOutfield.push(pool[i]);
    }
    
    startingXI.push(...selectedOutfield);
    bench.push(...remainingOutfield);
    
    const recStats = calcStats(startingXI);

    const container = document.getElementById('myLineupContainer');
    if (container) {
        container.innerHTML = '';
        const controls = document.createElement('div');
        controls.className = 'draft-lineup-controls';
        controls.style.cssText = 'display: flex; justify-content: center; gap: 10px; margin-bottom: 15px;';
        controls.innerHTML = `
            <button id="btnShowMyLineup" class="lineup-toggle" style="padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: white; color: #64748b; font-weight: 600; cursor: pointer;" onclick="renderMyLineup('${myTeamId}')">ההרכב שלי</button>
            <button id="btnShowRecLineup" class="lineup-toggle active" style="padding: 8px 16px; border-radius: 8px; border: none; background: #3b82f6; color: white; font-weight: 600; cursor: pointer;" onclick="showRecommendedLineup()">הרכב אופטימלי</button>
        `;
        container.appendChild(controls);

        // Diffs
        const diffs = {
            predicted: recStats.predicted - currentStats.predicted,
            lastGw: recStats.lastGw - currentStats.lastGw,
            ppg90: recStats.ppg90 - currentStats.ppg90,
            form: recStats.form - currentStats.form
        };
        
        const statsDiv = document.createElement('div');
        statsDiv.innerHTML = renderLineupStats(recStats, diffs);
        container.appendChild(statsDiv);
        
        const pitchWrapper = document.createElement('div');
        pitchWrapper.className = 'pitch-wrapper';
        container.appendChild(pitchWrapper);
        
        renderPitch(pitchWrapper, startingXI.map(p => p.id), true, bench.map(p => p.id));
        
        showToast('הרכב מומלץ הוצג', 'התצוגה עודכנה להרכב האופטימלי', 'success');
    }
}

// ============================================
// RIVAL ANALYSIS
// ============================================

function getNextOpponent(myEntryId) {
    const details = state.draft.details;
    if (!details || !details.matches) {
        console.log('❌ getNextOpponent: No details or matches');
        return null;
    }
    
    const currentEvent = details.league?.current_event || 1;
    console.log('🔍 getNextOpponent: currentEvent =', currentEvent, 'myEntryId =', myEntryId);
    console.log('🔍 Total matches:', details.matches.length);
    
    // First, try to find matches in current or future gameweeks
    const allMyMatches = details.matches.filter(m => 
        (m.league_entry_1 === myEntryId || m.league_entry_2 === myEntryId)
    );
    console.log('🔍 Matches involving my team:', allMyMatches.length);
    
    // Find next unfinished match (current or future)
    const futureMatches = allMyMatches.filter(m => 
        m.event >= currentEvent && 
        !m.finished
    ).sort((a,b) => a.event - b.event);
    
    console.log('🔍 Future unfinished matches:', futureMatches.length);
    if (futureMatches.length > 0) {
        console.log('✅ Found next match:', futureMatches[0]);
        const nextMatch = futureMatches[0];
        const isEntry1 = nextMatch.league_entry_1 === myEntryId;
        const opponentId = isEntry1 ? nextMatch.league_entry_2 : nextMatch.league_entry_1;
        return {
            match: nextMatch,
            opponentId: opponentId,
            opponentName: state.draft.entryIdToTeamName.get(opponentId) || 'Unknown',
            isHome: isEntry1,
            isLastMatch: false
        };
    }
    
    // If no future matches, try to find current week match even if finished (for debugging)
    const currentWeekMatch = allMyMatches.find(m => m.event === currentEvent);
    if (currentWeekMatch) {
        console.log('⚠️ Found current week match (may be finished):', currentWeekMatch);
    }
    
    console.log('❌ No future matches found');
    return null;
}

// Helper function to get team logo emoji based on team name
function getTeamLogo(teamName) {
    const logos = {
        'Amit United': '🦁',
        'The Gingers': '🦊',
        'Hamalik': '👑',
        'PSV Nivey': '⚡',
        'Francis Bodega FC': '🍷',
        'AEK Shemesh': '☀️',
        'Merkaz Klita': '🏰',
        'Torpedo Eshel': '🚀',
        'Los chicos': '🌟'
    };
    
    // Try to find exact match or partial match
    for (const [name, logo] of Object.entries(logos)) {
        if (teamName && teamName.includes(name)) {
            return logo;
        }
    }
    return '⚽'; // Default
}

// Helper function to get player photo URL
function getPlayerPhotoUrl(playerCode) {
    if (!playerCode) return config.urls.missingPlayerImage;
    return `https://resources.premierleague.com/premierleague/photos/players/250x250/p${playerCode}.png`;
}

function updateMyTeamForRival(newMyTeamId) {
    // Update the selected team temporarily for rival analysis
    const oldTeamId = state.draft.myTeamId;
    state.draft.myTeamId = parseInt(newMyTeamId);
    
    // Re-render with the new "my team"
    renderNextRivalAnalysis();
    
    // Note: This doesn't permanently change the team selection, just for this analysis
}

function renderNextRivalAnalysis(selectedOpponentId = null) {
    const container = document.getElementById('rivalAnalysisContainer');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;"><div class="spinner"></div> מחשב סיכויים ומנתח הרכבים...</div>';
    
    try {
        const myTeam = findMyTeam();
        if (!myTeam) {
            container.innerHTML = '<div class="alert alert-warning">לא נבחרה קבוצה. אנא בחר את הקבוצה שלך בתפריט ההגדרות.</div>';
        return;
    }

        // If opponent is manually selected, use it; otherwise get next opponent
        let opponentData;
        if (selectedOpponentId) {
            const entries = state.draft.details?.league_entries || [];
            const oppEntry = entries.find(e => String(e.id) === String(selectedOpponentId));
            if (oppEntry) {
                opponentData = {
                    opponentId: oppEntry.id,
                    opponentName: oppEntry.entry_name,
                    match: { event: state.draft.details?.league?.current_event || 0 },
                    isLastMatch: false,
                    isManual: true
                };
            }
        }
        
        if (!opponentData) {
            opponentData = getNextOpponent(myTeam.id);
        }
        
        if (!opponentData) {
            // If no next match found, show all teams for manual selection
            const entries = state.draft.details?.league_entries || [];
            const otherTeams = entries.filter(e => e.id !== myTeam.id);
            
            if (otherTeams.length > 0) {
                // Show team selector
                const teamOptions = otherTeams.map(e => `
                    <button onclick="renderNextRivalAnalysis(${e.id})" style="padding: 12px 24px; margin: 8px; border-radius: 12px; border: 2px solid #e2e8f0; background: white; color: #475569; font-weight: 700; cursor: pointer; transition: all 0.2s; font-size: 15px;">
                        ${getTeamLogo(e.entry_name)} ${e.entry_name}
                    </button>
                `).join('');
                
                container.innerHTML = `
                    <div style="text-align:center; padding:30px; border: 2px dashed #cbd5e1; border-radius: 12px; background: #f8fafc;">
                        <div style="font-size:40px; margin-bottom:10px;">🎯</div>
                        <h3 style="margin:0 0 20px 0; color:#475569;">בחר יריב להשוואה</h3>
                        <p style="margin:0 0 20px 0; color:#64748b;">לא נמצא משחק מתוכנן. בחר קבוצה להשוואה:</p>
                        <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;">
                            ${teamOptions}
                        </div>
                    </div>`;
            } else {
                container.innerHTML = `
                    <div class="alert alert-info" style="text-align:center; padding:30px; border: 2px dashed #cbd5e1; border-radius: 12px; background: #f8fafc;">
                        <div style="font-size:40px; margin-bottom:10px;">🏖️</div>
                        <h3 style="margin:0; color:#475569;">אין משחקים קרובים</h3>
                        <p style="margin:5px 0 0; color:#64748b;">העונה הסתיימה או שאין משחקים מתוכננים בלוח השנה.</p>
                    </div>`;
            }
            return;
        }
        
        const myRosterIds = state.draft.rostersByEntryId.get(myTeam.id) || [];
        const oppRosterIds = state.draft.rostersByEntryId.get(opponentData.opponentId) || [];
        const processedById = getProcessedByElementId();
        const mySquad = myRosterIds.map(id => processedById.get(id)).filter(Boolean);
        const oppSquad = oppRosterIds.map(id => processedById.get(id)).filter(Boolean);
        
        // Calculate stats using only top 11 players for xPts
        const calcStats = (squad) => {
            const top11 = squad
                .sort((a, b) => (b.predicted_points_1_gw || 0) - (a.predicted_points_1_gw || 0))
                .slice(0, 11);
            
            const totalXPts = top11.reduce((sum, p) => sum + (parseFloat(p.predicted_points_1_gw) || 0), 0);
            const totalXGI = squad.reduce((sum, p) => sum + (parseFloat(p.expected_goal_involvements) || 0), 0);
            const totalForm = squad.reduce((sum, p) => sum + (parseFloat(p.form) || 0), 0);
            const totalGoals = squad.reduce((sum, p) => sum + (parseInt(p.goals_scored) || 0), 0);
            const totalAssists = squad.reduce((sum, p) => sum + (parseInt(p.assists) || 0), 0);
            const totalCleanSheets = squad.reduce((sum, p) => sum + (parseInt(p.clean_sheets) || 0), 0);
            return { xPts: totalXPts, xGI: totalXGI, form: totalForm, goals: totalGoals, assists: totalAssists, cleanSheets: totalCleanSheets };
        };
        
        const myStats = calcStats(mySquad);
        const oppStats = calcStats(oppSquad);
        
        // Calculate win probability using ADVANCED algorithm
        const winProbResult = calculateAdvancedWinProbability(
            myTeam.id,
            opponentData.opponentId,
            myRosterIds,
            oppRosterIds,
            processedById
        );
        const myWinProb = winProbResult.winProb1;
        const oppWinProb = winProbResult.winProb2;
        
        // Get team logos
        const myLogo = getTeamLogo(myTeam.name);
        const oppLogo = getTeamLogo(opponentData.opponentName);
        
        // Create team selectors
        const entries = state.draft.details?.league_entries || [];
        const opponentSelector = `
            <div class="rival-selector-container" style="display: flex; justify-content: center; align-items: center; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; background: white; padding: 15px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                    <label style="font-size: 12px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.5px;">הקבוצה שלי</label>
                    <select id="rivalMyTeamSelect" onchange="updateMyTeamForRival(this.value)" style="padding: 8px 12px; border-radius: 8px; border: 2px solid #e0e7ff; font-size: 14px; font-weight: 600; color: #1e293b; cursor: pointer; background: #f8fafc; min-width: 160px; outline: none;">
                        ${entries.map(e => `
                            <option value="${e.id}" ${String(e.id) === String(myTeam.id) ? 'selected' : ''}>
                                ${e.entry_name}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <div style="font-size: 24px; color: #94a3b8; margin-top: 18px;">⚡</div>
                
                <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                    <label style="font-size: 12px; font-weight: 700; color: #ef4444; text-transform: uppercase; letter-spacing: 0.5px;">היריב</label>
                    <select id="rivalOpponentSelect" onchange="renderNextRivalAnalysis(this.value)" style="padding: 8px 12px; border-radius: 8px; border: 2px solid #fee2e2; font-size: 14px; font-weight: 600; color: #1e293b; cursor: pointer; background: #fff1f2; min-width: 160px; outline: none;">
                        ${entries.filter(e => e.id !== myTeam.id).map(e => `
                            <option value="${e.id}" ${String(e.id) === String(opponentData.opponentId) ? 'selected' : ''}>
                                ${e.entry_name}
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>
        `;
        
        // Match Title
        const matchTitle = opponentData.isManual ? 
            `<div style="text-align: center; margin-bottom: 15px; display: flex; align-items: center; justify-content: center; gap: 8px; color: #6366f1; font-weight: 700; font-size: 14px; background: #e0e7ff; padding: 8px 16px; border-radius: 20px; display: inline-flex;">
                <span>🔍</span> ניתוח מותאם אישית
            </div>` :
            `<div style="text-align: center; margin-bottom: 15px; display: flex; align-items: center; justify-content: center; gap: 8px; color: #0284c7; font-weight: 700; font-size: 14px; background: #e0f2fe; padding: 8px 16px; border-radius: 20px; display: inline-flex;">
                <span>🔜</span> המשחק הבא שלך (GW${opponentData.match.event})
            </div>`;
        
        // Main Comparison Card
        let html = `
            <div style="text-align: center;">${matchTitle}</div>
            ${opponentSelector}
            
            <div class="rival-header" style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 30px; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.4); margin-bottom: 24px; color: white; position: relative; overflow: hidden;">
                <!-- Background Pattern -->
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: radial-gradient(circle at 20% 150%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% -50%, rgba(255,255,255,0.15) 0%, transparent 50%); pointer-events: none;"></div>
                
                <div style="position: relative; z-index: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center; max-width: 600px; margin: 0 auto;">
                        <!-- My Team -->
                        <div style="text-align: center; flex: 1;">
                            <div style="font-size: 56px; margin-bottom: 10px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2)); transition: transform 0.3s ease;">${myLogo}</div>
                            <div style="font-weight: 800; font-size: 18px; margin-bottom: 8px; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${myTeam.name}</div>
                            <div style="display: inline-block; background: rgba(255,255,255,0.2); backdrop-filter: blur(8px); padding: 6px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.3); font-weight: 700;">
                                ${myStats.xPts.toFixed(1)} xPts
                        </div>
                    </div>
                    
                        <!-- VS & Prob -->
                        <div style="text-align: center; padding: 0 20px; flex: 0 0 180px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                            <div style="font-weight: 900; font-size: 32px; margin-bottom: 15px; opacity: 0.9;">VS</div>
                            
                            <!-- Win Prob Circle/Bar - INCREASED BY 30% -->
                            <div style="position: relative; height: 10.4px; background: rgba(0,0,0,0.3); border-radius: 5.2px; overflow: hidden; margin-bottom: 10px; width: 100%;">
                                <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${myWinProb}%; background: #34d399; border-radius: 5.2px;"></div>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 15.6px; font-weight: 700; color: rgba(255,255,255,0.9); width: 100%;">
                                <span>${myWinProb.toFixed(0)}%</span>
                                <span>${oppWinProb.toFixed(0)}%</span>
                            </div>
                        </div>
                        
                        <!-- Opponent -->
                        <div style="text-align: center; flex: 1;">
                            <div style="font-size: 56px; margin-bottom: 10px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.2)); transition: transform 0.3s ease;">${oppLogo}</div>
                            <div style="font-weight: 800; font-size: 18px; margin-bottom: 8px; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">${opponentData.opponentName}</div>
                            <div style="display: inline-block; background: rgba(255,255,255,0.2); backdrop-filter: blur(8px); padding: 6px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.3); font-weight: 700;">
                                ${oppStats.xPts.toFixed(1)} xPts
                            </div>
                        </div>
                                    </div>
                        </div>
                    </div>
                `;
        
        // Helper function to determine color (green for better, red for worse)
        const getComparisonColor = (myVal, oppVal, isHigherBetter = true) => {
            if (myVal > oppVal) return isHigherBetter ? '#10b981' : '#ef4444'; // Green if better, red if worse
            if (myVal < oppVal) return isHigherBetter ? '#ef4444' : '#10b981'; // Red if worse, green if better
            return '#64748b'; // Gray if equal
        };
        
        // Compact Analysis Grid
        html += `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; max-width: 1000px; margin: 0 auto;">
                <!-- Form Comparison -->
                <div style="background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; color: #64748b;">
                        <span style="font-size: 20px;">🔥</span>
                        <h3 style="margin: 0; font-size: 15px; font-weight: 700;">כושר נוכחי (Form)</h3>
                </div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: 800; color: ${getComparisonColor(myStats.form, oppStats.form)};">${myStats.form.toFixed(1)}</div>
                            <div style="font-size: 12px; color: #94a3b8;">שלך</div>
                                    </div>
                        <div style="padding-bottom: 8px; font-size: 12px; color: #cbd5e1;">VS</div>
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: 800; color: ${getComparisonColor(oppStats.form, myStats.form)};">${oppStats.form.toFixed(1)}</div>
                            <div style="font-size: 12px; color: #94a3b8;">יריב</div>
                                </div>
                            </div>
                    <div style="margin-top: 12px; height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden;">
                        <div style="width: ${(myStats.form / (myStats.form + oppStats.form || 1) * 100)}%; height: 100%; background: ${getComparisonColor(myStats.form, oppStats.form)};"></div>
                    </div>
                                    </div>

                <!-- Attack Potential (xGI) -->
                <div style="background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; color: #64748b;">
                        <span style="font-size: 20px;">⚡</span>
                        <h3 style="margin: 0; font-size: 15px; font-weight: 700;">פוטנציאל התקפי (xGI)</h3>
                        </div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: 800; color: ${getComparisonColor(myStats.xGI, oppStats.xGI)};">${myStats.xGI.toFixed(1)}</div>
                            <div style="font-size: 12px; color: #94a3b8;">שלך</div>
                        </div>
                        <div style="padding-bottom: 8px; font-size: 12px; color: #cbd5e1;">VS</div>
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: 800; color: ${getComparisonColor(oppStats.xGI, myStats.xGI)};">${oppStats.xGI.toFixed(1)}</div>
                            <div style="font-size: 12px; color: #94a3b8;">יריב</div>
                        </div>
                    </div>
                    <div style="margin-top: 12px; height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden;">
                        <div style="width: ${(myStats.xGI / (myStats.xGI + oppStats.xGI || 1) * 100)}%; height: 100%; background: ${getComparisonColor(myStats.xGI, oppStats.xGI)};"></div>
                </div>
                </div>

                <!-- Goals -->
                <div style="background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; color: #64748b;">
                        <span style="font-size: 20px;">⚽</span>
                        <h3 style="margin: 0; font-size: 15px; font-weight: 700;">שערים</h3>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: 800; color: ${getComparisonColor(myStats.goals, oppStats.goals)};">${myStats.goals}</div>
                            <div style="font-size: 12px; color: #94a3b8;">שלך</div>
                        </div>
                        <div style="padding-bottom: 8px; font-size: 12px; color: #cbd5e1;">VS</div>
                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: 800; color: ${getComparisonColor(oppStats.goals, myStats.goals)};">${oppStats.goals}</div>
                            <div style="font-size: 12px; color: #94a3b8;">יריב</div>
                        </div>
                    </div>
                    <div style="margin-top: 12px; height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden;">
                        <div style="width: ${(myStats.goals / (myStats.goals + oppStats.goals || 1) * 100)}%; height: 100%; background: ${getComparisonColor(myStats.goals, oppStats.goals)};"></div>
                                            </div>
                                        </div>

                <!-- Assists -->
                <div style="background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; color: #64748b;">
                        <span style="font-size: 20px;">🎯</span>
                        <h3 style="margin: 0; font-size: 15px; font-weight: 700;">בישולים</h3>
                                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: 800; color: ${getComparisonColor(myStats.assists, oppStats.assists)};">${myStats.assists}</div>
                            <div style="font-size: 12px; color: #94a3b8;">שלך</div>
                                        </div>
                        <div style="padding-bottom: 8px; font-size: 12px; color: #cbd5e1;">VS</div>
                                        <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: 800; color: ${getComparisonColor(oppStats.assists, myStats.assists)};">${oppStats.assists}</div>
                            <div style="font-size: 12px; color: #94a3b8;">יריב</div>
                                        </div>
                                        </div>
                    <div style="margin-top: 12px; height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden;">
                        <div style="width: ${(myStats.assists / (myStats.assists + oppStats.assists || 1) * 100)}%; height: 100%; background: ${getComparisonColor(myStats.assists, oppStats.assists)};"></div>
                                    </div>
                                </div>

                <!-- Clean Sheets -->
                <div style="background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; color: #64748b;">
                        <span style="font-size: 20px;">🧼</span>
                        <h3 style="margin: 0; font-size: 15px; font-weight: 700;">שערים נקיים</h3>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                    <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: 800; color: ${getComparisonColor(myStats.cleanSheets, oppStats.cleanSheets)};">${myStats.cleanSheets}</div>
                            <div style="font-size: 12px; color: #94a3b8;">שלך</div>
                        </div>
                        <div style="padding-bottom: 8px; font-size: 12px; color: #cbd5e1;">VS</div>
                    <div style="text-align: center;">
                            <div style="font-size: 24px; font-weight: 800; color: ${getComparisonColor(oppStats.cleanSheets, myStats.cleanSheets)};">${oppStats.cleanSheets}</div>
                            <div style="font-size: 12px; color: #94a3b8;">יריב</div>
                        </div>
                    </div>
                    <div style="margin-top: 12px; height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden;">
                        <div style="width: ${(myStats.cleanSheets / (myStats.cleanSheets + oppStats.cleanSheets || 1) * 100)}%; height: 100%; background: ${getComparisonColor(myStats.cleanSheets, oppStats.cleanSheets)};"></div>
                    </div>
                </div>
            </div>
        `;
        
        // 🗓️ FIXTURE & COUNTER-PICK ANALYSIS
        const easyFixturePlayers = oppSquad.filter(p => {
             const fixtures = getNextFixtures(p.team, 3);
             if (fixtures.length === 0) return false;
             const avgFDR = fixtures.reduce((sum, f) => sum + f.difficulty, 0) / fixtures.length;
             return avgFDR <= 2.8; // Threshold for easy
        });
        
        if (easyFixturePlayers.length > 0) {
            html += `
            <div style="background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); margin-top: 20px; max-width: 1000px; margin-left: auto; margin-right: auto;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; color: #15803d;">
                    <span style="font-size: 20px;">🗓️</span>
                    <h3 style="margin: 0; font-size: 15px; font-weight: 700;">ליריב יש משחקים קלים! הנה הזדמנויות נגד:</h3>
                </div>
                
                <div style="display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));">
            `;
            
            // Deduplicate players by team to avoid suggesting same free agents multiple times
            const teamsWithEasyFixtures = [...new Set(easyFixturePlayers.map(p => p.team))];
            
            teamsWithEasyFixtures.forEach(teamId => {
                 const rivalPlayer = easyFixturePlayers.find(p => p.team === teamId);
                 
                 // Find counter picks (Free Agents from same team)
                 const teamFreeAgents = state.allPlayersData[state.currentDataSource].processed
                    .filter(fa => fa.team === teamId && !state.draft.ownedElementIds.has(fa.id) && fa.minutes > 0)
                    .sort((a,b) => parseFloat(b.expected_goal_involvements || 0) - parseFloat(a.expected_goal_involvements || 0))
                    .slice(0, 1);
                 
                 const suggestion = teamFreeAgents.length > 0 ? teamFreeAgents[0] : null;
                 
                 html += `
                    <div style="display: flex; flex-direction: column; gap: 8px; background: #f0fdf4; padding: 12px; border-radius: 10px; border: 1px solid #bbf7d0;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: 700; color: #166534;">${rivalPlayer.web_name} (ו-${easyFixturePlayers.filter(p => p.team === teamId).length - 1} נוספים)</div>
                                <div style="font-size: 12px; color: #15803d;">לו"ז קל לקבוצה: ${state.teamsData[teamId]?.short_name || ''}</div>
                            </div>
                        </div>
                        ${suggestion ? `
                        <div style="display: flex; align-items: center; justify-content: space-between; background: white; padding: 8px 12px; border-radius: 8px; border: 1px solid #dcfce7; box-shadow: 0 2px 4px rgba(0,0,0,0.03); cursor: pointer;" onclick="document.getElementById('searchName').value='${suggestion.web_name}'; processChange(); showTab('players');">
                            <div>
                                <div style="font-size: 11px; color: #64748b;">אופציה פנויה מאותה קבוצה:</div>
                                <div style="font-weight: 700; color: #059669;">${suggestion.web_name}</div>
                            </div>
                            <span style="font-size: 11px; background: #ecfdf5; color: #047857; padding: 2px 6px; border-radius: 4px;">xGI ${parseFloat(suggestion.expected_goal_involvements || 0).toFixed(1)}</span>
                        </div>
                        ` : '<div style="font-size: 11px; color: #94a3b8; font-style: italic;">אין אופציות התקפיות פנויות</div>'}
                    </div>
                 `;
            });
            
            html += `</div></div>`;
        }
        
        // Find players from same Premier League team (overlaps)
        const teamGroups = {};
        [...mySquad, ...oppSquad].forEach(p => {
            if (!teamGroups[p.team]) {
                teamGroups[p.team] = { my: [], opp: [] };
            }
            if (mySquad.find(mp => mp.id === p.id)) {
                teamGroups[p.team].my.push(p);
            }
            if (oppSquad.find(op => op.id === p.id)) {
                teamGroups[p.team].opp.push(p);
            }
        });
        
        const overlaps = Object.entries(teamGroups).filter(([teamId, players]) => 
            players.my.length > 0 && players.opp.length > 0
        );
        
        if (overlaps.length > 0) {
            html += `
                <div style="margin-top: 32px; background: white; padding: 24px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <h3 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                        <span>⚔️</span> השוואת שחקנים מאותה קבוצה
                    </h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px;">
            `;
            
            overlaps.forEach(([teamId, players]) => {
                const teamName = state.teamsData[teamId]?.name || 'Unknown';
                const teamShortName = state.teamsData[teamId]?.short_name || '';
                
                html += `
                    <div style="background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0;">
                        <div style="font-weight: 700; color: #475569; margin-bottom: 12px; font-size: 14px;">${teamName} ${teamShortName ? `(${teamShortName})` : ''}</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div>
                                <div style="font-size: 11px; color: #64748b; margin-bottom: 6px; font-weight: 600;">שלך:</div>
                                ${players.my.map(p => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: white; border-radius: 6px; margin-bottom: 4px; border-left: 3px solid #3b82f6;">
                                        <span style="font-size: 12px; font-weight: 600; color: #0f172a;">${p.web_name}</span>
                                        <span style="font-size: 11px; color: #64748b;">${p.position_name}</span>
                                    </div>
                                `).join('')}
                            </div>
                            <div>
                                <div style="font-size: 11px; color: #64748b; margin-bottom: 6px; font-weight: 600;">יריב:</div>
                                ${players.opp.map(p => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: white; border-radius: 6px; margin-bottom: 4px; border-left: 3px solid #ef4444;">
                                        <span style="font-size: 12px; font-weight: 600; color: #0f172a;">${p.web_name}</span>
                                        <span style="font-size: 11px; color: #64748b;">${p.position_name}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
    } catch (err) {
        console.error('CRITICAL ERROR in renderNextRivalAnalysis:', err);
        container.innerHTML = `<div class="alert alert-danger">
            <strong>שגיאה בטעינת הנתונים:</strong><br>
            ${err.message}
        </div>`;
    }
}

// ============================================
// TREND CHART RESTORATION
// ============================================

window.renderAllTeamsTrendChart = function(teamAggregates, mode = 'cumulative', highlightTeamIds = []) {
    console.log("📈 renderAllTeamsTrendChart() called with mode:", mode, "highlightTeamIds:", highlightTeamIds);
    
    if (!state.draft.details) {
        console.error("❌ No draft details available for trend chart!");
        return;
    }
    
    // Define matches and entries FIRST
    const matches = state.draft.details?.matches || [];
    const entries = state.draft.details?.league_entries || [];
    
    // Determine which teams to highlight
    if (!Array.isArray(highlightTeamIds)) highlightTeamIds = highlightTeamIds ? [highlightTeamIds] : [];
    
    // If no teams are selected, default to the top 4 teams by total points from standings
    if (highlightTeamIds.length === 0) {
        // Use standings data if available (from state.draft._standingsData)
        if (state.draft._standingsData && state.draft._standingsData.length > 0) {
            // Sort by total points (descending) and take top 4
            const sortedStandings = [...state.draft._standingsData]
                .sort((a, b) => b.total - a.total)
                .slice(0, 4);
            
            // Map team names back to entry IDs
            highlightTeamIds = sortedStandings.map(s => {
                const entry = entries.find(e => e.entry_name === s.team);
                return entry ? String(entry.id) : null;
            }).filter(Boolean);
            
            console.log("📊 Top 4 teams by standings:", sortedStandings.map(s => `${s.team} (${s.total} pts)`));
        } else {
            // Fallback: Calculate total points from matches
            const teamPoints = [];
            entries.forEach(e => {
                let total = 0;
                matches.forEach(m => {
                    if (m.finished) {
                        if (String(m.league_entry_1) === String(e.id)) total += m.league_entry_1_points;
                        if (String(m.league_entry_2) === String(e.id)) total += m.league_entry_2_points;
                    }
                });
                teamPoints.push({ id: e.id, total });
            });
            
            // Sort descending and take top 4 IDs
            teamPoints.sort((a,b) => b.total - a.total);
            highlightTeamIds = teamPoints.slice(0, 4).map(t => String(t.id));
        }
    } else {
        highlightTeamIds = highlightTeamIds.map(id => String(id));
    }

    const container = document.getElementById('chart-progress');
    if (!container) {
        console.error("❌ chart-progress container not found!");
        return;
    }
    
    if (!matches.length || !entries.length) {
        container.innerHTML = '<div class="alert alert-info">אין נתונים להצגת גרף מגמה.</div>';
        return;
    }

    // Get current metric from state or select element or default to table_points
    let currentMetric = window.currentTrendState?.metric || document.getElementById('trendMetricSelect')?.value || 'table_points';

    container.innerHTML = `
        <div class="chart-controls-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <div class="chart-toggles" style="display: flex; background: #f1f5f9; border-radius: 8px; padding: 2px;">
                    <button onclick="updateTrendChartMode('cumulative')" class="${mode === 'cumulative' ? 'active' : ''}" style="padding: 6px 12px; border: none; background: ${mode === 'cumulative' ? 'white' : 'transparent'}; color: ${mode === 'cumulative' ? '#3b82f6' : '#64748b'}; font-weight: 600; border-radius: 6px; cursor: pointer;">מצטבר</button>
                    <button onclick="updateTrendChartMode('weekly')" class="${mode === 'weekly' ? 'active' : ''}" style="padding: 6px 12px; border: none; background: ${mode === 'weekly' ? 'white' : 'transparent'}; color: ${mode === 'weekly' ? '#3b82f6' : '#64748b'}; font-weight: 600; border-radius: 6px; cursor: pointer;">מחזורי</button>
                </div>
                
                <select id="trendMetricSelect" onchange="updateTrendChartMetric(this.value)" style="padding: 6px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 13px;">
                    <option value="points" ${currentMetric === 'points' ? 'selected' : ''}>נקודות</option>
                    <option value="table_points" ${currentMetric === 'table_points' ? 'selected' : ''}>נקודות בטבלה (נצחונות)</option>
                </select>
            </div>
        </div>

        <div class="trend-chart-grid" style="display: grid; grid-template-columns: 1fr 220px; gap: 20px; align-items: start;">
            <div class="chart-area" style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 10px; height: 450px; position: relative;">
            <canvas id="trendCanvas"></canvas>
            </div>
            <div class="team-selector-sidebar" style="background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; padding: 15px; max-height: 450px; overflow-y: auto;">
                <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">השוואת קבוצות</h4>
                <div class="team-checkbox-list" id="trendTeamList" style="display: flex; flex-direction: column; gap: 8px;"></div>
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0; text-align: center;">
                    <button onclick="selectAllTrendTeams()" style="font-size: 11px; color: #3b82f6; background: none; border: none; cursor: pointer;">בחר הכל</button>
                    <span style="color: #cbd5e1;">|</span>
                    <button onclick="clearAllTrendTeams()" style="font-size: 11px; color: #64748b; background: none; border: none; cursor: pointer;">נקה הכל</button>
                </div>
            </div>
        </div>
    `;

    const teamList = document.getElementById('trendTeamList');
    // 9 distinct colors - pastel versions for better visibility
    const colors = [
        '#3b82f6', // Blue
        '#ef4444', // Red
        '#10b981', // Green
        '#f59e0b', // Orange
        '#8b5cf6', // Purple
        '#ec4899', // Pink
        '#06b6d4', // Cyan
        '#84cc16', // Lime
        '#f97316'  // Deep Orange
    ];
    
    entries.forEach((e, index) => {
        const isChecked = highlightTeamIds.includes(String(e.id));
        const isMyTeam = String(e.id) === String(state.draft.myTeamId);
        const teamColor = isMyTeam ? '#0f172a' : colors[index % colors.length];
        const teamLogo = getTeamLogo(e.entry_name);
        
        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155; cursor: pointer; padding: 6px 8px; border-radius: 8px; transition: all 0.2s;';
        if (isChecked) {
            label.style.background = '#eef2ff';
            label.style.border = '1px solid #c7d2fe';
        }
        
        // Add color indicator circle
        const colorCircle = `<span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${teamColor}; border: 2px solid white; box-shadow: 0 0 0 1px #e2e8f0;"></span>`;
        
        label.innerHTML = `<input type="checkbox" value="${e.id}" ${isChecked ? 'checked' : ''} onchange="toggleTrendTeam('${e.id}')" style="accent-color: #3b82f6;">${colorCircle}<span style="font-size: 18px;">${teamLogo}</span><span style="${isMyTeam ? 'font-weight: 700; color: #0f172a;' : ''}">${isMyTeam ? '👤 ' : ''}${e.entry_name}</span>`;
        teamList.appendChild(label);
    });

    const historyMap = new Map(); 
    entries.forEach(e => historyMap.set(String(e.id), { name: e.entry_name, points: [], cumulative: [] }));
    const finishedMatches = matches.filter(m => m.finished).sort((a, b) => a.event - b.event);
    const maxGW = finishedMatches.length ? finishedMatches[finishedMatches.length-1].event : 0;
    entries.forEach(e => { for (let gw = 1; gw <= maxGW; gw++) historyMap.get(String(e.id)).points.push(0); });

    finishedMatches.forEach(m => {
        const gwIdx = m.event - 1;
        const id1 = String(m.league_entry_1), id2 = String(m.league_entry_2);
        let p1 = 0, p2 = 0;
        if (currentMetric === 'points') { p1 = m.league_entry_1_points; p2 = m.league_entry_2_points; }
        else {
            if (m.league_entry_1_points > m.league_entry_2_points) { p1 = 3; p2 = 0; }
            else if (m.league_entry_1_points < m.league_entry_2_points) { p1 = 0; p2 = 3; }
            else { p1 = 1; p2 = 1; }
        }
        if (historyMap.has(id1)) historyMap.get(id1).points[gwIdx] = p1;
        if (historyMap.has(id2)) historyMap.get(id2).points[gwIdx] = p2;
    });

    historyMap.forEach((data, id) => { let sum = 0; data.points.forEach(p => { sum += p; data.cumulative.push(sum); }); });

    const datasets = Array.from(historyMap.entries())
        .filter(([entryId, team]) => highlightTeamIds.includes(entryId))
        .map(([entryId, team], index) => {
            // 9 distinct colors matching the sidebar
            const chartColors = [
                '#3b82f6', // Blue
                '#ef4444', // Red
                '#10b981', // Green
                '#f59e0b', // Orange
                '#8b5cf6', // Purple
                '#ec4899', // Pink
                '#06b6d4', // Cyan
                '#84cc16', // Lime
                '#f97316'  // Deep Orange
            ];
            const isMyTeam = String(entryId) === String(state.draft.myTeamId);
            
            // Find the correct color index based on the entry's position in the full entries list
            const fullIndex = entries.findIndex(e => String(e.id) === entryId);
            const color = isMyTeam ? '#0f172a' : chartColors[fullIndex % chartColors.length];
            
            // Make lines thicker and more visible
            const lineWidth = isMyTeam ? 5 : 3.5;
            const pointSize = isMyTeam ? 6 : 4.5;
        
        return {
                label: team.name,
            data: mode === 'cumulative' ? team.cumulative : team.points,
            borderColor: color,
            backgroundColor: color,
                borderWidth: lineWidth,
                pointRadius: pointSize,
                pointHoverRadius: pointSize + 2,
                tension: 0.35, // Smooth curves for all modes
            fill: false,
                order: isMyTeam ? 100 : 1
        };
    });

    const labels = Array.from({length: maxGW}, (_, i) => `GW${i+1}`);
    const canvas = document.getElementById('trendCanvas');
    if (window.trendChartInstance) window.trendChartInstance.destroy();
    
    // Calculate max value for better Y-axis scaling
    const allValues = datasets.flatMap(d => d.data);
    const maxValue = Math.max(...allValues);
    const suggestedMax = Math.ceil(maxValue * 1.15); // Add 15% padding at top

    window.trendChartInstance = new Chart(canvas, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    position: 'top', 
                    align: 'center',
                    labels: { 
                        padding: 15, 
                        font: { size: 12, weight: '600' },
                        usePointStyle: true,
                        pointStyle: 'line'
                    } 
                },
                tooltip: { 
                    mode: 'index', 
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    padding: 12,
                    borderColor: 'rgba(59, 130, 246, 0.5)',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: suggestedMax,
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        font: { size: 12, weight: '600' },
                        color: '#64748b',
                        padding: 8
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 11, weight: '600' },
                        color: '#64748b'
                    }
                } 
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false }
        }
    });
    window.currentTrendState = { mode, highlightTeamIds, metric: currentMetric };
}

window.updateTrendChartMode = (mode) => {
    const current = window.currentTrendState || {};
    renderAllTeamsTrendChart(null, mode, current.highlightTeamIds);
}
window.updateTrendChartMetric = (metric) => {
    const current = window.currentTrendState || {};
    // Force re-render by clearing the container first
    const container = document.getElementById('chart-progress');
    if (container) {
        window.currentTrendState = { ...current, metric };
        renderAllTeamsTrendChart(null, current.mode || 'cumulative', current.highlightTeamIds);
    }
}
window.toggleTrendTeam = (teamId) => {
    const current = window.currentTrendState || {};
    let ids = current.highlightTeamIds || [];
    if (ids.includes(String(teamId))) ids = ids.filter(id => id !== String(teamId));
    else ids.push(String(teamId));
    renderAllTeamsTrendChart(null, current.mode, ids);
}
window.selectAllTrendTeams = () => {
    const ids = (state.draft.details?.league_entries || []).map(e => String(e.id));
    renderAllTeamsTrendChart(null, window.currentTrendState?.mode, ids);
}
window.clearAllTrendTeams = () => {
    const ids = state.draft.myTeamId ? [String(state.draft.myTeamId)] : [];
    renderAllTeamsTrendChart(null, window.currentTrendState?.mode, ids);
}

// Helper to call when draft data is loaded
function onDraftDataLoaded() {
    populateMyTeamSelector();
    const myTeam = findMyTeam();
    if(myTeam && state.draft.details) {
        renderAllTeamsTrendChart(null, 'cumulative', [String(myTeam.id)]);
    }
}

// Hook into existing loadDraftLeague (search for where it finishes and call onDraftDataLoaded)
// Or simply call populateMyTeamSelector inside loadDraftLeague if possible.

