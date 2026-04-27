import { useState, useEffect, useCallback, useRef } from 'react'
import type { HttpMethod, BodyType, KeyValue, Collection, Folder, Environment, HistoryItem, ResponseData, SavedRequest, ProxyConfig, RequestTab, AuthConfig, WsMessage } from './types'
import * as api from './api'
import { Sidebar } from './components/Sidebar'
import { RightPanel } from './components/RightPanel'
import { TabBar } from './components/TabBar'
import { RequestPane } from './components/RequestPane'
import { ResponsePane } from './components/ResponsePane'
import { EnvironmentModal } from './components/EnvironmentModal'
import { SaveModal } from './components/SaveModal'
import { ProxyModal } from './components/ProxyModal'
import { ImportModal } from './components/ImportModal'
import { VarsModal } from './components/VarsModal'
import { CollectionRunnerModal } from './components/CollectionRunnerModal'
import { Settings, Globe, PanelLeft, PanelRight } from 'lucide-react'
import { WsPane } from './components/WsPane'

const newKV = (): KeyValue => ({ id: crypto.randomUUID(), key: '', value: '', enabled: true })

const DEFAULT_PROXY: ProxyConfig = { enabled: false, url: '', bypass: '' }

function deriveTabName(url: string): string {
  if (!url.trim()) return 'New Request'
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length) return '/' + parts[parts.length - 1]
    return u.hostname || 'New Request'
  } catch {
    const parts = url.split('/').filter(s => s && !s.startsWith('{{'))
    if (parts.length > 1) return '/' + parts[parts.length - 1]
    return 'New Request'
  }
}

function newTab(): RequestTab {
  return {
    id: crypto.randomUUID(),
    name: 'New Request',
    isRenamed: false,
    method: 'GET',
    url: '',
    headers: [newKV()],
    params: [newKV()],
    body: '',
    bodyType: 'json',
    auth: { type: 'none' },
    preScript: '',
    postScript: '',
    response: null,
    loading: false,
    wsConnected: false,
    wsMessages: [],
  }
}

