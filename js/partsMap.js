// ============================================================
//  מפת החלקים — מנוע התיוג המרכזי
//  נגזר מהנתונים האמיתיים של כל השבועות (בלי כפילויות),
//  ולכן תמיד מסונכרן עם מה שהלקוח כתב.
//
//  שני צדדים, כל אחד עם אנטומיה מסודרת:
//   pain (החלק):      belief, thought[], emotion[], sensation[], over[], avoid[]
//   resource (ההורה): belief, thought[], emotion[], sensation[], behavior[]
//   + partName, idealName, primary (מגמת הרגש), counts, balance
// ============================================================

export function buildPartsMap(S) {
  const st = S.getState();
  const goal = S.getGoalPlan() || {};
  const td = (w, k) => S.getToolData(w, k);

  const pain = { belief: "", thought: [], emotion: [], sensation: [], over: [], avoid: [] };
  const resource = { belief: "", thought: [], emotion: [], sensation: [], behavior: [] };
  const seen = new Set();
  const add = (side, cat, label, text, week) => {
    const t = (text == null ? "" : String(text)).trim();
    if (!t) return;
    const sig = cat + "|" + t;
    if (seen.has(sig)) return;
    seen.add(sig);
    side[cat].push({ label, text: t, week });
  };

  // ===== אמונות יסוד =====
  const selfMap = td(2, "selfMap") || {};
  pain.belief = (selfMap.belief || "").trim();
  const beliefTool = td(6, "beliefSwap") || {};      // כלי החלפת אמונות (שבוע 6)
  resource.belief = (st.idealBelief || beliefTool.newBelief || "").trim();

  // ===== רגש ראשוני + מגמה =====
  const ratings = st.emotion.ratings || [];
  const primary = st.emotion.name
    ? { name: st.emotion.name, first: ratings[0]?.value ?? null, last: ratings.length ? ratings[ratings.length - 1].value : null }
    : null;

  // ===== צד החלק (כאב) =====
  // מחשבות
  add(pain, "thought", "מחשבה", goal.cur_thoughts, 1);
  add(pain, "thought", "חוק", selfMap.rules, 2);
  add(pain, "thought", "מחשבה", selfMap.thoughts, 2);
  (td(6, "thoughtTable") || []).forEach(r => {
    add(pain, "thought", "מחשבה", r.thought, 6);
    add(pain, "thought", "עיוות חשיבה", r.distortion, 6);
    add(pain, "emotion", "רגש", r.emotion, 6);
    add(pain, "sensation", "תחושה", r.sensation, 6);
    add(resource, "thought", "מחשבה חלופית", r.alternative, 6);
  });
  (td(2, "cycleJournal") || []).forEach(r => {
    add(pain, "thought", "מחשבה", r.thought, 2);
    add(pain, "emotion", "רגש", r.interpretation, 2);
    add(pain, "sensation", "תחושה", r.sensation, 2);
    add(pain, "over", "תגובה", r.response, 2);
  });
  // התנהגות — עשיית יתר / הימנעות
  add(pain, "over", "עשיית יתר", goal.cur_behavior, 1);
  add(pain, "over", "עשיית יתר", selfMap.overdoing, 2);
  (goal.cur_avoid || []).forEach(a => add(pain, "avoid", "הימנעות", a, 1));
  add(pain, "avoid", "הימנעות", goal.cur_avoid_detail, 1);
  add(pain, "avoid", "הימנעות", selfMap.avoidance, 2);
  // מחיר ההישארות (דיקנס — בתוך הגדרת המטרה)
  add(pain, "thought", "מחיר ההישארות", goal.stay5_feel, 1);
  add(pain, "thought", "מחיר ההישארות", goal.stay10_feel, 1);
  // חשיפה — פחד ומחשבות לפני
  const prep = td(7, "prepForm") || {};
  (prep.emotions || []).forEach(e => add(pain, "emotion", "פחד בחשיפה", e, 7));
  add(pain, "thought", "מחשבה בחשיפה", prep.autoThoughts, 7);

  // ===== צד המשאב (ההורה המיטיב) =====
  if (st.emotion.target) add(resource, "emotion", "רגש חלופי", st.emotion.target, 1);
  // מחשבות חדשות
  add(resource, "thought", "מחשבה חלופית", prep.altThoughts, 7);
  add(resource, "thought", "מנטרה", prep.rational, 7);
  add(resource, "thought", "למידה מחשיפה", (td(7, "afterForm") || {}).learned, 7);
  (td(3, "reframe") || []).forEach(t => add(resource, "thought", "מסגור מחדש", t, 3));
  add(resource, "thought", "אי-הזדהות", td(3, "thirdPerson"), 3);
  add(resource, "thought", "חזון הזהות", (td(1, "dickens") || {}).identity, 1);
  add(resource, "thought", "חזון", goal.dream_feel, 1);
  add(resource, "thought", "המטרה שלי", goal.goal_precise, 1);
  // כלי החלפת אמונות (שבוע 6)
  add(pain, "thought", "אמונה", beliefTool.belief, 6);
  add(pain, "emotion", "רגש", beliefTool.emotion, 6);
  add(resource, "emotion", "רגש שעולה", beliefTool.emotionInstead, 6);
  add(resource, "thought", "אמונה חדשה", beliefTool.newBelief, 6);
  add(resource, "thought", "בדיקת מציאות", beliefTool.real, 6);
  add(resource, "thought", "הסבר אחר", beliefTool.reframe, 6);
  add(resource, "thought", "רווח משומר", beliefTool.keepBenefit, 6);
  // התנהגות מיטיבה
  Object.values(td(1, "activityPlan") || {}).forEach(v => add(resource, "behavior", "פעילות מהנה", v && v.activity, 1));
  (td(8, "values") || []).forEach(v => add(resource, "behavior", "ערך מנחה", v, 8));
  add(resource, "behavior", "מה החלק צריך", (td(5, "focusing") || {}).needs, 5);
  Object.values(td(5, "burden") || {}).forEach(v => {
    const t = (v || "").trim();
    if (t) add(resource, "behavior", "הסרת העול", "להרפות מ" + t, 5);
  });
  add(resource, "behavior", "משאב חסר", beliefTool.resources, 6);
  // האזנה למדיטציות — כמספר האזנות שנרשמו
  const medListens = (st.activities || []).filter(a => a.type === "meditation").length;
  if (medListens) resource.behavior.push({ label: "מדיטציות", text: `האזנת ${medListens} פעמים`, week: 4 });

  const painCount = pain.thought.length + pain.emotion.length + pain.sensation.length + pain.over.length + pain.avoid.length;
  const resCount = resource.thought.length + resource.emotion.length + resource.sensation.length + resource.behavior.length;
  const balance = (painCount + resCount) === 0 ? 0.5 : resCount / (painCount + resCount);

  return {
    partName: (st.partName || "").trim(),
    idealName: (st.idealName || "").trim(),
    primary, pain, resource,
    counts: { pain: painCount, resource: resCount },
    balance,
  };
}
