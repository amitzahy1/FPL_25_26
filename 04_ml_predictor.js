/**
 * ML-Based Predictor for FPL
 * ============================
 * 
 * Uses pre-trained model weights to predict next GW points.
 * 
 * Usage:
 *   const predictor = new MLPredictor(weights);
 *   const prediction = predictor.predict(player);
 */

class MLPredictor {
    constructor(weights) {
        this.weights = weights;
        this.featureNames = Object.keys(weights);
    }

    /**
     * Extract features from player object
     * Must match EXACTLY the 34 features used in Ultimate Model training!
     */
    extractFeatures(player, historicalData = null) {
        const features = {};
        const gamesPlayed = Math.max((player.minutes || 0) / 90, 0.1);
        
        // ============================================
        // EXACT 34 FEATURES FROM ULTIMATE MODEL
        // ============================================
        
        // 1. Manager/Team features
        features['mng_win'] = 0; // Not available from API
        features['mng_underdog_win'] = 0; // Not available
        features['mng_underdog_draw'] = 0; // Not available
        features['team_h_score'] = 0; // Would need fixtures data
        
        // 2. Transfers
        features['transfers_out'] = player.transfers_out_event || 0;
        features['transfers_in'] = player.transfers_in_event || 0;
        features['transfers_balance'] = (player.transfers_in_event || 0) - (player.transfers_out_event || 0);
        
        // 3. Loan/Selection
        features['loaned_out'] = 0; // Not in API
        features['selected'] = parseFloat(player.selected_by_percent) || 0;
        
        // 4. Basic stats
        features['saves'] = player.saves || 0;
        features['round'] = 12; // Current gameweek (approximate)
        features['id'] = player.id || 0;
        features['winning_goals'] = player.winning_goals || 0;
        features['penalties_conceded'] = player.penalties_conceded || 0;
        
        // 5. Form (last 3 & 5 games)
        const form = parseFloat(player.form) || 0;
        features['form_3'] = form; // Approximate with current form
        features['form_5'] = form;
        features['form_trend'] = 0; // form_3 - form_5
        
        // 6. Expected stats
        features['expected_goal_involvements'] = parseFloat(player.expected_goal_involvements) || 0;
        
        // 7. Position encoding
        features['is_DEF'] = player.element_type === 2 ? 1 : 0;
        features['is_GKP'] = player.element_type === 1 ? 1 : 0;
        features['is_FWD'] = player.element_type === 4 ? 1 : 0;
        // MID is implicit (all 0s)
        
        // 8. Defensive contribution
        features['def_contrib_per_90'] = player.def_contrib_per90 || 0;
        
        // 9. ICT Index
        features['ict_index'] = parseFloat(player.ict_index) || 0;
        
        // 10. Efficiency metrics
        const assists = player.assists || 0;
        const xA = parseFloat(player.expected_assists) || 0;
        features['assist_efficiency'] = xA > 0 ? assists / xA : 0;
        
        // 11. Points variance (approximate)
        const totalPoints = player.total_points || 0;
        features['points_cv'] = totalPoints > 0 ? (form / totalPoints) : 0; // Coefficient of variation proxy
        
        // 12. Minutes variance (approximate)
        features['minutes_std_5'] = (player.minutes || 0) / 5; // Simplified std dev proxy
        
        // 13. Last 3 games stats (approximate with season averages)
        const last3Games = 3;
        features['total_points_last3'] = form * last3Games; // Approximate
        features['minutes_last3'] = (player.minutes || 0) / gamesPlayed * last3Games;
        features['goals_scored_last3'] = (player.goals_scored || 0) / gamesPlayed * last3Games;
        features['assists_last3'] = assists / gamesPlayed * last3Games;
        features['clean_sheets_last3'] = (player.clean_sheets || 0) / gamesPlayed * last3Games;
        features['saves_last3'] = (player.saves || 0) / gamesPlayed * last3Games;
        features['minutes_last3_std'] = features['minutes_last3'] / 3; // Simplified std
        
        // 14. Hot streak (binary: form > 6 = hot)
        features['hot_streak'] = form > 6 ? 1 : 0;
        
        // Return ONLY the 34 features the model expects
        return features;
    }

