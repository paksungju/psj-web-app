export interface StockPredictionRow {
  stPrdId: number
  stockCode: string | null
  stockName: string | null
  wrDate: string | null
  wrTime: string | null
  stockPrice: number | null
  perPrice: number | null
  content: string | null
  prediction: string | null
  goodNew1: string | null
  goodNew2: string | null
  goodNew3: string | null
  goodNew4: string | null
  goodNew5: string | null
  badNew1: string | null
  badNew2: string | null
  badNew3: string | null
  badNew4: string | null
  badNew5: string | null
  createdAt: string
}

const BASE = '/api/v1/stock-prediction'

export async function fetchStockPredictionsApi(): Promise<StockPredictionRow[]> {
  const response = await fetch(`${BASE}/`)
  if (!response.ok) throw new Error('Failed to fetch stock predictions')
  return (await response.json()) as StockPredictionRow[]
}

export async function fetchStockPredictionDetailApi(stPrdId: number): Promise<StockPredictionRow> {
  const response = await fetch(`${BASE}/${stPrdId}`)
  if (!response.ok) throw new Error('Failed to fetch stock prediction detail')
  return (await response.json()) as StockPredictionRow
}

export interface StockPredictionWritePayload {
  stock_code?: string | null
  stock_name?: string | null
  wr_date?: string | null
  wr_time?: string | null
  stock_price?: number | null
  per_price?: number | null
  content?: string | null
  prediction?: string | null
  good_new_1?: string | null
  good_new_2?: string | null
  good_new_3?: string | null
  good_new_4?: string | null
  good_new_5?: string | null
  bad_new_1?: string | null
  bad_new_2?: string | null
  bad_new_3?: string | null
  bad_new_4?: string | null
  bad_new_5?: string | null
}

export async function createStockPredictionApi(
  payload: StockPredictionWritePayload,
): Promise<StockPredictionRow> {
  const response = await fetch(`${BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error('Failed to create stock prediction')
  return (await response.json()) as StockPredictionRow
}

export async function updateStockPredictionApi(
  stPrdId: number,
  payload: Partial<StockPredictionWritePayload>,
): Promise<StockPredictionRow> {
  const response = await fetch(`${BASE}/${stPrdId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error('Failed to update stock prediction')
  return (await response.json()) as StockPredictionRow
}

export async function deleteStockPredictionApi(stPrdId: number): Promise<void> {
  const response = await fetch(`${BASE}/${stPrdId}`, { method: 'DELETE' })
  if (!response.ok) throw new Error('Failed to delete stock prediction')
}
