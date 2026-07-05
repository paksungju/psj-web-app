import { useEffect, useState, useRef, useCallback, useLayoutEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { NavigateFunction } from 'react-router-dom'
import { CircularProgress } from '@mui/material'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import TopBar from '../../components/TopBar'
import { randomUUID } from '../../utils/randomUUID'

// ── 세션 ID 관리 ──────────────────────────────────────────────────────────────
const SESSION_KEY = 'chat_session_id'

function getOrCreateSessionId(): string {
  let sid = localStorage.getItem(SESSION_KEY)
  if (!sid) {
    sid = randomUUID()
    localStorage.setItem(SESSION_KEY, sid)
  }
  return sid
}

function createNewSessionId(): string {
  const sid = randomUUID()
  localStorage.setItem(SESSION_KEY, sid)
  return sid
}

// ── 타입 ──────────────────────────────────────────────────────────────────────
type ModelType = 'qwen' | 'claude' | 'gemini' | 'gemma'

interface ChatMessage {
  id: number
  author: 'me' | 'bot'
  text: string
  time: string
  model?: ModelType
}

interface SessionItem {
  session_id: string
  title: string
  message_count: number
  last_id: number
}

// ── 상수 ──────────────────────────────────────────────────────────────────────
const CHAT_PAGE_SIZE = 10
/** 로그인 페이지와 동일 키 — 채팅 저장 시 DB message JSON에 로그인 id 넣기 위해 Bearer 전달 */
const AUTH_TOKEN_KEY = 'auth_token'

function chatAuthHeaders(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {}
  const t = localStorage.getItem(AUTH_TOKEN_KEY)
  return t ? { Authorization: `Bearer ${t}` } : {}
}

async function readFastApiErrorDetail(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: unknown }
    const d = data.detail
    if (typeof d === 'string') return d
    if (Array.isArray(d) && d.length > 0) {
      const first = d[0]
      if (typeof first === 'string') return first
      if (first && typeof first === 'object' && 'msg' in first) return String((first as { msg: string }).msg)
    }
  } catch {
    /* ignore */
  }
  if (res.status === 401) return '로그인이 만료되었거나 토큰이 유효하지 않습니다.'
  return `요청 실패 (HTTP ${res.status})`
}

function clearAuthAndNavigateToLogin(navigate: NavigateFunction): void {
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem('isLoggedIn')
  window.dispatchEvent(new Event('auth-change'))
  navigate('/login', { replace: true })
}

/**
 * `/api/*` 요청용 (배포: 현재 origin, 로컬: '' → Vite가 /api 프록시)
 * HTTPS 페이지에서 http://impsj.net 하드코딩 시 브라우저가 막아 세션 목록이 비는 경우가 많음.
 */
function getApiPrefix(): string {
  const fromEnv = import.meta.env.VITE_API_BASE as string | undefined
  if (fromEnv?.trim()) return fromEnv.replace(/\/$/, '')
  if (typeof window === 'undefined') return 'http://impsj.net'
  const { protocol, host, hostname } = window.location
  if (hostname === 'impsj.net' || hostname.endsWith('.impsj.net')) {
    return `${protocol}//${host}`
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return ''
  }
  return 'http://impsj.net'
}

/** 스트림·RAG 등 /api 밖 경로 (localhost는 Vite 프록시 → VITE_DEV_PROXY_TARGET) */
function getStreamBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE as string | undefined
  if (fromEnv?.trim()) return fromEnv.replace(/\/$/, '')
  if (typeof window === 'undefined') return 'http://impsj.net'
  const { protocol, host, hostname } = window.location
  if (hostname === 'impsj.net' || hostname.endsWith('.impsj.net')) {
    return `${protocol}//${host}`
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return ''
  }
  return 'http://impsj.net'
}

const API_PREFIX = getApiPrefix()
const STREAM_BASE = getStreamBase()

// ── 아이콘 ────────────────────────────────────────────────────────────────────
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const MenuIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
  </svg>
)

const ChatIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const QwenLogo = () => (
  <div style={{
    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg, #0ea5e9, #4f46e5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, color: '#fff',
  }}>Q</div>
)

const ClaudeLogo = () => (
  <div style={{
    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg, #d97706, #f59e0b)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, color: '#fff',
  }}>C</div>
)

const GeminiLogo = () => (
  <div style={{
    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg, #4285f4, #8ab4f8)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, color: '#fff',
  }}>G</div>
)

const GemmaLogo = () => (
  <div style={{
    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg, #ea4335, #fbbc04)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, color: '#fff',
  }}>G4</div>
)

const MODEL_TAB_STYLE: Record<ModelType, { activeBg: string; label: string }> = {
  qwen: { activeBg: '#4f46e5', label: 'Qwen 3.6' },
  claude: { activeBg: '#d97706', label: 'Claude' },
  gemini: { activeBg: '#2563eb', label: 'Gemini' },
  gemma: { activeBg: '#ea4335', label: 'Gemma 4' },
}

