# 🏆 FPL Draft Analytics - Version 3.0 (November 2024)

## 📦 תיאור הגרסה

גרסה 3.0 של מערכת הניתוח המתקדמת לליגות דראפט פנטזי פרמייר ליג.

**תאריך יצירה:** 24 נובמבר 2025  
**גרסה:** 3.0  
**סטטוס:** ✅ Production Ready

---

## 📁 קבצים בתיקייה

### קבצי Core
- `index.html` - מבנה HTML ראשי של האפליקציה
- `script.js` - לוגיקה מלאה של האפליקציה (JavaScript)
- `style.css` - עיצוב מלא של האפליקציה (CSS)
- `README.md` - קובץ זה

---

## 🚀 הוראות התקנה והפעלה

### שיטה 1: Local Server (מומלץ)
```bash
# Python 3
python3 -m http.server 8000

# או Python 2
python -m SimpleHTTPServer 8000

# או Node.js
npx http-server -p 8000
```

לאחר מכן פתח בדפדפן: `http://localhost:8000`

### שיטה 2: GitHub Pages
1. העלה את כל הקבצים לריפו GitHub
2. הפעל GitHub Pages מההגדרות
3. האתר יהיה זמין ב-`https://[username].github.io/[repo-name]`

### שיטה 3: Netlify/Vercel
1. גרור את התיקייה לממשק Netlify/Vercel
2. האתר יעלה אוטומטית

---

## ✨ תכונות עיקריות

### 📊 דף נתוני שחקנים
- ✅ טבלה מתקדמת עם מיון וסינון
- ✅ פילטרים חכמים (Top Scorers, Form Players, Value Picks)
- ✅ מטריצות השוואה (Price vs Points, ICT, Team Attack)
- ✅ גרפים אינטראקטיביים
- ✅ השוואת שחקנים (עד 5 שחקנים)
- ✅ תמונות שחקנים עם fallback

### 🏆 דף ליגת דראפט

#### 📋 מבט על (Overview)
- ✅ הרכב שלי על המגרש (4-3-3 / 3-4-3 / 3-5-2)
- ✅ הרכב נוכחי vs אופטימלי
- ✅ מטריקות: xPts, נקודות GW אחרון, PPG/90, Form
- ✅ תמונות שחקנים עם fallback

#### 📊 טבלה וסגלים
- ✅ טבלת ליגה מלאה עם מיון
- ✅ סגלים של כל הקבוצות
- ✅ לוגואים ייחודיים לכל קבוצה
- ✅ מדדים: נצחונות, תיקו, הפסדים, נקודות בעד/נגד

#### 📈 אנליטיקס
- ✅ גרפים: Draft Score, Selected By, xGI, Goals, Assists
- ✅ מטריצות: Attack vs Defense, Form vs Points
- ✅ השוואת קבוצות (טבלה מפורטת)
- ✅ סטטיסטיקות מתקדמות

#### ⚔️ המחזור הבא
- ✅ כל משחקי המחזור הבא
- ✅ חישוב סיכויי ניצחון מתקדם (Form, H2H, Injuries)
- ✅ xPts לכל קבוצה (רק 11 שחקנים מובילים)
- ✅ לוגואים וצבעים ייחודיים

#### 💡 שוק והמלצות
- ✅ זיהוי שחקנים חלשים בסגל
- ✅ המלצות חכמות מהשוק החופשי
- ✅ Smart Score: xPts, Draft Score, Form, Transfers, Ownership
- ✅ מיון לפי עמדה

#### ⚔️ השוואת יריב
- ✅ ניתוח מפורט מול היריב הבא
- ✅ סיכוי לניצחון מתקדם
- ✅ חפיפות ונטרולים
- ✅ המלצות אסטרטגיות (פרימיום - רק למשתמשים רשומים)
- ✅ סטטיסטיקות השוואה

#### 📜 היסטוריית מפגשים
- ✅ כל המשחקים הקודמים מול יריב נבחר
- ✅ תוצאות, נקודות, הרכבים היסטוריים
- ✅ סטטיסטיקות H2H

#### 🔍 ניתוח החלטות הרכב
- ✅ זיהוי טעויות הרכב (שחקנים שהיו צריכים לפתוח)
- ✅ חישוב נקודות שאבדו
- ✅ הרכב אופטימלי למפרע
- ✅ פירוט לפי מחזור (GW 1-12)

---

## 🔧 תכונות טכניות

### 🌐 CORS Proxy Management
- ✅ 3 proxies עם fallback אוטומטי:
  1. `corsproxy.io` (ראשי)
  2. `allorigins.win` (גיבוי 1)
  3. `codetabs.com` (גיבוי 2)
- ✅ Retry logic עם exponential backoff
- ✅ Rate limiting handling

### 💾 Caching System
- ✅ LocalStorage caching
- ✅ TTL configurable (ברירת מחדל: 120 דקות)
- ✅ Cache invalidation אוטומטי
- ✅ Background data loading

### 🔐 Authentication
- ✅ Google OAuth integration
- ✅ Demo mode עם הגבלות
- ✅ Premium features (רק למשתמשים רשומים)
- ✅ Email-based access control

### 📊 Data Processing
- ✅ Player ID mapping (Draft ↔ FPL)
- ✅ Fuzzy matching עם Levenshtein distance
- ✅ Historical lineup loading (GW 1-12)
- ✅ Team aggregates calculation
- ✅ xPts calculation (רק 11 מובילים)

