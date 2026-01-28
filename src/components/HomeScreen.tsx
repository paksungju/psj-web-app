import { Box, Typography, Paper, Grid, Card, CardContent } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import ChatIcon from '@mui/icons-material/Chat'
import HistoryIcon from '@mui/icons-material/History'
import PersonIcon from '@mui/icons-material/Person'
import SettingsIcon from '@mui/icons-material/Settings'
import CalendarPage from '../pages/calendar/iindex'
import TopBar from './TopBar'

interface HomeScreenProps {
  selectedMenu: string
}

const menuContent: Record<string, { title: string; icon: JSX.Element; description: string }> = {
  home: {
    title: '홈',
    icon: <HomeIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
    description: '환영합니다! 메뉴를 선택하여 시작하세요.',
  },
  chat: {
    title: '채팅',
    icon: <ChatIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
    description: '채팅 기능을 사용할 수 있습니다.',
  },
  history: {
    title: '히스토리',
    icon: <HistoryIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
    description: '이전 활동 내역을 확인할 수 있습니다.',
  },
  profile: {
    title: '프로필',
    icon: <PersonIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
    description: '프로필 정보를 관리할 수 있습니다.',
  },
  settings: {
    title: '설정',
    icon: <SettingsIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
    description: '앱 설정을 변경할 수 있습니다.',
  },
}

export default function HomeScreen({ selectedMenu }: HomeScreenProps) {
  if (selectedMenu === 'apps-calendar') {
    return <CalendarPage />
  }

  const content = (menuContent[selectedMenu] ?? menuContent.home)!

  return (
    <Box
      sx={{
        flexGrow: 1,
        overflow: 'auto',
        p: 3,
      }}
    >
      {/* 상단 공통 검색/빠른 이동 바 */}
      <TopBar />

      <Paper
        elevation={0}
        sx={{
          p: 4,
          borderRadius: 3,
          backgroundColor: 'background.paper',
          minHeight: '100%',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '55vh',
            textAlign: 'center',
          }}
        >
          <Box sx={{ mb: 3 }}>{content.icon}</Box>
          <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
            {content.title}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 500 }}>
            {content.description}
          </Typography>

          {/* Feature Cards */}
          <Grid container spacing={3} sx={{ mt: 4, maxWidth: 800 }}>
            <Grid item xs={12} sm={6} md={4}>
              <Card
                sx={{
                  height: '100%',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
              >
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    빠른 시작
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    간편하게 시작할 수 있습니다
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card
                sx={{
                  height: '100%',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
              >
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    직관적인 UI
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    사용하기 쉬운 인터페이스
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card
                sx={{
                  height: '100%',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
              >
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    현대적인 디자인
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    깔끔하고 모던한 디자인
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Box>
  )
}
