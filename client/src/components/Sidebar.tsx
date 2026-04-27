import { useState, useRef } from 'react'
import {
  ChevronRight, ChevronDown, Plus, Trash2, FolderOpen, Folder, Clock,
  X, Check, MoreHorizontal, Upload, Pencil, Play, Download, Variable
} from 'lucide-react'
import type { Collection, Folder as FolderType, HistoryItem, SavedRequest } from '../types'

const METHOD_COLORS: Record<string, string> = {
  GET: '#4ade80', POST: '#60a5fa', PUT: '#fb923c',
  PATCH: '#facc15', DELETE: '#f87171', HEAD: '#c084fc', OPTIONS: '#22d3ee',
}

function statusClass(status: number) {
  if (status === 0) return 'text-red-400'
  if (status < 300) return 'text-emerald-400'
  if (status < 400) return 'text-blue-400'
  if (status < 500) return 'text-amber-400'
  return 'text-red-400'
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatTime(ms: number) {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function countRequests(col: Collection): number {
  const countFolder = (f: FolderType): number =>
    f.requests.length + f.subfolders.reduce((acc, sf) => acc + countFolder(sf), 0)
  return col.requests.length + col.folders.reduce((acc, f) => acc + countFolder(f), 0)
}

interface Props {
  isOpen: boolean
  collections: Collection[]
  history: HistoryItem[]
  onLoadRequest: (req: SavedRequest | HistoryItem) => void
  onCreateCollection: (name: string, description: string) => Promise<Collection>
  onDeleteCollection: (id: string) => void
  onDeleteRequest: (id: string, collectionId: string) => void
  onClearHistory: () => void
  onRenameHistory: (id: string, name: string) => Promise<void>
  onImport: () => void
  onCreateFolder: (data: { collection_id: string; parent_folder_id?: string | null; name: string }) => Promise<FolderType>
  onDeleteFolder: (id: string, collectionId: string) => void
  onEditCollectionVars: (col: Collection) => void
  onRunCollection: (col: Collection) => void
  onExportCollection: (col: Collection) => void
}

export function Sidebar({
  isOpen,
  collections, history, onLoadRequest,
  onCreateCollection, onDeleteCollection, onDeleteRequest, onClearHistory, onRenameHistory, onImport,
  onCreateFolder, onDeleteFolder, onEditCollectionVars, onRunCollection, onExportCollection,
}: Props) {
  const [activeTab, setActiveTab] = useState<'collections' | 'history'>('collections')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [newCollectionName, setNewCollectionName] = useState('')
  const [showNewCollection, setShowNewCollection] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)
  const [addingFolderTo, setAddingFolderTo] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedFolders(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const startRename = (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenamingId(item.id)
    setRenameVal(item.name || '')
    setTimeout(() => renameRef.current?.select(), 0)
  }

  const commitRename = async (id: string) => {
    await onRenameHistory(id, renameVal.trim())
    setRenamingId(null)
  }

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return
    const col = await onCreateCollection(newCollectionName.trim(), '')
    setExpanded(prev => new Set([...prev, col.id]))
    setNewCollectionName('')
    setShowNewCollection(false)
  }

  const handleCreateFolder = async (collectionId: string, parentFolderId: string | null) => {
    if (!newFolderName.trim()) return
    const folder = await onCreateFolder({ collection_id: collectionId, parent_folder_id: parentFolderId, name: newFolderName.trim() })
    setExpandedFolders(prev => new Set([...prev, folder.id]))
    setNewFolderName('')
    setAddingFolderTo(null)
  }

  const renderRequest = (req: SavedRequest, col: Collection) => (
    <div
      key={req.id}
      className="group flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-800 cursor-pointer rounded mx-1"
      onClick={() => onLoadRequest(req)}
    >
      <span
        className="text-xs font-mono font-bold flex-shrink-0 w-12 text-right"
        style={{ color: METHOD_COLORS[req.method] ?? '#a1a1aa' }}
      >
        {req.method}
      </span>
      <span className="flex-1 text-xs text-zinc-400 truncate">{req.name}</span>
      <button
        onClick={e => { e.stopPropagation(); onDeleteRequest(req.id, col.id) }}
        className="p-0.5 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 size={11} />
      </button>
    </div>
  )

  const renderFolder = (folder: FolderType, col: Collection, depth: number) => {
    const folderOpen = expandedFolders.has(folder.id)
    const addKey = `${col.id}/${folder.id}`
    return (
      <div key={folder.id}>
        <div
          className="group flex items-center gap-1 px-2 py-1.5 hover:bg-zinc-800 cursor-pointer"
          style={{ paddingLeft: `${(depth + 1) * 12}px` }}
          onClick={e => toggleFolder(folder.id, e)}
        >
          <span className="text-zinc-500 flex-shrink-0">
            {folderOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          <Folder size={12} className="text-amber-400 flex-shrink-0" />
          <span className="flex-1 text-xs text-zinc-400 truncate">{folder.name}</span>
          <button
            onClick={e => { e.stopPropagation(); setAddingFolderTo(addKey); setNewFolderName('') }}
            className="p-0.5 text-zinc-600 hover:text-violet-400 opacity-0 group-hover:opacity-100 transition-all"
            title="New subfolder"
          >
            <Plus size={11} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDeleteFolder(folder.id, col.id) }}
            className="p-0.5 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
            title="Delete folder"
          >
            <Trash2 size={11} />
          </button>
        </div>
        {folderOpen && (
          <div>
            {addingFolderTo === addKey && (
              <div className="flex gap-1 px-2 py-1" style={{ paddingLeft: `${(depth + 2) * 12}px` }}>
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateFolder(col.id, folder.id)
                    if (e.key === 'Escape') { setAddingFolderTo(null); setNewFolderName('') }
                  }}
                  placeholder="Folder name..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
                />
                <button onClick={() => handleCreateFolder(col.id, folder.id)} className="p-0.5 text-emerald-400"><Check size={12} /></button>
                <button onClick={() => { setAddingFolderTo(null); setNewFolderName('') }} className="p-0.5 text-zinc-500"><X size={12} /></button>
              </div>
            )}
            {folder.subfolders.map(sf => renderFolder(sf, col, depth + 1))}
            <div style={{ paddingLeft: `${(depth + 1) * 12}px` }}>
              {folder.requests.map(req => renderRequest(req, col))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <aside
      style={{ width: isOpen ? 272 : 0, transition: 'width 200ms ease' }}
      className="flex-shrink-0 flex flex-col bg-zinc-900 border-r border-zinc-800 overflow-hidden"
    >
      {/* Tab bar */}
      <div className="flex border-b border-zinc-800 min-w-[272px]">
        <button
          onClick={() => setActiveTab('collections')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
            activeTab === 'collections'
              ? 'text-violet-400 border-b-2 border-violet-500'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <FolderOpen size={13} />
          Collections
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
            activeTab === 'history'
              ? 'text-violet-400 border-b-2 border-violet-500'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Clock size={13} />
          History
        </button>
      </div>

      {/* Collections tab */}
      {activeTab === 'collections' && (
        <div className="flex flex-col flex-1 overflow-hidden min-w-[272px]">
          <div className="p-2 border-b border-zinc-800">
            {showNewCollection ? (
              <div className="flex gap-1.5">
                <input
                  autoFocus
                  value={newCollectionName}
                  onChange={e => setNewCollectionName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateCollection()
                    if (e.key === 'Escape') { setShowNewCollection(false); setNewCollectionName('') }
                  }}
                  placeholder="Collection name..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
                />
                <button onClick={handleCreateCollection} className="p-1 text-emerald-400 hover:text-emerald-300">
                  <Check size={14} />
                </button>
                <button onClick={() => { setShowNewCollection(false); setNewCollectionName('') }} className="p-1 text-zinc-500 hover:text-zinc-300">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <button
                  onClick={() => setShowNewCollection(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-zinc-500 hover:text-violet-400 border border-dashed border-zinc-700 hover:border-violet-600 rounded transition-colors"
                >
                  <Plus size={12} />
                  New
                </button>
                <button
                  onClick={onImport}
                  title="Import Postman / OpenAPI / Swagger"
                  className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-500 hover:text-violet-400 border border-dashed border-zinc-700 hover:border-violet-600 rounded transition-colors"
                >
                  <Upload size={12} />
                  Import
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {collections.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-zinc-600 text-xs gap-2">
                <FolderOpen size={24} />
                <span>No collections yet</span>
              </div>
            ) : (
              collections.map(col => (
                <div key={col.id}>
                  <div
                    className="group flex items-center gap-1 px-2 py-1.5 hover:bg-zinc-800 cursor-pointer"
                    onClick={() => toggleExpand(col.id)}
                  >
                    <span className="text-zinc-500 flex-shrink-0">
                      {expanded.has(col.id) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </span>
                    <FolderOpen size={13} className="text-violet-400 flex-shrink-0" />
                    <span className="flex-1 text-xs font-medium text-zinc-300 truncate">{col.name}</span>
                    <span className="text-zinc-600 text-xs">{countRequests(col)}</span>
                    <div className="relative">
                      <button
                        onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === col.id ? null : col.id) }}
                        className="p-0.5 text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-all rounded"
                      >
                        <MoreHorizontal size={13} />
                      </button>
                      {openMenu === col.id && (
                        <div className="absolute right-0 top-6 z-50 bg-zinc-800 border border-zinc-700 rounded shadow-xl min-w-40 py-1"
                          onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => { setAddingFolderTo(col.id); setNewFolderName(''); setOpenMenu(null); setExpanded(prev => new Set([...prev, col.id])) }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
                          >
                            <Plus size={11} /> New Folder
                          </button>
                          <button
                            onClick={() => { onRunCollection(col); setOpenMenu(null) }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
                          >
                            <Play size={11} /> Run Collection
                          </button>
                          <button
                            onClick={() => { onEditCollectionVars(col); setOpenMenu(null) }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
                          >
                            <Variable size={11} /> Edit Variables
                          </button>
                          <button
                            onClick={() => { onExportCollection(col); setOpenMenu(null) }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
                          >
                            <Download size={11} /> Export
                          </button>
                          <div className="border-t border-zinc-700 my-1" />
                          <button
                            onClick={() => { onDeleteCollection(col.id); setOpenMenu(null) }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-zinc-700"
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {expanded.has(col.id) && (
                    <div className="pl-6">
                      {addingFolderTo === col.id && (
                        <div className="flex gap-1 px-2 py-1">
                          <input
                            autoFocus
                            value={newFolderName}
                            onChange={e => setNewFolderName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleCreateFolder(col.id, null)
                              if (e.key === 'Escape') { setAddingFolderTo(null); setNewFolderName('') }
                            }}
                            placeholder="Folder name..."
                            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-200 focus:outline-none focus:border-violet-500"
                          />
                          <button onClick={() => handleCreateFolder(col.id, null)} className="p-0.5 text-emerald-400"><Check size={12} /></button>
                          <button onClick={() => { setAddingFolderTo(null); setNewFolderName('') }} className="p-0.5 text-zinc-500"><X size={12} /></button>
                        </div>
                      )}
                      {col.folders.map(folder => renderFolder(folder, col, 0))}
                      {col.requests.length === 0 && col.folders.length === 0 && addingFolderTo !== col.id ? (
                        <div className="py-1.5 px-2 text-zinc-600 text-xs">No requests</div>
                      ) : (
                        col.requests.map(req => renderRequest(req, col))
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <div className="flex flex-col flex-1 overflow-hidden min-w-[272px]">
          <div className="p-2 border-b border-zinc-800 flex justify-end">
            <button
              onClick={onClearHistory}
              disabled={history.length === 0}
              className="text-xs text-zinc-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Clear all
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-zinc-600 text-xs gap-2">
                <Clock size={24} />
                <span>No history yet</span>
              </div>
            ) : (
              history.map(item => (
                <div
                  key={item.id}
                  className="group flex flex-col gap-0.5 px-3 py-2 hover:bg-zinc-800 cursor-pointer border-b border-zinc-800/50"
                  onClick={() => renamingId !== item.id && onLoadRequest(item)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-mono font-bold flex-shrink-0 w-12"
                      style={{ color: METHOD_COLORS[item.method] ?? '#a1a1aa' }}
                    >
                      {item.method}
                    </span>
                    {item.status > 0 && (
                      <span className={`text-xs font-mono font-medium ${statusClass(item.status)}`}>
                        {item.status}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-zinc-600">{timeAgo(item.created_at)}</span>
                    <button
                      onClick={e => startRename(item, e)}
                      className="p-0.5 text-zinc-600 hover:text-violet-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                      title="Rename"
                    >
                      <Pencil size={10} />
                    </button>
                  </div>
                  {renamingId === item.id ? (
                    <input
                      ref={renameRef}
                      value={renameVal}
                      onChange={e => setRenameVal(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.stopPropagation(); commitRename(item.id) }
                        if (e.key === 'Escape') { e.stopPropagation(); setRenamingId(null) }
                      }}
                      onClick={e => e.stopPropagation()}
                      placeholder="Name this request..."
                      className="text-xs bg-zinc-700 border border-violet-500 rounded px-2 py-0.5 text-zinc-200 focus:outline-none ml-14"
                      autoFocus
                    />
                  ) : (
                    item.name
                      ? <div className="text-xs text-violet-300 truncate pl-14">{item.name}</div>
                      : null
                  )}
                  <div className="text-xs text-zinc-500 truncate font-mono pl-14">{item.url}</div>
                  {item.status > 0 && (
                    <div className="flex gap-3 pl-14 text-xs text-zinc-600">
                      <span>{formatTime(item.duration)}</span>
                      <span>{formatSize(item.size)}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {openMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
      )}
    </aside>
  )
}
