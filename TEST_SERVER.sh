#!/bin/bash

echo "🔍 בודק את הסביבה..."
echo ""
echo "📂 תיקייה נוכחית:"
pwd
echo ""
echo "📋 קבצים בתיקייה:"
ls -la *.html *.js *.css 2>/dev/null || echo "❌ קבצים לא נמצאו!"
echo ""
echo "🐍 גרסת Python:"
python3 --version 2>/dev/null || echo "❌ Python 3 לא נמצא"
echo ""
echo "🌐 מנסה להריץ שרת על http://localhost:8000 ..."
echo ""
echo "⚠️  אם השרת רץ, פתח דפדפן ל: http://localhost:8000"
echo "⚠️  לעצור את השרת: לחץ Ctrl+C"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start server
python3 -m http.server 8000

