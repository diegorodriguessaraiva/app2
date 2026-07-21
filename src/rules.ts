import type { Email, Folder, Label, Rule } from './types'

export const LABEL_COLORS = [
  '#FF3B30', '#FF9500', '#FFCC00', '#34C759',
  '#00C7BE', '#007AFF', '#5856D6', '#AF52DE',
]

/** Etiquetas iniciais sugeridas. */
export const DEFAULT_LABELS: Label[] = [
  { id: 'lbl-trabalho', name: 'Trabalho', color: '#007AFF' },
  { id: 'lbl-financeiro', name: 'Financeiro', color: '#34C759' },
  { id: 'lbl-acao', name: 'Requer ação', color: '#FF3B30' },
  { id: 'lbl-pessoal', name: 'Pessoal', color: '#AF52DE' },
]

/** Regras iniciais sugeridas. */
export const DEFAULT_RULES: Rule[] = [
  {
    id: 'rule-fatura',
    name: 'Faturas → Financeiro',
    field: 'subject',
    value: 'fatura',
    action: 'label',
    target: 'lbl-financeiro',
    enabled: true,
  },
  {
    id: 'rule-urgente',
    name: 'Urgente → Requer ação',
    field: 'subject',
    value: 'urgente',
    action: 'label',
    target: 'lbl-acao',
    enabled: true,
  },
  {
    id: 'rule-promo',
    name: 'Promoções → Arquivo',
    field: 'category',
    value: 'promocoes',
    action: 'folder',
    target: 'archived',
    enabled: false,
  },
]

function fieldValue(email: Email, field: Rule['field']): string {
  switch (field) {
    case 'from':
      return `${email.from} ${email.fromEmail}`
    case 'subject':
      return email.subject
    case 'body':
      return `${email.subject} ${email.body}`
    case 'category':
      return email.category
  }
}

/**
 * Aplica as regras habilitadas a um e-mail, retornando uma cópia com etiquetas,
 * pasta e/ou favorito atualizados. Não altera o original.
 */
export function applyRules(email: Email, rules: Rule[]): Email {
  let next = { ...email, labels: [...email.labels] }
  for (const rule of rules) {
    if (!rule.enabled || !rule.value.trim()) continue
    const haystack = fieldValue(next, rule.field).toLowerCase()
    if (!haystack.includes(rule.value.toLowerCase())) continue

    if (rule.action === 'label') {
      if (!next.labels.includes(rule.target)) next.labels.push(rule.target)
    } else if (rule.action === 'star') {
      next.starred = true
    } else if (rule.action === 'folder') {
      next.folder = rule.target as Folder
    }
  }
  return next
}

export function applyRulesToAll(emails: Email[], rules: Rule[]): Email[] {
  return emails.map((e) => applyRules(e, rules))
}

// ---------- Persistência ----------
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch {
    /* ignora */
  }
  return fallback
}

export const loadLabels = () => load('triagem-labels-v1', DEFAULT_LABELS)
export const saveLabels = (labels: Label[]) =>
  localStorage.setItem('triagem-labels-v1', JSON.stringify(labels))

export const loadRules = () => load('triagem-rules-v1', DEFAULT_RULES)
export const saveRules = (rules: Rule[]) =>
  localStorage.setItem('triagem-rules-v1', JSON.stringify(rules))
