# 🎯 תכנית שיפור המודל

## 📊 מצב נוכחי

### מטריקות Regression:
- ✅ MAE: 2.05 נקודות (טוב!)
- ✅ ±2 נקודות: 63% (מצוין!)
- ⚠️ R²: 0.091 (9% - נמוך)

### מטריקות Classification (5+ נקודות):
- ⚠️ Precision: 50.8% (בסדר)
- ❌ Recall: 6.7% (נמוך מאוד!)
- ❌ F1: 11.9% (נמוך מאוד!)

---

## 🔍 הבעיה המרכזית

**המודל שמרן מדי!**
- מנבא 0-4 נקודות כמעט תמיד
- מפספס 93% מהשחקנים הטובים
- לא מועיל למי שרוצה למצוא Differential picks!

---

## 💡 פתרונות אפשריים

### 1. 🎯 Class Imbalance - איזון דאטה

**הבעיה:** יש הרבה יותר שחקנים עם 0-4 נקודות מאשר 5+

**פתרון:**
```python
# Give more weight to good players
class_weights = {
    0: 1.0,   # Bad players
    1: 5.0    # Good players (5x weight!)
}
```

### 2. 🏆 Train only on PLAYING players

**הבעיה:** רוב השחקנים לא משחקים (minutes=0)

**פתרון:**
```python
# Only train on players who played
df_filtered = df[df['minutes'] > 0]
```

### 3. 🎲 Ensemble - שילוב מודלים

**רעיון:** 3 מודלים נפרדים:
1. מודל ל-GKP/DEF (זיהוי Clean Sheets)
2. מודל ל-MID
3. מודל ל-FWD (זיהוי Goals/Assists)

### 4. 📊 Better Features

**נוסיף:**
- Last 3 games average (חשוב!)
- Home/Away split
- Opponent strength
- Recent form trend (עולה/יורד)

### 5. 🎚️ Threshold Tuning

במקום threshold=5, ננסה:
- 3+ נקודות: F1 49% (הרבה יותר טוב!)
- משנים את המטרה!

---

## 🚀 תכנית יישום

### Phase 1: Quick Wins (10 דקות)
```python
# 1. Filter players (minutes > 0)
# 2. Add class weights
# 3. Try threshold=3 instead of 5
```

### Phase 2: Better Features (30 דקות)
```python
# 1. Last 3 games average
# 2. Home/Away
# 3. Form trend
```

### Phase 3: Ensemble (1 שעה)
```python
# 1. Separate models per position
# 2. Combine predictions
```

---

## 📈 יעדים

| מטריקה | נוכחי | יעד |
|--------|-------|-----|
| MAE | 2.05 | **<2.00** ⭐ |
| ±2 נקודות | 63% | **>65%** ⭐ |
| Precision (3+) | 43% | **>50%** ⭐ |
| Recall (3+) | 56% | **>60%** ⭐ |
| F1 (3+) | 49% | **>55%** ⭐ |

---

## ❓ מה תרצה לנסות קודם?

1. ⚡ **Quick Fix**: Class weights + Filter (5 דקות)
2. 📊 **Better Features**: Last 3 games (20 דקות)
3. 🎯 **Change Target**: נחזה 3+ במקום 5+ (10 דקות)
4. 🏆 **Full Optimization**: הכל ביחד (1 שעה)

