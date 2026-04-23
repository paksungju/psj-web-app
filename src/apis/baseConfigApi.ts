export interface BaseConfigRow {
  configId: number
  cfSubject: string
  cfKey: string | null
  cfVal: string | null
  sortNo: number
  createdAt: string
}

const BASE = '/api/v1/base-config'

export async function fetchBaseConfigsApi(): Promise<BaseConfigRow[]> {
  const response = await fetch(`${BASE}/`)
  if (!response.ok) throw new Error('Failed to fetch base configs')
  return (await response.json()) as BaseConfigRow[]
}

export async function fetchBaseConfigDetailApi(configId: number): Promise<BaseConfigRow> {
  const response = await fetch(`${BASE}/${configId}`)
  if (!response.ok) throw new Error('Failed to fetch base config detail')
  return (await response.json()) as BaseConfigRow
}

export interface BaseConfigWritePayload {
  cf_subject: string
  cf_key?: string | null
  cf_val?: string | null
  sort_no: number
}

export async function createBaseConfigApi(payload: BaseConfigWritePayload): Promise<BaseConfigRow> {
  const response = await fetch(`${BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error('Failed to create base config')
  return (await response.json()) as BaseConfigRow
}

export async function updateBaseConfigApi(
  configId: number,
  payload: Partial<BaseConfigWritePayload>,
): Promise<BaseConfigRow> {
  const response = await fetch(`${BASE}/${configId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error('Failed to update base config')
  return (await response.json()) as BaseConfigRow
}

export async function deleteBaseConfigApi(configId: number): Promise<void> {
  const response = await fetch(`${BASE}/${configId}`, { method: 'DELETE' })
  if (!response.ok) throw new Error('Failed to delete base config')
}
