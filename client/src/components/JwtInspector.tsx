import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Shield } from 'lucide-react'
import type { ResponseData } from '../types'

const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/g

interface DecodedJWT {
  source: string
  token: string
  header: Record<string, unknown>
  payload: Record<string, unknown>
  issues: { level: 'error' | 'warn' | 'info'; text: string }[]
}

function b64decode(s: string): string {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return atob(s)
}

function decodeJWT(token: string, source: string): DecodedJWT | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const header = JSON.parse(b64decode(parts[0]))
    const payload = JSON.parse(b64decode(parts[1]))
    const issues: DecodedJWT['issues'] = []

    const alg = (header.alg as string) ?? ''
    if (alg.toLowerCase() === 'none' || alg === '') {
      issues.push({ level: 'error', text: `Algorithm is "${alg}" — signature not verified (critical)` })
    } else if (['HS256', 'HS384', 'HS512'].includes(alg)) {
      issues.push({ level: 'info', text: `Symmetric algorithm ${alg} — secret must stay server-side` })
    } else if (['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'].includes(alg)) {
      issues.push({ level: 'info', text: `Asymmetric algorithm ${alg}` })
    }

    const now = Math.floor(Date.now() / 1000)
    if (payload.exp !== undefined) {
      if ((payload.exp as number) < now) {
        issues.push({ level: 'error', text: `Token expired ${new Date((payload.exp as number) * 1000).toLocaleString()}` })
      } else {
        const expiresIn = (payload.exp as number) - now
        const h = Math.floor(expiresIn / 3600)
        const m = Math.floor((expiresIn % 3600) / 60)
        issues.push({ level: 'info', text: `Expires in ${h > 0 ? h + 'h ' : ''}${m}m (${new Date((payload.exp as number) * 1000).toLocaleString()})` })
      }
    } else {
      issues.push({ level: 'warn', text: 'No exp claim — token never expires' })
    }

    if (!payload.iss) issues.push({ level: 'warn', text: 'No iss claim' })
    if (!payload.sub && !payload.uid && !payload.user_id) issues.push({ level: 'warn', text: 'No sub/uid claim' })
    if (!payload.iat) issues.push({ level: 'info', text: 'No iat claim' })

    if (header.kid !== undefined) {
      issues.push({ level: 'info', text: `kid: ${header.kid} — check for path traversal or SQL in kid value` })
    }

    return { source, token, header, payload, issues }
  } catch {
    return null
  }
}

function findJWTs(response: ResponseData): DecodedJWT[] {
  const seen = new Set<string>()
  const results: DecodedJWT[] = []

  const tryAdd = (source: string, text: string) => {
    const matches = text.matchAll(JWT_RE)
    for (const m of matches) {
      if (seen.has(m[0])) continue
      seen.add(m[0])
      const decoded = decodeJWT(m[0], source)
      if (decoded) results.push(decoded)
    }
  }

  for (const [k, v] of Object.entries(response.headers)) {
    tryAdd(`Header: ${k}`, v)
  }
  if (response.body) tryAdd('Response Body', response.body)

  return results
}

function IssueRow({ issue }: { issue: DecodedJWT['issues'][0] }) {
  const colors = {
    error: 'text-red-400',
    warn: 'text-amber-400',
    info: 'text-zinc-400',
  }
  const Icon = issue.level === 'error' ? AlertTriangle : issue.level === 'warn' ? AlertTriangle : CheckCircle2
  return (
    <div className={`flex items-start gap-2 text-xs ${colors[issue.level]}`}>
      <Icon size={12} className="flex-shrink-0 mt-0.5" />
      <span>{issue.text}</span>
    </div>
  )
}

interface Props { response: ResponseData }

export function JwtInspector({ response }: Props) {
  const tokens = findJWTs(response)
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]))

  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-600">
        <Shield size={24} />
        <span className="text-sm">No JWTs detected in response headers or body</span>
      </div>
    )
  }

  const toggle = (i: number) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(i) ? next.delete(i) : next.add(i)
    return next
  })

  return (
    <div className="flex flex-col gap-3 p-4 overflow-auto h-full">
      {tokens.map((jwt, i) => {
        const hasErrors = jwt.issues.some(x => x.level === 'error')
        const hasWarns = jwt.issues.some(x => x.level === 'warn')
        const isOpen = expanded.has(i)
        return (
          <div key={i} className={`border rounded-lg overflow-hidden ${hasErrors ? 'border-red-500/30' : hasWarns ? 'border-amber-500/30' : 'border-zinc-700'}`}>
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-800/50 hover:bg-zinc-800 transition-colors text-left"
            >
              {isOpen ? <ChevronDown size={13} className="text-zinc-500 flex-shrink-0" /> : <ChevronRight size={13} className="text-zinc-500 flex-shrink-0" />}
              <span className="text-xs font-mono text-violet-400 flex-shrink-0">{jwt.source}</span>
              <span className="flex-1 text-xs font-mono text-zinc-500 truncate">{jwt.token.substring(0, 40)}…</span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {hasErrors && <span className="text-xs text-red-400 font-medium">⚠ {jwt.issues.filter(x => x.level === 'error').length} error</span>}
                {hasWarns && <span className="text-xs text-amber-400">{jwt.issues.filter(x => x.level === 'warn').length} warn</span>}
              </div>
            </button>

            {isOpen && (
              <div className="p-3 flex flex-col gap-3">
                {/* Issues */}
                {jwt.issues.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Findings</div>
                    {jwt.issues.map((issue, j) => <IssueRow key={j} issue={issue} />)}
                  </div>
                )}

                {/* Header */}
                <div>
                  <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Header</div>
                  <pre className="text-xs font-mono text-zinc-300 bg-zinc-900 rounded p-2 overflow-auto">
                    {JSON.stringify(jwt.header, null, 2)}
                  </pre>
                </div>

                {/* Payload */}
                <div>
                  <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Payload</div>
                  <pre className="text-xs font-mono text-zinc-300 bg-zinc-900 rounded p-2 overflow-auto">
                    {JSON.stringify(jwt.payload, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function hasJWTs(response: ResponseData | null): boolean {
  if (!response) return false
  return findJWTs(response).length > 0
}
