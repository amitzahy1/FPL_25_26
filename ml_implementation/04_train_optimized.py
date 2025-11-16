#!/usr/bin/env python3
"""
Train OPTIMIZED ML model with only the most important features
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb
import json
import joblib

# Load previous feature importance
print("📊 Loading previous feature importance...")
with open('model_weights_xgboost.json', 'r') as f:
    importance = json.load(f)

# Sort and select top features
sorted_features = sorted(importance.items(), key=lambda x: x[1], reverse=True)
TOP_N = 20  # Use only top 20 features

top_features = [f[0] for f in sorted_features[:TOP_N]]

print(f"\n✅ Selected Top {TOP_N} Features:")
for i, (feat, imp) in enumerate(sorted_features[:TOP_N], 1):
    pct = (imp / sum(importance.values())) * 100
    print(f"  {i:2d}. {feat:35s} {pct:5.2f}%")

total_importance = sum([f[1] for f in sorted_features[:TOP_N]])
total_all = sum(importance.values())
print(f"\n📊 Coverage: {(total_importance/total_all)*100:.1f}% of total importance")

# Load data
print("\n📂 Loading features data...")
df = pd.read_csv('features_data.csv')

print(f"  Total rows: {len(df):,}")

# Filter to only include top features + target
available_features = [f for f in top_features if f in df.columns]
print(f"\n✅ Available features: {len(available_features)}/{TOP_N}")

if len(available_features) < TOP_N:
    missing = set(top_features) - set(available_features)
    print(f"⚠️  Missing features: {missing}")

# Prepare X and y
X = df[available_features].copy()
y = df['target_next_gw_points'].copy()

# Ensure numeric and handle missing values
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

print(f"\n📊 Train/Test Split:")
print(f"  Train: {len(X_train):,}")
print(f"  Test:  {len(X_test):,}")

# ============================================================
# TRAIN RANDOM FOREST
# ============================================================
print("\n" + "="*60)
print("TRAINING RANDOM FOREST (Optimized)")
print("="*60)

rf_model = RandomForestRegressor(
    n_estimators=100,
    max_depth=15,
    min_samples_split=20,
    min_samples_leaf=10,
    max_features='sqrt',
    random_state=42,
    n_jobs=-1,
    verbose=0
)

print("Training...")
rf_model.fit(X_train, y_train)

rf_pred_train = rf_model.predict(X_train)
rf_pred_test = rf_model.predict(X_test)

rf_mae_train = mean_absolute_error(y_train, rf_pred_train)
rf_mae_test = mean_absolute_error(y_test, rf_pred_test)
rf_rmse_train = np.sqrt(mean_squared_error(y_train, rf_pred_train))
rf_rmse_test = np.sqrt(mean_squared_error(y_test, rf_pred_test))
rf_r2_train = r2_score(y_train, rf_pred_train)
rf_r2_test = r2_score(y_test, rf_pred_test)

print("\n📊 Random Forest Results:")
print(f"  Train MAE:  {rf_mae_train:.3f}")
print(f"  Test MAE:   {rf_mae_test:.3f}")
print(f"  Train RMSE: {rf_rmse_train:.3f}")
print(f"  Test RMSE:  {rf_rmse_test:.3f}")
print(f"  Train R²:   {rf_r2_train:.3f}")
print(f"  Test R²:    {rf_r2_test:.3f}")

# ============================================================
# TRAIN XGBOOST
# ============================================================
print("\n" + "="*60)
print("TRAINING XGBOOST (Optimized)")
print("="*60)

xgb_model = xgb.XGBRegressor(
    n_estimators=200,
    max_depth=6,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    min_child_weight=3,
    gamma=0.1,
    random_state=42,
    n_jobs=-1,
    verbosity=0
)

print("Training...")
xgb_model.fit(X_train, y_train)

xgb_pred_train = xgb_model.predict(X_train)
xgb_pred_test = xgb_model.predict(X_test)

xgb_mae_train = mean_absolute_error(y_train, xgb_pred_train)
xgb_mae_test = mean_absolute_error(y_test, xgb_pred_test)
xgb_rmse_train = np.sqrt(mean_squared_error(y_train, xgb_pred_train))
xgb_rmse_test = np.sqrt(mean_squared_error(y_test, xgb_pred_test))
xgb_r2_train = r2_score(y_train, xgb_pred_train)
xgb_r2_test = r2_score(y_test, xgb_pred_test)

print("\n📊 XGBoost Results:")
print(f"  Train MAE:  {xgb_mae_train:.3f}")
print(f"  Test MAE:   {xgb_mae_test:.3f}")
print(f"  Train RMSE: {xgb_rmse_train:.3f}")
print(f"  Test RMSE:  {xgb_rmse_test:.3f}")
print(f"  Train R²:   {xgb_r2_train:.3f}")
print(f"  Test R²:    {xgb_r2_test:.3f}")

# ============================================================
# COMPARISON
# ============================================================
print("\n" + "="*60)
print("COMPARISON")
print("="*60)
print(f"Random Forest Test MAE: {rf_mae_test:.3f}")
print(f"XGBoost Test MAE:       {xgb_mae_test:.3f}")

if xgb_mae_test < rf_mae_test:
    print("Winner: XGBoost 🏆")
    best_model = xgb_model
    best_name = "XGBoost"
    best_mae = xgb_mae_test
    best_r2 = xgb_r2_test
else:
    print("Winner: Random Forest 🏆")
    best_model = rf_model
    best_name = "Random Forest"
    best_mae = rf_mae_test
    best_r2 = rf_r2_test

# ============================================================
# EXPORT OPTIMIZED MODEL
# ============================================================
print("\n📤 Exporting optimized model...")

# Get feature importance from best model
if best_name == "XGBoost":
    feature_importance = dict(zip(X.columns, best_model.feature_importances_))
else:
    feature_importance = dict(zip(X.columns, best_model.feature_importances_))

# Export weights
weights = {
    'model_type': best_name,
    'n_features': len(X.columns),
    'features': list(X.columns),
    'mae': float(best_mae),
    'r2': float(best_r2),
    'feature_importance': {k: float(v) for k, v in feature_importance.items()}
}

with open('model_weights_optimized.json', 'w') as f:
    json.dump(weights, f, indent=2)

print(f"✅ Saved optimized weights to model_weights_optimized.json")

# Save model
joblib.dump(best_model, 'best_model_optimized.pkl')
print(f"✅ Saved model to best_model_optimized.pkl")

# ============================================================
# COMPARISON WITH OLD MODEL
# ============================================================
print("\n" + "="*60)
print("📊 OLD vs OPTIMIZED MODEL")
print("="*60)

# Load old results from training_log
print("\nOLD MODEL (99 features):")
print("  Test MAE:  2.049")
print("  Test R²:   0.092")

print(f"\nOPTIMIZED MODEL ({len(X.columns)} features):")
print(f"  Test MAE:  {best_mae:.3f}")
print(f"  Test R²:   {best_r2:.3f}")

improvement = ((2.049 - best_mae) / 2.049) * 100
print(f"\n{'🎉' if improvement > 0 else '⚠️'} MAE Improvement: {improvement:+.1f}%")
print(f"{'✅' if len(X.columns) < 99 else '❌'} Features reduced: 99 → {len(X.columns)} ({((99-len(X.columns))/99)*100:.0f}% reduction)")

print("\n" + "="*60)
print("✅ OPTIMIZATION COMPLETE!")
print("="*60)

