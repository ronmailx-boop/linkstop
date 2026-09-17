# PROJECT_STATE - LinkStop

## Current Focus
**גרסת v1 חיה, עובדת, ומאומתת קצה-לקצה בפועל אצל המשתמש** (2026-09-17,
"גרסה 3"). האתר פרוס ב-GitHub Pages, מחובר לפרויקט Supabase (`linkstop`),
כותרות עבריות ואנגליות מוצגות מלאות ונכונות. עברנו סבב דיבוג ארוך שבו
התברר ש-**Pages Source הוחלף בטעות ל-"GitHub Actions" ותקע את כל הפריסות
במשך כשעה** (לא היה קשור בכלל ל-Service Worker/מטמון כפי שחשדנו קודם) -
ר' סעיף "GitHub Pages" למטה לפרטים ולקח חשוב לעתיד. נותרו רק בדיקות
נוספות באנדרואיד (התקנה, שיתוף) ומשימות עתידיות לא-חוסמות (שדרוג לוגו,
מילוי placeholders במסמכים המשפטיים).

## Decisions Made
- [x] נקרא CLAUDE.md; עקרון האבטחה הותאם ל-Supabase (RLS policies במקום Firestore Rules) לפי הנחיית המשתמש
- [x] סטאק מאושר: Frontend סטטי ב-GitHub Pages, Backend/DB = Supabase רק לפי הצורך בפועל
- [x] הוצעה תוכנית מבנה תיקיות ראשונית (כולל `docs/legal/`, `PROJECT_STATE.md` בשורש)
- [x] הוצע `share_target` עם `method: GET` (ולא POST) — אין צורך ב-Service Worker לתפיסת הבקשה כי אין שיתוף קבצים, רק טקסט/קישור
- [x] זוהה שSupabase Edge Function **נדרש בהכרח** לחילוץ מטא-דאטה (og:title/og:image וכו') בגלל מגבלת CORS על fetch מהקליינט לאתרים חיצוניים
- [x] **הוחלט: מכשיר אנדרואיד יחיד, בלי ריבוי מכשירים בינתיים** → persistence ב-**localStorage בלבד** ל-v1, בלי Supabase Postgres
- [x] כתוצאה מכך: **אין צורך ב-Supabase Auth ואין צורך ב-DB בכלל ל-v1** — Supabase יידרש רק ל-Edge Function של חילוץ מטא-דאטה
- [x] **הוחלט: Project Page רגיל (`username.github.io/linkstop/`), בלי דומיין מותאם אישית** → `start_url`/`scope`/`action` ב-manifest יכללו פריפיקס `/linkstop/`
- [x] **הוחלט: אייקון/לוגו בסיסי זמני ל-v1** (192/512px + maskable) — שדרוג עיצובי בעתיד לא חוסם את הבנייה
- [x] **הוחלט: offline לא קריטי ל-v1** — Service Worker רק לצורך installability (לא cache מלא של תוכן/תמונות)
- [x] **הוחלט: מבנה שדות מינימלי ל-v1** — `url, title, image, description, source, created_at` בלבד, בלי תיוג/חיפוש/ארכוב כרגע

## Open Questions
אין שאלות פתוחות.

## Supabase (הושלם ואומת)
- [x] נוצר פרויקט Supabase ייעודי בשם **linkstop** (ref: `ehqypnefrnpeoqulyeqm`, region: `eu-central-1`, org: `ronmailx-boop's Org`) - היה כבר פרויקט אחר בחשבון ("ronmailx-boop's Project"), המשתמש בחר ביצירת פרויקט חדש וייעודי
- [x] נפרסה `supabase/functions/fetch-metadata` לפרויקט (status: ACTIVE, `verify_jwt: true`, כרגע גרסה v2)
- [x] `src/js/config.js` עודכן עם ה-URL וה-anon key האמיתיים של הפרויקט
- [x] **בדיקת קצה-לקצה אושרה על ידי המשתמש** - קישור פייסבוק נשמר עם כותרת, תיאור ותמונה אמיתיים
- [x] **נמצא ותוקן באג**: כותרות עם ישויות HTML מספריות (`&#x5e0;` וכו', כפי שפייסבוק מקודד עברית) לא פוענחו - תוקן ב-`decodeHtmlEntities`, נפרס כ-v2, מוזג ב-PR #3

## Build Log (v1)
- [x] `index.html` — מסך הבית: טופס הוספת קישור ידני + רשימת כרטיסים
- [x] `share-target.html` — קליטת שיתוף מאנדרואיד (GET params) עם fallback ל-URL בתוך `text`
- [x] `manifest.json` — כולל `share_target` (method GET), `scope`/`start_url` תחת `/linkstop/`, אייקונים
- [x] `sw.js` — Service Worker מינימלי ל-installability בלבד. **חשוב:** אסטרטגיית fetch היא **network-first** (לא cache-first!) - שונה מהגרסה המקורית אחרי שהתגלה שקאש-פירסט חוסם כל עדכון עתידי מלהגיע למשתמשים שכבר ביקרו באתר (ר' PR #6). כל שינוי עתידי ב-`CACHE_NAME` (`linkstop-shell-vN`) ינקה קאש ישן.
- [x] `src/css/style.css` — עיצוב RTL, mobile-first, פלטת סגול
- [x] `src/js/storage.js` — localStorage wrapper (get/add/delete)
- [x] `src/js/metadata.js` — קריאה ל-Edge Function עם timeout ו-fallback ל-null בכשל
- [x] `src/js/share-handler.js` — פרסור פרמטרים, זיהוי מקור (whatsapp/facebook/other), ולידציית URL (חוסם `javascript:` וכו')
- [x] `src/js/app.js` — רנדור כרטיסים דרך DOM API (לא innerHTML, למניעת XSS), טופס הוספה, מחיקה עם אישור, רישום SW
- [x] `src/js/config.js` — פלייסהולדר ל-`SUPABASE_FUNCTION_URL`/`SUPABASE_ANON_KEY` (**דורש מילוי אחרי יצירת הפרויקט**)
- [x] `src/icons/icon-192.png`, `icon-512.png` — אייקון בסיסי זמני (סגול + סמל קישור לבן), maskable
- [x] `supabase/functions/fetch-metadata/index.ts` — Edge Function: fetch + parse og:tags, הגנת SSRF בסיסית (חסימת רשתות פנימיות/לוקאליות), timeout, הגבלת גודל HTML
- [x] `docs/legal/privacy-policy.md`, `terms-of-service.md`, `cookie-policy.md`, `accessibility-statement.md` — טיוטות עברית עם `[PLACEHOLDER]`

**בדיקות שבוצעו:** האתר נטען ללא שגיאות קונסול/מודולים (נבדק דרך Chromium
headless); לוגיקת `share-handler.js` (זיהוי URL מתוך share params, זיהוי
מקור, ולידציית URL כולל חסימת `javascript:`) נבדקה ועברה ב-Node ישירות.
**לא בוצעה** בדיקת אינטראקציה מלאה בדפדפן אמיתי (טופס/מחיקה/PWA install)
מאחר שאין כלי Playwright/Puppeteer מותקן בסביבה זו — מומלץ לבדוק ידנית
באנדרואיד אחרי הפריסה.

## GitHub Pages (חי ומאומת - 2026-09-17)
- [x] **הוחלט (לצמיתות): כל שינוי עתידי יעבור PR מהברנץ הייעודי ומוזג אוטומטית ל-`main`** (עם merge commit רגיל, לא squash - כדי למנוע קונפליקטים חוזרים בין הברנץ הייעודי ל-`main`) - Pages תמיד תשרת מ-`main`. אין צורך לשאול שוב על כך בעתיד.
- [x] PR #1–#10 נפתחו ומוזגו ל-`main` - כל קוד ה-v1 (כולל תיקוני הבאגים) נמצא ב-`main`
- [x] **Source חייב להיות "Deploy from a branch" → `main` → `/(root)`, לעולם לא "GitHub Actions"** (אין לנו workflow file בריפו). **תקרית שקרתה בפועל**: ה-Source הוחלף בטעות ל-"GitHub Actions" בזמן שהמשתמש התעסק בהגדרות (סביב אותו זמן שהוא הזכיר "הפעלתי github actions") - מאותו רגע ואילך **אף push חדש לא הפעיל בנייה** (0 deployments חדשים במשך כשעה, PR #3 עד #9 מעולם לא הגיעו בפועל לאתר החי), בלי שום שגיאה גלויה. זוהה ותוקן ב-2026-09-17 15:30 בערך על ידי בדיקת Settings → Pages ומעבר חזרה ל-"Deploy from a branch". **אם בעתיד נראה ששינויים לא מגיעים לאתר החי - זו הבדיקה הראשונה שצריך לעשות** (`Settings → Pages`, לוודא ש-Source הוא "Deploy from a branch"), לפני שחושדים בבעיות Service Worker/מטמון דפדפן.
- [x] **מנגנון אבחון קבוע: מספר גרסה גלוי** ("גרסה N") ב-`index.html` (ב-HTML נקי, לא דרך JS) ליד הכותרת. **יש להעלות את המספר בכל שינוי עתידי** - זו הדרך המהירה ביותר לוודא שהמשתמש רואה בפועל את מה שנפרס, לפני שמניחים שהקוד "עובד" רק כי הוא נכון ב-`main`. גרסה נוכחית: **3**.
- [x] **נמצא ותוקן באג נוסף**: ה-Service Worker הגיש קבצים ב-cache-first (לא היה הגורם האמיתי הפעם, אבל תוקן ונשאר תיקון טוב): תוקן ל-network-first + `updateViaCache:"none"` + auto-reload ב-`controllerchange` (PR #6, #9) - כדי שעדכונים עתידיים יתעדכנו בלי ניקוי ידני של קאש.
- [x] **בדיקת קצה-לקצה מלאה אושרה**: כותרת עברית מלאה (Facebook, ישויות HTML מספריות) + כותרת אנגלית/מעורבת מלאה בלי קיצוץ (Notion) + "גרסה 3" נראים אצל המשתמש בפועל.

## Next Step (לא חוסמים - שיפורים עתידיים)
1. **לבדוק בפועל באנדרואיד**: התקנת PWA ("הוסף למסך הבית"), שיתוף קישור
   מוואטסאפ/פייסבוק/כרום (לא רק כרום ידני), מחיקה.
2. לשקול שדרוג לוגו/אייקון בעתיד (סוכם כבסיסי בינתיים).
3. למלא בהמשך את ה-`[PLACEHOLDER]` במסמכים המשפטיים (`docs/legal/`) בפרטים אמיתיים (אימייל ליצירת קשר וכו') לפני שהאפליקציה יוצאת לשימוש רחב.
4. **בכל commit עתידי: להעלות את מספר "גרסה N" ב-`index.html`, ללא יוצא מן הכלל** - גם בשינויים שנראים "backend-only" (כמו Edge Function). המשתמש ביקש זאת מפורשות; אל תנסה לשקול "אם זה רלוונטי" - פשוט להעלות בכל commit. גרסה נוכחית: **4**.

## Files Changed
- `PROJECT_STATE.md` — עודכן
- כל קבצי v1 שנוצרו (ראה "Build Log" למעלה)
