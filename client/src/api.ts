import axios from 'axios'
import type { Collection, Environment, Folder, HistoryItem, KeyValue, HttpMethod, BodyType, ResponseData, Settings } from './types'

const http = axios.create({ baseURL: '/api' })

export const getCollections = () => http.get<Collection[]>('/collections').then(r => r.data)
export const createCollection = (name: string, description = '') =>
  http.post<Collection>('/collections', { name, description }).then(r => r.data)
export const updateCollection = (id: string, name: string, description: string, variables: KeyValue[]) =>
  http.put(`/collections/${id}`, { name, description, variables }).then(r => r.data)
export const deleteCollection = (id: string) =>
  http.delete(`/collections/${id}`).then(r => r.data)

export const saveRequest = (data: {
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
}) => http.post('/requests', data).then(r => r.data)

export const deleteRequest = (id: string) =>
  http.delete(`/requests/${id}`).then(r => r.data)

export const moveRequest = (id: string, data: { collection_id: string; folder_id: string | null }) =>
  http.patch(`/requests/${id}/move`, data).then(r => r.data)

export const moveFolder = (id: string, data: { collection_id: string; parent_folder_id: string | null }) =>
  http.patch(`/folders/${id}/move`, data).then(r => r.data)

export const createFolder = (data: { collection_id: string; parent_folder_id?: string | null; name: string }) =>
  http.post<Folder>('/folders', data).then(r => r.data)
export const deleteFolder = (id: string) => http.delete(`/folders/${id}`).then(r => r.data)

export const exportCollection = (id: string) =>
  http.get(`/collections/${id}/export`).then(r => r.data)

export const getGlobalVars = () => http.get<KeyValue[]>('/global-vars').then(r => r.data)
export const updateGlobalVars = (variables: KeyValue[]) =>
  http.put('/global-vars', { variables }).then(r => r.data)

export const getHistory = () => http.get<HistoryItem[]>('/history').then(r => r.data)
export const renameHistoryItem = (id: string, name: string) =>
  http.patch(`/history/${id}`, { name }).then(r => r.data)
export const clearHistory = () => http.delete('/history').then(r => r.data)

export const getEnvironments = () => http.get<Environment[]>('/environments').then(r => r.data)
export const createEnvironment = (name: string, variables: KeyValue[]) =>
  http.post<Environment>('/environments', { name, variables }).then(r => r.data)
export const updateEnvironment = (id: string, name: string, variables: KeyValue[]) =>
  http.put(`/environments/${id}`, { name, variables }).then(r => r.data)
export const deleteEnvironment = (id: string) =>
  http.delete(`/environments/${id}`).then(r => r.data)

export const previewImport = (data: { content?: string; url?: string }) =>
  http.post<{ name: string; count: number }>('/import/preview', data).then(r => r.data)
export const importCollection = (data: { content?: string; url?: string }) =>
  http.post<Collection>('/import', data).then(r => r.data)

export const getSettings = () => http.get<Settings>('/settings').then(r => r.data)
export const updateSettings = (data: Partial<Settings>) =>
  http.put('/settings', data).then(r => r.data)

export const sendProxyRequest = (data: {
  method: HttpMethod
  url: string
  headers: KeyValue[]
  params: KeyValue[]
  body: string
  body_type: BodyType
  environment_variables: Record<string, string>
  global_variables: Record<string, string>
  collection_variables: Record<string, string>
  pre_script: string
  post_script: string
}) => http.post<ResponseData>('/proxy', data).then(r => r.data)
