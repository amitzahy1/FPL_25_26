# 📤 הוראות העלאה ל-GitHub

## ✅ מה תיקנו

### 1. בעיית CORS Proxy
- **לפני:** `api.allorigins.win` - לא עבד על GitHub Pages
- **אחרי:** `corsproxy.io` - עובד מושלם! ✅

### 2. בעיית מסך התחברות
- **לפני:** מסך ההתחברות לא הופיע
- **אחרי:** מסך ההתחברות מופיע תמיד בפעם הראשונה ✅

### 3. קבצים שהשתנו
- ✅ `script.js` - CORS proxy חדש + תיקון auth
- ✅ `sw.js` - עדכון ל-v18 + API hosts חדש
- ✅ `index.html` - גרסת סקריפט חדשה

## 🚀 איך להעלות ל-GitHub

### אופציה 1: דרך Terminal (מומלץ)

```bash
cd /Users/amitzahy/Documents/Draft/FPL_25_26

# Push לענף הנוכחי
git push origin FPL_Tool_Final_Changes

# אם זה לא עובד, נסה:
git push -u origin FPL_Tool_Final_Changes
```

### אופציה 2: דרך GitHub Desktop

1. פתח את GitHub Desktop
2. בחר את המאגר `FPL_25_26`
3. בחר את הענף `FPL_Tool_Final_Changes`
4. לחץ **Push origin**

### אופציה 3: דרך VS Code / Cursor

1. פתח את Source Control (Ctrl+Shift+G)
2. לחץ על **...** (More Actions)
3. בחר **Push**

## 🔐 אם מתבקש Username/Password

### אם אתה משתמש ב-HTTPS:

```bash
# אופציה 1: השתמש ב-Personal Access Token
# 1. לך ל-GitHub → Settings → Developer settings → Personal access tokens
# 2. צור token חדש עם הרשאות repo
# 3. השתמש ב-token במקום סיסמה

# אופציה 2: שנה ל-SSH
git remote set-url origin git@github.com:USERNAME/FPL_25_26.git
git push origin FPL_Tool_Final_Changes
```

### אם אתה משתמש ב-SSH:

```bash
# וודא שיש לך SSH key
ssh -T git@github.com

# אם לא, צור אחד:
ssh-keygen -t ed25519 -C "amitzahy1@gmail.com"
# הוסף אותו ל-GitHub: Settings → SSH and GPG keys
```

## 📊 מה קורה אחרי ה-Push?

1. **השינויים יעלו לענף `FPL_Tool_Final_Changes`**
2. **אם GitHub Pages מוגדר:**
   - האתר יתעדכן אוטומטית תוך 1-2 דקות
   - תוכל לראות את השינויים ב-`https://USERNAME.github.io/FPL_25_26/`

3. **אם GitHub Pages לא מוגדר:**
   - עקוב אחרי `DEPLOYMENT.md` להגדרה

## 🧪 בדיקה אחרי העלאה

1. **פתח את האתר:**
   ```
   https://amitzahy1.github.io/FPL_25_26/
   ```

2. **נקה Cache (חשוב!):**
   - Chrome: Ctrl+Shift+Delete → Clear site data
   - או: F12 → Application → Clear storage

3. **בדוק שמסך ההתחברות מופיע:**
   - ✅ אתה אמור לראות את מסך ההתחברות
   - ✅ לחץ "צפייה במצב דמו"

4. **בדוק ב-Console (F12):**
   ```
   צפוי לראות:
   📡 Using CORS proxy for: https://draft.premierleague.com/...
   ✅ Successfully fetched data from API
   
   לא צפוי לראות:
   ❌ blocked by CORS policy
   ❌ net::ERR_FAILED
   ```

## 🎯 סיכום

**Commit שנוצר:**
```
🔧 Fix CORS proxy and login screen issues

- Replace api.allorigins.win with corsproxy.io
- Fix login screen not showing
- Update service worker to v18
- Add comprehensive documentation
```

**קבצים שהשתנו:** 40
**שורות שנוספו:** 8,191
**שורות שנמחקו:** 402

**מוכן ל-Push!** פשוט הרץ:
```bash
git push origin FPL_Tool_Final_Changes
```

---

**זקוק לעזרה?** פתח issue או שלח מייל ל-amitzahy1@gmail.com

