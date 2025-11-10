# 🎉 FPL Draft Tool - עדכונים חדשים

## ✅ מה שתוקן

### 1. **נתונים חיים במקום קובץ JSON סטטי**
- הכלי עכשיו מושך נתונים חיים מ-FPL API בכל פעם
- אין יותר תלות בקובץ `FPL_Bootstrap_static.json` ישן
- הנתונים תמיד מעודכנים!

### 2. **מיפוי חכם בין Draft ל-FPL**
- **הבעיה**: ה-IDs של שחקנים שונים בין Draft API ל-FPL API
  - לדוגמה: Lammens הוא ID 729 ב-Draft אבל ID 733 ב-FPL
- **הפתרון**: מערכת מיפוי אוטומטית לפי שמות שחקנים
  - השוואה של `first_name + second_name`
  - מיפוי דו-כיווני (Draft→FPL ו-FPL→Draft)
  - זיהוי שחקנים שלא נמצאה להם התאמה

### 3. **טיפול בשחקנים לא ממופים**
- שחקנים שלא נמצאה להם התאמה מסומנים ב-⚠️
- הצגת אזהרה בקונסול
- המערכת ממשיכה לעבוד גם עם שחקנים חסרים

### 4. **הסרת תלות ב-Vercel**
- הקבצים הועתקו לתיקייה הראשית
- אפשר להריץ מקומית עם CORS proxy
- אין צורך ב-deployment

## 📊 סטטיסטיקות מיפוי

מתוך בדיקה של 752 שחקנים:
- ✅ **~745 שחקנים** - התאמה מושלמת
- ⚠️ **~7 שחקנים** - IDs שונים (אבל מופו בהצלחה)
- ❌ **~0-2 שחקנים** - לא נמצאה התאמה

## 🧪 בדיקה

פתח את `test.html` בדפדפן כדי לבדוק:
1. ✅ טעינת נתוני FPL
2. ✅ טעינת נתוני Draft
3. ✅ מיפוי שחקנים
4. ✅ הצגת הסגל שלך (Amit United)

## 🚀 שימוש

### אופציה 1: פתיחה ישירה (מומלץ)
```bash
# פשוט פתח את index.html בדפדפן
open index.html
```

### אופציה 2: שרת מקומי
```bash
# Python 3
python3 -m http.server 8000

# או Node.js
npx http-server
```

ואז פתח: http://localhost:8000

## 🔧 שינויים טכניים

### קבצים שהשתנו:
- ✅ `script.js` - הוספת מערכת מיפוי
- ✅ `index.html` - מעודכן מהגרסה העובדת
- ✅ `style.css` - מעודכן מהגרסה העובדת

### פונקציות חדשות:
```javascript
// בניית מיפוי
async function buildDraftToFplMapping()

// המרת IDs
function getFplIdFromDraft(draftId)
function getDraftIdFromFpl(fplId)
```

### שימוש:
```javascript
// בכל מקום שמשתמשים ב-Draft IDs:
const draftId = 729; // Lammens ב-Draft
const fplId = getFplIdFromDraft(draftId); // 733
const player = processedById.get(fplId); // מקבלים את הנתונים
```

## ⚠️ הערות חשובות

### CORS Proxy
הכלי משתמש ב-`corsproxy.io` לעקיפת CORS:
- ✅ עובד מצוין לפיתוח
- ⚠️ יכול להיות איטי לפעמים
- 💡 אלטרנטיבות: 
  - Cloudflare Workers
  - שרת Node.js פשוט
  - Chrome extension להשבתת CORS (לפיתוח בלבד!)

### Cache
- נתוני FPL: 60 דקות
- נתוני Draft: 5 דקות (מתעדכן לעיתים קרובות)
- ניתן למחוק cache ב-localStorage

### שחקנים חסרים
אם יש שחקנים שלא מופו:
1. בדוק את הקונסול - יש רשימה מפורטת
2. ייתכן ששמות שונים (כינויים, שגיאות כתיב)
3. ייתכן ששחקנים חדשים שעדיין לא ב-FPL

## 🐛 פתרון בעיות

### הסגל לא מוצג
1. פתח Developer Tools (F12)
2. עבור ל-Console
3. חפש שגיאות באדום
4. בדוק שה-league ID נכון (689)
5. בדוק שה-entry ID נכון (1889)

### נתונים ישנים
1. נקה Cache: `localStorage.clear()`
2. רענן עם Ctrl+Shift+R
3. נסה במצב Incognito

### Lammens לא מופיע
- בדוק באיזה gameweek אתה
- ייתכן שהוא לא בסגל בגיימוויק הנוכחי
- בדוק ב-`test.html` את המיפוי

## 📝 TODO הבא

- [ ] הוספת אפשרות לבחירת gameweek
- [ ] שיפור ביצועים - caching חכם יותר
- [ ] הוספת תמיכה בליגות מרובות
- [ ] UI לבחירת entry ID
- [ ] Export לExcel/CSV

## 🎯 מה הלאה?

### לגבי CORS Proxy
אם אתה רוצה להסיר את התלות ב-CORS proxy:

**אופציה 1: Cloudflare Workers (מומלץ)**
```javascript
// worker.js
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const apiUrl = url.searchParams.get('url');
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
```

**אופציה 2: Node.js Proxy פשוט**
```javascript
// proxy.js
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

app.get('/api/*', async (req, res) => {
  const url = 'https://fantasy.premierleague.com' + req.path;
  const data = await fetch(url).then(r => r.json());
  res.json(data);
});

app.listen(3000);
```

**אופציה 3: Chrome Extension (לפיתוח)**
- התקן "CORS Unblock" או "Allow CORS"
- השתמש רק לפיתוח מקומי!

## 📚 מקורות

- [FPL API Documentation](https://github.com/vaastav/Fantasy-Premier-League)
- [Draft API Endpoints](https://draft.premierleague.com/api/)
- [Fantasy PL MCP](https://github.com/rishijatia/fantasy-pl-mcp)

## 🙏 תודות

- FPL API - על הנתונים
- הקהילה של FPL - על המידע והכלים
- CORS Proxy - על העזרה בפיתוח

---

**נוצר ב:** 10 נובמבר 2025
**גרסה:** 2.0 (Live Data + ID Mapping)

