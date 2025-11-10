#!/usr/bin/env python3
"""
סקריפט בדיקה לוידוא שהתיקון עובד
"""

import json
import sys

def check_bootstrap_file():
    """בדיקת הקובץ הסטטי"""
    print("🔍 בודק את FPL_Bootstrap_static.json...")
    
    try:
        with open('FPL_Bootstrap_static.json', 'r') as f:
            data = json.load(f)
        
        elements = data.get('elements', [])
        total_players = len(elements)
        
        print(f"✅ סך הכל שחקנים: {total_players}")
        
        if total_players < 750:
            print(f"❌ שגיאה! צריך להיות לפחות 750 שחקנים, יש רק {total_players}")
            return False
        
        # בדיקת שחקנים ספציפיים
        lammens = [p for p in elements if p.get('id') == 729]
        woltemade = [p for p in elements if p.get('id') == 715]
        john = [p for p in elements if p.get('id') == 716]
        
        print("\n🎯 בדיקת שחקנים ספציפיים:")
        
        if lammens:
            print(f"✅ Lammens (ID 729): {lammens[0].get('web_name')} - קיים!")
        else:
            print("❌ Lammens (ID 729): לא נמצא!")
            return False
        
        if woltemade:
            print(f"✅ Woltemade (ID 715): {woltemade[0].get('web_name')} - קיים!")
        else:
            print("❌ Woltemade (ID 715): לא נמצא!")
            return False
        
        if john:
            print(f"✅ John (ID 716): {john[0].get('web_name')} - קיים!")
        else:
            print("❌ John (ID 716): לא נמצא!")
            return False
        
        return True
        
    except FileNotFoundError:
        print("❌ הקובץ FPL_Bootstrap_static.json לא נמצא!")
        return False
    except json.JSONDecodeError:
        print("❌ הקובץ FPL_Bootstrap_static.json לא תקין!")
        return False

def check_bootstrap_api():
    """בדיקת הקובץ API"""
    print("\n🔍 בודק את api/bootstrap.js...")
    
    try:
        with open('api/bootstrap.js', 'r') as f:
            content = f.read()
        
        if 'draft.premierleague.com' in content:
            print("✅ הקובץ משתמש ב-Draft API")
            return True
        elif 'fantasy.premierleague.com' in content:
            print("❌ הקובץ עדיין משתמש ב-Fantasy API!")
            return False
        else:
            print("⚠️  לא מצאתי התייחסות ל-API")
            return False
            
    except FileNotFoundError:
        print("❌ הקובץ api/bootstrap.js לא נמצא!")
        return False

def check_script_js():
    """בדיקת script.js"""
    print("\n🔍 בודק את script.js...")
    
    try:
        with open('script.js', 'r') as f:
            content = f.read()
        
        if 'window.location.origin}/api/bootstrap' in content:
            print("✅ הקוד משתמש ב-Vercel API")
            return True
        else:
            print("⚠️  לא מצאתי שימוש ב-Vercel API")
            return False
            
    except FileNotFoundError:
        print("❌ הקובץ script.js לא נמצא!")
        return False

def main():
    print("=" * 60)
    print("🔧 בדיקת תיקון בעיית רשימת שחקנים")
    print("=" * 60)
    
    results = []
    
    results.append(check_bootstrap_file())
    results.append(check_bootstrap_api())
    results.append(check_script_js())
    
    print("\n" + "=" * 60)
    if all(results):
        print("✅ כל הבדיקות עברו בהצלחה!")
        print("📤 אפשר להעלות את הקבצים ל-GitHub")
        return 0
    else:
        print("❌ יש בעיות שצריך לתקן")
        return 1

if __name__ == '__main__':
    sys.exit(main())

