export interface CodeRow {
  code_id: number
  code_cd: string
  code_nm: string | null
  p_code: string | null
  sort_no: number
  depth: number
  is_group: number
  created_at: string
}

export interface FetchCodesResponse {
  items: CodeRow[]
}

export interface CreateUpdateCodePayload {
  code_cd: string
  code_nm?: string | null
  p_code?: string | null
  sort_no: number
  depth: number
  is_group: number
}

export async function fetchCodeGroupsApi(): Promise<FetchCodesResponse> {
  const response = await fetch('http://impsj.net/api/v1/codes/groups')
  if (!response.ok) throw new Error('Failed to fetch code groups')
  return (await response.json()) as FetchCodesResponse
}

export async function fetchCodesByParentApi(parentCodeCd: string): Promise<FetchCodesResponse> {
  const response = await fetch(
    `http://impsj.net/api/v1/codes/items?parent_code_cd=${encodeURIComponent(parentCodeCd)}`,
  )
  if (!response.ok) throw new Error('Failed to fetch code items')
  return (await response.json()) as FetchCodesResponse
}

export async function createCodeApi(payload: CreateUpdateCodePayload): Promise<CodeRow> {
  const response = await fetch('http://impsj.net/api/v1/codes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error('Failed to create code')
  return (await response.json()) as CodeRow
}

export async function updateCodeApi(
  codeId: number,
  payload: CreateUpdateCodePayload,
): Promise<CodeRow> {
  const response = await fetch(`http://impsj.net/api/v1/codes/${codeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error('Failed to update code')
  return (await response.json()) as CodeRow
}

export async function deleteCodesApi(codeIds: number[]): Promise<void> {
  const response = await fetch('http://impsj.net/api/v1/codes', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codeIds }),
  })
  if (!response.ok) throw new Error('Failed to delete codes')
}

