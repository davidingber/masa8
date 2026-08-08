// ============================================================
//  ניהול מצב — נשמר מקומית (localStorage) לכל מכשיר
// ============================================================
import { DEFAULT_AI_PROMPTS, DEFAULT_MEDITATIONS } from "./data.js";

const KEY = "masa8_state_v1";

const DEFAULT_STATE = {
  name: "",
  goal: "",
  emotion: { name: "", ratings: [] }, // ratings: [{date, value}]
  activities: [],                     // [{type, date, note}]
  chapters: {},                       // { "1": { tasks: {0:true}, tools:{...} } }
  aiPrompts: null,                    // ייטען מברירת המחדל אם ריק
  meditations: null,                  // ייטען מברירת המחדל אם ריק
  apiKey: "",
  reminders: { enabled: false, time: "09:00", lastFired: null, email: "" },
  externalTools: {},                  // { "4": [{name,url}] } ווים לכלים חיצוניים
  timeLog: {},                        // { "2026-W32": שניות } זמן עבודה לפי שבוע
  chapterVideos: {},                  // { "1": "url" } סרטון הקלטה לכל פרק
  medLibrary: null,                   // ספריית מדיטציות לפי נושאים
  onboarded: false,                   // האם עבר את מסך הקליטה
  theme: "light",                     // "light" | "dark"
  badgesSeen: [],                     // מזהי מדליות שכבר נחגגו
  adminPin: "",                       // קוד מנחה לנעילת מסך הניהול (ריק = פתוח)
  createdAt: null,
};

// ספריית מדיטציות ברירת מחדל (נושאים לדוגמה — ניתן לערוך)
const DEFAULT_MED_LIBRARY = [
  { topic: "להירדם מהר", items: [] },
  { topic: "להרגיע התקף חרדה", items: [] },
];

// מפתח שבוע ISO (שנה-שבוע)
function weekKey(d = new Date()) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((dt - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return dt.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw);
    const merged = { ...structuredClone(DEFAULT_STATE), ...parsed };
    // מיזוג כלי AI חדשים שנוספו מאז (כמו בודק המחשבות), בלי לדרוס עריכות קיימות
    merged.aiPrompts = merged.aiPrompts || {};
    for (const [id, def] of Object.entries(DEFAULT_AI_PROMPTS)) {
      if (!merged.aiPrompts[id]) merged.aiPrompts[id] = structuredClone(def);
    }
    // מיזוג מדיטציות חדשות שנוספו (לפי id), בלי לדרוס עריכות
    merged.meditations = merged.meditations || structuredClone(DEFAULT_MEDITATIONS);
    for (const def of DEFAULT_MEDITATIONS) {
      if (!merged.meditations.some(m => m.id === def.id)) merged.meditations.push(structuredClone(def));
    }
    if (!merged.medLibrary) merged.medLibrary = structuredClone(DEFAULT_MED_LIBRARY);
    return merged;
  } catch (e) {
    return fresh();
  }
}

function fresh() {
  const s = structuredClone(DEFAULT_STATE);
  s.createdAt = new Date().toISOString();
  s.aiPrompts = structuredClone(DEFAULT_AI_PROMPTS);
  s.meditations = structuredClone(DEFAULT_MEDITATIONS);
  s.medLibrary = structuredClone(DEFAULT_MED_LIBRARY);
  return s;
}

export function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("state:changed"));
}

export function getState() {
  return state;
}

// ---- ערכת נושא ----
export function getTheme() { return state.theme === "dark" ? "dark" : "light"; }
export function setTheme(t) { state.theme = t === "dark" ? "dark" : "light"; save(); }

// ---- מדליות שנחגגו ----
export function getBadgesSeen() { return state.badgesSeen || (state.badgesSeen = []); }
export function setBadgesSeen(ids) { state.badgesSeen = ids; save(); }

// ---- קוד מנחה (PIN) לנעילת מסך הניהול ----
export function getAdminPin() { return state.adminPin || ""; }
export function setAdminPin(pin) { state.adminPin = String(pin || "").trim(); save(); }

// ---- קליטה (Onboarding) ----
export function isOnboarded() {
  return !!(state.onboarded || state.name || state.activities.length || state.emotion?.ratings?.length);
}
export function setOnboarded() { state.onboarded = true; save(); }

// ---- מטרה ורגש ----
export function setGoal(goal) { state.goal = goal; save(); }
export function setName(name) { state.name = name; save(); }

export function setEmotion(name) {
  if (state.emotion.name !== name) {
    state.emotion = { name, ratings: [] };
  }
  save();
}

export function logEmotionRating(value) {
  state.emotion.ratings.push({ date: new Date().toISOString(), value: Number(value) });
  save();
}

export function setEmotionTarget(target) {
  state.emotion.target = target;
  save();
}

// ---- פעולות שטוענות את האווטר ----
export function logActivity(type, note = "") {
  state.activities.push({ type, date: new Date().toISOString(), note });
  save();
}

// ---- משימות פרקים ----
export function toggleTask(week, index) {
  const w = String(week);
  state.chapters[w] = state.chapters[w] || { tasks: {}, tools: {} };
  state.chapters[w].tasks[index] = !state.chapters[w].tasks[index];
  save();
}

export function isTaskDone(week, index) {
  const w = state.chapters[String(week)];
  return !!(w && w.tasks && w.tasks[index]);
}

export function saveToolEntry(week, toolType, data) {
  const w = String(week);
  state.chapters[w] = state.chapters[w] || { tasks: {}, tools: {} };
  state.chapters[w].tools[toolType] = state.chapters[w].tools[toolType] || [];
  state.chapters[w].tools[toolType].push({ date: new Date().toISOString(), ...data });
  save();
}

