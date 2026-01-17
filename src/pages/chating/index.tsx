import { useState } from 'react'
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
} from '@mui/material'
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

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed) return

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
  }

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Box
      sx={{
        flexGrow: 1,
        overflow: 'hidden',
        p: 3,
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
              alignItems: 'center',
              gap: 1,
            }}
          >
            <TextField
              fullWidth
              size="small"
              placeholder="메시지를 입력하세요..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              multiline
              maxRows={3}
            />
            <IconButton
              color="primary"
              onClick={handleSend}
              disabled={!input.trim()}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Paper>
      </Paper>
    </Box>
  )
}

