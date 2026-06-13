import { useState, useMemo } from 'react'
import { seededShuffle } from '../../utils/seededRandom'
import { HL_PLAYERS } from '../../data/hlPlayers'

export default function HigherOrLowerGame({ seed, onComplete }) {
  const players = useMemo(() => seededShuffle(HL_PLAYERS, seed), [seed])
  const [idx, setIdx] = useState(0)
  const [lives, setLives] = useState(3)
  const [score, setScore] = useState(0)
  const [phase, setPhase] = useState('guess') // 'guess' | 'reveal'
  const [lastOk, setLastOk] = useState(null)
  const [ended, setEnded] = useState(false)

  const curr = players[idx]
  const next = players[idx + 1]

  function guess(higher) {
    if (phase !== 'guess' || ended) return
    // igual se considera correcto para ambas opciones
    const correct = higher ? next.goals >= curr.goals : next.goals <= curr.goals
    setLastOk(correct)
    setPhase('reveal')

    setTimeout(() => {
      if (!correct) {
        const newLives = lives - 1
        setLives(newLives)
        if (newLives <= 0) {
          setEnded(true)
          setTimeout(() => onComplete(score, []), 500)
          return
        }
      } else {
        const newScore = score + 1
        setScore(newScore)
        if (idx + 1 >= players.length - 1) {
          setEnded(true)
          setTimeout(() => onComplete(newScore, []), 500)
          return
        }
      }
      setIdx(i => i + 1)
      setPhase('guess')
      setLastOk(null)
    }, 2200)
  }

  const btn = (label, higher, color) => ({
    background: `${color}22`,
    border: `2px solid ${color}`,
    color,
    padding: '14px 28px',
    borderRadius: 14,
    fontSize: 17,
    fontWeight: 'bold',
    cursor: 'pointer',
    fontFamily: 'inherit'
  })

  return (
    <div style={{ padding: '20px 16px', maxWidth: 360, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontSize: 32 }}>📊</div>
      <h3 style={{ color: '#75AADB', margin: '4px 0 2px', fontSize: 20 }}>Mayor o Menor</h3>
      <p style={{ color: '#888', fontSize: 13, margin: '0 0 18px' }}>Goles en Mundiales</p>

      {/* Vidas y score */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 18 }}>
          {Array.from({ length: 3 }, (_, i) => i < lives ? '❤️' : '🖤').join('')}
        </span>
        <span style={{ color: '#F6C700', fontWeight: 'bold' }}>✅ {score} correctas</span>
      </div>

      {/* Jugador actual */}
      <PlayerCard player={curr} revealed goals={curr.goals} accent="#75AADB" />

      <div style={{ color: '#75AADB', fontSize: 22, fontWeight: 'bold', margin: '10px 0' }}>VS</div>

      {/* Siguiente jugador */}
      <PlayerCard
        player={next}
        revealed={phase === 'reveal'}
        goals={next?.goals}
        accent={lastOk === true ? '#4CAF50' : lastOk === false ? '#ff4444' : '#444'}
      />

      {phase === 'reveal' && lastOk !== null && (
        <div style={{
          fontSize: 22, fontWeight: 'bold', margin: '12px 0',
          color: lastOk ? '#4CAF50' : '#ff4444'
        }}>
          {lastOk ? '✅ ¡Correcto!' : '❌ ¡Incorrecto!'}
        </div>
      )}

      {/* Botones */}
      {phase === 'guess' && !ended && next && (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
          <button style={btn('⬆ MÁS', true, '#4CAF50')} onClick={() => guess(true)}>
            ⬆ MÁS
          </button>
          <button style={btn('⬇ MENOS', false, '#ff4444')} onClick={() => guess(false)}>
            ⬇ MENOS
          </button>
        </div>
      )}

      {ended && (
        <div style={{ marginTop: 16, color: '#F6C700', fontSize: 18, fontWeight: 'bold' }}>
          {score >= 10 ? '🏆 ¡Enciclopedia del fútbol!' : score >= 6 ? '💪 ¡Buen conocimiento!' : '📚 A estudiar un poco más'}
        </div>
      )}
    </div>
  )
}

function PlayerCard({ player, revealed, goals, accent }) {
  return (
    <div style={{
      background: '#12122a', borderRadius: 16, padding: 20,
      border: `2px solid ${accent}`, transition: 'border 0.3s'
    }}>
      {revealed && player ? (
        <>
          <div style={{ fontSize: 34, marginBottom: 6 }}>{player.emoji}</div>
          <div style={{ fontSize: 19, fontWeight: 'bold', color: 'white' }}>{player.name}</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>{player.country}</div>
          <div style={{ fontSize: 36, fontWeight: 'bold', color: '#F6C700' }}>{goals}</div>
          <div style={{ fontSize: 12, color: '#666' }}>goles en mundiales</div>
          {player.fun && (
            <div style={{ fontSize: 12, color: '#75AADB', marginTop: 6 }}>"{player.fun}"</div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: 36 }}>🎴</div>
          <div style={{ fontSize: 16, color: '#555', marginTop: 8 }}>???</div>
          <div style={{ fontSize: 12, color: '#333', marginTop: 4 }}>¿Más o menos goles?</div>
        </>
      )}
    </div>
  )
}
