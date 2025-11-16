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
        features['form_3'] = parseFloat(player.form) * 0.6 || 0;  // Approximate
        features['form_5'] = parseFloat(player.form) || 0;
        features['form_10'] = parseFloat(player.form) * 1.5 || 0;  // Approximate
        features['form_trend'] = 0;  // Not available
        
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
        features['minutes_std_5'] = 0;
        features['points_std_5'] = 0;
        features['points_cv'] = 0;
        features['xP'] = player.total_points || 0;
        features['ea_index'] = parseFloat(player.ep_next) || 0;
        
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
     * Predict next GW points
     */
    predict(player) {
        try {
            // Extract features
            const features = this.extractFeatures(player);
            
            // Traverse tree
            let prediction = this.traverseTree(this.tree, features);
            
            // Cap at realistic range (0-15)
            prediction = Math.max(0, Math.min(15, prediction));
            
            // Round to 1 decimal
            prediction = Math.round(prediction * 10) / 10;
            
            // Debug: Log key features for sample
            if (Math.random() < 0.02) {  // 2% sample
                console.log(`🎯 Draft ML for ${player.web_name}:`, {
                    prediction: prediction.toFixed(1),
                    form_10: features['form_10']?.toFixed(1),
                    selected: features['selected']?.toFixed(1),
                    transfers_in: features['transfers_in'],
                    minutes: features['minutes'],
                    ict: features['ict_index']?.toFixed(0)
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
        console.warn('⚠️ Draft ML predictor not ready yet');
        return 0;
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
            
            // Trigger re-render if renderTable exists
            setTimeout(() => {
                if (typeof renderTable === 'function') {
                    console.log('♻️ Re-rendering table with Draft ML predictions...');
                    renderTable();
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
