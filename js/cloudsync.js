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

// כשיש בדיקת רשימה צריך גם את המייל של המשתמש (openid+email)
const SCOPE = ALLOWLIST_CSV_URL
  ? "https://www.googleapis.com/auth/drive.appdata openid email"
  : "https://www.googleapis.com/auth/drive.appdata";
const FILE_NAME = "masa8_state.json";

const FLAG_ON = "masa8_cloud_on";     // "1" אם המשתמש חיבר סנכרון
const FLAG_SYNC = "masa8_cloud_sync"; // modifiedTime אחרון שסונכרן
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

export function cloudStatus() {
  return { enabled: CLOUD_ENABLED, connected: isConnected(), lastSync: getLastSync(), syncing };
}

// ---- טעינת ספריית Google Identity Services ----
function loadGis() {
  if (gisReady) return gisReady;
  gisReady = new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      initTokenClient(); return resolve();
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = () => { try { initTokenClient(); resolve(); } catch (e) { reject(e); } };
    s.onerror = () => reject(new Error("GIS load failed"));
    document.head.appendChild(s);
  });
  return gisReady;
}
function initTokenClient() {
  if (tokenClient) return;
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID, scope: SCOPE, callback: () => {},
  });
}

// ---- אסימון גישה ----
function requestToken() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) return reject(new Error("no token client"));
    tokenClient.callback = (resp) => {
      if (resp && resp.access_token) {
        accessToken = resp.access_token;
        tokenExp = Date.now() + ((resp.expires_in || 3600) * 1000);
        resolve(accessToken);
      } else reject(new Error((resp && resp.error) || "token error"));
    };
    try { tokenClient.requestAccessToken({ prompt: "" }); }
    catch (e) { reject(e); }
  });
}
async function ensureToken() {
  if (accessToken && Date.now() < tokenExp - 60000) return accessToken;
  try { return await requestToken(); } catch (e) { log("token failed", e.message); return null; }
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
  // אין קובץ בענן — ניצור מהמקומי
  setConnected(true);
  await push();
  return { action: "created" };
}

export function cloudDisconnect() {
  accessToken = null; tokenExp = 0; fileId = null;
  setConnected(false);
}

export async function initCloud() {
  if (!CLOUD_ENABLED) return;
  window.addEventListener("state:changed", schedulePush);
  if (isConnected()) {
    try { await loadGis(); await startupSync(); }
    catch (e) { log("startup sync failed", e.message); }
  }
}
