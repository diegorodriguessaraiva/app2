import { useEffect, useState } from 'react'
import type { Label, Rule, RuleAction, RuleField } from '../types'
import { LABEL_COLORS } from '../rules'

interface Props {
  onClose: () => void
  // IA local (WebLLM)
  webgpuOk: boolean
  aiEnabled: boolean
  onToggleAi: (v: boolean) => void
  modelStatus: 'idle' | 'loading' | 'ready' | 'error'
  modelProgress: number
  // Gmail
  gmailConfigured: boolean
  gmailConnected: boolean
  gmailBusy: boolean
  onConnectGmail: () => void
  onDisconnectGmail: () => void
  onRefreshGmail: () => void
  onResetInbox: () => void
  mailCount: number
  onMailCountChange: (n: number) => void
  // Organização
  labels: Label[]
  onLabelsChange: (labels: Label[]) => void
  rules: Rule[]
  onRulesChange: (rules: Rule[]) => void
  onApplyRules: () => void
  // Segurança
  pinOn: boolean
  onTogglePin: (v: boolean) => void
  onChangePin: (pin: string) => void
  onLockNow: () => void
}

const FIELD_LABEL: Record<RuleField, string> = {
  from: 'Remetente',
  subject: 'Assunto',
  body: 'Conteúdo',
  category: 'Categoria',
}
const ACTION_LABEL: Record<RuleAction, string> = {
  label: 'Aplicar etiqueta',
  folder: 'Mover para',
  star: 'Favoritar',
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={`toggle ${on ? 'on' : ''}`}
      onClick={() => onChange(!on)}
      aria-pressed={on}
    >
      <span className="knob" />
    </button>
  )
}

