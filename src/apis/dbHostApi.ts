import { getApiPrefix } from './apiPrefix'

const BASE = `${getApiPrefix()}/api/server`

export interface DbHost {
  id: number
  label: string
  host: string
  port: number
  db_name: string
  db_user: string
  db_password: string | null
  sort_no: number
}

export interface DbHostPayload {
  label: string
  host: string
  port: number
  db_name: string
  db_user: string
  db_password?: string | null
  sort_no?: number
}

export async function fetchDbHostsApi(): Promise<DbHost[]> {
  const res = await fetch(`${BASE}/db-hosts`)
  if (!res.ok) throw new Error('DB 연결 목록 조회 실패')
  return res.json()
}

export async function createDbHostApi(payload: DbHostPayload): Promise<DbHost> {
  const res = await fetch(`${BASE}/db-hosts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('DB 연결 등록 실패')
  return res.json()
}

export async function updateDbHostApi(
  id: number,
  payload: Partial<DbHostPayload>,
): Promise<DbHost> {
  const res = await fetch(`${BASE}/db-hosts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('DB 연결 수정 실패')
  return res.json()
}

export async function deleteDbHostApi(id: number): Promise<void> {
  const res = await fetch(`${BASE}/db-hosts/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('DB 연결 삭제 실패')
}

export async function testDbHostApi(id: number): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${BASE}/db-hosts/${id}/test`, { method: 'POST' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { detail?: string }).detail || '연결 테스트 실패')
  }
  return data
}
