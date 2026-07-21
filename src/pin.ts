// Bloqueio por PIN (client-side). Guardamos apenas o HASH do PIN, nunca o
// número em texto puro. Aviso: num app estático isto barra acesso casual, mas
// não é uma proteção forte contra alguém com conhecimento técnico.

// Hash SHA-256 do PIN padrão (670767).
const DEFAULT_HASH = '4fd578ba2d278848d42fc5c19877f2c764493d5c562ab5aa272c19dd34a22990'

const ENABLED_KEY = 'triagem-pin-enabled'
const HASH_KEY = 'triagem-pin-hash'
const UNLOCK_KEY = 'triagem-unlocked'

export function pinEnabled(): boolean {
  // Habilitado por padrão (só desliga se explicitamente 'false').
  return localStorage.getItem(ENABLED_KEY) !== 'false'
}

export function setPinEnabled(v: boolean): void {
  localStorage.setItem(ENABLED_KEY, v ? 'true' : 'false')
  if (!v) sessionStorage.removeItem(UNLOCK_KEY)
}

function storedHash(): string {
  return localStorage.getItem(HASH_KEY) || DEFAULT_HASH
}

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPin(pin: string): Promise<boolean> {
  return (await hashPin(pin)) === storedHash()
}

export async function setPin(pin: string): Promise<void> {
  localStorage.setItem(HASH_KEY, await hashPin(pin))
}

/** Desbloqueado nesta sessão? (ou PIN desativado) */
export function isUnlocked(): boolean {
  return !pinEnabled() || sessionStorage.getItem(UNLOCK_KEY) === '1'
}

export function markUnlocked(): void {
  sessionStorage.setItem(UNLOCK_KEY, '1')
}

export function lockNow(): void {
  sessionStorage.removeItem(UNLOCK_KEY)
}
