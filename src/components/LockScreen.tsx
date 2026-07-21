import { useState } from 'react'
import { markUnlocked, verifyPin } from '../pin'

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [digits, setDigits] = useState('')
  const [error, setError] = useState(false)

  const submit = async (code: string) => {
    if (await verifyPin(code)) {
      markUnlocked()
      onUnlock()
    } else {
      setError(true)
      setTimeout(() => {
        setError(false)
        setDigits('')
      }, 550)
    }
  }

  const press = (n: string) => {
    if (digits.length >= 6 || error) return
    const next = digits + n
    setDigits(next)
    if (next.length === 6) submit(next)
  }
  const del = () => setDigits((d) => d.slice(0, -1))

  return (
    <div className="lock">
      <div className="lock-inner">
        <div className="lock-icon">🔒</div>
        <div className="lock-title">Triagem bloqueada</div>
        <div className="lock-sub">Digite o PIN para acessar</div>

        <div className={`pin-dots ${error ? 'err' : ''}`}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={`pin-dot ${i < digits.length ? 'on' : ''}`} />
          ))}
        </div>

        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
            <button key={n} className="key" onClick={() => press(n)}>
              {n}
            </button>
          ))}
          <span />
          <button className="key" onClick={() => press('0')}>
            0
          </button>
          <button className="key del" onClick={del} aria-label="Apagar">
            ⌫
          </button>
        </div>
      </div>
    </div>
  )
}
