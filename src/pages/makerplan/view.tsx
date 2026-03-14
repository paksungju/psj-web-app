import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Divider,
  Dialog,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import LightbulbIcon from '@mui/icons-material/Lightbulb'
import BrushIcon from '@mui/icons-material/Brush'
import PaletteIcon from '@mui/icons-material/Palette'
import EngineeringIcon from '@mui/icons-material/Engineering'
import ScienceIcon from '@mui/icons-material/Science'
import ConstructionIcon from '@mui/icons-material/Construction'
import RateReviewIcon from '@mui/icons-material/RateReview'
import CloseIcon from '@mui/icons-material/Close'
import TopBar from '../../components/TopBar'
import { fetchAppDataByIdApi, fetchAppDataListApi, type ApiAppData } from '../../apis/appApi'

/** ap_content HTML 내 이미지 src에 도메인 추가 */
function processContentHtml(html: string): string {
  if (!html) return ''
  return html.replace(
    /<img([^>]*)\ssrc=["']([^"']+)["']/gi,
    (match, attrs: string, src: string) => {
      if (src.startsWith('http')) return match
      const path = src.startsWith('/') ? src : `/${src}`
      return `<img${attrs} src="http://impsj.net${path}"`
    },
  )
}

const STEP_ITEMS = [
  { id: 'concept', label: '구상', icon: LightbulbIcon },
  { id: 'sketch', label: '스케치', icon: BrushIcon },
  { id: 'design', label: '디자인', icon: PaletteIcon },
  { id: 'plan', label: '설계', icon: EngineeringIcon },
  { id: 'prototype', label: '프로토타입', icon: ScienceIcon },
  { id: 'build', label: '본체제작', icon: ConstructionIcon },
  { id: 'review', label: '제작후기', icon: RateReviewIcon },
]

const ITEMS_PER_ROW_NARROW = 4

function normalizeText(value: unknown): string {
  return String(value ?? '').trim()
}

function isBodyEntry(value: { cate1?: unknown; parent_id?: unknown }): boolean {
  const stepName = normalizeText(value.cate1)
  const parentId = Number(value.parent_id ?? 0)
  return stepName === '' && parentId === 0
}

