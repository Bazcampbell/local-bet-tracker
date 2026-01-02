import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import sqlite3 from 'sqlite3'
import { fileURLToPath } from 'url'

export async function startApi({ port = process.env.API_PORT || 4000, dataDir } = {}) {
  const app = express()
  app.use(cors())
  app.use(express.json())

  const DATA_DIR = dataDir ? dataDir : (process.env.DATA_DIR ? process.env.DATA_DIR : path.join(process.cwd(), 'data'))
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  const DB_PATH = path.join(DATA_DIR, 'bets.db')

  const db = new sqlite3.Database(DB_PATH, err => {
    if (err) {
      console.error('Failed to open db', err)
      process.exit(1)
    }
  })

  function run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err)
        resolve({ lastID: this.lastID, changes: this.changes })
      })
    })
  }

  function all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err)
        resolve(rows)
      })
    })
  }

  function get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) return reject(err)
        resolve(row)
      })
    })
  }

  // Initialize table
  await run(`CREATE TABLE IF NOT EXISTS bets (
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

  // Initialize sports table
  await run(`CREATE TABLE IF NOT EXISTS sports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`)

  // Initialize bet types table
  await run(`CREATE TABLE IF NOT EXISTS bet_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    kind TEXT DEFAULT 'line',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`)

  // Seed default bet types with kinds
  const DEFAULT_BET_TYPES = [
    { name: 'Total Over', kind: 'line' },
    { name: 'Total Under', kind: 'line' },
    { name: 'Line', kind: 'line' },
    { name: 'Disposals', kind: 'line' },
    { name: 'Win', kind: 'ev' },
    { name: 'Place', kind: 'ev' },
    { name: 'Lay Win', kind: 'ev' },
    { name: 'Lay Place', kind: 'ev' }
  ]
  for (const t of DEFAULT_BET_TYPES) {
    await run('INSERT OR IGNORE INTO bet_types (name, kind) VALUES (?, ?)', [t.name, t.kind])
  }

  // Ensure commission column exists on older DBs; ignore error if column already exists
  try {
    await run('ALTER TABLE bets ADD COLUMN commission REAL DEFAULT 0')
  } catch (err) {
    // column probably exists; no action needed
  }

  // Helpers
  function toNumberOrNull(val) {
    if (val === null || val === undefined || val === '') return null
    const n = Number(val)
    return Number.isFinite(n) ? n : null
  }

  // Routes
  app.get('/api/bets', async (req, res) => {
    try {
      const rows = await all('SELECT * FROM bets ORDER BY id DESC')
      res.json(rows)
    } catch (err) {
      console.error(err)
      res.status(500).send(err.message)
    }
  })

  // Sports endpoints
  app.get('/api/sports', async (req, res) => {
    try {
      const rows = await all('SELECT name FROM sports ORDER BY name COLLATE NOCASE')
      res.json(rows.map(r => r.name))
    } catch (err) {
      console.error(err)
      res.status(500).send(err.message)
    }
  })

  app.post('/api/sports', async (req, res) => {
    try {
      const name = (req.body && req.body.name || '').trim()
      if (!name) return res.status(400).send('Invalid sport name')
      await run('INSERT OR IGNORE INTO sports (name) VALUES (?)', [name])
      res.status(201).json({ name })
    } catch (err) {
      console.error(err)
      res.status(500).send(err.message)
    }
  })

  // Bet types endpoints
  app.get('/api/bet-types', async (req, res) => {
    try {
      const rows = await all('SELECT name, kind FROM bet_types ORDER BY name COLLATE NOCASE')
      res.json(rows)
    } catch (err) {
      console.error(err)
      res.status(500).send(err.message)
    }
  })

  app.post('/api/bet-types', async (req, res) => {
    try {
      const name = (req.body && req.body.name || '').trim()
      const kind = (req.body && req.body.kind || 'line').trim() === 'ev' ? 'ev' : 'line'
      if (!name) return res.status(400).send('Invalid bet type name')
      await run('INSERT OR IGNORE INTO bet_types (name, kind) VALUES (?, ?)', [name, kind])
      res.status(201).json({ name, kind })
    } catch (err) {
      console.error(err)
      res.status(500).send(err.message)
    }
  })

  app.get('/api/bets/:id', async (req, res) => {
    try {
      const row = await get('SELECT * FROM bets WHERE id = ?', [req.params.id])
      if (!row) return res.status(404).send('Not found')
      res.json(row)
    } catch (err) {
      console.error(err)
      res.status(500).send(err.message)
    }
  })

  app.post('/api/bets', async (req, res) => {
    try {
      const b = req.body || {}
      const result = await run(`INSERT INTO bets (date, sport, event, round_race, selection, bet, odds, stake, closing, line, closing_line, ev_perc, ev_val, result, return, commission, bf_market_id, bf_selection_id, strategy_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        b.date || null,
        b.sport || null,
        b.event || null,
        b.round_race || null,
        b.selection || null,
        b.bet || null,
        toNumberOrNull(b.odds),
        toNumberOrNull(b.stake),
        toNumberOrNull(b.closing),
        b.line || null,
        b.closing_line || null,
        toNumberOrNull(b.ev_perc),
        toNumberOrNull(b.ev_val),
        b.result || 'PENDING',
        toNumberOrNull(b.return),
        toNumberOrNull(b.commission),
        b.bf_market_id || null,
        b.bf_selection_id || null,
        b.strategy_ref || null
      ])

      // Ensure sport exists in sports table
      if (b.sport && b.sport.toString().trim() !== '') {
        await run('INSERT OR IGNORE INTO sports (name) VALUES (?)', [b.sport.toString().trim()])
      }

      // Ensure bet type exists in bet_types table
      if (b.bet && b.bet.toString().trim() !== '') {
        const kind = b.kind && b.kind === 'ev' ? 'ev' : 'line'
        await run('INSERT OR IGNORE INTO bet_types (name, kind) VALUES (?, ?)', [b.bet.toString().trim(), kind])
      }

      const row = await get('SELECT * FROM bets WHERE id = ?', [result.lastID])
      res.status(201).json(row)
    } catch (err) {
      console.error(err)
      res.status(500).send(err.message)
    }
  })

  app.put('/api/bets/:id', async (req, res) => {
    try {
      const id = req.params.id
      const b = req.body || {}
      const result = await run(`UPDATE bets SET date = ?, sport = ?, event = ?, round_race = ?, selection = ?, bet = ?, odds = ?, stake = ?, closing = ?, line = ?, closing_line = ?, ev_perc = ?, ev_val = ?, result = ?, return = ?, commission = ?, bf_market_id = ?, bf_selection_id = ?, strategy_ref = ? WHERE id = ?`, [
        b.date || null,
        b.sport || null,
        b.event || null,
        b.round_race || null,
        b.selection || null,
        b.bet || null,
        toNumberOrNull(b.odds),
        toNumberOrNull(b.stake),
        toNumberOrNull(b.closing),
        b.line || null,
        b.closing_line || null,
        toNumberOrNull(b.ev_perc),
        toNumberOrNull(b.ev_val),
        b.result || 'PENDING',
        toNumberOrNull(b.return),
        toNumberOrNull(b.commission),
        b.bf_market_id || null,
        b.bf_selection_id || null,
        b.strategy_ref || null,
        id
      ])

      // Ensure sport exists in sports table
      if (b.sport && b.sport.toString().trim() !== '') {
        await run('INSERT OR IGNORE INTO sports (name) VALUES (?)', [b.sport.toString().trim()])
      }

      // Ensure bet type exists in bet_types table
      if (b.bet && b.bet.toString().trim() !== '') {
        const kind = b.kind && b.kind === 'ev' ? 'ev' : 'line'
        await run('INSERT OR IGNORE INTO bet_types (name, kind) VALUES (?, ?)', [b.bet.toString().trim(), kind])
      }

      if (result.changes === 0) return res.status(404).send('Not found')
      const row = await get('SELECT * FROM bets WHERE id = ?', [id])
      res.json(row)
    } catch (err) {
      console.error(err)
      res.status(500).send(err.message)
    }
  })

  app.delete('/api/bets/:id', async (req, res) => {
    try {
      const id = req.params.id
      const result = await run('DELETE FROM bets WHERE id = ?', [id])
      if (result.changes === 0) return res.status(404).send('Not found')
      res.status(204).send()
    } catch (err) {
      console.error(err)
      res.status(500).send(err.message)
    }
  })

  // Settle endpoint that mirrors the frontend's settlement logic
  app.post('/api/bets/:id/settle', async (req, res) => {
    try {
      const id = req.params.id
      const { result, bspOdds, commission } = req.body || {}
      const bet = await get('SELECT * FROM bets WHERE id = ?', [id])
      if (!bet) return res.status(404).send('Not found')

      const bspOddsNum = Number(bspOdds) || 0
      const oddsNum = Number(bet.odds) || 0
      const stakeNum = Number(bet.stake) || 0
      const commissionNum = Number(commission !== undefined ? commission : bet.commission) || 0

      // determine bet type kind from bet_types table
      const bt = await get('SELECT kind FROM bet_types WHERE name = ?', [bet.bet])
      const betIsEvType = bt && bt.kind === 'ev'
      // detect lay by name containing 'lay' (case-insensitive)
      const betIsLayType = String(bet.bet || '').toLowerCase().includes('lay')

      let returnValue = 0

      if (betIsLayType) {
        if (result === 'WIN') {
          returnValue = stakeNum
        } else if (result === 'LOSE') {
          returnValue = -(oddsNum - 1) * stakeNum
        } else if (result === 'VOID') {
          returnValue = 0
        }
      } else {
        if (result === 'WIN') {
          returnValue = (oddsNum - 1) * stakeNum
        } else if (result === 'LOSE') {
          returnValue = -stakeNum
        } else if (result === 'VOID') {
          returnValue = 0
        }
      }

      if (returnValue > 0) {
        returnValue = (1 - commissionNum / 100) * returnValue
      }

      let updatedClosing = bet.closing
      let updatedClosingLine = bet.closing_line
      let updatedEvPerc = bet.ev_perc || null
      let updatedEvVal = bet.ev_val || null

      if (betIsEvType) {
        updatedClosing = bspOdds

        if (!isNaN(oddsNum) && !isNaN(bspOddsNum) && bspOddsNum > 1 && oddsNum > 1) {
          const commissionFactor = 1 - (commissionNum / 100)
          let evPerc = 0
          if (!betIsLayType) {
            // back bet EV: (odds_after_commission / closing - 1) × 100
            const oddsAfterCommission = 1 + (oddsNum - 1) * commissionFactor
            evPerc = ((oddsAfterCommission / bspOddsNum) - 1) * 100
          } else {
            // lay bet EV: (your_prob / fair_prob - 1) × 100 × (1 - commission)
            const yourProb = 1 / oddsNum
            const fairProb = 1 / bspOddsNum
            const edge = (yourProb / fairProb) - 1
            evPerc = edge * 100 * commissionFactor
          }
          const evVal = (evPerc / 100) * stakeNum
          updatedEvPerc = evPerc.toFixed(2)
          updatedEvVal = evVal.toFixed(2)
        }
      } else {
        updatedClosingLine = bspOdds
      }

      await run(`UPDATE bets SET closing = ?, closing_line = ?, ev_perc = ?, ev_val = ?, result = ?, return = ? WHERE id = ?`, [
        updatedClosing,
        updatedClosingLine,
        updatedEvPerc,
        updatedEvVal,
        result,
        parseFloat(returnValue).toFixed(2),
        id
      ])

      const updated = await get('SELECT * FROM bets WHERE id = ?', [id])
      res.json(updated)
    } catch (err) {
      console.error(err)
      res.status(500).send(err.message)
    }
  })

  // Serve frontend in production (if built)
  const DIST_DIR = path.join(process.cwd(), 'dist')
  if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR))
    app.get('*', (req, res) => {
      res.sendFile(path.join(DIST_DIR, 'index.html'))
    })
  }

  const server = app.listen(port, () => {
    console.log(`SQLite API server listening on port ${port}`)
  })

  return {
    app,
    server,
    db,
    close: () => new Promise((resolve) => server.close(() => { db.close(); resolve(); }))
  }
}

// If run directly, start the API
const __filename = fileURLToPath(import.meta.url)
if (process.argv[1] === __filename) {
  startApi().catch(err => {
    console.error('Failed to start API', err)
    process.exit(1)
  })
} else {
  // module loaded programmatically
}
