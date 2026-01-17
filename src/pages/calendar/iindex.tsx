import { useEffect, useState } from 'react'
import { Box, Paper, Typography, Button } from '@mui/material'

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

type ViewMode = 'month' | 'week' | 'list'

const sampleSchedules: Schedule[] = [
  {
    id: 1,
    title: '프로젝트 회의',
    description: '분기별 프로젝트 진행 상황 점검 및 다음 단계 논의',
    startDate: '2024-03-25',
    endDate: '2024-03-25',
    startTime: '14:00',
    endTime: '16:00',
    category: 'meeting',
    priority: 'high',
    status: 'scheduled',
    location: '회의실 A',
    attendees: ['김철수', '이영희', '박민수'],
  },
  {
    id: 2,
    title: '클라이언트 프레젠테이션',
    description: '신규 서비스 제안서 발표',
    startDate: '2024-03-26',
    endDate: '2024-03-26',
    startTime: '10:00',
    endTime: '11:30',
    category: 'meeting',
    priority: 'high',
    status: 'scheduled',
    location: '본사 대회의실',
  },
  {
    id: 3,
    title: 'UI/UX 디자인 리뷰',
    description: '모바일 앱 디자인 최종 검토',
    startDate: '2024-03-27',
    endDate: '2024-03-27',
    startTime: '15:00',
    endTime: '17:00',
    category: 'task',
    priority: 'medium',
    status: 'scheduled',
    attendees: ['정수민', '김철수'],
  },
  {
    id: 4,
    title: '팀 빌딩 이벤트',
    description: '분기별 팀워크 향상을 위한 야외 활동',
    startDate: '2024-03-29',
    endDate: '2024-03-29',
    startTime: '13:00',
    endTime: '18:00',
    category: 'event',
    priority: 'medium',
    status: 'scheduled',
    location: '한강공원',
  },
  {
    id: 5,
    title: '보고서 제출 마감',
    description: '월간 실적 보고서 작성 및 제출',
    startDate: '2024-03-31',
    endDate: '2024-03-31',
    startTime: '18:00',
    endTime: '18:00',
    category: 'reminder',
    priority: 'high',
    status: 'scheduled',
  },
]

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

export default function CalendarPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')

  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(() => {
      setSchedules(sampleSchedules)
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [])

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
          }}
        >
          {calendarDays.map((dayData, index) => (
            <div
              key={index}
              style={{
                minHeight: 110,
                padding: '0.5rem',
                borderRight: index % 7 !== 6 ? '1px solid #e5e7eb' : 'none',
                borderBottom: index < calendarDays.length - 7 ? '1px solid #e5e7eb' : 'none',
                backgroundColor: dayData ? 'white' : '#f9fafb',
              }}
            >
              {dayData && (
                <>
                  <div
                    style={{
                      fontWeight: 500,
                      marginBottom: '0.35rem',
                      color:
                        new Date(dayData.dateStr).toDateString() ===
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
                    }}
                  >
                    {dayData.schedules.slice(0, 3).map((schedule) => {
                      const categoryColor = getCategoryColor(schedule.category)
                      return (
                        <div
                          key={schedule.id}
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.25rem 0.35rem',
                            backgroundColor: categoryColor.bg,
                            color: categoryColor.text,
                            borderRadius: '0.25rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
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
          ))}
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
                      style={{
                        fontSize: '0.85rem',
                        padding: '0.5rem',
                        backgroundColor: categoryColor.bg,
                        color: categoryColor.text,
                        borderRadius: '0.25rem',
                        border: `2px solid ${getPriorityColor(schedule.priority)}`,
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
              style={{
                padding: '1rem',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                borderLeft: `4px solid ${getPriorityColor(schedule.priority)}`,
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
      </Paper>
    </Box>
  )
}

