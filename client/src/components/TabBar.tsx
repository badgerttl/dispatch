import { useState, useRef, useEffect } from 'react'
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { RequestTab } from '../types'

const METHOD_DOT: Record<string, string> = {
  GET: '#4ade80', POST: '#60a5fa', PUT: '#fb923c',
  PATCH: '#facc15', DELETE: '#f87171', HEAD: '#c084fc', OPTIONS: '#22d3ee',
}

interface Props {
  tabs: RequestTab[]
  activeTabId: string
  onSelect: (id: string) => void
  onAdd: () => void
  onClose: (id: string) => void
  onRename: (id: string, name: string) => void
}

export function TabBar({ tabs, activeTabId, onSelect, onAdd, onClose, onRename }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 0)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect() }
  }, [tabs])

  // Scroll active tab into view when it changes
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const activeEl = el.querySelector(`[data-tabid="${activeTabId}"]`) as HTMLElement | null
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeTabId])

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -160 : 160, behavior: 'smooth' })
  }

  const startRename = (tab: RequestTab, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenamingId(tab.id)
    setRenameVal(tab.name)
  }

  const commitRename = (id: string) => {
    onRename(id, renameVal.trim() || 'New Request')
    setRenamingId(null)
  }

  return (
    <div className="flex items-stretch bg-zinc-950 border-b border-zinc-800 flex-shrink-0" style={{ height: 40 }}>
      {canLeft && (
        <button
          onClick={() => scroll('left')}
          className="px-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 flex-shrink-0 transition-colors"
        >
          <ChevronLeft size={13} />
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex flex-1 overflow-x-hidden items-stretch min-w-0"
        onDoubleClick={onAdd}
      >
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId
          return (
            <div
              key={tab.id}
              data-tabid={tab.id}
              onClick={() => renamingId !== tab.id && onSelect(tab.id)}
              onDoubleClick={e => { e.stopPropagation(); startRename(tab, e) }}
              className={`group relative flex items-center justify-center gap-1.5 px-6 border-r border-zinc-800 cursor-pointer flex-shrink-0 select-none ${
                isActive
                  ? 'bg-zinc-900 text-zinc-200 border-t-2 border-t-violet-500'
                  : 'bg-zinc-950 text-zinc-500 hover:bg-zinc-900/70 hover:text-zinc-300'
              }`}
              style={{ minWidth: 140, maxWidth: 200 }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: METHOD_DOT[tab.method] ?? '#71717a' }}
              />
              {renamingId === tab.id ? (
                <input
                  autoFocus
                  value={renameVal}
                  onChange={e => setRenameVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(tab.id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  onBlur={() => commitRename(tab.id)}
                  onClick={e => e.stopPropagation()}
                  className="bg-transparent text-xs text-zinc-200 focus:outline-none min-w-0 w-full text-center"
                />
              ) : (
                <span className="text-xs truncate min-w-0 max-w-[120px]">{tab.name}</span>
              )}
              <button
                onClick={e => { e.stopPropagation(); onClose(tab.id) }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity rounded"
              >
                <X size={10} />
              </button>
            </div>
          )
        })}
      </div>

      {canRight && (
        <button
          onClick={() => scroll('right')}
          className="px-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 flex-shrink-0 transition-colors"
        >
          <ChevronRight size={13} />
        </button>
      )}

      <button
        onClick={onAdd}
        className="px-2.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 flex-shrink-0 transition-colors border-l border-zinc-800"
        title="New tab"
      >
        <Plus size={13} />
      </button>
    </div>
  )
}
