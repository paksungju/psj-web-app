import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Box, CircularProgress, IconButton, Paper, Tooltip, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import BrushIcon from '@mui/icons-material/Brush'
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule'
import CropFreeIcon from '@mui/icons-material/CropFree'
import SelectAllIcon from '@mui/icons-material/SelectAll'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import SaveIcon from '@mui/icons-material/Save'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import { SvgIcon } from '@mui/material'
import { randomUUID } from '../../utils/randomUUID'
import { createAppDataApi, fetchAppDataByIdApi, updateAppDataApi } from '../../apis/appApi'
import { deleteFilesApi, uploadFileApiWithProgress } from '../../apis/fileApi'

const APP_ID = 12
const MENU_CD = 'draw'
const SAVE_PATH = 'draw'
const SKETCH_DOC_VERSION = 1

const DEFAULT_CANVAS_WIDTH = 900
const DEFAULT_CANVAS_HEIGHT = 600
const MIN_CANVAS_SIZE = 200
const MAX_CANVAS_SIZE = 4000
const DOT_SPACING = 20
const DOT_RADIUS = 1.2
const BRUSH_WIDTH = 18
const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const ZOOM_STEP = 0.25

type Tool = 'pencil' | 'brush' | 'line' | 'eraser' | 'select'

interface Point {
  x: number
  y: number
}

interface Stroke {
  id: string
  points: Point[]
  width: number
  color: string
  isEraser: boolean
  isBrush?: boolean
}

interface SketchDocument {
  version: number
  canvasWidth: number
  canvasHeight: number
  strokes: Stroke[]
}

interface ParsedSketchDocument {
  strokes: Stroke[]
  canvasWidth: number
  canvasHeight: number
}

function clampCanvasSize(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(MAX_CANVAS_SIZE, Math.max(MIN_CANVAS_SIZE, Math.round(value)))
}

function parseSizeParam(value: string | null, fallback: number): number {
  return clampCanvasSize(Number(value), fallback)
}

function isValidStroke(value: unknown): value is Stroke {
  if (!value || typeof value !== 'object') return false
  const stroke = value as Stroke
  return (
    typeof stroke.id === 'string' &&
    Array.isArray(stroke.points) &&
    typeof stroke.width === 'number' &&
    typeof stroke.color === 'string' &&
    typeof stroke.isEraser === 'boolean'
  )
}

function serializeSketchDocument(strokes: Stroke[], canvasWidth: number, canvasHeight: number): string {
  const doc: SketchDocument = {
    version: SKETCH_DOC_VERSION,
    canvasWidth,
    canvasHeight,
    strokes,
  }
  return JSON.stringify(doc)
}

function parseSketchDocument(content: string | null | undefined): ParsedSketchDocument {
  const empty: ParsedSketchDocument = {
    strokes: [],
    canvasWidth: DEFAULT_CANVAS_WIDTH,
    canvasHeight: DEFAULT_CANVAS_HEIGHT,
  }
  if (!content?.trim()) return empty
  try {
    const parsed = JSON.parse(content) as Partial<SketchDocument> | Stroke[]
    if (Array.isArray(parsed)) {
      return { ...empty, strokes: parsed.filter(isValidStroke) }
    }
    if (parsed && Array.isArray(parsed.strokes)) {
      return {
        strokes: parsed.strokes.filter(isValidStroke),
        canvasWidth: clampCanvasSize(Number(parsed.canvasWidth), DEFAULT_CANVAS_WIDTH),
        canvasHeight: clampCanvasSize(Number(parsed.canvasHeight), DEFAULT_CANVAS_HEIGHT),
      }
    }
  } catch {
    // 이전에 PNG만 저장된 항목 등
  }
  return empty
}

function EraserIcon() {
  return (
    <SvgIcon fontSize="small" viewBox="0 0 24 24">
      <path d="M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 0 1-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l9.19-9.19a4.008 4.008 0 0 1 2.83 0l1.41 1.59zM5.64 16.36l2.83 2.83 7.07-7.07-2.83-2.83-7.07 7.07z" />
    </SvgIcon>
  )
}

function drawNotebookBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save()
  ctx.fillStyle = '#fffef8'
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#c5c5c5'
  for (let x = DOT_SPACING; x < width; x += DOT_SPACING) {
    for (let y = DOT_SPACING; y < height; y += DOT_SPACING) {
      ctx.beginPath()
      ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function traceSmoothPath(ctx: CanvasRenderingContext2D, points: Point[]) {
  const first = points[0]
  if (!first || points.length < 2) return false

  const second = points[1]
  if (points.length === 2 && second) {
    ctx.beginPath()
    ctx.moveTo(first.x, first.y)
    ctx.lineTo(second.x, second.y)
    return true
  }

  ctx.beginPath()
  ctx.moveTo(first.x, first.y)

  for (let i = 1; i < points.length - 2; i += 1) {
    const current = points[i]
    const next = points[i + 1]
    if (!current || !next) continue
    const midX = (current.x + next.x) / 2
    const midY = (current.y + next.y) / 2
    ctx.quadraticCurveTo(current.x, current.y, midX, midY)
  }

  const secondLast = points[points.length - 2]
  const last = points[points.length - 1]
  if (secondLast && last) {
    ctx.quadraticCurveTo(secondLast.x, secondLast.y, last.x, last.y)
  }

  return true
}

function appendInterpolatedPoints(points: Point[], next: Point, step = 3) {
  const last = points[points.length - 1]
  if (!last) {
    points.push(next)
    return
  }

  const dist = Math.hypot(next.x - last.x, next.y - last.y)
  if (dist <= step) {
    points.push(next)
    return
  }

  const steps = Math.ceil(dist / step)
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps
    points.push({
      x: last.x + (next.x - last.x) * t,
      y: last.y + (next.y - last.y) * t,
    })
  }
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length < 2) return

  ctx.save()
  if (stroke.isEraser) {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = 'rgba(0,0,0,1)'
    ctx.lineWidth = stroke.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (traceSmoothPath(ctx, stroke.points)) {
      ctx.stroke()
    }
  } else if (stroke.isBrush) {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.shadowBlur = stroke.width * 0.3
    ctx.shadowColor = 'rgba(26, 26, 26, 0.45)'
    ctx.globalAlpha = 0.88
    if (traceSmoothPath(ctx, stroke.points)) {
      ctx.stroke()
    }
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (traceSmoothPath(ctx, stroke.points)) {
      ctx.stroke()
    }
  }
  ctx.restore()
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

function normalizeRect(start: Point, end: Point): Rect {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  return {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

function pointInRect(point: Point, rect: Rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

function rectsIntersect(a: Rect, b: Rect) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

function getStrokeBounds(stroke: Stroke): Rect | null {
  if (stroke.points.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  stroke.points.forEach((point) => {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  })
  const pad = stroke.width / 2
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  }
}

function getSelectionBounds(strokes: Stroke[], ids: string[]): Rect | null {
  let bounds: Rect | null = null
  ids.forEach((id) => {
    const stroke = strokes.find((s) => s.id === id)
    if (!stroke || stroke.isEraser) return
    const strokeBounds = getStrokeBounds(stroke)
    if (!strokeBounds) return
    if (!bounds) {
      bounds = { ...strokeBounds }
      return
    }
    const right = Math.max(bounds.x + bounds.width, strokeBounds.x + strokeBounds.width)
    const bottom = Math.max(bounds.y + bounds.height, strokeBounds.y + strokeBounds.height)
    bounds.x = Math.min(bounds.x, strokeBounds.x)
    bounds.y = Math.min(bounds.y, strokeBounds.y)
    bounds.width = right - bounds.x
    bounds.height = bottom - bounds.y
  })
  return bounds
}

function findStrokesInRect(strokes: Stroke[], rect: Rect) {
  if (rect.width < 1 && rect.height < 1) return []
  return strokes
    .filter((stroke) => !stroke.isEraser)
    .filter((stroke) => {
      const bounds = getStrokeBounds(stroke)
      if (!bounds) return false
      return rectsIntersect(bounds, rect)
    })
    .map((stroke) => stroke.id)
}

function drawSelectionRect(ctx: CanvasRenderingContext2D, rect: Rect) {
  if (rect.width < 1 && rect.height < 1) return
  ctx.save()
  ctx.fillStyle = 'rgba(25, 118, 210, 0.12)'
  ctx.strokeStyle = '#1976d2'
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 4])
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
  ctx.restore()
}

function drawStrokeHighlight(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  ctx.save()
  ctx.strokeStyle = '#1976d2'
  ctx.lineWidth = stroke.width + 4
  ctx.globalAlpha = 0.35
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (traceSmoothPath(ctx, stroke.points)) {
    ctx.stroke()
  }
  ctx.restore()
}

function exportSketchBlob(strokes: Stroke[], width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('캔버스를 사용할 수 없습니다.'))

  drawNotebookBackground(ctx, width, height)
  strokes.forEach((stroke) => drawStroke(ctx, stroke))

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('이미지보내기에 실패했습니다.'))
    }, 'image/png')
  })
}

