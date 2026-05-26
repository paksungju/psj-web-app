import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  Avatar,
  CircularProgress,
  Link,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Collapse,
} from '@mui/material'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import CloseIcon from '@mui/icons-material/Close'
import CheckIcon from '@mui/icons-material/Check'
import VisibilityIcon from '@mui/icons-material/Visibility'
import TopBar from '../../../components/TopBar'
import SendIcon from '@mui/icons-material/Send'
import {
  fetchAppDataListApi,
  createAppDataApi,
  updateAppDataApi,
  type ApiAppData,
  type ApiAppPayload,
} from '../../../apis/appApi'
import { randomUUID } from '../../../utils/randomUUID'

const MEMO_SESSION_KEY = 'memo_session_id'

interface ChatMessage {
  id: number
  author: 'me' | 'bot'
  text: string
  time: string
}

const URL_REGEX = /https?:\/\/[^\s]+/gi
function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX)
  return matches ? [...new Set(matches)] : []
}

/** OG 메타 기반 링크 미리보기 데이터 */
interface OgPreviewData {
  url: string
  title?: string
  description?: string
  image?: string
  loading: boolean
  error?: string
}

/** YouTube URL에서 비디오 ID 추출 */
function getYoutubeVideoId(url: string): string | null {
  try {
    const u = new URL(url.trim())
    if (/youtube\.com|youtu\.be/i.test(u.hostname)) {
      if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0] || null
      return u.searchParams.get('v') || null
    }
  } catch {
    /* ignore */
  }
  return null
}

/** OG 메타 가져오기. YouTube는 직접 썸네일, 그 외 Microlink(프록시) */
async function fetchOgPreview(url: string): Promise<Pick<OgPreviewData, 'title' | 'description' | 'image'>> {
  const ytId = getYoutubeVideoId(url)
  if (ytId) {
    return {
      title: 'YouTube',
      description: undefined,
      image: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
    }
  }
  const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}`
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`
  const res = await fetch(proxyUrl)
  if (!res.ok) throw new Error('미리보기를 불러올 수 없습니다.')
  const json = await res.json()
  if (json.status !== 'success' || !json.data) throw new Error('미리보기를 불러올 수 없습니다.')
  const d = json.data
  return {
    title: d.title || undefined,
    description: d.description || undefined,
    image: d.image?.url || d.logo?.url || undefined,
  }
}

