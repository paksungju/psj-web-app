export interface PaidInfoRow {
  paidId: number
  accNm: string
  accNo: string
  subject: string
  memo: string
  cateCd: string | null
  cateNm: string | null
  price: number | null
  ioType: string | null
  paidDt: string | null
}

const BASE = '/api/v1/paid-info'

export async function fetchPaidInfosApi(): Promise<PaidInfoRow[]> {
  const response = await fetch(`${BASE}/`)
  if (!response.ok) throw new Error('Failed to fetch paid infos')
  return (await response.json()) as PaidInfoRow[]
}

export async function fetchPaidInfoDetailApi(paidId: number): Promise<PaidInfoRow> {
  const response = await fetch(`${BASE}/${paidId}`)
  if (!response.ok) throw new Error('Failed to fetch paid info detail')
  return (await response.json()) as PaidInfoRow
}

export interface PaidInfoWritePayload {
  acc_nm: string
  acc_no: string
  subject: string
  memo: string
  cate_cd?: string | null
  cate_nm?: string | null
  price?: number | null
  io_type?: string | null
  paid_dt?: string | null
}

export async function createPaidInfoApi(payload: PaidInfoWritePayload): Promise<PaidInfoRow> {
  const response = await fetch(`${BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error('Failed to create paid info')
  return (await response.json()) as PaidInfoRow
}

export async function updatePaidInfoApi(
  paidId: number,
  payload: Partial<PaidInfoWritePayload>,
): Promise<PaidInfoRow> {
  const response = await fetch(`${BASE}/${paidId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error('Failed to update paid info')
  return (await response.json()) as PaidInfoRow
}

export async function deletePaidInfoApi(paidId: number): Promise<void> {
  const response = await fetch(`${BASE}/${paidId}`, { method: 'DELETE' })
  if (!response.ok) throw new Error('Failed to delete paid info')
}
