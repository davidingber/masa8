// ============================================================
//  כלי ה-AI — מבנה מלא, מוכן לחיבור Claude API אמיתי
//  כרגע: אם אין מפתח → מצב הדגמה (Placeholder)
// ============================================================
import { getState } from "./state.js";

const MODEL = "claude-sonnet-5"; // ניתן לשנות בהמשך

/**
 * שולח שיחה ל-AI לפי ההוראות (system prompt) של הכלי הנבחר.
 * @param {string} systemPrompt - ההוראות שהמנחה הזין לכלי
 * @param {Array<{role,content}>} messages - היסטוריית השיחה
 * @returns {Promise<string>}
 */
export async function askAI(systemPrompt, messages) {
  const key = getState().apiKey?.trim();

  // ---- מצב הדגמה (אין מפתח) ----
  if (!key) {
    return demoResponse(systemPrompt, messages);
  }

  // ---- חיבור אמיתי ל-Claude API ----
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        // נדרש לקריאה ישירה מהדפדפן (אב-טיפוס בלבד):
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return `⚠️ שגיאה מה-API (${res.status}). בדוק את המפתח בהגדרות.\n${err.slice(0, 200)}`;
    }
    const data = await res.json();
    return data.content?.[0]?.text || "(לא התקבלה תשובה)";
  } catch (e) {
    return `⚠️ לא הצלחתי להתחבר ל-API. ייתכן שהדפדפן חוסם את הבקשה. פרטים: ${e.message}`;
  }
}

// ---- תשובת הדגמה כשאין מפתח ----
function demoResponse(systemPrompt, messages) {
  const last = messages[messages.length - 1]?.content || "";
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(
`🔹 *מצב הדגמה — עדיין לא חובר מפתח API אמיתי.*

קיבלתי את מה שכתבת:
"${last.slice(0, 160)}"

כאן ייכנס המענה של הבינה המלאכותית, לפי ההוראות שהמנחה הזין לכלי הזה:
"${(systemPrompt || "").slice(0, 120)}…"

כדי להפעיל תשובות אמיתיות: הגדרות → הזנת מפתח Claude API.`
      );
    }, 500);
  });
}
