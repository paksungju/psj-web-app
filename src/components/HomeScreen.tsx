import { useEffect, useMemo, useState } from 'react'
import { Box, Dialog, DialogContent, DialogTitle, Divider, IconButton, List, ListItem, ListItemButton, ListItemText, Menu, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, Button } from '@mui/material'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import CalendarPage from '../pages/schedule/calendar'
import TopBar from './TopBar'
import { createAppDataApi, deleteAppDataApi, fetchAppDataListApi, type ApiAppData, type ApiAppPayload, updateAppDataApi } from '../apis/appApi'
import { fetchCodesByParentApi } from '../apis/codesApi'
import { randomUUID } from '../utils/randomUUID'

interface HomeScreenProps {
  selectedMenu: string
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const TODO_APP_ID = 6
const MEMO_APP_ID = 1
const IMPORTANCE_ORDER = ['매우중요', '중요', '보통', '미미', '비중요']
const pad2 = (value: number): string => String(value).padStart(2, '0')
function normalizeDateStr(s: string | null | undefined): string {
  if (!s || !s.trim()) return ''
  const t = s.trim().replace(/-/g, '')
  if (t.length === 8) return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`
  return s
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function importanceBadgeStyle(label: string): { bg: string; color: string } {
  const normalized = label.replace(/\s/g, '')
  if (normalized === '매우중요') return { bg: '#ef4444', color: '#ffffff' }
  if (normalized === '중요') return { bg: '#f59e0b', color: '#ffffff' }
  if (normalized === '보통') return { bg: '#2563eb', color: '#ffffff' }
  if (normalized === '미미') return { bg: '#bbf7d0', color: '#14532d' }
  if (normalized === '비중요') return { bg: '#9ca3af', color: '#ffffff' }
  return { bg: '#e5e7eb', color: '#374151' }
}

function normalizeAppPayload(input: ApiAppPayload): ApiAppPayload {
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
    const v = input[k]
    ;(payload as Record<string, unknown>)[k] = v != null && v !== '' ? String(v) : ''
  }
  for (const k of intKeys) {
    const v = input[k]
    if (v != null && v !== '') {
      const n = Number(v)
      ;(payload as Record<string, unknown>)[k] = Number.isNaN(n) ? 0 : n
    } else {
      ;(payload as Record<string, unknown>)[k] = 0
    }
  }
  return payload
}
function buildCalendarDays(baseDate: Date): Array<Date | null> {
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const lastDate = new Date(year, month + 1, 0).getDate()
  const days: Array<Date | null> = []

  for (let i = 0; i < firstDay; i += 1) days.push(null)
  for (let day = 1; day <= lastDate; day += 1) days.push(new Date(year, month, day))
  while (days.length % 7 !== 0) days.push(null)

  return days
}

export default function HomeScreen({ selectedMenu }: HomeScreenProps) {
  if (selectedMenu === 'calendar') {
    return <CalendarPage />
  }

  const [baseDate, setBaseDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [clock, setClock] = useState(() => new Date())
  const [todoRows, setTodoRows] = useState<ApiAppData[]>([])
  const [progressOptions, setProgressOptions] = useState<Array<{ codeCd: string; codeNm: string }>>([])
  const [importantOptions, setImportantOptions] = useState<Array<{ codeCd: string; codeNm: string }>>([])
  const [progressCodeMap, setProgressCodeMap] = useState<Record<string, string>>({})
  const [popupOpen, setPopupOpen] = useState(false)
  const [popupEditing, setPopupEditing] = useState<ApiAppData | null>(null)
  const [popupStartDate, setPopupStartDate] = useState('')
  const [popupEndDate, setPopupEndDate] = useState('')
  const [popupTitle, setPopupTitle] = useState('')
  const [popupContent, setPopupContent] = useState('')
  const [popupProgress, setPopupProgress] = useState('')
  const [popupImportant, setPopupImportant] = useState('')
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(() => formatDateKey(new Date()))
  const [draggingTodoId, setDraggingTodoId] = useState<number | null>(null)
  const [memoRows, setMemoRows] = useState<ApiAppData[]>([])
  const [memoInput, setMemoInput] = useState('')
  const [memoLoading, setMemoLoading] = useState(true)
  const [memoSaving, setMemoSaving] = useState(false)
  const [memoMenuAnchor, setMemoMenuAnchor] = useState<HTMLElement | null>(null)
  const [memoTarget, setMemoTarget] = useState<ApiAppData | null>(null)
  const [memoModalMode, setMemoModalMode] = useState<'edit' | 'delete' | null>(null)
  const [memoEditContent, setMemoEditContent] = useState('')


  // 할일 목록 조회
  const loadTodos = async () => {
    const [items, progressCodes, importantCodes] = await Promise.all([
      fetchAppDataListApi({ app_id: TODO_APP_ID, skip: 0, limit: 200 }),
      fetchCodesByParentApi('progressCode'),
      fetchCodesByParentApi('importantCode'),
    ])
    const progressMap = Object.fromEntries(
      progressCodes.items.map((c) => [c.code_cd, c.code_nm ?? c.code_cd]),
    )
    const sorted = [...(items ?? [])].sort((a, b) => {
      const an = typeof a.nogood === 'number' ? a.nogood : Number(a.nogood ?? 999999)
      const bn = typeof b.nogood === 'number' ? b.nogood : Number(b.nogood ?? 999999)
      return (Number.isNaN(an) ? 999999 : an) - (Number.isNaN(bn) ? 999999 : bn)
    })
    setTodoRows(sorted)
    setProgressCodeMap(progressMap)
    setProgressOptions(progressCodes.items.map((row) => ({ codeCd: row.code_cd, codeNm: row.code_nm ?? row.code_cd })))
    setImportantOptions(importantCodes.items.map((row) => ({ codeCd: row.code_cd, codeNm: row.code_nm ?? row.code_cd })))
  }

  const loadMemos = async () => {
    setMemoLoading(true)
    try {
      const items = await fetchAppDataListApi({ app_id: MEMO_APP_ID, skip: 0, limit: 50 })
      const sorted = [...(items ?? [])].sort((a, b) => (b.data_id ?? 0) - (a.data_id ?? 0))
      setMemoRows(sorted)
    } catch (error) {
      console.error('홈 메모 목록 조회 오류:', error)
      setMemoRows([])
    } finally {
      setMemoLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await loadTodos()
        await loadMemos()
        if (cancelled) return
      } catch (error) {
        console.error('홈 할일 목록 조회 오류:', error)
        if (!cancelled) setTodoRows([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(new Date())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const days = useMemo(() => buildCalendarDays(baseDate), [baseDate])

  // 캘린더 캘린더 날짜 필터링
  const visibleTodoRows = useMemo(() => {
    if (!selectedDateKey) return todoRows
    return todoRows.filter((row) => {
      const key = normalizeDateStr(row.end_date || row.start_date)
      return key === selectedDateKey
    })
  }, [selectedDateKey, todoRows])
  const inProgressTodoRows = useMemo(
    () =>
      todoRows.filter((row) => {
        const raw = row.extra_2 ?? ''
        const statusName = progressCodeMap[raw] ?? raw
        return statusName === '진행중' || statusName === '등록'
      }),
    [todoRows, progressCodeMap],
  )


  const todoImportanceByDate = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const row of todoRows) {
      const raw = row.end_date || row.start_date
      const normalized = normalizeDateStr(raw)
      if (!normalized) continue
      const label = row.extra_3
        ? (importantOptions.find((opt) => opt.codeCd === row.extra_3)?.codeNm ?? row.extra_3)
        : '미분류'
      const current = map.get(normalized) ?? []
      current.push(label)
      map.set(normalized, current)
    }
    return map
  }, [todoRows, importantOptions])
  const today = clock
  const meridiem = today.getHours() >= 12 ? 'PM' : 'AM'
  const hour12 = today.getHours() % 12 || 12
  const todayDateLabel = `${today.getFullYear()}.${pad2(today.getMonth() + 1)}.${pad2(today.getDate())} ${meridiem}`
  const todayTimeLabel = `${pad2(hour12)}:${pad2(today.getMinutes())} ${pad2(today.getSeconds())}`

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
    const defaultDate = selectedDateKey ?? formatDateKey(new Date())
    setPopupEditing(null)
    setPopupStartDate(defaultDate)
    setPopupEndDate(defaultDate)
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
    const payload = normalizeAppPayload(form)
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
      await loadTodos()
    } catch (error) {
      console.error('일정 저장 실패:', error)
      alert(error instanceof Error ? error.message : '일정 저장에 실패했습니다.')
    }
  }

  const persistTodoOrder = async (rows: ApiAppData[]) => {
    await Promise.all(
      rows.map((row, index) =>
        row.data_id != null
          ? updateAppDataApi(
              row.data_id,
              normalizeAppPayload({
                ...row,
                app_id: row.app_id ?? TODO_APP_ID,
                nogood: index + 1,
              }),
            )
          : Promise.resolve(null),
      ),
    )
  }

  const handleDropTodo = async (targetId: number | undefined) => {
    if (draggingTodoId == null || targetId == null || draggingTodoId === targetId) return
    const fromIndex = todoRows.findIndex((r) => r.data_id === draggingTodoId)
    const toIndex = todoRows.findIndex((r) => r.data_id === targetId)
    if (fromIndex < 0 || toIndex < 0) return

    const next = [...todoRows]
    const [moved] = next.splice(fromIndex, 1)
    if (!moved) return
    next.splice(toIndex, 0, moved)
    setTodoRows(next)
    setDraggingTodoId(null)

    try {
      await persistTodoOrder(next)
    } catch (error) {
      console.error('할일 순서 저장 오류:', error)
      alert('순서 저장에 실패했습니다.')
      await loadTodos()
    }
  }

  const handleCreateMemo = async () => {
    const text = memoInput.trim()
    if (!text) return
    setMemoSaving(true)
    try {
      const payload = normalizeAppPayload({
        app_id: MEMO_APP_ID,
        ap_subject: text,
        ap_content: text,
        extra_1: randomUUID(),
      })
      await createAppDataApi(payload)
      setMemoInput('')
      await loadMemos()
    } catch (error) {
      console.error('메모 저장 실패:', error)
      alert(error instanceof Error ? error.message : '메모 저장에 실패했습니다.')
    } finally {
      setMemoSaving(false)
    }
  }

  const openMemoMenu = (event: React.MouseEvent<HTMLElement>, row: ApiAppData) => {
    event.stopPropagation()
    setMemoMenuAnchor(event.currentTarget)
    setMemoTarget(row)
  }

  const closeMemoMenu = () => {
    setMemoMenuAnchor(null)
  }

  const openMemoEditModal = () => {
    if (!memoTarget) return
    setMemoEditContent(memoTarget.ap_content ?? '')
    setMemoModalMode('edit')
    closeMemoMenu()
  }

  const openMemoDeleteModal = () => {
    if (!memoTarget) return
    setMemoModalMode('delete')
    closeMemoMenu()
  }

  const closeMemoModal = () => {
    setMemoModalMode(null)
    setMemoTarget(null)
    setMemoEditContent('')
  }

  const saveMemoEdit = async () => {
    if (!memoTarget?.data_id) return
    const content = memoEditContent.trim()
    if (!content) {
      alert('내용을 입력해 주세요.')
      return
    }
    setMemoSaving(true)
    try {
      const payload = normalizeAppPayload({
        ...memoTarget,
        app_id: MEMO_APP_ID,
        ap_subject: content,
        ap_content: content,
      })
      await updateAppDataApi(memoTarget.data_id, payload)
      await loadMemos()
      closeMemoModal()
    } catch (error) {
      console.error('메모 수정 실패:', error)
      alert(error instanceof Error ? error.message : '메모 수정에 실패했습니다.')
    } finally {
      setMemoSaving(false)
    }
  }

  const deleteMemo = async () => {
    if (!memoTarget?.data_id) return
    setMemoSaving(true)
    try {
      await deleteAppDataApi(memoTarget.data_id)
      await loadMemos()
      closeMemoModal()
    } catch (error) {
      console.error('메모 삭제 실패:', error)
      alert(error instanceof Error ? error.message : '메모 삭제에 실패했습니다.')
    } finally {
      setMemoSaving(false)
    }
  }

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

       {/* --------------------------- 캘린더  --------------------------- */}
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
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr 1fr' },
            gap: 2,
            alignItems: 'start',
            width: '100%',
            minHeight: '55vh',
          }}
        >
          <Box sx={{ textAlign: 'left' }}>
            <Typography
              variant="body2"
              sx={{ mb: 1, color: 'text.secondary', fontWeight: 600, letterSpacing: 0.2, fontSize: 20 }}
            >
              <AccessTimeIcon sx={{ fontSize: 22, verticalAlign: 'text-bottom', mr: 0.6 }} />
              {`${todayDateLabel} `}
              <Box component="span" sx={{ color: 'primary.main' }}>
                {todayTimeLabel}
              </Box>
            </Typography>

            <Paper
              elevation={1}
              sx={{
                width: '100%',
                p: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 1.5,
                }}
              >
                <Typography
                  component="button"
                  onClick={() => {
                    setBaseDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                  }}
                  sx={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: 18,
                    cursor: 'pointer',
                    color: 'text.secondary',
                  }}
                >
                  {'<'}
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {`${baseDate.getFullYear()}년 ${baseDate.getMonth() + 1}월`}
                </Typography>
                <Typography
                  component="button"
                  onClick={() => {
                    setBaseDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                  }}
                  sx={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: 18,
                    cursor: 'pointer',
                    color: 'text.secondary',
                  }}
                >
                  {'>'}
                </Typography>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gridAutoRows: '44px',
                  gap: 0.5,
                }}
              >
                {WEEKDAY_LABELS.map((label, dayIdx) => (
                  <Typography
                    key={label}
                    variant="caption"
                    sx={{
                      textAlign: 'center',
                      color: dayIdx === 0 ? '#d32f2f' : dayIdx === 6 ? '#1976d2' : 'text.secondary',
                      fontWeight: 600,
                    }}
                  >
                    {label}
                  </Typography>
                ))}
                {days.map((date, idx) => {
                  const dayIdx = idx % 7
                  const isToday =
                    !!date &&
                    date.getFullYear() === today.getFullYear() &&
                    date.getMonth() === today.getMonth() &&
                    date.getDate() === today.getDate()
                  const weekendTextColor =
                    dayIdx === 0 ? '#d32f2f' : dayIdx === 6 ? '#1976d2' : 'text.primary'

                  const dateKey = date ? formatDateKey(date) : ''
                  const importanceBands = date
                    ? (() => {
                        const values = [...(todoImportanceByDate.get(dateKey) ?? [])]
                        return values.sort((a, b) => {
                          const ai = IMPORTANCE_ORDER.indexOf(a)
                          const bi = IMPORTANCE_ORDER.indexOf(b)
                          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
                        })
                      })()
                    : []
                  const isSelectedDate = !!date && selectedDateKey === dateKey

                  return (
                    <Box
                      key={`${date?.toISOString() ?? 'empty'}-${idx}`}
                      onClick={date ? () => setSelectedDateKey(dateKey) : undefined}
                      sx={{
                        height: 44,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 1,
                        fontSize: 13,
                        fontWeight: isToday ? 700 : 500,
                        color: isToday ? '#2563eb' : weekendTextColor,
                        cursor: date ? 'pointer' : 'default',
                        outline: isSelectedDate ? '2px solid #2563eb' : 'none',
                        outlineOffset: -1,
                      }}
                    >
                      {date ? (
                        <Box
                          sx={{
                            width: '100%',
                            height: 44,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 0,
                          }}
                        >
                          <Box
                            component="span"
                            sx={{
                              lineHeight: 1,
                              height: 16,
                              px: isToday ? 0.75 : 0,
                              py: isToday ? 0.25 : 0,
                              borderRadius: isToday ? 1 : 0,
                              backgroundColor: isToday ? '#2563eb' : 'transparent',
                              color: isToday ? '#ffffff' : 'inherit',
                            }}
                          >
                            {date.getDate()}
                          </Box>
                          <Box
                            sx={{
                              minHeight: 12,
                              width: '75%',
                              display: 'grid',
                              gridAutoRows: '2px',
                              rowGap: '2px',
                              alignContent: 'start',
                              overflow: 'hidden',
                              visibility: importanceBands.length > 0 ? 'visible' : 'hidden',
                            }}
                          >
                            {importanceBands.map((label) => (
                              <Box
                                key={`${dateKey}-${label}`}
                                component="span"
                                sx={{
                                  display: 'block',
                                  width: '100%',
                                  height: 2,
                                  borderRadius: 1,
                                  backgroundColor: importanceBadgeStyle(label).bg,
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      ) : ''}
                    </Box>
                  )
                })}
              </Box>
            </Paper>
           {/* --------------------------- 할일목록 --------------------------- */}
            <Paper sx={{ p: 2, mt: 2, width: '100%', maxWidth: '100%' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {selectedDateKey ? `할일목록 (${selectedDateKey})` : '할일목록'}
                </Typography>
                <Typography
                  component="button"
                  onClick={openCreatePopup}
                  sx={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: 22,
                    lineHeight: 1,
                    cursor: 'pointer',
                    color: 'text.secondary',
                    px: 0.5,
                  }}
                  aria-label="할일 추가"
                >
                  +
                </Typography>
              </Stack>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f7fb' }}>
                    <TableCell sx={{ fontWeight: 600 }}>항목</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>DATE</TableCell>
                    <TableCell sx={{ fontWeight: 600 }} align="center">
                      중요도
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleTodoRows.map((row, index) => (
                    <TableRow key={row.data_id ?? `${row.ap_subject ?? 'todo'}-${index}`} hover sx={{ cursor: 'pointer' }}>
                      <TableCell
                        sx={{ cursor: 'pointer' }}
                        onClick={() => openEditPopup(row)}
                      >
                        {row.ap_subject ?? '-'}
                      </TableCell>
                      <TableCell>{row.end_date ?? row.start_date ?? '-'}</TableCell>
                      <TableCell align="center">
                        {(() => {
                          const label = row.extra_3
                            ? (importantOptions.find((opt) => opt.codeCd === row.extra_3)?.codeNm ?? row.extra_3)
                            : '-'
                          const style = importanceBadgeStyle(label)
                          return (
                            <Typography
                              component="span"
                              sx={{
                                fontSize: 12,
                                fontWeight: 700,
                                lineHeight: 1.4,
                                color: style.bg,
                              }}
                            >
                              {label}
                            </Typography>
                          )
                        })()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {visibleTodoRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} sx={{ color: 'text.secondary' }}>
                        {selectedDateKey ? '선택한 날짜의 할일이 없습니다.' : '노출할 할일이 없습니다.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Paper>
          </Box>

          <Paper
            elevation={0}
            sx={{
              minHeight: 520,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              p: 2,
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              할일목록 (리스트형)
            </Typography>
            <List sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }} component="nav" aria-label="todo list">
              {inProgressTodoRows.length === 0 ? (
                <ListItem>
                  <ListItemText primary="등록/진행중인 할일이 없습니다." />
                </ListItem>
              ) : (
                inProgressTodoRows.map((row, index) => (
                  <Box
                    key={row.data_id ?? `${row.ap_subject ?? 'todo'}-list-${index}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => void handleDropTodo(row.data_id)}
                    sx={{
                      opacity: draggingTodoId === row.data_id ? 0.5 : 1,
                    }}
                  >
                    <ListItem disablePadding>
                      <ListItemButton onClick={() => openEditPopup(row)}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                              <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {row.ap_subject ?? '(제목 없음)'}
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                                {(() => {
                                  const label = row.extra_3
                                    ? (importantOptions.find((opt) => opt.codeCd === row.extra_3)?.codeNm ?? row.extra_3)
                                    : '-'
                                  const style = importanceBadgeStyle(label)
                                  return (
                                    <Box
                                      component="span"
                                      sx={{
                                        display: 'inline-block',
                                        px: 1,
                                        py: 0.2,
                                        borderRadius: 1,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        lineHeight: 1.35,
                                        backgroundColor: style.bg,
                                        color: style.color,
                                        flexShrink: 0,
                                      }}
                                    >
                                      {label}
                                    </Box>
                                  )
                                })()}
                                <Box
                                  component="span"
                                  draggable={row.data_id != null}
                                  onDragStart={(e) => {
                                    e.stopPropagation()
                                    setDraggingTodoId(row.data_id ?? null)
                                  }}
                                  onDragEnd={() => setDraggingTodoId(null)}
                                  onClick={(e) => e.stopPropagation()}
                                  sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'text.secondary',
                                    cursor: 'grab',
                                  }}
                                  title="드래그해서 순서 변경"
                                >
                                  <DragIndicatorIcon fontSize="small" />
                                </Box>
                              </Box>
                            </Box>
                          }
                          secondary={
                            <Box sx={{ mt: 0.25 }}>{row.end_date ?? row.start_date ?? '-'}</Box>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                    {index < inProgressTodoRows.length - 1 && <Divider />}
                  </Box>
                ))
              )}
            </List>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              minHeight: 520,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              p: 2,
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              메모장
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="메모를 입력하세요"
                value={memoInput}
                onChange={(e) => setMemoInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleCreateMemo()
                  }
                }}
              />
              <Button
                size="small"
                variant="contained"
                onClick={() => void handleCreateMemo()}
                disabled={memoSaving || !memoInput.trim()}
              >
                등록
              </Button>
            </Stack>
            <Paper variant="outlined" sx={{ maxHeight: 430, overflow: 'auto' }}>
              <List dense disablePadding>
                {memoLoading ? (
                  <ListItem>
                    <ListItemText primary="불러오는 중..." />
                  </ListItem>
                ) : memoRows.length === 0 ? (
                  <ListItem>
                    <ListItemText primary="등록된 메모가 없습니다." />
                  </ListItem>
                ) : (
                  memoRows.map((row, index) => (
                    <Box key={row.data_id ?? `memo-${index}`}>
                      <ListItem
                        alignItems="flex-start"
                        sx={{
                          '&:hover .memo-more-btn': { opacity: 1 },
                        }}
                      >
                        <ListItemText
                          primary={row.ap_subject || '(제목 없음)'}
                          secondary={(
                            <Box sx={{ mt: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                {row.regist_dt ? formatDateKey(new Date(row.regist_dt)) : '-'}
                              </Typography>
                            </Box>
                          )}
                        />
                        <IconButton
                          className="memo-more-btn"
                          size="small"
                          sx={{
                            opacity: 0,
                            transition: 'opacity 0.2s',
                            color: 'text.secondary',
                          }}
                          onClick={(e) => openMemoMenu(e, row)}
                        >
                          <MoreHorizIcon fontSize="small" />
                        </IconButton>
                      </ListItem>
                      {index < memoRows.length - 1 && <Divider />}
                    </Box>
                  ))
                )}
              </List>
            </Paper>
          </Paper>
          <Menu
            anchorEl={memoMenuAnchor}
            open={Boolean(memoMenuAnchor)}
            onClose={closeMemoMenu}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem dense onClick={openMemoEditModal}>수정</MenuItem>
            <MenuItem dense onClick={openMemoDeleteModal}>삭제</MenuItem>
          </Menu>
          <Dialog open={memoModalMode !== null} onClose={closeMemoModal} maxWidth="sm" fullWidth>
            <DialogTitle>
              {memoModalMode === 'edit' ? '메모 수정' : '메모 삭제'}
            </DialogTitle>
            <DialogContent>
              {memoModalMode === 'edit' ? (
                <Stack spacing={1.5} sx={{ mt: 0.5 }}>
                  <TextField
                    size="small"
                    label="내용"
                    fullWidth
                    multiline
                    rows={4}
                    value={memoEditContent}
                    onChange={(e) => setMemoEditContent(e.target.value)}
                  />
                </Stack>
              ) : (
                <Typography sx={{ mt: 1 }}>
                  선택한 메모를 삭제하시겠습니까?
                </Typography>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                <Button size="small" variant="outlined" onClick={closeMemoModal} disabled={memoSaving}>
                  취소
                </Button>
                {memoModalMode === 'edit' ? (
                  <Button size="small" variant="contained" onClick={() => void saveMemoEdit()} disabled={memoSaving}>
                    {memoSaving ? '저장 중...' : '수정'}
                  </Button>
                ) : (
                  <Button size="small" variant="contained" color="error" onClick={() => void deleteMemo()} disabled={memoSaving}>
                    {memoSaving ? '삭제 중...' : '삭제'}
                  </Button>
                )}
              </Box>
            </DialogContent>
          </Dialog>
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
                rows={4}
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
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                <Button variant="outlined" size="small" onClick={() => setPopupOpen(false)}>취소</Button>
                <Button variant="contained" size="small" onClick={() => void savePopup()}>
                  저장
                </Button>
              </Box>
            </DialogContent>
          </Dialog>
        
        </Box>
      </Paper>
    </Box>
  )
}
