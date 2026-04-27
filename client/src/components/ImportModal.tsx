import { useState, useRef } from 'react'
import { X, Upload, Link2, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import type { Collection } from '../types'
import * as api from '../api'

interface Props {
  onClose: () => void
  onImport: (collection: Collection) => void
}

interface Preview { name: string; count: number }

export function ImportModal({ onClose, onImport }: Props) {
  const [tab, setTab] = useState<'file' | 'url'>('file')
  const [content, setContent] = useState('')
  const [importUrl, setImportUrl] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => { setPreview(null); setError('') }

  const fetchPreview = async (c: string, u: string) => {
    setPreviewing(true)
    setError('')
    setPreview(null)
    try {
      const result = await api.previewImport(c ? { content: c } : { url: u })
      setPreview(result)
    } catch (err: any) {
      setError(err.response?.data?.error ?? err.message)
    } finally {
      setPreviewing(false)
    }
  }

  const handleFile = async (file: File) => {
    const text = await file.text()
    setContent(text)
    setImportUrl('')
    fetchPreview(text, '')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const col = await api.importCollection(content ? { content } : { url: importUrl })
      onImport(col)
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.error ?? err.message)
    } finally {
      setImporting(false)
    }
  }

  const tabCls = (t: 'file' | 'url') =>
    `flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm rounded-md transition-colors ${
      tab === t ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
    }`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="font-semibold text-zinc-100">Import Collection</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X size={18} /></button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg">
            <button onClick={() => { setTab('file'); reset() }} className={tabCls('file')}>
              <Upload size={13} /> File
            </button>
            <button onClick={() => { setTab('url'); reset() }} className={tabCls('url')}>
              <Link2 size={13} /> URL
            </button>
          </div>

          {/* File upload */}
          {tab === 'file' && (
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onClick={() => fileRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                dragging
                  ? 'border-violet-500 bg-violet-500/10'
                  : preview
                    ? 'border-emerald-600/50 bg-emerald-500/5'
                    : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
              }`}
            >
              {previewing ? (
                <Loader2 size={28} className="animate-spin text-violet-400" />
              ) : (
                <FileText size={28} className={preview ? 'text-emerald-400' : 'text-zinc-500'} />
              )}
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-300">
                  {previewing ? 'Parsing…' : preview ? 'File loaded' : 'Drop a file or click to browse'}
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  Postman Collection v2.x · OpenAPI 3.x · Swagger 2.x · JSON or YAML
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".json,.yaml,.yml"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          )}

          {/* URL */}
          {tab === 'url' && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  value={importUrl}
                  onChange={e => { setImportUrl(e.target.value); reset() }}
                  onKeyDown={e => e.key === 'Enter' && importUrl.trim() && fetchPreview('', importUrl)}
                  placeholder="https://api.example.com/openapi.json"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500"
                />
                <button
                  onClick={() => fetchPreview('', importUrl)}
                  disabled={!importUrl.trim() || previewing}
                  className="px-4 py-2 text-sm bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-zinc-200 rounded transition-colors flex items-center gap-2"
                >
                  {previewing ? <Loader2 size={13} className="animate-spin" /> : null}
                  {previewing ? 'Fetching…' : 'Fetch'}
                </button>
              </div>
              <p className="text-xs text-zinc-600">
                Works with Swagger UI's <span className="font-mono text-zinc-500">/api-docs</span>, raw GitHub links, and any public OpenAPI/Postman URL.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-300 font-mono">{error}</p>
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{preview.name}</p>
                <p className="text-xs text-zinc-500">{preview.count} request{preview.count !== 1 ? 's' : ''} detected</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-800">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!preview || importing}
            className="flex items-center gap-2 px-4 py-1.5 text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-medium transition-colors"
          >
            {importing && <Loader2 size={13} className="animate-spin" />}
            {importing ? 'Importing…' : `Import ${preview ? `(${preview.count})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
