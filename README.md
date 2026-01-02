# Local Bet Tracker 🏷️

A small desktop-first betting tracker using a local SQLite backend and a React + Vite frontend. The project includes Electron scaffolding so you can package a mac app that ships a seeded DB and copies it to a writable per‑user location on first run.

---

## 🚀 Quick overview
- **Backend:** Node.js + Express + sqlite3 (`server-sqlite.js`) — exposes a REST API (`/api/*`).
- **Frontend:** Vite + React (in `src/`) — pages: **Bets** and **Results**.
- **Packaging:** Electron + electron-builder for mac artifacts (`npm run package:mac`).

---

## 🔧 Prerequisites
- Node.js 16+ installed
- On macOS: required to build mac artifacts locally

---

## 🧪 Development (quick start)
Run these from the project root:

1. Install dependencies
```bash
npm install
```

2. Seed a sample DB (creates `./data/bets.db`)
```bash
npm run seed-db
```

3a. Run in development (all-in-one via Electron)
```bash
npm run electron:dev
```
This starts the API, starts Vite, and opens an Electron window.

3b. Or run pieces separately:
```bash
# API
node server-sqlite.js
# Frontend
npm run dev
# Open http://localhost:5173
```

Verify API:
```bash
curl http://localhost:4000/api/bets
```

---

## 📦 Build a mac artifact
Must run on macOS:
```bash
npm run package:mac
```
This runs the seed step (if configured) and builds a `.dmg`/`.app` using electron-builder. The package includes a bundled DB that will be copied to the user's data directory on first run.

> The per-user DB location is: `app.getPath('userData')/data/bets.db` (mac example: `~/Library/Application Support/<YourAppName>/data/bets.db`).

If Gatekeeper blocks the app, right-click → Open to allow it.

---

## 🧭 How to use the app (UI)
- **Bets** page:
  - Add a bet via **+ Add Bet**
  - **Sport**: select or **+ Add New Sport**
  - **Bet Type**: select or **+ Add New Bet Type** (pick **line** or **ev**)
  - **EV** bets: enter odds/stake/commission — EV% and EV value auto-calc
  - **Settle** PENDING bets with closing BSP or closing line and commission
- **Results** page: cumulative profit & EV charts, filters by sport/strategy/result

---

## 🔁 Environment & overrides
- Change API port:
```bash
PORT=5000 node server-sqlite.js
```
- Override DB directory:
```bash
export DATA_DIR="/path/to/data" # mac / linux
# PowerShell
$env:DATA_DIR = "C:\path\to\data"; node server-sqlite.js
```

---

## 🐞 Troubleshooting
- API returns HTML on POST: the request hit the frontend (start the API or run `npm run electron:dev`).
- Port conflict: start the API on a different `PORT`.
- Packaged app seems empty: confirm the bundled DB was copied into `app.getPath('userData')` on first run.
- Inspect DB: use DB Browser for SQLite or `sqlite3 ./data/bets.db`.

---

## 🛠️ Extending / Next steps
- Add `/api/info` or a debug endpoint to return `app.getPath('userData')` for easier verification of the packaged DB location.
- Add a GitHub Actions workflow to build mac artifacts on push (I can add this for you).

---

## 📄 Project structure
- `server-sqlite.js` — Express API & DB setup
- `scripts/seed_db.js` — creates `data/bets.db` with sample data
- `src/` — React frontend (pages: `Bets.jsx`, `Results.jsx`)
- `src/electron/main.js` — Electron main process (spawn server + copy-on-first-run DB)

---

If you'd like, I can add small helpers (an `/api/info` endpoint or a CI workflow) or update the README with extra developer notes — let me know which you'd prefer next! ✅
