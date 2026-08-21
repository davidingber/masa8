// ============================================================
//  מפת החלקים — מנוע התיוג המרכזי
//  נגזר מהנתונים האמיתיים של כל השבועות (בלי כפילויות),
//  ולכן תמיד מסונכרן עם מה שהלקוח כתב.
//
//  מחזיר:
//   primary   — הרגש הראשוני (מתוקף · נראה · מוגן) או null
//   secondary — שכבת הסבל המשני (מחשבות, התנהגות, הימנעות, פחד...)
//   resource  — צד המשאב (רגש חלופי, אי-הזדהות, פעילות, חמלה, חזון...)
//   counts    — כמה פריטים בכל צד
//   balance   — 0..1, יחס המשאב מול הסבל (מניע את המאזן והאווטר)
// ============================================================

export function buildPartsMap(S) {
  const st = S.getState();
  const goal = S.getGoalPlan() || {};
  const td = (w, k) => S.getToolData(w, k);

  const secondary = [];
  const resource = [];
  const seen = new Set();
  const add = (arr, label, text, week) => {
    const t = (text == null ? "" : String(text)).trim();
    if (!t) return;
    const sig = label + "|" + t;
    if (seen.has(sig)) return;      // מונע כפילויות מאותו טקסט
    seen.add(sig);
    arr.push({ label, text: t, week });
  };

  // ===== כאב ראשוני =====
  const ratings = st.emotion.ratings || [];
  const lastRating = ratings.length ? ratings[ratings.length - 1].value : null;
  const primary = st.emotion.name ? { name: st.emotion.name, intensity: lastRating } : null;

  // ===== סבל משני =====
  // מחשבות
  add(secondary, "מחשבה", goal.cur_thoughts, 1);
  (td(6, "thoughtTable") || []).forEach(r => {
    add(secondary, "מחשבה", r.thought, 6);
    add(secondary, "עיוות חשיבה", r.distortion, 6);
    add(resource, "מחשבה חלופית", r.alternative, 6);
  });
  (td(2, "cycleJournal") || []).forEach(r => {
    add(secondary, "מחשבה", r.thought, 2);
    add(secondary, "תגובה", r.response, 2);
  });
  // התנהגות + הימנעות + כפייתיות
  add(secondary, "התנהגות", goal.cur_behavior, 1);
  (goal.cur_avoid || []).forEach(a => add(secondary, "הימנעות", a, 1));
  add(secondary, "הימנעות", goal.cur_avoid_detail, 1);
  // מחיר ההישארות (דיקנס)
  const dick = td(1, "dickens") || {};
  add(secondary, "מחיר ההישארות", dick.stay5feel, 1);
  add(secondary, "מחיר ההישארות", dick.stay10feel, 1);
  // חשיפה — פחד ומחשבות לפני
  const prep = td(7, "prepForm") || {};
  (prep.emotions || []).forEach(e => add(secondary, "פחד בחשיפה", e, 7));
  add(secondary, "מחשבה בחשיפה", prep.autoThoughts, 7);
  add(secondary, "עיוות חשיבה", prep.distortions, 7);
  // טריגרים לנסיגה
  ((td(8, "relapse") || {}).triggers || []).forEach(t => add(secondary, "טריגר לנסיגה", t, 8));

  // ===== משאב =====
  if (st.emotion.target) add(resource, "רגש חלופי", st.emotion.target, 1);
  // מחשבות חלופיות / מנטרות / למידה מחשיפה
  add(resource, "מחשבה חלופית", prep.altThoughts, 7);
  add(resource, "מנטרה", prep.rational, 7);
  add(resource, "למידה מחשיפה", (td(7, "afterForm") || {}).learned, 7);
  // אי-הזדהות ומסגור מחדש
  (td(3, "reframe") || []).forEach(t => add(resource, "מסגור מחדש", t, 3));
  add(resource, "אי-הזדהות", td(3, "thirdPerson"), 3);
  // פעילות מהנה
  Object.values(td(1, "activityPlan") || {}).forEach(v => add(resource, "פעילות מהנה", v && v.activity, 1));
  // חמלה / הורות עצמית (שבוע 5)
  add(resource, "מה החלק צריך", (td(5, "focusing") || {}).needs, 5);
  Object.values(td(5, "burden") || {}).forEach(v => add(resource, "הסרת העול", v, 5));
  // חזון הזהות
  add(resource, "חזון הזהות", dick.identity, 1);
  add(resource, "חזון", goal.dream_feel, 1);
  add(resource, "המטרה שלי", goal.goal_precise, 1);
  add(resource, "זהות חדשה", (td(8, "identityClose") || {}).text, 8);
  (td(8, "values") || []).forEach(v => add(resource, "ערך מנחה", v, 8));

  const sCount = secondary.length;
  const rCount = resource.length;
  const balance = (sCount + rCount) === 0 ? 0.5 : rCount / (sCount + rCount);

  return { primary, secondary, resource, counts: { secondary: sCount, resource: rCount }, balance };
}
