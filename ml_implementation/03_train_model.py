"""
Step 3: Train ML Model
=======================

Train XGBoost and Random Forest models.
Compare their performance.
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import RandomForestRegressor
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import matplotlib.pyplot as plt
import joblib
import json

def prepare_data(df, feature_cols):
    """Prepare X and y"""
    X = df[feature_cols].copy()
    y = df['target_next_gw_points'].copy()
    
    # Remove any remaining NaN or inf
    X = X.replace([np.inf, -np.inf], 0).fillna(0)
    y = y.fillna(0)
    
    return X, y

def train_random_forest(X_train, y_train, X_test, y_test):
    """Train Random Forest model"""
    print("\n" + "="*50)
    print("TRAINING RANDOM FOREST")
    print("="*50)
    
    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=15,
        min_samples_split=20,
        min_samples_leaf=10,
        max_features='sqrt',
        random_state=42,
        n_jobs=-1,
        verbose=1
    )
    
    # Train
    print("Training...")
    model.fit(X_train, y_train)
    
    # Predict
    print("Predicting...")
    y_pred_train = model.predict(X_train)
    y_pred_test = model.predict(X_test)
    
    # Evaluate
    print("\n📊 Random Forest Results:")
    print(f"  Train MAE: {mean_absolute_error(y_train, y_pred_train):.3f}")
    print(f"  Test MAE:  {mean_absolute_error(y_test, y_pred_test):.3f}")
    print(f"  Train RMSE: {np.sqrt(mean_squared_error(y_train, y_pred_train)):.3f}")
    print(f"  Test RMSE:  {np.sqrt(mean_squared_error(y_test, y_pred_test)):.3f}")
    print(f"  Train R²: {r2_score(y_train, y_pred_train):.3f}")
    print(f"  Test R²:  {r2_score(y_test, y_pred_test):.3f}")
    
    return model, y_pred_test

def train_xgboost(X_train, y_train, X_test, y_test):
    """Train XGBoost model"""
    print("\n" + "="*50)
    print("TRAINING XGBOOST")
    print("="*50)
    
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
        verbosity=1
    )
    
    # Train
    print("Training...")
    model.fit(X_train, y_train)
    
    # Predict
    print("Predicting...")
    y_pred_train = model.predict(X_train)
    y_pred_test = model.predict(X_test)
    
    # Evaluate
    print("\n📊 XGBoost Results:")
    print(f"  Train MAE: {mean_absolute_error(y_train, y_pred_train):.3f}")
    print(f"  Test MAE:  {mean_absolute_error(y_test, y_pred_test):.3f}")
    print(f"  Train RMSE: {np.sqrt(mean_squared_error(y_train, y_pred_train)):.3f}")
    print(f"  Test RMSE:  {np.sqrt(mean_squared_error(y_test, y_pred_test)):.3f}")
    print(f"  Train R²: {r2_score(y_train, y_pred_train):.3f}")
    print(f"  Test R²:  {r2_score(y_test, y_pred_test):.3f}")
    
    return model, y_pred_test

def plot_feature_importance(model, feature_names, model_name, top_n=20):
    """Plot feature importance"""
    if isinstance(model, xgb.XGBRegressor):
        importances = model.feature_importances_
    else:
        importances = model.feature_importances_
    
    # Get top features
    indices = np.argsort(importances)[::-1][:top_n]
    
    plt.figure(figsize=(10, 8))
    plt.title(f'{model_name} - Top {top_n} Features')
    plt.barh(range(top_n), importances[indices])
    plt.yticks(range(top_n), [feature_names[i] for i in indices])
    plt.xlabel('Importance')
    plt.tight_layout()
    plt.savefig(f'feature_importance_{model_name.lower().replace(" ", "_")}.png', dpi=150)
    print(f"✅ Saved feature importance plot: feature_importance_{model_name.lower().replace(' ', '_')}.png")
    
    # Return as dict
    feature_importance = {}
    for idx, importance in zip(indices, importances[indices]):
        feature_importance[feature_names[idx]] = float(importance)
    
    return feature_importance

def export_model_weights(model, feature_names, model_name):
    """Export model for JavaScript"""
    print(f"\n📤 Exporting {model_name} weights...")
    
    # Get feature importance
    importance_dict = {}
    for name, importance in zip(feature_names, model.feature_importances_):
        importance_dict[name] = float(importance)
    
    # Normalize to sum to 1
    total = sum(importance_dict.values())
    importance_dict = {k: v/total for k, v in importance_dict.items()}
    
    # Save as JSON
    filename = f'model_weights_{model_name.lower().replace(" ", "_")}.json'
    with open(filename, 'w') as f:
        json.dump(importance_dict, f, indent=2)
    
    print(f"✅ Saved weights to {filename}")
    return importance_dict

if __name__ == '__main__':
    # Load data
    print("Loading data...")
    df = pd.read_csv('features_data.csv')
    
    # Select features
    exclude_cols = ['name', 'season', 'GW', 'target_next_gw_points', 'kickoff_time', 
                    'team', 'opponent_team', 'fixture']
    feature_cols = [col for col in df.columns if col not in exclude_cols]
    
    print(f"\n📊 Dataset:")
    print(f"  Rows: {len(df):,}")
    print(f"  Features: {len(feature_cols)}")
    
    # Prepare data
    X, y = prepare_data(df, feature_cols)
    
    # Ensure all features are numeric
    X = X.select_dtypes(include=[np.number])
    
    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    print(f"\n📊 Split:")
    print(f"  Train: {len(X_train):,} samples")
    print(f"  Test:  {len(X_test):,} samples")
    
    # Train Random Forest
    rf_model, rf_pred = train_random_forest(X_train, y_train, X_test, y_test)
    
    # Train XGBoost
    xgb_model, xgb_pred = train_xgboost(X_train, y_train, X_test, y_test)
    
    # Compare
    print("\n" + "="*50)
    print("COMPARISON")
    print("="*50)
    rf_mae = mean_absolute_error(y_test, rf_pred)
    xgb_mae = mean_absolute_error(y_test, xgb_pred)
    
    print(f"Random Forest MAE: {rf_mae:.3f}")
    print(f"XGBoost MAE:       {xgb_mae:.3f}")
    print(f"Winner: {'XGBoost' if xgb_mae < rf_mae else 'Random Forest'} 🏆")
    
    # Choose best model
    best_model = xgb_model if xgb_mae < rf_mae else rf_model
    best_model_name = 'XGBoost' if xgb_mae < rf_mae else 'Random Forest'
    
    # Plot feature importance
    importance = plot_feature_importance(best_model, feature_cols, best_model_name)
    
    # Export weights
    weights = export_model_weights(best_model, feature_cols, best_model_name)
    
    # Save model
    joblib.dump(best_model, f'best_model_{best_model_name.lower().replace(" ", "_")}.pkl')
    print(f"\n✅ Saved model to best_model_{best_model_name.lower().replace(' ', '_')}.pkl")
    
    # Print top 10 features
    print("\n🏆 Top 10 Most Important Features:")
    sorted_features = sorted(importance.items(), key=lambda x: x[1], reverse=True)[:10]
    for i, (feature, importance_val) in enumerate(sorted_features, 1):
        print(f"  {i:2d}. {feature:30s} {importance_val:.4f}")

