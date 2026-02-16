# 🚀 איך להריץ את האתר על שרת מקומי

## למה צריך שרת מקומי?

אתרים מודרניים עם JavaScript לא יכולים לפעול ישירות מקובץ (`file://`) בגלל הגבלות אבטחה של הדפדפן. אתה צריך שרת HTTP מקומי.

---

## ✅ דרך 1: הכי קלה - סקריפט אוטומטי (מומלץ!)

### Mac / Linux:

1. **פתח Terminal** בתיקיית הפרויקט:
   ```bash
   cd /Users/amitzahy/Documents/Draft/FPL_25_26
   ```

2. **הרץ את הסקריפט**:
   ```bash
   ./START_SERVER.sh
   ```

3. **פתח דפדפן** וגלוש ל:
   ```
   http://localhost:8000
   ```

4. **לעצור את השרת**: לחץ `Ctrl+C` בטרמינל

---

## 🐍 דרך 2: Python Manual (אם הסקריפט לא עובד)

### Python 3 (Mac/Linux/Windows):

```bash
# נווט לתיקיית הפרויקט
cd /Users/amitzahy/Documents/Draft/FPL_25_26

# הרץ שרת
python3 -m http.server 8000
```

### Python 2 (ישן):

```bash
python -m SimpleHTTPServer 8000
```

### ואז פתח:
```
http://localhost:8000
```

---

## 📦 דרך 3: VS Code Live Server (אם אתה משתמש ב-VS Code)

1. **התקן את התוסף**:
   - פתח VS Code
   - לחץ על Extensions (Ctrl+Shift+X)
   - חפש "Live Server"
   - לחץ Install

2. **הרץ את השרת**:
   - פתח את `index.html` ב-VS Code
   - לחץ ימני → "Open with Live Server"
   - או לחץ על הכפתור "Go Live" בסטטוס בר

3. **הדפדפן ייפתח אוטומטית** ב:
   ```
   http://127.0.0.1:5500
   ```

---

## 🌐 דרך 4: Node.js http-server (אם יש לך Node.js)

### התקנה (פעם אחת):
```bash
npm install -g http-server
```

### הרצה:
```bash
cd /Users/amitzahy/Documents/Draft/FPL_25_26
http-server -p 8000
```

### פתח:
```
http://localhost:8000
```

---

## 🔧 פתרון בעיות נפוצות

### ❌ "Port already in use"

**הבעיה**: פורט 8000 כבר תפוס.

**פתרון 1**: השתמש בפורט אחר
```bash
python3 -m http.server 8080
# ואז פתח: http://localhost:8080
```

**פתרון 2**: מצא ועצור את התהליך:
```bash
# Mac/Linux
lsof -ti:8000 | xargs kill -9

# Windows
netstat -ano | findstr :8000
taskkill /PID <PID_NUMBER> /F
```

---

### ❌ "python3: command not found"

**פתרון Mac**:
1. התקן Python:
   ```bash
   brew install python3
   ```
   (צריך להתקין Homebrew קודם: https://brew.sh)

**פתרון Windows**:
1. הורד Python מ: https://www.python.org/downloads/
2. בהתקנה, סמן ✅ "Add Python to PATH"

---

### ❌ "CORS Error" / "Failed to load resource"

**הסיבה**: פתחת את הקובץ ישירות (`file://...`)

**פתרון**: **חובה** להשתמש בשרת מקומי (אחת מהדרכים למעלה)

---

## 📱 איך לגשת מהמובייל שלך (באותה רשת WiFi)

1. **הרץ את השרת** במחשב (כמו למעלה)

2. **מצא את ה-IP של המחשב**:

   **Mac**:
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

   **Windows**:
   ```bash
   ipconfig
   ```
   חפש את ה-"IPv4 Address" (למשל: `192.168.1.100`)

3. **במובייל**, פתח דפדפן וגלוש ל:
   ```
   http://192.168.1.100:8000
   ```
   (החלף `192.168.1.100` ב-IP שמצאת)

---

## 🎯 טיפים מקצועיים

### ✅ רענון אוטומטי (Hot Reload)
השתמש ב-**VS Code Live Server** - הדף מתרענן אוטומטית כשאתה שומר שינויים!

### ✅ לראות את ה-Console
פתח Developer Tools (F12 או Cmd+Option+I) כדי לראות שגיאות ולוגים.

### ✅ רענון מלא (Hard Refresh)
- **Mac**: `Cmd+Shift+R`
- **Windows**: `Ctrl+Shift+R`
- זה מוחק את ה-cache ומבטיח שאתה רואה את הגרסה האחרונה!

---

## 🚀 המלצה שלי

**למתחילים**: השתמש ב-**START_SERVER.sh** (הדרך הכי קלה!)

**למפתחים**: השתמש ב-**VS Code Live Server** (עם רענון אוטומטי!)

---

## 📞 עזרה נוספת?

אם משהו לא עובד, תבדוק:
1. ✅ האם אתה בתיקייה הנכונה? (`pwd` להציג תיקייה נוכחית)
2. ✅ האם `index.html` קיים בתיקייה? (`ls index.html`)
3. ✅ האם השרת רץ? (צריך לראות הודעה "Serving HTTP...")
4. ✅ האם הכתובת נכונה? (`http://localhost:8000` - שים לב ל-**http** ולא https!)

---

**בהצלחה! 🎉**

