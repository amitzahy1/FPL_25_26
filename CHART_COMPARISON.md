# 📊 השוואת לוגיקת הגרפים - גרסה מקורית vs נוכחית

## 🔍 הבעיה שזיהינו:

בגרסה הנוכחית, הגרפים מציגים רק שחקן אחד במטריצות, בעוד שבגרסה המקורית הם עבדו תקין.

## 📋 טבלת השוואה:

| היבט | גרסה מקורית (backup) | גרסה נוכחית | הבדל קריטי |
|------|---------------------|-------------|------------|
| **מקור הדאטה** | `state.displayedData` | `getProcessedPlayers()` | ✅ שניהם תקינים |
| **סף דקות** | `p.minutes > 300` (5 משחקים) | `p.minutes >= 90` (1 משחק) | ⚠️ הנוכחי פחות מגביל |
| **בדיקת פילטר** | בודק אם המשתמש סינן: `isFiltered = state.displayedData.length < state.allPlayersData[...].processed.length` | לא בודק | ❌ **זו הבעיה!** |
| **לוגיקת בחירת שחקנים** | אם יש פילטר → השתמש ב-`state.displayedData`<br>אם אין פילטר → סנן לפי `minutes > 300` | תמיד משתמש בכל הדאטה | ❌ לא מכבד פילטרים |
| **מבנה הדאטה** | `FPL_Bootstrap_static.json` (סטטי, לא מתעדכן) | אותו קובץ | ✅ זהה |

## 🎯 הבעיה האמיתית:

בגרסה המקורית, כל פונקציית גרף (כמו `showPriceVsScoreChart`) הייתה:
1. **בודקת אם המשתמש סינן את הטבלה**
2. אם כן → משתמשת ב-`state.displayedData` (הדאטה המסונן)
3. אם לא → מסננת בעצמה לפי `minutes > 300`

```javascript
// קוד מקורי:
const isFiltered = state.displayedData.length < state.allPlayersData[state.currentDataSource].processed.length;
const players = isFiltered ? state.displayedData : state.displayedData.filter(p => p.minutes > 300);
```

בגרסה הנוכחית, שינינו את זה ל:
```javascript
// קוד נוכחי (שגוי):
const sourceData = getProcessedPlayers(); // תמיד כל הדאטה
const players = sourceData.filter(p => p.element_type === typeId && p.minutes >= 90);
```

## 💡 הפתרון:

צריך לשחזר את הלוגיקה המקורית:
1. לבדוק אם `state.displayedData` מסונן (קטן מהדאטה המלא)
2. אם כן → להשתמש ב-`state.displayedData` כפי שהוא
3. אם לא → לסנן את הדאטה המלא לפי `minutes > 300` (או סף אחר)

## 🚫 למה לא להשתמש ב-`FPL_Bootstrap_static.json`:

כפי שציינת נכון - זה קובץ **סטטי** שלא מתעדכן. הגרסה המקורית השתמשה בו רק כ-fallback למצב "historical", אבל במצב "live" היא מושכת דאטה חי מה-API של FPL.

הקובץ הזה שימושי רק ל:
- בדיקות מקומיות
- מצב דמו
- fallback כשאין אינטרנט

אבל **לא** צריך להסתמך עליו כמקור הדאטה העיקרי.

## ✅ מסקנה:

הבעיה היא **לא** במבנה הדאטה או ב-`element_type`, אלא ב**לוגיקת הסינון** של הגרפים.
צריך לשחזר את הלוגיקה המקורית שבודקת אם המשתמש סינן את הטבלה.
