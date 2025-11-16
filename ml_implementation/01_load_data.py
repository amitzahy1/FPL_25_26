"""
Step 1: Load Historical FPL Data
================================

This script loads historical data from vaastav's repo
and prepares it for ML training.
"""

import pandas as pd
import numpy as np
from pathlib import Path

def load_season_data(season_path):
    """Load all gameweek data for a season"""
    gws_path = season_path / 'gws'
    
    all_gws = []
    for gw_file in sorted(gws_path.glob('gw*.csv')):
        gw_num = int(gw_file.stem.replace('gw', ''))
        df = pd.read_csv(gw_file, encoding='latin-1')
        df['GW'] = gw_num
        all_gws.append(df)
    
    return pd.concat(all_gws, ignore_index=True)

def load_all_seasons(data_dir='../Fantasy-Premier-League/data'):
    """Load multiple seasons"""
    data_path = Path(data_dir)
    
    all_seasons = []
    for season_dir in sorted(data_path.iterdir()):
        if season_dir.is_dir() and season_dir.name.startswith('20'):
            print(f"Loading {season_dir.name}...")
            season_df = load_season_data(season_dir)
            season_df['season'] = season_dir.name
            all_seasons.append(season_df)
    
    df = pd.concat(all_seasons, ignore_index=True)
    print(f"\n✅ Loaded {len(df):,} player-gameweeks from {len(all_seasons)} seasons")
    return df

def clean_data(df):
    """Clean and prepare data"""
    # Remove players with no minutes
    df = df[df['minutes'] > 0].copy()
    
    # Convert to numeric
    numeric_cols = ['total_points', 'minutes', 'goals_scored', 'assists', 
                    'expected_goals', 'expected_assists', 'bonus', 'bps',
                    'influence', 'creativity', 'threat', 'ict_index']
    
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
    
    # Fill missing values
    df = df.fillna(0)
    
    print(f"✅ Cleaned data: {len(df):,} rows")
    return df

if __name__ == '__main__':
    # Load data
    df = load_all_seasons()
    
    # Clean
    df = clean_data(df)
    
    # Save
    df.to_csv('historical_data.csv', index=False)
    print("✅ Saved to historical_data.csv")
    
    # Preview
    print("\n📊 Sample:")
    print(df.head())
    print("\n📈 Stats:")
    print(df.describe())

