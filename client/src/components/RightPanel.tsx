import { useState, useEffect } from 'react'
import { Crosshair, Code2 } from 'lucide-react'
import { PayloadLibrary } from './PayloadLibrary'
import { DecoderPane } from './DecoderPane'

interface Props {
  isOpen: boolean
  decoderPayload?: { text: string; key: string } | null
  onInjectBody: (value: string) => void
  onAddParam: (value: string) => void
  onSaveEnvVar: (key: string, value: string) => void
}

export function RightPanel({ isOpen, decoderPayload, onInjectBody, onAddParam, onSaveEnvVar }: Props) {
  const [activeTab, setActiveTab] = useState<'payloads' | 'decoder'>('payloads')

  // Auto-switch to decoder tab when text is pushed in
  useEffect(() => {
    if (decoderPayload) setActiveTab('decoder')
  }, [decoderPayload])

  return (
    <aside
      style={{ width: isOpen ? 300 : 0, transition: 'width 200ms ease' }}
      className="flex-shrink-0 flex flex-col bg-zinc-900 border-l border-zinc-800 overflow-hidden"
    >
      {/* Tab bar */}
      <div className="flex border-b border-zinc-800 min-w-[300px]">
        <button
          onClick={() => setActiveTab('payloads')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
            activeTab === 'payloads'
              ? 'text-violet-400 border-b-2 border-violet-500'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Crosshair size={13} />
          Payloads
        </button>
        <button
          onClick={() => setActiveTab('decoder')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
            activeTab === 'decoder'
              ? 'text-violet-400 border-b-2 border-violet-500'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Code2 size={13} />
          Decoder
        </button>
      </div>

      <div className="flex-1 overflow-hidden min-w-[300px]">
        {activeTab === 'payloads' && (
          <PayloadLibrary
            onInjectBody={onInjectBody}
            onAddParam={onAddParam}
          />
        )}
        {activeTab === 'decoder' && (
          <DecoderPane
            externalText={decoderPayload?.text}
            externalKey={decoderPayload?.key}
            onInjectBody={onInjectBody}
            onAddParam={onAddParam}
            onSaveEnvVar={onSaveEnvVar}
          />
        )}
      </div>
    </aside>
  )
}
