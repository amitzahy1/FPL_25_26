/**
 * ============================================
 * 🎯 DRAFT FPL ML PREDICTOR (Decision Tree)
 * ============================================
 * 
 * Uses Decision Tree model trained on Draft-relevant features
 * NO price-based features!
 * Focus on: form, transfers, performance, ICT
 */

class DraftDecisionTreePredictor {
    constructor(modelData) {
        this.modelData = modelData;
        this.tree = modelData.tree;
        this.features = modelData.features;
        this.metrics = modelData.metrics;
        
        console.log('✅ Draft Decision Tree loaded!');
        console.log(`   Features: ${this.features.length} (NO price!)`);
        console.log(`   MAE: ${this.metrics.mae.toFixed(3)}, R²: ${this.metrics.r2.toFixed(3)}`);
    }
    
    /**
     * Extract features from player data
     */
    extractFeatures(player) {
        const features = {};
        
        // Calculate games played
        const gamesPlayed = Math.max((player.minutes || 0) / 90, 0.1);
        
        // Map player data to features
        features['GW'] = player.event || 0;
        features['element'] = player.id || 0;
        features['fixture'] = 0;  // Not available in current API
        features['opponent_team'] = player.opponent_team || 0;
        features['round'] = player.event || 0;
        features['was_home'] = player.was_home || 0;
        features['id'] = player.id || 0;
        
        // Basic stats
        features['minutes'] = player.minutes || 0;
        features['starts'] = player.starts || 0;
        features['total_points'] = player.total_points || 0;
        features['selected'] = parseFloat(player.selected_by_percent) || 0;
        
        // Form features (IMPORTANT!)
        // FPL's 'form' is already a rolling average, but we need to approximate form_3, form_5, form_10
        // Use points_per_game_90 as base, which is more accurate than form
        const baseForm = parseFloat(player.form) || 0;
        // Calculate points_per_game_90 if not available
        const pointsPerGame = parseFloat(player.points_per_game_90) || 
                             (player.minutes > 0 ? (player.total_points / (player.minutes / 90)) : 0) || 
                             baseForm;
        
        // Better approximation: use points_per_game_90 as form_5 (most recent form)
        // form_3 should be slightly higher (more recent = potentially better)
        // form_10 should be slightly lower (longer period = more stable)
        // Add some variance based on recent performance indicators
        const recentBoost = (player.transfers_in_event > 0) ? 0.1 : 0;  // Slight boost if being transferred in
        const form5Base = pointsPerGame || baseForm || 0;
        
        features['form_5'] = form5Base + recentBoost;
        features['form_3'] = (form5Base * 1.15) + recentBoost;  // Recent form slightly higher
        features['form_10'] = (form5Base * 0.85);  // Longer form slightly lower (more stable)
        features['form_trend'] = features['form_3'] - features['form_5'];  // Calculate trend
        
        // Transfers (IMPORTANT!)
        features['transfers_in'] = player.transfers_in_event || 0;
        features['transfers_out'] = player.transfers_out_event || 0;
        features['transfers_balance'] = (player.transfers_in_event || 0) - (player.transfers_out_event || 0);
        
        // ICT Index
        features['ict_index'] = parseFloat(player.ict_index) || 0;
        features['influence'] = parseFloat(player.influence) || 0;
        features['creativity'] = parseFloat(player.creativity) || 0;
        features['threat'] = parseFloat(player.threat) || 0;
        
        // Per-90 metrics
        features['influence_per_90'] = (parseFloat(player.influence) || 0) / gamesPlayed;
        features['creativity_per_90'] = (parseFloat(player.creativity) || 0) / gamesPlayed;
        features['threat_per_90'] = (parseFloat(player.threat) || 0) / gamesPlayed;
        
        // Attacking
        features['goals_scored'] = player.goals_scored || 0;
        features['assists'] = player.assists || 0;
        features['expected_goals'] = parseFloat(player.expected_goals) || 0;
        features['expected_assists'] = parseFloat(player.expected_assists) || 0;
        features['expected_goal_involvements'] = parseFloat(player.expected_goal_involvements) || 0;
        features['goals_per_90'] = (player.goals_scored || 0) / gamesPlayed;
        features['assists_per_90'] = (player.assists || 0) / gamesPlayed;
        features['xG_per_90'] = (parseFloat(player.expected_goals) || 0) / gamesPlayed;
        features['xA_per_90'] = (parseFloat(player.expected_assists) || 0) / gamesPlayed;
        features['xGI_per_90'] = (parseFloat(player.expected_goal_involvements) || 0) / gamesPlayed;
        features['xGI_per_90_avg_5'] = features['xGI_per_90'];  // Approximate
        
        // Defensive
        features['clean_sheets'] = player.clean_sheets || 0;
        features['goals_conceded'] = player.goals_conceded || 0;
        features['expected_goals_conceded'] = parseFloat(player.expected_goals_conceded) || 0;
        features['saves'] = player.saves || 0;
        features['def_contrib'] = player.def_contrib || 0;
        features['def_contrib_per_90'] = player.def_contrib_per90 || 0;
        features['def_contrib_per_90_avg_5'] = player.def_contrib_per90 || 0;
        
        // Bonus
        features['bonus'] = player.bonus || 0;
        features['bps'] = player.bps || 0;
        features['bonus_per_90'] = (player.bonus || 0) / gamesPlayed;
        features['bps_per_90'] = (player.bps || 0) / gamesPlayed;
        
        // Advanced
        features['key_passes'] = player.key_passes || 0;
        features['big_chances_created'] = player.big_chances_created || 0;
        features['big_chances_missed'] = player.big_chances_missed || 0;
        features['tackles'] = player.tackles || 0;
        features['dribbles'] = player.dribbles || 0;
        features['fouls'] = player.fouls || 0;
        features['offside'] = player.offside || 0;
        features['yellow_cards'] = player.yellow_cards || 0;
        features['red_cards'] = player.red_cards || 0;
        
        // Penalties & Set Pieces
        features['penalties_missed'] = player.penalties_missed || 0;
        features['penalties_saved'] = player.penalties_saved || 0;
        features['own_goals'] = player.own_goals || 0;
        
        // Complex metrics
        features['finishing_efficiency'] = (player.goals_scored || 0) / (parseFloat(player.expected_goals) || 1);
        features['assist_efficiency'] = (player.assists || 0) / (parseFloat(player.expected_assists) || 1);
        features['cs_per_game'] = (player.clean_sheets || 0) / gamesPlayed;
        
        // Position encoding
        features['is_GKP'] = player.element_type === 1 ? 1 : 0;
        features['is_DEF'] = player.element_type === 2 ? 1 : 0;
        features['is_MID'] = player.element_type === 3 ? 1 : 0;
        features['is_FWD'] = player.element_type === 4 ? 1 : 0;
        
        // Additional features (approximations)
        features['minutes_rolling'] = player.minutes || 0;
        features['minutes_std_5'] = 0;  // Not available without history
        features['points_std_5'] = 0;  // Not available without history
        // Calculate coefficient of variation using form_5
        features['points_cv'] = features['form_5'] > 0 ? (0.3 / features['form_5']) : 0;  // Approximate CV
        features['xP'] = player.total_points || 0;
        features['ea_index'] = parseFloat(player.ep_next) || parseFloat(player.ep_this) || 0;
        
        // Match-specific
        features['team_h_score'] = 0;
        features['team_a_score'] = 0;
        features['winning_goals'] = 0;
        
        // Set pieces
        features['attempted_passes'] = 0;
        features['completed_passes'] = 0;
        features['open_play_crosses'] = 0;
        
        // Other
        features['clearances_blocks_interceptions'] = 0;
        features['recoveries'] = 0;
        features['tackled'] = 0;
        features['target_missed'] = 0;
        features['defensive_contribution'] = player.def_contrib || 0;
        features['errors_leading_to_goal'] = 0;
        features['errors_leading_to_goal_attempt'] = 0;
        features['loaned_in'] = 0;
        features['loaned_out'] = 0;
        features['penalties_conceded'] = 0;
        features['cs_rolling_5'] = 0;
        features['mng_clean_sheets'] = 0;
        features['mng_goals_scored'] = 0;
        features['mng_win'] = 0;
        features['mng_loss'] = 0;
        features['mng_draw'] = 0;
        features['mng_underdog_win'] = 0;
        features['mng_underdog_draw'] = 0;
        
        return features;
    }
    
