// ============================================================
//  חיבור תזכורת יומית ליומן של המשתמש
//  מייצר אירוע חוזר (.ics) + קישור ליומן Google.
//  שום מידע לא נשלח לשרת — המשתמש מאשר בעצמו את ההוספה.
// ============================================================

function pad(n) { return String(n).padStart(2, "0"); }

// escape לערכי טקסט ב-ICS
function ics(s = "") {
  return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;")
    .replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// זמן מקומי צף בפורמט ICS: YYYYMMDDTHHMMSS
function localStamp(date, h, m) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(h)}${pad(m)}00`;
}
function utcStamp(d = new Date()) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/**
 * בונה תוכן קובץ .ics לאירוע יומי חוזר עם התראה.
 */
export function buildICS({ title, description, email, time }) {
  const [h, m] = (time || "09:00").split(":").map(Number);
  const start = new Date();
  start.setDate(start.getDate() + 1); // מתחיל ממחר
  const dtStart = localStamp(start, h, m);
  const uid = "masa8-" + Date.now() + "@journey";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Masa8//Journal Reminder//HE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${utcStamp()}`,
    `DTSTART:${dtStart}`,
    `DURATION:PT15M`,
    `RRULE:FREQ=DAILY`,
    `SUMMARY:${ics(title)}`,
    `DESCRIPTION:${ics(description)}`,
  ];
  if (email) {
    lines.push(`ORGANIZER;CN=${ics(email)}:mailto:${email}`);
    lines.push(`ATTENDEE;CN=${ics(email)};RSVP=FALSE:mailto:${email}`);
  }
  lines.push(
    "BEGIN:VALARM",
    "TRIGGER:PT0S",
    "ACTION:DISPLAY",
    `DESCRIPTION:${ics(title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  );
  return lines.join("\r\n");
}

/** מוריד את קובץ ה-ICS */
export function downloadICS({ title, description, email, time }) {
  const content = buildICS({ title, description, email, time });
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "masa8-journal-reminder.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// קודי ימים ל-iCalendar ואינדקס JS (0=ראשון)
const DAY_CODE = { "ראשון": "SU", "שני": "MO", "שלישי": "TU", "רביעי": "WE", "חמישי": "TH", "שישי": "FR", "שבת": "SA" };
const DAY_IDX  = { "ראשון": 0, "שני": 1, "שלישי": 2, "רביעי": 3, "חמישי": 4, "שישי": 5, "שבת": 6 };

// התאריך הקרוב הבא של יום בשבוע נתון
function nextDateForDay(idx) {
  const d = new Date();
  const ahead = (idx - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + ahead);
  return d;
}

// חודש קדימה מתאריך נתון
function oneMonthAfter(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
}
// UNTIL בפורמט צף (ל-.ics עם DTSTART צף)
function untilFloating(date) {
  const u = oneMonthAfter(date);
  return `${u.getFullYear()}${pad(u.getMonth() + 1)}${pad(u.getDate())}T235900`;
}
// UNTIL בפורמט UTC (ל-Google)
function untilUtc(date) {
  const u = oneMonthAfter(date);
  return `${u.getFullYear()}${pad(u.getMonth() + 1)}${pad(u.getDate())}T235900Z`;
}

/**
 * בונה .ics עם אירוע נפרד לכל יום בטבלה (יום + שעה + פעילות),
 * חוזר שבועי לאותו יום.
 * @param {{events: Array<{day,time,activity}>, email?:string}} opts
 */
export function buildWeeklyICS({ events, email, label = "פעילות מהנה" }) {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    "PRODID:-//Masa8//Weekly Journal//HE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
  ];
  for (const ev of events) {
    const [h, m] = (ev.time || "09:00").split(":").map(Number);
    const date = nextDateForDay(DAY_IDX[ev.day] ?? 0);
    const endTotal = h * 60 + m + 30;
    const uid = "masa8-" + (DAY_CODE[ev.day] || "X") + "-" + Date.now() + Math.random().toString(36).slice(2, 6) + "@journey";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${utcStamp()}`,
      `DTSTART:${localStamp(date, h, m)}`,
      `DTEND:${localStamp(date, Math.floor(endTotal / 60) % 24, endTotal % 60)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${DAY_CODE[ev.day] || "SU"};UNTIL=${untilFloating(date)}`,
      `SUMMARY:${ics(ev.activity)}`,
      `DESCRIPTION:${ics(label + " — מסע 8 השבועות · יום " + ev.day)}`,
    );
    if (email) {
      lines.push(`ORGANIZER;CN=${ics(email)}:mailto:${email}`);
      lines.push(`ATTENDEE;CN=${ics(email)};RSVP=FALSE:mailto:${email}`);
    }
    lines.push("BEGIN:VALARM", "TRIGGER:PT0S", "ACTION:DISPLAY",
      `DESCRIPTION:${ics(ev.activity)}`, "END:VALARM", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/** מוריד .ics של כל השבוע */
export function downloadWeeklyICS({ events, email, label }) {
  const content = buildWeeklyICS({ events, email, label });
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "masa8-weekly-plan.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================================
//  תזכורת יומית (למשל "דייט עם הדאגה") — חוזר כל יום למשך חודש
// ============================================================
export function buildDailyICS({ title, description, email, time }) {
  const [h, m] = (time || "09:00").split(":").map(Number);
  const start = new Date(); start.setDate(start.getDate() + 1);
  const uid = "masa8-daily-" + Date.now() + "@journey";
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Masa8//Daily Reminder//HE",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${utcStamp()}`,
    `DTSTART:${localStamp(start, h, m)}`, "DURATION:PT10M",
    `RRULE:FREQ=DAILY;UNTIL=${untilFloating(start)}`,
    `SUMMARY:${ics(title)}`, `DESCRIPTION:${ics(description)}`,
  ];
  if (email) {
    lines.push(`ORGANIZER;CN=${ics(email)}:mailto:${email}`);
    lines.push(`ATTENDEE;CN=${ics(email)};RSVP=FALSE:mailto:${email}`);
  }
  lines.push("BEGIN:VALARM", "TRIGGER:PT0S", "ACTION:DISPLAY",
    `DESCRIPTION:${ics(title)}`, "END:VALARM", "END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadDailyICS({ title, description, email, time }) {
  const content = buildDailyICS({ title, description, email, time });
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "masa8-daily-reminder.ics";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function googleDailyUrl({ title, description, time }) {
  const [h, m] = (time || "09:00").split(":").map(Number);
  const start = new Date(); start.setDate(start.getDate() + 1);
  const s = localStamp(start, h, m);
  const endTotal = h * 60 + m + 10;
  const e = localStamp(start, Math.floor(endTotal / 60) % 24, endTotal % 60);
  const params = new URLSearchParams({
    action: "TEMPLATE", text: title, details: description,
    dates: `${s}/${e}`,
    recur: `RRULE:FREQ=DAILY;UNTIL=${untilUtc(start)}`,
    ctz: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jerusalem",
  });
  return "https://calendar.google.com/calendar/render?" + params.toString();
}

/**
 * קישור להוספת אירוע של יום בודד ליומן Google — חוזר שבועי למשך חודש.
 * לא כולל מייל ב-URL מטעמי פרטיות; נפתח בחשבון שהמשתמש מחובר אליו,
 * והמשתמש מאשר בעצמו את השמירה.
 */
export function googleEventUrl({ day, time, activity, label = "פעילות מהנה" }) {
  const [h, m] = (time || "09:00").split(":").map(Number);
  const date = nextDateForDay(DAY_IDX[day] ?? 0);
  const s = localStamp(date, h, m);
  const endTotal = h * 60 + m + 30;
  const e = localStamp(date, Math.floor(endTotal / 60) % 24, endTotal % 60);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: activity,
    details: label + " — מסע 8 השבועות · יום " + day,
    dates: `${s}/${e}`,
    recur: `RRULE:FREQ=WEEKLY;BYDAY=${DAY_CODE[day] || "SU"};UNTIL=${untilUtc(date)}`,
    ctz: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jerusalem",
  });
  return "https://calendar.google.com/calendar/render?" + params.toString();
}
