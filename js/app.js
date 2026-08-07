// ============================================================
//  מסע 8 השבועות — לוגיקת האפליקציה והמסכים
// ============================================================
import { COURSE, ACTIVITY_TYPES, EMOTION_ALTERNATIVES, ALT_EMOTION_POOL,
         PLEASANT_ACTIVITIES, WEEK_DAYS, CYCLE_STAGES, NLP_REFRAME_STEPS,
         WEEK4_SENSATIONS, INTEROCEPTIVE_EXPOSURES,
         DISTORTIONS, THOUGHT_TABLE_COLS,
         EXPOSURE_EMOTIONS, EXPOSURE_RULES, EXPOSURE_EXAMPLES, IMAGINAL_STEPS,
         VALUES_SUGGESTIONS, COMMUNICATION_PRINCIPLES, ASSERTIVENESS_STEPS } from "./data.js";
import * as S from "./state.js";
import { renderAvatar, avatarMessage } from "./avatar.js";
import { askAI } from "./ai.js";
import { requestPermission, startReminderLoop } from "./reminders.js";
import { downloadWeeklyICS, googleEventUrl, downloadDailyICS, googleDailyUrl } from "./calendar.js";

const app = document.getElementById("view");
const navEl = document.getElementById("nav");

let route = "home";
let routeParam = null;

function go(r, param = null) {
  route = r; routeParam = param;
  window.scrollTo(0, 0);
  render();
}
window.__go = go;

// ============================================================
//  ניווט תחתון
// ============================================================
const NAV = [
  { id: "home",     label: "בית",       icon: "🏠" },
  { id: "chapters", label: "המסע",       icon: "🗺️" },
  { id: "library",  label: "מדיטציות",  icon: "🎧" },
  { id: "coach",    label: "מאמן AI",    icon: "💬" },
  { id: "settings", label: "ניהול",      icon: "⚙️" },
];

function renderNav() {
  navEl.innerHTML = NAV.map(n => `
    <button class="nav-btn ${route === n.id ? "active" : ""}" data-route="${n.id}">
      <span class="nav-ico">${n.icon}</span><span>${n.label}</span>
    </button>`).join("");
  navEl.querySelectorAll(".nav-btn").forEach(b =>
    b.addEventListener("click", () => go(b.dataset.route)));
}

// ============================================================
//  ראוטר
// ============================================================
function render() {
  renderNav();
  if (route === "home") return renderHome();
  if (route === "chapters") return renderChapters();
  if (route === "chapter") return renderChapter(routeParam);
  if (route === "library") return renderLibrary();
  if (route === "coach") return renderCoach();
  if (route === "settings") return renderSettings();
}

// ============================================================
//  מסך בית — האווטר + פעולות מהירות + מטרה + רגש
// ============================================================
function renderHome() {
  const st = S.getState();
  const charge = S.computeCharge();
  const stage = S.avatarStage(charge);
  const stt = S.stats();
  const hello = st.name ? `שלום ${st.name} 👋` : "ברוך הבא למסע 👋";

  const ratings = st.emotion.ratings;
  const first = ratings[0]?.value;
  const lastR = ratings[ratings.length - 1]?.value;

  app.innerHTML = `
    <header class="topbar">
      <div>
        <div class="greeting">${hello}</div>
        <div class="subtle">${COURSE.subtitle}</div>
      </div>
    </header>

    <section class="card avatar-card">
      <div class="avatar-wrap">${renderAvatar(charge)}</div>
      <div class="charge-row">
        <div class="charge-bar"><div class="charge-fill" style="width:${charge}%"></div></div>
        <div class="charge-num">${charge}%</div>
      </div>
      <p class="avatar-msg">${avatarMessage(stage)}</p>
      <div class="work-clock" title="זמן העבודה שלך השבוע">⏱️ זמן עבודה השבוע: <b id="workClock">${fmtHM(S.getWeekWorkTime())}</b></div>
    </section>

    <section class="quick-actions">
      <h3>הפעולות שביצעת במסע</h3>
      <div class="qa-grid">
        ${Object.entries(ACTIVITY_TYPES).map(([k, v]) => `
          <div class="qa-btn static" style="--c:${v.color}">
            <span class="qa-ico">${v.icon}</span>
            <span class="qa-label">${v.label}</span>
            <span class="qa-count">${stt.counts[k] || 0}</span>
          </div>`).join("")}
      </div>
      <p class="qa-note">האווטר נטען מפעולות אמיתיות שאתה מבצע בכלים של כל שבוע.</p>
    </section>

    <section class="card">
      <div class="card-head"><h3>🎯 המטרה שלי למסע</h3>
        <button class="link-btn" id="editGoal">${st.goal ? "עריכה" : "הוספה"}</button></div>
      <p class="goal-text">${st.goal ? esc(st.goal) : "עוד לא הגדרת מטרה. לחץ להוספה — או בקש עזרה מהמאמן."}</p>
    </section>

    <section class="card">
      <div class="card-head"><h3>💗 הרגש שאני עובד עליו</h3></div>
      ${st.emotion.name ? `
        <div class="emotion-row">
          <span class="emotion-name">${esc(st.emotion.name)}</span>
          ${first != null ? `<span class="emotion-trend">${first} → ${lastR} ${lastR < first ? "📉" : ""}</span>` : ""}
        </div>
        ${renderSparkline(ratings)}
      ` : `<p class="subtle">בשבוע 1 תבחר רגש ותדרג אותו. כאן נראה אותו יורד לאורך הזמן.</p>`}
    </section>

    <section class="card summary-card">
      <div class="sum-item"><b>${stt.tasksDone}</b><span>משימות הושלמו</span></div>
      <div class="sum-item"><b>${stt.total}</b><span>פעולות שטענו</span></div>
      <div class="sum-item"><b>${stage}/5</b><span>שלב האווטר</span></div>
    </section>
  `;

  // מאזינים
  app.querySelector("#editGoal").addEventListener("click", editGoal);
}

function editGoal() {
  const cur = S.getState().goal;
  const v = prompt("מהי המטרה שלך למסע?", cur || "");
  if (v !== null) { S.setGoal(v.trim()); renderHome(); }
}

// ============================================================
//  רשימת הפרקים (המסע)
// ============================================================
function renderChapters() {
  app.innerHTML = `
    <header class="topbar"><div><div class="greeting">🗺️ מפת המסע</div>
      <div class="subtle">שמונה שבועות, שמונה זהויות</div></div></header>
    <div class="chapters-list">
      ${COURSE.chapters.map(c => {
        const done = tasksDoneCount(c);
        const total = c.tasks.length;
        const pct = Math.round(done / total * 100);
        const live = c.week === 1;
        return `
        <button class="chapter-item" data-week="${c.week}">
          <div class="ch-icon">${c.icon}</div>
          <div class="ch-body">
            <div class="ch-top">
              <span class="ch-week">שבוע ${c.week}</span>
              ${live ? '<span class="badge-live">כלי פעיל</span>' : ''}
            </div>
            <div class="ch-title">${c.title}</div>
            <div class="ch-shift">${c.shift.from} ← ${c.shift.to}</div>
            <div class="ch-progress"><div style="width:${pct}%"></div></div>
          </div>
          <div class="ch-arrow">‹</div>
        </button>`;
      }).join("")}
      <div class="private-card">
        <div class="ch-icon">${COURSE.privateModule.icon}</div>
        <div class="ch-body">
          <div class="ch-title">${COURSE.privateModule.title}</div>
          <div class="ch-shift">${COURSE.privateModule.subtitle}</div>
        </div>
      </div>
    </div>
  `;
  app.querySelectorAll(".chapter-item").forEach(b =>
    b.addEventListener("click", () => go("chapter", Number(b.dataset.week))));
}

function tasksDoneCount(c) {
  return c.tasks.reduce((n, _, i) => n + (S.isTaskDone(c.week, i) ? 1 : 0), 0);
}

// ============================================================
//  מסך פרק בודד
// ============================================================
function renderChapter(week) {
  const c = COURSE.chapters.find(x => x.week === week);
  const ext = S.getState().externalTools[String(week)] || [];
  const video = S.getChapterVideo(week);

  app.innerHTML = `
    <header class="topbar chapter-head">
      <button class="back-btn" id="back">›</button>
      <div><div class="greeting">${c.icon} שבוע ${c.week}</div>
        <div class="subtle">${c.title}</div></div>
    </header>

    ${video ? `<section class="card video-card"><h3>🎥 הקלטת השבוע</h3>${videoEmbed(video)}</section>` : ""}

    <section class="card shift-card">
      <div class="shift-from">${c.shift.from}</div>
      <div class="shift-arrow">↓</div>
      <div class="shift-to">${c.shift.to}</div>
    </section>

    <section class="card">
      <h3>📚 מה לומדים</h3>
      <ul class="learn-list">${c.learn.map(l => `<li>${l}</li>`).join("")}</ul>
    </section>

    <section class="card">
      <h3>✅ המשימות שלי</h3>
      <div class="tasks">
        ${c.tasks.map((t, i) => `
          <label class="task ${S.isTaskDone(week, i) ? "done" : ""}">
            <input type="checkbox" data-i="${i}" ${S.isTaskDone(week, i) ? "checked" : ""}>
            <span>${t}</span>
          </label>`).join("")}
      </div>
    </section>

    <section class="card tool-card">
      <h3>🛠️ הכלי של השבוע</h3>
      <div id="toolMount">${renderTool(c)}</div>
    </section>

    <section class="card">
      <div class="card-head"><h3>🔗 כלים דיגיטליים נוספים</h3></div>
      ${ext.length ? ext.map(t => `<a class="ext-tool" href="${esc(t.url)}" target="_blank">↗ ${esc(t.name)}</a>`).join("")
        : `<p class="subtle">כאן יתחברו הכלים שכבר בנית (תנועות עיניים ועוד) — לפי הפרק הרלוונטי. אפשר להוסיף במסך הניהול.</p>`}
    </section>

    <p class="tools-note">כלים בגישה זו: ${c.tools}</p>
  `;

  app.querySelector("#back").addEventListener("click", () => go("chapters"));
  app.querySelectorAll(".task input").forEach(cb =>
    cb.addEventListener("change", () => {
      S.toggleTask(week, Number(cb.dataset.i));
      renderChapter(week);
    }));
  mountToolHandlers(c);
}

// ============================================================
//  כלים אינטראקטיביים
// ============================================================
function renderTool(c) {
  const t = c.tool.type;
  if (t === "emotion-intention") return toolWeek1(c);
  if (t === "cycle-journal") return toolWeek2(c);
  if (t === "depth-process") return toolWeek3(c);
  if (t === "interoceptive-timer") return toolWeek4(c);
  if (t === "thought-replace") return toolWeek5(c);
  if (t === "worry-date") return toolWeek6(c);
  if (t === "fear-ladder") return toolWeek7(c);
  if (t === "value-action") return toolWeek8(c);
  // שאר הכלים — מבנה מוכן, ייבנו בגרסה המלאה
  return `
    <div class="tool-placeholder">
      <p>הכלי האינטראקטיבי של שבוע ${c.week} ייבנה בגרסה המלאה.</p>
      <p class="subtle">בינתיים אפשר לתעד באופן חופשי:</p>
      <textarea id="freeNote" class="ta" placeholder="רשום כאן את מה שעלה בתרגיל..."></textarea>
      <button class="btn" id="saveFree">שמירה + טעינת האווטר</button>
      <div id="freeLog" class="mini-log">${miniLog(c.week, "free")}</div>
    </div>`;
}

// --- שבוע 1: כלי מורחב עם 3 חלקים ---
let week1Tab = "emotion";
const W1_TABS = [
  { id: "emotion",    label: "רגש ודירוג" },
  { id: "dickens",    label: "תרגיל דיקנס" },
  { id: "activation", label: "יומן פעילות" },
];

function toolWeek1(c) {
  const tabs = `<div class="subtool-tabs">${W1_TABS.map(t =>
    `<button class="subtool-tab ${week1Tab === t.id ? "on" : ""}" data-w1tab="${t.id}">${t.label}</button>`).join("")}</div>`;
  let body = "";
  if (week1Tab === "emotion") body = w1Emotion();
  if (week1Tab === "dickens") body = w1Dickens();
  if (week1Tab === "activation") body = w1Activation();
  return tabs + `<div id="w1body">${body}</div>`;
}

// חלק 1 — רגש מרכזי + דירוג + רגש חלופי
function w1Emotion() {
  const st = S.getState();
  const emotions = ["חרדה", "פחד", "בושה", "כעס", "עצב", "אשמה", "בדידות"];
  const suggested = EMOTION_ALTERNATIVES[st.emotion.name];
  const altPool = [...new Set([suggested, ...ALT_EMOTION_POOL].filter(Boolean))];
  return `
    <div class="tool-block">
      <h4>1. בחר רגש מרכזי שמלווה אותך</h4>
      <div class="chip-row">
        ${emotions.map(e => `<button class="chip ${st.emotion.name === e ? "on" : ""}" data-emotion="${e}">${e}</button>`).join("")}
      </div>

      <h4>2. דרג את עוצמתו עכשיו (0–10) — נקודת מוצא למדידה</h4>
      <div class="rating-row">
        <input type="range" id="rate" min="0" max="10" value="${lastRating(st) ?? 5}" ${st.emotion.name ? "" : "disabled"}>
        <span class="rate-val" id="rateVal">${lastRating(st) ?? 5}</span>
      </div>
      <button class="btn" id="logRate" ${st.emotion.name ? "" : "disabled"}>שמור דירוג</button>
      ${st.emotion.ratings.length ? renderSparkline(st.emotion.ratings) : ""}

      <h4 style="margin-top:18px">3. הרגש החלופי — לאן אני רוצה להגיע?</h4>
      ${st.emotion.name ? `
        <p class="hint">${suggested
          ? `במקום <b>${esc(st.emotion.name)}</b>, אפשר לכוון אל <b>${esc(suggested)}</b>. בחר את היעד שלך:`
          : "בחר את הרגש שאליו תרצה להגיע במסע:"}</p>
        <div class="chip-row">
          ${altPool.map(a => `<button class="chip alt ${st.emotion.target === a ? "on" : ""}" data-alt="${esc(a)}">${esc(a)}</button>`).join("")}
        </div>
        ${st.emotion.target ? `<p class="target-line">🎯 היעד הרגשי שלי: <b>${esc(st.emotion.target)}</b></p>` : ""}
      ` : `<p class="subtle">בחר קודם רגש מרכזי למעלה.</p>`}
    </div>`;
}

// חלק 2 — תרגיל דיקנס + כיוון זהותי
function w1Dickens() {
  const d = S.getToolData(1, "dickens") || {};
  return `
    <div class="tool-block">
      <p class="hint">תרגיל דיקנס בוחן את <b>מחיר ההישארות</b> מול <b>מחיר השינוי</b>. קח רגע, עצום עיניים, ותכתוב בכנות.</p>

      <div class="dickens-section stay">
        <h4>💭 אם לא אעשה את השינוי — בעוד 5 שנים</h4>
        <label class="mini-label">איך אני נראה?</label>
        <textarea class="ta d-field" data-d="stay5look" placeholder="תאר את עצמך בעוד 5 שנים ללא השינוי...">${esc(d.stay5look || "")}</textarea>
        <label class="mini-label">מה אני מרגיש?</label>
        <textarea class="ta d-field" data-d="stay5feel" placeholder="הרגשות שיתלוו לכך...">${esc(d.stay5feel || "")}</textarea>
      </div>

      <div class="dickens-section stay">
        <h4>💭 אם לא אעשה את השינוי — בעוד עשור</h4>
        <label class="mini-label">איך אני נראה?</label>
        <textarea class="ta d-field" data-d="stay10look" placeholder="תאר את עצמך בעוד עשור ללא השינוי...">${esc(d.stay10look || "")}</textarea>
        <label class="mini-label">מה אני מרגיש?</label>
        <textarea class="ta d-field" data-d="stay10feel" placeholder="הרגשות שיתלוו לכך...">${esc(d.stay10feel || "")}</textarea>
      </div>

      <div class="dickens-section change">
        <h4>🌱 אבל אם כן אעשה את השינוי — מי אני רוצה להיות</h4>
        <p class="hint">כתוב <b>בלשון הווה</b>, כאילו זה קורה עכשיו: איך אתה מרגיש, איך היציבה שלך, מה זה מאפשר לך לעשות, איזה אדם אתה.</p>
        <textarea class="ta d-field big" data-d="identity" placeholder="אני אדם ש... אני מרגיש... היציבה שלי... זה מאפשר לי...">${esc(d.identity || "")}</textarea>
        <p class="tiny-note">✨ הכיוון הזה יחזור ויועמק בשבוע 8.</p>
      </div>

      <button class="btn" id="saveDickens">שמירה + טעינת האווטר</button>
    </div>`;
}

