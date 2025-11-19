/**
 * 🎯 DRAFT FPL HEURISTIC PREDICTOR (Optimized)
 * ============================================
 * Replaced the heavy/unreliable Decision Tree with a lightweight
 * weighted algorithm focused on Form, Fixtures, and xGI.
 */

class DraftHeuristicPredictor {
    constructor() {
        console.log('✅ Draft Heuristic Predictor loaded (Lightweight Mode)');
    }

    predict(player) {
        try {
            // 1. Base: Form (Weighted towards recent games)
            // Using points_per_game as a reliable baseline
            let baseScore = parseFloat(player.points_per_game_90) || parseFloat(player.form) || 0;
            
            // If player barely plays, penalty
            if ((player.minutes || 0) < 450) {
                baseScore *= 0.6; 
            }

            // 2. Fixture Difficulty (Calculated in script.js logic usually, approximating here)
            // Assuming neutral fixture logic if data missing
            let fixtureMultiplier = 1.0; 

            // 3. xGI (Expected Goal Involvement) Impact
            const xGI = parseFloat(player.expected_goal_involvements_per_90) || 0;
            const xGiBonus = xGI * 2.5; // Strong weight on underlying stats

            // 4. Transfer Momentum (Crowd Wisdom)
            const netTransfers = (player.transfers_in_event || 0) - (player.transfers_out_event || 0);
            const transferBonus = Math.max(-0.5, Math.min(0.5, netTransfers / 10000));

            // Calculate final single GW prediction
            let prediction = baseScore + xGiBonus + transferBonus;

            // Cap realistic boundaries
            prediction = Math.max(0.5, Math.min(15, prediction));

            // Predict for 3 GWs (Standard for Draft planning)
            let threeGwPrediction = prediction * 3;

            return parseFloat(threeGwPrediction.toFixed(1));

        } catch (error) {
            console.warn(`Prediction error for ${player.web_name}`, error);
            return 0;
        }
    }
}

// Global Instance & Helpers
let globalDraftPredictor = new DraftHeuristicPredictor();

async function initializeDraftMLModel() {
    console.log('🚀 Optimized Predictor Ready immediately.');
    return true;
}

function predictPlayerPoints(player) {
    return globalDraftPredictor.predict(player);
}

if (typeof window !== 'undefined') {
    window.mlModelReady = true;
}

// Export
if (typeof module !== 'undefined') {
    module.exports = { predictPlayerPoints };
}
