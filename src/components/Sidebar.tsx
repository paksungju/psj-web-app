import { useState } from 'react'
import { 
  Box, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText, 
  Divider, 
  Typography, 
  IconButton,
  Drawer,
  useMediaQuery,
  useTheme,
  Collapse,
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import AppsIcon from '@mui/icons-material/Apps'
import ChatIcon from '@mui/icons-material/Chat'
import HistoryIcon from '@mui/icons-material/History'
import GalleryIcon from '@mui/icons-material/Collections'
import SettingsIcon from '@mui/icons-material/Settings'
import PersonIcon from '@mui/icons-material/Person'
import MenuIcon from '@mui/icons-material/Menu'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

interface SidebarProps {
  selectedMenu: string
  onMenuSelect: (menu: string) => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

const menuItems = [
  { id: 'home', label: '홈', icon: <HomeIcon /> },
  { id: 'chat', label: '채팅', icon: <ChatIcon /> },
  { id: 'history', label: '히스토리', icon: <HistoryIcon /> },
  { id: 'gallery', label: '겔러리', icon: <GalleryIcon /> },
  { id: 'profile', label: '프로필', icon: <PersonIcon /> },
  {
    id: 'apps',
    label: 'Apps',
    icon: <AppsIcon />,
    children: [
      { id: 'apps-calendar', label: '켈린더' },
      { id: 'apps-accounts', label: '계정관리' },
      { id: 'apps-favorites', label: '즐겨찾기' },
      { id: 'apps-memo', label: '메모장' },
    ],
  },
  { id: 'settings', label: '설정', icon: <SettingsIcon /> },
]

const drawerWidth = 280

export default function Sidebar({ selectedMenu, onMenuSelect, mobileOpen, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({
    apps: true,
  })
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const toggleSidebar = () => {
    setCollapsed(!collapsed)
  }

  const handleMenuClick = (menuId: string) => {
    onMenuSelect(menuId)
    if (isMobile && onMobileClose) {
      onMobileClose()
    }
  }

  const sidebarContent = (
    <Box
      sx={{
        width: isMobile ? drawerWidth : collapsed ? 60 : drawerWidth,
        height: '100%',
        backgroundColor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        transition: isMobile ? 'none' : 'width 0.3s ease',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          minHeight: 64,
        }}
      >
        {(!collapsed || isMobile) && (
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            ImPsj
          </Typography>
        )}
        {!isMobile && (
          <IconButton
            onClick={toggleSidebar}
            sx={{
              ml: collapsed ? 0 : 'auto',
              color: 'text.primary',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <MenuIcon />
          </IconButton>
        )}
      </Box>

      {/* Menu Items */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <List sx={{ py: 1 }}>
          {menuItems.map((item) => (
            <Box key={item.id}>
              <ListItem disablePadding>
                <ListItemButton
                  selected={
                    selectedMenu === item.id ||
                    (item.children?.some((child) => child.id === selectedMenu) ?? false)
                  }
                  onClick={() => {
                    if (item.children && item.children.length > 0) {
                      setOpenMenus((prev) => ({
                        ...prev,
                        [item.id]: !prev[item.id],
                      }))
                      handleMenuClick(item.id)
                    } else {
                      handleMenuClick(item.id)
                    }
                  }}
                  sx={{
                    mx: (collapsed && !isMobile) ? 0.5 : 1,
                    borderRadius: 2,
                    justifyContent: (collapsed && !isMobile) ? 'center' : 'flex-start',
                    minHeight: 48,
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      },
                      '& .MuiListItemIcon-root': {
                        color: 'white',
                      },
                    },
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color:
                        selectedMenu === item.id ||
                        (item.children?.some((child) => child.id === selectedMenu) ?? false)
                          ? 'white'
                          : 'text.secondary',
                      minWidth: (collapsed && !isMobile) ? 0 : 40,
                      justifyContent: 'center',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {(!collapsed || isMobile) && (
                    <>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontSize: 14,
                          fontWeight:
                            selectedMenu === item.id ||
                            (item.children?.some((child) => child.id === selectedMenu) ?? false)
                              ? 600
                              : 400,
                        }}
                      />
                      {item.children && (
                        openMenus[item.id] ? (
                          <ExpandLessIcon fontSize="small" />
                        ) : (
                          <ExpandMoreIcon fontSize="small" />
                        )
                      )}
                    </>
                  )}
                </ListItemButton>
              </ListItem>

              {/* 2단계 메뉴 (Apps 하위 메뉴) */}
              {item.children && (!collapsed || isMobile) && (
                <Collapse in={openMenus[item.id]} timeout="auto" unmountOnExit>
                  <Box sx={{ pl: 4 }}>
                    {item.children.map((child) => (
                      <ListItem key={child.id} disablePadding>
                        <ListItemButton
                          selected={selectedMenu === child.id}
                          onClick={() => handleMenuClick(child.id)}
                          sx={{
                            mx: 1,
                            borderRadius: 2,
                            justifyContent: 'flex-start',
                            minHeight: 36,
                            '&.Mui-selected': {
                              backgroundColor: '#B8D7FF',
                              color: 'white',
                              '&:hover': {
                                backgroundColor: '#B8D7FF',
                              },
                            },
                            '&:hover': {
                              backgroundColor: 'action.hover',
                            },
                          }}
                        >
                          <ListItemText
                            primary={child.label}
                            primaryTypographyProps={{
                              fontSize: 13,
                              fontWeight: selectedMenu === child.id ? 600 : 400,
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </Box>
                </Collapse>
              )}
            </Box>
          ))}
        </List>
      </Box>

      <Divider />

      {/* Footer */}
      {(!collapsed || isMobile) && (
        <Box sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">
            © 2024 PSJ Web App
          </Typography>
        </Box>
      )}
    </Box>
  )

  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={mobileOpen || false}
        onClose={onMobileClose}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
          },
        }}
      >
        {sidebarContent}
      </Drawer>
    )
  }

  return (
    <Box
      sx={{
        width: collapsed ? 60 : drawerWidth,
        height: '100%',
        borderRight: '1px solid',
        borderColor: 'divider',
        transition: 'width 0.3s ease',
        flexShrink: 0,
      }}
    >
      {sidebarContent}
    </Box>
  )
}
