import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import type { KeyValue } from '../types'

const newKV = (): KeyValue => ({ id: crypto.randomUUID(), key: '', value: '', enabled: true })

interface Props {
  title: string
  variables: KeyValue[]
  onClose: () => void
  onSave: (variables: KeyValue[]) => Promise<void>
}

export function VarsModal({ title, variables, onClose, onSave }: Props) {
  const [vars, setVars] = useState<KeyValue[]>(variables.length ? variables.map(v => ({ ...v })) : [newKV()])
  const [saving, setSaving] = useState(false)

  const update = (id: string, field: keyof KeyValue, value: string | boolean) => {
    setVars(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v))
  }

  const add = () => setVars(prev => [...prev, newKV()])

  const remove = (id: string) => {
    setVars(prev => {
      const next = prev.filter(v => v.id !== id)
      return next.length ? next : [newKV()]
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(vars.filter(v => v.key.trim()))
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="font-semibold text-zinc-100">{title}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X size={18} /></button>
        </div>

        <div className="p-4 flex flex-col gap-2 max-h-96 overflow-y-auto">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs text-zinc-500 px-1 mb-1">
            <span>Variable</span>
            <span>Value</span>
            <span />
          </div>
          {vars.map(v => (
            <div key={v.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <input
                value={v.key}
                onChange={e => update(v.id, 'key', e.target.value)}
                placeholder="variable_name"
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 font-mono placeholder-zinc-600 focus:outline-none focus:border-violet-500"
              />
              <input
                value={v.value}
                onChange={e => update(v.id, 'value', e.target.value)}
                placeholder="value"
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 font-mono placeholder-zinc-600 focus:outline-none focus:border-violet-500"
              />
              <button onClick={() => remove(v.id)} className="p-1 text-zinc-600 hover:text-red-400">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button
            onClick={add}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-violet-400 mt-1 transition-colors"
          >
            <Plus size={12} /> Add Variable
          </button>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-800">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
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