    /**
     * Traverse Decision Tree recursively
     */
    traverseTree(node, features) {
        // Leaf node - return value
        if (node.value !== undefined) {
            return node.value;
        }
        
        // Get feature value
        const featureValue = features[node.feature] || 0;
        
        // Traverse left or right based on threshold
        if (featureValue <= node.threshold) {
            return this.traverseTree(node.left, features);
        } else {
            return this.traverseTree(node.right, features);
        }
    }
    
    /**
     * Predict points for next 3 gameweeks
     * (Changed from 1 GW to 3 GWs for better draft planning)
     */
    predict(player) {
        try {
            // Extract features
            const features = this.extractFeatures(player);
            
            // Traverse tree
            let modelPrediction = this.traverseTree(this.tree, features);
            
            // Since model has negative R² (-0.024), it's not reliable
            // Create a heuristic-based prediction using key features
            const form5 = features['form_5'] || 0;
            const selected = features['selected'] || 0;
            const minutes = features['minutes'] || 0;
            const transfersBalance = features['transfers_balance'] || 0;  // Use balance instead of transfers_in
            const xGI = features['xGI_per_90'] || 0;
            
            // Get upcoming fixtures for fixture difficulty calculation
            // Try multiple ways to access fixtures (depends on how script.js exposes it)
            let upcomingFixtures = [];
            if (typeof teamFixtures !== 'undefined' && teamFixtures[player.team]) {
                upcomingFixtures = teamFixtures[player.team];
            } else if (window.teamFixtures && window.teamFixtures[player.team]) {
                upcomingFixtures = window.teamFixtures[player.team];
            } else if (typeof state !== 'undefined' && state.fixtures) {
                // Fallback: try to get from state
                upcomingFixtures = (state.fixtures || []).filter(f => 
                    f.team_h === player.team || f.team_a === player.team
                );
            }
            const next3Fixtures = upcomingFixtures.slice(0, 3);
            
            // Calculate average fixture difficulty for next 3 games
            let avgFixtureDifficulty = 1.0;  // Default: neutral (1.0 = average difficulty)
            // Try to get teamStrengthData from various sources
            let teamStrengthData = null;
            if (typeof state !== 'undefined' && state.teamStrengthData) {
                teamStrengthData = state.teamStrengthData;
            } else if (window.state && window.state.teamStrengthData) {
                teamStrengthData = window.state.teamStrengthData;
            }
            
            if (next3Fixtures.length > 0 && teamStrengthData) {
                let totalDifficulty = 0;
                let count = 0;
                
                next3Fixtures.forEach(fixture => {
                    const isHome = player.team === fixture.team_h;
                    const opponentTeamId = isHome ? fixture.team_a : fixture.team_h;
                    const playerTeam = teamStrengthData[player.team];
                    const opponentTeam = teamStrengthData[opponentTeamId];
                    
                    if (playerTeam && opponentTeam) {
                        const attackScore = isHome ? playerTeam.strength_attack_home : playerTeam.strength_attack_away;
                        const defenseScore = isHome ? opponentTeam.strength_defence_home : opponentTeam.strength_defence_away;
                        // Higher ratio = easier fixture (our attack vs their defense)
                        const difficulty = attackScore / Math.max(defenseScore, 1);
                        totalDifficulty += difficulty;
                        count++;
                    }
                });
                
                if (count > 0) {
                    avgFixtureDifficulty = totalDifficulty / count;
                    // Normalize: 1.0 = average, >1.0 = easier, <1.0 = harder
                    // Typical range: 0.5 (very hard) to 2.0 (very easy)
                }
            }
            
            // Heuristic prediction for NEXT 3 GAMEWEEKS (not just 1)
            // Base prediction on form (points per game) × 3 games
            let heuristicPredPerGame = 0;
            
            if (form5 > 0) {
                // Base prediction on form (points per game)
                heuristicPredPerGame = form5;
                
                // Adjust based on other factors
                if (selected > 20) heuristicPredPerGame += 0.3;  // Popular players (reduced weight)
                if (selected > 50) heuristicPredPerGame += 0.4;  // Very popular (reduced weight)
                
                // Use transfers_balance instead of transfers_in (better metric!)
                if (transfersBalance > 5000) heuristicPredPerGame += 0.4;  // Positive balance = good
                if (transfersBalance > 20000) heuristicPredPerGame += 0.3;  // Very positive = very good
                if (transfersBalance < -5000) heuristicPredPerGame -= 0.3;  // Negative balance = bad
                
                if (minutes < 300) heuristicPredPerGame -= 1.0;  // Not playing much
                if (xGI > 0.5) heuristicPredPerGame += 0.3;  // Good xGI
                
                // ICT Index - not very important (only 1.29% in model), but can help
                // Only use if very high or very low
                if (features['ict_index'] > 120) heuristicPredPerGame += 0.2;  // Very high ICT
                if (features['ict_index'] < 30 && minutes > 500) heuristicPredPerGame -= 0.3;  // Low ICT but playing
                
                // Apply fixture difficulty multiplier
                // Easy fixtures (+20%), Hard fixtures (-20%)
                heuristicPredPerGame *= (0.8 + (avgFixtureDifficulty - 1.0) * 0.4);
                // Formula: 0.8 + (diff-1)*0.4
                // If diff=1.0 (average): 0.8 + 0 = 0.8 (slight penalty for average)
                // If diff=1.5 (easy): 0.8 + 0.2 = 1.0 (no change)
                // If diff=2.0 (very easy): 0.8 + 0.4 = 1.2 (+20%)
                // If diff=0.5 (hard): 0.8 - 0.2 = 0.6 (-20%)
            } else {
                // Fallback if no form data
                heuristicPredPerGame = (selected / 20) + 2;
            }
            
            // Predict for 3 gameweeks
            let heuristicPred = heuristicPredPerGame * 3;
            
            // Blend: Since model R² is negative, weight heuristic more heavily
            // Model gets 20%, heuristic gets 80%
            // But model predicts 1 GW, so multiply by 3
            let prediction = (modelPrediction * 3 * 0.2) + (heuristicPred * 0.8);
            
            // Cap at realistic range (0-45 for 3 GWs, ~15 per game)
            prediction = Math.max(0, Math.min(45, prediction));
            
            // Round to 1 decimal
            prediction = Math.round(prediction * 10) / 10;
            
            // Debug: Log key features for sample (more detailed)
            if (Math.random() < 0.05) {  // 5% sample for debugging
                console.log(`🎯 Draft ML (3 GWs) for ${player.web_name}:`, {
                    final_prediction_3gw: prediction.toFixed(1),
                    per_game: (prediction / 3).toFixed(1),
                    model_pred_1gw: modelPrediction.toFixed(1),
                    heuristic_pred_3gw: heuristicPred.toFixed(1),
                    heuristic_per_game: heuristicPredPerGame.toFixed(1),
                    form_5: features['form_5']?.toFixed(2),
                    selected: features['selected']?.toFixed(1),
                    transfers_balance: transfersBalance,
                    fixture_difficulty: avgFixtureDifficulty.toFixed(2),
                    next_3_fixtures: next3Fixtures.length,
                    minutes: features['minutes'],
                    ict: features['ict_index']?.toFixed(0),
                    xGI_per_90: features['xGI_per_90']?.toFixed(2),
                    points_per_game: player.points_per_game_90?.toFixed(2)
                });
            }
            
            return prediction;
            
        } catch (error) {
            console.error(`Draft prediction error for ${player.web_name}:`, error);
            return 0;
        }
    }
}

