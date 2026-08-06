# מסע 8 השבועות — מדריך למפתח (Claude)

אפליקציה טיפולית של **דוד אינגבר**: קורס דיגיטלי בן 8 שבועות "מהישרדות פנימית להנהגה עצמית"
(הורות עצמית מיטיבה להתמודדות עם חרדה). מדריך זה מתעד את כל המערכת כדי שכל שיחה עתידית של Claude
תוכל להמשיך מיד. **קרא אותו לפני שאתה נוגע בקוד.**

- **אתר חי:** https://davidingber.github.io/masa8/
- **מאגר:** github.com/davidingber/masa8 (ציבורי, GitHub Pages מ-`main` / root)
- **בעל המערכת:** David Ingber (davidingber)

---

## 1. ארכיטקטורה

- **אתר סטטי טהור** — HTML + CSS + **Vanilla JS (ES modules)**. אין build, אין framework, אין npm.
- **הכול צד-לקוח.** אין שרת ואין בסיס נתונים. המצב של כל משתמש נשמר ב-**localStorage** במכשיר שלו.
- **PWA** — ניתן להתקנה בנייד, עובד אופליין דרך Service Worker.
- **RTL עברית**, פלטת טורקיז/מרווה רגועה (משתני CSS ב-`:root`).

### שרשור השורש
> ה-`.git` יושב **בתוך תיקיית `app/`**, ותוכן `app/` נדחף כשורש המאגר.
> כלומר: `app/index.html` → `/index.html` באתר; `app/js/app.js` → `/js/app.js`.
> כל הנתיבים בקוד **יחסיים**, ולכן האתר עובד תחת תת-נתיב (`/masa8/`) בלי שינוי.

### מבנה קבצים (בתוך `app/`)
```
index.html            שלד + רישום ה-SW
styles.css            כל העיצוב (RTL, נגיש, רספונסיבי)
sw.js                 Service Worker — CACHE="masa8-vN" + רשימת ASSETS
manifest.webmanifest  מניפסט PWA
.nojekyll             מבטל עיבוד Jekyll ב-GitHub Pages
icons/                icon-192.png, icon-512.png
resources/            כל דפי העבודה וקבצי המדיטציה (PDF)
js/
  data.js       כל תוכן הקורס והקבועים (מקור האמת לתוכן)
  state.js      ניהול מצב ב-localStorage (KEY="masa8_state_v1")
  avatar.js     ציור האווטר (SVG) לפי טעינה 0–100
  ai.js         askAI() — Claude API אמיתי או מצב הדגמה
  calendar.js   בניית אירועי יומן (.ics) וקישורי Google Calendar
  reminders.js  תזכורות Notification API (לולאה יומית)
  app.js        הליבה: ניתוב, רינדור מסכים, כלי 8 השבועות + מאזינים
```

---

## 2. 8 השבועות והכלים

`COURSE.chapters` ב-`data.js` מגדיר כל שבוע; לכל שבוע `tool.type` שמנותב ב-`renderTool()` וב-`mountToolHandlers()` שב-`app.js`.

| שבוע | נושא | `tool.type` | פונקציה | תתי-כלים עיקריים |
|---|---|---|---|---|
| 1 | להבין את המערכת | `emotion-intention` | `toolWeek1` | רגש+דירוג+רגש חלופי · תרגיל דיקנס+זהות · יומן פעילות שבועי (יומן+PDF) |
| 2 | מעגל ההישרדות | `cycle-journal` | `toolWeek2` | יומן מיפוי טריגר→מחשבה→תחושה→פרשנות→תגובה · 3 מדיטציות (שבוע 2) |
| 3 | להפסיק להילחם במחשבות | `depth-process` | `toolWeek3` | הרחקת מחשבות (4 טכניקות+אנימציות) · מסגור מחדש NLP (6 שלבים) |
| 4 | להנהיג את הגוף | `interoceptive-timer` | `toolWeek4` | סריקה+מחוון נשימה · טיימרים מונחים (ליטוף היד/יד על הלב) · טבלת חשיפות פנימיות |
| 5 | להנהיג את המחשבות | `thought-replace` | `toolWeek5` | לימוד עיוותי חשיבה · טבלת החלפת מחשבות (7 עמ׳) · בודק מחשבה AI |
| 6 | הורות עצמית מיטיבה | `worry-date` | `toolWeek6` | כתיבה 5 דק׳+טיימר · תהליך מודרך (פוקוסינג) · מדיטציות (שבוע 6) · תזכורת יומית |
| 7 | פעולה למרות פחד | `fear-ladder` | `toolWeek7` | כללים+הכנה · חשיפה בדמיון · סולם פחדים (חישוב ירידת 50%) |
| 8 | זהות חדשה והמשכיות | `value-action` | `toolWeek8` | בחירת 10 ערכים+דירוג · הגשמה · לוח שבועי+יומן · תקשורת ואסרטיביות |

