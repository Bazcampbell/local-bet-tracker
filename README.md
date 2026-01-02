Local Bet Tracker

This project contains an Express + SQLite backend (`server-sqlite.js`) and a Vite + React frontend (`src/`).

Scripts:
- npm install
- npm run start:api    # start the SQLite API
- npm run dev          # start Vite dev server
- npm run build        # build frontend into `dist` (then API will serve it)

API endpoints are under /api/bets and /api/bets/:id/settle
