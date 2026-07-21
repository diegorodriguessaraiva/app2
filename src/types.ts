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
}
