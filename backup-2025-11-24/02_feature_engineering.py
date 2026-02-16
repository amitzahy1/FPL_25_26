"""
Step 2: Feature Engineering
============================

Create features that help predict next GW points.
"""

import pandas as pd
import numpy as np

def create_features(df):
    """Create all ML features"""
    print("Creating features...")
    
    # Sort by player and GW
    df = df.sort_values(['name', 'season', 'GW'])
    
    # ============================================
    # 1. ROLLING AVERAGES (Form)
    # ============================================
    print("  - Rolling averages...")
    df['form_3'] = df.groupby(['name', 'season'])['total_points'].transform(
        lambda x: x.rolling(3, min_periods=1).mean()
    )
    df['form_5'] = df.groupby(['name', 'season'])['total_points'].transform(
        lambda x: x.rolling(5, min_periods=1).mean()
    )
    df['form_10'] = df.groupby(['name', 'season'])['total_points'].transform(
        lambda x: x.rolling(10, min_periods=1).mean()
    )
    
    # Trend: improving or declining?
    df['form_trend'] = df['form_3'] - df['form_5']
    
    # ============================================
    # 2. PER-90 METRICS
    # ============================================
    print("  - Per-90 metrics...")
    df['minutes_rolling'] = df.groupby(['name', 'season'])['minutes'].transform(
        lambda x: x.rolling(5, min_periods=1).mean()
    )
    
    df['goals_per_90'] = (df['goals_scored'] / df['minutes']) * 90
    df['assists_per_90'] = (df['assists'] / df['minutes']) * 90
    df['xG_per_90'] = (df['expected_goals'] / df['minutes']) * 90
    df['xA_per_90'] = (df['expected_assists'] / df['minutes']) * 90
    df['xGI_per_90'] = df['xG_per_90'] + df['xA_per_90']
    
    # Clean infinities
    df = df.replace([np.inf, -np.inf], 0)
    
    # ============================================
    # 3. ROLLING PER-90 METRICS
    # ============================================
    print("  - Rolling per-90...")
    df['xGI_per_90_avg_5'] = df.groupby(['name', 'season'])['xGI_per_90'].transform(
        lambda x: x.rolling(5, min_periods=1).mean()
    )
    
    # ============================================
    # 4. CONSISTENCY METRICS
    # ============================================
    print("  - Consistency...")
    df['points_std_5'] = df.groupby(['name', 'season'])['total_points'].transform(
        lambda x: x.rolling(5, min_periods=2).std()
    )
    df['points_cv'] = df['points_std_5'] / (df['form_5'] + 0.1)  # Coefficient of variation
    
    df['minutes_std_5'] = df.groupby(['name', 'season'])['minutes'].transform(
        lambda x: x.rolling(5, min_periods=2).std()
    )
    
    # ============================================
    # 5. FINISHING EFFICIENCY
    # ============================================
    print("  - Efficiency...")
    df['finishing_efficiency'] = df['goals_scored'] / (df['expected_goals'] + 0.1)
    df['assist_efficiency'] = df['assists'] / (df['expected_assists'] + 0.1)
    
    # ============================================
    # 6. DEFENSIVE CONTRIBUTION (DefCon)
    # ============================================
    print("  - Defensive contribution...")
    # tackles + interceptions + clearances + blocks (if available)
    df['def_contrib'] = 0
    if 'tackles' in df.columns:
        df['def_contrib'] += df['tackles'].fillna(0)
    if 'interceptions' in df.columns:
        df['def_contrib'] += df['interceptions'].fillna(0)
    if 'clearances' in df.columns:
        df['def_contrib'] += df['clearances'].fillna(0)
    if 'blocks' in df.columns:
        df['def_contrib'] += df['blocks'].fillna(0)
    
    df['def_contrib_per_90'] = (df['def_contrib'] / df['minutes']) * 90
    
    # Rolling defensive contribution
    df['def_contrib_per_90_avg_5'] = df.groupby(['name', 'season'])['def_contrib_per_90'].transform(
        lambda x: x.rolling(5, min_periods=1).mean()
    )
    
    # ============================================
    # 7. ICT METRICS
    # ============================================
    print("  - ICT...")
    df['influence_per_90'] = (df['influence'] / df['minutes']) * 90
    df['creativity_per_90'] = (df['creativity'] / df['minutes']) * 90
    df['threat_per_90'] = (df['threat'] / df['minutes']) * 90
    
    # ============================================
    # 7. BONUS POTENTIAL
    # ============================================
    print("  - Bonus...")
    df['bonus_per_90'] = (df['bonus'] / df['minutes']) * 90
    df['bps_per_90'] = (df['bps'] / df['minutes']) * 90
    
    # ============================================
    # 8. POSITION ENCODING
    # ============================================
    print("  - Position encoding...")
    df['is_GKP'] = (df['position'] == 'GKP').astype(int)
    df['is_DEF'] = (df['position'] == 'DEF').astype(int)
    df['is_MID'] = (df['position'] == 'MID').astype(int)
    df['is_FWD'] = (df['position'] == 'FWD').astype(int)
    
    # ============================================
    # 9. CLEAN SHEETS (for defenders/GKP)
    # ============================================
    print("  - Clean sheets...")
    df['cs_per_game'] = df['clean_sheets'] / 1  # Already per game
    df['cs_rolling_5'] = df.groupby(['name', 'season'])['clean_sheets'].transform(
        lambda x: x.rolling(5, min_periods=1).mean()
    )
    
    # ============================================
    # 10. PRICE VALUE
    # ============================================
    print("  - Value...")
    if 'value' in df.columns:
        df['points_per_million'] = df['total_points'] / (df['value'] / 10)
        df['form_per_million'] = df['form_5'] / (df['value'] / 10)
    
    # Fill NaN with 0
    df = df.fillna(0)
    
    print(f"✅ Created {len(df.columns)} features")
    return df

def create_target(df):
    """Create target variable: points in NEXT gameweek"""
    print("Creating target variable...")
    
    df = df.sort_values(['name', 'season', 'GW'])
    
    # Shift points back by 1 (next GW's points)
    df['target_next_gw_points'] = df.groupby(['name', 'season'])['total_points'].shift(-1)
    
    # Remove rows where we don't have next GW (last GW of season)
    df = df[df['target_next_gw_points'].notna()].copy()
    
    print(f"✅ Target created: {len(df):,} training examples")
    return df

if __name__ == '__main__':
    # Load data
    df = pd.read_csv('historical_data.csv')
    
    # Create features
    df = create_features(df)
    
    # Create target
    df = create_target(df)
    
    # Save
    df.to_csv('features_data.csv', index=False)
    print("✅ Saved to features_data.csv")
    
    # Show feature list
    print("\n📊 Features created:")
    feature_cols = [col for col in df.columns if col not in ['name', 'season', 'GW', 'target_next_gw_points']]
    for i, col in enumerate(feature_cols[:20], 1):  # Show first 20
        print(f"  {i:2d}. {col}")
    print(f"  ... and {len(feature_cols) - 20} more")