תבנית קבועה לכל שבוע עם תתי-טאבים: משתנה מודול `weekNTab`, כפתורים `data-wNtab`, ופונקציית
`stashWeekNDrafts()` ששומרת טיוטות במעבר בין טאבים (למניעת אובדן טקסט בעת רינדור מחדש).

---

## 3. מודל המצב (`state.js`, `localStorage["masa8_state_v1"]`)

```
name, goal
emotion: { name, target, ratings:[{date,value}] }
activities: [{type, date, note}]        // type ∈ exercise|thought|exposure|joy
chapters: { "<week>": { tasks:{i:bool}, tools:{key:[entries]}, data:{key:value} } }
aiPrompts:   { id:{name,icon,prompt} }  // מוזג מ-DEFAULT_AI_PROMPTS
meditations: [{id,week,name,icon,link,file,note}]
medLibrary:  [{topic, items:[{name,link,file}]}]   // ספרייה לפי נושאים
chapterVideos: { "<week>": url }
apiKey
reminders: { enabled, time, email, lastFired }
externalTools: { "<week>": [{name,url}] }
timeLog: { "YYYY-Www": seconds }        // זמן עבודה לפי שבוע ISO
```

- **טעינת האווטר** = `computeCharge()`: נקודות מ-`activities` + משימות×2 + מס׳ דירוגי רגש. תקרה 100.
  `avatarStage()` = `floor(charge/20)` (0–5). **האריחים בבית הם תצוגה בלבד — לא טוענים בלחיצה.**
  הטעינה מגיעה רק מפעולות אמיתיות בכלים (שמירת תרגיל וכו׳ קוראת `S.logActivity(...)`).
- **מיזוג ברירות מחדל בטעינה** (`state.js` load): כלי AI ומדיטציות חדשים שנוספים ל-`data.js` מתמזגים
  לפי `id`/מפתח בלי לדרוס עריכות קיימות. שמור על התבנית הזו כשמוסיפים ברירות מחדל.

---

## 4. תבניות מפתח

- **PDF להורדה** — `window.open()` + כתיבת HTML של דף הדפסה RTL + `window.print()`. תומך עברית מלא.
- **יומן (Calendar)** — `calendar.js`:
  `buildWeeklyICS`/`googleEventUrl` (שבועי, מוגבל לחודש `UNTIL`); `buildDailyICS`/`googleDailyUrl` (יומי).
  **פרטיות:** המייל נכנס רק לקובץ ה-`.ics` — **לעולם לא ל-URL של Google**.
- **AI** — `ai.js` `askAI(systemPrompt, messages)`. משתמש ב-`state.apiKey`; בלי מפתח → מצב הדגמה.
  `MODEL="claude-sonnet-5"`, קריאה ישירה מהדפדפן עם `anthropic-dangerous-direct-browser-access`.
  הוראות הכלים נשמרות ב-`aiPrompts` (ברירת מחדל ב-`DEFAULT_AI_PROMPTS`), ניתנות לעריכה בניהול.
- **אווטר** — `avatar.js` `renderAvatar(charge)`: יציבה/הבעה/זוהר/סוללה משתנים לפי הטעינה.
- **מעקב זמן** — `startTimeTracker()` ב-`app.js`: כל 15 שנ׳ כשהדף גלוי מוסיף זמן ל-`timeLog[weekKey]`;
  מוצג כ-`שעות:דקות` (`fmtHM`) בכרטיס האווטר.
