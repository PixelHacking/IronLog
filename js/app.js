// ============================================================
// STATO GLOBALE
// ============================================================
const state = {
  user: null,
  workouts: [],          // tutti gli allenamenti dell'utente, più recenti prima
  reportDate: new Date(),
  currentView: "dashboard"
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const MONTHS_IT = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno",
  "Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const WEEKDAYS_IT = ["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"];

// ============================================================
// AUTENTICAZIONE
// ============================================================
async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    await onLoggedIn(session.user);
  } else {
    showAuthView();
  }

  sb.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user) {
      onLoggedIn(session.user);
    } else if (event === "SIGNED_OUT") {
      state.user = null;
      showAuthView();
    }
  });
}

async function onLoggedIn(user) {
  state.user = user;
  $("#profile-email").textContent = user.email;
  $("#auth-view").classList.add("hidden");
  $("#app-shell").classList.remove("hidden");
  await loadWorkouts();
  renderCurrentView();
}

function showAuthView() {
  $("#app-shell").classList.add("hidden");
  $("#auth-view").classList.remove("hidden");
}

function setAuthError(msg) {
  const el = $("#auth-error");
  if (!msg) { el.classList.add("hidden"); return; }
  el.textContent = msg;
  el.classList.remove("hidden");
}

function setAuthNote(msg) {
  const el = $("#auth-note");
  if (!msg) { el.classList.add("hidden"); return; }
  el.textContent = msg;
  el.classList.remove("hidden");
}

$("#show-signup").addEventListener("click", () => {
  $("#login-form").classList.add("hidden");
  $("#signup-form").classList.remove("hidden");
  $("#show-signup").classList.add("hidden");
  $("#show-login").classList.remove("hidden");
  setAuthError(null); setAuthNote(null);
});
$("#show-login").addEventListener("click", () => {
  $("#signup-form").classList.add("hidden");
  $("#login-form").classList.remove("hidden");
  $("#show-login").classList.add("hidden");
  $("#show-signup").classList.remove("hidden");
  setAuthError(null); setAuthNote(null);
});

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthError(null);
  const email = $("#login-email").value.trim();
  const password = $("#login-password").value;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) setAuthError(traduciErrore(error.message));
});

$("#signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthError(null);
  const email = $("#signup-email").value.trim();
  const password = $("#signup-password").value;
  const { error } = await sb.auth.signUp({ email, password });
  if (error) {
    setAuthError(traduciErrore(error.message));
  } else {
    setAuthNote("Account creato. Controlla la tua email se è richiesta la conferma, poi accedi.");
    $("#signup-form").classList.add("hidden");
    $("#login-form").classList.remove("hidden");
    $("#show-login").classList.remove("hidden");
    $("#show-signup").classList.add("hidden");
  }
});

$("#logout-btn").addEventListener("click", async () => {
  await sb.auth.signOut();
});

function traduciErrore(msg) {
  if (/invalid login credentials/i.test(msg)) return "Email o password non corrette.";
  if (/user already registered/i.test(msg)) return "Esiste già un account con questa email.";
  if (/password should be/i.test(msg)) return "La password deve avere almeno 6 caratteri.";
  return msg;
}

