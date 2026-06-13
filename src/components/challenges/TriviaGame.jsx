import { useState, useMemo } from 'react'
import { seededShuffle } from '../../utils/seededRandom'
import { ALL_TRIVIA } from '../../data/triviaQuestions'

const TOTAL_Q = 10

export default function TriviaGame({ seed, onComplete }) {
  const questions = useMemo(
    () => seededShuffle(ALL_TRIVIA, seed).slice(0, TOTAL_Q),
    [seed]
  )
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState(null)
  const [score, setScore] = useState(0)
  const [history, setHistory] = useState([])

  const q = questions[idx]
  const isLast = idx === questions.length - 1

  function handleSelect(optIdx) {
    if (selected !== null) return
    setSelected(optIdx)
    const correct = optIdx === q.a
    const newScore = score + (correct ? 1 : 0)

    setTimeout(() => {
      const newHistory = [...history, { correct, picked: optIdx, answer: q.a }]
      setHistory(newHistory)
      if (isLast) {
        onComplete(newScore, newHistory)
      } else {
        setScore(newScore)
        setIdx(i => i + 1)
        setSelected(null)
      }
    }, 2000)
  }

  return (
    <div style={{ padding: '20px 16px', maxWidth: 400, margin: '0 auto' }}>
      {/* Header: progreso + puntaje */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ color: '#888', fontSize: 13 }}>
          {idx + 1} / {TOTAL_Q}
        </span>
        <span style={{ color: '#F6C700', fontSize: 13, fontWeight: 'bold' }}>
          🏆 {score} pts
        </span>
      </div>

      {/* Barra de progreso */}
      <div style={{ height: 4, background: '#1a1a3e', borderRadius: 2, marginBottom: 20 }}>
        <div style={{
          height: '100%', background: '#75AADB', borderRadius: 2,
          width: `${(idx / TOTAL_Q) * 100}%`, transition: 'width 0.4s'
        }} />
      </div>

      {/* Pregunta */}
      <div style={{
        background: '#12122a', borderRadius: 14, padding: '20px 18px',
        marginBottom: 16, fontSize: 16, lineHeight: 1.5,
        color: 'white', textAlign: 'center', minHeight: 90,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {q.q}
      </div>

      {/* Opciones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {q.opts.map((opt, i) => {
          let bg = '#1e1e3a'
          let border = '2px solid transparent'
          let color = 'white'
          if (selected !== null) {
            if (i === q.a) {
              bg = '#0d3320'; border = '2px solid #4CAF50'; color = '#7dff9a'
            } else if (i === selected && i !== q.a) {
              bg = '#3a0d0d'; border = '2px solid #ff4444'; color = '#ff8888'
            }
          }
          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              style={{
                background: bg, border, borderRadius: 12,
                padding: '14px 16px', color, fontSize: 15,
                cursor: selected !== null ? 'default' : 'pointer',
                textAlign: 'left', transition: 'all 0.3s',
                fontFamily: 'inherit', width: '100%'
              }}
            >
              {selected !== null && i === q.a && '✅ '}
              {selected !== null && i === selected && i !== q.a && '❌ '}
              {opt}
            </button>
          )
        })}
      </div>

      {/* Dato curioso post-respuesta */}
      {selected !== null && q.extra && (
        <div style={{
          padding: '12px 14px', background: '#12122a', borderRadius: 12,
          color: '#aaa', fontSize: 13, textAlign: 'center',
          borderLeft: `4px solid ${selected === q.a ? '#4CAF50' : '#ff4444'}`
        }}>
          {q.extra}
        </div>
      )}
    </div>
  )
}
