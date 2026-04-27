import { useState } from 'react'
import { Send, Save, Loader2, Braces, Zap } from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { xml } from '@codemirror/lang-xml'
import { python } from '@codemirror/lang-python'
import { oneDark } from '@codemirror/theme-one-dark'
import type { HttpMethod, BodyType, KeyValue, AuthConfig } from '../types'
import { KeyValueEditor } from './KeyValueEditor'
import { AuthPane } from './AuthPane'

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: '#4ade80', POST: '#60a5fa', PUT: '#fb923c',
  PATCH: '#facc15', DELETE: '#f87171', HEAD: '#c084fc', OPTIONS: '#22d3ee',
}

const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'text', label: 'Text' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'form-data', label: 'Form Data' },
  { value: 'urlencoded', label: 'URL Encoded' },
]

const PRE_SCRIPT_TEMPLATE = `# Pre-request script — runs before the request is sent
# Available: request (dict), env (dict)
# Helpers: log(msg), set_header(key, value), remove_header(key), set_var(key, value)

# Example: inject auth header from environment
# set_header("Authorization", "Bearer " + env.get("TOKEN", ""))
# log("Pre-script ran")
`

const POST_SCRIPT_TEMPLATE = `# Post-response script — runs after the response is received
# Available: request (dict), response (dict), env (dict)
# Helpers: log(msg), test(name, condition)
# response keys: status, status_text, headers (dict), body (str), duration, size

# Example assertions
# test("Status is 200", response["status"] == 200)
# test("Fast response", response["duration"] < 1000)
# log(f"Got {response['status']} in {response['duration']}ms")
`

interface Props {
  method: HttpMethod
  url: string
  headers: KeyValue[]
  params: KeyValue[]
  body: string
  bodyType: BodyType
  auth: AuthConfig
  preScript: string
  postScript: string
  loading: boolean
  onMethodChange: (m: HttpMethod) => void
  onUrlChange: (u: string) => void
  onHeadersChange: (h: KeyValue[]) => void
  onParamsChange: (p: KeyValue[]) => void
  onBodyChange: (b: string) => void
  onBodyTypeChange: (t: BodyType) => void
  onAuthChange: (a: AuthConfig) => void
  onPreScriptChange: (s: string) => void
  onPostScriptChange: (s: string) => void
  onSend: () => void
  onSave: () => void
}

type Tab = 'params' | 'headers' | 'body' | 'auth' | 'scripts'
type ScriptTab = 'pre' | 'post'
type GqlTab = 'query' | 'variables' | 'payloads'

