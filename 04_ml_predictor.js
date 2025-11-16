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
     * Must match exactly what was used in training!
     */
    extractFeatures(player, historicalData = null) {
        const features = {};
        
        // Get games played
        const gamesPlayed = Math.max((player.minutes || 0) / 90, 0.1);
        
        // ============================================
        // 1. ROLLING AVERAGES (Form)
        // ============================================
        // If we have historical data, calculate rolling
        if (historicalData && historicalData.length >= 3) {
            features['form_3'] = this._calculateRollingAvg(historicalData, 3, 'total_points');
            features['form_5'] = this._calculateRollingAvg(historicalData, 5, 'total_points');
            features['form_10'] = this._calculateRollingAvg(historicalData, 10, 'total_points');
            features['form_trend'] = features['form_3'] - features['form_5'];
        } else {
            // Use current form as proxy
            features['form_3'] = parseFloat(player.form) || 0;
            features['form_5'] = parseFloat(player.form) || 0;
            features['form_10'] = parseFloat(player.form) || 0;
            features['form_trend'] = 0;
        }
        
        // ============================================
        // 2. PER-90 METRICS
        // ============================================
        features['minutes_rolling'] = player.minutes || 0;
        features['goals_per_90'] = ((player.goals_scored || 0) / gamesPlayed);
        features['assists_per_90'] = ((player.assists || 0) / gamesPlayed);
        features['xG_per_90'] = ((parseFloat(player.expected_goals) || 0) / gamesPlayed);
        features['xA_per_90'] = ((parseFloat(player.expected_assists) || 0) / gamesPlayed);
        features['xGI_per_90'] = features['xG_per_90'] + features['xA_per_90'];
        
        // ============================================
        // 3. ROLLING PER-90 METRICS
        // ============================================
        features['xGI_per_90_avg_5'] = features['xGI_per_90']; // Simplified
        
        // ============================================
        // 4. CONSISTENCY METRICS
        // ============================================
        if (historicalData && historicalData.length >= 5) {
            const recentPoints = historicalData.slice(-5).map(p => p.total_points);
            features['points_std_5'] = this._calculateStd(recentPoints);
            features['points_cv'] = features['points_std_5'] / (features['form_5'] + 0.1);
            
            const recentMinutes = historicalData.slice(-5).map(p => p.minutes);
            features['minutes_std_5'] = this._calculateStd(recentMinutes);
        } else {
            features['points_std_5'] = 0;
            features['points_cv'] = 0;
            features['minutes_std_5'] = 0;
        }
        
        // ============================================
        // 5. FINISHING EFFICIENCY
        // ============================================
        features['finishing_efficiency'] = (player.goals_scored || 0) / (parseFloat(player.expected_goals) || 0.1);
        features['assist_efficiency'] = (player.assists || 0) / (parseFloat(player.expected_assists) || 0.1);
        
        // ============================================
        // 6. DEFENSIVE CONTRIBUTION (DefCon)
        // ============================================
        const defContrib = (player.tackles || 0) + (player.interceptions || 0) + 
                          (player.clearances || 0) + (player.blocks || 0);
        features['def_contrib_per_90'] = defContrib / gamesPlayed;
        
        // Rolling (simplified - use current value)
        features['def_contrib_per_90_avg_5'] = player.def_contrib_per90 || features['def_contrib_per_90'];
        
        // ============================================
        // 7. ICT METRICS
        // ============================================
        features['influence_per_90'] = (parseFloat(player.influence) || 0) / gamesPlayed;
        features['creativity_per_90'] = (parseFloat(player.creativity) || 0) / gamesPlayed;
        features['threat_per_90'] = (parseFloat(player.threat) || 0) / gamesPlayed;
        
        // ============================================
        // 7. BONUS POTENTIAL
        // ============================================
        features['bonus_per_90'] = (player.bonus || 0) / gamesPlayed;
        features['bps_per_90'] = (player.bps || 0) / gamesPlayed;
        
        // ============================================
        // 8. POSITION ENCODING
        // ============================================
        features['is_GKP'] = player.position_name === 'GKP' ? 1 : 0;
        features['is_DEF'] = player.position_name === 'DEF' ? 1 : 0;
        features['is_MID'] = player.position_name === 'MID' ? 1 : 0;
        features['is_FWD'] = player.position_name === 'FWD' ? 1 : 0;
        
        // ============================================
        // 9. CLEAN SHEETS
        // ============================================
        features['cs_per_game'] = (player.clean_sheets || 0) / gamesPlayed;
        if (historicalData && historicalData.length >= 5) {
            features['cs_rolling_5'] = this._calculateRollingAvg(historicalData, 5, 'clean_sheets');
        } else {
            features['cs_rolling_5'] = features['cs_per_game'];
        }
        
        // ============================================
        // 10. PRICE VALUE
        // ============================================
        const price = player.now_cost || 0;
        features['points_per_million'] = (player.total_points || 0) / (price / 10);
        features['form_per_million'] = features['form_5'] / (price / 10);
        
        return features;
    }

    /**
     * Predict next GW points
     */
    predict(player, historicalData = null) {
        // Extract features
        const features = this.extractFeatures(player, historicalData);
        
        // Calculate weighted sum
        let prediction = 0;
        let totalWeight = 0;
        
        for (const featureName of this.featureNames) {
            const featureValue = features[featureName] || 0;
            const weight = this.weights[featureName];
            
            prediction += featureValue * weight;
            totalWeight += weight;
        }
        
        // Normalize (weights should sum to 1, but just in case)
        if (totalWeight > 0) {
            prediction = prediction / totalWeight;
        }
        
        // Scale to realistic points range (2-15)
        // This scaling factor depends on your model training
        prediction = prediction * 10 + 2;
        
        // Cap at reasonable range
        prediction = Math.max(0, Math.min(20, prediction));
        
        return Math.round(prediction * 10) / 10;
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

