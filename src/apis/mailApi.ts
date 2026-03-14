const BASE = 'http://impsj.net/api'

export interface ApiMail {
  id: string
  account: string
  from: string
  subject: string
  date: string
  hit?: number
  attachment_count?: number
  attachments?: ApiMailAttachment[]
}

export interface ApiMailAttachment {
  file_id: number
  data_id: number
  file_no?: number
  file_name?: string
  file_enc_name?: string
  file_path?: string
  file_url?: string
  filesize?: number
  type?: number
  created_at?: string
}

export interface FetchMailsResponse {
  mails: ApiMail[]
  total?: number
  accountErrors?: Record<string, string>
}

export async function fetchMailsApi(params?: { skip?: number; limit?: number }): Promise<FetchMailsResponse> {
  const search = new URLSearchParams()
  if (params?.skip != null) search.set('skip', String(params.skip))
  if (params?.limit != null) search.set('limit', String(params.limit))
  const url = search.toString() ? `${BASE}/mails?${search}` : `${BASE}/mails`
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to fetch mails')
  const data = await response.json()
  return {
    mails: data.mails ?? [],
    total: data.total ?? 0,
    accountErrors: data.accountErrors ?? {},
  }
}

export interface ImportMailsResponse {
  imported: number
  skipped?: number
  errors?: string[]
  error?: string
}

export async function importMailsApi(): Promise<ImportMailsResponse> {
  const response = await fetch(`${BASE}/mails/import`, { method: 'POST' })
  if (!response.ok) throw new Error('Failed to import mails')
  return response.json()
}

export interface ApiMailDetail extends ApiMail {
  body: string
  body_is_html: boolean
}

export async function fetchMailByIdApi(account: string, mailId: string): Promise<ApiMailDetail | null> {
  const enc = encodeURIComponent(account)
  const response = await fetch(`${BASE}/mails/${enc}/${mailId}`)
  if (!response.ok) return null
  return response.json()
}

export async function fetchMailAttachmentsApi(dataId: number): Promise<ApiMailAttachment[]> {
  const response = await fetch(`${BASE}/mails/${dataId}/attachments`)
  if (!response.ok) return []
  const data = await response.json()
  return data.attachments ?? []
}

export interface SendMailPayload {
  to: string
  subject: string
  body: string
  account_name?: string
}

export async function markMailReadApi(dataId: number): Promise<{ result: string }> {
  const response = await fetch(`${BASE}/mails/${dataId}/read`, { method: 'POST' })
  if (!response.ok) throw new Error('Failed to mark mail as read')
  return response.json()
}

export async function sendMailApi(payload: SendMailPayload): Promise<{ result: string }> {
  const response = await fetch(`${BASE}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: payload.to,
      subject: payload.subject,
      body: payload.body,
      account_name: payload.account_name ?? '네이버',
    }),
  })
  if (!response.ok) throw new Error('메일 발송에 실패했습니다.')
  return response.json()
}
