export const AUTH_TOKEN_KEY = 'auth_token'
export const IS_LOGGED_IN_KEY = 'isLoggedIn'
export const LOGIN_PASSWORD_SESSION_KEY = 'login_password'

export function readTokenExpMs(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof json.exp !== 'number') return null
    return json.exp * 1000
  } catch {
    return null
  }
}

export function getAuthToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
  localStorage.setItem(IS_LOGGED_IN_KEY, 'true')
  window.dispatchEvent(new Event('auth-change'))
}

/** 토큰 만료까지 남은 밀리초. 토큰이 없거나 exp 가 없으면 null */
export function getTokenRemainingMs(token?: string | null): number | null {
  const t = token ?? getAuthToken()
  if (!t) return null
  const expMs = readTokenExpMs(t)
  if (expMs == null) return null
  return Math.max(0, expMs - Date.now())
}

/** 남은 시간을 mm:ss (1시간 이상이면 h:mm:ss) 로 포맷 */
export function formatRemaining(ms: number): string {
  const total = Math.floor(ms / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`
  return `${pad(minutes)}:${pad(seconds)}`
}

/** 서버에 토큰 재발급 요청. 성공하면 새 토큰을 저장하고 true */
export async function refreshAuthToken(): Promise<boolean> {
  const token = getAuthToken()
  if (!token || isAuthTokenExpired(token)) return false

  try {
    const res = await fetch('http://impsj.net/api/v1/users/refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return false

    const data = await res.json()
    if (!data?.access_token) return false

    setAuthToken(data.access_token)
    return true
  } catch (error) {
    console.error('토큰 연장 오류:', error)
    return false
  }
}

/** 토큰이 없거나 파싱 불가하면 null, 만료면 true */
export function isAuthTokenExpired(token?: string | null): boolean {
  const t = token ?? getAuthToken()
  if (!t) return true
  const expMs = readTokenExpMs(t)
  if (expMs == null) return false
  return expMs <= Date.now()
}

export function hasValidAuthSession(): boolean {
  const token = getAuthToken()
  const flagged = localStorage.getItem(IS_LOGGED_IN_KEY) === 'true'
  if (token) return !isAuthTokenExpired(token)
  return flagged
}

export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(IS_LOGGED_IN_KEY)
  sessionStorage.removeItem(LOGIN_PASSWORD_SESSION_KEY)
  window.dispatchEvent(new Event('auth-change'))
}

/** 만료/무효 시 세션 정리 후 로그인으로 이동. 정리했으면 true */
export function redirectToLoginIfExpired(navigateToLogin?: () => void): boolean {
  const token = getAuthToken()
  const flagged = localStorage.getItem(IS_LOGGED_IN_KEY) === 'true'
  if (!token && !flagged) return false
  if (token && !isAuthTokenExpired(token)) return false

  clearAuthSession()
  if (navigateToLogin) navigateToLogin()
  else if (!window.location.pathname.startsWith('/login')) {
    window.location.assign('/login')
  }
  return true
}
