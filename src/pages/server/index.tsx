import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material'
import { fetchServerStatusApi, fetchCpuUsageApi, fetchMemoryUsageApi, formatBytes, type DiskUsage } from '../../apis/serverApi'
import StorageIcon from '@mui/icons-material/Storage'
import MemoryIcon from '@mui/icons-material/Memory'
import SpeedIcon from '@mui/icons-material/Speed'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

const POLL_INTERVAL_MS = 2000
const MAX_POINTS = 60

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function CpuChart({ initialCpu }: { initialCpu?: number }) {
  const [data, setData] = useState<Array<{ time: string; value: number }>>(() =>
    initialCpu != null ? [{ time: formatTime(new Date()), value: initialCpu }] : [],
  )
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchCpu = useCallback(async () => {
    try {
      const res = await fetchCpuUsageApi()
      if (res.error) {
        setError(res.error)
        return
      }
      setError(null)
      const now = new Date()
      setData((prev) => {
        const next = [...prev, { time: formatTime(now), value: res.used_percent }]
        return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'CPU 조회 실패')
    }
  }, [])

  useEffect(() => {
    fetchCpu()
    pollRef.current = setInterval(fetchCpu, POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchCpu])

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <SpeedIcon fontSize="small" />
        CPU 사용량 (실시간)
      </Typography>
      {error ? (
        <Typography variant="caption" color="error.main">
          {error}
        </Typography>
      ) : (
        <Box sx={{ width: '100%', height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: number | undefined) => [`${v ?? 0}%`, 'CPU']} labelFormatter={(label) => `시간: ${label}`} />
              <ReferenceLine y={70} stroke="#ed6c02" strokeDasharray="3 3" />
              <ReferenceLine y={90} stroke="#d32f2f" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="value" stroke="#1976d2" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Box>
  )
}

function MemoryChart({ initialMemory }: { initialMemory?: number }) {
  const [data, setData] = useState<Array<{ time: string; value: number }>>(() =>
    initialMemory != null ? [{ time: formatTime(new Date()), value: initialMemory }] : [],
  )
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchMemory = useCallback(async () => {
    try {
      const res = await fetchMemoryUsageApi()
      if (res.error) {
        setError(res.error)
        return
      }
      setError(null)
      const now = new Date()
      setData((prev) => {
        const next = [...prev, { time: formatTime(now), value: res.used_percent }]
        return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '메모리 조회 실패')
    }
  }, [])

  useEffect(() => {
    fetchMemory()
    pollRef.current = setInterval(fetchMemory, POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchMemory])

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <MemoryIcon fontSize="small" />
        메인 메모리 (실시간)
      </Typography>
      {error ? (
        <Typography variant="caption" color="error.main">
          {error}
        </Typography>
      ) : (
        <Box sx={{ width: '100%', height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: number | undefined) => [`${v ?? 0}%`, '메모리']} labelFormatter={(label) => `시간: ${label}`} />
              <ReferenceLine y={70} stroke="#ed6c02" strokeDasharray="3 3" />
              <ReferenceLine y={90} stroke="#d32f2f" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="value" stroke="#9c27b0" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Box>
  )
}

export default function ServerStatusPage() {
  const [disk, setDisk] = useState<DiskUsage | null>(null)
  const [initialCpu, setInitialCpu] = useState<number | undefined>(undefined)
  const [initialMemory, setInitialMemory] = useState<number | undefined>(undefined)
  const [pingOk, setPingOk] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetchServerStatusApi()
        if (!cancelled) {
          setDisk(res.disk)
          setPingOk(res.ping_ok)
          if (res.cpu && !res.cpu.error) setInitialCpu(res.cpu.used_percent)
          if (res.memory && !res.memory.error) setInitialMemory(res.memory.used_percent)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '서버 상태를 불러오지 못했습니다.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          backgroundColor: 'background.paper',
          maxWidth: 560,
        }}
      >
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <StorageIcon />
          서버 상태
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <CpuChart initialCpu={initialCpu} />
        <MemoryChart initialMemory={initialMemory} />

        {disk && (
          <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
            <Box
              sx={(theme) => ({
                width: 140,
                height: 140,
                borderRadius: '50%',
                background: `conic-gradient(
                  ${disk.used_percent >= 90 ? theme.palette.error.main : disk.used_percent >= 70 ? theme.palette.warning.main : theme.palette.primary.main} 0% ${disk.used_percent}%,
                  ${theme.palette.grey[300]} ${disk.used_percent}% 100%
                )`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Box
                sx={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  bgcolor: 'background.paper',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="h6" fontWeight={700}>
                  {disk.used_percent}%
                </Typography>
              </Box>
            </Box>
            <Box sx={{ flex: 1, minWidth: 180 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                디스크 사용량 ({disk.path})
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.25 }}>
                사용: {formatBytes(disk.used)} / {formatBytes(disk.total)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                여유: {formatBytes(disk.free)}
              </Typography>
              {disk.error && (
                <Typography variant="caption" color="error.main" sx={{ mt: 0.5, display: 'block' }}>
                  {disk.error}
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {pingOk !== null && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
              네트워크 (192.168.0.100)
            </Typography>
            <Typography variant="body2" color={pingOk ? 'success.main' : 'text.secondary'}>
              {pingOk ? '연결됨' : '연결 실패'}
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  )
}
