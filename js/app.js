// ============================================================
//  מסע 8 השבועות — לוגיקת האפליקציה והמסכים
// ============================================================
import { COURSE, ACTIVITY_TYPES, EMOTION_ALTERNATIVES, ALT_EMOTION_POOL,
         PLEASANT_ACTIVITIES, WEEK_DAYS, CYCLE_STAGES, NLP_REFRAME_STEPS,
         WEEK4_SENSATIONS, INTEROCEPTIVE_EXPOSURES, INTERO_LEVELS, INTERO_DISCLAIMER, INTERO_ACK_LABEL,
         DISTORTIONS, THOUGHT_TABLE_COLS,
         EXPOSURE_EMOTIONS, EXPOSURE_RULES, EXPOSURE_EXAMPLES, IMAGINAL_STEPS,
         VALUES_SUGGESTIONS, COMMUNICATION_PRINCIPLES, ASSERTIVENESS_STEPS, DAILY_PRACTICES,
         BREATH_PATTERNS, BADGES, CALMING_PHRASES, GROUNDING_STEPS, HOTLINES, GOAL_TOOL,
         CENTRAL_QUESTION, WEEK_FRAMING, METHODS_SUBTEXT } from "./data.js";
import * as S from "./state.js";
import { renderAvatar, avatarMessage } from "./avatar.js";
import { askAI } from "./ai.js";
import { requestPermission, startReminderLoop } from "./reminders.js";
import { downloadWeeklyICS, googleEventUrl, downloadDailyICS, googleDailyUrl } from "./calendar.js";

const app = document.getElementById("view");
const navEl = document.getElementById("nav");

let route = "home";
let routeParam = null;

// לשון פנייה לפי מגדר: G("זכר","נקבה")
function G(m, f) { return S.getGender() === "f" ? f : m; }

function go(r, param = null) {
  // יציאה ממסך הניהול נועלת אותו מחדש (אם הוגדר קוד) — כניסה חוזרת תדרוש קוד
  if (r !== "settings" && route === "settings") adminUnlocked = false;
  route = r; routeParam = param;
  window.scrollTo(0, 0);
  render();
}
window.__go = go;

// ============================================================
//  ניווט תחתון
// ============================================================
// אייקוני קו נקיים (SVG) — stroke=currentColor כדי לרשת את צבע המצב הפעיל
const SVG = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const NAV_ICON = {
  home:     SVG('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>'),
  chapters: SVG('<path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z"/><path d="M9 4v13M15 6.5v13"/>'),
  library:  SVG('<path d="M4 13a8 8 0 0 1 16 0"/><rect x="3" y="13" width="4" height="7.5" rx="1.6"/><rect x="17" y="13" width="4" height="7.5" rx="1.6"/>'),
  coach:    SVG('<path d="M21 11.5a7.5 7.5 0 0 1-10.9 6.7L4 19.5l1.3-4.2A7.5 7.5 0 1 1 21 11.5z"/>'),
};
// "ניהול" הוסר מהתפריט — גישה למנחה בלבד דרך לחיצה ארוכה על הכותרת בבית או #admin
const NAV = [
  { id: "home",     label: "בית" },
  { id: "chapters", label: "המסע" },
  { id: "library",  label: "מדיטציות" },
  { id: "coach",    label: "מאמן AI" },
];
let adminUnlocked = false;
// "מנחה" = נכנס עם קוד, או שעדיין לא הוגדר קוד נעילה
function isManager() { return adminUnlocked || !S.getAdminPin(); }

function renderNav() {
  navEl.innerHTML = NAV.map(n => `
    <button class="nav-btn ${route === n.id ? "active" : ""}" data-route="${n.id}">
      <span class="nav-ico">${NAV_ICON[n.id]}</span><span>${n.label}</span>
    </button>`).join("");
  navEl.querySelectorAll(".nav-btn").forEach(b =>
    b.addEventListener("click", () => go(b.dataset.route)));
}

// ============================================================
//  ראוטר
// ============================================================
function render() {
  updateSOSVisibility();
  if (!S.isOnboarded()) { navEl.innerHTML = ""; return renderOnboarding(); }
  renderNav();
  if (route === "home") return renderHome();
  if (route === "chapters") return renderChapters();
  if (route === "chapter") return renderChapter(routeParam);
  if (route === "library") return renderLibrary();
  if (route === "coach") return renderCoach();
  if (route === "settings") return (S.getAdminPin() && !adminUnlocked) ? renderPinGate() : renderSettings();
  if (route === "achievements") return renderAchievements();
  if (route === "goal") return renderGoalTool();
}

// ============================================================
//  כלי הגדרת מטרה (מודל דיסני + NLP)
// ============================================================
function goalField(f, plan) {
  const val = plan[f.key];
  if (f.type === "rating") {
    const v = val ?? 5;
    return `<div class="goal-field"><label class="mini-label">${f.label}</label>
      <div class="rating-row"><input type="range" min="1" max="10" class="goal-input" data-k="${f.key}" data-t="rating" value="${v}">
      <span class="rate-val">${v}</span></div></div>`;
  }
  if (f.type === "checks") {
    return `<div class="goal-field"><label class="mini-label">${f.label}</label>
      <div class="chip-row">${f.options.map(o =>
        `<label class="check-chip"><input type="checkbox" class="goal-check" data-k="${f.key}" value="${esc(o)}" ${Array.isArray(val) && val.includes(o) ? "checked" : ""}> ${esc(o)}</label>`).join("")}</div></div>`;
  }
  if (f.type === "anchor") {
    return `<div class="goal-anchor"><p>${f.label}</p>
      <button class="btn ghost2" id="goalBreath">🫁 נשימה מודרכת</button></div>`;
  }
  if (f.type === "text") {
    return `<div class="goal-field"><label class="mini-label">${f.label}</label>
      <input class="inp goal-input" data-k="${f.key}" data-t="text" value="${esc(val || "")}" placeholder="${esc(f.ph || "")}"></div>`;
  }
  return `<div class="goal-field"><label class="mini-label">${f.label}</label>
    <textarea class="ta goal-input" data-k="${f.key}" data-t="area" placeholder="${esc(f.ph || "")}">${esc(val || "")}</textarea></div>`;
}

function renderGoalTool() {
  const plan = S.getGoalPlan();
  app.innerHTML = `
    <header class="topbar chapter-head">
      <button class="back-btn" id="back">›</button>
      <div><div class="greeting">🎯 הגדרת המטרה</div><div class="subtle">מודל דיסני · NLP</div></div>
    </header>
    <section class="card"><p class="hint">${GOAL_TOOL.intro}</p></section>
    ${GOAL_TOOL.sections.map((s, si) => `
      <section class="card goal-section">
        <h3>${si + 1}. ${esc(s.title)}</h3>
        ${s.note ? `<p class="subtle goal-note">${esc(s.note)}</p>` : ""}
        ${s.fields.map(f => goalField(f, plan)).join("")}
      </section>`).join("")}
    <div class="activation-actions">
      <button class="btn" id="saveGoal">שמירת המטרה</button>
      <button class="btn ghost2" id="pdfGoal">⬇ הורדת המטרה כ-PDF</button>
    </div>
    <div class="chapter-footer"><button class="btn ghost2 back-all" id="backHome">↩ חזרה לבית</button></div>`;

  app.querySelector("#back").addEventListener("click", () => go("home"));
  app.querySelector("#backHome").addEventListener("click", () => go("home"));
  app.querySelectorAll("input[type=range].goal-input").forEach(r =>
    r.addEventListener("input", () => r.nextElementSibling.textContent = r.value));
  const gb = app.querySelector("#goalBreath");
  if (gb) gb.addEventListener("click", () => openBreathingPlayer({ patternId: "478" }));
  app.querySelector("#saveGoal").addEventListener("click", () => {
    const p = collectGoal(); S.setGoalPlan(p);
    if (p.goal_precise) S.setGoal(p.goal_precise);
    S.logActivity("exercise", "הגדרת מטרה"); celebrate();
    toast("המטרה נשמרה ✓");
  });
  app.querySelector("#pdfGoal").addEventListener("click", () => { const p = collectGoal(); S.setGoalPlan(p); openGoalPrint(p); });
}

function collectGoal() {
  const plan = {};
  app.querySelectorAll(".goal-input").forEach(el => {
    plan[el.dataset.k] = el.dataset.t === "rating" ? Number(el.value) : el.value.trim();
  });
  app.querySelectorAll(".goal-check").forEach(c => {
    plan[c.dataset.k] = plan[c.dataset.k] || [];
    if (c.checked) plan[c.dataset.k].push(c.value);
  });
  return plan;
}

