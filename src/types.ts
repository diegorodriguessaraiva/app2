export type Relevance = 'alta' | 'media' | 'baixa'

export type Folder = 'inbox' | 'archived' | 'trash'

export interface Email {
  id: string
  from: string
  fromEmail: string
  /** true quando o remetente está na lista de contatos importantes (VIP) */
  vip: boolean
  subject: string
  preview: string
  body: string
  /** ISO string */
  date: string
  read: boolean
  starred: boolean
  hasAttachment: boolean
  /** endereçado diretamente ao usuário (não é lista/newsletter) */
  directed: boolean
  folder: Folder
  /** categoria de origem, usada para organização e ícones */
  category: EmailCategory
  /** ids de etiquetas personalizadas atribuídas (manual ou por regra) */
  labels: string[]
}

export type EmailCategory =
  | 'trabalho'
  | 'financeiro'
  | 'pessoal'
  | 'social'
  | 'promocoes'
  | 'atualizacoes'

/** Resultado da análise de relevância de um e-mail. */
export interface ScoredEmail extends Email {
  score: number
  relevance: Relevance
  /** motivos legíveis que explicam a pontuação */
  reasons: string[]
  /** origem da análise: heurística local ou IA (Claude) */
  source: 'local' | 'ai'
  /** resumo em uma frase gerado pela IA (quando disponível) */
  summary?: string
}

/** Uma etiqueta personalizada para organização. */
export interface Label {
  id: string
  name: string
  color: string
}

export type RuleField = 'from' | 'subject' | 'body' | 'category'
export type RuleAction = 'label' | 'folder' | 'star'

/** Regra de organização automática: se `field` contém `value`, aplica a ação. */
export interface Rule {
  id: string
  name: string
  field: RuleField
  value: string
  action: RuleAction
  /** id da etiqueta (action=label) ou pasta (action=folder) */
  target: string
  enabled: boolean
}
