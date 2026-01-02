import sqlite3 from 'sqlite3'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
const DB_PATH = path.join(DATA_DIR, 'bets.db')

// Remove existing DB to ensure reproducible seed
if (fs.existsSync(DB_PATH)) {
  try { fs.unlinkSync(DB_PATH) } catch (e) { console.warn('Could not remove existing DB:', e.message) }
}

const db = new sqlite3.Database(DB_PATH)

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    sport TEXT,
    event TEXT,
    round_race TEXT,
    selection TEXT,
    bet TEXT,
    odds REAL,
    stake REAL,
    closing REAL,
    line TEXT,
    closing_line TEXT,
    ev_perc REAL,
    ev_val REAL,
    result TEXT DEFAULT 'PENDING',
    return REAL,
    commission REAL DEFAULT 0,
    bf_market_id TEXT,
    bf_selection_id TEXT,
    strategy_ref TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS sports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS bet_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    kind TEXT DEFAULT 'line',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`)

  const betTypes = [
    { name: 'Total Over', kind: 'line' },
    { name: 'Total Under', kind: 'line' },
    { name: 'Line', kind: 'line' },
    { name: 'Disposals', kind: 'line' },
    { name: 'Win', kind: 'ev' },
    { name: 'Place', kind: 'ev' },
    { name: 'Lay Win', kind: 'ev' },
    { name: 'Lay Place', kind: 'ev' }
  ]
  const insertBt = db.prepare('INSERT OR IGNORE INTO bet_types (name, kind) VALUES (?, ?)')
  for (const t of betTypes) insertBt.run(t.name, t.kind)
  insertBt.finalize()

  const sports = ['Horse', 'Greyhound', 'Harness']
  const insertSport = db.prepare('INSERT OR IGNORE INTO sports (name) VALUES (?)')
  for (const s of sports) insertSport.run(s)
  insertSport.finalize()

  const insertBet = db.prepare(`INSERT INTO bets (date, sport, event, round_race, selection, bet, odds, stake, closing, line, closing_line, ev_perc, ev_val, result, return, commission, bf_market_id, bf_selection_id, strategy_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)

  // Sample pending EV bet
  insertBet.run(new Date().toLocaleDateString('en-GB').split('/').join('/'), 'Horse', 'Spring Cup', 'Final', 'Speedster', 'Win', 3.5, 10, 4.0, null, null, 5.00, 0.50, 'PENDING', null, 8, null, null, 'S1')

  // Sample pending Line bet
  insertBet.run(new Date().toLocaleDateString('en-GB').split('/').join('/'), 'Greyhound', 'Final Dash', '', 'Flash', 'Line', 2.0, 20, null, '2.5', '2.5', null, null, 'PENDING', null, 0, null, null, 'S2')

  // Sample settled WIN (back bet)
  insertBet.run(new Date().toLocaleDateString('en-GB').split('/').join('/'), 'Horse', 'Autumn Stakes', 'Heat 1', 'Thunder', 'Win', 2.5, 10, 2.8, null, null, 2.00, 0.20, 'WIN', 13.80, 8, null, null, 'S1')

  // Sample settled LOSE (lay bet)
  insertBet.run(new Date().toLocaleDateString('en-GB').split('/').join('/'), 'Harness', 'Night Cup', '', 'Runner', 'Lay Win', 4.0, 5, 3.5, null, null, -30.00, -30.00, 'LOSE', -15.00, 0, null, null, 'S3')

  insertBet.finalize()

  console.log('Seed DB created at', DB_PATH)
})

db.close()
