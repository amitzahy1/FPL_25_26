#!/usr/bin/env python3
"""
Comprehensive model evaluation with ALL metrics
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    mean_absolute_error, 
    mean_squared_error, 
    r2_score,
    mean_absolute_percentage_error,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix
)
import xgboost as xgb
import json

print("="*70)
print("📊 COMPREHENSIVE MODEL EVALUATION")
print("="*70)

# Load data
df = pd.read_csv('features_data.csv')

# Test both: 99 features vs 20 features
configs = [
    {
        'name': 'ALL FEATURES (99)',
        'n_features': 99
    },
    {
        'name': 'OPTIMIZED (20)',
        'n_features': 20
    }
]

all_results = []

for config in configs:
    print(f"\n{'='*70}")
    print(f"🔬 Testing: {config['name']}")
    print(f"{'='*70}")
    
    # Load feature importance and select top N
    with open('model_weights_xgboost.json', 'r') as f:
        importance = json.load(f)
    
    sorted_features = sorted(importance.items(), key=lambda x: x[1], reverse=True)
    
    if config['n_features'] < 99:
        top_features = [f[0] for f in sorted_features[:config['n_features']]]
        available = [f for f in top_features if f in df.columns]
    else:
        # Use all numeric columns except target and identifiers
        exclude = ['target_next_gw_points', 'season', 'name', 'team', 
                   'opponent_team', 'fixture', 'kickoff_time_formatted']
        available = [col for col in df.columns if col not in exclude]
        available = df[available].select_dtypes(include=[np.number]).columns.tolist()
    
    X = df[available].copy()
    y = df['target_next_gw_points'].copy()
    
    # Clean data
    X = X.select_dtypes(include=[np.number])
    X = X.replace([np.inf, -np.inf], 0).fillna(0)
    y = y.fillna(0)
    
    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    print(f"📊 Features: {X.shape[1]}")
    print(f"📊 Samples: Train {len(X_train):,} | Test {len(X_test):,}")
    
    # Train XGBoost
    print("\n🤖 Training XGBoost...")
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
    
    # ============================================================
    # REGRESSION METRICS
    # ============================================================
    print("\n" + "="*70)
    print("📈 REGRESSION METRICS (חיזוי נקודות מדויק)")
    print("="*70)
    
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)
    
    # MAPE (avoid division by zero)
    mask = y_test != 0
    if mask.sum() > 0:
        mape = mean_absolute_percentage_error(y_test[mask], y_pred[mask])
    else:
        mape = float('inf')
    
    # Within N points accuracy
    within_1 = (np.abs(y_test - y_pred) <= 1).mean() * 100
    within_2 = (np.abs(y_test - y_pred) <= 2).mean() * 100
    within_3 = (np.abs(y_test - y_pred) <= 3).mean() * 100
    
    print(f"✅ MAE (Mean Absolute Error):        {mae:.3f} נקודות")
    print(f"   → בממוצע טועים ב-{mae:.2f} נקודות")
    print(f"\n✅ RMSE (Root Mean Squared Error):   {rmse:.3f} נקודות")
    print(f"   → עונש על טעויות גדולות")
    print(f"\n✅ R² Score:                         {r2:.3f}")
    print(f"   → {r2*100:.1f}% מהשונות מוסברת על ידי המודל")
    print(f"\n✅ MAPE (Mean Absolute % Error):     {mape:.1%}")
    print(f"   → אחוז טעות ממוצע")
    
    print(f"\n📊 Accuracy Within Range:")
    print(f"   ±1 point:  {within_1:.1f}%  {'🟢' if within_1 > 40 else '🟡' if within_1 > 30 else '🔴'}")
    print(f"   ±2 points: {within_2:.1f}%  {'🟢' if within_2 > 60 else '🟡' if within_2 > 50 else '🔴'}")
    print(f"   ±3 points: {within_3:.1f}%  {'🟢' if within_3 > 75 else '🟡' if within_3 > 65 else '🔴'}")
    
    # ============================================================
    # CLASSIFICATION METRICS
    # ============================================================
    print("\n" + "="*70)
    print("🎯 CLASSIFICATION METRICS (האם השחקן טוב?)")
    print("="*70)
    
    # Convert to binary: "good player" = 5+ points
    THRESHOLD = 5.0
    y_test_binary = (y_test >= THRESHOLD).astype(int)
    y_pred_binary = (y_pred >= THRESHOLD).astype(int)
    
    precision = precision_score(y_test_binary, y_pred_binary, zero_division=0)
    recall = recall_score(y_test_binary, y_pred_binary, zero_division=0)
    f1 = f1_score(y_test_binary, y_pred_binary, zero_division=0)
    
    print(f"השאלה: 'האם השחקן יקבל {THRESHOLD}+ נקודות?'\n")
    
    print(f"✅ Precision (דיוק חיובי):     {precision:.3f} ({precision*100:.1f}%)")
    print(f"   → כשאנחנו אומרים 'כן', כמה פעמים אנחנו צודקים")
    print(f"   → מתוך כל החיזויים ל-{THRESHOLD}+, {precision*100:.0f}% באמת קיבלו {THRESHOLD}+")
    
    print(f"\n✅ Recall (כיסוי):             {recall:.3f} ({recall*100:.1f}%)")
    print(f"   → מתוך כל השחקנים שקיבלו {THRESHOLD}+, כמה זיהינו")
    print(f"   → תפסנו {recall*100:.0f}% מהשחקנים הטובים")
    
    print(f"\n✅ F1-Score (ממוצע הרמוני):   {f1:.3f} ({f1*100:.1f}%)")
    print(f"   → איזון בין Precision ל-Recall")
    
    # Confusion Matrix
    cm = confusion_matrix(y_test_binary, y_pred_binary)
    tn, fp, fn, tp = cm.ravel()
    
    print(f"\n📊 Confusion Matrix:")
    print(f"   ┌─────────────┬─────────────┐")
    print(f"   │             │   חיזוי     │")
    print(f"   │             ├──────┬──────┤")
    print(f"   │             │  לא  │  כן  │")
    print(f"   ├─────────────┼──────┼──────┤")
    print(f"   │ אמת │  לא   │ {tn:5d} │ {fp:4d} │ ← False Positive")
    print(f"   │     ├───────┼──────┼──────┤")
    print(f"   │     │  כן   │ {fn:5d} │ {tp:4d} │ ← True Positive")
    print(f"   └─────────────┴──────┴──────┘")
    print(f"                      ↑")
    print(f"              False Negative")
    
    total = tn + fp + fn + tp
    accuracy = (tn + tp) / total
    print(f"\n✅ Accuracy (דיוק כללי): {accuracy:.3f} ({accuracy*100:.1f}%)")
    
    # Additional thresholds
    print(f"\n" + "="*70)
    print(f"📊 Different Thresholds:")
    print(f"="*70)
    
    for thresh in [3, 5, 7, 10]:
        y_test_bin = (y_test >= thresh).astype(int)
        y_pred_bin = (y_pred >= thresh).astype(int)
        
        if y_test_bin.sum() == 0:
            continue
        
        prec = precision_score(y_test_bin, y_pred_bin, zero_division=0)
        rec = recall_score(y_test_bin, y_pred_bin, zero_division=0)
        f1_s = f1_score(y_test_bin, y_pred_bin, zero_division=0)
        
        print(f"{thresh}+ points: Precision {prec:.2f} | Recall {rec:.2f} | F1 {f1_s:.2f}")
    
    # Store results
    all_results.append({
        'name': config['name'],
        'n_features': X.shape[1],
        'mae': mae,
        'rmse': rmse,
        'r2': r2,
        'within_2': within_2,
        'precision': precision,
        'recall': recall,
        'f1': f1,
        'accuracy': accuracy
    })

# ============================================================
# FINAL COMPARISON
# ============================================================
print("\n\n" + "="*70)
print("🏆 FINAL COMPARISON")
print("="*70)

print(f"\n{'Metric':<20} | {'99 Features':<15} | {'20 Features':<15} | Winner")
print("-"*70)

for metric in ['mae', 'rmse', 'r2', 'within_2', 'precision', 'recall', 'f1', 'accuracy']:
    val_99 = all_results[0][metric]
    val_20 = all_results[1][metric]
    
    # Lower is better for MAE, RMSE
    if metric in ['mae', 'rmse']:
        winner = '99 🏆' if val_99 < val_20 else '20 🏆'
        diff = ((val_20 - val_99) / val_99) * 100
        sign = '+' if diff > 0 else ''
    # Higher is better for others
    else:
        winner = '99 🏆' if val_99 > val_20 else '20 🏆'
        diff = ((val_20 - val_99) / val_99) * 100
        sign = '+' if diff > 0 else ''
    
    print(f"{metric.upper():<20} | {val_99:>14.3f} | {val_20:>14.3f} | {winner} ({sign}{diff:.1f}%)")

print("\n" + "="*70)
print("✅ EVALUATION COMPLETE!")
print("="*70)

