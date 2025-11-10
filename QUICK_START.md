# ⚡ התחלה מהירה - 5 דקות להעלאה

## 🎯 מטרה
להעלות את האתר ל-GitHub Pages תוך 5 דקות.

## 📋 דרישות
- חשבון GitHub (חינמי)
- Terminal/Command Line

## 🚀 3 שלבים פשוטים

### שלב 1: צור מאגר GitHub (2 דקות)

1. לך ל-https://github.com/new
2. שם המאגר: `fpl-draft-analytics`
3. סמן **Public**
4. לחץ **Create repository**
5. **העתק** את ה-URL שמופיע (משהו כמו `https://github.com/USERNAME/fpl-draft-analytics.git`)

### שלב 2: העלה את הקבצים (2 דקות)

פתח Terminal ונווט לתיקייה:

```bash
cd /Users/amitzahy/Documents/Draft/FPL_25_26/github_upload
```

הרץ את הפקודות הבאות (החלף את ה-URL עם שלך):

```bash
# אתחול Git
git init

# הוספת הקבצים
git add .

# יצירת commit ראשון
git commit -m "Initial commit - FPL Draft Analytics"

# קישור למאגר (החלף USERNAME ו-REPO-NAME!)
git remote add origin https://github.com/USERNAME/REPO-NAME.git

# דחיפה למאגר
git branch -M main
git push -u origin main
```

**או השתמש בסקריפט המוכן:**
```bash
# הגדר את ה-remote (פעם אחת)
git remote add origin https://github.com/USERNAME/REPO-NAME.git

# העלה
./deploy.sh "First deployment"
```

### שלב 3: הפעל GitHub Pages (1 דקה)

1. במאגר GitHub, לחץ **Settings**
2. בתפריט צד, לחץ **Pages**
3. תחת **Source**, בחר:
   - Branch: `main`
   - Folder: `/ (root)`
4. לחץ **Save**
5. המתן דקה ורענן - תראה את כתובת האתר!

## 🎉 זהו! האתר חי!

כתובת האתר שלך:
```
https://USERNAME.github.io/REPO-NAME/
```

## 🔍 בדיקה מהירה

1. פתח את האתר
2. לחץ "צפייה במצב דמו"
3. בדוק שהטבלה מציגה שחקנים
4. עבור ל-"ליגת דראפט" ובדוק שהסגלים מוצגים

## 🔄 עדכונים עתידיים

כל פעם שאתה רוצה לעדכן:

```bash
cd /Users/amitzahy/Documents/Draft/FPL_25_26/github_upload
./deploy.sh "תיאור העדכון"
```

או ידנית:
```bash
git add .
git commit -m "תיאור העדכון"
git push
```

## ❓ שאלות נפוצות

**ש: האתר לא נטען (404)**  
ת: המתן 2-3 דקות אחרי ההעלאה. GitHub Pages לוקח זמן לבנות את האתר.

**ש: CSS לא נטען**  
ת: נקה cache (Ctrl+Shift+Delete) ורענן.

**ש: שחקנים חסרים**  
ת: זה תקין. הקובץ הסטטי מכיל 670 שחקנים. ה-API החי יטען את כל 752.

**ש: איך אני מעדכן את מזהה הליגה?**  
ת: ערוך את `script.js`, שורה 461:
```javascript
draftLeagueId: 689,  // שנה למזהה שלך
```

## 📚 מסמכים נוספים

- **README.md** - תיעוד מלא
- **DEPLOYMENT.md** - מדריך פריסה מפורט
- **SUMMARY.md** - סיכום כל השינויים

## 🆘 עזרה

בעיה? פתח issue ב-GitHub או שלח מייל:
📧 amitzahy1@gmail.com

---

**זמן משוער:** 5 דקות  
**רמת קושי:** קל  
**עלות:** חינם לחלוטין 💰

