#!/usr/bin/env python3
"""
Draft FPL Feature Engineering
Remove price-based features, add Draft-specific features
"""

import pandas as pd
import numpy as np

def engineer_draft_features(df):
    """
    Add features specifically useful for Draft FPL
    (no price, focus on form, transfers, and performance)
    """
    
    print("\n" + "="*50)
    print("🎯 DRAFT FPL FEATURE ENGINEERING")
    print("="*50)
    
    # Make a copy
    df = df.copy()
    
    # ============================================
    # 1. MOMENTUM & TRENDS
    # ============================================
    print("\n🔥 Adding momentum features...")
    
    # Hot streak (consistently good form)
    df['hot_streak'] = (df['form_5'] > 6).astype(int)
    
    # Cold streak (poor form)
    df['cold_streak'] = (df['form_5'] < 2).astype(int)
    
    # Momentum score (recent form vs long-term)
    df['momentum_score'] = df['form_3'] - df['form_5']
    
    # Form acceleration (improving or declining)
    df['form_acceleration'] = df['form_3'] - df['form_10']
    
    # ============================================
    # 2. VALUE & AVAILABILITY (for waiver picks)
    # ============================================
    print("💎 Adding value features...")
    
    # Waiver value = performance / popularity
    # High value = good performance, low ownership
    df['waiver_value'] = df['form_5'] / (df['selected'] + 1)
    
    # Undervalued score
    df['undervalued_score'] = (df['total_points'] / 10) / (df['selected'] + 1)
    
    # Transfer momentum (demand indicator)
    df['transfer_momentum'] = df['transfers_in'] - df['transfers_out']
    df['transfer_momentum_pct'] = df['transfer_momentum'] / (df['selected'] + 1)
    
    # ============================================
    # 3. PERFORMANCE QUALITY
    # ============================================
    print("📊 Adding quality metrics...")
    
    # Games played
    df['games_played'] = np.maximum(df['minutes'] / 90, 0.1)
    
    # Points per 90 minutes
    df['points_per_90'] = df['total_points'] / df['games_played']
    
    # Consistency score (inverse of variance)
    df['consistency_score'] = 1 / (df['points_std_5'] + 0.1)
    
    # Reliability (% of games played)
    max_games = df.groupby('round')['games_played'].transform('max')
    df['reliability'] = df['games_played'] / (max_games + 0.1)
    
    # ============================================
    # 4. LAST 3 GAMES (recent performance)
    # ============================================
    print("🎯 Adding last 3 games features...")
    
    # Already have from previous feature engineering
    # But let's add ratios
    df['last3_vs_season_points'] = df['total_points_last3'] / (df['form_5'] * 5 + 0.1)
    df['last3_vs_season_minutes'] = df['minutes_last3'] / (df['minutes'] / df['games_played'] * 3 + 0.1)
    
    # ============================================
    # 5. ATTACKING THREAT
    # ============================================
    print("⚽ Adding attacking features...")
    
    # Goal involvement rate
    df['goal_involvement_rate'] = (df['goals_scored'] + df['assists']) / df['games_played']
    
    # Expected goal involvement rate
    df['xgi_rate'] = df['expected_goal_involvements'] / df['games_played']
    
    # Overperformance (goals/assists vs xG/xA)
    df['attacking_overperformance'] = (
        (df['goals_scored'] + df['assists']) - 
        (df['expected_goals'] + df['expected_assists'])
    )
    
    # ============================================
    # 6. BONUS POTENTIAL
    # ============================================
    print("🎁 Adding bonus features...")
    
    # Bonus per game
    df['bonus_per_game'] = df['bonus'] / df['games_played']
    
    # BPS per game (bonus point system)
    df['bps_per_game'] = df['bps'] / df['games_played']
    
    # High bonus potential (consistently high BPS)
    df['high_bonus_potential'] = (df['bps_per_game'] > 30).astype(int)
    
    # ============================================
    # 7. DEFENSIVE CONTRIBUTION (for DEF/GKP)
    # ============================================
    print("🛡️ Adding defensive features...")
    
    # Clean sheet rate
    df['cs_rate'] = df['clean_sheets'] / df['games_played']
    
    # Defensive actions (already have def_contrib_per_90)
    # Add save rate for GKP
    df['save_rate'] = df['saves'] / df['games_played']
    
    # ============================================
    # 8. DREAM TEAM QUALITY
    # ============================================
    print("⭐ Adding dream team features...")
    
    # Dream team rate (if column exists)
    if 'dreamteam_count' in df.columns:
        df['dreamteam_rate'] = df['dreamteam_count'] / df['games_played']
    else:
        df['dreamteam_rate'] = 0
    
    # ============================================
    # 9. POSITION-SPECIFIC FEATURES
    # ============================================
    print("🎭 Adding position-specific features...")
    
    # FWD attacking stats
    df['fwd_attacking_score'] = df['is_FWD'] * (
        df['goals_per_90'] * 2 + 
        df['assists_per_90'] + 
        df['xGI_per_90']
    )
    
    # MID all-around stats
    df['mid_allround_score'] = df['is_MID'] * (
        df['goals_per_90'] + 
        df['assists_per_90'] * 1.5 + 
        df['ict_index'] / 100
    )
    
    # DEF defensive stats
    df['def_defensive_score'] = df['is_DEF'] * (
        df['cs_rate'] * 3 + 
        df['def_contrib_per_90'] / 10 + 
        df['bonus_per_game']
    )
    
    # GKP save stats
    df['gkp_save_score'] = df['is_GKP'] * (
        df['save_rate'] * 2 + 
        df['cs_rate'] * 4 + 
        df['bonus_per_game']
    )
    
    # ============================================
    # 10. REMOVE PRICE FEATURES
    # ============================================
    print("❌ Removing price-based features...")
    
    price_features = [
        'value', 'points_per_million', 'form_per_million'
    ]
    
    removed = []
    for feat in price_features:
        if feat in df.columns:
            df = df.drop(columns=[feat])
            removed.append(feat)
    
    if removed:
        print(f"   Removed: {', '.join(removed)}")
    else:
        print(f"   No price features found")
    
    # ============================================
    # SUMMARY
    # ============================================
    print("\n✅ Feature engineering complete!")
    print(f"   Total features: {len(df.columns)}")
    print(f"   Samples: {len(df):,}")
    
    return df


