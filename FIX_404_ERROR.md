# 🔧 פתרון לשגיאת 404 - File not found

## ❓ למה קיבלת שגיאה?

השגיאה **404 File not found** יכולה לקרות מכמה סיבות:

### 1️⃣ פתחת את הקובץ ישירות (`file://...`)
❌ **לא עובד:** דאבל קליק על `index.html`  
✅ **צריך:** להריץ שרת HTTP מקומי

### 2️⃣ השרת לא רץ בתיקייה הנכונה
❌ **לא עובד:** השרת רץ בתיקייה אחרת  
✅ **צריך:** להיות בדיוק ב: `/Users/amitzahy/Documents/Draft/FPL_25_26`

### 3️⃣ הכתובת לא נכונה
❌ **לא עובד:** `https://localhost:8000` (עם s)  
✅ **צריך:** `http://localhost:8000` (בלי s)

---

## ✅ פתרון מהיר - עקוב אחרי השלבים האלה:

### שלב 1: פתח Terminal חדש

**Mac**: 
- `Cmd+Space` → הקלד `terminal` → `Enter`

---

### שלב 2: העתק והדבק את השורה הזו:

```bash
cd /Users/amitzahy/Documents/Draft/FPL_25_26 && ./TEST_SERVER.sh
```

**לחץ Enter**

---

### שלב 3: בדוק את הפלט

אתה אמור לראות:

```
🔍 בודק את הסביבה...

📂 תיקייה נוכחית:
/Users/amitzahy/Documents/Draft/FPL_25_26

📋 קבצים בתיקייה:
-rw-r--r--  1 user  staff  24812 Nov 19 15:31 index.html
-rw-r--r--  1 user  staff  209183 Nov 19 15:34 script.js
-rw-r--r--  1 user  staff  18196 Nov 19 15:34 style.css

🐍 גרסת Python:
Python 3.x.x

🌐 מנסה להריץ שרת על http://localhost:8000 ...
Serving HTTP on :: port 8000 ...
```

---

### שלב 4: פתח דפדפן

**בדפדפן**, גלוש ל:

```
http://localhost:8000
```

⚠️ **שים לב**: `http` ולא `https`!

---

## 🎯 אם עדיין לא עובד - בדיקות נוספות:

### בדיקה 1: האם Python מותקן?

```bash
python3 --version
```

**אם מקבל שגיאה** → התקן Python:
- Mac: `brew install python3`
- או הורד מ: https://www.python.org/downloads/

---

### בדיקה 2: האם הפורט תפוס?

**אם מקבל "Address already in use"**, נסה פורט אחר:

```bash
cd /Users/amitzahy/Documents/Draft/FPL_25_26
python3 -m http.server 8080
```

**ואז גלוש ל:** `http://localhost:8080`

---

### בדיקה 3: האם השרת רץ?

**ב-Terminal**, אתה אמור לראות:

```
Serving HTTP on :: port 8000 (http://[::]:8000/) ...
```

**אם לא רואה את זה** → השרת לא רץ!

---

### בדיקה 4: האם הכתובת נכונה?

✅ **נכון**: `http://localhost:8000`  
❌ **לא נכון**: `https://localhost:8000`  
❌ **לא נכון**: `file:///Users/amitzahy/Documents/...`  
❌ **לא נכון**: `localhost:8000` (חסר http://)

---

## 🔍 Debug: מה בדיוק ניסית?

אם עדיין יש בעיה, תענה על השאלות האלה:

1. **איך פתחת את האתר?**
   - [ ] דאבל קליק על index.html
   - [ ] הרצתי שרת והכנסתי לדפדפן
   - [ ] משהו אחר

2. **מה הכתובת בדפדפן?**
   - כתוב בדיוק מה כתוב בשורת הכתובת

3. **מה רואים ב-Terminal?**
   - האם רואים "Serving HTTP..."?
   - האם יש שגיאה?

---

## 💡 טיפ מקצועי

**לפני שמריצים את השרת**, תמיד בדוק:

```bash
# בדוק את התיקייה הנוכחית
pwd

# בדוק שיש index.html
ls index.html
```

**אם שניהם מחזירים תוצאות טובות** → אתה במקום הנכון!

---

## 🚀 הדרך המהירה ביותר (קופי-פייסט):

פשוט העתק והדבק את **כל זה** ב-Terminal:

```bash
cd /Users/amitzahy/Documents/Draft/FPL_25_26 && \
echo "✅ בתיקייה הנכונה" && \
ls index.html > /dev/null 2>&1 && echo "✅ הקבצים קיימים" && \
python3 -c "print('✅ Python מותקן')" && \
echo "" && \
echo "🚀 מריץ שרת..." && \
echo "📌 פתח דפדפן ל: http://localhost:8000" && \
echo "" && \
python3 -m http.server 8000
```

**לחץ Enter** ו**פתח דפדפן** ל: `http://localhost:8000`

---

## 📞 עדיין לא עובד?

אם עדיין יש בעיה, **תעתיק והדביק כאן**:

1. **הפקודה שהרצת**:
   ```
   (הדבק כאן)
   ```

2. **מה רואים ב-Terminal**:
   ```
   (הדבק כאן)
   ```

3. **מה הכתובת בדפדפן**:
   ```
   (הדבק כאן)
   ```

4. **מה השגיאה המדויקת**:
   ```
   (הדבק כאן)
   ```

**ואני אעזור לך לפתור!** 🔧

---

**בהצלחה!** 🎉

