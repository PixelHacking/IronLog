// ============================================================
// Categorie di allenamento e relativi colori (usati in tutta l'app)
// ============================================================
window.CATEGORIES = [
  { key: "Petto", color: "#E14B34" },
  { key: "Schiena", color: "#4E9A8D" },
  { key: "Gambe", color: "#D9A441" },
  { key: "Spalle", color: "#7C9CDE" },
  { key: "Braccia", color: "#B57EDC" },
  { key: "Core", color: "#5FBF7A" },
  { key: "Cardio", color: "#E2678A" },
  { key: "Altro", color: "#9B9EA8" }
];

window.catColor = (key) =>
  (window.CATEGORIES.find(c => c.key === key) || window.CATEGORIES.at(-1)).color;

// ============================================================
// Calcola le statistiche di un mese a partire dall'elenco completo
// di allenamenti dell'utente (array di righe della tabella workouts).
// year: es. 2026, month: 0-11 (come Date JS)
// ============================================================
function computeMonthStats(allWorkouts, year, month) {
  const inMonth = allWorkouts.filter(w => {
    const d = new Date(w.workout_date + "T00:00:00");
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const result = {
    count: inMonth.length,
    totalVolume: 0,
    totalDuration: 0,
    byCategory: {},
    exerciseFrequency: {},
    exerciseVolume: {},
    activeDays: new Set(),
    weeklyBuckets: [0, 0, 0, 0, 0], // fino a 5 settimane per mese
  };

  inMonth.forEach(w => {
    const vol = (Number(w.sets) || 0) * (Number(w.reps) || 0) * (Number(w.weight_kg) || 0);
    result.totalVolume += vol;
    result.totalDuration += Number(w.duration_min) || 0;

    result.byCategory[w.category] = (result.byCategory[w.category] || 0) + 1;

    result.exerciseFrequency[w.exercise_name] = (result.exerciseFrequency[w.exercise_name] || 0) + 1;
    result.exerciseVolume[w.exercise_name] = (result.exerciseVolume[w.exercise_name] || 0) + vol;

    result.activeDays.add(w.workout_date);

    const dayOfMonth = new Date(w.workout_date + "T00:00:00").getDate();
    const weekIdx = Math.min(4, Math.floor((dayOfMonth - 1) / 7));
    result.weeklyBuckets[weekIdx] += 1;
  });

  result.activeDaysCount = result.activeDays.size;
  result.weeksInMonth = Math.ceil(daysInMonth / 7);
  result.avgPerWeek = result.weeksInMonth ? (result.count / result.weeksInMonth) : 0;

  result.topExercise = Object.entries(result.exerciseFrequency)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  result.topVolumeExercise = Object.entries(result.exerciseVolume)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  result.topCategory = Object.entries(result.byCategory)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return result;
}

// Confronta il mese corrente col precedente, restituisce variazione %
function monthDelta(current, previous) {
  if (!previous) return null;
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

window.computeMonthStats = computeMonthStats;
window.monthDelta = monthDelta;

// ============================================================
// Stato Pro: attivo se sono passati 365 giorni dalla creazione
// dell'account, oppure se l'admin l'ha attivato manualmente.
// ============================================================
function computeProStatus(profile) {
  if (!profile) return { isPro: false, daysLeft: 365, source: null };

  if (profile.pro_manual) {
    return { isPro: true, daysLeft: 0, source: "manual" };
  }

  const created = new Date(profile.created_at);
  const now = new Date();
  const daysSince = Math.floor((now - created) / (1000 * 60 * 60 * 24));
  const daysLeft = Math.max(0, 365 - daysSince);

  return {
    isPro: daysSince >= 365,
    daysLeft,
    source: daysSince >= 365 ? "anzianità" : null
  };
}

window.computeProStatus = computeProStatus;

// ============================================================
// STATISTICHE PRO: record personali, streak, andamento 12 mesi
// ============================================================
function computeAllTimeStats(allWorkouts) {
  // ---- Record personali: peso massimo mai sollevato per esercizio ----
  const records = {};
  allWorkouts.forEach(w => {
    const weight = Number(w.weight_kg) || 0;
    if (weight <= 0) return;
    if (!records[w.exercise_name] || weight > records[w.exercise_name].weight) {
      records[w.exercise_name] = { weight, date: w.workout_date, reps: w.reps || null };
    }
  });
  const personalRecords = Object.entries(records)
    .map(([exercise, r]) => ({ exercise, ...r }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8);

  // ---- Streak: giorni consecutivi con almeno un allenamento ----
  const activeDaysSet = new Set(allWorkouts.map(w => w.workout_date));
  const activeDaysSorted = Array.from(activeDaysSet).sort(); // ascendente

  let longestStreak = 0, run = 0, prevDate = null;
  activeDaysSorted.forEach(dateStr => {
    const d = new Date(dateStr + "T00:00:00");
    if (prevDate) {
      const diffDays = Math.round((d - prevDate) / 86400000);
      run = diffDays === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    longestStreak = Math.max(longestStreak, run);
    prevDate = d;
  });

  // Streak corrente: da oggi (o ieri) a ritroso
  let currentStreak = 0;
  let cursor = new Date();
  cursor.setHours(0,0,0,0);
  const toISO = (d) => d.toISOString().slice(0,10);
  // se oggi non c'è allenamento, si parte da ieri (lo streak "regge" fino a fine giornata)
  if (!activeDaysSet.has(toISO(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (activeDaysSet.has(toISO(cursor))) {
    currentStreak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // ---- Andamento ultimi 12 mesi ----
  const monthlyTrend = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const s = computeMonthStats(allWorkouts, d.getFullYear(), d.getMonth());
    monthlyTrend.push({
      year: d.getFullYear(), month: d.getMonth(),
      label: MONTHS_SHORT_IT[d.getMonth()],
      count: s.count, volume: s.totalVolume
    });
  }

  const totalVolumeAllTime = allWorkouts.reduce((sum, w) =>
    sum + (Number(w.sets)||0) * (Number(w.reps)||0) * (Number(w.weight_kg)||0), 0);

  return {
    personalRecords,
    longestStreak,
    currentStreak,
    monthlyTrend,
    totalWorkoutsAllTime: allWorkouts.length,
    totalVolumeAllTime
  };
}

const MONTHS_SHORT_IT = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];

window.computeAllTimeStats = computeAllTimeStats;

