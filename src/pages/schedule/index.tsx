import { useEffect, useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularProgress,
  Button,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  MenuItem,
} from '@mui/material'
import TopBar from '../../components/TopBar'
import {
  createAppDataApi,
  deleteAppDataBatchApi,
  fetchAppDataListApi,
  updateAppDataApi,
  type ApiAppData,
  type ApiAppPayload,
} from '../../apis/appApi'
import { fetchCodesByParentApi } from '../../apis/codesApi'

const TODO_APP_ID = 6

function normalizeDateStr(s: string | null | undefined): string {
  if (!s || !s.trim()) return ''
  const t = s.trim().replace(/-/g, '')
  if (t.length === 8) return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`
  return s
}

export default function SchedulePage() {
  const [items, setItems] = useState<ApiAppData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [progressCodeMap, setProgressCodeMap] = useState<Record<string, string>>({})
  const [importantCodeMap, setImportantCodeMap] = useState<Record<string, string>>({})
  const [progressOptions, setProgressOptions] = useState<Array<{ codeCd: string; codeNm: string }>>([])
  const [importantOptions, setImportantOptions] = useState<Array<{ codeCd: string; codeNm: string }>>([])
  const [popupOpen, setPopupOpen] = useState(false)
  const [popupEditing, setPopupEditing] = useState<ApiAppData | null>(null)
  const [popupStartDate, setPopupStartDate] = useState('')
  const [popupEndDate, setPopupEndDate] = useState('')
  const [popupTitle, setPopupTitle] = useState('')
  const [popupContent, setPopupContent] = useState('')
  const [popupProgress, setPopupProgress] = useState('')
  const [popupImportant, setPopupImportant] = useState('')

  const loadCodeMaps = async () => {
    try {
      const [progressRes, importantRes] = await Promise.all([
        fetchCodesByParentApi('progressCode'),
        fetchCodesByParentApi('importantCode'),
      ])
      setProgressCodeMap(
        Object.fromEntries(progressRes.items.map((row) => [row.code_cd, row.code_nm ?? row.code_cd])),
      )
      setImportantCodeMap(
        Object.fromEntries(importantRes.items.map((row) => [row.code_cd, row.code_nm ?? row.code_cd])),
      )
      setProgressOptions(progressRes.items.map((row) => ({ codeCd: row.code_cd, codeNm: row.code_nm ?? row.code_cd })))
      setImportantOptions(importantRes.items.map((row) => ({ codeCd: row.code_cd, codeNm: row.code_nm ?? row.code_cd })))
    } catch (error) {
      console.error('코드값 조회 오류:', error)
      setProgressCodeMap({})
      setImportantCodeMap({})
      setProgressOptions([])
      setImportantOptions([])
    }
  }

  const refreshList = async () => {
    setLoading(true)
    try {
      const rows = await fetchAppDataListApi({
        app_id: TODO_APP_ID,
        skip: 0,
        limit: 500,
      })
      setItems(rows ?? [])
    } catch (error) {
      console.error('할일 목록 조회 오류:', error)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void (async () => {
      await Promise.all([refreshList(), loadCodeMaps()])
    })()
  }, [])

  const handleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set())
      return
    }
    setSelectedIds(new Set(items.map((it) => it.data_id).filter((id): id is number => id != null)))
  }

  const handleSelectOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
    } catch (error) {
      console.error(error)
      alert('삭제에 실패했습니다.')
    }
  }

  const openEditPopup = (row: ApiAppData) => {
    setPopupEditing(row)
    setPopupStartDate(normalizeDateStr(row.start_date))
    setPopupEndDate(normalizeDateStr(row.end_date))
    setPopupTitle(row.ap_subject ?? '')
    setPopupContent(row.ap_content ?? '')
    setPopupProgress(row.extra_2 ?? '')
    setPopupImportant(row.extra_3 ?? '')
    setPopupOpen(true)
  }

  const openCreatePopup = () => {
    setPopupEditing(null)
    setPopupStartDate('')
    setPopupEndDate('')
    setPopupTitle('')
    setPopupContent('')
    setPopupProgress('')
    setPopupImportant('')
    setPopupOpen(true)
  }

  const savePopup = async () => {
    if (!popupTitle.trim() || !popupStartDate || !popupEndDate) return
    const start = popupStartDate <= popupEndDate ? popupStartDate : popupEndDate
    const end = popupStartDate <= popupEndDate ? popupEndDate : popupStartDate

    const form = {
      ap_subject: popupTitle.trim(),
      ap_content: popupContent.trim(),
      app_id: TODO_APP_ID,
      start_date: start,
      end_date: end,
      start_time: '09:00',
      end_time: '18:00',
      extra_1: popupEditing?.extra_1 ?? 'task',
      extra_2: popupProgress,
      extra_3: popupImportant,
    } as ApiAppPayload

    const strKeys: (keyof ApiAppPayload)[] = [
      'cate1', 'cate2', 'ap_subject', 'ap_content', 'recv_mail', 'link1', 'link2',
      'user_passwd', 'user_nm', 'user_email', 'user_home', 'last_login', 'ip',
      'facebook_user', 'twitter_user', 'start_date', 'start_time', 'end_date', 'end_time',
      'regist_dt', 'update_dt', 'extra_1', 'extra_2', 'extra_3', 'extra_4', 'extra_5',
      'extra_6', 'extra_7', 'extra_8', 'extra_9', 'extra_10',
    ]
    const intKeys: (keyof ApiAppPayload)[] = [
      'data_id', 'app_id', 'gr_num', 'reply_cd', 'parent_id', 'is_commt', 'co_num', 'co_reply',
      'wr_type', 'is_secret', 'link1_hit', 'link2_hit', 'hit', 'good', 'nogood', 'user_no', 'file_cnt',
    ]

    const payload = {} as ApiAppPayload
    for (const k of strKeys) {
      const v = form[k]
      ;(payload as Record<string, unknown>)[k] = v != null && v !== '' ? String(v) : ''
    }
    for (const k of intKeys) {
      const v = form[k]
      if (v != null && v !== '') {
        const n = Number(v)
        ;(payload as Record<string, unknown>)[k] = Number.isNaN(n) ? 0 : n
      } else {
        ;(payload as Record<string, unknown>)[k] = 0
      }
    }
    ;(payload as Record<string, unknown>).start_date = start
    ;(payload as Record<string, unknown>).end_date = end
    ;(payload as Record<string, unknown>).start_time = '09:00'
    ;(payload as Record<string, unknown>).end_time = '18:00'

    try {
      if (popupEditing?.data_id != null) {
        await updateAppDataApi(popupEditing.data_id, payload)
      } else {
        await createAppDataApi(payload)
      }
      setPopupOpen(false)
      setPopupEditing(null)
      await refreshList()
    } catch (error) {
      console.error('일정 저장 실패:', error)
      alert(error instanceof Error ? error.message : '일정 저장에 실패했습니다.')
    }
  }

  return (
    <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
      <TopBar />
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, backgroundColor: 'background.paper' }}>
        <Typography variant="h5" sx={{ mb: 1.5, fontWeight: 600 }}>
          할일 목록
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          캘린더와 동일한 API(app_id=6) 데이터를 그대로 노출합니다.
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 3, mb: 2 }}>
          <Button variant="contained" size="small" onClick={openCreatePopup}>
            할일등록
          </Button>
          <Button variant="outlined" size="small" color="inherit" onClick={handleDeleteSelected}>
            선택삭제
          </Button>
          <Button variant="outlined" size="small" onClick={() => void refreshList()}>
            새로고침
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">등록된 할일이 없습니다.</Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f7fb' }}>
                <TableCell padding="checkbox" sx={{ fontWeight: 600, width: 48 }}>
                  <Checkbox
                    indeterminate={selectedIds.size > 0 && selectedIds.size < items.length}
                    checked={items.length > 0 && selectedIds.size === items.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 60 }}>
                  NO
                </TableCell>
                <TableCell sx={{ fontWeight: 600, width: 90 }}>data_id</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>제목(ap_subject)</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 160 }}>진행상태(extra_2)</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 160 }}>중요도(extra_3)</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 110 }}>start_date</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 90 }}>start_time</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 110 }}>end_date</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 90 }}>end_time</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((row, index) => (
                <TableRow key={row.data_id ?? index} hover>
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={row.data_id != null && selectedIds.has(row.data_id)}
                      onChange={() => row.data_id != null && handleSelectOne(row.data_id)}
                      disabled={row.data_id == null}
                    />
                  </TableCell>
                  <TableCell align="center">{index + 1}</TableCell>
                  <TableCell>{row.data_id ?? '-'}</TableCell>
                  <TableCell
                    sx={{ cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => openEditPopup(row)}
                  >
                    {row.ap_subject ?? '-'}
                  </TableCell>
                  <TableCell>{row.extra_2 ? (progressCodeMap[row.extra_2] ?? row.extra_2) : '-'}</TableCell>
                  <TableCell>{row.extra_3 ? (importantCodeMap[row.extra_3] ?? row.extra_3) : '-'}</TableCell>
                  <TableCell>{row.start_date ?? '-'}</TableCell>
                  <TableCell>{row.start_time ?? '-'}</TableCell>
                  <TableCell>{row.end_date ?? '-'}</TableCell>
                  <TableCell>{row.end_time ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 3, mb: 2 }}>
          <Button variant="outlined" size="small" color="inherit" onClick={openCreatePopup}>
            위로이동
          </Button>
          <Button variant="outlined" size="small" color="inherit" onClick={handleDeleteSelected}>
            아래로이동
          </Button>
        </Box>

      </Paper>

      <Dialog
        open={popupOpen}
        onClose={() => {
          setPopupOpen(false)
          setPopupEditing(null)
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ pb: 0 }}>
          {popupEditing ? '일정 수정' : '새 일정 등록'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
            <TextField
              size="small"
              label="시작일"
              type="date"
              value={popupStartDate}
              onChange={(e) => setPopupStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1, minWidth: 140 }}
            />
            <TextField
              size="small"   
              label="종료일"
              type="date"
              value={popupEndDate}
              onChange={(e) => setPopupEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1, minWidth: 140 }}
            />
          </Box>
          <TextField
            size="small"
            label="제목"
            fullWidth
            value={popupTitle}
            onChange={(e) => setPopupTitle(e.target.value)}
            sx={{ mb: 2 }}
            placeholder="일정 제목을 입력하세요"
          />
          <TextField
            label="내용"
            fullWidth
            multiline
            rows={6}
            value={popupContent}
            onChange={(e) => setPopupContent(e.target.value)}
            placeholder="일정 내용을 입력하세요"
            sx={{ mb: 2 }}
          />
          <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              select
              size="small"
              label="진행상태"
              value={popupProgress}
              onChange={(e) => setPopupProgress(e.target.value)}
              sx={{ flex: 1, minWidth: 180 }}
            >
              <MenuItem value="">선택 안함</MenuItem>
              {progressOptions.map((opt) => (
                <MenuItem key={opt.codeCd} value={opt.codeCd}>
                  {opt.codeNm}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="중요도"
              value={popupImportant}
              onChange={(e) => setPopupImportant(e.target.value)}
              sx={{ flex: 1, minWidth: 180 }}
            >
              <MenuItem value="">선택 안함</MenuItem>
              {importantOptions.map((opt) => (
                <MenuItem key={opt.codeCd} value={opt.codeCd}>
                  {opt.codeNm}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button variant="outlined" size="small" onClick={() => setPopupOpen(false)}>닫기</Button>
            <Button variant="contained" size="small" onClick={() => void savePopup()}>
              저장
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  )
}

