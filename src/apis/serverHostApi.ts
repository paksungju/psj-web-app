import { getApiPrefix } from './apiPrefix'

const BASE = `${getApiPrefix()}/api/server`

export interface ServerHost {
  id: number
  label: string
  host: string
  port: number
  user: string
  ssh_key: string | null
  password: string | null
  sort_no: number
}

export interface ServerHostPayload {
  label: string
  host: string
  port: number
  user: string
  ssh_key?: string | null
  password?: string | null
  sort_no?: number
}

export async function fetchServerHostsApi(): Promise<ServerHost[]> {
  const res = await fetch(`${BASE}/hosts`)
  if (!res.ok) throw new Error('호스트 목록 조회 실패')
  return res.json()
}

export async function createServerHostApi(payload: ServerHostPayload): Promise<ServerHost> {
  const res = await fetch(`${BASE}/hosts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('호스트 등록 실패')
  return res.json()
}

export async function updateServerHostApi(
  id: number,
  payload: Partial<ServerHostPayload>,
): Promise<ServerHost> {
  const res = await fetch(`${BASE}/hosts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('호스트 수정 실패')
  return res.json()
}

export async function deleteServerHostApi(id: number): Promise<void> {
  const res = await fetch(`${BASE}/hosts/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('호스트 삭제 실패')
}
