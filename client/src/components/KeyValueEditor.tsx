import { Plus, Trash2 } from 'lucide-react'
import type { KeyValue } from '../types'

interface Props {
  rows: KeyValue[]
  onChange: (rows: KeyValue[]) => void
  placeholder?: { key?: string; value?: string }
  showDescription?: boolean
  readOnly?: boolean
}

const newRow = (): KeyValue => ({
  id: crypto.randomUUID(),
  key: '',
  value: '',
  enabled: true,
})

export function KeyValueEditor({ rows, onChange, placeholder, showDescription, readOnly }: Props) {
  const update = (id: string, field: keyof KeyValue, val: string | boolean) => {
    onChange(rows.map(r => r.id === id ? { ...r, [field]: val } : r))
  }

  const remove = (id: string) => {
    const next = rows.filter(r => r.id !== id)
    onChange(next.length ? next : [newRow()])
  }

  const add = () => onChange([...rows, newRow()])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
              <th className="w-8 py-2.5 px-2"></th>
              <th className="py-2.5 px-2 text-left font-medium">Key</th>
              <th className="py-2.5 px-2 text-left font-medium">Value</th>
              {showDescription && <th className="py-2.5 px-2 text-left font-medium">Description</th>}
              {!readOnly && <th className="w-8"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className={`border-b border-zinc-800/50 group ${!row.enabled ? 'opacity-40' : ''}`}>
                <td className="py-1.5 px-2">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={e => update(row.id, 'enabled', e.target.checked)}
                    disabled={readOnly}
                    className="accent-violet-600 cursor-pointer"
                  />
                </td>
                <td className="py-1 px-1">
                  <input
                    value={row.key}
                    onChange={e => update(row.id, 'key', e.target.value)}
                    placeholder={placeholder?.key ?? 'Key'}
                    readOnly={readOnly}
                    className="w-full bg-transparent text-zinc-300 placeholder-zinc-600 focus:outline-none focus:text-zinc-100 font-mono text-sm py-1.5 px-2 rounded hover:bg-zinc-800 focus:bg-zinc-800"
                  />
                </td>
                <td className="py-1 px-1">
                  <input
                    value={row.value}
                    onChange={e => update(row.id, 'value', e.target.value)}
                    placeholder={placeholder?.value ?? 'Value'}
                    readOnly={readOnly}
                    className="w-full bg-transparent text-zinc-300 placeholder-zinc-600 focus:outline-none focus:text-zinc-100 font-mono text-sm py-1.5 px-2 rounded hover:bg-zinc-800 focus:bg-zinc-800"
                  />
                </td>
                {showDescription && (
                  <td className="py-1 px-1">
                    <input
                      value={row.description ?? ''}
                      onChange={e => update(row.id, 'description', e.target.value)}
                      placeholder="Description"
                      readOnly={readOnly}
                      className="w-full bg-transparent text-zinc-400 placeholder-zinc-600 focus:outline-none focus:text-zinc-300 text-sm py-1.5 px-2 rounded hover:bg-zinc-800 focus:bg-zinc-800"
                    />
                  </td>
                )}
                {!readOnly && (
                  <td className="py-1 px-1">
                    <button
                      onClick={() => remove(row.id)}
                      className="p-1.5 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <div className="px-3 py-2.5 border-t border-zinc-800">
          <button
            onClick={add}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-violet-400 transition-colors"
          >
            <Plus size={13} />
            Add Row
          </button>
        </div>
      )}
    </div>
  )
}
