# 🚀 מדריך פריסה ל-GitHub Pages

## שלב 1: הכנת המאגר

### 1.1 יצירת מאגר GitHub חדש
1. היכנס ל-[GitHub](https://github.com)
2. לחץ על **New Repository**
3. שם המאגר: `fpl-draft-analytics` (או כל שם אחר)
4. הגדר כ-**Public** (חובה ל-GitHub Pages)
5. **אל** תסמן "Initialize with README" (כבר יש לנו)
6. לחץ **Create Repository**

### 1.2 העלאת הקבצים למאגר

```bash
# נווט לתיקיית הפרויקט
cd /Users/amitzahy/Documents/Draft/FPL_25_26/github_upload

# אתחול Git (אם עדיין לא)
git init

# הוסף את כל הקבצים
git add .

# צור commit ראשון
git commit -m "Initial commit - FPL Draft Analytics Tool"

# קשר למאגר המרוחק (החלף USERNAME ו-REPO-NAME)
git remote add origin https://github.com/USERNAME/REPO-NAME.git

# דחוף למאגר
git push -u origin main
```

**אם יש בעיה עם השם של הענף:**
```bash
# שנה את שם הענף ל-main
git branch -M main
git push -u origin main
```

## שלב 2: הפעלת GitHub Pages

1. במאגר GitHub, לך ל-**Settings** (הגדרות)
2. בתפריט הצד, לחץ על **Pages**
3. תחת **Source**, בחר:
   - **Branch**: `main`
   - **Folder**: `/ (root)`
4. לחץ **Save**
5. המתן 1-2 דקות
6. רענן את הדף - תראה הודעה:
   ```
   Your site is live at https://USERNAME.github.io/REPO-NAME/
   ```

## שלב 3: בדיקת האתר

### 3.1 פתח את האתר
פתח את הכתובת: `https://USERNAME.github.io/REPO-NAME/`

### 3.2 בדיקות חיוניות

✅ **בדוק שהאתר נטען:**
- האם מסך ההתחברות מופיע?
- האם העיצוב נראה תקין?

✅ **בדוק את ה-Console (F12):**
```
צפוי לראות:
✅ Loaded bootstrap data from static file (670 players)
✅ Successfully fetched X draft players
📡 Using CORS proxy for: ...
```

✅ **התחבר במצב דמו:**
- לחץ על "צפייה במצב דמו"
- בדוק שהטבלה מציגה שחקנים
- בדוק שהפילטרים עובדים

✅ **בדוק את טאב הדראפט:**
- לחץ על "ליגת דראפט"
- בדוק שהסגלים מוצגים
- בדוק שטבלת הליגה מוצגת

## שלב 4: עדכונים עתידיים

כאשר אתה רוצה לעדכן את האתר:

```bash
# ודא שאתה בתיקייה הנכונה
cd /Users/amitzahy/Documents/Draft/FPL_25_26/github_upload

# הוסף שינויים
git add .

# צור commit עם תיאור
git commit -m "תיאור השינוי"

# דחוף לGitHub
git push origin main
```

האתר יתעדכן אוטומטית תוך 1-2 דקות.

## 🔧 פתרון בעיות נפוצות

### בעיה: האתר לא נטען (404)
**פתרון:**
1. וודא שהענף הוא `main` ולא `master`
2. וודא שהתיקייה היא `/ (root)` ולא `/docs`
3. המתן 5 דקות ורענן

### בעיה: CSS לא נטען
**פתרון:**
בדוק את הנתיבים ב-`index.html`:
```html
<link rel="stylesheet" href="./style.css">
<script src="./script.js"></script>
```

### בעיה: נתונים לא נטענים
**פתרון:**
1. פתח Console (F12)
2. חפש שגיאות CORS
3. וודא ש-CORS proxy זמין: `https://api.allorigins.win`

### בעיה: שחקנים חסרים
**הסבר:**
- הקובץ הסטטי מכיל 670 שחקנים
- ה-API החי אמור להחזיר 752 שחקנים
- האתר ינסה לטעון מה-API החי דרך CORS proxy
- אם זה נכשל, הוא ישתמש בקובץ הסטטי

## 📊 עדכון נתוני שחקנים

אם אתה רוצה לעדכן את `FPL_Bootstrap_static.json`:

1. פתח את האתר בדפדפן
2. פתח Console (F12)
3. הרץ:
```javascript
fetch('https://api.allorigins.win/raw?url=https://draft.premierleague.com/api/bootstrap-static')
  .then(r => r.json())
  .then(data => {
    console.log('Players:', data.elements.length);
    // Copy the JSON and save to file
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'FPL_Bootstrap_static.json';
    a.click();
  });
```

## 🔐 הגדרת Google OAuth (אופציונלי)

אם אתה רוצה אימות Google אמיתי:

1. לך ל-[Google Cloud Console](https://console.cloud.google.com)
2. צור פרויקט חדש
3. הפעל Google OAuth API
4. צור OAuth Client ID:
   - Application type: **Web application**
   - Authorized JavaScript origins: `https://USERNAME.github.io`
   - Authorized redirect URIs: `https://USERNAME.github.io/REPO-NAME/`
5. העתק את ה-Client ID
6. עדכן ב-`script.js`:
```javascript
googleClientId: 'YOUR_ACTUAL_CLIENT_ID_HERE'
```
7. שמור ו-push לGitHub

## 📱 הפיכת האתר ל-PWA

האתר כבר מוכן להיות PWA (Progressive Web App):

1. פתח את האתר בנייד
2. בחר "Add to Home Screen"
3. האתר יפתח כאפליקציה

## 🎯 סיכום

אחרי שתעלה את הקבצים ל-GitHub Pages, האתר:
- ✅ יעבוד ללא Vercel
- ✅ יטען נתונים דרך CORS proxy
- ✅ ישתמש בקובץ סטטי כגיבוי
- ✅ יהיה זמין 24/7
- ✅ יתעדכן אוטומטית עם כל push

**כתובת האתר הסופית:**
```
https://USERNAME.github.io/REPO-NAME/
```

---

**זקוק לעזרה?** פתח issue במאגר או שלח מייל ל-amitzahy1@gmail.com