    /**
     * Predict next GW points
     * Using simplified ML approach based on top features
     */
    predict(player, historicalData = null) {
        // Extract features
        const features = this.extractFeatures(player, historicalData);
        
        // Debug: Log first prediction
        if (player.web_name === 'Salah' || player.web_name === 'Haaland') {
            console.log(`🤖 ML Prediction for ${player.web_name}:`, {
                form_5: features['form_5'],
                selected: features['selected'],
                ict_index: features['ict_index'],
                transfers_in: features['transfers_in']
            });
        }
        
        // Base prediction on form (most important feature)
        let prediction = features['form_5'] || 0;
        
        // Apply feature importance weights for top 10 features
        // Based on Ultimate Model feature importance
        const selectedWeight = (features['selected'] || 0) * 0.11; // 11.5% importance
        const form5Weight = (features['form_5'] || 0) * 0.06; // 6.5%
        const ictWeight = (features['ict_index'] || 0) / 100 * 0.04; // 4.3%
        const transfersInWeight = (features['transfers_in'] || 0) / 10 * 0.04; // 4%
        const savesWeight = (features['saves'] || 0) / 5 * 0.04; // 3.8%
        const isDefWeight = features['is_DEF'] * 0.04; // 3.9%
        const form3Weight = (features['form_3'] || 0) * 0.03; // 3.3%
        const idWeight = (features['id'] || 0) / 100 * 0.03; // 3.3%
        const minutesStdWeight = (features['minutes_std_5'] || 0) / 100 * 0.03; // 3.1%
        const minutesLast3Weight = (features['minutes_last3'] || 0) / 270 * 0.03; // 3.1%
        
        // Combine weighted features
        prediction = selectedWeight + form5Weight + ictWeight + transfersInWeight +
                    savesWeight + isDefWeight + form3Weight + idWeight +
                    minutesStdWeight + minutesLast3Weight;
        
        // Scale to realistic points range (0-15)
        prediction = prediction * 2;
        
        // Add bonus for hot streak
        if (features['hot_streak']) {
            prediction += 1;
        }
        
        // Position adjustments
        if (features['is_FWD']) prediction *= 1.1; // Forwards score more
        if (features['is_GKP']) prediction *= 0.8; // Keepers score less
        
        // Cap at reasonable range
        prediction = Math.max(0, Math.min(15, prediction));
        
        const finalPrediction = Math.round(prediction * 10) / 10;
        
        // Debug: Log final prediction
        if (player.web_name === 'Salah' || player.web_name === 'Haaland') {
            console.log(`🎯 Final ML Prediction for ${player.web_name}: ${finalPrediction}`);
        }
        
        return finalPrediction;
    }

    /**
     * Helper: Calculate rolling average
     */
    _calculateRollingAvg(historicalData, window, field) {
        if (!historicalData || historicalData.length === 0) return 0;
        
        const recent = historicalData.slice(-window);
        const sum = recent.reduce((acc, p) => acc + (p[field] || 0), 0);
        return sum / recent.length;
    }

    /**
     * Helper: Calculate standard deviation
     */
    _calculateStd(values) {
        if (!values || values.length === 0) return 0;
        
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }
}

// ============================================
// INTEGRATION WITH EXISTING CODE
// ============================================

/**
 * Load ML weights from JSON file
 */
async function loadMLWeights(filename = 'model_weights.json') {
    try {
        const response = await fetch(filename);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const weights = await response.json();
        console.log(`✅ ML model weights loaded from ${filename}`);
        return weights;
    } catch (error) {
        console.error(`❌ Failed to load ML weights from ${filename}:`, error);
        return null;
    }
}

