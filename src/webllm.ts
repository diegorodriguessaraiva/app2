import type { MLCEngineInterface } from '@mlc-ai/web-llm'
import type { AiResult } from './ai'
import { toRelevance } from './relevance'
import type { Email, Relevance } from './types'

/**
 * Modelo pequeno e multilíngue que roda inteiramente no navegador via WebGPU.
 * Os pesos são baixados uma vez do CDN e ficam em cache no navegador.
 */
export const WEBLLM_MODEL = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC'

/** WebGPU disponível? (Chrome/Edge recentes no desktop, alguns no mobile) */
export function webgpuSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

let enginePromise: Promise<MLCEngineInterface> | null = null

export interface LoadProgress {
  text: string
  progress: number // 0..1
}

/** Carrega (uma vez) o modelo, reportando o progresso do download. */
export function loadModel(
  onProgress: (p: LoadProgress) => void,
): Promise<MLCEngineInterface> {
  if (enginePromise) return enginePromise
  enginePromise = (async () => {
    const webllm = await import('@mlc-ai/web-llm')
    const worker = new Worker(new URL('./webllm.worker.ts', import.meta.url), {
      type: 'module',
    })
    return webllm.CreateWebWorkerMLCEngine(worker, WEBLLM_MODEL, {
      initProgressCallback: (r) =>
        onProgress({ text: r.text, progress: r.progress ?? 0 }),
    })
  })()
  // Se falhar, permite tentar de novo depois.
  enginePromise.catch(() => {
    enginePromise = null
  })
  return enginePromise
}

const SYSTEM = `Você classifica a relevância de e-mails para uma pessoa ocupada.
Responda SOMENTE com um objeto JSON, sem texto extra, no formato:
{"score": <inteiro 0-100>, "relevance": "alta"|"media"|"baixa", "reasons": ["motivo curto"], "summary": "resumo em uma frase"}
Escreva em português. score alto = urgente / importante / pede uma ação;
score baixo = promoção / newsletter / informativo.`

function messagesFor(email: Email) {
  const user = `Remetente: ${email.from} <${email.fromEmail}>
Importante (VIP): ${email.vip ? 'sim' : 'não'}
Assunto: ${email.subject}
Conteúdo: ${email.body.slice(0, 1200)}`
  return [
    { role: 'system' as const, content: SYSTEM },
    { role: 'user' as const, content: user },
  ]
}

/** Classifica um único e-mail com o modelo local. */
export async function classifyOne(
  engine: MLCEngineInterface,
  email: Email,
): Promise<AiResult> {
  const reply = await engine.chat.completions.create({
    messages: messagesFor(email),
    max_tokens: 260,
    temperature: 0,
    response_format: { type: 'json_object' },
  })
  const text = reply.choices?.[0]?.message?.content ?? '{}'

  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = {}
  }

  let score = Math.round(Number(parsed.score))
  if (!Number.isFinite(score)) score = 50
  score = Math.max(0, Math.min(100, score))

  const rel = parsed.relevance
  const relevance: Relevance =
    rel === 'alta' || rel === 'media' || rel === 'baixa' ? rel : toRelevance(score)

  const reasons = Array.isArray(parsed.reasons)
    ? parsed.reasons.slice(0, 4).map((r) => String(r))
    : []
  const summary = typeof parsed.summary === 'string' ? parsed.summary : ''

  return { id: email.id, score, relevance, reasons, summary }
}

/**
 * Classifica uma lista de e-mails sequencialmente, chamando `onEach` a cada
 * resultado (permite atualizar a interface de forma progressiva).
 */
export async function classifyEmails(
  engine: MLCEngineInterface,
  emails: Email[],
  onEach: (r: AiResult) => void,
): Promise<void> {
  for (const email of emails) {
    try {
      onEach(await classifyOne(engine, email))
    } catch {
      // Mantém a pontuação local deste e-mail em caso de erro.
    }
  }
}
