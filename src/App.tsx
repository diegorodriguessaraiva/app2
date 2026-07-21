import { useEffect, useMemo, useRef, useState } from 'react'
import { SEED_EMAILS } from './data'
import { scoreAndSort, RELEVANCE_META } from './relevance'
import type { Email, Folder, Label, Relevance, Rule, ScoredEmail } from './types'
import { EmailRow } from './components/EmailRow'
import { EmailDetail } from './components/EmailDetail'
import { SettingsSheet } from './components/SettingsSheet'
import { LockScreen } from './components/LockScreen'
import { isUnlocked, lockNow, pinEnabled, setPin, setPinEnabled } from './pin'
import {
  applyRulesToAll,
  loadLabels,
  loadRules,
  saveLabels,
  saveRules,
} from './rules'
import type { AiResult } from './ai'
import { classifyEmails, loadModel, webgpuSupported, type LoadProgress } from './webllm'
import {
  connectGmail,
  disconnectGmail,
  fetchInboxPage,
  gmailConfigured,
  isGmailConnected,
} from './gmail'

type RelevanceFilter = 'todos' | Relevance
type Tab = Folder | 'starred'

const STORAGE_KEY = 'triagem-emails-v2'

function loadEmails(): Email[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Email[]
  } catch {
    /* usa o seed */
  }
  // Primeira execução: já aplica as regras padrão ao seed (mostra etiquetas).
  return applyRulesToAll(SEED_EMAILS, loadRules())
}

const TAB_META: Record<Tab, { label: string; icon: string }> = {
  inbox: { label: 'Entrada', icon: '📥' },
  starred: { label: 'Favoritos', icon: '⭐️' },
  archived: { label: 'Arquivo', icon: '🗄️' },
  trash: { label: 'Lixeira', icon: '🗑️' },
}

