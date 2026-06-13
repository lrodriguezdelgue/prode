import { useState, useMemo } from 'react'
import { createSeededRandom } from '../../utils/seededRandom'

const ZONES = ['TL', 'TC', 'TR', 'BL', 'BC', 'BR']
const LABELS = { TL: '↖', TC: '⬆', TR: '↗', BL: '↙', BC: '⬇', BR: '↘' }
const TOTAL = 5

const s = {
  wrap: { textAlign: 'center', padding: '20px 16px', maxWidth: 360, margin: '0 auto' },
  title: { color: '#75AADB', margin: '4px 0 2px', fontSize: 22 },
  sub: { color: '#888', fontSize: 13, margin: '0 0 20px' },
  goal: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3,
    maxWidth: 240, margin: '0 auto 20px',
    border: '3px solid white', borderBottom: 'none',
    padding: 3, background: '#0d0d1e', borderRadius: '8px 8px 0 0'
  },
  postMsg: { fontSize: 26, fontWeight: 'bold', margin: '8px 0', minHeight: 36 },
  history: { display: 'flex', justifyContent: 'center', gap: 10, marginTop: 12, fontSize: 22 },
  finalMsg: { marginTop: 16, color: '#F6C700', fontSize: 20, fontWeight: 'bold' }
}

function zoneColor(zone, shot, gk) {
  if (!shot) return '#1a1a3e'
  if (zone === shot && zone === gk) return '#993300' // disparé acá y me atajó
  if (zone === gk) return '#ff6600'  // el arquero fue acá
  if (zone === shot) return '#1a7a1a' // hice gol acá
  return '#1a1a3e'
}

export default function PenalesGame({ seed, onComplete }) {
  const [shots, setShots] = useState([])
  const [showing, setShowing] = useState(null) // {zone, gkZone, scored}
  const [finished, setFinished] = useState(false)

  const gkChoices = useMemo(() => {
    const rng = createSeededRandom(seed)
    return Array.from({ length: TOTAL }, () => ZONES[Math.floor(rng() * 6)])
  }, [seed])

  const taken = shots.length
  const score = shots.filter(s => s.scored).length

  function shoot(zone) {
    if (showing || finished || taken >= TOTAL) return
    const gkZone = gkChoices[taken]
    const scored = zone !== gkZone
    setShowing({ zone, gkZone, scored })
    setTimeout(() => {
      const next = [...shots, { zone, gkZone, scored }]
      setShots(next)
      setShowing(null)
      if (next.length >= TOTAL) {
        setFinished(true)
        setTimeout(() => onComplete(next.filter(s => s.scored).length, next), 800)
      }
    }, 1600)
  }

  const current = showing || null

  return (
    <div style={s.wrap}>
      <div style={{ fontSize: 36 }}>🥅</div>
      <h3 style={s.title}>Penales</h3>
      <p style={s.sub}>
        {!finished
          ? `Tiro ${Math.min(taken + 1, TOTAL)} de ${TOTAL} · ${score} ${score === 1 ? 'gol' : 'goles'}`
          : `Resultado final: ${score}/${TOTAL} goles`}
      </p>

      {/* Arco */}
      <div style={s.goal}>
        {ZONES.map(zone => (
          <div
            key={zone}
            onClick={() => !current && !finished && taken < TOTAL && shoot(zone)}
            style={{
              height: 64,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
              borderRadius: 4,
              background: zoneColor(zone, current?.zone, current?.gkZone),
              cursor: (!current && !finished && taken < TOTAL) ? 'pointer' : 'default',
              transition: 'background 0.25s',
              userSelect: 'none'
            }}
          >
            {current?.gkZone === zone
              ? '🧤'
              : current?.zone === zone
                ? (current.scored ? '⚽' : '🚫')
                : LABELS[zone]}
          </div>
        ))}
      </div>

      {/* Resultado del tiro */}
      <div style={s.postMsg}>
        {current && (
          <span style={{ color: current.scored ? '#4CAF50' : '#ff4444' }}>
            {current.scored ? '⚽ ¡GOOOL!' : '🧤 ¡Atajado!'}
          </span>
        )}
      </div>

      {/* Historial de tiros */}
      <div style={s.history}>
        {Array.from({ length: TOTAL }, (_, i) => (
          <span key={i}>
            {i < shots.length ? (shots[i].scored ? '⚽' : '❌') : '⬜'}
          </span>
        ))}
      </div>

      {finished && (
        <div style={s.finalMsg}>
          {score === 5 ? '🏆 ¡Perfecto!' : score >= 3 ? '💪 ¡Buen resultado!' : '😬 Flojito...'}
        </div>
      )}

      {!current && !finished && taken < TOTAL && (
        <p style={{ color: '#555', fontSize: 12, marginTop: 16 }}>
          Tocá una zona para disparar
        </p>
      )}
    </div>
  )
}
