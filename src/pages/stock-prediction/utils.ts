import type { StockPredictionRow } from '../../apis/stockPredictionApi'
import type { StockPredictionGridRow } from './StockPredictionAgGrid'

export function formatDate(s: string | null) {
  return s?.slice(0, 10) ?? ''
}

export function todayDateString() {
  return new Date().toISOString().slice(0, 10)
}

export function newDraftRow(): StockPredictionGridRow {
  return {
    draftKey: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    stPrdId: 0,
    stockCode: '',
    stockName: '',
    wrDate: todayDateString(),
    wrTime: '',
    stockPrice: null,
    perPrice: null,
    content: null,
    prediction: '',
    goodNew1: null,
    goodNew2: null,
    goodNew3: null,
    goodNew4: null,
    goodNew5: null,
    badNew1: null,
    badNew2: null,
    badNew3: null,
    badNew4: null,
    badNew5: null,
    createdAt: '',
  }
}

export function rowToWritePayload(row: StockPredictionRow) {
  return {
    stock_code: row.stockCode?.trim() || null,
    stock_name: row.stockName?.trim() || null,
    wr_date: row.wrDate || null,
    wr_time: row.wrTime?.trim() || null,
    stock_price: row.stockPrice != null ? Number(row.stockPrice) : null,
    per_price: row.perPrice != null ? Number(row.perPrice) : null,
    content: row.content?.trim() || null,
    prediction: row.prediction?.trim() || null,
    good_new_1: row.goodNew1?.trim() || null,
    good_new_2: row.goodNew2?.trim() || null,
    good_new_3: row.goodNew3?.trim() || null,
    good_new_4: row.goodNew4?.trim() || null,
    good_new_5: row.goodNew5?.trim() || null,
    bad_new_1: row.badNew1?.trim() || null,
    bad_new_2: row.badNew2?.trim() || null,
    bad_new_3: row.badNew3?.trim() || null,
    bad_new_4: row.badNew4?.trim() || null,
    bad_new_5: row.badNew5?.trim() || null,
  }
}

export type GoodBadField =
  | 'goodNew1'
  | 'goodNew2'
  | 'goodNew3'
  | 'goodNew4'
  | 'goodNew5'
  | 'badNew1'
  | 'badNew2'
  | 'badNew3'
  | 'badNew4'
  | 'badNew5'
