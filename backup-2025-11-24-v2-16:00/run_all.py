#!/usr/bin/env python3
"""
Run All ML Pipeline
===================

This script runs the entire ML pipeline:
1. Load data
2. Feature engineering
3. Train model
4. Export weights

Just run: python run_all.py
"""

import subprocess
import sys
import time
from pathlib import Path

def print_header(text):
    """Print colored header"""
    print("\n" + "="*60)
    print(f"  {text}")
    print("="*60 + "\n")

def run_script(script_name, description):
    """Run a Python script and report status"""
    print_header(description)
    
    start_time = time.time()
    
    try:
        result = subprocess.run(
            [sys.executable, script_name],
            check=True,
            capture_output=False
        )
        
        elapsed = time.time() - start_time
        print(f"\n✅ {description} completed in {elapsed:.1f}s")
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"\n❌ {description} failed!")
        print(f"Error: {e}")
        return False

def main():
    """Run the complete pipeline"""
    print("\n" + "🤖"*30)
    print("  FPL ML Pipeline - Running All Steps")
    print("🤖"*30)
    
    # Check if data exists
    data_path = Path('Fantasy-Premier-League/data')
    if not data_path.exists():
        print("\n❌ Error: Fantasy-Premier-League data not found!")
        print("Please run:")
        print("  git clone https://github.com/vaastav/Fantasy-Premier-League.git")
        return
    
    steps = [
        ('01_load_data.py', 'Step 1: Loading Historical Data'),
        ('02_feature_engineering.py', 'Step 2: Feature Engineering'),
        ('03_train_model.py', 'Step 3: Training Model')
    ]
    
    total_start = time.time()
    
    for script, description in steps:
        if not run_script(script, description):
            print("\n❌ Pipeline failed. Stopping.")
            return
    
    total_elapsed = time.time() - total_start
    
    # Summary
    print("\n" + "🎉"*30)
    print("  PIPELINE COMPLETED SUCCESSFULLY!")
    print("🎉"*30)
    
    print(f"\n⏱️  Total time: {total_elapsed/60:.1f} minutes")
    
    print("\n📁 Generated files:")
    files = [
        'historical_data.csv',
        'features_data.csv',
        'model_weights_xgboost.json',
        'best_model_xgboost.pkl',
        'feature_importance_xgboost.png'
    ]
    
    for f in files:
        if Path(f).exists():
            size = Path(f).stat().st_size / (1024*1024)  # MB
            print(f"  ✅ {f:40s} ({size:.1f} MB)")
    
    print("\n📋 Next steps:")
    print("  1. Copy model_weights_xgboost.json to your website")
    print("  2. Copy 04_ml_predictor.js to your website")
    print("  3. Update index.html and script.js")
    print("  4. See 05_integration_guide.md for details")
    
    print("\n✨ Happy predicting! ✨\n")

if __name__ == '__main__':
    main()

