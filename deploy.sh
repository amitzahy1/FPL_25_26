#!/bin/bash

# 🚀 סקריפט העלאה מהירה ל-GitHub
# שימוש: ./deploy.sh "הודעת commit"

# צבעים לפלט
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🚀 FPL Draft Analytics - Deploy Script${NC}"
echo -e "${BLUE}========================================${NC}\n"

# בדיקה אם יש הודעת commit
if [ -z "$1" ]; then
    echo -e "${YELLOW}⚠️  לא סופקה הודעת commit${NC}"
    echo -e "${YELLOW}📝 משתמש בהודעה ברירת מחדל...${NC}\n"
    COMMIT_MSG="Update: $(date '+%Y-%m-%d %H:%M:%S')"
else
    COMMIT_MSG="$1"
fi

# בדיקה אם Git מאותחל
if [ ! -d .git ]; then
    echo -e "${YELLOW}📦 Git לא מאותחל. מאתחל עכשיו...${NC}"
    git init
    echo -e "${GREEN}✅ Git אותחל בהצלחה${NC}\n"
fi

# בדיקה אם יש remote
if ! git remote | grep -q origin; then
    echo -e "${RED}❌ שגיאה: לא הוגדר remote repository${NC}"
    echo -e "${YELLOW}💡 הוסף remote עם הפקודה:${NC}"
    echo -e "   ${BLUE}git remote add origin https://github.com/USERNAME/REPO-NAME.git${NC}\n"
    exit 1
fi

# הצגת סטטוס
echo -e "${BLUE}📊 סטטוס נוכחי:${NC}"
git status --short
echo ""

# הוספת כל הקבצים
echo -e "${BLUE}📦 מוסיף קבצים...${NC}"
git add .

# יצירת commit
echo -e "${BLUE}💾 יוצר commit: ${YELLOW}\"${COMMIT_MSG}\"${NC}"
git commit -m "$COMMIT_MSG"

# בדיקה אם יש שינויים
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Commit נוצר בהצלחה${NC}\n"
    
    # דחיפה ל-GitHub
    echo -e "${BLUE}🚀 דוחף ל-GitHub...${NC}"
    
    # בדיקה אם הענף הוא main או master
    BRANCH=$(git branch --show-current)
    if [ -z "$BRANCH" ]; then
        BRANCH="main"
        git branch -M main
        echo -e "${YELLOW}📝 שונה שם הענף ל-main${NC}"
    fi
    
    git push -u origin $BRANCH
    
    if [ $? -eq 0 ]; then
        echo -e "\n${GREEN}========================================${NC}"
        echo -e "${GREEN}✅ הצלחה! האתר עודכן ב-GitHub${NC}"
        echo -e "${GREEN}========================================${NC}\n"
        
        # קבלת URL של המאגר
        REPO_URL=$(git remote get-url origin | sed 's/\.git$//')
        
        echo -e "${BLUE}🌐 קישורים שימושיים:${NC}"
        echo -e "   📦 מאגר: ${BLUE}${REPO_URL}${NC}"
        
        # ניסיון לחלץ את שם המשתמש והמאגר
        if [[ $REPO_URL =~ github\.com[:/]([^/]+)/([^/]+) ]]; then
            USERNAME="${BASH_REMATCH[1]}"
            REPONAME="${BASH_REMATCH[2]}"
            echo -e "   🌍 אתר: ${BLUE}https://${USERNAME}.github.io/${REPONAME}/${NC}"
            echo -e "\n${YELLOW}💡 האתר יתעדכן תוך 1-2 דקות${NC}"
        fi
        
        echo ""
    else
        echo -e "\n${RED}❌ שגיאה בדחיפה ל-GitHub${NC}"
        echo -e "${YELLOW}💡 נסה להריץ ידנית:${NC}"
        echo -e "   ${BLUE}git push -u origin $BRANCH${NC}\n"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  אין שינויים לcommit${NC}\n"
fi

echo -e "${GREEN}✨ סיום!${NC}\n"

