import { useEffect, useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Avatar,
  CircularProgress,
} from '@mui/material'
import TopBar from '../../components/TopBar'
import SendIcon from '@mui/icons-material/Send'

interface ChatMessage {
  id: number
  author: 'me' | 'bot'
  text: string
  time: string
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
  const [loading, setLoading] = useState(false);

  // 백엔드에서 온 message/text 값이 객체일 수 있으므로 문자열로 안전 변환
  const normalizeMessageText = (value: any): string => {
    if (value == null) return ''
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }

    // LangChain 스타일 { data, type } 구조 대응
    if (typeof value === 'object') {
      // data.content or content 우선 사용
      // 예: { data: { content: "..." }, type: "ai" }
      const data: any = (value as any).data
      if (typeof (value as any).content === 'string') {
        return (value as any).content
      }
      if (data) {
        if (typeof data.content === 'string') {
          return data.content
        }
        if (Array.isArray(data.content)) {
          // 배열이면 텍스트만 이어붙이기
          const joined = (data.content as any[])
            .map((c: any) => (typeof c === 'string' ? c : c?.text ?? ''))
            .join(' ')
          if (joined.trim()) return joined
        }
      }
    }

    // 그 외에는 JSON 문자열로 fallback
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }

  // 기본적으로 서버의 채팅 메시지 API를 조회해서 말풍선에 표시
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch('http://impsj.net/api/v1/chat/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            session_id: 'psj007',
            skip: 0,
            limit: 100,
          }),
        })
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }

        const data = (await res.json()) as any

        // 배열 또는 { messages: [...] } 형태 모두 대응
        const rawList: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.messages)
          ? data.messages
          : []

        const serverMessages: ChatMessage[] = rawList.map((item, idx) => {
          const created = item.created_at ?? item.time ?? new Date().toISOString()
          const createdDate = new Date(created)
          const time = `${createdDate
            .getHours()
            .toString()
            .padStart(2, '0')}:${createdDate
            .getMinutes()
            .toString()
            .padStart(2, '0')}`

          // message 컬럼이 JSON 문자열일 수도 있으므로 먼저 파싱 시도
          let messagePayload: any = item.message
          if (typeof messagePayload === 'string') {
            try {
              messagePayload = JSON.parse(messagePayload)
            } catch {
              // 파싱 실패 시 그대로 둠 (normalizeMessageText 에서 처리)
            }
          }

          // 요구사항:
          // - message.type === 'ai' 이면 왼쪽 말풍선 (bot)
          // - 그 외(type이 ai가 아니거나 없으면)는 모두 오른쪽 말풍선 (me)
          const rawType = messagePayload?.type
          const lowerType =
            typeof rawType === 'string' ? rawType.toLowerCase() : rawType

          const author: 'me' | 'bot' =
            lowerType === 'ai' ? 'bot' : 'me'

          const rawTextSource = item.text ?? messagePayload ?? item.message ?? ''

          return {
            id: item.id ?? idx + 1,
            author,
            text: normalizeMessageText(rawTextSource),
            time,
          }
        })

        if (serverMessages.length > 0) {
          setMessages(serverMessages)
        }
      } catch (error) {
        console.error('채팅 메시지 조회 오류:', error)
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

    setMessages((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        author: 'me',
        text: trimmed,
        time,
      },
    ])

    setInput('')
    setLoading(true);
    try {
      // 채팅 요청: 배포 서버 /ask 엔드포인트로 전달
      const url = `http://impsj.net/ask?topic=${encodeURIComponent(trimmed)}&session_id=psj007`
      const res = await fetch(url)

      // HTTP 에러라도 일단 응답 본문을 최대한 사용
      let answer = ''
      try {
        const data = (await res.json()) as { answer?: string }
        answer = data?.answer ?? ''
      } catch {
        // JSON 파싱이 안 되면 텍스트로 처리
        try {
          const text = await res.text()
          answer = typeof text === 'string' ? text : ''
        } catch {
          answer = ''
        }
      }

      const botNow = new Date()
      const botTime = `${botNow.getHours().toString().padStart(2, '0')}:${botNow
        .getMinutes()
        .toString()
        .padStart(2, '0')}`

      // 봇 응답을 채팅 목록에 추가
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          author: 'bot',
          text: answer || '(응답이 없습니다.)',
          time: botTime,
        },
      ])
    } catch (error) {
      console.error('채팅 요청 오류:', error);
      const errorNow = new Date()
      const errorTime = `${errorNow.getHours().toString().padStart(2, '0')}:${errorNow
        .getMinutes()
        .toString()
        .padStart(2, '0')}`

      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          author: 'bot',
          // 에러 상세는 콘솔에만 남기고, UI에는 단순 메시지만 표시
          text: '일시적인 오류로 응답을 가져오지 못했습니다.',
          time: errorTime,
        },
      ])
    }
    setLoading(false);
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      askOllama()
    }
  }



  return (
    <Box
      sx={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        p: 3,
      }}
    >
      <TopBar />
      <Box
        sx={{
          flexGrow: 1,
          overflow: 'auto',
        }}
      >
        <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          backgroundColor: 'background.paper',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
          채팅
        </Typography>

        <Paper
          variant="outlined"
          sx={{
            flexGrow: 1,
            mb: 2,
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <List
            sx={{
              flexGrow: 1,
              overflowY: 'auto',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            {messages.map((msg) => {
              const isMe = msg.author === 'me'
              return (
                <ListItem
                  key={msg.id}
                  sx={{
                    display: 'flex',
                    justifyContent: isMe ? 'flex-end' : 'flex-start',
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
                      maxWidth: '70%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMe ? 'flex-end' : 'flex-start',
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
                      <ListItemText
                        primary={msg.text}
                        primaryTypographyProps={{
                          fontSize: 14,
                        }}
                      />
                    </Paper>
                    <Typography
                      variant="caption"
                      sx={{ mt: 0.25, color: 'text.secondary' }}
                    >
                      {msg.time}
                    </Typography>
                  </Box>
                </ListItem>
              )
            })}
          </List>

          <Box
            sx={{
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
      </Box>
    </Box>
  )
}

