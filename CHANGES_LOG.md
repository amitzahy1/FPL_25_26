# 📝 רשימת שינויים מפורטת

## 🗓️ תאריך: 9 בנובמבר 2025

---

## 🎯 בעיות שתוקנו

### 1. 🏆 שחקנים חסרים בסגל דראפט
**בעיה**: שחקנים כמו Woltemade ו-Lammens שהצטרפו אחרי פתיחת ליגת הדראפט לא הופיעו בטבלה.

**פתרון**:
- הוספת לוגיקה ב-`script.js` שמזהה שחקנים חסרים
- טעינה דינמית מ-API החי של FPL
- עיבוד והוספה אוטומטית לטבלה

**קבצים שהשתנו**:
- `script.js` (שורות 2925-2968)

---

### 2. 📊 עמודת "קבוצת דראפט" חסרה
**בעיה**: לא הייתה דרך לראות לאיזו קבוצת דראפט שייך כל שחקן.

**פתרון**:
- הוספת עמודה חדשה בטבלת נתוני שחקנים
- מיפוי בין player ID ל-team ID
- הצגת שם הקבוצה עם tooltip

**קבצים שהשתנו**:
- `index.html` (שורה 264)
- `script.js` (שורות 548, 1023-1026, 1035, 1065-1069, 2898-2968)
- `style.css` (שורות 250-259)

---

### 3. 🌐 בעיות CORS
**בעיה**: שגיאות CORS חסמו טעינת נתונים מ-FPL API.

**פתרון**:
- מעבר מלא ל-Vercel API
- הסרת כל CORS Proxies
- הוספת CORS headers לכל קבצי ה-API

**קבצים שהשתנו**:
- `script.js` (שורה 439, כל הקריאות ל-API)
- `vercel.json` (שורות 31-49)
- `api/bootstrap.js` (שורות 6-14)
- `api/fixtures.js` (שורות 6-14)
- `api/draft/[leagueId]/details.js` (שורות 6-14)
- `api/draft/[leagueId]/standings.js` (שורות 6-14)
- `api/draft/entry/[entryId]/picks.js` (שורות 6-14, 28-48)

---

## 📁 קבצים שהשתנו

### index.html
```diff
+ <th onclick="sortTable(5)">קבוצת דראפט<span class="sort-indicator"></span></th>
```
- הוספת עמודת "קבוצת דראפט"
- תיקון אינדקסים של `sortTable()`

### script.js
```javascript
// הוספת מיפוי player ID → team ID
state.draft = {
    ...
    playerIdToTeamId: new Map(), // ✅ NEW
};

// הוספת לוגיקה לטעינת שחקנים חסרים
const missingPlayerIds = Array.from(state.draft.ownedElementIds)
    .filter(id => !processedById.has(id));

if (missingPlayerIds.length > 0) {
    // Fetch from live API and add to processed data
}

// הוספת עמודת draft team ב-HTML
<td class="draft-team-cell" title="${draftTeamName}">${draftTeamName}</td>
```

### style.css
```css
.draft-team-cell {
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.85em;
    color: var(--text-secondary);
    text-align: center;
    font-weight: 600;
}
```

### vercel.json
```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        },
        ...
      ]
    }
  ]
}
```

### api/draft/entry/[entryId]/picks.js
```javascript
// תיקון: טעינת gameweek נוכחי
const publicResponse = await fetch(
    `https://draft.premierleague.com/api/entry/${entryId}/public`
);
const publicData = await publicResponse.json();
const currentEvent = publicData.entry?.current_event || 1;

// עכשיו טוען את ה-picks של ה-gameweek הנוכחי
const response = await fetch(
    `https://draft.premierleague.com/api/entry/${entryId}/event/${currentEvent}`
);
```

---

## 🔍 איך לבדוק שהתיקונים עובדים

### בדיקה 1: עמודת "קבוצת דראפט"
1. פתח את טבלת נתוני שחקנים
2. חפש את העמודה "קבוצת דראפט" (אחרי "קבוצה")
3. וודא שיש שמות קבוצות דראפט בעמודה

### בדיקה 2: שחקנים חסרים
1. פתח Console (F12)
2. חפש את ההודעה: "✅ Found X missing players in bootstrap"
3. וודא ש-Woltemade ו-Lammens מופיעים בטבלה
4. חפש אותם בשורת החיפוש

### בדיקה 3: CORS
1. פתח Console (F12)
2. רענן את הדף
3. וודא שאין שגיאות CORS
4. וודא שכל הנתונים נטענים בהצלחה

---

## 📊 סטטיסטיקות

- **קבצים שהשתנו**: 9
- **שורות קוד שנוספו**: ~150
- **שורות קוד שהוסרו**: ~50
- **פיצ'רים חדשים**: 2 (עמודת דראפט, טעינת שחקנים חסרים)
- **באגים שתוקנו**: 3 (CORS, שחקנים חסרים, gameweek picks)

---

## ✅ TODO הבא

- [ ] מערכת התראות חכמות (notifications)
- [ ] שיפורים נוספים בביצועים
- [ ] אופטימיזציה של cache

---

**תאריך עדכון**: 9 בנובמבר 2025, 12:45
**גרסה**: 2.1.0
