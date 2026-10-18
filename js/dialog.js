// ============================================================
//  חלון אישור משלנו — במקום window.confirm.
//  הדפדפן חוסם confirm/alert בתוך iframe של אתר אחר (למשל הטמעה ברב-מסר): החלון לא נפתח
//  וההחזרה "לא" — ופעולות כמו יציאה או הכרעה בהתנגשות סנכרון נעצרות בשקט (או גרוע מזה).
//  askChoice מחזיר Promise עם ה-id של הכפתור שנבחר (או "cancel").
// ============================================================
export function askChoice(message, buttons) {
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "dlg-overlay";
    const box = document.createElement("div");
    box.className = "dlg-box"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
    const p = document.createElement("div");
    p.className = "dlg-msg"; p.textContent = message;
    const row = document.createElement("div");
    row.className = "dlg-actions";
    const done = (id) => { ov.remove(); resolve(id); };
    buttons.forEach(b => {
      const el = document.createElement("button");
      el.type = "button"; el.className = "btn" + (b.primary ? "" : " ghost2"); el.textContent = b.label;
      el.addEventListener("click", () => done(b.id));
      row.appendChild(el);
    });
    box.append(p, row); ov.appendChild(box); document.body.appendChild(ov);
    const first = row.querySelector("button"); if (first) first.focus();
  });
}
// אישור/ביטול רגיל — מחזיר true/false
export async function askConfirm(message, okLabel = "אישור", cancelLabel = "ביטול") {
  return (await askChoice(message, [{ id: "ok", label: okLabel, primary: true }, { id: "cancel", label: cancelLabel }])) === "ok";
}