function BotAvatar({ model }: { model?: ModelType }) {
  if (model === 'claude') return <ClaudeLogo />
  if (model === 'gemini') return <GeminiLogo />
  if (model === 'gemma') return <GemmaLogo />
  return <QwenLogo />
}

// ── 모델 선택 토글 ─────────────────────────────────────────────────────────────
function ModelToggle({ model, onChange }: { model: ModelType; onChange: (m: ModelType) => void }) {
  const order: ModelType[] = ['qwen', 'claude', 'gemini', 'gemma']
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end',
      background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 10, padding: 3, gap: 2, maxWidth: 320,
    }}>
      {order.map((m) => (
        <button key={m} onClick={() => onChange(m)} style={{
          padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
          background: model === m ? MODEL_TAB_STYLE[m].activeBg : 'transparent',
          color: model === m ? '#fff' : '#6b7280',
          transition: 'all 0.15s',
        }}>
          {MODEL_TAB_STYLE[m].label}
        </button>
      ))}
    </div>
  )
}

// ── 메시지 정규화 ─────────────────────────────────────────────────────────────
const normalizeText = (value: any): string => {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    if (typeof value.content === 'string') return value.content
    const data: any = value.data
    if (data) {
      if (typeof data.content === 'string') return data.content
      if (Array.isArray(data.content)) {
        return data.content.map((c: any) => (typeof c === 'string' ? c : c?.text ?? '')).join(' ')
      }
    }
  }
  try { return JSON.stringify(value) } catch { return String(value) }
}

function mapRawRowToChatMessage(item: any, idx: number): ChatMessage {
  let payload: any = item.message
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload) } catch { /* 그대로 */ }
  }
  const rawType = payload?.type
  const author: 'me' | 'bot' =
    typeof rawType === 'string' && rawType.toLowerCase() === 'ai' ? 'bot' : 'me'
  const created = item.created_at ?? item.time ?? new Date().toISOString()
  const d = new Date(created)
  const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  // additional_kwargs.chat_api 에서 모델 정보 추출 (qwen | exaone | claude | gemini | gemma)
  const chatApi = payload?.data?.additional_kwargs?.chat_api as string | undefined
  const model: ModelType | undefined =
    chatApi === 'claude' ? 'claude'
      : chatApi === 'gemini' ? 'gemini'
      : chatApi === 'gemma' ? 'gemma'
      : chatApi === 'qwen' || chatApi === 'exaone' ? 'qwen'
      : undefined
  return {
    id: item.id ?? idx + 1,
    author,
    text: normalizeText(item.text ?? payload ?? item.message ?? ''),
    time,
    model,
  }
}

// ── 메시지 버블 ───────────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isMe = msg.author === 'me'
  return (
    <div style={{
      display: 'flex', gap: 10,
      flexDirection: isMe ? 'row-reverse' : 'row',
      alignItems: 'flex-start', marginBottom: 16, padding: '0 4px',
    }}>
      {!isMe && <BotAvatar model={msg.model} />}
      {isMe && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: '#e5e7eb', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 13,
        }}>👤</div>
      )}
      <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: 4 }}>
        <div style={{
          background: isMe ? '#4f46e5' : '#f3f4f6',
          border: isMe ? 'none' : '1px solid #e5e7eb',
          borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          padding: '10px 14px',
          fontSize: 14, lineHeight: 1.65,
          color: isMe ? '#fff' : '#1f2937',
          wordBreak: 'break-word',
        }}>
          {isMe
            ? <span style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</span>
            : msg.text === ''
              ? <ThinkingDots />
              : <div style={{ fontSize: 14 }}><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.text}</ReactMarkdown></div>
          }
        </div>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{msg.time}</span>
      </div>
    </div>
  )
}

