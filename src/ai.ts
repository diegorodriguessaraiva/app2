import type { Email, Relevance } from './types'

export interface AiResult {
  id: string
  score: number
  relevance: Relevance
  reasons: string[]
  summary: string
}

export interface AiHealth {
  ok: boolean
  ai: boolean
  model: string
}

/** Verifica se o backend está disponível e se a IA está configurada. */
export async function checkAi(): Promise<AiHealth> {
  try {
    const res = await fetch('/api/health')
    if (!res.ok) return { ok: false, ai: false, model: '' }
    return (await res.json()) as AiHealth
  } catch {
    return { ok: false, ai: false, model: '' }
  }
}

/**
 * Envia os e-mails ao backend para classificação por IA (Claude).
 * Retorna um mapa id → resultado. Lança erro se a IA não estiver disponível.
 */
export async function classifyWithAI(emails: Email[]): Promise<Map<string, AiResult>> {
  const payload = emails.map((e) => ({
    id: e.id,
    from: e.from,
    fromEmail: e.fromEmail,
    vip: e.vip,
    directed: e.directed,
    hasAttachment: e.hasAttachment,
    category: e.category,
    subject: e.subject,
    body: e.body,
  }))

  const res = await fetch('/api/classify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ emails: payload }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Falha na classificação (${res.status}).`)
  }

  const data = (await res.json()) as { results: AiResult[] }
  const map = new Map<string, AiResult>()
  for (const r of data.results ?? []) map.set(r.id, r)
  return map
}
