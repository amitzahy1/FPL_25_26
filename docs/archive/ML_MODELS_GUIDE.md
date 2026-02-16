# 🤖 מדריך ML Models לניבוי FPL

## 📋 תוכן עניינים
1. [מבוא](#מבוא)
2. [המודלים מ-kz4killua/fpl-ai](#המודלים-מ-kz4killuafpl-ai)
3. [Feature Engineering](#feature-engineering)
4. [אלגוריתמים](#אלגוריתמים)
5. [איך ליישם אצלנו](#איך-ליישם-אצלנו)
6. [קוד לדוגמה](#קוד-לדוגמה)

---

## מבוא

**Machine Learning** ל-FPL עוסק בחיזוי ביצועי שחקנים עתידיים על בסיס נתונים היסטוריים וסטטיסטיקות משחק.

### למה ML?

**מודלים מסורתיים** (כמו שיש לנו):
```javascript
prediction = form * 0.28 + xGI * 0.25 + fixtures * 0.20 + ...
```

✅ **יתרונות:**
- פשוט להבין
- מהיר לחשב
- שקוף

❌ **חסרונות:**
- משקלים קבועים (לא מסתגלים)
- לא מגלה קשרים מורכבים
- לא לומד מהעבר

**ML Models:**
```python
model.fit(historical_data, actual_points)
prediction = model.predict(player_features)
```

✅ **יתרונות:**
- **לומד מהנתונים** - מוצא משקלים אופטימליים
- **מזהה דפוסים** - קשרים לא ליניאריים
- **משתפר עם הזמן** - ככל שמוסיפים data

❌ **חסרונות:**
- דורש הרבה data
- "Black box" - קשה להבין למה
- עלול ל-overfit (ללמוד רעש)

---

## המודלים מ-[kz4killua/fpl-ai](https://github.com/kz4killua/fpl-ai)

### 1️⃣ Random Forest Regressor

#### מה זה?
**יער של עצי החלטה** שמצביעים ביחד על התוצאה.

```
        🌳 Tree 1: 8.5 pts
        🌳 Tree 2: 7.2 pts
        🌳 Tree 3: 9.1 pts
        ...
        🌳 Tree 100: 8.0 pts
        ↓
    Average = 8.2 pts ⚽
```

#### איך זה עובד?

**עץ בודד:**
```
        minutes > 45?
         /          \
       Yes          No
      /                \
  form > 5?          2.0 pts
   /    \
 Yes    No
 /        \
8.5pts   4.2pts
```

**יער:**
- מאמן 100+ עצים על דגימות שונות מהData
- כל עץ נותן תחזית
- התוצאה = ממוצע כל העצים

#### למה זה טוב?
✅ מטפל ב-overfitting (כי ממוצע הרבה עצים)
✅ מטפל ב-missing data
✅ מזהה אינטראקציות בין features

#### איך לאמן?
```python
from sklearn.ensemble import RandomForestRegressor

# Features
X = players[['minutes', 'goals', 'assists', 'xG', 'xA', 
             'form', 'fixture_difficulty', 'price', ...]]

# Target
y = players['points_next_gw']

# Train
model = RandomForestRegressor(
    n_estimators=100,     # 100 עצים
    max_depth=10,         # עומק מקסימלי
    min_samples_split=20, # מינימום דגימות לפיצול
    random_state=42
)

model.fit(X, y)

# Predict
predictions = model.predict(X_test)
```

#### Feature Importance
Random Forest נותן לנו **חשיבות של כל feature**:

```python
importances = model.feature_importances_
features = X.columns

for feature, importance in zip(features, importances):
    print(f"{feature}: {importance:.3f}")
```

**דוגמה:**
```
form: 0.28          # הכי חשוב!
xG: 0.22
minutes: 0.15
fixture_difficulty: 0.12
price: 0.08
...
```

---

### 2️⃣ XGBoost (eXtreme Gradient Boosting)

#### מה זה?
**מודל שמתקן את עצמו צעד אחר צעד**.

```
Tree 1 → Errors → Tree 2 (fixes errors) → Errors → Tree 3 (fixes remaining) → ...
```

#### איך זה עובד?

**Boosting Logic:**
1. אמן עץ ראשון - תחזה נקודות
2. חשב את השגיאות (actual - predicted)
3. אמן עץ שני **על השגיאות** (לא על הנתונים המקוריים!)
4. הוסף את התחזית של עץ 2 לעץ 1
5. חזור על 3-4 עוד 100 פעמים

**דוגמה:**
```
Actual: 10 pts

Tree 1: predicts 7 pts  → Error: +3
Tree 2: predicts +2     → Error: +1
Tree 3: predicts +0.8   → Error: +0.2
Tree 4: predicts +0.2   → Error: 0!

Final: 7 + 2 + 0.8 + 0.2 = 10 pts ✅
```

#### למה זה טוב?
✅ **מדויק מאוד** - לרוב הטוב ביותר
✅ **מהיר** - אופטימיזציות מתקדמות
✅ **גמיש** - hyperparameters רבים

#### איך לאמן?
```python
import xgboost as xgb

# Features + Target
dtrain = xgb.DMatrix(X_train, label=y_train)
dtest = xgb.DMatrix(X_test, label=y_test)

# Parameters
params = {
    'objective': 'reg:squarederror',  # Regression
    'max_depth': 6,                   # עומק עץ
    'learning_rate': 0.1,             # קצב למידה
    'n_estimators': 100,              # מספר עצים
    'subsample': 0.8,                 # % דגימות לכל עץ
    'colsample_bytree': 0.8,          # % features לכל עץ
    'seed': 42
}

# Train
model = xgb.train(
    params,
    dtrain,
    num_boost_round=100,
    evals=[(dtest, 'test')],
    early_stopping_rounds=10  # עצור אם לא משתפר
)

# Predict
predictions = model.predict(dtest)
```

#### Hyperparameter Tuning
**המפתח להצלחה:**

```python
from sklearn.model_selection import GridSearchCV

param_grid = {
    'max_depth': [3, 5, 7, 10],
    'learning_rate': [0.01, 0.05, 0.1, 0.2],
    'n_estimators': [50, 100, 200, 500],
    'subsample': [0.6, 0.8, 1.0]
}

grid_search = GridSearchCV(
    xgb.XGBRegressor(),
    param_grid,
    cv=5,  # 5-fold cross validation
    scoring='neg_mean_squared_error'
)

grid_search.fit(X_train, y_train)

print("Best params:", grid_search.best_params_)
print("Best score:", grid_search.best_score_)
```

---

### 3️⃣ LSTM (Long Short-Term Memory)

#### מה זה?
**רשת נוירונים** שזוכרת **רצפים** (time series).

```
GW1 → GW2 → GW3 → GW4 → GW5 → Predict GW6
 5     8     3     9     7   →    ?
```

#### למה זה שונה?
Random Forest & XGBoost: **לא זוכרים סדר**
LSTM: **זוכר היסטוריה**

**דוגמה:**
```
Player A: 5, 5, 5, 5, 5 → Predict: 5 (stable)
Player B: 10, 2, 10, 2, 10 → Predict: 2 (alternating)
```

Random Forest יחזה אותו דבר לשניהם (average = 5 / 6.8).
LSTM יזהה את הדפוס!

#### איך לאמן?
```python
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout

# Prepare sequences (last 5 GWs → next GW)
def create_sequences(data, seq_length=5):
    X, y = [], []
    for i in range(len(data) - seq_length):
        X.append(data[i:i+seq_length])
        y.append(data[i+seq_length]['points'])
    return np.array(X), np.array(y)

X_train, y_train = create_sequences(player_history, seq_length=5)

# Build model
model = Sequential([
    LSTM(128, return_sequences=True, input_shape=(5, n_features)),
    Dropout(0.3),
    LSTM(64, return_sequences=False),
    Dropout(0.2),
    Dense(32, activation='relu'),
    Dense(1, activation='linear')  # Points prediction
])

model.compile(
    optimizer='adam',
    loss='mse',
    metrics=['mae']
)

# Train
history = model.fit(
    X_train, y_train,
    epochs=50,
    batch_size=32,
    validation_split=0.2,
    callbacks=[
        tf.keras.callbacks.EarlyStopping(patience=10),
        tf.keras.callbacks.ReduceLROnPlateau(patience=5)
    ]
)

# Predict
predictions = model.predict(X_test)
```

#### למתי זה מתאים?
✅ יש הרבה נתוני history (5+ GWs per player)
✅ רוצים ללכוד דפוסים זמניים (streaks, slumps)
✅ יש GPU (אימון מהיר)

❌ פחות טוב עם data מועט
❌ "Black box" - קשה להבין

---

## Feature Engineering

### מה זה?
**יצירת features חדשים** מהנתונים הקיימים.

#### דוגמאות מ-fpl-ai:

##### 1. Rolling Averages (Moving Windows)
```python
# Average last 5 GW
player['form_5'] = player['points'].rolling(5).mean()

# Average last 10 GW
player['form_10'] = player['points'].rolling(10).mean()

# Trend: האם משתפר?
player['trend'] = player['form_5'] - player['form_10']
```

##### 2. Fixture Difficulty Rolling
```python
# Average FDR next 3 GW
def calculate_avg_fdr(player, fixtures, n=3):
    next_fixtures = get_next_fixtures(player.team_id, n)
    return np.mean([f.difficulty for f in next_fixtures])

player['avg_fdr_3'] = calculate_avg_fdr(player, fixtures, 3)
player['avg_fdr_5'] = calculate_avg_fdr(player, fixtures, 5)
```

##### 3. Per-90 Metrics
```python
# Goals per 90 minutes
player['goals_per_90'] = (player['goals'] / player['minutes']) * 90

# xG per 90
player['xG_per_90'] = (player['expected_goals'] / player['minutes']) * 90

# Efficiency: goals vs xG
player['finishing_efficiency'] = player['goals'] / (player['expected_goals'] + 0.1)
```

##### 4. Opponent Strength
```python
# Team strength from team ratings
def get_opponent_strength(fixture, player_team_id):
    opponent_id = fixture.team_a if player_team_id == fixture.team_h else fixture.team_h
    is_home = player_team_id == fixture.team_h
    
    opponent_team = teams[opponent_id]
    
    if is_home:
        # Home player vs away opponent
        attack_strength = player_team.strength_attack_home
        defense_strength = opponent_team.strength_defence_away
    else:
        # Away player vs home opponent
        attack_strength = player_team.strength_attack_away
        defense_strength = opponent_team.strength_defence_home
    
    return {
        'attack_strength': attack_strength,
        'defense_strength': defense_strength,
        'strength_diff': attack_strength - defense_strength
    }
```

##### 5. Position-Specific Features
```python
# Defenders
if player.position == 'DEF':
    player['cs_probability'] = calculate_cs_prob(player, opponent)
    player['def_value'] = player['def_contrib_per90'] * player['minutes'] / 90

# Forwards
if player.position == 'FWD':
    player['goal_threat'] = player['xG_per_90'] * player['minutes'] / 90
    player['shot_accuracy'] = player['goals'] / (player['shots'] + 0.1)
```

##### 6. Team Form
```python
# Team's recent results (last 5 games)
def get_team_form(team_id, last_n=5):
    recent_games = get_team_games(team_id, last_n)
    points = 0
    for game in recent_games:
        if game.winner == team_id:
            points += 3
        elif game.is_draw:
            points += 1
    return points / (last_n * 3)  # Normalize to 0-1

player['team_form'] = get_team_form(player.team_id, 5)
```

##### 7. Ownership & Transfers
```python
# Transfer momentum
player['transfer_momentum'] = player['transfers_in'] - player['transfers_out']
player['transfer_momentum_norm'] = player['transfer_momentum'] / player['transfers_in'].max()

# Ownership trend
player['ownership_change'] = player['selected_by_percent'] - player['selected_by_percent_prev']
```

##### 8. Price Value
```python
# Points per million
player['ppm'] = player['total_points'] / player['now_cost']

# Form per million
player['form_pm'] = player['form'] / player['now_cost']

# xGI per million
player['xgi_pm'] = player['expected_goal_involvements'] / player['now_cost']
```

##### 9. Consistency Metrics
```python
# Standard deviation of points (last 5 GW)
player['points_std'] = player['points'].rolling(5).std()

# Coefficient of Variation
player['points_cv'] = player['points_std'] / (player['form_5'] + 0.1)

# Max/Min range
player['points_range'] = player['points'].rolling(5).max() - player['points'].rolling(5).min()
```

##### 10. Interaction Features
```python
# xG * Fixture Difficulty
player['xG_fdr'] = player['xG_per_90'] * (6 - player['avg_fdr_3'])

# Form * Team Form
player['combined_form'] = player['form_5'] * player['team_form']

# Minutes * Price (playing time value)
player['minutes_value'] = (player['minutes'] / player['appearances']) * player['now_cost']
```

---

## אלגוריתמים

### השוואה בין המודלים

| מודל | דיוק | מהירות | פשטות | צריך Data |
|------|------|---------|-------|-----------|
| **Random Forest** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **XGBoost** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **LSTM** | ⭐⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |

### Ensemble (שילוב מודלים)

**הרעיון:** משלבים כמה מודלים ביחד!

```python
# Train 3 models
rf_pred = random_forest.predict(X_test)
xgb_pred = xgboost.predict(X_test)
lstm_pred = lstm.predict(X_test)

# Ensemble: weighted average
final_pred = (
    rf_pred * 0.3 +
    xgb_pred * 0.5 +
    lstm_pred * 0.2
)
```

**למה זה טוב?**
- כל מודל תופס דפוסים שונים
- ממוצע = פחות overfitting
- יציב יותר

---

## איך ליישם אצלנו?

### אופציה 1: Pre-trained Model (מומלץ!)

**רעיון:** אמן מודל Python אופליין, ייצא משקלים, השתמש ב-JavaScript.

#### שלב 1: אמן Python (אופליין)
```python
# train_model.py
import xgboost as xgb
import joblib

# Load historical data
data = load_fpl_historical_data()

X = data[['minutes', 'goals', 'xG', 'xA', 'form', ...]]
y = data['points_next_gw']

# Train
model = xgb.XGBRegressor(n_estimators=100, max_depth=5)
model.fit(X, y)

# Save model
joblib.dump(model, 'fpl_model.pkl')

# Test
print(f"Accuracy: {model.score(X_test, y_test)}")
```

#### שלב 2: ייצא משקלים
```python
# Export feature importance
importances = model.feature_importances_
weights = dict(zip(X.columns, importances))

# Save as JSON
import json
with open('model_weights.json', 'w') as f:
    json.dump(weights, f)
```

#### שלב 3: השתמש ב-JavaScript
```javascript
// Load weights
const weights = {
    "minutes": 0.15,
    "goals": 0.22,
    "xG": 0.20,
    "xA": 0.18,
    "form": 0.28,
    ...
};

// Predict
function mlPredict(player) {
    let score = 0;
    for (const [feature, weight] of Object.entries(weights)) {
        const value = player[feature] || 0;
        score += value * weight;
    }
    return score;
}
```

**יתרונות:**
✅ לא צריך Python runtime
✅ מהיר מאוד
✅ אפשר לעדכן משקלים בקלות

---

### אופציה 2: API Backend

**רעיון:** שרת Python שמריץ מודל, JavaScript קורא לAPI.

#### Backend (Flask/FastAPI)
```python
from fastapi import FastAPI
import joblib

app = FastAPI()
model = joblib.load('fpl_model.pkl')

@app.post("/predict")
def predict(player_data: dict):
    features = extract_features(player_data)
    prediction = model.predict([features])[0]
    return {"predicted_points": float(prediction)}
```

#### Frontend (JavaScript)
```javascript
async function getMLPrediction(player) {
    const response = await fetch('https://your-api.com/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(player)
    });
    
    const result = await response.json();
    return result.predicted_points;
}
```

**יתרונות:**
✅ מודלים מורכבים (LSTM, etc.)
✅ עדכון מודל בלי לשנות frontend
✅ אפשר לאסוף data למידה

**חסרונות:**
❌ צריך server
❌ עלויות hosting
❌ תלות ברשת

---

### אופציה 3: TensorFlow.js

**רעיון:** הרץ ML ישירות בדפדפן!

```javascript
// Load pre-trained model
const model = await tf.loadLayersModel('https://your-site.com/model.json');

// Predict
function tfPredict(player) {
    const features = tf.tensor2d([[
        player.minutes,
        player.goals,
        player.xG,
        player.xA,
        player.form,
        ...
    ]]);
    
    const prediction = model.predict(features);
    return prediction.dataSync()[0];
}
```

**יתרונות:**
✅ אין צורך ב-server
✅ מודלים מורכבים (neural networks)
✅ פועל offline

**חסרונות:**
❌ קובץ model גדול (MB)
❌ ביצועים (לא כמו Python)
❌ תאימות דפדפנים

---

## קוד לדוגמה

### דוגמה מלאה: Simplified XGBoost

```javascript
/**
 * Simplified Gradient Boosting predictor
 * Based on pre-trained XGBoost model
 */

// Feature weights from trained model
const xgboostWeights = {
    // Base features (40%)
    'form': 0.28,
    'xGI_per90': 0.25,
    'minutes_percent': 0.15,
    
    // Fixtures (20%)
    'avg_fdr_3': -0.12,  // Negative: lower FDR = better
    'opponent_strength': -0.08,
    
    // Team & Context (20%)
    'team_form': 0.10,
    'is_home': 0.05,
    'days_rest': 0.05,
    
    // Value & Ownership (10%)
    'transfer_momentum': 0.06,
    'ownership_change': 0.04,
    
    // Consistency (10%)
    'points_std': -0.05,  // Negative: lower variance = better
    'minutes_consistency': 0.05
};

function xgboostPredict(player, fixtures, teams) {
    // Extract features
    const features = extractFeatures(player, fixtures, teams);
    
    // Calculate weighted score
    let prediction = 0;
    for (const [feature, weight] of Object.entries(xgboostWeights)) {
        const value = features[feature] || 0;
        prediction += value * weight;
    }
    
    // Scale to realistic points range (2-15)
    prediction = Math.max(2, Math.min(15, prediction * 10 + 4));
    
    return Math.round(prediction * 10) / 10;
}

function extractFeatures(player, fixtures, teams) {
    const nextFixtures = getNextFixtures(player.team_id, 3, fixtures);
    const avgFDR = nextFixtures.reduce((sum, f) => sum + f.difficulty, 0) / 3;
    
    const gamesPlayed = Math.max((player.minutes || 0) / 90, 1);
    const minutesPercent = (player.minutes || 0) / (gamesPlayed * 90);
    
    // Calculate rolling std (simplified)
    const recentPoints = getRecentPoints(player, 5);
    const pointsStd = calculateStd(recentPoints);
    
    return {
        'form': parseFloat(player.form) || 0,
        'xGI_per90': player.xGI_per90 || 0,
        'minutes_percent': minutesPercent,
        'avg_fdr_3': avgFDR,
        'opponent_strength': getOpponentStrength(nextFixtures[0], player, teams),
        'team_form': getTeamForm(player.team_id, teams),
        'is_home': nextFixtures[0]?.is_home ? 1 : 0,
        'days_rest': calculateDaysRest(player),
        'transfer_momentum': (player.transfers_in_event - player.transfers_out_event) / 100,
        'ownership_change': 0, // Would need historical data
        'points_std': pointsStd,
        'minutes_consistency': calculateMinutesConsistency(player)
    };
}

// Helper functions
function calculateStd(values) {
    if (!values || values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
}

function getOpponentStrength(fixture, player, teams) {
    if (!fixture) return 0;
    const isHome = player.team_id === fixture.team_h;
    const opponentId = isHome ? fixture.team_a : fixture.team_h;
    const opponent = teams.find(t => t.id === opponentId);
    return isHome 
        ? opponent.strength_defence_away / 1300
        : opponent.strength_defence_home / 1300;
}

function getTeamForm(teamId, teams) {
    const team = teams.find(t => t.id === teamId);
    // Simplified: use team strength as proxy
    return (team.strength_attack_home + team.strength_attack_away) / 2600;
}
```

---

## 📊 Performance Metrics

### איך למדוד דיוק?

#### 1. Mean Absolute Error (MAE)
```python
mae = np.mean(np.abs(predictions - actual))
print(f"MAE: {mae:.2f} points")
```

**טוב:** MAE < 3.0 points

#### 2. Root Mean Squared Error (RMSE)
```python
rmse = np.sqrt(np.mean((predictions - actual) ** 2))
print(f"RMSE: {rmse:.2f} points")
```

**טוב:** RMSE < 4.0 points

#### 3. R² Score
```python
r2 = r2_score(actual, predictions)
print(f"R²: {r2:.3f}")
```

**טוב:** R² > 0.4 (40% variance explained)

---

## 🎯 סיכום והמלצות

### מה ליישם אצלנו?

**המלצה שלי: אופציה 1 (Pre-trained)**

1. **אמן XGBoost אופליין** על נתונים היסטוריים
2. **ייצא feature importances**
3. **השתמש במשקלים ב-JavaScript**

**למה?**
- ✅ פשוט ליישום
- ✅ מהיר (no API calls)
- ✅ עובד offline
- ✅ שמור על העיצוב הקיים

### תכנית יישום

#### שלב 1: Feature Engineering (1-2 שבועות)
```javascript
// הוסף features חדשים לכל שחקן
function enhancePlayerFeatures(player) {
    return {
        ...player,
        form_5: calculateRollingAvg(player, 5),
        avg_fdr_3: calculateAvgFDR(player, 3),
        goals_per_90: player.goals / (player.minutes / 90),
        xG_per_90: player.expected_goals / (player.minutes / 90),
        finishing_efficiency: player.goals / (player.expected_goals + 0.1),
        team_form: getTeamForm(player.team_id),
        transfer_momentum: player.transfers_in - player.transfers_out,
        points_std: calculatePointsStd(player, 5)
    };
}
```

#### שלב 2: Weight Optimization (offline)
- אסוף נתונים היסטוריים (3+ seasons)
- אמן XGBoost
- ייצא משקלים

#### שלב 3: Integration (1 שבוע)
```javascript
// החלף את predictPointsForFixture() הקיים
function predictPointsForFixture(player, fixture) {
    return xgboostPredict(player, [fixture], teams);
}
```

#### שלב 4: Testing & Validation
- השווה תחזיות למציאות
- חשב MAE, RMSE
- Fine-tune

---

**📅 תאריך:** 16 נובמבר 2025  
**👨‍💻 מפתח:** Claude Sonnet 4.5  
**🎯 סטטוס:** ✅ מוכן ליישום!

