import { useState, useEffect } from 'react'
import { ThemeProvider, createTheme, CssBaseline, AppBar, Toolbar, IconButton, useMediaQuery, Typography, useTheme } from '@mui/material'
import { Box } from '@mui/material'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import MenuIcon from '@mui/icons-material/Menu'
import Sidebar from './components/Sidebar'
import HomeScreen from './components/HomeScreen'
import ChatPage from './pages/chating/index'
import MemoPage from './pages/apps/memo'
import FavoritePage from './pages/apps/favorite'
import CalendarPage from './pages/calendar'
import GalleryPage from './pages/gallery'
import FilesPage from './pages/files'
import MakerPlanPage from './pages/makerplan'
import MakerPlanFormPage from './pages/makerplan/form'
import MakerPlanViewPage from './pages/makerplan/view'
import AccountsPage from './pages/accounts'
import AppsInfoPage from './pages/apps/basic'
import AppInfoFormPage from './pages/apps/basic/form'
import AppInfoViewPage from './pages/apps/basic/view'
import AppConfigPage from './pages/appconfigs'
import AppConfigFormPage from './pages/appconfigs/form'
import LoginPage from './pages/login'
import SearchPage from './pages/search'
import MailsPage from './pages/mails'
import MailFormPage from './pages/mails/mailForm'
import MailViewPage from './pages/mails/view'
import ServerStatusPage from './pages/server'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
})

function AppContent() {
  const [selectedMenu, setSelectedMenu] = useState('home')
  const [mobileOpen, setMobileOpen] = useState(false)
  const appTheme = useTheme()
  const isMobile = useMediaQuery(appTheme.breakpoints.down('md'))
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.pathname === '/search') {
      setSelectedMenu('search')
    } else if (location.pathname === '/chat') {
      setSelectedMenu('chat')
    } else if (location.pathname === '/gallery') {
      setSelectedMenu('gallery')
    } else if (location.pathname === '/apps-accounts') {
      setSelectedMenu('apps-accounts')
    } else if (location.pathname === '/app/configs' || location.pathname.startsWith('/app/configs/')) {
      setSelectedMenu('app/configs')
    } else if (location.pathname === '/app-info' || location.pathname.startsWith('/app-info/')) {
      setSelectedMenu('apps-info')
    } else if (location.pathname === '/apps/info/create' || location.pathname.startsWith('/apps/info/create') ||
               /^\/apps\/info\/\d+\/form/.test(location.pathname)) {
      setSelectedMenu('apps-info/form')
    } else if (location.pathname === '/apps/info' || location.pathname.match(/^\/apps\/info\/\d+$/)) {
      setSelectedMenu('apps/info')
    } else if (location.pathname === '/apps/memo' || location.pathname.startsWith('/apps/memo/')) {
      setSelectedMenu('memo')
    } else if (location.pathname === '/apps/calendar' || location.pathname.startsWith('/apps/calendar/')) {
      setSelectedMenu('calendar')
    } else if (location.pathname === '/apps/favorite' || location.pathname.startsWith('/apps/favorite/')) {
      setSelectedMenu('favorite')
    } else if (location.pathname === '/files' || location.pathname.startsWith('/files/') || location.pathname === '/apps/files' || location.pathname.startsWith('/apps/files/')) {
      setSelectedMenu('files')
    } else if (location.pathname === '/makerplan' || location.pathname.startsWith('/makerplan/')) {
      setSelectedMenu('makerplan')
    } else if (location.pathname === '/mails' || location.pathname.startsWith('/mails/')) {
      setSelectedMenu('mails')
    } else if (location.pathname === '/server' || location.pathname.startsWith('/server/')) {
      setSelectedMenu('server')
    }
    // 그 외 경로('/') 등에서는 현재 선택된 메뉴를 유지
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
        navigate('/apps/calendar')
      } else if (menuId === 'favorite') {
        navigate('/apps/favorite')
      } else if (menuId === 'files') {
        navigate('/files')
      } else if (menuId === 'makerplan') {
        navigate('/makerplan')
      } else if (menuId === 'mails') {
        navigate('/mails')
      } else if (menuId === 'server') {
        navigate('/server')
      } else {
      navigate('/')
    }
  }

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  return (
    <>
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar 
          selectedMenu={selectedMenu} 
          onMenuSelect={handleMenuSelect}
          mobileOpen={mobileOpen}
          onMobileClose={handleDrawerToggle}
        />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            backgroundColor: 'background.default',
          }}
        >
          {isMobile && (
            <AppBar
              position="fixed"
              sx={{
                display: { xs: 'block', md: 'none' },
                zIndex: (theme) => theme.zIndex.drawer + 1,
              }}
            >
              <Toolbar>
                <IconButton
                  color="inherit"
                  aria-label="open drawer"
                  edge="start"
                  onClick={handleDrawerToggle}
                  sx={{ mr: 2 }}
                >
                  <MenuIcon />
                </IconButton>
                <Typography variant="h6" noWrap component="div">
                  PSJ App
                </Typography>
              </Toolbar>
            </AppBar>
          )}
          <Box
            sx={{
              flexGrow: 1,
              overflow: 'auto',
              mt: isMobile ? '64px' : 0,
            }}
          >
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/apps-accounts" element={<AccountsPage />} />
              <Route path="/app/configs" element={<AppConfigPage />} />
              <Route path="/app/configs/form" element={<AppConfigFormPage />} />
              <Route path="/app/configs/:id/form" element={<AppConfigFormPage />} />
              <Route path="/apps/info" element={<AppsInfoPage />} />
              <Route path="/apps/info/create" element={<AppInfoFormPage />} />
              <Route path="/apps/info/create/:id" element={<AppInfoFormPage />} />
              <Route path="/apps/info/:id/form" element={<AppInfoFormPage />} />
              <Route path="/apps/info/:id" element={<AppInfoViewPage />} />
              <Route path="/app-info/:app_id/form" element={<AppInfoFormPage />} />
              <Route path="/apps/memo" element={<MemoPage />} />
              <Route path="/apps/calendar" element={<CalendarPage />} />
              <Route path="/apps/favorite" element={<FavoritePage />} />
              <Route path="/files" element={<FilesPage />} />
              <Route path="/makerplan" element={<MakerPlanPage />} />
              <Route path="/makerplan/create" element={<MakerPlanFormPage />} />
              <Route path="/makerplan/:id/form" element={<MakerPlanFormPage />} />
              <Route path="/makerplan/:id" element={<MakerPlanViewPage />} />
              <Route path="/mails" element={<MailsPage />} />
              <Route path="/mails/create" element={<MailFormPage />} />
              <Route path="/mails/:dataId" element={<MailViewPage />} />
              <Route path="/server" element={<ServerStatusPage />} />

              <Route path="*" element={<HomeScreen selectedMenu={selectedMenu} />} />
            </Routes>
          </Box>
        </Box>
      </Box>
    </>
  )
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppContent />
    </ThemeProvider>
  )
}

export default App
