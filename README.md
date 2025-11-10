# FPL Draft Analytics Tool

כלי ניתוח מתקדם לליגות דראפט פנטזי של הפרמיירליג.

## 🚀 תכונות עיקריות

- **ניתוח שחקנים מתקדם** - ציוני דראפט, חיזוי נקודות, מטריצות השוואה
- **ניהול ליגת דראפט** - צפייה בסגלים, טבלת ליגה, המלצות חכמות
- **גרפים ומטריצות** - ויזואליזציות מתקדמות לניתוח ביצועים
- **אימות Google** - גישה מאובטחת עם מצב דמו לצפייה

## 📦 התקנה והפעלה

### דרישות מקדימות
- דפדפן מודרני (Chrome, Firefox, Safari, Edge)
- חיבור לאינטרנט

### הפעלה מקומית
פשוט פתח את `index.html` בדפדפן.

### פריסה ל-GitHub Pages

1. העלה את כל הקבצים למאגר GitHub
2. הפעל GitHub Pages מהגדרות המאגר
3. בחר את הענף הראשי (main/master) כמקור
4. האתר יהיה זמין ב-`https://[username].github.io/[repository-name]`

## 🏗️ מבנה הפרויקט

```
/
├── index.html              # עמוד ראשי
├── style.css              # עיצוב
├── script.js              # לוגיקה ראשית
├── sw.js                  # Service Worker
├── manifest.webmanifest   # PWA Manifest
├── FPL_Bootstrap_static.json  # נתוני שחקנים סטטיים
└── README.md              # תיעוד
```

## 🔧 הגדרות

### Google OAuth
לשימוש באימות Google, עדכן את ה-Client ID ב-`script.js`:
```javascript
googleClientId: 'YOUR_GOOGLE_CLIENT_ID'
```

### ליגת דראפט
עדכן את מזהה הליגה ב-`script.js`:
```javascript
draftLeagueId: 689  // שנה למזהה הליגה שלך
```

## 📊 מקורות נתונים

האתר משתמש ב-API הרשמי של Fantasy Premier League:
- **נתוני שחקנים**: Draft API (`draft.premierleague.com`)
- **משחקים**: Fantasy API (`fantasy.premierleague.com`)
- **CORS Proxy**: `api.allorigins.win` (לפתרון בעיות CORS)

### קובץ נתונים סטטי
הקובץ `FPL_Bootstrap_static.json` משמש כגיבוי כאשר ה-API לא זמין.
כרגע מכיל 670 שחקנים (מעודכן לעונת 2024/25).

**הערה**: ה-API החי של Draft מחזיר 752 שחקנים, אך לעיתים חוסם בקשות.
האתר ינסה תחילה לטעון מהקובץ הסטטי, ואז יעבור ל-API החי דרך CORS proxy.

## 🌐 תאימות דפדפנים

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 🔐 אבטחה ופרטיות

- אימות Google מאובטח
- נתונים נשמרים רק ב-localStorage המקומי
- אין שרת backend - הכל רץ בצד הלקוח
- מצב דמו לצפייה ללא התחברות

## 🐛 פתרון בעיות

### האתר לא טוען נתונים
1. נקה את ה-cache של הדפדפן (Ctrl+Shift+Delete)
2. בדוק את ה-Console (F12) לשגיאות
3. וודא שיש חיבור לאינטרנט

### שחקנים חסרים
- הקובץ הסטטי מכיל 670 שחקנים
- ה-API החי אמור להחזיר 752 שחקנים
- אם ה-API חסום, האתר ישתמש בקובץ הסטטי

### בעיות CORS
האתר משתמש ב-CORS proxy (`api.allorigins.win`).
אם הוא לא זמין, ייתכנו בעיות בטעינת נתונים.

## 📝 רישיון

MIT License - ראה קובץ LICENSE לפרטים

## 👨‍💻 מפתח

Amit Zahy - [amitzahy1@gmail.com](mailto:amitzahy1@gmail.com)

## 🙏 תודות

- Fantasy Premier League API
- Chart.js
- Google OAuth
- AllOrigins CORS Proxy

