// ============================================================
//  האווטר המתפתח — דמות חמה ומעוצבת
//  charge 0..100 → משנה: יציבה, הבעה, זוהר, צבע, ונבט שצומח
// ============================================================

export function renderAvatar(charge) {
  const t = Math.max(0, Math.min(100, charge)) / 100; // 0..1

  // יציבה: כפוף (t=0) → זקוף (t=1)
  const slouch = (1 - t) * 20;
  const bodyLift = t * 14;
  const headY = 84 + slouch * 0.5 - bodyLift * 0.4;

  // הבעה: עצוב → שליו/שמח
  const smile = -6 + t * 18;

  // עיניים — נעשות פקוחות/ערניות יותר
  const eyeOpen = 2.6 + t * 2.0;

  // פלטה חמה תואמת (מרווה/ירוק) במקום טורקיז קר
  const hue = 150;
  const sat = 22 + t * 40;                 // חיוור → רווי
  const light = 66 - t * 12;               // מבהיר עם צל עדין
  const cTop  = `hsl(${hue} ${sat}% ${Math.min(light + 10, 82)}%)`;
  const cBot  = `hsl(${hue} ${sat}% ${light}%)`;
  const cLine = `hsl(${hue} ${sat}% ${Math.max(light - 20, 22)}%)`;
  const cGlow = `hsl(${hue} ${55 + t * 20}% ${58}%)`;
  const eyeCol = "#33493c";

  // הילה רכה — טבעות לפי הטעינה
  const glowRings = Math.round(t * 3);
  let rings = "";
  for (let i = 1; i <= glowRings; i++) {
    const r = 66 + i * 15;
    rings += `<circle cx="105" cy="120" r="${r}" fill="none"
      stroke="${cGlow}" stroke-width="2"
      opacity="${(0.16 * (1 - i * 0.24)).toFixed(3)}" />`;
  }

  // נבט שצומח לצד הדמות — עלה אחד (t>.25), שני (t>.5), פריחה (t>.78)
  let sprout = "";
  const grow = Math.max(0, (t - 0.06) / 0.94);          // 0..1
  if (grow > 0.02) {
    const stemH = 14 + grow * 40;                        // גובה הגבעול
    sprout += `<g transform="translate(42 236)">
      <ellipse cx="0" cy="2" rx="12" ry="3.5" fill="${cBot}" opacity="0.28"/>
      <path d="M0 0 Q ${grow*4} ${-stemH*0.55} 0 ${-stemH}"
        fill="none" stroke="hsl(122 34% 42%)" stroke-width="3" stroke-linecap="round"/>`;
    if (t > 0.25)
      sprout += `<path d="M0 ${-stemH*0.5} q -15 -3 -21 -15 q 13 -3 21 9 Z" fill="hsl(122 38% 48%)"/>`;
    if (t > 0.5)
      sprout += `<path d="M0 ${-stemH*0.75} q 15 -3 21 -15 q -13 -3 -21 9 Z" fill="hsl(124 42% 52%)"/>`;
    if (t > 0.78)
      sprout += `<g transform="translate(0 ${-stemH-2})">
        ${[0,72,144,216,288].map(a=>`<ellipse cx="0" cy="-7" rx="4.8" ry="7.4" fill="hsl(340 58% 76%)" transform="rotate(${a})"/>`).join("")}
        <circle cx="0" cy="0" r="4.2" fill="hsl(44 80% 62%)"/></g>`;
    sprout += `</g>`;
  }

  return `
  <svg viewBox="0 0 210 250" xmlns="http://www.w3.org/2000/svg" class="avatar-svg" aria-label="הדמות המתפתחת">
    <defs>
      <linearGradient id="avBody" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"  stop-color="${cTop}"/>
        <stop offset="100%" stop-color="${cBot}"/>
      </linearGradient>
      <radialGradient id="avAura" cx="50%" cy="46%" r="52%">
        <stop offset="0%"  stop-color="${cGlow}" stop-opacity="${(0.10 + t*0.20).toFixed(3)}"/>
        <stop offset="100%" stop-color="${cGlow}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="avFloor" cx="50%" cy="50%" r="50%">
        <stop offset="0%"  stop-color="${cBot}" stop-opacity="${(0.22 + t*0.18).toFixed(3)}"/>
        <stop offset="100%" stop-color="${cBot}" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <!-- הילה רכה -->
    <circle cx="105" cy="120" r="94" fill="url(#avAura)"/>
    ${rings}

    <!-- צל/רצפה -->
    <ellipse cx="105" cy="230" rx="${48 + t*10}" ry="12" fill="url(#avFloor)"/>
    ${sprout}

    <g transform="translate(0 ${-bodyLift})">
      <!-- גוף רך עם הצללה -->
      <path d="M 68 ${228}
               Q 60 ${168 - bodyLift} 74 ${146}
               Q 82 ${126} 105 ${124}
               Q 128 ${126} 136 ${146}
               Q 150 ${168 - bodyLift} 142 ${228} Z"
            fill="url(#avBody)" stroke="${cLine}" stroke-width="2"/>
      <!-- הדגשת אור עדינה -->
      <path d="M 84 ${150} Q 90 ${134} 105 ${132} Q 96 ${140} 92 ${158} Z"
            fill="#ffffff" opacity="0.16"/>

      <!-- ידיים -->
      <path d="M 76 ${156} Q ${62 - t*14} ${156 - t*42} ${60 - t*10} ${124 - t*46}"
            fill="none" stroke="url(#avBody)" stroke-width="12" stroke-linecap="round"/>
      <path d="M 134 ${156} Q ${148 + t*14} ${156 - t*42} ${150 + t*10} ${124 - t*46}"
            fill="none" stroke="url(#avBody)" stroke-width="12" stroke-linecap="round"/>

      <!-- ראש -->
      <g transform="rotate(${slouch*0.5} 105 ${headY}) translate(0 ${slouch*0.4})">
        <circle cx="105" cy="${headY}" r="33" fill="url(#avBody)" stroke="${cLine}" stroke-width="2"/>
        <ellipse cx="98" cy="${headY-8}" rx="12" ry="9" fill="#ffffff" opacity="0.14"/>
        <!-- לחיים חמות -->
        <circle cx="85"  cy="${headY+9}" r="5.5" fill="hsl(20 60% 72%)" opacity="${(0.25 + t*0.45).toFixed(2)}"/>
        <circle cx="125" cy="${headY+9}" r="5.5" fill="hsl(20 60% 72%)" opacity="${(0.25 + t*0.45).toFixed(2)}"/>
        <!-- עיניים -->
        <ellipse cx="93"  cy="${headY-2}" rx="3.6" ry="${eyeOpen}" fill="${eyeCol}"/>
        <ellipse cx="117" cy="${headY-2}" rx="3.6" ry="${eyeOpen}" fill="${eyeCol}"/>
        <!-- פה -->
        <path d="M 90 ${headY+20} Q 105 ${headY+20+smile} 120 ${headY+20}"
              fill="none" stroke="${eyeCol}" stroke-width="3" stroke-linecap="round"/>
      </g>
    </g>

    <!-- מחוון טעינה עדין -->
    <g transform="translate(178 110)">
      <rect x="0" y="0" width="13" height="32" rx="4" fill="none" stroke="${cLine}" stroke-width="2" opacity="0.7"/>
      <rect x="3.5" y="-4" width="6" height="4" rx="1.5" fill="${cLine}" opacity="0.7"/>
      <rect x="2.5" y="${2 + (28 - 28*t)}" width="8" height="${28*t}" rx="2.5"
            fill="hsl(${120*t + 20} 55% 50%)"/>
    </g>
  </svg>`;
}