export function RequestPane(props: Props) {
  const {
    method, url, headers, params, body, bodyType, auth, preScript, postScript, loading,
    onMethodChange, onUrlChange, onHeadersChange, onParamsChange,
    onBodyChange, onBodyTypeChange, onAuthChange, onPreScriptChange, onPostScriptChange,
    onSend, onSave,
  } = props

  const [activeTab, setActiveTab] = useState<Tab>('params')
  const [scriptTab, setScriptTab] = useState<ScriptTab>('pre')
  const [gqlTab, setGqlTab] = useState<GqlTab>('query')

  const hasParams = params.some(p => p.key)
  const hasHeaders = headers.some(h => h.key)
  const hasBody = body.trim().length > 0
  const hasScripts = preScript.trim().length > 0 || postScript.trim().length > 0
  const hasAuth = auth.type !== 'none'
  const showBodyEditor = !['GET', 'HEAD', 'OPTIONS'].includes(method)

  const formatJSON = () => {
    try { onBodyChange(JSON.stringify(JSON.parse(body), null, 2)) } catch {}
  }

  const bodyLanguage = bodyType === 'json' ? json() : bodyType === 'xml' ? xml() : undefined

  // GraphQL body helpers — stored as JSON {query, variables}
  const parseGql = () => {
    try { const p = JSON.parse(body); return { query: p.query ?? '', vars: JSON.stringify(p.variables ?? {}, null, 2) } } catch {}
    return { query: body, vars: '{}' }
  }
  const updateGql = (query: string, vars: string) => {
    try { onBodyChange(JSON.stringify({ query, variables: JSON.parse(vars) })) }
    catch { onBodyChange(JSON.stringify({ query, variables: {} })) }
  }

  // GraphQL offensive payloads from library
  const gqlPayloads = (() => {
    try {
      // Inline list to avoid circular import
      return [
        { label: "Full introspection", value: `query IntrospectionQuery { __schema { queryType { name } types { kind name fields(includeDeprecated: true) { name args { name type { name kind } } type { name kind } } } } }` },
        { label: "__schema types", value: "{ __schema { types { name kind } } }" },
        { label: "Query fields", value: '{ __type(name: "Query") { fields { name type { name kind } } } }' },
        { label: "All users dump", value: "{ users { id email role password token } }" },
        { label: "IDOR enum", value: "{ user(id: 2) { id email role } }" },
        { label: "Alias batch", value: "{ a:user(id:1){email} b:user(id:2){email} c:user(id:3){email} }" },
        { label: "Field suggestion probe", value: "{ usr { id } }" },
        { label: "Fragment DoS", value: "fragment a on Query { ...b } fragment b on Query { ...a } { ...a }" },
      ]
    } catch { return [] }
  })()

  const tabCls = (tab: Tab) =>
    `px-3.5 py-2.5 text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
      activeTab === tab
        ? 'text-violet-400 border-b-2 border-violet-500'
        : 'text-zinc-500 hover:text-zinc-300'
    }`

  const dot = (show: boolean) =>
    show ? <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block flex-shrink-0" /> : null

  return (
    <div className="flex flex-col h-full border-b border-zinc-800">
      {/* URL bar */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800 flex-shrink-0">
        <select
          value={method}
          onChange={e => onMethodChange(e.target.value as HttpMethod)}
          style={{ color: METHOD_COLORS[method] }}
          className="bg-zinc-800 border border-zinc-700 rounded px-2.5 py-2 text-sm font-mono font-bold focus:outline-none focus:border-violet-500 cursor-pointer flex-shrink-0"
        >
          {METHODS.map(m => (
            <option key={m} value={m} style={{ color: METHOD_COLORS[m] }}>{m}</option>
          ))}
        </select>

        <input
          value={url}
          onChange={e => onUrlChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSend()}
          placeholder="https://api.example.com/endpoint  —  use {{VARIABLE}} for env vars"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 min-w-0"
        />

        <button
          onClick={onSave}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded transition-colors flex-shrink-0"
        >
          <Save size={14} />
          Save
        </button>

        <button
          onClick={onSend}
          disabled={loading || !url.trim()}
          className="flex items-center gap-1.5 px-5 py-2 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-medium transition-colors flex-shrink-0 shadow-lg shadow-violet-900/30"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Send
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex items-center border-b border-zinc-800 px-1 overflow-x-auto flex-shrink-0">
        <button className={tabCls('params')} onClick={() => setActiveTab('params')}>
          Params {dot(hasParams)}
        </button>
        <button className={tabCls('headers')} onClick={() => setActiveTab('headers')}>
          Headers {dot(hasHeaders)}
        </button>
        {showBodyEditor && (
          <button className={tabCls('body')} onClick={() => setActiveTab('body')}>
            Body {dot(hasBody)}
          </button>
        )}
        <button className={tabCls('auth')} onClick={() => setActiveTab('auth')}>
          Auth {hasAuth ? <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block flex-shrink-0" /> : null}
        </button>
        <button className={tabCls('scripts')} onClick={() => setActiveTab('scripts')}>
          Scripts {dot(hasScripts)}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'params' && (
          <KeyValueEditor
            rows={params}
            onChange={onParamsChange}
            placeholder={{ key: 'param', value: 'value' }}
            showDescription
          />
        )}

        {activeTab === 'headers' && (
          <KeyValueEditor
            rows={headers}
            onChange={onHeadersChange}
            placeholder={{ key: 'Header', value: 'Value' }}
          />
        )}

        {activeTab === 'body' && showBodyEditor && (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 px-3 py-2 border-b border-zinc-800 flex-shrink-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {BODY_TYPES.map(bt => (
                  <button
                    key={bt.value}
                    onClick={() => onBodyTypeChange(bt.value)}
                    className={`px-2.5 py-1 text-xs rounded transition-colors ${
                      bodyType === bt.value
                        ? 'bg-violet-600/20 text-violet-400 border border-violet-600/50'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {bt.label}
                  </button>
                ))}
              </div>
              {bodyType === 'json' && (
                <button
                  onClick={formatJSON}
                  className="ml-auto flex items-center gap-1 text-xs text-zinc-500 hover:text-violet-400 transition-colors"
                >
                  <Braces size={11} />
                  Format
                </button>
              )}
            </div>

            <div className="flex-1 overflow-auto">
              {bodyType === 'none' ? (
                <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                  No body
                </div>
              ) : bodyType === 'form-data' || bodyType === 'urlencoded' ? (
                <KeyValueEditor
                  rows={(() => {
                    const empty = () => [{ id: crypto.randomUUID(), key: '', value: '', enabled: true }]
                    if (!body.trim()) return empty()
                    // Already a KeyValue[] JSON array (stored by form/urlencoded editor)
                    try {
                      const parsed = JSON.parse(body)
                      if (Array.isArray(parsed)) return parsed.length ? parsed : empty()
                      // JSON object — flatten to pairs
                      if (parsed && typeof parsed === 'object') {
                        const pairs = Object.entries(parsed).map(([k, v]) => ({
                          id: crypto.randomUUID(), key: k, value: String(v), enabled: true,
                        }))
                        return pairs.length ? pairs : empty()
                      }
                    } catch {}
                    // Urlencoded string: key=value&key2=value2
                    try {
                      const pairs = body.split('&').flatMap(pair => {
                        const eq = pair.indexOf('=')
                        const k = decodeURIComponent(eq >= 0 ? pair.slice(0, eq) : pair).trim()
                        const v = eq >= 0 ? decodeURIComponent(pair.slice(eq + 1)) : ''
                        return k ? [{ id: crypto.randomUUID(), key: k, value: v, enabled: true }] : []
                      })
                      return pairs.length ? pairs : empty()
                    } catch {}
                    return empty()
                  })()}
                  onChange={rows => onBodyChange(JSON.stringify(rows))}
                  placeholder={{ key: 'field', value: 'value' }}
                />
              ) : bodyType === 'graphql' ? (
                <div className="flex flex-col h-full">
                  {/* GraphQL sub-tabs */}
                  <div className="flex items-center border-b border-zinc-800 px-2 flex-shrink-0">
                    {(['query', 'variables', 'payloads'] as GqlTab[]).map(t => (
                      <button
                        key={t}
                        onClick={() => setGqlTab(t)}
                        className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                          gqlTab === t ? 'text-violet-400 border-b-2 border-violet-500' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {t === 'payloads' ? <span className="flex items-center gap-1"><Zap size={10} />Payloads</span> : t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 overflow-auto">
                    {gqlTab === 'query' && (
                      <CodeMirror
                        value={parseGql().query}
                        onChange={q => updateGql(q, parseGql().vars)}
                        theme={oneDark}
                        extensions={[json()]}
                        height="100%"
                        basicSetup={{ lineNumbers: true, foldGutter: true, syntaxHighlighting: true }}
                      />
                    )}
                    {gqlTab === 'variables' && (
                      <CodeMirror
                        value={parseGql().vars}
                        onChange={v => updateGql(parseGql().query, v)}
                        theme={oneDark}
                        extensions={[json()]}
                        height="100%"
                        basicSetup={{ lineNumbers: true, foldGutter: true, syntaxHighlighting: true }}
                      />
                    )}
                    {gqlTab === 'payloads' && (
                      <div className="p-3 flex flex-col gap-1.5 overflow-auto">
                        <p className="text-xs text-zinc-600 mb-1">Click to load into Query editor</p>
                        {gqlPayloads.map((p, i) => (
                          <button
                            key={i}
                            onClick={() => { updateGql(p.value, parseGql().vars); setGqlTab('query') }}
                            className="text-left px-3 py-2 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 hover:border-cyan-600/50 transition-colors"
                          >
                            <span className="text-cyan-400 font-medium">{p.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <CodeMirror
                  value={body}
                  onChange={onBodyChange}
                  theme={oneDark}
                  extensions={bodyLanguage ? [bodyLanguage] : []}
                  height="100%"
                  basicSetup={{ lineNumbers: true, foldGutter: true, syntaxHighlighting: true }}
                />
              )}
            </div>
          </div>
        )}

        {activeTab === 'auth' && (
          <AuthPane auth={auth} onChange={onAuthChange} />
        )}

        {activeTab === 'scripts' && (
          <div className="flex flex-col h-full">
            {/* Script sub-tabs */}
            <div className="flex items-center border-b border-zinc-800 px-3 flex-shrink-0">
              <button
                onClick={() => setScriptTab('pre')}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  scriptTab === 'pre'
                    ? 'text-violet-400 border-b-2 border-violet-500'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Pre-request
                {preScript.trim() && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />}
              </button>
              <button
                onClick={() => setScriptTab('post')}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  scriptTab === 'post'
                    ? 'text-violet-400 border-b-2 border-violet-500'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Post-response
                {postScript.trim() && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />}
              </button>
              <div className="ml-auto flex items-center gap-1 py-1.5">
                <span className="text-xs text-zinc-600">Python 3</span>
              </div>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-auto">
              {scriptTab === 'pre' ? (
                <CodeMirror
                  value={preScript || PRE_SCRIPT_TEMPLATE}
                  onChange={val => onPreScriptChange(val === PRE_SCRIPT_TEMPLATE ? '' : val)}
                  theme={oneDark}
                  extensions={[python()]}
                  height="100%"
                  basicSetup={{ lineNumbers: true, foldGutter: true, syntaxHighlighting: true }}
                />
              ) : (
                <CodeMirror
                  value={postScript || POST_SCRIPT_TEMPLATE}
                  onChange={val => onPostScriptChange(val === POST_SCRIPT_TEMPLATE ? '' : val)}
                  theme={oneDark}
                  extensions={[python()]}
                  height="100%"
                  basicSetup={{ lineNumbers: true, foldGutter: true, syntaxHighlighting: true }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
