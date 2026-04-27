import { useState } from 'react'
import { X, Plus, Trash2, Check } from 'lucide-react'
import type { Environment, KeyValue } from '../types'
import { KeyValueEditor } from './KeyValueEditor'

const newKV = (): KeyValue => ({ id: crypto.randomUUID(), key: '', value: '', enabled: true })

interface Props {
  environments: Environment[]
  initialId?: string | null
  onClose: () => void
  onCreate: (name: string, variables: KeyValue[]) => Promise<void>
  onUpdate: (id: string, name: string, variables: KeyValue[]) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function initFromId(environments: Environment[], id: string | null | undefined) {
  const env = environments.find(e => e.id === id) ?? environments[0] ?? null
  return {
    id: env?.id ?? null,
    name: env?.name ?? '',
    vars: env?.variables?.length ? env.variables : [newKV()],
  }
}

export function EnvironmentModal({ environments, initialId, onClose, onCreate, onUpdate, onDelete }: Props) {
  const init = initFromId(environments, initialId)
  const [selectedId, setSelectedId] = useState<string | null>(init.id)
  const [newName, setNewName] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editName, setEditName] = useState<string>(init.name)
  const [editVars, setEditVars] = useState<KeyValue[]>(init.vars)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const selected = environments.find(e => e.id === selectedId) ?? null

  const selectEnv = (env: Environment) => {
    setSelectedId(env.id)
    setEditName(env.name)
    setEditVars(env.variables.length ? env.variables : [newKV()])
    setDirty(false)
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    await onCreate(newName.trim(), [newKV()])
    setNewName('')
    setShowNew(false)
    // Select the newly created env (it'll be last in the list after state updates)
  }

  const handleSave = async () => {
    if (!selectedId) return
    setSaving(true)
    await onUpdate(selectedId, editName, editVars.filter(v => v.key))
    setSaving(false)
    setDirty(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this environment?')) return
    await onDelete(id)
    setSelectedId(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-3xl max-w-5xl w-full mx-4 flex flex-col" style={{ height: 560 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="font-semibold text-zinc-100">Manage Environments</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Environment list */}
          <div className="w-52 border-r border-zinc-800 flex flex-col">
            <div className="flex-1 overflow-y-auto py-2">
              {environments.map(env => (
                <button
                  key={env.id}
                  onClick={() => selectEnv(env)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between group transition-colors ${
                    selectedId === env.id ? 'bg-violet-600/20 text-violet-300' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  <span className="truncate">{env.name}</span>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(env.id) }}
                    className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </button>
              ))}
            </div>
            <div className="p-2 border-t border-zinc-800">
              {showNew ? (
                <div className="flex gap-1">
                  <input
                    autoFocus
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNew(false) }}
                    placeholder="Name..."
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
                  />
                  <button onClick={handleCreate} className="p-1 text-emerald-400 hover:text-emerald-300">
                    <Check size={13} />
                  </button>
                  <button onClick={() => setShowNew(false)} className="p-1 text-zinc-500 hover:text-zinc-300">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNew(true)}
                  className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-zinc-500 hover:text-violet-400 border border-dashed border-zinc-700 hover:border-violet-600 rounded transition-colors"
                >
                  <Plus size={11} />
                  New Environment
                </button>
              )}
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selected ? (
              <>
                <div className="px-4 py-3 border-b border-zinc-800">
                  <input
                    value={editName}
                    onChange={e => { setEditName(e.target.value); setDirty(true) }}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div className="flex-1 overflow-hidden">
                  <KeyValueEditor
                    rows={editVars}
                    onChange={rows => { setEditVars(rows); setDirty(true) }}
                    placeholder={{ key: 'VARIABLE', value: 'value' }}
                  />
                </div>
                <div className="px-4 py-3 border-t border-zinc-800 flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={!dirty || saving}
                    className="flex items-center gap-2 px-4 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded font-medium transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                Select or create an environment
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
