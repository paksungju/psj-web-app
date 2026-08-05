import { useEffect, useState } from 'react'
import { useMediaQuery, useTheme } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import AuthenticatedAppRoutes from './appRoutes'
import AuthRoutes from './authRoutes'
import SptRoutes from './sptRoutes'
import {
  getAuthToken,
  hasValidAuthSession,
  readTokenExpMs,
  redirectToLoginIfExpired,
} from '../utils/auth'

export default function AppRoutes() {
  const [selectedMenu, setSelectedMenu] = useState('home')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasValidAuthSession())
  const appTheme = useTheme()
  const isMobile = useMediaQuery(appTheme.breakpoints.down('md'))
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const syncAuthState = () => {
      if (
        redirectToLoginIfExpired(() => {
          navigate('/login', { replace: true })
        })
      ) {
        setIsAuthenticated(false)
        return
      }
      setIsAuthenticated(hasValidAuthSession())
    }

    syncAuthState()
    window.addEventListener('storage', syncAuthState)
    window.addEventListener('auth-change', syncAuthState as EventListener)
    window.addEventListener('focus', syncAuthState)
    document.addEventListener('visibilitychange', syncAuthState)
    return () => {
      window.removeEventListener('storage', syncAuthState)
      window.removeEventListener('auth-change', syncAuthState as EventListener)
      window.removeEventListener('focus', syncAuthState)
      document.removeEventListener('visibilitychange', syncAuthState)
    }
  }, [navigate])

  // 토큰 exp 시각에 맞춰 자동 로그아웃
  useEffect(() => {
    if (!isAuthenticated) return
    const token = getAuthToken()
    if (!token) return
    const expMs = readTokenExpMs(token)
    if (expMs == null) return
    const delay = Math.max(expMs - Date.now(), 0)
    const timer = window.setTimeout(() => {
      redirectToLoginIfExpired(() => {
        navigate('/login', { replace: true })
      })
      setIsAuthenticated(false)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [isAuthenticated, navigate, location.pathname])

  useEffect(() => {
    redirectToLoginIfExpired(() => {
      navigate('/login', { replace: true })
    })
  }, [location.pathname, navigate])

  useEffect(() => {
    if (location.pathname === '/search') {
      setSelectedMenu('search')
    } else if (location.pathname === '/chat') {
      setSelectedMenu('chat')
    } else if (location.pathname === '/gallery') {
      setSelectedMenu('gallery')
    } else if (location.pathname === '/apps-accounts') {
      setSelectedMenu('apps-accounts')
    } else if (location.pathname === '/items') {
      setSelectedMenu('items')
    } else if (location.pathname === '/app/configs' || location.pathname.startsWith('/app/configs/')) {
      setSelectedMenu('app/configs')
    } else if (location.pathname === '/app-info' || location.pathname.startsWith('/app-info/')) {
      setSelectedMenu('apps-info')
    } else if (
      location.pathname === '/apps/info/create' ||
      location.pathname.startsWith('/apps/info/create') ||
      /^\/apps\/info\/\d+\/form/.test(location.pathname)
    ) {
      setSelectedMenu('apps-info/form')
    } else if (location.pathname === '/apps/info' || location.pathname.match(/^\/apps\/info\/\d+$/)) {
      setSelectedMenu('apps/info')
    } else if (location.pathname === '/apps/memo' || location.pathname.startsWith('/apps/memo/')) {
      setSelectedMenu('memo')
    } else if (
      location.pathname === '/apps/calendar' ||
      location.pathname.startsWith('/apps/calendar/') ||
      location.pathname === '/schedule/calendar' ||
      location.pathname.startsWith('/schedule/calendar/')
    ) {
      setSelectedMenu('calendar')
    } else if (location.pathname === '/apps/favorite' || location.pathname.startsWith('/apps/favorite/')) {
      setSelectedMenu('favorite')
    } else if (
      location.pathname === '/files' ||
      location.pathname.startsWith('/files/') ||
      location.pathname === '/apps/files' ||
      location.pathname.startsWith('/apps/files/')
    ) {
      setSelectedMenu('files')
    } else if (location.pathname === '/makerplan/3d' || location.pathname.startsWith('/makerplan/3d/')) {
      setSelectedMenu('makerplan-3d')
    } else if (location.pathname === '/draw' || location.pathname.startsWith('/draw/')) {
      setSelectedMenu('makerplan-sketch')
    } else if (
      location.pathname === '/apps/ideablock' ||
      location.pathname.startsWith('/apps/ideablock/')
    ) {
      setSelectedMenu('ideablock')
    } else if (location.pathname === '/makerplan' || location.pathname.startsWith('/makerplan/')) {
      setSelectedMenu('makerplan-list')
    } else if (location.pathname === '/schedule' || location.pathname.startsWith('/schedule/')) {
      setSelectedMenu('todo-list')
    } else if (location.pathname === '/training' || location.pathname.startsWith('/training/')) {
      setSelectedMenu('training')
    } else if (location.pathname === '/mails' || location.pathname.startsWith('/mails/')) {
      // 제공자별 하위 메뉴가 선택되도록 쿼리의 provider를 함께 본다.
      const provider = new URLSearchParams(location.search).get('provider')
      setSelectedMenu(provider ? `mails-${provider}` : 'mails')
    } else if (location.pathname === '/spt/cate') {
      setSelectedMenu('spt-cate')
    } else if (location.pathname === '/spt/resources') {
      setSelectedMenu('spt-resources')
    } else if (location.pathname === '/spt' || location.pathname.startsWith('/spt/')) {
      setSelectedMenu('spt-home')
    } else if (location.pathname === '/server/remote') {
      setSelectedMenu('server-remote')
    } else if (location.pathname === '/server/db-manager') {
      setSelectedMenu('db-manager')
    } else if (location.pathname === '/server' || location.pathname.startsWith('/server/')) {
      setSelectedMenu('server-status')
    } else if (location.pathname === '/codes' || location.pathname.startsWith('/codes/')) {
      setSelectedMenu('codes')
    } else if (location.pathname === '/baseconfig') {
      setSelectedMenu('baseconfig')
    } else if (location.pathname === '/stock-prediction' || location.pathname.startsWith('/stock-prediction/')) {
      setSelectedMenu('stock-prediction')
    } else if (location.pathname === '/users' || location.pathname.startsWith('/users/')) {
      setSelectedMenu('users')
    } else if (location.pathname === '/paid' || location.pathname.startsWith('/paid/')) {
      setSelectedMenu('paid')
    } else if (location.pathname === '/menu' || location.pathname.startsWith('/menu/')) {
      setSelectedMenu('menus')
    }
  }, [location.pathname, location.search])

  const handleMenuSelect = (menuId: string) => {
    setSelectedMenu(menuId)

    if (menuId === 'search') {
      navigate('/search')
    } else if (menuId === 'chat') {
      navigate('/chat')
    } else if (menuId === 'gallery') {
      navigate('/gallery')
    } else if (menuId === 'apps-accounts') {
      navigate('/apps-accounts')
    } else if (menuId === 'items') {
      navigate('/items')
    } else if (menuId === 'app-settings') {
      navigate('/webapps')
    } else if (menuId === 'app/configs') {
      navigate('/app/configs')
    } else if (menuId === 'apps/info') {
      navigate('/apps/info')
    } else if (menuId === 'apps-info/form') {
      navigate('/apps/info/create')
    } else if (menuId === 'apps-info/view') {
      navigate('/apps/info')
    } else if (menuId === 'apps/info/create') {
      navigate('/apps/info/create')
    } else if (menuId === 'memo') {
      navigate('/apps/memo')
    } else if (menuId === 'calendar') {
      navigate('/schedule/calendar')
    } else if (menuId === 'todo-list') {
      navigate('/schedule')
    } else if (menuId === 'training') {
      navigate('/training')
    } else if (menuId === 'favorite') {
      navigate('/apps/favorite')
    } else if (menuId === 'files') {
      navigate('/files')
    } else if (menuId === 'makerplan' || menuId === 'makerplan-list') {
      navigate('/makerplan')
    } else if (menuId === 'makerplan-3d') {
      navigate('/makerplan/3d')
    } else if (menuId === 'makerplan-sketch') {
      navigate('/draw')
    } else if (menuId === 'ideablock') {
      navigate('/apps/ideablock')
    } else if (menuId === 'mails') {
      navigate('/mails')
    } else if (menuId === 'mails-naver') {
      navigate('/mails?provider=naver')
    } else if (menuId === 'mails-daum') {
      navigate('/mails?provider=daum')
    } else if (menuId === 'mails-gmail') {
      navigate('/mails?provider=gmail')
    } else if (menuId === 'spt-home') {
      navigate('/spt')
    } else if (menuId === 'spt-cate') {
      navigate('/spt/cate')
    } else if (menuId === 'spt-resources') {
      navigate('/spt/resources')
    } else if (menuId === 'server' || menuId === 'server-status') {
      navigate('/server')
    } else if (menuId === 'server-remote') {
      navigate('/server/remote')
    } else if (menuId === 'db-manager') {
      navigate('/server/db-manager')
    } else if (menuId === 'codes') {
      navigate('/codes')
    } else if (menuId === 'baseconfig') {
      navigate('/baseconfig')
    } else if (menuId === 'stock-prediction') {
      navigate('/stock-prediction')
    } else if (menuId === 'users') {
      navigate('/users')
    } else if (menuId === 'paid') {
      navigate('/paid')
    } else if (menuId === 'menus') {
      navigate('/menu')
    } else {
      navigate('/')
    }
  }

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev)
  }

  const sptInMainApp =
    location.pathname === '/spt/cate' || location.pathname === '/spt/resources'

  return (
    !isAuthenticated ? (
      <AuthRoutes />
    ) : sptInMainApp ? (
      <AuthenticatedAppRoutes
        selectedMenu={selectedMenu}
        mobileOpen={mobileOpen}
        isMobile={isMobile}
        onMenuSelect={handleMenuSelect}
        onMobileClose={handleDrawerToggle}
      />
    ) : location.pathname === '/spt' || location.pathname.startsWith('/spt/') ? (
      <SptRoutes />
    ) : (
      <AuthenticatedAppRoutes
        selectedMenu={selectedMenu}
        mobileOpen={mobileOpen}
        isMobile={isMobile}
        onMenuSelect={handleMenuSelect}
        onMobileClose={handleDrawerToggle}
      />
    )
  )
}
