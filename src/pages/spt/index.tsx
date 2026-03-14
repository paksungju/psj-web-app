import { createRef, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
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
import Modal from '../../components/Modal'
import {
  contentBlockdelUpdate,
  type IContentBlockModel,
  type IContentCateModel,
  positionSave,
  postContentBlockSave,
  postlineDataSave,
} from '../../apis/contentBlockApi'
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

const HARD_CODED_CATE_DATA: IContentCateModel[] = [
  {
    ccId: 1,
    ciId: 101,
    subject: '시장 분석',
    cateNm: '전략기획',
  },
  {
    ccId: 2,
    ciId: 102,
    subject: '실행 계획',
    cateNm: '전략기획',
  },
]

const HARD_CODED_ROWS: Record<string, IContentBlockModel[]> = {
  '101': [
    {
      cbId: '1001',
      leftP: 80,
      topP: 100,
      width: 220,
      height: 120,
      cbSubject: '시장 분석',
      cbContent: '시장 규모와 경쟁사 현황을 정리합니다.',
      coType: 'C01',
    },
    {
      cbId: '1002',
      leftP: 380,
      topP: 240,
      width: 220,
      height: 120,
      cbSubject: '핵심 고객',
      cbContent: '타깃 고객과 주요 니즈를 정의합니다.',
      coType: 'C01',
    },
  ],
  '102': [
    {
      cbId: '2001',
      leftP: 120,
      topP: 120,
      width: 240,
      height: 120,
      cbSubject: '실행 계획',
      cbContent: '분기별 실행 항목과 담당자를 설정합니다.',
      coType: 'C01',
    },
    {
      cbId: '2002',
      leftP: 430,
      topP: 260,
      width: 240,
      height: 120,
      cbSubject: '성과 지표',
      cbContent: 'KPI와 점검 주기를 정의합니다.',
      coType: 'C01',
    },
  ],
}

const HARD_CODED_LINE_DATA: Record<string, SavedLineRow[]> = {
  '101': [{ from: '1001', to: '1002', color: '#3357FF', size: 2, path: 'fluid' }],
  '102': [{ from: '2001', to: '2002', color: '#33AA57', size: 2, path: 'fluid' }],
}

export default function SptPage({
  title = 'SPT HOME',
  description = '전략기획툴 작업 화면입니다.',
}: SptPageProps) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState('IT기술')
  const [isOpen, setIsOpen] = useState(false)
  const [menuVisible, setMenuVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [selectedColor, setSelectedColor] = useState<string>(colors[0] ?? '#ccc')
  const [selectedCiId, setSelectedCiId] = useState<string | null>(null)
  const [selectedRefs, setSelectedRefs] = useState<HTMLElement[]>([])
  const [rows, setRows] = useState<IContentBlockModel[]>([])
  const [angles, setAngles] = useState<number[]>([])
  const [lineDataRow, setLineDataRow] = useState<SavedLineRow[]>([])
  const [cateDataRow, setCateDataRow] = useState<IContentCateModel[]>([])
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(0)
  const [selectedPath, setSelectedPath] = useState('fluid')
  const [selectedLineStyle, setSelectedLineStyle] = useState('solid')
  const [selectedLineThickness, setSelectedLineThickness] = useState(2)
  const [checked, setChecked] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [cbId, setCbId] = useState('')
  const [cbSubject, setCbSubject] = useState('')
  const [cbContent, setCbContent] = useState('')
  const [coType, setCoType] = useState('C01')
  const [imgUrl, setImgUrl] = useState('')

  const lineRef = useRef<Array<{ from: HTMLElement; to: HTMLElement; line: LeaderLineInstance }>>([])
  const itemRefs = useRef<Array<React.RefObject<HTMLDivElement>>>([])

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

  const allLinesRemove = useCallback(() => {
    lineRef.current.forEach(({ line }) => line.remove())
    lineRef.current = []
    setSelectedRefs([])
  }, [])

  const searchLineRowData = useCallback(async (id: string) => {
    setLineDataRow(HARD_CODED_LINE_DATA[id] ?? [])
  }, [])

  const searchContentBlockRowData = useCallback(async (id: string) => {
    allLinesRemove()
    setRows([])
    itemRefs.current = []
    setCbId(id)
    const safeRows = HARD_CODED_ROWS[id] ?? []
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
  }, [allLinesRemove, searchLineRowData])

  const getContentBlockDetail = useCallback(async (id: string) => {
    const detail = Object.values(HARD_CODED_ROWS)
      .flat()
      .find((row) => row.cbId === id)
    if (!detail) return

    setCoType(String(detail.coType ?? 'C01'))
    setCbId(String(detail.cbId ?? ''))
    setCbSubject(String(detail.cbSubject ?? ''))
    setCbContent(String(detail.cbContent ?? ''))
    setImgUrl(String(detail.imgUrl ?? ''))
  }, [])

  const searchRowData = useCallback(async () => {
    setCateDataRow(HARD_CODED_CATE_DATA)
    setSelectedCiId('101')
    await searchContentBlockRowData('101')
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

      const line = new LeaderLine(fromEl, toEl, {
        size: Number(size ?? 2),
        color: color ?? selectedColor,
        path: path ?? selectedPath,
        dash: false,
        startPlug: 'behind',
        endPlug: 'arrow',
      })
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
    if (!checked) return
    event.stopPropagation()

    const target = event.target as HTMLElement
    if (target.classList.contains('drag-handle')) return

    const resizableEl = document.getElementById(`resizable_${index}`)
    if (!resizableEl || selectedRefs.includes(resizableEl)) return

    const nextSelected = [...selectedRefs, resizableEl]
    setSelectedRefs(nextSelected)

    if (nextSelected.length === 2) {
      const from = nextSelected[0]
      const to = nextSelected[1]
      if (!from || !to) return
      const line = new LeaderLine(from, to, {
        size: selectedLineThickness,
        color: selectedColor,
        path: selectedPath,
        dash: dashOption,
        startPlug: 'behind',
        endPlug: 'arrow',
      })
      lineRef.current.push({ from, to, line })
      setSelectedRefs([])
    }
  }

  const handleMouseDown = (index: number, e: React.MouseEvent<HTMLDivElement>) => {
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
    try {
      setIsSaving(true)
      await postlineDataSave({
        ciId: cbId,
        lineObject: extractConnectionsData(),
      })
      window.setTimeout(() => {
        setIsSaving(false)
      }, 1000)
    } catch (error) {
      console.error('라인 저장 실패:', error)
      setIsSaving(false)
    }
  }

  const resetContentBlockForm = () => {
    setCbId('')
    setCbSubject('')
    setCbContent('')
    setCoType('C01')
    setImgUrl('')
  }

  const contentBlockSave = async () => {
    const isInsert = !cbId || cbId === '0'
    const params: Record<string, unknown> = {
      cbId,
      ciId: selectedCiId,
      imgUrl,
      cbSubject,
      cbContent,
      coType,
      inUserNo: 1,
      inUserId: '1',
      useYn: '1',
      delYn: '0',
    }

    if (isInsert) {
      Object.assign(params, {
        topP: 100,
        leftP: 100,
        width: 100,
        height: 100,
        imgAngle: 0,
        zIndex: 100,
      })
    }

    if (!cbSubject || !cbContent) {
      alert('제목과 내용을 입력해주세요.')
      return
    }

    await postContentBlockSave(params)
    if (selectedCiId) {
      await searchContentBlockRowData(selectedCiId)
    }
    resetContentBlockForm()
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
  }

  return (
    <>
      <div className="contentWrap" onClick={handleClick} onContextMenu={handleContextMenu}>
        {rows.map((row, index) => (
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
                textAlign: 'center',
                lineHeight: '28px',
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
                style={{ position: 'absolute', background: '#f0f0f0' }}
              >
                <div id={`resizable_${row.cbId}`} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div className="drag-handle" style={{ height: '34px', background: '#ebebeb', cursor: 'move', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: '8px' }}>
                    <span>{row.cbSubject}</span>
                    <IconButton
                      size="small"
                      sx={{ paddingTop: '6px', paddingRight: '6px', '& svg': { fontSize: '18px' }, float: 'right' }}
                      onClick={() => {
                        void getContentBlockDetail(String(row.cbId))
                        setOpen(true)
                      }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </div>
                  <div style={{ flex: 1, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderRadius: '2px' }}>
                    <div
                      onMouseDown={(e) => handleMouseDown(index, e)}
                      style={{
                        transform: `rotate(${angles[index] ?? 0}deg)`,
                        display: 'flex',
                        alignItems: 'center',
                        userSelect: 'none',
                        cursor: 'grab',
                        width: '100%',
                        height: '100%',
                      }}
                    >
                      {row.coType === 'C03' || row.coType === '03' ? (
                        <img src={row.imgUrl} alt="content" style={{ width: '100%', height: '100%' }} />
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
        ))}

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
                                    {item.subject && icons.map((icon, i) => (
                                      <IconButton
                                        key={`icon-${item.ciId}-${i}`}
                                        size="small"
                                        sx={{ padding: '2px', '& svg': { fontSize: '16px' } }}
                                        onClick={() => { if (i === 0) setOpen(true) }}
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

                    <p>
                      <Button variant="contained" color="primary" onClick={() => navigate('/')}>홈으로</Button>
                    </p>
                    <p>
                      <Button variant="contained" color="info" onClick={() => setOpen(true)}>등록하기</Button>
                    </p>
                  </Typography>
                )}

                {value === 1 && (
                  <Typography component="div">
                    <FormControlLabel control={<Switch checked={checked} onChange={(e) => setChecked(e.target.checked)} />} label={checked ? 'ON' : 'OFF'} />
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
            {['저장하기', '라인저장', '붙여넣기', '선전체지움'].map((label, index) => (
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label htmlFor="coType" style={{ fontWeight: 'bold', marginBottom: '4px' }}>타입 (Type)</label>
              <select id="coType" value={coType} onChange={(e) => setCoType(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px' }}>
                <option value="">-선택-</option>
                <option value="C01">text</option>
                <option value="C02">html</option>
                <option value="C03">Image</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label htmlFor="cbSubject" style={{ fontWeight: 'bold', marginBottom: '4px' }}>제목 (Subject)</label>
              <input type="text" id="cbSubject" value={cbSubject} onChange={(e) => setCbSubject(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label htmlFor="imgUrl" style={{ fontWeight: 'bold', marginBottom: '4px' }}>이미지 (imgUrl)</label>
              <input type="text" id="imgUrl" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label htmlFor="cbContent" style={{ fontWeight: 'bold', marginBottom: '4px' }}>내용 (Content)</label>
              <textarea id="cbContent" rows={6} value={cbContent} onChange={(e) => setCbContent(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', resize: 'vertical' }} />
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