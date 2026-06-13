/**
 * ChallengeSystem.jsx
 * Usa sget/sset/slist de db.js — igual que el resto de la app.
 * 
 * Uso en App.jsx (ya integrado):
 *   import ChallengeSystem from './components/challenges/ChallengeSystem'
 *   <ChallengeSystem currentUser={me} allUsers={Object.keys(users)} />
 */

import { useState, useEffect, useCallback } from 'react'
import { sget, sset, slist } from '../../db.js'
import PenalesGame from './PenalesGame'
import TriviaGame from './TriviaGame'
import HigherOrLowerGame from './HigherOrLowerGame'

const CHALLENGE_PREFIX = 'scalonetta:challenge:'

const GAMES = {
  penales:      { label: '🥅 Penales',        desc: '5 tiros al arco. ¿Quién mete más?',                 maxScore: 5  },
  trivia:       { label: '🧠 Trivia Mundial',  desc: '10 preguntas mundialistas con alma argentina',      maxScore: 10 },
  higher_lower: { label: '📊 Mayor o Menor',   desc: 'Goles en Mundiales. ¿Más o menos que el rival?',   maxScore: 15 },
}

function uuid() {
  return 'ch_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso)
  const m = Math.floor(diff / 60000)
  if (m < 60) return `hace ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h`
  return `hace ${Math.floor(h / 24)}d`
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function ChallengeSystem({ currentUser, allUsers }) {
  const [view, setView] = useState('list')
  const [challenges, setChallenges] = useState([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(null)
  const [lastResult, setLastResult] = useState(null)

  const otherUsers = allUsers.filter(u => u !== currentUser)

  const loadChallenges = useCallback(async () => {
    setLoading(true)
    const keys = await slist(CHALLENGE_PREFIX)
    const all = []
    for (const key of (keys || [])) {
      const val = await sget(key, null)
      if (val) all.push(val)
    }
    const mine = all
      .filter(c => c.challenger === currentUser || c.challenged === currentUser)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    setChallenges(mine)
    setLoading(false)
  }, [currentUser])

  useEffect(() => { loadChallenges() }, [loadChallenges])

  async function createChallenge(game, challenged) {
    const id = uuid()
    const ch = {
      id, game,
      challenger: currentUser,
      challenged,
      seed: Math.floor(Math.random() * 999999),
      challenger_score: null,
      challenged_score: null,
      status: 'pending',
      created_at: new Date().toISOString(),
    }
    await sset(`${CHALLENGE_PREFIX}${id}`, ch)
    return ch
  }

  async function submitScore(challenge, score) {
    const isChallenger = challenge.challenger === currentUser
    const updated = {
      ...challenge,
      [isChallenger ? 'challenger_score' : 'challenged_score']: score,
    }
    const other = isChallenger ? updated.challenged_score : updated.challenger_score
    if (other !== null) updated.status = 'completed'
    await sset(`${CHALLENGE_PREFIX}${updated.id}`, updated)
    return updated
  }

  async function onGameComplete(score) {
    const updated = await submitScore(active, score)
    setLastResult({ challenge: updated, myScore: score })
    setView('result')
    loadChallenges()
  }

  // ─── Clasificar ───────────────────────────────────────────────

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

  // ─── Vistas ───────────────────────────────────────────────────

  if (view === 'create') {
    return (
      <CreateView
        users={otherUsers}
        currentUser={currentUser}
        onBack={() => setView('list')}
        onCreate={async (game, challenged) => {
          const ch = await createChallenge(game, challenged)
          setActive(ch)
          setView('play')
        }}
      />
    )
  }

  if (view === 'play' && active) {
    const GameComp = { penales: PenalesGame, trivia: TriviaGame, higher_lower: HigherOrLowerGame }[active.game]
    const opponent = active.challenger === currentUser ? active.challenged : active.challenger
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 0 8px' }}>
          <button onClick={() => { setView('list'); loadChallenges() }} style={btnBack}>← Salir</button>
          <span style={{ color: '#6B8299', fontSize: 13 }}>
            vs <strong style={{ color: '#0C1E33' }}>{opponent}</strong> · {GAMES[active.game]?.label}
          </span>
        </div>
        <GameComp seed={active.seed} onComplete={onGameComplete} />
      </div>
    )
  }

  if (view === 'result' && lastResult) {
    return (
      <ResultView
        result={lastResult}
        currentUser={currentUser}
        onBack={() => { setView('list'); loadChallenges() }}
      />
    )
  }

  // ─── Lista ────────────────────────────────────────────────────

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, color: '#0C1E33', fontSize: 22, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: .5 }}>
            🎮 Desafíos
          </h2>
          {toPlay.length > 0 && (
            <span style={{
              background: '#C0392B', color: 'white', borderRadius: 12,
              padding: '2px 10px', fontSize: 12, marginTop: 4, display: 'inline-block', fontWeight: 700,
            }}>
              {toPlay.length} te {toPlay.length === 1 ? 'espera' : 'esperan'}
            </span>
          )}
        </div>
        <button
          onClick={() => setView('create')}
          style={{
            background: 'linear-gradient(135deg,#74ACDF,#2F6FB0)', color: 'white',
            border: 'none', borderRadius: 12, padding: '10px 18px',
            fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          + Desafiar
        </button>
      </div>

      {loading && <p style={{ color: '#6B8299', textAlign: 'center' }}>Cargando desafíos...</p>}

      {toPlay.length > 0 && (
        <Section title="⚡ Te desafiaron">
          {toPlay.map(c => (
            <ChallengeCard key={c.id} ch={c} currentUser={currentUser}
              onPlay={() => { setActive(c); setView('play') }}
              actionLabel="¡Jugar!" actionColor="#F6B40E" />
          ))}
        </Section>
      )}

      {waiting.length > 0 && (
        <Section title="⏳ Esperando rival">
          {waiting.map(c => (
            <ChallengeCard key={c.id} ch={c} currentUser={currentUser} disabled />
          ))}
        </Section>
      )}

      {completed.length > 0 && (
        <Section title="✅ Completados">
          {completed.map(c => (
            <ChallengeCard key={c.id} ch={c} currentUser={currentUser} showResult />
          ))}
        </Section>
      )}

      {!loading && challenges.length === 0 && (
        <div style={{ textAlign: 'center', color: '#6B8299', marginTop: 48 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🎮</div>
          <p style={{ fontWeight: 700 }}>Todavía no hay desafíos.</p>
          <p style={{ fontSize: 14 }}>¡Desafiá a alguien y que empiece el juego!</p>
        </div>
      )}
    </div>
  )
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ color: '#6B8299', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
        {title}
      </div>
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
  const won = showResult && myScore > theirScore
  const tied = showResult && myScore === theirScore

  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 1px 0 #D9E6F2',
      border: showResult
        ? `2px solid ${won ? '#1B9E5A' : tied ? '#F6B40E' : '#C0392B'}`
        : '2px solid #D9E6F2',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, color: '#0C1E33', fontSize: 15, marginBottom: 2 }}>
          {game?.label} vs <span style={{ color: '#2F6FB0' }}>{opponent}</span>
        </div>
        <div style={{ color: '#6B8299', fontSize: 12 }}>
          {isChallenger ? 'Vos desafiaste' : 'Te desafió'} · {timeAgo(ch.created_at)}
        </div>
        {showResult && (
          <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: won ? '#1B9E5A' : tied ? '#B97E06' : '#C0392B' }}>
            {won ? '🏆 Ganaste' : tied ? '🤝 Empate' : '💀 Perdiste'} · {myScore} vs {theirScore}
          </div>
        )}
      </div>
      {onPlay && !disabled && (
        <button onClick={onPlay} style={{
          background: actionColor, border: 'none', borderRadius: 10,
          padding: '10px 16px', fontWeight: 800, color: '#3a2c00',
          cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap', fontFamily: 'inherit',
        }}>
          {actionLabel}
        </button>
      )}
      {disabled && (
        <span style={{ color: '#6B8299', fontSize: 13, whiteSpace: 'nowrap' }}>Esperando...</span>
      )}
    </div>
  )
}