def main():
    print("="*50)
    print("🎯 DRAFT FPL FEATURE ENGINEERING")
    print("="*50)
    
    # Load features data
    print("\n📂 Loading features_data.csv...")
    df = pd.read_csv('features_data.csv')
    print(f"✅ Loaded {len(df):,} rows, {len(df.columns)} columns")
    
    # Engineer Draft features
    df_draft = engineer_draft_features(df)
    
    # Save
    output_file = 'features_data_draft.csv'
    print(f"\n💾 Saving to {output_file}...")
    df_draft.to_csv(output_file, index=False)
    print(f"✅ Saved {len(df_draft):,} rows, {len(df_draft.columns)} columns")
    
    # Show feature list
    print("\n📋 Feature Categories:")
    print("="*50)
    
    feature_categories = {
        'Form & Momentum': [f for f in df_draft.columns if any(x in f for x in ['form', 'momentum', 'streak', 'acceleration'])],
        'Transfers & Value': [f for f in df_draft.columns if 'transfer' in f or 'waiver' in f or 'undervalued' in f],
        'Performance': [f for f in df_draft.columns if any(x in f for x in ['points', 'consistency', 'reliability', 'per_90', 'per_game'])],
        'Attacking': [f for f in df_draft.columns if any(x in f for x in ['goals', 'assists', 'xG', 'attacking', 'involvement'])],
        'Defensive': [f for f in df_draft.columns if any(x in f for x in ['clean', 'saves', 'def_', 'defensive'])],
        'Bonus & Quality': [f for f in df_draft.columns if any(x in f for x in ['bonus', 'bps', 'dream', 'ict'])],
        'Position': [f for f in df_draft.columns if 'is_' in f or '_score' in f]
    }
    
    for cat, features in feature_categories.items():
        if features:
            print(f"\n{cat} ({len(features)}):")
            for f in sorted(features)[:10]:  # Show first 10
                print(f"  • {f}")
            if len(features) > 10:
                print(f"  ... and {len(features) - 10} more")
    
    print("\n" + "="*50)
    print("✅ DRAFT FPL DATA READY!")
    print("="*50)


if __name__ == '__main__':
    main()

