import React, { useEffect, useState } from 'react'



// Dynamic sports and bet types lists (fetched from API)


export default function Bets(){
  const [bets, setBets] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [filterSport, setFilterSport] = useState('')
  const [filterResult, setFilterResult] = useState('')

  // Dynamic sports fetched from API
  const [sports, setSports] = useState([])
  const [newSport, setNewSport] = useState('')
  const [newStrategy, setNewStrategy] = useState('')

  // Dynamic bet types
  const [betTypes, setBetTypes] = useState([])
  const [newBetTypeKind, setNewBetTypeKind] = useState(null)
  const [showAddBetTypeModal, setShowAddBetTypeModal] = useState(false)
  const [betTypeModalName, setBetTypeModalName] = useState('')
  const [betTypeModalKind, setBetTypeModalKind] = useState('line')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    date: new Date().toLocaleDateString('en-GB').split('/').join('/'),
    sport: '',
    event: '',
    round_race: '',
    selection: '',
    bet: '',
    odds: '',
    stake: '',
    closing: '',
    line: '',
    closing_line: '',
    ev_perc: '',
    ev_val: '',
    result: 'PENDING',
    return: '',
    bf_market_id: '',
    bf_selection_id: '',
    strategy_ref: '',
    commission: '0'
  })

  // Commission and BSP used for settle
  const [commission, setCommission] = useState('8')
  const [bspOdds, setBspOdds] = useState('')
  const [settleModal, setSettleModal] = useState(null)

  // Determine bet kind to control form fields (either chosen when creating a new bet type or from existing bet type)
  const currentBetKind = newBetTypeKind || (betTypes.find(t => t.name === formData.bet)?.kind) || 'line'

  useEffect(() => { fetchBets(); fetchSports(); fetchBetTypes() }, [])

  async function fetchBetTypes(){
    try{
      const res = await fetch('/api/bet-types')
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setBetTypes(Array.isArray(data) ? data : [])
    } catch (err){
      console.error('Failed to load bet types', err)
      setBetTypes([])
    }
  }

  // Auto-calculate EV% and EV value when odds/closing/stake/commission change for EV bet types
  React.useEffect(() => {
    if (currentBetKind !== 'ev') {
      if (formData.ev_perc || formData.ev_val) setFormData(prev => ({ ...prev, ev_perc: '', ev_val: '' }))
      return
    }

    const oddsNum = Number(formData.odds)
    const bspNum = Number(formData.closing)
    const stakeNum = Number(formData.stake) || 0
    const commissionNum = Number(formData.commission) || 0

    if (!isNaN(oddsNum) && !isNaN(bspNum) && bspNum > 0 && oddsNum > 0 && stakeNum) {
      const commissionFactor = 1 - (commissionNum / 100)
      const betIsLay = String(formData.bet || '').toLowerCase().includes('lay')
      let evPerc = 0

      if (!betIsLay) {
        const oddsAfterCommission = 1 + (oddsNum - 1) * commissionFactor
        evPerc = ((oddsAfterCommission / bspNum) - 1) * 100
      } else {
        const yourProb = 1 / oddsNum
        const fairProb = 1 / bspNum
        const edge = (yourProb / fairProb) - 1
        evPerc = edge * 100 * commissionFactor
      }

      const evVal = (evPerc / 100) * stakeNum
      const evPercStr = evPerc.toFixed(2)
      const evValStr = evVal.toFixed(2)

      if (formData.ev_perc !== evPercStr || formData.ev_val !== evValStr) {
        setFormData(prev => ({ ...prev, ev_perc: evPercStr, ev_val: evValStr }))
      }
    } else {
      if (formData.ev_perc || formData.ev_val) setFormData(prev => ({ ...prev, ev_perc: '', ev_val: '' }))
    }
  }, [formData.odds, formData.closing, formData.stake, formData.bet, formData.commission, currentBetKind])

  async function addBetType(){
    if (!betTypeModalName || !betTypeModalName.trim()) {
      setMessage('Please enter a name for the bet type')
      return
    }
    try{
      const payload = { name: betTypeModalName.trim(), kind: betTypeModalKind }
      const res = await fetch('/api/bet-types', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error(await res.text())
      await fetchBetTypes()
      setNewBetTypeKind(betTypeModalKind)
      setFormData({...formData, bet: betTypeModalName.trim()})
      setShowAddBetTypeModal(false)
      setBetTypeModalName('')
      setBetTypeModalKind('line')
      setMessage('Bet type added')
    } catch (err){
      console.error(err)
      setMessage(`Add bet type failed: ${err.message}`)
    }
  }

  async function fetchSports(){
    try{
      const res = await fetch('/api/sports')
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setSports(data)
    } catch (err){
      console.error('Failed to load sports', err)
      setSports([])
    }
  }

  async function fetchBets(){
    setLoading(true)
    try{
      const res = await fetch('/api/bets')
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setBets(data)
    } catch (err){
      console.error(err)
      setMessage(`Failed to load bets: ${err.message}`)
      setBets([])
    } finally { setLoading(false) }
  }

  async function saveBet(e){
    e.preventDefault()

    // Validate sport and bet type (either selected or entered as new)
    const sportVal = (newSport && newSport.trim()) ? newSport.trim() : (formData.sport && formData.sport.trim() ? formData.sport.trim() : '')
    const betVal = (formData.bet && formData.bet.trim() ? formData.bet.trim() : '')
    if (!sportVal) {
      setMessage('Please select or enter a sport')
      return
    }
    if (!betVal) {
      setMessage('Please select or enter a bet type')
      return
    }

    try{
      const strategyVal = (newStrategy && newStrategy.trim()) ? newStrategy.trim() : (formData.strategy_ref && formData.strategy_ref.trim() ? formData.strategy_ref.trim() : '')
      const payload = { ...formData, sport: sportVal, bet: betVal, kind: newBetTypeKind || undefined, commission: Number(formData.commission) || 0, strategy_ref: strategyVal || null }

      let res
      if (editingId) {
        res = await fetch(`/api/bets/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      } else {
        res = await fetch(`/api/bets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      }
      if (!res.ok) throw new Error(await res.text())

      // If a new sport was provided, also create it in sports table (backend ignores duplicates)
      if (newSport && newSport.trim() !== '') {
        await fetch('/api/sports', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: newSport.trim() }) })
      }



      setMessage(editingId ? 'Bet updated' : 'Bet added')
      setShowForm(false)
      setEditingId(null)
      setNewSport('')
      setNewStrategy('')
      setNewBetTypeKind(null)
      setFormData({ date: new Date().toLocaleDateString('en-GB').split('/').join('/'), sport: '', event: '', selection: '', bet: '', odds: '', stake: '', closing: '', line: '', closing_line: '', ev_perc: '', ev_val: '', result: 'PENDING', return: '', bf_market_id: '', bf_selection_id: '', strategy_ref: '', commission: '0' })
      fetchBets()
      fetchSports()
      fetchBetTypes()
    } catch (err){
      console.error(err)
      setMessage(`Save failed: ${err.message}`)
    }
  }

  function startEdit(bet){
    setEditingId(bet.id)
    setFormData({ ...bet })
    setNewSport('')
    setNewBetTypeKind(null)
    setShowForm(true)
  }

  function cancelEdit(){
    setEditingId(null)
    setShowForm(false)
    setNewSport('')
    setNewStrategy('')
    setNewBetTypeKind(null)
    setFormData({
      date: new Date().toLocaleDateString('en-GB').split('/').join('/'),
      sport: '', event: '', round_race: '', selection: '', bet: '', odds: '', stake: '', closing: '', line: '', closing_line: '', ev_perc: '', ev_val: '', result: 'PENDING', return: '', bf_market_id: '', bf_selection_id: '', strategy_ref: '', commission: '0'
    })
  }

  async function deleteBet(id){
    if (!window.confirm(`Delete bet ${id}?`)) return
    try{
      const res = await fetch(`/api/bets/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      setMessage('Bet deleted')
      setBets(bets.filter(b => b.id !== id))
    } catch (err){
      console.error(err)
      setMessage(`Delete failed: ${err.message}`)
    }
  }

  function openSettleModal(bet){
    setSettleModal(bet)
    setBspOdds(bet.closing || bet.closing_line || '')
    setCommission((bet && (bet.commission !== undefined && bet.commission !== null)) ? String(bet.commission) : '0')
  }

  async function settleBet(resultVal){
    if (!settleModal) return
    try{
      const res = await fetch(`/api/bets/${settleModal.id}/settle`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ result: resultVal, bspOdds: bspOdds, commission }) })
      if (!res.ok) throw new Error(await res.text())
      setMessage(`Bet #${settleModal.id} settled ${resultVal}`)
      setSettleModal(null)
      fetchBets()
    } catch (err){
      console.error(err)
      setMessage(`Settle failed: ${err.message}`)
    }
  }

  const filtered = bets.filter(b => {
    if (filterSport && b.sport !== filterSport) return false
    if (filterResult && b.result !== filterResult) return false
    return true
  })

  return (
    <div>
      <h2>Bets</h2>
      <div className="controls">
        <select value={filterSport} onChange={e => setFilterSport(e.target.value)} className="input half">
          <option value="">All sports</option>
          {sports.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterResult} onChange={e => setFilterResult(e.target.value)} className="input half">
          <option value="">All results</option>
          <option value="PENDING">PENDING</option>
          <option value="WIN">WIN</option>
          <option value="LOSE">LOSE</option>
          <option value="VOID">VOID</option>
        </select>
        <button className="btn small" onClick={() => {
          if (showForm) {
            cancelEdit()
          } else {
            cancelEdit()
            setShowForm(true)
          }
        }}>{showForm ? 'Cancel' : '+ Add Bet'}</button>
        <button className="btn small ghost" onClick={fetchBets}>Refresh</button>
      </div>

      {message && <div className="toast">{message}</div>}

      {showForm && (
        <form onSubmit={saveBet} className="form">
          <div className="formGrid">
            <label style={{display:'flex',flexDirection:'column',gap:4}}>Date: <input required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></label>
            <label style={{display:'flex',flexDirection:'column',gap:4}}>
              <strong>Sport:</strong>
              <select value={formData.sport === '' && newSport === '' ? '' : formData.sport} onChange={e => {
                const v = e.target.value
                if (v === '__new__') {
                  setNewSport('')
                  setFormData({...formData, sport: ''})
                } else {
                  setNewSport('')
                  setFormData({...formData, sport: v})
                }
              }}>
                <option value="">Select</option>
                {sports.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="__new__">+ Add New Sport</option>
              </select>

              {(formData.sport === '' || newSport !== '') && (
                <input type="text" placeholder="Enter new sport" value={newSport || formData.sport} onChange={e => {
                  const v = e.target.value
                  setNewSport(v)
                  setFormData({...formData, sport: v})
                }} />
              )}
            </label>

            <label style={{display:'flex',flexDirection:'column',gap:4}}>
              <strong>Strategy:</strong>
              <select value={formData.strategy_ref === '' && newStrategy === '' ? '' : formData.strategy_ref} onChange={e => {
                const v = e.target.value
                if (v === '__new__') {
                  setNewStrategy('')
                  setFormData({...formData, strategy_ref: ''})
                } else {
                  setNewStrategy('')
                  setFormData({...formData, strategy_ref: v})
                }
              }}>
                <option value="">Select</option>
                {Array.from(new Set(bets.map(b => b.strategy_ref).filter(Boolean))).map(s => <option key={s} value={s}>{s}</option>)}
                <option value="__new__">+ Add New Strategy</option>
              </select>

              {(formData.strategy_ref === '' || newStrategy !== '') && (
                <input type="text" placeholder="Enter new strategy" value={newStrategy || formData.strategy_ref} onChange={e => {
                  const v = e.target.value
                  setNewStrategy(v)
                  setFormData({...formData, strategy_ref: v})
                }} />
              )}
            </label>

            <label style={{display:'flex',flexDirection:'column',gap:4}}>Event: <input required value={formData.event} onChange={e => setFormData({...formData, event: e.target.value})} /></label>
            <label style={{display:'flex',flexDirection:'column',gap:4}}>Selection: <input required value={formData.selection} onChange={e => setFormData({...formData, selection: e.target.value})} /></label>
            <label style={{display:'flex',flexDirection:'column',gap:4}}>
              <strong>Bet Type:</strong>
              <select value={formData.bet || ''} onChange={e => {
                const v = e.target.value
                if (v === '__new__') {
                  setBetTypeModalName('')
                  setBetTypeModalKind('line')
                  setShowAddBetTypeModal(true)
                  setFormData({...formData, bet: ''})
                } else {
                  setNewBetTypeKind(null)
                  setFormData({...formData, bet: v})
                }
              }}>
                <option value="">Select</option>
                {betTypes.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                <option value="__new__">+ Add New Bet Type</option>
              </select>


            </label>
            <label style={{display:'flex',flexDirection:'column',gap:4}}>Stake: <input required type="number" step="0.01" value={formData.stake} onChange={e => setFormData({...formData, stake: e.target.value})} /></label>
            <label style={{display:'flex',flexDirection:'column',gap:4}}>Commission %: <input type="number" step="0.01" value={formData.commission} onChange={e => setFormData({...formData, commission: e.target.value})} /></label>
            {currentBetKind === 'ev' ? (
              <>
                <label style={{display:'flex',flexDirection:'column',gap:4}}>Odds: <input required type="number" step="0.01" value={formData.odds} onChange={e => setFormData({...formData, odds: e.target.value})} /></label>
                <label style={{display:'flex',flexDirection:'column',gap:4}}>Closing (BSP): <input type="number" step="0.01" value={formData.closing} onChange={e => setFormData({...formData, closing: e.target.value})} /></label>
                <label style={{display:'flex',flexDirection:'column',gap:4}}>EV%: <input readOnly value={formData.ev_perc} /></label>
                <label style={{display:'flex',flexDirection:'column',gap:4}}>EV Value: <input readOnly value={formData.ev_val} /></label>
              </>
            ) : (
              <>
                <label style={{display:'flex',flexDirection:'column',gap:4}}>Odds: <input required type="number" step="0.01" value={formData.odds} onChange={e => setFormData({...formData, odds: e.target.value})} /></label>
                <label style={{display:'flex',flexDirection:'column',gap:4}}>Line: <input required value={formData.line} onChange={e => setFormData({...formData, line: e.target.value})} /></label>
                <label style={{display:'flex',flexDirection:'column',gap:4}}>Closing Line: <input value={formData.closing_line} onChange={e => setFormData({...formData, closing_line: e.target.value})} /></label>
              </>
            )}
            <label style={{display:'flex',flexDirection:'column',gap:4}}>Result: <select value={formData.result} onChange={e => setFormData({...formData, result: e.target.value})}><option value="PENDING">PENDING</option><option value="WIN">WIN</option><option value="LOSE">LOSE</option><option value="VOID">VOID</option></select></label>
          </div>
          <div className="formActions">
            <button type="submit" className="btn">{editingId ? 'Update' : 'Add'}</button>
            <button type="button" className="btn ghost" onClick={cancelEdit}>Cancel</button>
          </div>
        </form>
      )}

      <div className="tableWrap">
        <table>
          <thead>
            <tr><th>ID</th><th>Date</th><th>Sport</th><th>Selection</th><th>Bet</th><th>Odds</th><th>Stake</th><th>Comm%</th><th>EV%</th><th>Result</th><th>Return</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={11}>Loading...</td></tr> : filtered.length ===0 ? <tr><td colSpan={11}>No bets</td></tr> : filtered.map(b => (
              <tr key={b.id}>
                <td>{b.id}</td>
                <td>{b.date}</td>
                <td>{b.sport}</td>
                <td>{b.selection}</td>
                <td>{b.bet}</td>
                <td>{b.odds}</td>
                <td>{b.stake}</td>
                <td>{b.commission !== undefined && b.commission !== null ? `${b.commission}%` : '0%'}</td>
                <td>{b.ev_perc ? `${b.ev_perc}%` : '-'}</td>
                <td>
                  {b.result ? (
                    <span className={`chip ${b.result === 'WIN' ? 'win' : b.result === 'LOSE' ? 'lose' : 'pending'}`}>
                      {b.result}
                    </span>
                  ) : null}
                </td>
                <td>{(b.return !== null && b.return !== undefined) ? `$${b.return}` : '-'}</td>
                <td className="actions" onClick={e => e.stopPropagation()}>
                  <button className="btn ghost" onClick={() => startEdit(b)}>Edit</button>
                  {b.result === 'PENDING' && <button className="btn success" onClick={() => openSettleModal(b)}>Settle</button>}
                  <button className="btn danger" onClick={() => deleteBet(b.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {settleModal && (
        <div className="modal">
          <div className="modalInner">
            <h3>Settle Bet #{settleModal.id}</h3>
            <div className="formGrid">
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                <strong>Selection:</strong>
                <div style={{marginTop:6}}>{settleModal.selection}</div>
              </div>

              <label style={{display:'flex',flexDirection:'column',gap:4}}>
                <strong>{(betTypes.find(t => t.name === settleModal.bet)?.kind === 'ev') ? 'Closing Odds (BSP):' : 'Closing Line:'}</strong>
                {(betTypes.find(t => t.name === settleModal.bet)?.kind === 'ev') ? (
                  <input type="number" step="0.01" value={bspOdds} onChange={e => setBspOdds(e.target.value)} />
                ) : (
                  <input value={bspOdds} onChange={e => setBspOdds(e.target.value)} />
                )}
              </label>

              <label style={{display:'flex',flexDirection:'column',gap:4}}>Commission %: <input value={commission} onChange={e => setCommission(e.target.value)} /></label>
            </div>
            <div className="modalActions">
              <button className="btn success" onClick={() => settleBet('WIN')}>WIN</button>
              <button className="btn danger" onClick={() => settleBet('LOSE')}>LOSE</button>
              <button className="btn warning" onClick={() => settleBet('VOID')}>VOID</button>
            </div>
            <div className="formRow">
              <button className="btn ghost" onClick={() => setSettleModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showAddBetTypeModal && (
        <div className="modal">
          <div className="modalInner">
            <h3>Add Bet Type</h3>
            <div className="grid">
              <label>Name: <input value={betTypeModalName} onChange={e => setBetTypeModalName(e.target.value)} /></label>
              <label>Kind: 
                <select value={betTypeModalKind} onChange={e => setBetTypeModalKind(e.target.value)}>
                  <option value="line">Line</option>
                  <option value="ev">EV</option>
                </select>
              </label>
            </div>
            <div className="formActions">
              <button className="btn" onClick={addBetType}>Add</button>
              <button className="btn ghost" onClick={() => setShowAddBetTypeModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}