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
import ComputerIcon from '@mui/icons-material/Computer'
import DnsIcon from '@mui/icons-material/Dns'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import TopBar from '../../components/TopBar'
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


const EMPTY_FORM: ServerHostPayload = {
  label: '',
  host: '',
  port: 22,
  user: '',
  ssh_key: '',
  password: '',
  sort_no: 0,
}

export default function ServerRemotePage() {
  const termHostRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const openedRef = useRef(false)

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

  const sendResize = useCallback(() => {
    const term = termRef.current
    const ws = wsRef.current
    if (!term || !ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
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
      const t = termRef.current
      if (!t) return
      let text = ''
      if (typeof ev.data === 'string') {
        text = ev.data
        t.write(ev.data)
      } else if (ev.data instanceof ArrayBuffer) {
        const bytes = new Uint8Array(ev.data)
        text = new TextDecoder().decode(bytes)
        t.write(bytes)
      } else if (ev.data instanceof Blob) {
        void ev.data.arrayBuffer().then((buf) => {
          const bytes = new Uint8Array(buf)
          const decoded = new TextDecoder().decode(bytes)
          t.write(bytes)
          if (decoded.includes('[인증 필요]')) {
            setError('인증에 실패했습니다. 다시 로그인한 뒤 연결하세요.')
            setStatus('인증 실패')
          }
        })
        return
      }
      if (text.includes('[인증 필요]')) {
        setError('인증에 실패했습니다. 다시 로그인한 뒤 연결하세요.')
        setStatus('인증 실패')
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
  }, [disconnect, sendResize, selectedHostId])

  useEffect(() => {
    const host = termHostRef.current
    if (!host) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0f172a',
        foreground: '#e2e8f0',
        cursor: '#38bdf8',
        selectionBackground: '#334155',
      },
      convertEol: true,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host)
    fit.fit()
    termRef.current = term
    fitRef.current = fit

    term.onData((data) => {
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })

    const onResize = () => {
      fit.fit()
      sendResize()
    }
    window.addEventListener('resize', onResize)
    const ro = new ResizeObserver(onResize)
    ro.observe(host)

    return () => {
      window.removeEventListener('resize', onResize)
      ro.disconnect()
      disconnect()
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [disconnect, sendResize])

  // ── 호스트 관리 ─────────────────────────────────────

  const openCreateDialog = () => {
    setEditingHost(null)
    setFormMode('create')
    setForm({ ...EMPTY_FORM })
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

  const selectedLabel = selectedHostId == null
    ? '로컬 쉘'
    : hosts.find((h) => h.id === selectedHostId)?.label || `호스트 #${selectedHostId}`

  return (
    <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
      <TopBar />
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
                <ComputerIcon sx={{ mr: 1, fontSize: 18 }} />
                로컬 쉘
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
          <Tooltip title="호스트 관리">
            <IconButton onClick={() => setManageOpen(true)} disabled={connected}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Paper
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
          }}
        >
          <Box
            ref={termHostRef}
            sx={{
              width: '100%',
              height: 'min(70vh, 720px)',
              minHeight: 480,
              '& .xterm': { height: '100%' },
              '& .xterm-viewport': { overflowY: 'auto' },
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
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          SSH 호스트 관리
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
          >
            추가
          </Button>
        </DialogTitle>
        <DialogContent dividers>
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
                {editingHost ? '호스트 수정' : '새 호스트 등록'}
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
                    placeholder="192.168.0.110"
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
                    placeholder="ddiotwcms"
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
