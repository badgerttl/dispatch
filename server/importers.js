import { randomUUID } from 'crypto'

function kv(key, value, enabled = true) {
  return { id: randomUUID(), key: String(key ?? ''), value: String(value ?? ''), enabled }
}

// ─── Format detection ─────────────────────────────────────────────────────────

export function detectFormat(data) {
  if (data.info?._postman_id !== undefined || (data.info?.schema ?? '').includes('postman')) return 'postman'
  if (data.openapi) return 'openapi3'
  if (data.swagger) return 'swagger2'
  return null
}

// ─── Postman Collection v2.x ──────────────────────────────────────────────────

export function importPostman(data) {
  const name = data.info?.name || 'Imported Collection'
  const requests = []
  processItems(data.item ?? [], requests, '')
  return { name, requests }
}

function processItems(items, out, folderPath) {
  for (const item of items) {
    if (Array.isArray(item.item)) {
      const path = folderPath ? `${folderPath} / ${item.name}` : item.name
      processItems(item.item, out, path)
    } else if (item.request) {
      out.push(parsePostmanRequest(item, folderPath))
    }
  }
}

function parsePostmanRequest(item, folderPath) {
  const req = item.request
  const name = folderPath ? `${folderPath} / ${item.name}` : item.name
  const method = (req.method || 'GET').toUpperCase()

  let url = ''
  let params = []
  if (typeof req.url === 'string') {
    url = req.url
  } else if (req.url) {
    url = req.url.raw || ''
    params = (req.url.query ?? []).filter(q => q.key).map(q => kv(q.key, q.value ?? '', !q.disabled))
  }

  const headers = (req.header ?? []).filter(h => h.key).map(h => kv(h.key, h.value ?? '', !h.disabled))

  let body = '', body_type = 'none'
  if (req.body) {
    const { mode } = req.body
    if (mode === 'raw') {
      body = req.body.raw ?? ''
      const lang = req.body.options?.raw?.language
      body_type = lang === 'json' ? 'json' : lang === 'xml' ? 'xml' : 'text'
      if (body_type === 'text' && body.trimStart().startsWith('{')) body_type = 'json'
    } else if (mode === 'urlencoded') {
      body = JSON.stringify((req.body.urlencoded ?? []).filter(p => p.key).map(p => kv(p.key, p.value ?? '', !p.disabled)))
      body_type = 'urlencoded'
    } else if (mode === 'formdata') {
      body = JSON.stringify((req.body.formdata ?? []).filter(p => p.key && p.type !== 'file').map(p => kv(p.key, p.value ?? '', !p.disabled)))
      body_type = 'form-data'
    } else if (mode === 'graphql') {
      body = JSON.stringify({ query: req.body.graphql?.query ?? '', variables: req.body.graphql?.variables ?? {} }, null, 2)
      body_type = 'json'
    }
  }

  return { name, method, url, headers, params, body, body_type, pre_script: '', post_script: '' }
}

// ─── OpenAPI 3.x ─────────────────────────────────────────────────────────────

export function importOpenAPI3(data) {
  const name = data.info?.title || 'Imported API'
  const baseUrl = (data.servers?.[0]?.url ?? '').replace(/\/$/, '')
  const requests = []

  for (const [path, pathItem] of Object.entries(data.paths ?? {})) {
    const shared = pathItem.parameters ?? []
    for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
      const op = pathItem[method]
      if (!op) continue

      const reqName = op.operationId || op.summary || `${method.toUpperCase()} ${path}`
      const all = [...shared, ...(op.parameters ?? [])]
      const url = baseUrl + path.replace(/\{(\w+)\}/g, '{{$1}}')

      const params = all.filter(p => p.in === 'query').map(p =>
        kv(p.name, p.example !== undefined ? String(p.example) : (p.schema?.default !== undefined ? String(p.schema.default) : ''), !p.required)
      )
      const headers = all.filter(p => p.in === 'header').map(p =>
        kv(p.name, p.example !== undefined ? String(p.example) : '', true)
      )

      let body = '', body_type = ['get', 'head', 'options'].includes(method) ? 'none' : 'json'

      if (op.requestBody) {
        const ct = op.requestBody.content ?? {}
        if (ct['application/json']) {
          body_type = 'json'
          body = extractExample(ct['application/json'])
        } else if (ct['application/xml']) {
          body_type = 'xml'
        } else if (ct['application/x-www-form-urlencoded']) {
          body_type = 'urlencoded'
        } else if (ct['multipart/form-data']) {
          body_type = 'form-data'
        } else {
          const first = Object.values(ct)[0]
          if (first) { body_type = 'json'; body = extractExample(first) }
        }
      }

      requests.push({ name: reqName, method: method.toUpperCase(), url, headers, params, body, body_type, pre_script: '', post_script: '' })
    }
  }
  return { name, requests }
}

