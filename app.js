// ---------- Setup ----------
const $ = (id) => document.getElementById(id);

const configured = !SUPABASE_URL.startsWith("YOUR_") && !SUPABASE_ANON_KEY.startsWith("YOUR_");
const db = configured ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let habits = [];          // [{ id, name, created_at }]
let doneSet = new Set();  // "habitId|YYYY-MM-DD" for every completed day
let signUpMode = false;
let editingId = null;     // habit currently being renamed
const shownIds = new Set(); // habits already drawn once (only new ones animate in)

// Each habit gets an accent color, cycling through this palette
const COLORS = ["#7c3aed", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#14b8a6"];

// ---------- Date helpers ----------
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// Consecutive completed days ending today (or yesterday, if today isn't done yet)
function streakFor(habitId) {
  let start = doneSet.has(`${habitId}|${toDateStr(daysAgo(0))}`) ? 0 : 1;
  let streak = 0;
  while (doneSet.has(`${habitId}|${toDateStr(daysAgo(start + streak))}`)) streak++;
  return streak;
}

// ---------- UI helpers ----------
function show(el, visible) { el.classList.toggle("hidden", !visible); }

function message(el, text, isError = true) {
  el.textContent = text || "";
  el.classList.toggle("error", isError);
  show(el, !!text);
}

// ---------- Auth ----------
function setAuthMode(signUp) {
  signUpMode = signUp;
  $("auth-title").textContent = signUp ? "Create an account" : "Welcome back";
  $("auth-subtitle").textContent = signUp ? "Start tracking your habits in seconds." : "Log in to see your habits.";
  $("auth-submit").textContent = signUp ? "Sign up" : "Log in";
  $("auth-switch-text").textContent = signUp ? "Already have an account?" : "Don't have an account?";
  $("auth-switch").textContent = signUp ? "Log in" : "Sign up";
  $("password").autocomplete = signUp ? "new-password" : "current-password";
  show($("name-field"), signUp);
  message($("auth-message"), "");
}

$("auth-switch").addEventListener("click", (e) => {
  e.preventDefault();
  setAuthMode(!signUpMode);
});

$("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("email").value.trim();
  const password = $("password").value;
  $("auth-submit").disabled = true;
  message($("auth-message"), "");

  if (signUpMode) {
    const displayName = $("signup-name").value.trim();
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: displayName ? { data: { display_name: displayName } } : undefined,
    });
    if (error) message($("auth-message"), error.message);
    else if (!data.session) message($("auth-message"), "Account created! Check your email to confirm, then log in.", false);
  } else {
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) message($("auth-message"), error.message);
  }
  $("auth-submit").disabled = false;
});

$("logout-btn").addEventListener("click", () => db.auth.signOut());

// ---------- Display name ----------
// Stored in the Supabase user's metadata; falls back to the part of the email before "@"
function displayNameOf(user) {
  return user.user_metadata?.display_name || user.email.split("@")[0];
}

function renderName(user) {
  const name = displayNameOf(user);
  $("user-name").textContent = name;
  $("avatar").textContent = name[0];
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  $("greeting").textContent = `Good ${timeOfDay}, ${name} 👋`;
}

function showNameForm(visible) {
  show($("name-form"), visible);
  show($("profile-btn"), !visible);
  show($("logout-btn"), !visible);
  if (visible) {
    $("name-input").value = $("user-name").textContent;
    $("name-input").focus();
    $("name-input").select();
  }
}

$("profile-btn").addEventListener("click", () => showNameForm(true));
$("name-cancel").addEventListener("click", () => showNameForm(false));

$("name-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("name-input").value.trim();
  if (!name) return;

  const { data, error } = await db.auth.updateUser({ data: { display_name: name } });
  if (error) return message($("app-message"), error.message);

  renderName(data.user);
  showNameForm(false);
});

function renderSession(session) {
  const loggedIn = !!session;
  show($("auth-view"), !loggedIn);
  show($("app-view"), loggedIn);
  show($("user-bar"), loggedIn);
  showNameForm(false);

  if (loggedIn) {
    renderName(session.user);
    $("today-label").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    loadData();
  } else {
    habits = [];
    doneSet = new Set();
    $("auth-form").reset();
  }
}

// ---------- Data (CRUD) ----------
async function loadData() {
  const [habitsRes, logsRes] = await Promise.all([
    db.from("habits").select("id, name, created_at").order("created_at"),
    db.from("habit_logs").select("habit_id, log_date").gte("log_date", toDateStr(daysAgo(365))),
  ]);

  if (habitsRes.error || logsRes.error) {
    message($("app-message"), (habitsRes.error || logsRes.error).message);
    return;
  }
  message($("app-message"), "");
  habits = habitsRes.data;
  doneSet = new Set(logsRes.data.map((l) => `${l.habit_id}|${l.log_date}`));
  renderHabits();
}

// Create
$("add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("habit-name").value.trim();
  if (!name) return;

  const { data, error } = await db.from("habits").insert({ name }).select().single();
  if (error) return message($("app-message"), error.message);

  habits.push(data);
  $("habit-name").value = "";
  renderHabits();
});