// חלק 3 — אקטיבציה מבוססת ערכים ועונג: יומן פעילות שבועי
function w1Activation() {
  const st = S.getState();
  const plan = S.getToolData(1, "activityPlan") || {};
  const palette = PLEASANT_ACTIVITIES.map(g => `
    <div class="pal-group">
      <div class="pal-cat">${g.cat}</div>
      <div class="chip-row">
        ${g.items.map(it => `<button class="chip mini" data-activity="${esc(it)}">${esc(it)}</button>`).join("")}
      </div>
    </div>`).join("");

  const table = WEEK_DAYS.map(day => {
    const cell = plan[day];
    const activity = cell ? (typeof cell === "string" ? cell : (cell.activity || "")) : "";
    const time = cell && typeof cell === "object" ? (cell.time || "") : "";
    return `
    <div class="day-row" data-day="${day}">
      <div class="day-name">${day}</div>
      <input class="inp day-time" type="time" value="${esc(time)}" aria-label="שעה ל${day}">
      <input class="inp day-input" value="${esc(activity)}" placeholder="פעילות מהנה...">
    </div>`;
  }).join("");

  return `
    <div class="tool-block">
      <p class="hint">בחר פעילויות מהנות (או שהיו מהנות) ושבץ אותן בימות השבוע. לחיצה על פעילות משבצת אותה ביום הפנוי הבא.</p>

      <h4>מאגר פעילויות מהנות</h4>
      <div class="palette">${palette}</div>

      <h4 style="margin-top:14px">יומן הפעילות השבועי שלי</h4>
      <div class="week-table">${table}</div>

      <div class="activation-actions">
        <button class="btn" id="savePlan">שמירה + טעינת האווטר</button>
        <button class="btn ghost2" id="pdfPlan">⬇ הורדה כ-PDF</button>
      </div>

      <div class="cal-connect">
        <h4>🔔 הוספת הפעילויות ליומן — לחודש</h4>
        <p class="hint">כל פעילות תתווסף כאירוע חוזר שבועי <b>למשך חודש</b>, עם היום, השעה והפעילות.
          שום דבר לא נשלח; אתה מאשר בעצמך את השמירה ביומן.</p>

        <div class="gcal-block">
          <div class="mini-label">📅 הוספה ישירה ליומן Google — לחיצה לכל יום:</div>
          ${gcalLinks(plan)}
        </div>

        <div class="ics-block">
          <div class="mini-label">📥 או קובץ ליומן (Outlook / Apple / iPhone):</div>
          <input class="inp" id="calEmail" type="email" dir="ltr"
            placeholder="המייל שלך (לקובץ) — you@example.com" value="${esc(st.reminders.email || "")}">
          <button class="btn ghost2" id="calWeek">⬇ הורדת קובץ יומן (.ics)</button>
        </div>

        <p class="tiny-note">ימים ללא שעה יתווספו ל-09:00 כברירת מחדל.</p>
      </div>
    </div>`;
}

// קישורי Google לכל יום עם פעילות
function gcalLinks(plan) {
  const items = WEEK_DAYS.filter(day => {
    const c = plan[day];
    return c && (typeof c === "string" ? c : c.activity);
  });
  if (!items.length) return `<p class="subtle">מלא ושמור פעילויות בטבלה כדי לקבל קישורים ליומן Google.</p>`;
  return `<div class="chip-row">` + items.map(day => {
    const c = plan[day];
    const activity = typeof c === "string" ? c : c.activity;
    const time = typeof c === "object" ? (c.time || "") : "";
    return `<button class="chip gcal-link" data-gday="${day}">➕ ${day}${time ? " " + esc(time) : ""} · ${esc(activity)}</button>`;
  }).join("") + `</div>`;
}

// ============================================================
//  שבוע 2 — יומן מיפוי מעגל ההישרדות + מדיטציות
// ============================================================
function emptyCycleRow() {
  const r = {}; CYCLE_STAGES.forEach(s => r[s.key] = ""); return r;
}

function toolWeek2(c) {
  const rows = S.getToolData(2, "cycleJournal") || [emptyCycleRow()];
  const meds = S.getMeditationsByWeek(2);
  return `
    <div class="tool-block">
      <h4>יומן מיפוי המעגל</h4>
      <p class="hint">מלא מקרה אחר מקרה. כל מקרה עוקב אחרי הרצף:
        <b>טריגר → מחשבה → תחושה → פרשנות → תגובה</b>. אפשר להוסיף כמה מקרים שרוצים.</p>
      <div id="cycleCases">${rows.map((r, i) => cycleCase(r, i)).join("")}</div>
      <button class="btn ghost2 add-case" id="addCase">＋ הוספת מקרה</button>
      <div class="activation-actions">
        <button class="btn" id="saveCycle">שמירה + טעינת האווטר</button>
        <button class="btn ghost2" id="pdfCycleFull">⬇ הורדת היומן המלא</button>
        <button class="btn ghost2" id="pdfCycleEmpty">⬇ יומן ריק להדפסה</button>
      </div>
    </div>

    <div class="tool-block med-block">
      <h4>🎧 מדיטציות מלוות</h4>
      <p class="hint">תרגול יומי מרגיע את מערכת העצבים. האזן/צפה בקישור, או הורד את הקובץ.</p>
      ${meds.map(medCard).join("")}
    </div>`;
}

function cycleCase(r, i) {
  return `
    <div class="cycle-case" data-i="${i}">
      <div class="case-head">
        <span class="case-title">מקרה ${i + 1}</span>
        <button class="case-del" data-del="${i}">מחיקה ✕</button>
      </div>
      <div class="cycle-flow">
        ${CYCLE_STAGES.map(s => `
          <div class="cyc-field">
            <label>${s.label}</label>
            <textarea class="cyc-input" data-f="${s.key}" rows="2" placeholder="${s.hint}">${esc(r[s.key] || "")}</textarea>
          </div>`).join("")}
      </div>
    </div>`;
}

function medCard(m) {
  return `
    <div class="med-item">
      <div class="med-name">${m.icon || "🎧"} ${esc(m.name)}</div>
      ${m.note ? `<div class="tiny-note">${esc(m.note)}</div>` : ""}
      <div class="med-actions">
        ${m.link ? `<a class="btn ghost2" href="${esc(m.link)}" target="_blank" rel="noopener">▶ צפייה / האזנה</a>` : ""}
        ${m.file ? `<a class="btn ghost2" href="${esc(m.file)}" target="_blank" rel="noopener">⬇ קובץ</a>` : ""}
      </div>
    </div>`;
}

function collectCycleRows() {
  const rows = [];
  app.querySelectorAll(".cycle-case").forEach(caseEl => {
    const r = {};
    caseEl.querySelectorAll(".cyc-input").forEach(inp => r[inp.dataset.f] = inp.value.trim());
    rows.push(r);
  });
  return rows;
}

function mountWeek2Handlers() {
  // שמירה אוטומטית ב-blur כדי לא לאבד טקסט בעת ריענון
  app.querySelectorAll(".cyc-input").forEach(inp =>
    inp.addEventListener("change", () => S.setToolData(2, "cycleJournal", collectCycleRows())));

  const add = app.querySelector("#addCase");
  if (add) add.addEventListener("click", () => {
    const rows = collectCycleRows(); rows.push(emptyCycleRow());
    S.setToolData(2, "cycleJournal", rows); renderChapter(2);
  });

  app.querySelectorAll(".case-del").forEach(b =>
    b.addEventListener("click", () => {
      const rows = collectCycleRows();
      rows.splice(Number(b.dataset.del), 1);
      S.setToolData(2, "cycleJournal", rows.length ? rows : [emptyCycleRow()]);
      renderChapter(2);
    }));

  const sc = app.querySelector("#saveCycle");
  if (sc) sc.addEventListener("click", () => {
    const rows = collectCycleRows();
    S.setToolData(2, "cycleJournal", rows);
    if (rows.some(r => Object.values(r).some(Boolean))) S.logActivity("exercise", "יומן מעגל");
    toast("היומן נשמר ✓"); renderChapter(2);
  });

  const pf = app.querySelector("#pdfCycleFull");
  if (pf) pf.addEventListener("click", () => {
    S.setToolData(2, "cycleJournal", collectCycleRows());
    openCyclePrint(collectCycleRows(), false);
  });
  const pe = app.querySelector("#pdfCycleEmpty");
  if (pe) pe.addEventListener("click", () => openCyclePrint(Array.from({ length: 6 }, emptyCycleRow), true));
}

