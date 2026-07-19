import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Box,
  InputBase,
  IconButton,
  Avatar,
  Button,
  Menu,
  MenuItem,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  clearAuthSession,
  formatRemaining,
  getTokenRemainingMs,
  refreshAuthToken,
} from '../utils/auth'

const MOBILE_HIDE_DELTA = 12
const MOBILE_SHOW_DELTA = 10
const TOP_EPSILON = 4
const SCROLL_TOGGLE_COOLDOWN_MS = 300
/** 남은 시간이 이 값 이하로 떨어지면 빨간색으로 경고 */
const SESSION_WARN_MS = 5 * 60 * 1000

/** TopBar와 사이드바 헤더가 공유하는 높이(px) */
export const TOPBAR_HEIGHT = 56

function getScrollTopFromEvent(event: Event): { target: HTMLElement | Window; scrollTop: number } | null {
  const { target } = event
  if (target instanceof HTMLElement) {
    if (target === document.documentElement || target === document.body) {
      return { target: window, scrollTop: window.scrollY }
    }
    return { target, scrollTop: target.scrollTop }
  }
  if (target === document || target instanceof Document) {
    return { target: window, scrollTop: window.scrollY }
  }
  return null
}

export default function TopBar() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const barRef = useRef<HTMLDivElement>(null)
  const barHiddenRef = useRef(false)
  const toggleCooldownUntilRef = useRef(0)
  const [barHidden, setBarHidden] = useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const menuOpen = Boolean(menuAnchorEl)
  const [keyword, setKeyword] = useState('')
  const [remainingMs, setRemainingMs] = useState<number | null>(() => getTokenRemainingMs())
  const [extending, setExtending] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const setBarHiddenSafe = useCallback((hidden: boolean) => {
    if (barHiddenRef.current === hidden) return
    barHiddenRef.current = hidden
    setBarHidden(hidden)
    if (hidden) setMenuAnchorEl(null)
    toggleCooldownUntilRef.current = performance.now() + SCROLL_TOGGLE_COOLDOWN_MS
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const kw = params.get('keyword')
    if (kw !== null) {
      setKeyword(kw)
    }
  }, [location.search])

  useEffect(() => {
    if (!isMobile) {
      barHiddenRef.current = false
      setBarHidden(false)
      return
    }

    const scrollPositions = new Map<HTMLElement | Window, number>()
    const accDeltaRef = { value: 0, direction: null as 'up' | 'down' | null }
    let rafId = 0
    let pendingEvent: Event | null = null

    const processScroll = () => {
      rafId = 0
      const event = pendingEvent
      pendingEvent = null
      if (!event) return

      const info = getScrollTopFromEvent(event)
      if (!info) return

      const { target, scrollTop } = info
      const prevTop = scrollPositions.get(target) ?? scrollTop
      const delta = scrollTop - prevTop
      scrollPositions.set(target, scrollTop)

      const inCooldown = performance.now() < toggleCooldownUntilRef.current

      if (scrollTop <= TOP_EPSILON) {
        accDeltaRef.value = 0
        accDeltaRef.direction = null
        if (!inCooldown) setBarHiddenSafe(false)
        return
      }

      if (Math.abs(delta) < 1 || inCooldown) return

      const direction: 'up' | 'down' = delta > 0 ? 'down' : 'up'
      if (direction !== accDeltaRef.direction) {
        accDeltaRef.direction = direction
        accDeltaRef.value = 0
      }
      accDeltaRef.value += Math.abs(delta)

      if (direction === 'down' && accDeltaRef.value >= MOBILE_HIDE_DELTA) {
        setBarHiddenSafe(true)
        accDeltaRef.value = 0
      } else if (direction === 'up' && accDeltaRef.value >= MOBILE_SHOW_DELTA) {
        setBarHiddenSafe(false)
        accDeltaRef.value = 0
      }
    }

    const handleScroll = (event: Event) => {
      pendingEvent = event
      if (!rafId) {
        rafId = requestAnimationFrame(processScroll)
      }
    }

    document.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    return () => {
      document.removeEventListener('scroll', handleScroll, { capture: true })
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [isMobile, location.pathname, setBarHiddenSafe])

  // 남은 세션 시간을 1초마다 갱신. 만료되면 세션을 정리하고 로그인으로 이동
  useEffect(() => {
    const sync = () => setRemainingMs(getTokenRemainingMs())

    sync()
    const timerId = window.setInterval(sync, 1000)
    window.addEventListener('auth-change', sync)
    return () => {
      window.clearInterval(timerId)
      window.removeEventListener('auth-change', sync)
    }
  }, [])

  useEffect(() => {
    if (remainingMs !== 0) return
    clearAuthSession()
    window.alert('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.')
    navigate('/login', { replace: true })
  }, [remainingMs, navigate])

  const handleExtendSession = useCallback(async () => {
    if (extending) return
    setExtending(true)
    try {
      const ok = await refreshAuthToken()
      if (ok) {
        setRemainingMs(getTokenRemainingMs())
      } else {
        window.alert('세션 연장에 실패했습니다. 다시 로그인해 주세요.')
      }
    } finally {
      setExtending(false)
    }
  }, [extending])

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setMenuAnchorEl(null)
  }

  const handleLogout = () => {
    clearAuthSession()
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
      ref={barRef}
      sx={{
        position: 'relative',
        zIndex: (t) => t.zIndex.appBar,
        mt: { xs: -1.5, sm: -2, md: -3 },
        mx: { xs: -1.5, sm: -2, md: -3 },
        mb: 4,
        flexShrink: 0,
        overflow: 'hidden',
        pointerEvents: isMobile && barHidden ? 'none' : 'auto',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          px: { xs: 1.5, sm: 2, md: 3 },
          height: TOPBAR_HEIGHT,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          transform: isMobile && barHidden ? 'translateY(-100%)' : 'translateY(0)',
          transition: isMobile ? 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          willChange: isMobile ? 'transform' : 'auto',
          ...(isMobile && {
            width: '100%',
            '& .MuiInputBase-input': {
              fontSize: 13,
            },
          }),
        }}
      >
        <Box
          sx={{
            width: { xs: '100%', md: '60%' },
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            py: 0.8,
            borderRadius: 999,
            backgroundColor: 'grey.50',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <SearchIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
          <InputBase
            sx={{ width: '60%', fontSize: 11 }}
            placeholder="Ctrl+G 키를 눌러 채팅 또는 채널로 바로 이동하기"
            inputProps={{ 'aria-label': 'global quick search' }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {remainingMs !== null && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography
                variant="body2"
                sx={{
                  fontSize: 13,
                  fontVariantNumeric: 'tabular-nums',
                  color: remainingMs <= SESSION_WARN_MS ? 'error.main' : 'text.secondary',
                }}
              >
                {formatRemaining(remainingMs)}
              </Typography>
              <Button
                size="small"
                variant="text"
                onClick={handleExtendSession}
                disabled={extending}
                sx={{ minWidth: 0, px: 1, fontSize: 12 }}
              >
                연장하기
              </Button>
            </Box>
          )}
          <IconButton
            size="small"
            sx={{ color: 'text.secondary' }}
            onClick={handleMenuOpen}
          >
            <MoreHorizIcon />
          </IconButton>
          <Menu
            anchorEl={menuAnchorEl}
            open={menuOpen}
            onClose={handleMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem onClick={handleUserInfo}>사용자 정보</MenuItem>
            <MenuItem onClick={handleLogout}>로그아웃</MenuItem>
          </Menu>
          <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: 'primary.main' }}>
            PS
          </Avatar>
        </Box>
      </Box>
    </Box>
  )
}
