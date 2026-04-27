import { useState, useMemo } from 'react'
import { X, Plus, Check } from 'lucide-react'
import type { Collection, Folder } from '../types'

interface Props {
  collections: Collection[]
  onClose: () => void
  onSave: (collectionId: string, folderId: string | null, name: string) => Promise<void>
  onCreateCollection: (name: string, description: string) => Promise<Collection>
}

function flatFolders(folders: Folder[], depth = 0): { folder: Folder; depth: number }[] {
  return folders.flatMap(f => [{ folder: f, depth }, ...flatFolders(f.subfolders, depth + 1)])
}

export function SaveModal({ collections, onClose, onSave, onCreateCollection }: Props) {
  const [requestName, setRequestName] = useState('')
  const [selectedCollectionId, setSelectedCollectionId] = useState(collections[0]?.id ?? '')
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')
  const [showNewCollection, setShowNewCollection] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedCollection = collections.find(c => c.id === selectedCollectionId)
  const folderOptions = useMemo(() => {
    if (!selectedCollection) return []
    return flatFolders(selectedCollection.folders)
  }, [selectedCollection])

  const handleCollectionChange = (id: string) => {
    setSelectedCollectionId(id)
    setSelectedFolderId('')
  }

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return
    const col = await onCreateCollection(newCollectionName.trim(), '')
    setSelectedCollectionId(col.id)
    setSelectedFolderId('')
    setNewCollectionName('')
    setShowNewCollection(false)
  }

  const handleSave = async () => {
    if (!requestName.trim() || !selectedCollectionId) return
    setSaving(true)
    try {
      await onSave(selectedCollectionId, selectedFolderId || null, requestName.trim())
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="font-semibold text-zinc-100">Save Request</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Request Name</label>
            <input
              autoFocus
              value={requestName}
              onChange={e => setRequestName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Get all users"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Collection</label>
            {collections.length === 0 && !showNewCollection ? (
              <p className="text-xs text-zinc-500 mb-2">No collections yet — create one below.</p>
            ) : (
              <select
                value={selectedCollectionId}
                onChange={e => handleCollectionChange(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500 mb-2"
              >
                {collections.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}

            {showNewCollection ? (
              <div className="flex gap-2 mb-2">
                <input
                  autoFocus
                  value={newCollectionName}
                  onChange={e => setNewCollectionName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateCollection(); if (e.key === 'Escape') setShowNewCollection(false) }}
                  placeholder="Collection name..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                />
                <button onClick={handleCreateCollection} className="p-2 text-emerald-400 hover:text-emerald-300">
                  <Check size={15} />
                </button>
                <button onClick={() => setShowNewCollection(false)} className="p-2 text-zinc-500 hover:text-zinc-300">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewCollection(true)}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-violet-400 transition-colors mb-2"
              >
                <Plus size={12} />
                New Collection
              </button>
            )}
          </div>

          {folderOptions.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Folder (optional)</label>
              <select
                value={selectedFolderId}
                onChange={e => setSelectedFolderId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
              >
                <option value="">— None (root) —</option>
                {folderOptions.map(({ folder, depth }) => (
                  <option key={folder.id} value={folder.id}>
                    {'  '.repeat(depth)}{depth > 0 ? '└ ' : ''}{folder.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!requestName.trim() || !selectedCollectionId || saving}
            className="px-4 py-1.5 text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-medium transition-colors"
          >
            {saving ? 'Saving...' : 'Save Request'}
          </button>
        </div>
      </div>
    </div>
  )
}
