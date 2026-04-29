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
} from '@mui/material'
import TopBar from '../../components/TopBar'
import {
  fetchAppDataListApi,
  deleteAppDataBatchApi,
  type ApiAppData,
} from '../../apis/appApi'
import { fetchTrainingLogsApi, type TrainingLogRow } from '../../apis/trainingLogApi'

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

export default function TrainingPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [rightLoading, setRightLoading] = useState(true)
  const [leftList, setLeftList] = useState<ApiAppData[]>([])
  const [rightList, setRightList] = useState<TrainingLogRow[]>([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [hasNextPageLeft, setHasNextPageLeft] = useState(true)
  const [hasNextPageRight, setHasNextPageRight] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const filteredLeftList = useMemo(() => {
    return leftList
  }, [leftList])

  const handleSelectAllLeft = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const ids = new Set(filteredLeftList.map((r) => r.data_id).filter((id): id is number => id != null))
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
    setRightLoading(true)
    try {
      const skip = (page - 1) * pageSize
      const leftData = await fetchAppDataListApi({ skip, limit: pageSize, app_id: 8 })
      const sortedLeft = [...(leftData ?? [])].sort((a, b) => (b.data_id ?? 0) - (a.data_id ?? 0))
      setLeftList(sortedLeft)
      setHasNextPageLeft((leftData ?? []).length === pageSize)
    } catch (error) {
      console.error('트레이닝 목록(app_data) 로드 실패:', error)
      setLeftList([])
      setHasNextPageLeft(false)
    } finally {
      setLoading(false)
    }

    try {
      const skip = (page - 1) * pageSize
      const trainingLogs = await fetchTrainingLogsApi({ skip, limit: pageSize, app_id: 8 })
      const sortedRight = [...(trainingLogs ?? [])].sort((a, b) => (b.tr_id ?? 0) - (a.tr_id ?? 0))
      setRightList(sortedRight)
      setHasNextPageRight((trainingLogs ?? []).length === pageSize)
    } catch (error) {
      console.error('트레이닝 로그(training_logs) 로드 실패:', error)
      setRightList([])
      setHasNextPageRight(false)
    } finally {
      setRightLoading(false)
    }
  }

  useEffect(() => {
    refreshList()
  }, [page, pageSize])

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

  const totalPagesLeft = hasNextPageLeft ? page + 1 : page
  const totalPagesRight = hasNextPageRight ? page + 1 : page

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
        }}
      >
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
          트레이닝 목록
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        트레이닝 목록입니다.
        </Typography>

        <Button
          size="small"
          variant="outlined"
          color="inherit"
          sx={{ mb: 2 }}
          onClick={() => navigate('/training/form')}
        >
          등록하기
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          sx={{ mb: 2, ml: '10px' }}
          onClick={handleDeleteSelected}
        >
          선택삭제
        </Button>

        <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', width: '83.3333%' }}>
          <Paper
            variant="outlined"
            sx={{
              width: '60%',
              flexShrink: 0,
              p: 2,
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            {loading ? (
              <Typography color="text.secondary">로딩 중...</Typography>
            ) : leftList.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography color="text.secondary">등록된 데이터가 없습니다.</Typography>
              </Box>
            ) : (
              <>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f5f7fb' }}>
                      <TableCell padding="checkbox" sx={{ fontWeight: 600, width: 48 }}>
                        <Checkbox
                          indeterminate={
                            filteredLeftList.some((row) => row.data_id != null && selectedIds.has(row.data_id)) &&
                            !filteredLeftList.every((row) => row.data_id != null && selectedIds.has(row.data_id))
                          }
                          checked={
                            filteredLeftList.length > 0 &&
                            filteredLeftList.every((row) => row.data_id != null && selectedIds.has(row.data_id))
                          }
                          onChange={handleSelectAllLeft}
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
                    {filteredLeftList.map((row) => {
                      const replyDepth = (() => {
                        const rc = row.reply_cd
                        if (rc == null) return 0
                        const s = String(rc).trim()
                        if (s === '' || s === '0') return 0
                        return s.length
                      })()
                      return (
                        <TableRow key={`left-${row.data_id ?? row.app_id ?? 0}`} hover>
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
                              row.data_id != null && navigate(`/training/${row.data_id}`)
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
                {!loading && leftList.length > 0 && (
                  <Stack spacing={2} sx={{ p: 2, alignItems: 'center' }}>
                    <Pagination
                      count={totalPagesLeft}
                      page={page}
                      onChange={handlePageChange}
                      color="primary"
                      showFirstButton
                      showLastButton
                    />
                  </Stack>
                )}
              </>
            )}
          </Paper>

          <Paper
            variant="outlined"
            sx={{
              width: '40%',
              minWidth: 0,
              p: 2,
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            {rightLoading ? (
              <Typography color="text.secondary">로딩 중...</Typography>
            ) : rightList.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography color="text.secondary">등록된 데이터가 없습니다.</Typography>
              </Box>
            ) : (
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f5f7fb' }}>
                      <TableCell align="center" sx={{ fontWeight: 600, width: 70 }}>
                        tr_id
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, width: 70 }}>
                        app_id
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, width: 70 }}>data_id</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, minWidth: 180 }}>학습제목</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, width: 120 }}>훈련일자</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, width: 100 }}>시작</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, width: 100 }}>종료</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rightList.map((row) => {
                      return (
                        <TableRow key={row.tr_id} hover>
                          <TableCell align="center">{row.tr_id}</TableCell>
                          <TableCell align="center">{row.app_id ?? '-'}</TableCell>
                          <TableCell align="center">{row.data_id ?? '-'}</TableCell>
                          <TableCell>{row.tr_subject ?? '-'}</TableCell>
                          <TableCell align="center">{row.tr_date ?? '-'}</TableCell>
                          <TableCell align="center">{row.start_time ?? '-'}</TableCell>
                          <TableCell align="center">{row.end_time ?? '-'}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                {!rightLoading && rightList.length > 0 && (
                  <Stack spacing={2} sx={{ p: 2, alignItems: 'center' }}>
                    <Pagination
                      count={totalPagesRight}
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
          </Paper>
        </Box>
      </Paper>
    </Box>
  )
}