// ─── Swagger 2.x ─────────────────────────────────────────────────────────────

export function importSwagger2(data) {
  const name = data.info?.title || 'Imported API'
  const scheme = data.schemes?.[0] ?? 'https'
  const baseUrl = `${scheme}://${data.host ?? ''}${data.basePath ?? ''}`.replace(/\/$/, '')
  const requests = []

  for (const [path, pathItem] of Object.entries(data.paths ?? {})) {
    const shared = pathItem.parameters ?? []
    for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
      const op = pathItem[method]
      if (!op) continue

      const reqName = op.operationId || op.summary || `${method.toUpperCase()} ${path}`
      const all = [...shared, ...(op.parameters ?? [])]
      const url = baseUrl + path.replace(/\{(\w+)\}/g, '{{$1}}')

      const params = all.filter(p => p.in === 'query').map(p =>
        kv(p.name, p.default !== undefined ? String(p.default) : '', !p.required)
      )
      const headers = all.filter(p => p.in === 'header').map(p =>
        kv(p.name, p.default !== undefined ? String(p.default) : '', true)
      )

      let body = '', body_type = ['get', 'head', 'options'].includes(method) ? 'none' : 'json'

      const bodyParam = all.find(p => p.in === 'body')
      if (bodyParam?.schema) {
        body_type = 'json'
        body = schemaToExample(bodyParam.schema)
      }

      const formParams = all.filter(p => p.in === 'formData').map(p =>
        kv(p.name, p.default !== undefined ? String(p.default) : '', true)
      )
      const consumes = op.consumes ?? data.consumes ?? []
      if (formParams.length > 0) {
        body = JSON.stringify(formParams)
        body_type = consumes.includes('multipart/form-data') ? 'form-data' : 'urlencoded'
      } else if (consumes.includes('application/x-www-form-urlencoded')) {
        body_type = 'urlencoded'
      } else if (consumes.includes('multipart/form-data')) {
        body_type = 'form-data'
      }

      requests.push({ name: reqName, method: method.toUpperCase(), url, headers, params, body, body_type, pre_script: '', post_script: '' })
    }
  }
  return { name, requests }
}

// ─── Schema → example helpers ─────────────────────────────────────────────────

function extractExample(mediaType) {
  if (!mediaType) return ''
  if (mediaType.example !== undefined) return JSON.stringify(mediaType.example, null, 2)
  const first = mediaType.examples && Object.values(mediaType.examples)[0]
  if (first?.value !== undefined) return JSON.stringify(first.value, null, 2)
  return mediaType.schema ? schemaToExample(mediaType.schema) : ''
}

function schemaToExample(schema, depth = 0) {
  if (!schema || depth > 4) return ''
  if (schema.$ref) return ''
  if (schema.example !== undefined) return JSON.stringify(schema.example, null, 2)
  if (schema.default !== undefined) return JSON.stringify(schema.default, null, 2)
  const sub = schema.allOf?.[0] ?? schema.anyOf?.[0] ?? schema.oneOf?.[0]
  if (sub) return schemaToExample(sub, depth + 1)
  const type = schema.type ?? (schema.properties ? 'object' : null)
  if (type === 'object' || schema.properties) {
    const obj = {}
    for (const [k, v] of Object.entries(schema.properties ?? {})) obj[k] = sampleValue(v, depth + 1)
    return JSON.stringify(obj, null, 2)
  }
  if (type === 'array') return JSON.stringify([schema.items ? sampleValue(schema.items, depth + 1) : null], null, 2)
  return JSON.stringify(sampleValue(schema, depth), null, 2)
}

function sampleValue(s, depth = 0) {
  if (!s || depth > 4) return null
  if (s.example !== undefined) return s.example
  if (s.default !== undefined) return s.default
  if (s.enum?.length) return s.enum[0]
  const t = s.type ?? (s.properties ? 'object' : null)
  if (t === 'string') {
    if (s.format === 'date-time') return new Date().toISOString()
    if (s.format === 'date') return new Date().toISOString().split('T')[0]
    if (s.format === 'uuid') return '00000000-0000-0000-0000-000000000000'
    if (s.format === 'email') return 'user@example.com'
    return 'string'
  }
  if (t === 'integer' || t === 'number') return s.minimum ?? 0
  if (t === 'boolean') return false
  if (t === 'array') return []
  if (t === 'object' || s.properties) {
    const obj = {}
    for (const [k, v] of Object.entries(s.properties ?? {})) obj[k] = sampleValue(v, depth + 1)
    return obj
  }
  return null
}
