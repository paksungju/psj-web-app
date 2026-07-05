export interface IContentBlockModel {
  cbId: string
  ciId?: number | string | null
  crId?: number | null
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
  headerYn?: number
  headerBg?: string
  borderTk?: number
  borderR?: number
  borderGd?: number
  bodyBg?: string
  linkUrl?: string
  linkTarget?: string
  contentObject?: Record<string, unknown>
  useYn?: string | null
  delYn?: string | null
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

/** 등록/수정 요청 문자열 필드 앞뒤 공백 제거 */
function normalizeContentBlockSavePayload(src: Record<string, unknown>): Record<string, unknown> {
  const data = { ...src }
  const trimKeys = [
    'cbSubject',
    'cbContent',
    'imgUrl',
    'coType',
    'headerBg',
    'bodyBg',
    'linkUrl',
    'linkTarget',
    'useYn',
    'delYn',
  ] as const
  for (const k of trimKeys) {
    const v = data[k]
    if (typeof v === 'string') data[k] = v.trim()
  }
  if (data.ciId != null) data.ciId = String(data.ciId).trim()
  if (data.cbId != null) data.cbId = String(data.cbId).trim()
  if (data.crId != null) data.crId = Number(data.crId) || 0

  const existingContentObject =
    (typeof data.contentObject === 'object' && data.contentObject !== null
      ? (data.contentObject as Record<string, unknown>)
      : {}) || {}

  data.contentObject = {
    ...existingContentObject,
    cb_subject: data.cbSubject,
    cb_content: data.cbContent,
    co_type: data.coType,
    img_url: data.imgUrl,
    top_p: data.topP,
    left_p: data.leftP,
    z_index: data.zindex,
    width: data.width,
    height: data.height,
    img_angle: data.imgAngle,
    header_yn: data.headerYn,
    header_bg: data.headerBg,
    border_tk: data.borderTk,
    border_r: data.borderR,
    border_gd: data.borderGd,
    body_bg: data.bodyBg,
    link_url: data.linkUrl,
    link_target: data.linkTarget,
  }
  return data
}

export async function fetchContentBlockData(params: { ciId: string }) {
  const res = await postJson<JsonResponse<{ list?: IContentBlockModel[] }>>('/api/spt/contentBlock/list', {
    data: { ciId: String(params.ciId).trim() },
  })
  return res.data?.list ?? []
}

export async function fetchContentBlockDetail(params: { cbId: string }) {
  const res = await postJson<JsonResponse<Record<string, unknown>>>('/api/spt/contentBlock/data', {
    data: { cbId: String(params.cbId).trim() },
  })
  return res.data ?? res
}

export async function postContentBlockSave(object: Record<string, unknown>) {
  const data = normalizeContentBlockSavePayload(object)
  const cbId = String(data.cbId ?? '')
  const url = cbId && cbId !== '0'
    ? '/api/spt/contentBlock/update'
    : '/api/spt/contentBlock/insert'

  return postJson<JsonResponse>(url, { data })
}

export async function contentBlockdelUpdate(object: { cbId: string }) {
  return postJson<JsonResponse>('/api/spt/contentBlock/delUpdate', {
    data: { cbId: String(object.cbId ?? '').trim() },
  })
}

export async function positionSave(params: unknown[]) {
  const data = (params as Record<string, unknown>[]).map((row) => {
    const r = { ...row }
    if (r.cbId != null) r.cbId = String(r.cbId).trim()
    return r
  })
  return postJson<JsonResponse>('/api/spt/contentBlock/positions/saveAll', { data })
}

export async function postlineDataSave(object: Record<string, unknown>) {
  const ciId = object.ciId != null ? String(object.ciId).trim() : object.ciId
  return postJson<JsonResponse>('/api/spt/contentBlock/lineData/save', { data: { ...object, ciId } })
}

export async function getlineData(params: { ciId: string }) {
  const res = await postJson<JsonResponse<{ lineObject?: unknown[] }>>('/api/spt/contentBlock/getLineData', {
    data: { ciId: String(params.ciId).trim() },
  })
  return res.bizData ?? res.data?.lineObject ?? []
}

export async function fetchContentCateList(params?: Record<string, unknown>) {
  const res = await postJson<JsonResponse<{ list?: IContentCateModel[] }>>('/api/spt/contentitems/cate/list', {
    data: params,
  })
  return res.data?.list ?? []
}
