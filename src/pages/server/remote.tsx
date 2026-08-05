import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import SettingsIcon from '@mui/icons-material/Settings'
import FullscreenIcon from '@mui/icons-material/Fullscreen'
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit'
import ComputerIcon from '@mui/icons-material/Computer'
import DnsIcon from '@mui/icons-material/Dns'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import LaptopMacIcon from '@mui/icons-material/LaptopMac'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from '@mui/material'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { getApiPrefix } from '../../apis/apiPrefix'
import { readTokenExpMs } from '../../utils/auth'
import {
  ServerHost,
  ServerHostPayload,
  fetchServerHostsApi,
  createServerHostApi,
  updateServerHostApi,
  deleteServerHostApi,
} from '../../apis/serverHostApi'

function getShellWsUrl(token: string, hostId?: number | null): string {
  const httpBase = getApiPrefix()
  let wsBase: string
  if (httpBase) {
    wsBase = httpBase.replace(/^http/, 'ws')
  } else {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    wsBase = `${proto}//${window.location.host}`
  }
  let url = `${wsBase}/api/server/shell?token=${encodeURIComponent(token)}`
  if (hostId != null) {
    url += `&host_id=${hostId}`
  }
  return url
}


const SERVER_SHELL_LABEL = '서버 쉘 (Docker)'
const MAC_HOST_LABEL = '내 Mac'
const MAC_HOST_ADDRESS = 'host.docker.internal'

const MAC_HOST_PRESET: ServerHostPayload = {
  label: MAC_HOST_LABEL,
  host: MAC_HOST_ADDRESS,
  port: 22,
  user: '',
  ssh_key: '',
  password: '',
  sort_no: -1,
}

const EMPTY_FORM: ServerHostPayload = {
  label: '',
  host: '',
  port: 22,
  user: '',
  ssh_key: '',
  password: '',
  sort_no: 0,
}

const MAX_TERM_DIM = 500
const RESIZE_DEBOUNCE_MS = 80

function isMacHost(h: ServerHost): boolean {
  return h.label === MAC_HOST_LABEL || h.host === MAC_HOST_ADDRESS
}

/** FitAddon이 0/Infinity 크기를 반환하면 xterm.resize가 브라우저를 멈추거나 크래시시킨다. */
function safeFitTerminal(
  term: Terminal,
  fit: FitAddon,
  hostEl: HTMLElement | null,
): boolean {
  if (!hostEl || !term.element) return false
  if (hostEl.offsetWidth <= 0 || hostEl.offsetHeight <= 0) return false
  try {
    fit.fit()
    const { cols, rows } = term
    if (
      !Number.isFinite(cols) ||
      !Number.isFinite(rows) ||
      cols <= 0 ||
      rows <= 0
    ) {
      return false
    }
    if (cols > MAX_TERM_DIM || rows > MAX_TERM_DIM) {
      term.resize(
        Math.min(cols, MAX_TERM_DIM),
        Math.min(rows, MAX_TERM_DIM),
      )
    }
    return true
  } catch {
    return false
  }
}

function clampTermDim(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 80
  return Math.min(Math.max(Math.floor(n), 1), MAX_TERM_DIM)
}