// ============================================================
// DATI: caricamento allenamenti
// ============================================================
async function loadWorkouts() {
  const { data, error } = await sb
    .from("workouts")
    .select("*")
    .order("workout_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }
  state.workouts = data || [];
}

async function addWorkout(payload) {
  const { error } = await sb.from("workouts").insert({
    user_id: state.user.id,
    ...payload
  });
  if (error) throw error;
  await loadWorkouts();
}

async function deleteWorkout(id) {
  const { error } = await sb.from("workouts").delete().eq("id", id);
  if (error) { console.error(error); return; }
  state.workouts = state.workouts.filter(w => w.id !== id);
  renderCurrentView();
}

// ============================================================
// NAVIGAZIONE
// ============================================================
$$("[data-nav]").forEach(el => {
  el.addEventListener("click", () => navigate(el.dataset.nav));
});
$("#fab-add").addEventListener("click", () => navigate("add"));

function navigate(view) {
  state.currentView = view;
  $$(".view").forEach(v => v.classList.add("hidden"));
  $(`#view-${view}`).classList.remove("hidden");

  $$(".bottom-nav button").forEach(b => b.classList.remove("active"));
  const navBtn = $(`.bottom-nav button[data-nav="${view}"]`);
  if (navBtn) navBtn.classList.add("active");

  renderCurrentView();
}

function renderCurrentView() {
  if (!state.user) return;
  if (state.currentView === "dashboard") renderDashboard();
  if (state.currentView === "history") renderHistory();
  if (state.currentView === "report") renderReport();
  if (state.currentView === "add") prepareAddForm();
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  $("#today-label").textContent = new Date().toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long"
  });

  const now = new Date();
  const stats = computeMonthStats(state.workouts, now.getFullYear(), now.getMonth());

  $("#dash-stats").innerHTML = `
    <div class="stat-block">
      <div class="num accent">${stats.count}</div>
      <div class="lab">Allenamenti (mese)</div>
    </div>
    <div class="stat-block">
      <div class="num">${stats.activeDaysCount}</div>
      <div class="lab">Giorni attivi</div>
    </div>
    <div class="stat-block">
      <div class="num">${stats.avgPerWeek.toFixed(1)}</div>
      <div class="lab">Media/settimana</div>
    </div>
  `;

  const recent = state.workouts.slice(0, 5);
  $("#dash-recent").innerHTML = recent.length
    ? renderWorkoutGroups(recent)
    : `<div class="empty-state"><div class="display">Nessun allenamento</div>Premi + per registrare il primo.</div>`;

  attachDeleteHandlers("#dash-recent");
}

// ============================================================
// STORICO
// ============================================================
function renderHistory() {
  $("#history-list").innerHTML = state.workouts.length
    ? renderWorkoutGroups(state.workouts)
    : `<div class="empty-state"><div class="display">Nessun allenamento</div>Il tuo storico apparirà qui.</div>`;
  attachDeleteHandlers("#history-list");
}

function renderWorkoutGroups(list) {
  const groups = {};
  list.forEach(w => {
    groups[w.workout_date] = groups[w.workout_date] || [];
    groups[w.workout_date].push(w);
  });

  return Object.entries(groups).map(([date, items]) => {
    const d = new Date(date + "T00:00:00");
    const label = `${WEEKDAYS_IT[d.getDay()]} ${d.getDate()} ${MONTHS_IT[d.getMonth()]}`;
    const rows = items.map(w => `
      <div class="workout-item" data-id="${w.id}">
        <div>
          <div class="exercise"><span class="cat-dot" style="background:${catColor(w.category)}"></span>${escapeHtml(w.exercise_name)}</div>
          <div class="meta">${formatWorkoutMeta(w)}</div>
        </div>
        <button class="del" data-id="${w.id}" aria-label="Elimina">×</button>
      </div>
    `).join("");
    return `<div class="day-group"><div class="day-label">${label}</div>${rows}</div>`;
  }).join("");
}

function formatWorkoutMeta(w) {
  const parts = [];
  if (w.sets && w.reps) parts.push(`${w.sets}×${w.reps}`);
  if (w.weight_kg) parts.push(`${w.weight_kg} kg`);
  if (w.duration_min) parts.push(`${w.duration_min} min`);
  parts.push(w.category);
  return parts.join(" · ");
}

function attachDeleteHandlers(scopeSel) {
  $$(`${scopeSel} .del`).forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("Eliminare questo allenamento?")) deleteWorkout(btn.dataset.id);
    });
  });
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// ============================================================
// REPORT MENSILE
// ============================================================
$("#prev-month").addEventListener("click", () => {
  state.reportDate.setMonth(state.reportDate.getMonth() - 1);
  renderReport();
});
$("#next-month").addEventListener("click", () => {
  state.reportDate.setMonth(state.reportDate.getMonth() + 1);
  renderReport();
});

