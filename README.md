# MAZE RUNNER: ESCAPE THE AI HUNTER

An atmospheric retro pixel-art maze survival game built from zero in vanilla HTML5, Canvas, and JavaScript.

Inspired by the ancient stone ruin aesthetic, twilight sunset palette, and restrained pixel UI of the original concept art.

---

## 🎮 Game Overview

You are the Cyan Runner, an explorer trapped in the sprawling ancient labyrinth ruins. Stalked by an autonomous red AI Hunter drone, your mission is to collect ancient amber energy relics scattered throughout the ruins, energize the dormant emerald sanctuary portal, and escape before you are intercepted.

---

## 🛠️ Technology Stack

- **HTML5 & CSS3**: Crisp layout with integer scaling, CRT scanline overlay, and responsive container.
- **Vanilla JavaScript (ES6+)**: Clean, decoupled, modular architecture without external frameworks or dependencies.
- **HTML5 Canvas**: Procedural 32×32 pixel-art sprite generator, 2.5D ruin wall rendering with autotiled shadows, animated particle motes, dynamic lighting, and cinematic sunset backdrop panorama.
- **Web Audio API**: 100% offline procedural 8-bit sound effects engine for footsteps, crystal pickups, portal humming, collisions, and retro victory fanfares.
- **No external images, no CDNs, and no API keys required**: Completely playable offline.

---

## 🚀 How to Run Locally

You can launch the game using any standard local HTTP server.

### Option 1: Built-in Node.js Server (Recommended — Zero Dependencies)

Run the included zero-dependency server script with Node.js:

```bash
node server.js
```

Open your browser and navigate to:
```
http://localhost:3000
```

### Option 2: Python HTTP Server

If you have Python installed:

```bash
# Python 3
python -m http.server 3000
```

Navigate to: `http://localhost:3000`

### Option 3: Direct File Opening

You can also simply double-click and open `index.html` directly in any modern browser (Chrome, Edge, Firefox, Safari).

---

## 🕹️ Controls

| Action | Primary Key | Secondary Key |
| :--- | :--- | :--- |
| **Move Up** | `W` | `Up Arrow (↑)` |
| **Move Down** | `S` | `Down Arrow (↓)` |
| **Move Left** | `A` | `Left Arrow (←)` |
| **Move Right** | `D` | `Right Arrow (→)` |
| **Pause / Resume** | `P` | `Escape` |
| **Quick Restart / Replay** | `R` | — |
| **Next Level (on victory)** | `Enter` | `Space` |
| **Toggle AI Path Vision** | `H` | HUD Button (`👁 AI PATH`) |

---

## 🏛️ Project Architecture

```
hackit/
├── index.html                  # Semantic game layout, HUD, menus, and retro terminal overlays
├── style.css                   # Pixel-perfect styles, CRT scanline effects, and retro modals
├── js/
│   ├── audio.js                # Web Audio API 8-bit synthesizer (footsteps, pickups, hit, fanfare)
│   ├── maze.js                 # Grid data, tile definitions, wall collisions, and relic trackers
│   ├── pathfinding.js          # Standalone A* (Manhattan/Euclidean) & BFS heuristic pathfinding engine
│   ├── player.js               # Grid-based movement with sub-pixel interpolation & input buffering
│   ├── enemy.js                # AI Hunter entity with autonomous path recalculation & telemetry
│   ├── renderer.js             # Procedural 32x32 sprites, holographic trajectory lasers, canvas scenes
│   └── main.js                 # Master game loop, state machine, input router, and HUD updates
├── server.js                   # Lightweight Node.js local dev server
├── test_progression_system.js  # Task 7 Progression, Level Completion & Replay test suite (119 assertions)
├── test_maze_generation.js     # Task 6 Procedural maze variety & themes test suite (3,819 assertions)
├── test_ai_intelligence.js     # Comprehensive Task 5 verification suite (369 assertions)
├── test_hunter_modes.js        # Task 4 Basic Hunter & AI reveal test suite
├── test_progression.js         # Task 3 Linear level difficulty progression test suite
├── test_astar.js               # Task 2 A* pathfinding verification suite
├── test_engine.js              # Headless engine verification suite
├── Progress.md                 # Detailed engineering log, benchmarks, and roadmap
└── README.md                   # Project documentation
```

---

## 🌟 Visual Art & Color Palette

- **Deep Navy & Obsidian**: `#0a1118`, `#101c26`, `#070b0f` — Ancient ruin depth and night sky.
- **Muted Teal & Twilight**: `#1e3a45`, `#264653`, `#2a9d8f` — Atmospheric twilight horizon.
- **Stone Grey**: `#19212a`, `#2b3541`, `#495867` — Weathered ruin walls and flagstone slabs.
- **Restrained Green**: `#132e20`, `#23583f`, `#3a875f` — Overgrown ivy, vines, and seam moss.
- **Cyan Runner (Player)**: `#00f0ff`, `#00a8cc` with survival backpack `#423c34`.
- **Red AI Hunter**: `#ff1744`, `#99182c`, `#260408` with pulsating cyclopean optical sensor.
- **Amber Relics**: `#ffb703`, `#ff9100` — Floating ancient power crystals.
- **Emerald Exit Portal**: `#00e676`, `#00c853` — Glowing runic gateway.

---

## 🧪 AI Lab Subsystem

Click the **AI LAB** button on the main menu to inspect the AI Hunter's real-time sensory telemetry and adjust simulation tuning parameters:
- **Heuristic Switching**: Toggle between `A* MANHATTAN` (optimal 4-way orthogonal grid search), `A* EUCLIDEAN` (diagonal distance bias), and `BFS SHORTEST` (uniform breadth-first exploration).
- **Live Search Telemetry**: Monitor Target Cell coordinates, Route Length (steps), Nodes Explored, and Computation Latency (ms).
- **Holographic Route Vision (Key: H)**: Renders the Hunter's real-time computed laser trajectory and cybernetic targeting reticle directly on the labyrinth floor.
- **Real-Time Sensor Radar**: Dynamically tracks the relative coordinates of the Hunter and Cyan Runner across the ancient stone ruins.