// Update
async function renameHabit(habit, newName) {
  const name = newName.trim();
  editingId = null;
  if (!name || name === habit.name) return renderHabits();

  const { error } = await db.from("habits").update({ name }).eq("id", habit.id);
  if (error) return message($("app-message"), error.message);

  habit.name = name;
  renderHabits();
}

// Delete
async function deleteHabit(habit) {
  if (!confirm(`Delete "${habit.name}" and all its history?`)) return;

  const { error } = await db.from("habits").delete().eq("id", habit.id);
  if (error) return message($("app-message"), error.message);

  habits = habits.filter((h) => h.id !== habit.id);
  renderHabits();
}

// Mark / unmark a day as done
async function toggleDay(habit, dateStr) {
  const key = `${habit.id}|${dateStr}`;
  const wasDone = doneSet.has(key);

  const { error } = wasDone
    ? await db.from("habit_logs").delete().eq("habit_id", habit.id).eq("log_date", dateStr)
    : await db.from("habit_logs").insert({ habit_id: habit.id, log_date: dateStr });
  if (error) return message($("app-message"), error.message);

  wasDone ? doneSet.delete(key) : doneSet.add(key);
  renderHabits();
}

// ---------- Rendering ----------
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderStats() {
  const today = toDateStr(new Date());
  const doneToday = habits.filter((h) => doneSet.has(`${h.id}|${today}`)).length;
  const pct = habits.length ? Math.round((doneToday / habits.length) * 100) : 0;
  const best = habits.reduce((max, h) => Math.max(max, streakFor(h.id)), 0);

  $("stat-today").textContent = `${doneToday} / ${habits.length}`;
  $("today-pct").textContent = `${pct}%`;
  $("today-ring").style.setProperty("--pct", pct);
  $("stat-streak").textContent = `${best} ${best === 1 ? "day" : "days"}`;
  $("stat-count").textContent = habits.length;
}

function renderHabits() {
  renderStats();
  const list = $("habit-list");
  list.innerHTML = "";
  show($("empty"), habits.length === 0);

  const today = toDateStr(new Date());
  const week = [6, 5, 4, 3, 2, 1, 0].map(daysAgo);

  habits.forEach((habit, i) => {
    const doneToday = doneSet.has(`${habit.id}|${today}`);
    const li = el("li", "habit card" + (shownIds.has(habit.id) ? "" : " new"));
    shownIds.add(habit.id);
    li.style.setProperty("--accent", COLORS[i % COLORS.length]);

    // Big check button for today
    const check = el("button", "check" + (doneToday ? " done" : ""), "✓");
    check.title = doneToday ? "Mark today as not done" : "Mark today as done";
    check.onclick = () => toggleDay(habit, today);

    // Name + streak (or rename input while editing)
    const body = el("div", "habit-body");
    if (editingId === habit.id) {
      const form = el("form", "edit-row");
      const input = el("input");
      input.value = habit.name;
      input.maxLength = 100;
      const save = el("button", "btn primary", "Save");
      const cancel = el("button", "btn ghost", "Cancel");
      cancel.type = "button";
      cancel.onclick = () => { editingId = null; renderHabits(); };
      form.onsubmit = (e) => { e.preventDefault(); renameHabit(habit, input.value); };
      form.append(input, save, cancel);
      body.append(form);
      setTimeout(() => input.focus(), 0);
    } else {
      const s = streakFor(habit.id);
      const streak = el("div", "streak");
      if (s > 0) {
        streak.append("🔥 ", el("b", "", `${s} day streak`));
      } else {
        streak.textContent = "Start your streak today";
      }
      body.append(el("div", "habit-name" + (doneToday ? " done" : ""), habit.name), streak);
    }

    // Last 7 days – click a day to toggle it
    const days = el("div", "days");
    for (const d of week) {
      const dateStr = toDateStr(d);
      const cls = ["day"];
      if (doneSet.has(`${habit.id}|${dateStr}`)) cls.push("done");
      if (dateStr === today) cls.push("today");
      const btn = el("button", cls.join(" "));
      btn.title = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
      btn.append(el("small", "", d.toLocaleDateString(undefined, { weekday: "narrow" })), el("span", "dot", d.getDate()));
      btn.onclick = () => toggleDay(habit, dateStr);
      days.append(btn);
    }

    // Edit / delete
    const actions = el("div", "habit-actions");
    const editBtn = el("button", "icon-btn", "✏️");
    editBtn.title = "Rename";
    editBtn.onclick = () => { editingId = habit.id; renderHabits(); };
    const delBtn = el("button", "icon-btn danger", "🗑️");
    delBtn.title = "Delete";
    delBtn.onclick = () => deleteHabit(habit);
    actions.append(editBtn, delBtn);

    li.append(check, body, days, actions);
    list.append(li);
  });
}

// ---------- Start ----------
if (!configured) {
  show($("config-warning"), true);
  show($("auth-view"), true);
  $("auth-submit").disabled = true;
} else {
  db.auth.getSession().then(({ data }) => renderSession(data.session));
  db.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT") renderSession(session);
  });
}
