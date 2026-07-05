import { useEffect, useState } from 'react'
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
  Snackbar,
  Checkbox,
  CircularProgress,
} from '@mui/material'
import TopBar from '../../components/TopBar'
import { fetchMailsApi, importMailsApi, deleteMailsApi, type ApiMail } from '../../apis/mailApi'
import Alert from '@mui/material/Alert'

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    return `${year}.${month}.${day} ${hour}:${min}`
  } catch {
    return '-'
  }
}

const ROWS_PER_PAGE = 20

export default function MailsPage() {
  const navigate = useNavigate()
  const [list, setList] = useState<ApiMail[]>([])
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [accountErrors, setAccountErrors] = useState<Record<string, string>>({})
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [importNotice, setImportNotice] = useState<{ message: string; severity: 'success' | 'warning' | 'error' } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE))

  const refreshList = async (page: number = currentPage) => {
    setLoading(true)
    setFetchError(null)
    setAccountErrors({})
    try {
      const skip = (page - 1) * ROWS_PER_PAGE
      const data = await fetchMailsApi({ skip, limit: ROWS_PER_PAGE })
      setList(data.mails ?? [])
      setTotal(data.total ?? 0)
      setAccountErrors(data.accountErrors ?? {})
      setSelectedIds(new Set())
    } catch (error) {
      console.error('메일 목록을 불러오는 중 오류가 발생했습니다:', error)
      setFetchError(error instanceof Error ? error.message : '메일 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (_: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page)
    refreshList(page)
  }

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(list.map((row) => row.id)))
      return
    }
    setSelectedIds(new Set())
  }

  const handleSelectOne = (mailId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(mailId)) next.delete(mailId)
      else next.add(mailId)
      return next
    })
  }

  const handleImport = async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await importMailsApi()
      if (res.error) {
        setFetchError(res.error)
      } else {
        await refreshList(1)
        setCurrentPage(1)
        if (res.imported > 0) {
          setImportNotice({
            message: res.skipped ? `${res.imported}건 가져왔습니다. ${res.skipped}건은 이미 가져온 메일입니다.` : `${res.imported}건 가져왔습니다.`,
            severity: 'success',
          })
        } else if (res.errors?.length) {
          setImportNotice({
            message: `가져오기 실패: ${res.errors.slice(0, 3).join(' / ')}`,
            severity: 'error',
          })
        } else {
          setImportNotice({
            message: res.skipped ? `새 메일이 없습니다. ${res.skipped}건은 이미 가져온 메일입니다.` : '가져올 메일이 없습니다.',
            severity: 'warning',
          })
        }
      }
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : '메일 가져오기에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleWriteMail = () => navigate('/mails/create')

  const handleDeleteSelected = async () => {
    if (!selectedIds.size) return
    if (!window.confirm(`선택한 ${selectedIds.size}개의 메일을 삭제하시겠습니까?`)) return
    try {
      setIsDeleting(true)
      const dataIds = Array.from(selectedIds).map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n))
      if (!dataIds.length) return
      const res = await deleteMailsApi({ dataIds })
      setSelectedIds(new Set())
      await refreshList(currentPage)
      if (res.errors?.length) {
        setImportNotice({ message: `${res.deleted}건 삭제됨. 일부 실패: ${res.errors.join(', ')}`, severity: 'warning' })
      } else {
        setImportNotice({ message: `${res.deleted}건 삭제되었습니다.`, severity: 'success' })
      }
    } catch (error) {
      console.error('메일 삭제 오류:', error)
      setImportNotice({ message: error instanceof Error ? error.message : '메일 삭제에 실패했습니다.', severity: 'error' })
    } finally {
      setIsDeleting(false)
    }
  }

  useEffect(() => {
    refreshList(currentPage)
  }, [])

  return (
    <Box
      sx={{
        flexGrow: 1,
        overflow: 'auto',
        p: 3,
      }}
    >
      <TopBar />
      {isDeleting && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            bgcolor: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
        >
          <CircularProgress size={64} />
        </Box>
      )}
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
          메일 목록
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          통합 메일함입니다.
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Button size="small" variant="outlined" color="inherit" onClick={handleImport}>
            가져오기
          </Button>
          <Button size="small" variant="outlined" color="inherit" onClick={() => refreshList()}>
            새로고침
          </Button>
          <Button size="small" variant="outlined" color="inherit" onClick={handleWriteMail}>
            메일작성
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            disabled={!selectedIds.size || isDeleting}
            onClick={handleDeleteSelected}
          >
            선택 삭제
          </Button>
        </Box>

        {fetchError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFetchError(null)}>
            {fetchError}
          </Alert>
        )}
        {Object.keys(accountErrors).length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>일부 계정 연결 실패:</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              {Object.entries(accountErrors).map(([name, err]) => (
                <li key={name}>
                  {name}: {err}
                </li>
              ))}
            </ul>
          </Alert>
        )}

        {loading ? (
          <Typography color="text.secondary">로딩 중...</Typography>
        ) : list.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">메일이 없습니다.</Typography>
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
                  <TableCell padding="checkbox" sx={{ width: 48 }}>
                    <Checkbox
                      indeterminate={selectedIds.size > 0 && selectedIds.size < list.length}
                      checked={list.length > 0 && selectedIds.size === list.length}
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, width: 80 }}>
                    계정
                  </TableCell>
                  <TableCell align="left" sx={{ fontWeight: 600, minWidth: 200 }}>
                    제목
                  </TableCell>
                  <TableCell align="left" sx={{ fontWeight: 600, minWidth: 180 }}>
                    발신자
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, width: 80 }}>
                    첨부
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, width: 140 }}>
                    수신일
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {list.map((row) => (
                  <TableRow key={`${row.account}-${row.id}`} hover>
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(row.id)}
                        onChange={() => handleSelectOne(row.id)}
                      />
                    </TableCell>
                    <TableCell align="center">{row.account ?? '-'}</TableCell>
                    <TableCell
                      sx={{
                        fontWeight: (row.hit ?? 0) === 0 ? 700 : 400,
                        cursor: 'pointer',
                        color: 'primary.main',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                      onClick={() => navigate(`/mails/${row.id}`)}
                    >
                      {row.subject ?? '-'}
                    </TableCell>
                    <TableCell>{row.from ?? '-'}</TableCell>
                    <TableCell align="center">{row.attachment_count ?? 0}</TableCell>
                    <TableCell align="center">{formatDate(row.date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <Pagination count={totalPages} page={currentPage} onChange={handlePageChange} color="primary" />
              </Box>
            )}
          </Paper>
        )}
      </Paper>
      <Snackbar
        open={Boolean(importNotice)}
        autoHideDuration={3000}
        onClose={() => setImportNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={importNotice?.severity ?? 'success'} onClose={() => setImportNotice(null)} sx={{ width: '100%' }}>
          {importNotice?.message ?? ''}
        </Alert>
      </Snackbar>
    </Box>
  )
}
