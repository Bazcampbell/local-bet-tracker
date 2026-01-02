import React from 'react'
import { Routes, Route, Link, Navigate } from 'react-router-dom'
import Bets from './pages/Bets'
import Results from './pages/Results'
import logo from './assets/logo.png' 

export default function App(){
  return (
    <div className="app">
      <header className="header">
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div className="logo">
            <img src={logo} alt="LB" className="mark" />
          </div>
          <div>
            <div style={{fontSize:16,fontWeight:700}}>Quark Bets</div>
            <div style={{fontSize:11,color:'#666'}}>{new Date().getFullYear()}</div>
          </div>
        </div>
        <nav style={{marginLeft:'auto',display:'flex',gap:12}}>
          <Link to="/bets" className="navLink">Bets</Link>
          <Link to="/results" className="navLink">Results</Link>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/bets" element={<Bets />} />
          <Route path="/results" element={<Results />} />
          <Route path="/" element={<Navigate to="/bets" replace />} />
        </Routes>
      </main>
    </div>
  )
}