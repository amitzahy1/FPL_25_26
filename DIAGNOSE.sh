#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🔍 FPL Analytics Hub - אבחון מערכת"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Check current directory
echo "📂 בדיקה 1: תיקייה נוכחית"
CURRENT_DIR=$(pwd)
echo "   התיקייה: $CURRENT_DIR"

if [[ "$CURRENT_DIR" == *"FPL_25_26"* ]]; then
    echo "   ✅ אתה בתיקייה הנכונה"
else
    echo "   ⚠️  אזהרה: אולי לא בתיקייה הנכונה"
    echo "   💡 הרץ: cd /Users/amitzahy/Documents/Draft/FPL_25_26"
fi
echo ""

# Test 2: Check for index.html
echo "📄 בדיקה 2: קיום קבצים חיוניים"
if [ -f "index.html" ]; then
    echo "   ✅ index.html נמצא"
else
    echo "   ❌ index.html לא נמצא!"
    echo "   💡 אתה לא בתיקייה הנכונה"
fi

if [ -f "script.js" ]; then
    echo "   ✅ script.js נמצא"
else
    echo "   ❌ script.js לא נמצא!"
fi

if [ -f "style.css" ]; then
    echo "   ✅ style.css נמצא"
else
    echo "   ❌ style.css לא נמצא!"
fi
echo ""

# Test 3: Check Python
echo "🐍 בדיקה 3: Python"
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "   ✅ Python מותקן: $PYTHON_VERSION"
else
    echo "   ❌ Python 3 לא נמצא!"
    echo "   💡 התקן Python: brew install python3"
fi
echo ""

# Test 4: Check if port 8000 is free
echo "🌐 בדיקה 4: זמינות פורט 8000"
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "   ⚠️  פורט 8000 כבר תפוס!"
    echo "   💡 אפשרות 1: עצור את השרת הקיים (Ctrl+C)"
    echo "   💡 אפשרות 2: השתמש בפורט אחר: python3 -m http.server 8080"
else
    echo "   ✅ פורט 8000 פנוי"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📊 סיכום"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ALL_OK=true

if [[ "$CURRENT_DIR" != *"FPL_25_26"* ]]; then
    ALL_OK=false
fi

if [ ! -f "index.html" ]; then
    ALL_OK=false
fi

if ! command -v python3 &> /dev/null; then
    ALL_OK=false
fi

if $ALL_OK; then
    echo "✅ הכל נראה תקין!"
    echo ""
    echo "🚀 להרצת השרת, הרץ:"
    echo "   ./START_SERVER.sh"
    echo ""
    echo "או:"
    echo "   python3 -m http.server 8000"
    echo ""
    echo "ואז פתח דפדפן ל: http://localhost:8000"
else
    echo "⚠️  נמצאו בעיות!"
    echo ""
    echo "📖 קרא את FIX_404_ERROR.md לפתרונות"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

