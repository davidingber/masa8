// ============================================================
//  סנכרון לגוגל דרייב של המשתמש (Google Drive · appDataFolder)
//  ההתקדמות נשמרת בקובץ מוסתר בדרייב הפרטי של המשתמש עצמו,
//  כך שמכל מכשיר שבו הוא מתחבר עם אותו חשבון גוגל — הנתונים זהים.
//  אין שרת משלנו: הכול רץ מהדפדפן מול ה-API של גוגל.
// ============================================================
import * as S from "./state.js";

// מזהה הלקוח מ-Google Cloud (לא סוד — מיועד לדפדפן)
const CLIENT_ID = "816880058586-v7t2us1vbjq9g8rm1tfb8du2vok5408n.apps.googleusercontent.com";

// רשימת מאושרים: קישור CSV מגיליון גוגל שפורסם לאינטרנט.
// ריק = אין בדיקת רשימה (כניסה מותרת לכל מי שמשלים התחברות — למשל לפי Test users).
// כשמוגדר: רק מיילים שמופיעים בגיליון יורשו להיכנס.
const ALLOWLIST_CSV_URL = "";
// טופס "בקשת גישה" (Google Form) — מוצג למי שאינו ברשימה. ריק = לא מוצג.
export const REQUEST_FORM_URL = "";

// תמיד מבקשים גם זהות (openid+email+profile) — לשם וזיהוי אוטומטי לפי חשבון.
// אם ההרשאות עדיין לא הוגדרו בקונסולה — יש נפילה חזרה ל-drive בלבד (חיבור עדיין עובד).
const BASE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const FULL_SCOPE = BASE_SCOPE + " openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile";
const FILE_NAME = "masa8_state.json";

const FLAG_ON = "masa8_cloud_on";     // "1" אם המשתמש חיבר סנכרון
const FLAG_SYNC = "masa8_cloud_sync"; // modifiedTime אחרון שסונכרן
const FLAG_TOK = "masa8_cloud_tok";   // אסימון גישה שמור (תקף ~שעה) — מונע חלון גוגל בכל רענון
const FLAG_EMAIL = "masa8_cloud_email"; // המייל של החשבון המחובר
const FLAG_GNAME = "masa8_cloud_gname"; // השם מחשבון הגוגל
const FLAG_RELOADED = "masa8_cloud_reloaded"; // מונע רענון כפול באותה טעינה (sessionStorage)

export const CLOUD_ENABLED = !!CLIENT_ID;

let tokenClient = null;
let accessToken = null;
let tokenExp = 0;
let fileId = null;
let gisReady = null;
let pushTimer = null;
let syncing = false;

const log = (...a) => { try { console.log("[cloud]", ...a); } catch (e) {} };

function isConnected() { try { return localStorage.getItem(FLAG_ON) === "1"; } catch (e) { return false; } }
function setConnected(v) {
  try { v ? localStorage.setItem(FLAG_ON, "1") : localStorage.removeItem(FLAG_ON); } catch (e) {}
  emitChanged();
}
function getLastSync() { try { return localStorage.getItem(FLAG_SYNC) || ""; } catch (e) { return ""; } }
function setLastSync(v) { try { if (v) localStorage.setItem(FLAG_SYNC, v); } catch (e) {} }
function emitChanged() { try { window.dispatchEvent(new CustomEvent("cloud:changed")); } catch (e) {} }

function storedEmail() { try { return localStorage.getItem(FLAG_EMAIL) || ""; } catch (e) { return ""; } }
function storedGName() { try { return localStorage.getItem(FLAG_GNAME) || ""; } catch (e) { return ""; } }
function storeGoogle(info) {
  try {
    if (info && info.email) localStorage.setItem(FLAG_EMAIL, info.email);
    if (info && info.name) localStorage.setItem(FLAG_GNAME, info.name);
  } catch (e) {}
}

export function cloudStatus() {
  return { enabled: CLOUD_ENABLED, connected: isConnected(), lastSync: getLastSync(), syncing, email: storedEmail() };
}