export default function App() {
  const [emails, setEmails] = useState<Email[]>(loadEmails)
  const [tab, setTab] = useState<Tab>('inbox')
  const [filter, setFilter] = useState<RelevanceFilter>('todos')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [notifyOn, setNotifyOn] = useState(false)
  const [showBanner, setShowBanner] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [unlocked, setUnlocked] = useState(isUnlocked())
  const [pinOn, setPinOn] = useState(pinEnabled())
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  // Organização
  const [labels, setLabels] = useState<Label[]>(loadLabels)
  const [rules, setRules] = useState<Rule[]>(loadRules)

  // IA local (WebLLM — roda no navegador via WebGPU)
  const webgpuOk = useMemo(webgpuSupported, [])
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiResults, setAiResults] = useState<Map<string, AiResult>>(new Map())
  const [aiLoading, setAiLoading] = useState(false)
  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [modelProgress, setModelProgress] = useState<LoadProgress>({ text: '', progress: 0 })
  const engineRef = useRef<Awaited<ReturnType<typeof loadModel>> | null>(null)

  // Gmail
  const [gmailConnected, setGmailConnected] = useState(isGmailConnected())
  const [gmailBusy, setGmailBusy] = useState(false)
  const [mailCount, setMailCount] = useState<number>(() => {
    const v = Number(localStorage.getItem('triagem-mailcount'))
    return v === 50 || v === 100 || v === 20 ? v : 50
  })
  const [gmailPageToken, setGmailPageToken] = useState<string | null>(null)

  // Persistência
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(emails))
  }, [emails])
  useEffect(() => saveLabels(labels), [labels])
  useEffect(() => saveRules(rules), [rules])

  const flashToast = (msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2200)
  }

  // ---------- Pontuação (local ou IA) + ordenação decrescente ----------
  const scored: ScoredEmail[] = useMemo(() => {
    const base = scoreAndSort(emails)
    if (!aiEnabled || aiResults.size === 0) return base
    const merged = base.map((e) => {
      const r = aiResults.get(e.id)
      return r
        ? {
            ...e,
            score: r.score,
            relevance: r.relevance,
            reasons: r.reasons,
            summary: r.summary,
            source: 'ai' as const,
          }
        : e
    })
    merged.sort(
      (a, b) => b.score - a.score || +new Date(b.date) - +new Date(a.date),
    )
    return merged
  }, [emails, aiEnabled, aiResults])

  // ---------- IA local (WebLLM) ----------
  const ensureModel = async () => {
    if (engineRef.current) return engineRef.current
    setModelStatus('loading')
    try {
      const engine = await loadModel(setModelProgress)
      engineRef.current = engine
      setModelStatus('ready')
      return engine
    } catch (e) {
      setModelStatus('error')
      throw e
    }
  }

  const runAi = async (list: Email[]) => {
    if (!webgpuOk) {
      flashToast('Seu navegador não suporta WebGPU (use Chrome/Edge no desktop)')
      return
    }
    setAiLoading(true)
    try {
      const engine = await ensureModel()
      const inbox = list.filter((e) => e.folder === 'inbox')
      // Atualiza a interface a cada e-mail analisado.
      await classifyEmails(engine, inbox, (r) =>
        setAiResults((prev) => new Map(prev).set(r.id, r)),
      )
      flashToast('🧠 E-mails analisados pela IA local')
    } catch (e) {
      flashToast(e instanceof Error ? e.message : 'Falha ao rodar a IA local')
    } finally {
      setAiLoading(false)
    }
  }

  const toggleAi = (v: boolean) => {
    setAiEnabled(v)
    if (v && aiResults.size === 0) runAi(emails)
  }

  // ---------- Gmail ----------
  const refreshGmail = async (count = mailCount) => {
    setGmailBusy(true)
    try {
      const { emails: raw, nextPageToken } = await fetchInboxPage(count)
      const organized = applyRulesToAll(raw, rules)
      setEmails(organized)
      setGmailPageToken(nextPageToken)
      setGmailConnected(true)
      flashToast(`📧 ${organized.length} e-mails carregados`)
      if (aiEnabled) runAi(organized)
    } catch (e) {
      flashToast(e instanceof Error ? e.message : 'Erro ao ler o Gmail')
    } finally {
      setGmailBusy(false)
    }
  }

  const loadMoreGmail = async () => {
    if (!gmailPageToken || gmailBusy) return
    setGmailBusy(true)
    try {
      const { emails: raw, nextPageToken } = await fetchInboxPage(mailCount, gmailPageToken)
      const organizedNew = applyRulesToAll(raw, rules)
      setEmails((prev) => {
        const seen = new Set(prev.map((e) => e.id))
        return [...prev, ...organizedNew.filter((e) => !seen.has(e.id))]
      })
      setGmailPageToken(nextPageToken)
      flashToast(`➕ Mais ${organizedNew.length} e-mails`)
      if (aiEnabled) runAi(organizedNew)
    } catch (e) {
      flashToast(e instanceof Error ? e.message : 'Erro ao carregar mais')
    } finally {
      setGmailBusy(false)
    }
  }

  const onConnectGmail = async () => {
    setGmailBusy(true)
    try {
      await connectGmail()
      await refreshGmail()
    } catch (e) {
      flashToast(e instanceof Error ? e.message : 'Falha ao conectar o Gmail')
      setGmailBusy(false)
    }
  }

  const onDisconnectGmail = () => {
    disconnectGmail()
    setGmailConnected(false)
    setGmailPageToken(null)
    flashToast('Gmail desconectado')
  }

  const changeMailCount = (n: number) => {
    setMailCount(n)
    localStorage.setItem('triagem-mailcount', String(n))
    if (gmailConnected) refreshGmail(n)
  }

  const resetInbox = () => {
    setEmails(applyRulesToAll(SEED_EMAILS, rules))
    setAiResults(new Map())
    setGmailPageToken(null)
    flashToast('Caixa de exemplo restaurada')
  }

  const applyRulesNow = () => {
    setEmails((prev) => applyRulesToAll(prev, rules))
    flashToast('⚡ Regras aplicadas')
  }

  // ---------- PIN de acesso ----------
  const togglePin = (v: boolean) => {
    setPinEnabled(v)
    setPinOn(v)
    flashToast(v ? '🔒 Bloqueio por PIN ativado' : 'Bloqueio por PIN desativado')
  }
  const changePin = async (pin: string) => {
    await setPin(pin)
    flashToast('PIN alterado com sucesso')
  }
  const handleLockNow = () => {
    lockNow()
    setShowSettings(false)
    setUnlocked(false)
  }

  // ---------- Ações de organização ----------
  const patch = (id: string, changes: Partial<Email>) =>
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, ...changes } : e)))

  const openEmail = (id: string) => {
    patch(id, { read: true })
    setOpenId(id)
  }
  const toggleStar = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const email = emails.find((x) => x.id === id)
    patch(id, { starred: !email?.starred })
    flashToast(email?.starred ? 'Removido dos favoritos' : '⭐️ Adicionado aos favoritos')
  }
  const toggleRead = (id: string) => {
    const email = emails.find((x) => x.id === id)
    patch(id, { read: !email?.read })
    flashToast(email?.read ? 'Marcado como não lido' : 'Marcado como lido')
  }
  const moveTo = (id: string, folder: Folder, label: string) => {
    patch(id, { folder })
    setOpenId(null)
    flashToast(label)
  }
  const toggleLabel = (id: string, labelId: string) => {
    setEmails((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e
        const has = e.labels.includes(labelId)
        return {
          ...e,
          labels: has ? e.labels.filter((l) => l !== labelId) : [...e.labels, labelId],
        }
      }),
    )
  }

  // ---------- Notificações ----------
  const highPriorityUnread = useMemo(
    () => scored.filter((e) => e.folder === 'inbox' && e.relevance === 'alta' && !e.read),
    [scored],
  )

  const enableNotifications = async () => {
    if (!('Notification' in window)) {
      flashToast('Notificações não suportadas neste navegador')
      return
    }
    if (notifyOn) {
      setNotifyOn(false)
      flashToast('Notificações desativadas')
      return
    }
    const perm = await Notification.requestPermission()
    if (perm === 'granted') {
      setNotifyOn(true)
      flashToast('🔔 Notificações ativadas')
      if (highPriorityUnread.length > 0) {
        const top = highPriorityUnread[0]
        new Notification('Novo e-mail de alta relevância', {
          body: `${top.from}: ${top.subject}`,
          icon: '/mail.svg',
        })
      }
    } else {
      flashToast('Permissão de notificação negada')
    }
  }

  // ---------- Filtragem ----------
  const visible = useMemo(() => {
    let list = scored
    if (tab === 'starred') list = list.filter((e) => e.starred && e.folder !== 'trash')
    else list = list.filter((e) => e.folder === tab)
    if (filter !== 'todos') list = list.filter((e) => e.relevance === filter)
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (e) =>
          e.from.toLowerCase().includes(q) ||
          e.subject.toLowerCase().includes(q) ||
          e.body.toLowerCase().includes(q),
      )
    }
    return list
  }, [scored, tab, filter, query])

  const folderList = useMemo(() => {
    if (tab === 'starred') return scored.filter((e) => e.starred && e.folder !== 'trash')
    return scored.filter((e) => e.folder === tab)
  }, [scored, tab])

  const counts = useMemo(
    () => ({
      todos: folderList.length,
      alta: folderList.filter((e) => e.relevance === 'alta').length,
      media: folderList.filter((e) => e.relevance === 'media').length,
      baixa: folderList.filter((e) => e.relevance === 'baixa').length,
    }),
    [folderList],
  )

  const inboxUnread = useMemo(
    () => scored.filter((e) => e.folder === 'inbox' && !e.read).length,
    [scored],
  )

  const openEmailObj = openId ? scored.find((e) => e.id === openId) ?? null : null

  const filterTabs: { key: RelevanceFilter; label: string; color?: string; count: number }[] = [
    { key: 'todos', label: 'Todos', count: counts.todos },
    { key: 'alta', label: 'Alta', color: RELEVANCE_META.alta.color, count: counts.alta },
    { key: 'media', label: 'Média', color: RELEVANCE_META.media.color, count: counts.media },
    { key: 'baixa', label: 'Baixa', color: RELEVANCE_META.baixa.color, count: counts.baixa },
  ]

  if (!unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <h1>{TAB_META[tab].label}</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            {aiEnabled && webgpuOk && (
              <button
                className="icon-btn"
                onClick={() => runAi(emails)}
                disabled={aiLoading}
                title="Reanalisar com IA"
                aria-label="Reanalisar com IA"
              >
                {aiLoading ? '…' : '🧠'}
              </button>
            )}
            <button
              className={`icon-btn ${notifyOn ? 'on' : ''}`}
              onClick={enableNotifications}
              title="Ativar notificações"
              aria-label="Ativar notificações"
            >
              {notifyOn ? '🔔' : '🔕'}
            </button>
            <button
              className="icon-btn"
              onClick={() => setShowSettings(true)}
              title="Configurações"
              aria-label="Configurações"
            >
              ⚙️
            </button>
          </div>
        </div>
        <div className="header-subtitle">
          {modelStatus === 'loading'
            ? `Baixando modelo de IA… ${Math.round(modelProgress.progress * 100)}%`
            : aiLoading
              ? 'Analisando com IA…'
              : `Triagem ${aiEnabled ? 'por IA' : 'inteligente'} · ${folderList.length} ${
                  folderList.length === 1 ? 'mensagem' : 'mensagens'
                }`}
        </div>

        <div className="search">
          <span className="mag">🔍</span>
          <input
            placeholder="Buscar remetente ou assunto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="segmented" role="tablist">
          {filterTabs.map((f) => (
            <button
              key={f.key}
              className={filter === f.key ? 'active' : ''}
              onClick={() => setFilter(f.key)}
            >
              {f.color && <span className="seg-dot" style={{ background: f.color }} />}
              {f.label}
              <span className="seg-count">{f.count}</span>
            </button>
          ))}
        </div>
      </header>

      {tab === 'inbox' && (
        <div className="stats">
          <div className="stat">
            <div className="num" style={{ color: RELEVANCE_META.alta.color }}>
              {counts.alta}
            </div>
            <div className="lbl">Alta</div>
          </div>
          <div className="stat">
            <div className="num" style={{ color: RELEVANCE_META.media.color }}>
              {counts.media}
            </div>
            <div className="lbl">Média</div>
          </div>
          <div className="stat">
            <div className="num" style={{ color: RELEVANCE_META.baixa.color }}>
              {counts.baixa}
            </div>
            <div className="lbl">Baixa</div>
          </div>
        </div>
      )}

      {tab === 'inbox' && showBanner && highPriorityUnread.length > 0 && (
        <div className="alert-banner" role="alert">
          <span className="bell">🔔</span>
          <div className="alert-text">
            <div className="alert-title">
              {highPriorityUnread.length}{' '}
              {highPriorityUnread.length === 1
                ? 'e-mail de alta relevância'
                : 'e-mails de alta relevância'}
            </div>
            <div className="alert-sub">
              {highPriorityUnread[0].from} · {highPriorityUnread[0].subject}
            </div>
          </div>
          <button className="alert-close" onClick={() => setShowBanner(false)} aria-label="Dispensar">
            ✕
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="empty">
          <div className="big">📭</div>
          <h3>Nada por aqui</h3>
          <p>
            {query ? 'Nenhum e-mail corresponde à busca.' : 'Nenhuma mensagem nesta seção.'}
          </p>
        </div>
      ) : (
        <>
          {filter === 'todos' && tab === 'inbox' && (
            <div className="section-title">
              <span className="dot" style={{ background: RELEVANCE_META.alta.color }} />
              Ordenado por relevância
            </div>
          )}
          <div className="list">
            {visible.map((e) => (
              <EmailRow
                key={e.id}
                email={e}
                labels={labels}
                onOpen={() => openEmail(e.id)}
                onToggleStar={(ev) => toggleStar(e.id, ev)}
              />
            ))}
          </div>
          {tab === 'inbox' && gmailConnected && gmailPageToken && (
            <button className="load-more" onClick={loadMoreGmail} disabled={gmailBusy}>
              {gmailBusy ? 'Carregando…' : `Carregar mais ${mailCount} e-mails`}
            </button>
          )}
        </>
      )}

      <nav className="tabbar">
        {(['inbox', 'starred', 'archived', 'trash'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => {
              setTab(t)
              setFilter('todos')
              setQuery('')
            }}
          >
            <span className="tab-ico">
              {TAB_META[t].icon}
              {t === 'inbox' && inboxUnread > 0 && (
                <span className="tab-badge">{inboxUnread}</span>
              )}
            </span>
            {TAB_META[t].label}
          </button>
        ))}
      </nav>

      {openEmailObj && (
        <EmailDetail
          email={openEmailObj}
          labels={labels}
          onClose={() => setOpenId(null)}
          onToggleStar={() => toggleStar(openEmailObj.id)}
          onToggleRead={() => {
            toggleRead(openEmailObj.id)
            setOpenId(null)
          }}
          onArchive={() => moveTo(openEmailObj.id, 'archived', '🗄️ E-mail arquivado')}
          onTrash={() => moveTo(openEmailObj.id, 'trash', '🗑️ Movido para a lixeira')}
          onToggleLabel={(labelId) => toggleLabel(openEmailObj.id, labelId)}
        />
      )}

      {showSettings && (
        <SettingsSheet
          onClose={() => setShowSettings(false)}
          webgpuOk={webgpuOk}
          aiEnabled={aiEnabled}
          onToggleAi={toggleAi}
          modelStatus={modelStatus}
          modelProgress={modelProgress.progress}
          gmailConfigured={gmailConfigured}
          gmailConnected={gmailConnected}
          gmailBusy={gmailBusy}
          onConnectGmail={onConnectGmail}
          onDisconnectGmail={onDisconnectGmail}
          onRefreshGmail={() => refreshGmail()}
          onResetInbox={resetInbox}
          mailCount={mailCount}
          onMailCountChange={changeMailCount}
          labels={labels}
          onLabelsChange={setLabels}
          rules={rules}
          onRulesChange={setRules}
          onApplyRules={applyRulesNow}
          pinOn={pinOn}
          onTogglePin={togglePin}
          onChangePin={changePin}
          onLockNow={handleLockNow}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
