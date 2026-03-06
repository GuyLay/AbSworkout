/**
 * ABS Workout App
 * ─────────────────────────────────────────────────────────────
 * Data sources:
 *   days.json     – day metadata: name, numberOfSets
 *   workouts.json – individual exercises per day
 *
 * State machine phases:
 *   "exercise"  – show exercise card, user presses Start / Done
 *   "rest"      – auto-countdown, then advance to next exercise or next set
 *   "complete"  – all sets for the day finished
 *
 * Set loop:
 *   After completing every exercise in a day, if sets remain the app
 *   resets currentIndex to 0 and increments currentSet, then shows
 *   the first exercise again. This repeats until currentSet === totalSets.
 */

// ── Constants ─────────────────────────────────────────────────
const RING_CIRC  = 2 * Math.PI * 52; // matches SVG r="52"
const VIDEO_EXTS = [".mp4", ".webm", ".ogg", ".mov"];
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"];

// ── DOM references ─────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const screenExercise = $("screen-exercise");
const screenRest     = $("screen-rest");
const screenComplete = $("screen-complete");

const tabBar         = $("tab-bar");
const dayNameEl      = $("day-name");
const dayTotalTimeEl = $("day-total-time");

const progressLabel  = $("progress-label");
const setLabel       = $("set-label");
const exerciseName   = $("exercise-name");
const exerciseDesc   = $("exercise-desc");
const mediaWrap      = $("media-wrap");

const ringProgress   = $("ring-progress");
const timerText      = $("timer-text");

const ringRest       = $("ring-rest");
const restTimerText  = $("rest-timer-text");
const nextUpLabel    = $("next-up-label");
const nextUpName     = $("next-up-name");

const btnStart       = $("btn-start");
const btnDone        = $("btn-done");
const btnSkipRest    = $("btn-skip-rest");
const btnRestart     = $("btn-restart");

// ── Application state ──────────────────────────────────────────
let allExercises = [];   // full data from workouts.json
let daysData     = [];   // full data from days.json
let dayExercises = [];   // exercises filtered for the active day
let activeDayObj = null; // current entry from daysData
let currentIndex = 0;    // exercise index within dayExercises
let currentSet   = 1;    // current set (1-based)
let totalSets    = 1;    // from activeDayObj.numberOfSets
let phase        = "idle";

// Timer internals
let timerInterval = null;
let timeRemaining = 0;

// ── Boot: fetch both JSON files in parallel ────────────────────
Promise.all([
  fetch("./days.json").then((r) => r.json()),
  fetch("./workouts.json").then((r) => r.json()),
])
  .then(([days, workouts]) => {
    daysData     = days;
    allExercises = workouts;
    buildTabs();
    // Always start on Plan A (first entry in days.json)
    selectDay(daysData[0].day);
  })
  .catch(() => {
    exerciseName.textContent = "Could not load days.json or workouts.json";
    exerciseDesc.textContent = "Make sure both files exist next to index.html.";
  });

// ── Tab bar — built dynamically from days.json ─────────────────
function buildTabs() {
  tabBar.innerHTML = "";
  daysData.forEach((d) => {
    const btn = document.createElement("button");
    btn.className    = "tab";
    btn.dataset.day  = d.day;
    btn.role         = "tab";
    btn.textContent  = d.day;
    btn.addEventListener("click", () => selectDay(d.day));
    tabBar.appendChild(btn);
  });
}

function selectDay(day) {
  activeDayObj = daysData.find((d) => d.day === day) || daysData[0];
  totalSets    = activeDayObj.numberOfSets || 1;

  // Highlight active tab
  tabBar.querySelectorAll(".tab").forEach((btn) => {
    const active = btn.dataset.day === activeDayObj.day;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active);
  });

  // Update day info strip
  dayNameEl.textContent = activeDayObj.name || activeDayObj.day;

  // Filter exercises and calculate total practice time
  dayExercises = allExercises.filter((e) => e.day === activeDayObj.day);
  dayTotalTimeEl.textContent = formatTotalTime(dayExercises, totalSets);

  // Reset and show first exercise
  currentIndex = 0;
  currentSet   = 1;
  stopTimer();
  showExercise();
}

