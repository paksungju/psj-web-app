import {
  AppBar,
  Box,
  IconButton,
  Toolbar,
  Typography,
} from '@mui/material'
import { Navigate, Route, Routes } from 'react-router-dom'
import MenuIcon from '@mui/icons-material/Menu'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import HomeScreen from '../components/HomeScreen'
import ChatPage from '../pages/chating/index'
import MemoPage from '../pages/apps/memo'
import FavoritePage from '../pages/apps/favorite'
import SchedulePage from '../pages/schedule'
import ScheduleCalendarPage from '../pages/schedule/calendar'
import GalleryPage from '../pages/gallery'
import SptResourcePage from '../pages/spt/resource'
import FilesPage from '../pages/files'
import MenuPage from '../pages/menu'
import MakerPlanPage from '../pages/makerplan'
import MakerPlanFormPage from '../pages/makerplan/form'
import MakerPlanViewPage from '../pages/makerplan/view'
import MakerPlan3dIndexPage from '../pages/makerplan/index3d'
import AccountsPage from '../pages/accounts'
import ItemsPage from '../pages/items'
import AppsInfoPage from '../pages/apps/basic'
import AppInfoFormPage from '../pages/apps/basic/form'
import AppInfoViewPage from '../pages/apps/basic/view'
import IdeaBlockPage from '../pages/apps/ideablock'
import IdeaBlockFormPage from '../pages/apps/ideablock/form'
import IdeaBlockViewPage from '../pages/apps/ideablock/view'
import AppConfigPage from '../pages/appconfigs'
import AppConfigFormPage from '../pages/appconfigs/form'
import SearchPage from '../pages/search'
import MailsPage from '../pages/mails'
import MailFormPage from '../pages/mails/mailForm'
import MailViewPage from '../pages/mails/view'
import ServerStatusPage from '../pages/server'
import ServerRemotePage from '../pages/server/remote'
import DbManagerPage from '../pages/server/db_manager'
import CodesPage from '../pages/codes'
import BaseConfigPage from '../pages/baseconfig'
import UsersPage from '../pages/users'
import PaidInfoPage from '../pages/paid'
import SptContentCatePage from '../pages/spt/contentCate'
import TrainingPage from '../pages/training'
import TrainingFormPage from '../pages/training/form'
import TrainingViewPage from '../pages/training/view'
import DrawPage from '../pages/draw'
import DrawWritePage from '../pages/draw/write'
import StockPredictionPage from '../pages/stock-prediction'
import StockPredictionDetailPage from '../pages/stock-prediction/detail'

interface AppRoutesProps {
  selectedMenu: string
  mobileOpen: boolean
  isMobile: boolean
  onMenuSelect: (menuId: string) => void
  onMobileClose: () => void
}

function AppShell({
  selectedMenu,
  mobileOpen,
  isMobile,
  onMenuSelect,
  onMobileClose,
}: AppRoutesProps) {
  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        selectedMenu={selectedMenu}
        onMenuSelect={onMenuSelect}
        mobileOpen={mobileOpen}
        onMobileClose={onMobileClose}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: 0,
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
                onClick={onMobileClose}
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
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            mt: isMobile ? '64px' : 0,
          }}
        >
          <TopBar />
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
            }}
          >
            <Routes>
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/" element={<HomeScreen selectedMenu={selectedMenu} />} />
            <Route path="/search" element={<SearchPage />} />
            <Route
              path="/chat"
              element={
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    // 부모가 flex 컬럼이어야 flex:1로 뷰포트 안 높이를 받음 → 내부 메시지 영역만 스크롤
                    height: '100%',
                    maxHeight: '100%',
                  }}
                >
                  <ChatPage />
                </Box>
              }
            />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/apps-accounts" element={<AccountsPage />} />
            <Route path="/items" element={<ItemsPage />} />
            <Route path="/app/configs" element={<AppConfigPage />} />
            <Route path="/app/configs/form" element={<AppConfigFormPage />} />
            <Route path="/app/configs/:id/form" element={<AppConfigFormPage />} />
            <Route path="/apps/info" element={<AppsInfoPage />} />
            <Route path="/apps/info/create" element={<AppInfoFormPage />} />
            <Route path="/apps/info/create/:id" element={<AppInfoFormPage />} />
            <Route path="/apps/info/:id/form" element={<AppInfoFormPage />} />
            <Route path="/apps/info/:id" element={<AppInfoViewPage />} />
            <Route path="/app-info/:app_id/form" element={<AppInfoFormPage />} />
            <Route path="/apps/ideablock" element={<IdeaBlockPage />} />
            <Route path="/apps/ideablock/create" element={<IdeaBlockFormPage />} />
            <Route path="/apps/ideablock/:id/form" element={<IdeaBlockFormPage />} />
            <Route path="/apps/ideablock/:id" element={<IdeaBlockViewPage />} />
            <Route path="/apps/memo" element={<MemoPage />} />
            <Route path="/apps/calendar" element={<ScheduleCalendarPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/schedule/calendar" element={<ScheduleCalendarPage />} />
            <Route path="/apps/favorite" element={<FavoritePage />} />
            <Route path="/files" element={<FilesPage />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/makerplan" element={<MakerPlanPage />} />
            <Route path="/makerplan/3d" element={<MakerPlan3dIndexPage />} />
            <Route path="/makerplan/3d/:id" element={<MakerPlan3dIndexPage />} />
            <Route path="/makerplan/create" element={<MakerPlanFormPage />} />
            <Route path="/makerplan/:id/form" element={<MakerPlanFormPage />} />
            <Route path="/makerplan/:id" element={<MakerPlanViewPage />} />
            <Route path="/mails" element={<MailsPage />} />
            <Route path="/mails/create" element={<MailFormPage />} />
            <Route path="/mails/:dataId" element={<MailViewPage />} />
            <Route path="/server" element={<ServerStatusPage />} />
            <Route path="/server/remote" element={<ServerRemotePage />} />
            <Route path="/server/db-manager" element={<DbManagerPage />} />
            <Route path="/codes" element={<CodesPage />} />
            <Route path="/spt/cate" element={<SptContentCatePage />} />
            <Route path="/spt/resources" element={<SptResourcePage />} />
            <Route path="/baseconfig" element={<BaseConfigPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/paid" element={<PaidInfoPage />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/training/form" element={<TrainingFormPage />} />
            <Route path="/training/:id" element={<TrainingViewPage />} />
            <Route path="/training/:id/form" element={<TrainingFormPage />} />
            <Route path="/draw/write/:id" element={<DrawWritePage />} />
            <Route path="/draw/write" element={<DrawWritePage />} />
            <Route path="/draw" element={<DrawPage />} />
            <Route path="/draw/:id" element={<DrawPage />} />
            <Route path="/stock-prediction" element={<StockPredictionPage />} />
            <Route path="/stock-prediction/:id" element={<StockPredictionDetailPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default function AppRoutes(props: AppRoutesProps) {
  return <AppShell {...props} />
}
