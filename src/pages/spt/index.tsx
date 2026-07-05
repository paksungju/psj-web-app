import {
  createRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Draggable from 'react-draggable'
import { ResizableBox } from 'react-resizable'
import LeaderLineLib from 'leader-line-new'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Switch,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import EditIcon from '@mui/icons-material/Edit'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import DOMPurify from 'dompurify'
import {
  fetchContentBlockData,
  getlineData,
  type IContentBlockModel,
  type IContentCateModel,
  positionSave,
  postlineDataSave,
} from '../../apis/contentBlockApi'
import {
  fetchSptContentCateGroupsApi,
  fetchSptContentCateItemsApi,
} from '../../apis/sptContentCateApi'
import ContentBlockModal from './contentBlockModal'
import ContentBlockListModal from './contentBlockList'
import {
  ColorCircle,
  ColorPickerContainer,
  PreviewBox,
  colors,
  drawerMenuContentStyle,
  drawerTabStyle,
} from './func'
import 'react-resizable/css/styles.css'
import './index.css'

type LeaderLineInstance = {
  remove: () => void
  position: () => void
  color?: string
  size?: number
  path?: string
  dash?: unknown
}

type LineEntry = {
  from: HTMLElement
  to: HTMLElement
  line: LeaderLineInstance
}

function newLineId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `leaderline-${crypto.randomUUID()}`
    : `leaderline-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function sanitizeHtmlContent(html: string): string {
  return DOMPurify.sanitize(html)
}

/** LeaderLine DOM이 붙은 뒤 SVG에 클릭 삭제 연결 (동작 확인된 패턴) */
function scheduleLeaderLineClickDelete(line: LeaderLineInstance, lineRef: MutableRefObject<LineEntry[]>, domIndex: number) {
  window.setTimeout(() => {
    const roots = document.querySelectorAll('.leader-line')
    const svg = roots[domIndex] as HTMLElement | SVGSVGElement | undefined
    const path = svg?.querySelector?.('path')

    if (svg && path) {
      const lineId = newLineId()
      svg.setAttribute('id', lineId)
      svg.style.pointerEvents = 'auto'
      svg.style.cursor = 'pointer'
      svg.style.zIndex = '0'
      path.style.pointerEvents = 'auto'

      svg.addEventListener('click', (e) => {
        e.stopPropagation()
        line.remove()
        lineRef.current = lineRef.current.filter((item) => item.line !== line)
      })
    } else {
      const fallback = document.querySelector('.leader-line:last-of-type') as HTMLElement | null
      const fbPath = fallback?.querySelector('path')
      if (fallback && fbPath) {
        const lineId = newLineId()
        fallback.setAttribute('id', lineId)
        fallback.style.pointerEvents = 'auto'
        fallback.style.cursor = 'pointer'
        fallback.style.zIndex = '0'
        fbPath.style.pointerEvents = 'auto'
        fallback.addEventListener('click', (e) => {
          e.stopPropagation()
          line.remove()
          lineRef.current = lineRef.current.filter((item) => item.line !== line)
        })
      } else {
        console.warn('leader-line path를 찾을 수 없습니다.')
      }
    }
  }, 150)
}

type MenuCateRow = IContentCateModel & { groupCateCd: string }

type RootCateGroup = {
  cateCd: string
  cateNm: string
  sortNo: number | null
}

type CateGroup = {
  cateNm: string
  groupCateCd: string
  items: Array<{ ciId: number | null; subject: string | null; cateCd?: string }>
}

type SavedLineRow = {
  from: string
  to: string
  color?: string
  size?: number | string
  path?: string
}

interface SptPageProps {
  title?: string
  description?: string
}

const LeaderLine = LeaderLineLib as unknown as new (
  start: HTMLElement,
  end: HTMLElement,
  options?: Record<string, unknown>,
) => LeaderLineInstance

function buildSptItemPath(groupCateCd: string, itemCateCd?: string, fallbackCiId?: number | null) {
  const cat1Part = encodeURIComponent(groupCateCd)
  const cat2Part = encodeURIComponent(itemCateCd || String(fallbackCiId ?? ''))
  return `/spt/${cat1Part}/${cat2Part}`
}

function copyTextToClipboard(text: string): boolean {
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', 'readonly')
    textarea.style.position = 'fixed'
    textarea.style.top = '0'
    textarea.style.left = '0'
    textarea.style.width = '2em'
    textarea.style.height = '2em'
    textarea.style.padding = '0'
    textarea.style.border = 'none'
    textarea.style.outline = 'none'
    textarea.style.boxShadow = 'none'
    textarea.style.background = 'transparent'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    if (ok) return true
  } catch {
    // fall through
  }
  return false
}

async function copySptItemLink(groupCateCd: string, itemCateCd?: string, fallbackCiId?: number | null) {
  const path = buildSptItemPath(groupCateCd, itemCateCd, fallbackCiId)
  const url = `${window.location.origin}${path}`

  if (copyTextToClipboard(url)) {
    alert('링크가 복사되었습니다.')
    return
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
      alert('링크가 복사되었습니다.')
      return
    }
  } catch {
    // fall through
  }

  alert('링크 복사에 실패했습니다.')
}

const icons = [<EditIcon key="edit" />, <AttachFileIcon key="attach" />]

// const HARD_CODED_CATE_DATA: IContentCateModel[] = [
//   {
//     ccId: 1,
//     ciId: 101,
//     subject: '시장 분석',
//     cateNm: '전략기획',
//   },
//   {
//     ccId: 2,
//     ciId: 102,
//     subject: '실행 계획',
//     cateNm: '전략기획',
//   },
//   {
//     ccId: 3,
//     ciId: 103,
//     subject: 'KIDS',
//     cateNm: '프로젝트',
//   },
// ]

/** psj_spt_content_cate 트리로 사이드 메뉴 구성 (블록 ci_id = cc_id) */
async function loadSptContentCateMenuRows(): Promise<{
  groups: RootCateGroup[]
  rows: MenuCateRow[]
}> {
  const groups = await fetchSptContentCateGroupsApi()

  const menuRows: MenuCateRow[] = []
  for (const g of groups) {
    const groupLabel = (g.cateNm || g.cateCd || '').trim() || '미분류'
    const depth1 = await fetchSptContentCateItemsApi(g.cateCd)
    for (const item of depth1) {
      const depth2 = await fetchSptContentCateItemsApi(item.cateCd)
      const leaves = depth2.length > 0 ? depth2 : [item]
      for (const leaf of leaves) {
        const cateCd = leaf.cateCd
        menuRows.push({
          ccId: leaf.ccId,
          ciId: leaf.ccId,
          subject: leaf.cateNm || leaf.cateCd || null,
          cateCd,
          cateNm: groupLabel,
          groupCateCd: g.cateCd,
        })
      }
    }
  }

  return {
    groups: groups.map((g) => ({
      cateCd: g.cateCd,
      cateNm: g.cateNm,
      sortNo: g.sortNo,
    })),
    rows: menuRows,
  }
}

export default function SptPage({
  title = 'SPT HOME',
  description = '전략기획툴 작업 화면입니다.',
}: SptPageProps) {
  const { cat1, cat2 } = useParams<{ cat1?: string; cat2?: string }>()
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [menuVisible, setMenuVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [selectedColor, setSelectedColor] = useState<string>(colors[0] ?? '#ccc')
  const [selectedCiId, setSelectedCiId] = useState<string | null>(null)
  const [rows, setRows] = useState<IContentBlockModel[]>([])
  const [angles, setAngles] = useState<number[]>([])
  const [lineDataRow, setLineDataRow] = useState<SavedLineRow[]>([])
  const [cateDataRow, setCateDataRow] = useState<MenuCateRow[]>([])
  const [rootGroups, setRootGroups] = useState<RootCateGroup[]>([])
  const [open, setOpen] = useState(false)
  const [contentBlockListOpen, setContentBlockListOpen] = useState(false)
  const [contentBlockEditBlock, setContentBlockEditBlock] = useState<IContentBlockModel | null>(null)
  const [listRefreshKey, setListRefreshKey] = useState(0)
  const [value, setValue] = useState(0)
  const [selectedPath, setSelectedPath] = useState('fluid')
  const [selectedLineStyle, setSelectedLineStyle] = useState('solid')
  const [selectedLineThickness, setSelectedLineThickness] = useState(2)
  const [lineChecked, setLineChecked] = useState(false)
  const [rotateChecked, setRotateChecked] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const lineRef = useRef<LineEntry[]>([])
  const itemRefs = useRef<Array<React.RefObject<HTMLDivElement>>>([])
  const [selectedRefs, setSelectedRefs] = useState<HTMLElement[]>([])

  const handleChange2 = (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : '')
  }

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    setPos({ x: event.pageX, y: event.pageY })
    setMenuVisible(true)
  }

  const handleClick = () => {
    setMenuVisible(false)
  }

  const openContentBlockModal = useCallback((block: IContentBlockModel | null = null) => {
    setContentBlockListOpen(false)
    setContentBlockEditBlock(block)
    setOpen(true)
  }, [])

  const openContentBlockListModal = useCallback(() => {
    setContentBlockListOpen(true)
  }, [])


  const allLinesRemove = useCallback(() => {
    lineRef.current.forEach(({ line }) => line.remove())
    lineRef.current = []
    setSelectedRefs([])
  }, [])

  const undoLastLine = useCallback(() => {
    if (lineRef.current.length === 0) return
    const last = lineRef.current.pop()
    last?.line.remove()
  }, [])

  const searchLineRowData = useCallback(async (id: string) => {
    try {
      const list = await getlineData({ ciId: id })
      const lineList = (Array.isArray(list) ? list : []) as SavedLineRow[]
      setLineDataRow(lineList)
    } catch (e) {
      console.error('라인 데이터 조회 실패:', e)
      setLineDataRow([])
    }
  }, [])

  const searchContentBlockRowData = useCallback(async (id: string) => {
    allLinesRemove()
    setLineDataRow([])
    setSelectedRefs([])
    setRows([])
    itemRefs.current = []
    try {
      const list = await fetchContentBlockData({ ciId: id })
      const safeRows: IContentBlockModel[] = (list ?? []).map((row) => ({
        ...row,
        cbId: String(row.cbId ?? '').trim(),
        cbSubject: String(row.cbSubject ?? '').trim(),
        cbContent: row.cbContent != null ? String(row.cbContent).trim() : row.cbContent,
        imgUrl: row.imgUrl != null ? String(row.imgUrl).trim() : row.imgUrl,
        coType: row.coType != null ? String(row.coType).trim() : row.coType,
        headerBg: row.headerBg != null ? String(row.headerBg).trim() : row.headerBg,
        bodyBg: row.bodyBg != null ? String(row.bodyBg).trim() : row.bodyBg,
      }))
      setRows(safeRows)
      setAngles(safeRows.map((row) => Number(row.imgAngle ?? 0)))
      itemRefs.current = safeRows.map(() => createRef<HTMLDivElement>())

      if (safeRows.length > 0) {
        window.setTimeout(() => {
          void searchLineRowData(id)
        }, 50)
      } else {
        setLineDataRow([])
      }
    } catch (e) {
      console.error('컨텐츠 블록 조회 실패:', e)
      setLineDataRow([])
    }
  }, [allLinesRemove, searchLineRowData])

  const openContentBlockEdit = useCallback((id: string) => {
    const detail = rows.find((row) => String(row.cbId) === id)
    if (!detail) return
    openContentBlockModal(detail)
  }, [rows, openContentBlockModal])

  const searchRowData = useCallback(async () => {
    try {
      const { groups, rows } = await loadSptContentCateMenuRows()
      setRootGroups(groups)
      setCateDataRow(rows)
      const groupNames = groups.map((g) => (g.cateNm || g.cateCd || '').trim() || '미분류')
      setExpanded((prev) =>
        prev && groupNames.includes(prev) ? prev : (groupNames[0] ?? ''),
      )
      if (!cat1) {
        const first = rows.find((r) => r.ciId != null) ?? rows[0]
        if (first?.ciId != null) {
          const id = String(first.ciId)
          setSelectedCiId(id)
          await searchContentBlockRowData(id)
        } else {
          setSelectedCiId(null)
          setRows([])
          setLineDataRow([])
          itemRefs.current = []
        }
      }
    } catch (e) {
      console.error('SPT 분류 목록 로드 실패:', e)
      setRootGroups([])
      setCateDataRow([])
      setSelectedCiId(null)
      setRows([])
      setLineDataRow([])
    }
  }, [searchContentBlockRowData, cat1])

  useEffect(() => {
    void searchRowData()
  }, [searchRowData])

  useEffect(() => {
    if (!cat1 || cateDataRow.length === 0) return
    const decodedCat1 = decodeURIComponent(cat1)
    const matchGroup = rootGroups.find((g) => g.cateCd === decodedCat1)
    if (matchGroup) {
      const groupLabel = (matchGroup.cateNm || matchGroup.cateCd || '').trim() || '미분류'
      setExpanded(groupLabel)
      if (cat2) {
        const decodedCat2 = decodeURIComponent(cat2)
        const matchItem = cateDataRow.find(
          (r) => r.groupCateCd === matchGroup.cateCd && r.cateCd === decodedCat2,
        )
        if (matchItem) {
          const nextId = matchItem.ciId != null ? String(matchItem.ciId) : null
          if (nextId && selectedCiId !== nextId) {
            setSelectedCiId(nextId)
            void searchContentBlockRowData(nextId)
          } else if (!nextId) {
            setSelectedCiId(null)
            setRows([])
            setLineDataRow([])
            itemRefs.current = []
          }
        }
      }
    }
  }, [cat1, cat2, cateDataRow, rootGroups, selectedCiId, searchContentBlockRowData])

  const grouped = useMemo<CateGroup[]>(() => {
    return rootGroups.map((g) => {
      const groupLabel = (g.cateNm || g.cateCd || '').trim() || '미분류'
      const items = cateDataRow
        .filter((r) => r.groupCateCd === g.cateCd)
        .map((r) => ({
          ciId: r.ciId,
          subject: r.subject,
          cateCd: r.cateCd,
        }))
      return { cateNm: groupLabel, groupCateCd: g.cateCd, items }
    })
  }, [rootGroups, cateDataRow])

  const isMenuItemSelected = useCallback(
    (groupCateCd: string, itemCateCd?: string, itemCiId?: number | null) => {
      if (cat1 && cat2 && itemCateCd) {
        return decodeURIComponent(cat1) === groupCateCd && decodeURIComponent(cat2) === itemCateCd
      }
      return itemCiId != null && selectedCiId === String(itemCiId)
    },
    [cat1, cat2, selectedCiId],
  )

  const selectedCategoryLabel = useMemo(() => {
    if (!selectedCiId) return ''
    const row = cateDataRow.find((r) => r.ciId != null && String(r.ciId) === selectedCiId)
    if (!row) return ''
    const depth1 = String(row.cateNm ?? '').trim()
    const depth2 = String(row.subject ?? '').trim()
    if (depth1 && depth2) return `${depth1} > ${depth2}`
    return depth2 || depth1
  }, [cateDataRow, selectedCiId])

  const drawSavedLines = useCallback(() => {
    if (!lineDataRow.length) return
    lineDataRow.forEach(({ from, to, color, size, path }) => {
      const fromEl = document.getElementById(`resizable_${from}`)
      const toEl = document.getElementById(`resizable_${to}`)
      if (!fromEl || !toEl) return

      const domIndex = document.querySelectorAll('.leader-line').length
      const line = new LeaderLine(fromEl, toEl, {
        size: Number(size ?? 2),
        color: color ?? selectedColor,
        path: path ?? selectedPath,
        dash: false,
        startPlug: 'behind',
        endPlug: 'arrow',
      })
      scheduleLeaderLineClickDelete(line, lineRef, domIndex)
      lineRef.current.push({ from: fromEl, to: toEl, line })
    })
  }, [lineDataRow, selectedColor, selectedPath])

  useEffect(() => {
    allLinesRemove()
    const timer = window.setTimeout(() => {
      drawSavedLines()
    }, 50)
    return () => {
      window.clearTimeout(timer)
    }
  }, [drawSavedLines, allLinesRemove])

  const dashOption =
    selectedLineStyle === 'solid'
      ? false
      : selectedLineStyle === 'dashed'
        ? { animation: false }
        : { len: 2, gap: 6, animation: false }

  const handleClickCreateLine = (event: React.MouseEvent<HTMLDivElement>, index: string) => {
    if (!lineChecked) return
    event.stopPropagation()

    const target = event.target as HTMLElement
    if (target.classList.contains('drag-handle')) return

    const resizableEl = document.getElementById(`resizable_${index}`)
    if (!resizableEl) return
    if (selectedRefs.includes(resizableEl)) return

    const newSelectedRefs = [...selectedRefs, resizableEl]
    setSelectedRefs(newSelectedRefs)

    if (newSelectedRefs.length === 2) {
      const from = newSelectedRefs[0]
      const to = newSelectedRefs[1]
      if (from && to) {
        const domIndex = document.querySelectorAll('.leader-line').length
        const line = new LeaderLine(from, to, {
          size: selectedLineThickness,
          color: selectedColor,
          path: selectedPath,
          dash: dashOption,
          startPlug: 'behind',
          endPlug: 'arrow',
        })
        scheduleLeaderLineClickDelete(line, lineRef, domIndex)
        lineRef.current.push({ from, to, line })
      }
      setSelectedRefs([])
    }
  }

  const handleMouseDown = (index: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (!rotateChecked) return
    e.preventDefault()
    const startX = e.clientX
    const startAngle = angles[index] ?? 0

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX
      const newAngle = startAngle + dx / 5
      setAngles((prev) => {
        const next = [...prev]
        next[index] = newAngle
        return next
      })
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleSavePositions = async () => {
    const saveList = rows
      .map((row, index) => {
        const el = document.getElementById(`item_${row.cbId}`)
        const rel = document.getElementById(`resizable_${row.cbId}`)
        if (!el || !rel) return null

        const rect = el.getBoundingClientRect()
        const parentRect = el.parentElement?.getBoundingClientRect()
        const relRect = rel.getBoundingClientRect()
        return {
          cbId: row.cbId,
          topP: Math.round(rect.top - (parentRect?.top || 0)),
          leftP: Math.round(rect.left - (parentRect?.left || 0)),
          width: Math.round(relRect.width),
          height: Math.round(relRect.height),
          imgAngle: parseFloat(String(angles[index] ?? 0)),
        }
      })
      .filter(Boolean)

    try {
      const ret = await positionSave(saveList as Array<Record<string, unknown>>)
      if (ret?.code === '0') {
        await lineDataSave()
      } else {
        alert(`저장 실패: ${ret?.msg ?? ''}`)
      }
    } catch (error) {
      console.error('위치 저장 실패:', error)
      alert('위치 저장 중 오류가 발생했습니다.')
    }
  }

  const extractConnectionsData = () => {
    return lineRef.current.map(({ from, to, line }) => ({
      from: from.id.replace('resizable_', ''),
      to: to.id.replace('resizable_', ''),
      color: line?.color,
      size: line?.size,
      path: line?.path,
      dash: line?.dash,
    }))
  }

  const lineDataSave = async () => {
    const ciIdForLine = selectedCiId
    if (!ciIdForLine) {
      alert('카테고리를 선택한 후 저장해주세요.')
      return
    }
    try {
      setIsSaving(true)
      const res = await postlineDataSave({
        ciId: ciIdForLine,
        lineObject: extractConnectionsData(),
      })
      if (res?.code !== '0') {
        alert(res?.msg || '라인 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('라인 저장 실패:', error)
      alert('라인 저장 중 오류가 발생했습니다.')
    } finally {
      window.setTimeout(() => setIsSaving(false), 1000)
    }
  }

  const actionMap: Record<string, () => void> = {
    저장하기: () => { void handleSavePositions() },
    라인저장: () => { void lineDataSave() },
    붙여넣기: () => alert('붙여넣기!'),
    선전체지움: () => allLinesRemove(),
    마지막선취소: () => undoLastLine(),
  }

  return (
    <>
      <div className="contentWrap" onClick={handleClick} onContextMenu={handleContextMenu}>

{/* ######################################################################################################################### */}
   {/* 컨텐츠 블록 출력 스페이스 시작 */}
{/* ######################################################################################################################### */}

        {rows.map((row, index) => {
          const isImageBlock = row.coType === 'C03' || row.coType === '03'
          const showHeader = Number(row.headerYn ?? 1) !== 0
          const hdrBg = row.headerBg?.trim() ? row.headerBg : '#ebebeb'
          const bodBg = row.bodyBg?.trim() ? row.bodyBg : '#fff'
          const bt = Number(row.borderTk ?? 0)
          const br = Number(row.borderR ?? 0)
          const gd = Number(row.borderGd ?? 0)
          const cardOutline = gd > 0 ? `${gd}px solid rgba(0,0,0,0.12)` : undefined
          return (
          <Draggable
            key={row.cbId}
            nodeRef={itemRefs.current[index]}
            handle=".drag-handle"
            bounds="parent"
            onDrag={() => {
              const movedEl = document.getElementById(`resizable_${row.cbId}`)
              lineRef.current.forEach(({ from, to, line }) => {
                if (from === movedEl || to === movedEl) line.position()
              })
            }}
          >
            <div
              ref={itemRefs.current[index]}
              style={{
                position: 'absolute',
                top: `${row.topP}px`,
                left: `${row.leftP}px`,
                width: `${row.width ?? 100}px`,
                height: `${row.height ?? 100}px`,
                zIndex: row.zindex,
                textAlign: isImageBlock ? 'center' : 'left',
                lineHeight: isImageBlock ? '28px' : 'normal',
                cursor: 'default',
              }}
              onClick={(event) => handleClickCreateLine(event, row.cbId)}
              id={`item_${row.cbId}`}
            >
              <ResizableBox
                width={Number(row.width ?? 100)}
                height={Number(row.height ?? 100)}
                minConstraints={[10, 10]}
                resizeHandles={['se']}
                onResize={() => {
                  const resizedEl = document.getElementById(`resizable_${row.cbId}`)
                  lineRef.current.forEach(({ from, to, line }) => {
                    if (from === resizedEl || to === resizedEl) line.position()
                  })
                }}
                style={{
                  position: 'absolute',
                  background: bodBg,
                  boxSizing: 'border-box',
                  border: bt > 0 ? `${bt}px solid #cfcfcf` : undefined,
                  borderRadius: br > 0 ? `${br}px` : undefined,
                  outline: cardOutline,
                  overflow: 'hidden',
                }}
              >
                <div
                  id={`resizable_${row.cbId}`}
                  style={{ height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}
                >
                  {showHeader ? (
                    <div
                      className="drag-handle"
                      style={{
                        position: 'relative',
                        height: '34px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box',
                        background: hdrBg,
                        cursor: 'move',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        borderRadius: br > 0 ? `${Math.min(br, 12)}px ${Math.min(br, 12)}px 0 0` : '8px 8px 0 0',
                      }}
                    >
                      <span
                        style={{
                          width: '100%',
                          padding: '0 40px',
                          textAlign: 'center',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          boxSizing: 'border-box',
                        }}
                      >
                        {row.cbSubject}
                      </span>
                      <IconButton
                        size="small"
                        sx={{
                          position: 'absolute',
                          right: 2,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          padding: '4px',
                          '& svg': { fontSize: '18px' },
                        }}
                        onClick={() => {
                          openContentBlockEdit(String(row.cbId))
                        }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </div>
                  ) : null}
                  <div
                    className={showHeader ? undefined : 'drag-handle'}
                    style={{
                      flex: 1,
                      background: bodBg,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      borderRadius: '2px',
                      position: 'relative',
                      cursor: showHeader ? undefined : 'move',
                    }}
                  >
                    {!showHeader ? (
                      <IconButton
                        size="small"
                        sx={{
                          position: 'absolute',
                          right: 2,
                          top: 4,
                          zIndex: 2,
                          padding: '4px',
                          '& svg': { fontSize: '18px' },
                        }}
                        onClick={() => {
                          openContentBlockEdit(String(row.cbId))
                        }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    ) : null}
                    <div
                      onMouseDown={(e) => handleMouseDown(index, e)}
                      style={{
                        transform: `rotate(${angles[index] ?? 0}deg)`,
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: isImageBlock ? 'center' : 'flex-start',
                        justifyContent: isImageBlock ? 'center' : 'flex-start',
                        userSelect: 'none',
                        cursor: 'grab',
                        width: '100%',
                        height: '100%',
                      }}
                    >
                      {isImageBlock ? (
                        row.linkUrl ? (
                          <a
                            href={row.linkUrl}
                            target={row.linkTarget === '_blank' ? '_blank' : '_self'}
                            rel={row.linkTarget === '_blank' ? 'noopener noreferrer' : undefined}
                            style={{ display: 'block', width: '100%', height: '100%' }}
                          >
                            <img src={row.imgUrl} alt="content" style={{ width: '100%', height: '100%' }} />
                          </a>
                        ) : (
                          <img src={row.imgUrl} alt="content" style={{ width: '100%', height: '100%' }} />
                        )
                      ) : row.coType === 'C01' || row.coType === '01' ? (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            overflow: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            boxSizing: 'border-box',
                          }}
                        >
                          {String(row.cbContent ?? '')}
                        </div>
                      ) : row.coType === 'C02' || row.coType === '02' ? (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            overflow: 'auto',
                            wordBreak: 'break-word',
                            boxSizing: 'border-box',
                          }}
                          dangerouslySetInnerHTML={{ __html: sanitizeHtmlContent(String(row.cbContent ?? '')) }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                          {String(row.cbContent ?? '')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </ResizableBox>
            </div>
          </Draggable>
          )
        })}
{/* ######################################################################################################################### */}
   {/* 컨텐츠 블록 출력 스페이스 종료 */}
{/* ######################################################################################################################### */}

        <div style={{
          position: 'fixed',
          top: '16px',
          right: isOpen ? '16px' : '-295px',
          width: '330px',
          height: 'calc(100vh - 32px)',
          transition: 'right 0.3s ease',
          display: 'flex',
          overflow: 'auto',
          zIndex: '100',
        }}>
          <div style={drawerTabStyle as CSSProperties} onClick={() => setIsOpen((prev) => !prev)}>
            {isOpen ? '닫기' : '열기'}
          </div>
          <div style={drawerMenuContentStyle as CSSProperties}>
            <Box sx={{ width: '200px', typography: 'body1', p: 1 }}>
              <Tabs value={value} onChange={(_, newValue) => setValue(newValue)} sx={{ minHeight: '28px', borderBottom: '2px solid gray' }}>
                <Tab label="메뉴" sx={{ minWidth: '64px', minHeight: '28px', padding: '0px' }} />
                <Tab label="LINE" sx={{ minWidth: '64px', minHeight: '28px', padding: '0px' }} />
                <Tab label="설정" sx={{ minWidth: '64px', minHeight: '28px', padding: '0px' }} />
              </Tabs>

              <Box sx={{ mt: 2 }}>
                {value === 0 && (
                  <Typography component="div">
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>{title}</Typography>
                    <Typography variant="caption" color="text.secondary">{description}</Typography>
{/* ######################################################################################################################### */}
   {/* SIDE MENU 시작 */}
{/* ######################################################################################################################### */}
                    <div style={{ marginTop: 12 }}>
                      {grouped.map((category) => (
                        <Accordion key={category.groupCateCd} expanded={expanded === category.cateNm} onChange={handleChange2(category.cateNm)} disableGutters square>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography>{category.cateNm}</Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            {category.items.length > 0 ? (
                              <List dense disablePadding>
                                {category.items.map((item, index) => (
                                  <ListItem key={`item-${item.cateCd ?? item.ciId ?? index}`} disablePadding>
                                    <ListItemText
                                      onClick={() => {
                                        const path = buildSptItemPath(
                                          category.groupCateCd || category.cateNm,
                                          item.cateCd,
                                          item.ciId,
                                        )
                                        navigate(path, { replace: true })
                                        if (item.ciId != null) {
                                          const nextId = String(item.ciId)
                                          if (selectedCiId !== nextId) {
                                            setSelectedCiId(nextId)
                                            void searchContentBlockRowData(nextId)
                                          }
                                        } else {
                                          setSelectedCiId(null)
                                          allLinesRemove()
                                          setRows([])
                                          setLineDataRow([])
                                          itemRefs.current = []
                                        }
                                      }}
                                      primary={(
                                        <span style={{ color: 'black', paddingLeft: '15px', fontWeight: isMenuItemSelected(category.groupCateCd, item.cateCd, item.ciId) ? 'bold' : 'normal', cursor: 'pointer' }}>
                                          {item.subject}
                                        </span>
                                      )}
                                    />
                                    {item.subject &&
                                      isMenuItemSelected(category.groupCateCd, item.cateCd, item.ciId) &&
                                      item.ciId != null &&
                                      icons.map((icon, i) => (
                                        <IconButton
                                          key={`icon-${item.ciId}-${i}`}
                                          size="small"
                                          sx={{ padding: '2px', '& svg': { fontSize: '16px' } }}
                                          onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            if (i === 0) {
                                              setOpen(false)
                                              setContentBlockEditBlock(null)
                                              openContentBlockListModal()
                                            } else {
                                              void copySptItemLink(
                                                category.groupCateCd || category.cateNm,
                                                item.cateCd,
                                                item.ciId,
                                              )
                                            }
                                          }}
                                        >
                                          {icon}
                                        </IconButton>
                                      ))}
                                  </ListItem>
                                ))}
                              </List>
                            ) : (
                              <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                                하위 항목 없음
                              </Typography>
                            )}
                          </AccordionDetails>
                        </Accordion>
                      ))}
                    </div>
{/* ######################################################################################################################### */}
   {/* SIDE MENU 종료 */}
{/* ######################################################################################################################### */}
                    <p style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                      <Button variant="contained" color="info" size="small" onClick={() => openContentBlockModal(null)}>등록하기</Button>
                      <Button variant="contained" color="info" size="small" onClick={() => openContentBlockListModal()}>다중등록</Button>
                    </p>
                  </Typography>
                )}

                {value === 1 && (
                  <Typography component="div">
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            선긋기
                          </Typography>
                          <FormControlLabel control={<Switch checked={lineChecked} onChange={(e) => setLineChecked(e.target.checked)} />} label={lineChecked ? 'ON' : 'OFF'} />
                        </div>
                        {lineChecked && (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            블록 2개를 클릭하면 선이 연결됩니다
                          </Typography>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            회전여부
                          </Typography>
                          <FormControlLabel control={<Switch checked={rotateChecked} onChange={(e) => setRotateChecked(e.target.checked)} />} label={rotateChecked ? 'ON' : 'OFF'} />
                        </div>
                        {rotateChecked && (
                          <Typography variant="caption" sx={{ mb: 1, color: 'text.secondary' }}>
                            블록 본문에서 마우스를 좌우로 드래그하면 회전합니다
                          </Typography>
                        )}
                      </div>
                    </div>
                    <div>
                      컬러 선택:
                      <ColorPickerContainer>
                        {colors.map((color) => (
                          <ColorCircle key={color} color={color} selected={color === selectedColor} onClick={() => setSelectedColor(color)} />
                        ))}
                      </ColorPickerContainer>
                      선택된 색상: <span style={{ color: selectedColor }}>{selectedColor}</span>
                      <PreviewBox color={selectedColor || '#ccc'} />
                    </div>

                    <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                      <InputLabel id="path-select-label">선 경로</InputLabel>
                      <Select labelId="path-select-label" value={selectedPath} label="선 경로" onChange={(e) => setSelectedPath(String(e.target.value))}>
                        <MenuItem value="fluid">Fluid (곡선)</MenuItem>
                        <MenuItem value="grid">Grid (직각)</MenuItem>
                        <MenuItem value="straight">Straight (직선)</MenuItem>
                      </Select>
                    </FormControl>

                    <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                      <InputLabel id="style-select-label">선 종류</InputLabel>
                      <Select labelId="style-select-label" value={selectedLineStyle} label="선 종류" onChange={(e) => setSelectedLineStyle(String(e.target.value))}>
                        <MenuItem value="solid">실선</MenuItem>
                        <MenuItem value="dashed">점선</MenuItem>
                        <MenuItem value="dotted">점점선</MenuItem>
                      </Select>
                    </FormControl>

                    <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                      <InputLabel id="thickness-select-label">선 두께</InputLabel>
                      <Select labelId="thickness-select-label" value={selectedLineThickness} label="선 두께" onChange={(e) => setSelectedLineThickness(Number(e.target.value))}>
                        {[1, 2, 3, 4, 5].map((thickness) => (
                          <MenuItem key={thickness} value={thickness}>{thickness}px</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Typography>
                )}

                {value === 2 && (
                  <Typography variant="body2" color="text.secondary">
                    설정 화면은 준비 중입니다.
                  </Typography>
                )}
              </Box>
            </Box>
          </div>
        </div>

        {menuVisible && (
          <ul className="context-menu" style={{ position: 'absolute', top: pos.y, left: pos.x }}>
            {['저장하기', '라인저장', '붙여넣기', '선전체지움', '마지막선취소'].map((label, index) => (
              <li
                key={index}
                onClick={() => actionMap[label]?.()}
                style={{ padding: '5px 20px', cursor: 'default', whiteSpace: 'nowrap' }}
              >
                {label}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ContentBlockModal
        open={open}
        onClose={() => {
          setOpen(false)
          setContentBlockEditBlock(null)
        }}
        selectedCiId={selectedCiId}
        initialBlock={contentBlockEditBlock}
        onSaved={async () => {
          if (selectedCiId) {
            await searchContentBlockRowData(selectedCiId)
          }
          setListRefreshKey((k) => k + 1)
        }}
      />

      <ContentBlockListModal
        open={contentBlockListOpen}
        onClose={() => setContentBlockListOpen(false)}
        selectedCiId={selectedCiId}
        selectedCategoryLabel={selectedCategoryLabel}
        onSaved={async () => {
          if (selectedCiId) {
            await searchContentBlockRowData(selectedCiId)
          }
        }}
        onViewBlock={(block) => {
          setContentBlockEditBlock(block)
          setOpen(true)
        }}
        refreshKey={listRefreshKey}
      />

      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          opacity: isSaving ? 1 : 0,
          visibility: isSaving ? 'visible' : 'hidden',
          transition: 'opacity 0.3s ease-in-out, visibility 0.3s ease-in-out',
        }}
      >
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <CircularProgress />
          <span>라인 정보 저장 중...</span>
        </div>
      </div>
    </>
  )
}