import { useState, useRef, useEffect } from 'react'
import { Send, Plug, PlugZap, Trash2, ArrowDown, ArrowUp } from 'lucide-react'
import type { WsMessage } from '../types'

interface Props {
  url: string
  connected: boolean
  messages: WsMessage[]
  onConnect: () => void
  onDisconnect: () => void
  onSend: (msg: string) => void
  onClear: () => void
}

function formatTs(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function WsPane({ url, connected, messages, onConnect, onDisconnect, onSend, onClear }: Props) {
  const [msg, setMsg] = useState('')
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    if (!msg.trim() || !connected) return
    onSend(msg)
    setMsg('')
  }

  const isWs = url.startsWith('ws://') || url.startsWith('wss://')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-zinc-800 flex-shrink-0">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
        <span className="text-xs font-mono text-zinc-400 truncate flex-1">{url || 'No URL'}</span>
        {connected ? (
          <button
            onClick={onDisconnect}
            className="flex items-center gap-1.5 px-3 py-1 text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors"
          >
            <PlugZap size={11} /> Disconnect
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={!isWs}
            title={!isWs ? 'URL must start with ws:// or wss://' : undefined}
            className="flex items-center gap-1.5 px-3 py-1 text-xs bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plug size={11} /> Connect
          </button>
        )}
        <button
          onClick={onClear}
          disabled={messages.length === 0}
          className="p-1 text-zinc-600 hover:text-zinc-400 disabled:opacity-30 transition-colors"
          title="Clear messages"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Message log */}
      <div ref={logRef} className="flex-1 overflow-y-auto font-mono text-xs">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm font-sans">
            {connected ? 'Connected — waiting for messages' : 'Not connected'}
          </div>
        ) : (
          messages.map(m => (
            <div
              key={m.id}
              className={`flex gap-2 px-3 py-1.5 border-b border-zinc-800/40 ${
                m.dir === 'sent' ? 'bg-violet-500/5' : 'bg-zinc-900'
              }`}
            >
              <span className="flex-shrink-0 text-zinc-700 pt-0.5">{formatTs(m.ts)}</span>
              <span className="flex-shrink-0 pt-0.5">
                {m.dir === 'sent'
                  ? <ArrowUp size={11} className="text-violet-400" />
                  : <ArrowDown size={11} className="text-emerald-400" />}
              </span>
              <span className={`flex-1 break-all whitespace-pre-wrap ${m.dir === 'sent' ? 'text-violet-300' : 'text-zinc-300'}`}>
                {m.data}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Send input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-zinc-800 flex-shrink-0">
        <input
          value={msg}
          onChange={e => setMsg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={connected ? 'Send a message…' : 'Connect first'}
          disabled={!connected}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 disabled:opacity-40"
        />
        <button
          onClick={handleSend}
          disabled={!connected || !msg.trim()}
          className="p-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded transition-colors"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  )
}