function openGoalPrint(plan) {
  const st = S.getState();
  const today = new Date().toLocaleDateString("he-IL");
  const body = GOAL_TOOL.sections.map(s => {
    const items = s.fields.filter(f => f.type !== "anchor").map(f => {
      let a = plan[f.key];
      if (Array.isArray(a)) a = a.join(", ");
      if (f.type === "rating" && a) a = a + "/10";
      return `<div class="q"><div class="ql">${esc(f.label)}</div><div class="qa">${esc(a || "").replace(/\n/g, "<br>") || "&nbsp;"}</div></div>`;
    }).join("");
    return `<h2>${esc(s.title)}</h2>${items}`;
  }).join("");
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
    <title>הגדרת המטרה — מסע 8 השבועות</title>
    <style>
      body{font-family:'Segoe UI',Arial,sans-serif;color:#20353a;padding:30px;max-width:760px;margin:auto}
      h1{color:#0f766e;margin:0 0 2px} .sub{color:#6a8189;margin:0 0 16px;font-size:13px}
      h2{color:#0f766e;font-size:16px;margin:20px 0 8px;border-bottom:2px solid #cfe0dc;padding-bottom:4px}
      .q{margin-bottom:12px} .ql{font-weight:700;font-size:13.5px;margin-bottom:4px}
      .qa{border:1px solid #cfe0dc;border-radius:8px;padding:9px 11px;min-height:34px;font-size:14px;background:#fbfdfc;line-height:1.5}
      .meta{display:flex;gap:24px;color:#6a8189;font-size:13px;margin-bottom:14px}
      .btn{background:#0f766e;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:15px;cursor:pointer;margin-top:18px}
      @media print{.noprint{display:none}}
    </style></head><body>
    <h1>הגדרת המטרה</h1>
    <p class="sub">מסע 8 השבועות · מודל דיסני ו-NLP</p>
    <div class="meta"><span>שם: ${esc(st.name) || "________"}</span><span>תאריך: ${today}</span></div>
    ${body}
    <button class="btn noprint" onclick="window.print()">הדפסה / שמירה כ-PDF</button>
    <script>setTimeout(()=>window.print(),400)<\/script>
    </body></html>`;
  const w = window.open("", "_blank");
  if (!w) { toast("אפשר חלונות קופצים כדי להוריד"); return; }
  w.document.write(html); w.document.close();
}

// שער קוד מנחה — מוצג כשמסך הניהול נעול
function renderPinGate() {
  app.innerHTML = `
    <header class="topbar chapter-head">
      <button class="back-btn" id="back">›</button>
      <div><div class="greeting">🔒 אזור מנחה</div><div class="subtle">נדרש קוד</div></div>
    </header>
    <section class="card" style="text-align:center">
      <div style="font-size:44px;margin-bottom:8px">🔒</div>
      <p class="subtle" style="margin-bottom:14px">הזן את קוד המנחה כדי להיכנס למסך הניהול.</p>
      <input class="inp" id="pinInput" type="password" inputmode="numeric" placeholder="קוד" style="text-align:center;letter-spacing:4px;max-width:200px;margin:0 auto 12px">
      <div><button class="btn" id="pinUnlock">כניסה</button></div>
    </section>`;
  app.querySelector("#back").addEventListener("click", () => go("home"));
  const tryUnlock = () => {
    const v = app.querySelector("#pinInput").value.trim();
    if (v && v === S.getAdminPin()) { adminUnlocked = true; renderSettings(); }
    else toast("קוד שגוי");
  };
  app.querySelector("#pinUnlock").addEventListener("click", tryUnlock);
  app.querySelector("#pinInput").addEventListener("keydown", e => { if (e.key === "Enter") tryUnlock(); });
}

// גישה למנחה: #admin או מחווה נסתרת
function openAdmin() { go("settings"); }
window.addEventListener("hashchange", () => { if (location.hash === "#admin") openAdmin(); });
if (location.hash === "#admin") setTimeout(openAdmin, 0);

// ============================================================
//  ערכת נושא (מצב כהה)
// ============================================================
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
}
function toggleTheme() {
  const next = S.getTheme() === "dark" ? "light" : "dark";
  S.setTheme(next); applyTheme(next); render();
}

// ============================================================
//  מסך קליטה (Onboarding) — כניסה ראשונה
// ============================================================
let onbStep = 0;
const onb = { name: "", gender: "m", emotion: "", otherMode: false, rating: 5, goal: "", breathDone: false, remind: false, remindTime: "09:00" };
const ONB_EMOTIONS = ["חרדה", "פחד", "בושה", "כעס", "עצב", "אשמה", "בדידות"];
const ONB_TOTAL = 1; // מסך כניסה מינימלי: שם + ברוך הבא בלבד

function captureOnb() {
  const n = app.querySelector("#onbName"); if (n) onb.name = n.value;
  const eo = app.querySelector("#onbEmotionOther"); if (eo) onb.emotion = eo.value.trim();
  const r = app.querySelector("#onbRate"); if (r) onb.rating = +r.value;
  const g = app.querySelector("#onbGoal"); if (g) onb.goal = g.value;
  const rt = app.querySelector("#onbRemindTime"); if (rt) onb.remindTime = rt.value;
  const rc = app.querySelector("#onbRemind"); if (rc) onb.remind = rc.checked;
}

// איורים רכים למסכי הקליטה (SVG מוטמע — עובד אופליין)
function onbArt(step) {
  const wrap = (inner) => `<div class="onb-art"><svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">${inner}</svg></div>`;
  if (step === 0) return wrap(`<circle cx="60" cy="60" r="52" fill="#eafaf5"/><circle cx="88" cy="40" r="11" fill="#e9b949"/>
    <path d="M40 88 h40" stroke="#0f766e" stroke-width="4" stroke-linecap="round"/>
    <path d="M60 88 V54" stroke="#0f766e" stroke-width="4" stroke-linecap="round"/>
    <path d="M60 66 C47 64 43 53 45 44 C56 46 62 55 60 66Z" fill="#84b59f"/>
    <path d="M60 60 C73 56 79 47 77 38 C66 40 60 49 60 60Z" fill="#14b8a6"/>`);
  if (step === 1) return wrap(`<circle cx="60" cy="60" r="52" fill="#fbeef0"/>
    <path d="M60 86 C39 71 33 58 41 49 C48 41 57 45 60 51 C63 45 72 41 79 49 C87 58 81 71 60 86Z" fill="#e07a5f"/>
    <path d="M40 62 h9 l4-9 6 16 5-10 3 3 h13" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
  if (step === 2) return wrap(`<circle cx="60" cy="60" r="52" fill="#eafaf5"/>
    <circle cx="60" cy="60" r="30" fill="none" stroke="#0f766e" stroke-width="4"/>
    <circle cx="60" cy="60" r="18" fill="none" stroke="#14b8a6" stroke-width="4"/>
    <circle cx="60" cy="60" r="6" fill="#e07a5f"/>`);
  if (step === 3) return wrap(`<circle cx="60" cy="60" r="52" fill="#eef3fb"/>
    <circle cx="60" cy="60" r="34" fill="none" stroke="#5b8def" stroke-width="3" opacity=".45"/>
    <circle cx="60" cy="60" r="24" fill="none" stroke="#14b8a6" stroke-width="3" opacity=".7"/>
    <circle cx="60" cy="60" r="13" fill="#14b8a6"/>`);
  return wrap(`<circle cx="60" cy="60" r="52" fill="#fff6e6"/>
    <path d="M60 34 c-10 0-16 8-16 18 v9 l-6 9 h44 l-6-9 v-9 c0-10-6-18-16-18Z" fill="#e9b949"/>
    <circle cx="60" cy="30" r="4" fill="#0f766e"/>
    <path d="M53 74 a7 7 0 0 0 14 0" fill="#0f766e"/>`);
}

function renderOnboarding() {
  const dots = ONB_TOTAL <= 1 ? "" : Array.from({ length: ONB_TOTAL }, (_, i) =>
    `<span class="onb-dot ${i === onbStep ? "on" : ""} ${i < onbStep ? "done" : ""}"></span>`).join("");
  let body = "";
  const emoOther = onb.otherMode || (!!onb.emotion && !ONB_EMOTIONS.includes(onb.emotion));
  if (onbStep === 0) body = `
    ${onbArt(0)}
    <h2>${onb.gender === "f" ? "ברוכה הבאה" : "ברוך הבא"} למסע 8 השבועות</h2>
    <p class="onb-sub">מהישרדות פנימית להנהגה עצמית. נתחיל בהיכרות קצרה.</p>
    <label class="onb-label">איך קוראים לך?</label>
    <input class="inp" id="onbName" placeholder="השם שלך" value="${esc(onb.name)}">
    <label class="onb-label">אני:</label>
    <div class="chip-row">
      <button class="chip ${onb.gender === "m" ? "on" : ""}" data-onbgender="m">זכר</button>
      <button class="chip ${onb.gender === "f" ? "on" : ""}" data-onbgender="f">נקבה</button>
    </div>
    <p class="onb-safety">כלי עזר ותמיכה — לא ${onb.gender === "f" ? "תחליף" : "תחליף"} לטיפול מקצועי. במצוקה חריפה: ער״ן 1201 · חירום 101.</p>`;
  if (onbStep === 1) body = `
    ${onbArt(1)}
    <h2>איזה רגש הכי מלווה אותך?</h2>
    <p class="onb-sub">נבחר רגש אחד לעבוד עליו לאורך המסע — ונראה אותו יורד עם הזמן.</p>
    <div class="chip-row">${ONB_EMOTIONS.map(e =>
      `<button class="chip ${onb.emotion === e ? "on" : ""}" data-onbemo="${e}">${e}</button>`).join("")}
      <button class="chip ${emoOther ? "on" : ""}" data-onbemo="__other__">אחר…</button></div>
    ${emoOther ? `<input class="inp" id="onbEmotionOther" placeholder="כתוב את הרגש שלך..." value="${esc(ONB_EMOTIONS.includes(onb.emotion) ? "" : (onb.emotion || ""))}">` : ""}
    <label class="onb-label">כמה חזק הוא עכשיו? (0–10)</label>
    <div class="rating-row"><input type="range" id="onbRate" min="0" max="10" value="${onb.rating}">
      <span class="rate-val" id="onbRateV">${onb.rating}</span></div>`;
  if (onbStep === 2) body = `
    ${onbArt(2)}
    <h2>מה תרצה שיהיה שונה?</h2>
    <p class="onb-sub">מטרה אחת קטנה למסע. אפשר גם לדלג ולחזור לזה מאוחר יותר.</p>
    <textarea class="ta" id="onbGoal" placeholder="למשל: לנסוע באוטובוס בלי חרדה, לישון טוב יותר...">${esc(onb.goal)}</textarea>`;
  if (onbStep === 3) body = `
    ${onbArt(3)}
    <h2>הניצחון הראשון שלך</h2>
    <p class="onb-sub">בוא נטען את האווטר בפעם הראשונה. קח נשימה אחת עמוקה ואיטית —
      שאיפה דרך האף, נשיפה ארוכה דרך הפה.</p>
    <button class="btn onb-breath ${onb.breathDone ? "done" : ""}" id="onbBreath">
      ${onb.breathDone ? "✓ נשמתי" : "נשמתי נשימה עמוקה"}</button>`;
  if (onbStep === 4) body = `
    ${onbArt(4)}
    <h2>רוצה תזכורת יומית קטנה?</h2>
    <p class="onb-sub">רגע ביום לצעד קטן שטוען את האווטר. אפשר לכבות בכל עת בהגדרות.</p>
    <label class="onb-check"><input type="checkbox" id="onbRemind" ${onb.remind ? "checked" : ""}> כן, הזכר לי כל יום</label>
    <label class="onb-label">באיזו שעה?</label>
    <input class="inp" id="onbRemindTime" type="time" value="${onb.remindTime}">`;

  const isLast = onbStep === ONB_TOTAL - 1;
  app.innerHTML = `
    <div class="onboarding">
      <div class="onb-dots">${dots}</div>
      <div class="card onb-card">${body}</div>
      <div class="onb-actions">
        ${onbStep > 0 ? `<button class="btn ghost2" id="onbBack">חזרה</button>` : ""}
        ${onbStep === 2 ? `<button class="btn ghost2" id="onbSkip">דלג</button>` : ""}
        <button class="btn onb-next" id="onbNext">${isLast ? "סיום — " + (onb.gender === "f" ? "בואי" : "בוא") + " נתחיל 🚀" : (onb.gender === "f" ? "המשיכי" : "המשך")}</button>
      </div>
    </div>`;

  const rate = app.querySelector("#onbRate");
  if (rate) rate.addEventListener("input", () => app.querySelector("#onbRateV").textContent = rate.value);
  app.querySelectorAll("[data-onbemo]").forEach(b => b.addEventListener("click", () => {
    captureOnb();
    if (b.dataset.onbemo === "__other__") { onb.otherMode = true; if (ONB_EMOTIONS.includes(onb.emotion)) onb.emotion = ""; }
    else { onb.otherMode = false; onb.emotion = b.dataset.onbemo; }
    renderOnboarding();
    if (onb.otherMode) app.querySelector("#onbEmotionOther")?.focus();
  }));
  app.querySelectorAll("[data-onbgender]").forEach(b => b.addEventListener("click", () => {
    captureOnb(); onb.gender = b.dataset.onbgender; renderOnboarding();
  }));
  const breath = app.querySelector("#onbBreath");
  if (breath) breath.addEventListener("click", () => {
    onb.breathDone = true; try { navigator.vibrate?.(30); } catch (e) {} renderOnboarding();
  });
  const back = app.querySelector("#onbBack");
  if (back) back.addEventListener("click", () => { captureOnb(); onbStep--; renderOnboarding(); });
  const skip = app.querySelector("#onbSkip");
  if (skip) skip.addEventListener("click", () => { onb.goal = ""; onbStep++; renderOnboarding(); });
  app.querySelector("#onbNext").addEventListener("click", onbNext);
}

function onbNext() {
  captureOnb();
  if (onbStep === 0 && !onb.name.trim()) return toast("איך לקרוא לך? 🙂");
  if (onbStep === 1 && !onb.emotion) return toast("בחר רגש אחד");
  if (onbStep === 3 && !onb.breathDone) return toast("קח נשימה אחת עמוקה 🫁");
  if (onbStep < ONB_TOTAL - 1) { onbStep++; renderOnboarding(); }
  else finishOnboarding();
}

async function finishOnboarding() {
  S.setGender(onb.gender);
  if (onb.name.trim()) S.setName(onb.name.trim());
  if (onb.emotion) { S.setEmotion(onb.emotion); S.logEmotionRating(onb.rating); }
  if (onb.goal.trim()) S.setGoal(onb.goal.trim());
  if (onb.breathDone) S.logActivity("exercise", "נשימה ראשונה במסע");
  if (onb.remind) {
    S.setReminders({ enabled: true, time: onb.remindTime });
    startReminderLoop();
    const p = await requestPermission();
    if (p !== "granted") toast("אפשר התראות בדפדפן כדי לקבל תזכורת");
  }
  S.setOnboarded();
  onbStep = 0;
  go("home");
  setTimeout(celebrate, 350);
}

// ============================================================
//  מסך בית — האווטר + פעולות מהירות + מטרה + רגש
// ============================================================
function renderHome() {
  const st = S.getState();
  const charge = S.computeCharge();
  const stage = S.avatarStage(charge);
  const stt = S.stats();
  const hello = st.name ? `שלום ${st.name} 👋` : `${G("ברוך הבא", "ברוכה הבאה")} למסע 👋`;

  const ratings = st.emotion.ratings;
  const first = ratings[0]?.value;
  const lastR = ratings[ratings.length - 1]?.value;
  const streak = S.getStreak();
  const task = getNextTask();
  const prac = todaysPractice();
  const pracDone = practiceDoneToday(prac.name);
  checkNewBadges();
  const badgeCount = badgeSummary();
  const today = new Date().toISOString().slice(0, 10);
  const checkedToday = ratings.some(r => r.date.slice(0, 10) === today);
  const todayVal = [...ratings].reverse().find(r => r.date.slice(0, 10) === today)?.value;


  app.innerHTML = `
    <header class="topbar">
      <div>
        <div class="greeting" id="homeTitle">${hello}</div>
        <div class="subtle">${COURSE.subtitle}</div>
      </div>
      <button class="icon-btn" id="themeToggle" title="מצב כהה / בהיר" aria-label="מצב כהה או בהיר">${S.getTheme() === "dark" ? "☀️" : "🌙"}</button>
    </header>

    ${installBanner()}

    <section class="card avatar-card">
      ${streak > 0 ? `<div class="streak-chip" title="ימים רצופים של עבודה">🔥 ${streak} ${streak === 1 ? "יום" : "ימים"} ברצף</div>` : ""}
      <div class="avatar-wrap">${renderAvatar(charge)}</div>
      <div class="leader-label">🏠 המנהיג הפנימי שלי</div>
      <div class="charge-row">
        <div class="charge-bar"><div class="charge-fill" style="width:${charge}%"></div></div>
        <div class="charge-num">${charge}%</div>
      </div>
      <p class="avatar-msg">${avatarMessage(stage)}</p>
      <p class="leader-hint">מתחזק בכל פעם שאני בוחר להנהיג — לא כשהפחד נעלם.</p>
      <div class="work-clock" title="זמן העבודה שלך השבוע">⏱️ זמן עבודה השבוע: <b id="workClock">${fmtHM(S.getWeekWorkTime())}</b></div>
      <button class="btn share-btn" id="shareProgress">📤 שיתוף ההתקדמות שלי</button>
    </section>

    <section class="card goal-card">
      <div class="card-head"><h3>🎯 המטרה שלי</h3>
        ${st.goal ? `<button class="link-btn" id="editGoal">עריכה</button>` : ""}</div>
      ${st.goal ? `<p class="goal-text">${esc(st.goal)}</p>`
        : `<p class="subtle">${G("הגדר", "הגדרי")} מטרה מדויקת ומעצימה בעזרת מודל דיסני ו-NLP — שלב אחר שלב.</p>`}
      <button class="btn" id="goalToolBtn">✍️ ${st.goal ? "פתיחת הגדרת המטרה" : (G("בוא", "בואי") + " נגדיר את המטרה")}</button>
    </section>

    ${st.emotion.name ? `
    <section class="card checkin-card">
      <div class="card-head"><h3>🌡️ צ'ק-אין יומי</h3>
        ${checkedToday ? `<span class="today-done">✓ נבדקת היום</span>` : ""}</div>
      <p class="checkin-q">איך <b>${esc(st.emotion.name)}</b> מרגיש עכשיו? <span class="subtle">(0–10)</span></p>
      <div class="rating-row">
        <input type="range" id="checkinRate" min="0" max="10" value="${todayVal ?? lastR ?? 5}">
        <span class="rate-val" id="checkinVal">${todayVal ?? lastR ?? 5}</span>
      </div>
      <button class="btn" id="checkinSave">${checkedToday ? "עדכון הדירוג" : "שמירת הדירוג היומי"}</button>
    </section>` : ""}

    <section class="card today-card">
      <h3>📌 המשימה של היום</h3>
      <div class="today-block">
        <div class="today-tag">משימת השבוע</div>
        ${task ? `
          <div class="today-text">${esc(task.text)}</div>
          <div class="today-meta">שבוע ${task.week} · ${esc(task.title)}</div>
          <div class="today-actions">
            <button class="btn" data-tasknav="${task.week}">פתיחה</button>
            <button class="btn ghost2" data-taskdone="${task.week}:${task.i}">✓ סמן כבוצע</button>
          </div>`
        : `<div class="today-text">🎉 סיימת את כל המשימות! אפשר לחזור לכל שבוע ולהעמיק.</div>`}
      </div>
      <div class="today-block">
        <div class="today-tag">תרגול יומי מתחלף</div>
        <div class="today-text">${prac.icon} <b>${esc(prac.name)}</b> — ${esc(prac.text)}</div>
        <div class="today-actions">
          ${pracDone ? `<span class="today-done">✓ בוצע היום — כל הכבוד</span>`
            : `<button class="btn" id="pracDone">עשיתי ✓</button>`}
          ${prac.name.includes("נשימ") ? `<button class="btn ghost2" id="pracBreath">🫁 מודרך</button>` : ""}
        </div>
      </div>
    </section>

    <section class="quick-actions">
      <h3>הפעולות שביצעת במסע</h3>
      <div class="qa-grid">
        ${Object.entries(ACTIVITY_TYPES).map(([k, v]) => {
          const nav = QA_NAV[k];
          return `<div class="qa-btn ${nav ? "tappable" : "static"}" style="--c:${v.color}" ${nav ? `data-qa="${k}"` : ""}>
            <span class="qa-ico">${v.icon}</span>
            <span class="qa-label">${v.label}</span>
            <span class="qa-count">${stt.counts[k] || 0}</span>
          </div>`; }).join("")}
      </div>
      <p class="qa-note">האווטר נטען מפעולות אמיתיות שאתה מבצע בכלים של כל שבוע.</p>
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

    <button class="btn ghost2 achv-link" id="achvLink">🏅 ההישגים שלי · ${badgeCount.unlocked}/${badgeCount.total}</button>

    ${trustBlock()}
  `;

  // מאזינים
  const eg = app.querySelector("#editGoal");
  if (eg) eg.addEventListener("click", () => go("goal"));
  app.querySelector("#goalToolBtn").addEventListener("click", () => go("goal"));
  app.querySelector("#shareProgress").addEventListener("click", shareProgress);
  app.querySelectorAll("[data-qa]").forEach(el =>
    el.addEventListener("click", () => { const [r, p] = QA_NAV[el.dataset.qa]; go(r, p); }));

  // המשימה של היום
  const tn = app.querySelector("[data-tasknav]");
  if (tn) tn.addEventListener("click", () => go("chapter", Number(tn.dataset.tasknav)));
  const td = app.querySelector("[data-taskdone]");
  if (td) td.addEventListener("click", () => {
    const [w, i] = td.dataset.taskdone.split(":").map(Number);
    S.toggleTask(w, i); celebrate(); renderHome();
  });
  const pd = app.querySelector("#pracDone");
  if (pd) pd.addEventListener("click", () => {
    const p = todaysPractice();
    S.logActivity(p.logType, "תרגול יומי: " + p.name);
    celebrate(); renderHome();
  });
  app.querySelector("#themeToggle").addEventListener("click", toggleTheme);
  app.querySelector("#achvLink").addEventListener("click", () => go("achievements"));
  app.querySelector("#trustSOS").addEventListener("click", openSOS);
  bindLongPress(app.querySelector("#homeTitle"), openAdmin);
  mountInstallBanner();
  const pb = app.querySelector("#pracBreath");
  if (pb) pb.addEventListener("click", () => openBreathingPlayer({ patternId: "478" }));
  const cr = app.querySelector("#checkinRate");
  if (cr) cr.addEventListener("input", () => app.querySelector("#checkinVal").textContent = cr.value);
  const cs = app.querySelector("#checkinSave");
  if (cs) cs.addEventListener("click", () => {
    S.logEmotionRating(app.querySelector("#checkinRate").value);
    toast("הדירוג היומי נשמר ✓"); celebrate(); renderHome();
  });

  // חגיגה בעליית שלב אווטר (רק כשעולה בתוך המפגש, לא בטעינה ראשונה)
  if (lastAvatarStage !== null && stage > lastAvatarStage) celebrate();
  lastAvatarStage = stage;
}
let lastAvatarStage = null;

// משבצות שאפשר ללחוץ עליהן במסך הבית — ניווט מהיר
const QA_NAV = {
  meditation: ["library", null],
  values: ["chapter", 8],
};

// המשימה הפתוחה הבאה — השבוע המוקדם ביותר עם משימה שלא סומנה
function getNextTask() {
  for (const c of COURSE.chapters) {
    for (let i = 0; i < c.tasks.length; i++) {
      if (!S.isTaskDone(c.week, i)) return { week: c.week, i, text: c.tasks[i], title: c.title };
    }
  }
  return null;
}
// תרגול יומי מתחלף — נבחר לפי היום כדי שיהיה יציב לאורך היום ומתחלף כל יום
function todaysPractice() {
  const idx = Math.floor(Date.now() / 86400000) % DAILY_PRACTICES.length;
  return DAILY_PRACTICES[idx];
}
function practiceDoneToday(name) {
  const today = new Date().toISOString().slice(0, 10);
  return S.getState().activities.some(a => a.note === "תרגול יומי: " + name && a.date.slice(0, 10) === today);
}

// ============================================================
//  מדליות והישגים
// ============================================================
function badgeCtx() {
  const stt = S.stats();
  const charge = S.computeCharge();
  const ratings = S.getState().emotion.ratings;
  const acts = S.getState().activities || [];
  const has = (re) => acts.filter(a => re.test(a.note || "")).length;
  // מדדי הנהגה — נספרים לפי מה שהאדם בחר לעשות, לא לפי ירידת רגש
  const lead = {
    stay:   has(/נשאר|להישאר|תוך-גופנית|הישארות|עוד 20 שניות/) ,
    fear:   (stt.counts.exposure || 0) + has(/למרות פחד|לוקח את הפחד|לקחתי את הפחד/),
    safety: has(/התנהגות ביטחון|התנהגות הצלה|ויתור על|ויתרתי/),
    value:  (stt.counts.values || 0) + has(/מבוססת ערך|בחירת ערך|מתוך ערכים/),
    meet:   has(/בלי להילחם|מי אני בלי הבעיה|חמלה|פגשתי רגש|הצורך שמתחת/),
  };
  return {
    total: stt.total, streak: S.getStreak(), charge, stage: S.avatarStage(charge),
    counts: stt.counts, lead, first: ratings[0]?.value ?? null, last: ratings[ratings.length - 1]?.value ?? null,
    weekDone: (w) => { const c = COURSE.chapters.find(x => x.week === w); return !!c && c.tasks.every((_, i) => S.isTaskDone(w, i)); },
  };
}
function unlockedBadgeIds() {
  const ctx = badgeCtx();
  return BADGES.filter(bd => { try { return bd.test(ctx); } catch (e) { return false; } }).map(bd => bd.id);
}
function badgeSummary() {
  return { unlocked: unlockedBadgeIds().length, total: BADGES.length };
}
// חוגג מדליות חדשות שנפתחו מאז הביקור הקודם (בלי להציף בטעינה הראשונה)
function checkNewBadges() {
  const unlocked = unlockedBadgeIds();
  const seen = S.getBadgesSeen();
  if (!seen.length) { S.setBadgesSeen(unlocked); return; } // בסיס ראשוני — לא חוגגים רטרואקטיבית
  const fresh = unlocked.filter(id => !seen.includes(id));
  if (fresh.length) {
    S.setBadgesSeen(unlocked);
    celebrate();
    const bd = BADGES.find(b => b.id === fresh[0]);
    if (bd) toast(`🏅 מדליה חדשה: ${bd.name}`);
  }
}

function renderAchievements() {
  const unlocked = new Set(unlockedBadgeIds());
  const done = unlocked.size;
  app.innerHTML = `
    <header class="topbar chapter-head">
      <button class="back-btn" id="back">›</button>
      <div><div class="greeting">🏅 ההישגים שלי</div>
        <div class="subtle">${done} מתוך ${BADGES.length} מדליות</div></div>
    </header>

    <section class="card">
      <div class="charge-row">
        <div class="charge-bar"><div class="charge-fill" style="width:${Math.round(done / BADGES.length * 100)}%"></div></div>
        <div class="charge-num">${Math.round(done / BADGES.length * 100)}%</div>
      </div>
      <p class="subtle" style="text-align:center;margin-top:8px">כל פעם שאתה בוחר להנהיג במקום להישלט על-ידי ההגנה — המנהיג הפנימי מתחזק 🌱</p>
    </section>

    <div class="badge-grid">
      ${BADGES.map(bd => {
        const on = unlocked.has(bd.id);
        return `<div class="badge ${on ? "on" : "locked"}">
          <div class="badge-ico">${on ? bd.icon : "🔒"}</div>
          <div class="badge-name">${esc(bd.name)}</div>
          <div class="badge-desc">${esc(bd.desc)}</div>
        </div>`;
      }).join("")}
    </div>

    <div class="chapter-footer">
      <button class="btn ghost2 back-all" id="backHome">↩ חזרה לבית</button>
    </div>`;
  app.querySelector("#back").addEventListener("click", () => go("home"));
  app.querySelector("#backHome").addEventListener("click", () => go("home"));
}

// ============================================================
//  נגן נשימה מודרך (אנימציה + אודיו אופציונלי)
// ============================================================
let breathState = null; // { patternId, running, cycles, timerId, audio, muted }

function openBreathingPlayer(opts = {}) {
  breathState = { patternId: opts.patternId || BREATH_PATTERNS[0].id, running: false, cycles: 0,
    timerId: null, audioSrc: opts.audioSrc || "", audioName: opts.audioName || "", muted: false };
  renderBreathingPlayer();
}
function closeBreathingPlayer() {
  stopBreathing();
  if (breathState?.audioEl) { breathState.audioEl.pause(); }
  document.getElementById("breathOverlay")?.remove();
  breathState = null;
}
function currentPattern() { return BREATH_PATTERNS.find(p => p.id === breathState.patternId) || BREATH_PATTERNS[0]; }

function renderBreathingPlayer() {
  let ov = document.getElementById("breathOverlay");
  if (!ov) { ov = document.createElement("div"); ov.id = "breathOverlay"; ov.className = "breath-overlay"; document.body.appendChild(ov); }
  const p = currentPattern();
  ov.innerHTML = `
    <button class="breath-close" id="breathClose" aria-label="סגירה">✕</button>
    <div class="breath-picker">
      ${BREATH_PATTERNS.map(x => `<button class="chip ${x.id === breathState.patternId ? "on" : ""}" data-bp="${x.id}">${x.name}</button>`).join("")}
    </div>
    <div class="breath-stage">
      <div class="breath-circle" id="breathCircle"><span id="breathPhase">מוכן?</span></div>
    </div>
    <div class="breath-count">סבבים: <b id="breathCycles">${breathState.cycles}</b></div>
    ${breathState.audioSrc ? `<audio id="breathAudio" src="${esc(breathState.audioSrc)}" controls loop style="width:100%;max-width:320px"></audio>` : ""}
    <div class="breath-actions">
      <button class="btn" id="breathToggle">${breathState.running ? "עצירה" : "התחלה ▶"}</button>
      <button class="btn ghost2" id="breathMute">${breathState.muted ? "🔇 שקט" : "🔔 צליל"}</button>
    </div>`;
  ov.querySelector("#breathClose").addEventListener("click", closeBreathingPlayer);
  ov.querySelectorAll("[data-bp]").forEach(b => b.addEventListener("click", () => {
    stopBreathing(); breathState.patternId = b.dataset.bp; renderBreathingPlayer();
  }));
  ov.querySelector("#breathToggle").addEventListener("click", () => {
    if (breathState.running) stopBreathing(); else startBreathing();
  });
  ov.querySelector("#breathMute").addEventListener("click", () => {
    breathState.muted = !breathState.muted;
    ov.querySelector("#breathMute").textContent = breathState.muted ? "🔇 שקט" : "🔔 צליל";
  });
}

function breathChime(freq) {
  if (breathState?.muted) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    breathState.ac = breathState.ac || new AC();
    const ac = breathState.ac, o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, ac.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.6);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.62);
  } catch (e) {}
}

function startBreathing() {
  const p = currentPattern();
  breathState.running = true;
  renderBreathingPlayer();
  const circle = document.getElementById("breathCircle");
  const phaseEl = document.getElementById("breathPhase");
  let pi = 0;
  const runPhase = () => {
    if (!breathState || !breathState.running) return;
    const [label, secs] = p.phases[pi];
    phaseEl.textContent = `${label} · ${secs}`;
    circle.className = "breath-circle " + (label === "שאיפה" ? "inhale" : label === "נשיפה" ? "exhale" : "hold");
    circle.style.transitionDuration = secs + "s";
    breathChime(label === "שאיפה" ? 440 : label === "נשיפה" ? 330 : 392);
    // ספירה לאחור בתוך השלב
    let left = secs;
    clearInterval(breathState.countId);
    breathState.countId = setInterval(() => {
      left--; if (left > 0 && phaseEl) phaseEl.textContent = `${label} · ${left}`;
    }, 1000);
    breathState.timerId = setTimeout(() => {
      pi = (pi + 1) % p.phases.length;
      if (pi === 0) { breathState.cycles++; const c = document.getElementById("breathCycles"); if (c) c.textContent = breathState.cycles; }
      runPhase();
    }, secs * 1000);
  };
  runPhase();
}
function stopBreathing() {
  if (!breathState) return;
  breathState.running = false;
  clearTimeout(breathState.timerId); clearInterval(breathState.countId);
  const circle = document.getElementById("breathCircle");
  const phaseEl = document.getElementById("breathPhase");
  if (circle) { circle.className = "breath-circle"; circle.style.transitionDuration = "0.6s"; }
  if (phaseEl) phaseEl.textContent = breathState.cycles ? "יפה 🌿" : "מוכן?";
  const tg = document.getElementById("breathToggle"); if (tg) tg.textContent = "התחלה ▶";
  // רישום פעולה אם היו לפחות 2 סבבים
  if (breathState.cycles >= 2 && !breathState.logged) { breathState.logged = true; S.logActivity("meditation", "נשימה מודרכת"); }
}

function editGoal() {
  const cur = S.getState().goal;
  const v = prompt("מהי המטרה שלך למסע?", cur || "");
  if (v !== null) { S.setGoal(v.trim()); renderHome(); }
}

// בלוק אמון ובטיחות (מוצג בתחתית הבית)
function trustBlock() {
  return `
    <section class="card trust-card">
      <div class="trust-methods">🧠 מבוסס CBT · ACT · NLP · מיינדפולנס</div>
      <p class="trust-author">פותח על ידי <b>דוד אינגבר</b> — הורות עצמית מיטיבה להתמודדות עם חרדה.</p>
      <p class="trust-privacy">🔒 הנתונים שלך נשמרים במכשיר שלך בלבד ואינם נשלחים לאף אחד.</p>
      <div class="trust-safety">
        <b>⚠️ חשוב:</b> האפליקציה היא כלי עזר ואינה תחליף לטיפול מקצועי.
        במצוקה חריפה או מחשבות אובדניות — פנה מיד לעזרה: ער״ן <b>1201</b> · מוקד חירום <b>101</b>.
      </div>
      <button class="btn ghost2" id="trustSOS">🫂 צריך רגע עכשיו?</button>
    </section>`;
}

// לחיצה ארוכה על הכותרת פותחת אזור מנחה (נסתר מהלקוח)
function bindLongPress(el, cb, ms = 700) {
  if (!el) return;
  let t = null;
  const start = () => { t = setTimeout(cb, ms); };
  const cancel = () => { clearTimeout(t); };
  el.addEventListener("pointerdown", start);
  ["pointerup", "pointerleave", "pointercancel", "pointermove"].forEach(ev => el.addEventListener(ev, cancel));
}

// ---- חגיגה: קונפטי + רטט ----
function celebrate() {
  try { navigator.vibrate?.([18, 40, 18]); } catch (e) {}
  const colors = ["#0f766e", "#14b8a6", "#e9b949", "#e07a5f", "#84b59f", "#5b8def", "#c07bb0"];
  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  for (let i = 0; i < 40; i++) {
    const s = document.createElement("i");
    s.className = "confetti";
    s.style.left = (Math.random() * 100) + "vw";
    s.style.background = colors[i % colors.length];
    s.style.animationDelay = (Math.random() * 0.25) + "s";
    s.style.animationDuration = (0.9 + Math.random() * 0.8) + "s";
    layer.appendChild(s);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 2000);
}

// ---- כרטיס התקדמות לשיתוף (canvas → Web Share / הורדה) ----
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function svgToImage(svg) {
  return new Promise((resolve, reject) => {
    const sized = svg.replace("<svg ", '<svg width="210" height="250" ');
    const url = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }));
    const im = new Image();
    im.onload = () => { resolve(im); URL.revokeObjectURL(url); };
    im.onerror = reject;
    im.src = url;
  });
}

async function shareProgress() {
  const st = S.getState();
  const charge = S.computeCharge();
  const stage = S.avatarStage(charge);
  const streak = S.getStreak();
  const stt = S.stats();
  const ratings = st.emotion.ratings;
  const first = ratings[0]?.value, last = ratings[ratings.length - 1]?.value;

  const W = 1080, H = 1080, F = "'Segoe UI',Arial,sans-serif";
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0f766e"); bg.addColorStop(1, "#0b4f49");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  roundRectPath(ctx, 64, 64, W - 128, H - 128, 52); ctx.fillStyle = "#ffffff"; ctx.fill();

  ctx.direction = "rtl"; ctx.textAlign = "center";
  ctx.fillStyle = "#0f766e"; ctx.font = "700 48px " + F;
  ctx.fillText("מסע 8 השבועות", W / 2, 176);
  ctx.fillStyle = "#6a8189"; ctx.font = "400 30px " + F;
  ctx.fillText("מהישרדות פנימית להנהגה עצמית", W / 2, 224);

  try {
    const img = await svgToImage(renderAvatar(charge));
    ctx.drawImage(img, W / 2 - 165, 250, 330, 392);
  } catch (e) {}

  let y = 706;
  if (first != null && last != null && last < first) {
    ctx.fillStyle = "#0f766e"; ctx.font = "800 58px " + F;
    ctx.fillText(`${st.emotion.name}: מ-${first} ל-${last}`, W / 2, y);
    ctx.fillStyle = "#6a8189"; ctx.font = "400 30px " + F;
    ctx.fillText("עוצמת הרגש ירדה מאז תחילת המסע", W / 2, y + 44);
  } else {
    ctx.fillStyle = "#0f766e"; ctx.font = "800 52px " + F;
    ctx.fillText(st.name ? `${st.name} במסע 💪` : "התחלתי את המסע 💪", W / 2, y);
  }

  // שורת נתונים: רצף · שלב · פעולות
  y = 840;
  const stats = [
    ["🔥", streak, streak === 1 ? "יום ברצף" : "ימים ברצף"],
    ["⭐", `${stage}/5`, "שלב האווטר"],
    ["✓", stt.total, "פעולות שטענו"],
  ];
  const colW = (W - 200) / 3;
  stats.forEach((s, i) => {
    const cx = 100 + colW * (i + 0.5);
    ctx.fillStyle = "#0f766e"; ctx.font = "800 56px " + F;
    ctx.fillText(`${s[0]} ${s[1]}`, cx, y);
    ctx.fillStyle = "#6a8189"; ctx.font = "400 26px " + F;
    ctx.fillText(s[2], cx, y + 40);
  });

  ctx.fillStyle = "#0f766e"; ctx.font = "600 30px " + F;
  ctx.fillText("davidingber.github.io/masa8", W / 2, H - 116);

  canvas.toBlob(async (blob) => {
    if (!blob) return toast("לא הצלחתי ליצור את התמונה");
    const file = new File([blob], "masa8-progress.png", { type: "image/png" });
    const data = { files: [file], title: "מסע 8 השבועות", text: "ההתקדמות שלי במסע 8 השבועות 💪" };
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share(data); return; }
      catch (e) { if (e.name === "AbortError") return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "masa8-progress.png";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("התמונה ירדה — אפשר לשתף אותה 📤");
  }, "image/png");
}

// ============================================================
//  רשימת הפרקים (המסע)
// ============================================================
function renderChapters() {
  app.innerHTML = `
    <header class="topbar"><div><div class="greeting">🗺️ מפת המסע</div>
      <div class="subtle">שמונה שבועות של הנהגה עצמית</div></div></header>
    <section class="card central-q-card">
      <div class="central-q-label">השאלה שמלווה את כל המסע</div>
      <div class="central-q-text">${CENTRAL_QUESTION}</div>
      <div class="central-q-sub">בכל שבוע אני מתאמן להיות המבוגר המיטיב שמנהיג את מה שקורה בתוכי.</div>
    </section>
    <div class="chapters-list">
      ${COURSE.chapters.map(c => {
        const done = tasksDoneCount(c);
        const total = c.tasks.length;
        const pct = Math.round(done / total * 100);
        const live = c.week === 1;
        const fr = WEEK_FRAMING[c.week];
        return `
        <button class="chapter-item" data-week="${c.week}">
          <div class="ch-icon">${c.icon}</div>
          <div class="ch-body">
            <div class="ch-top">
              <span class="ch-week">שבוע ${c.week}</span>
              ${live ? '<span class="badge-live">כלי פעיל</span>' : ''}
            </div>
            <div class="ch-title">${c.title}</div>
            ${fr ? `<div class="ch-flag">🚩 "${fr.flag}"</div>` : ""}
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
  const fr = WEEK_FRAMING[week];
  const ext = S.getState().externalTools[String(week)] || [];
  const video = S.getChapterVideo(week);

  app.innerHTML = `
    <header class="topbar chapter-head">
      <button class="back-btn" id="back">›</button>
      <div><div class="greeting">${c.icon} שבוע ${c.week}</div>
        <div class="subtle">${c.title}</div></div>
    </header>

    ${fr ? `<section class="card benefit-card">
      <p class="benefit-line">${fr.benefit}</p>
      <div class="flag-moment">
        <div class="flag-label">🚩 רגע הדגל של השבוע</div>
        <div class="flag-text">"${fr.flag}"</div>
      </div>
    </section>` : ""}

    ${video ? `<section class="card video-card"><h3>🎥 הקלטת השבוע</h3>${videoEmbed(video)}</section>` : ""}

    <section class="card shift-card">
      ${fr ? `<div class="lead-line">🏠 השבוע אני מתאמן להיות המבוגר המיטיב:<br><b>${fr.lead}</b></div>` : ""}
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

    ${ext.length ? `<section class="card">
      <div class="card-head"><h3>🔗 כלים דיגיטליים נוספים</h3></div>
      ${ext.map(t => `<a class="ext-tool" href="${esc(t.url)}" target="_blank">↗ ${esc(t.name)}</a>`).join("")}
    </section>` : ""}

    <p class="tools-note">${METHODS_SUBTEXT}</p>

    <div class="chapter-footer">
      <button class="btn ghost2 back-all" id="backAll">↩ חזרה לכל הפרקים</button>
    </div>
  `;

  app.querySelector("#back").addEventListener("click", () => go("chapters"));
  app.querySelector("#backAll").addEventListener("click", () => go("chapters"));
  app.querySelectorAll(".task input").forEach(cb =>
    cb.addEventListener("change", () => {
      S.toggleTask(week, Number(cb.dataset.i));
      if (cb.checked) celebrate();
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
let week1EmoOther = false;
const W1_TABS = [
  { id: "emotion",    label: "רגש ודירוג" },
  { id: "calm",       label: "סריקה ורגיעה" },
  { id: "dickens",    label: "תרגיל דיקנס" },
  { id: "activation", label: "יומן פעילות" },
];

function toolWeek1(c) {
  const tabs = `<div class="subtool-tabs">${W1_TABS.map(t =>
    `<button class="subtool-tab ${week1Tab === t.id ? "on" : ""}" data-w1tab="${t.id}">${t.label}</button>`).join("")}</div>`;
  let body = "";
  if (week1Tab === "emotion") body = w1Emotion();
  if (week1Tab === "calm") body = w1Calm();
  if (week1Tab === "dickens") body = w1Dickens();
  if (week1Tab === "activation") body = w1Activation();
  return tabs + `<div id="w1body">${body}</div>`;
}

// --- סריקת גוף + נשימה מונחית + מיינדפולנס ---
function w1Calm() {
  const mindfulness = S.getMeditations().find(m => m.id === "mindfulness");
  return w4Scan() + (mindfulness ? `
    <div class="tool-block med-block">
      <h4>🧘 מיינדפולנס</h4>
      <p class="hint">תרגול נוכחות עדין — לשים לב לרגע הזה כמו שהוא, בלי לשפוט.</p>
      ${medCard(mindfulness)}
    </div>` : "");
}

// חלק 1 — רגש מרכזי + דירוג + רגש חלופי
function w1Emotion() {
  const st = S.getState();
  const emotions = ["חרדה", "פחד", "בושה", "כעס", "עצב", "אשמה", "בדידות"];
  const suggested = EMOTION_ALTERNATIVES[st.emotion.name];
  const altPool = [...new Set([suggested, ...ALT_EMOTION_POOL].filter(Boolean))];
  const emoOther = week1EmoOther || (!!st.emotion.name && !emotions.includes(st.emotion.name));
  return `
    <div class="tool-block">
      <h4>1. ${G("בחר", "בחרי")} רגש מרכזי שמלווה אותך</h4>
      <div class="chip-row">
        ${emotions.map(e => `<button class="chip ${st.emotion.name === e ? "on" : ""}" data-emotion="${e}">${e}</button>`).join("")}
        <button class="chip ${emoOther ? "on" : ""}" data-emotion="__other__">אחר…</button>
      </div>
      ${emoOther ? `<div class="other-emo-row">
        <input class="inp" id="w1EmoOther" placeholder="${G("כתוב", "כתבי")} את הרגש שלך..." value="${esc(emotions.includes(st.emotion.name) ? "" : (st.emotion.name || ""))}">
        <button class="btn ghost2" id="w1EmoSave">שמירת הרגש</button></div>` : ""}

      <h4>2. ${G("דרג", "דרגי")} את עוצמתו עכשיו (0–10) — נקודת מוצא למדידה</h4>
      <div class="rating-row">
        <input type="range" id="rate" min="0" max="10" value="${lastRating(st) ?? 5}" ${st.emotion.name ? "" : "disabled"}>
        <span class="rate-val" id="rateVal">${lastRating(st) ?? 5}</span>
      </div>
      <button class="btn" id="logRate" ${st.emotion.name ? "" : "disabled"}>שמירת הדירוג</button>
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

let week2Tab = "journal";
const W2_TABS = [
  { id: "journal", label: "יומן המעגל" },
  { id: "map",     label: "מיפוי אישי" },
];
// מיפוי אישי — דפוסי החלק המפוחד
const SELFMAP_FIELDS = [
  { key: "trigger", icon: "⚡", label: "מה מפעיל אותי רגשית?", ph: "אנשים, מצבים או מחשבות שמציתים בי תגובה..." },
  { key: "avoid",   icon: "🚪", label: "מאלו דברים אני בהימנעות?", ph: "מה אני נמנע מלעשות, לומר או להרגיש..." },
  { key: "overdo",  icon: "🔁", label: "אלו דברים אני עושה יותר מדי מתוך חשש?", ph: "בדיקות, ריצוי, שליטה, הכנות יתר..." },
];

function toolWeek2(c) {
  const tabs = `<div class="subtool-tabs">${W2_TABS.map(t =>
    `<button class="subtool-tab ${week2Tab === t.id ? "on" : ""}" data-w2tab="${t.id}">${t.label}</button>`).join("")}</div>`;
  const body = week2Tab === "map" ? w2Map() : w2Journal();
  return tabs + `<div id="w2body">${body}</div>`;
}

function w2Journal() {
  const rows = S.getToolData(2, "cycleJournal") || [emptyCycleRow()];
  const meds = S.getMeditationsByWeek(2);
  return `
    <div class="tool-block">
      <h4>יומן מיפוי המעגל</h4>
      <p class="hint">מלא מקרה אחר מקרה. כל מקרה עוקב אחרי הרצף:
        <b>טריגר → מחשבה → רגש → תחושה → תגובה</b>. אפשר להוסיף כמה מקרים שרוצים.</p>
      <div id="cycleCases">${rows.map((r, i) => cycleCase(r, i)).join("")}</div>
      <button class="btn ghost2 add-case" id="addCase">＋ הוספת מקרה</button>
      <div class="activation-actions">
        <button class="btn" id="saveCycle">שמירה + טעינת האווטר</button>
        <button class="btn ghost2" id="pdfCycleFull">⬇ הורדת היומן המלא</button>
        <button class="btn ghost2" id="pdfCycleEmpty">⬇ יומן ריק להדפסה</button>
      </div>
    </div>
    ${meds.length ? `
    <div class="tool-block med-block">
      <h4>🎧 מדיטציות מלוות</h4>
      <p class="hint">תרגול יומי מרגיע את מערכת העצבים. האזן/צפה בקישור, או הורד את הקובץ.</p>
      ${meds.map(medCard).join("")}
    </div>` : ""}`;
}

// --- מיפוי אישי — מה מפעיל, ממה נמנע, מה עושה יותר מדי ---
function w2Map() {
  const d = S.getToolData(2, "selfMap") || {};
  return `
    <div class="tool-block">
      <p class="hint">מיפוי אישי — לזהות את הדפוסים שהחלק המפוחד מפעיל בי, כדי שאוכל להנהיג אותם במקום להישלט על-ידם.</p>
      ${SELFMAP_FIELDS.map(f => `
        <label class="mini-label">${f.icon} ${f.label}</label>
        <textarea class="ta selfmap-ta" data-m="${f.key}" placeholder="${f.ph}">${esc(d[f.key] || "")}</textarea>`).join("")}
      <button class="btn" id="saveSelfMap">שמירה + טעינת האווטר</button>
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
        ${m.link ? `<a class="btn ghost2 med-log" data-medname="${esc(m.name)}" href="${esc(m.link)}" target="_blank" rel="noopener">▶ צפייה / האזנה</a>` : ""}
        ${m.file ? `<a class="btn ghost2" href="${esc(m.file)}" target="_blank" rel="noopener">⬇ קובץ</a>` : ""}
      </div>
    </div>`;
}

// כל האזנה למדיטציה נרשמת כפעולה (טוענת את מונה "מדיטציה")
function mountMedLog() {
  app.querySelectorAll(".med-log").forEach(a =>
    a.addEventListener("click", () => S.logActivity("meditation", a.dataset.medname || "מדיטציה")));
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

function stashWeek2Drafts() {
  if (app.querySelectorAll(".cyc-input").length) S.setToolData(2, "cycleJournal", collectCycleRows());
  if (app.querySelector(".selfmap-ta")) {
    const d = {}; app.querySelectorAll(".selfmap-ta").forEach(t => d[t.dataset.m] = t.value.trim());
    S.setToolData(2, "selfMap", d);
  }
}

function mountWeek2Handlers() {
  app.querySelectorAll("[data-w2tab]").forEach(b =>
    b.addEventListener("click", () => { stashWeek2Drafts(); week2Tab = b.dataset.w2tab; renderChapter(2); }));

  // מיפוי אישי
  const sm = app.querySelector("#saveSelfMap");
  if (sm) sm.addEventListener("click", () => {
    const d = {}; app.querySelectorAll(".selfmap-ta").forEach(t => d[t.dataset.m] = t.value.trim());
    S.setToolData(2, "selfMap", d);
    if (Object.values(d).some(Boolean)) S.logActivity("exercise", "מיפוי אישי");
    toast("נשמר ✓");
  });

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
    <p class="sub">מסע 8 השבועות · שבוע 2 — טריגר → מחשבה → רגש → תחושה → תגובה</p>
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
//  שבוע 3 — הרחקת מחשבות (אי הזדהות) + מסגור מחדש NLP
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
      <p class="hint">מסגור מחדש מגישת NLP (שלבים 0–6) — עבודה עם החלק שאחראי על ההתנהגות הלא רצויה.
        השאלות מימין, מקום לתשובות משמאל.</p>
      <div class="reframe-list">
        ${NLP_REFRAME_STEPS.map((s, i) => `
          <div class="reframe-row">
            <div class="reframe-q">
              <span class="step-num">${i}</span>
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

  // אי הזדהות
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
      <td class="n">${i}</td>
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
  { id: "scan",       label: "סריקה ונשימה" },
  { id: "sensations", label: "להכיר את התחושות" },
  { id: "contract",   label: "החוזה שלי" },
  { id: "exposure",   label: "חשיפה תוך-גופנית" },
  { id: "regulation", label: "כלי ויסות" },
];
// שדות "החוזה שלי עם התחושות"
const CONTRACT_FIELDS = [
  { key: "sensation", label: "איזו תחושה יש לי?", ph: "תיאור התחושה והיכן היא יושבת..." },
  { key: "dangerous", label: "האם ידוע לי שהיא מסוכנת?", ph: "מה אני יודע בוודאות — לא מה שהחרדה אומרת..." },
  { key: "vital", label: "האם היא באיבר חיוני?", ph: "למשל: לב, ראש, נשימה — או אזור לא חיוני..." },
  { key: "duration", label: "כמה זמן מותר לה להיות בלי שהיא תעיד על סכנה?", ph: "למשל: 3 ימים, שבוע..." },
  { key: "contract", label: "החוזה שלי עם עצמי:", ph: "אני מתחייב ל..." },
];
// שלבי "להכיר את התחושות" — תהליך שחרור מודרך
const SENS_QUALITIES = ["כיווץ", "כבדות", "משהו שרוצה להתפרץ", "מחנק", "דקירה", "נימול", "חום", "זרמים", "ריקנות", "לחץ"];
const SENS_RELEASE = ["תנועה", "נשימה", "מגע", "תיפוף עם קצות האצבעות", "דימוי של משהו שמתפזר"];

function stopActiveTimer() { if (activeTimer) { clearInterval(activeTimer); activeTimer = null; } }

function toolWeek4(c) {
  const tabs = `<div class="subtool-tabs">${W4_TABS.map(t =>
    `<button class="subtool-tab ${week4Tab === t.id ? "on" : ""}" data-w4tab="${t.id}">${t.label}</button>`).join("")}</div>`;
  let body = "";
  if (week4Tab === "scan") body = w4Scan();
  if (week4Tab === "sensations") body = w4Sensations();
  if (week4Tab === "contract") body = w4Contract();
  if (week4Tab === "exposure") body = w4Exposure();
  if (week4Tab === "regulation") body = w4Regulation();
  return tabs + `<div id="w4body">${body}</div>`;
}

// --- החוזה שלי עם התחושות ---
function w4Contract() {
  const d = S.getToolData(4, "contract") || {};
  return `
    <div class="tool-block">
      <p class="hint">חוזה עם התחושה — במקום להיבהל מכל מיחוש, אני קובע מראש, כמבוגר מיטיב, כמה מקום וזמן
        לתת לתחושה לפני שהיא בכלל מעידה על סכנה.</p>
      ${CONTRACT_FIELDS.map(f => `
        <label class="mini-label">${f.label}</label>
        <textarea class="ta contract-ta" data-c="${f.key}" placeholder="${f.ph}">${esc(d[f.key] || "")}</textarea>`).join("")}
      <div class="identity-close" style="text-align:right">
        <b>📄 חוזה לדוגמה:</b><br>
        "אם יש לי כאב בכתף — או בכל אזור לא חיוני אחר — אתן לכאב <b>3 ימים</b> להיות,
        כל עוד הוא לא הולך ומתעצם, וכל עוד מדובר במיחוש ולא בכאב ממשי."
      </div>
      <div class="warn-note">⚠️ אם אתם חוששים שמדובר בסכנה — כדאי ללכת להיבדק.</div>
      <button class="btn" id="saveContract">שמירה + טעינת האווטר</button>
    </div>`;
}

// --- תת-כלי: להכיר את התחושות — תהליך שחרור ב-7 שלבים ---
function w4Sensations() {
  const d = S.getToolData(4, "sensProcess") || {};
  const qChips = SENS_QUALITIES.map(q =>
    `<button class="chip mini sq-chip ${(d.quality || []).includes(q) ? "on" : ""}" data-q="${q}">${q}</button>`).join("");
  const relChips = SENS_RELEASE.map(r =>
    `<button class="chip mini sr-chip ${(d.release || []).includes(r) ? "on" : ""}" data-r="${r}">${r}</button>`).join("");
  return `
    <div class="tool-block">
      <p class="hint">תהליך עדין להכיר תחושה גופנית וללוות אותה עד שחרור. קח את הזמן, בלי למהר.</p>

      <div class="focus-step"><span class="fs-num">1</span>
        <div><b>איפה התחושה בגוף?</b>
          <input class="inp" id="sWhere" value="${esc(d.where || "")}" placeholder="למשל: בחזה, בבטן, בגרון..."></div></div>

      <div class="focus-step"><span class="fs-num">2</span>
        <div><b>מה אופי התחושה?</b>
          <div class="chip-row" style="margin-top:6px">${qChips}</div></div></div>

      <div class="focus-step"><span class="fs-num">3</span>
        <div><b>באיזו עוצמה?</b> (1–10)
          <div class="rating-row" style="margin-top:6px">
            <input type="range" id="sIntensity" min="1" max="10" value="${d.intensity ?? 5}">
            <span class="rate-val" id="sIntensityV">${d.intensity ?? 5}</span>
          </div></div></div>

      <div class="focus-step"><span class="fs-num">4</span>
        <div><b>תן שם לתחושה</b> — "הנה כיווץ בחזה", "הנה שריפה בבטן"
          <input class="inp" id="sName" value="${esc(d.name || "")}" placeholder="הנה ______ ב______"></div></div>

      <div class="focus-step"><span class="fs-num">5</span>
        <div><b>אפשר לתחושה להיות.</b> אל תילחם בה — פשוט תן לה מקום כמה נשימות.</div></div>

      <div class="focus-step"><span class="fs-num">6</span>
        <div><b>האם אני מסכים לשחרר את התחושה?</b>
          <div class="chip-row" style="margin-top:6px">
            <button class="chip ${d.agree === "yes" ? "on" : ""}" data-sagree="yes">כן</button>
            <button class="chip ${d.agree === "no" ? "on" : ""}" data-sagree="no">עדיין לא</button>
          </div></div></div>

      <div class="focus-step"><span class="fs-num">7</span>
        <div><b>אם כן — אפשר לתחושה להשתחרר.</b> בחר כיצד:
          <div class="chip-row" style="margin-top:6px">${relChips}</div>
          <div class="release-stage" id="sReleaseStage"></div>
          <button class="btn ghost2" id="sReleaseBtn" style="margin-top:8px">🌬️ שחרור</button></div></div>

      <button class="btn" id="saveSensProcess">שמירה + טעינת האווטר</button>
    </div>`;
}

// --- תת-כלי: כלי ויסות — מדיטציות שבוע 4 + כניסה לטראנס ---
function w4Regulation() {
  const meds = S.getMeditationsByWeek(4);
  return `
    <div class="tool-block med-block">
      <p class="hint">כלים לוויסות עצמי — מיינדפולנס, אימון אוטוגני, הרפיית ג'ייקובסון וכניסה לטראנס.
        בחר כלי אחד שמתאים לך עכשיו ותרגל אותו.</p>
      ${meds.length ? meds.map(medCard).join("") : `<p class="tiny-note">טרם הוגדרו כלים — ניתן להוסיף במסך הניהול.</p>`}
    </div>`;
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

// --- תת-כלי 2: חשיפה תוך-גופנית (שים לב לתחושה → מעברים → תרגילים תומכים) ---
function w4Exposure() {
  const chips = WEEK4_SENSATIONS.map(s =>
    `<button class="chip mini sens-chip" data-sens="${s}">${s}</button>`).join("");
  return `
    <div class="tool-block">
      <div class="def-tech">
        <h5>👁️ שלב 1 — שים לב לתחושה בגוף</h5>
        <p class="hint">לפני הכול — עצור ושים לב: איזו תחושה גופנית נוכחת עכשיו, והיכן היא יושבת?</p>
        <div class="chip-row">${chips}</div>
        <p class="hint edge-note">💡 חשוב: התמקד רק ב<b>קצה של התחושה</b> — רק באזור שבו היא מתחילה, בגבול שלה —
          <b>בלי לקפוץ ישר אל תוך מרכז התחושה.</b></p>
      </div>

      <div class="def-tech">
        <h5>🔁 שלב 2 — מעברים בין ביטחון לתחושה</h5>
        <p class="hint">התחל מ<b>תחושת ביטחון ורוגע</b> בגוף (מהמקום הבטוח או מהנשימה). כשאתה מעוגן —
          עבור בעדינות אל <b>הקצה</b> של תחושת הכיווץ / אי-הנוחות, שהה בו כמה שניות, <b>והסכם לה להיות</b> —
          ואז חזור לתחושת הביטחון. עשה כמה מעברים כאלה, הלוך ושוב, בלי למהר.</p>
      </div>

      <div class="def-tech">
        <h5>✋ תרגיל תומך 1 — ליטוף היד (3 מחזורים)</h5>
        <p class="hint">לטף את היד באופן מונוטוני מהכתף ועד גב היד, בקצב איטי, כ-2 דקות.
          ואז שים לב ל<b>קצה</b> של התחושה הלא נעימה כמה שניות — <b>והסכם לה להיות</b> — ואז חזור ללטף. שלושה מחזורים.</p>
        <div class="timer-display" id="handTimer"><div class="timer-idle">מוכן להתחיל</div></div>
        <button class="btn ghost2" id="handStart">התחל תרגיל מונחה</button>
        <button class="btn ghost2 hidden" id="handStop">עצור</button>
      </div>

      <div class="def-tech">
        <h5>❤️ תרגיל תומך 2 — יד על הלב</h5>
        <p class="hint">הנח יד על הלב. שאף 5 שניות אל הלב, היזכר במשהו משמח, ונשוף 5 שניות.
          אז שים לב ל<b>קצה</b> של התחושה הלא נעימה כמה שניות — וחזור. כמה סבבים.</p>
        <div class="timer-display" id="heartTimer"><div class="timer-idle">מוכן להתחיל</div></div>
        <button class="btn ghost2" id="heartStart">התחל תרגיל מונחה</button>
        <button class="btn ghost2 hidden" id="heartStop">עצור</button>
      </div>

      <div class="def-tech">
        <h5>📝 מה קרה?</h5>
        <textarea class="ta" id="sensNote" placeholder="מה עלה? מה קרה לתחושה כשנשארת עם הקצה שלה, בלי לקפוץ פנימה?"></textarea>
        <button class="btn" id="saveSens">שמירה + טעינת האווטר</button>
      </div>
    </div>`;
}

// --- תת-כלי 3: טבלת חשיפות פנימיות (ניתנת לעריכה, מדורגת ל-3 רמות, עם שער בטיחות) ---
const W4_TABLE_COLS = [
  { key: "sensation", label: "תחושה", w: "22%" },
  { key: "exercise", label: "תרגיל", w: "24%" },
  { key: "duration", label: "משך", w: "12%" },
  { key: "guidance", label: "הנחיה / ויסות", w: "34%" },
];

function w4Table() {
  const disclaimerBox = `<div class="warn-note intero-disclaimer">⚠️ ${esc(INTERO_DISCLAIMER)}</div>`;
  // שער בטיחות — עד לאישור רפואי, התרגילים לא נפתחים
  if (!S.getToolData(7, "interoAck")) {
    return `
      <div class="tool-block">
        <p class="hint">חשיפות פנימיות — כל תרגיל מעורר תחושה גופנית בכוונה, כדי להתאמן להישאר איתה עד שהיא יורדת בעצמה.</p>
        ${disclaimerBox}
        <label class="rung-check intero-ack"><input type="checkbox" id="interoAck"> ${esc(INTERO_ACK_LABEL)}</label>
        <p class="hint">לאחר האישור ייפתחו התרגילים, מחולקים ל-3 רמות עצימות — מהעדין אל המעורר.</p>
      </div>`;
  }
  const rows = S.getToolData(4, "exposures") || structuredClone(INTEROCEPTIVE_EXPOSURES);
  const cols = W4_TABLE_COLS;
  // מיון והצגה לפי רמה, עם כותרות קבוצה (ברירת מחדל רמה 2 לשורות ישנות)
  const sorted = rows.map((r, idx) => ({ r, idx })).sort((a, b) => (Number(a.r.level) || 2) - (Number(b.r.level) || 2));
  let lastLevel = null;
  const rowsHtml = sorted.map((o, pos) => {
    const lvl = Number(o.r.level) || 2;
    let header = "";
    if (lvl !== lastLevel) { lastLevel = lvl; header = `<div class="exp-group lvl-${lvl}">${INTERO_LEVELS[lvl] || ("רמה " + lvl)}</div>`; }
    return header + expRow(o.r, pos, cols);
  }).join("");
  return `
    <div class="tool-block">
      <p class="hint">חשיפות פנימיות — כל תרגיל מעורר תחושה גופנית, ואנחנו מתרגלים להישאר איתה עד שהיא יורדת בעצמה.
        התרגילים מחולקים ל-3 רמות עצימות. אפשר לערוך, להוסיף ולמחוק שורות.</p>
      ${disclaimerBox}
      <div class="exp-table">
        <div class="exp-head"><div style="flex-basis:46px">רמה</div>${cols.map(co => `<div style="flex-basis:${co.w}">${co.label}</div>`).join("")}<div class="exp-del-col"></div></div>
        <div id="expRows">${rowsHtml}</div>
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
  const lvl = Number(r.level) || 2;
  const lvlSel = `<div class="exp-cell exp-lvl" style="flex-basis:46px">
    <select class="exp-input exp-lvl-sel" data-f="level">
      ${[1, 2, 3].map(n => `<option value="${n}" ${lvl === n ? "selected" : ""}>${n}</option>`).join("")}
    </select></div>`;
  return `<div class="exp-row" data-i="${i}">
    ${lvlSel}
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

// מטפל משותף לסריקת הגוף + הנשימה המונחית (בשימוש בשבוע 1 ובשבוע 4)
function mountScanBreathHandlers() {
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
}

function mountWeek4Handlers() {
  app.querySelectorAll("[data-w4tab]").forEach(b =>
    b.addEventListener("click", () => { stopActiveTimer(); stashWeek4Drafts(); week4Tab = b.dataset.w4tab; renderChapter(4); }));

  // תת-כלי 1 — סריקה ונשימה
  mountScanBreathHandlers();

  // תת-כלי: להכיר את התחושות (תהליך שחרור)
  const sInt = app.querySelector("#sIntensity");
  if (sInt) sInt.addEventListener("input", () => app.querySelector("#sIntensityV").textContent = sInt.value);
  app.querySelectorAll(".sq-chip, .sr-chip").forEach(b => b.addEventListener("click", () => b.classList.toggle("on")));
  app.querySelectorAll("[data-sagree]").forEach(b => b.addEventListener("click", () => {
    app.querySelectorAll("[data-sagree]").forEach(x => x.classList.remove("on")); b.classList.add("on");
  }));
  const srb = app.querySelector("#sReleaseBtn");
  if (srb) srb.addEventListener("click", () => {
    const stage = app.querySelector("#sReleaseStage");
    stage.innerHTML = `<div class="release-orb"></div><div class="release-text">משחררים… תן לתחושה להתפזר עם נשימה ארוכה</div>`;
    S.logActivity("exposure", "שחרור תחושה");
  });
  const ssp = app.querySelector("#saveSensProcess");
  if (ssp) ssp.addEventListener("click", () => {
    S.setToolData(4, "sensProcess", {
      where: qv("#sWhere"),
      quality: [...app.querySelectorAll(".sq-chip.on")].map(b => b.dataset.q),
      intensity: Number(app.querySelector("#sIntensity")?.value || 5),
      name: qv("#sName"),
      agree: app.querySelector("[data-sagree].on")?.dataset.sagree || "",
      release: [...app.querySelectorAll(".sr-chip.on")].map(b => b.dataset.r),
    });
    S.logActivity("exercise", "להכיר את התחושות");
    toast("נשמר ✓");
  });

  // החוזה שלי עם התחושות
  const sct = app.querySelector("#saveContract");
  if (sct) sct.addEventListener("click", () => {
    const d = {}; app.querySelectorAll(".contract-ta").forEach(t => d[t.dataset.c] = t.value.trim());
    S.setToolData(4, "contract", d);
    if (Object.values(d).some(Boolean)) S.logActivity("exercise", "החוזה שלי עם התחושות");
    toast("החוזה נשמר ✓");
  });

  // תת-כלי 2 — טיימרים מונחים
  const handPhases = [];
  for (let cyc = 1; cyc <= 3; cyc++) {
    handPhases.push({ label: `מחזור ${cyc} — ליטוף מונוטוני`, seconds: 120, cue: "מהכתף → גב היד, קצב איטי" });
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

}

function stashWeek4Drafts() {
  if (app.querySelector(".contract-ta")) {
    const d = {}; app.querySelectorAll(".contract-ta").forEach(t => d[t.dataset.c] = t.value.trim());
    S.setToolData(4, "contract", d);
  }
}

function openExposurePrint(rows) {
  const st = S.getState();
  const today = new Date().toLocaleDateString("he-IL");
  const sortedRows = [...rows].sort((a, b) => (Number(a.level) || 2) - (Number(b.level) || 2));
  const body = sortedRows.map(r =>
    `<tr><td class="d">${esc(String(r.level || 2))}</td><td>${esc(r.sensation || "")}</td><td>${esc(r.exercise || "")}</td><td class="d">${esc(r.duration || "")}</td><td>${esc(r.guidance || "")}</td></tr>`).join("");
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
    <title>חשיפות פנימיות — שבוע 7</title>
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
    <p class="sub">מסע 8 השבועות · שבוע 7 — פעולה למרות פחד</p>
    <div class="meta"><span>שם: ${esc(st.name) || "________"}</span><span>תאריך: ${today}</span></div>
    <table><thead><tr><th>רמה</th><th>תחושה</th><th>תרגיל</th><th>משך</th><th>הנחיה / ויסות</th></tr></thead><tbody>${body}</tbody></table>
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
let week5Tab = "quick";
const W5_TABS = [
  { id: "quick",   label: "בדיקה מהירה" },
  { id: "learn",   label: "עיוותי חשיבה" },
  { id: "table",   label: "טבלה מלאה" },
  { id: "checker", label: "בדיקת מחשבה (AI)" },
];

function toolWeek5(c) {
  const tabs = `<div class="subtool-tabs">${W5_TABS.map(t =>
    `<button class="subtool-tab ${week5Tab === t.id ? "on" : ""}" data-w5tab="${t.id}">${t.label}</button>`).join("")}</div>`;
  let body = "";
  if (week5Tab === "quick") body = w5Quick();
  if (week5Tab === "learn") body = w5Learn();
  if (week5Tab === "table") body = w5Table();
  if (week5Tab === "checker") body = w5Checker();
  return tabs + `<div id="w5body">${body}</div>`;
}

// --- תת-כלי 0: בדיקה מהירה של מחשבה (30 שניות) — ברירת המחדל הפשוטה ---
function w5Quick() {
  const d = S.getToolData(6, "quickCheck") || {};
  return `
    <div class="tool-block">
      <p class="hint">בדיקה מהירה של מחשבה מטרידה — 30 שניות, ארבע שאלות. זו ברירת המחדל.
        מי שרוצה לבדוק לעומק — יש טבלה מלאה בלשונית הבאה.</p>
      <label class="mini-label">1. מה המוח אומר?</label>
      <textarea class="ta" id="q1" placeholder="המחשבה כמו שהיא עולה...">${esc(d.q1 || "")}</textarea>
      <label class="mini-label">2. מה אני יודע בוודאות?</label>
      <textarea class="ta" id="q2" placeholder="רק העובדות, בלי פרשנות...">${esc(d.q2 || "")}</textarea>
      <label class="mini-label">3. מה עוד יכול להיות נכון?</label>
      <textarea class="ta" id="q3" placeholder="פרשנות נוספת, סבירה לא פחות...">${esc(d.q3 || "")}</textarea>
      <label class="mini-label">4. איך הייתי מדבר עכשיו לאדם שאני אוהב?</label>
      <textarea class="ta" id="q4" placeholder="במילים חמות ומדויקות...">${esc(d.q4 || "")}</textarea>
      <div class="activation-actions">
        <button class="btn" id="saveQuick">שמירה + טעינת האווטר</button>
        <button class="btn ghost2" id="toDepth">אני רוצה לבדוק לעומק ←</button>
      </div>
    </div>`;
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
  const rows = S.getToolData(6, "thoughtTable") || [emptyThoughtRow()];
  return `
    <div class="tool-block">
      <p class="hint">גרסת העומק (אופציונלית): מלא אירוע אחר אירוע — מהמחשבה האוטומטית, דרך זיהוי עיוות החשיבה,
        אל המחשבה החלופית שמרגישה מדויקת יותר.</p>
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
    b.addEventListener("click", () => { stashWeek5Drafts(); week5Tab = b.dataset.w5tab; renderChapter(6); }));

  // בדיקה מהירה (30 שניות)
  const sq = app.querySelector("#saveQuick");
  if (sq) sq.addEventListener("click", () => {
    const d = { q1: qv("#q1"), q2: qv("#q2"), q3: qv("#q3"), q4: qv("#q4") };
    S.setToolData(6, "quickCheck", d);
    if (Object.values(d).some(Boolean)) S.logActivity("thought", "בדיקה מהירה של מחשבה");
    toast("נשמר ✓");
  });
  const tod = app.querySelector("#toDepth");
  if (tod) tod.addEventListener("click", () => { stashWeek5Drafts(); week5Tab = "table"; renderChapter(6); });

  // לימוד
  const ld = app.querySelector("#learnDone");
  if (ld) ld.addEventListener("click", () => { S.logActivity("thought", "לימוד עיוותי חשיבה"); toast("יפה! טענת את האווטר ✓"); });

  // טבלה
  app.querySelectorAll(".tt-input").forEach(inp =>
    inp.addEventListener("change", () => S.setToolData(6, "thoughtTable", collectThoughtRows())));
  const at = app.querySelector("#addThought");
  if (at) at.addEventListener("click", () => {
    const rows = collectThoughtRows(); rows.push(emptyThoughtRow());
    S.setToolData(6, "thoughtTable", rows); renderChapter(6);
  });
  app.querySelectorAll(".tt-del").forEach(b =>
    b.addEventListener("click", () => {
      const rows = collectThoughtRows(); rows.splice(Number(b.dataset.del), 1);
      S.setToolData(6, "thoughtTable", rows.length ? rows : [emptyThoughtRow()]); renderChapter(6);
    }));
  const stt = app.querySelector("#saveThoughtTable");
  if (stt) stt.addEventListener("click", () => {
    const rows = collectThoughtRows();
    S.setToolData(6, "thoughtTable", rows);
    if (rows.some(r => Object.values(r).some(Boolean))) S.logActivity("thought", "החלפת מחשבה");
    toast("הטבלה נשמרה ✓"); renderChapter(6);
  });
  const pt = app.querySelector("#pdfThought");
  if (pt) pt.addEventListener("click", () => { S.setToolData(6, "thoughtTable", collectThoughtRows()); openThoughtPrint(collectThoughtRows()); });

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
  if (app.querySelectorAll("#thoughtRows .exp-row").length) S.setToolData(6, "thoughtTable", collectThoughtRows());
  if (app.querySelector("#q1")) S.setToolData(6, "quickCheck", { q1: qv("#q1"), q2: qv("#q2"), q3: qv("#q3"), q4: qv("#q4") });
}

function openThoughtPrint(rows) {
  const st = S.getState();
  const today = new Date().toLocaleDateString("he-IL");
  const head = THOUGHT_TABLE_COLS.map(co => `<th>${esc(co.label)}</th>`).join("");
  const body = rows.map(r =>
    `<tr>${THOUGHT_TABLE_COLS.map(co => `<td>${esc(r[co.key] || "")}</td>`).join("")}</tr>`).join("");
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
    <title>טבלת החלפת מחשבות — שבוע 6</title>
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
    <p class="sub">מסע 8 השבועות · שבוע 6 — הנהגת המחשבות</p>
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
let week6Tab = "identity";
const W6_TABS = [
  { id: "identity", label: "מי אני בלי הבעיה" },
  { id: "guided",   label: "מפגש החמלה" },
  { id: "burden",   label: "הסרת העול" },
  { id: "meds",     label: "מדיטציות" },
  { id: "write",    label: "כתיבה 5 דק׳" },
];
// הסרת העול — 4 עומסים שאני מניח מעליי
const BURDEN_FIELDS = [
  { key: "guilt",   icon: "🪶", label: "איזו אשמה אני מוריד מעליי?", ph: "אשמה שנשאתי ולא באמת שלי..." },
  { key: "others",  icon: "🎒", label: "איזה עול של אחרים אני מוריד מעליי?", ph: "אחריות/רגשות של אחרים שלקחתי על עצמי..." },
  { key: "pleasing", icon: "🙇", label: "איזה ריצוי אני מוריד מעליי?", ph: "לרצות ולהתאים את עצמי כדי שיאהבו אותי..." },
  { key: "perfect", icon: "🎯", label: "איזה משהו שאני עושה בפרפקציוניזם אני מוריד מעליי?", ph: "דרישה מעצמי שהכול יהיה מושלם..." },
];
const WORRY_REMINDER = {
  title: "דייט עם הדאגה — 5 דקות",
  description: "שב 5 דקות עם הדאגה: פשוט לכתוב כל מה שעולה, או לתרגל את מפגש החמלה. אני כאן — מה אתה מנסה להגיד לי?",
};
const FOCUS_SENSATIONS = ["כיווץ", "רעד", "עומס", "כבדות", "משהו שרוצה להתפרץ"];

function toolWeek6(c) {
  const tabs = `<div class="subtool-tabs">${W6_TABS.map(t =>
    `<button class="subtool-tab ${week6Tab === t.id ? "on" : ""}" data-w6tab="${t.id}">${t.label}</button>`).join("")}</div>`;
  let body = "";
  if (week6Tab === "identity") body = w6Identity();
  if (week6Tab === "guided") body = w6Guided();
  if (week6Tab === "burden") body = w6Burden();
  if (week6Tab === "meds") body = w6Meds();
  if (week6Tab === "write") body = w6Write();
  return tabs + `<div id="w6body">${body}</div>`;
}

// --- מי אני בלי הבעיה — דמיון מודרך "להפשיט את הכאב" ---
function w6Identity() {
  return `
    <div class="tool-block">
      <p class="hint">תרגיל דמיון מודרך — פורקים שכבה אחר שכבה של מה שמכביד, עד שנזכרים במי שאנחנו באמת, בלי הבעיה.</p>
      <div class="identity-guide">
        <h4>🌬️ להפשיט את הכאב</h4>
        <p>שימו לב לרגש שאתם עובדים עליו — <b>איפה הוא נוכח בגוף?</b> וכעת דמיינו, כאילו אתם כותבים את הרגש הזה על דף,
          מקפלים אותו, ומניחים אותו בצד לכמה שניות.</p>
        <p>עכשיו בדקו: האם אתם מרגישים טוב בלי הבעיה? אם עדיין לא — <b>מה עוד נשאר?</b> שימו לב לרגש נוסף.
          דמיינו שאתם מוציאים אותו, כותבים גם אותו על דף, מקפלים ומניחים בקערה דמיונית, רק לכמה רגעים.</p>
        <p>ושוב בדקו: האם אתם מרגישים נפלא בלי הבעיה? אם עדיין לא — שימו לב לעוד רגש, אולי לתחושה כללית של סטרס.
          דמיינו שאתם מוציאים אותה מהגוף, רושמים על הדף, מקפלים ומניחים בקערה.</p>
        <p>וכך גם עם כעס, עצב או אכזבה — שכבה אחר שכבה — עד שאתם מרגישים <b>שאתם מרגישים מצוין בלי הבעיה.</b></p>
      </div>

      <div class="bowl-ritual">
        <p class="hint">וכעת באמת: כתבו שכבה אחת שמכבידה — רגש, מחשבה, בעיה — <b>והשליכו אותה לקערה.</b></p>
        <div class="bowl-line">
          <input class="inp" id="w6probInput" maxlength="60" placeholder="כתבו כאן מה מכביד עליכם עכשיו...">
          <button class="btn tossBtn" id="w6tossBtn">🕊️ להשליך לקערה</button>
        </div>
        <p class="bowl-affirm" id="w6bowlAffirm"></p>
        <div class="bowl-stage" id="w6bowlStage">
          <div class="bowl-wrap">
            <div class="bowl-rim"></div>
            <div class="bowl-body"><div class="bowl-rest" id="w6bowlRest"></div></div>
          </div>
        </div>

        <div class="heal-avatar-wrap">
          <div class="heal-avatar" id="w6avatar">
            <svg viewBox="0 0 120 155" aria-hidden="true">
              <ellipse class="ha-glow" cx="60" cy="74" rx="52" ry="55" fill="#9fe0cf"></ellipse>
              <g class="ha-fig">
                <path class="ha-body" d="M40 140 C40 100 45 82 60 82 C75 82 80 100 80 140 Z" fill="#3bb3a0"></path>
                <circle class="ha-head" cx="60" cy="46" r="21" fill="#f4c9a8"></circle>
                <circle class="ha-eye" cx="52" cy="44" r="2.6"></circle>
                <circle class="ha-eye" cx="68" cy="44" r="2.6"></circle>
                <path class="ha-mouth-sad" d="M51 57 Q60 51 69 57"></path>
                <path class="ha-mouth-happy" d="M51 52 Q60 60 69 52"></path>
              </g>
            </svg>
          </div>
          <p class="identity-close">בשעה טובה — הנה נזכרתם במי אתם, בלי הבעיה. <b>זה מי שאתם.</b> 🌱</p>
        </div>
      </div>

      <button class="btn" id="saveIdentity">סיימתי את התרגיל + טעינת האווטר</button>
    </div>`;
}
const BOWL_AFFIRM = [
  "שכבה אחת פחות לשאת. נשמו.",
  "הנחתם את זה בצד. יפה.",
  "שימו לב — נהיה קליל יותר?",
  "עוד משהו שמכביד? כתבו והשליכו.",
  "אתם לא הבעיה. אתם מי שנשאר. 🌱",
];
// אווטר שמתיישר, מאיר ומתמלא רוגע ככל שמשליכים כאב לקערה (0 = כפוף/עצוב, 4 = זקוף/שמח)
function w6HealAvatar(count) {
  const wrap = app.querySelector("#w6avatar");
  if (!wrap) return;
  const s = Math.max(0, Math.min(4, count));
  const fig = wrap.querySelector(".ha-fig");
  const glow = wrap.querySelector(".ha-glow");
  const sad = wrap.querySelector(".ha-mouth-sad");
  const happy = wrap.querySelector(".ha-mouth-happy");
  if (fig) {
    fig.style.transform = `translateY(${(6 - 1.5 * s).toFixed(1)}px) rotate(${(-5 + 1.25 * s).toFixed(2)}deg) scale(${(0.86 + 0.035 * s).toFixed(3)})`;
    fig.style.filter = `grayscale(${(0.55 * (1 - s / 4)).toFixed(2)}) saturate(${(0.7 + 0.3 * (s / 4)).toFixed(2)}) brightness(${(0.95 + 0.05 * (s / 4)).toFixed(3)})`;
  }
  if (glow) { glow.style.opacity = (0.06 + 0.12 * s).toFixed(2); glow.style.transform = `scale(${(0.7 + 0.09 * s).toFixed(2)})`; }
  const happyOn = s >= 2;
  if (sad) sad.style.opacity = happyOn ? "0" : "1";
  if (happy) happy.style.opacity = happyOn ? "1" : "0";
}

// --- הסרת העול — 4 עומסים שאני מניח מעליי ---
function w6Burden() {
  const d = S.getToolData(5, "burden") || {};
  return `
    <div class="tool-block">
      <p class="hint">כהורה מיטיב לעצמי — אני בוחר להניח מעליי את מה שאני נושא ולא באמת שלי.
        לכל שורה: מה בדיוק אני מוריד מעליי כרגע?</p>
      ${BURDEN_FIELDS.map(f => `
        <div class="burden-item">
          <label class="mini-label">${f.icon} ${f.label}</label>
          <textarea class="ta burden-ta" data-b="${f.key}" placeholder="${f.ph}">${esc(d[f.key] || "")}</textarea>
        </div>`).join("")}
      <button class="btn" id="saveBurden">🪶 הנחתי את זה מעליי — שמירה</button>
    </div>`;
}

// --- כתיבה חופשית 5 דקות + טיימר + תזכורת יומית ---
function w6Write() {
  const st = S.getState();
  return `
    <div class="tool-block">
      <p class="hint">שבו 5 דקות עם הדאגה — פשוט לכתוב כל מה שעולה, בלי לסנן. כמו הורה טוב שמקשיב לדאגה.</p>
      <div class="timer-display" id="writeTimer"><div class="timer-idle">5:00 — לחץ להתחלה</div></div>
      <div class="activation-actions">
        <button class="btn ghost2" id="writeStart">▶ התחל טיימר 5 דקות</button>
        <button class="btn ghost2 hidden" id="writeStop">עצור</button>
      </div>
      <textarea class="ta big" id="freeWrite" placeholder="אני כאן, מה אתם מנסים להגיד לי?..."></textarea>
      <button class="btn" id="saveWrite">שמירה + טעינת האווטר</button>

      <div class="cal-connect" style="margin-top:18px">
        <h4>🔔 רוצים תזכורת יומית לתרגול הזה?</h4>
        <p class="hint">נכין אירוע יומי חוזר <b>למשך חודש</b> ביומן שלכם. אתם מאשרים בעצמכם את ההוספה — שום דבר לא נשלח.</p>
        <div class="cal-time-row">
          <label class="mini-label">שעה</label>
          <input class="inp cal-time" id="worryTime" type="time" value="${esc(st.reminders.time || "20:00")}">
        </div>
        <div class="gcal-block">
          <button class="btn ghost2" id="worryGoogle">📅 הוספה ליומן Google</button>
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

// --- תהליך מודרך (פוקוסינג) ---
function w6Guided() {
  const d = S.getToolData(5, "focusing") || {};
  const sensChips = FOCUS_SENSATIONS.map(s =>
    `<button class="chip mini focus-sens ${(d.sens || []).includes(s) ? "on" : ""}" data-sens="${s}">${s}</button>`).join("");
  return `
    <div class="tool-block">
      <p class="hint">תהליך עדין של הקשבה לתחושה. קח את הזמן, נשום, ולווה כל שלב ברוגע.</p>

      <div class="focus-step"><span class="fs-num">1</span>
        <div><b>התמקד בתחושה</b> — היכן היא יושבת בגוף? איזה סוג תחושה?
          <div class="chip-row" style="margin-top:6px">${sensChips}</div></div></div>

      <div class="focus-step"><span class="fs-num">2</span>
        <div><b>איזו מילה או תמונה עולה מתוך התחושה</b> ומייצגת אותה?
          <input class="inp" id="fWord" value="${esc(d.word || "")}" placeholder="תוסיף מילה או תמונה שעולה מתוך התחושה..."></div></div>

      <div class="focus-step"><span class="fs-num">3</span>
        <div><b>בחן:</b> האם זו באמת המילה שמרגישה נכון מתוך התחושה? לשהות איתה כמה רגעים.
          אפשר גם לשנות את המילה או התמונה שמייצגת או מתארת את התחושה.</div></div>

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
  const meds = S.getMeditationsByWeek(5);
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

function mountWeek6Handlers() {
  // מי אני בלי הבעיה
  const si = app.querySelector("#saveIdentity");
  if (si) si.addEventListener("click", () => {
    S.logActivity("exercise", "מי אני בלי הבעיה");
    celebrate(); toast("יפה — נזכרת במי שאתה 🌱");
  });

  // הסרת העול
  const sb = app.querySelector("#saveBurden");
  if (sb) sb.addEventListener("click", () => {
    const d = {}; app.querySelectorAll(".burden-ta").forEach(t => d[t.dataset.b] = t.value.trim());
    S.setToolData(5, "burden", d);
    if (Object.values(d).some(Boolean)) S.logActivity("exercise", "הסרת העול");
    celebrate(); toast("🪶 הנחת את זה מעליך");
  });

  // טקס הקערה — כותבים בעיה ומשליכים אותה לקערה
  const tossBtn = app.querySelector("#w6tossBtn");
  if (tossBtn) {
    let tossed = 0;
    const doToss = () => {
      const inp = app.querySelector("#w6probInput");
      const v = (inp.value || "").trim();
      if (!v) return toast("כתבו קודם מה מכביד");
      const stage = app.querySelector("#w6bowlStage");
      const note = document.createElement("div");
      note.className = "paper-note flying";
      note.textContent = v.length > 16 ? v.slice(0, 16) + "…" : v;
      stage.appendChild(note);
      setTimeout(() => {
        note.remove();
        const rest = app.querySelector("#w6bowlRest");
        if (rest) {
          const chip = document.createElement("span");
          chip.className = "bowl-paper";
          chip.style.transform = `rotate(${Math.round(Math.random() * 40 - 20)}deg)`;
          rest.appendChild(chip);
        }
      }, 1050);
      const aff = app.querySelector("#w6bowlAffirm");
      if (aff) aff.textContent = BOWL_AFFIRM[Math.min(tossed, BOWL_AFFIRM.length - 1)];
      tossed++;
      w6HealAvatar(tossed);
      inp.value = "";
      S.logActivity("thought", "השלכת שכבה לקערה");
    };
    tossBtn.addEventListener("click", doToss);
    const pi = app.querySelector("#w6probInput");
    if (pi) pi.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); doToss(); } });
    w6HealAvatar(0); // מצב פתיחה — כפוף ומעט עצוב
  }

  app.querySelectorAll("[data-w6tab]").forEach(b =>
    b.addEventListener("click", () => { stopActiveTimer(); stashWeek6Drafts(); week6Tab = b.dataset.w6tab; renderChapter(5); }));

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
    S.saveToolEntry(5, "freewrite", { text: v });
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
    S.setToolData(5, "focusing", data);
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
    S.setToolData(5, "focusing", {
      sens: [...app.querySelectorAll(".focus-sens.on")].map(b => b.dataset.sens),
      word: app.querySelector("#fWord")?.value.trim() || "",
      needs: app.querySelector("#fNeeds")?.value.trim() || "",
      agree: app.querySelector("[data-agree].on")?.dataset.agree || "",
    });
  }
  if (app.querySelector(".burden-ta")) {
    const d = {}; app.querySelectorAll(".burden-ta").forEach(t => d[t.dataset.b] = t.value.trim());
    S.setToolData(5, "burden", d);
  }
}

// ============================================================
//  שבוע 7 — פעולה למרות פחד: כללים והכנה, חשיפה בדמיון, סולם פחדים
// ============================================================
let week7Part = "a";
let week7Tab = "rules";
const W7_PARTS = [
  { id: "a", label: "חלק א · הכנה", tabs: [
    { id: "rules",    label: "כללים והכנה" },
    { id: "prep",     label: "הכנה לחשיפה" },
    { id: "imaginal", label: "חשיפה בדמיון" },
    { id: "ladder",   label: "סולם פחדים" },
  ]},
  { id: "b", label: "חלק ב · ביצוע ומעקב", tabs: [
    { id: "internal", label: "חשיפות פנימיות" },
    { id: "journal",  label: "יומן חשיפות" },
    { id: "after",    label: "אחרי חשיפה" },
    { id: "advisor",  label: "יועץ חשיפות" },
  ]},
];
// רגשות מוצעים בטופס ההכנה לחשיפה
const PREP_EMOTIONS = ["פחד", "חרדה", "עצבנות", "כעס", "תסכול", "עצב", "מבוכה", "בושה", "שנאה"];

// שיחת ייעוץ החשיפות — נשמרת בזיכרון למשך הגלישה (כמו מאמן ה-AI)
let expAdvisorThread = [];

function toolWeek7(c) {
  const part = W7_PARTS.find(p => p.id === week7Part) || W7_PARTS[0];
  if (!part.tabs.some(t => t.id === week7Tab)) week7Tab = part.tabs[0].id;
  const partToggle = `<div class="part-toggle">${W7_PARTS.map(p =>
    `<button class="part-btn ${week7Part === p.id ? "on" : ""}" data-w7part="${p.id}">${p.label}</button>`).join("")}</div>`;
  const tabs = `<div class="subtool-tabs">${part.tabs.map(t =>
    `<button class="subtool-tab ${week7Tab === t.id ? "on" : ""}" data-w7tab="${t.id}">${t.label}</button>`).join("")}</div>`;
  let body = "";
  if (week7Tab === "rules") body = w7Rules();
  if (week7Tab === "prep") body = w7Prep();
  if (week7Tab === "imaginal") body = w7Imaginal();
  if (week7Tab === "ladder") body = w7Ladder();
  if (week7Tab === "internal") body = w4Table();
  if (week7Tab === "journal") body = w7Journal();
  if (week7Tab === "after") body = w7After();
  if (week7Tab === "advisor") body = w7Advisor();
  return partToggle + tabs + `<div id="w7body">${body}</div>`;
}

// --- חלק א: טופס הכנה לחשיפה (דיגיטלי) ---
function w7Prep() {
  const d = S.getToolData(7, "prepForm") || {};
  const emoChips = PREP_EMOTIONS.map(e =>
    `<button class="chip mini prep-emo ${(d.emotions || []).includes(e) ? "on" : ""}" data-e="${e}">${e}</button>`).join("");
  const f = (key, label, ph) => `<label class="mini-label">${label}</label>
    <textarea class="ta prepf" data-f="${key}" placeholder="${esc(ph)}">${esc(d[key] || "")}</textarea>`;
  return `
    <div class="tool-block">
      <p class="hint">טופס הכנה לחשיפה — ממלאים <b>לפני</b> החשיפה. תכנון טוב מפחית הפתעות ומחזק את ההנהגה העצמית.</p>
      ${f("situation", "מצב שיש להיחשף אליו", "תאר את הסיטואציה שאליה תיחשף...")}
      ${f("autoThoughts", "מחשבות אוטומטיות שעולות בראשך לגבי המצב", "מה המוח אומר על המצב...")}
      <label class="mini-label">רגשות שאתה מניח שתרגיש בזמן האירוע</label>
      <div class="chip-row">${emoChips}</div>
      <input class="inp prepf" data-f="emotionOther" value="${esc(d.emotionOther || "")}" placeholder="אחר (פרט)...">
      ${f("distortions", "טעויות / עיוותי חשיבה", "איזה עיוות חשיבה מופיע כאן...")}
      <div class="prep-challenge">
        <div class="prep-ch-title">🔍 שאלות מאתגרות</div>
        ${f("sure", "האם אני בטוח ש...", "...")}
        ${f("evidence", "מה הן הראיות שיש לי שמוכיחות ש...", "...")}
        ${f("worst", "מה הדבר הכי גרוע שעלול לקרות? עד כמה זה גרוע?", "...")}
        ${f("alt", "האם קיים הסבר אחר אפשרי ל...", "...")}
      </div>
      ${f("altThoughts", "מחשבות חלופיות (שינוי במחשבות האוטומטיות אחרי אתגור)", "הניסוח המדויק והמאוזן יותר...")}
      ${f("rational", "תגובה רציונאלית — מנטרות הגיוניות וקצרות שיעזרו לי", "משפט קצר שיעזור לי בזמן החשיפה...")}
      ${f("goal", "המטרה", "היעד ההתנהגותי שלי לחשיפה הזאת...")}
      <button class="btn" id="savePrepForm">שמירה + טעינת האווטר</button>
    </div>`;
}
function collectPrepForm() {
  const d = {};
  app.querySelectorAll("#w7body .prepf").forEach(el => d[el.dataset.f] = el.value.trim());
  d.emotions = [...app.querySelectorAll("#w7body .prep-emo.on")].map(b => b.dataset.e);
  return d;
}

// --- חלק ב: טופס אחרי חשיפה (דיגיטלי) ---
function w7After() {
  const d = S.getToolData(7, "afterForm") || {};
  const f = (key, label, ph) => `<label class="mini-label">${label}</label>
    <textarea class="ta afterf" data-f="${key}" placeholder="${esc(ph)}">${esc(d[key] || "")}</textarea>`;
  return `
    <div class="tool-block">
      <p class="hint">טופס אחרי חשיפה — ממלאים <b>אחרי</b> החשיפה, כדי לעגן את הלמידה החדשה.</p>
      ${f("goalsAchieved", "האם השגת את היעדים ההתנהגותיים שכתבת בהכנה לחשיפה?", "...")}
      <div class="prep-challenge">
        <div class="prep-ch-title">🔍 בדיקה של מחשבות אוטומטיות בפועל</div>
        ${f("predicted", "האם המחשבות שצפית מראש אכן היו?", "...")}
        ${f("helped", "עד כמה ההבניה הקוגניטיבית סייעה לך להתגבר עליהן?", "...")}
        ${f("unexpected", "האם היו מחשבות בלתי צפויות — ומה עשית איתן?", "...")}
      </div>
      ${f("learned", "מה למדת?", "הלמידה החדשה מהחוויה הזאת...")}
      <button class="btn" id="saveAfterForm">שמירה + טעינת האווטר</button>
    </div>`;
}
function collectAfterForm() {
  const d = {};
  app.querySelectorAll("#w7body .afterf").forEach(el => d[el.dataset.f] = el.value.trim());
  return d;
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
      <label class="mini-label">יכולת ויסות עצמי שמעניקה לי ביטחון</label>
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
      <p class="hint">דרג את הפעולות שאתה נמנע מהן, מהקל אל הכבד. המטרה אינה שהפחד ייעלם, אלא <b>למידה חדשה</b>:
        "הפחד יכול להיות פה — ואני עדיין מתמודד". עולים דרגה כשנשארת, ויתרת על התנהגות ההצלה, ולמדת משהו חדש.</p>
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

function emptyRung() { return { desc: "", predict: "", actual: "", learning: "", stayed: false, droppedSafety: false }; }

function rungReady(r) { return !!r.stayed && !!r.droppedSafety && !!(r.learning && String(r.learning).trim()); }

function rungCard(r, i) {
  const ready = rungReady(r);
  return `
    <div class="rung" data-i="${i}">
      <div class="rung-head">
        <span class="rung-num">${i + 1}</span>
        <input class="inp rung-desc" data-f="desc" value="${esc(r.desc || "")}" placeholder="מה אני נמנע/מפחד ממנו">
        <button class="rung-del" data-del="${i}">✕</button>
      </div>
      <div class="rung-q">
        <label class="mini-label">לפני — מה אני מפחד שיקרה?</label>
        <textarea class="ta rung-ta" data-f="predict" placeholder="התרחיש שהמוח מנבא...">${esc(r.predict || "")}</textarea>
        <label class="mini-label">אחרי — מה קרה בפועל?</label>
        <textarea class="ta rung-ta" data-f="actual" placeholder="מה באמת קרה כשנשארתי...">${esc(r.actual || "")}</textarea>
        <label class="mini-label">למידה — מה המוח שלי צריך לקחת מהחוויה הזאת?</label>
        <textarea class="ta rung-ta" data-f="learning" placeholder="למשל: 'הפחד היה פה — ואני עדיין התמודדתי'">${esc(r.learning || "")}</textarea>
      </div>
      <div class="rung-checks">
        <label class="rung-check"><input type="checkbox" data-f="stayed" ${r.stayed ? "checked" : ""}> נשארתי עד שהתחושה ירדה בעצמה</label>
        <label class="rung-check"><input type="checkbox" data-f="droppedSafety" ${r.droppedSafety ? "checked" : ""}> ויתרתי על התנהגות ההצלה הרגילה שלי</label>
      </div>
      <span class="rung-drop ${ready ? "ready" : ""}" data-i="${i}">${ready ? "למידה חדשה נרשמה ✓ אפשר לעלות דרגה" : "נשארתי · ויתרתי על הצלה · רשמתי מה למדתי"}</span>
    </div>`;
}

function collectLadder() {
  const emotion = app.querySelector("[data-emo].on")?.dataset.emo || "";
  const rungs = [];
  app.querySelectorAll("#rungs .rung").forEach(el => {
    const r = {};
    el.querySelectorAll("[data-f]").forEach(inp => {
      r[inp.dataset.f] = inp.type === "checkbox" ? inp.checked : inp.value.trim();
    });
    rungs.push(r);
  });
  return { emotion, rungs };
}

// --- יומן חשיפות שבועי (יום · שעה · החשיפה) + תזכורת ליומן ---
function w7Journal() {
  const st = S.getState();
  const plan = S.getToolData(7, "exposurePlan") || {};
  const table = WEEK_DAYS.map(day => {
    const cell = plan[day];
    const activity = cell ? (typeof cell === "string" ? cell : (cell.activity || "")) : "";
    const time = cell && typeof cell === "object" ? (cell.time || "") : "";
    return `
    <div class="day-row exp-day-row" data-day="${day}">
      <div class="day-name">${day}</div>
      <input class="inp exp-day-time" type="time" value="${esc(time)}" aria-label="שעה ל${day}">
      <input class="inp exp-day-input" value="${esc(activity)}" placeholder="החשיפה שאתרגל ביום זה...">
    </div>`;
  }).join("");

  return `
    <div class="tool-block">
      <p class="hint">שבץ את החשיפות שתתרגל השבוע — יום, שעה והחשיפה עצמה. תרגול קבוע וחוזר הוא מה שמלמד
        את הגוף שהפחד עולה וחולף. אפשר לקחת דרגות מ<b>סולם הפחדים</b> או להתייעץ עם <b>יועץ החשיפות</b>.</p>

      <h4>יומן החשיפות השבועי שלי</h4>
      <div class="week-table">${table}</div>

      <div class="activation-actions">
        <button class="btn" id="saveExpPlan">שמירה + טעינת האווטר</button>
        <button class="btn ghost2" id="pdfExpPlan">⬇ הורדה כ-PDF</button>
      </div>

      <div class="cal-connect">
        <h4>🔔 הוספת החשיפות ליומן — לחודש</h4>
        <p class="hint">כל חשיפה תתווסף כאירוע חוזר שבועי <b>למשך חודש</b>, עם היום, השעה והחשיפה.
          שום דבר לא נשלח; אתה מאשר בעצמך את השמירה ביומן.</p>

        <div class="gcal-block">
          <div class="mini-label">📅 הוספה ישירה ליומן Google — לחיצה לכל יום:</div>
          ${expGcalLinks(plan)}
        </div>

        <div class="ics-block">
          <div class="mini-label">📥 או קובץ ליומן (Outlook / Apple / iPhone):</div>
          <input class="inp" id="expCalEmail" type="email" dir="ltr"
            placeholder="המייל שלך (לקובץ) — you@example.com" value="${esc(st.reminders.email || "")}">
          <button class="btn ghost2" id="expCalWeek">⬇ הורדת קובץ יומן (.ics)</button>
        </div>

        <p class="tiny-note">ימים ללא שעה יתווספו ל-09:00 כברירת מחדל.</p>
      </div>
    </div>`;
}

// קישורי Google לכל יום עם חשיפה
function expGcalLinks(plan) {
  const items = WEEK_DAYS.filter(day => {
    const c = plan[day];
    return c && (typeof c === "string" ? c : c.activity);
  });
  if (!items.length) return `<p class="subtle">מלא ושמור חשיפות בטבלה כדי לקבל קישורים ליומן Google.</p>`;
  return `<div class="chip-row">` + items.map(day => {
    const c = plan[day];
    const activity = typeof c === "string" ? c : c.activity;
    const time = typeof c === "object" ? (c.time || "") : "";
    return `<button class="chip gcal-link exp-gcal-link" data-gday="${day}">➕ ${day}${time ? " " + esc(time) : ""} · ${esc(activity)}</button>`;
  }).join("") + `</div>`;
}

function collectExpPlan() {
  const plan = {};
  app.querySelectorAll(".exp-day-row").forEach(row => {
    const day = row.dataset.day;
    const activity = row.querySelector(".exp-day-input")?.value.trim();
    const time = row.querySelector(".exp-day-time")?.value || "";
    if (activity) plan[day] = { time, activity };
  });
  return plan;
}

function openExpJournalPrint() {
  const st = S.getState();
  const plan = S.getToolData(7, "exposurePlan") || {};
  const today = new Date().toLocaleDateString("he-IL");
  const rows = WEEK_DAYS.map(day => {
    const cell = plan[day];
    const activity = cell ? (typeof cell === "string" ? cell : (cell.activity || "")) : "";
    const time = cell && typeof cell === "object" ? (cell.time || "") : "";
    return `<tr><td class="d">${day}</td><td class="t">${esc(time)}</td><td>${esc(activity)}</td><td class="c"></td></tr>`;
  }).join("");

  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
    <title>יומן חשיפות שבועי — שבוע 7</title>
    <style>
      body{font-family:"Segoe UI",Arial,sans-serif;color:#20353a;padding:32px;max-width:720px;margin:auto}
      h1{color:#0f766e;margin:0 0 4px} .sub{color:#6a8189;margin:0 0 20px}
      table{width:100%;border-collapse:collapse;margin-top:6px}
      th,td{border:1px solid #cfe0dc;padding:10px;text-align:right;font-size:14px}
      th{background:#eefaf6;color:#0f766e} td.d{font-weight:700;width:80px;background:#f6fbfa}
      td.t{width:64px;text-align:center;color:#0f766e;font-weight:700}
      td.c{width:60px} .meta{display:flex;gap:24px;color:#6a8189;font-size:13px;margin-bottom:16px}
      @media print{.noprint{display:none}}
      .btn{background:#0f766e;color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:15px;cursor:pointer}
    </style></head><body>
    <h1>יומן חשיפות שבועי</h1>
    <p class="sub">מסע 8 השבועות · שבוע 7 — פעולה למרות פחד</p>
    <div class="meta"><span>שם: ${esc(st.name) || "________"}</span><span>תאריך: ${today}</span></div>
    <table><thead><tr><th>יום</th><th>שעה</th><th>החשיפה שאתרגל</th><th>בוצע</th></tr></thead>
      <tbody>${rows}</tbody></table>
    <button class="btn noprint" onclick="window.print()">הדפסה / שמירה כ-PDF</button>
    <script>setTimeout(()=>window.print(),400)<\/script>
    </body></html>`;

  const w = window.open("", "_blank");
  if (!w) { toast("אפשר חלונות קופצים כדי להוריד PDF"); return; }
  w.document.write(html);
  w.document.close();
}

// --- יועץ חשיפות (סוכן AI) ---
function w7Advisor() {
  const prompt = S.getState().aiPrompts["exposure-advisor"];
  const chat = expAdvisorThread.length
    ? expAdvisorThread.map(m => chatBubble(m)).join("")
    : `<div class="chat-empty">${prompt?.icon || "🪜"} התייעץ על סוגי החשיפות שמתאימים לך.<br>
       <span class="subtle">ספר ממה אתה נמנע ואיזה רגש עולה — ואבנה איתך חשיפה בטוחה והדרגתית.</span></div>`;
  return `
    <div class="tool-block">
      <p class="hint">יועץ החשיפות עוזר לך לבחור <b>איזה סוג חשיפה</b> מתאים לך (במציאות · בדמיון · פנימית)
        ואילו חשיפות מעשיות אפשר לשבץ ביומן. ${S.getState().apiKey ? "" : "<b>שים לב:</b> ללא מפתח Claude API פעיל (בניהול) התשובות הן במצב הדגמה."}</p>
      <div class="chat" id="expChat">${chat}</div>
      <div class="chat-input">
        <textarea id="expMsg" class="ta" rows="2" placeholder="כתוב כאן... (למשל: אני נמנע מלנסוע ברכבת בגלל פחד מהתקף)"></textarea>
        <button class="btn send" id="expSend">שלח</button>
      </div>
    </div>`;
}

async function sendExpMsg() {
  const input = app.querySelector("#expMsg");
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  expAdvisorThread.push({ role: "user", content: text });
  const chat = app.querySelector("#expChat");
  chat.innerHTML = expAdvisorThread.map(m => chatBubble(m)).join("")
    + `<div class="bubble assistant typing">מקליד…</div>`;
  chat.scrollTop = chat.scrollHeight;

  const sys = S.getState().aiPrompts["exposure-advisor"].prompt;
  const reply = await askAI(sys, expAdvisorThread);
  expAdvisorThread.push({ role: "assistant", content: reply });
  S.logActivity("exposure", "התייעצות על חשיפות");
  const c2 = app.querySelector("#expChat");
  if (c2) {
    c2.innerHTML = expAdvisorThread.map(m => chatBubble(m)).join("");
    c2.scrollTop = c2.scrollHeight;
  }
}

function mountWeek7Handlers() {
  app.querySelectorAll("[data-w7part]").forEach(b =>
    b.addEventListener("click", () => {
      stashWeek7Drafts(); week7Part = b.dataset.w7part;
      const part = W7_PARTS.find(p => p.id === week7Part); week7Tab = part.tabs[0].id;
      renderChapter(7);
    }));
  app.querySelectorAll("[data-w7tab]").forEach(b =>
    b.addEventListener("click", () => { stashWeek7Drafts(); week7Tab = b.dataset.w7tab; renderChapter(7); }));

  // טופס הכנה לחשיפה
  app.querySelectorAll(".prep-emo").forEach(b => b.addEventListener("click", () => b.classList.toggle("on")));
  const spf = app.querySelector("#savePrepForm");
  if (spf) spf.addEventListener("click", () => {
    S.setToolData(7, "prepForm", collectPrepForm());
    S.logActivity("exercise", "הכנה לחשיפה");
    toast("נשמר ✓");
  });
  // טופס אחרי חשיפה
  const saf = app.querySelector("#saveAfterForm");
  if (saf) saf.addEventListener("click", () => {
    S.setToolData(7, "afterForm", collectAfterForm());
    S.logActivity("exposure", "אחרי חשיפה — למידה");
    toast("נשמר ✓");
  });

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

  // חשיפות פנימיות — שער בטיחות
  const iack = app.querySelector("#interoAck");
  if (iack) iack.addEventListener("change", () => {
    if (iack.checked) { S.setToolData(7, "interoAck", true); renderChapter(7); }
  });
  // חשיפות פנימיות — טבלה
  app.querySelectorAll(".exp-input").forEach(inp =>
    inp.addEventListener("change", () => {
      S.setToolData(4, "exposures", collectExposures());
      if (inp.classList.contains("exp-lvl-sel")) renderChapter(7); // שינוי רמה → מיון מחדש לקבוצות
    }));
  const ae = app.querySelector("#addExp");
  if (ae) ae.addEventListener("click", () => {
    const rows = collectExposures(); rows.push({ level: 2, sensation: "", exercise: "", duration: "", guidance: "" });
    S.setToolData(4, "exposures", rows); renderChapter(7);
  });
  app.querySelectorAll(".exp-del").forEach(b =>
    b.addEventListener("click", () => {
      const rows = collectExposures(); rows.splice(Number(b.dataset.del), 1);
      S.setToolData(4, "exposures", rows); renderChapter(7);
    }));
  const se = app.querySelector("#saveExp");
  if (se) se.addEventListener("click", () => { S.setToolData(4, "exposures", collectExposures()); toast("הטבלה נשמרה ✓"); });
  const pe = app.querySelector("#pdfExp");
  if (pe) pe.addEventListener("click", () => { S.setToolData(4, "exposures", collectExposures()); openExposurePrint(collectExposures()); });
  const re = app.querySelector("#resetExp");
  if (re) re.addEventListener("click", () => {
    if (confirm("לשחזר את טבלת ברירת המחדל? השינויים שלך יימחקו.")) {
      S.setToolData(4, "exposures", structuredClone(INTEROCEPTIVE_EXPOSURES)); renderChapter(7);
    }
  });

  // סולם פחדים
  app.querySelectorAll("[data-emo]").forEach(b => b.addEventListener("click", () => {
    app.querySelectorAll("[data-emo]").forEach(x => x.classList.remove("on")); b.classList.add("on");
    S.setToolData(7, "ladder", collectLadder());
  }));
  app.querySelectorAll("#rungs [data-f]").forEach(inp =>
    inp.addEventListener(inp.type === "checkbox" ? "change" : "input", () => {
      const rungEl = inp.closest(".rung");
      const r = {}; rungEl.querySelectorAll("[data-f]").forEach(x => r[x.dataset.f] = x.type === "checkbox" ? x.checked : x.value.trim());
      const badge = rungEl.querySelector(".rung-drop");
      const ready = rungReady(r);
      badge.textContent = ready ? "למידה חדשה נרשמה ✓ אפשר לעלות דרגה" : "נשארתי · ויתרתי על הצלה · רשמתי מה למדתי";
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
    L.rungs = EXPOSURE_EXAMPLES[key].map(desc => ({ ...emptyRung(), desc }));
    S.setToolData(7, "ladder", L); renderChapter(7);
  });
  const sl = app.querySelector("#saveLadder");
  if (sl) sl.addEventListener("click", () => {
    const L = collectLadder(); S.setToolData(7, "ladder", L);
    if (L.rungs.some(r => r.desc)) S.logActivity("exposure", "סולם פחדים");
    // מדדי הנהגה — נספרים לפי מה שבחרתי לעשות, לא לפי ירידת הפחד
    if (L.rungs.some(r => r.droppedSafety)) S.logActivity("exposure", "ויתרתי על התנהגות ביטחון");
    if (L.rungs.some(r => rungReady(r))) S.logActivity("exposure", "פעלתי למרות פחד");
    toast("הסולם נשמר ✓"); renderChapter(7);
  });
  const pl = app.querySelector("#pdfLadder");
  if (pl) pl.addEventListener("click", () => { S.setToolData(7, "ladder", collectLadder()); openLadderPrint(collectLadder()); });

  // יומן חשיפות
  const sep = app.querySelector("#saveExpPlan");
  if (sep) sep.addEventListener("click", () => {
    S.setToolData(7, "exposurePlan", collectExpPlan());
    S.logActivity("exposure", "יומן חשיפות");
    toast("היומן נשמר ✓");
    renderChapter(7);
  });
  const pep = app.querySelector("#pdfExpPlan");
  if (pep) pep.addEventListener("click", () => { S.setToolData(7, "exposurePlan", collectExpPlan()); openExpJournalPrint(); });

  // הוספה ישירה ליומן Google לכל יום חשיפה
  app.querySelectorAll(".exp-gcal-link").forEach(b =>
    b.addEventListener("click", () => {
      const day = b.dataset.gday;
      const row = [...app.querySelectorAll(".exp-day-row")].find(r => r.dataset.day === day);
      const activity = row?.querySelector(".exp-day-input")?.value.trim();
      const time = row?.querySelector(".exp-day-time")?.value || "09:00";
      if (!activity) return toast("אין חשיפה ליום זה");
      S.setToolData(7, "exposurePlan", collectExpPlan());
      window.open(googleEventUrl({ day, time: time || "09:00", activity, label: "חשיפה" }), "_blank", "noopener");
      toast(`נפתח יומן Google ליום ${day} — אשר את השמירה ✓`);
    }));

  // חיבור כל שבוע החשיפות ליומן דרך מייל
  const validEmail7 = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const ecw = app.querySelector("#expCalWeek");
  if (ecw) ecw.addEventListener("click", () => {
    const email = (app.querySelector("#expCalEmail")?.value || "").trim();
    if (!validEmail7(email)) return toast("הזן כתובת מייל תקינה");
    const plan = collectExpPlan();
    const events = Object.entries(plan).map(([day, v]) => ({
      day, time: v.time || "09:00", activity: v.activity,
    }));
    if (!events.length) return toast("הוסף לפחות חשיפה אחת לטבלה");
    S.setToolData(7, "exposurePlan", plan);
    S.setReminders({ email, enabled: true });
    downloadWeeklyICS({ events, email, label: "חשיפה" });
    toast(`קובץ עם ${events.length} ימים ירד — פתח אותו כדי להוסיף ליומן ✓`);
    renderChapter(7);
  });

  // יועץ חשיפות (סוכן AI)
  const es = app.querySelector("#expSend");
  if (es) es.addEventListener("click", sendExpMsg);
  const em = app.querySelector("#expMsg");
  if (em) em.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendExpMsg(); }
  });
}

function stashWeek7Drafts() {
  if (app.querySelectorAll(".prep-field").length) {
    const data = {}; app.querySelectorAll(".prep-field").forEach(f => data[f.dataset.p] = f.value.trim());
    S.setToolData(7, "prep", data);
  }
  if (app.querySelectorAll("#rungs .rung").length) S.setToolData(7, "ladder", collectLadder());
  if (app.querySelectorAll(".exp-day-row").length) S.setToolData(7, "exposurePlan", collectExpPlan());
  if (app.querySelectorAll(".exp-row").length) S.setToolData(4, "exposures", collectExposures());
  if (app.querySelector("#w7body .prepf")) S.setToolData(7, "prepForm", collectPrepForm());
  if (app.querySelector("#w7body .afterf")) S.setToolData(7, "afterForm", collectAfterForm());
}

function openLadderPrint(L) {
  const st = S.getState();
  const today = new Date().toLocaleDateString("he-IL");
  const body = L.rungs.map((r, i) => {
    const chk = (v) => v ? "✓" : "";
    return `<tr><td class="n">${i + 1}</td><td>${esc(r.desc || "")}</td><td>${esc(r.predict || "")}</td><td>${esc(r.actual || "")}</td><td>${esc(r.learning || "")}</td><td class="c">${chk(r.stayed)}</td><td class="c">${chk(r.droppedSafety)}</td></tr>`;
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
    <table><thead><tr><th>#</th><th>הפעולה / הפחד</th><th>מה פחדתי שיקרה</th><th>מה קרה בפועל</th><th>מה למדתי</th><th>נשארתי</th><th>ויתרתי על הצלה</th></tr></thead><tbody>${body}</tbody></table>
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
  { id: "relapse",  label: "טריגרים לנסיגה" },
  { id: "bonus",    label: "בונוסים" },
];
// דוגמאות לטריגרים שמסמנים נסיגה
const RELAPSE_EXAMPLES = ["הססנות", "קושי בקבלת החלטות", "ביקורת עצמית", "חוסר סבלנות",
  "חוסר עניין והנאה", "עייפות", "אכילת יתר", "חוסר תיאבון", "כבדות", "עצבנות",
  "מחשבות חרדתיות", "התמקדות בשלילי", "חוסר התלהבות", "פרפקציוניזם", "הימנעות חברתית", "גוף דרוך"];
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
  if (week8Tab === "relapse") body = w8Relapse();
  if (week8Tab === "bonus") body = w8Comm();
  return tabs + `<div id="w8body">${body}</div>`;
}

// --- טריגרים לנסיגה + מענה עצמי ---
function w8Relapse() {
  const d = S.getToolData(8, "relapse") || {};
  const t = d.triggers || ["", "", ""];
  const chips = RELAPSE_EXAMPLES.map(x => `<button class="chip mini relapse-ex" data-x="${esc(x)}">${esc(x)}</button>`).join("");
  return `
    <div class="tool-block">
      <p class="hint">מפת נסיגה — לזהות מראש את הסימנים שאני מתחיל להיסחף, ולהכין לעצמי מענה מתוך מה שכבר למדתי במסע.</p>
      <h5>🚩 אלו 3 טריגרים מסמנים לי שאני בנסיגה?</h5>
      <p class="hint">לחץ על דוגמה כדי למלא, או כתוב משלך:</p>
      <div class="chip-row" style="margin-bottom:10px">${chips}</div>
      <input class="inp relapse-t" data-i="0" value="${esc(t[0] || "")}" placeholder="טריגר 1">
      <input class="inp relapse-t" data-i="1" value="${esc(t[1] || "")}" placeholder="טריגר 2">
      <input class="inp relapse-t" data-i="2" value="${esc(t[2] || "")}" placeholder="טריגר 3">
      <h5 style="margin-top:12px">💪 מה המענה שאני אתן לעצמי ברגע שאני בנסיגה?</h5>
      <p class="hint">מתוך מה שכבר למדתי — איך אני, המבוגר המיטיב, מנהיג את עצמי חזרה?</p>
      <textarea class="ta" id="relapseResponse" placeholder="המענה שלי לעצמי...">${esc(d.response || "")}</textarea>
      <button class="btn" id="saveRelapse">שמירה + טעינת האווטר</button>
    </div>`;
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
      <p class="hint">🎁 בונוס — כלים נוספים שיעזרו לך לחיות מתוך הערכים גם במערכות היחסים שלך.</p>
    </div>
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

  // טריגרים לנסיגה
  app.querySelectorAll(".relapse-ex").forEach(b => b.addEventListener("click", () => {
    const inputs = [...app.querySelectorAll(".relapse-t")];
    const empty = inputs.find(i => !i.value.trim());
    if (empty) empty.value = b.dataset.x; else toast("שלושת הטריגרים מלאים");
  }));
  const srl = app.querySelector("#saveRelapse");
  if (srl) srl.addEventListener("click", () => {
    const triggers = [...app.querySelectorAll(".relapse-t")].map(i => i.value.trim());
    const response = qv("#relapseResponse");
    S.setToolData(8, "relapse", { triggers, response });
    if (triggers.some(Boolean) || response) S.logActivity("exercise", "מפת נסיגה");
    toast("נשמר ✓");
  });

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
    if (vals.some(Boolean)) S.logActivity("values", "בחירת ערכים");
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
  if (app.querySelector("#relapseResponse") || app.querySelector(".relapse-t"))
    S.setToolData(8, "relapse", { triggers: [...app.querySelectorAll(".relapse-t")].map(i => i.value.trim()), response: qv("#relapseResponse") });
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
  mountMedLog(); // רישום האזנה למדיטציות בכל פרק שמציג אותן
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

  // סריקה ורגיעה — סריקת גוף + נשימה מונחית
  mountScanBreathHandlers();

  // חלק 1 — רגש
  app.querySelectorAll("[data-emotion]").forEach(b =>
    b.addEventListener("click", () => {
      if (b.dataset.emotion === "__other__") { week1EmoOther = true; renderChapter(1); app.querySelector("#w1EmoOther")?.focus(); }
      else { week1EmoOther = false; S.setEmotion(b.dataset.emotion); renderChapter(1); }
    }));
  const w1es = app.querySelector("#w1EmoSave");
  if (w1es) w1es.addEventListener("click", () => {
    const v = app.querySelector("#w1EmoOther").value.trim();
    if (!v) return toast("כתוב את הרגש");
    week1EmoOther = false; S.setEmotion(v); renderChapter(1);
  });
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

// מאמנים שלא מוצגים במסך "מאמן AI" (thought-checker עדיין משמש את הכלי בשבוע 5)
const HIDDEN_COACH_TOOLS = ["emotion-helper", "thought-checker"];

// "מראה טיפולית" — 4 פעולות סגורות של השיטה, במקום צ'אט פתוח בלבד
const COACH_ACTIONS = [
  { icon: "🔁", label: "לזהות את המעגל", seed: "עזור לי לזהות את המעגל שהחלק המפוחד מפעיל בי עכשיו — הטריגר, המחשבה, התחושה, התגובה ופעולת ההצלה. שאל אותי שאלה אחת בכל פעם." },
  { icon: "🍃", label: "הפרדה ממחשבה", seed: "עזור לי לעשות הפרדה (אי-הזדהות) מהמחשבה שמטרידה אותי עכשיו, כך שאני אשים לב שאני חושב אותה במקום להיות בתוכה." },
  { icon: "🏠", label: "תגובת הורה מיטיב", seed: "עזור לי לנסח תגובה של הורה פנימי מיטיב לחלק שמפחד בי עכשיו — באימות, בחמלה ובקול יציב." },
  { icon: "🧭", label: "פעולה מבוססת ערך", seed: "עזור לי לבחור פעולה קטנה אחת מבוססת ערך לצעד הבא שלי, גם אם הפחד עדיין נוכח." },
];

function renderCoach() {
  const st = S.getState();
  coachTool = "mirror"; // המאמן הוא "מראה טיפולית" אחת עם 4 פעולות — בלי לשוניות מאמנים
  const thread = coachThreads[coachTool] || [];

  app.innerHTML = `
    <header class="topbar"><div><div class="greeting">🪞 המראה הטיפולית</div>
      <div class="subtle">${st.apiKey ? "מחובר ל-Claude" : "מצב הדגמה — ללא מפתח API"}</div></div></header>

    <section class="card coach-actions-card">
      <div class="coach-actions-title">מה אתה צריך עכשיו?</div>
      <div class="coach-actions">
        ${COACH_ACTIONS.map((a, i) => `<button class="coach-action" data-seed="${i}">
          <span class="ca-ico">${a.icon}</span><span>${a.label}</span></button>`).join("")}
      </div>
    </section>

    <div class="chat" id="chat">
      ${thread.length ? thread.map(m => chatBubble(m)).join("")
        : `<div class="chat-empty">🪞 בחר למעלה מה אתה צריך עכשיו — או כתוב בעצמך למטה.</div>`}
    </div>

    <div class="chat-input">
      <textarea id="msg" class="ta" rows="2" placeholder="כתוב כאן..."></textarea>
      <button class="btn send" id="send">שלח</button>
    </div>
  `;

  app.querySelectorAll(".coach-action").forEach(b =>
    b.addEventListener("click", () => {
      const a = COACH_ACTIONS[Number(b.dataset.seed)];
      if (!a) return;
      const m = app.querySelector("#msg"); m.value = a.seed; sendMsg();
    }));

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

  const prompts = S.getState().aiPrompts;
  const sys = (prompts[coachTool] || prompts["mirror"] || prompts["alt-thoughts"] || {}).prompt || "";
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
    <header class="topbar chapter-head">
      <button class="back-btn" id="backHome">›</button>
      <div><div class="greeting">⚙️ ניהול והגדרות</div>
      <div class="subtle">אזור המנחה</div></div></header>

    <section class="card">
      <h3>🔒 קוד מנחה (PIN)</h3>
      <p class="subtle">קוד שנועל את מסך הניהול הזה בפני משתתפים. כשקוד מוגדר — הכניסה לניהול תדרוש אותו.
        גישה למנחה: לחיצה ארוכה על הכותרת במסך הבית, או הוספת <b dir="ltr">#admin</b> לכתובת.</p>
      <input id="setPin" class="inp" type="text" inputmode="numeric" value="${esc(st.adminPin || "")}" placeholder="למשל 1234 — ריק = ללא נעילה">
      <button class="btn" id="savePin">שמירת הקוד</button>
    </section>

    <section class="card">
      <h3>📢 הפצת תוכן לכל הלקוחות</h3>
      <p class="subtle">מדיטציות, ספריית מדיטציות וסרטוני פרקים שאתה מוסיף נשמרים כרגע במכשיר שלך בלבד.
        כדי שיופיעו <b>אצל כל הלקוחות</b>: לחץ “ייצוא”, ואז העלה את הקובץ <b dir="ltr">content.json</b>
        לתיקיית הריפו (כמו שאתה מעלה קבצים אחרים). תוך דקה זה יופיע לכולם.</p>
      <button class="btn" id="publishContent">⬇ ייצוא content.json</button>
    </section>

    <section class="card">
      <h3>👤 פרטים</h3>
      <label class="field">שם המשתתף
        <input id="setName" class="inp" value="${esc(st.name)}" placeholder="שם">
      </label>
      <label class="onb-label">לשון פנייה (מגדר)</label>
      <div class="chip-row">
        <button class="chip ${st.gender !== "f" ? "on" : ""}" data-setgender="m">זכר</button>
        <button class="chip ${st.gender === "f" ? "on" : ""}" data-setgender="f">נקבה</button>
      </div>
    </section>

    <section class="card">
      <h3>🎨 תצוגה</h3>
      <label class="onb-check" style="justify-content:space-between">
        <span>🌙 מצב כהה</span>
        <input type="checkbox" id="setTheme" ${st.theme === "dark" ? "checked" : ""}>
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
      ${Object.entries(st.aiPrompts).filter(([id]) => !HIDDEN_COACH_TOOLS.includes(id)).map(([id, t]) => `
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

    <section class="card">
      <h3>💾 גיבוי ושחזור</h3>
      <p class="subtle">ההתקדמות נשמרת רק במכשיר הזה. הורד קובץ גיבוי מדי פעם — כדי לא לאבד
        אותה אם תנקה את הדפדפן או תחליף מכשיר.</p>
      <div class="med-actions">
        <button class="btn" id="backupDownload">⬇ הורדת קובץ גיבוי</button>
        <button class="btn ghost2" id="backupRestore">⬆ שחזור מקובץ</button>
      </div>
      <input type="file" id="backupFile" accept="application/json,.json" hidden>
    </section>

    <section class="card danger">
      <h3>איפוס</h3>
      <button class="btn ghost" id="reset">איפוס כל הנתונים במכשיר</button>
    </section>
  `;

  app.querySelector("#backHome").addEventListener("click", () => go("home"));
  app.querySelector("#savePin").addEventListener("click", () => {
    S.setAdminPin(app.querySelector("#setPin").value);
    adminUnlocked = true;
    toast(S.getAdminPin() ? "הקוד נשמר 🔒 — ביציאה מהניהול הוא יינעל, וכניסה חוזרת תדרוש קוד" : "הנעילה בוטלה");
  });
  app.querySelector("#publishContent").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([S.exportPublishedContent()], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "content.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("content.json ירד — העלה אותו לריפו ✓");
  });
  app.querySelector("#setName").addEventListener("change", e => S.setName(e.target.value.trim()));
  app.querySelectorAll("[data-setgender]").forEach(b => b.addEventListener("click", () => {
    S.setGender(b.dataset.setgender); renderSettings(); toast("לשון הפנייה עודכנה");
  }));
  app.querySelector("#setTheme").addEventListener("change", e => {
    const t = e.target.checked ? "dark" : "light"; S.setTheme(t); applyTheme(t); render();
  });
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

  // גיבוי ושחזור
  app.querySelector("#backupDownload").addEventListener("click", () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(new Blob([S.exportState()], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `masa8-backup-${stamp}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("קובץ הגיבוי ירד ✓");
  });
  const backupFile = app.querySelector("#backupFile");
  app.querySelector("#backupRestore").addEventListener("click", () => backupFile.click());
  backupFile.addEventListener("change", () => {
    const file = backupFile.files[0];
    if (!file) return;
    if (!confirm("שחזור יחליף את כל ההתקדמות הנוכחית בקובץ הגיבוי. להמשיך?")) { backupFile.value = ""; return; }
    const reader = new FileReader();
    reader.onload = () => {
      try { S.importState(reader.result); toast("שוחזר בהצלחה ✓"); setTimeout(() => location.reload(), 600); }
      catch (e) { toast("קובץ גיבוי לא תקין"); }
      backupFile.value = "";
    };
    reader.readAsText(file);
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

    <section class="card breath-card">
      <div class="card-head"><h3>🫁 נשימה מודרכת</h3></div>
      <p class="subtle">תרגול נשימה עם אנימציה שמובילה אותך — שאיפה, החזקה, נשיפה. מרגיע את מערכת העצבים תוך דקות.</p>
      <button class="btn" id="openBreath">פתיחת נגן הנשימה ▶</button>
    </section>
    ${!lib.length ? `<div class="card"><p class="subtle">עדיין אין נושאים. אפשר להוסיף במסך הניהול.</p></div>` : ""}
    ${lib.map(t => `
      <section class="card">
        <h3>${esc(t.topic)}</h3>
        ${t.items.length ? t.items.map(m => `
          <div class="med-item">
            <div class="med-name">🎧 ${esc(m.name || "מדיטציה")}</div>
            ${m.link || m.file ? `<div class="med-actions">
              ${m.link ? `<a class="btn ghost2 med-log" data-medname="${esc(m.name || "מדיטציה")}" href="${esc(m.link)}" target="_blank" rel="noopener">▶ האזנה / צפייה</a>` : ""}
              ${m.file ? `<a class="btn ghost2" href="${esc(m.file)}" target="_blank" rel="noopener">⬇ קובץ</a>` : ""}
            </div>` : `<div class="tiny-note">טרם הוגדר קישור.</div>`}
          </div>`).join("") : `<p class="subtle">אין עדיין מדיטציות בנושא זה.</p>`}
      </section>`).join("")}
    ${lib.length && !hasAny ? `<p class="tools-note">הוסף מדיטציות לנושאים במסך הניהול ⚙️</p>` : ""}
  `;
  app.querySelector("#openBreath").addEventListener("click", () => openBreathingPlayer());
  mountMedLog();
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
// ערך שדה טקסט לפי סלקטור (מקוצר)
function qv(sel) { return (app.querySelector(sel)?.value || "").trim(); }

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
//  ערכת "רגע קשה" (SOS) — נגישה מכל מסך
// ============================================================
let sosFab = null;
let sosView = "menu";
let sosPhraseIdx = 0;

function mountSOS() {
  if (sosFab) return;
  sosFab = document.createElement("button");
  sosFab.id = "sosFab"; sosFab.className = "sos-fab";
  sosFab.innerHTML = "🫂 רגע קשה";
  sosFab.title = "צריך רגע? לחץ כאן";
  sosFab.addEventListener("click", openSOS);
  document.body.appendChild(sosFab);
}
function updateSOSVisibility() {
  if (sosFab) sosFab.style.display = S.isOnboarded() ? "" : "none";
}
function openSOS() { sosView = "menu"; renderSOS(); }
function closeSOS() { document.getElementById("sosOverlay")?.remove(); }

function renderSOS() {
  let ov = document.getElementById("sosOverlay");
  if (!ov) { ov = document.createElement("div"); ov.id = "sosOverlay"; ov.className = "sos-overlay"; document.body.appendChild(ov); }
  let body = "";
  if (sosView === "menu") {
    body = `
      <div class="sos-emoji">🫂</div>
      <h2>רגע קשה? אני כאן איתך</h2>
      <p class="sos-sub">${G("אתה בטוח", "את בטוחה")}. מה ש${G("אתה מרגיש", "את מרגישה")} הוא גל — הוא יעלה ויחלוף. ${G("בוא", "בואי")} נעבור אותו יחד, צעד אחד.</p>
      <div class="sos-menu">
        <button class="sos-item" data-sos="breath"><span>🫁</span> נשימה מרגיעה</button>
        <button class="sos-item" data-sos="ground"><span>🖐️</span> עיגון 5-4-3-2-1</button>
        <button class="sos-item" data-sos="safe"><span>🏝️</span> המקום הבטוח שלי</button>
        <button class="sos-item" data-sos="phrase"><span>💗</span> משפט שמרגיע אותי</button>
      </div>
      <div class="sos-hotlines">
        <div class="sos-hot-title">אם קשה מאוד — לא צריך להיות לבד:</div>
        ${HOTLINES.map(h => h.phone
          ? `<a class="sos-hot" href="tel:${h.phone.replace(/[^0-9]/g, "")}">${esc(h.name)} · ${esc(h.phone)}</a>`
          : `<a class="sos-hot" href="${esc(h.url)}" target="_blank" rel="noopener">${esc(h.name)}</a>`).join("")}
      </div>`;
  } else if (sosView === "ground") {
    body = `
      <div class="sos-emoji">🖐️</div>
      <h2>עיגון 5-4-3-2-1</h2>
      <p class="sos-sub">מחזירים את תשומת הלב לכאן ועכשיו, דרך החושים.</p>
      <div class="ground-list">
        ${GROUNDING_STEPS.map(s => `<div class="ground-row"><span class="ground-n">${s.n}</span>
          <div><b>${esc(s.sense)}</b><div class="subtle">${esc(s.prompt)}</div></div></div>`).join("")}
      </div>
      <button class="btn sos-back" data-sos="menu">חזרה</button>`;
  } else if (sosView === "safe") {
    const safe = (S.getToolData(7, "prep") || {}).safePlace;
    body = `
      <div class="sos-emoji">🏝️</div>
      <h2>המקום הבטוח שלי</h2>
      ${safe ? `<p class="sos-safe">${esc(safe).replace(/\n/g, "<br>")}</p>`
        : `<p class="sos-sub">עצום עיניים ודמיין מקום שבו אתה מרגיש בטוח ורגוע — חוף, יער, חדר ילדות.
           ראה את הצבעים, שמע את הצלילים, הרגש את החום. אתה יכול לחזור לשם בכל רגע.</p>`}
      <button class="btn sos-back" data-sos="menu">חזרה</button>`;
  } else if (sosView === "phrase") {
    body = `
      <div class="sos-emoji">💗</div>
      <h2>קח נשימה, ותקרא לאט</h2>
      <p class="sos-phrase">${esc(CALMING_PHRASES[sosPhraseIdx % CALMING_PHRASES.length])}</p>
      <div class="sos-actions">
        <button class="btn ghost2" id="sosMore">משפט נוסף</button>
        <button class="btn sos-back" data-sos="menu">חזרה</button>
      </div>`;
  }
  ov.innerHTML = `<button class="sos-close" id="sosClose" aria-label="סגירה">✕</button>
    <div class="sos-inner">${body}</div>`;
  ov.querySelector("#sosClose").addEventListener("click", closeSOS);
  ov.querySelectorAll("[data-sos]").forEach(b => b.addEventListener("click", () => {
    const v = b.dataset.sos;
    if (v === "breath") { closeSOS(); openBreathingPlayer({ patternId: "478" }); return; }
    sosView = v; renderSOS();
  }));
  const more = ov.querySelector("#sosMore");
  if (more) more.addEventListener("click", () => { sosPhraseIdx++; renderSOS(); });
}

// ============================================================
//  הצעת התקנה למסך הבית (PWA)
// ============================================================
let deferredInstall = null;
function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function installDismissed() { return localStorage.getItem("masa8_install_dismissed") === "1"; }

function installBanner() {
  if (installDismissed() || isStandalone()) return "";
  if (deferredInstall) return `
    <div class="install-banner" id="installBanner">
      <span>📲 התקן את האפליקציה למסך הבית — גישה מהירה ועבודה גם אופליין.</span>
      <div class="install-actions">
        <button class="btn" id="installBtn">התקנה</button>
        <button class="btn ghost2" id="installX">לא עכשיו</button>
      </div>
    </div>`;
  if (isIOS()) return `
    <div class="install-banner" id="installBanner">
      <span>📲 להתקנה: הקש על <b>שיתוף</b> ⬆ ואז <b>“הוסף למסך הבית”</b>.</span>
      <div class="install-actions"><button class="btn ghost2" id="installX">הבנתי</button></div>
    </div>`;
  return "";
}
function mountInstallBanner() {
  const btn = app.querySelector("#installBtn");
  if (btn) btn.addEventListener("click", async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    try { await deferredInstall.userChoice; } catch (e) {}
    deferredInstall = null;
    app.querySelector("#installBanner")?.remove();
  });
  const x = app.querySelector("#installX");
  if (x) x.addEventListener("click", () => {
    localStorage.setItem("masa8_install_dismissed", "1");
    app.querySelector("#installBanner")?.remove();
  });
}
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); deferredInstall = e;
  if (route === "home" && S.isOnboarded()) renderHome();
});
window.addEventListener("appinstalled", () => { deferredInstall = null; });

// ============================================================
//  אתחול
// ============================================================
window.addEventListener("state:changed", () => { /* עתידי: סנכרון */ });

// תוכן מרכזי מהמנחה — מגיע לכל הלקוחות (מדיטציות/ספרייה/סרטונים)
async function loadPublishedContent() {
  try {
    const res = await fetch("./content.json", { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    if (S.applyPublishedContent(json)) render();
  } catch (e) { /* אין קובץ תוכן / אופליין — ממשיכים עם ברירות המחדל */ }
}

applyTheme(S.getTheme());
mountSOS();
startReminderLoop();
startTimeTracker();
render();
loadPublishedContent();
