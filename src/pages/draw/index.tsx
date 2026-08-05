import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import BrushIcon from '@mui/icons-material/Brush'
import EditIcon from '@mui/icons-material/Edit'
import {
  fetchAppDataListApi,
  fetchAppDataByIdApi,
  deleteAppDataApi,
  type ApiAppData,
} from '../../apis/appApi'
import { deleteFilesApi, fetchFilesByDataApi } from '../../apis/fileApi'
import { getApiPrefix } from '../../apis/apiPrefix'

const APP_ID = 12
const MENU_CD = 'draw'

const DEFAULT_CANVAS_WIDTH = 900
const DEFAULT_CANVAS_HEIGHT = 600
const MIN_CANVAS_SIZE = 200
const MAX_CANVAS_SIZE = 4000

function clampCanvasSize(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(MAX_CANVAS_SIZE, Math.max(MIN_CANVAS_SIZE, Math.round(value)))
}

function apiV1Base(): string {
  const prefix = getApiPrefix()
  return prefix ? `${prefix}/api/v1` : '/api/v1'
}

function toAbsoluteFileUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  const prefix = getApiPrefix()
  let origin = prefix
  if (!origin) {
    // /data 정적 파일은 Vite 프록시 대상이 아니므로 원격 호스트 사용
    if (url.startsWith('/data/')) {
      origin = 'http://impsj.net'
    } else if (typeof window !== 'undefined') {
      origin = window.location.origin
    } else {
      origin = 'http://impsj.net'
    }
  }
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`
}

/**
 * 로드 후보 URL 목록.
 * 1) /data 정적 경로(file_url) — 서버 디스크와 DB file_path 불일치 시에도 동작
 * 2) file_id 다운로드 API — 폴백
 */
function resolveSketchSources(fileId: number | null, fileUrl?: string): string[] {
  const sources: string[] = []
  if (fileUrl?.trim()) {
    sources.push(toAbsoluteFileUrl(fileUrl.trim()))
  }
  if (fileId != null && !Number.isNaN(fileId)) {
    sources.push(`${apiV1Base()}/files/${fileId}/download`)
  }
  return sources
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '-'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

/**
 * URL로 스케치 이미지를 로드해 보여주는 뷰어.
 */
function SketchImageViewer({
  sources,
  alt,
  height = 'min(70vh, 720px)',
}: {
  sources: string[]
  alt: string
  height?: string | number
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setSrc(null)

    const load = async () => {
      if (sources.length === 0) {
        setError('연결된 이미지가 없습니다.')
        setLoading(false)
        return
      }
      const failures: string[] = []
      for (const url of sources) {
        if (cancelled) return
        try {
          const res = await fetch(url)
          if (!res.ok) {
            failures.push(`HTTP ${res.status}: ${url}`)
            continue
          }
          if (!cancelled) {
            setSrc(url)
            setLoading(false)
          }
          return
        } catch (e) {
          const reason = e instanceof TypeError ? '네트워크/CORS' : e instanceof Error ? e.message : '알 수 없음'
          failures.push(`${reason}: ${url}`)
        }
      }
      if (!cancelled) {
        setError(`이미지를 불러오지 못했습니다.\n${failures.join('\n')}`)
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [sources.join('|')])

  return (
    <Box sx={{ position: 'relative', width: '100%', flex: 1, minHeight: 0 }}>
      <Box
        sx={{
          width: '100%',
          height,
          minHeight: 400,
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: '#f4f6f8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {src && !error && (
          <Box
            component="img"
            src={src}
            alt={alt}
            sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        )}
      </Box>
      {loading && !error && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <Stack alignItems="center" spacing={1}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary">
              불러오는 중…
            </Typography>
          </Stack>
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ position: 'absolute', left: 16, right: 16, bottom: 16, whiteSpace: 'pre-line', wordBreak: 'break-all' }}>
          {error}
        </Alert>
      )}
    </Box>
  )
}

// ── app_data(app_id=12) → 스케치 항목 매핑 ─────────────────

type SketchItem = {
  dataId: number
  title: string
  sources: string[]
  thumbUrl: string
  fileName: string
  filesize: number
  ext: string
  fileId: number | null
  fileUrl: string
}

/**
 * extra 필드 매핑:
 *  extra_1 = 썸네일 이미지 URL (목록 카드용)
 *  extra_2 = 파일명, extra_3 = 크기, extra_4 = 확장자, extra_5 = file_id
 *  extra_6 = file_url (/data/... 정적 경로)
 */
function rowToItem(row: ApiAppData): SketchItem {
  const fileId = row.extra_5 ? Number(row.extra_5) || null : null
  const fileUrl = row.extra_6?.trim() ?? ''
  return {
    dataId: row.data_id ?? 0,
    title: row.ap_subject?.trim() || row.extra_2?.trim() || '(제목 없음)',
    sources: resolveSketchSources(fileId, fileUrl),
    thumbUrl: toAbsoluteFileUrl(row.extra_1 ?? '') || toAbsoluteFileUrl(fileUrl),
    fileName: row.extra_2 ?? '',
    filesize: Number(row.extra_3 ?? 0) || 0,
    ext: (row.extra_4 ?? '').toLowerCase(),
    fileId,
    fileUrl,
  }
}

async function enrichSketchWithFileUrl(item: SketchItem, dataId: number): Promise<SketchItem> {
  if (item.fileUrl || !item.fileId) return item
  try {
    const { items } = await fetchFilesByDataApi({ menuCd: MENU_CD, dataId, limit: 20 })
    const file = items.find((f) => f.file_id === item.fileId) ?? items[0]
    if (!file?.file_url) return item
    return {
      ...item,
      fileUrl: file.file_url,
      sources: resolveSketchSources(item.fileId, file.file_url),
    }
  } catch (e) {
    console.error('스케치 파일 URL 조회 실패:', e)
    return item
  }
}

// ── 상세(뷰어) 페이지 ───────────────────────────────────
function DrawDetail({ dataId }: { dataId: number }) {
  const navigate = useNavigate()
  const [item, setItem] = useState<SketchItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    const load = async () => {
      try {
        const row = await fetchAppDataByIdApi(dataId)
        if (cancelled) return
        if (!row) {
          setNotFound(true)
          return
        }
        setItem(await enrichSketchWithFileUrl(rowToItem(row), dataId))
      } catch (e) {
        console.error('스케치 상세 로드 실패:', e)
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [dataId])

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
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/draw')}
            sx={{ backgroundColor: '#fff', borderColor: 'grey.400', color: 'text.primary' }}
          >
            목록
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/draw/write/${dataId}`)}
            sx={{ backgroundColor: '#fff', borderColor: 'grey.400', color: 'text.primary' }}
          >
            편집
          </Button>
          <Typography variant="h6" sx={{ fontWeight: 600 }} noWrap>
            {item?.title ?? '스케치'}
          </Typography>
          {item?.fileName && (
            <Typography variant="body2" color="text.secondary" noWrap>
              {item.fileName} · {formatFileSize(item.filesize)}
            </Typography>
          )}
        </Stack>

        {loading ? (
          <Box sx={{ flex: 1, minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={48} />
          </Box>
        ) : notFound || !item ? (
          <Alert severity="warning">해당 스케치 데이터를 찾을 수 없습니다.</Alert>
        ) : item.sources.length === 0 ? (
          <Alert severity="warning">이 항목에는 연결된 스케치 이미지가 없습니다.</Alert>
        ) : (
          <Paper
            variant="outlined"
            sx={{ borderRadius: 2, overflow: 'hidden', flex: 1, minHeight: 480, display: 'flex' }}
          >
            <SketchImageViewer sources={item.sources} alt={item.fileName || item.title} />
          </Paper>
        )}
      </Paper>
    </Box>
  )
}

