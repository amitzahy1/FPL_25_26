#!/usr/bin/env python3
"""
ULTIMATE OPTIMIZED MODEL - All improvements combined!

1. ✅ Filter only playing players (minutes > 0)
2. ✅ Better features (last 3 games, trends)
3. ✅ Class weights for imbalanced data
4. ✅ Optimized threshold (3+ instead of 5+)
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    mean_absolute_error, 
    mean_squared_error, 
    r2_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report
)
import xgboost as xgb
import json
import joblib

print("="*70)
print("🚀 ULTIMATE OPTIMIZED MODEL")
print("="*70)

# ============================================================
# STEP 1: LOAD AND FILTER DATA
# ============================================================
print("\n📂 Loading data...")
df = pd.read_csv('features_data.csv')
print(f"  Original rows: {len(df):,}")

# Filter: Only players who actually played
df = df[df['minutes'] > 0].copy()
print(f"  After filtering (minutes > 0): {len(df):,}")
print(f"  Removed: {((1 - len(df)/94391)*100):.1f}% non-playing rows")

# ============================================================
# STEP 2: CREATE BETTER FEATURES
# ============================================================
print("\n🔧 Creating enhanced features...")

# Sort by player and gameweek for rolling calculations
if 'element' in df.columns and 'round' in df.columns:
    df = df.sort_values(['element', 'round'])

# Last 3 games average (more recent = more important!)
for col in ['total_points', 'minutes', 'goals_scored', 'assists', 
            'clean_sheets', 'saves', 'bonus']:
    if col in df.columns:
        df[f'{col}_last3'] = df.groupby('element')[col].transform(
            lambda x: x.rolling(3, min_periods=1).mean()
        )

# Form trend (going up or down?)
if 'form' in df.columns:
    df['form_trend'] = df.groupby('element')['form'].transform(
        lambda x: x.diff()
    ).fillna(0)

# Minutes consistency (reliable starter?)
if 'minutes' in df.columns:
    df['minutes_last3_std'] = df.groupby('element')['minutes'].transform(
        lambda x: x.rolling(3, min_periods=1).std()
    ).fillna(0)

# Hot streak detector
if 'total_points' in df.columns:
    df['hot_streak'] = (df['total_points_last3'] > 5).astype(int)

print(f"  Added enhanced features ✅")

# ============================================================
# STEP 3: SELECT BEST FEATURES
# ============================================================
print("\n📊 Selecting optimal features...")

# Load previous importance
with open('model_weights_xgboost.json', 'r') as f:
    importance = json.load(f)

sorted_features = sorted(importance.items(), key=lambda x: x[1], reverse=True)

# Top 25 original features
top_original = [f[0] for f in sorted_features[:25]]

# Add our new enhanced features
enhanced_features = [
    'total_points_last3', 'minutes_last3', 'goals_scored_last3',
    'assists_last3', 'clean_sheets_last3', 'saves_last3',
    'form_trend', 'minutes_last3_std', 'hot_streak'
]

# Combine
all_features = []
for f in top_original + enhanced_features:
    if f in df.columns:
        all_features.append(f)

print(f"  Original top features: {len([f for f in top_original if f in df.columns])}")
print(f"  Enhanced features: {len([f for f in enhanced_features if f in df.columns])}")
print(f"  Total features: {len(all_features)}")

# ============================================================
# STEP 4: PREPARE X AND Y
# ============================================================
X = df[all_features].copy()
y = df['target_next_gw_points'].copy()

# Clean
X = X.select_dtypes(include=[np.number])
X = X.replace([np.inf, -np.inf], 0).fillna(0)
y = y.fillna(0)

print(f"\n📊 Final dataset:")
print(f"  Features: {X.shape[1]}")
print(f"  Samples: {X.shape[0]:,}")

# Split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

print(f"  Train: {len(X_train):,}")
print(f"  Test:  {len(X_test):,}")

# ============================================================
# STEP 5: CALCULATE CLASS WEIGHTS
# ============================================================
THRESHOLD = 3.0  # Changed from 5 to 3!

y_train_binary = (y_train >= THRESHOLD).astype(int)
y_test_binary = (y_test >= THRESHOLD).astype(int)

# Calculate weights
n_samples = len(y_train_binary)
n_positive = y_train_binary.sum()
n_negative = n_samples - n_positive

weight_positive = n_samples / (2 * n_positive) if n_positive > 0 else 1
weight_negative = n_samples / (2 * n_negative) if n_negative > 0 else 1

# Create sample weights for XGBoost
sample_weights = np.where(y_train_binary == 1, weight_positive, weight_negative)

print(f"\n⚖️ Class Weights (for {THRESHOLD}+ points):")
print(f"  Negative class (<{THRESHOLD}): {weight_negative:.2f}")
print(f"  Positive class (≥{THRESHOLD}): {weight_positive:.2f}")
print(f"  Ratio: {weight_positive/weight_negative:.1f}x more weight to good players")

# ============================================================
# STEP 6: TRAIN ULTIMATE MODEL
# ============================================================
print("\n" + "="*70)
print("🤖 TRAINING ULTIMATE XGBOOST MODEL")
print("="*70)

model = xgb.XGBRegressor(
    n_estimators=300,  # More trees
    max_depth=7,       # Slightly deeper
    learning_rate=0.03, # Slower learning
    subsample=0.8,
    colsample_bytree=0.8,
    min_child_weight=2,  # Less conservative
    gamma=0.05,          # Less conservative
    reg_alpha=0.1,       # L1 regularization
    reg_lambda=1.0,      # L2 regularization
    random_state=42,
    n_jobs=-1,
    verbosity=0
)

print("Training with sample weights...")
model.fit(X_train, y_train, sample_weight=sample_weights)

# Predictions
y_pred_train = model.predict(X_train)
y_pred_test = model.predict(X_test)

# ============================================================
# STEP 7: REGRESSION METRICS
# ============================================================
print("\n" + "="*70)
print("📈 REGRESSION METRICS")
print("="*70)

mae = mean_absolute_error(y_test, y_pred_test)
rmse = np.sqrt(mean_squared_error(y_test, y_pred_test))
r2 = r2_score(y_test, y_pred_test)

within_1 = (np.abs(y_test - y_pred_test) <= 1).mean() * 100
within_2 = (np.abs(y_test - y_pred_test) <= 2).mean() * 100
within_3 = (np.abs(y_test - y_pred_test) <= 3).mean() * 100

print(f"✅ MAE:  {mae:.3f} נקודות")
print(f"✅ RMSE: {rmse:.3f} נקודות")
print(f"✅ R²:   {r2:.3f} ({r2*100:.1f}%)")
print(f"\n📊 Accuracy Within Range:")
print(f"   ±1 point:  {within_1:.1f}%")
print(f"   ±2 points: {within_2:.1f}%")
print(f"   ±3 points: {within_3:.1f}%")

# ============================================================
# STEP 8: CLASSIFICATION METRICS
# ============================================================
print("\n" + "="*70)
print(f"🎯 CLASSIFICATION METRICS ({THRESHOLD}+ points)")
print("="*70)

y_pred_test_binary = (y_pred_test >= THRESHOLD).astype(int)

precision = precision_score(y_test_binary, y_pred_test_binary, zero_division=0)
recall = recall_score(y_test_binary, y_pred_test_binary, zero_division=0)
f1 = f1_score(y_test_binary, y_pred_test_binary, zero_division=0)

print(f"✅ Precision: {precision:.3f} ({precision*100:.1f}%)")
print(f"✅ Recall:    {recall:.3f} ({recall*100:.1f}%)")
print(f"✅ F1-Score:  {f1:.3f} ({f1*100:.1f}%)")

# ============================================================
# STEP 9: COMPARISON WITH OLD MODEL
# ============================================================
print("\n" + "="*70)
print("📊 OLD vs ULTIMATE MODEL")
print("="*70)

comparison = {
    'OLD (99 features, all players)': {
        'mae': 2.050,
        'within_2': 63.2,
        'precision_5': 50.8,
        'recall_5': 6.7,
        'f1_5': 11.9,
        'precision_3': 43.0,
        'recall_3': 56.0,
        'f1_3': 49.0
    },
    'ULTIMATE (optimized)': {
        'mae': mae,
        'within_2': within_2,
        'precision_3': precision * 100,
        'recall_3': recall * 100,
        'f1_3': f1 * 100
    }
}

print("\nRegression:")
print(f"  MAE:        {comparison['OLD (99 features, all players)']['mae']:.3f} → {mae:.3f}")
print(f"  ±2 points:  {comparison['OLD (99 features, all players)']['within_2']:.1f}% → {within_2:.1f}%")

print(f"\nClassification (3+ points - our new target!):")
print(f"  Precision:  {comparison['OLD (99 features, all players)']['precision_3']:.1f}% → {precision*100:.1f}%")
print(f"  Recall:     {comparison['OLD (99 features, all players)']['recall_3']:.1f}% → {recall*100:.1f}%")
print(f"  F1-Score:   {comparison['OLD (99 features, all players)']['f1_3']:.1f}% → {f1*100:.1f}%")

# Calculate improvements
mae_improvement = ((comparison['OLD (99 features, all players)']['mae'] - mae) / comparison['OLD (99 features, all players)']['mae']) * 100
f1_improvement = ((f1*100 - comparison['OLD (99 features, all players)']['f1_3']) / comparison['OLD (99 features, all players)']['f1_3']) * 100
recall_improvement = ((recall*100 - comparison['OLD (99 features, all players)']['recall_3']) / comparison['OLD (99 features, all players)']['recall_3']) * 100

print(f"\n🎉 Improvements:")
print(f"  MAE:     {mae_improvement:+.1f}%")
print(f"  F1:      {f1_improvement:+.1f}%")
print(f"  Recall:  {recall_improvement:+.1f}%")

# ============================================================
# STEP 10: EXPORT ULTIMATE MODEL
# ============================================================
print("\n" + "="*70)
print("📤 EXPORTING ULTIMATE MODEL")
print("="*70)

# Get feature importance
feature_importance = dict(zip(X.columns, model.feature_importances_))

# Export weights
weights = {
    'model_type': 'XGBoost Ultimate',
    'version': '2.0',
    'threshold': THRESHOLD,
    'n_features': len(X.columns),
    'features': list(X.columns),
    'mae': float(mae),
    'r2': float(r2),
    'precision': float(precision),
    'recall': float(recall),
    'f1': float(f1),
    'within_2': float(within_2),
    'feature_importance': {k: float(v) for k, v in feature_importance.items()}
}

with open('model_weights_ultimate.json', 'w') as f:
    json.dump(weights, f, indent=2)

print(f"✅ Saved to model_weights_ultimate.json")

# Save model
joblib.dump(model, 'best_model_ultimate.pkl')
print(f"✅ Saved to best_model_ultimate.pkl")

# Top features
print(f"\n🏆 Top 10 Most Important Features:")
sorted_importance = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
for i, (feat, imp) in enumerate(sorted_importance[:10], 1):
    print(f"  {i:2d}. {feat:30s} {imp:.4f}")

print("\n" + "="*70)
print("✅ ULTIMATE MODEL COMPLETE!")
print("="*70)

print(f"\n📊 Summary:")
print(f"  • {len(X.columns)} features (vs 99 original)")
print(f"  • {mae:.3f} MAE (vs 2.050 original)")
print(f"  • {f1*100:.1f}% F1 for 3+ points (vs 49% original)")
print(f"  • Trained on {len(X_train):,} playing players")
print(f"  • Ready for deployment! 🚀")

