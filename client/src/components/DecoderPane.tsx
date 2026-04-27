import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Copy, ChevronDown, Check } from 'lucide-react'
import type { KeyValue } from '../types'

// ── Transforms ────────────────────────────────────────────────────────────────

export type TransformType =
  | 'url-decode' | 'url-encode'
  | 'base64-decode' | 'base64-encode'
  | 'html-decode' | 'html-encode'
  | 'hex-decode' | 'hex-encode'
  | 'sha256' | 'sha1'
  | 'rot13' | 'reverse'
  | 'to-upper' | 'to-lower'
  | 'unicode-escape' | 'unicode-unescape'
  | 'length'

export const TRANSFORMS: { value: TransformType; label: string; group: string }[] = [
  { value: 'url-decode',       label: 'URL Decode',       group: 'URL' },
  { value: 'url-encode',       label: 'URL Encode',       group: 'URL' },
  { value: 'base64-decode',    label: 'Base64 Decode',    group: 'Base64' },
  { value: 'base64-encode',    label: 'Base64 Encode',    group: 'Base64' },
  { value: 'html-decode',      label: 'HTML Decode',      group: 'HTML' },
  { value: 'html-encode',      label: 'HTML Encode',      group: 'HTML' },
  { value: 'hex-decode',       label: 'Hex Decode',       group: 'Hex' },
  { value: 'hex-encode',       label: 'Hex Encode',       group: 'Hex' },
  { value: 'unicode-escape',   label: 'Unicode Escape',   group: 'Unicode' },
  { value: 'unicode-unescape', label: 'Unicode Unescape', group: 'Unicode' },
  { value: 'sha256',           label: 'SHA-256',          group: 'Hash' },
  { value: 'sha1',             label: 'SHA-1',            group: 'Hash' },
  { value: 'rot13',            label: 'ROT13',            group: 'Text' },
  { value: 'reverse',          label: 'Reverse',          group: 'Text' },
  { value: 'to-upper',         label: 'Uppercase',        group: 'Text' },
  { value: 'to-lower',         label: 'Lowercase',        group: 'Text' },
  { value: 'length',           label: 'Length',           group: 'Info' },
]

async function applyTransform(type: TransformType, input: string): Promise<{ output: string; error?: string }> {
  try {
    switch (type) {
      case 'url-decode':
        return { output: decodeURIComponent(input.replace(/\+/g, ' ')) }
      case 'url-encode':
        return { output: encodeURIComponent(input) }
      case 'base64-decode': {
        const bytes = Uint8Array.from(atob(input), c => c.charCodeAt(0))
        return { output: new TextDecoder().decode(bytes) }
      }
      case 'base64-encode': {
        const bytes = new TextEncoder().encode(input)
        const bin = Array.from(bytes, b => String.fromCharCode(b)).join('')
        return { output: btoa(bin) }
      }
      case 'html-decode': {
        const el = document.createElement('textarea')
        el.innerHTML = input
        return { output: el.value }
      }
      case 'html-encode': {
        const el = document.createElement('div')
        el.appendChild(document.createTextNode(input))
        return { output: el.innerHTML }
      }
      case 'hex-encode': {
        const bytes = new TextEncoder().encode(input)
        return { output: Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('') }
      }
      case 'hex-decode': {
        const hex = input.replace(/\s+/g, '')
        if (hex.length % 2 !== 0) return { output: '', error: 'Odd hex length' }
        const bytes = new Uint8Array(hex.length / 2)
        for (let i = 0; i < hex.length; i += 2) {
          const b = parseInt(hex.slice(i, i + 2), 16)
          if (isNaN(b)) return { output: '', error: `Invalid hex at pos ${i}` }
          bytes[i / 2] = b
        }
        return { output: new TextDecoder().decode(bytes) }
      }
      case 'unicode-escape':
        return { output: Array.from(input).map(c => {
          const cp = c.codePointAt(0)!
          return cp > 127 ? `\\u${cp.toString(16).padStart(4, '0')}` : c
        }).join('') }
      case 'unicode-unescape':
        return { output: input.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCodePoint(parseInt(h, 16))) }
      case 'sha256': {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
        return { output: Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('') }
      }
      case 'sha1': {
        const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input))
        return { output: Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('') }
      }
      case 'rot13':
        return { output: input.replace(/[a-zA-Z]/g, c => {
          const base = c <= 'Z' ? 65 : 97
          return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base)
        }) }
      case 'reverse':
        return { output: [...input].reverse().join('') }
      case 'to-upper':
        return { output: input.toUpperCase() }
      case 'to-lower':
        return { output: input.toLowerCase() }
      case 'length':
        return { output: String(input.length) }
    }
  } catch (e: any) {
    return { output: '', error: e.message }
  }
}

// ── Context menu ──────────────────────────────────────────────────────────────

interface CtxMenu {
  x: number
  y: number
  value: string
  mode: 'default' | 'env-input'
  envKey: string
}

// ── Step ─────────────────────────────────────────────────────────────────────

interface Step {
  id: string
  type: TransformType
  output: string
  error?: string
}

