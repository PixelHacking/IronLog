// ============================================================
// STATO GLOBALE
// ============================================================
const state = {
  user: null,
  profile: null,       // riga della tabella profiles (creato account, stato Pro)
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
  await loadProfile();
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
// PROFILO & STATO PRO
// ============================================================
async function loadProfile() {
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", state.user.id)
    .single();

  if (error) {
    console.error("Impossibile caricare il profilo:", error.message);
    state.profile = null;
    return;
  }
  state.profile = data;
}

function isAdmin() {
  return !!window.ADMIN_EMAIL &&
    state.user?.email?.toLowerCase() === window.ADMIN_EMAIL.toLowerCase();
}

function renderProfile() {
  $("#profile-email").textContent = state.user.email;

  const pro = computeProStatus(state.profile);
  const card = $("#pro-status-card");

  if (pro.isPro) {
    card.innerHTML = `
      <div class="pro-card is-pro">
        <div class="pro-title">⭐ Account PRO attivo</div>
        <div class="pro-sub">${pro.source === "manual" ? "Accesso concesso in anticipo dall'amministratore." : "Sbloccato per anzianità dell'account (365+ giorni)."}</div>
      </div>`;
  } else {
    const pct = Math.round(((365 - pro.daysLeft) / 365) * 100);
    card.innerHTML = `
      <div class="pro-card is-free">
        <div class="pro-title">Account Free</div>
        <div class="pro-sub">Mancano ${pro.daysLeft} giorni all'accesso PRO automatico.</div>
        <div class="pro-progress"><div class="pro-progress-fill" style="width:${pct}%"></div></div>
      </div>`;
  }

  if (isAdmin()) {
    $("#admin-panel").classList.remove("hidden");
    loadAdminUsers();
  } else {
    $("#admin-panel").classList.add("hidden");
  }
}

async function loadAdminUsers() {
  const { data, error } = await sb.rpc("admin_list_profiles");
  if (error) {
    $("#admin-user-list").innerHTML = `<p class="muted">Errore: ${escapeHtml(error.message)}</p>`;
    return;
  }

  $("#admin-user-list").innerHTML = data.map(u => {
    const status = computeProStatus(u);
    return `
      <div class="admin-user-row">
        <div>
          <div class="u-email">${escapeHtml(u.email || u.id)}</div>
          <div class="u-meta">Registrato il ${new Date(u.created_at).toLocaleDateString("it-IT")} · ${status.isPro ? "PRO" : `Free (${status.daysLeft}gg)`}</div>
        </div>
        <button class="admin-toggle ${u.pro_manual ? 'on' : ''}" data-uid="${u.id}" data-current="${u.pro_manual}">
          ${u.pro_manual ? "PRO ✓" : "Attiva PRO"}
        </button>
      </div>`;
  }).join("") || `<p class="muted">Nessun utente registrato.</p>`;

  $$("#admin-user-list .admin-toggle").forEach(btn => {
    btn.addEventListener("click", async () => {
      const uid = btn.dataset.uid;
      const newVal = btn.dataset.current !== "true";
      btn.disabled = true;
      const { error } = await sb.rpc("set_pro_status", { target_user_id: uid, pro: newVal });
      btn.disabled = false;
      if (error) { alert("Errore: " + error.message); return; }
      if (uid === state.user.id) await loadProfile();
      loadAdminUsers();
      if (state.currentView === "profile") renderProfile();
    });
  });
}

// ============================================================
// EXPORT CSV (funzione Pro)
// ============================================================
function exportAllCSV() {
  const header = ["Data","Esercizio","Categoria","Serie","Ripetizioni","Peso (kg)","Durata (min)","Note"];
  const rows = state.workouts.map(w => [
    w.workout_date, w.exercise_name, w.category, w.sets ?? "", w.reps ?? "",
    w.weight_kg ?? "", w.duration_min ?? "", (w.notes || "").replace(/[\r\n,]/g, " ")
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `iron-log_storico-completo.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportMonthCSV(year, month) {
  const inMonth = state.workouts.filter(w => {
    const d = new Date(w.workout_date + "T00:00:00");
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const header = ["Data","Esercizio","Categoria","Serie","Ripetizioni","Peso (kg)","Durata (min)","Note"];
  const rows = inMonth.map(w => [
    w.workout_date, w.exercise_name, w.category, w.sets ?? "", w.reps ?? "",
    w.weight_kg ?? "", w.duration_min ?? "", (w.notes || "").replace(/[\r\n,]/g, " ")
  ]);

  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `iron-log_${year}-${String(month+1).padStart(2,"0")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
  if (state.currentView === "profile") renderProfile();
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

  const proStatus = computeProStatus(state.profile);
  const exportBlock = proStatus.isPro
    ? `<button class="btn btn-ghost export-btn" id="export-csv-btn">⭐ Esporta questo mese in CSV</button>`
    : `<div class="muted export-btn">⭐ L'export CSV è una funzione PRO — sbloccala nel tuo profilo.</div>`;

  const allTime = computeAllTimeStats(state.workouts);
  const maxTrendCount = Math.max(...allTime.monthlyTrend.map(m => m.count), 1);

  const proSection = proStatus.isPro ? `
    <div class="section-title">⭐ Andamento ultimi 12 mesi</div>
    <div class="bar-chart">
      ${allTime.monthlyTrend.map(m => `<div class="bar ${m.count===maxTrendCount && m.count>0 ? 'max':''}" style="height:${Math.max(4,(m.count/maxTrendCount)*110)}px" title="${m.label}: ${m.count}"></div>`).join("")}
    </div>
    <div class="bar-chart-labels">
      ${allTime.monthlyTrend.map(m => `<span>${m.label}</span>`).join("")}
    </div>

    <div class="section-title">⭐ Costanza</div>
    <div class="stat-row">
      <div class="stat-block">
        <div class="num accent">${allTime.currentStreak}</div>
        <div class="lab">Streak attuale (gg)</div>
      </div>
      <div class="stat-block">
        <div class="num">${allTime.longestStreak}</div>
        <div class="lab">Record streak (gg)</div>
      </div>
      <div class="stat-block">
        <div class="num">${allTime.totalWorkoutsAllTime}</div>
        <div class="lab">Allenamenti totali</div>
      </div>
    </div>

    <div class="section-title">⭐ Record personali (peso massimo)</div>
    ${allTime.personalRecords.length ? allTime.personalRecords.map((r, i) => `
      <div class="workout-item">
        <div>
          <div class="exercise">${i+1}. ${escapeHtml(r.exercise)}</div>
          <div class="meta">${new Date(r.date+"T00:00:00").toLocaleDateString("it-IT")}${r.reps ? ` · ${r.reps} rip.` : ""}</div>
        </div>
        <div class="num" style="font-size:16px">${r.weight} kg</div>
      </div>
    `).join("") : `<p class="muted">Registra un peso per vedere qui i tuoi record.</p>`}

    <div class="section-title">⭐ Statistiche a vita</div>
    <div class="highlight-card">
      <div class="htitle">Volume totale sollevato da sempre</div>
      <div class="hval">${(allTime.totalVolumeAllTime/1000).toFixed(1)} tonnellate</div>
    </div>

    <button class="btn btn-ghost export-btn" id="export-all-btn">⭐ Esporta tutto lo storico in CSV</button>
  ` : `
    <div class="section-title">⭐ Funzioni PRO</div>
    <div class="highlight-card">
      <div class="htitle">Sblocca di più</div>
      <div class="hsub" style="margin-top:6px">Andamento ultimi 12 mesi, record personali per esercizio, streak di costanza, statistiche a vita ed export completo dello storico. Attivabili automaticamente dopo 365 giorni, o in anticipo dal tuo profilo.</div>
    </div>
  `;

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

    ${exportBlock}

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

    <div class="divider"></div>
    ${proSection}
  `;

  const exportBtn = $("#export-csv-btn");
  if (exportBtn) exportBtn.addEventListener("click", () => exportMonthCSV(year, month));

  const exportAllBtn = $("#export-all-btn");
  if (exportAllBtn) exportAllBtn.addEventListener("click", () => exportAllCSV());
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
