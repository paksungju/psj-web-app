export interface IContentBlockModel {
  cbId: string
  leftP: number
  topP: number
  width?: number
  height?: number
  zindex?: number
  imgUrl?: string
  imgAngle?: number
  cbSubject: string
  cbContent?: string
  coType?: string
  inUserNo?: string
  inDatetime?: string
  upUserNo?: string
  upDatetime?: string
}

export interface IContentCateModel {
  ccId: number
  ciId: number | null
  subject: string | null
  cateCd?: string
  cateNm: string
}

interface JsonResponse<T = unknown> {
  code?: string
  msg?: string
  data?: T
  bizData?: T
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export async function fetchContentBlockData(params: { ciId: string }) {
  const res = await postJson<JsonResponse<{ list?: IContentBlockModel[] }>>('/api/spt/contentBlock/list', {
    data: params,
  })
  return res.data?.list ?? []
}

export async function fetchContentBlockDetail(params: { cbId: string }) {
  const res = await postJson<JsonResponse<Record<string, unknown>>>('/api/spt/contentBlock/data', {
    data: params,
  })
  return res.data ?? res
}

export async function postContentBlockSave(object: Record<string, unknown>) {
  const cbId = String(object.cbId ?? '')
  const url = cbId && cbId !== '0'
    ? '/api/spt/contentBlock/update'
    : '/api/spt/contentBlock/insert'

  return postJson<JsonResponse>(url, { data: object })
}

export async function contentBlockdelUpdate(object: { cbId: string }) {
  return postJson<JsonResponse>('/api/spt/contentBlock/delUpdate', { data: object })
}

export async function positionSave(params: unknown[]) {
  return postJson<JsonResponse>('/api/spt/contentBlock/positions/saveAll', { data: params })
}

export async function postlineDataSave(object: Record<string, unknown>) {
  return postJson<JsonResponse>('/api/spt/contentBlock/lineData/save', { data: object })
}

export async function getlineData(params: { ciId: string }) {
  const res = await postJson<JsonResponse<{ lineObject?: unknown[] }>>('/api/spt/contentBlock/getLineData', {
    data: params,
  })
  return res.bizData ?? res.data?.lineObject ?? []
}

export async function fetchContentCateList(params?: Record<string, unknown>) {
  const res = await postJson<JsonResponse<{ list?: IContentCateModel[] }>>('/api/spt/contentitems/cate/list', {
    data: params,
  })
  return res.data?.list ?? []
}
