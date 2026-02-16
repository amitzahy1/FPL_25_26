#!/usr/bin/env python3
"""
Train Decision Tree for Draft FPL
Remove price features, focus on performance
"""

import pandas as pd
import numpy as np
from sklearn.tree import DecisionTreeRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import json
import joblib

def prepare_draft_data(df):
    """Remove price features and prepare for training"""
    
    print("\n🎯 Preparing Draft FPL Data...")
    print("="*60)
    
    # Remove price-based features
    price_features = ['value', 'points_per_million', 'form_per_million']
    removed = []
    for feat in price_features:
        if feat in df.columns:
            df = df.drop(columns=[feat])
            removed.append(feat)
    
    print(f"✅ Removed price features: {', '.join(removed)}")
    
    # Remove non-numeric columns
    non_numeric = ['name', 'position', 'team', 'kickoff_time', 'kickoff_time_formatted']
    for col in non_numeric:
        if col in df.columns:
            df = df.drop(columns=[col])
    
    # Select only numeric columns
    X = df.drop(columns=['target_next_gw_points'], errors='ignore')
    X = X.select_dtypes(include=[np.number])
    
    y = df['target_next_gw_points'] if 'target_next_gw_points' in df.columns else None
    
    print(f"✅ Features: {len(X.columns)}")
    print(f"✅ Samples: {len(X):,}")
    
    return X, y

def train_draft_model(X, y):
    """Train Decision Tree for Draft FPL"""
    
    print("\n🎯 Training Draft FPL Model...")
    print("="*60)
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    print(f"📊 Training samples: {len(X_train):,}")
    print(f"📊 Testing samples: {len(X_test):,}")
    
    # Train Decision Tree
    print("\n🌳 Training Decision Tree...")
    model = DecisionTreeRegressor(
        max_depth=15,  # Deeper for more accuracy
        min_samples_split=50,
        min_samples_leaf=20,
        random_state=42
    )
    
    model.fit(X_train, y_train)
    
    # Predict
    y_pred = model.predict(X_test)
    
    # Evaluate
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)
    
    # Within ±2 points
    within_2 = np.mean(np.abs(y_test - y_pred) <= 2) * 100
    
    print("\n✅ Model Performance:")
    print(f"  📊 MAE: {mae:.3f}")
    print(f"  📊 RMSE: {rmse:.3f}")
    print(f"  📊 R²: {r2:.3f}")
    print(f"  🎯 Within ±2 points: {within_2:.1f}%")
    
    # Feature importance
    feature_importance = dict(zip(X.columns, model.feature_importances_))
    top_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)[:30]
    
    print("\n🏆 Top 30 Features:")
    print("="*60)
    for i, (feat, imp) in enumerate(top_features, 1):
        print(f"{i:2d}. {feat:35s} {imp*100:6.2f}%")
    
    return model, {
        'mae': mae,
        'rmse': rmse,
        'r2': r2,
        'within_2': within_2
    }

def tree_to_dict(tree, feature_names):
    """Export Decision Tree to dictionary format"""
    tree_ = tree.tree_
    
    def recurse(node):
        if tree_.feature[node] != -2:  # Not a leaf
            feature_name = feature_names[tree_.feature[node]]
            threshold = float(tree_.threshold[node])
            
            return {
                'feature': feature_name,
                'threshold': threshold,
                'left': recurse(tree_.children_left[node]),
                'right': recurse(tree_.children_right[node])
            }
        else:  # Leaf node
            return {'value': float(tree_.value[node][0])}
    
    return recurse(0)

def export_model_to_json(model, feature_names, metrics, output_file='decision_tree_draft.json'):
    """Export model to JSON format"""
    
    print(f"\n💾 Exporting model to {output_file}...")
    
    # Convert tree to dict
    tree_dict = tree_to_dict(model, feature_names)
    
    # Get feature importance
    feature_importance = {
        name: float(imp) 
        for name, imp in zip(feature_names, model.feature_importances_)
    }
    
    # Create model package
    model_package = {
        'model_type': 'DecisionTreeRegressor',
        'version': '2.0_draft',
        'max_depth': int(model.get_depth()),
        'n_leaves': int(model.get_n_leaves()),
        'features': list(feature_names),
        'n_features': len(feature_names),
        'metrics': {
            'mae': float(metrics['mae']),
            'rmse': float(metrics['rmse']),
            'r2': float(metrics['r2']),
            'within_2': float(metrics['within_2'])
        },
        'feature_importance': feature_importance,
        'tree': tree_dict,
        'notes': 'Draft FPL model - NO price features!'
    }
    
    # Save to JSON
    with open(output_file, 'w') as f:
        json.dump(model_package, f, indent=2)
    
    print(f"✅ Exported to {output_file}")
    print(f"   File size: {len(json.dumps(model_package)) / 1024:.1f} KB")

def main():
    print("="*60)
    print("🎯 DRAFT FPL MODEL TRAINING")
    print("="*60)
    
    # Load data
    print("\n📂 Loading features_data.csv...")
    df = pd.read_csv('features_data.csv')
    print(f"✅ Loaded {len(df):,} rows, {len(df.columns)} columns")
    
    # Prepare Draft data
    X, y = prepare_draft_data(df)
    
    # Train model
    model, metrics = train_draft_model(X, y)
    
    # Export to JSON
    export_model_to_json(model, X.columns, metrics, '../decision_tree_draft.json')
    
    # Also save .pkl for later use
    joblib.dump(model, 'draft_model.pkl')
    print(f"✅ Also saved to draft_model.pkl")
    
    print("\n" + "="*60)
    print("✅ DRAFT FPL MODEL READY!")
    print("="*60)
    print("\n📋 Summary:")
    print(f"  • Features: {len(X.columns)}")
    print(f"  • NO price features! ❌💰")
    print(f"  • MAE: {metrics['mae']:.3f}")
    print(f"  • R²: {metrics['r2']:.3f}")
    print(f"  • Within ±2: {metrics['within_2']:.1f}%")

if __name__ == '__main__':
    main()

