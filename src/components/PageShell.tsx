import { ReactNode } from 'react'
import { Box } from '@mui/material'

interface PageShellProps {
  children: ReactNode
}

/** 본문만 스크롤되는 페이지 레이아웃 (TopBar는 AppShell에서 렌더) */
export default function PageShell({ children }: PageShellProps) {
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        component="main"
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          px: { xs: 1.5, sm: 2, md: 3 },
          pb: { xs: 1.5, sm: 2, md: 3 },
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
