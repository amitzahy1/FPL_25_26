#!/usr/bin/env python3
"""
BALANCED MODEL - Best of both worlds!

Goal: Good MAE + Good Recall
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.metrics import (
    mean_absolute_error, 
    r2_score,
    precision_score,
    recall_score,
    f1_score
)
import xgboost as xgb
import json
import joblib

print("="*70)
print("⚖️ BALANCED MODEL - Best Trade-off")
print("="*70)

# Load data
df = pd.read_csv('features_data.csv')
df = df[df['minutes'] > 0].copy()

# Create enhanced features
if 'element' in df.columns and 'round' in df.columns:
    df = df.sort_values(['element', 'round'])

for col in ['total_points', 'minutes', 'goals_scored', 'assists']:
    if col in df.columns:
        df[f'{col}_last3'] = df.groupby('element')[col].transform(
            lambda x: x.rolling(3, min_periods=1).mean()
        )

# Select features
with open('model_weights_xgboost.json', 'r') as f:
    importance = json.load(f)

sorted_features = sorted(importance.items(), key=lambda x: x[1], reverse=True)
top_features = [f[0] for f in sorted_features[:30]]  # Top 30

enhanced = ['total_points_last3', 'minutes_last3', 'goals_scored_last3', 'assists_last3']
all_features = [f for f in top_features + enhanced if f in df.columns]

X = df[all_features].copy()
y = df['target_next_gw_points'].copy()

X = X.select_dtypes(include=[np.number]).replace([np.inf, -np.inf], 0).fillna(0)
y = y.fillna(0)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

print(f"\n📊 Dataset: {X.shape[1]} features, {len(X):,} samples")

# BALANCED weights (not too aggressive)
THRESHOLD = 3.0
y_train_binary = (y_train >= THRESHOLD).astype(int)
y_test_binary = (y_test >= THRESHOLD).astype(int)

n_samples = len(y_train_binary)
n_positive = y_train_binary.sum()
n_negative = n_samples - n_positive

# Moderate weights (not 2.1x, just 1.5x)
weight_positive = 1.5
weight_negative = 1.0

sample_weights = np.where(y_train_binary == 1, weight_positive, weight_negative)

print(f"⚖️ Balanced Weights: 1.5x for good players (vs 2.1x in Ultimate)")

# Train with optimized hyperparameters
print("\n🤖 Training BALANCED XGBoost...")

model = xgb.XGBRegressor(
    n_estimators=250,
    max_depth=6,
    learning_rate=0.04,
    subsample=0.85,
    colsample_bytree=0.85,
    min_child_weight=3,
    gamma=0.08,
    reg_alpha=0.05,
    reg_lambda=0.5,
    random_state=42,
    n_jobs=-1,
    verbosity=0
)

model.fit(X_train, y_train, sample_weight=sample_weights)

y_pred_test = model.predict(X_test)

# Metrics
mae = mean_absolute_error(y_test, y_pred_test)
r2 = r2_score(y_test, y_pred_test)
within_2 = (np.abs(y_test - y_pred_test) <= 2).mean() * 100

y_pred_test_binary = (y_pred_test >= THRESHOLD).astype(int)
precision = precision_score(y_test_binary, y_pred_test_binary, zero_division=0)
recall = recall_score(y_test_binary, y_pred_test_binary, zero_division=0)
f1 = f1_score(y_test_binary, y_pred_test_binary, zero_division=0)

print(f"\n📈 BALANCED MODEL RESULTS:")
print(f"="*70)
print(f"Regression:")
print(f"  MAE:        {mae:.3f}")
print(f"  R²:         {r2:.3f}")
print(f"  ±2 points:  {within_2:.1f}%")
print(f"\nClassification (3+ points):")
print(f"  Precision:  {precision*100:.1f}%")
print(f"  Recall:     {recall*100:.1f}%")
print(f"  F1-Score:   {f1*100:.1f}%")

# Comparison table
print(f"\n{'='*70}")
print(f"📊 3-WAY COMPARISON")
print(f"{'='*70}")
print(f"\n{'Metric':<15} | {'OLD':<12} | {'ULTIMATE':<12} | {'BALANCED':<12} | Best")
print("-"*70)

comparisons = [
    ('MAE', 2.050, 2.447, mae, 'lower'),
    ('±2 points', 63.2, 45.2, within_2, 'higher'),
    ('Precision', 43.0, 36.1, precision*100, 'higher'),
    ('Recall', 56.0, 85.6, recall*100, 'higher'),
    ('F1', 49.0, 50.8, f1*100, 'higher')
]

for metric, old, ultimate, balanced, direction in comparisons:
    values = {'OLD': old, 'ULTIMATE': ultimate, 'BALANCED': balanced}
    
    if direction == 'lower':
        best = min(values, key=values.get)
    else:
        best = max(values, key=values.get)
    
    print(f"{metric:<15} | {old:>11.1f} | {ultimate:>11.1f} | {balanced:>11.1f} | {best} 🏆")

# Export
weights = {
    'model_type': 'XGBoost Balanced',
    'version': '3.0',
    'n_features': len(X.columns),
    'features': list(X.columns),
    'mae': float(mae),
    'r2': float(r2),
    'precision': float(precision),
    'recall': float(recall),
    'f1': float(f1),
    'within_2': float(within_2),
    'feature_importance': {k: float(v) for k, v in zip(X.columns, model.feature_importances_)}
}

with open('model_weights_balanced.json', 'w') as f:
    json.dump(weights, f, indent=2)

joblib.dump(model, 'best_model_balanced.pkl')

print(f"\n✅ Saved to model_weights_balanced.json")
print(f"✅ Saved to best_model_balanced.pkl")

# Recommendation
print(f"\n{'='*70}")
print(f"💡 RECOMMENDATION")
print(f"{'='*70}")

# Calculate balanced score (MAE + F1)
score_old = (2.05 / 2.5) * 0.5 + (49 / 100) * 0.5
score_ultimate = (2.45 / 2.5) * 0.5 + (50.8 / 100) * 0.5
score_balanced = (mae / 2.5) * 0.5 + (f1 * 100 / 100) * 0.5

print(f"\nBalanced Score (50% MAE + 50% F1):")
print(f"  OLD:      {score_old:.3f}")
print(f"  ULTIMATE: {score_ultimate:.3f}")
print(f"  BALANCED: {score_balanced:.3f}")

best_overall = max([('OLD', score_old), ('ULTIMATE', score_ultimate), ('BALANCED', score_balanced)], key=lambda x: x[1])

print(f"\n🏆 Winner: {best_overall[0]}")

if best_overall[0] == 'BALANCED':
    print(f"\n✅ Use BALANCED model for deployment!")
    print(f"   • Good accuracy (MAE {mae:.2f})")
    print(f"   • Good recall ({recall*100:.0f}%)")
    print(f"   • Best overall trade-off")
elif best_overall[0] == 'OLD':
    print(f"\n✅ Use OLD model if accuracy is most important")
elif best_overall[0] == 'ULTIMATE':
    print(f"\n✅ Use ULTIMATE model if finding good players is most important")

print(f"\n{'='*70}")
print(f"✅ ANALYSIS COMPLETE!")
print(f"{'='*70}")