// ── Total time calculator ──────────────────────────────────────
/**
 * Sum of (duration + restTime) for every exercise, multiplied by numberOfSets.
 * Displayed in the day info strip so the user knows how long the session takes.
 */
function calculateTotalSeconds(exercises, sets) {
  const perSet = exercises.reduce((acc, ex) => acc + (ex.duration || 0) + (ex.restTime || 0), 0);
  return perSet * sets;
}

function formatTotalTime(exercises, sets) {
  const total = calculateTotalSeconds(exercises, sets);
  if (total === 0) return "—";
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s total`;
  return s === 0 ? `~${m} min` : `~${m}m ${s}s`;
}

// ── Screen helpers ─────────────────────────────────────────────
function showScreen(id) {
  [screenExercise, screenRest, screenComplete].forEach((s) => {
    s.classList.toggle("hidden", s.id !== id);
  });
}

// ── Exercise screen ────────────────────────────────────────────
function showExercise() {
  phase = "exercise";
  showScreen("screen-exercise");

  const ex = dayExercises[currentIndex];
  if (!ex) { showComplete(); return; }

  progressLabel.textContent = `Exercise ${currentIndex + 1} of ${dayExercises.length}`;
  setLabel.textContent      = `Set ${currentSet} of ${totalSets}`;
  exerciseName.textContent  = ex.name;
  exerciseDesc.textContent  = ex.description;

  renderMedia(ex.media);
  renderTimeline();

  // Reset timer ring to full — countdown does NOT start until ▶ is pressed
  timeRemaining = ex.duration * 1000;
  setRing(ringProgress, 1);
  timerText.textContent = formatTime(timeRemaining);

  btnStart.disabled    = false;
  btnStart.textContent = "\u25B6 Start";
}

btnStart.addEventListener("click", () => {
  if (phase !== "exercise") return;
  btnStart.disabled = true;
  const total = dayExercises[currentIndex].duration * 1000;
  startCountdown(timeRemaining, total, ringProgress, timerText, () => beginRest());
});

btnDone.addEventListener("click", () => {
  if (phase !== "exercise") return;
  stopTimer();
  beginRest();
});

// ── Rest screen ────────────────────────────────────────────────
function beginRest() {
  phase = "rest";
  stopTimer();
  showScreen("screen-rest");

  const ex      = dayExercises[currentIndex];
  const restSec = (ex ? ex.restTime : 15) * 1000;

  // Determine what comes next: next exercise in this set, first exercise of
  // next set, or nothing (last set last exercise)
  const nextIndex = currentIndex + 1;
  const isLastExercise = nextIndex >= dayExercises.length;
  const isLastSet      = currentSet >= totalSets;

  if (isLastExercise && isLastSet) {
    nextUpLabel.textContent = "Finishing up";
    nextUpName.textContent  = "Workout complete!";
  } else if (isLastExercise) {
    // About to loop back to set start
    nextUpLabel.textContent = `Starting Set ${currentSet + 1} of ${totalSets}`;
    nextUpName.textContent  = dayExercises[0]?.name || "—";
  } else {
    nextUpLabel.textContent = "Up next";
    nextUpName.textContent  = dayExercises[nextIndex]?.name || "—";
  }

  startCountdown(restSec, restSec, ringRest, restTimerText, () => {
    currentIndex += 1;

    if (currentIndex >= dayExercises.length) {
      // Completed all exercises in this set
      if (currentSet < totalSets) {
        // More sets remain — loop back
        currentSet  += 1;
        currentIndex = 0;
        showExercise();
      } else {
        showComplete();
      }
    } else {
      showExercise();
    }
  });
}

// ── Complete screen ────────────────────────────────────────────
function showComplete() {
  phase = "complete";
  stopTimer();
  showScreen("screen-complete");
}

btnSkipRest.addEventListener("click", () => {
  if (phase !== "rest") return;
  stopTimer();
  currentIndex += 1;
  if (currentIndex >= dayExercises.length) {
    if (currentSet < totalSets) {
      currentSet  += 1;
      currentIndex = 0;
      showExercise();
    } else {
      showComplete();
    }
  } else {
    showExercise();
  }
});

btnRestart.addEventListener("click", () => {
  currentIndex = 0;
  currentSet   = 1;
  showExercise();
});

// ── Countdown engine ───────────────────────────────────────────
function startCountdown(ms, totalMs, ringEl, textEl, onDone) {
  timeRemaining = ms;
  updateCountdownDisplay(timeRemaining, totalMs, ringEl, textEl);

  timerInterval = setInterval(() => {
    timeRemaining -= 10;
    updateCountdownDisplay(timeRemaining, totalMs, ringEl, textEl);
    if (timeRemaining <= 0) {
      stopTimer();
      onDone();
    }
  }, 10);
}

function updateCountdownDisplay(remaining, total, ringEl, textEl) {
  const ratio = total > 0 ? Math.max(0, remaining / total) : 0;
  setRing(ringEl, ratio);
  textEl.textContent = formatTime(remaining);
}

function stopTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// ── SVG ring helper ────────────────────────────────────────────
// ratio 1 = full ring, 0 = empty ring
function setRing(el, ratio) {
  el.style.strokeDashoffset = RING_CIRC * (1 - ratio);
}

// ── Media renderer ─────────────────────────────────────────────
function renderMedia(src) {
  const existing = mediaWrap.querySelector("video, img");
  if (existing) existing.remove();

  if (!src) { showPlaceholder(); return; }

  const ext = src.substring(src.lastIndexOf(".")).toLowerCase();

  if (VIDEO_EXTS.includes(ext)) {
    const vid = document.createElement("video");
    vid.src         = src;
    vid.autoplay    = true;
    vid.loop        = true;
    vid.muted       = true;
    vid.playsInline = true;
    vid.setAttribute("playsinline", "");
    vid.onerror = showPlaceholder;
    mediaWrap.insertBefore(vid, mediaWrap.firstChild);
    hidePlaceholder();
  } else if (IMAGE_EXTS.includes(ext)) {
    const img = document.createElement("img");
    img.src    = src;
    img.alt    = "";
    img.onerror = showPlaceholder;
    mediaWrap.insertBefore(img, mediaWrap.firstChild);
    hidePlaceholder();
  } else {
    showPlaceholder();
  }
}

function showPlaceholder() { $("media-placeholder").style.display = ""; }
function hidePlaceholder() { $("media-placeholder").style.display = "none"; }

// ── Set timeline ───────────────────────────────────────────────
// One dot per exercise: grey = upcoming, green = done, cyan = current
function renderTimeline() {
  const el = $("timeline");
  el.innerHTML = "";
  dayExercises.forEach((_, i) => {
    const dot = document.createElement("span");
    dot.className = "tl-dot";
    if (i < currentIndex)      dot.classList.add("done");
    else if (i === currentIndex) dot.classList.add("active");
    el.appendChild(dot);
  });
}

// ── Utility ────────────────────────────────────────────────────
// Format milliseconds as  S.cs  or  M:SS.cs
function formatTime(ms) {
  if (ms <= 0) return "0.00";
  const totalSec = Math.floor(ms / 1000);
  const cs       = Math.floor((ms % 1000) / 10);  // centiseconds (0-99)
  const csStr    = String(cs).padStart(2, "0");
  const m        = Math.floor(totalSec / 60);
  const s        = totalSec % 60;
  if (m > 0) return `${m}:${String(s).padStart(2, "0")}.${csStr}`;
  return `${s}.${csStr}`;
}