function openCyclePrint(rows, empty) {
  const st = S.getState();
  const today = new Date().toLocaleDateString("he-IL");
  const head = CYCLE_STAGES.map(s => `<th>${s.label}</th>`).join("");
  const body = rows.map((r, i) =>
    `<tr><td class="n">${i + 1}</td>${CYCLE_STAGES.map(s => `<td>${esc(r[s.key] || "")}</td>`).join("")}</tr>`).join("");

  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
    <title>יומן מיפוי המעגל — שבוע 2</title>
    <style>
      body{font-family:"Segoe UI",Arial,sans-serif;color:#20353a;padding:28px}
      h1{color:#0f766e;margin:0 0 4px} .sub{color:#6a8189;margin:0 0 8px}
      .meta{display:flex;gap:24px;color:#6a8189;font-size:13px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;table-layout:fixed}
      th,td{border:1px solid #cfe0dc;padding:9px;text-align:right;font-size:13px;vertical-align:top;word-wrap:break-word}
      th{background:#eefaf6;color:#0f766e} td.n{width:34px;text-align:center;font-weight:700;background:#f6fbfa}
      td{height:${empty ? "54px" : "auto"}}
      .btn{background:#0f766e;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:15px;cursor:pointer;margin-top:16px}
      @media print{.noprint{display:none}}
    </style></head><body>
    <h1>יומן מיפוי מעגל ההישרדות</h1>
    <p class="sub">מסע 8 השבועות · שבוע 2 — טריגר → מחשבה → תחושה → פרשנות → תגובה</p>
    <div class="meta"><span>שם: ${esc(st.name) || "________"}</span><span>תאריך: ${today}</span></div>
    <table><thead><tr><th class="n">#</th>${head}</tr></thead><tbody>${body}</tbody></table>
    <button class="btn noprint" onclick="window.print()">הדפסה / שמירה כ-PDF</button>
    <script>setTimeout(()=>window.print(),400)<\/script>
    </body></html>`;
  const w = window.open("", "_blank");
  if (!w) { toast("אפשר חלונות קופצים כדי להוריד"); return; }
  w.document.write(html); w.document.close();
}

// ============================================================
//  שבוע 3 — הרחקת מחשבות (דיפיוז'ן) + מסגור מחדש NLP
// ============================================================
let week3Tab = "defusion";
const W3_TABS = [
  { id: "defusion", label: "הרחקת מחשבות" },
  { id: "reframe",  label: "מסגור מחדש (NLP)" },
];

function toolWeek3(c) {
  const tabs = `<div class="subtool-tabs">${W3_TABS.map(t =>
    `<button class="subtool-tab ${week3Tab === t.id ? "on" : ""}" data-w3tab="${t.id}">${t.label}</button>`).join("")}</div>`;
  const body = week3Tab === "defusion" ? w3Defusion() : w3Reframe();
  return tabs + `<div id="w3body">${body}</div>`;
}

function w3Defusion() {
  const third = S.getToolData(3, "thirdPerson") || "";
  return `
    <div class="tool-block">
      <p class="hint">מחשבה היא אירוע פנימי, לא אמת. הנה ארבע דרכים <b>להרחיק</b> את המחשבה
        ולצפות בה מבחוץ, במקום להיות בתוכה.</p>

      <div class="def-tech">
        <h5>1️⃣ גוף שלישי</h5>
        <p class="hint">נסח את המחשבה בגוף שלישי — זה יוצר מרחק. למשל: "המוח שלי העלה מחשבה שאומרת ש…"</p>
        <textarea class="ta" id="thirdPerson" placeholder="המוח שלי העלה מחשבה שאומרת ש...">${esc(third)}</textarea>
        <button class="btn" id="saveThird">שמירה + טעינת האווטר</button>
      </div>

      <div class="def-tech">
        <h5>2️⃣ לשיר את המחשבה</h5>
        <p class="hint">קח את המחשבה ושיר אותה בלחן מוכר (יום הולדת שמח, מנגינת ילדים).
          כששרים אותה — היא מאבדת מהעוצמה והרצינות.</p>
        <button class="btn ghost2" id="sangIt">שרתי אותה 🎵</button>
      </div>

      <div class="def-tech">
        <h5>3️⃣ המחשבה על הלוח</h5>
        <p class="hint">דמיין את המחשבה כתובה על לוח רחוק. שחרר אותה — היא נופלת מטה בכוח הכבידה,
          מתרחקת ונעשית קטנה יותר ויותר, עד שנעלמת.</p>
        <input class="inp" id="boardThought" placeholder="כתוב את המחשבה...">
        <button class="btn ghost2" id="boardRelease">שחרר את המחשבה ⬇</button>
        <div class="anim-stage" id="boardStage"></div>
      </div>

      <div class="def-tech">
        <h5>4️⃣ עלים על נחל (מיינדפולנס)</h5>
        <p class="hint">צפה במחשבה כמו עלה שט על נחל — הוא מרחף על המים והולך ומתרחק.
          אל תילחם בו, רק צפה בו נעלם.</p>
        <input class="inp" id="streamThought" placeholder="כתוב את המחשבה...">
        <button class="btn ghost2" id="streamRelease">שלח לנחל 🍃</button>
        <div class="anim-stage stream" id="streamStage"></div>
      </div>
    </div>`;
}

function w3Reframe() {
  const saved = S.getToolData(3, "reframe") || [];
  return `
    <div class="tool-block">
      <p class="hint">מסגור מחדש בשישה שלבים מגישת NLP — עבודה עם החלק שאחראי על ההתנהגות הלא רצויה.
        השאלות מימין, מקום לתשובות משמאל.</p>
      <div class="reframe-list">
        ${NLP_REFRAME_STEPS.map((s, i) => `
          <div class="reframe-row">
            <div class="reframe-q">
              <span class="step-num">${i + 1}</span>
              <div><div class="q-text">${s.q}</div>${s.hint ? `<div class="q-hint">${s.hint}</div>` : ""}</div>
            </div>
            <div class="reframe-a">
              <textarea class="ta rf-input" data-i="${i}" placeholder="התשובה שלי...">${esc(saved[i] || "")}</textarea>
            </div>
          </div>`).join("")}
      </div>
      <div class="activation-actions">
        <button class="btn" id="saveReframe">שמירה + טעינת האווטר</button>
        <button class="btn ghost2" id="pdfReframe">⬇ הורדת התרגיל כ-PDF</button>
      </div>
    </div>`;
}

function collectReframe() {
  const arr = [];
  app.querySelectorAll(".rf-input").forEach(inp => arr[Number(inp.dataset.i)] = inp.value.trim());
  return arr;
}

// אנימציה: הצגת טקסט על "במה" והפעלת מחלקת אנימציה
function playThoughtAnim(stageId, inputId, animClass, emptyMsg) {
  const input = app.querySelector("#" + inputId);
  const stage = app.querySelector("#" + stageId);
  const text = (input?.value || "").trim();
  if (!text) return toast(emptyMsg);
  stage.innerHTML = `<span class="thought-note">${esc(text)}</span>`;
  const note = stage.firstChild;
  void note.offsetWidth;          // reflow כדי שהאנימציה תרוץ מחדש
  note.classList.add(animClass);
  S.logActivity("thought", "הרחקת מחשבה");
}

function mountWeek3Handlers() {
  app.querySelectorAll("[data-w3tab]").forEach(b =>
    b.addEventListener("click", () => { stashWeek3Drafts(); week3Tab = b.dataset.w3tab; renderChapter(3); }));

  // דיפיוז'ן
  const stv = app.querySelector("#saveThird");
  if (stv) stv.addEventListener("click", () => {
    const v = app.querySelector("#thirdPerson").value.trim();
    S.setToolData(3, "thirdPerson", v);
    if (v) S.logActivity("thought", "גוף שלישי");
    toast("נשמר ✓"); renderChapter(3);
  });
  const sang = app.querySelector("#sangIt");
  if (sang) sang.addEventListener("click", () => { S.logActivity("thought", "לשיר את המחשבה"); toast("יפה! 🎵 טענת את האווטר"); });
  const br = app.querySelector("#boardRelease");
  if (br) br.addEventListener("click", () => playThoughtAnim("boardStage", "boardThought", "fall", "כתוב קודם את המחשבה"));
  const sr = app.querySelector("#streamRelease");
  if (sr) sr.addEventListener("click", () => playThoughtAnim("streamStage", "streamThought", "drift", "כתוב קודם את המחשבה"));

  // מסגור מחדש
  app.querySelectorAll(".rf-input").forEach(inp =>
    inp.addEventListener("change", () => S.setToolData(3, "reframe", collectReframe())));
  const sref = app.querySelector("#saveReframe");
  if (sref) sref.addEventListener("click", () => {
    const arr = collectReframe();
    S.setToolData(3, "reframe", arr);
    if (arr.some(Boolean)) S.logActivity("exercise", "מסגור מחדש NLP");
    toast("התרגיל נשמר ✓"); renderChapter(3);
  });
  const pref = app.querySelector("#pdfReframe");
  if (pref) pref.addEventListener("click", () => { S.setToolData(3, "reframe", collectReframe()); openReframePrint(collectReframe()); });
}

function stashWeek3Drafts() {
  const tp = app.querySelector("#thirdPerson");
  if (tp) S.setToolData(3, "thirdPerson", tp.value.trim());
  if (app.querySelectorAll(".rf-input").length) S.setToolData(3, "reframe", collectReframe());
}

function openReframePrint(answers) {
  const st = S.getState();
  const today = new Date().toLocaleDateString("he-IL");
  const rows = NLP_REFRAME_STEPS.map((s, i) => `
    <tr>
      <td class="n">${i + 1}</td>
      <td class="q">${esc(s.q)}${s.hint ? `<div class="h">${esc(s.hint)}</div>` : ""}</td>
      <td class="a">${esc(answers[i] || "")}</td>
    </tr>`).join("");
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
    <title>מסגור מחדש NLP — שבוע 3</title>
    <style>
      body{font-family:"Segoe UI",Arial,sans-serif;color:#20353a;padding:28px}
      h1{color:#0f766e;margin:0 0 4px}.sub{color:#6a8189;margin:0 0 8px}
      .meta{display:flex;gap:24px;color:#6a8189;font-size:13px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse}
      td{border:1px solid #cfe0dc;padding:10px;text-align:right;font-size:13px;vertical-align:top}
      td.n{width:30px;text-align:center;font-weight:700;background:#f6fbfa}
      td.q{width:46%;background:#eefaf6} td.q .h{color:#6a8189;font-size:12px;margin-top:4px}
      td.a{height:56px}
      .btn{background:#0f766e;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:15px;cursor:pointer;margin-top:16px}
      @media print{.noprint{display:none}}
    </style></head><body>
    <h1>מסגור מחדש בשישה שלבים (NLP)</h1>
    <p class="sub">מסע 8 השבועות · שבוע 3 — עבודה עם החלקים הפנימיים</p>
    <div class="meta"><span>שם: ${esc(st.name) || "________"}</span><span>תאריך: ${today}</span></div>
    <table><tbody>${rows}</tbody></table>
    <button class="btn noprint" onclick="window.print()">הדפסה / שמירה כ-PDF</button>
    <script>setTimeout(()=>window.print(),400)<\/script>
    </body></html>`;
  const w = window.open("", "_blank");
  if (!w) { toast("אפשר חלונות קופצים כדי להוריד"); return; }
  w.document.write(html); w.document.close();
}

// ============================================================
//  שבוע 4 — הנהגת הגוף: סריקה ונשימה, חשיפה תוך-גופנית, טבלת חשיפות
// ============================================================
let week4Tab = "scan";
let activeTimer = null;
const W4_TABS = [
  { id: "scan",     label: "סריקה ונשימה" },
  { id: "exposure", label: "חשיפה תוך-גופנית" },
  { id: "table",    label: "טבלת חשיפות" },
];

function stopActiveTimer() { if (activeTimer) { clearInterval(activeTimer); activeTimer = null; } }

function toolWeek4(c) {
  const tabs = `<div class="subtool-tabs">${W4_TABS.map(t =>
    `<button class="subtool-tab ${week4Tab === t.id ? "on" : ""}" data-w4tab="${t.id}">${t.label}</button>`).join("")}</div>`;
  let body = "";
  if (week4Tab === "scan") body = w4Scan();
  if (week4Tab === "exposure") body = w4Exposure();
  if (week4Tab === "table") body = w4Table();
  return tabs + `<div id="w4body">${body}</div>`;
}

// --- תת-כלי 1: סריקת גוף + נשימת בטן + מחוון נשימה ---
function w4Scan() {
  const breathing = S.getMeditations().find(m => m.id === "autogenic") || {};
  return `
    <div class="tool-block">
      <p class="hint">סרוק את הגוף מהראש עד קצות האצבעות. קח כמה נשימות אל <b>הבטן התחתונה</b>,
        עם נשיפות ארוכות ועדינות — <b>כפולות באורכן מהשאיפה</b>.</p>

      <div class="breath-pacer">
        <div class="breath-circle" id="breathCircle"><span id="breathLabel">התחל</span></div>
        <button class="btn ghost2" id="breathToggle">התחל נשימה מונחית</button>
        <p class="tiny-note">שאיפה 4 שניות · נשיפה 8 שניות</p>
      </div>

      <div class="def-tech">
        <h5>🌬️ קובץ הנשימה (מהפרק הקודם)</h5>
        <div class="med-actions">
          ${breathing.link ? `<a class="btn ghost2" href="${esc(breathing.link)}" target="_blank" rel="noopener">▶ צפייה / האזנה</a>` : ""}
          ${breathing.file ? `<a class="btn ghost2" href="${esc(breathing.file)}" target="_blank" rel="noopener">⬇ קובץ הנשימה</a>` : ""}
        </div>
      </div>

      <button class="btn" id="scanDone">סיימתי סריקה ונשימה ✓</button>
    </div>`;
}

// --- תת-כלי 2: חשיפה תוך-גופנית (ליטוף היד + יד על הלב) ---
function w4Exposure() {
  const chips = WEEK4_SENSATIONS.map(s =>
    `<button class="chip mini sens-chip" data-sens="${s}">${s}</button>`).join("");
  return `
    <div class="tool-block">
      <div class="def-tech">
        <h5>✋ תרגיל 1 — ליטוף היד (3 מחזורים)</h5>
        <p class="hint">לטף את היד באופן מונוטוני מכף היד עד גב היד, בקצב איטי, כ-2 דקות.
          אז שים לב לתחושה הלא נעימה כמה שניות — <b>והסכם לה להיות</b> — ואז חזור ללטף. שלושה מחזורים.</p>
        <div class="timer-display" id="handTimer"><div class="timer-idle">מוכן להתחיל</div></div>
        <button class="btn ghost2" id="handStart">התחל תרגיל מונחה</button>
        <button class="btn ghost2 hidden" id="handStop">עצור</button>
      </div>

      <div class="def-tech">
        <h5>❤️ תרגיל 2 — יד על הלב</h5>
        <p class="hint">הנח יד על הלב. שאף 5 שניות אל הלב, היזכר במשהו משמח, ונשוף 5 שניות.
          אז שים לב לתחושה הלא נעימה כמה שניות — וחזור. כמה סבבים.</p>
        <div class="timer-display" id="heartTimer"><div class="timer-idle">מוכן להתחיל</div></div>
        <button class="btn ghost2" id="heartStart">התחל תרגיל מונחה</button>
        <button class="btn ghost2 hidden" id="heartStop">עצור</button>
      </div>

      <div class="def-tech">
        <h5>🎯 על איזו תחושה פיזית התמקדת?</h5>
        <p class="hint">התמקד בעיקר בתחושה הפיזית עצמה.</p>
        <div class="chip-row">${chips}</div>
        <textarea class="ta" id="sensNote" placeholder="מה עלה? מה קרה לתחושה כשנתת לה להיות?"></textarea>
        <button class="btn" id="saveSens">שמירה + טעינת האווטר</button>
      </div>
    </div>`;
}

// --- תת-כלי 3: טבלת חשיפות פנימיות (ניתנת לעריכה) ---
function w4Table() {
  const rows = S.getToolData(4, "exposures") || structuredClone(INTEROCEPTIVE_EXPOSURES);
  const cols = [
    { key: "sensation", label: "תחושה", w: "22%" },
    { key: "exercise", label: "תרגיל", w: "26%" },
    { key: "duration", label: "משך", w: "14%" },
    { key: "guidance", label: "הנחיה / ויסות", w: "38%" },
  ];
  return `
    <div class="tool-block">
      <p class="hint">חשיפות פנימיות — כל תרגיל מעורר תחושה גופנית, ואנחנו מתרגלים להישאר איתה עד שהיא יורדת.
        אפשר לערוך, להוסיף ולמחוק שורות.</p>
      <div class="exp-table">
        <div class="exp-head">${cols.map(co => `<div style="flex-basis:${co.w}">${co.label}</div>`).join("")}<div class="exp-del-col"></div></div>
        <div id="expRows">
          ${rows.map((r, i) => expRow(r, i, cols)).join("")}
        </div>
      </div>
      <button class="btn ghost2 add-case" id="addExp">＋ הוספת שורה</button>
      <div class="activation-actions">
        <button class="btn" id="saveExp">שמירה</button>
        <button class="btn ghost2" id="pdfExp">⬇ הורדת הטבלה כ-PDF</button>
        <button class="btn ghost2" id="resetExp">שחזור ברירת מחדל</button>
      </div>
    </div>`;
}

function expRow(r, i, cols) {
  return `<div class="exp-row" data-i="${i}">
    ${cols.map(co => `<div class="exp-cell" style="flex-basis:${co.w}">
      <textarea class="exp-input" data-f="${co.key}" rows="2" placeholder="${co.label}">${esc(r[co.key] || "")}</textarea></div>`).join("")}
    <button class="exp-del" data-del="${i}">✕</button>
  </div>`;
}

function collectExposures() {
  const rows = [];
  app.querySelectorAll(".exp-row").forEach(rowEl => {
    const r = {};
    rowEl.querySelectorAll(".exp-input").forEach(inp => r[inp.dataset.f] = inp.value.trim());
    rows.push(r);
  });
  return rows;
}

// מנוע טיימר מונחה: רצף שלבים [{label, seconds, cue}]
function runGuidedSequence(displayId, phases, onDone) {
  stopActiveTimer();
  const el = app.querySelector("#" + displayId);
  if (!el) return;
  let pi = 0, remaining = phases[0].seconds;
  const paint = () => {
    const p = phases[pi];
    const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
    const sscc = String(remaining % 60).padStart(2, "0");
    el.innerHTML = `<div class="timer-phase">${p.label}</div>
      <div class="timer-count">${mm}:${sscc}</div>
      ${p.cue ? `<div class="timer-cue">${p.cue}</div>` : ""}
      <div class="timer-step">שלב ${pi + 1} מתוך ${phases.length}</div>`;
  };
  paint();
  activeTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      pi++;
      if (pi >= phases.length) { stopActiveTimer(); el.innerHTML = `<div class="timer-done">✓ סיימת את התרגיל</div>`; onDone && onDone(); return; }
      remaining = phases[pi].seconds;
    }
    paint();
  }, 1000);
}

function mountWeek4Handlers() {
  app.querySelectorAll("[data-w4tab]").forEach(b =>
    b.addEventListener("click", () => { stopActiveTimer(); stashWeek4Drafts(); week4Tab = b.dataset.w4tab; renderChapter(4); }));

  // תת-כלי 1
  const bt = app.querySelector("#breathToggle");
  if (bt) bt.addEventListener("click", () => {
    const circle = app.querySelector("#breathCircle");
    const label = app.querySelector("#breathLabel");
    if (circle.classList.contains("breathing")) {
      circle.classList.remove("breathing"); label.textContent = "התחל"; bt.textContent = "התחל נשימה מונחית";
    } else {
      circle.classList.add("breathing"); label.textContent = "נשמו…"; bt.textContent = "עצור";
    }
  });
  const sd = app.querySelector("#scanDone");
  if (sd) sd.addEventListener("click", () => { S.logActivity("exercise", "סריקה ונשימה"); toast("יפה! טענת את האווטר ✓"); });

  // תת-כלי 2 — טיימרים מונחים
  const handPhases = [];
  for (let cyc = 1; cyc <= 3; cyc++) {
    handPhases.push({ label: `מחזור ${cyc} — ליטוף מונוטוני`, seconds: 120, cue: "כף היד → גב היד, קצב איטי" });
    handPhases.push({ label: `מחזור ${cyc} — שים לב לתחושה`, seconds: 10, cue: "הסכם לה להיות. רק להרגיש" });
  }
  const hs = app.querySelector("#handStart");
  if (hs) hs.addEventListener("click", () => {
    app.querySelector("#handStop").classList.remove("hidden");
    runGuidedSequence("handTimer", handPhases, () => S.logActivity("exposure", "ליטוף היד"));
  });
  const hst = app.querySelector("#handStop");
  if (hst) hst.addEventListener("click", () => { stopActiveTimer(); app.querySelector("#handTimer").innerHTML = `<div class="timer-idle">נעצר</div>`; });

  const heartPhases = [];
  for (let r = 1; r <= 4; r++) {
    heartPhases.push({ label: `סבב ${r} — שאיפה אל הלב`, seconds: 5, cue: "היזכר במשהו משמח" });
    heartPhases.push({ label: `סבב ${r} — נשיפה`, seconds: 5, cue: "אוויר יוצא לאט" });
    heartPhases.push({ label: `סבב ${r} — שים לב לתחושה`, seconds: 5, cue: "תן לה להיות" });
  }
  const es = app.querySelector("#heartStart");
  if (es) es.addEventListener("click", () => {
    app.querySelector("#heartStop").classList.remove("hidden");
    runGuidedSequence("heartTimer", heartPhases, () => S.logActivity("exposure", "יד על הלב"));
  });
  const est = app.querySelector("#heartStop");
  if (est) est.addEventListener("click", () => { stopActiveTimer(); app.querySelector("#heartTimer").innerHTML = `<div class="timer-idle">נעצר</div>`; });

  app.querySelectorAll(".sens-chip").forEach(b =>
    b.addEventListener("click", () => b.classList.toggle("on")));
  const ss = app.querySelector("#saveSens");
  if (ss) ss.addEventListener("click", () => {
    const sens = [...app.querySelectorAll(".sens-chip.on")].map(b => b.dataset.sens);
    const note = app.querySelector("#sensNote").value.trim();
    S.saveToolEntry(4, "sensations", { sens, note });
    S.logActivity("exposure", "חשיפה תוך-גופנית");
    toast("נשמר ✓"); renderChapter(4);
  });

  // תת-כלי 3 — טבלה
  app.querySelectorAll(".exp-input").forEach(inp =>
    inp.addEventListener("change", () => S.setToolData(4, "exposures", collectExposures())));
  const ae = app.querySelector("#addExp");
  if (ae) ae.addEventListener("click", () => {
    const rows = collectExposures(); rows.push({ sensation: "", exercise: "", duration: "", guidance: "" });
    S.setToolData(4, "exposures", rows); renderChapter(4);
  });
  app.querySelectorAll(".exp-del").forEach(b =>
    b.addEventListener("click", () => {
      const rows = collectExposures(); rows.splice(Number(b.dataset.del), 1);
      S.setToolData(4, "exposures", rows); renderChapter(4);
    }));
  const se = app.querySelector("#saveExp");
  if (se) se.addEventListener("click", () => { S.setToolData(4, "exposures", collectExposures()); toast("הטבלה נשמרה ✓"); });
  const pe = app.querySelector("#pdfExp");
  if (pe) pe.addEventListener("click", () => { S.setToolData(4, "exposures", collectExposures()); openExposurePrint(collectExposures()); });
  const re = app.querySelector("#resetExp");
  if (re) re.addEventListener("click", () => {
    if (confirm("לשחזר את טבלת ברירת המחדל? השינויים שלך יימחקו.")) {
      S.setToolData(4, "exposures", structuredClone(INTEROCEPTIVE_EXPOSURES)); renderChapter(4);
    }
  });
}

function stashWeek4Drafts() {
  if (app.querySelectorAll(".exp-row").length) S.setToolData(4, "exposures", collectExposures());
}

function openExposurePrint(rows) {
  const st = S.getState();
  const today = new Date().toLocaleDateString("he-IL");
  const body = rows.map(r =>
    `<tr><td>${esc(r.sensation || "")}</td><td>${esc(r.exercise || "")}</td><td class="d">${esc(r.duration || "")}</td><td>${esc(r.guidance || "")}</td></tr>`).join("");
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
    <title>חשיפות פנימיות — שבוע 4</title>
    <style>
      body{font-family:"Segoe UI",Arial,sans-serif;color:#20353a;padding:28px}
      h1{color:#0f766e;margin:0 0 4px}.sub{color:#6a8189;margin:0 0 8px}
      .meta{display:flex;gap:24px;color:#6a8189;font-size:13px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #cfe0dc;padding:9px;text-align:right;font-size:13px;vertical-align:top}
      th{background:#eefaf6;color:#0f766e} td.d{text-align:center;white-space:nowrap}
      .btn{background:#0f766e;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:15px;cursor:pointer;margin-top:16px}
      @media print{.noprint{display:none}}
    </style></head><body>
    <h1>חשיפות פנימיות</h1>
    <p class="sub">מסע 8 השבועות · שבוע 4 — הנהגת הגוף</p>
    <div class="meta"><span>שם: ${esc(st.name) || "________"}</span><span>תאריך: ${today}</span></div>
    <table><thead><tr><th>תחושה</th><th>תרגיל</th><th>משך</th><th>הנחיה / ויסות</th></tr></thead><tbody>${body}</tbody></table>
    <button class="btn noprint" onclick="window.print()">הדפסה / שמירה כ-PDF</button>
    <script>setTimeout(()=>window.print(),400)<\/script>
    </body></html>`;
  const w = window.open("", "_blank");
  if (!w) { toast("אפשר חלונות קופצים כדי להוריד"); return; }
  w.document.write(html); w.document.close();
}

// ============================================================
//  שבוע 5 — עיוותי חשיבה, טבלת החלפת מחשבות, בודק AI
// ============================================================
let week5Tab = "learn";
const W5_TABS = [
  { id: "learn",   label: "עיוותי חשיבה" },
  { id: "table",   label: "טבלת החלפה" },
  { id: "checker", label: "בדיקת מחשבה (AI)" },
];

function toolWeek5(c) {
  const tabs = `<div class="subtool-tabs">${W5_TABS.map(t =>
    `<button class="subtool-tab ${week5Tab === t.id ? "on" : ""}" data-w5tab="${t.id}">${t.label}</button>`).join("")}</div>`;
  let body = "";
  if (week5Tab === "learn") body = w5Learn();
  if (week5Tab === "table") body = w5Table();
  if (week5Tab === "checker") body = w5Checker();
  return tabs + `<div id="w5body">${body}</div>`;
}

// --- תת-כלי 1: לימוד עיוותי חשיבה ---
function w5Learn() {
  return `
    <div class="tool-block">
      <p class="hint">לפני ההחלפה — נלמד לזהות עיוותי חשיבה. אלו "מלכודות" נפוצות של המחשבה,
        ולכל אחת יש חלופה אדפטיבית ומדויקת יותר.</p>
      <div class="dist-list">
        ${DISTORTIONS.map(d => `
          <div class="dist-card">
            <div class="dist-top"><span class="dist-name">${esc(d.name)}</span>
              <span class="dist-common">${esc(d.common)}</span></div>
            <div class="dist-ex">🔴 ${esc(d.example)}</div>
            <div class="dist-ad">🟢 ${esc(d.adaptive)}</div>
          </div>`).join("")}
      </div>
      <div class="activation-actions">
        <a class="btn ghost2" href="resources/thinking-errors.pdf" target="_blank" rel="noopener">⬇ הורדת דף עיוותי החשיבה</a>
        <button class="btn" id="learnDone">סיימתי ללמוד ✓</button>
      </div>
    </div>`;
}

// --- תת-כלי 2: טבלת החלפת מחשבות (7 עמודות) ---
function w5Table() {
  const rows = S.getToolData(5, "thoughtTable") || [emptyThoughtRow()];
  return `
    <div class="tool-block">
      <p class="hint">מלא אירוע אחר אירוע: מהמחשבה האוטומטית, דרך זיהוי עיוות החשיבה,
        אל המחשבה החלופית — ובדוק איך עוצמת הרגש יורדת.</p>
      <div class="exp-table wide">
        <div class="exp-head">${THOUGHT_TABLE_COLS.map(co => `<div style="flex-basis:${co.w}" title="${esc(co.hint)}">${co.label}</div>`).join("")}<div class="exp-del-col"></div></div>
        <div id="thoughtRows">${rows.map((r, i) => thoughtRow(r, i)).join("")}</div>
      </div>
      <button class="btn ghost2 add-case" id="addThought">＋ הוספת שורה</button>
      <div class="activation-actions">
        <button class="btn" id="saveThoughtTable">שמירה + טעינת האווטר</button>
        <button class="btn ghost2" id="pdfThought">⬇ הורדת הטבלה כ-PDF</button>
      </div>
    </div>`;
}

function emptyThoughtRow() {
  const r = {}; THOUGHT_TABLE_COLS.forEach(co => r[co.key] = ""); return r;
}

function thoughtRow(r, i) {
  return `<div class="exp-row" data-i="${i}">
    ${THOUGHT_TABLE_COLS.map(co => `<div class="exp-cell" style="flex-basis:${co.w}">
      <textarea class="exp-input tt-input" data-f="${co.key}" rows="2" placeholder="${esc(co.label)}">${esc(r[co.key] || "")}</textarea></div>`).join("")}
    <button class="exp-del tt-del" data-del="${i}">✕</button>
  </div>`;
}

function collectThoughtRows() {
  const rows = [];
  app.querySelectorAll("#thoughtRows .exp-row").forEach(rowEl => {
    const r = {};
    rowEl.querySelectorAll(".tt-input").forEach(inp => r[inp.dataset.f] = inp.value.trim());
    rows.push(r);
  });
  return rows;
}

// --- תת-כלי 3: בודק מחשבה חלופית (AI) ---
function w5Checker() {
  return `
    <div class="tool-block">
      <p class="hint">כתוב את המחשבה המטרידה, ואם תרצה גם מחשבה חלופית שניסחת — וה-AI יבדוק אותה
        לפי ארבעה כללים:</p>
      <ul class="rules-list">
        <li>מְתקפת את מה שאתה מרגיש</li>
        <li>עונה בחמלה לכאב</li>
        <li>ממוקדת פתרון ריאלי</li>
        <li>מבוססת עובדות — בלי הכללה, עיוות או השמטה</li>
      </ul>
      <label class="mini-label">המחשבה המטרידה</label>
      <textarea class="ta" id="tcOriginal" placeholder="למשל: כולם רואים שאני לחוץ ושופטים אותי"></textarea>
      <label class="mini-label">המחשבה החלופית שלי (לא חובה)</label>
      <textarea class="ta" id="tcAlt" placeholder="המחשבה המדויקת יותר שניסחתי..."></textarea>
      <button class="btn" id="tcCheck">🔍 בדוק מחשבה חלופית</button>
      <div class="tc-result" id="tcResult"></div>
    </div>`;
}

function mountWeek5Handlers() {
  app.querySelectorAll("[data-w5tab]").forEach(b =>
    b.addEventListener("click", () => { stashWeek5Drafts(); week5Tab = b.dataset.w5tab; renderChapter(5); }));

  // לימוד
  const ld = app.querySelector("#learnDone");
  if (ld) ld.addEventListener("click", () => { S.logActivity("thought", "לימוד עיוותי חשיבה"); toast("יפה! טענת את האווטר ✓"); });

  // טבלה
  app.querySelectorAll(".tt-input").forEach(inp =>
    inp.addEventListener("change", () => S.setToolData(5, "thoughtTable", collectThoughtRows())));
  const at = app.querySelector("#addThought");
  if (at) at.addEventListener("click", () => {
    const rows = collectThoughtRows(); rows.push(emptyThoughtRow());
    S.setToolData(5, "thoughtTable", rows); renderChapter(5);
  });
  app.querySelectorAll(".tt-del").forEach(b =>
    b.addEventListener("click", () => {
      const rows = collectThoughtRows(); rows.splice(Number(b.dataset.del), 1);
      S.setToolData(5, "thoughtTable", rows.length ? rows : [emptyThoughtRow()]); renderChapter(5);
    }));
  const stt = app.querySelector("#saveThoughtTable");
  if (stt) stt.addEventListener("click", () => {
    const rows = collectThoughtRows();
    S.setToolData(5, "thoughtTable", rows);
    if (rows.some(r => Object.values(r).some(Boolean))) S.logActivity("thought", "החלפת מחשבה");
    toast("הטבלה נשמרה ✓"); renderChapter(5);
  });
  const pt = app.querySelector("#pdfThought");
  if (pt) pt.addEventListener("click", () => { S.setToolData(5, "thoughtTable", collectThoughtRows()); openThoughtPrint(collectThoughtRows()); });

  // בודק AI
  const tc = app.querySelector("#tcCheck");
  if (tc) tc.addEventListener("click", async () => {
    const orig = app.querySelector("#tcOriginal").value.trim();
    const alt = app.querySelector("#tcAlt").value.trim();
    if (!orig && !alt) return toast("כתוב לפחות מחשבה אחת");
    const result = app.querySelector("#tcResult");
    result.innerHTML = `<div class="tc-loading">בודק…</div>`;
    const sys = S.getState().aiPrompts["thought-checker"].prompt;
    const msg = `המחשבה המטרידה: ${orig || "(לא נכתבה)"}\nהמחשבה החלופית שניסחתי: ${alt || "(עדיין לא ניסחתי)"}`;
    const reply = await askAI(sys, [{ role: "user", content: msg }]);
    result.innerHTML = `<div class="tc-reply">${esc(reply).replace(/\n/g, "<br>")}</div>`;
    S.logActivity("thought", "בדיקת מחשבה חלופית");
  });
}

function stashWeek5Drafts() {
  if (app.querySelectorAll("#thoughtRows .exp-row").length) S.setToolData(5, "thoughtTable", collectThoughtRows());
}

function openThoughtPrint(rows) {
  const st = S.getState();
  const today = new Date().toLocaleDateString("he-IL");
  const head = THOUGHT_TABLE_COLS.map(co => `<th>${esc(co.label)}</th>`).join("");
  const body = rows.map(r =>
    `<tr>${THOUGHT_TABLE_COLS.map(co => `<td>${esc(r[co.key] || "")}</td>`).join("")}</tr>`).join("");
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
    <title>טבלת החלפת מחשבות — שבוע 5</title>
    <style>
      @page{size:landscape}
      body{font-family:"Segoe UI",Arial,sans-serif;color:#20353a;padding:22px}
      h1{color:#0f766e;margin:0 0 4px}.sub{color:#6a8189;margin:0 0 8px}
      .meta{display:flex;gap:24px;color:#6a8189;font-size:13px;margin-bottom:14px}
      table{width:100%;border-collapse:collapse;table-layout:fixed}
      th,td{border:1px solid #cfe0dc;padding:8px;text-align:right;font-size:12px;vertical-align:top;word-wrap:break-word}
      th{background:#eefaf6;color:#0f766e} td{height:60px}
      .btn{background:#0f766e;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:15px;cursor:pointer;margin-top:16px}
      @media print{.noprint{display:none}}
    </style></head><body>
    <h1>טבלת החלפת מחשבות</h1>
    <p class="sub">מסע 8 השבועות · שבוע 5 — הנהגת המחשבות</p>
    <div class="meta"><span>שם: ${esc(st.name) || "________"}</span><span>תאריך: ${today}</span></div>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    <button class="btn noprint" onclick="window.print()">הדפסה / שמירה כ-PDF</button>
    <script>setTimeout(()=>window.print(),400)<\/script>
    </body></html>`;
  const w = window.open("", "_blank");
  if (!w) { toast("אפשר חלונות קופצים כדי להוריד"); return; }
  w.document.write(html); w.document.close();
}

// ============================================================
//  שבוע 6 — דייט עם הדאגה, מדיטציות, תזכורת יומית
// ============================================================
let week6Tab = "write";
const W6_TABS = [
  { id: "write",    label: "כתיבה 5 דק׳" },
  { id: "guided",   label: "תהליך מודרך" },
  { id: "meds",     label: "מדיטציות" },
  { id: "reminder", label: "תזכורת יומית" },
];
const WORRY_REMINDER = {
  title: "דייט עם הדאגה — 5 דקות",
  description: "שב 5 דקות עם הדאגה: פשוט לכתוב כל מה שעולה, או לתרגל את התהליך המודרך. אני כאן — מה אתה מנסה להגיד לי?",
};
const FOCUS_SENSATIONS = ["כיווץ", "רעד", "עומס", "כבדות", "משהו שרוצה להתפרץ"];

function toolWeek6(c) {
  const tabs = `<div class="subtool-tabs">${W6_TABS.map(t =>
    `<button class="subtool-tab ${week6Tab === t.id ? "on" : ""}" data-w6tab="${t.id}">${t.label}</button>`).join("")}</div>`;
  let body = "";
  if (week6Tab === "write") body = w6Write();
  if (week6Tab === "guided") body = w6Guided();
  if (week6Tab === "meds") body = w6Meds();
  if (week6Tab === "reminder") body = w6Reminder();
  return tabs + `<div id="w6body">${body}</div>`;
}

// --- כתיבה חופשית 5 דקות + טיימר ---
function w6Write() {
  return `
    <div class="tool-block">
      <p class="hint">אפשרות א׳ — פשוט לכתוב 5 דקות את כל מה שעולה, בלי לסנן. כמו הורה טוב שמקשיב לדאגה.</p>
      <div class="timer-display" id="writeTimer"><div class="timer-idle">5:00 — לחץ להתחלה</div></div>
      <div class="activation-actions">
        <button class="btn ghost2" id="writeStart">▶ התחל טיימר 5 דקות</button>
        <button class="btn ghost2 hidden" id="writeStop">עצור</button>
      </div>
      <textarea class="ta big" id="freeWrite" placeholder="אני כאן, מה אתה מנסה להגיד לי?..."></textarea>
      <button class="btn" id="saveWrite">שמירה + טעינת האווטר</button>
    </div>`;
}

// --- תהליך מודרך (פוקוסינג) ---
function w6Guided() {
  const d = S.getToolData(6, "focusing") || {};
  const sensChips = FOCUS_SENSATIONS.map(s =>
    `<button class="chip mini focus-sens ${(d.sens || []).includes(s) ? "on" : ""}" data-sens="${s}">${s}</button>`).join("");
  return `
    <div class="tool-block">
      <p class="hint">אפשרות ב׳ — תהליך עדין של הקשבה לתחושה. קח את הזמן, נשום, ולווה כל שלב ברוגע.</p>

      <div class="focus-step"><span class="fs-num">1</span>
        <div><b>התמקד בתחושה</b> — היכן היא יושבת בגוף? איזה סוג תחושה?
          <div class="chip-row" style="margin-top:6px">${sensChips}</div></div></div>

      <div class="focus-step"><span class="fs-num">2</span>
        <div><b>איזו מילה עולה מתוך התחושה</b> ומייצגת אותה?
          <input class="inp" id="fWord" value="${esc(d.word || "")}" placeholder="המילה שעולה מהתחושה..."></div></div>

      <div class="focus-step"><span class="fs-num">3</span>
        <div><b>בחן:</b> האם זו באמת המילה שמרגישה נכון מתוך התחושה? שהות איתה כמה רגעים.</div></div>

      <div class="focus-step"><span class="fs-num">4</span>
        <div><b>שים לב</b> למה שעולה מתוך התחושה כשאתה נשאר איתה.</div></div>

      <div class="focus-step"><span class="fs-num">5</span>
        <div><b>למה התחושה זקוקה</b> כדי להרגיש טוב?
          <textarea class="ta" id="fNeeds" placeholder="למה התחושה זקוקה?...">${esc(d.needs || "")}</textarea></div></div>

      <div class="focus-step"><span class="fs-num">6</span>
        <div><b>דמיין</b> איך אתה מעניק לתחושה את מה שהיא צריכה — אולי הגנה, אולי נראות.</div></div>

      <div class="focus-step"><span class="fs-num">7</span>
        <div><b>האם אתה מסכים</b> לאפשר לתחושה להשתחרר עכשיו?
          <div class="chip-row" style="margin-top:6px">
            <button class="chip ${d.agree === "yes" ? "on" : ""}" data-agree="yes">כן</button>
            <button class="chip ${d.agree === "no" ? "on" : ""}" data-agree="no">עדיין לא</button>
          </div></div></div>

      <div class="focus-step"><span class="fs-num">8</span>
        <div><b>אם כן</b> — קח נשימה, אולי אנחת רווחה, אולי אפשר רעד, או פשוט דמיין איך התחושה הולכת ומשתחררת.
          <div class="release-stage" id="releaseStage"></div>
          <button class="btn ghost2" id="releaseBtn" style="margin-top:8px">🌬️ שחרור</button></div></div>

      <button class="btn" id="saveFocus">שמירה + טעינת האווטר</button>
    </div>`;
}

// --- מדיטציות שבוע 6 ---
function w6Meds() {
  const meds = S.getMeditationsByWeek(6);
  return `
    <div class="tool-block med-block">
      <p class="hint">מדיטציות ללווי העבודה על הורות עצמית מיטיבה, סליחה ואהבה עצמית.</p>
      ${meds.map(m => `
        <div class="med-item">
          <div class="med-name">${m.icon || "🎧"} ${esc(m.name)}</div>
          ${m.link || m.file ? `<div class="med-actions">
            ${m.link ? `<a class="btn ghost2" href="${esc(m.link)}" target="_blank" rel="noopener">▶ צפייה / האזנה</a>` : ""}
            ${m.file ? `<a class="btn ghost2" href="${esc(m.file)}" target="_blank" rel="noopener">⬇ קובץ</a>` : ""}
          </div>` : `<div class="tiny-note">טרם הוגדר קישור — ניתן להזין במסך הניהול.</div>`}
        </div>`).join("")}
    </div>`;
}

// --- תזכורת יומית ---
function w6Reminder() {
  const st = S.getState();
  return `
    <div class="tool-block">
      <div class="cal-connect">
        <h4>🔔 תזכורת יומית — דייט עם הדאגה (5 דק׳)</h4>
        <p class="hint">נכין אירוע יומי חוזר <b>למשך חודש</b> ביומן שלך. אתה מאשר בעצמך את ההוספה;
          שום דבר לא נשלח.</p>
        <div class="cal-time-row">
          <label class="mini-label">שעה</label>
          <input class="inp cal-time" id="worryTime" type="time" value="${esc(st.reminders.time || "20:00")}">
        </div>
        <div class="gcal-block">
          <button class="btn" id="worryGoogle">📅 הוספה ליומן Google</button>
        </div>
        <div class="ics-block">
          <div class="mini-label">📥 או קובץ ליומן (Outlook / Apple / iPhone):</div>
          <input class="inp" id="worryEmail" type="email" dir="ltr"
            placeholder="המייל שלך (לקובץ) — you@example.com" value="${esc(st.reminders.email || "")}">
          <button class="btn ghost2" id="worryIcs">⬇ הורדת קובץ יומן (.ics)</button>
        </div>
      </div>
    </div>`;
}

function mountWeek6Handlers() {
  app.querySelectorAll("[data-w6tab]").forEach(b =>
    b.addEventListener("click", () => { stopActiveTimer(); stashWeek6Drafts(); week6Tab = b.dataset.w6tab; renderChapter(6); }));

  // כתיבה 5 דקות
  const ws = app.querySelector("#writeStart");
  if (ws) ws.addEventListener("click", () => {
    app.querySelector("#writeStop").classList.remove("hidden");
    runGuidedSequence("writeTimer", [{ label: "כתיבה חופשית", seconds: 300, cue: "פשוט תכתוב כל מה שעולה" }],
      () => toast("5 דקות הושלמו 🌱"));
  });
  const wst = app.querySelector("#writeStop");
  if (wst) wst.addEventListener("click", () => { stopActiveTimer(); app.querySelector("#writeTimer").innerHTML = `<div class="timer-idle">נעצר</div>`; });
  const sw = app.querySelector("#saveWrite");
  if (sw) sw.addEventListener("click", () => {
    const v = app.querySelector("#freeWrite").value.trim();
    if (!v) return toast("כתוב משהו קודם");
    S.saveToolEntry(6, "freewrite", { text: v });
    S.logActivity("exercise", "דייט עם הדאגה — כתיבה");
    toast("נשמר ✓"); app.querySelector("#freeWrite").value = "";
  });

  // תהליך מודרך
  app.querySelectorAll(".focus-sens").forEach(b => b.addEventListener("click", () => b.classList.toggle("on")));
  app.querySelectorAll("[data-agree]").forEach(b => b.addEventListener("click", () => {
    app.querySelectorAll("[data-agree]").forEach(x => x.classList.remove("on")); b.classList.add("on");
  }));
  const rb = app.querySelector("#releaseBtn");
  if (rb) rb.addEventListener("click", () => {
    const stage = app.querySelector("#releaseStage");
    stage.innerHTML = `<div class="release-orb"></div><div class="release-text">משחררים… נשימה אחת ארוכה</div>`;
    S.logActivity("thought", "שחרור תחושה");
  });
  const sf = app.querySelector("#saveFocus");
  if (sf) sf.addEventListener("click", () => {
    const data = {
      sens: [...app.querySelectorAll(".focus-sens.on")].map(b => b.dataset.sens),
      word: app.querySelector("#fWord").value.trim(),
      needs: app.querySelector("#fNeeds").value.trim(),
      agree: app.querySelector("[data-agree].on")?.dataset.agree || "",
    };
    S.setToolData(6, "focusing", data);
    S.logActivity("exercise", "דייט עם הדאגה — מודרך");
    toast("נשמר ✓");
  });

  // תזכורת יומית
  const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const wg = app.querySelector("#worryGoogle");
  if (wg) wg.addEventListener("click", () => {
    const time = app.querySelector("#worryTime").value || "20:00";
    S.setReminders({ time });
    window.open(googleDailyUrl({ ...WORRY_REMINDER, time }), "_blank", "noopener");
    toast("נפתח יומן Google — אשר את ההוספה ✓");
  });
  const wi = app.querySelector("#worryIcs");
  if (wi) wi.addEventListener("click", () => {
    const email = (app.querySelector("#worryEmail").value || "").trim();
    const time = app.querySelector("#worryTime").value || "20:00";
    if (!validEmail(email)) return toast("הזן כתובת מייל תקינה");
    S.setReminders({ email, time, enabled: true });
    downloadDailyICS({ ...WORRY_REMINDER, email, time });
    toast("הקובץ ירד — פתח אותו כדי להוסיף ליומן ✓");
  });
}

function stashWeek6Drafts() {
  const fw = app.querySelector("#fWord");
  if (fw || app.querySelector("#fNeeds")) {
    S.setToolData(6, "focusing", {
      sens: [...app.querySelectorAll(".focus-sens.on")].map(b => b.dataset.sens),
      word: app.querySelector("#fWord")?.value.trim() || "",
      needs: app.querySelector("#fNeeds")?.value.trim() || "",
      agree: app.querySelector("[data-agree].on")?.dataset.agree || "",
    });
  }
}

// ============================================================
//  שבוע 7 — פעולה למרות פחד: כללים והכנה, חשיפה בדמיון, סולם פחדים
// ============================================================
let week7Tab = "rules";
const W7_TABS = [
  { id: "rules",    label: "כללים והכנה" },
  { id: "imaginal", label: "חשיפה בדמיון" },
  { id: "ladder",   label: "סולם פחדים" },
  { id: "journal",  label: "יומן חשיפות" },
];

function toolWeek7(c) {
  const tabs = `<div class="subtool-tabs">${W7_TABS.map(t =>
    `<button class="subtool-tab ${week7Tab === t.id ? "on" : ""}" data-w7tab="${t.id}">${t.label}</button>`).join("")}</div>`;
  let body = "";
  if (week7Tab === "rules") body = w7Rules();
  if (week7Tab === "imaginal") body = w7Imaginal();
  if (week7Tab === "ladder") body = w7Ladder();
  if (week7Tab === "journal") body = w7Journal();
  return tabs + `<div id="w7body">${body}</div>`;
}

// --- יומן חשיפות שבועי (יום + שעה + החשיפה) + שיתוף ליומן ---
const EXP_REMINDER = {
  title: "חשיפה יומית — מסע 8 השבועות",
  description: "הזמן לחשיפה שתכננת. זכור: הכנה, חשיפה בדמיון, ולהישאר עם התחושה עד שהיא יורדת.",
};
function w7Journal() {
  const st = S.getState();
  const plan = S.getToolData(7, "expJournal") || {};
  const table = WEEK_DAYS.map(day => {
    const cell = plan[day] || {};
    return `
      <div class="day-row" data-day="${day}">
        <div class="day-name">${day}</div>
        <input class="inp day-time" type="time" value="${esc(cell.time || "")}" aria-label="שעה ל${day}">
        <input class="inp day-input" value="${esc(cell.action || "")}" placeholder="החשיפה שאבצע...">
      </div>`;
  }).join("");
  return `
    <div class="tool-block">
      <p class="hint">שבץ ביומן השבועי את החשיפות שתתרגל — יום, שעה, והחשיפה עצמה. עדיף אותה חשיפה
        3–5 פעמים עד התרגלות, ורק אז לעלות דרגה.</p>
      <div id="w7journal" class="week-table">${table}</div>
      <div class="activation-actions">
        <button class="btn" id="saveExpJournal">שמירה + טעינת האווטר</button>
        <button class="btn ghost2" id="pdfExpJournal">⬇ הורדה כ-PDF</button>
      </div>

      <div class="cal-connect">
        <h4>🔔 הוספת החשיפות ליומן — לחודש</h4>
        <div class="gcal-block">
          <div class="mini-label">📅 הוספה ישירה ליומן Google — לחיצה לכל יום:</div>
          ${w7JournalGcalLinks(plan)}
        </div>
        <div class="ics-block">
          <div class="mini-label">📥 או קובץ ליומן (Outlook / Apple / iPhone):</div>
          <input class="inp" id="expEmail" type="email" dir="ltr"
            placeholder="המייל שלך (לקובץ) — you@example.com" value="${esc(st.reminders.email || "")}">
          <button class="btn ghost2" id="expIcs">⬇ הורדת קובץ יומן (.ics)</button>
        </div>
      </div>
    </div>`;
}

function w7JournalGcalLinks(plan) {
  const items = WEEK_DAYS.filter(day => plan[day] && plan[day].action);
  if (!items.length) return `<p class="subtle">מלא ושמור חשיפות בלוח כדי לקבל קישורים ליומן Google.</p>`;
  return `<div class="chip-row">` + items.map(day => {
    const c = plan[day];
    return `<button class="chip gcal-link" data-gday="${day}">➕ ${day}${c.time ? " " + esc(c.time) : ""} · ${esc(c.action)}</button>`;
  }).join("") + `</div>`;
}

function collectExpJournal() {
  const plan = {};
  app.querySelectorAll("#w7journal .day-row").forEach(row => {
    const day = row.dataset.day;
    const action = row.querySelector(".day-input")?.value.trim();
    const time = row.querySelector(".day-time")?.value || "";
    if (action) plan[day] = { time, action };
  });
  return plan;
}

function openExpJournalPrint(plan) {
  const st = S.getState();
  const today = new Date().toLocaleDateString("he-IL");
  const rows = WEEK_DAYS.map(day => {
    const c = plan[day] || {};
    return `<tr><td class="d">${day}</td><td class="t">${esc(c.time || "")}</td><td>${esc(c.action || "")}</td><td class="c"></td></tr>`;
  }).join("");
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
    <title>יומן חשיפות — שבוע 7</title>
    <style>
      body{font-family:"Segoe UI",Arial,sans-serif;color:#20353a;padding:28px;max-width:720px;margin:auto}
      h1{color:#0f766e;margin:0 0 4px}.sub{color:#6a8189;margin:0 0 16px}
      .meta{display:flex;gap:24px;color:#6a8189;font-size:13px;margin-bottom:14px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #cfe0dc;padding:10px;text-align:right;font-size:14px}
      th{background:#eefaf6;color:#0f766e} td.d{font-weight:700;width:80px;background:#f6fbfa}
      td.t{width:64px;text-align:center;color:#0f766e;font-weight:700} td.c{width:60px}
      .btn{background:#0f766e;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:15px;cursor:pointer;margin-top:16px}
      @media print{.noprint{display:none}}
    </style></head><body>
    <h1>יומן חשיפות שבועי</h1>
    <p class="sub">מסע 8 השבועות · שבוע 7 — פעולה למרות פחד</p>
    <div class="meta"><span>שם: ${esc(st.name) || "________"}</span><span>תאריך: ${today}</span></div>
    <table><thead><tr><th>יום</th><th>שעה</th><th>החשיפה</th><th>בוצע</th></tr></thead><tbody>${rows}</tbody></table>
    <button class="btn noprint" onclick="window.print()">הדפסה / שמירה כ-PDF</button>
    <script>setTimeout(()=>window.print(),400)<\/script>
    </body></html>`;
  const w = window.open("", "_blank");
  if (!w) { toast("אפשר חלונות קופצים כדי להוריד"); return; }
  w.document.write(html); w.document.close();
}

// --- כללים + הכנה ---
function w7Rules() {
  const p = S.getToolData(7, "prep") || {};
  return `
    <div class="tool-block">
      <p class="hint">אנחנו נחשפים לרגש שמפחיד — פחד, בושה, תסכול, אי-שקט או דחף — לומדים שהוא עולה
        וחולף, עד שהגוף מתרגל ומפסיק להיבהל.</p>
      <h5>📜 כללי החשיפה</h5>
      <ol class="rules-ol">${EXPOSURE_RULES.map(r => `<li>${esc(r)}</li>`).join("")}</ol>
    </div>

    <div class="tool-block">
      <h5>🛡️ הכנה לחשיפה</h5>
      <label class="mini-label">כלי או טכניקה שמרגיעים אותי ומעניקים ביטחון</label>
      <textarea class="ta prep-field" data-p="tool" placeholder="למשל: נשימת בטן, המקום הבטוח, משפט מרגיע...">${esc(p.tool || "")}</textarea>
      <label class="mini-label">המקום הבטוח שלי בדמיון</label>
      <textarea class="ta prep-field" data-p="safePlace" placeholder="חוף הים, גינה ירוקה... תאר אותו בפירוט">${esc(p.safePlace || "")}</textarea>
      <button class="btn" id="savePrep">שמירה + טעינת האווטר</button>
    </div>

    <div class="tool-block">
      <h5>📎 דפי עבודה להורדה</h5>
      <div class="med-actions">
        <a class="btn ghost2" href="resources/exposures-guide.pdf" target="_blank" rel="noopener">⬇ מדרג חשיפות</a>
        <a class="btn ghost2" href="resources/imaginal-exposure.pdf" target="_blank" rel="noopener">⬇ חשיפה בדמיון</a>
        <a class="btn ghost2" href="resources/internal-exposure.pdf" target="_blank" rel="noopener">⬇ חשיפה פנימית</a>
      </div>
    </div>`;
}

// --- חשיפה בדמיון ---
function w7Imaginal() {
  const d = S.getToolData(7, "imaginal") || {};
  return `
    <div class="tool-block">
      <p class="hint">חשיפה בדמיון — יוצרים מקום בטוח, מתקרבים שלב-שלב אל הפחד, ומאפשרים לחרדה לעלות ולחלוף.</p>
      <div class="warn-note">⚠️ לסובלים מסכיזופרניה, דיכאון קשה או פוסט-טראומה — יש להימנע מחשיפה בדמיון.</div>
      <ol class="imaginal-steps">${IMAGINAL_STEPS.map(s => `<li>${esc(s)}</li>`).join("")}</ol>

      <h5>דירוג החרדה (0–10)</h5>
      <div class="sud-row"><span>לפני</span><input type="range" min="0" max="10" class="sud" id="imgBefore" value="${d.before ?? 0}"><b id="imgBeforeV">${d.before ?? 0}</b></div>
      <div class="sud-row"><span>בשיא</span><input type="range" min="0" max="10" class="sud" id="imgPeak" value="${d.peak ?? 0}"><b id="imgPeakV">${d.peak ?? 0}</b></div>
      <div class="sud-row"><span>אחרי</span><input type="range" min="0" max="10" class="sud" id="imgAfter" value="${d.after ?? 0}"><b id="imgAfterV">${d.after ?? 0}</b></div>
      <textarea class="ta" id="imgNote" placeholder="מה עלה? אילו מחשבות? מה קרה לחרדה?">${esc(d.note || "")}</textarea>
      <button class="btn" id="saveImaginal">שמירה + טעינת האווטר</button>
    </div>`;
}

// --- סולם פחדים ---
function w7Ladder() {
  const L = S.getToolData(7, "ladder") || { emotion: "", rungs: [emptyRung()] };
  const emoChips = EXPOSURE_EMOTIONS.map(e =>
    `<button class="chip ${L.emotion === e ? "on" : ""}" data-emo="${e}">${e}</button>`).join("");
  return `
    <div class="tool-block">
      <h5>איזה רגש אנחנו חושפים?</h5>
      <div class="chip-row">${emoChips}</div>

      <h5 style="margin-top:14px">סולם הפחדים — מהקל אל הכבד</h5>
      <p class="hint">דרג את הפעולות שאתה נמנע מהן, מהקל (למטה) אל הכבד (למעלה). לכל דרגה: עוצמה לפני ואחרי,
        ומספר הפעמים שתרגלת. עולים דרגה רק כשהפחד יורד בכ-50%.</p>
      <div id="rungs">${L.rungs.map((r, i) => rungCard(r, i)).join("")}</div>
      <button class="btn ghost2 add-case" id="addRung">＋ הוספת דרגה</button>

      <div class="example-load">
        <select id="exampleSelect" class="inp">
          <option value="">טען מדרג לדוגמה…</option>
          ${Object.keys(EXPOSURE_EXAMPLES).map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join("")}
        </select>
        <button class="btn ghost2" id="loadExample">טען</button>
      </div>

      <div class="activation-actions">
        <button class="btn" id="saveLadder">שמירה + טעינת האווטר</button>
        <button class="btn ghost2" id="pdfLadder">⬇ הורדת הסולם כ-PDF</button>
      </div>
    </div>`;
}

function emptyRung() { return { desc: "", before: "", after: "", times: "" }; }

function rungCard(r, i) {
  const drop = dropPct(r);
  const ready = drop >= 50 && Number(r.times) >= 3;
  return `
    <div class="rung" data-i="${i}">
      <div class="rung-head">
        <span class="rung-num">${i + 1}</span>
        <input class="inp rung-desc" data-f="desc" value="${esc(r.desc || "")}" placeholder="מה אני נמנע/מפחד ממנו">
        <button class="rung-del" data-del="${i}">✕</button>
      </div>
      <div class="rung-scores">
        <label>עוצמה לפני<input type="number" min="0" max="10" class="rung-score" data-f="before" value="${esc(r.before ?? "")}"></label>
        <label>עוצמה אחרי<input type="number" min="0" max="10" class="rung-score" data-f="after" value="${esc(r.after ?? "")}"></label>
        <label>פעמים<input type="number" min="0" max="20" class="rung-score" data-f="times" value="${esc(r.times ?? "")}"></label>
        <span class="rung-drop ${ready ? "ready" : ""}" data-i="${i}">${drop > 0 ? "ירידה " + drop + "%" : ""}${ready ? " · אפשר לעלות דרגה ✓" : ""}</span>
      </div>
    </div>`;
}

function dropPct(r) {
  const b = Number(r.before), a = Number(r.after);
  if (!b || b <= 0 || r.after === "" || r.after == null) return 0;
  return Math.max(0, Math.round((b - a) / b * 100));
}

function collectLadder() {
  const emotion = app.querySelector("[data-emo].on")?.dataset.emo || "";
  const rungs = [];
  app.querySelectorAll("#rungs .rung").forEach(el => {
    const r = {};
    el.querySelectorAll("[data-f]").forEach(inp => r[inp.dataset.f] = inp.value.trim());
    rungs.push(r);
  });
  return { emotion, rungs };
}

function mountWeek7Handlers() {
  app.querySelectorAll("[data-w7tab]").forEach(b =>
    b.addEventListener("click", () => { stashWeek7Drafts(); week7Tab = b.dataset.w7tab; renderChapter(7); }));

  // הכנה
  const sp = app.querySelector("#savePrep");
  if (sp) sp.addEventListener("click", () => {
    const data = {};
    app.querySelectorAll(".prep-field").forEach(f => data[f.dataset.p] = f.value.trim());
    S.setToolData(7, "prep", data);
    if (Object.values(data).some(Boolean)) S.logActivity("exercise", "הכנה לחשיפה");
    toast("נשמר ✓");
  });

  // חשיפה בדמיון
  ["imgBefore", "imgPeak", "imgAfter"].forEach(id => {
    const el = app.querySelector("#" + id);
    if (el) el.addEventListener("input", () => app.querySelector("#" + id + "V").textContent = el.value);
  });
  const si = app.querySelector("#saveImaginal");
  if (si) si.addEventListener("click", () => {
    S.setToolData(7, "imaginal", {
      before: +app.querySelector("#imgBefore").value, peak: +app.querySelector("#imgPeak").value,
      after: +app.querySelector("#imgAfter").value, note: app.querySelector("#imgNote").value.trim(),
    });
    S.logActivity("exposure", "חשיפה בדמיון");
    toast("נשמר ✓");
  });

  // סולם פחדים
  app.querySelectorAll("[data-emo]").forEach(b => b.addEventListener("click", () => {
    app.querySelectorAll("[data-emo]").forEach(x => x.classList.remove("on")); b.classList.add("on");
    S.setToolData(7, "ladder", collectLadder());
  }));
  app.querySelectorAll("#rungs [data-f]").forEach(inp =>
    inp.addEventListener("input", () => {
      const rungEl = inp.closest(".rung");
      const r = {}; rungEl.querySelectorAll("[data-f]").forEach(x => r[x.dataset.f] = x.value.trim());
      const badge = rungEl.querySelector(".rung-drop");
      const drop = dropPct(r); const ready = drop >= 50 && Number(r.times) >= 3;
      badge.textContent = `${drop > 0 ? "ירידה " + drop + "%" : ""}${ready ? " · אפשר לעלות דרגה ✓" : ""}`;
      badge.classList.toggle("ready", ready);
      S.setToolData(7, "ladder", collectLadder());
    }));
  const ar = app.querySelector("#addRung");
  if (ar) ar.addEventListener("click", () => {
    const L = collectLadder(); L.rungs.push(emptyRung()); S.setToolData(7, "ladder", L); renderChapter(7);
  });
  app.querySelectorAll(".rung-del").forEach(b =>
    b.addEventListener("click", () => {
      const L = collectLadder(); L.rungs.splice(Number(b.dataset.del), 1);
      if (!L.rungs.length) L.rungs.push(emptyRung());
      S.setToolData(7, "ladder", L); renderChapter(7);
    }));
  const le = app.querySelector("#loadExample");
  if (le) le.addEventListener("click", () => {
    const key = app.querySelector("#exampleSelect").value;
    if (!key) return;
    const L = collectLadder();
    L.rungs = EXPOSURE_EXAMPLES[key].map(desc => ({ desc, before: "", after: "", times: "" }));
    S.setToolData(7, "ladder", L); renderChapter(7);
  });
  const sl = app.querySelector("#saveLadder");
  if (sl) sl.addEventListener("click", () => {
    const L = collectLadder(); S.setToolData(7, "ladder", L);
    if (L.rungs.some(r => r.desc)) S.logActivity("exposure", "סולם פחדים");
    toast("הסולם נשמר ✓"); renderChapter(7);
  });
  const pl = app.querySelector("#pdfLadder");
  if (pl) pl.addEventListener("click", () => { S.setToolData(7, "ladder", collectLadder()); openLadderPrint(collectLadder()); });

  // יומן חשיפות
  app.querySelectorAll("#w7journal .day-input, #w7journal .day-time").forEach(inp =>
    inp.addEventListener("change", () => S.setToolData(7, "expJournal", collectExpJournal())));
  const sej = app.querySelector("#saveExpJournal");
  if (sej) sej.addEventListener("click", () => {
    S.setToolData(7, "expJournal", collectExpJournal());
    S.logActivity("exposure", "יומן חשיפות");
    toast("היומן נשמר ✓"); renderChapter(7);
  });
  const pej = app.querySelector("#pdfExpJournal");
  if (pej) pej.addEventListener("click", () => { S.setToolData(7, "expJournal", collectExpJournal()); openExpJournalPrint(collectExpJournal()); });
  app.querySelectorAll(".gcal-link").forEach(b => b.addEventListener("click", () => {
    const day = b.dataset.gday;
    const row = [...app.querySelectorAll("#w7journal .day-row")].find(r => r.dataset.day === day);
    if (!row) return; // רק אם אנחנו בטאב היומן
    const action = row.querySelector(".day-input")?.value.trim();
    const time = row.querySelector(".day-time")?.value || "09:00";
    if (!action) return toast("אין חשיפה ליום זה");
    S.setToolData(7, "expJournal", collectExpJournal());
    window.open(googleEventUrl({ day, time: time || "09:00", activity: action }), "_blank", "noopener");
    toast(`נפתח יומן Google ליום ${day} — אשר את השמירה ✓`);
  }));
  const validEmail7 = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const eic = app.querySelector("#expIcs");
  if (eic) eic.addEventListener("click", () => {
    const email = (app.querySelector("#expEmail").value || "").trim();
    if (!validEmail7(email)) return toast("הזן כתובת מייל תקינה");
    const plan = collectExpJournal();
    const events = Object.entries(plan).map(([day, v]) => ({ day, time: v.time || "09:00", activity: v.action }));
    if (!events.length) return toast("הוסף לפחות חשיפה אחת");
    S.setToolData(7, "expJournal", plan); S.setReminders({ email, enabled: true });
    downloadWeeklyICS({ events, email });
    toast(`קובץ עם ${events.length} ימים ירד — פתח אותו כדי להוסיף ליומן ✓`);
  });
}

function stashWeek7Drafts() {
  if (app.querySelectorAll(".prep-field").length) {
    const data = {}; app.querySelectorAll(".prep-field").forEach(f => data[f.dataset.p] = f.value.trim());
    S.setToolData(7, "prep", data);
  }
  if (app.querySelectorAll("#rungs .rung").length) S.setToolData(7, "ladder", collectLadder());
  if (app.querySelectorAll("#w7journal .day-row").length) S.setToolData(7, "expJournal", collectExpJournal());
}

function openLadderPrint(L) {
  const st = S.getState();
  const today = new Date().toLocaleDateString("he-IL");
  const body = L.rungs.map((r, i) => {
    const drop = dropPct(r);
    return `<tr><td class="n">${i + 1}</td><td>${esc(r.desc || "")}</td><td class="c">${esc(r.before ?? "")}</td><td class="c">${esc(r.after ?? "")}</td><td class="c">${esc(r.times ?? "")}</td><td class="c">${drop > 0 ? drop + "%" : ""}</td></tr>`;
  }).join("");
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
    <title>סולם פחדים — שבוע 7</title>
    <style>
      body{font-family:"Segoe UI",Arial,sans-serif;color:#20353a;padding:26px}
      h1{color:#0f766e;margin:0 0 4px}.sub{color:#6a8189;margin:0 0 8px}
      .meta{display:flex;gap:24px;color:#6a8189;font-size:13px;margin-bottom:14px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #cfe0dc;padding:9px;text-align:right;font-size:13px;vertical-align:top}
      th{background:#eefaf6;color:#0f766e} td.n{width:34px;text-align:center;font-weight:700;background:#f6fbfa}
      td.c{text-align:center;width:70px}
      .btn{background:#0f766e;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:15px;cursor:pointer;margin-top:16px}
      @media print{.noprint{display:none}}
    </style></head><body>
    <h1>סולם פחדים</h1>
    <p class="sub">מסע 8 השבועות · שבוע 7 — פעולה למרות פחד${L.emotion ? " · רגש: " + esc(L.emotion) : ""}</p>
    <div class="meta"><span>שם: ${esc(st.name) || "________"}</span><span>תאריך: ${today}</span></div>
    <table><thead><tr><th>#</th><th>הפעולה / הפחד</th><th>עוצמה לפני</th><th>עוצמה אחרי</th><th>פעמים</th><th>ירידה</th></tr></thead><tbody>${body}</tbody></table>
    <button class="btn noprint" onclick="window.print()">הדפסה / שמירה כ-PDF</button>
    <script>setTimeout(()=>window.print(),400)<\/script>
    </body></html>`;
  const w = window.open("", "_blank");
  if (!w) { toast("אפשר חלונות קופצים כדי להוריד"); return; }
  w.document.write(html); w.document.close();
}

// ============================================================
//  שבוע 8 — זהות חדשה: ערכים, הגשמה, לוח שבועי, תקשורת
// ============================================================
let week8Tab = "values";
const W8_TABS = [
  { id: "values",   label: "בחירת ערכים" },
  { id: "realize",  label: "הגשמת הערכים" },
  { id: "schedule", label: "לוח שבועי" },
  { id: "comm",     label: "תקשורת" },
];
const VALUE_REMINDER = {
  title: "הגשמת ערך — מסע 8 השבועות",
  description: "פעולה קטנה שמגשימה ערך שחשוב לך. לא לחכות שהפחד ייעלם — לפעול לכיוון שחשוב לך.",
};

function toolWeek8(c) {
  const tabs = `<div class="subtool-tabs">${W8_TABS.map(t =>
    `<button class="subtool-tab ${week8Tab === t.id ? "on" : ""}" data-w8tab="${t.id}">${t.label}</button>`).join("")}</div>`;
  let body = "";
  if (week8Tab === "values") body = w8Values();
  if (week8Tab === "realize") body = w8Realize();
  if (week8Tab === "schedule") body = w8Schedule();
  if (week8Tab === "comm") body = w8Comm();
  return tabs + `<div id="w8body">${body}</div>`;
}

// --- בחירת ודירוג ערכים ---
function w8Values() {
  const values = S.getToolData(8, "values") || Array(10).fill("");
  const palette = VALUES_SUGGESTIONS.map(v =>
    `<button class="chip mini val-chip" data-val="${esc(v)}">${esc(v)}</button>`).join("");
  const rows = values.map((v, i) => `
    <div class="val-row ${i < 3 ? "top3" : ""}">
      <span class="val-rank">${i + 1}</span>
      <input class="inp val-input" value="${esc(v || "")}" placeholder="ערך ${i + 1}...">
      <div class="val-move">
        <button class="val-up" data-up="${i}" ${i === 0 ? "disabled" : ""}>▲</button>
        <button class="val-down" data-down="${i}" ${i === values.length - 1 ? "disabled" : ""}>▼</button>
      </div>
    </div>`).join("");
  return `
    <div class="tool-block">
      <div class="heart-note">❤️ המטרה — לבחור ערכים <b>מהלב</b>. הרשימות הן רק השראה אם נתקעת.</div>
      <p class="hint">בחר עד 10 ערכים שחשובים לך, ואז דרג אותם עם החיצים — מה הכי חשוב למעלה.
        שלושת הראשונים יעברו להגשמה.</p>

      <div class="val-palette"><div class="pal-cat">השראה (לחיצה מוסיפה):</div>
        <div class="chip-row">${palette}</div></div>

      <div class="val-list">${rows}</div>

      <div class="activation-actions">
        <button class="btn" id="saveValues">שמירה + טעינת האווטר</button>
      </div>
      <div class="med-actions" style="margin-top:10px">
        <a class="btn ghost2" href="resources/values-list-1.pdf" target="_blank" rel="noopener">⬇ רשימת ערכים 1</a>
        <a class="btn ghost2" href="resources/values-list-2.pdf" target="_blank" rel="noopener">⬇ רשימת ערכים 2</a>
      </div>
    </div>`;
}

// --- הגשמת 3 הערכים המובילים ---
function w8Realize() {
  const values = (S.getToolData(8, "values") || []).filter(Boolean);
  const top3 = values.slice(0, 3);
  const realize = S.getToolData(8, "realize") || {};
  if (!top3.length) {
    return `<div class="tool-block"><p class="subtle">בחר ודרג ערכים בטאב "בחירת ערכים" — ושלושת הראשונים יופיעו כאן.</p></div>`;
  }
  return `
    <div class="tool-block">
      <div class="heart-note">💡 ההגשמה צריכה להיות <b>בשליטה שלך, קלה להשגה</b>, ועם <b>כמה דרכים</b>.
        למשל "לאהוב" — את בן/בת הזוג, ההורה, החבר, חיית המחמד, העשייה, היצירה, הטבע...</div>
      ${top3.map((v, idx) => `
        <div class="realize-value">
          <h5>שבוע ${idx + 1} · הערך: ${esc(v)}</h5>
          ${[0, 1, 2].map(j => `
            <input class="inp realize-way" data-val="${esc(v)}" data-w="${j}"
              value="${esc((realize[v] || [])[j] || "")}" placeholder="דרך ${j + 1} להגשים את ${esc(v)} כאן ועכשיו...">`).join("")}
        </div>`).join("")}
      <button class="btn" id="saveRealize">שמירה + טעינת האווטר</button>
    </div>`;
}

// --- לוח שבועי (יום + שעה + פעולה) + שיתוף ליומן ---
function w8Schedule() {
  const st = S.getState();
  const plan = S.getToolData(8, "schedule") || {};
  const table = WEEK_DAYS.map(day => {
    const cell = plan[day] || {};
    return `
      <div class="day-row" data-day="${day}">
        <div class="day-name">${day}</div>
        <input class="inp day-time" type="time" value="${esc(cell.time || "")}" aria-label="שעה ל${day}">
        <input class="inp day-input" value="${esc(cell.action || "")}" placeholder="איך אגשים את הערך...">
      </div>`;
  }).join("");
  return `
    <div class="tool-block">
      <p class="hint">שבץ ביומן השבועי פעולות שמגשימות את הערכים — יום, שעה, והפעולה.</p>
      <div id="w8sched" class="week-table">${table}</div>
      <div class="activation-actions">
        <button class="btn" id="saveSched">שמירה + טעינת האווטר</button>
        <button class="btn ghost2" id="pdfSched">⬇ הורדה כ-PDF</button>
      </div>

      <div class="cal-connect">
        <h4>🔔 הוספת הלוח ליומן — לחודש</h4>
        <div class="gcal-block">
          <div class="mini-label">📅 הוספה ישירה ליומן Google — לחיצה לכל יום:</div>
          ${w8GcalLinks(plan)}
        </div>
        <div class="ics-block">
          <div class="mini-label">📥 או קובץ ליומן (Outlook / Apple / iPhone):</div>
          <input class="inp" id="schedEmail" type="email" dir="ltr"
            placeholder="המייל שלך (לקובץ) — you@example.com" value="${esc(st.reminders.email || "")}">
          <button class="btn ghost2" id="schedIcs">⬇ הורדת קובץ יומן (.ics)</button>
        </div>
      </div>
    </div>`;
}

function w8GcalLinks(plan) {
  const items = WEEK_DAYS.filter(day => plan[day] && plan[day].action);
  if (!items.length) return `<p class="subtle">מלא ושמור פעולות בלוח כדי לקבל קישורים ליומן Google.</p>`;
  return `<div class="chip-row">` + items.map(day => {
    const c = plan[day];
    return `<button class="chip gcal-link" data-gday="${day}">➕ ${day}${c.time ? " " + esc(c.time) : ""} · ${esc(c.action)}</button>`;
  }).join("") + `</div>`;
}

function collectSchedule() {
  const plan = {};
  app.querySelectorAll("#w8sched .day-row").forEach(row => {
    const day = row.dataset.day;
    const action = row.querySelector(".day-input")?.value.trim();
    const time = row.querySelector(".day-time")?.value || "";
    if (action) plan[day] = { time, action };
  });
  return plan;
}

// --- תקשורת ואסרטיביות ---
function w8Comm() {
  return `
    <div class="tool-block">
      <h5>🗣️ עקרונות התקשורת המקרבת</h5>
      <div class="dist-list">
        ${COMMUNICATION_PRINCIPLES.map(p => `
          <div class="dist-card"><div class="dist-name">${esc(p.t)}</div>
            <div class="dist-ex" style="color:var(--ink)">${esc(p.d)}</div></div>`).join("")}
      </div>
    </div>
    <div class="tool-block">
      <h5>💪 אסרטיביות — חמישה צעדים</h5>
      <p class="hint">אסרטיביות שונה מאגרסיביות. מותר להיות עדין — וזה לא אומר להסכים על הכל.</p>
      <ol class="rules-ol">${ASSERTIVENESS_STEPS.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
      <div class="med-actions">
        <a class="btn ghost2" href="resources/communication.pdf" target="_blank" rel="noopener">⬇ עקרונות התקשורת</a>
        <a class="btn ghost2" href="resources/assertiveness.pdf" target="_blank" rel="noopener">⬇ אסרטיביות</a>
      </div>
    </div>`;
}

function mountWeek8Handlers() {
  app.querySelectorAll("[data-w8tab]").forEach(b =>
    b.addEventListener("click", () => { stashWeek8Drafts(); week8Tab = b.dataset.w8tab; renderChapter(8); }));

  // ערכים
  const collectValues = () => [...app.querySelectorAll(".val-input")].map(i => i.value.trim());
  app.querySelectorAll(".val-input").forEach(inp =>
    inp.addEventListener("change", () => S.setToolData(8, "values", collectValues())));
  app.querySelectorAll(".val-chip").forEach(b => b.addEventListener("click", () => {
    const vals = collectValues();
    const empty = vals.findIndex(v => !v);
    if (empty === -1) return toast("כל 10 המקומות מלאים");
    vals[empty] = b.dataset.val;
    S.setToolData(8, "values", vals); renderChapter(8);
  }));
  app.querySelectorAll(".val-up").forEach(b => b.addEventListener("click", () => {
    const i = +b.dataset.up, vals = collectValues();
    [vals[i - 1], vals[i]] = [vals[i], vals[i - 1]];
    S.setToolData(8, "values", vals); renderChapter(8);
  }));
  app.querySelectorAll(".val-down").forEach(b => b.addEventListener("click", () => {
    const i = +b.dataset.down, vals = collectValues();
    [vals[i + 1], vals[i]] = [vals[i], vals[i + 1]];
    S.setToolData(8, "values", vals); renderChapter(8);
  }));
  const sv = app.querySelector("#saveValues");
  if (sv) sv.addEventListener("click", () => {
    const vals = collectValues(); S.setToolData(8, "values", vals);
    if (vals.some(Boolean)) S.logActivity("exercise", "בחירת ערכים");
    toast("הערכים נשמרו ✓"); renderChapter(8);
  });

  // הגשמה
  const sr = app.querySelector("#saveRealize");
  if (sr) sr.addEventListener("click", () => {
    const realize = {};
    app.querySelectorAll(".realize-way").forEach(inp => {
      const v = inp.dataset.val;
      realize[v] = realize[v] || ["", "", ""];
      realize[v][+inp.dataset.w] = inp.value.trim();
    });
    S.setToolData(8, "realize", realize);
    S.logActivity("exercise", "הגשמת ערכים");
    toast("נשמר ✓");
  });

  // לוח שבועי
  app.querySelectorAll("#w8sched .day-input, #w8sched .day-time").forEach(inp =>
    inp.addEventListener("change", () => S.setToolData(8, "schedule", collectSchedule())));
  const ssc = app.querySelector("#saveSched");
  if (ssc) ssc.addEventListener("click", () => {
    S.setToolData(8, "schedule", collectSchedule());
    S.logActivity("joy", "לוח הגשמת ערכים");
    toast("הלוח נשמר ✓"); renderChapter(8);
  });
  const psc = app.querySelector("#pdfSched");
  if (psc) psc.addEventListener("click", () => { S.setToolData(8, "schedule", collectSchedule()); openSchedulePrint(collectSchedule()); });

  app.querySelectorAll(".gcal-link").forEach(b => b.addEventListener("click", () => {
    const day = b.dataset.gday;
    const row = [...app.querySelectorAll("#w8sched .day-row")].find(r => r.dataset.day === day);
    const action = row?.querySelector(".day-input")?.value.trim();
    const time = row?.querySelector(".day-time")?.value || "09:00";
    if (!action) return toast("אין פעולה ליום זה");
    S.setToolData(8, "schedule", collectSchedule());
    window.open(googleEventUrl({ day, time: time || "09:00", activity: action }), "_blank", "noopener");
    toast(`נפתח יומן Google ליום ${day} — אשר את השמירה ✓`);
  }));
  const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const si = app.querySelector("#schedIcs");
  if (si) si.addEventListener("click", () => {
    const email = (app.querySelector("#schedEmail").value || "").trim();
    if (!validEmail(email)) return toast("הזן כתובת מייל תקינה");
    const plan = collectSchedule();
    const events = Object.entries(plan).map(([day, v]) => ({ day, time: v.time || "09:00", activity: v.action }));
    if (!events.length) return toast("הוסף לפחות פעולה אחת");
    S.setToolData(8, "schedule", plan); S.setReminders({ email, enabled: true });
    downloadWeeklyICS({ events, email });
    toast(`קובץ עם ${events.length} ימים ירד — פתח אותו כדי להוסיף ליומן ✓`);
  });
}

function stashWeek8Drafts() {
  if (app.querySelectorAll(".val-input").length)
    S.setToolData(8, "values", [...app.querySelectorAll(".val-input")].map(i => i.value.trim()));
  if (app.querySelectorAll(".realize-way").length) {
    const realize = {};
    app.querySelectorAll(".realize-way").forEach(inp => {
      const v = inp.dataset.val; realize[v] = realize[v] || ["", "", ""]; realize[v][+inp.dataset.w] = inp.value.trim();
    });
    S.setToolData(8, "realize", realize);
  }
  if (app.querySelectorAll("#w8sched .day-row").length) S.setToolData(8, "schedule", collectSchedule());
}

function openSchedulePrint(plan) {
  const st = S.getState();
  const today = new Date().toLocaleDateString("he-IL");
  const rows = WEEK_DAYS.map(day => {
    const c = plan[day] || {};
    return `<tr><td class="d">${day}</td><td class="t">${esc(c.time || "")}</td><td>${esc(c.action || "")}</td><td class="c"></td></tr>`;
  }).join("");
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
    <title>לוח הגשמת ערכים — שבוע 8</title>
    <style>
      body{font-family:"Segoe UI",Arial,sans-serif;color:#20353a;padding:28px;max-width:720px;margin:auto}
      h1{color:#0f766e;margin:0 0 4px}.sub{color:#6a8189;margin:0 0 16px}
      .meta{display:flex;gap:24px;color:#6a8189;font-size:13px;margin-bottom:14px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #cfe0dc;padding:10px;text-align:right;font-size:14px}
      th{background:#eefaf6;color:#0f766e} td.d{font-weight:700;width:80px;background:#f6fbfa}
      td.t{width:64px;text-align:center;color:#0f766e;font-weight:700} td.c{width:60px}
      .btn{background:#0f766e;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:15px;cursor:pointer;margin-top:16px}
      @media print{.noprint{display:none}}
    </style></head><body>
    <h1>לוח הגשמת ערכים</h1>
    <p class="sub">מסע 8 השבועות · שבוע 8 — פעולה מבוססת ערך</p>
    <div class="meta"><span>שם: ${esc(st.name) || "________"}</span><span>תאריך: ${today}</span></div>
    <table><thead><tr><th>יום</th><th>שעה</th><th>הפעולה להגשמת הערך</th><th>בוצע</th></tr></thead><tbody>${rows}</tbody></table>
    <button class="btn noprint" onclick="window.print()">הדפסה / שמירה כ-PDF</button>
    <script>setTimeout(()=>window.print(),400)<\/script>
    </body></html>`;
  const w = window.open("", "_blank");
  if (!w) { toast("אפשר חלונות קופצים כדי להוריד"); return; }
  w.document.write(html); w.document.close();
}

function mountToolHandlers(c) {
  const t = c.tool.type;
  if (t === "emotion-intention") {
    mountWeek1Handlers();
  } else if (t === "cycle-journal") {
    mountWeek2Handlers();
  } else if (t === "depth-process") {
    mountWeek3Handlers();
  } else if (t === "interoceptive-timer") {
    mountWeek4Handlers();
  } else if (t === "thought-replace") {
    mountWeek5Handlers();
  } else if (t === "worry-date") {
    mountWeek6Handlers();
  } else if (t === "fear-ladder") {
    mountWeek7Handlers();
  } else if (t === "value-action") {
    mountWeek8Handlers();
  } else {
    const sf = app.querySelector("#saveFree");
    if (sf) sf.addEventListener("click", () => {
      const v = app.querySelector("#freeNote").value.trim();
      if (!v) return;
      S.saveToolEntry(c.week, "free", { text: v });
      S.logActivity("exercise", `שבוע ${c.week}`);
      renderChapter(c.week);
    });
  }
}

// --- מאזיני שבוע 1 ---
function mountWeek1Handlers() {
  // מעבר בין תתי-כלים — שומר טיוטות שדות טקסט לפני מעבר
  app.querySelectorAll("[data-w1tab]").forEach(b =>
    b.addEventListener("click", () => {
      stashWeek1Drafts();
      week1Tab = b.dataset.w1tab;
      renderChapter(1);
    }));

  // חלק 1 — רגש
  app.querySelectorAll("[data-emotion]").forEach(b =>
    b.addEventListener("click", () => { S.setEmotion(b.dataset.emotion); renderChapter(1); }));
  app.querySelectorAll("[data-alt]").forEach(b =>
    b.addEventListener("click", () => { S.setEmotionTarget(b.dataset.alt); renderChapter(1); }));
  const rate = app.querySelector("#rate");
  if (rate) rate.addEventListener("input", () => app.querySelector("#rateVal").textContent = rate.value);
  const lr = app.querySelector("#logRate");
  if (lr) lr.addEventListener("click", () => { S.logEmotionRating(app.querySelector("#rate").value); renderChapter(1); });

  // חלק 2 — דיקנס
  const sd = app.querySelector("#saveDickens");
  if (sd) sd.addEventListener("click", () => {
    const data = {};
    app.querySelectorAll(".d-field").forEach(f => data[f.dataset.d] = f.value.trim());
    S.setToolData(1, "dickens", data);
    if (Object.values(data).some(Boolean)) S.logActivity("exercise", "תרגיל דיקנס");
    toast("נשמר ✓");
    renderChapter(1);
  });

  // חלק 3 — יומן פעילות
  app.querySelectorAll("[data-activity]").forEach(b =>
    b.addEventListener("click", () => {
      const inputs = [...app.querySelectorAll(".day-input")];
      let target = inputs.find(i => !i.value.trim()) || inputs[inputs.length - 1];
      if (target) {
        target.value = target.value ? target.value + ", " + b.dataset.activity : b.dataset.activity;
        target.focus();
      }
    }));
  const sp = app.querySelector("#savePlan");
  if (sp) sp.addEventListener("click", () => {
    S.setToolData(1, "activityPlan", collectPlan());
    S.logActivity("joy", "יומן פעילות");
    toast("היומן נשמר ✓");
    renderChapter(1);
  });
  const pp = app.querySelector("#pdfPlan");
  if (pp) pp.addEventListener("click", () => { S.setToolData(1, "activityPlan", collectPlan()); openPrintJournal(); });

  // הוספה ישירה ליומן Google — קריאת השורה העדכנית ופתיחת האירוע
  app.querySelectorAll(".gcal-link").forEach(b =>
    b.addEventListener("click", () => {
      const day = b.dataset.gday;
      const row = [...app.querySelectorAll(".day-row")].find(r => r.dataset.day === day);
      const activity = row?.querySelector(".day-input")?.value.trim();
      const time = row?.querySelector(".day-time")?.value || "09:00";
      if (!activity) return toast("אין פעילות ליום זה");
      S.setToolData(1, "activityPlan", collectPlan());
      window.open(googleEventUrl({ day, time: time || "09:00", activity }), "_blank", "noopener");
      toast(`נפתח יומן Google ליום ${day} — אשר את השמירה ✓`);
    }));

  // חיבור כל השבוע ליומן דרך מייל
  const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const cw = app.querySelector("#calWeek");
  if (cw) cw.addEventListener("click", () => {
    const email = (app.querySelector("#calEmail")?.value || "").trim();
    if (!validEmail(email)) return toast("הזן כתובת מייל תקינה");
    const plan = collectPlan();
    const events = Object.entries(plan).map(([day, v]) => ({
      day, time: v.time || "09:00", activity: v.activity,
    }));
    if (!events.length) return toast("הוסף לפחות פעילות אחת לטבלה");
    S.setToolData(1, "activityPlan", plan);
    S.setReminders({ email, enabled: true });
    downloadWeeklyICS({ events, email });
    toast(`קובץ עם ${events.length} ימים ירד — פתח אותו כדי להוסיף ליומן ✓`);
    renderChapter(1);
  });
}

function collectPlan() {
  const plan = {};
  app.querySelectorAll(".day-row").forEach(row => {
    const day = row.dataset.day;
    const activity = row.querySelector(".day-input")?.value.trim();
    const time = row.querySelector(".day-time")?.value || "";
    if (activity) plan[day] = { time, activity };
  });
  return plan;
}

// שמירת טיוטות בזמן מעבר בין תתי-הכלים של שבוע 1
function stashWeek1Drafts() {
  const dFields = app.querySelectorAll(".d-field");
  if (dFields.length) {
    const data = {};
    dFields.forEach(f => data[f.dataset.d] = f.value.trim());
    if (Object.values(data).some(Boolean)) S.setToolData(1, "dickens", data);
  }
  const dayInputs = app.querySelectorAll(".day-input");
  if (dayInputs.length) S.setToolData(1, "activityPlan", collectPlan());
}

// יצירת יומן להדפסה / שמירה כ-PDF (דרך מנוע ההדפסה של הדפדפן — תומך עברית)
function openPrintJournal() {
  const st = S.getState();
  const plan = S.getToolData(1, "activityPlan") || {};
  const d = S.getToolData(1, "dickens") || {};
  const today = new Date().toLocaleDateString("he-IL");
  const rows = WEEK_DAYS.map(day => {
    const cell = plan[day];
    const activity = cell ? (typeof cell === "string" ? cell : (cell.activity || "")) : "";
    const time = cell && typeof cell === "object" ? (cell.time || "") : "";
    return `<tr><td class="d">${day}</td><td class="t">${esc(time)}</td><td>${esc(activity)}</td><td class="c"></td></tr>`;
  }).join("");

  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
    <title>יומן פעילות שבועי — שבוע 1</title>
    <style>
      body{font-family:"Segoe UI",Arial,sans-serif;color:#20353a;padding:32px;max-width:720px;margin:auto}
      h1{color:#0f766e;margin:0 0 4px} .sub{color:#6a8189;margin:0 0 20px}
      .box{border:1px solid #cfe0dc;border-radius:12px;padding:14px 16px;margin-bottom:16px}
      .box h3{margin:0 0 6px;color:#0f766e;font-size:15px}
      table{width:100%;border-collapse:collapse;margin-top:6px}
      th,td{border:1px solid #cfe0dc;padding:10px;text-align:right;font-size:14px}
      th{background:#eefaf6;color:#0f766e} td.d{font-weight:700;width:80px;background:#f6fbfa}
      td.t{width:64px;text-align:center;color:#0f766e;font-weight:700}
      td.c{width:60px} .meta{display:flex;gap:24px;color:#6a8189;font-size:13px;margin-bottom:16px}
      @media print{.noprint{display:none}}
      .btn{background:#0f766e;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:15px;cursor:pointer}
    </style></head><body>
    <h1>יומן פעילות שבועי</h1>
    <p class="sub">מסע 8 השבועות · שבוע 1 — אקטיבציה מבוססת ערכים ועונג</p>
    <div class="meta"><span>שם: ${esc(st.name) || "________"}</span><span>תאריך: ${today}</span></div>
    ${st.emotion.name ? `<div class="box"><h3>הרגש שאני עובד עליו</h3>
      ${esc(st.emotion.name)}${st.emotion.target ? " → יעד: " + esc(st.emotion.target) : ""}
      ${lastRating(st) != null ? " · עוצמה נוכחית: " + lastRating(st) + "/10" : ""}</div>` : ""}
    ${d.identity ? `<div class="box"><h3>מי אני רוצה להיות</h3>${esc(d.identity).replace(/\n/g, "<br>")}</div>` : ""}
    <div class="box"><h3>הפעילויות שלי לשבוע</h3>
      <table><thead><tr><th>יום</th><th>שעה</th><th>פעילות מהנה</th><th>בוצע</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <button class="btn noprint" onclick="window.print()">הדפסה / שמירה כ-PDF</button>
    <script>setTimeout(()=>window.print(),400)<\/script>
    </body></html>`;

  const w = window.open("", "_blank");
  if (!w) { toast("אפשר חלונות קופצים כדי להוריד PDF"); return; }
  w.document.write(html);
  w.document.close();
}

function miniLog(week, tool) {
  return S.getToolEntries(week, tool).map(e => `<div class="log-line">📝 ${esc(e.text || "")}</div>`).join("");
}
function lastRating(st) {
  const r = st.emotion.ratings; return r.length ? r[r.length - 1].value : null;
}

// ============================================================
//  מאמן AI
// ============================================================
let coachTool = "alt-thoughts";
let coachThreads = {}; // toolId -> messages

function renderCoach() {
  const st = S.getState();
  const prompts = st.aiPrompts;
  const thread = coachThreads[coachTool] || [];

  app.innerHTML = `
    <header class="topbar"><div><div class="greeting">💬 המאמן שלך</div>
      <div class="subtle">${st.apiKey ? "מחובר ל-Claude" : "מצב הדגמה — ללא מפתח API"}</div></div></header>

    <div class="tool-tabs">
      ${Object.entries(prompts).map(([id, t]) => `
        <button class="tool-tab ${coachTool === id ? "on" : ""}" data-tool="${id}">
          ${t.icon} ${t.name}</button>`).join("")}
    </div>

    <div class="chat" id="chat">
      ${thread.length ? thread.map(m => chatBubble(m)).join("")
        : `<div class="chat-empty">${prompts[coachTool].icon} כתוב הודעה כדי להתחיל.<br>
           <span class="subtle">${esc(prompts[coachTool].name)}</span></div>`}
    </div>

    <div class="chat-input">
      <textarea id="msg" class="ta" rows="2" placeholder="כתוב כאן..."></textarea>
      <button class="btn send" id="send">שלח</button>
    </div>
  `;

  app.querySelectorAll(".tool-tab").forEach(b =>
    b.addEventListener("click", () => { coachTool = b.dataset.tool; renderCoach(); }));

  app.querySelector("#send").addEventListener("click", sendMsg);
  app.querySelector("#msg").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  });
}

function chatBubble(m) {
  return `<div class="bubble ${m.role}">${esc(m.content).replace(/\n/g, "<br>")}</div>`;
}

async function sendMsg() {
  const input = app.querySelector("#msg");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  coachThreads[coachTool] = coachThreads[coachTool] || [];
  coachThreads[coachTool].push({ role: "user", content: text });
  renderCoach();

  const chat = app.querySelector("#chat");
  chat.innerHTML += `<div class="bubble assistant typing">מקליד…</div>`;
  chat.scrollTop = chat.scrollHeight;

  const sys = S.getState().aiPrompts[coachTool].prompt;
  const reply = await askAI(sys, coachThreads[coachTool]);
  coachThreads[coachTool].push({ role: "assistant", content: reply });
  S.logActivity("thought", "שיחה עם המאמן");
  renderCoach();
  const c2 = app.querySelector("#chat"); c2.scrollTop = c2.scrollHeight;
}

// ============================================================
//  מסך ניהול / הגדרות
// ============================================================
function renderSettings() {
  const st = S.getState();
  app.innerHTML = `
    <header class="topbar"><div><div class="greeting">⚙️ ניהול והגדרות</div>
      <div class="subtle">אזור המנחה</div></div></header>

    <section class="card">
      <h3>👤 פרטים</h3>
      <label class="field">שם המשתתף
        <input id="setName" class="inp" value="${esc(st.name)}" placeholder="שם">
      </label>
    </section>

    <section class="card">
      <h3>🔑 מפתח Claude API</h3>
      <p class="subtle">להפעלת תשובות אמיתיות במאמן ה-AI. נשמר מקומית במכשיר בלבד.</p>
      <input id="setKey" class="inp" type="password" value="${esc(st.apiKey)}" placeholder="sk-ant-...">
      <button class="btn" id="saveKey">שמירה</button>
    </section>

    <section class="card">
      <h3>🧠 הוראות לכלי ה-AI</h3>
      <p class="subtle">כאן אתה מזין מראש איך כל כלי יתנהג. זו ה"אישיות" של המאמן.</p>
      ${Object.entries(st.aiPrompts).map(([id, t]) => `
        <div class="prompt-edit">
          <label class="field">${t.icon} ${t.name}
            <textarea class="ta prompt-ta" data-prompt="${id}" rows="4">${esc(t.prompt)}</textarea>
          </label>
        </div>`).join("")}
      <button class="btn" id="savePrompts">שמירת ההוראות</button>
    </section>

    <section class="card">
      <h3>🎧 משאבי מדיטציה (שבוע 2)</h3>
      <p class="subtle">קישור וקובץ לכל מדיטציה — ניתן להחליף בכל עת. הקובץ יכול להיות נתיב מקומי
        (למשל resources/autogenic.pdf) או כתובת אינטרנט מלאה.</p>
      ${S.getMeditations().map(m => `
        <div class="med-edit">
          <div class="field">${m.icon || "🎧"} ${esc(m.name)}${m.note ? ` <span class="tiny-note">(${esc(m.note)})</span>` : ""}</div>
          <input class="inp med-field" data-med="${m.id}" data-field="link" dir="ltr" value="${esc(m.link || "")}" placeholder="קישור (YouTube / URL)">
          <input class="inp med-field" data-med="${m.id}" data-field="file" dir="ltr" value="${esc(m.file || "")}" placeholder="קובץ (נתיב או URL)">
        </div>`).join("")}
      <button class="btn" id="saveMeds">שמירת המשאבים</button>
    </section>

    <section class="card">
      <h3>🎥 סרטון (הקלטה) לכל פרק</h3>
      <p class="subtle">הדבק קישור YouTube / Drive / וידאו לכל שבוע. יוצג בראש הפרק.</p>
      ${COURSE.chapters.map(c => `
        <label class="field">שבוע ${c.week} — ${esc(c.title)}
          <input class="inp vid-field" data-week="${c.week}" dir="ltr" value="${esc(S.getChapterVideo(c.week))}" placeholder="https://youtu.be/...">
        </label>`).join("")}
      <button class="btn" id="saveVideos">שמירת הסרטונים</button>
    </section>

    <section class="card">
      <h3>🎧 ספריית מדיטציות לפי נושאים</h3>
      <p class="subtle">בנה ספרייה לפי נושאים (למשל "להירדם מהר", "להרגיע התקף"), ובכל נושא מדיטציות עם קישור/קובץ.</p>
      <div id="libEditor">${renderLibEditor()}</div>
      <div class="ext-form" style="margin-top:10px">
        <input id="newTopic" class="inp" placeholder="שם נושא חדש (למשל: להירדם מהר)">
        <button class="btn" id="addTopic">＋ הוספת נושא</button>
      </div>
    </section>

    <section class="card">
      <h3>🔔 תזכורות לנייד</h3>
      <label class="switch-row">
        <span>תזכורת יומית</span>
        <input type="checkbox" id="remOn" ${st.reminders.enabled ? "checked" : ""}>
      </label>
      <label class="field">שעה
        <input type="time" id="remTime" class="inp" value="${st.reminders.time}">
      </label>
      <button class="btn" id="saveRem">הפעלה + בקשת הרשאה</button>
    </section>

    <section class="card">
      <h3>🔗 חיבור כלים חיצוניים לפרק</h3>
      <p class="subtle">קשר כלי דיגיטלי שכבר בנית (תנועות עיניים וכו') לשבוע רלוונטי.</p>
      <div class="ext-form">
        <select id="extWeek" class="inp">
          ${COURSE.chapters.map(c => `<option value="${c.week}">שבוע ${c.week} — ${c.title}</option>`).join("")}
        </select>
        <input id="extName" class="inp" placeholder="שם הכלי">
        <input id="extUrl" class="inp" placeholder="קישור (https://...)">
        <button class="btn" id="addExt">הוספה</button>
      </div>
    </section>

    <section class="card danger">
      <h3>איפוס</h3>
      <button class="btn ghost" id="reset">איפוס כל הנתונים במכשיר</button>
    </section>
  `;

  app.querySelector("#setName").addEventListener("change", e => S.setName(e.target.value.trim()));
  app.querySelector("#saveKey").addEventListener("click", () => {
    S.setApiKey(app.querySelector("#setKey").value.trim()); toast("המפתח נשמר");
  });
  app.querySelector("#savePrompts").addEventListener("click", () => {
    app.querySelectorAll("[data-prompt]").forEach(ta => S.setAiPrompt(ta.dataset.prompt, ta.value));
    toast("ההוראות נשמרו");
  });
  app.querySelector("#saveMeds").addEventListener("click", () => {
    app.querySelectorAll(".med-field").forEach(inp =>
      S.setMeditationField(inp.dataset.med, inp.dataset.field, inp.value.trim()));
    toast("משאבי המדיטציה נשמרו");
  });

  // סרטונים לכל פרק
  app.querySelector("#saveVideos").addEventListener("click", () => {
    app.querySelectorAll(".vid-field").forEach(i => S.setChapterVideo(i.dataset.week, i.value.trim()));
    toast("הסרטונים נשמרו");
  });

  // ספריית מדיטציות
  app.querySelector("#addTopic").addEventListener("click", () => {
    const name = app.querySelector("#newTopic").value.trim();
    if (!name) return toast("הזן שם נושא");
    S.addMedTopic(name); renderSettings();
  });
  app.querySelectorAll(".del-topic").forEach(b => b.addEventListener("click", () => {
    if (confirm("למחוק את הנושא וכל המדיטציות שבו?")) { S.deleteMedTopic(+b.dataset.ti); renderSettings(); }
  }));
  app.querySelectorAll(".add-item").forEach(b => b.addEventListener("click", () => {
    S.addMedItem(+b.dataset.ti); renderSettings();
  }));
  app.querySelectorAll(".del-item").forEach(b => b.addEventListener("click", () => {
    S.deleteMedItem(+b.dataset.ti, +b.dataset.ii); renderSettings();
  }));
  app.querySelectorAll(".lib-field").forEach(inp => inp.addEventListener("change", () =>
    S.updateMedItem(+inp.dataset.ti, +inp.dataset.ii, inp.dataset.f, inp.value.trim())));

  app.querySelector("#saveRem").addEventListener("click", async () => {
    const enabled = app.querySelector("#remOn").checked;
    const time = app.querySelector("#remTime").value;
    if (enabled) {
      const p = await requestPermission();
      if (p !== "granted") { toast("נדרשת הרשאת התראות"); }
    }
    S.setReminders({ enabled, time });
    startReminderLoop();
    toast("התזכורות עודכנו");
  });
  app.querySelector("#addExt").addEventListener("click", () => {
    const week = app.querySelector("#extWeek").value;
    const name = app.querySelector("#extName").value.trim();
    const url = app.querySelector("#extUrl").value.trim();
    if (!name || !url) return toast("מלא שם וקישור");
    S.addExternalTool(week, { name, url });
    app.querySelector("#extName").value = ""; app.querySelector("#extUrl").value = "";
    toast("הכלי חובר לשבוע " + week);
  });
  app.querySelector("#reset").addEventListener("click", () => {
    if (confirm("לאפס את כל ההתקדמות? אין חזרה.")) { S.resetAll(); go("home"); }
  });
}

// ============================================================
//  עזרי תצוגה
// ============================================================
// המרת קישור וידאו להטמעה (YouTube) או נגן/קישור
function ytEmbed(url) {
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return m ? "https://www.youtube.com/embed/" + m[1] : null;
}
function videoEmbed(url) {
  const yt = ytEmbed(url);
  if (yt) return `<div class="video-frame"><iframe src="${yt}" allowfullscreen loading="lazy"
    referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url)) return `<video class="video-el" src="${esc(url)}" controls preload="metadata"></video>`;
  return `<a class="btn ghost2" href="${esc(url)}" target="_blank" rel="noopener">▶ צפייה בהקלטה</a>`;
}

// ============================================================
//  ספריית מדיטציות לפי נושאים
// ============================================================
function renderLibrary() {
  const lib = S.getMedLibrary();
  const hasAny = lib.some(t => t.items.length);
  app.innerHTML = `
    <header class="topbar"><div><div class="greeting">🎧 ספריית מדיטציות</div>
      <div class="subtle">לפי נושאים</div></div></header>
    ${!lib.length ? `<div class="card"><p class="subtle">עדיין אין נושאים. אפשר להוסיף במסך הניהול.</p></div>` : ""}
    ${lib.map(t => `
      <section class="card">
        <h3>${esc(t.topic)}</h3>
        ${t.items.length ? t.items.map(m => `
          <div class="med-item">
            <div class="med-name">🎧 ${esc(m.name || "מדיטציה")}</div>
            ${m.link || m.file ? `<div class="med-actions">
              ${m.link ? `<a class="btn ghost2" href="${esc(m.link)}" target="_blank" rel="noopener">▶ האזנה / צפייה</a>` : ""}
              ${m.file ? `<a class="btn ghost2" href="${esc(m.file)}" target="_blank" rel="noopener">⬇ קובץ</a>` : ""}
            </div>` : `<div class="tiny-note">טרם הוגדר קישור.</div>`}
          </div>`).join("") : `<p class="subtle">אין עדיין מדיטציות בנושא זה.</p>`}
      </section>`).join("")}
    ${lib.length && !hasAny ? `<p class="tools-note">הוסף מדיטציות לנושאים במסך הניהול ⚙️</p>` : ""}
  `;
}

function renderLibEditor() {
  const lib = S.getMedLibrary();
  if (!lib.length) return `<p class="subtle">אין נושאים עדיין.</p>`;
  return lib.map((t, ti) => `
    <div class="lib-topic" data-ti="${ti}">
      <div class="lib-topic-head"><b>${esc(t.topic)}</b>
        <button class="link-btn del-topic" data-ti="${ti}">מחיקת נושא ✕</button></div>
      ${t.items.map((m, ii) => `
        <div class="lib-item">
          <input class="inp lib-field" data-ti="${ti}" data-ii="${ii}" data-f="name" value="${esc(m.name)}" placeholder="שם המדיטציה">
          <input class="inp lib-field" data-ti="${ti}" data-ii="${ii}" data-f="link" dir="ltr" value="${esc(m.link)}" placeholder="קישור (URL)">
          <input class="inp lib-field" data-ti="${ti}" data-ii="${ii}" data-f="file" dir="ltr" value="${esc(m.file)}" placeholder="קובץ (URL)">
          <button class="link-btn del-item" data-ti="${ti}" data-ii="${ii}">מחיקת מדיטציה</button>
        </div>`).join("")}
      <button class="btn ghost2 add-item" data-ti="${ti}">＋ הוספת מדיטציה לנושא</button>
    </div>`).join("");
}

function esc(s = "") {
  return String(s).replace(/[&<>"']/g, m =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function renderSparkline(ratings) {
  if (!ratings.length) return "";
  const vals = ratings.map(r => r.value);
  const w = 260, h = 60, pad = 6;
  const max = 10, min = 0;
  const step = vals.length > 1 ? (w - pad * 2) / (vals.length - 1) : 0;
  const pts = vals.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (1 - (v - min) / (max - min)) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `
    <svg class="spark" viewBox="0 0 ${w} ${h}">
      <polyline points="${pts.join(" ")}" fill="none" stroke="var(--teal)" stroke-width="3"
        stroke-linecap="round" stroke-linejoin="round"/>
      ${pts.map(p => { const [x, y] = p.split(","); return `<circle cx="${x}" cy="${y}" r="3.5" fill="var(--teal)"/>`; }).join("")}
    </svg>`;
}

function burst(el) {
  el.classList.add("burst");
  setTimeout(() => el.classList.remove("burst"), 400);
}

let toastTimer;
function toast(msg) {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

// ============================================================
//  מעקב זמן עבודה — נצבר כל עוד הדף פתוח וגלוי
// ============================================================
function fmtHM(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}
let lastTick = Date.now();
function flushWorkTime() {
  const now = Date.now();
  const elapsed = Math.round((now - lastTick) / 1000);
  lastTick = now;
  if (elapsed > 0 && elapsed < 120) S.addWorkTime(elapsed); // מתעלם מפערים גדולים (שינה/רקע)
}
function updateWorkClock() {
  const el = document.getElementById("workClock");
  if (el) el.textContent = fmtHM(S.getWeekWorkTime());
}
function startTimeTracker() {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flushWorkTime(); else lastTick = Date.now();
  });
  window.addEventListener("beforeunload", flushWorkTime);
  setInterval(() => { if (!document.hidden) flushWorkTime(); updateWorkClock(); }, 15000);
}

// ============================================================
//  אתחול
// ============================================================
window.addEventListener("state:changed", () => { /* עתידי: סנכרון */ });
startReminderLoop();
startTimeTracker();
render();
