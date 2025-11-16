#!/usr/bin/env python3
"""
Decision Tree Model - Can be exported to JSON and run in browser!
"""

import json
import joblib
import numpy as np
import pandas as pd
from sklearn.tree import DecisionTreeRegressor, _tree
from sklearn.metrics import mean_absolute_error, r2_score, mean_squared_error
from sklearn.model_selection import train_test_split

def export_tree_to_json(tree, feature_names):
    """
    Export sklearn DecisionTree to JSON format for JavaScript
    """
    tree_ = tree.tree_
    feature_name = [
        feature_names[i] if i != _tree.TREE_UNDEFINED else "undefined!"
        for i in tree_.feature
    ]

    def recurse(node, depth=0):
        if tree_.feature[node] != _tree.TREE_UNDEFINED:
            # Internal node
            name = feature_name[node]
            threshold = float(tree_.threshold[node])
            
            return {
                "type": "split",
                "feature": name,
                "threshold": threshold,
                "left": recurse(tree_.children_left[node], depth + 1),
                "right": recurse(tree_.children_right[node], depth + 1)
            }
        else:
            # Leaf node
            value = float(tree_.value[node][0][0])
            return {
                "type": "leaf",
                "value": value
            }
    
    return recurse(0)


def train_decision_tree(X_train, y_train, X_test, y_test, max_depth=12):
    """
    Train Decision Tree model
    """
    print("\n" + "="*50)
    print("🌳 TRAINING DECISION TREE")
    print("="*50)
    
    # Train model
    model = DecisionTreeRegressor(
        max_depth=max_depth,
        min_samples_split=50,  # Prevent overfitting
        min_samples_leaf=20,   # Prevent overfitting
        random_state=42
    )
    
    print(f"Training with max_depth={max_depth}...")
    model.fit(X_train, y_train)
    
    # Predictions
    y_pred = model.predict(X_test)
    
    # Metrics
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)
    
    # Within 2 points accuracy
    within_2 = np.mean(np.abs(y_test - y_pred) <= 2) * 100
    
    print(f"\n📊 Results:")
    print(f"  MAE:  {mae:.3f} points")
    print(f"  RMSE: {rmse:.3f} points")
    print(f"  R²:   {r2:.3f}")
    print(f"  Within ±2 points: {within_2:.1f}%")
    print(f"\n🌲 Tree Depth: {model.get_depth()}")
    print(f"🍃 Leaf Nodes: {model.get_n_leaves()}")
    
    return model, y_pred


def main():
    print("="*50)
    print("🌳 DECISION TREE FOR BROWSER")
    print("="*50)
    
    # Load data
    print("\n📂 Loading data...")
    df = pd.read_csv('ml_implementation/features_data.csv')
    
    print(f"✅ Loaded {len(df):,} samples with {len(df.columns)} columns")
    
    # Separate features and target
    y = df['total_points']
    X = df.drop(['total_points'], axis=1)
    
    # Keep only numeric columns
    X = X.select_dtypes(include=[np.number])
    
    print(f"✅ Using {len(X.columns)} numeric features")
    
    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    # Train Decision Tree
    model, y_pred = train_decision_tree(X_train, y_train, X_test, y_test, max_depth=12)
    
    # Export to JSON
    print("\n📦 Exporting to JSON...")
    feature_names = list(X.columns)
    tree_json = export_tree_to_json(model, feature_names)
    
    # Create model package
    model_package = {
        "model_type": "Decision Tree",
        "version": "3.0",
        "max_depth": int(model.get_depth()),
        "n_leaves": int(model.get_n_leaves()),
        "features": feature_names,
        "n_features": int(len(feature_names)),
        "metrics": {
            "mae": float(mean_absolute_error(y_test, y_pred)),
            "rmse": float(np.sqrt(mean_squared_error(y_test, y_pred))),
            "r2": float(r2_score(y_test, y_pred)),
            "within_2": float(np.mean(np.abs(y_test - y_pred) <= 2) * 100)
        },
        "tree": tree_json
    }
    
    # Save to JSON
    with open('decision_tree_model.json', 'w') as f:
        json.dump(model_package, f, indent=2)
    
    print(f"✅ Saved to decision_tree_model.json")
    print(f"📦 File size: {len(json.dumps(model_package)) / 1024:.1f} KB")
    
    # Also save pickle for Python use
    joblib.dump(model, 'decision_tree_model.pkl')
    print(f"✅ Saved to decision_tree_model.pkl")
    
    # Feature importance
    print("\n🏆 Top 10 Most Important Features:")
    importance = dict(zip(feature_names, model.feature_importances_))
    sorted_features = sorted(importance.items(), key=lambda x: x[1], reverse=True)[:10]
    for i, (feature, imp) in enumerate(sorted_features, 1):
        print(f"  {i:2d}. {feature:30s} {imp:.4f}")
    
    print("\n" + "="*50)
    print("✅ DONE! Use decision_tree_model.json in browser")
    print("="*50)


if __name__ == '__main__':
    main()

