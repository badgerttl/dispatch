import { useState, useEffect } from 'react'
import { X, Globe, ToggleLeft, ToggleRight } from 'lucide-react'
import type { ProxyConfig } from '../types'

interface Props {
  initial: ProxyConfig
  onClose: () => void
  onSave: (config: ProxyConfig) => Promise<void>
}

export function ProxyModal({ initial, onClose, onSave }: Props) {
  const [config, setConfig] = useState<ProxyConfig>(initial)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setConfig(initial) }, [initial])

  const set = (field: keyof ProxyConfig, val: string | boolean) =>
    setConfig(prev => ({ ...prev, [field]: val }))

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(config) } finally { setSaving(false) }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-violet-400" />
            <h2 className="font-semibold text-zinc-100">Proxy Settings</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-200">Use Proxy</p>
              <p className="text-xs text-zinc-500 mt-0.5">Route requests through a proxy server</p>
            </div>
            <button
              onClick={() => set('enabled', !config.enabled)}
              className="text-2xl transition-colors"
            >
              {config.enabled
                ? <ToggleRight size={32} className="text-violet-500" />
                : <ToggleLeft size={32} className="text-zinc-600" />}
            </button>
          </div>

          {/* Proxy URL */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Proxy URL
            </label>
            <input
              value={config.url}
              onChange={e => set('url', e.target.value)}
              placeholder="http://proxy.example.com:8080"
              disabled={!config.enabled}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 disabled:opacity-40"
            />
            <p className="text-xs text-zinc-600 mt-1">
              Supports HTTP, HTTPS, SOCKS4, and SOCKS5 proxies.
            </p>
          </div>

          {/* Bypass list */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Bypass List
            </label>
            <input
              value={config.bypass}
              onChange={e => set('bypass', e.target.value)}
              placeholder="localhost, 127.0.0.1, *.internal.corp"
              disabled={!config.enabled}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500 disabled:opacity-40"
            />
            <p className="text-xs text-zinc-600 mt-1">
              Comma-separated hostnames to bypass the proxy.
            </p>
          </div>

          {/* Note */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3">
            <p className="text-xs text-blue-300">
              Proxy applies server-side — all requests from Dispatch will route through it, not just browser traffic.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-800">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-zinc-400 hover:text-zinc-200">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded font-medium transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
