import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
} from '@mui/material'
import { type Editor } from 'ckeditor5'
import RichTextEditor from '../../components/RichTextEditor'
import TopBar from '../../components/TopBar'
import { sendMailApi } from '../../apis/mailApi'

/** "Name <email>" 형식에서 이메일만 추출 */
function extractEmail(str: string): string {
  if (!str?.trim()) return ''
  const match = str.match(/<([^>]+)>/)
  return match?.[1]?.trim() ?? str.trim()
}

export default function MailFormPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const editorRef = useRef<Editor | null>(null)
  const state = (location.state as { replyTo?: string; replySubject?: string; replyBody?: string } | null) ?? {}
  const [to, setTo] = useState(() => (state?.replyTo ? extractEmail(state.replyTo) : ''))
  const [subject, setSubject] = useState(() => state?.replySubject ?? '')
  const [body, setBody] = useState(() => state?.replyBody ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!to.trim()) {
      setError('수신자를 입력해 주세요.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await sendMailApi({ to: to.trim(), subject: subject.trim(), body: body.trim() })
      alert('메일이 발송되었습니다.')
      navigate('/mails')
    } catch (err) {
      setError(err instanceof Error ? err.message : '메일 발송에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
      <TopBar />
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          backgroundColor: 'background.paper',
          minWidth: 960,
        }}
      >
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
          메일 작성
        </Typography>

        <form onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            <TextField
              label="수신자"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="example@email.com"
              fullWidth
              required
              type="email"
            />
            <TextField
              label="제목"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="제목을 입력하세요"
              fullWidth
            />
            <RichTextEditor
              label="내용"
              minHeight={200}
              value={body}
              onChange={setBody}
              onReady={(editor) => { editorRef.current = editor }}
              fontColor={false}
              // 메일 본문은 외부 HTML을 그대로 붙여넣는 경우가 있어 전체 태그를 허용한다.
              htmlSupportAllow={[{ name: /.*/, attributes: true, classes: true, styles: true }]}
            />

            {error && (
              <Typography color="error" variant="body2">
                {error}
              </Typography>
            )}

            <Stack direction="row" spacing={1}>
              <Button
                type="submit"
                variant="contained"
                disabled={saving}
              >
                {saving ? '발송 중...' : '발송'}
              </Button>
              <Button
                type="button"
                variant="outlined"
                color="inherit"
                onClick={() => navigate('/mails')}
              >
                취소
              </Button>
            </Stack>
          </Stack>
        </form>
      </Paper>
    </Box>
  )
}
