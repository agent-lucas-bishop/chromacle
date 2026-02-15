import { useState, useEffect, useCallback } from 'react'
import './App.css'

// Deterministic daily color from date seed
function seededRandom(seed: number) {
  let x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function getDailyColor(): [number, number, number] {
  const today = new Date()
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
  const h = Math.floor(seededRandom(seed) * 360)
  const s = Math.floor(seededRandom(seed + 1) * 60) + 30 // 30-90
  const l = Math.floor(seededRandom(seed + 2) * 50) + 25 // 25-75
  return [h, s, l]
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l / 100 - 1)) * s / 100
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = l / 100 - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else { r = c; b = x }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function hslDistance(h1: number, s1: number, l1: number, h2: number, s2: number, l2: number) {
  const hDiff = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2))
  const sDiff = Math.abs(s1 - s2)
  const lDiff = Math.abs(l1 - l2)
  return { hDiff, sDiff, lDiff, total: hDiff + sDiff * 2 + lDiff * 2 }
}

function getHueHint(guess: number, target: number): string {
  const diff = target - guess
  const absDiff = Math.min(Math.abs(diff), 360 - Math.abs(diff))
  if (absDiff <= 5) return '🎯'
  // Determine direction on color wheel
  const clockwise = ((target - guess + 360) % 360) < 180
  return clockwise ? '🔴→' : '←🔵'
}

function getSLHint(guess: number, target: number, upEmoji: string, downEmoji: string): string {
  const diff = target - guess
  if (Math.abs(diff) <= 3) return '🎯'
  return diff > 0 ? upEmoji : downEmoji
}

type Guess = {
  h: number; s: number; l: number; hex: string
  hHint: string; sHint: string; lHint: string
  closeness: number
}

const STORAGE_KEY = 'chromacle-state'

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const state = JSON.parse(raw)
    const today = new Date().toDateString()
    if (state.date !== today) return null
    return state
  } catch { return null }
}

function loadStats() {
  try {
    const raw = localStorage.getItem('chromacle-stats')
    if (!raw) return { played: 0, won: 0, streak: 0, maxStreak: 0 }
    return JSON.parse(raw)
  } catch { return { played: 0, won: 0, streak: 0, maxStreak: 0 } }
}

export default function App() {
  const [target] = useState(getDailyColor)
  const [guesses, setGuesses] = useState<Guess[]>([])
  const [hue, setHue] = useState(180)
  const [sat, setSat] = useState(50)
  const [lit, setLit] = useState(50)
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)
  const [copied, setCopied] = useState(false)
  const [stats, setStats] = useState(loadStats)
  const maxGuesses = 6

  useEffect(() => {
    const saved = loadState()
    if (saved) {
      setGuesses(saved.guesses)
      setGameOver(saved.gameOver)
      setWon(saved.won)
    }
  }, [])

  const saveState = useCallback((g: Guess[], over: boolean, w: boolean) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      date: new Date().toDateString(), guesses: g, gameOver: over, won: w
    }))
  }, [])

  const handleGuess = () => {
    if (gameOver) return
    const hex = hslToHex(hue, sat, lit)
    const { total } = hslDistance(hue, sat, lit, target[0], target[1], target[2])
    const guess: Guess = {
      h: hue, s: sat, l: lit, hex,
      hHint: getHueHint(hue, target[0]),
      sHint: getSLHint(sat, target[1], '⬆️', '⬇️'),
      lHint: getSLHint(lit, target[2], '☀️', '🌑'),
      closeness: total
    }
    const newGuesses = [...guesses, guess]
    const isWin = total <= 10
    const isOver = isWin || newGuesses.length >= maxGuesses
    setGuesses(newGuesses)
    if (isWin) { setWon(true); setGameOver(true) }
    else if (newGuesses.length >= maxGuesses) { setGameOver(true) }
    
    if (isOver) {
      const s = loadStats()
      s.played++
      if (isWin) { s.won++; s.streak++; s.maxStreak = Math.max(s.maxStreak, s.streak) }
      else { s.streak = 0 }
      setStats(s)
      localStorage.setItem('chromacle-stats', JSON.stringify(s))
    }
    saveState(newGuesses, isOver, isWin)
  }

  const share = () => {
    const blocks = guesses.map(g => {
      if (g.closeness <= 10) return '🟩'
      if (g.closeness <= 30) return '🟨'
      if (g.closeness <= 60) return '🟧'
      return '🟥'
    })
    const pad = Array(maxGuesses - blocks.length).fill('⬛')
    const text = `🎨 Chromacle ${new Date().toLocaleDateString()}\n${[...blocks, ...pad].join('')} ${won ? guesses.length : 'X'}/${maxGuesses}\n\nchromacle.app`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const previewColor = hslToHex(hue, sat, lit)
  const targetHex = hslToHex(target[0], target[1], target[2])

  return (
    <div className="app">
      <header>
        <h1>CHROMACLE</h1>
        <p className="subtitle">guess the daily color</p>
      </header>

      <div className="stats-bar">
        <span>🔥 {stats.streak}</span>
        <span>✅ {stats.won}/{stats.played}</span>
      </div>

      <div className="game-area">
        <div className="guess-list">
          {guesses.map((g, i) => (
            <div key={i} className="guess-row">
              <div className="guess-swatch" style={{ background: g.hex }} />
              <span className="guess-hex">{g.hex}</span>
              <span className="hint">{g.hHint}</span>
              <span className="hint">{g.sHint}</span>
              <span className="hint">{g.lHint}</span>
            </div>
          ))}
        </div>

        {!gameOver ? (
          <div className="controls">
            <div className="preview-swatch" style={{ background: previewColor }} />
            <div className="slider-group">
              <label>
                <span>H {hue}°</span>
                <input type="range" min={0} max={359} value={hue} onChange={e => setHue(+e.target.value)}
                  className="slider hue-slider" />
              </label>
              <label>
                <span>S {sat}%</span>
                <input type="range" min={0} max={100} value={sat} onChange={e => setSat(+e.target.value)}
                  className="slider" />
              </label>
              <label>
                <span>L {lit}%</span>
                <input type="range" min={0} max={100} value={lit} onChange={e => setLit(+e.target.value)}
                  className="slider" />
              </label>
            </div>
            <button className="guess-btn" onClick={handleGuess}>
              GUESS ({guesses.length + 1}/{maxGuesses})
            </button>
          </div>
        ) : (
          <div className="result">
            <div className="result-colors">
              <div>
                <div className="result-swatch" style={{ background: targetHex }} />
                <span>{targetHex}</span>
              </div>
              {won && guesses.length > 0 && (
                <div>
                  <div className="result-swatch" style={{ background: guesses[guesses.length-1].hex }} />
                  <span>{guesses[guesses.length-1].hex}</span>
                </div>
              )}
            </div>
            <p>{won ? `🎨 Nailed it in ${guesses.length}!` : `The color was ${targetHex}`}</p>
            <button className="share-btn" onClick={share}>
              {copied ? '✓ Copied!' : '📋 Share'}
            </button>
          </div>
        )}
      </div>

      <footer>
        <p>New color every day at midnight</p>
      </footer>
    </div>
  )
}
