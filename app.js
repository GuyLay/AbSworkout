/**
 * ABS Workout App
 * ─────────────────────────────────────────────────────────────
 * State machine with three phases:
 *   "exercise"  – show exercise card, user presses Start/Done
 *   "rest"      – auto-countdown, then advance to next exercise
 *   "complete"  – all exercises for the day finished
 */

// ── Constants ─────────────────────────────────────────────────
const RING_CIRC = 2 * Math.PI * 52; // matches SVG r="52"
const VIDEO_EXTS = [".mp4", ".webm", ".ogg", ".mov"];
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday"];

// ── DOM references ─────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const screenExercise = $("screen-exercise");
const screenRest     = $("screen-rest");
const screenComplete = $("screen-complete");

const tabBar         = $("tab-bar");
const progressLabel  = $("progress-label");
const exerciseName   = $("exercise-name");
const exerciseDesc   = $("exercise-desc");
const mediaWrap      = $("media-wrap");

const ringProgress   = $("ring-progress");
const timerText      = $("timer-text");

const ringRest       = $("ring-rest");
const restTimerText  = $("rest-timer-text");
const nextUpName     = $("next-up-name");

const btnStart       = $("btn-start");
const btnDone        = $("btn-done");
const btnRestart     = $("btn-restart");

// ── Application state ──────────────────────────────────────────
let allExercises  = [];   // full data from workouts.json
let dayExercises  = [];   // exercises filtered for the active day
let currentIndex  = 0;    // index within dayExercises
let activeDay     = "";   // "Sunday" | "Monday" | "Tuesday"
let phase         = "idle"; // "idle" | "exercise" | "rest" | "complete"

// Timer internals
let timerInterval = null;   // setInterval handle
let timeRemaining = 0;      // seconds left in current countdown

// ── Boot ───────────────────────────────────────────────────────
fetch("./workouts.json")
  .then((r) => r.json())
  .then((data) => {
    allExercises = data;
    initTabs();
    const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const defaultDay = DAYS.includes(today) ? today : "Sunday";
    selectDay(defaultDay);
  })
  .catch(() => {
    exerciseName.textContent = "Could not load workouts.json";
    exerciseDesc.textContent = "Make sure the file exists next to index.html.";
  });

// ── Tab bar ────────────────────────────────────────────────────
function initTabs() {
  tabBar.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectDay(btn.dataset.day);
    });
  });
}

function selectDay(day) {
  activeDay = day;

  // Highlight active tab
  tabBar.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.day === day);
    btn.setAttribute("aria-selected", btn.dataset.day === day);
  });

  // Filter exercises for this day and reset to first
  dayExercises = allExercises.filter((e) => e.day === day);
  currentIndex = 0;
  stopTimer();
  showExercise();
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

  // Text content
  progressLabel.textContent = `Exercise ${currentIndex + 1} of ${dayExercises.length}`;
  exerciseName.textContent  = ex.name;
  exerciseDesc.textContent  = ex.description;

  // Media
  renderMedia(ex.media);

  // Timer ring reset to full (no countdown started yet)
  timeRemaining = ex.duration;
  setRing(ringProgress, 1); // 1 = full ring
  timerText.textContent = formatTime(ex.duration);

  // Buttons: Start active, Done always active
  btnStart.disabled = false;
  btnStart.textContent = "\u25B6 Start";
}

// Start the exercise countdown when the user taps Start
btnStart.addEventListener("click", () => {
  if (phase !== "exercise") return;
  btnStart.disabled = true; // prevent double-tap
  const total = dayExercises[currentIndex].duration;
  startCountdown(timeRemaining, total, ringProgress, timerText, () => {
    // Timer hit 0 — begin rest phase
    beginRest();
  });
});

// Done button — end exercise early and start rest
btnDone.addEventListener("click", () => {
  if (phase !== "exercise") return;
  stopTimer();
  beginRest();
});

// ── Rest screen ────────────────────────────────────────────────
function beginRest() {
  phase = "rest";
  stopTimer();

  const ex      = dayExercises[currentIndex];
  const nextEx  = dayExercises[currentIndex + 1];
  const restSec = ex ? ex.restTime : 15;

  showScreen("screen-rest");

  // Show upcoming exercise name (or "—" if this was the last)
  nextUpName.textContent = nextEx ? nextEx.name : "—";

  // Auto-start rest countdown
  startCountdown(restSec, restSec, ringRest, restTimerText, () => {
    // Rest finished — advance to next exercise
    currentIndex += 1;
    if (currentIndex >= dayExercises.length) {
      showComplete();
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

btnRestart.addEventListener("click", () => {
  currentIndex = 0;
  showExercise();
});

// ── Countdown engine ───────────────────────────────────────────
/**
 * Ticks every second, updates the ring arc and text, calls onDone at 0.
 * @param {number}   seconds   Starting value
 * @param {number}   total     Full duration (for ring ratio)
 * @param {Element}  ringEl    The <circle class="ring-progress"> element
 * @param {Element}  textEl    The text element showing the number
 * @param {Function} onDone    Called when the countdown reaches 0
 */
function startCountdown(seconds, total, ringEl, textEl, onDone) {
  timeRemaining = seconds;
  updateCountdownDisplay(timeRemaining, total, ringEl, textEl);

  timerInterval = setInterval(() => {
    timeRemaining -= 1;
    updateCountdownDisplay(timeRemaining, total, ringEl, textEl);

    if (timeRemaining <= 0) {
      stopTimer();
      onDone();
    }
  }, 1000);
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
/**
 * Sets the ring arc so it shows `ratio` of a full circle (1 = full, 0 = empty).
 * Uses stroke-dashoffset: 0 means full ring, RING_CIRC means empty.
 */
function setRing(el, ratio) {
  el.style.strokeDashoffset = RING_CIRC * (1 - ratio);
}

// ── Media renderer ─────────────────────────────────────────────
function renderMedia(src) {
  // Clear previous media element (keep placeholder in DOM as fallback)
  const existing = mediaWrap.querySelector("video, img");
  if (existing) existing.remove();

  if (!src) { showPlaceholder(); return; }

  const ext = src.substring(src.lastIndexOf(".")).toLowerCase();

  if (VIDEO_EXTS.includes(ext)) {
    const vid = document.createElement("video");
    vid.src      = src;
    vid.autoplay = true;
    vid.loop     = true;
    vid.muted    = true;
    vid.playsInline = true;
    vid.setAttribute("playsinline", ""); // iOS Safari
    vid.onerror = showPlaceholder;
    mediaWrap.insertBefore(vid, mediaWrap.firstChild);
    hidePlaceholder();
  } else if (IMAGE_EXTS.includes(ext)) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.onerror = showPlaceholder;
    mediaWrap.insertBefore(img, mediaWrap.firstChild);
    hidePlaceholder();
  } else {
    showPlaceholder();
  }
}

function showPlaceholder() {
  $("media-placeholder").style.display = "";
}

function hidePlaceholder() {
  $("media-placeholder").style.display = "none";
}

// ── Utility ────────────────────────────────────────────────────
function formatTime(sec) {
  if (sec <= 0) return "0";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : String(s);
}
