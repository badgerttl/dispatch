import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { spawnSync, execFileSync } from 'child_process'
import { v4 as uuid } from 'uuid'
import { ProxyAgent } from 'undici'
import yaml from 'js-yaml'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { initDB, getDB } from './db.js'
import { detectFormat, importPostman, importOpenAPI3, importSwagger2 } from './importers.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001
const httpServer = createServer(app)

// Detect Python at startup — try explicit env var first, then common names
function findPython() {
  const candidates = [
    process.env.PYTHON_BIN,
    'python3', 'python', 'python3.12', 'python3.11', 'python3.10',
  ].filter(Boolean)
  for (const cmd of candidates) {
    try {
      execFileSync(cmd, ['--version'], { stdio: 'ignore', timeout: 3000 })
      return cmd
    } catch {}
  }
  return null
}
const PYTHON = findPython()
if (PYTHON) {
  console.log(`Python found: ${PYTHON}`)
} else {
  console.warn('Python not found — pre/post scripts will be disabled. Install python3 or set PYTHON_BIN.')
}

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.static(join(__dirname, 'public')))

initDB()

// ─── Script runner ────────────────────────────────────────────────────────────

const SCRIPT_WRAPPER = (userScript) => `
import json as _json
import sys as _sys

_ctx = _json.loads(_sys.stdin.read())
request = _ctx.get('request', {})
response = _ctx.get('response', {})
env = request.get('env_vars', {})

_logs = []
_tests = []

def log(msg):
    _logs.append(str(msg))

def test(name, condition):
    _tests.append({'name': str(name), 'passed': bool(condition)})

def set_header(key, value):
    request.setdefault('headers', [])
    request['headers'] = [h for h in request['headers'] if h.get('key','').lower() != key.lower()]
    request['headers'].append({'id': key, 'key': key, 'value': str(value), 'enabled': True})

def remove_header(key):
    request['headers'] = [h for h in request.get('headers', []) if h.get('key','').lower() != key.lower()]

def set_var(key, value):
    env[key] = str(value)

${userScript}

_sys.stdout.write(_json.dumps({
    'logs': _logs, 'tests': _tests,
    'request': request, 'response': response, 'env': env,
}))
`

function runScript(scriptCode, context, timeout = 30000) {
  if (!scriptCode || !scriptCode.trim()) return { logs: [], tests: [] }
  if (!PYTHON) return { logs: [], tests: [], error: 'Python not found on this system. Install python3 or set the PYTHON_BIN environment variable.' }

  const result = spawnSync(PYTHON, ['-c', SCRIPT_WRAPPER(scriptCode)], {
    input: JSON.stringify(context),
    encoding: 'utf8',
    timeout,
  })

  if (result.error) return { logs: [], tests: [], error: result.error.message }
  if (result.status !== 0) return { logs: [], tests: [], error: (result.stderr || 'Script failed').trim() }

  try {
    const out = JSON.parse(result.stdout)
    return { logs: out.logs || [], tests: out.tests || [], request: out.request, env: out.env }
  } catch {
    return { logs: [result.stdout.trim()].filter(Boolean), tests: [], error: 'Script output was not valid JSON' }
  }
}

// ─── Settings helper ──────────────────────────────────────────────────────────

function getSetting(key, defaultVal = null) {
  const row = getDB().prepare('SELECT value FROM settings WHERE key = ?').get(key)
  if (!row) return defaultVal
  try { return JSON.parse(row.value) } catch { return row.value }
}

function setSetting(key, value) {
  getDB().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value))
}

// ─── Collections ─────────────────────────────────────────────────────────────

function buildCollection(c, allRequests, allFolders) {
  const colRequests = allRequests.filter(r => r.collection_id === c.id)
    .map(r => ({ ...r, headers: JSON.parse(r.headers || '[]'), params: JSON.parse(r.params || '[]') }))
  const colFolders = allFolders.filter(f => f.collection_id === c.id)
  const buildFolder = (f) => ({
    ...f,
    requests: colRequests.filter(r => r.folder_id === f.id),
    subfolders: colFolders.filter(sf => sf.parent_folder_id === f.id).map(buildFolder),
  })
  return {
    ...c,
    variables: JSON.parse(c.variables || '[]'),
    folders: colFolders.filter(f => !f.parent_folder_id).map(buildFolder),
    requests: colRequests.filter(r => !r.folder_id),
  }
}