// ---- טעינת ספריית Google Identity Services ----
function loadGis() {
  if (gisReady) return gisReady;
  gisReady = new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("GIS load failed"));
    document.head.appendChild(s);
  });
  return gisReady;
}
// שליפת שם+מייל מחשבון הגוגל (דורש הרשאות openid/email/profile). null אם אין הרשאה.
async function getUserInfo() {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: "Bearer " + accessToken } });
    if (!res.ok) return null;
    const d = await res.json();
    return { email: (d.email || "").trim().toLowerCase(), name: (d.name || d.given_name || "").trim() };
  } catch (e) { return null; }
}

// ---- אסימון גישה ----
function persistToken() {
  try { localStorage.setItem(FLAG_TOK, JSON.stringify({ t: accessToken, e: tokenExp })); } catch (e) {}
}
function loadStoredToken() {
  try {
    const o = JSON.parse(localStorage.getItem(FLAG_TOK) || "null");
    if (o && o.t && o.e && Date.now() < o.e - 60000) { accessToken = o.t; tokenExp = o.e; return accessToken; }
  } catch (e) {}
  return null;
}
function requestTokenWith(scope) {
  return new Promise((resolve, reject) => {
    if (!(window.google && window.google.accounts && window.google.accounts.oauth2)) return reject(new Error("no GIS"));
    const tc = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID, scope,
      callback: (resp) => {
        if (resp && resp.access_token) {
          accessToken = resp.access_token;
          tokenExp = Date.now() + ((resp.expires_in || 3600) * 1000);
          persistToken();
          resolve(accessToken);
        } else reject(new Error((resp && resp.error) || "token error"));
      },
    });
    try { tc.requestAccessToken({ prompt: "" }); }
    catch (e) { reject(e); }
  });
}
// בקשת אסימון אינטראקטיבית — עלולה לפתוח חלון גוגל. נקראת רק מפעולה יזומה.
// מנסה סקופ מלא (עם זהות); אם ההרשאות עוד לא הוגדרו — נופל ל-drive בלבד כדי שהחיבור עדיין יעבוד.
async function requestToken() {
  try { return await requestTokenWith(FULL_SCOPE); }
  catch (e) { log("full scope failed → drive-only fallback", e.message); return await requestTokenWith(BASE_SCOPE); }
}
// אסימון שקט בלבד — לעולם לא פותח חלון. משתמש באסימון שבמטמון (עד שעה). null אם אין.
async function ensureToken() {
  if (accessToken && Date.now() < tokenExp - 60000) return accessToken;
  return loadStoredToken();
}

// ---- קריאות Drive REST (מרחב appDataFolder) ----
async function driveFind() {
  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)&pageSize=100",
    { headers: { Authorization: "Bearer " + accessToken } });
  if (!res.ok) throw new Error("find " + res.status);
  const data = await res.json();
  const f = (data.files || []).find(x => x.name === FILE_NAME) || (data.files || [])[0] || null;
  if (f) fileId = f.id;
  return f;
}
async function driveDownload(id) {
  const res = await fetch("https://www.googleapis.com/drive/v3/files/" + id + "?alt=media",
    { headers: { Authorization: "Bearer " + accessToken } });
  if (!res.ok) throw new Error("download " + res.status);
  return res.text();
}

