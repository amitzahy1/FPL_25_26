# 📦 קבצים להעלאה - V4.0.1 Draft Model + Filter Fix

## 🎯 עדכון זה (V4.0 + V4.0.1):

### ✅ קבצים חדשים (3):
```
✨ decision_tree_draft.json (309KB)
✨ 04_ml_predictor_draft.js
✨ ml_implementation/06_train_draft_model.py
```

### 📝 קבצים שהשתנו (4):
```
📝 index.html (ML model script path)
📝 script.js (filter charts fix)
📝 CHANGELOG.md (V4.0 + V4.0.1)
📝 FILES_TO_UPLOAD.md (זה!)
```

### ❌ קבצים למחיקה (2):
```
🗑️ 04_ml_predictor.js (הישן - עם מחירים)
🗑️ decision_tree_model.json (הישן - 82KB)
```

---

## 🚀 פקודות Git:

### 1️⃣ הוסף קבצים חדשים:
```bash
git add decision_tree_draft.json
git add 04_ml_predictor_draft.js
git add ml_implementation/06_train_draft_model.py
```

### 2️⃣ עדכן קבצים קיימים:
```bash
git add index.html
git add script.js
git add CHANGELOG.md
git add FILES_TO_UPLOAD.md
```

### 3️⃣ מחק קבצים ישנים:
```bash
git rm 04_ml_predictor.js
git rm decision_tree_model.json
```

### 4️⃣ Commit:
```bash
git commit -m "🎯 v4.0 - Draft FPL Model (NO price features!)

✨ New Features:
- Decision Tree trained specifically for Draft FPL
- Removed ALL price-based features (value, points_per_million, form_per_million)
- Focus on: form, transfers, minutes, ICT, performance

📊 Model Performance:
- Features: 95 (no price!)
- MAE: 2.14
- Within ±2: 60%

🏆 Top Features:
1. form_10 (22.87%)
2. selected (12.74%)
3. minutes (5.85%)
4. transfers_in (3.43%)
5. transfers_out (3.09%)

✅ Files:
+ decision_tree_draft.json (309KB)
+ 04_ml_predictor_draft.js
+ ml_implementation/06_train_draft_model.py
~ index.html (updated tooltip + script)
~ CHANGELOG.md
- 04_ml_predictor.js (old)
- decision_tree_model.json (old)"
```

### 5️⃣ Push:
```bash
git push origin main
```

---

## 📋 פקודה מלאה אחת (copy-paste):

```bash
cd /Users/amitzahy/Documents/Draft/FPL_25_26 && \
git add decision_tree_draft.json 04_ml_predictor_draft.js ml_implementation/06_train_draft_model.py index.html CHANGELOG.md FILES_TO_UPLOAD.md && \
git rm 04_ml_predictor.js decision_tree_model.json && \
git commit -m "🎯 v4.0 - Draft FPL Model (NO price!)" && \
git push origin main
```

---

## 🔍 בדיקה לפני העלאה:

```bash
# בדוק שהקבצים החדשים נוצרו:
ls -lh decision_tree_draft.json
ls -lh 04_ml_predictor_draft.js

# בדוק שה-JSON תקין:
python3 -c "import json; json.load(open('decision_tree_draft.json'))"

# בדוק גודל:
du -h decision_tree_draft.json
```

---

## 📊 היסטוריית גרסאות:

### V4.0 (נוכחי):
- 🎯 Draft FPL Model - NO price!
- 95 features, MAE 2.14
- Top: form_10, selected, minutes

### V3.0.1:
- 🐛 Debug logging + CSV export
- 25 columns export

### V3.0:
- 🌳 Decision Tree (with price)
- 98 features, MAE 0.049
- Top: points_per_million (80%!)

### V2.6.1:
- 🐛 Draft Team column fix
- 🐛 ML prediction 0 fix
- 📝 xPts → חיזוי טכני

### V2.6:
- 🎨 Player comparison redesign
- Grid layout
- Smaller fonts/images

### V2.5:
- 📊 Stability Index
- 🔄 Better error handling

### V2.0:
- 🔗 Player ID mapping system
- 3-step algorithm
- Fuzzy matching

---

## ⚠️ הערות חשובות:

1. **גודל הקובץ:**
   - `decision_tree_draft.json` = 309KB
   - ✅ מתחת ל-25MB (GitHub limit)

2. **תלויות:**
   - `index.html` תלוי ב-`04_ml_predictor_draft.json`
   - וודא שהקובץ קיים לפני push!

3. **Backup:**
   - הקבצים הישנים נמחקים
   - אם צריך - יש backup ב-git history

4. **Testing:**
   - פתח את האתר לאחר העלאה
   - בדוק שהחיזויים שונים בין שחקנים
   - וודא שאין שגיאות ב-console

---

## ✅ Checklist:

- [ ] רצתי את `ml_implementation/06_train_draft_model.py`
- [ ] נוצר `decision_tree_draft.json` (309KB)
- [ ] בדקתי ש-JSON תקין
- [ ] בדקתי ש-`index.html` מצביע ל-`04_ml_predictor_draft.js`
- [ ] הרצתי את כל הפקודות Git
- [ ] push הצליח
- [ ] בדקתי את האתר - חיזויים שונים! ✅