export default function MakerPlanViewPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams<{ id?: string }>()
  const theme = useTheme()
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'))
  const dataId = id ? parseInt(id, 10) : NaN

  const [data, setData] = useState<ApiAppData | null>(null)
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null)
  const [stepDataIds, setStepDataIds] = useState<Map<number, number>>(new Map())
  const [rootData, setRootData] = useState<ApiAppData | null>(null)
  const [stepContents, setStepContents] = useState<Array<{
    stepLabel: string
    data_id: number
    ap_subject: string
    ap_content: string
  }>>([])
  const [rootId, setRootId] = useState<number>(0)
  const [rootTitle, setRootTitle] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [previewImage, setPreviewImage] = useState<{ src: string; alt?: string }>({ src: '' })
  const [showingRootContent, setShowingRootContent] = useState(true)

  useEffect(() => {
    if (!id || isNaN(dataId)) {
        setData(null)
        setActiveStepIndex(null)
        setStepDataIds(new Map())
        setRootData(null)
        setStepContents([])
        setRootId(0)
        setRootTitle('')
      setLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetchAppDataByIdApi(dataId)
        if (cancelled) return
        if (!res) {
        setData(null)
        setActiveStepIndex(null)
        setStepDataIds(new Map())
        setRootData(null)
        setStepContents([])
        setRootId(0)
        setRootTitle('')
          setLoading(false)
          return
        }
        setData(res)
        const grNum = res.gr_num ?? 0
        const listRes = await fetchAppDataListApi({
          app_id: 4,
          gr_num: grNum,
          skip: 0,
          limit: 500,
        })
        if (cancelled) return
        const currentStepIdx = STEP_ITEMS.findIndex((s) => normalizeText(res.cate1) === s.label)
        const rootRow = (listRes ?? []).find((r) => isBodyEntry(r))
        const resolvedRoot = rootRow ?? (isBodyEntry(res) ? res : null)
        const rid = resolvedRoot?.data_id ?? res.data_id ?? 0
        setRootData(resolvedRoot)
        setRootId(rid)
        setRootTitle(resolvedRoot?.ap_subject?.trim() ?? res.ap_subject?.trim() ?? '')
        const ids = new Map<number, number>()
        const steps: Array<{
          stepLabel: string
          data_id: number
          ap_subject: string
          ap_content: string
        }> = []
        for (let i = 0; i < STEP_ITEMS.length; i++) {
          const step = STEP_ITEMS[i]
          if (!step) continue
          const row = (listRes ?? []).find((item) => normalizeText(item.cate1) === step.label && (item.parent_id ?? 0) === rid)
          if (row?.data_id) {
            ids.set(i, row.data_id)
            steps.push({
              stepLabel: step.label,
              data_id: row.data_id,
              ap_subject: row.ap_subject?.trim() ?? '',
              ap_content: row.ap_content?.trim() ?? '',
            })
          }
        }
        const latestStepIdx = ids.size > 0 ? Math.max(...Array.from(ids.keys())) : null
        const params = new URLSearchParams(location.search)
        const viewParam = params.get('view')
        const stepParam = params.get('step')
        const stepIdxFromUrl = stepParam != null ? parseInt(stepParam, 10) : NaN
        const hasStepFromUrl = !Number.isNaN(stepIdxFromUrl) && ids.has(stepIdxFromUrl)
        if (viewParam === 'step' && hasStepFromUrl) {
          setShowingRootContent(false)
          setActiveStepIndex(stepIdxFromUrl)
        } else {
          const state = typeof location.state === 'object' && location.state != null ? location.state as { initialView?: string; stepIndex?: number } : {}
          if (state.initialView === 'step' && typeof state.stepIndex === 'number' && ids.has(state.stepIndex)) {
            setShowingRootContent(false)
            setActiveStepIndex(state.stepIndex)
          } else if (state.initialView === 'root') {
            setShowingRootContent(true)
            setActiveStepIndex(currentStepIdx >= 0 ? currentStepIdx : latestStepIdx)
          } else {
            setShowingRootContent(true)
            setActiveStepIndex(currentStepIdx >= 0 ? currentStepIdx : latestStepIdx)
          }
        }
        setStepDataIds(ids)
        setStepContents(steps)
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setData(null)
          setActiveStepIndex(null)
          setStepDataIds(new Map())
          setRootData(null)
          setStepContents([])
          setRootId(0)
          setRootTitle('')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, dataId, location.state, location.search])

  if (loading) {
    return (
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
        <TopBar />
        <Typography color="text.secondary">로딩 중...</Typography>
      </Box>
    )
  }

  if (!data) {
    return (
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
        <TopBar />
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            데이터를 찾을 수 없습니다.
          </Typography>
          <Button variant="outlined" onClick={() => navigate('/makerplan')}>
            목록으로
          </Button>
        </Paper>
      </Box>
    )
  }

  const handleContentImageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null
    const imgEl = target?.closest('img') as HTMLImageElement | null
    if (!imgEl?.src) return
    setPreviewImage({ src: imgEl.src, alt: imgEl.alt })
  }

  return (
    <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
      <TopBar />
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          backgroundColor: 'background.paper',
        }}
      >
        <Typography variant="h5" sx={{ mb: 1.5, fontWeight: 600 }}>
          메이커플랜
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0 }}>
          구상, 스케치, 디자인, 설계, 프로토타입, 본체제작, 제작후기 단계별로 진행합니다.
        </Typography>

        {/* 스텝별 진행 단계 UI */}
        <Box sx={{ mt: 5 }}>
          <Box
            sx={{
              display: 'flex',
              flexWrap: isNarrow ? 'wrap' : 'nowrap',
              alignItems: 'center',
              gap: isNarrow ? 2 : 0,
            }}
          >
            {STEP_ITEMS.map((step, index) => {
              const isCompleted = activeStepIndex != null && index < activeStepIndex
              const isActive = activeStepIndex === index
              const isLast = index === STEP_ITEMS.length - 1
              const StepIcon = step.icon
              const isEndOfRow = (idx: number) =>
                isNarrow && (idx + 1) % ITEMS_PER_ROW_NARROW === 0
              const showConnector = (idx: number) =>
                idx < STEP_ITEMS.length - 1 && !isEndOfRow(idx)

              return (
                <Box
                  key={step.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    flex: isNarrow
                      ? `0 0 calc((100% - ${(ITEMS_PER_ROW_NARROW - 1) * 16}px) / ${ITEMS_PER_ROW_NARROW})`
                      : isLast
                        ? '0 0 auto'
                        : 1,
                    minWidth: isNarrow ? 0 : 0,
                    mb: isNarrow ? 2 : 0,
                  }}
                >
                  <Box
                    onClick={() => {
                      if (!stepDataIds.has(index)) return
                      setActiveStepIndex(index)
                    }}
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: '15%',
                      backgroundColor: isCompleted ? '#4caf50' : isActive ? '#2196f3' : '#ccc',
                      color: 'white',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      fontWeight: 'bold',
                      border: '4px solid white',
                      boxSizing: 'border-box',
                      flexShrink: 0,
                      cursor: stepDataIds.has(index) ? 'pointer' : 'default',
                      opacity: stepDataIds.has(index) ? 1 : 0.5,
                    }}
                  >
                    <StepIcon sx={{ fontSize: 36 }} />
                  </Box>
                  {showConnector(index) && (
                    <Box
                      sx={{
                        flex: 1,
                        height: 2,
                        minWidth: 20,
                        mx: 0.5,
                        backgroundColor: isCompleted ? '#4caf50' : '#bbb',
                      }}
                    />
                  )}
                </Box>
              )
            })}
          </Box>
          <Box
            sx={{
              display: 'flex',
              flexWrap: isNarrow ? 'wrap' : 'nowrap',
              alignItems: 'center',
              mt: 1.25,
              gap: isNarrow ? 2 : 0,
            }}
          >
            {STEP_ITEMS.map((step, index) => {
              const isActive = activeStepIndex === index
              const isLast = index === STEP_ITEMS.length - 1
              const isEndOfRow = (idx: number) =>
                isNarrow && (idx + 1) % ITEMS_PER_ROW_NARROW === 0
              const showConnector = (idx: number) =>
                idx < STEP_ITEMS.length - 1 && !isEndOfRow(idx)

              return (
                <Box
                  key={step.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    flex: isNarrow
                      ? `0 0 calc((100% - ${(ITEMS_PER_ROW_NARROW - 1) * 16}px) / ${ITEMS_PER_ROW_NARROW})`
                      : isLast
                        ? '0 0 auto'
                        : 1,
                    minWidth: 0,
                    mb: isNarrow ? 0.5 : 0,
                  }}
                >
                  <Box
                    onClick={() => {
                      if (!stepDataIds.has(index)) return
                      setActiveStepIndex(index)
                    }}
                    sx={{
                      width: 80,
                      flexShrink: 0,
                      textAlign: 'center',
                      cursor: stepDataIds.has(index) ? 'pointer' : 'default',
                      opacity: stepDataIds.has(index) ? 1 : 0.5,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: 14,
                        color: isActive ? '#2196f3' : '#666',
                        fontWeight: isActive ? 'bold' : 400,
                      }}
                    >
                      {step.label}
                    </Typography>
                  </Box>
                  {showConnector(index) && <Box sx={{ flex: 1, minWidth: 20, mx: 0.5 }} />}
                </Box>
              )
            })}
          </Box>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            {rootData?.ap_subject || rootTitle || '원글'}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            onClick={() => setShowingRootContent((prev) => !prev)}
            sx={{
              mb: 3,
              cursor: 'pointer',
              '&:hover': { color: 'text.primary' },
            }}
          >
            {showingRootContent ? '원글 숨기기' : '원글 보기'}
          </Typography>
          {showingRootContent ? (
            <>
              {rootData?.ap_content ? (
                <Box
                  component="div"
                  onClick={handleContentImageClick}
                  dangerouslySetInnerHTML={{ __html: processContentHtml(rootData.ap_content) }}
                  sx={{
                    overflow: 'hidden',
                    wordBreak: 'break-word',
                    '& img': {
                      maxWidth: '100%',
                      height: 'auto',
                      objectFit: 'contain',
                      cursor: 'pointer',
                    },
                    '& figure': { margin: '0.5em 0', maxWidth: '100%' },
                    '& figure img': { maxWidth: '100%' },
                    '& p': { margin: '0 0 0.75em' },
                    '& .image-style-align-left': { float: 'left', marginRight: 2, marginBottom: 1, maxWidth: '100%' },
                    '& .image-style-align-right': { float: 'right', marginLeft: 2, marginBottom: 1, maxWidth: '100%' },
                    '& .image-style-align-center': { display: 'block', marginLeft: 'auto', marginRight: 'auto', textAlign: 'center', maxWidth: '100%' },
                    '& .image-style-align-block-left': { display: 'block', marginRight: 'auto', marginLeft: 0, maxWidth: '100%' },
                    '& .image-style-align-block-right': { display: 'block', marginLeft: 'auto', marginRight: 0, maxWidth: '100%' },
                    '& figure::after': { content: '""', display: 'table', clear: 'both' },
                  }}
                />
              ) : (
                <Typography variant="body1">-</Typography>
              )}
              {(rootData?.data_id || rootId) && (
                <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                  <Button
                    variant="text"
                    color="inherit"
                    onClick={() => navigate(`/makerplan/${rootData?.data_id ?? rootId}/form`, { state: { returnTo: location.pathname } })}
                    sx={{
                      minWidth: 'auto',
                      px: 0,
                      color: 'text.secondary',
                      fontWeight: 400,
                      '&:hover': {
                        backgroundColor: 'transparent',
                        color: 'text.primary',
                      },
                    }}
                  >
                    본문수정
                  </Button>
                </Stack>
              )}
            </>
          ) : null}
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          단계별 컨텐츠
        </Typography>
        {stepContents.length > 0 && activeStepIndex != null && stepDataIds.has(activeStepIndex) ? (
          (() => {
            const item = stepContents.find((s) => s.stepLabel === STEP_ITEMS[activeStepIndex]?.label)
            if (!item) return <Typography variant="body2" color="text.secondary">해당 단계 컨텐츠를 찾을 수 없습니다.</Typography>
            return (
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 0.5, fontWeight: 600 }}>
                  {item.stepLabel}
                </Typography>
                {item.ap_subject && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {item.ap_subject}
                  </Typography>
                )}
                {item.ap_content ? (
                  <Box
                    component="div"
                    onClick={handleContentImageClick}
                    dangerouslySetInnerHTML={{ __html: processContentHtml(item.ap_content) }}
                    sx={{
                      overflow: 'hidden',
                      wordBreak: 'break-word',
                      '& img': {
                        maxWidth: '100%',
                        height: 'auto',
                        objectFit: 'contain',
                        cursor: 'pointer',
                      },
                      '& figure': { margin: '0.5em 0', maxWidth: '100%' },
                      '& figure img': { maxWidth: '100%' },
                      '& p': { margin: '0 0 0.75em' },
                      '& .image-style-align-left': { float: 'left', marginRight: 2, marginBottom: 1, maxWidth: '100%' },
                      '& .image-style-align-right': { float: 'right', marginLeft: 2, marginBottom: 1, maxWidth: '100%' },
                      '& .image-style-align-center': { display: 'block', marginLeft: 'auto', marginRight: 'auto', textAlign: 'center', maxWidth: '100%' },
                      '& .image-style-align-block-left': { display: 'block', marginRight: 'auto', marginLeft: 0, maxWidth: '100%' },
                      '& .image-style-align-block-right': { display: 'block', marginLeft: 'auto', marginRight: 0, maxWidth: '100%' },
                      '& figure::after': { content: '""', display: 'table', clear: 'both' },
                    }}
                  />
                ) : (
                  <Typography variant="body1">-</Typography>
                )}
                <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                  <Button
                    variant="text"
                    color="inherit"
                    onClick={() => navigate(`/makerplan/${item.data_id}/form`, { state: { returnTo: location.pathname } })}
                    sx={{
                      minWidth: 'auto',
                      px: 0,
                      color: 'text.secondary',
                      fontWeight: 400,
                      '&:hover': {
                        backgroundColor: 'transparent',
                        color: 'text.primary',
                      },
                    }}
                  >
                    {item.stepLabel} 수정
                  </Button>
                </Stack>
              </Box>
            )
          })()
        ) : (
          <Typography variant="body2" color="text.secondary">
            {stepContents.length === 0 ? '등록된 단계별 컨텐츠가 없습니다.' : '단계를 선택해 주세요.'}
          </Typography>
        )}

        <Divider sx={{ my: 2 }} />

        <Stack direction="row" spacing={1.5} sx={{ mt: 3, justifyContent: 'flex-end' }}>
          <Button variant="outlined" color="inherit" onClick={() => navigate('/makerplan')}>
            목록
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate(`/makerplan/${rootId}/form?reply=1&step=1`, { state: { returnTo: location.pathname } })}
          >
            다음단계등록
          </Button>
        </Stack>
      </Paper>

      <Dialog
        open={Boolean(previewImage.src)}
        onClose={() => setPreviewImage({ src: '' })}
        maxWidth={false}
      >
        <Box sx={{ position: 'relative', bgcolor: 'background.default', p: 1 }}>
          <IconButton
            onClick={() => setPreviewImage({ src: '' })}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'rgba(0,0,0,0.5)',
              color: '#fff',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' },
            }}
          >
            <CloseIcon />
          </IconButton>
          <Box
            component="img"
            src={previewImage.src}
            alt={previewImage.alt ?? '이미지 미리보기'}
            sx={{
              display: 'block',
              maxWidth: '90vw',
              maxHeight: '90vh',
              width: 'auto',
              height: 'auto',
            }}
          />
        </Box>
      </Dialog>
    </Box>
  )
}
