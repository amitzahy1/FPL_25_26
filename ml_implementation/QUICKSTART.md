# ⚡ Quick Start - ML ב-3 דקות!

## הכנה (פעם אחת)

```bash
# 1. התקן Python packages
pip install -r requirements.txt

# 2. הורד נתונים
git clone https://github.com/vaastav/Fantasy-Premier-League.git
```

---

## הרץ הכל (פעם אחת)

```bash
python run_all.py
```

**זמן:** 15-20 דקות  
**תוצאה:** קובץ `model_weights_xgboost.json` ✅

---

## שלב באתר (פעם אחת)

### 1. העתק קבצים:
```bash
cp model_weights_xgboost.json ../
cp 04_ml_predictor.js ../
```

### 2. עדכן `index.html` (שורה אחת!):
```html
<!-- הוסף לפני script.js -->
<script src="04_ml_predictor.js"></script>
```

### 3. עדכן `script.js` (3 שורות!):

**בתוך `init()` הוסף:**
```javascript
// Initialize ML
const weights = await fetch('model_weights_xgboost.json').then(r => r.json());
window.mlPredictor = new MLPredictor(weights);
```

**החלף את `predictPointsForFixture`:**
```javascript
function predictPointsForFixture(player, fixture) {
    return window.mlPredictor ? window.mlPredictor.predict(player) : 0;
}
```

---

## בדיקה

פתח Console (F12):
```javascript
// בדוק שעבד:
console.log(mlPredictor);
// אמור להראות: MLPredictor {weights: {...}, featureNames: [...]}

// נסה תחזית:
const testPlayer = state.displayedData[0];
console.log(mlPredictor.predict(testPlayer));
// אמור להחזיר מספר (2-15)
```

---

## ✅ סיימת!

**עכשיו יש לך ML predictions!**

רוצה יותר פרטים? → ראה `README.md`

רוצה להבין איך זה עובד? → ראה `../ML_MODELS_GUIDE.md`

יש בעיה? → ראה `05_integration_guide.md` → Troubleshooting

---

**זה הכל! 🎉**

