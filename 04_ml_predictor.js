/**
 * ============================================
 * 🌳 ML PREDICTOR - DECISION TREE RUNNER
 * ============================================
 * 
 * This file loads a trained Decision Tree model (JSON)
 * and runs predictions directly in the browser!
 * 
 * No server needed! 🚀
 */

class DecisionTreePredictor {
    constructor(modelData) {
        this.modelType = modelData.model_type;
        this.version = modelData.version;
        this.features = modelData.features;
        this.nFeatures = modelData.n_features;
        this.tree = modelData.tree;
        this.metrics = modelData.metrics;
        
        console.log(`✅ Loaded ${this.modelType} v${this.version}`);
        console.log(`📊 MAE: ${this.metrics.mae.toFixed(3)}, R²: ${this.metrics.r2.toFixed(3)}`);
        console.log(`🌲 Depth: ${modelData.max_depth}, Leaves: ${modelData.n_leaves}`);
    }
    
    /**
     * Extract features from player object
     * Returns feature vector in same order as training
     */
    extractFeatures(player) {
        const features = {};
        
        // Calculate games played
        const gamesPlayed = Math.max((player.minutes || 0) / 90, 0.1);
        const price = (player.now_cost || 0) / 10;
        
        // Basic stats
        features['assists'] = player.assists || 0;
        features['bonus'] = player.bonus || 0;
        features['bps'] = player.bps || 0;
        features['clean_sheets'] = player.clean_sheets || 0;
        features['creativity'] = parseFloat(player.creativity) || 0;
        features['goals_conceded'] = player.goals_conceded || 0;
        features['goals_scored'] = player.goals_scored || 0;
        features['ict_index'] = parseFloat(player.ict_index) || 0;
        features['influence'] = parseFloat(player.influence) || 0;
        features['minutes'] = player.minutes || 0;
        features['own_goals'] = player.own_goals || 0;
        features['penalties_missed'] = player.penalties_missed || 0;
        features['penalties_saved'] = player.penalties_saved || 0;
        features['red_cards'] = player.red_cards || 0;
        features['saves'] = player.saves || 0;
        features['threat'] = parseFloat(player.threat) || 0;
        features['yellow_cards'] = player.yellow_cards || 0;
        features['starts'] = player.starts || 0;
        features['expected_goals'] = parseFloat(player.expected_goals) || 0;
        features['expected_assists'] = parseFloat(player.expected_assists) || 0;
        features['expected_goal_involvements'] = parseFloat(player.expected_goal_involvements) || 0;
        features['expected_goals_conceded'] = parseFloat(player.expected_goals_conceded) || 0;
        
        // Form
        features['form'] = parseFloat(player.form) || 0;
        features['points_per_game'] = parseFloat(player.points_per_game) || 0;
        features['selected_by_percent'] = parseFloat(player.selected_by_percent) || 0;
        features['now_cost'] = player.now_cost || 0;
        features['cost_change_start'] = player.cost_change_start || 0;
        features['cost_change_event'] = player.cost_change_event || 0;
        
        // Transfers
        features['transfers_in'] = player.transfers_in || 0;
        features['transfers_out'] = player.transfers_out || 0;
        features['transfers_in_event'] = player.transfers_in_event || 0;
        features['transfers_out_event'] = player.transfers_out_event || 0;
        
        // Per-90 metrics
        features['goals_per_90'] = (features['goals_scored'] / gamesPlayed);
        features['assists_per_90'] = (features['assists'] / gamesPlayed);
        features['xG_per_90'] = (features['expected_goals'] / gamesPlayed);
        features['xA_per_90'] = (features['expected_assists'] / gamesPlayed);
        features['xGI_per_90'] = (features['expected_goal_involvements'] / gamesPlayed);
        features['bonus_per_90'] = (features['bonus'] / gamesPlayed);
        features['bps_per_90'] = (features['bps'] / gamesPlayed);
        features['influence_per_90'] = (features['influence'] / gamesPlayed);
        features['creativity_per_90'] = (features['creativity'] / gamesPlayed);
        features['threat_per_90'] = (features['threat'] / gamesPlayed);
        
        // Efficiency
        features['finishing_efficiency'] = features['expected_goals'] > 0 
            ? features['goals_scored'] / features['expected_goals'] 
            : 0;
        features['assist_efficiency'] = features['expected_assists'] > 0 
            ? features['assists'] / features['expected_assists'] 
            : 0;
        
        // Position encoding (from element_type: 1=GKP, 2=DEF, 3=MID, 4=FWD)
        features['is_GKP'] = player.element_type === 1 ? 1 : 0;
        features['is_DEF'] = player.element_type === 2 ? 1 : 0;
        features['is_MID'] = player.element_type === 3 ? 1 : 0;
        features['is_FWD'] = player.element_type === 4 ? 1 : 0;
        
        // Clean sheets
        features['cs_per_game'] = features['clean_sheets'] / gamesPlayed;
        
        // Value metrics
        features['points_per_million'] = player.total_points > 0 && price > 0 
            ? player.total_points / price 
            : 0;
        features['form_per_million'] = features['form'] > 0 && price > 0 
            ? features['form'] / price 
            : 0;
        
        // Defensive contribution
        features['def_contrib_per90'] = player.def_contrib_per90 || 0;
        
        // Form metrics (approximations)
        features['form_3'] = features['form'];
        features['form_5'] = features['form'];
        features['form_10'] = features['form'];
        
        // Rolling stats (approximate with season stats)
        features['xGI_per_90_avg_5'] = features['xGI_per_90'];
        features['def_contrib_per_90_avg_5'] = features['def_contrib_per90'];
        features['cs_rolling_5'] = features['cs_per_game'];
        
        // Variance metrics (approximate)
        features['points_std_5'] = features['form'] * 0.5; // Rough approximation
        features['points_cv'] = features['form'] > 0 ? features['points_std_5'] / features['form'] : 0;
        features['minutes_std_5'] = features['minutes'] / 10; // Rough approximation
        
        // Last 3 games (approximate with season averages)
        const last3Games = 3;
        features['total_points_last3'] = features['form'] * last3Games;
        features['minutes_last3'] = (features['minutes'] / gamesPlayed) * last3Games;
        features['goals_scored_last3'] = features['goals_per_90'] * last3Games;
        features['assists_last3'] = features['assists_per_90'] * last3Games;
        features['clean_sheets_last3'] = features['cs_per_game'] * last3Games;
        features['saves_last3'] = (features['saves'] / gamesPlayed) * last3Games;
        features['minutes_last3_std'] = features['minutes_last3'] / 3;
        
        // Hot streak
        features['hot_streak'] = features['form'] > 6 ? 1 : 0;
        
        // Value
        features['value'] = price;
        
        return features;
    }
    
