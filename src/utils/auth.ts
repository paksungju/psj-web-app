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