function defaultSketchTitle(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `스케치_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`
}

export default function DrawWritePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { id: idParam } = useParams<{ id?: string }>()
  const editingDataId = idParam ? Number(idParam) : NaN
  const isEditingDocument = Boolean(idParam && !Number.isNaN(editingDataId))

  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef<Stroke[]>([])
  const currentStrokeRef = useRef<Stroke | null>(null)
  const isDrawingRef = useRef(false)
  const dragStartRef = useRef<Point | null>(null)
  const selectedStrokeSnapshotRef = useRef<Stroke[]>([])
  const selectedStrokeIdsRef = useRef<string[]>([])
  const marqueeRef = useRef<{ start: Point; end: Point } | null>(null)
  const isMarqueeSelectingRef = useRef(false)
  const isMovingSelectionRef = useRef(false)

  const [tool, setTool] = useState<Tool>('pencil')
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [loadingDoc, setLoadingDoc] = useState(isEditingDocument)
  const [documentTitle, setDocumentTitle] = useState('')
  const [existingFileId, setExistingFileId] = useState<number | null>(null)
  const [canvasEpoch, setCanvasEpoch] = useState(0)
  const [canvasWidth, setCanvasWidth] = useState(DEFAULT_CANVAS_WIDTH)
  const [canvasHeight, setCanvasHeight] = useState(DEFAULT_CANVAS_HEIGHT)
  const [zoom, setZoom] = useState(1)
  const viewportRef = useRef<HTMLDivElement | null>(null)

  const zoomIn = useCallback(() => {
    setZoom((value) => Math.min(ZOOM_MAX, Math.round((value + ZOOM_STEP) * 100) / 100))
  }, [])

  const zoomOut = useCallback(() => {
    setZoom((value) => Math.max(ZOOM_MIN, Math.round((value - ZOOM_STEP) * 100) / 100))
  }, [])

  const resetZoom = useCallback(() => {
    setZoom(1)
  }, [])

  const zoomPercentLabel = `${Math.round(zoom * 100)}%`

  const updateSelectedStrokeIds = useCallback((ids: string[]) => {
    selectedStrokeIdsRef.current = ids
    setSelectedStrokeIds(ids)
  }, [])

  const paintCanvas = useCallback(() => {
    const canvas = drawingCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    strokesRef.current.forEach((stroke) => {
      drawStroke(ctx, stroke)
    })

    selectedStrokeIdsRef.current.forEach((id) => {
      const selected = strokesRef.current.find((s) => s.id === id)
      if (selected && !selected.isEraser) {
        drawStrokeHighlight(ctx, selected)
      }
    })

    const selectionBounds = getSelectionBounds(strokesRef.current, selectedStrokeIdsRef.current)
    if (selectionBounds && !isMarqueeSelectingRef.current) {
      drawSelectionRect(ctx, selectionBounds)
    }

    if (marqueeRef.current) {
      drawSelectionRect(
        ctx,
        normalizeRect(marqueeRef.current.start, marqueeRef.current.end),
      )
    }

    const current = currentStrokeRef.current
    if (current) {
      drawStroke(ctx, current)
    }
  }, [canvasHeight, canvasWidth, selectedStrokeIds])

  useEffect(() => {
    if (isEditingDocument) return
    setCanvasWidth(parseSizeParam(searchParams.get('w'), DEFAULT_CANVAS_WIDTH))
    setCanvasHeight(parseSizeParam(searchParams.get('h'), DEFAULT_CANVAS_HEIGHT))
  }, [isEditingDocument, searchParams])

  useLayoutEffect(() => {
    const bgCanvas = backgroundCanvasRef.current
    if (!bgCanvas) return
    const bgCtx = bgCanvas.getContext('2d')
    if (!bgCtx) return
    drawNotebookBackground(bgCtx, canvasWidth, canvasHeight)
  }, [canvasWidth, canvasHeight])

  useEffect(() => {
    paintCanvas()
  }, [paintCanvas, canvasEpoch])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      if (event.deltaY < 0) zoomIn()
      else if (event.deltaY > 0) zoomOut()
    }

    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [zoomIn, zoomOut])

  useEffect(() => {
    if (!isEditingDocument) return
    let cancelled = false

    const load = async () => {
      setLoadingDoc(true)
      try {
        const row = await fetchAppDataByIdApi(editingDataId)
        if (cancelled) return
        if (!row || row.app_id !== APP_ID) {
          window.alert('스케치를 불러오지 못했습니다.')
          navigate('/draw')
          return
        }

        setDocumentTitle(row.ap_subject?.trim() || '')
        setExistingFileId(row.extra_5 ? Number(row.extra_5) || null : null)
        const parsed = parseSketchDocument(row.ap_content)
        strokesRef.current = parsed.strokes
        setCanvasWidth(parsed.canvasWidth)
        setCanvasHeight(parsed.canvasHeight)
        updateSelectedStrokeIds([])
        setCanvasEpoch((v) => v + 1)
      } catch (e) {
        console.error('스케치 편집 데이터 로드 실패:', e)
        if (!cancelled) {
          window.alert('스케치를 불러오지 못했습니다.')
          navigate('/draw')
        }
      } finally {
        if (!cancelled) setLoadingDoc(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [editingDataId, isEditingDocument, navigate, updateSelectedStrokeIds])

  useEffect(() => {
    const canvas = drawingCanvasRef.current
    if (!canvas) return

    const blockTouchScroll = (event: TouchEvent) => {
      event.preventDefault()
    }

    canvas.addEventListener('touchstart', blockTouchScroll, { passive: false })
    canvas.addEventListener('touchmove', blockTouchScroll, { passive: false })

    return () => {
      canvas.removeEventListener('touchstart', blockTouchScroll)
      canvas.removeEventListener('touchmove', blockTouchScroll)
    }
  }, [])

  const handleSelectAll = useCallback(() => {
    const ids = strokesRef.current
      .filter((stroke) => !stroke.isEraser)
      .map((stroke) => stroke.id)
    setTool('select')
    updateSelectedStrokeIds(ids)
  }, [updateSelectedStrokeIds])

  const handleDeleteSelected = useCallback(() => {
    if (selectedStrokeIdsRef.current.length === 0) return
    const selectedIds = new Set(selectedStrokeIdsRef.current)
    strokesRef.current = strokesRef.current.filter((stroke) => !selectedIds.has(stroke.id))
    updateSelectedStrokeIds([])
  }, [updateSelectedStrokeIds])

  const handleSave = useCallback(async () => {
    if (saving || loadingDoc) return
    const defaultTitle = documentTitle.trim() || defaultSketchTitle()
    const titleInput = window.prompt('저장할 제목을 입력하세요.', defaultTitle)
    if (titleInput == null) return
    const subject = titleInput.trim() || defaultTitle
    const sketchContent = serializeSketchDocument(strokesRef.current, canvasWidth, canvasHeight)

    setSaving(true)
    try {
      const blob = await exportSketchBlob(strokesRef.current, canvasWidth, canvasHeight)
      const fileName = `${subject.replace(/[^\w가-힣.-]+/g, '_')}.png`
      const file = new File([blob], fileName, { type: 'image/png' })

      let dataId = isEditingDocument ? editingDataId : 0
      if (!dataId) {
        const created = await createAppDataApi({
          app_id: APP_ID,
          ap_subject: subject,
          ap_content: sketchContent,
        })
        dataId = created.data_id ?? 0
        if (!dataId) throw new Error('데이터 생성에 실패했습니다.')
      }

      const res = await uploadFileApiWithProgress({
        file,
        menuCd: MENU_CD,
        dataId,
        fileNo: 1,
        fileType: 0,
        description: subject,
        save_path: SAVE_PATH,
      })

      if (existingFileId && existingFileId !== res.file_id) {
        try {
          await deleteFilesApi({ fileIds: [existingFileId] })
        } catch (e) {
          console.error('기존 미리보기 파일 삭제 실패:', e)
        }
      }

      await updateAppDataApi(dataId, {
        app_id: APP_ID,
        ap_subject: subject,
        ap_content: sketchContent,
        extra_1: res.file_url || '',
        extra_2: res.file_name || fileName,
        extra_3: String(res.filesize || file.size),
        extra_4: 'png',
        extra_5: String(res.file_id ?? ''),
      })

      navigate('/draw')
    } catch (e) {
      console.error('스케치 저장 실패:', e)
      window.alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }, [
    canvasWidth,
    canvasHeight,
    documentTitle,
    editingDataId,
    existingFileId,
    isEditingDocument,
    loadingDoc,
    navigate,
    saving,
  ])

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = drawingCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvasWidth / rect.width
    const scaleY = canvasHeight / rect.height
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    }
  }

  const beginPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!event.isPrimary) return
    event.preventDefault()

    const point = getCanvasPoint(event)
    event.currentTarget.setPointerCapture(event.pointerId)

    if (tool === 'select') {
      const selectionBounds = getSelectionBounds(strokesRef.current, selectedStrokeIdsRef.current)
      if (
        selectedStrokeIdsRef.current.length > 0 &&
        selectionBounds &&
        pointInRect(point, selectionBounds)
      ) {
        isMovingSelectionRef.current = true
        dragStartRef.current = point
        selectedStrokeSnapshotRef.current = strokesRef.current.map((stroke) => ({
          ...stroke,
          points: stroke.points.map((p) => ({ ...p })),
        }))
        return
      }

      isMarqueeSelectingRef.current = true
      marqueeRef.current = { start: point, end: point }
      updateSelectedStrokeIds([])
      dragStartRef.current = point
      paintCanvas()
      return
    }

    if (tool === 'line') {
      isDrawingRef.current = true
      currentStrokeRef.current = {
        id: randomUUID(),
        points: [point, { ...point }],
        width: 2,
        color: '#1a1a1a',
        isEraser: false,
      }
      updateSelectedStrokeIds([])
      paintCanvas()
      return
    }

    isDrawingRef.current = true
    currentStrokeRef.current = {
      id: randomUUID(),
      points: [point],
      width: tool === 'eraser' ? 24 : tool === 'brush' ? BRUSH_WIDTH : 2,
      color: '#1a1a1a',
      isEraser: tool === 'eraser',
      isBrush: tool === 'brush',
    }
    updateSelectedStrokeIds([])
    paintCanvas()
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    beginPointer(event)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!event.isPrimary) return
    event.preventDefault()

    const point = getCanvasPoint(event)

    if (tool === 'select' && isMovingSelectionRef.current && dragStartRef.current) {
      const dx = point.x - dragStartRef.current.x
      const dy = point.y - dragStartRef.current.y
      strokesRef.current = selectedStrokeSnapshotRef.current.map((stroke) => {
        if (!selectedStrokeIdsRef.current.includes(stroke.id)) return stroke
        return {
          ...stroke,
          points: stroke.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
        }
      })
      paintCanvas()
      return
    }

    if (tool === 'select' && isMarqueeSelectingRef.current && marqueeRef.current) {
      marqueeRef.current.end = point
      paintCanvas()
      return
    }

    if (tool === 'line' && isDrawingRef.current && currentStrokeRef.current) {
      const start = currentStrokeRef.current.points[0]
      if (start) {
        currentStrokeRef.current.points = [start, point]
      }
      paintCanvas()
      return
    }

    if (!isDrawingRef.current || !currentStrokeRef.current) return
    const step = currentStrokeRef.current.isBrush ? 2 : 3
    appendInterpolatedPoints(currentStrokeRef.current.points, point, step)
    paintCanvas()
  }

  const finishPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!event.isPrimary) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (tool === 'select') {
      if (isMovingSelectionRef.current) {
        isMovingSelectionRef.current = false
        dragStartRef.current = null
        selectedStrokeSnapshotRef.current = []
        paintCanvas()
        return
      }

      if (isMarqueeSelectingRef.current && marqueeRef.current) {
        const rect = normalizeRect(marqueeRef.current.start, marqueeRef.current.end)
        updateSelectedStrokeIds(findStrokesInRect(strokesRef.current, rect))
        marqueeRef.current = null
        isMarqueeSelectingRef.current = false
        dragStartRef.current = null
        paintCanvas()
      }
      return
    }

    if (tool === 'line') {
      if (isDrawingRef.current && currentStrokeRef.current) {
        const start = currentStrokeRef.current.points[0]
        const end = currentStrokeRef.current.points[1]
        if (start && end && Math.hypot(end.x - start.x, end.y - start.y) > 2) {
          strokesRef.current = [...strokesRef.current, currentStrokeRef.current]
        }
        currentStrokeRef.current = null
        isDrawingRef.current = false
        paintCanvas()
      }
      return
    }

    if (!isDrawingRef.current || !currentStrokeRef.current) return
    if (currentStrokeRef.current.points.length > 1) {
      strokesRef.current = [...strokesRef.current, currentStrokeRef.current]
    }
    currentStrokeRef.current = null
    isDrawingRef.current = false
    paintCanvas()
  }

  return (
    <Box
      sx={{
        p: { xs: 1, sm: 2, md: 3 },
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        minHeight: '100%',
        bgcolor: 'background.default',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: canvasWidth,
          borderRadius: 1,
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          bgcolor: '#fffef8',
          overflow: 'hidden',
        }}
      >
        <Box
          ref={viewportRef}
          sx={{
            width: '100%',
            height: 'min(70vh, 720px)',
            minHeight: 480,
            overflow: 'auto',
            position: 'relative',
          }}
        >
          <Box
            sx={{
              width: canvasWidth * zoom,
              height: canvasHeight * zoom,
              position: 'relative',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: canvasWidth,
                height: canvasHeight,
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
              }}
            >
              <canvas
                ref={backgroundCanvasRef}
                width={canvasWidth}
                height={canvasHeight}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  display: 'block',
                  width: canvasWidth,
                  height: canvasHeight,
                  pointerEvents: 'none',
                }}
              />
              <canvas
                ref={drawingCanvasRef}
                width={canvasWidth}
                height={canvasHeight}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishPointer}
                onPointerCancel={finishPointer}
                onPointerLeave={finishPointer}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  display: 'block',
                  width: canvasWidth,
                  height: canvasHeight,
                  cursor: 'crosshair',
                  touchAction: 'none',
                }}
              />
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            bottom: 8,
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            bgcolor: 'rgba(255,255,255,0.92)',
            borderRadius: 1,
            boxShadow: 1,
            p: 0.5,
            minHeight: 0,
            pointerEvents: loadingDoc ? 'none' : 'auto',
            opacity: loadingDoc ? 0.6 : 1,
            '@media (pointer: coarse)': {
              '& .MuiIconButton-root': {
                width: 44,
                height: 44,
              },
            },
          }}
        >
          <Tooltip title="연필" placement="right">
            <IconButton
              size="small"
              color={tool === 'pencil' ? 'primary' : 'default'}
              onClick={() => setTool('pencil')}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="붓" placement="right">
            <IconButton
              size="small"
              color={tool === 'brush' ? 'primary' : 'default'}
              onClick={() => setTool('brush')}
            >
              <BrushIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="직선" placement="right">
            <IconButton
              size="small"
              color={tool === 'line' ? 'primary' : 'default'}
              onClick={() => setTool('line')}
            >
              <HorizontalRuleIcon fontSize="small" sx={{ transform: 'rotate(-45deg)' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="지우개" placement="right">
            <IconButton
              size="small"
              color={tool === 'eraser' ? 'primary' : 'default'}
              onClick={() => setTool('eraser')}
            >
              <EraserIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="선택" placement="right">
            <IconButton
              size="small"
              color={tool === 'select' ? 'primary' : 'default'}
              onClick={() => setTool('select')}
            >
              <CropFreeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="전체 선택" placement="right">
            <IconButton size="small" onClick={handleSelectAll}>
              <SelectAllIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="삭제" placement="right">
            <IconButton
              size="small"
              color="error"
              onClick={handleDeleteSelected}
              disabled={selectedStrokeIds.length === 0}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="확대" placement="right">
            <IconButton size="small" onClick={zoomIn} disabled={zoom >= ZOOM_MAX}>
              <ZoomInIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="축소" placement="right">
            <IconButton size="small" onClick={zoomOut} disabled={zoom <= ZOOM_MIN}>
              <ZoomOutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={`배율 ${zoomPercentLabel} (클릭 시 100%)`} placement="right">
            <IconButton
              size="small"
              onClick={resetZoom}
              sx={{ fontSize: 11, fontWeight: 700, minWidth: 36 }}
            >
              {zoomPercentLabel}
            </IconButton>
          </Tooltip>
          <Box sx={{ flex: 1, minHeight: 8 }} />
          <Tooltip title="저장하기" placement="right">
            <IconButton
              size="small"
              color="primary"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? <CircularProgress size={18} /> : <SaveIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>

        {loadingDoc && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              bgcolor: 'rgba(255,255,255,0.72)',
            }}
          >
            <CircularProgress size={40} />
            <Typography variant="body2" color="text.secondary">
              스케치 불러오는 중…
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  )
}