export function getToolEntries(week, toolType) {
  const w = state.chapters[String(week)];
  return (w && w.tools && w.tools[toolType]) || [];
}

// ערך יחיד לכלי (נשמר ומוחלף, לא נצבר) — למשל יומן פעילות / דיקנס / זהות
export function setToolData(week, key, value) {
  const w = String(week);
  state.chapters[w] = state.chapters[w] || { tasks: {}, tools: {}, data: {} };
  state.chapters[w].data = state.chapters[w].data || {};
  state.chapters[w].data[key] = value;
  save();
}

export function getToolData(week, key) {
  const w = state.chapters[String(week)];
  return (w && w.data && w.data[key]) || null;
}

// ---- הגדרות ----
export function setApiKey(k) { state.apiKey = k; save(); }
export function setAiPrompt(toolId, prompt) {
  state.aiPrompts = state.aiPrompts || {};
  state.aiPrompts[toolId] = state.aiPrompts[toolId] || {};
  state.aiPrompts[toolId].prompt = prompt;
  save();
}
export function setReminders(r) { state.reminders = { ...state.reminders, ...r }; save(); }

export function getMeditations() {
  if (!state.meditations) state.meditations = structuredClone(DEFAULT_MEDITATIONS);
  return state.meditations;
}
export function getMeditationsByWeek(week) {
  return getMeditations().filter(m => (m.week || 2) === week);
}
export function setMeditationField(id, field, value) {
  const meds = getMeditations();
  const m = meds.find(x => x.id === id);
  if (m) { m[field] = value; save(); }
}
export function addExternalTool(week, tool) {
  const w = String(week);
  state.externalTools[w] = state.externalTools[w] || [];
  state.externalTools[w].push(tool);
  save();
}

// ============================================================
//  חישוב "טעינה" של האווטר (0–100)
// ============================================================
import { ACTIVITY_TYPES } from "./data.js";

export function computeCharge() {
  let points = 0;
  for (const a of state.activities) {
    points += (ACTIVITY_TYPES[a.type]?.points || 3);
  }
  // משימות שהושלמו
  for (const w of Object.values(state.chapters)) {
    if (w.tasks) points += Object.values(w.tasks).filter(Boolean).length * 2;
  }
  // דירוגי רגש (עצם המעקב)
  points += state.emotion.ratings.length * 1;
  return Math.min(100, points);
}

export function avatarStage(charge = computeCharge()) {
  return Math.min(5, Math.floor(charge / 20)); // 0..5
}

// סטטיסטיקות מהירות
export function stats() {
  const counts = { exercise: 0, thought: 0, exposure: 0, joy: 0, meditation: 0, values: 0 };
  for (const a of state.activities) if (counts[a.type] !== undefined) counts[a.type]++;
  const tasksDone = Object.values(state.chapters)
    .reduce((n, w) => n + (w.tasks ? Object.values(w.tasks).filter(Boolean).length : 0), 0);
  return { counts, tasksDone, total: state.activities.length };
}

// ---- סרטון לכל פרק ----
export function setChapterVideo(week, url) {
  state.chapterVideos = state.chapterVideos || {};
  state.chapterVideos[String(week)] = url;
  save();
}
export function getChapterVideo(week) {
  return (state.chapterVideos && state.chapterVideos[String(week)]) || "";
}

// ---- ספריית מדיטציות לפי נושאים ----
export function getMedLibrary() {
  if (!state.medLibrary) state.medLibrary = structuredClone(DEFAULT_MED_LIBRARY);
  return state.medLibrary;
}
export function addMedTopic(name) {
  getMedLibrary().push({ topic: name, items: [] }); save();
}
export function deleteMedTopic(idx) {
  getMedLibrary().splice(idx, 1); save();
}
export function addMedItem(topicIdx) {
  getMedLibrary()[topicIdx].items.push({ name: "", link: "", file: "" }); save();
}
export function updateMedItem(topicIdx, itemIdx, field, value) {
  getMedLibrary()[topicIdx].items[itemIdx][field] = value; save();
}
export function deleteMedItem(topicIdx, itemIdx) {
  getMedLibrary()[topicIdx].items.splice(itemIdx, 1); save();
}

// ---- מעקב זמן עבודה שבועי ----
export function addWorkTime(seconds) {
  const k = weekKey();
  state.timeLog = state.timeLog || {};
  state.timeLog[k] = (state.timeLog[k] || 0) + seconds;
  save();
}
export function getWeekWorkTime() {
  return (state.timeLog && state.timeLog[weekKey()]) || 0;
}

export function resetAll() {
  state = fresh();
  save();
}

// ---- רצף ימים (streak) ----
// יום "פעיל" = יום שבו נרשמה פעולה כלשהי או דירוג רגש.
export function getStreak() {
  const days = new Set();
  for (const a of state.activities) if (a.date) days.add(a.date.slice(0, 10));
  for (const r of (state.emotion?.ratings || [])) if (r.date) days.add(r.date.slice(0, 10));
  if (!days.size) return 0;
  const dayMs = 86400000;
  const key = d => new Date(d).toISOString().slice(0, 10);
  let cur = new Date();
  if (!days.has(key(cur))) cur = new Date(cur.getTime() - dayMs); // גרייס: היום עוד לא נעשה — סופרים עד אתמול
  let streak = 0;
  while (days.has(key(cur))) { streak++; cur = new Date(cur.getTime() - dayMs); }
  return streak;
}

// ---- גיבוי ושחזור ----
export function exportState() {
  return JSON.stringify(state, null, 2);
}
export function importState(json) {
  const parsed = JSON.parse(json); // זורק אם לא תקין
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("קובץ לא תקין");
  localStorage.setItem(KEY, JSON.stringify(parsed)); // load() ימזג ברירות מחדל בטעינה הבאה
  return true;
}