    /**
     * Traverse decision tree to get prediction
     */
    traverseTree(node, features) {
        if (node.type === 'leaf') {
            return node.value;
        }
        
        // Get feature value
        const featureValue = features[node.feature] || 0;
        
        // Go left if value <= threshold, else right
        if (featureValue <= node.threshold) {
            return this.traverseTree(node.left, features);
        } else {
            return this.traverseTree(node.right, features);
        }
    }
    
    /**
     * Predict points for a player
     */
    predict(player) {
        try {
            // Extract features
            const features = this.extractFeatures(player);
            
            // Traverse tree
            const prediction = this.traverseTree(this.tree, features);
            
            // Cap at reasonable range (0-15)
            const cappedPrediction = Math.max(0, Math.min(15, prediction));
            
            // Round to 1 decimal
            return Math.round(cappedPrediction * 10) / 10;
        } catch (error) {
            console.error(`Prediction error for ${player.web_name}:`, error);
            return 0;
        }
    }
}

// ============================================
// GLOBAL FUNCTIONS
// ============================================

let globalMLPredictor = null;

/**
 * Load the Decision Tree model
 */
async function loadMLModel(filename = 'decision_tree_model.json') {
    try {
        const response = await fetch(filename);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const modelData = await response.json();
        return modelData;
    } catch (error) {
        console.error(`❌ Failed to load ML model from ${filename}:`, error);
        return null;
    }
}

/**
 * Initialize the ML model
 */
async function initializeMLModel() {
    try {
        const modelData = await loadMLModel('decision_tree_model.json');
        if (!modelData) {
            throw new Error('Failed to load model data');
        }
        
        globalMLPredictor = new DecisionTreePredictor(modelData);
        console.log('✅ Decision Tree Model ready for predictions!');
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize ML model:', error);
        return false;
    }
}

/**
 * Predict points for a player (global function for script.js)
 */
function predictPlayerPoints(player) {
    if (!globalMLPredictor) {
        // Model not loaded yet
        return 0;
    }
    
    try {
        return globalMLPredictor.predict(player);
    } catch (error) {
        console.error(`ML prediction error for ${player.web_name}:`, error);
        return 0;
    }
}

// ============================================
// AUTO-INITIALIZE ON PAGE LOAD
// ============================================

if (typeof window !== 'undefined') {
    window.mlModelReady = false;
    
    initializeMLModel().then(() => {
        window.mlModelReady = true;
        console.log('🎯 ML Model ready!');
        
        // Trigger re-render if renderTable exists
        if (typeof renderTable === 'function') {
            console.log('♻️ Re-rendering table with ML predictions...');
            renderTable();
        }
    }).catch(error => {
        console.error('❌ ML Model initialization failed:', error);
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DecisionTreePredictor,
        loadMLModel,
        initializeMLModel,
        predictPlayerPoints
    };
}
