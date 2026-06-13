/**
 * ChallengeSystem.jsx
 * 
 * Uso en App.jsx:
 *   import ChallengeSystem, { usePendingChallenges } from './components/challenges/ChallengeSystem'
 * 
 *   // Para el badge del nav:
 *   const pending = usePendingChallenges(userName, SUPABASE_URL, SUPABASE_ANON_KEY)
 * 
 *   // Para mostrar el sistema completo:
 *   <ChallengeSystem
 *     currentUser={userName}
 *     users={allUsers}           // string[] con todos los nombres registrados
 *     supabaseUrl={SUPABASE_URL}
 *     supabaseKey={SUPABASE_ANON_KEY}
 *   />
 */

import { useState, useEffect, useCallback } from 'react'
import PenalesGame from './PenalesGame'
import TriviaGame from './TriviaGame'
import HigherOrLowerGame from './HigherOrLowerGame'

// ─── Supabase helpers ────────────────────────────────────────────────────────

function supaHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates'
  }
}

async function kvGet(url, key, sbKey) {
  const res = await fetch(
    `${url}/rest/v1/kv?key=eq.${encodeURIComponent(key)}&select=value`,
    { headers: supaHeaders(sbKey) }
  )
  const data = await res.json()
  return data[0]?.value ?? null
}

async function kvSet(url, key, value, sbKey) {
  await fetch(`${url}/rest/v1/kv`, {
    method: 'POST',
    headers: supaHeaders(sbKey),
    body: JSON.stringify({ key, value })
  })
}

async function kvList(url, prefix, sbKey) {
  const res = await fetch(
    `${url}/rest/v1/kv?key=like.${encodeURIComponent(prefix + '%')}&select=key,value`,
    { headers: supaHeaders(sbKey) }
  )
  return await res.json()
}

// ─── Hook para el badge del nav ──────────────────────────────────────────────

export function usePendingChallenges(currentUser, supabaseUrl, supabaseKey) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!currentUser || !supabaseUrl) return
    async function check() {
      const rows = await kvList(supabaseUrl, 'challenge:', supabaseKey)
      const pending = rows.filter(r =>
        r.value?.challenged === currentUser &&
        r.value?.challenged_score === null &&
        r.value?.status === 'pending'
      )
      setCount(pending.length)
    }
    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [currentUser, supabaseUrl, supabaseKey])

  return count
}

// ─── Constantes de juegos ────────────────────────────────────────────────────

const GAMES = {
  penales: { label: '🥅 Penales', desc: '5 tiros al arco. ¿Quién mete más?', maxScore: 5 },
  trivia: { label: '🧠 Trivia Mundial', desc: '10 preguntas mundialistas con alma argentina', maxScore: 10 },
  higher_lower: { label: '📊 Mayor o Menor', desc: 'Goles en Mundiales. ¿Más o menos?', maxScore: 15 }
}