export function SettingsSheet(props: Props) {
  const {
    onClose,
    webgpuOk,
    aiEnabled,
    onToggleAi,
    modelStatus,
    modelProgress,
    gmailConfigured,
    gmailConnected,
    gmailBusy,
    onConnectGmail,
    onDisconnectGmail,
    onRefreshGmail,
    onResetInbox,
    mailCount,
    onMailCountChange,
    labels,
    onLabelsChange,
    rules,
    onRulesChange,
    onApplyRules,
    pinOn,
    onTogglePin,
    onChangePin,
    onLockNow,
  } = props

  const [newPin, setNewPin] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState(LABEL_COLORS[5])

  const addLabel = () => {
    const name = newLabel.trim()
    if (!name) return
    onLabelsChange([
      ...labels,
      { id: `lbl-${Date.now()}`, name, color: newColor },
    ])
    setNewLabel('')
  }
  const removeLabel = (id: string) => {
    onLabelsChange(labels.filter((l) => l.id !== id))
    onRulesChange(rules.filter((r) => !(r.action === 'label' && r.target === id)))
  }

  // Nova regra
  const [rField, setRField] = useState<RuleField>('subject')
  const [rValue, setRValue] = useState('')
  const [rAction, setRAction] = useState<RuleAction>('label')
  const [rTarget, setRTarget] = useState(labels[0]?.id ?? '')

  const addRule = () => {
    const value = rValue.trim()
    if (rAction !== 'star' && !value) return
    const target =
      rAction === 'label' ? rTarget || labels[0]?.id || '' : rAction === 'folder' ? 'archived' : ''
    onRulesChange([
      ...rules,
      {
        id: `rule-${Date.now()}`,
        name: value ? `“${value}” → ${ACTION_LABEL[rAction]}` : ACTION_LABEL[rAction],
        field: rField,
        value,
        action: rAction,
        target,
        enabled: true,
      },
    ])
    setRValue('')
  }
  const toggleRule = (id: string) =>
    onRulesChange(rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)))
  const removeRule = (id: string) => onRulesChange(rules.filter((r) => r.id !== id))

  const labelName = (id: string) => labels.find((l) => l.id === id)?.name ?? '—'

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-grabber" />
        <div className="sheet-nav">
          <span style={{ fontWeight: 700, fontSize: 17 }}>Configurações</span>
          <button onClick={onClose}>OK</button>
        </div>

        <div className="sheet-body">
          {/* ---------- Gmail ---------- */}
          <div className="settings-section">Conta</div>
          <div className="settings-card">
            <div className="settings-row">
              <div>
                <div className="sr-title">📧 Gmail</div>
                <div className="sr-sub">
                  {!gmailConfigured
                    ? 'Defina VITE_GOOGLE_CLIENT_ID para habilitar'
                    : gmailConnected
                      ? 'Conectado'
                      : 'Ler seus e-mails reais (somente leitura)'}
                </div>
              </div>
              {gmailConnected ? (
                <button className="btn-secondary" onClick={onDisconnectGmail}>
                  Desconectar
                </button>
              ) : (
                <button
                  className="btn-primary"
                  disabled={!gmailConfigured || gmailBusy}
                  onClick={onConnectGmail}
                >
                  {gmailBusy ? '...' : 'Conectar'}
                </button>
              )}
            </div>
            {gmailConnected && (
              <div className="settings-row">
                <div className="sr-sub">Atualizar caixa de entrada</div>
                <button className="btn-secondary" onClick={onRefreshGmail} disabled={gmailBusy}>
                  {gmailBusy ? '...' : '↻ Atualizar'}
                </button>
              </div>
            )}
            <div className="settings-row">
              <div>
                <div className="sr-title" style={{ fontSize: 15 }}>
                  E-mails a carregar
                </div>
                <div className="sr-sub">Mais e-mails = um pouco mais lento</div>
              </div>
              <div className="count-seg">
                {[20, 50, 100].map((n) => (
                  <button
                    key={n}
                    className={mailCount === n ? 'active' : ''}
                    onClick={() => onMailCountChange(n)}
                    disabled={gmailBusy}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-row">
              <div className="sr-sub">Voltar aos e-mails de exemplo</div>
              <button className="btn-secondary" onClick={onResetInbox}>
                Restaurar
              </button>
            </div>
          </div>

          {/* ---------- IA local (WebLLM) ---------- */}
          <div className="settings-section">Inteligência artificial</div>
          <div className="settings-card">
            <div className="settings-row">
              <div>
                <div className="sr-title">🧠 Classificar com IA (no navegador)</div>
                <div className="sr-sub">
                  {!webgpuOk
                    ? 'Este navegador não suporta WebGPU'
                    : modelStatus === 'ready'
                      ? 'Modelo carregado — roda no seu dispositivo'
                      : modelStatus === 'loading'
                        ? `Baixando modelo… ${Math.round(modelProgress * 100)}%`
                        : 'Grátis e sem limite — roda no seu dispositivo'}
                </div>
              </div>
              <Toggle on={aiEnabled && webgpuOk} onChange={(v) => onToggleAi(v)} />
            </div>
            {modelStatus === 'loading' && (
              <div className="meter" style={{ margin: '4px 0 12px' }}>
                <div
                  className="meter-fill"
                  style={{ width: `${Math.round(modelProgress * 100)}%`, background: '#5856D6' }}
                />
              </div>
            )}
            <div className="sr-hint">
              {webgpuOk ? (
                <>
                  Um modelo de IA roda <b>inteiramente no seu navegador</b> — sem
                  chave, sem servidor, grátis e sem limite de uso. No primeiro uso
                  ele baixa o modelo (algumas centenas de MB, fica em cache). Depois,
                  cada e-mail é pontuado com motivos e um resumo.
                </>
              ) : (
                <>
                  Para usar a IA local, abra o app no <b>Chrome ou Edge atualizados
                  no computador</b> (requer WebGPU). Sem isso, a triagem local
                  continua funcionando normalmente.
                </>
              )}
            </div>
          </div>

          {/* ---------- Etiquetas ---------- */}
          <div className="settings-section">Etiquetas</div>
          <div className="settings-card">
            {labels.map((l) => (
              <div className="settings-row" key={l.id}>
                <div className="label-chip" style={{ background: `${l.color}22`, color: l.color }}>
                  <span className="dot" style={{ background: l.color }} />
                  {l.name}
                </div>
                <button className="link-danger" onClick={() => removeLabel(l.id)}>
                  Remover
                </button>
              </div>
            ))}
            <div className="add-row">
              <input
                className="field"
                placeholder="Nova etiqueta"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLabel()}
              />
              <button className="btn-primary" onClick={addLabel}>
                Adicionar
              </button>
            </div>
            <div className="color-row">
              {LABEL_COLORS.map((c) => (
                <button
                  key={c}
                  className={`color-dot ${newColor === c ? 'sel' : ''}`}
                  style={{ background: c }}
                  onClick={() => setNewColor(c)}
                  aria-label={`cor ${c}`}
                />
              ))}
            </div>
          </div>

          {/* ---------- Regras ---------- */}
          <div className="settings-section">Regras de organização automática</div>
          <div className="settings-card">
            {rules.length === 0 && <div className="sr-hint">Nenhuma regra ainda.</div>}
            {rules.map((r) => (
              <div className="settings-row" key={r.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="sr-title" style={{ fontSize: 15 }}>
                    {r.name}
                  </div>
                  <div className="sr-sub">
                    Se {FIELD_LABEL[r.field].toLowerCase()} contém “{r.value}” →{' '}
                    {r.action === 'label'
                      ? `etiqueta ${labelName(r.target)}`
                      : r.action === 'folder'
                        ? 'arquivar'
                        : 'favoritar'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Toggle on={r.enabled} onChange={() => toggleRule(r.id)} />
                  <button className="link-danger" onClick={() => removeRule(r.id)}>
                    ✕
                  </button>
                </div>
              </div>
            ))}

            <div className="rule-builder">
              <div className="rb-line">
                <span>Se</span>
                <select value={rField} onChange={(e) => setRField(e.target.value as RuleField)}>
                  {(Object.keys(FIELD_LABEL) as RuleField[]).map((f) => (
                    <option key={f} value={f}>
                      {FIELD_LABEL[f]}
                    </option>
                  ))}
                </select>
                <span>contém</span>
              </div>
              <input
                className="field"
                placeholder={rField === 'category' ? 'ex.: promocoes' : 'ex.: fatura'}
                value={rValue}
                onChange={(e) => setRValue(e.target.value)}
              />
              <div className="rb-line">
                <span>então</span>
                <select value={rAction} onChange={(e) => setRAction(e.target.value as RuleAction)}>
                  {(Object.keys(ACTION_LABEL) as RuleAction[]).map((a) => (
                    <option key={a} value={a}>
                      {ACTION_LABEL[a]}
                    </option>
                  ))}
                </select>
                {rAction === 'label' && (
                  <select value={rTarget} onChange={(e) => setRTarget(e.target.value)}>
                    {labels.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <button className="btn-primary full" onClick={addRule}>
                + Criar regra
              </button>
            </div>

            <button className="btn-secondary full" onClick={onApplyRules} style={{ marginTop: 10 }}>
              ⚡ Aplicar regras agora
            </button>
          </div>

          {/* ---------- Segurança ---------- */}
          <div className="settings-section">Segurança</div>
          <div className="settings-card">
            <div className="settings-row">
              <div>
                <div className="sr-title">🔒 Bloqueio por PIN</div>
                <div className="sr-sub">Pede um PIN para abrir o app</div>
              </div>
              <Toggle on={pinOn} onChange={onTogglePin} />
            </div>
            {pinOn && (
              <>
                <div className="add-row">
                  <input
                    className="field"
                    type="tel"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Novo PIN (6 dígitos)"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                  <button
                    className="btn-primary"
                    disabled={newPin.length !== 6}
                    onClick={() => {
                      onChangePin(newPin)
                      setNewPin('')
                    }}
                  >
                    Salvar
                  </button>
                </div>
                <button className="btn-secondary full" onClick={onLockNow} style={{ marginTop: 4 }}>
                  Bloquear agora
                </button>
              </>
            )}
            <div className="sr-hint">
              O app pede este PIN para abrir. É um obstáculo para acesso casual —
              num site que roda no navegador, não substitui a segurança da sua
              conta Google (ative a verificação em duas etapas).
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
