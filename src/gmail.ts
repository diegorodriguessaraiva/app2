import type { Email, EmailCategory } from './types'

const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

export const gmailConfigured = !!CLIENT_ID

let tokenClient: GoogleTokenClient | null = null
let accessToken: string | null = null
let userEmail: string | null = null

/** Aguarda o script do Google Identity Services carregar. */
function waitForGoogle(timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tick = () => {
      if (window.google?.accounts?.oauth2) return resolve()
      if (Date.now() - start > timeoutMs)
        return reject(new Error('Google Identity Services não carregou.'))
      setTimeout(tick, 100)
    }
    tick()
  })
}

/**
 * Inicia o fluxo OAuth e retorna um token de acesso do Gmail (somente leitura).
 * Requer VITE_GOOGLE_CLIENT_ID configurado.
 */
export async function connectGmail(): Promise<void> {
  if (!CLIENT_ID) throw new Error('Defina VITE_GOOGLE_CLIENT_ID para conectar o Gmail.')
  await waitForGoogle()

  return new Promise((resolve, reject) => {
    tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error))
        accessToken = resp.access_token
        resolve()
      },
      error_callback: (err) => reject(err),
    })
    tokenClient.requestAccessToken({ prompt: '' })
  })
}

export function disconnectGmail() {
  if (accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken)
  }
  accessToken = null
  userEmail = null
}

export function isGmailConnected(): boolean {
  return !!accessToken
}

async function api<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 401) {
    accessToken = null
    throw new Error('Sessão do Gmail expirou. Conecte novamente.')
  }
  if (!res.ok) throw new Error(`Erro do Gmail (${res.status}).`)
  return res.json() as Promise<T>
}

interface GmailHeader {
  name: string
  value: string
}
interface GmailPart {
  mimeType?: string
  filename?: string
  body?: { data?: string; size?: number }
  parts?: GmailPart[]
}
interface GmailMessage {
  id: string
  snippet?: string
  labelIds?: string[]
  internalDate?: string
  payload?: { headers?: GmailHeader[]; mimeType?: string; body?: { data?: string }; parts?: GmailPart[] }
}

function header(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

/** Decodifica o base64url usado pelo Gmail. */
function decodeB64Url(data: string): string {
  try {
    const norm = data.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(norm)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return ''
  }
}

/** Extrai texto legível (prefere text/plain) e detecta anexos. */
function extractBody(payload: GmailMessage['payload']): { text: string; hasAttachment: boolean } {
  let text = ''
  let hasAttachment = false

  const walk = (part?: GmailPart) => {
    if (!part) return
    if (part.filename && part.filename.length > 0) hasAttachment = true
    if (part.mimeType === 'text/plain' && part.body?.data && !text) {
      text = decodeB64Url(part.body.data)
    }
    part.parts?.forEach(walk)
  }

  if (payload?.body?.data && payload.mimeType === 'text/plain') {
    text = decodeB64Url(payload.body.data)
  }
  payload?.parts?.forEach(walk)

  return { text: text.replace(/\r/g, '').trim(), hasAttachment }
}

function categoryFromLabels(labelIds: string[]): EmailCategory {
  if (labelIds.includes('CATEGORY_PROMOTIONS')) return 'promocoes'
  if (labelIds.includes('CATEGORY_SOCIAL')) return 'social'
  if (labelIds.includes('CATEGORY_UPDATES') || labelIds.includes('CATEGORY_FORUMS')) return 'atualizacoes'
  return 'pessoal'
}

function extractName(from: string): string {
  const match = from.match(/^\s*"?([^"<]+?)"?\s*</)
  if (match) return match[1].trim()
  const email = from.match(/[^<>\s]+@[^<>\s]+/)
  return email ? email[0] : from
}

function extractEmail(from: string): string {
  const m = from.match(/[^<>\s]+@[^<>\s]+/)
  return m ? m[0] : from
}

export interface InboxPage {
  emails: Email[]
  /** token para carregar a próxima página; null quando não há mais */
  nextPageToken: string | null
}

/**
 * Busca uma página da caixa de entrada e converte para o formato `Email`.
 * `max` = quantas mensagens nesta página; `pageToken` = continuação (paginação).
 */
export async function fetchInboxPage(max = 20, pageToken?: string): Promise<InboxPage> {
  if (!accessToken) throw new Error('Gmail não conectado.')

  // Descobre o e-mail do usuário (para detectar mensagens direcionadas).
  if (!userEmail) {
    try {
      const profile = await api<{ emailAddress: string }>(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile',
      )
      userEmail = profile.emailAddress.toLowerCase()
    } catch {
      userEmail = ''
    }
  }

  const url =
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}&labelIds=INBOX` +
    (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '')
  const list = await api<{ messages?: { id: string }[]; nextPageToken?: string }>(url)
  const ids = (list.messages ?? []).map((m) => m.id)

  const messages = await Promise.all(
    ids.map((id) =>
      api<GmailMessage>(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      ).catch(() => null),
    ),
  )

  const emails = messages
    .filter((m): m is GmailMessage => m !== null)
    .map((m) => {
      const headers = m.payload?.headers
      const from = header(headers, 'From')
      const to = header(headers, 'To')
      const dateHeader = header(headers, 'Date')
      const labelIds = m.labelIds ?? []
      const { text, hasAttachment } = extractBody(m.payload)
      const date = m.internalDate
        ? new Date(Number(m.internalDate)).toISOString()
        : dateHeader
          ? new Date(dateHeader).toISOString()
          : new Date().toISOString()

      const email: Email = {
        id: m.id,
        from: extractName(from),
        fromEmail: extractEmail(from),
        vip: labelIds.includes('IMPORTANT'),
        subject: header(headers, 'Subject') || '(sem assunto)',
        preview: (m.snippet ?? '').slice(0, 140),
        body: text || m.snippet || '',
        date,
        read: !labelIds.includes('UNREAD'),
        starred: labelIds.includes('STARRED'),
        hasAttachment,
        directed: !!userEmail && to.toLowerCase().includes(userEmail),
        folder: 'inbox',
        category: categoryFromLabels(labelIds),
        labels: [],
      }
      return email
    })

  return { emails, nextPageToken: list.nextPageToken ?? null }
}
