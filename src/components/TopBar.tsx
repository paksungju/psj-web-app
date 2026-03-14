import { useEffect, useState } from 'react'
import {
  Box,
  InputBase,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { useLocation, useNavigate } from 'react-router-dom'

const LOGIN_PASSWORD_SESSION_KEY = 'login_password'

export default function TopBar() {
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const menuOpen = Boolean(menuAnchorEl)
  const [keyword, setKeyword] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  // URL 쿼리스트링에 keyword가 있으면 입력창에 반영 (예: /search?keyword=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const kw = params.get('keyword')
    if (kw !== null) {
      setKeyword(kw)
    }
  }, [location.search])

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setMenuAnchorEl(null)
  }

  const handleLogout = () => {
    // 간단한 로그아웃 처리: 토큰/플래그 제거 후 로그인 페이지로 이동
    localStorage.removeItem('auth_token')
    localStorage.removeItem('isLoggedIn')
    sessionStorage.removeItem(LOGIN_PASSWORD_SESSION_KEY)
    window.dispatchEvent(new Event('auth-change'))
    handleMenuClose()
    navigate('/login', { replace: true })
  }

  const handleUserInfo = () => {
    handleMenuClose()
    window.alert('사용자 정보 화면은 준비 중입니다.')
  }

  const handleSearchKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter') {
      const value = (e.target as HTMLInputElement).value.trim()
      if (!value) return
      navigate(`/search?keyword=${encodeURIComponent(value)}`)
    }
  }

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 4,
        gap: 2,
        bgcolor: 'background.paper',
      }}
    >
      {/* 검색 영역 블럭 */}
      <Box
        sx={{
          //flex: 1,
          width: '60%',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1,
          borderRadius: 999,
          backgroundColor: 'grey.50',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <SearchIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
        <InputBase
          sx={{ width: '100%', fontSize: 14 }}
          placeholder="Ctrl+G 키를 눌러 채팅 또는 채널로 바로 이동하기"
          inputProps={{ 'aria-label': 'global quick search' }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
      </Box>

      {/* ... 버튼 / 아바타 영역 블럭 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <IconButton
          size="small"
          sx={{
            color: 'text.secondary',
          }}
          onClick={handleMenuOpen}
        >
          <MoreHorizIcon />
        </IconButton>
        <Menu
          anchorEl={menuAnchorEl}
          open={menuOpen}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <MenuItem onClick={handleUserInfo}>사용자 정보</MenuItem>
          <MenuItem onClick={handleLogout}>로그아웃</MenuItem>
        </Menu>
        <Avatar
          sx={{
            width: 32,
            height: 32,
            fontSize: 14,
            bgcolor: 'primary.main',
          }}
        >
          PS
        </Avatar>
      </Box>
    </Box>
  )
}

