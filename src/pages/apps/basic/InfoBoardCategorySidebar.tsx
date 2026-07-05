import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Paper, Typography, List, ListItemButton } from '@mui/material'
import { fetchAppDataListApi, type ApiAppData } from '../../../apis/appApi'

export function normalizeInfoBoardCategory(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : '미분류'
}

function buildCategoryItems(list: ApiAppData[]) {
  const counts = new Map<string, number>()
  list.forEach((row) => {
    const key = normalizeInfoBoardCategory(row.cate1)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  const dynamicItems = Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'ko'))
    .map(([key, count]) => ({ key, label: key, count }))
  return [{ key: 'all', label: '전체', count: list.length }, ...dynamicItems]
}

export function useInfoBoardCategoryItems() {
  const [list, setList] = useState<ApiAppData[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchAppDataListApi({ skip: 0, limit: 5000, app_id: 2 })
        if (!cancelled) setList(data ?? [])
      } catch (e) {
        console.error(e)
        if (!cancelled) setList([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  const categoryItems = useMemo(() => buildCategoryItems(list), [list])
  return { categoryItems, loading }
}

export type InfoBoardCategorySidebarProps = {
  selectedKey: string
}

export const INFO_BOARD_LAYOUT_SX = {
  display: 'flex',
  flexDirection: { xs: 'column', md: 'row' },
  gap: { xs: 2, md: 3 },
  alignItems: 'flex-start',
} as const

export const INFO_BOARD_MAIN_SX = {
  flex: 1,
  minWidth: 0,
  width: { xs: '100%', md: 'auto' },
} as const

/** HomeScreen 과 동일한 페이지 외곽 여백 */
export const INFO_BOARD_PAGE_SX = {
  flexGrow: 1,
  overflow: 'auto',
  p: { xs: 1.5, sm: 2, md: 3 },
} as const

/** HomeScreen 과 동일한 Paper 내부 여백 */
export const INFO_BOARD_PAPER_SX = {
  p: { xs: 1.5, sm: 2, md: 4 },
  borderRadius: 3,
  backgroundColor: 'background.paper',
  minHeight: '100%',
} as const

export default function InfoBoardCategorySidebar({ selectedKey }: InfoBoardCategorySidebarProps) {
  const navigate = useNavigate()
  const { categoryItems, loading } = useInfoBoardCategoryItems()

  const go = (key: string) => {
    if (key === 'all') {
      navigate('/apps/info')
    } else {
      navigate(`/apps/info?category=${encodeURIComponent(key)}`)
    }
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        width: { xs: '100%', md: 220 },
        flexShrink: 0,
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 1.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
          분류
        </Typography>
      </Box>
      <List dense disablePadding sx={{ py: 0.5 }}>
        {loading ? (
          <Box sx={{ px: 1.5, py: 1 }}>
            <Typography variant="body2" color="text.secondary">
              불러오는 중…
            </Typography>
          </Box>
        ) : (
          categoryItems.map((item) => (
            <ListItemButton
              key={item.key}
              selected={selectedKey === item.key}
              onClick={() => go(item.key)}
              sx={{
                mx: 0.5,
                borderRadius: 1,
                py: 0.75,
                '&.Mui-selected': { bgcolor: 'action.selected' },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 1 }}>
                <Typography variant="body2" noWrap>
                  {item.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.count}
                </Typography>
              </Box>
            </ListItemButton>
          ))
        )}
      </List>
    </Paper>
  )
}
