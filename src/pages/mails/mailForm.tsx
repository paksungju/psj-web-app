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
import { CKEditor } from '@ckeditor/ckeditor5-react'
import {
  ClassicEditor,
  Essentials,
  Paragraph,
  Bold,
  Italic,
  Image,
  ImageInsert,
  ImageResize,
  ImageToolbar,
  ImageStyle,
  Alignment,
  GeneralHtmlSupport,
} from 'ckeditor5'
import 'ckeditor5/ckeditor5.css'
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
  const editorRef = useRef<unknown>(null)
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
            <Box sx={{ '& .ck-editor__editable': { minHeight: 200 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                내용
              </Typography>
              <CKEditor
                editor={ClassicEditor}
                data={body}
                config={{
                  licenseKey: 'GPL',
                  plugins: [Essentials, Paragraph, Bold, Italic, Image, ImageInsert, ImageResize, ImageToolbar, ImageStyle, Alignment, GeneralHtmlSupport],
                  toolbar: ['undo', 'redo', '|', 'bold', 'italic', '|', 'alignment:left', 'alignment:center', 'alignment:right', 'alignment:justify', '|', 'insertImage'],
                  htmlSupport: {
                    allow: [
                      { name: /.*/, attributes: true, classes: true, styles: true },
                    ],
                  },
                  image: {
                    resizeOptions: [
                      { name: 'resizeImage:original', value: null, icon: 'original' },
                      { name: 'resizeImage:25', value: '25', icon: 'small' },
                      { name: 'resizeImage:50', value: '50', icon: 'medium' },
                      { name: 'resizeImage:75', value: '75', icon: 'large' },
                      { name: 'resizeImage:custom', value: 'custom', icon: 'custom' },
                    ],
                    styles: {
                      options: ['inline', 'alignLeft', 'alignRight', 'alignCenter', 'alignBlockLeft', 'alignBlockRight', 'block'],
                    },
                    toolbar: [
                      'resizeImage:25', 'resizeImage:50', 'resizeImage:75', 'resizeImage:original', 'resizeImage:custom',
                      '|',
                      'imageStyle:wrapText',
                      'imageStyle:breakText',
                      '|',
                      'imageStyle:alignLeft', 'imageStyle:alignRight', 'imageStyle:alignCenter',
                      'imageStyle:alignBlockLeft', 'imageStyle:alignBlockRight',
                    ],
                  },
                }}
                onReady={(editor) => {
                  ;(editorRef as React.MutableRefObject<typeof editor | null>).current = editor
                }}
                onChange={(_evt, editor) => {
                  setBody(editor.getData())
                }}
              />
            </Box>

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
