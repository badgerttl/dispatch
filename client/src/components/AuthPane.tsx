import type { AuthConfig, AuthType } from '../types'

interface Props {
  auth: AuthConfig
  onChange: (auth: AuthConfig) => void
}

const AUTH_TYPES: { value: AuthType; label: string; desc: string }[] = [
  { value: 'none', label: 'None', desc: 'No authentication' },
  { value: 'bearer', label: 'Bearer Token', desc: 'Authorization: Bearer <token>' },
  { value: 'basic', label: 'Basic Auth', desc: 'Authorization: Basic base64(user:pass)' },
  { value: 'api-key', label: 'API Key', desc: 'Custom key injected as header or query param' },
]

const input = "w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500"
const label = "text-xs text-zinc-500 mb-1"

export function AuthPane({ auth, onChange }: Props) {
  const set = (partial: Partial<AuthConfig>) => onChange({ ...auth, ...partial })

  return (
    <div className="p-4 flex flex-col gap-4 overflow-auto h-full">
      {/* Type selector */}
      <div className="flex gap-2 flex-wrap">
        {AUTH_TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => set({ type: t.value })}
            title={t.desc}
            className={`px-3 py-1 text-xs rounded border transition-colors ${
              auth.type === t.value
                ? 'bg-violet-600/20 text-violet-400 border-violet-600/50'
                : 'text-zinc-500 border-zinc-700 hover:text-zinc-300 hover:border-zinc-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Bearer */}
      {auth.type === 'bearer' && (
        <div className="flex flex-col gap-1.5">
          <div className={label}>Token</div>
          <input
            value={auth.bearer ?? ''}
            onChange={e => set({ bearer: e.target.value })}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            className={input}
          />
          <p className="text-xs text-zinc-600 mt-0.5">
            Sends <span className="font-mono text-zinc-500">Authorization: Bearer &lt;token&gt;</span>. Supports <span className="font-mono text-zinc-500">{'{{ENV_VAR}}'}</span>.
          </p>
        </div>
      )}

      {/* Basic */}
      {auth.type === 'basic' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className={label}>Username</div>
            <input
              value={auth.basic?.username ?? ''}
              onChange={e => set({ basic: { ...auth.basic, username: e.target.value, password: auth.basic?.password ?? '' } })}
              placeholder="username"
              className={input}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className={label}>Password</div>
            <input
              type="password"
              value={auth.basic?.password ?? ''}
              onChange={e => set({ basic: { username: auth.basic?.username ?? '', ...auth.basic, password: e.target.value } })}
              placeholder="••••••••"
              className={input}
            />
          </div>
          {auth.basic?.username && (
            <p className="text-xs text-zinc-600">
              Sends <span className="font-mono text-zinc-500 break-all">Authorization: Basic {btoa(`${auth.basic.username}:${auth.basic.password ?? ''}`)}</span>
            </p>
          )}
        </div>
      )}

      {/* API Key */}
      {auth.type === 'api-key' && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <div className={label}>Key name</div>
              <input
                value={auth.apiKey?.key ?? ''}
                onChange={e => set({ apiKey: { ...auth.apiKey, key: e.target.value, value: auth.apiKey?.value ?? '', in: auth.apiKey?.in ?? 'header' } })}
                placeholder="X-API-Key"
                className={input}
              />
            </div>
            <div className="flex flex-col gap-1.5 w-32">
              <div className={label}>Add to</div>
              <select
                value={auth.apiKey?.in ?? 'header'}
                onChange={e => set({ apiKey: { ...auth.apiKey, key: auth.apiKey?.key ?? '', value: auth.apiKey?.value ?? '', in: e.target.value as 'header' | 'query' } })}
                className={input + ' cursor-pointer'}
              >
                <option value="header">Header</option>
                <option value="query">Query</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className={label}>Value</div>
            <input
              value={auth.apiKey?.value ?? ''}
              onChange={e => set({ apiKey: { key: auth.apiKey?.key ?? '', in: auth.apiKey?.in ?? 'header', ...auth.apiKey, value: e.target.value } })}
              placeholder="your-api-key"
              className={input}
            />
          </div>
        </div>
      )}

      {auth.type === 'none' && (
        <p className="text-xs text-zinc-600">No auth header will be added. Set headers manually in the Headers tab.</p>
      )}
    </div>
  )
}
