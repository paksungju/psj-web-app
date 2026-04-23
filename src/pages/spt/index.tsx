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
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import DOMPurify from 'dompurify'
import Modal from '../../components/Modal'
import {
  contentBlockdelUpdate,
  fetchContentBlockData,
  getlineData,
  type IContentBlockModel,
  type IContentCateModel,
  positionSave,
  postContentBlockSave,
  postlineDataSave,
} from '../../apis/contentBlockApi'
import {
  fetchSptContentCateGroupsApi,
  fetchSptContentCateItemsApi,
} from '../../apis/sptContentCateApi'
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

type CateGroup = {
  cateNm: string
  items: Array<{ ciId: number | null; subject: string | null }>
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

/** psj_spt_content_cate API → 사이드 메뉴용 IContentCateModel (ciId는 블록 조회용으로 ccId와 동일 사용) */
async function loadSptContentCateMenuRows(): Promise<IContentCateModel[]> {
  const groups = await fetchSptContentCateGroupsApi()
  const rows: IContentCateModel[] = []
  for (const g of groups) {
    const groupLabel = (g.cateNm || g.cateCd || '').trim() || '미분류'
    const depth1 = await fetchSptContentCateItemsApi(g.cateCd)
    for (const item of depth1) {
      rows.push({
        ccId: item.ccId,
        ciId: item.ccId,
        subject: item.cateNm || item.cateCd || null,
        cateCd: item.cateCd,
        cateNm: groupLabel,
      })
      const depth2 = await fetchSptContentCateItemsApi(item.cateCd)
      for (const sub of depth2) {
        rows.push({
          ccId: sub.ccId,
          ciId: sub.ccId,
          subject: sub.cateNm || sub.cateCd || null,
          cateCd: sub.cateCd,
          cateNm: groupLabel,
        })
      }
    }
  }
  return rows
}

export default function SptPage({
  title = 'SPT HOME',
  description = '전략기획툴 작업 화면입니다.',
}: SptPageProps) {
  const [expanded, setExpanded] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [menuVisible, setMenuVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [selectedColor, setSelectedColor] = useState<string>(colors[0] ?? '#ccc')
  const [selectedCiId, setSelectedCiId] = useState<string | null>(null)
  const [rows, setRows] = useState<IContentBlockModel[]>([])
  const [angles, setAngles] = useState<number[]>([])
  const [lineDataRow, setLineDataRow] = useState<SavedLineRow[]>([])
  const [cateDataRow, setCateDataRow] = useState<IContentCateModel[]>([])
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(0)
  const [selectedPath, setSelectedPath] = useState('fluid')
  const [selectedLineStyle, setSelectedLineStyle] = useState('solid')
  const [selectedLineThickness, setSelectedLineThickness] = useState(2)
  const [lineChecked, setLineChecked] = useState(false)
  const [rotateChecked, setRotateChecked] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [cbId, setCbId] = useState('')
  const [cbSubject, setCbSubject] = useState('')
  const [cbContent, setCbContent] = useState('')
  const [coType, setCoType] = useState('C01')
  const [imgUrl, setImgUrl] = useState('')
  const [topP, setTopP] = useState('100')
  const [leftP, setLeftP] = useState('100')
  const [blockWidth, setBlockWidth] = useState('100')
  const [blockHeight, setBlockHeight] = useState('100')
  const [headerYn, setHeaderYn] = useState('1')
  const [headerBg, setHeaderBg] = useState('')
  const [borderTk, setBorderTk] = useState('0')
  const [borderR, setBorderR] = useState('0')
  const [borderGd, setBorderGd] = useState('0')
  const [bodyBg, setBodyBg] = useState('')
  const [showTextColorPalette, setShowTextColorPalette] = useState(false)

  const htmlEditor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      TextStyle,
      Color,
    ],
    content: cbContent || '',
    editorProps: {
      attributes: {
        class: 'tiptap-content',
      },
    },
    onUpdate: ({ editor }) => {
      if (coType === 'C02') {
        setCbContent(editor.getHTML())
      }
    },
  })
  const textEditor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bold: false,
        italic: false,
        strike: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        horizontalRule: false,
      }),
    ],
    content: cbContent || '',
    editorProps: {
      attributes: {
        class: 'tiptap-content',
      },
    },
    onUpdate: ({ editor }) => {
      if (coType === 'C01') {
        setCbContent(editor.getText({ blockSeparator: '\n' }))
      }
    },
  })

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

  useEffect(() => {
    if (!htmlEditor || coType !== 'C02') return
    const current = htmlEditor.getHTML()
    if (current !== (cbContent || '')) {
      htmlEditor.commands.setContent(cbContent || '', { emitUpdate: false })
    }
  }, [htmlEditor, cbContent, coType])

  useEffect(() => {
    if (!textEditor || coType !== 'C01') return
    const current = textEditor.getText({ blockSeparator: '\n' })
    if (current !== (cbContent || '')) {
      textEditor.commands.setContent(cbContent || '', { emitUpdate: false })
    }
  }, [textEditor, cbContent, coType])

  const handleSetEditorLink = () => {
    if (!htmlEditor) return
    const previousUrl = htmlEditor.getAttributes('link').href as string | undefined
    const url = window.prompt('링크 URL을 입력하세요.', previousUrl || '')
    if (url === null) return
    const normalized = url.trim()
    if (!normalized) {
      htmlEditor.chain().focus().unsetLink().run()
      return
    }
    htmlEditor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run()
  }

  const handleSetEditorTextColor = (color: string) => {
    if (!htmlEditor) return
    htmlEditor.chain().focus().setColor(color).run()
    setShowTextColorPalette(false)
  }

  const handleUnsetEditorTextColor = () => {
    if (!htmlEditor) return
    htmlEditor.chain().focus().unsetColor().run()
    setShowTextColorPalette(false)
  }

  const activeTextColor = (htmlEditor?.getAttributes('textStyle').color as string | undefined) || ''
  const textColorPalette = ['#0f172a', '#334155', '#64748b', '#ef4444', '#f59e0b', '#16a34a', '#2563eb', '#7c3aed']

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
    setRows([])
    itemRefs.current = []
    setCbId('')
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

  const getContentBlockDetail = useCallback(async (id: string) => {
    const detail = rows.find((row) => String(row.cbId) === id)
    if (!detail) return

    setCoType(String(detail.coType ?? 'C01').trim() || 'C01')
    setCbId(String(detail.cbId ?? '').trim())
    setCbSubject(String(detail.cbSubject ?? '').trim())
    setCbContent(String(detail.cbContent ?? '').trim())
    setImgUrl(String(detail.imgUrl ?? '').trim())
    setTopP(String(detail.topP ?? 100))
    setLeftP(String(detail.leftP ?? 100))
    setBlockWidth(String(detail.width ?? 100))
    setBlockHeight(String(detail.height ?? 100))
    setHeaderYn(String(detail.headerYn ?? 1))
    setHeaderBg(String(detail.headerBg ?? '').trim())
    setBorderTk(String(detail.borderTk ?? 0))
    setBorderR(String(detail.borderR ?? 0))
    setBorderGd(String(detail.borderGd ?? 0))
    setBodyBg(String(detail.bodyBg ?? '').trim())
  }, [rows])

  const searchRowData = useCallback(async () => {
    try {
      const rows = await loadSptContentCateMenuRows()
      setCateDataRow(rows)
      const first = rows.find((r) => r.ciId != null)
      if (first?.ciId != null) {
        const id = String(first.ciId)
        const groupNames = [...new Set(rows.map((r) => r.cateNm).filter(Boolean))]
        setExpanded((prev) =>
          prev && groupNames.includes(prev) ? prev : (groupNames[0] ?? ''),
        )
        setSelectedCiId(id)
        await searchContentBlockRowData(id)
      } else {
        setExpanded('')
        setSelectedCiId(null)
        setRows([])
        setLineDataRow([])
        itemRefs.current = []
      }
    } catch (e) {
      console.error('SPT 분류 목록 로드 실패:', e)
      setCateDataRow([])
      setSelectedCiId(null)
      setRows([])
      setLineDataRow([])
    }
  }, [searchContentBlockRowData])

  useEffect(() => {
    void searchRowData()
  }, [searchRowData])

  const grouped = useMemo<CateGroup[]>(() => {
    return Object.values(
      cateDataRow.reduce((acc, { cateNm, ciId, subject }) => {
        const categoryName = cateNm || '미분류'
        if (!acc[categoryName]) {
          acc[categoryName] = { cateNm: categoryName, items: [] }
        }
        if (ciId != null && subject != null) {
          acc[categoryName].items.push({ ciId, subject })
        }
        return acc
      }, {} as Record<string, CateGroup>),
    )
  }, [cateDataRow])

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
    const ciIdForLine = selectedCiId || cbId
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

  const resetContentBlockForm = () => {
    setCbId('')
    setCbSubject('')
    setCbContent('')
    setCoType('C01')
    setImgUrl('')
    setTopP('100')
    setLeftP('100')
    setBlockWidth('100')
    setBlockHeight('100')
    setHeaderYn('1')
    setHeaderBg('')
    setBorderTk('0')
    setBorderR('0')
    setBorderGd('0')
    setBodyBg('')
  }

  const contentBlockSave = async () => {
    const subjectT = cbSubject.trim()
    const contentT = cbContent.trim()
    const isInsert = !cbId || cbId.trim() === '' || cbId.trim() === '0'
    const params: Record<string, unknown> = {
      cbId: cbId.trim(),
      ciId: selectedCiId != null ? String(selectedCiId).trim() : selectedCiId,
      imgUrl: imgUrl.trim(),
      cbSubject: subjectT,
      cbContent: contentT,
      coType: coType.trim() || 'C01',
      topP: Number(String(topP).trim() || 100),
      leftP: Number(String(leftP).trim() || 100),
      width: Number(String(blockWidth).trim() || 100),
      height: Number(String(blockHeight).trim() || 100),
      inUserNo: 1,
      inUserId: '1',
      useYn: '1',
      delYn: '0',
      headerYn: (() => {
        const n = Number.parseInt(String(headerYn).trim(), 10)
        return Number.isFinite(n) ? n : 1
      })(),
      headerBg: headerBg.trim(),
      borderTk: Number(String(borderTk).trim() || 0),
      borderR: Number(String(borderR).trim() || 0),
      borderGd: Number(String(borderGd).trim() || 0),
      bodyBg: bodyBg.trim(),
    }

    if (isInsert) {
      Object.assign(params, {
        imgAngle: 0,
        zIndex: 100,
      })
    }

    if (!subjectT || !contentT) {
      alert('제목과 내용을 입력해주세요. (공백만 있으면 저장되지 않습니다)')
      return
    }

    try {
      const res = await postContentBlockSave(params)
      if (res?.code !== '0') {
        alert(res?.msg || '저장에 실패했습니다.')
        return
      }
      if (selectedCiId) {
        await searchContentBlockRowData(selectedCiId)
      }
      resetContentBlockForm()
    } catch (e) {
      console.error('저장 실패:', e)
      alert('저장 중 오류가 발생했습니다.')
    }
  }

  const onDelUpdate = async () => {
    if (!cbId || cbId === '0') {
      alert('삭제할 콘텐츠 블록이 없습니다.')
      return
    }
    const response = await contentBlockdelUpdate({ cbId })
    if (response?.code === '0') {
      setOpen(false)
      resetContentBlockForm()
      if (selectedCiId) {
        await searchContentBlockRowData(selectedCiId)
      }
    } else {
      alert(response?.msg || '삭제 처리에 실패했습니다.')
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
                          void getContentBlockDetail(String(row.cbId))
                          setOpen(true)
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
                          void getContentBlockDetail(String(row.cbId))
                          setOpen(true)
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
                        <img src={row.imgUrl} alt="content" style={{ width: '100%', height: '100%' }} />
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

                    <div style={{ marginTop: 12 }}>
                      {grouped.map((category) => (
                        <Accordion key={category.cateNm} expanded={expanded === category.cateNm} onChange={handleChange2(category.cateNm)} disableGutters square>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography>{category.cateNm}</Typography>
                          </AccordionSummary>
                          {category.items.length > 0 && (
                            <AccordionDetails>
                              <List dense disablePadding>
                                {category.items.map((item, index) => (
                                  <ListItem key={`item-${item.ciId ?? index}`} disablePadding>
                                    <ListItemText
                                      onClick={() => {
                                        if (item.ciId != null) {
                                          const nextId = String(item.ciId)
                                          if (selectedCiId !== nextId) {
                                            setSelectedCiId(nextId)
                                            void searchContentBlockRowData(nextId)
                                          }
                                        }
                                      }}
                                      primary={(
                                        <span style={{ color: 'black', paddingLeft: '15px', fontWeight: selectedCiId === String(item.ciId) ? 'bold' : 'normal', cursor: 'pointer' }}>
                                          {item.subject}
                                        </span>
                                      )}
                                    />
                                    {item.subject &&
                                      selectedCiId === String(item.ciId) &&
                                      icons.map((icon, i) => (
                                        <IconButton
                                          key={`icon-${item.ciId}-${i}`}
                                          size="small"
                                          sx={{ padding: '2px', '& svg': { fontSize: '16px' } }}
                                          onClick={() => {
                                            if (i === 0) setOpen(true)
                                          }}
                                        >
                                          {icon}
                                        </IconButton>
                                      ))}
                                  </ListItem>
                                ))}
                              </List>
                            </AccordionDetails>
                          )}
                        </Accordion>
                      ))}
                    </div>

                    <p style={{ marginTop: '10px' }}>
                      <Button variant="contained" color="info" onClick={() => setOpen(true)}>등록하기</Button>
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

      {open && (
        <Modal
          title="콘텐츠블록 등록"
          onClose={() => {
            setOpen(false)
            resetContentBlockForm()
          }}
          onSave={() => {
            void contentBlockSave()
            setOpen(false)
            resetContentBlockForm()
          }}
          onDelUpdate={() => {
            void onDelUpdate()
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              height: 400,
              overflowY: 'auto',
              boxSizing: 'border-box',
              paddingRight: '4px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label htmlFor="coType" style={{ fontWeight: 'bold', marginBottom: '4px' }}>타입 (Type)</label>
              <div id="coType" style={{ display: 'inline-flex', width: 'fit-content', border: '1px solid #d0d7de', borderRadius: '10px', overflow: 'hidden', marginTop: '4px' }}>
                {[
                  { value: 'C01', label: 'Text' },
                  { value: 'C02', label: 'Html' },
                  { value: 'C03', label: 'Image' },
                ].map((opt) => {
                  const selected = coType === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCoType(opt.value)}
                      style={{
                        border: 'none',
                        borderRight: opt.value === 'C03' ? 'none' : '1px solid #d0d7de',
                        padding: '8px 14px',
                        fontSize: '14px',
                        fontWeight: selected ? 700 : 500,
                        color: selected ? '#fff' : '#374151',
                        background: selected ? '#1976d2' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label htmlFor="cbSubject" style={{ fontWeight: 'bold', marginBottom: '4px' }}>제목 (Subject)</label>
              <input type="text" id="cbSubject" value={cbSubject} onChange={(e) => setCbSubject(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px' }} />
            </div>

            {coType === 'C03' && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label htmlFor="imgUrl" style={{ fontWeight: 'bold', marginBottom: '4px' }}>이미지 (imgUrl)</label>
                <input type="text" id="imgUrl" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px' }} />
              </div>
            )}


            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label htmlFor="cbContent" style={{ fontWeight: 'bold', marginBottom: '4px' }}>내용 (Content)</label>
              {coType === 'C02' ? (
                <div style={{ border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
                  <div className="editor-toolbar">
                    <button
                      type="button"
                      className={`editor-tool-btn ${htmlEditor?.isActive('bold') ? 'is-active' : ''}`}
                      onClick={() => htmlEditor?.chain().focus().toggleBold().run()}
                    >
                      Bold
                    </button>
                    <button
                      type="button"
                      className={`editor-tool-btn ${htmlEditor?.isActive('italic') ? 'is-active' : ''}`}
                      onClick={() => htmlEditor?.chain().focus().toggleItalic().run()}
                    >
                      Italic
                    </button>
                    <button
                      type="button"
                      className={`editor-tool-btn ${htmlEditor?.isActive('bulletList') ? 'is-active' : ''}`}
                      onClick={() => htmlEditor?.chain().focus().toggleBulletList().run()}
                    >
                      Bullet
                    </button>
                    <button
                      type="button"
                      className={`editor-tool-btn ${htmlEditor?.isActive('orderedList') ? 'is-active' : ''}`}
                      onClick={() => htmlEditor?.chain().focus().toggleOrderedList().run()}
                    >
                      Number
                    </button>
                    <button
                      type="button"
                      className={`editor-tool-btn ${htmlEditor?.isActive('link') ? 'is-active' : ''}`}
                      onClick={handleSetEditorLink}
                    >
                      Link
                    </button>
                    <div className="editor-color-wrap">
                      <button
                        type="button"
                        className={`editor-tool-btn ${activeTextColor ? 'is-active' : ''}`}
                        onClick={() => setShowTextColorPalette((prev) => !prev)}
                      >
                        Color
                      </button>
                      {showTextColorPalette && (
                        <div className="editor-color-palette">
                          <div className="editor-color-grid">
                            {textColorPalette.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={`editor-color-chip ${activeTextColor === color ? 'is-active' : ''}`}
                                style={{ backgroundColor: color }}
                                onClick={() => handleSetEditorTextColor(color)}
                                aria-label={`텍스트 색상 ${color}`}
                              />
                            ))}
                          </div>
                          <div className="editor-color-actions">
                            <input
                              type="color"
                              value={activeTextColor || '#000000'}
                              onChange={(e) => handleSetEditorTextColor(e.target.value)}
                              title="사용자 지정 색상"
                            />
                            <button type="button" className="editor-tool-btn" onClick={handleUnsetEditorTextColor}>
                              Clear
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <EditorContent editor={htmlEditor} />
                </div>
              ) : coType === 'C01' ? (
                <div style={{ border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid #eee', background: '#f8fafc', color: '#64748b', fontSize: '12px' }}>
                    텍스트 전용 모드 (서식/링크 사용 불가)
                  </div>
                  <EditorContent editor={textEditor} />
                </div>
              ) : (
                <textarea id="cbContent" rows={6} value={cbContent} onChange={(e) => setCbContent(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', resize: 'vertical' }} />
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '10px',
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <label htmlFor="topP" style={{ fontWeight: 'bold', marginBottom: '4px' }}>Top</label>
                <input
                  type="number"
                  id="topP"
                  value={topP}
                  onChange={(e) => setTopP(e.target.value)}
                  style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <label htmlFor="leftP" style={{ fontWeight: 'bold', marginBottom: '4px' }}>Left</label>
                <input
                  type="number"
                  id="leftP"
                  value={leftP}
                  onChange={(e) => setLeftP(e.target.value)}
                  style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <label htmlFor="blockWidth" style={{ fontWeight: 'bold', marginBottom: '4px' }}>Width</label>
                <input
                  type="number"
                  id="blockWidth"
                  value={blockWidth}
                  onChange={(e) => setBlockWidth(e.target.value)}
                  style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <label htmlFor="blockHeight" style={{ fontWeight: 'bold', marginBottom: '4px' }}>Height</label>
                <input
                  type="number"
                  id="blockHeight"
                  value={blockHeight}
                  onChange={(e) => setBlockHeight(e.target.value)}
                  style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>헤더·테두리·본문 배경</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    checked={headerYn !== '0'}
                    onChange={(e) => setHeaderYn(e.target.checked ? '1' : '0')}
                  />
                  헤더 표시
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <label htmlFor="headerBg" style={{ fontWeight: 'bold', marginBottom: '4px' }}>헤더 배경 (headerBg)</label>
                  <input type="text" id="headerBg" value={headerBg} onChange={(e) => setHeaderBg(e.target.value)} placeholder="#ebebeb" style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <label htmlFor="bodyBg" style={{ fontWeight: 'bold', marginBottom: '4px' }}>본문 배경 (bodyBg)</label>
                  <input type="text" id="bodyBg" value={bodyBg} onChange={(e) => setBodyBg(e.target.value)} placeholder="#fff" style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <label htmlFor="borderTk" style={{ fontWeight: 'bold', marginBottom: '4px' }}>테두리 두께 (borderTk)</label>
                  <input type="number" id="borderTk" value={borderTk} onChange={(e) => setBorderTk(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <label htmlFor="borderR" style={{ fontWeight: 'bold', marginBottom: '4px' }}>모서리 반경 (borderR)</label>
                  <input type="number" id="borderR" value={borderR} onChange={(e) => setBorderR(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gridColumn: '1 / -1' }}>
                  <label htmlFor="borderGd" style={{ fontWeight: 'bold', marginBottom: '4px' }}>외곽선 보조 (borderGd)</label>
                  <input type="number" id="borderGd" value={borderGd} onChange={(e) => setBorderGd(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

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