export default function ServerRemotePage() {
  const termHostRef = useRef<HTMLDivElement | null>(null)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const openedRef = useRef(false)
  const writeChunksRef = useRef<Uint8Array[]>([])
  const writeFlushRef = useRef<number | null>(null)
  const resizeTimerRef = useRef<number | null>(null)

  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState('대기')
  const [error, setError] = useState<string | null>(null)

  // 호스트 목록
  const [hosts, setHosts] = useState<ServerHost[]>([])
  const [selectedHostId, setSelectedHostId] = useState<number | null>(null)

  // 호스트 관리 다이얼로그
  const [manageOpen, setManageOpen] = useState(false)
  const [editingHost, setEditingHost] = useState<ServerHost | null>(null)
  const [formMode, setFormMode] = useState<'none' | 'create' | 'edit'>('none')
  const [form, setForm] = useState<ServerHostPayload>({ ...EMPTY_FORM })
  const [formError, setFormError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const loadHosts = useCallback(async () => {
    try {
      const list = await fetchServerHostsApi()
      setHosts(list)
    } catch {
      // 무시
    }
  }, [])

  useEffect(() => {
    loadHosts()
  }, [loadHosts])

  const disconnect = useCallback(() => {
    const ws = wsRef.current
    wsRef.current = null
    openedRef.current = false
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.close(1000, 'client disconnect')
    }
    setConnected(false)
    setStatus('연결 종료')
  }, [])

  const flushTermWrites = useCallback(() => {
    const term = termRef.current
    if (!term || writeChunksRef.current.length === 0) return

    const chunks = writeChunksRef.current
    writeChunksRef.current = []
    if (chunks.length === 1) {
      const single = chunks[0]
      if (single) term.write(single)
      return
    }
    let total = 0
    for (const chunk of chunks) total += chunk.length
    const merged = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    term.write(merged)
  }, [])

  const queueTermWrite = useCallback(
    (data: string | Uint8Array) => {
      const bytes =
        typeof data === 'string' ? new TextEncoder().encode(data) : data
      writeChunksRef.current.push(bytes)
      if (writeFlushRef.current != null) return
      writeFlushRef.current = window.requestAnimationFrame(() => {
        writeFlushRef.current = null
        flushTermWrites()
      })
    },
    [flushTermWrites],
  )

  const sendResize = useCallback(() => {
    const term = termRef.current
    const fit = fitRef.current
    const ws = wsRef.current
    if (!term || !ws || ws.readyState !== WebSocket.OPEN) return

    safeFitTerminal(term, fit!, termHostRef.current)
    const cols = clampTermDim(term.cols)
    const rows = clampTermDim(term.rows)
    ws.send(JSON.stringify({ type: 'resize', cols, rows }))
  }, [])

  const connect = useCallback(() => {
    setError(null)
    const token = localStorage.getItem('auth_token')
    if (!token) {
      setError('로그인이 필요합니다. 다시 로그인한 뒤 연결하세요.')
      return
    }

    const expMs = readTokenExpMs(token)
    if (expMs != null && expMs <= Date.now()) {
      setError('로그인 토큰이 만료되었습니다. 다시 로그인한 뒤 연결하세요.')
      setStatus('인증 만료')
      return
    }

    disconnect()

    const term = termRef.current
    if (term) {
      term.clear()
      term.writeln('연결 중…')
    }

    const url = getShellWsUrl(token, selectedHostId)
    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws
    openedRef.current = false
    setStatus('연결 중…')

    ws.onopen = () => {
      openedRef.current = true
      setConnected(true)
      setStatus('연결됨')
      setError(null)
      // SSH 채널이 열린 뒤 터미널 크기 전달
      window.setTimeout(() => {
        sendResize()
        term?.focus()
      }, 150)
    }

    ws.onmessage = (ev) => {
      const handleBytes = (bytes: Uint8Array) => {
        queueTermWrite(bytes)
        const decoded = new TextDecoder().decode(bytes)
        if (decoded.includes('[인증 필요]')) {
          setError('인증에 실패했습니다. 다시 로그인한 뒤 연결하세요.')
          setStatus('인증 실패')
        }
      }

      if (typeof ev.data === 'string') {
        handleBytes(new TextEncoder().encode(ev.data))
      } else if (ev.data instanceof ArrayBuffer) {
        handleBytes(new Uint8Array(ev.data))
      } else if (ev.data instanceof Blob) {
        void ev.data.arrayBuffer().then((buf) => handleBytes(new Uint8Array(buf)))
      }
    }

    ws.onerror = () => {
      if (!openedRef.current) {
        setError(`WebSocket 연결 오류 (${url.replace(/\?token=.*/, '?token=…')})`)
        setStatus('오류')
      }
    }

    ws.onclose = (ev) => {
      const wasOpen = openedRef.current
      setConnected(false)
      wsRef.current = null
      openedRef.current = false
      termRef.current?.writeln('\r\n[세션 종료]')

      if (ev.code === 4401 || ev.code === 1008) {
        setError('인증에 실패했습니다. 다시 로그인한 뒤 연결하세요.')
        setStatus('인증 실패')
        return
      }
      if (ev.code === 1011) {
        setError('원격 세션 오류가 발생했습니다. 호스트/인증 정보를 확인하세요.')
        setStatus('세션 오류')
        return
      }
      if (!wasOpen && ev.code !== 1000) {
        setStatus('연결 실패')
        return
      }
      setStatus('연결 종료')
    }
  }, [disconnect, queueTermWrite, sendResize, selectedHostId])

  useEffect(() => {
    const host = termHostRef.current
    if (!host) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"D2Coding", "D2Coding ligature", Menlo, Monaco, "Courier New", monospace',
      scrollback: 5000,
      theme: {
        background: '#0f172a',
        foreground: '#e2e8f0',
        cursor: '#38bdf8',
        selectionBackground: '#334155',
      },
      // vi 등 전체 화면 TUI는 convertEol이 출력을 깨고 과도한 리렌더를 유발한다.
      convertEol: false,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host)
    safeFitTerminal(term, fit, host)
    termRef.current = term
    fitRef.current = fit

    term.onData((data) => {
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })

    term.onResize(({ cols, rows }) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      ws.send(
        JSON.stringify({
          type: 'resize',
          cols: clampTermDim(cols),
          rows: clampTermDim(rows),
        }),
      )
    })

    const scheduleResize = () => {
      if (resizeTimerRef.current != null) {
        window.clearTimeout(resizeTimerRef.current)
      }
      resizeTimerRef.current = window.setTimeout(() => {
        resizeTimerRef.current = null
        safeFitTerminal(term, fit, host)
        sendResize()
      }, RESIZE_DEBOUNCE_MS)
    }
    window.addEventListener('resize', scheduleResize)
    const ro = new ResizeObserver(scheduleResize)
    ro.observe(host)

    return () => {
      window.removeEventListener('resize', scheduleResize)
      ro.disconnect()
      if (resizeTimerRef.current != null) {
        window.clearTimeout(resizeTimerRef.current)
        resizeTimerRef.current = null
      }
      if (writeFlushRef.current != null) {
        window.cancelAnimationFrame(writeFlushRef.current)
        writeFlushRef.current = null
      }
      writeChunksRef.current = []
      disconnect()
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [disconnect, sendResize])

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev)
  }, [])

  useEffect(() => {
    document.body.style.overflow = isFullscreen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isFullscreen])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const term = termRef.current
      const fit = fitRef.current
      if (term && fit && termHostRef.current) {
        safeFitTerminal(term, fit, termHostRef.current)
        sendResize()
      }
    }, 100)
    return () => window.clearTimeout(timer)
  }, [isFullscreen, sendResize])

  // ── 호스트 관리 ─────────────────────────────────────

  const openCreateDialog = () => {
    setEditingHost(null)
    setFormMode('create')
    setForm({ ...EMPTY_FORM })
    setFormError(null)
    setManageOpen(true)
  }

  const openMacHostDialog = () => {
    setEditingHost(null)
    setFormMode('create')
    setForm({ ...MAC_HOST_PRESET })
    setFormError(null)
    setManageOpen(true)
  }

  const openEditDialog = (h: ServerHost) => {
    setEditingHost(h)
    setFormMode('edit')
    setForm({
      label: h.label,
      host: h.host,
      port: h.port,
      user: h.user,
      ssh_key: h.ssh_key || '',
      password: h.password || '',
      sort_no: h.sort_no,
    })
    setFormError(null)
    setManageOpen(true)
  }

  const handleSaveHost = async () => {
    if (!form.label.trim() || !form.host.trim() || !form.user.trim()) {
      setFormError('별칭, 호스트, 사용자명은 필수입니다.')
      return
    }
    try {
      if (editingHost) {
        await updateServerHostApi(editingHost.id, form)
      } else {
        await createServerHostApi(form)
      }
      setManageOpen(false)
      loadHosts()
    } catch (e: any) {
      setFormError(e.message || '저장 실패')
    }
  }

  const handleDeleteHost = async (id: number) => {
    if (!confirm('이 호스트를 삭제하시겠습니까?')) return
    try {
      await deleteServerHostApi(id)
      if (selectedHostId === id) setSelectedHostId(null)
      loadHosts()
    } catch {
      // 무시
    }
  }

  const hasMacHost = hosts.some(isMacHost)

  const selectedLabel = selectedHostId == null
    ? SERVER_SHELL_LABEL
    : hosts.find((h) => h.id === selectedHostId)?.label || `호스트 #${selectedHostId}`

  return (
    <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          backgroundColor: 'background.paper',
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
          원격제어
        </Typography>
        {/* <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          서버 쉘에 웹으로 접속합니다. 호스트를 선택한 뒤 연결하세요.
        </Typography> */}

        <Stack
          direction="row"
          alignItems="center"
          flexWrap="wrap"
          sx={{ mb: 2, columnGap: 1, rowGap: '10px' }}
        >
          <Button
            variant="contained"
            size="small"
            startIcon={<PlayArrowIcon />}
            onClick={connect}
            disabled={connected}
          >
            연결
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<StopIcon />}
            onClick={disconnect}
            disabled={!connected}
            sx={{ borderColor: 'grey.400', color: 'text.primary' }}
          >
            종료
          </Button>
          <Typography variant="body2" color="text.secondary">
            상태: {status}
          </Typography>
          {connected && (
            <Chip
              label={selectedLabel}
              size="small"
              color={selectedHostId != null ? 'primary' : 'default'}
            />
          )}
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="host-select-label">접속 대상</InputLabel>
            <Select
              labelId="host-select-label"
              value={selectedHostId != null ? String(selectedHostId) : ''}
              input={<OutlinedInput label="접속 대상" />}
              onChange={(e: SelectChangeEvent) => {
                const v = e.target.value
                setSelectedHostId(v === '' ? null : Number(v))
              }}
              disabled={connected}
            >
              <MenuItem value="">
                <Tooltip
                  title="백엔드 API가 실행 중인 Docker 컨테이너 쉘입니다. Mac 터미널이 아닙니다."
                  placement="right"
                >
                  <Stack direction="row" alignItems="center" component="span" sx={{ width: '100%' }}>
                    <ComputerIcon sx={{ mr: 1, fontSize: 18 }} />
                    {SERVER_SHELL_LABEL}
                  </Stack>
                </Tooltip>
              </MenuItem>
              {hosts.map((h) => (
                <MenuItem key={h.id} value={String(h.id)}>
                  <DnsIcon sx={{ mr: 1, fontSize: 18 }} />
                  {h.label}
                  <Chip
                    label={`${h.user}@${h.host}`}
                    size="small"
                    sx={{ ml: 1, height: 20, fontSize: 11 }}
                  />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Tooltip title="호스트 관리">
              <IconButton onClick={() => setManageOpen(true)} disabled={connected}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={isFullscreen ? '전체 화면 종료' : '전체 화면'}>
              <IconButton onClick={toggleFullscreen}>
                {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Paper
          ref={shellRef}
          variant="outlined"
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            backgroundColor: '#0f172a',
            p: 1,
            flex: 1,
            minHeight: 480,
            position: 'relative',
            zIndex: 0,
            display: 'flex',
            flexDirection: 'column',
            ...(isFullscreen && {
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              minHeight: '100vh',
              zIndex: 1300,
              borderRadius: 0,
            }),
          }}
        >
          {isFullscreen && (
            <Tooltip title="전체 화면 종료">
              <IconButton
                onClick={toggleFullscreen}
                size="small"
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  zIndex: 1,
                  color: '#94a3b8',
                  '&:hover': { color: '#e2e8f0', backgroundColor: 'rgba(255,255,255,0.08)' },
                }}
              >
                <FullscreenExitIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Box
            ref={termHostRef}
            sx={{
              width: '100%',
              height: isFullscreen ? '100%' : 'min(70vh, 720px)',
              flex: isFullscreen ? 1 : undefined,
              minHeight: isFullscreen ? 0 : 480,
              '& .xterm': { height: '100%' },
              // vi 등 alternate buffer TUI는 스크롤 가능 viewport가 레이아웃 루프를 유발한다.
              '& .xterm-viewport': { overflow: 'hidden' },
            }}
          />
        </Paper>
      </Paper>

      {/* ── 호스트 관리 다이얼로그 ── */}
      <Dialog
        open={manageOpen}
        onClose={() => { setManageOpen(false); setFormMode('none') }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { zIndex: 1400 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
          SSH 호스트 관리
          <Stack direction="row" spacing={0.5}>
            <Button
              size="small"
              startIcon={<LaptopMacIcon />}
              onClick={openMacHostDialog}
            >
              내 Mac 추가
            </Button>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={openCreateDialog}
            >
              추가
            </Button>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {!hasMacHost && (
            <Alert
              severity="info"
              sx={{ mb: 2 }}
              action={
                <Button color="inherit" size="small" onClick={openMacHostDialog}>
                  등록하기
                </Button>
              }
            >
              Mac 터미널에 접속하려면 SSH 호스트로 Mac을 등록하세요. Docker 환경에서는 호스트 주소를{' '}
              <strong>{MAC_HOST_ADDRESS}</strong>로 설정합니다.
            </Alert>
          )}

          <Accordion disableGutters elevation={0} sx={{ mb: 2, border: '1px solid', borderColor: 'divider' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <HelpOutlineIcon fontSize="small" color="action" />
                <Typography variant="body2">Mac SSH 접속 설정 가이드</Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Stack spacing={1.25} component="ol" sx={{ m: 0, pl: 2.5 }}>
                <Typography component="li" variant="body2">
                  Mac에서 <strong>시스템 설정 → 일반 → 공유 → 원격 로그인</strong>을 켭니다.
                </Typography>
                <Typography component="li" variant="body2">
                  터미널에서 SSH 키를 생성합니다:{' '}
                  <Box component="code" sx={{ fontSize: 12, bgcolor: 'action.hover', px: 0.75, py: 0.25, borderRadius: 0.5 }}>
                    ssh-keygen -t ed25519 -f ~/.ssh/psj_web_app -N ""
                  </Box>
                </Typography>
                <Typography component="li" variant="body2">
                  공개키를 Mac에 등록합니다:{' '}
                  <Box component="code" sx={{ fontSize: 12, bgcolor: 'action.hover', px: 0.75, py: 0.25, borderRadius: 0.5 }}>
                    cat ~/.ssh/psj_web_app.pub &gt;&gt; ~/.ssh/authorized_keys
                  </Box>
                </Typography>
                <Typography component="li" variant="body2">
                  <strong>내 Mac 추가</strong> 버튼으로 호스트를 등록하고, 사용자명에 Mac 로그인 계정을 입력합니다.
                </Typography>
                <Typography component="li" variant="body2">
                  SSH 개인키 칸에 <Box component="code" sx={{ fontSize: 12 }}>~/.ssh/psj_web_app</Box> 파일 내용을 붙여넣습니다.
                  (패스워드 방식도 가능)
                </Typography>
                <Typography component="li" variant="body2">
                  등록 후 접속 대상에서 <strong>{MAC_HOST_LABEL}</strong>을 선택하고 연결합니다.
                </Typography>
              </Stack>
            </AccordionDetails>
          </Accordion>

          {hosts.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              저장된 호스트가 없습니다. "추가" 버튼으로 등록하세요.
            </Typography>
          ) : (
            <Stack spacing={0} divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />}>
              {hosts.map((h) => (
                <Stack
                  key={h.id}
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{
                    py: 0.75,
                    px: 0,
                    bgcolor: selectedHostId === h.id ? 'action.selected' : 'transparent',
                  }}
                >
                  <Button
                    size="small"
                    variant={selectedHostId === h.id ? 'contained' : 'outlined'}
                    onClick={() => {
                      setSelectedHostId(h.id)
                      setManageOpen(false)
                    }}
                    sx={{ flexShrink: 0, minWidth: 72, ml: 0 }}
                  >
                    접속하기
                  </Button>
                  <Typography variant="body2" fontWeight={600} noWrap sx={{ flexShrink: 0 }}>
                    {h.label}
                  </Typography>
                  <Chip
                    label={`${h.user}@${h.host}:${h.port}`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: 11, maxWidth: 220 }}
                  />
                  <Box sx={{ flex: 1 }} />
                  <IconButton size="small" onClick={() => openEditDialog(h)} aria-label="수정">
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDeleteHost(h.id)} aria-label="삭제">
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          )}

          {/* 등록/수정 폼 */}
          {formMode !== 'none' && (
            <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                {editingHost
                  ? '호스트 수정'
                  : form.host === MAC_HOST_ADDRESS
                    ? 'Mac SSH 호스트 등록'
                    : '새 호스트 등록'}
              </Typography>
              <Stack spacing={1.5}>
                <TextField
                  label="별칭"
                  size="small"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="예: 디디오트WCMS"
                  fullWidth
                />
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="호스트 (IP/도메인)"
                    size="small"
                    value={form.host}
                    onChange={(e) => setForm({ ...form, host: e.target.value })}
                    placeholder={MAC_HOST_ADDRESS}
                    sx={{ flex: 2 }}
                  />
                  <TextField
                    label="포트"
                    size="small"
                    type="number"
                    value={form.port}
                    onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                    sx={{ flex: 1 }}
                  />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="사용자명"
                    size="small"
                    value={form.user}
                    onChange={(e) => setForm({ ...form, user: e.target.value })}
                    placeholder="parksungju"
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="패스워드 (선택)"
                    size="small"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    sx={{ flex: 1 }}
                  />
                </Stack>
                <TextField
                  label="SSH 개인키 PEM (선택, 패스워드 대체)"
                  size="small"
                  value={form.ssh_key}
                  onChange={(e) => setForm({ ...form, ssh_key: e.target.value })}
                  multiline
                  rows={3}
                  fullWidth
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                />
                <TextField
                  label="정렬순서"
                  size="small"
                  type="number"
                  value={form.sort_no}
                  onChange={(e) => setForm({ ...form, sort_no: Number(e.target.value) })}
                  sx={{ width: 120 }}
                />
              </Stack>
              {formError && (
                <Alert severity="error" sx={{ mt: 1.5 }}>
                  {formError}
                </Alert>
              )}
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          {formMode !== 'none' && (
            <>
              <Button
                onClick={() => {
                  setEditingHost(null)
                  setFormMode('none')
                  setForm({ ...EMPTY_FORM })
                  setFormError(null)
                }}
              >
                취소
              </Button>
              <Button variant="contained" onClick={handleSaveHost}>
                {editingHost ? '수정' : '등록'}
              </Button>
            </>
          )}
          <Button onClick={() => { setManageOpen(false); setFormMode('none') }}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
