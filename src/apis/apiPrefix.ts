/** `/api/*` 요청 prefix (배포: 현재 origin, 로컬: '' → Vite/nginx 프록시) */
export function getApiPrefix(): string {
  const fromEnv = import.meta.env.VITE_API_BASE as string | undefined
  if (fromEnv?.trim()) return fromEnv.replace(/\/$/, '')
  if (typeof window === 'undefined') return ''
  const { protocol, host, hostname } = window.location
  if (hostname === 'impsj.net' || hostname.endsWith('.impsj.net')) {
    return `${protocol}//${host}`
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return ''
  }
  return 'http://impsj.net'
}
