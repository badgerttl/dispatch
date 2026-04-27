import { useState, useRef } from 'react'
import { X, Play, Square, Check, AlertCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import type { Collection, SavedRequest, KeyValue, ResponseData } from '../types'

const METHOD_COLORS: Record<string, string> = {
  GET: '#4ade80', POST: '#60a5fa', PUT: '#fb923c',
  PATCH: '#facc15', DELETE: '#f87171', HEAD: '#c084fc', OPTIONS: '#22d3ee',
}

function flattenRequests(col: Collection): SavedRequest[] {
  const fromFolder = (folders: typeof col.folders): SavedRequest[] =>
    folders.flatMap(f => [...f.requests, ...fromFolder(f.subfolders)])
  return [...col.requests, ...fromFolder(col.folders)]
}

type RunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'error'

interface RequestResult {
  req: SavedRequest
  status: RunStatus
  response?: ResponseData
  error?: string
  duration?: number
  testsPassed?: number
  testsTotal?: number
}

interface Props {
  collections: Collection[]
  onClose: () => void
  onRun: (req: SavedRequest, envVars: Record<string, string>, globalVars: Record<string, string>, collectionVars: Record<string, string>) => Promise<ResponseData>
  globalVars: KeyValue[]
  environmentVars: Record<string, string>
}

export function CollectionRunnerModal({ collections, onClose, onRun, globalVars, environmentVars }: Props) {
  const [selectedColId, setSelectedColId] = useState(collections[0]?.id ?? '')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [results, setResults] = useState<RequestResult[]>([])
  const [running, setRunning] = useState(false)
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set())
  const abortRef = useRef(false)

  const selectedCol = collections.find(c => c.id === selectedColId)
  const allRequests = selectedCol ? flattenRequests(selectedCol) : []

  const toggleCheck = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => setChecked(new Set(allRequests.map(r => r.id)))
  const selectNone = () => setChecked(new Set())

  const handleColChange = (id: string) => {
    setSelectedColId(id)
    setChecked(new Set())
    setResults([])
  }

  const handleRun = async () => {
    const toRun = allRequests.filter(r => checked.has(r.id))
    if (!toRun.length) return

    abortRef.current = false
    setRunning(true)
    setResults(toRun.map(req => ({ req, status: 'pending' })))

    const gVars = Object.fromEntries(globalVars.filter(v => v.enabled && v.key).map(v => [v.key, v.value]))
    const cVars = Object.fromEntries(
      (selectedCol?.variables ?? []).filter(v => v.enabled && v.key).map(v => [v.key, v.value])
    )
    let chainedEnv: Record<string, string> = { ...environmentVars }

    for (let i = 0; i < toRun.length; i++) {
      if (abortRef.current) break
      const req = toRun[i]

      setResults(prev => prev.map(r => r.req.id === req.id ? { ...r, status: 'running' } : r))

      const start = Date.now()
      try {
        const res = await onRun(req, chainedEnv, gVars, cVars)
        const duration = Date.now() - start
        const tests = res.post_script_result?.tests ?? []
        const passed = tests.filter(t => t.passed).length
        const failed = tests.filter(t => !t.passed).length
        const status: RunStatus = res.error ? 'error' : failed > 0 ? 'failed' : 'passed'

        // Chain env: post-script env mutations carry forward
        if (res.post_script_result?.env) {
          chainedEnv = { ...chainedEnv, ...res.post_script_result.env }
        }

        setResults(prev => prev.map(r => r.req.id === req.id
          ? { ...r, status, response: res, duration, testsPassed: passed, testsTotal: tests.length }
          : r
        ))
      } catch (err: any) {
        setResults(prev => prev.map(r => r.req.id === req.id
          ? { ...r, status: 'error', error: err.message, duration: Date.now() - start }
          : r
        ))
      }
    }
    setRunning(false)
  }

  const handleStop = () => { abortRef.current = true }

  const toggleResultExpand = (id: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const statusIcon = (s: RunStatus) => {
    if (s === 'pending') return <div className="w-3 h-3 rounded-full border border-zinc-600" />
    if (s === 'running') return <Loader2 size={12} className="text-violet-400 animate-spin" />
    if (s === 'passed') return <Check size={12} className="text-emerald-400" />
    if (s === 'failed') return <AlertCircle size={12} className="text-amber-400" />
    return <AlertCircle size={12} className="text-red-400" />
  }

  const summary = results.length > 0 ? {
    passed: results.filter(r => r.status === 'passed').length,
    failed: results.filter(r => r.status === 'failed').length,
    error: results.filter(r => r.status === 'error').length,
    total: results.filter(r => r.status !== 'pending').length,
  } : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 flex-shrink-0">
          <h2 className="font-semibold text-zinc-100">Collection Runner</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X size={18} /></button>
        </div>

        <div className="flex flex-col gap-4 p-5 flex-shrink-0">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Collection</label>
            <select
              value={selectedColId}
              onChange={e => handleColChange(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
            >
              {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {allRequests.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-400">Requests</label>
                <div className="flex gap-3 text-xs text-zinc-500">
                  <button onClick={selectAll} className="hover:text-zinc-300 transition-colors">All</button>
                  <button onClick={selectNone} className="hover:text-zinc-300 transition-colors">None</button>
                </div>
              </div>
              <div className="bg-zinc-800 rounded border border-zinc-700 max-h-40 overflow-y-auto">
                {allRequests.map(req => (
                  <label key={req.id} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-zinc-700/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked.has(req.id)}
                      onChange={() => toggleCheck(req.id)}
                      className="accent-violet-500"
                    />
                    <span className="text-xs font-mono font-bold w-14 flex-shrink-0" style={{ color: METHOD_COLORS[req.method] ?? '#a1a1aa' }}>
                      {req.method}
                    </span>
                    <span className="text-xs text-zinc-300 truncate">{req.name}</span>
                    <span className="text-xs text-zinc-600 truncate ml-auto font-mono">{req.url}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="flex flex-col flex-1 overflow-hidden border-t border-zinc-800">
            {summary && (
              <div className="flex items-center gap-4 px-5 py-2.5 flex-shrink-0 text-xs">
                <span className="text-zinc-500">{summary.total}/{results.length} done</span>
                {summary.passed > 0 && <span className="text-emerald-400">{summary.passed} passed</span>}
                {summary.failed > 0 && <span className="text-amber-400">{summary.failed} failed</span>}
                {summary.error > 0 && <span className="text-red-400">{summary.error} errored</span>}
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              {results.map(r => (
                <div key={r.req.id} className="border-b border-zinc-800/50">
                  <button
                    className="w-full flex items-center gap-2 px-5 py-2.5 hover:bg-zinc-800/50 text-left"
                    onClick={() => r.status !== 'pending' && r.status !== 'running' && toggleResultExpand(r.req.id)}
                  >
                    {statusIcon(r.status)}
                    <span className="text-xs font-mono font-bold w-14 flex-shrink-0" style={{ color: METHOD_COLORS[r.req.method] ?? '#a1a1aa' }}>
                      {r.req.method}
                    </span>
                    <span className="flex-1 text-xs text-zinc-300 truncate">{r.req.name}</span>
                    {r.response && (
                      <span className={`text-xs font-mono ${r.response.status < 400 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {r.response.status}
                      </span>
                    )}
                    {r.duration !== undefined && <span className="text-xs text-zinc-600 ml-2">{r.duration}ms</span>}
                    {r.testsTotal !== undefined && r.testsTotal > 0 && (
                      <span className={`text-xs ml-2 ${r.testsPassed === r.testsTotal ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {r.testsPassed}/{r.testsTotal} tests
                      </span>
                    )}
                    {r.status !== 'pending' && r.status !== 'running' && (
                      expandedResults.has(r.req.id) ? <ChevronDown size={12} className="text-zinc-600 flex-shrink-0" /> : <ChevronRight size={12} className="text-zinc-600 flex-shrink-0" />
                    )}
                  </button>
                  {expandedResults.has(r.req.id) && r.response && (
                    <div className="px-5 pb-3">
                      {r.response.error && <div className="text-xs text-red-400 mb-2">{r.response.error}</div>}
                      {(r.response.post_script_result?.tests?.length ?? 0) > 0 && (
                        <div className="flex flex-col gap-1 mb-2">
                          {r.response.post_script_result!.tests!.map((t, i) => (
                            <div key={i} className={`flex items-center gap-2 text-xs ${t.passed ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {t.passed ? <Check size={11} /> : <AlertCircle size={11} />}
                              {t.name}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="bg-zinc-800 rounded p-2 text-xs font-mono text-zinc-400 max-h-32 overflow-y-auto whitespace-pre-wrap">
                        {r.response.body ? r.response.body.slice(0, 2000) : '(empty body)'}
                      </div>
                    </div>
                  )}
                  {expandedResults.has(r.req.id) && r.error && (
                    <div className="px-5 pb-3 text-xs text-red-400">{r.error}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-800 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
            Close
          </button>
          {running ? (
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-4 py-1.5 text-sm bg-red-600/80 hover:bg-red-600 text-white rounded font-medium transition-colors"
            >
              <Square size={13} /> Stop
            </button>
          ) : (
            <button
              onClick={handleRun}
              disabled={checked.size === 0}
              className="flex items-center gap-2 px-4 py-1.5 text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-medium transition-colors"
            >
              <Play size={13} /> Run {checked.size > 0 ? `(${checked.size})` : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