### 🎨 UI/UX
- ✅ Responsive design
- ✅ RTL support (עברית)
- ✅ Dark mode elements
- ✅ Smooth transitions
- ✅ Loading states
- ✅ Error handling עם Toast notifications
- ✅ Modal system
- ✅ Tab navigation

---

## 📈 אלגוריתמים מתקדמים

### 🎯 Win Probability Algorithm
```
Win Probability = sigmoid(
  Base xPts (55%) +
  Form Factor (20%) +
  H2H History (15%) +
  Injury Impact (10%)
)

Range: 25% - 75%
Special: Null team = 50-50
```

### 💡 Smart Recommendation Score
```
Smart Score = 
  xPts (1GW) × 30% +
  Draft Score × 25% +
  Form × 15% +
  Transfers Balance × 20% +
  Ownership × 10% +
  Comeback Bonus
```

### 📊 Team Aggregates
- ✅ מבוסס על historical lineups בפועל
- ✅ רק שחקנים שפתחו ושיחקו (minutes > 0)
- ✅ ממוצע על פני כל המחזורים

---

## 🎨 עיצוב וצבעים

### Color Palette
- **Primary:** `#667eea` → `#764ba2` (Gradient)
- **Success:** `#10b981` → `#34d399`
- **Warning:** `#f59e0b` → `#fbbf24`
- **Danger:** `#ef4444` → `#f87171`
- **Info:** `#3b82f6` → `#60a5fa`

### Team Colors (9 distinct colors)
1. 🦁 Amit United - `#f59e0b` (Orange)
2. 🦊 The Gingers - `#ef4444` (Red)
3. 👑 Hamalik - `#8b5cf6` (Purple)
4. ⚡ PSV Nivey - `#3b82f6` (Blue)
5. 🍷 Francis Bodega FC - `#ec4899` (Pink)
6. ☀️ AEK Shemesh - `#eab308` (Yellow)
7. 🏛️ Merkaz Klita - `#06b6d4` (Cyan)
8. 🚀 Torpedo Eshel - `#10b981` (Green)
9. 🌟 Los chicos - `#6366f1` (Indigo)

---

## 📝 Configuration

### League Settings
```javascript
config = {
  draftLeagueId: 689,
  myTeamName: "Amit United",
  corsProxy: "https://corsproxy.io/?",
  cacheDuration: 120 // minutes
}
```

### API Endpoints
- FPL Bootstrap: `fantasy.premierleague.com/api/bootstrap-static/`
- FPL Live: `fantasy.premierleague.com/api/event/{gw}/live/`
- Draft Details: `draft.premierleague.com/api/league/{id}/details`
- Draft Picks: `draft.premierleague.com/api/entry/{id}/event/{gw}`

---

## 🐛 Known Issues & Limitations

### ⚠️ CORS Proxy
- Draft Standings endpoint מחזיר 404 (fallback עובד)
- Proxies עלולים להיות איטיים בשעות עומס
- Rate limiting אפשרי

### 🖼️ Images
- תמונות שחקנים נטענות מ-`resources.premierleague.com`
- Fallback אוטומטי לתמונת placeholder
- לוגואים של קבוצות הם emojis (לא תמונות אמיתיות)

### 📱 Mobile
- עיצוב responsive אבל מותאם יותר ל-Desktop
- טבלאות עשויות לדרוש גלילה אופקית

---

## 🔄 Version History

### v3.0 (November 24, 2025)
- ✅ תיקון CORS proxy עם fallback mechanism
- ✅ הוספת טאבים: "היסטוריית מפגשים" ו"ניתוח החלטות הרכב"
- ✅ שיפור win probability algorithm
- ✅ תיקון scroll issue בטאב Analytics
- ✅ הוספת player comparison modal
- ✅ מרכוז Rival Analysis header
- ✅ הגדלת שמות קבוצות בדף "המחזור הבא"
- ✅ טעינת historical lineups לכל 12 המחזורים
- ✅ שיפור UI/UX כללי

---

## 👨‍💻 Developer Notes

### File Structure
```
v3_nov24/
├── index.html      (7,421 lines)
├── script.js       (7,421 lines)
├── style.css       (1,200+ lines)
└── README.md       (this file)
```

### Dependencies
- **Chart.js** (v4.4.1) - גרפים
- **chartjs-plugin-annotation** (v3.0.1) - קווי ממוצע
- **chartjs-plugin-datalabels** (v2.2.0) - תוויות על גרפים
- **Google OAuth** - התחברות

### Browser Support
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

---

## 📞 Support & Contact

**Developer:** Amit Zahy  
**Email:** redacted@users.noreply.github.com  
**League ID:** 689  
**Team:** Amit United 🏆🏆

---

## 📄 License

This is a private project for personal use.  
All rights reserved © 2024-2025

---

## 🙏 Credits

- **FPL API** - Fantasy Premier League
- **Draft API** - Draft Fantasy Premier League
- **Chart.js** - Data visualization
- **Google Fonts** - Typography
- **CORS Proxies** - corsproxy.io, allorigins.win, codetabs.com

---

**🚀 Version 3.0 - Ready for Production!**

*Last Updated: November 24, 2025*

