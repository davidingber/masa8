// ============================================================
//  האווטר המתפתח
//  charge 0..100 → משנה: יציבה, הבעה, זוהר/טעינה, צבע
// ============================================================

export function renderAvatar(charge) {
  const t = Math.max(0, Math.min(100, charge)) / 100; // 0..1

  // יציבה: כפוף (t=0) → זקוף (t=1)
  const slouch = (1 - t) * 22;          // כמה הראש/גוף נוטים קדימה
  const bodyLift = t * 14;               // כמה הגוף "מתרומם"
  const headY = 74 + slouch * 0.5 - bodyLift * 0.4;

  // הבעה: עצוב (עקומה למטה) → שמח (עקומה למעלה)
  const smile = -8 + t * 20;             // -8 (עצוב) .. +12 (שמח)
  const mouthPath = `M 88 ${150} Q 105 ${150 + smile} 122 ${150}`;

  // עיניים — נעשות פקוחות/ערניות יותר
  const eyeOpen = 2.4 + t * 2.2;

  // צבע — חיוור/אפרפר → רווי וחם
  const bodyHue = 175;                   // טורקיז
  const bodySat = 18 + t * 52;
  const bodyLight = 62 - t * 8;
  const bodyColor = `hsl(${bodyHue} ${bodySat}% ${bodyLight}%)`;
  const bodyColorDark = `hsl(${bodyHue} ${bodySat}% ${bodyLight - 12}%)`;

  // זוהר/הילה — מספר טבעות לפי הטעינה
  const glowRings = Math.round(t * 3);   // 0..3
  const glowOpacity = 0.10 + t * 0.30;

  // "אחוז טעינה" — סוללה קטנה ליד הדמות
  const batteryFill = t;

  let rings = "";
  for (let i = 1; i <= glowRings; i++) {
    const r = 60 + i * 16;
    rings += `<circle cx="105" cy="120" r="${r}" fill="none"
      stroke="hsl(${bodyHue} 80% 55%)" stroke-width="2"
      opacity="${(glowOpacity * (1 - i * 0.22)).toFixed(3)}" />`;
  }

  // ניצוצות כשהטעינה גבוהה
  let sparks = "";
  if (t > 0.55) {
    const s = [[42,64],[168,70],[54,150],[158,148],[105,34]];
    const n = Math.round((t - 0.55) / 0.45 * s.length);
    for (let i = 0; i < n; i++) {
      const [x, y] = s[i];
      sparks += `<g transform="translate(${x} ${y})" opacity="${0.5 + t * 0.5}">
        <path d="M0,-6 L1.6,-1.6 L6,0 L1.6,1.6 L0,6 L-1.6,1.6 L-6,0 L-1.6,-1.6 Z"
          fill="hsl(45 90% 62%)"/></g>`;
    }
  }

  return `
  <svg viewBox="0 0 210 250" xmlns="http://www.w3.org/2000/svg" class="avatar-svg" aria-label="אווטר">
    <defs>
      <radialGradient id="floorGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="hsl(${bodyHue} 60% 60%)" stop-opacity="${0.25 + t*0.25}"/>
        <stop offset="100%" stop-color="hsl(${bodyHue} 60% 60%)" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <!-- הילה -->
    ${rings}

    <!-- רצפה/צל -->
    <ellipse cx="105" cy="228" rx="${46 + t*10}" ry="11" fill="url(#floorGrad)"/>

    <g transform="translate(0 ${-bodyLift})">
      <!-- גוף -->
      <path d="M 70 ${228}
               Q 62 ${170 - bodyLift} 74 ${140}
               Q 80 ${118} 105 ${116}
               Q 130 ${118} 136 ${140}
               Q 148 ${170 - bodyLift} 140 ${228} Z"
            fill="${bodyColor}" stroke="${bodyColorDark}" stroke-width="2"/>

      <!-- ראש -->
      <g transform="rotate(${slouch*0.5} 105 ${headY}) translate(0 ${slouch*0.4})">
        <circle cx="105" cy="${headY}" r="34" fill="${bodyColor}" stroke="${bodyColorDark}" stroke-width="2"/>
        <!-- עיניים -->
        <ellipse cx="93"  cy="${headY-2}" rx="4" ry="${eyeOpen}" fill="#2b3a44"/>
        <ellipse cx="117" cy="${headY-2}" rx="4" ry="${eyeOpen}" fill="#2b3a44"/>
        <!-- לחיים ורודות כשמאושר -->
        <circle cx="84"  cy="${headY+8}" r="5" fill="hsl(5 70% 70%)" opacity="${t*0.6}"/>
        <circle cx="126" cy="${headY+8}" r="5" fill="hsl(5 70% 70%)" opacity="${t*0.6}"/>
        <!-- פה -->
        <path d="M ${88} ${headY+22} Q 105 ${headY+22+smile} ${122} ${headY+22}"
              fill="none" stroke="#2b3a44" stroke-width="3" stroke-linecap="round"/>
      </g>

      <!-- ידיים — עולות כלפי מעלה ככל שהטעינה גבוהה -->
      <path d="M 74 ${150} Q ${60 - t*14} ${150 - t*40} ${58 - t*10} ${120 - t*46}"
            fill="none" stroke="${bodyColor}" stroke-width="12" stroke-linecap="round"/>
      <path d="M 136 ${150} Q ${150 + t*14} ${150 - t*40} ${152 + t*10} ${120 - t*46}"
            fill="none" stroke="${bodyColor}" stroke-width="12" stroke-linecap="round"/>
    </g>

    ${sparks}

    <!-- סוללת טעינה קטנה -->
    <g transform="translate(176 108)">
      <rect x="0" y="0" width="14" height="34" rx="3" fill="none" stroke="#9fb4bd" stroke-width="2"/>
      <rect x="4" y="-4" width="6" height="4" rx="1" fill="#9fb4bd"/>
      <rect x="2.5" y="${2 + (30 - 30*batteryFill)}" width="9" height="${30*batteryFill}" rx="2"
            fill="hsl(${90*batteryFill} 65% 50%)"/>
    </g>
  </svg>`;
}

export function avatarMessage(stage) {
  const msgs = [
    "אני קצת כפוף עדיין… בוא נתחיל יחד. כל צעד קטן טוען אותי.",
    "אני מתחיל להזדקף. ממשיכים — אתה בכיוון הנכון.",
    "אני מרגיש יותר יציב. העבודה שלך ניכרת עליי.",
    "אני נטען יפה! רואים שאתה מנהיג את עצמך.",
    "אני זקוף ומלא אנרגיה. איזה מסע עשית.",
    "אני זוהר! הגעת להנהגה עצמית — תמשיך לתחזק את זה.",
  ];
  return msgs[Math.min(stage, msgs.length - 1)];
}
