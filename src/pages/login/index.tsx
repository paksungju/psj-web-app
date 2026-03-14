import { useEffect, useState } from 'react'
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Checkbox,
  FormControlLabel,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'

const SAVED_LOGIN_ID_KEY = 'saved_login_id'
const LOGIN_PASSWORD_SESSION_KEY = 'login_password'

export default function LoginPage() {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [rememberLoginId, setRememberLoginId] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const savedLoginId = localStorage.getItem(SAVED_LOGIN_ID_KEY) ?? ''
    if (savedLoginId) {
      setLoginId(savedLoginId)
      setRememberLoginId(true)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginId || !password) {
      window.alert('아이디와 비밀번호를 입력해 주세요.')
      return
    }

    try {
      setLoading(true)
      const form = new URLSearchParams()
      form.set('username', loginId)
      form.set('password', password)

      const res = await fetch('http://impsj.net/api/v1/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      })

      if (!res.ok) {
        let message = '로그인에 실패했습니다.'
        try {
          const errorData = await res.json()
          if (errorData?.detail) {
            message = String(errorData.detail)
          }
        } catch {
          // ignore parse error
        }
        window.alert(message)
        return
      }

      const data = await res.json()

      // 토큰 / 로그인 상태 저장 (필요 시 필드명 조정)
      if (data?.access_token) {
        localStorage.setItem('auth_token', data.access_token)
      }
      sessionStorage.setItem(LOGIN_PASSWORD_SESSION_KEY, password)
      if (rememberLoginId) {
        localStorage.setItem(SAVED_LOGIN_ID_KEY, loginId)
      } else {
        localStorage.removeItem(SAVED_LOGIN_ID_KEY)
      }
      localStorage.setItem('isLoggedIn', 'true')
      window.dispatchEvent(new Event('auth-change'))

      navigate('/', { replace: true })
    } catch (error) {
      console.error('로그인 오류:', error)
      window.alert('로그인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          width: 360,
          p: 4,
          borderRadius: 3,
        }}
      >
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, textAlign: 'center' }}>
          로그인
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="아이디"
            size="small"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            fullWidth
            autoFocus
          />
          <TextField
            label="비밀번호"
            type="password"
            size="small"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
          />
          <FormControlLabel
            control={(
              <Checkbox
                checked={rememberLoginId}
                onChange={(e) => {
                  const checked = e.target.checked
                  setRememberLoginId(checked)
                  if (!checked) {
                    localStorage.removeItem(SAVED_LOGIN_ID_KEY)
                  }
                }}
                size="small"
              />
            )}
            label="아이디 저장"
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={loading}
            sx={{ mt: 1.5 }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : '로그인'}
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}