// ============================================
// GLOBAL FUNCTIONS
// ============================================

let globalDraftPredictor = null;

/**
 * Load the Draft Decision Tree model
 */
async function loadDraftModel(filename = 'decision_tree_draft.json') {
    try {
        console.log(`📥 Loading Draft model: ${filename}...`);
        const response = await fetch(filename);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const modelData = await response.json();
        console.log('✅ Draft model loaded!');
        
        return modelData;
    } catch (error) {
        console.error('❌ Failed to load Draft model:', error);
        return null;
    }
}

/**
 * Initialize the Draft ML predictor
 */
async function initializeDraftMLModel() {
    try {
        const modelData = await loadDraftModel();
        
        if (!modelData) {
            console.error('❌ Draft model initialization failed');
            return false;
        }
        
        globalDraftPredictor = new DraftDecisionTreePredictor(modelData);
        console.log('✅ Draft FPL ML Model ready!');
        console.log('🎯 Top features: form_10, selected, minutes, transfers');
        console.log('❌ NO price features!');
        
        return true;
    } catch (error) {
        console.error('❌ Draft model initialization error:', error);
        return false;
    }
}

/**
 * Predict points for a player (global function for script.js)
 */
function predictPlayerPoints(player) {
    if (!globalDraftPredictor) {
        // Model not ready yet - return null so script.js knows to wait
        return null;
    }
    
    try {
        return globalDraftPredictor.predict(player);
    } catch (error) {
        console.error(`Draft prediction error for ${player.web_name}:`, error);
        return 0;
    }
}

