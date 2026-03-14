import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  Pagination,
  Stack,
  Checkbox,
  List,
  ListItemButton,
} from '@mui/material'
import TopBar from '../../../components/TopBar'
import {
  fetchAppDataListApi,
  deleteAppDataBatchApi,
  type ApiAppData,
} from '../../../apis/appApi'

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}.${month}.${day}`
  } catch {
    return '-'
  }
}

export default function AppConfigsPage() {
  const navigate = useNavigate()
  const [list, setList] = useState<ApiAppData[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [hasNextPage, setHasNextPage] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const normalizeCategory = (value: string | null | undefined): string => {
    const trimmed = value?.trim()
    return trimmed ? trimmed : '미분류'
  }

  const categoryItems = useMemo(() => {
    const counts = new Map<string, number>()
    list.forEach((row) => {
      const key = normalizeCategory(row.cate1)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    const dynamicItems = Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'ko'))
      .map(([key, count]) => ({ key, label: key, count }))
    return [{ key: 'all', label: '전체', count: list.length }, ...dynamicItems]
  }, [list])

  const filteredList = useMemo(() => {
    if (selectedCategory === 'all') return list
    return list.filter((row) => normalizeCategory(row.cate1) === selectedCategory)
  }, [list, selectedCategory])

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const ids = new Set(filteredList.map((r) => r.data_id).filter((id): id is number => id != null))
      setSelectedIds(ids)
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (dataId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(dataId)) next.delete(dataId)
      else next.add(dataId)
      return next
    })
  }

  const refreshList = async () => {
    setLoading(true)
    try {
      const skip = (page - 1) * pageSize
      const data = await fetchAppDataListApi({ skip, limit: pageSize, app_id: 2 })
      setList(data ?? [])
      setHasNextPage((data ?? []).length === pageSize)
    } catch (error) {
      console.error('앱 데이터 목록을 불러오는 중 오류가 발생했습니다:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshList()
  }, [page, pageSize])

  useEffect(() => {
    if (selectedCategory === 'all') return
    const exists = categoryItems.some((item) => item.key === selectedCategory)
    if (!exists) setSelectedCategory('all')
  }, [categoryItems, selectedCategory])

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) {
      alert('삭제할 항목을 선택해 주세요.')
      return
    }
    if (!window.confirm(`선택한 ${ids.length}개 항목을 삭제하시겠습니까?`)) return
    try {
      const res = await deleteAppDataBatchApi(ids)
      setSelectedIds(new Set())
      await refreshList()
      if (res.errors.length > 0) {
        alert(`${res.deleted}건 삭제됨. 일부 실패:\n${res.errors.join('\n')}`)
      } else {
        alert(`${res.deleted}건 삭제되었습니다.`)
      }
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    }
  }

  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value)
  }

  // 현재 페이지가 마지막이 아니면 다음 페이지가 있다고 가정
  const totalPages = hasNextPage ? page + 1 : page

  return (
    <Box
      sx={{
        flexGrow: 1,
        overflow: 'auto',
        p: 3,
      }}
    >
      <TopBar />
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          backgroundColor: 'background.paper',
          minHeight: '100%',
        }}
      >
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
          앱 데이터 목록
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          앱 데이터(AppData) 목록입니다.
        </Typography>

        <Button
          variant="outlined"
          color="inherit"
          sx={{ mb: 2 }}
          onClick={() => navigate('/apps/info/create')}
        >
          등록하기
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          sx={{ mb: 2, ml: '10px' }}
          onClick={handleDeleteSelected}
        >
          선택삭제
        </Button>

        <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
          <Paper
            variant="outlined"
            sx={{
              width: 220,
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
              {categoryItems.map((item) => (
                <ListItemButton
                  key={item.key}
                  selected={selectedCategory === item.key}
                  onClick={() => setSelectedCategory(item.key)}
                  sx={{
                    mx: 0.5,
                    borderRadius: 1,
                    py: 0.75,
                    '&.Mui-selected': { bgcolor: 'action.selected' },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 1 }}>
                    <Typography variant="body2" noWrap>{item.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.count}</Typography>
                  </Box>
                </ListItemButton>
              ))}
            </List>
          </Paper>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <Typography color="text.secondary">로딩 중...</Typography>
            ) : list.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography color="text.secondary">등록된 데이터가 없습니다.</Typography>
              </Box>
            ) : filteredList.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography color="text.secondary">선택한 분류에 데이터가 없습니다.</Typography>
              </Box>
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  overflow: 'hidden',
                  minWidth: 960,
                }}
              >
                <Table size="small" sx={{ minWidth: 960 }}>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f5f7fb' }}>
                      <TableCell padding="checkbox" sx={{ fontWeight: 600, width: 48 }}>
                        <Checkbox
                          indeterminate={
                            filteredList.some((row) => row.data_id != null && selectedIds.has(row.data_id)) &&
                            !filteredList.every((row) => row.data_id != null && selectedIds.has(row.data_id))
                          }
                          checked={
                            filteredList.length > 0 &&
                            filteredList.every((row) => row.data_id != null && selectedIds.has(row.data_id))
                          }
                          onChange={handleSelectAll}
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, width: 70 }}>
                        data_id
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, width: 70 }}>
                        app_id
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, minWidth: 180 }}>제목</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, width: 100 }}>작성자</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, width: 120 }}>등록일</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredList.map((row) => {
                      const replyDepth = (() => {
                        const rc = row.reply_cd
                        if (rc == null) return 0
                        const s = String(rc).trim()
                        if (s === '' || s === '0') return 0
                        return s.length
                      })()
                      return (
                        <TableRow key={row.data_id ?? row.app_id ?? 0} hover>
                          <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={row.data_id != null && selectedIds.has(row.data_id)}
                              onChange={() => row.data_id != null && handleSelectOne(row.data_id)}
                              disabled={row.data_id == null}
                            />
                          </TableCell>
                          <TableCell align="center">{row.data_id ?? '-'}</TableCell>
                          <TableCell align="center">{row.app_id ?? '-'}</TableCell>
                          <TableCell
                            onClick={() =>
                              row.data_id != null && navigate(`/apps/info/${row.data_id}`)
                            }
                            sx={{
                              cursor: row.data_id != null ? 'pointer' : 'default',
                              color: row.data_id != null ? 'primary.main' : 'text.primary',
                              fontWeight: 600,
                              pl: 2 + replyDepth * 2,
                            }}
                          >
                            {row.ap_subject ?? '-'}
                          </TableCell>
                          <TableCell>{row.user_nm ?? '-'}</TableCell>
                          <TableCell align="center">{formatDate(row.regist_dt)}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                {!loading && list.length > 0 && (
                  <Stack spacing={2} sx={{ p: 2, alignItems: 'center' }}>
                    <Pagination
                      count={totalPages}
                      page={page}
                      onChange={handlePageChange}
                      color="primary"
                      showFirstButton
                      showLastButton
                    />
                  </Stack>
                )}
              </Paper>
            )}
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}
