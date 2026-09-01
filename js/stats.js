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