function CreateView({ users, currentUser, onCreate, onBack }) {
  const [step, setStep] = useState('game')
  const [game, setGame] = useState(null)
  const [rival, setRival] = useState(null)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(null)

  async function handleCreate() {
    setCreating(true)
    await onCreate(game, rival)
    setCreated({ game, rival })
  }

  if (created) {
    const waText = encodeURIComponent(
      `🏆 *${currentUser}* te desafió en *La Scalonetta* a jugar *${GAMES[created.game]?.label}*!\n\nEntrá a la app y aceptá el desafío 👉 https://prode-lyart.vercel.app`
    )
    return (
      <div style={{ textAlign: 'center', paddingTop: 32 }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
        <h2 style={{ color: '#0C1E33', margin: '0 0 8px' }}>¡Desafío creado!</h2>
        <p style={{ color: '#6B8299' }}>Avisale a <strong>{created.rival}</strong> que lo espera un desafío</p>
        <a
          href={`https://wa.me/?text=${waText}`}
          target="_blank" rel="noreferrer"
          style={{
            display: 'block', background: '#25D366', color: 'white', textDecoration: 'none',
            borderRadius: 12, padding: '14px 20px', fontWeight: 800, fontSize: 16,
            margin: '20px 0 12px',
          }}
        >
          📱 Avisar por WhatsApp
        </a>
        <button onClick={onBack} style={btnBack}>Volver a desafíos</button>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <button onClick={step === 'game' ? onBack : () => setStep('game')} style={{ ...btnBack, marginBottom: 16 }}>
        ← {step === 'game' ? 'Cancelar' : 'Atrás'}
      </button>

      {step === 'game' && (
        <>
          <h2 style={{ color: '#0C1E33', margin: '0 0 16px', fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: .5 }}>
            ¿A qué jugamos?
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(GAMES).map(([key, g]) => (
              <button
                key={key}
                onClick={() => { setGame(key); setStep('rival') }}
                style={{
                  background: '#fff', border: '2px solid #D9E6F2', borderRadius: 14,
                  padding: '18px 16px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: 17, fontWeight: 800, color: '#0C1E33' }}>{g.label}</div>
                <div style={{ fontSize: 13, color: '#6B8299', marginTop: 4 }}>{g.desc}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 'rival' && (
        <>
          <h2 style={{ color: '#0C1E33', margin: '0 0 6px', fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: .5 }}>
            ¿A quién desafiás?
          </h2>
          <p style={{ color: '#6B8299', fontSize: 13, margin: '0 0 16px' }}>
            Juego elegido: {GAMES[game]?.label}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {users.map(u => (
              <button
                key={u}
                onClick={() => setRival(u)}
                style={{
                  background: rival === u ? '#EBF4FF' : '#fff',
                  border: `2px solid ${rival === u ? '#2F6FB0' : '#D9E6F2'}`,
                  borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                  color: '#0C1E33', fontSize: 16, fontFamily: 'inherit', textAlign: 'left', fontWeight: 700,
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
                width: '100%', background: 'linear-gradient(135deg,#74ACDF,#2F6FB0)',
                border: 'none', borderRadius: 14, padding: 16,
                color: 'white', fontWeight: 800, fontSize: 17,
                cursor: creating ? 'default' : 'pointer', opacity: creating ? 0.7 : 1,
                fontFamily: 'inherit',
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
  const won = bothPlayed && myScore > theirScore
  const tied = bothPlayed && myScore === theirScore

  const waText = encodeURIComponent(
    `🎮 Jugué *${game?.label}* en *La Scalonetta* y saqué ${myScore}/${game?.maxScore}.\n${opponent}, ¡ahora te toca vos! 👉 https://prode-lyart.vercel.app`
  )

  return (
    <div style={{ textAlign: 'center', paddingTop: 24 }}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>
        {!bothPlayed ? '⏳' : won ? '🏆' : tied ? '🤝' : '💀'}
      </div>
      <h2 style={{ color: '#0C1E33', margin: '0 0 4px' }}>
        {!bothPlayed ? '¡Turno completado!' : won ? '¡Ganaste!' : tied ? '¡Empate!' : '¡Perdiste!'}
      </h2>

      <div style={{
        background: '#fff', borderRadius: 16, padding: 24,
        margin: '20px 0', boxShadow: '0 1px 0 #D9E6F2',
      }}>
        <div style={{ fontSize: 12, color: '#6B8299', marginBottom: 16, fontWeight: 700 }}>
          {game?.label}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: '#6B8299', marginBottom: 4 }}>{currentUser}</div>
            <div style={{ fontSize: 44, fontWeight: 800, color: '#2F6FB0' }}>{myScore}</div>
          </div>
          <div style={{ color: '#D9E6F2', fontSize: 22, fontWeight: 700 }}>VS</div>
          <div>
            <div style={{ fontSize: 12, color: '#6B8299', marginBottom: 4 }}>{opponent}</div>
            <div style={{ fontSize: 44, fontWeight: 800, color: bothPlayed ? '#B97E06' : '#D9E6F2' }}>
              {bothPlayed ? theirScore : '?'}
            </div>
          </div>
        </div>
        {!bothPlayed && (
          <p style={{ color: '#6B8299', fontSize: 13, marginTop: 16, marginBottom: 0 }}>
            Esperando que <strong>{opponent}</strong> juegue...
          </p>
        )}
      </div>

      {!bothPlayed && (
        <a
          href={`https://wa.me/?text=${waText}`}
          target="_blank" rel="noreferrer"
          style={{
            display: 'block', background: '#25D366', color: 'white', textDecoration: 'none',
            borderRadius: 12, padding: '14px 20px', fontWeight: 800, fontSize: 15, marginBottom: 12,
          }}
        >
          📱 Apurar a {opponent} por WhatsApp
        </a>
      )}

      <button onClick={onBack} style={btnBack}>Volver a desafíos</button>
    </div>
  )
}

const btnBack = {
  background: '#fff', border: '2px solid #D9E6F2', color: '#6B8299',
  borderRadius: 10, padding: '10px 16px', cursor: 'pointer',
  fontSize: 14, fontFamily: 'inherit', fontWeight: 700, width: '100%',
}