// ── 생각 중 애니메이션 ──────────────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: '50%', background: '#7c3aed',
          display: 'inline-block',
          animation: 'bounce 1.2s infinite ease-in-out',
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0.6);opacity:.4}40%{transform:scale(1);opacity:1}}`}</style>
    </span>
  )
}

// ── 빈 화면 ───────────────────────────────────────────────────────────────────
function EmptyState({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  const suggestions = ['안녕! 자기소개 해줘', '오늘 할 일 목록 만들어줘', '간단한 Python 코드 예제', '최근 AI 트렌드 알려줘']
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 40 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
          background: 'linear-gradient(135deg, #0ea5e9, #4f46e5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, fontWeight: 700, color: '#fff',
        }}>Q</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: '#111827', marginBottom: 6 }}>Qwen 3.6</div>
        <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>Ollama · 로컬 실행 중<br />무엇이든 물어보세요</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 440, width: '100%' }}>
        {suggestions.map((s) => (
          <button key={s} onClick={() => onSuggestion(s)} style={{
            background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12,
            padding: '12px 14px', fontSize: 13, color: '#374151', cursor: 'pointer',
            textAlign: 'left', lineHeight: 1.5, transition: 'all 0.15s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#4f46e5'; (e.currentTarget as HTMLButtonElement).style.color = '#1f2937' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLButtonElement).style.color = '#374151' }}
          >{s}</button>
        ))}
      </div>
    </div>
  )
}

// ── 문서 업로드 버튼 ───────────────────────────────────────────────────────────
function UploadButton({ onUploaded }: { onUploaded: (msg: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    try {
      const formData = new FormData()
      files.forEach(f => formData.append('files', f))
      const res = await fetch(`${STREAM_BASE}/rag/upload`, { method: 'POST', body: formData })
      const data = await res.json() as { results: { file: string; chunks?: number; status: string }[] }
      const summary = data.results.map(r =>
        r.status === 'ok' ? `✅ ${r.file} (${r.chunks}청크)` : `❌ ${r.file}`
      ).join(', ')
      onUploaded(`📎 문서 업로드 완료: ${summary}`)
    } catch {
      onUploaded('❌ 문서 업로드 실패')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" multiple accept=".pdf,.txt,.docx"
        style={{ display: 'none' }} onChange={handleFiles} />
      <button onClick={() => inputRef.current?.click()} disabled={uploading}
        title="PDF/TXT/DOCX 업로드 (RAG)"
        style={{
          background: 'none', border: '1px solid #d1d5db', borderRadius: 10,
          padding: '8px 10px', cursor: uploading ? 'wait' : 'pointer',
          color: uploading ? '#9ca3af' : '#6b7280', display: 'flex', alignItems: 'center',
          transition: 'all 0.15s', flexShrink: 0,
        }}
        onMouseEnter={e => { if (!uploading) (e.currentTarget as HTMLButtonElement).style.borderColor = '#7c3aed' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#d1d5db' }}
      >
        {uploading ? <CircularProgress size={16} sx={{ color: '#7c3aed' }} /> : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        )}
      </button>
    </>
  )
}

// ── 웹 검색 토글 ──────────────────────────────────────────────────────────────
function WebSearchToggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!enabled)}
      title={enabled ? '웹 검색 ON (클릭하여 끄기)' : '웹 검색 OFF'}
      style={{
        background: enabled ? '#dcfce7' : 'none',
        border: `1px solid ${enabled ? '#22c55e' : '#d1d5db'}`,
        borderRadius: 10, padding: '7px 10px', cursor: 'pointer',
        color: enabled ? '#15803d' : '#6b7280',
        display: 'flex', alignItems: 'center', gap: 5,
        fontSize: 12, fontWeight: 600, transition: 'all 0.15s', flexShrink: 0,
      }}
      onMouseEnter={e => { if (!enabled) (e.currentTarget as HTMLButtonElement).style.borderColor = '#22c55e' }}
      onMouseLeave={e => { if (!enabled) (e.currentTarget as HTMLButtonElement).style.borderColor = '#d1d5db' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
      </svg>
      {enabled ? '웹검색 ON' : '웹검색'}
    </button>
  )
}

// ── 사이드바 컴포넌트 ──────────────────────────────────────────────────────────
interface SidebarProps {
  /** 목록에 표시할 항목 (현재 세션만 있고 아직 DB에 없으면 맨 앞에 가상 항목 포함) */
  sessions: SessionItem[]
  /** API에서 받은 세션 개수 (0이면 안내 문구 표시) */
  serverSessionCount: number
  /** 세션 API 실패 시 메시지 */
  listError?: string | null
  currentSessionId: string
  loading: boolean
  onSelectSession: (sid: string) => void
  onNewChat: () => void
  refreshing: boolean
  onCloseMobile?: () => void
  onRetryList?: () => void
  onDeleteSession?: (sid: string) => void
}

function Sidebar({ sessions, serverSessionCount, listError, currentSessionId, loading, onSelectSession, onNewChat, refreshing, onCloseMobile, onRetryList, onDeleteSession }: SidebarProps) {
  const [menuSid, setMenuSid] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!menuSid) return
    const close = () => setMenuSid(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menuSid])

  const openMenu = (e: React.MouseEvent, sid: string) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, left: rect.left - 80 })
    setMenuSid(prev => prev === sid ? null : sid)
  }

  return (
    <div style={{
      width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: '#f3f4f6', borderRight: '1px solid #e5e7eb',
      height: '100%', minHeight: 0, overflow: 'hidden',
    }}>
      {/* 사이드바 헤더 */}
      <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', letterSpacing: '0.02em' }}>
            채팅
          </div>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="목록 닫기"
              style={{
                border: 'none', background: '#e5e7eb', borderRadius: 8,
                padding: '4px 10px', fontSize: 12, color: '#374151', cursor: 'pointer',
              }}
            >
              닫기
            </button>
          )}
        </div>
        {/* 새 채팅 버튼 */}
        <button
          onClick={() => { onNewChat(); onCloseMobile?.() }}
          disabled={loading}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 10,
            padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#4338ca' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#4f46e5' }}
        >
          <PlusIcon /> 새 채팅
        </button>
      </div>

      {/* 세션 목록 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
        {listError && (
          <div style={{
            marginBottom: 10, padding: '10px 10px', borderRadius: 8, fontSize: 12, lineHeight: 1.5,
            background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca',
          }}>
            {listError}
            {onRetryList && (
              <button
                type="button"
                onClick={onRetryList}
                style={{
                  display: 'block', marginTop: 8, width: '100%', padding: '6px 10px', borderRadius: 6,
                  border: '1px solid #fca5a5', background: '#fff', color: '#991b1b', fontSize: 12, cursor: 'pointer',
                }}
              >
                다시 시도
              </button>
            )}
          </div>
        )}
        {refreshing && serverSessionCount === 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
            <CircularProgress size={18} sx={{ color: '#9ca3af' }} />
          </div>
        )}
        {serverSessionCount === 0 && !refreshing && (
          <div style={{ padding: '12px 8px 8px', fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 1.5 }}>
            서버에 저장된 대화가 없습니다.<br />
            <span style={{ fontSize: 11 }}>메시지를 내면 목록에 반영됩니다.</span>
          </div>
        )}
        {sessions.map((s) => {
          const isActive = s.session_id === currentSessionId
          return (
            <div key={s.session_id} style={{ position: 'relative', marginBottom: 2 }}>
              {/* 세션 선택 버튼 */}
              <button
                onClick={() => { onSelectSession(s.session_id); onCloseMobile?.() }}
                style={{
                  width: '100%', textAlign: 'left', border: 'none', borderRadius: 8,
                  padding: '9px 32px 9px 10px', cursor: 'pointer',
                  background: isActive ? '#ede9fe' : 'transparent',
                  transition: 'background 0.12s',
                  display: 'flex', flexDirection: 'column', gap: 3,
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                {/* 제목 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: isActive ? '#4f46e5' : '#9ca3af', flexShrink: 0 }}>
                    <ChatIcon />
                  </span>
                  <span style={{
                    fontSize: 13, fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#3730a3' : '#374151',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    lineHeight: 1.4,
                  }}>
                    {s.title || '새 대화'}
                  </span>
                </div>
                {/* 메시지 수 */}
                <div style={{ paddingLeft: 20, fontSize: 11, color: '#9ca3af' }}>
                  {Math.floor(s.message_count / 2)}턴 · #{s.session_id.slice(0, 6)}
                </div>
              </button>

              {/* ⋮ 더보기 버튼 — 선택된 항목에서만 노출 */}
              {isActive && (
                <button
                  onClick={(e) => openMenu(e, s.session_id)}
                  title="더보기"
                  style={{
                    position: 'absolute', top: '50%', right: 4,
                    transform: 'translateY(-50%)',
                    border: 'none', borderRadius: 6, background: 'transparent',
                    width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#9ca3af', fontSize: 16, lineHeight: 1,
                    padding: 0,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#e5e7eb'; (e.currentTarget as HTMLButtonElement).style.color = '#374151' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af' }}
                >
                  ⋮
                </button>
              )}

              {/* 팝업 메뉴 */}
              {menuSid === s.session_id && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'fixed', top: menuPos.top, left: menuPos.left,
                    background: '#ffffff', border: '1px solid #e5e7eb',
                    borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                    zIndex: 9999, minWidth: 110, overflow: 'hidden',
                  }}
                >
                  <button
                    onClick={() => {
                      setMenuSid(null)
                      onDeleteSession?.(s.session_id)
                    }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 14px', border: 'none', background: 'transparent',
                      cursor: 'pointer', fontSize: 13, color: '#ef4444',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 15 }}>🗑</span> 삭제
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 사이드바 하단 */}
      <div style={{ borderTop: '1px solid #e5e7eb', padding: '10px 14px', fontSize: 11, color: '#9ca3af' }}>
        현재: #{currentSessionId.slice(0, 8)}
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function ChatPage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMoreOlder, setHasMoreOlder] = useState(false)
  const [model, setModel] = useState<ModelType>('qwen')
  const [webSearch, setWebSearch] = useState(false)
  const [sessionId, setSessionId] = useState<string>(() => getOrCreateSessionId())
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [sessionsRefreshing, setSessionsRefreshing] = useState(false)
  // 사실 저장 알림 토스트
  const [savedFactToast, setSavedFactToast] = useState<string | null>(null)
  const factToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sessionsListError, setSessionsListError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? !window.matchMedia('(max-width: 900px)').matches : true,
  )
  const [isNarrow, setIsNarrow] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const oldestServerMessageIdRef = useRef<number | null>(null)
  const skipNextBottomScrollRef = useRef(false)
  const scrollPreserveRef = useRef<{ prevHeight: number; prevTop: number } | null>(null)
  const loadingOlderRef = useRef(false)
  const hasMoreOlderRef = useRef(false)
  const messagesRef = useRef<ChatMessage[]>([])

  useEffect(() => { hasMoreOlderRef.current = hasMoreOlder }, [hasMoreOlder])
  useEffect(() => { messagesRef.current = messages }, [messages])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    const apply = () => {
      const n = mq.matches
      setIsNarrow(n)
      if (!n) setSidebarOpen(true)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  /** DB 목록에 없는 현재 세션(새 채팅)은 맨 위에 가상 행으로 표시 */
  const displaySessions = useMemo((): SessionItem[] => {
    const hasCurrent = sessions.some(s => s.session_id === sessionId)
    const firstUser = messages.find(m => m.author === 'me')?.text?.trim() || ''
    const draftTitle = firstUser
      ? (firstUser.length > 52 ? `${firstUser.slice(0, 52)}…` : firstUser)
      : '새 대화'
    if (!hasCurrent) {
      const phantom: SessionItem = {
        session_id: sessionId,
        title: draftTitle,
        message_count: Math.max(messages.length, 0),
        last_id: 0,
      }
      return [phantom, ...sessions]
    }
    return sessions
  }, [sessions, sessionId, messages])

  const activeTitle = useMemo(() => {
    const row = displaySessions.find(s => s.session_id === sessionId)
    return row?.title?.trim() || '새 대화'
  }, [displaySessions, sessionId])

  const now = () => {
    const d = new Date()
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  useLayoutEffect(() => {
    const p = scrollPreserveRef.current
    const el = scrollRef.current
    if (!p || !el) return
    scrollPreserveRef.current = null
    el.scrollTop = p.prevTop + (el.scrollHeight - p.prevHeight)
  }, [messages])

  useEffect(() => {
    if (skipNextBottomScrollRef.current) { skipNextBottomScrollRef.current = false; return }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── 세션 목록 불러오기 ────────────────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    setSessionsRefreshing(true)
    setSessionsListError(null)
    try {
      const prefix = getApiPrefix()
      const url = `${prefix}/api/v1/chat/sessions`
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        console.error('세션 목록 HTTP 오류:', res.status, url, body)
        let detail = ''
        try {
          const j = JSON.parse(body) as { detail?: unknown }
          if (j.detail != null) detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
        } catch {
          /* ignore */
        }
        const hint =
          res.status === 502 || res.status === 503
            ? ' (백엔드/프록시 미기동: 로컬이면 docker compose + nginx 8080, 또는 psj-web-app/.env 의 VITE_DEV_PROXY_TARGET 확인)'
            : ''
        setSessionsListError(
          `대화 목록을 불러오지 못했습니다 (${res.status}${detail ? `: ${detail}` : ''})${hint}`,
        )
        return
      }
      const data = await res.json() as unknown
      const list = Array.isArray(data)
        ? data
        : data && typeof data === 'object' && Array.isArray((data as { sessions?: unknown }).sessions)
          ? (data as { sessions: SessionItem[] }).sessions
          : []
      setSessions(list)
    } catch (e) {
      console.error('세션 목록 조회 오류:', e)
      setSessionsListError('대화 목록 요청에 실패했습니다. 네트워크를 확인해 주세요.')
    } finally {
      setSessionsRefreshing(false)
    }
  }, [])

  // 마운트 시 세션 목록 조회
  useEffect(() => { fetchSessions() }, [fetchSessions])

  // ── 무한 스크롤 ─────────────────────────────────────────────────────────
  const loadOlderMessages = useCallback(async () => {
    if (loadingOlderRef.current || !hasMoreOlderRef.current) return
    const beforeId = oldestServerMessageIdRef.current
    if (beforeId == null) return

    loadingOlderRef.current = true
    setLoadingOlder(true)
    try {
      const res = await fetch(`${API_PREFIX}/api/v1/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, limit: CHAT_PAGE_SIZE, tail: false, before_id: beforeId }),
      })
      if (!res.ok) return
      const data = await res.json() as any
      const rawList: any[] = Array.isArray(data) ? data : Array.isArray(data?.messages) ? data.messages : []
      const older: ChatMessage[] = rawList.map((item, idx) => mapRawRowToChatMessage(item, idx))

      if (older.length < CHAT_PAGE_SIZE) { setHasMoreOlder(false); hasMoreOlderRef.current = false }
      if (older.length === 0) return

      const prev = messagesRef.current
      const existing = new Set(prev.map(m => m.id))
      const merged = older.filter(m => !existing.has(m.id))
      if (merged.length === 0) return

      const el = scrollRef.current
      if (el) scrollPreserveRef.current = { prevHeight: el.scrollHeight, prevTop: el.scrollTop }
      skipNextBottomScrollRef.current = true

      oldestServerMessageIdRef.current = Math.min(...merged.map(m => m.id))
      setMessages([...merged, ...prev])
    } catch (e) {
      console.error('이전 메시지 로드 오류:', e)
    } finally {
      loadingOlderRef.current = false
      setLoadingOlder(false)
    }
  }, [sessionId])

  const onMessagesScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || loadingOlderRef.current || !hasMoreOlderRef.current) return
    if (el.scrollTop < 120) void loadOlderMessages()
  }, [loadOlderMessages])

  // ── 히스토리 불러오기 (sessionId 변경 시) ────────────────────────────────
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch(`${API_PREFIX}/api/v1/chat/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, limit: CHAT_PAGE_SIZE, tail: true }),
        })
        if (!res.ok) return
        const data = await res.json() as any
        const rawList: any[] = Array.isArray(data) ? data : Array.isArray(data?.messages) ? data.messages : []
        const serverMessages: ChatMessage[] = rawList.map((item, idx) => mapRawRowToChatMessage(item, idx))

        if (serverMessages.length > 0) {
          const ids = rawList.map((r: any) => r.id).filter((id: unknown): id is number => typeof id === 'number')
          if (ids.length > 0) oldestServerMessageIdRef.current = Math.min(...ids)
          setHasMoreOlder(serverMessages.length >= CHAT_PAGE_SIZE)
          hasMoreOlderRef.current = serverMessages.length >= CHAT_PAGE_SIZE
          setMessages(serverMessages)
        } else {
          setMessages([])
          setHasMoreOlder(false)
          hasMoreOlderRef.current = false
          oldestServerMessageIdRef.current = null
        }
      } catch (e) {
        console.error('히스토리 조회 오류:', e)
      }
    }
    fetchMessages()
  }, [sessionId])

  // ── 사실 저장 토스트 표시 ────────────────────────────────────────────────
  const showFactToast = useCallback((fact: string) => {
    if (factToastTimerRef.current) clearTimeout(factToastTimerRef.current)
    setSavedFactToast(fact)
    factToastTimerRef.current = setTimeout(() => setSavedFactToast(null), 4000)
  }, [])

  // ── 새 채팅 ──────────────────────────────────────────────────────────────
  const startNewChat = useCallback(() => {
    if (loading) return
    const newSid = createNewSessionId()
    setSessionId(newSid)
    setMessages([])
    setInput('')
    setHasMoreOlder(false)
    hasMoreOlderRef.current = false
    oldestServerMessageIdRef.current = null
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches) {
      setSidebarOpen(false)
    }
  }, [loading])

  // ── 세션 선택 ────────────────────────────────────────────────────────────
  const handleSelectSession = useCallback((sid: string) => {
    if (sid === sessionId || loading) return
    localStorage.setItem(SESSION_KEY, sid)
    setSessionId(sid)
    setMessages([])
    setInput('')
    setHasMoreOlder(false)
    hasMoreOlderRef.current = false
    oldestServerMessageIdRef.current = null
  }, [sessionId, loading])

  // ── 메시지 전송 ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text?: string) => {
    const trimmed = (text ?? input).trim()
    if (!trimmed || loading) return
    const useWebSearch = webSearch
    const sid = sessionId

    const userMsgId = Date.now()
    setMessages(prev => [...prev, { id: userMsgId, author: 'me', text: trimmed, time: now(), model }])
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)

    if (model === 'qwen' || model === 'gemma') {
      const botMsgId = userMsgId + 1
      setMessages(prev => [...prev, { id: botMsgId, author: 'bot', text: '', time: now(), model }])

      try {
        const streamPath = model === 'gemma' ? 'ask-gemma-stream' : 'ask-stream'
        const url = `${STREAM_BASE}/${streamPath}?topic=${encodeURIComponent(trimmed)}&session_id=${sid}&web_search=${useWebSearch}`
        const res = await fetch(url, { headers: chatAuthHeaders() })
        if (res.status === 401) {
          const detail = await readFastApiErrorDetail(res)
          window.alert(detail)
          clearAuthAndNavigateToLogin(navigate)
          setMessages(prev => prev.map(m =>
            m.id === botMsgId ? { ...m, text: detail } : m,
          ))
          return
        }
        if (!res.ok) {
          const detail = await readFastApiErrorDetail(res)
          setMessages(prev => prev.map(m =>
            m.id === botMsgId ? { ...m, text: detail } : m,
          ))
          return
        }
        if (!res.body) throw new Error('스트림 없음')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data:')) continue
            const raw = line.slice(5).trim()
            if (raw === '[DONE]') break
            try {
              const payload = JSON.parse(raw) as { delta?: string; fact_saved?: string }
              if (payload.fact_saved) {
                // 사실 저장 알림 토스트
                showFactToast(payload.fact_saved)
              }
              if (payload.delta) {
                setMessages(prev => prev.map(m =>
                  m.id === botMsgId ? { ...m, text: m.text + payload.delta! } : m
                ))
              }
            } catch { /* skip */ }
          }
        }
      } catch (e) {
        console.error('스트리밍 오류:', e)
        setMessages(prev => prev.map(m =>
          m.id === botMsgId ? { ...m, text: '일시적인 오류로 응답을 가져오지 못했습니다.' } : m
        ))
      } finally {
        setLoading(false)
        setTimeout(() => fetchSessions(), 800)
      }
    } else {
      const path = model === 'claude' ? 'ask-claude' : 'ask-gemini'
      try {
        const url = `${STREAM_BASE}/${path}?topic=${encodeURIComponent(trimmed)}&session_id=${sid}&web_search=${useWebSearch}`
        const res = await fetch(url, { headers: chatAuthHeaders() })
        if (res.status === 401) {
          const detail = await readFastApiErrorDetail(res)
          window.alert(detail)
          clearAuthAndNavigateToLogin(navigate)
          setMessages(prev => [...prev, { id: userMsgId + 1, author: 'bot', text: detail, time: now(), model }])
          return
        }
        if (!res.ok) {
          const detail = await readFastApiErrorDetail(res)
          setMessages(prev => [...prev, { id: userMsgId + 1, author: 'bot', text: detail, time: now(), model }])
          return
        }
        const data = await res.json() as { answer?: string }
        setMessages(prev => [...prev, { id: userMsgId + 1, author: 'bot', text: data?.answer || '(응답이 없습니다.)', time: now(), model }])
      } catch (e) {
        console.error('채팅 오류:', e)
        setMessages(prev => [...prev, { id: userMsgId + 1, author: 'bot', text: '일시적인 오류로 응답을 가져오지 못했습니다.', time: now(), model }])
      } finally {
        setLoading(false)
        setTimeout(() => fetchSessions(), 800)
      }
    }
  }, [input, loading, model, webSearch, sessionId, fetchSessions, navigate])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const handleUploadNotify = (msg: string) => {
    setMessages(prev => [...prev, { id: Date.now(), author: 'bot', text: msg, time: now(), model }])
  }

  // ── 렌더 ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      height: '100%',
      maxHeight: '100%',
      overflow: 'hidden',
      background: '#ffffff',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      {/* 최상단바 */}
      <div style={{ borderBottom: '1px solid #e5e7eb', background: '#ffffff', flexShrink: 0 }}>
        <TopBar />
      </div>

      {/* 📌 사실 저장 토스트 알림 */}
      {savedFactToast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10,
          background: '#1a1a2e', color: '#fff',
          border: '1px solid #4f46e5', borderRadius: 12,
          padding: '12px 18px', boxShadow: '0 4px 24px rgba(79,70,229,0.35)',
          fontSize: 13, fontWeight: 500, maxWidth: 480,
          animation: 'slideDown 0.25s ease',
        }}>
          <span style={{ fontSize: 18 }}>📌</span>
          <div>
            <div style={{ fontWeight: 700, color: '#a5b4fc', marginBottom: 2 }}>사실 저장됨</div>
            <div style={{ color: '#c7d2fe', wordBreak: 'break-word' }}>{savedFactToast}</div>
          </div>
          <button onClick={() => setSavedFactToast(null)} style={{
            background: 'none', border: 'none', color: '#6b7280',
            cursor: 'pointer', fontSize: 16, marginLeft: 8, padding: 0,
          }}>✕</button>
        </div>
      )}
      <style>{`@keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>

      {/* 사이드바 + 채팅 영역 (좌우 분할) */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden', position: 'relative' }}>

        {isNarrow && sidebarOpen && (
          <button
            type="button"
            aria-label="대화 목록 닫기"
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'absolute', inset: 0, zIndex: 1199, border: 'none', padding: 0,
              background: 'rgba(15, 23, 42, 0.35)', cursor: 'pointer',
            }}
          />
        )}

        {/* ── 왼쪽 사이드바 (좁은 화면에서는 슬라이드 패널, 채팅 행 기준 배치) ── */}
        <div
          style={{
            flexShrink: 0,
            height: '100%',
            minHeight: 0,
            ...(isNarrow
              ? {
                position: 'absolute' as const,
                left: 0,
                top: 0,
                bottom: 0,
                zIndex: 1200,
                transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
                transition: 'transform 0.22s ease',
                boxShadow: sidebarOpen ? '8px 0 32px rgba(0,0,0,0.12)' : 'none',
              }
              : {}),
          }}
        >
          <Sidebar
            sessions={displaySessions}
            serverSessionCount={sessions.length}
            listError={sessionsListError}
            currentSessionId={sessionId}
            loading={loading}
            onSelectSession={handleSelectSession}
            onNewChat={startNewChat}
            refreshing={sessionsRefreshing}
            onCloseMobile={isNarrow ? () => setSidebarOpen(false) : undefined}
            onRetryList={fetchSessions}
            onDeleteSession={async (sid) => {
              try {
                const res = await fetch(
                  `${getApiPrefix()}/api/v1/chat/sessions/${encodeURIComponent(sid)}`,
                  { method: 'DELETE', headers: chatAuthHeaders() },
                )
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                // 삭제된 세션이 현재 활성 세션이면 새 채팅으로 전환
                if (sid === sessionId) startNewChat()
                // 세션 목록 새로고침
                await fetchSessions()
              } catch (_err) {
                alert('삭제 중 오류가 발생했습니다.')
              }
            }}
          />
        </div>

        {/* ── 오른쪽 채팅 영역 ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden', color: '#111827' }}>

          {/* 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0, gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
              {isNarrow && (
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  title="대화 목록"
                  style={{
                    flexShrink: 0, width: 40, height: 40, borderRadius: 10, border: '1px solid #e5e7eb',
                    background: '#fff', color: '#374151', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <MenuIcon />
                </button>
              )}
              <BotAvatar model={model} />
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 15, fontWeight: 600, color: '#111827',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }} title={activeTitle}>
                  {activeTitle}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>
                  {model === 'claude' ? 'Claude · Anthropic'
                    : model === 'gemini' ? 'Gemini · Google'
                    : model === 'gemma' ? 'Gemma 4 · oMLX'
                    : 'Qwen 3.6 · Ollama'}
                  {' · '}
                  <span title={`세션 ID: ${sessionId}`} style={{ color: '#9ca3af' }}>
                    #{sessionId.slice(0, 6)}
                  </span>
                </div>
              </div>
            </div>
            <ModelToggle model={model} onChange={setModel} />
          </div>

          {/* 메시지 영역 — flex 컬럼 안에서 스크롤되려면 minHeight:0 + flex-basis 0 필요 */}
          <div
            ref={scrollRef}
            onScroll={onMessagesScroll}
            style={{
              flex: '1 1 0%',
              minHeight: 0,
              maxHeight: '100%',
              overflowY: 'auto',
              overflowX: 'hidden',
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch',
              padding: '20px 20px 0',
              background: '#ffffff',
            }}
          >
            {loadingOlder && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 16px' }}>
                <CircularProgress size={20} sx={{ color: '#7c6af5' }} />
              </div>
            )}
            {messages.length === 0
              ? <EmptyState onSuggestion={(s) => sendMessage(s)} />
              : messages.map((msg) => <MessageBubble key={`${msg.id}-${msg.time}`} msg={msg} />)
            }
            {loading && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, padding: '0 4px' }}>
                <BotAvatar model={model} />
                <div style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '18px 18px 18px 4px', padding: '10px 16px' }}>
                  <CircularProgress size={14} style={{ color: '#7c6af5' }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} style={{ height: 16 }} />
          </div>

          {/* 입력창 */}
          <div style={{ padding: '12px 16px 20px', borderTop: '1px solid #e5e7eb', background: '#ffffff', flexShrink: 0 }}>
            <div style={{
              display: 'flex', gap: 10, alignItems: 'flex-end',
              background: '#f9fafb', border: '1px solid #e5e7eb',
              borderRadius: 16, padding: '10px 14px',
            }}>
              <UploadButton onUploaded={handleUploadNotify} />
              <WebSearchToggle enabled={webSearch} onChange={setWebSearch} />
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
                rows={1}
                disabled={loading}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: '#111827', fontSize: 14, resize: 'none', maxHeight: 160,
                  overflowY: 'auto', lineHeight: 1.6, fontFamily: 'inherit',
                  opacity: loading ? 0.5 : 1,
                }}
                onInput={e => {
                  const t = e.target as HTMLTextAreaElement
                  t.style.height = 'auto'
                  t.style.height = Math.min(t.scrollHeight, 160) + 'px'
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                style={{
                  width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: loading || !input.trim() ? '#d1d5db' : '#4f46e5',
                  color: loading || !input.trim() ? '#9ca3af' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'background 0.15s',
                }}
              >
                {loading ? <CircularProgress size={16} style={{ color: '#fff' }} /> : <SendIcon />}
              </button>
            </div>
            <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
              {webSearch
                ? '웹검색 ON · DuckDuckGo로 검색 후 답변에 반영됩니다'
                : model === 'qwen'
                  ? 'Qwen 3.6 · Ollama 로컬 · 웹검색 ON 시 검색만 외부 연동'
                  : model === 'gemma'
                    ? 'Gemma 4 · oMLX 로컬'
                  : model === 'claude'
                    ? 'Claude · Anthropic API'
                    : 'Gemini · Google API (서버에 GEMINI_API_KEY 설정)'}
            </p>
          </div>
        </div>
      </div>

      {/* 마크다운 + 스크롤바 스타일 */}
      <style>{`
        textarea::placeholder { color: #9ca3af; opacity: 1; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
        pre { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; overflow-x: auto; margin: 6px 0; font-size: 13px; line-height: 1.6; color: #1f2937; }
        code { font-family: 'Fira Code', monospace; font-size: 13px; }
        p > code { background: #e5e7eb; padding: 2px 6px; border-radius: 4px; color: #1f2937; }
        p { margin: 4px 0; line-height: 1.7; color: inherit; }
        ul, ol { padding-left: 18px; margin: 4px 0; }
        li { margin: 2px 0; line-height: 1.6; }
      `}</style>
    </div>
  )
}
