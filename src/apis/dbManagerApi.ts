import { getApiPrefix } from './apiPrefix'
import { getAuthToken } from '../utils/auth'

const BASE = `${getApiPrefix()}/api/server`

export type DbConnId = number | null

function authHeaders(json = false): HeadersInit {
  const token = getAuthToken()
  const headers: Record<string, string> = {}
  if (json) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

function withConnQuery(connId: DbConnId, extra?: URLSearchParams): string {
  const params = extra ?? new URLSearchParams()
  if (connId != null) params.set('conn_id', String(connId))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

async function handleRes<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const detail = (err as { detail?: string }).detail
    throw new Error(detail || `요청 실패 (${res.status})`)
  }
  return res.json()
}

export interface DbSchema {
  name: string
}

export interface DbTable {
  name: string
  size_bytes: number
  approx_rows: number
}

export interface DbColumn {
  name: string
  type: string
  max_length: number | null
  nullable: boolean
  default: string | null
  udt_name: string
  comment: string | null
}

export interface DbTableRows {
  columns: string[]
  rows: Record<string, unknown>[]
  total: number
  limit: number
  offset: number
}

export interface DbQueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  row_count: number
  affected_rows: number | null
  message: string | null
}

export interface DbTableDdl {
  ddl: string
  schema: string
  table: string
}

export async function fetchDbSchemasApi(connId: DbConnId = null): Promise<DbSchema[]> {
  const res = await fetch(`${BASE}/db/schemas${withConnQuery(connId)}`, { headers: authHeaders() })
  return handleRes(res)
}

export async function fetchDbTablesApi(schema = 'public', connId: DbConnId = null): Promise<DbTable[]> {
  const params = new URLSearchParams({ schema })
  const res = await fetch(`${BASE}/db/tables${withConnQuery(connId, params)}`, {
    headers: authHeaders(),
  })
  return handleRes(res)
}

export async function fetchDbColumnsApi(
  table: string,
  schema = 'public',
  connId: DbConnId = null,
): Promise<DbColumn[]> {
  const params = new URLSearchParams({ schema })
  const res = await fetch(
    `${BASE}/db/tables/${encodeURIComponent(table)}/columns${withConnQuery(connId, params)}`,
    { headers: authHeaders() },
  )
  return handleRes(res)
}

export async function fetchDbTableRowsApi(
  table: string,
  opts: {
    schema?: string
    connId?: DbConnId
    limit?: number
    offset?: number
    order_by?: string
    order?: 'asc' | 'desc'
  } = {},
): Promise<DbTableRows> {
  const params = new URLSearchParams()
  if (opts.schema) params.set('schema', opts.schema)
  if (opts.limit != null) params.set('limit', String(opts.limit))
  if (opts.offset != null) params.set('offset', String(opts.offset))
  if (opts.order_by) params.set('order_by', opts.order_by)
  if (opts.order) params.set('order', opts.order)
  const res = await fetch(
    `${BASE}/db/tables/${encodeURIComponent(table)}/rows${withConnQuery(opts.connId ?? null, params)}`,
    { headers: authHeaders() },
  )
  return handleRes(res)
}

export async function fetchDbTableDdlApi(
  table: string,
  schema = 'public',
  connId: DbConnId = null,
): Promise<DbTableDdl> {
  const params = new URLSearchParams({ schema })
  const res = await fetch(
    `${BASE}/db/tables/${encodeURIComponent(table)}/ddl${withConnQuery(connId, params)}`,
    { headers: authHeaders() },
  )
  return handleRes(res)
}

export async function executeDbQueryApi(sql: string, connId: DbConnId = null): Promise<DbQueryResult> {
  const res = await fetch(`${BASE}/db/query${withConnQuery(connId)}`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ sql }),
  })
  return handleRes(res)
}

export interface AlterColumnPayload {
  new_name?: string
  new_type?: string
  new_comment?: string | null
}

export async function alterDbColumnApi(
  table: string,
  column: string,
  payload: AlterColumnPayload,
  schema = 'public',
  connId: DbConnId = null,
): Promise<{ ok: boolean; column: string; message: string }> {
  const params = new URLSearchParams({ schema })
  const res = await fetch(
    `${BASE}/db/tables/${encodeURIComponent(table)}/columns/${encodeURIComponent(column)}${withConnQuery(connId, params)}`,
    {
      method: 'PATCH',
      headers: authHeaders(true),
      body: JSON.stringify(payload),
    },
  )
  return handleRes(res)
}

export function columnTypeLabel(col: DbColumn): string {
  if (
    col.max_length != null &&
    ['varchar', 'bpchar', 'char', 'character varying'].includes(col.udt_name)
  ) {
    return `${col.udt_name}(${col.max_length})`
  }
  return col.udt_name || col.type
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
