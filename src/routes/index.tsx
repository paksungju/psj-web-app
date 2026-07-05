import { useEffect, useState } from 'react'
import { useMediaQuery, useTheme } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import AuthenticatedAppRoutes from './appRoutes'
import AuthRoutes from './authRoutes'
import SptRoutes from './sptRoutes'

export default function AppRoutes() {
  const [selectedMenu, setSelectedMenu] = useState('home')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem('isLoggedIn') === 'true' || Boolean(localStorage.getItem('auth_token')),
  )
  const appTheme = useTheme()
  const isMobile = useMediaQuery(appTheme.breakpoints.down('md'))
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const syncAuthState = () => {
      setIsAuthenticated(
        localStorage.getItem('isLoggedIn') === 'true' || Boolean(localStorage.getItem('auth_token')),
      )
    }

    syncAuthState()
    window.addEventListener('storage', syncAuthState)
    window.addEventListener('auth-change', syncAuthState as EventListener)
    return () => {
      window.removeEventListener('storage', syncAuthState)
      window.removeEventListener('auth-change', syncAuthState as EventListener)
    }
  }, [])

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
    } else if (location.pathname === '/makerplan' || location.pathname.startsWith('/makerplan/')) {
      setSelectedMenu('makerplan')
    } else if (location.pathname === '/schedule' || location.pathname.startsWith('/schedule/')) {
      setSelectedMenu('todo-list')
    } else if (location.pathname === '/training' || location.pathname.startsWith('/training/')) {
      setSelectedMenu('training')
    } else if (location.pathname === '/mails' || location.pathname.startsWith('/mails/')) {
      setSelectedMenu('mails')
    } else if (location.pathname === '/spt/cate') {
      setSelectedMenu('spt-cate')
    } else if (location.pathname === '/spt/resources') {
      setSelectedMenu('spt-resources')
    } else if (location.pathname === '/spt' || location.pathname.startsWith('/spt/')) {
      setSelectedMenu('spt-home')
    } else if (location.pathname === '/server' || location.pathname.startsWith('/server/')) {
      setSelectedMenu('server')
    } else if (location.pathname === '/codes' || location.pathname.startsWith('/codes/')) {
      setSelectedMenu('codes')
    } else if (location.pathname === '/baseconfig') {
      setSelectedMenu('baseconfig')
    } else if (location.pathname === '/paid' || location.pathname.startsWith('/paid/')) {
      setSelectedMenu('paid')
    } else if (location.pathname === '/menu' || location.pathname.startsWith('/menu/')) {
      setSelectedMenu('menus')
    }
  }, [location.pathname])

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
    } else if (menuId === 'makerplan') {
      navigate('/makerplan')
    } else if (menuId === 'mails') {
      navigate('/mails')
    } else if (menuId === 'spt-home') {
      navigate('/spt')
    } else if (menuId === 'spt-cate') {
      navigate('/spt/cate')
    } else if (menuId === 'spt-resources') {
      navigate('/spt/resources')
    } else if (menuId === 'server') {
      navigate('/server')
    } else if (menuId === 'codes') {
      navigate('/codes')
    } else if (menuId === 'baseconfig') {
      navigate('/baseconfig')
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
