import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')

const PORT = process.env.PORT || 8787
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-8'

const app = express()
app.use(express.json({ limit: '4mb' }))

// Cliente Anthropic (lê ANTHROPIC_API_KEY do ambiente).
const hasKey = !!process.env.ANTHROPIC_API_KEY
const client = hasKey ? new Anthropic() : null

/**
 * Esquema de saída estruturada: garante que a Claude devolva um JSON válido
 * com a análise de relevância de cada e-mail.
 */
const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          score: { type: 'integer' },
          relevance: { type: 'string', enum: ['alta', 'media', 'baixa'] },
          reasons: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
        },
        required: ['id', 'score', 'relevance', 'reasons', 'summary'],
        additionalProperties: false,
      },
    },
  },
  required: ['results'],
  additionalProperties: false,
}

const SYSTEM = `Você é um assistente de triagem de e-mails. Avalie a relevância de cada e-mail para uma pessoa ocupada, considerando: urgência, prazos, remetente, se pede uma ação, valor financeiro, e se é apenas promoção/newsletter.

Para cada e-mail retorne:
- score: inteiro de 0 a 100 (quão relevante/prioritário é).
- relevance: "alta" (>= 70), "media" (45-69) ou "baixa" (< 45), coerente com o score.
- reasons: 2 a 4 motivos curtos, em português, que explicam a pontuação.
- summary: uma frase curta em português resumindo o e-mail e a ação sugerida.

Responda apenas com o JSON no formato pedido. Não invente e-mails; use exatamente os ids recebidos.`

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ai: hasKey, model: MODEL })
})

app.post('/api/classify', async (req, res) => {
  if (!client) {
    return res.status(503).json({
      error: 'IA indisponível: defina ANTHROPIC_API_KEY no servidor.',
    })
  }

  const emails = Array.isArray(req.body?.emails) ? req.body.emails : []
  if (emails.length === 0) {
    return res.status(400).json({ error: 'Nenhum e-mail enviado.' })
  }

  // Enxuga o payload para o modelo (limita o corpo para controlar tokens).
  const compact = emails.slice(0, 40).map((e) => ({
    id: String(e.id),
    from: String(e.from || ''),
    fromEmail: String(e.fromEmail || ''),
    vip: !!e.vip,
    directed: !!e.directed,
    hasAttachment: !!e.hasAttachment,
    category: String(e.category || ''),
    subject: String(e.subject || '').slice(0, 300),
    body: String(e.body || '').slice(0, 1500),
  }))

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: RESULT_SCHEMA },
      },
      messages: [
        {
          role: 'user',
          content: `Classifique estes e-mails e devolva o JSON:\n\n${JSON.stringify(compact, null, 2)}`,
        },
      ],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock) throw new Error('Resposta sem conteúdo de texto.')
    const parsed = JSON.parse(textBlock.text)
    res.json(parsed)
  } catch (err) {
    console.error('Erro ao classificar:', err)
    const status = err?.status && Number.isInteger(err.status) ? err.status : 500
    res.status(status).json({ error: err?.message || 'Falha na classificação por IA.' })
  }
})

// Serve o build de produção, se existir.
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST))
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')))
} else {
  app.get('/', (_req, res) =>
    res
      .type('text')
      .send('API em execução. Rode `npm run build` para servir o app, ou use `npm run dev:all` em desenvolvimento.'),
  )
}

app.listen(PORT, () => {
  console.log(`▶ API de triagem em http://localhost:${PORT}`)
  console.log(`  IA (Claude): ${hasKey ? `ativada (${MODEL})` : 'desativada — defina ANTHROPIC_API_KEY'}`)
})
