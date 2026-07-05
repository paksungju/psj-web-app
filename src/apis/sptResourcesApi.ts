export interface SptResourceRow {
  crId: number
  subject: string
  content: string | null
  coType: string | null
  imgUrl: string | null
  weight: number
  heigth: number
  linkUrl: string | null
  useYn: number | null
  delYn: number | null
  inUserId?: number | null
  inDatetime?: string | null
  upUserId?: number | null
  upDatetime?: string | null
}

export type SptResourcePayload = {
  subject: string
  content?: string | null
  co_type?: string | null
  img_url?: string | null
  weight: number
  heigth: number
  link_url?: string | null
  use_yn?: number | null
  in_user_id?: number | null
  up_user_id?: number | null
}

const BASE = '/api/v1/spt/resources'
const DEFAULT_USER_ID = 1

export async function fetchSptResourcesApi(params?: {
  co_type?: string
  limit?: number
}): Promise<SptResourceRow[]> {
  const q = new URLSearchParams()
  if (params?.co_type) q.set('co_type', params.co_type)
  if (params?.limit != null) q.set('limit', String(params.limit))
  const suffix = q.toString() ? `?${q}` : ''
  const response = await fetch(`${BASE}${suffix}`)
  if (!response.ok) throw new Error('리소스 목록 조회에 실패했습니다.')
  const data = (await response.json()) as { items: SptResourceRow[] }
  return data.items ?? []
}

export async function fetchSptResourceByIdApi(crId: number): Promise<SptResourceRow> {
  const response = await fetch(`${BASE}/${crId}`)
  if (!response.ok) throw new Error('리소스 조회에 실패했습니다.')
  return (await response.json()) as SptResourceRow
}

export async function createSptResourceApi(payload: SptResourcePayload): Promise<SptResourceRow> {
  const response = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      in_user_id: payload.in_user_id ?? DEFAULT_USER_ID,
    }),
  })
  if (!response.ok) throw new Error('리소스 등록에 실패했습니다.')
  return (await response.json()) as SptResourceRow
}

export async function updateSptResourceApi(
  crId: number,
  payload: SptResourcePayload,
): Promise<SptResourceRow> {
  const response = await fetch(`${BASE}/${crId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      up_user_id: payload.up_user_id ?? DEFAULT_USER_ID,
    }),
  })
  if (!response.ok) throw new Error('리소스 수정에 실패했습니다.')
  return (await response.json()) as SptResourceRow
}

export async function deleteSptResourcesApi(crIds: number[], upUserId?: number | null): Promise<void> {
  const response = await fetch(BASE, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ crIds, up_user_id: upUserId ?? DEFAULT_USER_ID }),
  })
  if (!response.ok) throw new Error('리소스 삭제에 실패했습니다.')
}