function newStep(type: TransformType = 'url-decode'): Step {
  return { id: crypto.randomUUID(), type, output: '' }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  externalText?: string
  externalKey?: string
  onInjectBody: (value: string) => void
  onAddParam: (value: string) => void
  onSaveEnvVar: (key: string, value: string) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DecoderPane({ externalText, externalKey, onInjectBody, onAddParam, onSaveEnvVar }: Props) {
  const [input, setInput] = useState('')
  const [steps, setSteps] = useState<Step[]>([newStep('url-decode')])
  const [ctx, setCtx] = useState<CtxMenu | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Accept text pushed from outside (Send to Decoder)
  const prevKeyRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (externalKey && externalKey !== prevKeyRef.current && externalText !== undefined) {
      prevKeyRef.current = externalKey
      setInput(externalText)
    }
  }, [externalKey, externalText])

  // Recompute chain whenever input or step types change
  useEffect(() => {
    let cancelled = false
    async function compute() {
      let current = input
      const next: Step[] = []
      for (const step of steps) {
        const { output, error } = await applyTransform(step.type, current)
        if (cancelled) return
        next.push({ ...step, output, error })
        current = error ? '' : output
      }
      if (!cancelled) setSteps(next)
    }
    compute()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, steps.map(s => s.type).join(',')])

  const addStep = () => setSteps(prev => [...prev, newStep()])
  const removeStep = (id: string) => setSteps(prev => prev.length > 1 ? prev.filter(s => s.id !== id) : prev)
  const changeType = (id: string, type: TransformType) =>
    setSteps(prev => prev.map(s => s.id === id ? { ...s, type } : s))

  const openCtx = (e: React.MouseEvent, value: string) => {
    e.preventDefault()
    const el = containerRef.current
    const bounds = el?.getBoundingClientRect()
    // Clamp so menu stays inside viewport
    const x = Math.min(e.clientX - (bounds?.left ?? 0), (bounds?.width ?? 400) - 180)
    const y = e.clientY - (bounds?.top ?? 0)
    setCtx({ x, y, value, mode: 'default', envKey: '' })
  }

  const closeCtx = () => setCtx(null)

  const handleCopy = async (value: string, id?: string) => {
    await navigator.clipboard.writeText(value)
    if (id) {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    }
    closeCtx()
  }

  const handleSaveEnv = () => {
    if (!ctx) return
    if (ctx.mode === 'default') {
      setCtx({ ...ctx, mode: 'env-input' })
      return
    }
    if (ctx.envKey.trim()) {
      onSaveEnvVar(ctx.envKey.trim(), ctx.value)
      closeCtx()
    }
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden relative" onClick={ctx ? closeCtx : undefined}>
      {/* Input area */}
      <div className="flex-shrink-0 p-3 border-b border-zinc-800">
        <div className="text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">Input</div>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Paste or type text to transform…"
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 resize-none"
          rows={4}
        />
      </div>

      {/* Transform chain */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {steps.map((step, i) => (
          <div key={step.id} className="flex flex-col gap-1.5">
            {/* Step header */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-600 w-4 text-right flex-shrink-0">{i + 1}</span>
              <div className="relative flex-1">
                <select
                  value={step.type}
                  onChange={e => changeType(step.id, e.target.value as TransformType)}
                  className="w-full appearance-none bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-violet-500 cursor-pointer pr-7"
                >
                  {TRANSFORMS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              </div>
              <button
                onClick={() => handleCopy(step.output, step.id)}
                className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0"
                title="Copy output"
              >
                {copiedId === step.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
              <button
                onClick={() => removeStep(step.id)}
                className="p-1 text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0"
                title="Remove step"
              >
                <Trash2 size={12} />
              </button>
            </div>

            {/* Output */}
            <div
              onContextMenu={e => step.output && openCtx(e, step.output)}
              className={`ml-6 rounded border text-xs font-mono whitespace-pre-wrap break-all px-3 py-2 min-h-[40px] cursor-context-menu select-text ${
                step.error
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-zinc-800/70 border-zinc-700 text-zinc-300 hover:border-zinc-600'
              }`}
            >
              {step.error
                ? `Error: ${step.error}`
                : step.output || <span className="text-zinc-600 not-italic">(empty)</span>
              }
            </div>
          </div>
        ))}

        <button
          onClick={addStep}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-violet-400 transition-colors mt-1 ml-6"
        >
          <Plus size={12} /> Add Transform
        </button>
      </div>

      {/* Context menu */}
      {ctx && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeCtx} />
          <div
            className="absolute z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-2xl py-1 min-w-44"
            style={{ left: ctx.x, top: ctx.y }}
            onClick={e => e.stopPropagation()}
          >
            {ctx.mode === 'default' ? (
              <>
                <button
                  onClick={() => handleCopy(ctx.value)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
                >
                  <Copy size={11} className="text-zinc-500" /> Copy
                </button>
                <div className="border-t border-zinc-700 my-1" />
                <button
                  onClick={() => { onInjectBody(ctx.value); closeCtx() }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
                >
                  <span className="text-zinc-500 font-mono text-[10px] w-[11px]">B</span> Send to Body
                </button>
                <button
                  onClick={() => { onAddParam(ctx.value); closeCtx() }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
                >
                  <span className="text-zinc-500 font-mono text-[10px] w-[11px]">P</span> Add as URL Param
                </button>
                <div className="border-t border-zinc-700 my-1" />
                <button
                  onClick={handleSaveEnv}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 text-left"
                >
                  <span className="text-zinc-500 font-mono text-[10px] w-[11px]">{'{}'}</span> Save as Env Var…
                </button>
              </>
            ) : (
              <div className="px-3 py-2 flex flex-col gap-2">
                <span className="text-xs text-zinc-400">Variable name</span>
                <input
                  autoFocus
                  value={ctx.envKey}
                  onChange={e => setCtx({ ...ctx, envKey: e.target.value })}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveEnv()
                    if (e.key === 'Escape') closeCtx()
                  }}
                  placeholder="MY_VAR"
                  className="bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs font-mono text-zinc-200 focus:outline-none focus:border-violet-500"
                />
                <div className="flex gap-1.5 justify-end">
                  <button onClick={closeCtx} className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
                  <button
                    onClick={handleSaveEnv}
                    disabled={!ctx.envKey.trim()}
                    className="px-2 py-1 text-xs bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
