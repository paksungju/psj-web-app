import { useState, useEffect } from 'react'
import { ThemeProvider, createTheme, CssBaseline, AppBar, Toolbar, IconButton, useMediaQuery, Typography, useTheme } from '@mui/material'
import { Box } from '@mui/material'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import MenuIcon from '@mui/icons-material/Menu'
import Sidebar from './components/Sidebar'
import HomeScreen from './components/HomeScreen'
import ChatPage from './pages/chating'
import GalleryPage from './pages/gallery'
import AccountsPage from './pages/accounts'
import LoginPage from './pages/login'
import SearchPage from './pages/search'

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
    if (location.pathname === '/chat') {
      setSelectedMenu('chat')
    } else if (location.pathname === '/gallery') {
      setSelectedMenu('gallery')
    } else if (location.pathname === '/search') {
      setSelectedMenu('search')
    } else if (location.pathname === '/apps-accounts') {
      setSelectedMenu('apps-accounts')
    }
    // 그 외 경로('/') 등에서는 현재 선택된 메뉴를 유지
  }, [location.pathname])

  const handleMenuSelect = (menuId: string) => {
    setSelectedMenu(menuId)

    if (menuId === 'chat') {
      navigate('/chat')
    } else if (menuId === 'gallery') {
      navigate('/gallery')
    } else if (menuId === 'search') {
      navigate('/search')
    } else if (menuId === 'apps-accounts') {
      navigate('/apps-accounts')
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
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/apps-accounts" element={<AccountsPage />} />
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
