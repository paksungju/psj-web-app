import { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
} from '@mui/material'

export default function LoginPage() {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // TODO: 실제 로그인 API 연동
    // 현재는 폼 데이터만 콘솔에 출력
    console.log('login submit', { loginId, password })
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

        <Box component="form" onSubmit={handleSubmit}>
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
              disabled={!loginId || !password}
              sx={{ mt: 1 }}
            >
              로그인
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  )
}

