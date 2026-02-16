# 🚀 מדריך מהיר - 60 שניות

## צעד 1: פתח Terminal 

**Mac**: 
- לחץ `Cmd+Space`
- הקלד `terminal`
- לחץ `Enter`

**Windows**:
- לחץ `Win+R`
- הקלד `cmd`
- לחץ `Enter`

---

## צעד 2: נווט לתיקייה

העתק והדבק את הפקודה הזו ב-Terminal:

```bash
cd /Users/amitzahy/Documents/Draft/FPL_25_26
```

לחץ `Enter`

---

## צעד 3: הרץ את השרת

**Mac/Linux**: העתק והדבק:
```bash
./START_SERVER.sh
```

**Windows**: העתק והדבק:
```bash
START_SERVER.bat
```

לחץ `Enter`

---

## צעד 4: פתח דפדפן

בדפדפן שלך (Chrome/Safari/Edge), גלוש ל:

```
http://localhost:8000
```

---

## ✅ זהו! האתר צריך להיפתח

אתה אמור לראות:
1. 🎨 **מסך כניסה** עם לוגו FPL
2. 👁️ **כפתור "מצב דמו"** - לחץ עליו לצפייה מהירה
3. ⚽ **הכותרת החדשה** "FPL Pro Analytics Hub"

---

## 🛑 איך לעצור את השרת?

חזור ל-Terminal ולחץ:
```
Ctrl+C
```

---

## ❓ בעיות?

### "python3: command not found"
➡️ התקן Python מ: https://www.python.org/downloads/

### "Port 8000 already in use"
➡️ נסה פורט אחר:
```bash
python3 -m http.server 8080
```
ואז גלוש ל: `http://localhost:8080`

### האתר לא נפתח
➡️ בדוק שהכתובת היא **http** (לא https):
```
http://localhost:8000  ✅
https://localhost:8000 ❌
```

---

## 🎉 כל הכבוד!

עכשיו אתה יכול:
- ✅ לראות את האתר המלא
- ✅ לבדוק את הכותרת החדשה בדף הדראפט
- ✅ לעבור בין הטאבים
- ✅ לבדוק שכל העיצובים עובדים

---

**רוצה עוד עזרה?**  
📖 קרא את [HOW_TO_RUN_LOCALLY.md](HOW_TO_RUN_LOCALLY.md) למדריך מפורט

