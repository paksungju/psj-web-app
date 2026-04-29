const BASE = 'http://impsj.net/api/v1'

export interface TrainingLogRow {
  tr_id: number
  app_id: number
  data_id: number
  tr_subject: string | null
  tr_date: string | null
  start_time: string | null
  end_time: string | null
  del_yn: string | null
  in_user_id: number | null
  in_datetime: string | null
  up_user_id: number | null
  up_datetime: string | null
}

export interface TrainingLogPayload {
  app_id?: number
  data_id?: number
  tr_subject?: string | null
  tr_date?: string | null
  start_time?: string | null
  end_time?: string | null
  del_yn?: string | null
  in_user_id?: number | null
  up_user_id?: number | null
}

function buildQuery(params?: {
  skip?: number
  limit?: number
  app_id?: number
  data_id?: number
  tr_date?: string
}) {
  const search = new URLSearchParams()
  if (params?.skip != null) search.set('skip', String(params.skip))
  if (params?.limit != null) search.set('limit', String(params.limit))
  if (params?.app_id != null) search.set('app_id', String(params.app_id))
  if (params?.data_id != null) search.set('data_id', String(params.data_id))
  if (params?.tr_date) search.set('tr_date', params.tr_date)
  return search
}

async function checkOk(response: Response, fallbackMessage: string): Promise<void> {
  if (response.ok) return
  let message = fallbackMessage
  try {
    const body = await response.json()
    if (body?.detail) {
      message = Array.isArray(body.detail)
        ? body.detail.map((d: { msg?: string }) => d?.msg).filter(Boolean).join(', ')
        : String(body.detail)
    } else if (body?.message) {
      message = body.message
    }
  } catch {
    const text = await response.text()
    if (text) message = text
  }
  throw new Error(message)
}

export async function fetchTrainingLogsApi(params?: {
  skip?: number
  limit?: number
  app_id?: number
  data_id?: number
  tr_date?: string
}): Promise<TrainingLogRow[]> {
  const search = buildQuery(params)
  const url = search.toString() ? `${BASE}/training_logs?${search}` : `${BASE}/training_logs`
  const response = await fetch(url)
  await checkOk(response, 'Failed to fetch training logs')
  return (await response.json()) as TrainingLogRow[]
}

export async function fetchTrainingLogByIdApi(trId: number): Promise<TrainingLogRow | null> {
  const response = await fetch(`${BASE}/training_logs/${trId}`)
  if (!response.ok) {
    if (response.status === 404) return null
    await checkOk(response, 'Failed to fetch training log')
  }
  return (await response.json()) as TrainingLogRow
}

export async function createTrainingLogApi(payload: TrainingLogPayload): Promise<TrainingLogRow> {
  const response = await fetch(`${BASE}/training_logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  await checkOk(response, 'Failed to create training log')
  return (await response.json()) as TrainingLogRow
}

export async function updateTrainingLogApi(
  trId: number,
  payload: TrainingLogPayload,
): Promise<TrainingLogRow> {
  const response = await fetch(`${BASE}/training_logs/${trId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  await checkOk(response, 'Failed to update training log')
  return (await response.json()) as TrainingLogRow
}

export async function deleteTrainingLogApi(trId: number): Promise<{ message: string }> {
  const response = await fetch(`${BASE}/training_logs/${trId}`, { method: 'DELETE' })
  await checkOk(response, 'Failed to delete training log')
  return (await response.json()) as { message: string }
}
