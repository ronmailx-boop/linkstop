# PROJECT_STATE - LinkStop

## Current Focus
שלב תכנון ארכיטקטורה ראשוני (טרם נכתב קוד אפליקציה). הוצגה למשתמש תוכנית מבנה
תיקיות, סכימת `share_target`, ומיפוי היכן Supabase נדרש בהכרח מול היכן אפשר
בלעדיו. ממתין לתשובות המשתמש לשאלות ההבהרה לפני תחילת בנייה בפועל.

## Decisions Made
- [x] נקרא CLAUDE.md; עקרון האבטחה הותאם ל-Supabase (RLS policies במקום Firestore Rules) לפי הנחיית המשתמש
- [x] סטאק מאושר: Frontend סטטי ב-GitHub Pages, Backend/DB = Supabase רק לפי הצורך בפועל
- [x] הוצעה תוכנית מבנה תיקיות ראשונית (כולל `docs/legal/`, `PROJECT_STATE.md` בשורש)
- [x] הוצע `share_target` עם `method: GET` (ולא POST) — אין צורך ב-Service Worker לתפיסת הבקשה כי אין שיתוף קבצים, רק טקסט/קישור
- [x] זוהה שSupabase Edge Function **נדרש בהכרח** לחילוץ מטא-דאטה (og:title/og:image וכו') בגלל מגבלת CORS על fetch מהקליינט לאתרים חיצוניים
- [x] **הוחלט: מכשיר אנדרואיד יחיד, בלי ריבוי מכשירים בינתיים** → persistence ב-**localStorage בלבד** ל-v1, בלי Supabase Postgres
- [x] כתוצאה מכך: **אין צורך ב-Supabase Auth ואין צורך ב-DB בכלל ל-v1** — Supabase יידרש רק ל-Edge Function של חילוץ מטא-דאטה
- [x] **הוחלט: Project Page רגיל (`username.github.io/linkstop/`), בלי דומיין מותאם אישית** → `start_url`/`scope`/`action` ב-manifest יכללו פריפיקס `/linkstop/`

## Open Questions (ממתין לתשובת המשתמש)
1. יש לוגו/אייקונים קיימים ל-PWA, או צריך להכין (192/512px, maskable)?
2. נדרשת תמיכה offline לרשימת קישורים שכבר נשמרו (שכבר נטענו פעם אחת), או מספיק חיבור לאינטרנט תמיד?
3. יש לתכנן מראש מבנה שדות בקישור השמור (תיוג/קטגוריות, חיפוש, ארכוב), או שעדיף מינימלי ל-v1 (url, title, image, description, source, created_at) ולהרחיב בהמשך?

## Next Step
לקבל תשובות המשתמש ל-3 השאלות הפתוחות הנותרות, ואז לגבש Plan מפורט וסופי
(מבנה קבצים + manifest סופי עם `/linkstop/` כ-scope, ללא סכימת DB — הוחלט על
localStorage בלבד ל-v1) ולקבל אישור מפורש **לפני** תחילת כתיבת קוד האפליקציה
בפועל (לפי כלל ה-Plan ב-CLAUDE.md).

## Files Changed
- `PROJECT_STATE.md` — נוצר (קובץ זה)
- אין קבצי קוד נוספים שנוצרו/שונו בשלב זה
