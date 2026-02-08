import { useEffect, useRef, useState } from 'react'
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
} from '@mui/material'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import CloseIcon from '@mui/icons-material/Close'
import CheckIcon from '@mui/icons-material/Check'
import TopBar from '../../../components/TopBar'
import SendIcon from '@mui/icons-material/Send'
import {
  fetchAppDataListApi,
  createAppDataApi,
  type ApiAppData,
  type ApiAppPayload,
} from '../../../apis/appApi'

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

/** Microlink API로 OG 메타 가져오기 (카드 미리보기용) */
async function fetchOgPreview(url: string): Promise<Pick<OgPreviewData, 'title' | 'description' | 'image'>> {
  const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}`
  const res = await fetch(apiUrl)
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

  // 앱 데이터 목록을 조회해서 말풍선에 표시
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const data = await fetchAppDataListApi({ skip: 0, limit: 100 })
        const serverMessages: ChatMessage[] = (data ?? []).map((item: ApiAppData, idx: number) => {
          const created = item.regist_dt ?? item.update_dt ?? new Date().toISOString()
          const createdDate = new Date(created)
          const time = `${createdDate.getHours().toString().padStart(2, '0')}:${createdDate.getMinutes().toString().padStart(2, '0')}`
          // item.ap_subject, 
          const text = [item.ap_content].filter(Boolean).join('\n') || '-'
          // data_id가 없거나 중복될 수 있으므로 고유 id 보장 (data_id 우선, 없으면 1000000+idx)
          const id = item.data_id != null ? item.data_id : 1000000 + idx
          return {
            id,
            author: item.user_nm ? 'me' : 'bot',
            text,
            time,
          }
        })
        if (serverMessages.length > 0) {
          setMessages(serverMessages)
        }
      } catch (error) {
        console.error('앱 데이터 목록 조회 오류:', error)
      }
    }

    fetchMessages()
  }, [])

  const askOllama = async () => {
    const trimmed = input.trim()
    if (!trimmed) return

    // 사용자 메시지를 채팅 목록에 추가
    const now = new Date()
    const time = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`

    setMessages((prev) => {
      const nextId = prev.length > 0 ? Math.max(...prev.map((m) => m.id)) + 1 : 1
      return [
        ...prev,
        {
          id: nextId,
          author: 'me',
          text: trimmed,
          time,
        },
      ]
    })

    setInput('')
    setLoading(true)
    try {
      await saveMessageAsAppData(trimmed)
    } catch (e) {
      console.error('메시지 저장 오류:', e)
      const msg = e instanceof Error ? e.message : '저장에 실패했습니다.'
      alert(msg)
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

  /** 메시지 텍스트를 앱 데이터로 저장 (form handleSubmit과 동일한 payload 구성) */
  const saveMessageAsAppData = async (text: string): Promise<void> => {
    if (!text.trim()) return
    // form과 동일: ap_subject/ap_content에 메시지, 나머지는 ''/0
    const form = {
      ap_subject: text.trim(),
      ap_content: text.trim(),
      app_id: 2,
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
    await createAppDataApi(payload)
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <TopBar />
      <Paper
        elevation={0}
        sx={{
          flex: 1,
          minHeight: 0,
          p: 2,
          px: 3,
          borderRadius: 0,
          backgroundColor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Typography variant="h5" sx={{ flexShrink: 0, py: 1.5, fontWeight: 600 }}>
          메모장
        </Typography>

        <Paper
          variant="outlined"
          sx={{
            flex: 1,
            minHeight: 0,
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
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
                              onClick={() => {
                                setMessages((prev) =>
                                  prev.map((m) => (m.id === msg.id ? { ...m, text: editingDraft } : m))
                                )
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