export default function App() {
  const initialTab = newTab()
  const [tabs, setTabs] = useState<RequestTab[]>([initialTab])
  const [activeTabId, setActiveTabId] = useState<string>(initialTab.id)

  // Global data
  const [collections, setCollections] = useState<Collection[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [activeEnvId, setActiveEnvId] = useState('')
  const [proxyConfig, setProxyConfig] = useState<ProxyConfig>(DEFAULT_PROXY)
  const [globalVars, setGlobalVars] = useState<KeyValue[]>([])

  // Modals
  const [showEnvModal, setShowEnvModal] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showProxyModal, setShowProxyModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showGlobalVarsModal, setShowGlobalVarsModal] = useState(false)
  const [collectionVarsTarget, setCollectionVarsTarget] = useState<Collection | null>(null)
  const [runnerTarget, setRunnerTarget] = useState<Collection | null>(null)

  // Panel visibility
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === '[' && !e.metaKey && !e.ctrlKey) setLeftOpen(o => !o)
      if (e.key === ']' && !e.metaKey && !e.ctrlKey) setRightOpen(o => !o)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Decoder
  const [decoderPayload, setDecoderPayload] = useState<{ text: string; key: string } | null>(null)

  const handleSendToDecoder = (text: string) => {
    setDecoderPayload({ text, key: crypto.randomUUID() })
    setRightOpen(true)
  }

  const handleDecoderSaveEnvVar = (varKey: string, value: string) => {
    if (!activeEnvId) return
    setEnvironments(prev => {
      const env = prev.find(e => e.id === activeEnvId)
      if (!env) return prev
      const existing = env.variables.findIndex(v => v.key === varKey)
      let newVars: KeyValue[]
      if (existing >= 0) {
        newVars = env.variables.map((v, i) => i === existing ? { ...v, value } : v)
      } else {
        newVars = [...env.variables, { id: crypto.randomUUID(), key: varKey, value, enabled: true }]
      }
      api.updateEnvironment(activeEnvId, env.name, newVars).catch(() => {})
      return prev.map(e => e.id === activeEnvId ? { ...e, variables: newVars } : e)
    })
  }

  useEffect(() => {
    Promise.all([
      api.getCollections(),
      api.getHistory(),
      api.getEnvironments(),
      api.getSettings(),
      api.getGlobalVars(),
    ]).then(([cols, hist, envs, settings, gVars]) => {
      setCollections(cols)
      setHistory(hist)
      setEnvironments(envs)
      setProxyConfig(settings.proxy ?? DEFAULT_PROXY)
      setGlobalVars(gVars)
    }).catch(() => {})
  }, [])

  // ── Active tab helpers ────────────────────────────────────────────────────────

  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0]

  const updateActiveTab = (partial: Partial<RequestTab>) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, ...partial } : t))
  }

  const { method, url, headers, params, body, bodyType, auth, preScript, postScript, response, loading, wsConnected, wsMessages } = activeTab

  const setMethod = (m: HttpMethod) => updateActiveTab({ method: m })

  const setUrl = (u: string) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t
      return { ...t, url: u, name: t.isRenamed ? t.name : deriveTabName(u) }
    }))
  }

  const setHeaders = (h: KeyValue[] | ((prev: KeyValue[]) => KeyValue[])) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t
      return { ...t, headers: typeof h === 'function' ? h(t.headers) : h }
    }))
  }

  const setParams = (p: KeyValue[] | ((prev: KeyValue[]) => KeyValue[])) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t
      return { ...t, params: typeof p === 'function' ? p(t.params) : p }
    }))
  }

  const setBody = (b: string) => updateActiveTab({ body: b })
  const setAuth = (a: AuthConfig) => updateActiveTab({ auth: a })
  const setPreScript = (s: string) => updateActiveTab({ preScript: s })
  const setPostScript = (s: string) => updateActiveTab({ postScript: s })

  const setResponse = (r: ResponseData | null) => updateActiveTab({ response: r })
  const setLoading = (l: boolean) => updateActiveTab({ loading: l })

  // ── Tab management ────────────────────────────────────────────────────────────

  const handleAddTab = () => {
    const tab = newTab()
    setTabs(prev => [...prev, tab])
    setActiveTabId(tab.id)
  }

  const handleCloseTab = (id: string) => {
    setTabs(prev => {
      if (prev.length === 1) {
        const fresh = newTab()
        setActiveTabId(fresh.id)
        return [fresh]
      }
      const next = prev.filter(t => t.id !== id)
      if (id === activeTabId) {
        const idx = prev.findIndex(t => t.id === id)
        setActiveTabId(next[Math.min(idx, next.length - 1)].id)
      }
      return next
    })
  }

  const handleRenameTab = (id: string, name: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, name, isRenamed: true } : t))
  }

  // ── Body type with auto Content-Type ─────────────────────────────────────────

  const BODY_TYPE_CT: Partial<Record<BodyType, string>> = {
    json: 'application/json',
    xml: 'application/xml',
    text: 'text/plain',
    urlencoded: 'application/x-www-form-urlencoded',
  }
  const AUTO_CTS = new Set(Object.values(BODY_TYPE_CT))

  const handleBodyTypeChange = (newType: BodyType) => {
    const ctIdx = headers.findIndex(h => h.key.toLowerCase() === 'content-type')
    const existingVal = ctIdx >= 0 ? headers[ctIdx].value : ''
    if (existingVal && !AUTO_CTS.has(existingVal)) {
      updateActiveTab({ bodyType: newType })
      return
    }
    const newCT = BODY_TYPE_CT[newType]
    let newHeaders: KeyValue[]
    if (!newCT) {
      newHeaders = ctIdx >= 0 ? headers.filter((_, i) => i !== ctIdx) : headers
    } else if (ctIdx >= 0) {
      newHeaders = headers.map((h, i) => i === ctIdx ? { ...h, value: newCT } : h)
    } else {
      newHeaders = [{ id: crypto.randomUUID(), key: 'Content-Type', value: newCT, enabled: true }, ...headers]
    }
    updateActiveTab({ bodyType: newType, headers: newHeaders })
  }

  // ── Variable resolution ───────────────────────────────────────────────────────

  const getEnvVars = useCallback((): Record<string, string> => {
    if (!activeEnvId) return {}
    const env = environments.find(e => e.id === activeEnvId)
    if (!env) return {}
    return Object.fromEntries(
      env.variables.filter(v => v.enabled && v.key).map(v => [v.key, v.value])
    )
  }, [activeEnvId, environments])

  const getGlobalVarsObj = useCallback((): Record<string, string> => {
    return Object.fromEntries(globalVars.filter(v => v.enabled && v.key).map(v => [v.key, v.value]))
  }, [globalVars])

  const getCollectionVars = useCallback((collectionId?: string): Record<string, string> => {
    if (!collectionId) return {}
    const col = collections.find(c => c.id === collectionId)
    if (!col) return {}
    return Object.fromEntries(
      (col.variables ?? []).filter(v => v.enabled && v.key).map(v => [v.key, v.value])
    )
  }, [collections])

  // ── Send ──────────────────────────────────────────────────────────────────────

  const buildAuthExtras = (a: AuthConfig): { headers: KeyValue[]; params: KeyValue[] } => {
    const mkKV = (key: string, value: string): KeyValue => ({ id: crypto.randomUUID(), key, value, enabled: true })
    switch (a.type) {
      case 'bearer':
        if (a.bearer) return { headers: [mkKV('Authorization', `Bearer ${a.bearer}`)], params: [] }
        break
      case 'basic':
        if (a.basic?.username) {
          const creds = btoa(`${a.basic.username}:${a.basic.password ?? ''}`)
          return { headers: [mkKV('Authorization', `Basic ${creds}`)], params: [] }
        }
        break
      case 'api-key':
        if (a.apiKey?.key && a.apiKey?.value) {
          return a.apiKey.in === 'header'
            ? { headers: [mkKV(a.apiKey.key, a.apiKey.value)], params: [] }
            : { headers: [], params: [mkKV(a.apiKey.key, a.apiKey.value)] }
        }
        break
    }
    return { headers: [], params: [] }
  }

  // WebSocket handlers
  const wsRef = useRef<WebSocket | null>(null)

  const handleWsConnect = () => {
    const wsUrl = url.trim()
    if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) return
    const proxyUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws-proxy?url=${encodeURIComponent(wsUrl)}`
    const ws = new WebSocket(proxyUrl)
    wsRef.current = ws

    const addMsg = (dir: 'sent' | 'received', data: string) => {
      const msg: WsMessage = { id: crypto.randomUUID(), dir, data, ts: Date.now() }
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, wsMessages: [...t.wsMessages, msg] } : t))
    }

    ws.onopen = () => setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, wsConnected: true } : t))
    ws.onmessage = e => {
      try {
        const ctrl = JSON.parse(e.data)
        if (ctrl.__type === 'connected') { return }
        if (ctrl.__type === 'disconnected') {
          setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, wsConnected: false } : t))
          return
        }
        if (ctrl.__type === 'error') { addMsg('received', `[Error] ${ctrl.message}`); return }
      } catch {}
      addMsg('received', e.data)
    }
    ws.onclose = () => setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, wsConnected: false } : t))
    ws.onerror = () => {
      const msg: WsMessage = { id: crypto.randomUUID(), dir: 'received', data: '[Connection error]', ts: Date.now() }
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, wsMessages: [...t.wsMessages, msg], wsConnected: false } : t))
    }
  }

  const handleWsDisconnect = () => {
    wsRef.current?.close()
    wsRef.current = null
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, wsConnected: false } : t))
  }

  const handleWsSend = (msg: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(msg)
    const wsMsg: WsMessage = { id: crypto.randomUUID(), dir: 'sent', data: msg, ts: Date.now() }
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, wsMessages: [...t.wsMessages, wsMsg] } : t))
  }

  const handleWsClear = () => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, wsMessages: [] } : t))
  }

  const handleInjectPayloadToBody = (payload: string) => updateActiveTab({ body: payload })
  const handleAddPayloadParam = (value: string) => {
    setParams(prev => {
      const existing = Array.isArray(prev) ? prev : []
      return [...existing.filter(p => p.key), { id: crypto.randomUUID(), key: 'payload', value, enabled: true }, newKV()]
    })
  }

  const runRequest = async (
    req: SavedRequest,
    envVars: Record<string, string>,
    gVars: Record<string, string>,
    cVars: Record<string, string>,
  ): Promise<ResponseData> => {
    return api.sendProxyRequest({
      method: req.method,
      url: req.url,
      headers: (req.headers ?? []).filter(h => h.enabled && h.key),
      params: (req.params ?? []).filter(p => p.enabled && p.key),
      body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? '' : (req.body ?? ''),
      body_type: req.body_type,
      environment_variables: envVars,
      global_variables: gVars,
      collection_variables: cVars,
      pre_script: req.pre_script ?? '',
      post_script: req.post_script ?? '',
    })
  }

  const handleSend = async () => {
    if (!url.trim()) return
    const sendTabId = activeTabId
    setTabs(prev => prev.map(t => t.id === sendTabId ? { ...t, loading: true, response: null } : t))
    const authExtras = buildAuthExtras(auth)
    try {
      const result = await api.sendProxyRequest({
        method,
        url: url.trim(),
        headers: [...headers, ...authExtras.headers].filter(h => h.enabled && h.key),
        params: [...params, ...authExtras.params].filter(p => p.enabled && p.key),
        body: ['GET', 'HEAD', 'OPTIONS'].includes(method) ? '' : body,
        body_type: bodyType,
        environment_variables: getEnvVars(),
        global_variables: getGlobalVarsObj(),
        collection_variables: getCollectionVars(activeTab.sourceCollectionId),
        pre_script: preScript,
        post_script: postScript,
      })
      setTabs(prev => prev.map(t => t.id === sendTabId ? { ...t, response: result, loading: false } : t))
      api.getHistory().then(setHistory).catch(() => {})

      const scriptEnv = result.post_script_result?.env
      if (activeEnvId && scriptEnv) {
        const originalVars = getEnvVars()
        const changed = Object.entries(scriptEnv).filter(([k, v]) => originalVars[k] !== v)
        if (changed.length > 0) {
          setEnvironments(prev => {
            const currentEnv = prev.find(e => e.id === activeEnvId)
            if (!currentEnv) return prev
            let newVars = [...currentEnv.variables]
            for (const [k, v] of changed) {
              const idx = newVars.findIndex(vr => vr.key === k)
              if (idx >= 0) {
                newVars[idx] = { ...newVars[idx], value: v }
              } else {
                newVars.push({ id: crypto.randomUUID(), key: k, value: v, enabled: true })
              }
            }
            api.updateEnvironment(activeEnvId, currentEnv.name, newVars).catch(() => {})
            return prev.map(e => e.id === activeEnvId ? { ...e, variables: newVars } : e)
          })
        }
      }
    } catch (err: any) {
      const errResponse: ResponseData = {
        status: 0, statusText: 'Error', headers: {}, body: '',
        duration: 0, size: 0, error: err.response?.data?.error ?? err.message,
        raw_request: '', pre_script_result: { logs: [], tests: [] }, post_script_result: { logs: [], tests: [] },
      }
      setTabs(prev => prev.map(t => t.id === sendTabId ? { ...t, response: errResponse, loading: false } : t))
    }
  }

  // ── Load request ──────────────────────────────────────────────────────────────

  const loadRequest = (req: SavedRequest | HistoryItem) => {
    const name = 'name' in req && req.name ? req.name : deriveTabName(req.url)
    const restoredResponse: ResponseData | null = 'response_body' in req && req.status
      ? {
          status: req.status, statusText: '', headers: req.response_headers ?? {},
          body: req.response_body ?? '', duration: req.duration ?? 0, size: req.size ?? 0,
          raw_request: req.raw_request, raw_response: req.raw_response,
          pre_script_result: { logs: [], tests: [] }, post_script_result: { logs: [], tests: [] },
        }
      : null

    const sourceCollectionId = 'collection_id' in req ? req.collection_id : undefined

    updateActiveTab({
      name,
      isRenamed: false,
      method: req.method,
      url: req.url,
      headers: req.headers?.length ? req.headers.map(h => ({ ...h, id: h.id || crypto.randomUUID() })) : [newKV()],
      params: req.params?.length ? req.params.map(p => ({ ...p, id: p.id || crypto.randomUUID() })) : [newKV()],
      body: req.body ?? '',
      bodyType: (req.body_type as BodyType) ?? 'json',
      preScript: ('pre_script' in req ? req.pre_script : '') ?? '',
      postScript: ('post_script' in req ? req.post_script : '') ?? '',
      response: restoredResponse,
      sourceCollectionId,
    })
  }

  // ── Collection ops ────────────────────────────────────────────────────────────

  const handleCreateCollection = async (name: string, description: string): Promise<Collection> => {
    const col = await api.createCollection(name, description)
    setCollections(prev => [...prev, col])
    return col
  }

  const handleDeleteCollection = async (id: string) => {
    await api.deleteCollection(id)
    setCollections(prev => prev.filter(c => c.id !== id))
  }

  const handleUpdateCollectionVars = async (col: Collection, variables: KeyValue[]) => {
    await api.updateCollection(col.id, col.name, col.description, variables)
    setCollections(prev => prev.map(c => c.id === col.id ? { ...c, variables } : c))
  }

  const handleSaveRequest = async (collectionId: string, folderId: string | null, name: string) => {
    const saved = await api.saveRequest({
      collection_id: collectionId,
      folder_id: folderId,
      name,
      method,
      url,
      headers: headers.filter(h => h.key),
      params: params.filter(p => p.key),
      body,
      body_type: bodyType,
      pre_script: preScript,
      post_script: postScript,
    })
    setCollections(prev =>
      prev.map(c => {
        if (c.id !== collectionId) return c
        if (!folderId) return { ...c, requests: [...c.requests, saved] }
        const addToFolder = (folders: Folder[]): Folder[] =>
          folders.map(f => {
            if (f.id === folderId) return { ...f, requests: [...f.requests, saved] }
            return { ...f, subfolders: addToFolder(f.subfolders) }
          })
        return { ...c, folders: addToFolder(c.folders) }
      })
    )
  }

  const handleDeleteRequest = async (id: string, collectionId: string) => {
    await api.deleteRequest(id)
    setCollections(prev =>
      prev.map(c => {
        if (c.id !== collectionId) return c
        const removeFromFolders = (folders: Folder[]): Folder[] =>
          folders.map(f => ({
            ...f,
            requests: f.requests.filter(r => r.id !== id),
            subfolders: removeFromFolders(f.subfolders),
          }))
        return {
          ...c,
          requests: c.requests.filter(r => r.id !== id),
          folders: removeFromFolders(c.folders),
        }
      })
    )
  }

  const handleCreateFolder = async (data: { collection_id: string; parent_folder_id?: string | null; name: string }): Promise<Folder> => {
    const folder = await api.createFolder(data)
    setCollections(prev =>
      prev.map(c => {
        if (c.id !== data.collection_id) return c
        if (!data.parent_folder_id) {
          return { ...c, folders: [...c.folders, { ...folder, requests: [], subfolders: [] }] }
        }
        const addSubfolder = (folders: Folder[]): Folder[] =>
          folders.map(f => {
            if (f.id === data.parent_folder_id) return { ...f, subfolders: [...f.subfolders, { ...folder, requests: [], subfolders: [] }] }
            return { ...f, subfolders: addSubfolder(f.subfolders) }
          })
        return { ...c, folders: addSubfolder(c.folders) }
      })
    )
    return { ...folder, requests: [], subfolders: [] }
  }

  const handleDeleteFolder = async (id: string, collectionId: string) => {
    await api.deleteFolder(id)
    setCollections(prev =>
      prev.map(c => {
        if (c.id !== collectionId) return c
        const removeFolder = (folders: Folder[]): Folder[] =>
          folders.filter(f => f.id !== id).map(f => ({ ...f, subfolders: removeFolder(f.subfolders) }))
        return { ...c, folders: removeFolder(c.folders) }
      })
    )
  }

  const handleExportCollection = async (col: Collection) => {
    const data = await api.exportCollection(col.id)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${col.name.replace(/\s+/g, '_')}.postman_collection.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleClearHistory = async () => {
    await api.clearHistory()
    setHistory([])
  }

  const handleRenameHistory = async (id: string, name: string) => {
    await api.renameHistoryItem(id, name)
    setHistory(prev => prev.map(h => h.id === id ? { ...h, name } : h))
  }

  // ── Environment ops ───────────────────────────────────────────────────────────

  const handleCreateEnvironment = async (name: string, variables: KeyValue[]) => {
    const env = await api.createEnvironment(name, variables)
    setEnvironments(prev => [...prev, env])
  }

  const handleUpdateEnvironment = async (id: string, name: string, variables: KeyValue[]) => {
    await api.updateEnvironment(id, name, variables)
    setEnvironments(prev => prev.map(e => e.id === id ? { ...e, name, variables } : e))
  }

  const handleDeleteEnvironment = async (id: string) => {
    await api.deleteEnvironment(id)
    setEnvironments(prev => prev.filter(e => e.id !== id))
    if (activeEnvId === id) setActiveEnvId('')
  }

  // ── Global vars ops ───────────────────────────────────────────────────────────

  const handleUpdateGlobalVars = async (variables: KeyValue[]) => {
    await api.updateGlobalVars(variables)
    setGlobalVars(variables)
  }

  // ── Proxy ops ─────────────────────────────────────────────────────────────────

  const handleSaveProxy = async (config: ProxyConfig) => {
    await api.updateSettings({ proxy: config })
    setProxyConfig(config)
  }

  const handleToggleProxy = async () => {
    const updated = { ...proxyConfig, enabled: !proxyConfig.enabled }
    await api.updateSettings({ proxy: updated })
    setProxyConfig(updated)
  }

  const activeEnvName = environments.find(e => e.id === activeEnvId)?.name

  // ── Resizable split ───────────────────────────────────────────────────────────
  const [splitPct, setSplitPct] = useState(44)
  const draggingRef = useRef(false)
  const mainRef = useRef<HTMLDivElement>(null)

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = true
    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current || !mainRef.current) return
      const rect = mainRef.current.getBoundingClientRect()
      const pct = ((ev.clientY - rect.top) / rect.height) * 100
      setSplitPct(Math.min(Math.max(pct, 20), 78))
    }
    const onUp = () => {
      draggingRef.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  void setLoading; void setResponse; void setBody; void setParams

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setLeftOpen(o => !o)}
            className={`p-1.5 rounded transition-colors ${leftOpen ? 'text-violet-400 bg-violet-500/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
            title="Toggle sidebar ([)"
          >
            <PanelLeft size={15} />
          </button>
          <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-violet-900/40">
            <span className="text-white font-bold text-sm leading-none">D</span>
          </div>
          <span className="font-semibold text-zinc-100 tracking-tight">Dispatch</span>
          <span className="text-zinc-700 text-xs hidden sm:block">HTTP Client</span>
        </div>

        <div className="flex items-center gap-2">
          {proxyConfig.url && (
            <button
              onClick={handleToggleProxy}
              onContextMenu={e => { e.preventDefault(); setShowProxyModal(true) }}
              className={`flex items-center gap-1.5 text-xs rounded px-2 py-0.5 transition-colors ${
                proxyConfig.enabled
                  ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20'
                  : 'text-zinc-500 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700'
              }`}
              title={proxyConfig.enabled ? `Proxy on: ${proxyConfig.url} — click to disable` : `Proxy off: ${proxyConfig.url} — click to enable`}
            >
              <Globe size={11} />
              {proxyConfig.enabled ? 'Proxy on' : 'Proxy off'}
            </button>
          )}

          {/* Global vars button */}
          <button
            onClick={() => setShowGlobalVarsModal(true)}
            className={`flex items-center gap-1.5 text-xs rounded px-2 py-0.5 border transition-colors ${
              globalVars.some(v => v.enabled && v.key)
                ? 'text-sky-400 bg-sky-500/10 border-sky-500/20 hover:bg-sky-500/20'
                : 'text-zinc-500 bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
            }`}
            title="Global variables"
          >
            <span className="font-mono text-[10px]">{'{}'}</span>
            Globals
          </button>

          {activeEnvId && (
            <button
              onClick={() => setShowEnvModal(true)}
              className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5 hover:bg-emerald-500/20 transition-colors"
              title="Edit active environment"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              {activeEnvName}
            </button>
          )}

          <div className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5">
            <span className="text-xs text-zinc-500">ENV</span>
            <select
              value={activeEnvId}
              onChange={e => setActiveEnvId(e.target.value)}
              className="bg-transparent text-sm text-zinc-300 focus:outline-none cursor-pointer pr-1"
            >
              <option value="">None</option>
              {environments.map(env => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowEnvModal(true)}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
            title="Manage environments"
          >
            <Settings size={15} />
          </button>

          <button
            onClick={() => setShowProxyModal(true)}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
            title="Proxy settings"
          >
            <Globe size={15} />
          </button>
          <button
            onClick={() => setRightOpen(o => !o)}
            className={`p-1.5 rounded transition-colors ${rightOpen ? 'text-violet-400 bg-violet-500/10' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
            title="Toggle tools panel (])"
          >
            <PanelRight size={15} />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={leftOpen}
          collections={collections}
          history={history}
          onLoadRequest={loadRequest}
          onCreateCollection={handleCreateCollection}
          onDeleteCollection={handleDeleteCollection}
          onDeleteRequest={handleDeleteRequest}
          onClearHistory={handleClearHistory}
          onRenameHistory={handleRenameHistory}
          onImport={() => setShowImportModal(true)}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          onEditCollectionVars={col => setCollectionVarsTarget(col)}
          onRunCollection={col => setRunnerTarget(col)}
          onExportCollection={handleExportCollection}
        />

        <main ref={mainRef} className="flex flex-col flex-1 overflow-hidden">
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSelect={setActiveTabId}
            onAdd={handleAddTab}
            onClose={handleCloseTab}
            onRename={handleRenameTab}
          />

          {(url.startsWith('ws://') || url.startsWith('wss://')) ? (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center gap-2 p-3 border-b border-zinc-800 flex-shrink-0">
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="wss://echo.websocket.org"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 min-w-0"
                />
              </div>
              <WsPane
                url={url}
                connected={wsConnected}
                messages={wsMessages}
                onConnect={handleWsConnect}
                onDisconnect={handleWsDisconnect}
                onSend={handleWsSend}
                onClear={handleWsClear}
              />
            </div>
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div style={{ height: `${splitPct}%`, minHeight: 200 }} className="flex-shrink-0 overflow-hidden">
                <RequestPane
                  method={method}
                  url={url}
                  headers={headers}
                  params={params}
                  body={body}
                  bodyType={bodyType}
                  auth={auth}
                  preScript={preScript}
                  postScript={postScript}
                  loading={loading}
                  onMethodChange={setMethod}
                  onUrlChange={setUrl}
                  onHeadersChange={setHeaders}
                  onParamsChange={setParams}
                  onBodyChange={setBody}
                  onBodyTypeChange={handleBodyTypeChange}
                  onAuthChange={setAuth}
                  onPreScriptChange={setPreScript}
                  onPostScriptChange={setPostScript}
                  onSend={handleSend}
                  onSave={() => setShowSaveModal(true)}
                />
              </div>
              {/* Drag handle */}
              <div
                onMouseDown={handleDragStart}
                className="flex-shrink-0 h-1.5 bg-zinc-800 hover:bg-violet-600/50 cursor-row-resize transition-colors group relative"
              >
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
                  <div className="w-8 h-0.5 rounded-full bg-zinc-700 group-hover:bg-violet-500 transition-colors" />
                </div>
              </div>
              <div className="flex flex-col flex-1 overflow-hidden">
                <ResponsePane response={response} loading={loading} onSendToDecoder={handleSendToDecoder} />
              </div>
            </div>
          )}
        </main>

        <RightPanel
          isOpen={rightOpen}
          decoderPayload={decoderPayload}
          onInjectBody={body => updateActiveTab({ body })}
          onAddParam={handleAddPayloadParam}
          onSaveEnvVar={handleDecoderSaveEnvVar}
        />
      </div>

      {showEnvModal && (
        <EnvironmentModal
          environments={environments}
          initialId={activeEnvId || environments[0]?.id || null}
          onClose={() => setShowEnvModal(false)}
          onCreate={handleCreateEnvironment}
          onUpdate={handleUpdateEnvironment}
          onDelete={handleDeleteEnvironment}
        />
      )}

      {showSaveModal && (
        <SaveModal
          collections={collections}
          onClose={() => setShowSaveModal(false)}
          onSave={handleSaveRequest}
          onCreateCollection={handleCreateCollection}
        />
      )}

      {showProxyModal && (
        <ProxyModal
          initial={proxyConfig}
          onClose={() => setShowProxyModal(false)}
          onSave={handleSaveProxy}
        />
      )}

      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImport={col => setCollections(prev => [...prev, col])}
        />
      )}

      {showGlobalVarsModal && (
        <VarsModal
          title="Global Variables"
          variables={globalVars}
          onClose={() => setShowGlobalVarsModal(false)}
          onSave={handleUpdateGlobalVars}
        />
      )}

      {collectionVarsTarget && (
        <VarsModal
          title={`Variables — ${collectionVarsTarget.name}`}
          variables={collectionVarsTarget.variables ?? []}
          onClose={() => setCollectionVarsTarget(null)}
          onSave={vars => handleUpdateCollectionVars(collectionVarsTarget, vars)}
        />
      )}

      {runnerTarget && (
        <CollectionRunnerModal
          collections={collections}
          onClose={() => setRunnerTarget(null)}
          onRun={runRequest}
          globalVars={globalVars}
          environmentVars={getEnvVars()}
        />
      )}
    </div>
  )
}
