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
import { EMOTION_ALTERNATIVES } from "./data.js";

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
  // כלי החלפת אמונות (שבוע 6): כל מחשבה ששמרו (beliefSwapList) + הטופס הנוכחי — כולן נשמרות ולא נמחקות
  const beliefEntries = [...(td(6, "beliefSwapList") || []), td(6, "beliefSwap") || {}];
  resource.belief = (selfMap.newBelief || st.idealBelief || "").trim();

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
  // חשיפה — שרשרת מאוחדת (הכנה → יומן → אחרי). כל פריט = פחד מהסולם.
  const expItems = Array.isArray(td(7, "expItems")) ? td(7, "expItems") : [];
  const exposures = [];
  if (expItems.length) {
    expItems.forEach(it => {
      add(pain, "thought", "מחשבה בחשיפה", it.autoThoughts, 7);
      (it.emotions || []).forEach(e => add(pain, "emotion", "פחד בחשיפה", e, 7));
      add(resource, "thought", "מחשבה חלופית", it.altThoughts, 7);
      add(resource, "thought", "מנטרה", it.rational, 7);
      add(resource, "thought", "למידה מחשיפה", it.learned, 7);
      const fear = (it.fear || "").trim();
      if (fear) exposures.push({ fear, learned: (it.learned || "").trim(), done: !!it.done, day: it.day || "", time: it.time || "" });
    });
  } else {
    // תאימות לאחור — טפסים בודדים ישנים
    const prep = td(7, "prepForm") || {};
    (prep.emotions || []).forEach(e => add(pain, "emotion", "פחד בחשיפה", e, 7));
    add(pain, "thought", "מחשבה בחשיפה", prep.autoThoughts, 7);
    add(resource, "thought", "מחשבה חלופית", prep.altThoughts, 7);
    add(resource, "thought", "מנטרה", prep.rational, 7);
    add(resource, "thought", "למידה מחשיפה", (td(7, "afterForm") || {}).learned, 7);
  }

  // ===== צד המשאב (ההורה המיטיב) =====
  // (הרגש החלופי / חמלה עצמית מוצג ממורכז בתחתית הדשבורד — לא בעמודה)
  // מסגור מחדש — רק התוצאות המשמעותיות נכנסות (כוונה חיובית + דרך חלופית), לא כל שלב
  const rf = td(3, "reframe") || [];
  add(resource, "thought", "כוונה חיובית", rf[3], 3);
  add(resource, "behavior", "דרך חלופית", rf[4], 3);
  add(resource, "thought", "אי-הזדהות", td(3, "thirdPerson"), 3);
  add(resource, "thought", "חזון הזהות", (td(1, "dickens") || {}).identity, 1);
  add(resource, "emotion", "רגש בחזון", goal.dream_feel, 1);   // "מה עוד עולה בי שם, בגוף וברגש" — רגש, ולכן תחת קטגוריית רגש
  add(resource, "thought", "המטרה שלי", goal.goal_precise, 1);
  // כלי החלפת אמונות (שבוע 6) — כל המחשבות ששמרו
  beliefEntries.forEach(bt => {
    add(pain, "thought", "אמונה", bt.belief, 6);
    add(pain, "emotion", "רגש", bt.emotion, 6);
    add(resource, "emotion", "רגש שעולה", bt.emotionInstead, 6);
    add(resource, "thought", "אמונה חדשה", bt.newBelief, 6);
    add(resource, "thought", "בדיקת מציאות", bt.real, 6);
    add(resource, "thought", "הסבר אחר", bt.reframe, 6);
    add(resource, "thought", "רווח משומר", bt.keepBenefit, 6);
    add(resource, "behavior", "משאב חסר", bt.resources, 6);
  });
  // התנהגות מיטיבה
  Object.values(td(1, "activityPlan") || {}).forEach(v => add(resource, "behavior", "פעילות מהנה", v && v.activity, 1));
  (td(8, "values") || []).forEach(v => add(resource, "behavior", "ערך מנחה", v, 8));
  // פעולות ממשיות להגשמת הערכים (הלו"ז של הערכים — שבוע 8)
  Object.values(td(8, "realize") || {}).forEach(arr =>
    (Array.isArray(arr) ? arr : []).forEach(a => add(resource, "behavior", "פעילות מבוססת ערכים", a, 8)));
  add(resource, "behavior", "מה החלק צריך", (td(5, "focusing") || {}).needs, 5);
  Object.values(td(5, "burden") || {}).forEach(v => {
    const t = (v || "").trim();
    if (t) add(resource, "behavior", "הסרת העול", t, 5);   // הטקסט הגולמי — הקטגוריה "הסרת העול" מוצגת מעל
  });
  // תחושות חיוביות שנבחרו אחרי רגיעה/מדיטציה
  (st.senseNow || []).forEach(s => add(resource, "sensation", "תחושה עכשיו", s, 4));
  // כל מדיטציה שהאזנו לה — בשמה, כמענה מיטיב לחלק (כפילויות מתמזגות)
  (st.activities || []).filter(a => a.type === "meditation").forEach(a =>
    add(resource, "behavior", "מדיטציה", `🎧 ${(a.note || "").trim() || "מדיטציה"}`, 4));

  // ===== קישור הופכי: לכל רגש-כאב — רגש מיטיב שכנגד =====
  // כך צד המשאב (השמאלי) תמיד "עונה" לצד הכאב (הימני):
  // לא רק שהפחד יורד — עולה כנגדו אומץ; מול חרדה — ביטחון; מול בושה — חמלה עצמית, וכו'.
  const opposite = (text) => {
    const t = (text || "").trim();
    if (!t) return null;
    for (const [p, r] of Object.entries(EMOTION_ALTERNATIVES)) if (t.includes(p)) return r;
    return null;
  };
  // עותק של רגשות הכאב שנאספו עד כה (לפני שנוסיף מיטיבים), כדי לייצר לכל אחד מענה
  pain.emotion.slice().forEach(e => {
    const opp = opposite(e.text);
    if (opp) add(resource, "emotion", "רגש מיטיב שכנגד", opp, e.week);
  });
  // היעד שנבחר לרגש הראשוני (או ההופכי שלו) — מענה מרכזי
  const primaryOpp = (st.emotion.target || "").trim() || opposite(st.emotion.name);
  if (primaryOpp) add(resource, "emotion", "הרגש שאליו אני מכוון", primaryOpp, 1);

  const painCount = pain.thought.length + pain.emotion.length + pain.sensation.length + pain.over.length + pain.avoid.length;
  const resCount = resource.thought.length + resource.emotion.length + resource.sensation.length + resource.behavior.length;
  const balance = (painCount + resCount) === 0 ? 0.5 : resCount / (painCount + resCount);

  return {
    partName: (st.partName || "").trim(),
    idealName: (st.idealName || "").trim(),
    target: (st.emotion.target || "").trim(),
    primary, pain, resource, exposures,
    counts: { pain: painCount, resource: resCount },
    balance,
  };
}