app.get('/api/collections', (req, res) => {
  const db = getDB()
  const collections = db.prepare('SELECT * FROM collections ORDER BY created_at ASC').all()
  const requests = db.prepare('SELECT * FROM requests').all()
  const folders = db.prepare('SELECT * FROM folders ORDER BY created_at ASC').all()
  res.json(collections.map(c => buildCollection(c, requests, folders)))
})

app.post('/api/collections', (req, res) => {
  const { name, description = '' } = req.body
  const id = uuid()
  const now = new Date().toISOString()
  getDB().prepare('INSERT INTO collections (id, name, description, variables, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, description, '[]', now)
  res.json({ id, name, description, variables: [], folders: [], requests: [], created_at: now })
})

app.put('/api/collections/:id', (req, res) => {
  const { name, description = '', variables = [] } = req.body
  getDB().prepare('UPDATE collections SET name = ?, description = ?, variables = ? WHERE id = ?')
    .run(name, description, JSON.stringify(variables), req.params.id)
  res.json({ success: true })
})

app.delete('/api/collections/:id', (req, res) => {
  const db = getDB()
  db.prepare('DELETE FROM requests WHERE collection_id = ?').run(req.params.id)
  db.prepare('DELETE FROM folders WHERE collection_id = ?').run(req.params.id)
  db.prepare('DELETE FROM collections WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

// ─── Folders ──────────────────────────────────────────────────────────────────

app.post('/api/folders', (req, res) => {
  const { collection_id, parent_folder_id = null, name } = req.body
  const id = uuid()
  const now = new Date().toISOString()
  getDB().prepare('INSERT INTO folders (id, collection_id, parent_folder_id, name, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, collection_id, parent_folder_id, name, now)
  res.json({ id, collection_id, parent_folder_id, name, requests: [], subfolders: [], created_at: now })
})

app.put('/api/folders/:id', (req, res) => {
  const { name } = req.body
  getDB().prepare('UPDATE folders SET name = ? WHERE id = ?').run(name, req.params.id)
  res.json({ success: true })
})

app.delete('/api/folders/:id', (req, res) => {
  const db = getDB()
  db.prepare('UPDATE requests SET folder_id = NULL WHERE folder_id = ?').run(req.params.id)
  db.prepare('DELETE FROM folders WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

app.patch('/api/requests/:id/move', (req, res) => {
  const { collection_id, folder_id = null } = req.body
  getDB().prepare('UPDATE requests SET collection_id = ?, folder_id = ? WHERE id = ?')
    .run(collection_id, folder_id, req.params.id)
  res.json({ success: true })
})

app.patch('/api/folders/:id/move', (req, res) => {
  const { collection_id, parent_folder_id = null } = req.body
  getDB().prepare('UPDATE folders SET collection_id = ?, parent_folder_id = ? WHERE id = ?')
    .run(collection_id, parent_folder_id, req.params.id)
  res.json({ success: true })
})

// ─── Collection export (Postman v2.1) ─────────────────────────────────────────

function toPostmanRequest(r) {
  let body = undefined
  if (r.body && r.body_type !== 'none') {
    const modeMap = { json: 'raw', xml: 'raw', text: 'raw', graphql: 'graphql', urlencoded: 'urlencoded', 'form-data': 'formdata' }
    const mode = modeMap[r.body_type] || 'raw'
    if (mode === 'raw') {
      body = { mode, raw: r.body, options: { raw: { language: r.body_type === 'xml' ? 'xml' : r.body_type === 'json' ? 'json' : 'text' } } }
    } else if (mode === 'urlencoded' || mode === 'formdata') {
      let items = []
      try { items = JSON.parse(r.body).map(kv => ({ key: kv.key, value: kv.value, disabled: !kv.enabled })) } catch {}
      body = { mode, [mode === 'formdata' ? 'formdata' : 'urlencoded']: items }
    } else if (mode === 'graphql') {
      try { body = { mode: 'graphql', graphql: JSON.parse(r.body) } } catch { body = { mode: 'raw', raw: r.body } }
    }
  }
  return {
    name: r.name,
    request: {
      method: r.method,
      header: (r.headers || []).filter(h => h.key && h.enabled !== false).map(h => ({ key: h.key, value: h.value })),
      url: { raw: r.url, host: [], path: [] },
      body,
    },
  }
}

app.get('/api/collections/:id/export', (req, res) => {
  const db = getDB()
  const col = db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id)
  if (!col) return res.status(404).json({ error: 'Not found' })
  const requests = db.prepare('SELECT * FROM requests WHERE collection_id = ?').all(req.params.id)
    .map(r => ({ ...r, headers: JSON.parse(r.headers || '[]'), params: JSON.parse(r.params || '[]') }))
  const folders = db.prepare('SELECT * FROM folders WHERE collection_id = ?').all(req.params.id)

  const buildFolderItem = (f) => ({
    name: f.name,
    item: requests.filter(r => r.folder_id === f.id).map(toPostmanRequest),
  })

  const postman = {
    info: {
      _postman_id: col.id,
      name: col.name,
      description: col.description || '',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: [
      ...folders.filter(f => !f.parent_folder_id).map(buildFolderItem),
      ...requests.filter(r => !r.folder_id).map(toPostmanRequest),
    ],
    variable: JSON.parse(col.variables || '[]').map(v => ({ key: v.key, value: v.value, enabled: v.enabled })),
  }
  res.setHeader('Content-Disposition', `attachment; filename="${col.name.replace(/[^a-z0-9]/gi, '_')}.postman_collection.json"`)
  res.json(postman)
})

// ─── Requests ────────────────────────────────────────────────────────────────

app.post('/api/requests', (req, res) => {
  const { collection_id, folder_id = null, name, method, url, headers = [], params = [], body = '', body_type = 'json', pre_script = '', post_script = '' } = req.body
  const id = uuid()
  const now = new Date().toISOString()
  getDB().prepare(`
    INSERT INTO requests (id, collection_id, folder_id, name, method, url, headers, params, body, body_type, pre_script, post_script, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, collection_id, folder_id, name, method, url, JSON.stringify(headers), JSON.stringify(params), body, body_type, pre_script, post_script, now)
  res.json({ id, collection_id, folder_id, name, method, url, headers, params, body, body_type, pre_script, post_script, created_at: now })
})

app.put('/api/requests/:id', (req, res) => {
  const { name, method, url, headers = [], params = [], body = '', body_type = 'json', pre_script = '', post_script = '' } = req.body
  getDB().prepare(`
    UPDATE requests SET name = ?, method = ?, url = ?, headers = ?, params = ?, body = ?, body_type = ?, pre_script = ?, post_script = ?
    WHERE id = ?
  `).run(name, method, url, JSON.stringify(headers), JSON.stringify(params), body, body_type, pre_script, post_script, req.params.id)
  res.json({ success: true })
})

app.delete('/api/requests/:id', (req, res) => {
  getDB().prepare('DELETE FROM requests WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

// ─── Environments ─────────────────────────────────────────────────────────────

app.get('/api/environments', (req, res) => {
  const envs = getDB().prepare('SELECT * FROM environments ORDER BY created_at ASC').all()
  res.json(envs.map(e => ({ ...e, variables: JSON.parse(e.variables) })))
})

app.post('/api/environments', (req, res) => {
  const { name, variables = [] } = req.body
  const id = uuid()
  const now = new Date().toISOString()
  getDB().prepare('INSERT INTO environments (id, name, variables, created_at) VALUES (?, ?, ?, ?)')
    .run(id, name, JSON.stringify(variables), now)
  res.json({ id, name, variables, created_at: now })
})

app.put('/api/environments/:id', (req, res) => {
  const { name, variables = [] } = req.body
  getDB().prepare('UPDATE environments SET name = ?, variables = ? WHERE id = ?')
    .run(name, JSON.stringify(variables), req.params.id)
  res.json({ success: true })
})

app.delete('/api/environments/:id', (req, res) => {
  getDB().prepare('DELETE FROM environments WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

// ─── History ──────────────────────────────────────────────────────────────────

app.get('/api/history', (req, res) => {
  const rows = getDB().prepare('SELECT * FROM history ORDER BY created_at DESC LIMIT 200').all()
  res.json(rows.map(r => ({
    ...r,
    headers: JSON.parse(r.headers),
    params: JSON.parse(r.params),
    response_headers: JSON.parse(r.response_headers || '{}'),
  })))
})

app.patch('/api/history/:id', (req, res) => {
  const { name } = req.body
  getDB().prepare('UPDATE history SET name = ? WHERE id = ?').run(name ?? '', req.params.id)
  res.json({ success: true })
})

app.delete('/api/history', (req, res) => {
  getDB().prepare('DELETE FROM history').run()
  res.json({ success: true })
})

// ─── Settings ─────────────────────────────────────────────────────────────────

app.get('/api/settings', (req, res) => {
  res.json({
    proxy: getSetting('proxy', { enabled: false, url: '', bypass: '' }),
  })
})

app.put('/api/settings', (req, res) => {
  const { proxy } = req.body
  if (proxy !== undefined) setSetting('proxy', proxy)
  res.json({ success: true })
})

// ─── Global variables ─────────────────────────────────────────────────────────

app.get('/api/global-vars', (req, res) => {
  res.json(getSetting('global_vars', []))
})

app.put('/api/global-vars', (req, res) => {
  const { variables = [] } = req.body
  setSetting('global_vars', variables)
  res.json({ success: true })
})

// ─── Proxy ────────────────────────────────────────────────────────────────────

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade',
])

function applyEnv(str, vars) {
  return String(str).replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
}

// Cache ProxyAgent — recreate only when the URL changes
let _proxyAgent = null
let _proxyAgentUrl = null

function getProxyAgent(url) {
  if (_proxyAgentUrl !== url || !_proxyAgent) {
    _proxyAgent = new ProxyAgent(url)
    _proxyAgentUrl = url
  }
  return _proxyAgent
}

function shouldBypassProxy(hostname, bypassList) {
  if (!bypassList) return false
  return bypassList.split(',').map(s => s.trim()).filter(Boolean).some(b => {
    const pattern = b.replace(/^\*\./, '') // strip wildcard prefix
    return hostname === b || hostname === pattern || hostname.endsWith('.' + pattern)
  })
}

app.post('/api/proxy', async (req, res) => {
  const {
    method = 'GET',
    url: rawUrl,
    headers = [],
    params = [],
    body = '',
    body_type = 'json',
    global_variables = {},
    collection_variables = {},
    environment_variables = {},
    pre_script = '',
    post_script = '',
  } = req.body

  // Merge vars: global (lowest) < collection < environment (highest)
  const allVars = { ...global_variables, ...collection_variables, ...environment_variables }

  const t0 = Date.now()

  try {
    // ── 1. Resolve variables (merged scope) ───────────────────────────────────
    let resolvedUrl = applyEnv(rawUrl, allVars)
    let resolvedHeaders = headers.map(h => ({ ...h, value: applyEnv(h.value ?? '', allVars) }))
    let resolvedParams = params.map(p => ({ ...p, value: applyEnv(p.value ?? '', allVars) }))
    let resolvedBody = applyEnv(body, allVars)

    // ── 2. Pre-request script ─────────────────────────────────────────────────
    let preScriptResult = { logs: [], tests: [], error: undefined }
    if (pre_script?.trim()) {
      const preCtx = {
        request: {
          method, url: resolvedUrl,
          headers: resolvedHeaders, params: resolvedParams,
          body: resolvedBody, body_type,
          env_vars: allVars,
        },
        response: {},
      }
      preScriptResult = runScript(pre_script, preCtx)
      if (preScriptResult.request) {
        resolvedUrl = preScriptResult.request.url ?? resolvedUrl
        resolvedHeaders = preScriptResult.request.headers ?? resolvedHeaders
        resolvedParams = preScriptResult.request.params ?? resolvedParams
        resolvedBody = preScriptResult.request.body ?? resolvedBody
      }
    }

    // ── 3. Build fetch options ────────────────────────────────────────────────
    const urlObj = new URL(resolvedUrl)
    resolvedParams
      .filter(p => p.enabled !== false && p.key)
      .forEach(p => urlObj.searchParams.set(p.key, p.value ?? ''))

    const fetchHeaders = {}
    resolvedHeaders
      .filter(h => h.enabled !== false && h.key)
      .forEach(h => { fetchHeaders[h.key] = h.value })

    const upper = method.toUpperCase()
    let fetchBody = undefined
    if (!['GET', 'HEAD', 'OPTIONS'].includes(upper) && resolvedBody) {
      fetchBody = resolvedBody
      if (body_type === 'json' && !fetchHeaders['Content-Type'] && !fetchHeaders['content-type']) {
        fetchHeaders['Content-Type'] = 'application/json'
      }
    }

    // ── 4. Build raw request string ───────────────────────────────────────────
    const rawRequest = [
      `${upper} ${urlObj.pathname}${urlObj.search || ''} HTTP/1.1`,
      `Host: ${urlObj.host}`,
      ...Object.entries(fetchHeaders).map(([k, v]) => `${k}: ${v}`),
      '',
      fetchBody || '',
    ].join('\r\n')

    // ── 5. Resolve proxy ──────────────────────────────────────────────────────
    const proxyConfig = getSetting('proxy', { enabled: false, url: '', bypass: '' })
    const useProxy = proxyConfig?.enabled && proxyConfig?.url &&
      !shouldBypassProxy(urlObj.hostname, proxyConfig.bypass)

    // ── 6. Send request ───────────────────────────────────────────────────────
    const fetchOpts = { method: upper, headers: fetchHeaders, body: fetchBody, redirect: 'follow' }
    let response
    if (useProxy) {
      const { fetch: proxyFetch } = await import('undici')
      response = await proxyFetch(urlObj.toString(), { ...fetchOpts, dispatcher: getProxyAgent(proxyConfig.url) })
    } else {
      response = await fetch(urlObj.toString(), fetchOpts)
    }

    const duration = Date.now() - t0
    const text = await response.text()
    const responseBody = text.length > 5 * 1024 * 1024
      ? text.substring(0, 5 * 1024 * 1024) + '\n\n[Response truncated at 5MB]'
      : text

    const responseHeaders = {}
    response.headers.forEach((v, k) => {
      if (!HOP_BY_HOP.has(k.toLowerCase())) responseHeaders[k] = v
    })

    const size = Buffer.byteLength(responseBody, 'utf8')

    // Build raw response string
    const rawResponse = [
      `HTTP/1.1 ${response.status} ${response.statusText}`,
      ...Object.entries(responseHeaders).map(([k, v]) => `${k}: ${v}`),
      '',
      responseBody.length > 50_000 ? responseBody.substring(0, 50_000) + '\n[body truncated in raw view]' : responseBody,
    ].join('\r\n')

    // ── 7. Post-response script ───────────────────────────────────────────────
    let postScriptResult = { logs: [], tests: [], error: undefined }
    if (post_script?.trim()) {
      const postCtx = {
        request: {
          method, url: resolvedUrl,
          headers: resolvedHeaders, params: resolvedParams,
          body: resolvedBody, body_type,
          env_vars: allVars,
        },
        response: {
          status: response.status,
          status_text: response.statusText,
          headers: responseHeaders,
          body: responseBody,
          duration,
          size,
        },
      }
      postScriptResult = runScript(post_script, postCtx)
    }

    // ── 8. Save to history ────────────────────────────────────────────────────
    getDB().prepare(`
      INSERT INTO history
        (id, method, url, headers, params, body, body_type, status, duration, size,
         response_body, response_headers, raw_request, raw_response, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuid(), method, rawUrl,
      JSON.stringify(headers), JSON.stringify(params),
      body, body_type,
      response.status, duration, size,
      responseBody.substring(0, 100_000),
      JSON.stringify(responseHeaders),
      rawRequest,
      rawResponse,
      new Date().toISOString()
    )

    res.json({
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      duration,
      size,
      raw_request: rawRequest,
      raw_response: rawResponse,
      pre_script_result: preScriptResult,
      post_script_result: postScriptResult,
    })
  } catch (err) {
    const msg = err.cause?.message || err.cause?.code || err.message || 'Unknown error'
    res.json({
      status: 0, statusText: 'Error', headers: {}, body: '',
      duration: Date.now() - t0, size: 0, error: msg,
      raw_request: '',
      pre_script_result: { logs: [], tests: [] },
      post_script_result: { logs: [], tests: [] },
    })
  }
})

// ─── Import ───────────────────────────────────────────────────────────────────

function parseImport(text) {
  let data
  try { data = JSON.parse(text) } catch {
    try { data = yaml.load(text) } catch { throw new Error('Could not parse as JSON or YAML') }
  }
  if (!data || typeof data !== 'object') throw new Error('Invalid file: expected an object')
  const fmt = detectFormat(data)
  if (!fmt) throw new Error('Unrecognized format — expected Postman Collection, OpenAPI 3.x, or Swagger 2.x')
  if (fmt === 'postman') return importPostman(data)
  if (fmt === 'openapi3') return importOpenAPI3(data)
  return importSwagger2(data)
}

async function resolveImportText(body) {
  if (body.content) return body.content
  if (body.url) {
    const r = await fetch(body.url)
    if (!r.ok) throw new Error(`Fetch failed: ${r.status} ${r.statusText}`)
    return r.text()
  }
  throw new Error('Provide content or url')
}

// Preview without saving
app.post('/api/import/preview', async (req, res) => {
  try {
    const text = await resolveImportText(req.body)
    const { name, requests } = parseImport(text)
    res.json({ name, count: requests.length })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Parse and save
app.post('/api/import', async (req, res) => {
  try {
    const text = await resolveImportText(req.body)
    const { name, requests } = parseImport(text)

    const db = getDB()
    const colId = uuid()
    const now = new Date().toISOString()

    db.prepare('INSERT INTO collections (id, name, description, created_at) VALUES (?, ?, ?, ?)')
      .run(colId, name, `Imported — ${requests.length} requests`, now)

    for (const r of requests) {
      db.prepare(`
        INSERT INTO requests (id, collection_id, name, method, url, headers, params, body, body_type, pre_script, post_script, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(uuid(), colId, r.name, r.method, r.url,
        JSON.stringify(r.headers), JSON.stringify(r.params),
        r.body, r.body_type, r.pre_script, r.post_script, now)
    }

    const col = db.prepare('SELECT * FROM collections WHERE id = ?').get(colId)
    const reqs = db.prepare('SELECT * FROM requests WHERE collection_id = ?').all(colId)
      .map(r => ({ ...r, headers: JSON.parse(r.headers), params: JSON.parse(r.params) }))
    res.json({ ...col, requests: reqs })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// ─── SPA fallback ─────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'))
})

// ─── WebSocket proxy ─────────────────────────────────────────────────────────

const wss = new WebSocketServer({ noServer: true })

httpServer.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  if (!url.pathname.startsWith('/api/ws-proxy')) {
    socket.destroy()
    return
  }
  const targetUrl = url.searchParams.get('url')
  if (!targetUrl || (!targetUrl.startsWith('ws://') && !targetUrl.startsWith('wss://'))) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n')
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, client => {
    const target = new WebSocket(targetUrl)
    const send = (data) => { try { client.send(data) } catch {} }
    const fwd = (data) => { try { target.send(data) } catch {} }
    target.on('open', () => send(JSON.stringify({ __type: 'connected' })))
    target.on('message', data => send(data))
    target.on('close', (code, reason) => {
      send(JSON.stringify({ __type: 'disconnected', code, reason: reason?.toString() }))
      client.close()
    })
    target.on('error', err => send(JSON.stringify({ __type: 'error', message: err.message })))
    client.on('message', fwd)
    client.on('close', () => target.close())
  })
})

httpServer.listen(PORT, () => console.log(`Dispatch on http://localhost:${PORT}`))