- **ניווט** — `NAV` ב-`app.js`: בית / המסע / מדיטציות / מאמן AI / ניהול. ניתוב ב-`render()`.

---

## 5. מקור האמת לתוכן — ‏`data.js`

הקבועים ב-`data.js` הם התוכן שכל **לקוח** מקבל כברירת מחדל:
`COURSE` (8 השבועות), `DEFAULT_MEDITATIONS`, `DEFAULT_AI_PROMPTS`, `DISTORTIONS`, `NLP_REFRAME_STEPS`,
`INTEROCEPTIVE_EXPOSURES`, `THOUGHT_TABLE_COLS`, `EXPOSURE_*`, `IMAGINAL_STEPS`, `VALUES_SUGGESTIONS`,
`COMMUNICATION_PRINCIPLES`, `ASSERTIVENESS_STEPS`, `PLEASANT_ACTIVITIES`, `CYCLE_STAGES`, ועוד.

> ⚠️ **חשוב — הפצת תוכן ללקוחות:** מסך "ניהול" עורך את ה-**localStorage של המכשיר הנוכחי בלבד**;
> עריכות שם **אינן מגיעות ללקוחות**. כדי שתוכן (סרטוני פרקים, מדיטציות, הוראות AI, ספריית מדיטציות)
> יגיע לכל הלקוחות — יש להטמיע אותו ב-`data.js`/ברירות המחדל, לעשות commit ולפרסם.

---

## 6. הרצה מקומית ופרסום

**מקומית** (ES modules דורשים http, לא file://): מריצים שרת סטטי קטן —
`C:\Users\User\Downloads\000\serve.ps1` (PowerShell HttpListener על פורט 8123) → פותחים `http://localhost:8123`.

**פרסום (GitHub Pages):** דוחפים ל-`main`. האתר מתעדכן תוך ~דקה בכתובת החיה.
> **בכל שינוי בקבצים המוגשים — יש להעלות את מספר הגרסה `CACHE` ב-`sw.js`** (למשל `masa8-v14`→`v15`),
> אחרת ה-Service Worker יגיש ללקוחות גרסה ישנה מהמטמון. לאחר עדכון, רענון קשה בדפדפן מנקה מטמון.

זרימת עדכון טיפוסית: ערוך קבצים → העלה `CACHE` ב-`sw.js` → `git add/commit/push` → האתר החי מתעדכן.

---

## 7. משימות פתוחות / שיפורים מתוכננים

- **נעילת מסך "ניהול" למנחה בלבד** — כרגע גלוי לכולם. תוכנית: להסתיר מהתפריט ולאפשר גישה דרך
  קישור פרטי (`#admin`) + קוד PIN. (זכור: ממילא עריכות ניהול הן פר-מכשיר; ראה §5.)
- **הפצת תצורת המנחה ללקוחות** — כיום פר-מכשיר. אם רוצים שתצורה תגיע לכולם, מטמיעים ב-`data.js`.
- **חיבור מפתח Claude API אמיתי** — כרגע מצב הדגמה עד שמזינים מפתח בניהול.
- **כלים חיצוניים** (`externalTools`) — ווים מוכנים לחיבור כלים שהמנחה בנה (תנועות עיניים וכו׳) לכל פרק.

---

## 8. הנחיות עבודה ל-Claude

- שמור על **Vanilla JS, בלי תלויות/framework**. בלי צעד build.
- כל כלי חדש: הוסף `tool.type` → נתב ב-`renderTool` → כתוב `toolWeekN` + `mountWeekNHandlers` →
  אם יש תתי-טאבים, הוסף `weekNTab` + `stashWeekNDrafts`.
- שמור מצב עם ה-setters של `state.js` (הם קוראים `save()` שכותב ל-localStorage).
- **תמיד** העלה את `CACHE` ב-`sw.js` כשמשנים קבצים מוגשים.
- בדוק מקומית מול `http://localhost:8123` (הרץ את `serve.ps1`), נקה SW+cache בין בדיקות.
- דבר עם המשתמש במונחי מוצר, לא במונחי git/deploy.
