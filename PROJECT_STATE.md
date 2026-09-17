# PROJECT_STATE - LinkStop

## Current Focus
**גרסת v1 נבנתה במלואה לפי התוכנית המאושרת** (frontend + Edge Function +
מסמכים משפטיים). האפליקציה עדיין לא נפרסה בפועל ל-GitHub Pages ולא חובר
פרויקט Supabase אמיתי — אלו הצעדים הבאים. ראה "Next Step" למה שנשאר לבצע
לפני שהאפליקציה שמישה בפועל על המכשיר.

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
אין שאלות פתוחות מהתכנון. שאלות חדשות שעלו תוך כדי בנייה:
- [ ] יש לכם פרויקט Supabase קיים, או שצריך להנחות איך ליצור אחד חדש?

## Build Log (v1)
- [x] `index.html` — מסך הבית: טופס הוספת קישור ידני + רשימת כרטיסים
- [x] `share-target.html` — קליטת שיתוף מאנדרואיד (GET params) עם fallback ל-URL בתוך `text`
- [x] `manifest.json` — כולל `share_target` (method GET), `scope`/`start_url` תחת `/linkstop/`, אייקונים
- [x] `sw.js` — Service Worker מינימלי ל-installability בלבד (בלי offline caching מלא)
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

## Next Step (לפני שהאפליקציה שמישה בפועל)
1. **לפרוס ל-GitHub Pages** מהריפו הזה (הגדרות → Pages → branch), ולוודא
   שהיא עולה תחת `/linkstop/`.
2. **ליצור פרויקט Supabase** (אם אין כבר), לפרוס את `supabase/functions/fetch-metadata`
   (`supabase functions deploy fetch-metadata`), ולמלא את `src/js/config.js`
   עם ה-URL וה-anon key האמיתיים.
3. **לבדוק בפועל באנדרואיד**: התקנת PWA ("הוסף למסך הבית"), שיתוף קישור
   מוואטסאפ/פייסבוק/כרום, הוספה ידנית, מחיקה.
4. לשקול שדרוג לוגו/אייקון בעתיד (סוכם כבסיסי בינתיים).

## Files Changed
- `PROJECT_STATE.md` — עודכן
- כל קבצי v1 שנוצרו (ראה "Build Log" למעלה)
