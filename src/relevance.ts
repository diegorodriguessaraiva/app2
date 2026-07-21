import type { Email, Relevance, ScoredEmail } from './types'

/**
 * Palavras-chave que indicam urgência / importância no assunto ou corpo.
 * Cada categoria contribui com um peso diferente na pontuação.
 */
const URGENT_KEYWORDS = [
  'urgente', 'urgência', 'imediato', 'imediata', 'agora', 'hoje',
  'prazo', 'vencimento', 'vence', 'expira', 'último dia', 'ação necessária',
  'crítico', 'crítica', 'emergência', 'atenção',
]

const IMPORTANT_KEYWORDS = [
  'importante', 'reunião', 'contrato', 'proposta', 'aprovação', 'aprovar',
  'assinatura', 'fatura', 'pagamento', 'boleto', 'entrevista', 'oferta',
  'resposta', 'confirmação', 'confirmar', 'projeto', 'decisão', 'revisão',
]

const LOW_VALUE_KEYWORDS = [
  'newsletter', 'promoção', 'desconto', 'cupom', 'oferta imperdível',
  'não perca', 'novidades', 'descadastrar', 'unsubscribe', 'imperdível',
  'black friday', 'liquidação', 'grátis', 'sorteio', 'ganhe',
]

function countMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase()
  return keywords.reduce((acc, kw) => (lower.includes(kw) ? acc + 1 : acc), 0)
}

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60)
}

/**
 * Classifica a relevância de um e-mail com base em múltiplos sinais:
 * remetente VIP, palavras de urgência/importância, se é direcionado,
 * anexos, se está por ler e a recência. Retorna uma pontuação de 0 a 100.
 */
export function scoreEmail(email: Email): ScoredEmail {
  let score = 40 // linha de base
  const reasons: string[] = []
  const haystack = `${email.subject} ${email.body}`

  // Remetente importante (VIP)
  if (email.vip) {
    score += 22
    reasons.push('Remetente importante (VIP)')
  }

  // Direcionado diretamente ao usuário vs. lista/newsletter
  if (email.directed) {
    score += 8
    reasons.push('Endereçado diretamente a você')
  } else {
    score -= 10
  }

  // Urgência
  const urgent = countMatches(haystack, URGENT_KEYWORDS)
  if (urgent > 0) {
    score += Math.min(24, urgent * 12)
    reasons.push('Contém sinais de urgência')
  }

  // Importância
  const important = countMatches(haystack, IMPORTANT_KEYWORDS)
  if (important > 0) {
    score += Math.min(18, important * 7)
    reasons.push('Palavras-chave de alta importância')
  }

  // Ruído / baixo valor
  const lowValue = countMatches(haystack, LOW_VALUE_KEYWORDS)
  if (lowValue > 0) {
    score -= Math.min(28, lowValue * 12)
    reasons.push('Aparenta ser promoção/newsletter')
  }

  // Categoria de baixa prioridade
  if (email.category === 'promocoes') {
    score -= 14
  } else if (email.category === 'social') {
    score -= 6
  } else if (email.category === 'financeiro' || email.category === 'trabalho') {
    score += 6
    reasons.push(email.category === 'financeiro' ? 'Assunto financeiro' : 'Assunto de trabalho')
  }

  // Anexos costumam indicar conteúdo acionável
  if (email.hasAttachment) {
    score += 6
    reasons.push('Possui anexo')
  }

  // Não lido ganha leve prioridade
  if (!email.read) {
    score += 4
  }

  // Recência: e-mails muito antigos perdem prioridade
  const age = hoursSince(email.date)
  if (age < 3) {
    score += 8
    reasons.push('Recebido há pouco tempo')
  } else if (age > 72) {
    score -= 8
  }

  // Normaliza para 0–100
  score = Math.max(0, Math.min(100, Math.round(score)))

  return { ...email, score, relevance: toRelevance(score), reasons, source: 'local' }
}

export function toRelevance(score: number): Relevance {
  if (score >= 70) return 'alta'
  if (score >= 45) return 'media'
  return 'baixa'
}

/** Pontua e ordena de forma decrescente por relevância. */
export function scoreAndSort(emails: Email[]): ScoredEmail[] {
  return emails
    .map(scoreEmail)
    .sort((a, b) => b.score - a.score || +new Date(b.date) - +new Date(a.date))
}

export const RELEVANCE_META: Record<Relevance, { label: string; color: string; emoji: string }> = {
  alta: { label: 'Alta', color: '#FF3B30', emoji: '🔴' },
  media: { label: 'Média', color: '#FF9500', emoji: '🟠' },
  baixa: { label: 'Baixa', color: '#34C759', emoji: '🟢' },
}