// ---- זהות + רשימת מאושרים ----
async function getUserEmail() {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo",
    { headers: { Authorization: "Bearer " + accessToken } });
  if (!res.ok) throw new Error("userinfo " + res.status);
  const d = await res.json();
  return (d.email || "").trim().toLowerCase();
}
async function checkAllowed(email) {
  const res = await fetch(ALLOWLIST_CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("allowlist " + res.status);
  const text = await res.text();
  const emails = text
    .split(/[\r\n,;\t]+/)
    .map(s => s.trim().toLowerCase().replace(/^"+|"+$/g, ""))
    .filter(s => s.includes("@"));
  return emails.includes(email);
}
async function driveCreate(text) {
  const boundary = "masa8sync" + Date.now();
  const meta = { name: FILE_NAME, parents: ["appDataFolder"] };
  const body =
    "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(meta) + "\r\n" +
    "--" + boundary + "\r\nContent-Type: application/json\r\n\r\n" +
    text + "\r\n--" + boundary + "--";
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime",
    { method: "POST", headers: { Authorization: "Bearer " + accessToken, "Content-Type": "multipart/related; boundary=" + boundary }, body });
  if (!res.ok) throw new Error("create " + res.status);
  return res.json();
}
async function driveUpdate(id, text) {
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files/" + id + "?uploadType=media&fields=id,modifiedTime",
    { method: "PATCH", headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" }, body: text });
  if (!res.ok) throw new Error("update " + res.status);
  return res.json();
}

// ---- רענון פעם אחת (החלת נתונים שנמשכו מהענן) ----
function reloadOnce() {
  try {
    if (sessionStorage.getItem(FLAG_RELOADED)) return;
    sessionStorage.setItem(FLAG_RELOADED, "1");
  } catch (e) {}
  location.reload();
}

function hasLocalData() {
  try {
    const st = S.getState();
    return !!(st.onboarded || (st.activities && st.activities.length) ||
      (st.chapters && Object.keys(st.chapters).length) || (st.emotion && st.emotion.name));
  } catch (e) { return false; }
}

// ---- דחיפה לענן (נשמר את המצב הנוכחי) ----
async function push() {
  if (!isConnected()) return;
  const tok = await ensureToken();
  if (!tok) { log("push skipped — no token"); return; }
  // הגנה קריטית: מכשיר ריק לא ידרוס גיבוי ענן קיים
  if (!hasLocalData()) {
    try { const f0 = await driveFind(); if (f0) { log("push skipped — local empty, cloud has data (protected)"); return; } }
    catch (e) {}
  }
  syncing = true; emitChanged();
  try {
    const text = S.exportState();
    let res;
    if (fileId) {
      try { res = await driveUpdate(fileId, text); }
      catch (e) { fileId = null; const f = await driveFind(); res = f ? await driveUpdate(f.id, text) : await driveCreate(text); }
    } else {
      const f = await driveFind();
      res = f ? await driveUpdate(f.id, text) : await driveCreate(text);
    }
    fileId = res.id;
    setLastSync(res.modifiedTime || new Date().toISOString());
    log("pushed", res.modifiedTime);
  } catch (e) { log("push error", e.message); }
  finally { syncing = false; emitChanged(); }
}

function schedulePush() {
  if (!isConnected()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { push(); }, 2500);
}

// ---- סנכרון בהעלאת האפליקציה (משיכת גרסה חדשה יותר ממכשיר אחר) ----
async function startupSync() {
  const tok = await ensureToken();
  if (!tok) { log("startup — no token (will sync after reconnect)"); return; }
  const f = await driveFind();
  if (!f) { await push(); return; }            // אין קובץ בענן — ניצור מהמקומי
  const cloudMs = Date.parse(f.modifiedTime || 0) || 0;
  const lastMs = Date.parse(getLastSync() || 0) || 0;
  if (cloudMs > lastMs) {
    const text = await driveDownload(f.id);
    try { JSON.parse(text); } catch (e) { log("cloud file invalid"); return; }
    S.importState(text);
    setLastSync(f.modifiedTime);
    log("pulled newer from cloud — reloading");
    reloadOnce();
  } else {
    log("local up to date");
  }
}

// ---- API ציבורי ----
export async function cloudConnect() {
  await loadGis();
  await requestToken(); // מפעיל מסך הסכמה בפעם הראשונה (בתגובה ללחיצת המשתמש)
  // זהות מחשבון הגוגל — המייל והשם. אלה מזהים את המשתמש (המייל = הזהות הקבועה).
  const info = await getUserInfo();
  if (info) storeGoogle(info);
  // בדיקת רשימת מאושרים (אם הוגדרה) — לפני שמחברים
  if (ALLOWLIST_CSV_URL) {
    const email = await getUserEmail();
    let allowed = false;
    try { allowed = await checkAllowed(email); }
    catch (e) { const err = new Error("allowlist_unreachable"); err.code = "allowlist_unreachable"; throw err; }
    if (!allowed) {
      const err = new Error("not_allowed");
      err.code = "not_allowed"; err.email = email;
      throw err;
    }
  }
  const f = await driveFind();
  if (f) {
    if (hasLocalData()) {
      const loadCloud = window.confirm(
        "נמצאה גרסה שמורה בענן.\n\nאישור = לטעון אותה למכשיר הזה (יחליף את מה שיש כאן)\nביטול = להעלות את מה שיש כאן לענן");
      if (loadCloud) {
        const text = await driveDownload(f.id);
        S.importState(text);
        setLastSync(f.modifiedTime);
        setConnected(true);
        reloadOnce();
        return { action: "loaded" };
      }
      setConnected(true);
      await push();
      return { action: "uploaded" };
    }
    // אין נתונים מקומיים — נטען מהענן
    const text = await driveDownload(f.id);
    S.importState(text);
    setLastSync(f.modifiedTime);
    setConnected(true);
    reloadOnce();
    return { action: "loaded" };
  }
  // אין קובץ בענן — חשבון חדש. השם נקבע אוטומטית מחשבון הגוגל,
  // ומסך בחירת השם לא יופיע (setOnboarded). המייל הוא הזהות הקבועה.
  try {
    if (info && info.name) S.setName(info.name);
    if (!S.isOnboarded()) S.setOnboarded();
  } catch (e) {}
  setConnected(true);
  await push();
  return { action: "created" };
}

export function cloudDisconnect() {
  accessToken = null; tokenExp = 0; fileId = null;
  try {
    localStorage.removeItem(FLAG_TOK);
    localStorage.removeItem(FLAG_EMAIL);
    localStorage.removeItem(FLAG_GNAME);
  } catch (e) {}
  setConnected(false);
}

// סנכרון יזום (בלחיצת כפתור) — מרענן אסימון ומסנכרן. משמש כשהאסימון השמור פג.
export async function cloudSyncNow() {
  await loadGis();
  await requestToken();   // אינטראקטיבי (בתגובה ללחיצה)
  await startupSync();    // משיכת גרסה חדשה יותר אם יש
  await push();           // דחיפת המצב הנוכחי
  return true;
}

// דחיפה יזומה מיידית (למשל מיד אחרי onboarding) — שהשם/הנתונים יידבקו לחשבון ולא ייאבדו
export async function cloudPush() { try { await push(); } catch (e) { log("cloudPush", e.message); } }

// יישום זהות (השם מחשבון הגוגל) — סינכרוני, ללא רשת. נקרא לפני הרינדור הראשון,
// כך שהשם הנכון מוצג מיד. החשבון קובע את השם, לא בחירה.
export function cloudBootIdentity() {
  if (!CLOUD_ENABLED || !isConnected()) return;
  try {
    const gn = storedGName();
    if (gn && (S.getState().name || "").trim() !== gn) S.setName(gn);
  } catch (e) {}
}

export async function initCloud() {
  if (!CLOUD_ENABLED) return;
  window.addEventListener("state:changed", schedulePush);
  // דחיפה בסגירה/מעבר-רקע — מאמץ אחרון לשמור לענן לפני יציאה
  const closePush = () => { if (isConnected()) push(); };
  window.addEventListener("pagehide", closePush);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") closePush(); });
  if (isConnected()) {
    // השם נקבע ע"י חשבון הגוגל — לא ע"י בחירה. אם שמור שם מהחשבון, מיישמים אותו.
    try {
      const gn = storedGName();
      if (gn && (S.getState().name || "").trim() !== gn) S.setName(gn);
    } catch (e) {}
    try { await loadGis(); await startupSync(); }
    catch (e) { log("startup sync failed", e.message); }
  }
}
