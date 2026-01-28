import { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
} from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'

const LOGIN_API_URL = 'http://impsj.net/api/v1/users/login'

interface LoginFormValues {
  username: string
  password: string
}

export default function LoginPage() {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as any)?.from?.pathname || '/'

  const handleFinish = async (values: LoginFormValues) => {
    setLoading(true)
    try {
      const response = await fetch(LOGIN_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        // OAuth2 password 그랜트 표준 스펙에 맞게 grant_type 추가
        body: new URLSearchParams({
          grant_type: 'password',
          username: values.username,
          password: values.password,
        }),
      })

      if (!response.ok) {
        let serverMessage = '로그인에 실패했습니다.'
        try {
          const errorData = await response.json()
          if (errorData?.detail) {
            serverMessage = errorData.detail
          }
        } catch {
          // ignore JSON parse error
        }
        throw new Error(serverMessage)
      }

      const data = await response.json()

      if (data?.access_token) {
        localStorage.setItem('auth_token', data.access_token)
      }

      localStorage.setItem('isLoggedIn', 'true')

      // 간단한 알림 후 이전 페이지로 이동
      window.alert('로그인 성공')
      navigate(from, { replace: true })
    } catch (error: any) {
      window.alert(error?.message || '로그인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        flexGrow: 1,
        overflow: 'auto',
        p: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          width: '100%',
          maxWidth: 420,
          p: 4,
          borderRadius: 3,
          backgroundColor: 'background.paper',
        }}
      >
        <Typography variant="h5" sx={{ mb: 1.5, fontWeight: 600, textAlign: 'center' }}>
          로그인
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 3, textAlign: 'center' }}
        >
          계정으로 로그인하여 서비스를 이용하세요.
        </Typography>

        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault()
            handleFinish({ username: loginId, password })
          }}
        >
          <Stack spacing={2.5}>
            <TextField
              label="아이디"
              fullWidth
              size="small"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
            />
            <TextField
              label="비밀번호"
              type="password"
              fullWidth
              size="small"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={!loginId || !password || loading}
              sx={{ mt: 1 }}
            >
              {loading ? '로그인 중...' : '로그인'}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  )
}