// גרסת תצוגה עם צילום אמיתי — מתחלף לפי ההתקדמות (זרע → צמח → פריחה).
// נפילה חכמה: אם התמונה חסרה (אופליין בטעינה ראשונה) — מוצג הוקטור.
export function renderAvatarPhoto(charge) {
  const t = Math.max(0, Math.min(100, charge)) / 100;
  const stage = t < 0.34 ? 1 : t < 0.70 ? 2 : 3;
  return `<div class="avatar-photo-wrap">
    <img class="avatar-photo" src="img/avatar-${stage}.png"
         alt="הדמות המתפתחת — שלב ${stage} מתוך 3"
         onerror="this.closest('.avatar-photo-wrap').classList.add('noimg')">
    <div class="avatar-photo-fallback">${renderAvatar(charge)}</div>
  </div>`;
}

export function avatarMessage(stage) {
  const msgs = [
    "אני קצת כפוף עדיין… מתחילים יחד. כל צעד קטן טוען אותי.",
    "אני מתחיל להזדקף. ממשיכים — וזה בדיוק הכיוון הנכון.",
    "אני מרגיש יותר יציב. העבודה שלך ניכרת עליי.",
    "אני נטען יפה! רואים את ההנהגה העצמית שלך.",
    "אני זקוף ומלא אנרגיה. איזה מסע עשית.",
    "אני זוהר! הגעת להנהגה עצמית — כדאי להמשיך לתחזק את זה.",
  ];
  return msgs[Math.min(stage, msgs.length - 1)];
}