/** 텍스트 안의 URL을 링크로 렌더링 */
function MessageContent({ text, isMe }: { text: string; isMe: boolean }) {
  const urls = extractUrls(text)
  if (urls.length === 0) {
    return <Typography component="span" sx={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{text}</Typography>
  }
  const parts: string[] = []
  let lastIndex = 0
  const re = /https?:\/\/[^\s]+/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index))
    parts.push(m[0])
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))

  return (
    <Typography component="span" sx={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>
      {parts.map((part, i) => {
        if (/^https?:\/\/\S+$/i.test(part.trim())) {
          const url = part.replace(/[.,;:!?)\]]+$/, '')
          const suffix = part.slice(url.length)
          return (
            <span key={i}>
              <Link
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: isMe ? 'primary.contrastText' : 'primary.main',
                  textDecoration: 'underline',
                }}
              >
                {url}
              </Link>
              {suffix}
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </Typography>
  )
}

const MEMO_APP_ID = 1

const initialMessages: ChatMessage[] = [
  {
    id: 1,
    author: 'bot',
    text: '안녕하세요! 무엇을 도와드릴까요?',
    time: '09:00',
  },
  {
    id: 2,
    author: 'me',
    text: '새 기능 아이디어를 정리하고 싶어요.',
    time: '09:01',
  },
]

function appDataToChatMessage(item: ApiAppData, idx: number): ChatMessage {
  const created = item.regist_dt ?? item.update_dt ?? new Date().toISOString()
  const createdDate = new Date(created)
  const time = `${createdDate.getHours().toString().padStart(2, '0')}:${createdDate.getMinutes().toString().padStart(2, '0')}`
  const text = [item.ap_content].filter(Boolean).join('\n') || '-'
  const id = item.data_id != null ? item.data_id : 1000000 + idx
  return {
    id,
    author: item.user_nm ? 'me' : 'bot',
    text,
    time,
  }
}

function getMemoTitle(row: ApiAppData): string {
  const subject = row.ap_subject?.trim()
  if (subject) return subject.length > 48 ? `${subject.slice(0, 48)}…` : subject
  const content = row.ap_content?.trim()
  if (content) {
    const first = content.split('\n')[0]?.trim() || content
    return first.length > 48 ? `${first.slice(0, 48)}…` : first
  }
  return '제목 없음'
}

/** 채팅 session_id 와 동일 — 메모 스레드 식별자(extra_1) */
interface MemoSessionItem {
  session_id: string
  title: string
  message_count: number
  last_id: number
}

function getMemoSessionId(row: ApiAppData): string {
  const sid = row.extra_1?.trim()
  if (sid) return sid
  return `__legacy_${row.data_id ?? 0}`
}

function buildMemoSessions(rows: ApiAppData[]): MemoSessionItem[] {
  const groups = new Map<string, ApiAppData[]>()
  for (const row of rows) {
    const sid = getMemoSessionId(row)
    const list = groups.get(sid) ?? []
    list.push(row)
    groups.set(sid, list)
  }
  const sessions: MemoSessionItem[] = []
  for (const [session_id, items] of groups) {
    const sorted = [...items].sort((a, b) => (a.data_id ?? 0) - (b.data_id ?? 0))
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    sessions.push({
      session_id,
      title: first ? getMemoTitle(first) : '제목 없음',
      message_count: sorted.length,
      last_id: last?.data_id ?? 0,
    })
  }
  sessions.sort((a, b) => b.last_id - a.last_id)
  return sessions
}

const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const MemoListIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

interface MemoTitleSidebarProps {
  sessions: MemoSessionItem[]
  serverSessionCount: number
  currentSessionId: string
  listLoading: boolean
  onSelectSession: (sessionId: string) => void
  onNewMemo: () => void
  onCloseMobile?: () => void
}

/** 채팅 왼쪽 세션 목록과 동일 — extra_1(UUID) 기준 분류 */
function MemoTitleSidebar({
  sessions,
  serverSessionCount,
  currentSessionId,
  listLoading,
  onSelectSession,
  onNewMemo,
  onCloseMobile,
}: MemoTitleSidebarProps) {
  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#f3f4f6',
        borderRight: '1px solid #e5e7eb',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        borderRadius: '8px 0 0 8px',
      }}
    >
      <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', letterSpacing: '0.02em' }}>
            메모 목록
          </div>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="목록 닫기"
              style={{
                border: 'none',
                background: '#e5e7eb',
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 12,
                color: '#374151',
                cursor: 'pointer',
              }}
            >
              닫기
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onNewMemo()
            onCloseMobile?.()
          }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            background: '#4f46e5',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '9px 14px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <PlusIcon /> 새 메모
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
        {listLoading && serverSessionCount === 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
            <CircularProgress size={18} sx={{ color: '#9ca3af' }} />
          </div>
        )}
        {!listLoading && serverSessionCount === 0 && sessions.length === 0 && (
          <div style={{ padding: '12px 8px', fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 1.5 }}>
            저장된 메모가 없습니다.
            <br />
            <span style={{ fontSize: 11 }}>메시지를 내면 목록에 반영됩니다.</span>
          </div>
        )}
        {sessions.map((s) => {
          const isActive = s.session_id === currentSessionId
          return (
            <button
              key={s.session_id}
              type="button"
              onClick={() => {
                onSelectSession(s.session_id)
                onCloseMobile?.()
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                border: 'none',
                borderRadius: 8,
                padding: '9px 10px',
                marginBottom: 2,
                cursor: 'pointer',
                background: isActive ? '#ede9fe' : 'transparent',
                transition: 'background 0.12s',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: isActive ? '#4f46e5' : '#9ca3af', flexShrink: 0 }}>
                  <MemoListIcon />
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#3730a3' : '#374151',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.4,
                  }}
                >
                  {s.title || '새 메모'}
                </span>
              </div>
              <div style={{ paddingLeft: 20, fontSize: 11, color: '#9ca3af' }}>
                {s.message_count}건 · #{s.session_id.slice(0, 6)}
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ borderTop: '1px solid #e5e7eb', padding: '10px 14px', fontSize: 11, color: '#9ca3af' }}>
        {serverSessionCount}개 스레드
        {currentSessionId ? ` · #${currentSessionId.slice(0, 8)}` : ''}
      </div>
    </div>
  )
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  /** URL별 OG 카드 데이터 (목록 인라인용) */
  const [previewCards, setPreviewCards] = useState<Record<string, OgPreviewData>>({})
  const fetchedUrlsRef = useRef(new Set<string>())
  /** 카드/메시지 ... 메뉴 */
  const [cardMenuAnchor, setCardMenuAnchor] = useState<null | HTMLElement>(null)
  const [cardMenuUrl, setCardMenuUrl] = useState<string | null>(null)
  const [cardMenuMessageId, setCardMenuMessageId] = useState<number | null>(null)
  /** 수정/삭제 모달 */
  const [cardActionModal, setCardActionModal] = useState<'edit' | 'delete' | null>(null)
  /** 메시지 인라인 수정 */
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null)
  const [editingDraft, setEditingDraft] = useState('')
  /** 링크 iframe 미리보기 열린 URL */
  const [previewLinkUrl, setPreviewLinkUrl] = useState<string | null>(null)
  /** 왼쪽 제목 목록 (extra_1 = 세션 UUID) */
  const [memos, setMemos] = useState<ApiAppData[]>([])
  const [memoSessionId, setMemoSessionId] = useState<string>(() => {
    if (typeof localStorage === 'undefined') return ''
    return localStorage.getItem(MEMO_SESSION_KEY) ?? ''
  })
  const [listLoading, setListLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? !window.matchMedia('(max-width: 900px)').matches : true,
  )
  const [isNarrow, setIsNarrow] = useState(false)

  const memoSessions = useMemo(() => buildMemoSessions(memos), [memos])

  /** DB에 없는 새 메모 스레드는 맨 위 가상 행 (채팅 displaySessions 와 동일) */
  const displaySessions = useMemo((): MemoSessionItem[] => {
    const hasCurrent = memoSessions.some((s) => s.session_id === memoSessionId)
    const firstUser = messages.find((m) => m.author === 'me')?.text?.trim() || ''
    const draftTitle = firstUser
      ? (firstUser.length > 52 ? `${firstUser.slice(0, 52)}…` : firstUser)
      : '새 메모'
    if (memoSessionId && !hasCurrent) {
      const phantom: MemoSessionItem = {
        session_id: memoSessionId,
        title: draftTitle,
        message_count: Math.max(messages.length, 0),
        last_id: 0,
      }
      return [phantom, ...memoSessions]
    }
    return memoSessions
  }, [memoSessions, memoSessionId, messages])

  const activeMemoTitle = useMemo(() => {
    const row = displaySessions.find((s) => s.session_id === memoSessionId)
    return row?.title?.trim() || '새 메모'
  }, [displaySessions, memoSessionId])

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

  const applyMessagesForSession = useCallback((rows: ApiAppData[], sessionId: string) => {
    if (!sessionId) {
      setMessages([])
      return
    }
    const inSession = rows
      .filter((r) => getMemoSessionId(r) === sessionId)
      .sort((a, b) => (a.data_id ?? 0) - (b.data_id ?? 0))
    if (inSession.length === 0) {
      setMessages([])
      return
    }
    setMessages(inSession.map((row, idx) => appDataToChatMessage(row, idx)))
  }, [])

  const loadMemoList = useCallback(async () => {
    setListLoading(true)
    try {
      const data = await fetchAppDataListApi({ skip: 0, limit: 100, app_id: MEMO_APP_ID })
      const sorted = [...(data ?? [])].sort((a, b) => (b.data_id ?? 0) - (a.data_id ?? 0))
      setMemos(sorted)
      return sorted
    } catch (error) {
      console.error('메모 목록 조회 오류:', error)
      setMemos([])
      return [] as ApiAppData[]
    } finally {
      setListLoading(false)
    }
  }, [])

  const handleSelectSession = useCallback((sessionId: string) => {
    if (sessionId === memoSessionId) return
    localStorage.setItem(MEMO_SESSION_KEY, sessionId)
    setMemoSessionId(sessionId)
    applyMessagesForSession(memos, sessionId)
  }, [memoSessionId, memos, applyMessagesForSession])

  const handleNewMemo = useCallback(() => {
    const sid = randomUUID()
    localStorage.setItem(MEMO_SESSION_KEY, sid)
    setMemoSessionId(sid)
    setMessages([])
    setInput('')
  }, [])

  useEffect(() => {
    const urls = new Set<string>()
    messages.forEach((msg) => extractUrls(msg.text).forEach((u) => urls.add(u)))
    const toFetch = [...urls].filter((url) => !fetchedUrlsRef.current.has(url))
    toFetch.forEach((url) => fetchedUrlsRef.current.add(url))
    if (toFetch.length > 0) {
      setPreviewCards((prev) => {
        const next = { ...prev }
        toFetch.forEach((url) => { next[url] = { url, loading: true } })
        return next
      })
    }
    toFetch.forEach((url) => {
      fetchOgPreview(url)
        .then((data) => {
          setPreviewCards((prev) => ({ ...prev, [url]: { url, ...data, loading: false } }))
        })
        .catch(() => {
          setPreviewCards((prev) => ({ ...prev, [url]: { url, loading: false, error: '미리보기 실패' } }))
        })
    })
  }, [messages])

  // 앱 데이터 목록 → extra_1 세션 목록 + 선택 스레드 말풍선
  useEffect(() => {
    void (async () => {
      const sorted = await loadMemoList()
      const sessions = buildMemoSessions(sorted)
      if (sessions.length === 0) {
        if (!memoSessionId) {
          const sid = randomUUID()
          localStorage.setItem(MEMO_SESSION_KEY, sid)
          setMemoSessionId(sid)
        }
        setMessages([])
        return
      }
      const stored = localStorage.getItem(MEMO_SESSION_KEY) ?? ''
      const pick =
        (stored && sessions.some((s) => s.session_id === stored) ? stored : null) ??
        sessions[0]?.session_id ??
        ''
      if (pick) {
        localStorage.setItem(MEMO_SESSION_KEY, pick)
        setMemoSessionId(pick)
        applyMessagesForSession(sorted, pick)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMemoList])

  const askOllama = async () => {
    const trimmed = input.trim()
    if (!trimmed) return

    setInput('')
    setLoading(true)
    try {
      let sid = memoSessionId
      if (!sid) {
        sid = randomUUID()
        localStorage.setItem(MEMO_SESSION_KEY, sid)
        setMemoSessionId(sid)
      }
      await saveMessageAsAppData(trimmed, sid)
      const sorted = await loadMemoList()
      applyMessagesForSession(sorted, sid)
    } catch (e) {
      console.error('메시지 저장 오류:', e)
      alert(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      askOllama()
    }
  }

  /** 메시지 텍스트를 앱 데이터로 저장 (extra_1 = 메모 스레드 UUID) */
  const saveMessageAsAppData = async (text: string, sessionId: string): Promise<ApiAppData> => {
    if (!text.trim()) throw new Error('메시지가 비어 있습니다.')
    if (!sessionId.trim()) throw new Error('메모 세션이 없습니다.')
    const form = {
      ap_subject: text.trim(),
      ap_content: text.trim(),
      app_id: MEMO_APP_ID,
      extra_1: sessionId.trim(),
    } as ApiAppPayload
    const strKeys: (keyof ApiAppPayload)[] = [
      'cate1', 'cate2', 'ap_subject', 'ap_content', 'recv_mail', 'link1', 'link2',
      'user_passwd', 'user_nm', 'user_email', 'user_home', 'last_login', 'ip',
      'facebook_user', 'twitter_user', 'start_date', 'start_time', 'end_date', 'end_time',
      'regist_dt', 'update_dt', 'extra_1', 'extra_2', 'extra_3', 'extra_4', 'extra_5',
      'extra_6', 'extra_7', 'extra_8', 'extra_9', 'extra_10',
    ]
    const intKeys: (keyof ApiAppPayload)[] = [
      'data_id', 'app_id', 'gr_num', 'reply_cd', 'parent_id', 'is_commt', 'co_num', 'co_reply',
      'wr_type', 'is_secret', 'link1_hit', 'link2_hit', 'hit', 'good', 'nogood', 'user_no', 'file_cnt',
    ]
    const payload = {} as ApiAppPayload
    for (const k of strKeys) {
      const v = form[k]
      ;(payload as Record<string, unknown>)[k] = v != null && v !== '' ? String(v) : ''
    }
    for (const k of intKeys) {
      const v = form[k]
      if (v != null && v !== '') {
        const n = Number(v)
        ;(payload as Record<string, unknown>)[k] = Number.isNaN(n) ? 0 : n
      } else {
        ;(payload as Record<string, unknown>)[k] = 0
      }
    }
    return await createAppDataApi(payload)
  }

  /** 메시지 수정 시 앱 데이터 업데이트 (extra_1 유지) */
  const updateMessageAsAppData = async (dataId: number, text: string): Promise<void> => {
    if (!text.trim()) return
    const existing = memos.find((m) => m.data_id === dataId)
    const sessionId = existing
      ? (existing.extra_1?.trim() || getMemoSessionId(existing))
      : memoSessionId
    const form = {
      ap_subject: text.trim(),
      ap_content: text.trim(),
      app_id: MEMO_APP_ID,
      extra_1: sessionId,
    } as ApiAppPayload
    const strKeys: (keyof ApiAppPayload)[] = [
      'cate1', 'cate2', 'ap_subject', 'ap_content', 'recv_mail', 'link1', 'link2',
      'user_passwd', 'user_nm', 'user_email', 'user_home', 'last_login', 'ip',
      'facebook_user', 'twitter_user', 'start_date', 'start_time', 'end_date', 'end_time',
      'regist_dt', 'update_dt', 'extra_1', 'extra_2', 'extra_3', 'extra_4', 'extra_5',
      'extra_6', 'extra_7', 'extra_8', 'extra_9', 'extra_10',
    ]
    const intKeys: (keyof ApiAppPayload)[] = [
      'data_id', 'app_id', 'gr_num', 'reply_cd', 'parent_id', 'is_commt', 'co_num', 'co_reply',
      'wr_type', 'is_secret', 'link1_hit', 'link2_hit', 'hit', 'good', 'nogood', 'user_no', 'file_cnt',
    ]
    const payload = {} as ApiAppPayload
    for (const k of strKeys) {
      const v = form[k]
      ;(payload as Record<string, unknown>)[k] = v != null && v !== '' ? String(v) : ''
    }
    for (const k of intKeys) {
      const v = form[k]
      if (v != null && v !== '') {
        const n = Number(v)
        ;(payload as Record<string, unknown>)[k] = Number.isNaN(n) ? 0 : n
      } else {
        ;(payload as Record<string, unknown>)[k] = 0
      }
    }
    await updateAppDataApi(dataId, payload)
  }

  return (
    <Box
      sx={{
        flexGrow: 1,
        overflow: 'auto',
        p: 3,
      }}
    >
      <TopBar />
      <Paper
        elevation={0}
        sx={{
          minHeight: '100%',
          p: 2,
          px: 3,
          borderRadius: 3,
          backgroundColor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Typography variant="h5" sx={{ flexShrink: 0, py: 1.5, fontWeight: 600 }}>
          메모장
        </Typography>

        <Box
          sx={{
            position: 'relative',
            height: 'calc(100vh - 240px)',
            minHeight: 420,
            display: 'flex',
            flexDirection: 'row',
            overflow: 'hidden',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          {isNarrow && sidebarOpen && (
            <Box
              component="button"
              type="button"
              aria-label="메모 목록 닫기"
              onClick={() => setSidebarOpen(false)}
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 1199,
                border: 'none',
                p: 0,
                bgcolor: 'rgba(15, 23, 42, 0.35)',
                cursor: 'pointer',
              }}
            />
          )}

          <Box
            sx={{
              flexShrink: 0,
              height: '100%',
              minHeight: 0,
              ...(isNarrow
                ? {
                    position: 'absolute',
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
            <MemoTitleSidebar
              sessions={displaySessions}
              serverSessionCount={memoSessions.length}
              currentSessionId={memoSessionId}
              listLoading={listLoading}
              onSelectSession={handleSelectSession}
              onNewMemo={handleNewMemo}
              onCloseMobile={isNarrow ? () => setSidebarOpen(false) : undefined}
            />
          </Box>

          <Paper
            variant="outlined"
            elevation={0}
            sx={{
              flex: 1,
              minWidth: 0,
              height: '100%',
              borderRadius: '0 8px 8px 0',
              border: 'none',
              borderLeft: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
          {isNarrow && (
            <Box
              sx={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 1,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <IconButton
                size="small"
                onClick={() => setSidebarOpen(true)}
                title="메모 목록"
                sx={{ border: '1px solid', borderColor: 'divider' }}
              >
                <MoreHorizIcon fontSize="small" />
              </IconButton>
              <Typography variant="body2" fontWeight={600} noWrap title={activeMemoTitle}>
                {activeMemoTitle}
              </Typography>
            </Box>
          )}
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', p: 2 }}>
            <Virtuoso
              data={messages}
              style={{ height: '100%', flex: 1 }}
              itemContent={(_index: number, msg: ChatMessage) => {
                const isMe = msg.author === 'me'
                return (
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: isMe ? 'flex-end' : 'flex-start',
                      mb: 1,
                    }}
                  >
                    {!isMe && (
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          mr: 1,
                          bgcolor: 'primary.main',
                          fontSize: 14,
                        }}
                      >
                        B
                      </Avatar>
                    )}
                    <Box
                      sx={{
                        maxWidth: editingMessageId === msg.id ? '80%' : '70%',
                        width: editingMessageId === msg.id ? '80%' : undefined,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMe ? 'flex-end' : 'flex-start',
                      }}
                    >
                      {editingMessageId === msg.id ? (
                        <Paper
                          elevation={0}
                          sx={{
                            px: 1.5,
                            py: 1,
                            borderRadius: 2,
                            backgroundColor: isMe ? 'primary.main' : 'grey.100',
                            color: isMe ? 'primary.contrastText' : 'text.primary',
                            width: '100%',
                          }}
                        >
                          <TextField
                            multiline
                            minRows={2}
                            maxRows={8}
                            value={editingDraft}
                            onChange={(e) => setEditingDraft(e.target.value)}
                            variant="standard"
                            fullWidth
                            InputProps={{ disableUnderline: true }}
                            sx={{
                              '& .MuiInputBase-input': {
                                color: 'inherit',
                                fontSize: '0.875rem',
                              },
                            }}
                          />
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setEditingMessageId(null)
                                setEditingDraft('')
                              }}
                              sx={{ color: 'inherit', opacity: 0.9 }}
                              title="취소"
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={async () => {
                                try {
                                  await updateMessageAsAppData(msg.id, editingDraft)
                                  setMessages((prev) =>
                                    prev.map((m) => (m.id === msg.id ? { ...m, text: editingDraft } : m))
                                  )
                                  const sorted = await loadMemoList()
                                  if (memoSessionId) {
                                    applyMessagesForSession(sorted, memoSessionId)
                                  }
                                } catch (e) {
                                  console.error('메시지 수정 오류:', e)
                                  alert(e instanceof Error ? e.message : '수정에 실패했습니다.')
                                  return
                                }
                                setEditingMessageId(null)
                                setEditingDraft('')
                              }}
                              sx={{ color: 'inherit', opacity: 0.9 }}
                              title="수정"
                            >
                              <CheckIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Paper>
                      ) : (
                        <Box
                          sx={{
                            position: 'relative',
                            display: 'inline-block',
                            '&:hover .msg-more-btn': { opacity: 1 },
                          }}
                        >
                          <Paper
                            elevation={0}
                            sx={{
                              px: 1.5,
                              py: 1,
                              borderRadius: 2,
                              backgroundColor: isMe ? 'primary.main' : 'grey.100',
                              color: isMe ? 'primary.contrastText' : 'text.primary',
                            }}
                          >
                            <MessageContent text={msg.text} isMe={isMe} />
                          </Paper>
                          <IconButton
                            className="msg-more-btn"
                            size="small"
                            sx={{
                              position: 'absolute',
                              top: 0,
                              right: -40,
                              opacity: 0,
                              transition: 'opacity 0.2s',
                              backgroundColor: 'background.paper',
                              color: 'text.primary',
                              boxShadow: 1,
                              '&:hover': { backgroundColor: 'action.hover' },
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setCardMenuAnchor(e.currentTarget)
                              setCardMenuUrl(null)
                              setCardMenuMessageId(msg.id)
                            }}
                          >
                            <MoreHorizIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      )}
                      {extractUrls(msg.text).map((url) => {
                        const card = previewCards[url]
                        if (!card) return null
                        if (card.loading) {
                          return (
                            <Box key={url} sx={{ mt: 1, p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', maxWidth: 560, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
                              <CircularProgress size={24} />
                            </Box>
                          )
                        }
                        if (card.error || (!card.title && !card.image)) return null
                        return (
                          <Paper
                            key={url}
                            variant="outlined"
                            sx={{
                              mt: 1,
                              maxWidth: 560,
                              overflow: 'hidden',
                              borderRadius: 2,
                              display: 'flex',
                              flexDirection: 'row',
                            }}
                          >
                            {card.image && (
                              <Box
                                component="img"
                                src={card.image}
                                alt=""
                                sx={{
                                  width: 120,
                                  minWidth: 120,
                                  height: 120,
                                  objectFit: 'cover',
                                  display: 'block',
                                }}
                              />
                            )}
                            <Box
                              sx={{
                                flex: 1,
                                p: 1.5,
                                minWidth: 0,
                                position: 'relative',
                                '&:hover .card-more-btn': { opacity: 1 },
                              }}
                            >
                              <IconButton
                                className="card-more-btn"
                                size="small"
                                sx={{
                                  position: 'absolute',
                                  top: 4,
                                  right: 4,
                                  opacity: 0,
                                  transition: 'opacity 0.2s',
                                  backgroundColor: 'background.paper',
                                  '&:hover': { backgroundColor: 'action.hover' },
                                }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setCardMenuAnchor(e.currentTarget)
                                  setCardMenuUrl(url)
                                  setCardMenuMessageId(null)
                                }}
                              >
                                <MoreHorizIcon fontSize="small" />
                              </IconButton>
                              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5, pr: 3 }}>
                                {card.title || '(제목 없음)'}
                              </Typography>
                              {card.description && (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    fontSize: 12,
                                  }}
                                >
                                  {card.description}
                                </Typography>
                              )}
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                {(() => {
                                  try { return new URL(url).hostname } catch { return url }
                                })()}
                              </Typography>
                              <Button
                                size="small"
                                startIcon={<VisibilityIcon fontSize="small" />}
                                onClick={() => setPreviewLinkUrl(previewLinkUrl === url ? null : url)}
                                sx={{ mt: 1, minWidth: 'auto', px: 1 }}
                              >
                                미리 보기
                              </Button>
                              <Collapse in={previewLinkUrl === url}>
                                <Box
                                  sx={{
                                    mt: 1,
                                    borderRadius: 1,
                                    overflow: 'hidden',
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    height: 280,
                                  }}
                                >
                                  <Box
                                    component="iframe"
                                    src={url}
                                    title="링크 미리보기"
                                    sx={{
                                      width: '100%',
                                      height: '100%',
                                      border: 'none',
                                      display: 'block',
                                    }}
                                  />
                                </Box>
                              </Collapse>
                            </Box>
                          </Paper>
                        )
                      })}
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25 }}>
                        {msg.time}
                      </Typography>
                    </Box>
                  </Box>
                )
              }}
            />
          </Box>

          <Box
            sx={{
              flexShrink: 0,
              borderTop: '1px solid',
              borderColor: 'divider',
              p: 1.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 1,
              }}
            >
            <TextField
              fullWidth
              size="small"
              placeholder="질문을 입력하세요..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              multiline
              maxRows={4}
            />
            <IconButton
              color="primary"
              onClick={askOllama}
              disabled={loading || !input.trim()}
              sx={{ mb: 0.5 }}
            >
              {loading ? <CircularProgress size={20} /> : <SendIcon />}
            </IconButton>
          </Box>
          </Box>
        </Paper>
        </Box>
      </Paper>

      <Menu
        anchorEl={cardMenuAnchor}
        open={Boolean(cardMenuAnchor)}
        onClose={() => { setCardMenuAnchor(null); setCardMenuUrl(null); setCardMenuMessageId(null) }}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
        <MenuItem
          dense
          onClick={() => {
            if (cardMenuMessageId !== null) {
              const message = messages.find((m) => m.id === cardMenuMessageId)
              setEditingMessageId(cardMenuMessageId)
              setEditingDraft(message?.text ?? '')
            } else {
              setCardActionModal('edit')
            }
            setCardMenuAnchor(null)
            setCardMenuUrl(null)
            setCardMenuMessageId(null)
          }}
        >
          수정
        </MenuItem>
        <MenuItem
          dense
          onClick={() => {
            setCardMenuAnchor(null)
            setCardActionModal('delete')
          }}
        >
          삭제
        </MenuItem>
      </Menu>

      <Dialog
        open={cardActionModal !== null}
        onClose={() => setCardActionModal(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{cardActionModal === 'edit' ? '수정' : '삭제'}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {cardMenuMessageId !== null
              ? (cardActionModal === 'edit'
                ? '메시지를 수정합니다.'
                : '이 메시지를 삭제하시겠습니까?')
              : (cardActionModal === 'edit'
                ? '링크 카드를 수정합니다.'
                : '이 링크 카드를 삭제하시겠습니까?')}
            {cardMenuUrl && (
              <Typography component="span" display="block" variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                {cardMenuUrl}
              </Typography>
            )}
            {cardMenuMessageId !== null && (
              <Typography component="span" display="block" variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                메시지 ID: {cardMenuMessageId}
              </Typography>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCardActionModal(null); setCardMenuUrl(null); setCardMenuMessageId(null) }}>취소</Button>
          <Button
            variant="contained"
            color={cardActionModal === 'delete' ? 'error' : 'primary'}
            onClick={() => {
              if (cardActionModal === 'delete') {
                // TODO: 삭제 처리 (cardMenuUrl 또는 cardMenuMessageId 기준)
              } else {
                // TODO: 수정 처리
              }
              setCardActionModal(null)
              setCardMenuUrl(null)
              setCardMenuMessageId(null)
            }}
          >
            {cardActionModal === 'edit' ? '확인' : '삭제'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
