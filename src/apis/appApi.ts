const BASE = 'http://impsj.net/api/v1'

/** 앱 데이터 한 건 (서버 응답 - AppData) */
export interface ApiAppData {
  data_id?: number
  app_id?: number
  gr_num?: number
  reply_cd?: number
  parent_id?: number
  is_commt?: number
  co_num?: number
  co_reply?: number
  cate1?: string | null
  cate2?: string | null
  ap_subject?: string | null
  ap_content?: string | null
  wr_type?: number
  is_secret?: number
  recv_mail?: string | null
  link1?: string | null
  link2?: string | null
  link1_hit?: number
  link2_hit?: number
  hit?: number
  good?: number
  nogood?: number
  user_no?: number
  user_passwd?: string | null
  user_nm?: string | null
  user_email?: string | null
  user_home?: string | null
  file_cnt?: number
  last_login?: string | null
  ip?: string | null
  facebook_user?: string | null
  twitter_user?: string | null
  start_date?: string | null
  start_time?: string | null
  end_date?: string | null
  end_time?: string | null
  regist_dt?: string | null
  update_dt?: string | null
  extra_1?: string | null
  extra_2?: string | null
  extra_3?: string | null
  extra_4?: string | null
  extra_5?: string | null
  extra_6?: string | null
  extra_7?: string | null
  extra_8?: string | null
  extra_9?: string | null
  extra_10?: string | null
}

export type ApiAppPayload = Partial<ApiAppData>

export async function fetchAppDataListApi(params?: {
  skip?: number
  limit?: number
  app_id?: number
  gr_num?: number
  reply_cd_empty?: boolean
}): Promise<ApiAppData[]> {
  const search = new URLSearchParams()
  if (params?.skip != null) search.set('skip', String(params.skip))
  if (params?.limit != null) search.set('limit', String(params.limit))
  if (params?.app_id != null) search.set('app_id', String(params.app_id))
  if (params?.gr_num != null) search.set('gr_num', String(params.gr_num))
  if (params?.reply_cd_empty === true) search.set('reply_cd_empty', '1')
  const url = search.toString() ? `${BASE}/app_data?${search}` : `${BASE}/app_data`
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to fetch app data list')
  return (await response.json()) as ApiAppData[]
}

export async function fetchAppDataByIdApi(dataId: number): Promise<ApiAppData | null> {
  const response = await fetch(`${BASE}/app_data/${dataId}`)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch app data')
  }
  return (await response.json()) as ApiAppData
}

async function checkOk(response: Response, fallbackMessage: string): Promise<void> {
  if (response.ok) return
  let message = fallbackMessage
  try {
    const body = await response.json()
    if (body?.detail) {
      message = Array.isArray(body.detail) ? body.detail.map((d: { msg?: string }) => d?.msg).filter(Boolean).join(', ') : String(body.detail)
    } else if (body?.message) {
      message = body.message
    }
  } catch {
    const text = await response.text()
    if (text) message = text
  }
  throw new Error(message)
}

// 등록
export async function createAppDataApi(
  payload: ApiAppPayload,
  params?: { reply?: number }
): Promise<ApiAppData> {
  const search = new URLSearchParams()
  if (params?.reply != null) search.set('reply', String(params.reply))
  const url = search.toString() ? `${BASE}/app_data?${search}` : `${BASE}/app_data`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  await checkOk(response, 'Failed to create app data')
  return (await response.json()) as ApiAppData
}

// 수정처리
export async function updateAppDataApi(
  dataId: number,
  payload: ApiAppPayload,
  params?: { reply?: number }
): Promise<ApiAppData> {
  const search = new URLSearchParams()
  if (params?.reply != null) search.set('reply', String(params.reply))
  const url = search.toString() ? `${BASE}/app_data/${dataId}?${search}` : `${BASE}/app_data/${dataId}`
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  await checkOk(response, 'Failed to update app data')
  return (await response.json()) as ApiAppData
}

// 삭제
export async function deleteAppDataApi(dataId: number): Promise<{ message: string }> {
  const response = await fetch(`${BASE}/app_data/${dataId}`, { method: 'DELETE' })
  if (!response.ok) throw new Error('Failed to delete app data')
  return (await response.json()) as { message: string }
}

// 선택 삭제 (배치)
export async function deleteAppDataBatchApi(dataIds: number[]): Promise<{ deleted: number; errors: string[] }> {
  const response = await fetch(`${BASE}/app_data/batch_delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data_ids: dataIds }),
  })
  if (!response.ok) throw new Error('Failed to delete app data')
  return (await response.json()) as { deleted: number; errors: string[] }
}