// ── 목록 페이지 ─────────────────────────────────────────
function DrawList() {
  const navigate = useNavigate()
  const [items, setItems] = useState<SketchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [menuDataId, setMenuDataId] = useState<number | null>(null)
  const [sizeDialogOpen, setSizeDialogOpen] = useState(false)
  const [canvasWidthInput, setCanvasWidthInput] = useState(String(DEFAULT_CANVAS_WIDTH))
  const [canvasHeightInput, setCanvasHeightInput] = useState(String(DEFAULT_CANVAS_HEIGHT))

  const openNewSketchDialog = () => {
    setCanvasWidthInput(String(DEFAULT_CANVAS_WIDTH))
    setCanvasHeightInput(String(DEFAULT_CANVAS_HEIGHT))
    setSizeDialogOpen(true)
  }

  const confirmNewSketch = () => {
    const width = clampCanvasSize(Number(canvasWidthInput), DEFAULT_CANVAS_WIDTH)
    const height = clampCanvasSize(Number(canvasHeightInput), DEFAULT_CANVAS_HEIGHT)
    setSizeDialogOpen(false)
    navigate(`/draw/write?w=${width}&h=${height}`)
  }

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchAppDataListApi({ app_id: APP_ID, limit: 500 })
      setItems(rows.map(rowToItem).filter((it) => it.dataId > 0))
      setSelectedIds([])
    } catch (e) {
      console.error('스케치 목록 로드 실패:', e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  const menuOpen = Boolean(menuAnchorEl)
  const allSelected = items.length > 0 && selectedIds.length === items.length

  const toggleSelected = (dataId: number) => {
    setSelectedIds((prev) =>
      prev.includes(dataId) ? prev.filter((id) => id !== dataId) : [...prev, dataId],
    )
  }

  const handleDelete = async (dataIds: number[]) => {
    if (!dataIds.length) return
    if (!window.confirm(`선택한 ${dataIds.length}개 항목을 삭제하시겠습니까?`)) return
    setBusy(true)
    try {
      for (const id of dataIds) {
        const target = items.find((it) => it.dataId === id)
        if (target?.fileId) {
          try {
            await deleteFilesApi({ fileIds: [target.fileId] })
          } catch (e) {
            console.error('첨부파일 삭제 실패:', e)
          }
        }
        await deleteAppDataApi(id)
      }
      setSelectedIds([])
      setSelectMode(false)
      await loadItems()
    } catch (e) {
      console.error('삭제 실패:', e)
      window.alert('삭제 중 오류가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 3 }}>
      {(loading || busy) && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            bgcolor: 'rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
        >
          <CircularProgress size={64} />
        </Box>
      )}

      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, backgroundColor: 'background.paper', minHeight: '100%' }}>
          <Typography variant="h5" sx={{ mb: 1.5, fontWeight: 600 }}>
            스케치
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            새로 그리기에서 스케치를 작성하고 저장할 수 있습니다.
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              startIcon={<EditIcon />}
              onClick={openNewSketchDialog}
            >
              새로 그리기
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              onClick={() => {
                setSelectMode((prev) => !prev)
                setSelectedIds([])
              }}
            >
              {selectMode ? '선택 취소' : '선택하기'}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              disabled={!items.length}
              onClick={() => {
                if (!selectMode) setSelectMode(true)
                setSelectedIds(allSelected ? [] : items.map((it) => it.dataId))
              }}
            >
              {allSelected ? '전체해제' : '전체선택'}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              disabled={!selectedIds.length}
              onClick={() => void handleDelete(selectedIds)}
            >
              선택 삭제
            </Button>
          </Box>

          {!loading && items.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography color="text.secondary">저장된 스케치가 없습니다.</Typography>
            </Box>
          ) : (
            <Grid container spacing={2.5}>
              {items.map((item) => (
                <Grid key={item.dataId} item xs={12} sm={6} md={4} lg={3}>
                  <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                    <CardActionArea onClick={() => navigate(`/draw/${item.dataId}`)}>
                      <Box
                        sx={{
                          width: '100%',
                          aspectRatio: '4 / 3',
                          bgcolor: 'grey.100',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 1,
                          color: 'text.secondary',
                          overflow: 'hidden',
                        }}
                      >
                        {item.thumbUrl ? (
                          <Box
                            component="img"
                            src={item.thumbUrl}
                            alt={item.title}
                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <>
                            <BrushIcon sx={{ fontSize: 48, opacity: 0.6 }} />
                            <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 700 }}>
                              {item.ext || 'IMG'}
                            </Typography>
                          </>
                        )}
                      </Box>
                    </CardActionArea>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, flex: 1 }}>
                        {selectMode && (
                          <Checkbox
                            size="small"
                            checked={selectedIds.includes(item.dataId)}
                            onChange={() => toggleSelected(item.dataId)}
                          />
                        )}
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {item.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {(item.ext || '-').toUpperCase()} · {formatFileSize(item.filesize)}
                          </Typography>
                        </Box>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          setMenuAnchorEl(e.currentTarget)
                          setMenuDataId(item.dataId)
                        }}
                      >
                        <span style={{ fontSize: 18 }}>⋯</span>
                      </IconButton>
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          <Menu anchorEl={menuAnchorEl} open={menuOpen} onClose={() => setMenuAnchorEl(null)}>
            <MenuItem
              onClick={() => {
                setMenuAnchorEl(null)
                if (menuDataId != null) navigate(`/draw/${menuDataId}`)
              }}
            >
              보기
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuAnchorEl(null)
                if (menuDataId != null) navigate(`/draw/write/${menuDataId}`)
              }}
            >
              편집
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuAnchorEl(null)
                if (menuDataId != null) void handleDelete([menuDataId])
              }}
            >
              삭제
            </MenuItem>
          </Menu>

          <Dialog open={sizeDialogOpen} onClose={() => setSizeDialogOpen(false)} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 600 }}>캔버스 크기</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <TextField
                  label="가로 (px)"
                  type="number"
                  size="small"
                  fullWidth
                  value={canvasWidthInput}
                  onChange={(e) => setCanvasWidthInput(e.target.value)}
                  inputProps={{ min: MIN_CANVAS_SIZE, max: MAX_CANVAS_SIZE }}
                />
                <TextField
                  label="세로 (px)"
                  type="number"
                  size="small"
                  fullWidth
                  value={canvasHeightInput}
                  onChange={(e) => setCanvasHeightInput(e.target.value)}
                  inputProps={{ min: MIN_CANVAS_SIZE, max: MAX_CANVAS_SIZE }}
                />
                <Typography variant="caption" color="text.secondary">
                  {MIN_CANVAS_SIZE}px ~ {MAX_CANVAS_SIZE}px 범위에서 입력할 수 있습니다.
                </Typography>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button color="inherit" onClick={() => setSizeDialogOpen(false)}>
                취소
              </Button>
              <Button variant="contained" onClick={confirmNewSketch}>
                시작
              </Button>
            </DialogActions>
          </Dialog>
        </Paper>
      </Box>
    </Box>
  )
}

export default function DrawPage() {
  const { id } = useParams<{ id?: string }>()
  const dataId = id ? Number(id) : NaN
  if (id && !Number.isNaN(dataId)) {
    return <DrawDetail dataId={dataId} />
  }
  return <DrawList />
}
