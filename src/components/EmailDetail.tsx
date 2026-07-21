import { useEffect } from 'react'
import { RELEVANCE_META } from '../relevance'
import type { ScoredEmail } from '../types'

const AVATAR_COLORS = [
  '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#00C7BE',
  '#30B0C7', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55',
]
function avatarColor(name: string): string {
  let sum = 0
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}
function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\s]/gu, '').trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

interface Props {
  email: ScoredEmail
  onClose: () => void
  onToggleStar: () => void
  onToggleRead: () => void
  onArchive: () => void
  onTrash: () => void
}

export function EmailDetail({
  email,
  onClose,
  onToggleStar,
  onToggleRead,
  onArchive,
  onTrash,
}: Props) {
  const meta = RELEVANCE_META[email.relevance]

  // Fecha com a tecla Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const fullDate = new Date(email.date).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-grabber" />
        <div className="sheet-nav">
          <button onClick={onClose}>‹ Voltar</button>
          <button onClick={onToggleStar}>{email.starred ? '★ Favorito' : '☆ Favoritar'}</button>
        </div>

        <div className="sheet-body">
          <h2 className="sheet-subject">{email.subject}</h2>

          <div className="sheet-sender">
            <div className="avatar" style={{ background: avatarColor(email.from) }}>
              {initials(email.from)}
            </div>
            <div className="who">
              <div className="name">
                {email.from} {email.vip && <span className="vip-tag">VIP</span>}
              </div>
              <div className="addr">{email.fromEmail}</div>
            </div>
          </div>
          <div className="sheet-date" style={{ marginBottom: 18 }}>
            {fullDate}
            {email.hasAttachment && ' · 📎 1 anexo'}
          </div>

          {/* Card de análise de relevância */}
          <div className="reason-card">
            <div className="reason-head">
              <span className="rh-title">Análise de relevância</span>
              <span className="score-pill" style={{ background: meta.color }}>
                {meta.label} · {email.score}/100
              </span>
            </div>
            <div className="meter">
              <div
                className="meter-fill"
                style={{ width: `${email.score}%`, background: meta.color }}
              />
            </div>
            <ul className="reasons">
              {email.reasons.length > 0 ? (
                email.reasons.map((r, i) => (
                  <li key={i}>
                    <span className="chk">✓</span>
                    {r}
                  </li>
                ))
              ) : (
                <li>
                  <span className="chk">–</span>
                  Sem sinais fortes de prioridade.
                </li>
              )}
            </ul>
          </div>

          <div className="sheet-text">{email.body}</div>
        </div>

        <div className="sheet-actions">
          <button className="action-btn" onClick={onToggleRead}>
            <span className="ab-ico">{email.read ? '✉️' : '📭'}</span>
            {email.read ? 'Não lido' : 'Lido'}
          </button>
          <button className="action-btn" onClick={onToggleStar}>
            <span className="ab-ico">{email.starred ? '★' : '☆'}</span>
            Favorito
          </button>
          <button className="action-btn" onClick={onArchive}>
            <span className="ab-ico">🗄️</span>
            Arquivar
          </button>
          <button className="action-btn danger" onClick={onTrash}>
            <span className="ab-ico">🗑️</span>
            Excluir
          </button>
        </div>
      </div>
    </>
  )
}