// ============================================
// AUTO-INITIALIZE ON PAGE LOAD
// ============================================

if (typeof window !== 'undefined') {
    window.mlModelReady = false;
    
    // Initialize asynchronously
    window.addEventListener('load', async () => {
        const success = await initializeDraftMLModel();
        window.mlModelReady = success;
        
        if (success) {
            console.log('🎯 Draft FPL ML Model initialized!');
            
            // Trigger re-calculation and re-render
            setTimeout(() => {
                // Get players from state
                let players = null;
                if (typeof state !== 'undefined' && state.displayedData && state.displayedData.length > 0) {
                    players = state.displayedData;
                } else if (window.state && window.state.displayedData && window.state.displayedData.length > 0) {
                    players = window.state.displayedData;
                }
                
                if (players && typeof calculateAllPredictions === 'function' && typeof renderTable === 'function') {
                    console.log('♻️ Recalculating ML predictions...');
                    calculateAllPredictions(players);
                    console.log('♻️ Re-rendering table with Draft ML predictions...');
                    renderTable();
                } else {
                    console.warn('⚠️ Cannot recalculate: players data not available yet');
                }
            }, 100);
        }
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DraftDecisionTreePredictor,
        loadDraftModel,
        initializeDraftMLModel,
        predictPlayerPoints
    };
}