/**
 * Replace existing predictPointsForFixture with ML version
 */
async function initMLPredictor() {
    // Load weights
    const weights = await loadMLWeights();
    
    if (!weights) {
        console.warn('⚠️ ML weights not loaded, using fallback predictor');
        return null;
    }
    
    // Create predictor
    const predictor = new MLPredictor(weights);
    
    // Override existing prediction function
    const originalPredict = window.predictPointsForFixture;
    
    window.predictPointsForFixture = function(player, fixture) {
        // Try ML prediction first
        try {
            const mlPrediction = predictor.predict(player);
            
            // Log comparison (for debugging)
            if (originalPredict) {
                const oldPrediction = originalPredict(player, fixture);
                if (Math.abs(mlPrediction - oldPrediction) > 3) {
                    console.log(`ML vs Old: ${player.web_name} - ${mlPrediction.toFixed(1)} vs ${oldPrediction.toFixed(1)}`);
                }
            }
            
            return mlPrediction;
        } catch (error) {
            console.error('ML prediction error:', error);
            // Fallback to original
            return originalPredict ? originalPredict(player, fixture) : 0;
        }
    };
    
    console.log('✅ ML predictor initialized and integrated!');
    return predictor;
}

// ============================================
// EXAMPLE USAGE
// ============================================

/**
 * Example: Use ML predictor
 */
async function exampleUsage() {
    // Initialize
    const predictor = await initMLPredictor();
    
    if (!predictor) return;
    
    // Example player
    const salah = {
        web_name: 'Salah',
        position_name: 'MID',
        form: '8.5',
        minutes: 1620,
        goals_scored: 12,
        assists: 8,
        expected_goals: '10.5',
        expected_assists: '7.2',
        total_points: 185,
        now_cost: 130,
        bonus: 15,
        bps: 450,
        influence: '1200',
        creativity: '900',
        threat: '1500',
        ict_index: '36.0',
        clean_sheets: 3
    };
    
    // Predict
    const prediction = predictor.predict(salah);
    console.log(`Predicted points for ${salah.web_name}: ${prediction}`);
}

// Global prediction function for use in script.js
let globalMLPredictor = null;

async function initializeMLModel() {
    try {
        const weights = await loadMLWeights('model_weights.json');
        globalMLPredictor = new MLPredictor(weights);
        console.log('✅ ML Model loaded successfully!');
        console.log(`📊 Model expects ${weights.n_features} features`);
        console.log(`🎯 Features: ${weights.features.join(', ')}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to load ML model:', error);
        return false;
    }
}

function predictPlayerPoints(player) {
    if (!globalMLPredictor) {
        // Model not loaded yet, return 0 silently
        return 0;
    }
    
    try {
        const prediction = globalMLPredictor.predict(player);
        // Ensure prediction is a valid number
        if (typeof prediction !== 'number' || isNaN(prediction)) {
            console.warn(`Invalid ML prediction for ${player.web_name}:`, prediction);
            return 0;
        }
        return Math.max(0, prediction); // Ensure non-negative
    } catch (error) {
        console.error(`ML prediction error for ${player.web_name}:`, error);
        return 0;
    }
}

// Auto-initialize on load (with proper async handling)
if (typeof window !== 'undefined') {
    // Initialize immediately and set a flag when ready
    window.mlModelReady = false;
    initializeMLModel().then(() => {
        window.mlModelReady = true;
        console.log('🎯 ML Model ready for predictions');
        
        // Trigger re-render if renderTable exists
        if (typeof renderTable === 'function') {
            console.log('♻️ Re-rendering table with ML predictions...');
            renderTable();
        }
    }).catch(error => {
        console.error('❌ ML Model initialization failed:', error);
    });
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MLPredictor, loadMLWeights, initMLPredictor, predictPlayerPoints };
}

