import { useState } from 'react'
import { Copy, Check, Loader2, CheckCircle2, XCircle, Terminal, Shield, Send } from 'lucide-react'
import { JwtInspector, hasJWTs } from './JwtInspector'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { xml } from '@codemirror/lang-xml'
import { html } from '@codemirror/lang-html'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import type { ResponseData, ScriptResult } from '../types'

function statusColor(status: number) {
  if (status === 0) return 'text-red-400'
  if (status < 300) return 'text-emerald-400'
  if (status < 400) return 'text-blue-400'
  if (status < 500) return 'text-amber-400'
  return 'text-red-400'
}

function statusBg(status: number) {
  if (status === 0) return 'bg-red-500/10 border-red-500/30'
  if (status < 300) return 'bg-emerald-500/10 border-emerald-500/30'
  if (status < 400) return 'bg-blue-500/10 border-blue-500/30'
  if (status < 500) return 'bg-amber-500/10 border-amber-500/30'
  return 'bg-red-500/10 border-red-500/30'
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatTime(ms: number) {
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function detectLanguage(headers: Record<string, string>, body: string) {
  const ct = Object.entries(headers).find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? ''
  if (ct.includes('json') || body.trimStart().startsWith('{') || body.trimStart().startsWith('[')) return 'json'
  if (ct.includes('xml')) return 'xml'
  if (ct.includes('html')) return 'html'
  return 'text'
}

function prettyBody(body: string, lang: string): string {
  if (lang === 'json') {
    try { return JSON.stringify(JSON.parse(body), null, 2) } catch {}
  }
  return body
}

function ScriptLogs({ result, label }: { result: ScriptResult; label: string }) {
  if (!result) return null
  const hasContent = (result.logs?.length ?? 0) > 0 || (result.tests?.length ?? 0) > 0 || result.error
  if (!hasContent) return null

  return (
    <div className="border-t border-zinc-800">
      <div className="px-4 py-2 flex items-center gap-2">
        <Terminal size={11} className="text-zinc-500" />
        <span className="text-xs font-medium text-zinc-500">{label}</span>
        {result.tests && result.tests.length > 0 && (
          <span className={`text-xs ml-auto ${result.tests.every(t => t.passed) ? 'text-emerald-400' : 'text-red-400'}`}>
            {result.tests.filter(t => t.passed).length}/{result.tests.length} passed
          </span>
        )}
      </div>

      {result.error && (
        <div className="mx-4 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-xs font-mono text-red-300 whitespace-pre-wrap">
          {result.error}
        </div>
      )}

      {result.logs && result.logs.length > 0 && (
        <div className="mx-4 mb-2">
          {result.logs.map((log, i) => (
            <div key={i} className="text-xs font-mono text-zinc-400 py-0.5">
              <span className="text-zinc-600 mr-2">›</span>{log}
            </div>
          ))}
        </div>
      )}

      {result.tests && result.tests.length > 0 && (
        <div className="mx-4 mb-3 space-y-1">
          {result.tests.map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {t.passed
                ? <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                : <XCircle size={13} className="text-red-400 flex-shrink-0" />}
              <span className={t.passed ? 'text-zinc-300' : 'text-red-300'}>{t.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  response: ResponseData | null
  loading: boolean
  onSendToDecoder?: (text: string) => void
}

type Tab = 'request' | 'body' | 'headers' | 'tests' | 'jwt' | 'raw_response'

export function ResponsePane({ response, loading, onSendToDecoder }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('body')
  const [copied, setCopied] = useState(false)

  const handleSendToDecoder = () => {
    const sel = window.getSelection()?.toString().trim()
    if (sel && onSendToDecoder) onSendToDecoder(sel)
  }

  const handleCopy = async () => {
    if (!response) return
    const content =
      activeTab === 'request' ? (response.raw_request ?? '') :
      activeTab === 'raw_response' ? (response.raw_response ?? '') :
      activeTab === 'headers' ? Object.entries(response.headers).map(([k, v]) => `${k}: ${v}`).join('\n') :
      response.body
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tabCls = (tab: Tab) =>
    `px-3.5 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
      activeTab === tab
        ? 'text-violet-400 border-b-2 border-violet-500'
        : 'text-zinc-500 hover:text-zinc-300'
    }`

  const lang = response ? detectLanguage(response.headers, response.body) : 'text'
  const displayBody = response ? prettyBody(response.body, lang) : ''
  const langExt = lang === 'json' ? [json()] : lang === 'xml' ? [xml()] : lang === 'html' ? [html()] : []

  const allTests = [
    ...(response?.pre_script_result?.tests ?? []),
    ...(response?.post_script_result?.tests ?? []),
  ]
  const hasTests = allTests.length > 0
  const jwtDetected = hasJWTs(response)
  const hasScriptOutput =
    (response?.pre_script_result?.logs?.length ?? 0) > 0 ||
    response?.pre_script_result?.error ||
    (response?.post_script_result?.logs?.length ?? 0) > 0 ||
    response?.post_script_result?.error

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden">
      {/* Status bar */}
      {response && !loading && (
        <div className="flex items-center gap-4 px-4 py-2.5 border-b border-zinc-800 flex-shrink-0 bg-zinc-900/50">
          <span className={`px-2.5 py-1 text-xs font-mono font-bold rounded-md border ${statusBg(response.status)} ${statusColor(response.status)}`}>
            {response.status > 0 ? `${response.status} ${response.statusText}` : 'Error'}
          </span>
          {response.status > 0 && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-600 text-xs">Time</span>
                <span className="text-xs font-mono text-zinc-300">{formatTime(response.duration)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-600 text-xs">Size</span>
                <span className="text-xs font-mono text-zinc-300">{formatSize(response.size)}</span>
              </div>
            </>
          )}
          {response.error && (
            <span className="text-xs text-red-400 font-mono truncate">{response.error}</span>
          )}
          {hasTests && (
            <span className={`ml-1 text-xs font-mono font-medium px-2 py-0.5 rounded border ${
              allTests.every(t => t.passed)
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                : 'text-red-400 bg-red-500/10 border-red-500/30'
            }`}>
              {allTests.filter(t => t.passed).length}/{allTests.length} tests
            </span>
          )}
        </div>
      )}

      {/* Tabs */}
      {response && !loading && (
        <div className="flex items-center border-b border-zinc-800 px-1 flex-shrink-0">
          <button className={tabCls('request')} onClick={() => setActiveTab('request')}>Request</button>
          <button className={tabCls('body')} onClick={() => setActiveTab('body')}>Body</button>
          <button className={tabCls('headers')} onClick={() => setActiveTab('headers')}>
            Headers
            <span className="ml-1 text-zinc-600 text-xs">({Object.keys(response.headers).length})</span>
          </button>
          {hasTests && (
            <button className={tabCls('tests')} onClick={() => setActiveTab('tests')}>
              Tests
              <span className={`ml-1.5 text-xs ${allTests.every(t => t.passed) ? 'text-emerald-400' : 'text-red-400'}`}>
                {allTests.filter(t => t.passed).length}/{allTests.length}
              </span>
            </button>
          )}
          {jwtDetected && (
            <button className={tabCls('jwt')} onClick={() => setActiveTab('jwt')}>
              <Shield size={11} className="text-amber-400" />
              JWT
            </button>
          )}
          <button className={tabCls('raw_response')} onClick={() => setActiveTab('raw_response')}>Raw Response</button>
          <div className="ml-auto flex items-center gap-1 pr-2">
            {onSendToDecoder && (
              <button
                onClick={handleSendToDecoder}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-cyan-400 transition-colors px-1.5 py-1 rounded hover:bg-cyan-500/10"
                title="Send selection to Decoder"
              >
                <span className="font-mono text-[10px]">{'</>'}</span>
                Decode
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-1.5 py-1"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {loading && (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-zinc-500">
            <Loader2 size={24} className="animate-spin text-violet-500" />
            <span className="text-sm">Sending request...</span>
          </div>
        )}

        {!loading && !response && (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-zinc-600 select-none">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center">
                <Send size={28} className="text-zinc-600" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                <span className="text-violet-400 text-xs font-bold leading-none">→</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-400">Send a request</p>
              <p className="text-xs mt-1 text-zinc-600">Enter a URL above and press Send or ↵</p>
            </div>
          </div>
        )}

        {!loading && response && (
          <>
            {/* Request tab */}
            {activeTab === 'request' && (
              <div className="flex-1 overflow-auto">
                {response.raw_request ? (
                  <CodeMirror
                    value={response.raw_request}
                    theme={oneDark}
                    extensions={[EditorView.editable.of(false)]}
                    height="100%"
                    basicSetup={{ lineNumbers: true, syntaxHighlighting: false }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                    Raw request not available
                  </div>
                )}
              </div>
            )}

            {/* JWT tab */}
            {activeTab === 'jwt' && response && (
              <div className="flex-1 overflow-hidden">
                <JwtInspector response={response} />
              </div>
            )}

            {/* Raw Response tab */}
            {activeTab === 'raw_response' && (
              <div className="flex-1 overflow-auto">
                {response.raw_response ? (
                  <CodeMirror
                    value={response.raw_response}
                    theme={oneDark}
                    extensions={[EditorView.editable.of(false)]}
                    height="100%"
                    basicSetup={{ lineNumbers: true, syntaxHighlighting: false }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                    Raw response not available
                  </div>
                )}
              </div>
            )}

            {/* Body tab */}
            {activeTab === 'body' && (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-auto">
                  {response.body ? (
                    <CodeMirror
                      value={displayBody}
                      theme={oneDark}
                      extensions={[...langExt, EditorView.editable.of(false)]}
                      height="100%"
                      basicSetup={{ lineNumbers: true, foldGutter: true, syntaxHighlighting: true }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                      Empty response body
                    </div>
                  )}
                </div>

                {/* Script output inline below body */}
                {hasScriptOutput && (
                  <div className="flex-shrink-0 border-t border-zinc-800 overflow-y-auto max-h-40">
                    {response.pre_script_result && (
                      <ScriptLogs result={response.pre_script_result} label="Pre-request script" />
                    )}
                    {response.post_script_result && (
                      <ScriptLogs result={response.post_script_result} label="Post-response script" />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Headers tab */}
            {activeTab === 'headers' && (
              <div className="overflow-auto flex-1 p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                      <th className="text-left py-2 pr-4 font-medium w-2/5">Header</th>
                      <th className="text-left py-2 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(response.headers).map(([k, v]) => (
                      <tr key={k} className="border-b border-zinc-800/50">
                        <td className="py-2 pr-4 font-mono text-xs text-violet-400">{k}</td>
                        <td className="py-2 font-mono text-xs text-zinc-300 break-all">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tests tab */}
            {activeTab === 'tests' && hasTests && (
              <div className="flex-1 overflow-auto p-4">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-sm font-medium text-zinc-300">
                    {allTests.filter(t => t.passed).length} / {allTests.length} tests passed
                  </span>
                  <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${allTests.every(t => t.passed) ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{ width: `${(allTests.filter(t => t.passed).length / allTests.length) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  {allTests.map((t, i) => (
                    <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                      t.passed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'
                    }`}>
                      {t.passed
                        ? <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
                        : <XCircle size={15} className="text-red-400 flex-shrink-0" />}
                      <span className={`text-sm ${t.passed ? 'text-zinc-200' : 'text-red-300'}`}>{t.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
