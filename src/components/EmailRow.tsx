import { RELEVANCE_META } from '../relevance'
import type { Label, ScoredEmail } from '../types'

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
  if (parts.length === 0 || parts[0] === '') return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs} h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days} d`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

interface Props {
  email: ScoredEmail
  labels: Label[]
  onOpen: () => void
  onToggleStar: (e: React.MouseEvent) => void
}

export function EmailRow({ email, labels, onOpen, onToggleStar }: Props) {
  const meta = RELEVANCE_META[email.relevance]
  const emailLabels = labels.filter((l) => email.labels.includes(l.id))
  return (
    <div className="row" onClick={onOpen}>
      <div className={`unread-dot ${email.read ? 'hidden' : ''}`} />
      <div className="avatar" style={{ background: avatarColor(email.from) }}>
        {initials(email.from)}
      </div>
      <div className="row-main">
        <div className="row-line1">
          <span className={`row-from ${email.read ? 'read' : ''}`}>{email.from}</span>
          <span className="row-time">{relativeTime(email.date)}</span>
        </div>
        <div className="row-subject">{email.subject}</div>
        <div className="row-preview">{email.preview}</div>
        <div className="row-meta">
          <span
            className="badge"
            style={{ background: `${meta.color}22`, color: meta.color }}
          >
            {meta.label}
            <span className="score">· {email.score}</span>
          </span>
          {email.source === 'ai' && <span className="ai-tag">IA</span>}
          {emailLabels.map((l) => (
            <span
              key={l.id}
              className="label-chip sm"
              style={{ background: `${l.color}22`, color: l.color }}
            >
              <span className="dot" style={{ background: l.color }} />
              {l.name}
            </span>
          ))}
          {email.vip && <span className="vip-tag">VIP</span>}
          {email.hasAttachment && <span className="mini-icon">📎</span>}
          <button
            className={`mini-icon ${email.starred ? 'star-on' : ''}`}
            onClick={onToggleStar}
            aria-label="Favoritar"
            style={{ marginLeft: 'auto' }}
          >
            {email.starred ? '★' : '☆'}
          </button>
        </div>
      </div>
    </div>
  )
}