function renderReport() {
  const year = state.reportDate.getFullYear();
  const month = state.reportDate.getMonth();
  $("#month-label").textContent = `${MONTHS_IT[month]} ${year}`;

  const stats = computeMonthStats(state.workouts, year, month);

  const prevDate = new Date(year, month - 1, 1);
  const prevStats = computeMonthStats(state.workouts, prevDate.getFullYear(), prevDate.getMonth());
  const delta = monthDelta(stats.count, prevStats.count);

  if (stats.count === 0) {
    $("#report-content").innerHTML = `<div class="empty-state"><div class="display">Nessun dato</div>Non hai registrato allenamenti in questo mese.</div>`;
    return;
  }

  const deltaText = delta === null ? "" :
    delta >= 0 ? `+${delta}% rispetto al mese scorso` : `${delta}% rispetto al mese scorso`;

  const catEntries = Object.entries(stats.byCategory).sort((a,b) => b[1]-a[1]);
  const maxCat = catEntries[0]?.[1] || 1;

  const weekBars = stats.weeklyBuckets.slice(0, stats.weeksInMonth);
  const maxWeek = Math.max(...weekBars, 1);

  $("#report-content").innerHTML = `
    <div class="stat-row">
      <div class="stat-block">
        <div class="num accent">${stats.count}</div>
        <div class="lab">Allenamenti</div>
      </div>
      <div class="stat-block">
        <div class="num">${stats.activeDaysCount}</div>
        <div class="lab">Giorni attivi</div>
      </div>
      <div class="stat-block">
        <div class="num">${Math.round(stats.totalVolume/1000)}t</div>
        <div class="lab">Volume totale</div>
      </div>
    </div>

    <div class="highlight-card">
      <div class="htitle">Frequenza settimanale</div>
      <div class="hval">${stats.avgPerWeek.toFixed(1)} allenamenti/settimana</div>
      ${deltaText ? `<div class="hsub">${deltaText}</div>` : ""}
    </div>

    <div class="section-title">Allenamenti per settimana</div>
    <div class="bar-chart">
      ${weekBars.map(v => `<div class="bar ${v===maxWeek && v>0 ? 'max':''}" style="height:${Math.max(4,(v/maxWeek)*110)}px"></div>`).join("")}
    </div>
    <div class="bar-chart-labels">
      ${weekBars.map((_,i) => `<span>Sett. ${i+1}</span>`).join("")}
    </div>

    <div class="section-title">Distribuzione per categoria</div>
    ${catEntries.map(([cat,count]) => `
      <div class="cat-bar-row">
        <div class="cat-name">${cat}</div>
        <div class="cat-track"><div class="cat-fill" style="width:${(count/maxCat)*100}%;background:${catColor(cat)}"></div></div>
        <div class="cat-val">${count}</div>
      </div>
    `).join("")}

    <div class="section-title">In evidenza</div>
    <div class="highlight-card">
      <div class="htitle">Esercizio più frequente</div>
      <div class="hval">${escapeHtml(stats.topExercise || "—")}</div>
    </div>
    <div class="highlight-card">
      <div class="htitle">Esercizio con maggior volume totale</div>
      <div class="hval">${escapeHtml(stats.topVolumeExercise || "—")}</div>
    </div>
    ${stats.totalDuration > 0 ? `
    <div class="highlight-card">
      <div class="htitle">Minuti totali di cardio/attività a tempo</div>
      <div class="hval">${Math.round(stats.totalDuration)} min</div>
    </div>` : ""}
  `;
}

// ============================================================
// FORM NUOVO ALLENAMENTO
// ============================================================
let selectedCategory = "Petto";

function prepareAddForm() {
  $("#w-date").value = new Date().toISOString().slice(0,10);
  renderCategoryChips();
}

function renderCategoryChips() {
  $("#category-chips").innerHTML = CATEGORIES.map(c => `
    <div class="chip ${c.key === selectedCategory ? 'active' : ''}" data-cat="${c.key}">${c.key}</div>
  `).join("");
  $$("#category-chips .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      selectedCategory = chip.dataset.cat;
      renderCategoryChips();
    });
  });
}

$("#workout-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    exercise_name: $("#w-exercise").value.trim(),
    category: selectedCategory,
    workout_date: $("#w-date").value,
    sets: $("#w-sets").value ? Number($("#w-sets").value) : null,
    reps: $("#w-reps").value ? Number($("#w-reps").value) : null,
    weight_kg: $("#w-weight").value ? Number($("#w-weight").value) : null,
    duration_min: $("#w-duration").value ? Number($("#w-duration").value) : null,
    notes: $("#w-notes").value.trim() || null
  };

  try {
    await addWorkout(payload);
    e.target.reset();
    $("#w-date").value = new Date().toISOString().slice(0,10);
    navigate("dashboard");
  } catch (err) {
    alert("Errore nel salvataggio: " + err.message);
  }
});

// ============================================================
// SERVICE WORKER (PWA)
// ============================================================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(console.error);
  });
}

// ============================================================
// INIT
// ============================================================
initAuth();
