export interface SptContentCateRow {
  ccId: number
  cateCd: string
  cateNm: string
  pCateCd: string | null
  sortNo: number | null
  cateDepth: number | null
  userId: number
  useFlag: number | null
  delFlag: number | null
  inUserId?: number | null
  inDatetime?: string | null
  upUserId?: number | null
  upDatetime?: string | null
}

export type SptContentCateCreatePayload = {
  cate_cd: string
  cate_nm: string
  p_cate_cd?: string | null
  sort_no?: number | null
  cate_depth?: number | null
  user_id?: number
  use_flag?: number | null
}

export type SptContentCateUpdatePayload = {
  cate_cd: string
  cate_nm: string
  p_cate_cd?: string | null
  sort_no?: number | null
  cate_depth?: number | null
  use_flag?: number | null
  up_user_id?: number | null
}

const BASE = '/api/v1/spt/content-cate'

const DEFAULT_USER_ID = 1

export async function fetchSptContentCateGroupsApi(): Promise<SptContentCateRow[]> {
  const response = await fetch(`${BASE}/groups`)
  if (!response.ok) throw new Error('Failed to fetch SPT content categories (roots)')
  const data = (await response.json()) as { items: SptContentCateRow[] }
  return data.items ?? []
}

export async function fetchSptContentCateItemsApi(parentCateCd: string): Promise<SptContentCateRow[]> {
  const q = new URLSearchParams({ parent_cate_cd: parentCateCd })
  const response = await fetch(`${BASE}/items?${q}`)
  if (!response.ok) throw new Error('Failed to fetch SPT content category items')
  const data = (await response.json()) as { items: SptContentCateRow[] }
  return data.items ?? []
}

export async function createSptContentCateApi(
  payload: SptContentCateCreatePayload,
): Promise<SptContentCateRow> {
  const body = {
    ...payload,
    user_id: payload.user_id ?? DEFAULT_USER_ID,
  }
  const response = await fetch(`${BASE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error('Failed to create SPT content category')
  return (await response.json()) as SptContentCateRow
}

export async function updateSptContentCateApi(
  ccId: number,
  payload: SptContentCateUpdatePayload,
): Promise<SptContentCateRow> {
  const response = await fetch(`${BASE}/${ccId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error('Failed to update SPT content category')
  return (await response.json()) as SptContentCateRow
}

export async function deleteSptContentCateApi(ccIds: number[], upUserId?: number | null): Promise<void> {
  const response = await fetch(`${BASE}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ccIds, up_user_id: upUserId ?? DEFAULT_USER_ID }),
  })
  if (!response.ok) throw new Error('Failed to delete SPT content categories')
}
