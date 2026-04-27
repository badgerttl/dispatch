export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
export type BodyType = 'json' | 'xml' | 'text' | 'form-data' | 'urlencoded' | 'graphql' | 'none'

export type AuthType = 'none' | 'bearer' | 'basic' | 'api-key'
export interface AuthConfig {
  type: AuthType
  bearer?: string
  basic?: { username: string; password: string }
  apiKey?: { key: string; value: string; in: 'header' | 'query' }
}

export interface WsMessage {
  id: string
  dir: 'sent' | 'received'
  data: string
  ts: number
}

export interface KeyValue {
  id: string
  key: string
  value: string
  enabled: boolean
  description?: string
}

export interface SavedRequest {
  id: string
  collection_id: string
  folder_id?: string | null
  name: string
  method: HttpMethod
  url: string
  headers: KeyValue[]
  params: KeyValue[]
  body: string
  body_type: BodyType
  pre_script: string
  post_script: string
  created_at: string
}

export interface Folder {
  id: string
  collection_id: string
  parent_folder_id: string | null
  name: string
  requests: SavedRequest[]
  subfolders: Folder[]
  created_at: string
}

export interface Collection {
  id: string
  name: string
  description: string
  variables: KeyValue[]
  folders: Folder[]
  requests: SavedRequest[]
  created_at: string
}

export interface Environment {
  id: string
  name: string
  variables: KeyValue[]
  created_at: string
}

export interface HistoryItem {
  id: string
  name?: string
  method: HttpMethod
  url: string
  headers: KeyValue[]
  params: KeyValue[]
  body: string
  body_type: BodyType
  status: number
  duration: number
  size: number
  response_body: string
  response_headers: Record<string, string>
  raw_request?: string
  raw_response?: string
  created_at: string
}

export interface ScriptResult {
  logs: string[]
  tests?: { name: string; passed: boolean }[]
  error?: string
  env?: Record<string, string>
}

export interface ResponseData {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  duration: number
  size: number
  error?: string
  raw_request?: string
  raw_response?: string
  pre_script_result?: ScriptResult
  post_script_result?: ScriptResult
}

export interface RequestTab {
  id: string
  name: string
  isRenamed: boolean
  method: HttpMethod
  url: string
  headers: KeyValue[]
  params: KeyValue[]
  body: string
  bodyType: BodyType
  auth: AuthConfig
  preScript: string
  postScript: string
  response: ResponseData | null
  loading: boolean
  sourceCollectionId?: string
  // WebSocket
  wsConnected: boolean
  wsMessages: WsMessage[]
}

export interface ProxyConfig {
  enabled: boolean
  url: string
  bypass: string
}

export interface Settings {
  proxy: ProxyConfig
}
