import { useState } from 'react'
import { ChevronRight, ChevronDown, Copy, ArrowRight, Plus, Check } from 'lucide-react'
import { PAYLOAD_LIBRARY } from '../data/payloads'

interface Props {
  onInjectBody: (payload: string) => void
  onAddParam: (value: string) => void
}

interface PopoverState { catIdx: number; payIdx: number; copied: boolean }

export function PayloadLibrary({ onInjectBody, onAddParam }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]))
  const [popover, setPopover] = useState<PopoverState | null>(null)
  const [search, setSearch] = useState('')

  const toggle = (i: number) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(i) ? next.delete(i) : next.add(i)
    return next
  })

  const filtered = PAYLOAD_LIBRARY.map(cat => ({
    ...cat,
    payloads: search
      ? cat.payloads.filter(p => p.label.toLowerCase().includes(search.toLowerCase()) || p.value.toLowerCase().includes(search.toLowerCase()))
      : cat.payloads,
  })).filter(cat => cat.payloads.length > 0)

  const handleCopy = async (catIdx: number, payIdx: number, value: string) => {
    await navigator.clipboard.writeText(value)
    setPopover({ catIdx, payIdx, copied: true })
    setTimeout(() => setPopover(null), 1200)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-2 border-b border-zinc-800">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search payloads..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map((cat, catIdx) => (
          <div key={cat.label}>
            <button
              onClick={() => toggle(catIdx)}
              className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-800 transition-colors"
            >
              {expanded.has(catIdx) ? <ChevronDown size={11} className="text-zinc-600 flex-shrink-0" /> : <ChevronRight size={11} className="text-zinc-600 flex-shrink-0" />}
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
              <span className="flex-1 text-xs font-medium text-zinc-300 text-left">{cat.label}</span>
              <span className="text-xs text-zinc-600">{cat.payloads.length}</span>
            </button>

            {expanded.has(catIdx) && cat.payloads.map((p, payIdx) => (
              <div key={payIdx} className="group relative px-2 pl-7 py-1 hover:bg-zinc-800/60">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="flex-1 text-xs text-zinc-400 truncate group-hover:text-zinc-300">{p.label}</span>
                  {/* Action buttons on hover */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {popover?.catIdx === catIdx && popover?.payIdx === payIdx && popover.copied ? (
                      <span className="flex items-center gap-0.5 text-emerald-400 text-xs px-1">
                        <Check size={10} /> Copied
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleCopy(catIdx, payIdx, p.value)}
                          className="p-0.5 text-zinc-600 hover:text-zinc-300 transition-colors"
                          title="Copy"
                        >
                          <Copy size={10} />
                        </button>
                        <button
                          onClick={() => { onInjectBody(p.value); setPopover(null) }}
                          className="p-0.5 text-zinc-600 hover:text-violet-400 transition-colors"
                          title="Set as body"
                        >
                          <ArrowRight size={10} />
                        </button>
                        <button
                          onClick={() => { onAddParam(p.value); setPopover(null) }}
                          className="p-0.5 text-zinc-600 hover:text-emerald-400 transition-colors"
                          title="Add as param value"
                        >
                          <Plus size={10} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="px-2 py-1.5 border-t border-zinc-800 text-xs text-zinc-700 flex gap-3">
        <span className="flex items-center gap-1"><Copy size={9} /> copy</span>
        <span className="flex items-center gap-1"><ArrowRight size={9} /> body</span>
        <span className="flex items-center gap-1"><Plus size={9} /> param</span>
      </div>
    </div>
  )
}
