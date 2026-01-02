import React, { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function Toast({ text, onClose = () => {} }) {
  useEffect(() => {
    if (!text) return
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [text, onClose])
  if (!text) return null
  return <div className="toast">{text}</div>
}

// Helper function to parse dd/mm/yyyy to Date object
function parseDate(dateStr) {
  if (!dateStr) return null
  const parts = dateStr.split('/')
  if (parts.length !== 3) return null
  const [day, month, year] = parts
  const y = parseInt(year, 10)
  const m = parseInt(month, 10) - 1
  const d = parseInt(day, 10)
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null
  return new Date(y, m, d)
}

// Helper function to format Date to dd/mm/yyyy
function formatDate(date) {
  const d = new Date(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

export default function Results() {
  const [bets, setBets] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  // Filter states
  const [filterSport, setFilterSport] = useState('')
  const [filterBet, setFilterBet] = useState('')
  const [filterStrategy, setFilterStrategy] = useState('')
  const [dateRange, setDateRange] = useState('all') // all, week, month, 3months, 6months, year, custom
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')

  // Available filter options
  const [sports, setSports] = useState([])
  const [betTypes, setBetTypes] = useState([]) // objects {name, kind}
  const [strategies, setStrategies] = useState([])

  useEffect(() => {
    fetchBetTypes()
    fetchBets()
  }, [])

  async function fetchBetTypes() {
    try {
      const res = await fetch('/api/bet-types')
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setBetTypes(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load bet types', err)
      setBetTypes([])
    }
  }

  async function fetchBets() {
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('/api/bets')
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setBets(data)

      // Extract unique values for filters
      const uniqueSports = [...new Set((data || []).map(bet => bet.sport).filter(Boolean))].sort()
      setSports(uniqueSports)

      const uniqueStrategies = [...new Set((data || []).map(bet => bet.strategy_ref).filter(Boolean))].sort()
      setStrategies(uniqueStrategies)
    } catch (err) {
      console.error('Failed to fetch bets', err)
      setMessage(`Error loading bets: ${err.message}`)
      setBets([])
      setSports([])
      setStrategies([])
    } finally {
      setLoading(false)
    }
  }

  // Compute set of EV bet names from betTypes
  const evBetNames = new Set((betTypes || []).filter(t => t.kind === 'ev').map(t => t.name))

  // Apply filters to bets
  function getFilteredBets() {
    let filtered = [...bets]

    // Filter by sport
    if (filterSport) filtered = filtered.filter(bet => bet.sport === filterSport)

    // Filter by bet type
    if (filterBet) filtered = filtered.filter(bet => bet.bet === filterBet)

    // Filter by strategy
    if (filterStrategy) filtered = filtered.filter(bet => bet.strategy_ref === filterStrategy)

    // Filter by date range
    if (dateRange !== 'all') {
      const now = new Date()
      let startDate = null

      if (dateRange === 'week') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      else if (dateRange === 'month') startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      else if (dateRange === '3months') startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      else if (dateRange === '6months') startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
      else if (dateRange === 'year') startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
      else if (dateRange === 'custom') {
        const fromDate = customDateFrom ? parseDate(customDateFrom) : null
        const toDate = customDateTo ? parseDate(customDateTo) : null

        filtered = filtered.filter(bet => {
          const betDate = parseDate(bet.date)
          if (!betDate) return false
          if (fromDate && betDate < fromDate) return false
          if (toDate && betDate > toDate) return false
          return true
        })

        return filtered
      }

      if (startDate) {
        filtered = filtered.filter(bet => {
          const betDate = parseDate(bet.date)
          return betDate && betDate >= startDate
        })
      }
    }

    return filtered
  }

  // Calculate metrics
  function calculateMetrics(filteredBets) {
    // Only include settled bets (not PENDING)
    const settledBets = filteredBets.filter(bet => bet.result && bet.result !== 'PENDING')

    if (settledBets.length === 0) {
      return {
        betCount: 0,
        avgStake: 0,
        totalStake: 0,
        totalProfit: 0,
        avgProfit: 0,
        avgOdds: 0,
        highestOdds: 0,
        lowestOdds: 0,
        avgEv: null,
        totalEv: null,
        hasEvBets: false
      }
    }

    // Check if we have EV bets
    const evBets = settledBets.filter(bet => evBetNames.has(bet.bet))
    const hasEvBets = evBets.length > 0

    // Calculate basic metrics
    const stakes = settledBets.map(bet => parseFloat(bet.stake) || 0)
    const returns = settledBets.map(bet => parseFloat(bet.return) || 0)
    const odds = settledBets.map(bet => parseFloat(bet.odds) || 0).filter(o => o > 0)

    const totalStake = stakes.reduce((sum, val) => sum + val, 0)
    const totalProfit = returns.reduce((sum, val) => sum + val, 0)
    const avgStake = totalStake / settledBets.length
    const avgProfit = totalProfit / settledBets.length
    const avgOdds = odds.length > 0 ? odds.reduce((sum, val) => sum + val, 0) / odds.length : 0
    const highestOdds = odds.length > 0 ? Math.max(...odds) : 0
    const lowestOdds = odds.length > 0 ? Math.min(...odds) : 0
    const POT = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0

    // Calculate EV metrics if applicable
    let avgEv = null
    let totalEv = null

    if (hasEvBets) {
      const evValues = evBets.map(bet => parseFloat(bet.ev_val) || 0)
      totalEv = evValues.reduce((sum, val) => sum + val, 0)
      avgEv = totalEv / evBets.length
    }

    return {
      betCount: settledBets.length,
      avgStake: avgStake.toFixed(2),
      totalStake: totalStake.toFixed(2),
      totalProfit: totalProfit.toFixed(2),
      avgProfit: avgProfit.toFixed(2),
      avgOdds: avgOdds.toFixed(2),
      highestOdds: highestOdds.toFixed(2),
      lowestOdds: lowestOdds.toFixed(2),
      avgEv: avgEv !== null ? avgEv.toFixed(2) : null,
      totalEv: totalEv !== null ? totalEv.toFixed(2) : null,
      POT: POT.toFixed(2),
      hasEvBets
    }
  }

  // Prepare chart data
  function prepareChartData(filteredBets) {
    // Only include settled bets
    const settledBets = filteredBets
      .filter(bet => bet.result && bet.result !== 'PENDING')
      .sort((a, b) => {
        const dateA = parseDate(a.date)
        const dateB = parseDate(b.date)
        if (!dateA || !dateB) return 0
        return dateA - dateB
      })

    if (settledBets.length === 0) return []

    // Check if we have EV bets
    const hasEvBets = settledBets.some(bet => evBetNames.has(bet.bet))

    // Calculate cumulative values
    let cumulativeProfit = 0
    let cumulativeEv = 0

    const chartData = settledBets.map(bet => {
      const returnVal = parseFloat(bet.return) || 0
      const evVal = evBetNames.has(bet.bet) ? (parseFloat(bet.ev_val) || 0) : 0

      cumulativeProfit += returnVal
      cumulativeEv += evVal

      return {
        date: bet.date,
        profit: parseFloat(cumulativeProfit.toFixed(2)),
        ev: hasEvBets ? parseFloat(cumulativeEv.toFixed(2)) : null
      }
    })

    return chartData
  }

  const filteredBets = getFilteredBets()
  const metrics = calculateMetrics(filteredBets)
  const chartData = prepareChartData(filteredBets)

  return (
    <div>
      <h1>Results Dashboard</h1>

      {/* Filters */}
      <div style={{ marginBottom: 24, background: '#fbfdff', padding: 16, borderRadius: 8, border: '1px solid #dbe7f2' }}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Filters</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <strong>Sport:</strong>
            <select 
              value={filterSport} 
              onChange={e => setFilterSport(e.target.value)} 
              style={{ padding: 8, borderRadius: 6, border: '1px solid #dbe7f2' }}
            >
              <option value="">All sports</option>
              {sports.map(sport => (
                <option key={sport} value={sport}>{sport}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <strong>Bet Type:</strong>
            <select 
              value={filterBet} 
              onChange={e => setFilterBet(e.target.value)} 
              style={{ padding: 8, borderRadius: 6, border: '1px solid #dbe7f2' }}
            >
              <option value="">All bet types</option>
              {(betTypes || []).map(t => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <strong>Strategy:</strong>
            <select 
              value={filterStrategy} 
              onChange={e => setFilterStrategy(e.target.value)} 
              style={{ padding: 8, borderRadius: 6, border: '1px solid #dbe7f2' }}
            >
              <option value="">All strategies</option>
              {strategies.map(strategy => (
                <option key={strategy} value={strategy}>{strategy}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <strong>Date Range:</strong>
            <select 
              value={dateRange} 
              onChange={e => setDateRange(e.target.value)} 
              style={{ padding: 8, borderRadius: 6, border: '1px solid #dbe7f2' }}
            >
              <option value="all">All time</option>
              <option value="week">Last week</option>
              <option value="month">Last month</option>
              <option value="3months">Last 3 months</option>
              <option value="6months">Last 6 months</option>
              <option value="year">Last year</option>
              <option value="custom">Custom range</option>
            </select>
          </label>
        </div>

        {dateRange === 'custom' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <strong>From Date (dd/mm/yyyy):</strong>
              <input 
                type="text" 
                value={customDateFrom} 
                onChange={e => setCustomDateFrom(e.target.value)} 
                placeholder="01/01/2024"
                style={{ padding: 8, borderRadius: 6, border: '1px solid #dbe7f2' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <strong>To Date (dd/mm/yyyy):</strong>
              <input 
                type="text" 
                value={customDateTo} 
                onChange={e => setCustomDateTo(e.target.value)} 
                placeholder="31/12/2024"
                style={{ padding: 8, borderRadius: 6, border: '1px solid #dbe7f2' }}
              />
            </label>
          </div>
        )}

        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button 
            className="btn ghost" 
            onClick={() => {
              setFilterSport('')
              setFilterBet('')
              setFilterStrategy('')
              setDateRange('all')
              setCustomDateFrom('')
              setCustomDateTo('')
            }}
          >
            Clear All Filters
          </button>
          <button className="btn" onClick={fetchBets} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {message && <Toast text={message} onClose={() => setMessage('')} />}

      {/* Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #dbe7f2', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Bet Count</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#2196f3' }}>{metrics.betCount}</div>
        </div>

        <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #dbe7f2', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Total Stake</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#2196f3', fontFamily: 'monospace' }}>${metrics.totalStake}</div>
        </div>

        <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #dbe7f2', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Average Stake</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#2196f3', fontFamily: 'monospace' }}>${metrics.avgStake}</div>
        </div>

        <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #dbe7f2', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Total Profit</div>
          <div style={{ 
            fontSize: 28, 
            fontWeight: 700, 
            color: parseFloat(metrics.totalProfit) >= 0 ? '#4caf50' : '#f44336',
            fontFamily: 'monospace'
          }}>
            ${metrics.totalProfit}
          </div>
        </div>

        <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #dbe7f2', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Average Profit</div>
          <div style={{ 
            fontSize: 28, 
            fontWeight: 700, 
            color: parseFloat(metrics.avgProfit) >= 0 ? '#4caf50' : '#f44336',
            fontFamily: 'monospace'
          }}>
            ${metrics.avgProfit}
          </div>
        </div>

        <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #dbe7f2', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Average Odds</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#2196f3', fontFamily: 'monospace' }}>{metrics.avgOdds}</div>
        </div>

        <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #dbe7f2', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Highest Odds</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#ff9800', fontFamily: 'monospace' }}>{metrics.highestOdds}</div>
        </div>

        <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #dbe7f2', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Lowest Odds</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#ff9800', fontFamily: 'monospace' }}>{metrics.lowestOdds}</div>
        </div>

        {metrics.hasEvBets && (
          <>
            <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #dbe7f2', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Total EV</div>
              <div style={{ 
                fontSize: 28, 
                fontWeight: 700, 
                color: parseFloat(metrics.totalEv) >= 0 ? '#4caf50' : '#f44336',
                fontFamily: 'monospace'
              }}>
                ${metrics.totalEv}
              </div>
            </div>

            <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #dbe7f2', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Average EV</div>
              <div style={{ 
                fontSize: 28, 
                fontWeight: 700, 
                color: parseFloat(metrics.avgEv) >= 0 ? '#4caf50' : '#f44336',
                fontFamily: 'monospace'
              }}>
                ${metrics.avgEv}
              </div>
            </div>

            <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #dbe7f2', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>POT</div>
              <div style={{ 
                fontSize: 28, 
                fontWeight: 700, 
                color: parseFloat(metrics.POT) >= 0 ? '#4caf50' : '#f44336',
                fontFamily: 'monospace'
              }}>
                {metrics.POT}%
              </div>
            </div>
          </>
        )}
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <div style={{ background: '#fff', padding: 20, borderRadius: 8, border: '1px solid #dbe7f2', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24 }}>
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Performance Over Time</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis 
                dataKey="date" 
                style={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis style={{ fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ background: '#fff', border: '1px solid #dbe7f2', borderRadius: 4 }}
                formatter={(value) => `$${value}`}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="profit" 
                stroke="#2196f3" 
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Cumulative Profit"
              />
              {metrics.hasEvBets && (
                <Line 
                  type="monotone" 
                  dataKey="ev" 
                  stroke="#4caf50" 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Cumulative EV"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ background: '#fff', padding: 40, borderRadius: 8, border: '1px solid #dbe7f2', textAlign: 'center', color: '#666' }}>
          No data to display. Try adjusting your filters or add some settled bets.
        </div>
      )}
    </div>
  )
}