function uuid() {
  return 'ch_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function ChallengeSystem({ currentUser, users, supabaseUrl, supabaseKey }) {
  const [view, setView] = useState('list')       // 'list' | 'create' | 'play' | 'result'
  const [challenges, setChallenges] = useState([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(null)     // challenge en juego
  const [lastResult, setLastResult] = useState(null)

  const otherUsers = users.filter(u => u !== currentUser)

  // ─── Cargar desafíos ───────────────────────────────────────────

  const loadChallenges = useCallback(async () => {
    setLoading(true)
    const rows = await kvList(supabaseUrl, 'challenge:', supabaseKey)
    const mine = rows
      .map(r => r.value)
      .filter(v => v?.challenger === currentUser || v?.challenged === currentUser)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    setChallenges(mine)
    setLoading(false)
  }, [currentUser, supabaseUrl, supabaseKey])

  useEffect(() => { loadChallenges() }, [loadChallenges])

  // ─── Crear desafío ─────────────────────────────────────────────

  async function createChallenge(game, challenged) {
    const id = uuid()
    const seed = Math.floor(Math.random() * 999999)
    const ch = {
      id,
      game,
      challenger: currentUser,
      challenged,
      seed,
      challenger_score: null,
      challenged_score: null,
      status: 'pending',
      created_at: new Date().toISOString()
    }
    await kvSet(supabaseUrl, `challenge:${id}`, ch, supabaseKey)
    return ch
  }

  // ─── Guardar score ─────────────────────────────────────────────

  async function submitScore(challenge, score) {
    const isChallenger = challenge.challenger === currentUser
    const updated = {
      ...challenge,
      [isChallenger ? 'challenger_score' : 'challenged_score']: score
    }
    // Si ya hay dos scores → completado
    const otherScore = isChallenger ? challenge.challenged_score : challenge.challenger_score
    if (otherScore !== null) {
      updated.status = 'completed'
    }
    await kvSet(supabaseUrl, `challenge:${updated.id}`, updated, supabaseKey)
    return updated
  }

  // ─── Handlers de flujo ─────────────────────────────────────────

  async function onGameComplete(score, details) {
    const updated = await submitScore(active, score)
    setLastResult({ challenge: updated, myScore: score })
    setView('result')
    loadChallenges()
  }

  function openChallenge(ch) {
    setActive(ch)
    setView('play')
  }

  // ─── Clasificar desafíos ───────────────────────────────────────

  const toPlay = challenges.filter(c => {
    const isChallenger = c.challenger === currentUser
    const myScore = isChallenger ? c.challenger_score : c.challenged_score
    return myScore === null && c.status === 'pending'
  })
  const waiting = challenges.filter(c => {
    const isChallenger = c.challenger === currentUser
    const myScore = isChallenger ? c.challenger_score : c.challenged_score
    const theirScore = isChallenger ? c.challenged_score : c.challenger_score
    return myScore !== null && theirScore === null
  })
  const completed = challenges.filter(c => c.status === 'completed')

  // ─── Render ────────────────────────────────────────────────────

  if (view === 'create') {
    return <CreateView
      users={otherUsers}
      currentUser={currentUser}
      supabaseUrl={supabaseUrl}
      supabaseKey={supabaseKey}
      onBack={() => setView('list')}
      onCreate={async (game, challenged) => {
        const ch = await createChallenge(game, challenged)
        setActive(ch)
        setView('play')
      }}
    />
  }

  if (view === 'play' && active) {
    const GameComp = { penales: PenalesGame, trivia: TriviaGame, higher_lower: HigherOrLowerGame }[active.game]
    const opponent = active.challenger === currentUser ? active.challenged : active.challenger
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 8px' }}>
          <button onClick={() => { setView('list'); loadChallenges() }} style={btnBack}>← Salir</button>
          <span style={{ color: '#888', fontSize: 13 }}>
            vs <strong style={{ color: 'white' }}>{opponent}</strong> · {GAMES[active.game]?.label}
          </span>
        </div>
        <GameComp seed={active.seed} onComplete={onGameComplete} />
      </div>
    )
  }

  if (view === 'result' && lastResult) {
    return <ResultView
      result={lastResult}
      currentUser={currentUser}
      onBack={() => { setView('list'); loadChallenges() }}
    />
  }

  // ─── Lista principal ───────────────────────────────────────────

  return (
    <div style={{ padding: '16px 16px 80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, color: 'white', fontSize: 22 }}>🎮 Desafíos</h2>
          {toPlay.length > 0 && (
            <span style={{
              background: '#e53935', color: 'white', borderRadius: 12,
              padding: '2px 10px', fontSize: 13, marginTop: 4, display: 'inline-block'
            }}>
              {toPlay.length} te {toPlay.length === 1 ? 'espera' : 'esperan'}
            </span>
          )}
        </div>
        <button
          onClick={() => setView('create')}
          style={{
            background: '#75AADB', color: '#0d0d1e', border: 'none',
            borderRadius: 12, padding: '10px 18px', fontWeight: 'bold',
            fontSize: 15, cursor: 'pointer'
          }}
        >
          + Desafiar
        </button>
      </div>

      {loading && <p style={{ color: '#555', textAlign: 'center' }}>Cargando...</p>}

      {/* A jugar */}
      {toPlay.length > 0 && (
        <Section title="⚡ Te desafiaron">
          {toPlay.map(c => (
            <ChallengeCard
              key={c.id} ch={c} currentUser={currentUser}
              onPlay={() => openChallenge(c)}
              actionLabel="¡Jugar!"
              actionColor="#F6C700"
            />
          ))}
        </Section>
      )}

      {/* Esperando rival */}
      {waiting.length > 0 && (
        <Section title="⏳ Esperando rival">
          {waiting.map(c => (
            <ChallengeCard
              key={c.id} ch={c} currentUser={currentUser}
              actionLabel="Jugaste, esperando..."
              actionColor="#555"
              disabled
            />
          ))}
        </Section>
      )}

      {/* Completados */}
      {completed.length > 0 && (
        <Section title="✅ Completados">
          {completed.map(c => (
            <ChallengeCard
              key={c.id} ch={c} currentUser={currentUser}
              showResult
            />
          ))}
        </Section>
      )}

      {!loading && challenges.length === 0 && (
        <div style={{ textAlign: 'center', color: '#555', marginTop: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎮</div>
          <p>Todavía no hay desafíos.</p>
          <p>¡Desafiá a alguien!</p>
        </div>
      )}
    </div>
  )
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ color: '#888', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 10px' }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </div>
  )
}

function ChallengeCard({ ch, currentUser, onPlay, actionLabel, actionColor, disabled, showResult }) {
  const isChallenger = ch.challenger === currentUser
  const opponent = isChallenger ? ch.challenged : ch.challenger
  const myScore = isChallenger ? ch.challenger_score : ch.challenged_score
  const theirScore = isChallenger ? ch.challenged_score : ch.challenger_score
  const game = GAMES[ch.game]
  const won = showResult && myScore !== null && theirScore !== null && myScore > theirScore
  const tied = showResult && myScore !== null && theirScore !== null && myScore === theirScore

  return (
    <div style={{
      background: '#12122a', borderRadius: 14, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      border: showResult
        ? `1px solid ${won ? '#4CAF50' : tied ? '#F6C700' : '#ff4444'}`
        : '1px solid #1e1e3e'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 'bold', color: 'white', fontSize: 15, marginBottom: 2 }}>
          {game?.label} vs {opponent}
        </div>
        <div style={{ color: '#888', fontSize: 12 }}>
          {isChallenger ? 'Vos desafiaste' : 'Te desafió'} · {timeAgo(ch.created_at)}
        </div>
        {showResult && myScore !== null && theirScore !== null && (
          <div style={{ marginTop: 6, fontSize: 14, color: won ? '#4CAF50' : tied ? '#F6C700' : '#ff4444', fontWeight: 'bold' }}>
            {won ? '🏆 Ganaste' : tied ? '🤝 Empate' : '💀 Perdiste'} · {myScore} vs {theirScore}
          </div>
        )}
      </div>
      {onPlay && !disabled && (
        <button
          onClick={onPlay}
          style={{
            background: actionColor, border: 'none', borderRadius: 10,
            padding: '10px 16px', fontWeight: 'bold', color: '#0d0d1e',
            cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap'
          }}
        >
          {actionLabel}
        </button>
      )}
      {disabled && (
        <span style={{ color: '#555', fontSize: 13, whiteSpace: 'nowrap' }}>Esperando...</span>
      )}
    </div>
  )
}

function CreateView({ users, currentUser, onCreate, onBack }) {
  const [step, setStep] = useState('game')   // 'game' | 'rival'
  const [game, setGame] = useState(null)
  const [rival, setRival] = useState(null)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(null)

  async function handleCreate() {
    setCreating(true)
    await onCreate(game, rival)
  }

  if (created) {
    const waText = encodeURIComponent(
      `🏆 *${currentUser}* te desafió en *La Scalonetta* a jugar *${GAMES[game]?.label}*!\n\nAbrí la app y aceptá el desafío: https://prode-lyart.vercel.app`
    )
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
        <h2 style={{ color: 'white' }}>¡Desafío creado!</h2>
        <p style={{ color: '#888' }}>Avisale a {rival} que lo espera un desafío</p>
        <a
          href={`https://wa.me/?text=${waText}`}
          target="_blank" rel="noreferrer"
          style={{
            display: 'block', background: '#25D366', color: 'white', textDecoration: 'none',
            borderRadius: 12, padding: '14px 20px', fontWeight: 'bold', fontSize: 16, margin: '16px 0'
          }}
        >
          📱 Avisar por WhatsApp
        </a>
        <button onClick={onBack} style={btnSecondary}>Volver</button>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 16px 80px' }}>
      <button onClick={onBack} style={btnBack}>← Cancelar</button>

      {step === 'game' && (
        <>
          <h2 style={{ color: 'white', margin: '16px 0' }}>¿A qué jugamos?</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(GAMES).map(([key, g]) => (
              <button
                key={key}
                onClick={() => { setGame(key); setStep('rival') }}
                style={{
                  background: '#12122a', border: '2px solid #1e1e4a',
                  borderRadius: 14, padding: '18px 16px', cursor: 'pointer',
                  textAlign: 'left', fontFamily: 'inherit'
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 'bold', color: 'white' }}>{g.label}</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{g.desc}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 'rival' && (
        <>
          <h2 style={{ color: 'white', margin: '16px 0' }}>¿A quién desafiás?</h2>
          <p style={{ color: '#888', fontSize: 13, margin: '0 0 16px' }}>
            Juego: {GAMES[game]?.label}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {users.map(u => (
              <button
                key={u}
                onClick={() => setRival(u)}
                style={{
                  background: rival === u ? '#1a2a4a' : '#12122a',
                  border: `2px solid ${rival === u ? '#75AADB' : '#1e1e4a'}`,
                  borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                  color: 'white', fontSize: 16, fontFamily: 'inherit', textAlign: 'left'
                }}
              >
                {rival === u ? '✅ ' : ''}{u}
              </button>
            ))}
          </div>
          {rival && (
            <button
              onClick={handleCreate}
              disabled={creating}
              style={{
                marginTop: 20, width: '100%', background: '#75AADB', border: 'none',
                borderRadius: 14, padding: '16px', color: '#0d0d1e', fontWeight: 'bold',
                fontSize: 17, cursor: creating ? 'default' : 'pointer', opacity: creating ? 0.7 : 1
              }}
            >
              {creating ? 'Creando...' : `🎮 Desafiar a ${rival}`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function ResultView({ result, currentUser, onBack }) {
  const { challenge: ch, myScore } = result
  const isChallenger = ch.challenger === currentUser
  const opponent = isChallenger ? ch.challenged : ch.challenger
  const theirScore = isChallenger ? ch.challenged_score : ch.challenger_score
  const game = GAMES[ch.game]
  const bothPlayed = theirScore !== null

  const waText = encodeURIComponent(
    `🎮 Jugué *${game?.label}* en *La Scalonetta* y saqué ${myScore}/${game?.maxScore}. ¡Ahora te toca vos, ${opponent}! https://prode-lyart.vercel.app`
  )

  return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>
        {!bothPlayed ? '⏳' : myScore > theirScore ? '🏆' : myScore === theirScore ? '🤝' : '💀'}
      </div>
      <h2 style={{ color: 'white', margin: '0 0 4px' }}>
        {!bothPlayed ? 'Tu turno completado' : myScore > theirScore ? '¡Ganaste!' : myScore === theirScore ? '¡Empate!' : 'Perdiste'}
      </h2>

      <div style={{ background: '#12122a', borderRadius: 16, padding: 20, margin: '20px 0' }}>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>{game?.label}</div>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, color: '#888' }}>{currentUser}</div>
            <div style={{ fontSize: 40, fontWeight: 'bold', color: '#75AADB' }}>{myScore}</div>
          </div>
          <div style={{ color: '#555', fontSize: 18 }}>VS</div>
          <div>
            <div style={{ fontSize: 13, color: '#888' }}>{opponent}</div>
            <div style={{ fontSize: 40, fontWeight: 'bold', color: bothPlayed ? '#F6C700' : '#444' }}>
              {bothPlayed ? theirScore : '?'}
            </div>
          </div>
        </div>
        {!bothPlayed && (
          <p style={{ color: '#666', fontSize: 13, marginTop: 12 }}>
            Esperando que {opponent} juegue...
          </p>
        )}
      </div>

      {!bothPlayed && (
        <a
          href={`https://wa.me/?text=${waText}`}
          target="_blank" rel="noreferrer"
          style={{
            display: 'block', background: '#25D366', color: 'white', textDecoration: 'none',
            borderRadius: 12, padding: '14px 20px', fontWeight: 'bold', fontSize: 15,
            marginBottom: 12
          }}
        >
          📱 Apurar a {opponent} por WhatsApp
        </a>
      )}

      <button onClick={onBack} style={btnSecondary}>Volver a desafíos</button>
    </div>
  )
}

// ─── Estilos base ─────────────────────────────────────────────────────────────

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso)
  const m = Math.floor(diff / 60000)
  if (m < 60) return `hace ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h`
  return `hace ${Math.floor(h / 24)}d`
}

const btnBack = {
  background: 'transparent', border: '1px solid #333', color: '#888',
  borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontSize: 14,
  fontFamily: 'inherit'
}

const btnSecondary = {
  background: 'transparent', border: '1px solid #333', color: '#888',
  borderRadius: 12, padding: '12px 20px', cursor: 'pointer',
  fontSize: 15, width: '100%', fontFamily: 'inherit'
}
