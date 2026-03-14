import { useEffect, useState, useCallback } from 'react'
import { Box, Paper, Typography, Button, Dialog, DialogTitle, DialogContent, TextField } from '@mui/material'
import { fetchAppDataListApi, createAppDataApi, updateAppDataApi, type ApiAppPayload } from '../../apis/appApi'

const CALENDAR_APP_ID = 6

type ScheduleCategory = 'meeting' | 'task' | 'event' | 'reminder'
type SchedulePriority = 'high' | 'medium' | 'low'
type ScheduleStatus = 'scheduled' | 'completed' | 'cancelled'

interface Schedule {
  id: number
  title: string
  description: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  category: ScheduleCategory
  priority: SchedulePriority
  status: ScheduleStatus
  location?: string
  attendees?: string[]
}

/** YYYYMMDD(8자) → YYYY-MM-DD 변환 (DB VARCHAR(8) 저장 형식) */
function normalizeDateStr(s: string | null | undefined): string {
  if (!s || !s.trim()) return ''
  const t = s.trim().replace(/-/g, '')
  if (t.length === 8) return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`
  return s
}

/** ApiAppData → Schedule 변환 (start_date, end_date, start_time, end_time 컬럼 사용) */
function appDataToSchedule(item: {
  data_id?: number
  ap_subject?: string | null
  ap_content?: string | null
  start_date?: string | null
  end_date?: string | null
  start_time?: string | null
  end_time?: string | null
  extra_1?: string | null
}): Schedule {
  const category = (item.extra_1 as ScheduleCategory) || 'task'
  return {
    id: item.data_id ?? 0,
    title: item.ap_subject ?? '',
    description: item.ap_content ?? '',
    startDate: normalizeDateStr(item.start_date) || '',
    endDate: normalizeDateStr(item.end_date) || '',
    startTime: item.start_time ?? '09:00',
    endTime: item.end_time ?? '18:00',
    category,
    priority: 'medium',
    status: 'scheduled',
  }
}

type ViewMode = 'month' | 'week' | 'list'

function getCategoryColor(category: ScheduleCategory) {
  const colors: Record<ScheduleCategory, { bg: string; text: string }> = {
    meeting: { bg: '#dbeafe', text: '#1e40af' },
    task: { bg: '#dcfce7', text: '#166534' },
    event: { bg: '#fef3c7', text: '#92400e' },
    reminder: { bg: '#fee2e2', text: '#dc2626' },
  }
  return colors[category]
}

function getPriorityColor(priority: SchedulePriority) {
  const colors: Record<SchedulePriority, string> = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#10b981',
  }
  return colors[priority]
}

function getStatusBadge(status: ScheduleStatus) {
  const statusMap: Record<ScheduleStatus, { bg: string; text: string; label: string }> = {
    scheduled: { bg: '#dbeafe', text: '#1e40af', label: '예정' },
    completed: { bg: '#dcfce7', text: '#166534', label: '완료' },
    cancelled: { bg: '#fee2e2', text: '#dc2626', label: '취소' },
  }

  const s = statusMap[status]
  return (
    <span
      style={{
        backgroundColor: s.bg,
        color: s.text,
        padding: '0.25rem 0.5rem',
        borderRadius: '0.25rem',
        fontSize: '0.75rem',
      }}
    >
      {s.label}
    </span>
  )
}

function isDateInRange(dateStr: string, start: string, end: string): boolean {
  return dateStr >= start && dateStr <= end
}

export default function CalendarPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')

  // 드래그 선택
  const [dragStart, setDragStart] = useState<string | null>(null)
  const [dragEnd, setDragEnd] = useState<string | null>(null)
  const isDragging = dragStart !== null

  // 팝업 (시작일, 종료일, 제목, 내용 폼)
  const [popupOpen, setPopupOpen] = useState(false)
  const [popupRange, setPopupRange] = useState<{ start: string; end: string } | null>(null)
  const [popupEditingSchedule, setPopupEditingSchedule] = useState<Schedule | null>(null)
  const [popupStartDate, setPopupStartDate] = useState('')
  const [popupEndDate, setPopupEndDate] = useState('')
  const [popupTitle, setPopupTitle] = useState('')
  const [popupContent, setPopupContent] = useState('')

  useEffect(() => {
    if (popupRange && !popupEditingSchedule) {
      setPopupStartDate(popupRange.start)
      setPopupEndDate(popupRange.end)
      setPopupTitle('')
      setPopupContent('')
    }
  }, [popupRange, popupEditingSchedule])

  const handleScheduleClick = useCallback((schedule: Schedule, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setPopupEditingSchedule(schedule)
    setPopupStartDate(schedule.startDate)
    setPopupEndDate(schedule.endDate)
    setPopupTitle(schedule.title)
    setPopupContent(schedule.description)
    setPopupOpen(true)
  }, [])

  const selectedStart = dragStart && dragEnd ? (dragStart <= dragEnd ? dragStart : dragEnd) : dragStart
  const selectedEnd = dragStart && dragEnd ? (dragStart <= dragEnd ? dragEnd : dragStart) : dragStart

  const handleCellMouseDown = useCallback((dateStr: string) => {
    setDragStart(dateStr)
    setDragEnd(dateStr)
  }, [])

  const handleCellMouseEnter = useCallback(
    (dateStr: string) => {
      if (isDragging && dragStart) {
        setDragEnd(dateStr)
      }
    },
    [isDragging, dragStart],
  )

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAppDataListApi({ skip: 0, limit: 500, app_id: CALENDAR_APP_ID })
      setSchedules((data ?? []).map(appDataToSchedule))
    } catch (e) {
      console.error('일정 로드 실패:', e)
      setSchedules([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])

  useEffect(() => {
    if (!isDragging) return
    const onGlobalMouseUp = () => {
      if (dragStart && dragEnd) {
        const start = dragStart <= dragEnd ? dragStart : dragEnd
        const end = dragStart <= dragEnd ? dragEnd : dragStart
        setPopupEditingSchedule(null)
        setPopupRange({ start, end })
        setPopupOpen(true)
      }
      setDragStart(null)
      setDragEnd(null)
    }
    window.addEventListener('mouseup', onGlobalMouseUp)
    return () => window.removeEventListener('mouseup', onGlobalMouseUp)
  }, [isDragging, dragStart, dragEnd])

  const generateCalendar = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days: Array<
      | null
      | {
          day: number
          dateStr: string
          schedules: Schedule[]
          isNextMonth?: boolean
        }
    > = []

    for (let i = 0; i < startingDayOfWeek; i += 1) {
      days.push(null)
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const daySchedules = schedules.filter(
        (schedule) => schedule.startDate <= dateStr && schedule.endDate >= dateStr,
      )
      days.push({ day, dateStr, schedules: daySchedules })
    }

    // 빈 칸을 다음달 시작일로 채움
    const totalSoFar = startingDayOfWeek + daysInMonth
    const remainder = totalSoFar % 7
    const cellsToFill = remainder === 0 ? 0 : 7 - remainder

    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year

    for (let day = 1; day <= cellsToFill; day += 1) {
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const daySchedules = schedules.filter(
        (schedule) => schedule.startDate <= dateStr && schedule.endDate >= dateStr,
      )
      days.push({ day, dateStr, schedules: daySchedules, isNextMonth: true })
    }

    return days
  }

  const generateWeekView = () => {
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())

    const weekDays: Array<{
      date: Date
      dateStr: string
      schedules: Schedule[]
    }> = []

    for (let i = 0; i < 7; i += 1) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      const dateStr = day.toISOString().split('T')[0] as string
      const daySchedules = schedules.filter(
        (schedule) => schedule.startDate <= dateStr && schedule.endDate >= dateStr,
      )
      weekDays.push({ date: day, dateStr, schedules: daySchedules })
    }

    return weekDays
  }

  const renderMonthView = () => {
    const calendarDays = generateCalendar()
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']

    return (
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            backgroundColor: '#f9fafb',
          }}
        >
          {weekdays.map((day) => (
            <div
              key={day}
              style={{
                padding: '0.75rem',
                textAlign: 'center',
                fontWeight: 600,
                borderRight: '1px solid #e5e7eb',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              {day}
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gridAutoRows: 'minmax(110px, auto)',
            userSelect: isDragging ? 'none' : 'auto',
            borderTop: '1px solid #e5e7eb',
          }}
        >
          {calendarDays.map((dayData, index) => {
            const isSelected =
              dayData &&
              selectedStart &&
              selectedEnd &&
              isDateInRange(dayData.dateStr, selectedStart, selectedEnd)
            const lastRowStartIndex = (Math.ceil(calendarDays.length / 7) - 1) * 7
            const showBottomBorder = index < lastRowStartIndex
            return (
            <div
              key={index}
              style={{
                minHeight: 110,
                padding: '0.5rem',
                borderRight: index % 7 !== 6 ? '1px solid #e5e7eb' : 'none',
                borderBottom: showBottomBorder ? '1px solid #e5e7eb' : 'none',
                backgroundColor: isSelected
                  ? 'rgba(59, 130, 246, 0.2)'
                  : dayData
                    ? dayData.isNextMonth
                      ? '#f3f4f6'
                      : 'white'
                    : '#f9fafb',
                cursor: dayData ? (isDragging ? 'crosshair' : 'pointer') : 'default',
                transition: 'background-color 0.15s ease',
                overflow: 'hidden',
              }}
              onMouseDown={dayData ? () => handleCellMouseDown(dayData.dateStr) : undefined}
              onMouseEnter={dayData ? () => handleCellMouseEnter(dayData.dateStr) : undefined}
            >
              {dayData && (
                <>
                  <div
                    style={{
                      fontWeight: 500,
                      marginBottom: '0.35rem',
                      color: dayData.isNextMonth
                        ? '#9ca3af'
                        : new Date(dayData.dateStr).toDateString() ===
                            new Date().toDateString()
                          ? '#3b82f6'
                          : '#374151',
                    }}
                  >
                    {dayData.day}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      minHeight: 0,
                    }}
                  >
                    {dayData.schedules.slice(0, 3).map((schedule) => {
                      const categoryColor = getCategoryColor(schedule.category)
                      return (
                        <div
                          key={schedule.id}
                          role="button"
                          tabIndex={0}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => handleScheduleClick(schedule, e)}
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.25rem 0.35rem',
                            backgroundColor: categoryColor.bg,
                            color: categoryColor.text,
                            borderRadius: '0.25rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                          }}
                        >
                          {schedule.title}
                        </div>
                      )
                    })}
                    {dayData.schedules.length > 3 && (
                      <div
                        style={{
                          fontSize: '0.7rem',
                          color: '#6b7280',
                          textAlign: 'center',
                        }}
                      >
                        +{dayData.schedules.length - 3}개 더
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
        </div>
      </div>
    )
  }

  const renderWeekView = () => {
    const weekDays = generateWeekView()

    return (
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
          }}
        >
          {weekDays.map((dayData, index) => (
            <div
              key={index}
              style={{
                minHeight: 260,
                padding: '0.85rem',
                borderRight: index < 6 ? '1px solid #e5e7eb' : 'none',
                backgroundColor: 'white',
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: '0.75rem',
                  color:
                    dayData.date.toDateString() === new Date().toDateString()
                      ? '#3b82f6'
                      : '#374151',
                }}
              >
                {dayData.date.toLocaleDateString('ko-KR', {
                  weekday: 'short',
                  day: 'numeric',
                })}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {dayData.schedules.map((schedule) => {
                  const categoryColor = getCategoryColor(schedule.category)
                  return (
                    <div
                      key={schedule.id}
                      role="button"
                      tabIndex={0}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => handleScheduleClick(schedule, e)}
                      style={{
                        fontSize: '0.85rem',
                        padding: '0.5rem',
                        backgroundColor: categoryColor.bg,
                        color: categoryColor.text,
                        borderRadius: '0.25rem',
                        border: `2px solid ${getPriorityColor(schedule.priority)}`,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>
                        {schedule.startTime} {schedule.title}
                      </div>
                      {schedule.location && (
                        <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                          📍 {schedule.location}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderListView = () => {
    const sortedSchedules = [...schedules].sort((a, b) => {
      const dateA = new Date(`${a.startDate} ${a.startTime}`)
      const dateB = new Date(`${b.startDate} ${b.startTime}`)
      return dateA.getTime() - dateB.getTime()
    })

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        {sortedSchedules.map((schedule) => {
          const categoryColor = getCategoryColor(schedule.category)
          return (
            <div
              key={schedule.id}
              role="button"
              tabIndex={0}
              onClick={(e) => handleScheduleClick(schedule, e)}
              style={{
                padding: '1rem',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                borderLeft: `4px solid ${getPriorityColor(schedule.priority)}`,
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                }}
              >
                <h4
                  style={{
                    margin: 0,
                    fontSize: '1.05rem',
                    fontWeight: 600,
                  }}
                >
                  {schedule.title}
                </h4>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: categoryColor.bg,
                      color: categoryColor.text,
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                    }}
                  >
                    {schedule.category}
                  </span>
                  {getStatusBadge(schedule.status)}
                </div>
              </div>
              <div
                style={{
                  color: '#6b7280',
                  fontSize: '0.85rem',
                  marginBottom: '0.35rem',
                }}
              >
                📅 {schedule.startDate} {schedule.startTime} - {schedule.endTime}
                {schedule.location && <span> 📍 {schedule.location}</span>}
              </div>
              <div
                style={{
                  color: '#374151',
                  fontSize: '0.9rem',
                }}
              >
                {schedule.description}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1))
      return newDate
    })
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      newDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7))
      return newDate
    })
  }

  const weekDaysForLabel = viewMode === 'week' ? generateWeekView() : []

  const monthLabel =
    viewMode === 'week' && weekDaysForLabel.length === 7
      ? `${weekDaysForLabel[0]!.date.toLocaleDateString('ko-KR', {
          month: 'short',
          day: 'numeric',
        })} - ${weekDaysForLabel[6]!.date.toLocaleDateString('ko-KR', {
          month: 'short',
          day: 'numeric',
        })}`
      : currentDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })

  return (
    <Box
      sx={{
        flexGrow: 1,
        overflow: 'auto',
        p: 3,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 4,
          borderRadius: 3,
          backgroundColor: 'background.paper',
          minHeight: '100%',
        }}
      >
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
          스케줄 / 캘린더
        </Typography>

        <Box
          sx={{
            mb: 3,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() =>
                  viewMode === 'month' ? navigateMonth('prev') : navigateWeek('prev')
                }
              >
                ←
              </Button>
              <Typography
                variant="h6"
                sx={{
                  minWidth: 200,
                  textAlign: 'center',
                  fontWeight: 600,
                }}
              >
                {monthLabel}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() =>
                  viewMode === 'month' ? navigateMonth('next') : navigateWeek('next')
                }
              >
                →
              </Button>
              <Button
                variant="contained"
                size="small"
                color="inherit"
                onClick={() => setCurrentDate(new Date())}
                sx={{ ml: 1 }}
              >
                오늘
              </Button>
            </Box>

            <Box
              sx={{
                display: 'flex',
                border: '1px solid #e5e7eb',
                borderRadius: 1,
                overflow: 'hidden',
                ml: 2,
              }}
            >
              {(['month', 'week', 'list'] as ViewMode[]).map((mode) => (
                <Button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  sx={{
                    px: 2,
                    py: 0.5,
                    fontSize: 14,
                    borderRadius: 0,
                    backgroundColor:
                      viewMode === mode ? 'primary.main' : 'background.paper',
                    color: viewMode === mode ? 'common.white' : 'text.primary',
                    '&:not(:last-of-type)': {
                      borderRight: '1px solid #e5e7eb',
                    },
                    '&:hover': {
                      backgroundColor:
                        viewMode === mode ? 'primary.dark' : 'action.hover',
                    },
                  }}
                >
                  {mode === 'month' ? '월' : mode === 'week' ? '주' : '목록'}
                </Button>
              ))}
            </Box>
          </Box>
        </Box>

        {loading ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              color: 'text.secondary',
            }}
          >
            일정을 불러오는 중...
          </Box>
        ) : (
          <>
            {viewMode === 'month' && renderMonthView()}
            {viewMode === 'week' && renderWeekView()}
            {viewMode === 'list' && renderListView()}
          </>
        )}

        <Dialog
          open={popupOpen}
          onClose={() => {
            setPopupOpen(false)
            setPopupRange(null)
            setPopupEditingSchedule(null)
          }}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 2 } }}
        >
          <DialogTitle sx={{ pb: 0 }}>
            {popupEditingSchedule ? '일정 수정' : '새 일정 등록'}
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            {(popupRange || popupEditingSchedule) && (
              <>
                <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <TextField
                    label="시작일"
                    type="date"
                    value={popupStartDate}
                    onChange={(e) => setPopupStartDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1, minWidth: 140 }}
                  />
                  <TextField
                    label="종료일"
                    type="date"
                    value={popupEndDate}
                    onChange={(e) => setPopupEndDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1, minWidth: 140 }}
                  />
                </Box>
                <TextField
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
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                  <Button onClick={() => setPopupOpen(false)}>취소</Button>
                  <Button
                    variant="contained"
                    onClick={async () => {
                      if (!popupTitle.trim() || !popupStartDate || !popupEndDate) return
                      const start = popupStartDate <= popupEndDate ? popupStartDate : popupEndDate
                      const end = popupStartDate <= popupEndDate ? popupEndDate : popupStartDate
                      const form = {
                        ap_subject: popupTitle.trim(),
                        ap_content: popupContent.trim(),
                        app_id: CALENDAR_APP_ID,
                        start_date: start,
                        end_date: end,
                        start_time: '09:00',
                        end_time: '18:00',
                        extra_1: popupEditingSchedule?.category ?? 'task',
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
                        if (popupEditingSchedule) {
                          await updateAppDataApi(popupEditingSchedule.id, payload)
                          const updated = appDataToSchedule({
                            ...payload,
                            data_id: popupEditingSchedule.id,
                            start_date: start,
                            end_date: end,
                            start_time: '09:00',
                            end_time: '18:00',
                          })
                          setSchedules((prev) =>
                            prev.map((s) => (s.id === popupEditingSchedule.id ? updated : s)),
                          )
                        } else {
                          const created = await createAppDataApi(payload)
                          const newSchedule = appDataToSchedule({
                            ...created,
                            start_date: start,
                            end_date: end,
                            start_time: '09:00',
                            end_time: '18:00',
                          })
                          setSchedules((prev) => [...prev, newSchedule])
                        }
                        setPopupOpen(false)
                        setPopupRange(null)
                        setPopupEditingSchedule(null)
                        setPopupTitle('')
                        setPopupContent('')
                      } catch (e) {
                        console.error('일정 저장 실패:', e)
                        alert(e instanceof Error ? e.message : '일정 저장에 실패했습니다.')
                      }
                    }}
                  >
                    저장
                  </Button>
                </Box>
              </>
            )}
          </DialogContent>
        </Dialog>
      </Paper>
    </Box>
  )
}

