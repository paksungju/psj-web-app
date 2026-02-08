const BASE = 'http://impsj.net/api/v1/apps'

/** 웹앱 한 건 (서버 응답 - snake_case 가능) */
export interface ApiAppConfig {
  app_id?: number
  app_code?: string | null
  app_name?: string | null
  mobile_name?: string | null
  group_id?: string | null
  admin_id?: string | null
  list_level?: number | null
  read_level?: number | null
  write_level?: number | null
  reply_level?: number | null
  comment_level?: number | null
  upload_level?: number | null
  download_level?: number | null
  html_level?: number | null
  link_level?: number | null
  count_delete?: number | null
  count_modify?: number | null
  read_point?: number | null
  write_point?: number | null
  comment_point?: number | null
  download_point?: number | null
  use_cate?: string | null
  cate_list?: string | null
  use_sideview?: string | null
  use_file_content?: string | null
  use_secret?: string | null
  use_html_editor?: string | null
  use_rss_view?: string | null
  use_recaptcha?: string | null
  use_good?: string | null
  use_nogood?: string | null
  use_name?: string | null
  use_email?: string | null
  use_cert?: string | null
  use_sns?: string | null
  use_signature?: string | null
  use_ip_view?: string | null
  use_list_view?: string | null
  use_list_file?: string | null
  use_list_content?: string | null
  table_width?: number | null
  subject_len?: number | null
  mobile_subject_len?: number | null
  page_rows?: number | null
  new_icon?: number | null
  hot_icon?: number | null
  image_width?: number | null
  skin_nm?: string | null
  mobile_skin_nm?: string | null
  layout?: string | null
  content_head?: string | null
  mobile_content_head?: string | null
  content_tail?: string | null
  mobile_content_tail?: string | null
  insert_content?: string | null
  gallery_cols?: number | null
  gallery_width?: number | null
  gallery_height?: number | null
  mobile_gallery_width?: number | null
  mobile_gallery_height?: number | null
  reply_oder?: string | null
  use_search?: string | null
  order_no?: number | null
  count_write?: number | null
  count_comment?: number | null
  write_min?: number | null
  write_max?: number | null
  comment_min?: number | null
  comment_max?: number | null
  notice_yn?: string | null
  upload_count?: number | null
  upload_size?: number | null
  upload_type?: string | null
  sort_field?: string | null
  in_admin_id?: string | null
  in_datetime?: string | null
  up_admin_id?: string | null
  up_datetime?: string | null
}

export type ApiAppConfigPayload = Partial<ApiAppConfig>

export async function fetchAppConfigsApi(params?: { skip?: number; limit?: number }): Promise<ApiAppConfig[]> {
  const search = new URLSearchParams()
  if (params?.skip != null) search.set('skip', String(params.skip))
  if (params?.limit != null) search.set('limit', String(params.limit))
  const url = search.toString() ? `${BASE}?${search}` : BASE
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to fetch web apps')
  return (await response.json()) as ApiAppConfig[]
}

export async function fetchAppConfigApi(appId: number): Promise<ApiAppConfig | null> {
  const response = await fetch(`${BASE}/${appId}`)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch web app')
  }
  return (await response.json()) as ApiAppConfig
}

export async function createAppConfigApi(payload: ApiAppConfigPayload): Promise<ApiAppConfig> {
  const response = await fetch(`${BASE}/insert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error('Failed to create web app')
  return (await response.json()) as ApiAppConfig
}

export async function updateAppConfigApi(appId: number, payload: ApiAppConfigPayload): Promise<ApiAppConfig> {
  const response = await fetch(`${BASE}/${appId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error('Failed to update web app')
  return (await response.json()) as ApiAppConfig
}
