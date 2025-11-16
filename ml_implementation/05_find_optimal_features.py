#!/usr/bin/env python3
"""
Find the optimal number of features by testing different combinations
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import xgboost as xgb
import json

# Load previous feature importance
with open('model_weights_xgboost.json', 'r') as f:
    importance = json.load(f)

sorted_features = sorted(importance.items(), key=lambda x: x[1], reverse=True)

# Load data
df = pd.read_csv('features_data.csv')
y = df['target_next_gw_points'].fillna(0)

print("🔍 Testing different numbers of features...")
print("="*70)

results = []

# Test different feature counts: 10, 15, 20, 25, 30, 40, 50
for n_features in [10, 15, 20, 25, 30, 40, 50]:
    top_features = [f[0] for f in sorted_features[:n_features]]
    available = [f for f in top_features if f in df.columns]
    
    if len(available) < 5:
        continue
    
    X = df[available].copy()
    X = X.select_dtypes(include=[np.number])
    X = X.replace([np.inf, -np.inf], 0).fillna(0)
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    # Train XGBoost
    model = xgb.XGBRegressor(
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
    
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    results.append({
        'n_features': len(available),
        'mae': mae,
        'r2': r2,
        'improvement_vs_99': ((2.049 - mae) / 2.049) * 100
    })
    
    print(f"Features: {len(available):2d} | MAE: {mae:.3f} | R²: {r2:.3f} | vs 99f: {((2.049-mae)/2.049)*100:+.1f}%")

print("\n" + "="*70)
print("📊 SUMMARY")
print("="*70)

# Sort by MAE
results_sorted = sorted(results, key=lambda x: x['mae'])

print("\n🏆 Top 3 Best Configurations:")
for i, r in enumerate(results_sorted[:3], 1):
    print(f"{i}. {r['n_features']:2d} features: MAE {r['mae']:.3f}, R² {r['r2']:.3f} ({r['improvement_vs_99']:+.1f}% vs 99)")

# Find best balance (good MAE + fewer features)
print("\n💡 Best Trade-off (Accuracy + Speed):")
for r in results:
    if r['improvement_vs_99'] >= -2 and r['n_features'] <= 30:  # Within 2% of best, max 30 features
        reduction = ((99 - r['n_features']) / 99) * 100
        print(f"✅ {r['n_features']} features: MAE {r['mae']:.3f}, {reduction:.0f}% fewer features")
        break

print("\n" + "="*70)

