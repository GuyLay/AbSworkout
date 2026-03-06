# PROJECT.md — Workout Web App

## Overview

A static, dark-mode workout web app designed for mobile and desktop. It guides the user through a daily workout — one exercise at a time — with built-in exercise and rest timers, driven entirely by a JSON data file.

---

## Goals

- Display a structured workout program across three days (Sunday, Monday, Tuesday)
- Walk the user through each exercise sequentially with minimal friction
- Support both video and image exercise demonstrations
- Require zero backend — fully static and offline-capable

---

## File Structure

```
/
├── index.html          # App shell and markup
├── app.js              # All application logic (state, timer, rendering)
├── style.css           # Dark-mode styles, responsive layout, SVG ring
└── workouts.json       # Exercise data (editable without touching code)
```

---

## Data Format (`workouts.json`)

```json
[
  {
    "id": "sun-1",
    "day": "Sunday",
    "name": "Push-Up",
    "description": "Keep your body straight, lower your chest to the floor, push back up.",
    "duration": 40,
    "restTime": 20,
    "media": "./videos/pushup.mp4"
  },
  {
    "id": "sun-2",
    "day": "Sunday",
    "name": "Plank",
    "description": "Hold a straight-arm plank position. Engage your core throughout.",
    "duration": 45,
    "restTime": 15,
    "media": "./images/plank.jpg"
  }
]
```

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique identifier |
| `day` | string | `"Sunday"`, `"Monday"`, or `"Tuesday"` |
| `name` | string | Display name of the exercise |
| `description` | string | Short instruction shown to the user |
| `duration` | number | Exercise timer length in seconds |
| `restTime` | number | Rest period after the exercise in seconds |
| `media` | string | Relative path to `.mp4`, `.jpg`, `.png`, `.gif`, or `.webp` |

---

## User Flow

```
App loads
   │
   ▼
Auto-select today's tab (or Sunday as default)
   │
   ▼
Show Exercise 1 of the day
   │  User presses ▶ Start
   ▼
Exercise timer counts down
   │  Timer hits 0  ──OR──  User presses ✓
   ▼
Rest screen (auto-countdown)
   │  Rest timer hits 0
   ▼
Show next exercise  ──── (repeat) ────►  Workout Complete 🎉
```

---

## Key Screens

### 1. Exercise Screen
- Tab bar (day selector)
- Exercise name + description
- Media (video loop or image)
- SVG circular countdown timer (starts on ▶)
- ✓ Done button
- Progress indicator (e.g. "2 of 5")

### 2. Rest Screen
- Large "REST" label
- Auto-running countdown ring
- Upcoming exercise name (preview)

### 3. Completion Screen
- "Workout Complete! 🎉" message
- Option to restart the day

---

## Design Tokens

| Token | Value |
|---|---|
| Background | `#0f0f0f` |
| Surface | `#1a1a1a` |
| Text primary | `#f5f5f5` |
| Text secondary | `#9ca3af` |
| Accent | `#00e5ff` |
| Danger / Done btn | `#22c55e` |
| Max content width | `480px` |
| Min tap target | `48px` |

---

## How to Add Exercises

1. Open `workouts.json`
2. Add a new object following the data format above
3. Place your video or image file in the appropriate folder
4. Set the `media` path accordingly
5. Refresh the app — no build step needed

---

## How to Add a New Day

The tab bar is currently hardcoded to `Sunday`, `Monday`, `Tuesday`. To add more days:
1. Add exercises with the new `day` value in `workouts.json`
2. Add the new tab to the tab bar in `index.html`
3. No other changes required — the filtering logic is data-driven

---

## Browser Support

- Chrome 90+
- Safari 14+
- Firefox 88+
- No build tools or bundlers required
