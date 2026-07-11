import { getApiPrefix } from './apiPrefix'

export interface UserRow {
  userId: number
  userLoginId: string
  userName: string | null
  userEmail: string
  genderTypeCd: string | null
  userStatusCd: string | null
  userTypeCd: string | null
  lastIp: string | null
  delFlag: string
  inUserId: number
  inDatetime: string
  upUserId: number | null
  upDatetime: string
}

function dtIso(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  return String(v)
}

export function normalizeUserRow(raw: Record<string, unknown>): UserRow {
  return {
    userId: Number(raw.userId ?? raw.user_id ?? 0),
    userLoginId: String(raw.userLoginId ?? raw.user_login_id ?? ''),
    userName: (raw.userName ?? raw.user_name ?? null) as string | null,
    userEmail: String(raw.userEmail ?? raw.user_email ?? ''),
    genderTypeCd: (raw.genderTypeCd ?? raw.gender_type_cd ?? null) as string | null,
    userStatusCd: (raw.userStatusCd ?? raw.user_status_cd ?? null) as string | null,
    userTypeCd: (raw.userTypeCd ?? raw.user_type_cd ?? null) as string | null,
    lastIp: (raw.lastIp ?? raw.last_ip ?? null) as string | null,
    delFlag: String(raw.delFlag ?? raw.del_flag ?? '0'),
    inUserId: Number(raw.inUserId ?? raw.in_user_id ?? 0),
    inDatetime: dtIso(raw.inDatetime ?? raw.in_datetime),
    upUserId: (raw.upUserId ?? raw.up_user_id ?? null) as number | null,
    upDatetime: dtIso(raw.upDatetime ?? raw.up_datetime),
  }
}

const PSJ_USERS_BASE = () => `${getApiPrefix()}/api/v1/psj-users`
const LEGACY_USERS_BASE = () => `${getApiPrefix()}/api/v1/users`

async function parseUsersResponse(response: Response): Promise<UserRow[]> {
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `HTTP ${response.status}`)
  }
  const data = (await response.json()) as Record<string, unknown>[]
  return data
    .map((row) => normalizeUserRow(row))
    .filter((row) => row.delFlag !== '1')
}

export async function fetchUsersApi(): Promise<UserRow[]> {
  const primary = await fetch(`${PSJ_USERS_BASE()}/`)
  if (primary.ok) {
    return parseUsersResponse(primary)
  }

  const legacy = await fetch(`${LEGACY_USERS_BASE()}/`)
  if (!legacy.ok) {
    throw new Error(
      `사용자 목록 조회 실패 (psj-users: ${primary.status}, users: ${legacy.status})`,
    )
  }
  return parseUsersResponse(legacy)
}

export async function fetchUserDetailApi(userId: number): Promise<UserRow> {
  const primary = await fetch(`${PSJ_USERS_BASE()}/${userId}`)
  if (primary.ok) {
    const row = (await primary.json()) as Record<string, unknown>
    return normalizeUserRow(row)
  }

  const legacy = await fetch(`${LEGACY_USERS_BASE()}/${userId}`)
  if (!legacy.ok) {
    throw new Error(`사용자 상세 조회 실패 (HTTP ${legacy.status})`)
  }
  const row = (await legacy.json()) as Record<string, unknown>
  return normalizeUserRow(row)
}

export interface UserWritePayload {
  user_login_id: string
  user_password?: string | null
  user_name?: string | null
  user_email: string
  gender_type_cd?: string | null
  user_status_cd?: string | null
  user_type_cd?: string | null
}

export async function createUserApi(payload: UserWritePayload): Promise<UserRow> {
  const response = await fetch(`${PSJ_USERS_BASE()}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error('Failed to create user')
  const row = (await response.json()) as Record<string, unknown>
  return normalizeUserRow(row)
}

export async function updateUserApi(
  userId: number,
  payload: Partial<UserWritePayload>,
): Promise<UserRow> {
  const response = await fetch(`${PSJ_USERS_BASE()}/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error('Failed to update user')
  const row = (await response.json()) as Record<string, unknown>
  return normalizeUserRow(row)
}

export async function deleteUserApi(userId: number): Promise<void> {
  const response = await fetch(`${PSJ_USERS_BASE()}/${userId}`, { method: 'DELETE' })
  if (!response.ok) throw new Error('Failed to delete user')
}
