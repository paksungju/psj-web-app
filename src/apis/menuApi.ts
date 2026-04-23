export interface ApiMenuRow {
  menu_id: number
  me_subject: string
  parent_id: number | null
  me_url: string | null
  target_type: string | null
  depth: number | null
  sort_no: number
  me_icon: string | null
  is_use: number
  created_at: string
}

export type ApiMenuCreatePayload = {
  me_subject: string
  parent_id: number | null
  me_url?: string | null
  target_type?: string | null
  depth?: number | null
  sort_no: number
  me_icon?: string | null
  is_use: number
}

const BASE = '/api/v1/menus'

export async function fetchMenusApi(params?: {
  skip?: number
  limit?: number
  parent_id?: number | null
  depth?: number | null
  is_use?: number | null
}): Promise<ApiMenuRow[]> {
  const search = new URLSearchParams()
  if (params?.skip != null) search.set('skip', String(params.skip))
  if (params?.limit != null) search.set('limit', String(params.limit))
  if (params?.parent_id != null) search.set('parent_id', String(params.parent_id))
  if (params?.depth != null) search.set('depth', String(params.depth))
  if (params?.is_use != null) search.set('is_use', String(params.is_use))

  const url = search.toString() ? `${BASE}/?${search.toString()}` : `${BASE}/`
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to fetch menus')
  return (await response.json()) as ApiMenuRow[]
}

export async function createMenuApi(payload: ApiMenuCreatePayload): Promise<ApiMenuRow> {
  const response = await fetch(`${BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) throw new Error('Failed to create menu')
  return (await response.json()) as ApiMenuRow
}

export async function updateMenuApi(menuId: number, payload: ApiMenuCreatePayload): Promise<ApiMenuRow> {
  const response = await fetch(`${BASE}/${menuId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) throw new Error('Failed to update menu')
  return (await response.json()) as ApiMenuRow
}

export type MenuSortOrderItem = { menu_id: number; sort_no: number }

export async function saveMenusSortOrderApi(items: MenuSortOrderItem[]): Promise<{ updated: number; requested: number }> {
  const response = await fetch(`${BASE}/sort-order`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  if (!response.ok) throw new Error('Failed to save menu sort order')
  return (await response.json()) as { updated: number; requested: number }
}

