// ============================================================
//  תזכורות לנייד — התראות דרך המערכת
//  (אב-טיפוס: התראה יומית בזמן שנקבע, כשהאפליקציה פתוחה/רקע)
// ============================================================
import { getState, setReminders } from "./state.js";

export async function requestPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  const p = await Notification.requestPermission();
  return p;
}

export function notify(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification(title, {
    body,
    icon: "icons/icon-192.png",
    dir: "rtl",
    lang: "he",
  });
}

// בודק כל דקה אם הגיע זמן התזכורת היומית
let timer = null;
export function startReminderLoop() {
  if (timer) clearInterval(timer);
  timer = setInterval(checkReminder, 60 * 1000);
  checkReminder();
}

function checkReminder() {
  const r = getState().reminders;
  if (!r.enabled) return;
  const now = new Date();
  const [h, m] = (r.time || "09:00").split(":").map(Number);
  const todayKey = now.toISOString().slice(0, 10);

  if (now.getHours() === h && now.getMinutes() === m && r.lastFired !== todayKey) {
    notify("מסע 8 השבועות 🌱", "הגיע הזמן לצעד הקטן היומי שלך. האווטר מחכה שתטעין אותו.");
    setReminders({ lastFired: todayKey });
  }
}
