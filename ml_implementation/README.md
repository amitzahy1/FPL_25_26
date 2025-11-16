# 🤖 FPL Machine Learning Implementation

ליישום ML לחיזוי נקודות שחקנים במשחק Fantasy Premier League.

---

## 📋 תוכן עניינים

1. [מה זה עושה?](#מה-זה-עושה)
2. [התקנה מהירה](#התקנה-מהירה)
3. [שלבי ההרצה](#שלבי-ההרצה)
4. [שילוב באתר](#שילוב-באתר)
5. [דוגמאות](#דוגמאות)
6. [FAQ](#faq)

---

## 🎯 מה זה עושה?

**לפני:**
```javascript
// Hardcoded weights
prediction = form * 0.28 + xGI * 0.25 + ...
```

**אחרי:**
```javascript
// ML learns optimal weights from historical data!
prediction = mlPredictor.predict(player);
// → More accurate predictions
```

### יתרונות:

- ✅ **מדויק יותר** - לומד מהיסטוריה אמיתית
- ✅ **משקלים אופטימליים** - לא קבועים
- ✅ **מזהה דפוסים** - קשרים לא ליניאריים
- ✅ **משתפר עם הזמן** - עדכון כל שבועיים

---

## ⚡ התקנה מהירה

### דרישות מוקדמות:
- Python 3.8+
- pip
- Git

### 1. התקן Python packages:
```bash
pip install -r requirements.txt
```

### 2. הורד נתונים היסטוריים:
```bash
# מהתיקיה הראשית של הפרויקט
git clone https://github.com/vaastav/Fantasy-Premier-League.git
```

זהו! מוכן להרצה.

---

## 🚀 שלבי ההרצה

### שלב 1: טעינת נתונים
```bash
python 01_load_data.py
```

**פלט:**
```
Loading 2023-24...
Loading 2022-23...
...
✅ Loaded 45,230 player-gameweeks from 3 seasons
✅ Cleaned data: 38,945 rows
✅ Saved to historical_data.csv
```

**זמן:** ~2-3 דקות

---

### שלב 2: יצירת Features
```bash
python 02_feature_engineering.py
```

**פלט:**
```
Creating features...
  - Rolling averages...
  - Per-90 metrics...
  - Consistency...
  - ICT...
  - Bonus...
✅ Created 52 features
✅ Target created: 36,821 training examples
✅ Saved to features_data.csv
```

**זמן:** ~3-5 דקות

---

### שלב 3: אימון מודל
```bash
python 03_train_model.py
```

**פלט:**
```
==================================================
TRAINING RANDOM FOREST
==================================================
Training...
[Parallel(n_jobs=-1)]: Done 100 out of 100 | elapsed:  2.3min finished

📊 Random Forest Results:
  Test MAE:  2.91 points
  Test RMSE: 3.72 points
  Test R²:   0.43

==================================================
TRAINING XGBOOST
==================================================
Training...
[0]     validation_0-rmse:4.52134
[50]    validation_0-rmse:3.61829
[100]   validation_0-rmse:3.59012
[150]   validation_0-rmse:3.58245
Stopping. Best iteration: [157]

📊 XGBoost Results:
  Test MAE:  2.78 points    ← Better!
  Test RMSE: 3.58 points
  Test R²:   0.47

==================================================
COMPARISON
==================================================
Random Forest MAE: 2.91
XGBoost MAE:       2.78
Winner: XGBoost 🏆

✅ Saved weights to model_weights_xgboost.json
✅ Saved model to best_model_xgboost.pkl
```

**זמן:** ~5-10 דקות

**קבצים שנוצרו:**
- `model_weights_xgboost.json` ⭐ (זה מה שאנחנו צריכים!)
- `best_model_xgboost.pkl`
- `feature_importance_xgboost.png`

---

## 🔧 שילוב באתר

### קובץ 1: העתק משקלים
```bash
cp model_weights_xgboost.json /path/to/your/website/
```

### קובץ 2: העתק predictor
```bash
cp 04_ml_predictor.js /path/to/your/website/
```

### קובץ 3: עדכן `index.html`
```html
<!-- הוסף לפני script.js -->
<script src="04_ml_predictor.js"></script>
<script src="script.js"></script>
```

### קובץ 4: עדכן `script.js`

#### 4.1 הוסף אתחול:
```javascript
// בתחילת הקובץ
let mlPredictor = null;

// בתוך init()
async function init() {
    showLoading();
    
    try {
        // Initialize ML FIRST
        const weights = await loadMLWeights();
        if (weights) {
            mlPredictor = new MLPredictor(weights);
            console.log('✅ ML predictor ready');
        }
        
        // ... rest of your init code
    }
}
```

#### 4.2 החלף prediction:
```javascript
// מצא את:
function predictPointsForFixture(player, fixture) {
    // ... old code
}

// החלף ב:
function predictPointsForFixture(player, fixture) {
    if (mlPredictor) {
        return mlPredictor.predict(player);
    }
    // Fallback to original
    return predictPointsForFixtureOld(player, fixture);
}

// שמור את הקוד המקורי כ:
function predictPointsForFixtureOld(player, fixture) {
    // ... paste old code here
}
```

---

## 📊 דוגמאות

### דוגמה 1: תחזית בסיסית
```javascript
const salah = {
    web_name: 'Salah',
    position_name: 'MID',
    form: '8.5',
    minutes: 1620,
    goals_scored: 12,
    assists: 8,
    expected_goals: '10.5',
    expected_assists: '7.2',
    total_points: 185,
    now_cost: 130,
    // ... more fields
};

const prediction = mlPredictor.predict(salah);
console.log(`Predicted: ${prediction.toFixed(1)} points`);
// Output: Predicted: 8.3 points
```

### דוגמה 2: השוואה ML vs Original
```javascript
function comparePredictions() {
    const topPlayers = state.displayedData.slice(0, 20);
    
    console.table(topPlayers.map(p => ({
        Name: p.web_name,
        ML: mlPredictor.predict(p).toFixed(1),
        Original: predictPointsForFixtureOld(p, null).toFixed(1),
        Diff: (mlPredictor.predict(p) - predictPointsForFixtureOld(p, null)).toFixed(1)
    })));
}

// קרא לזה אחרי טעינה
comparePredictions();
```

### דוגמה 3: בדיקת דיוק
```javascript
// לאחר כמה GW, השווה תחזיות למציאות
function evaluateAccuracy(actualPoints) {
    const predictions = state.displayedData.map(p => 
        mlPredictor.predict(p)
    );
    
    const errors = predictions.map((pred, i) => 
        Math.abs(pred - actualPoints[i])
    );
    
    const mae = errors.reduce((a, b) => a + b, 0) / errors.length;
    console.log(`MAE: ${mae.toFixed(2)} points`);
}
```

---

## 🐛 Troubleshooting

### שגיאה: "ML model weights not loaded"

**פתרון 1:** וודא שהקובץ במקום הנכון
```bash
ls model_weights_xgboost.json
# צריך להיות באותה תיקיה כמו index.html
```

**פתרון 2:** CORS issue - הרץ local server
```bash
python -m http.server 8000
# פתח: http://localhost:8000
```

### שגיאה: "ML prediction error"

**בדוק features:**
```javascript
const features = mlPredictor.extractFeatures(player);
console.log('Features:', features);
// וודא שאין NaN או undefined
```

### תחזיות לא הגיוניות (0 או 100)

**כוונן scaling:**
```javascript
// ב-04_ml_predictor.js, בתוך predict():
// שנה את השורה:
prediction = prediction * 10 + 2;

// ל:
prediction = prediction * 8 + 3;  // נסה ערכים שונים
```

---

## 📈 מדדי הצלחה

### איך לדעת שהמודל טוב?

**1. MAE (Mean Absolute Error)**
```
✅ מצוין: < 2.5
✅ טוב:    2.5-3.5
⚠️ בסדר:   3.5-4.5
❌ חלש:    > 4.5
```

**2. R² Score**
```
✅ מצוין: > 0.50
✅ טוב:    0.40-0.50
⚠️ בסדר:   0.30-0.40
❌ חלש:    < 0.30
```

**3. Feature Importance**

בדוק את `feature_importance_xgboost.png` - Features המובילים צריכים להיות:
- form_5 / form_3
- xGI_per_90
- minutes
- bonus_per_90

---

## 🔄 עדכון המודל

**מתי?** כל שבועיים (או כל 4-5 GW)

**איך?**
```bash
# 1. Pull latest data
cd Fantasy-Premier-League
git pull

# 2. Re-run training
cd ..
python 03_train_model.py

# 3. Copy new weights
cp model_weights_xgboost.json /path/to/website/

# 4. Clear browser cache (Ctrl+Shift+R)
```

---

## 💡 שיפורים עתידיים

### 1. הוסף Fixture Difficulty
```python
# ב-02_feature_engineering.py
df['avg_fdr_3'] = calculate_avg_fdr(df, 3)
df['avg_fdr_5'] = calculate_avg_fdr(df, 5)
```

### 2. הוסף Team Form
```python
df['team_form'] = get_team_form(df['team_id'])
df['opponent_strength'] = get_opponent_strength(df)
```

### 3. Ensemble Models
```javascript
// ב-JavaScript
const rf_pred = rfModel.predict(player);
const xgb_pred = xgbModel.predict(player);
const final = rf_pred * 0.3 + xgb_pred * 0.7;  // Weighted average
```

### 4. Deep Learning (LSTM)
```python
# עבור זיהוי דפוסים זמניים
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense

model = Sequential([
    LSTM(128, input_shape=(5, n_features)),
    Dense(1)
])
```

---

## 📚 קבצים

```
ml_implementation/
├── README.md                      ← אתה כאן
├── requirements.txt               ← Python dependencies
├── 01_load_data.py               ← טעינת data
├── 02_feature_engineering.py     ← יצירת features
├── 03_train_model.py             ← אימון מודל
├── 04_ml_predictor.js            ← JavaScript predictor
└── 05_integration_guide.md       ← מדריך שילוב מפורט

Generated files:
├── historical_data.csv           ← Raw data
├── features_data.csv             ← Engineered features
├── model_weights_xgboost.json    ← Weights for JS ⭐
├── best_model_xgboost.pkl        ← Trained model
└── feature_importance_xgboost.png ← Visualization
```

---

## ❓ FAQ

### ש: כמה נתונים צריך?
**ת:** מינימום 1-2 עונות (20,000+ שורות). יותר = טוב יותר.

### ש: כמה זמן אימון?
**ת:** 
- Load: 2-3 דקות
- Features: 3-5 דקות
- Training: 5-10 דקות
**סה"כ: 15-20 דקות**

### ש: האם זה מחליף את כל הלוגיקה?
**ת:** לא! זה רק משפר את ה-`predictPointsForFixture()`. כל השאר נשאר.

### ש: מה אם המודל טועה?
**ת:** זה תחזית! אף מודל לא מושלם. מצופה MAE של 2.5-3.5 נקודות.

### ש: איך אני יודע שזה עובד טוב יותר?
**ת:** השווה MAE של ML vs המודל המקורי שלך על אותם שחקנים:
```javascript
const mlMAE = calculateMAE(mlPredictions, actualPoints);
const oldMAE = calculateMAE(oldPredictions, actualPoints);
console.log(`ML: ${mlMAE.toFixed(2)} vs Old: ${oldMAE.toFixed(2)}`);
```

### ש: אפשר להשתמש במודל אחר?
**ת:** כן! Random Forest, LightGBM, Neural Networks - הכל אפשרי. תשנה את `03_train_model.py`.

---

## 🎯 סיכום

**3 צעדים פשוטים:**

1. **הרץ Python:**
   ```bash
   python 01_load_data.py
   python 02_feature_engineering.py
   python 03_train_model.py
   ```

2. **העתק קבצים:**
   ```bash
   cp model_weights_xgboost.json /path/to/website/
   cp 04_ml_predictor.js /path/to/website/
   ```

3. **שלב בקוד:**
   - הוסף `<script src="04_ml_predictor.js"></script>`
   - קרא ל-`initMLPredictor()` ב-`init()`
   - השתמש ב-`mlPredictor.predict(player)`

**זהו! עכשיו יש לך חיזויים מבוססי ML! 🚀**

---

**📧 שאלות? פשוט תשאל!**

