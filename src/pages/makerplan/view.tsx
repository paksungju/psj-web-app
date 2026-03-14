import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Divider,
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

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
        {label}
      </Typography>
      <Typography variant="body1" component="div">
        {value ?? '-'}
      </Typography>
    </Box>
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

export default function MakerPlanViewPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const theme = useTheme()
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'))
  const dataId = id ? parseInt(id, 10) : NaN

  const [data, setData] = useState<ApiAppData | null>(null)
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null)
  const [stepDataIds, setStepDataIds] = useState<Map<number, number>>(new Map())
  const [rootId, setRootId] = useState<number>(0)
  const [rootTitle, setRootTitle] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id || isNaN(dataId)) {
        setData(null)
        setActiveStepIndex(null)
        setStepDataIds(new Map())
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
        const stepNumbers = [1, 2, 3, 4, 5, 6, 7]
        let maxStepNum = 0
        for (const row of listRes ?? []) {
          const rc = row.reply_cd
          if (rc == null) continue
          const n = typeof rc === 'number' ? rc : parseInt(String(rc), 10)
          if (!Number.isNaN(n) && stepNumbers.includes(n) && n > maxStepNum) {
            maxStepNum = n
          }
        }
        const stepIdx = maxStepNum > 0 ? maxStepNum - 1 : STEP_ITEMS.findIndex((s) => (res.ap_subject ?? '').trim() === s.label)
        setActiveStepIndex(stepIdx >= 0 ? stepIdx : null)
        const rootRow = (listRes ?? []).find((r) => {
          const rc = r.reply_cd
          return rc == null || String(rc).trim() === '' || String(rc).trim() === '0'
        })
        const rid = rootRow?.data_id ?? res.data_id ?? 0
        setRootId(rid)
        setRootTitle(rootRow?.ap_subject?.trim() ?? res.ap_subject?.trim() ?? '')
        const ids = new Map<number, number>()
        for (const row of listRes ?? []) {
          const rc = row.reply_cd
          if (rc == null) continue
          const n = typeof rc === 'number' ? rc : parseInt(String(rc), 10)
          if (!Number.isNaN(n) && n >= 1 && n <= 7 && row.parent_id === rid && row.data_id) {
            ids.set(n - 1, row.data_id)
          }
        }
        setStepDataIds(ids)
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setData(null)
          setActiveStepIndex(null)
          setStepDataIds(new Map())
          setRootId(0)
          setRootTitle('')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, dataId])

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

  return (
    <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
      <TopBar />
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          backgroundColor: 'background.paper',
          maxWidth: 960,
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
                      const editId = stepDataIds.get(index)
                      if (editId) {
                        navigate(`/makerplan/${editId}/form`)
                      } else {
                        navigate(`/makerplan/${rootId}/form?reply=1&step=${index + 1}`)
                      }
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
                      cursor: 'pointer',
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
                      const editId = stepDataIds.get(index)
                      if (editId) {
                        navigate(`/makerplan/${editId}/form`)
                      } else {
                        navigate(`/makerplan/${rootId}/form?reply=1&step=${index + 1}`)
                      }
                    }}
                    sx={{
                      width: 80,
                      flexShrink: 0,
                      textAlign: 'center',
                      cursor: 'pointer',
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

        <Box sx={{ mt: 3, mb: 2 }}>
          {data.ap_subject ? (
            <>
              <Typography component="span" variant="subtitle2" color="text.secondary">
                {data.ap_subject} -{' '}
              </Typography>
              {data.ap_content ? (
                <Box
                  component="div"
                  dangerouslySetInnerHTML={{ __html: processContentHtml(data.ap_content) }}
                  sx={{
                    overflow: 'hidden',
                    wordBreak: 'break-word',
                    '& img': {
                      maxWidth: '100%',
                      height: 'auto',
                      objectFit: 'contain',
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
                <Typography component="span" variant="subtitle2" color="text.secondary">
                  (설명 없음)
                </Typography>
              )}
            </>
          ) : (
            <Typography variant="subtitle2" color="text.secondary">
              (단계 정보)
            </Typography>
          )}
        </Box>

        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          {data.ap_subject}
        </Typography>
        {rootTitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            원제목글: {rootTitle}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          data_id: {data.data_id ?? '-'} · app_id: {data.app_id ?? '-'}
        </Typography>

        <Divider sx={{ my: 2 }} />

        <FieldRow label="단계명" value={data.ap_subject} />
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
            설명
          </Typography>
          {data.ap_content ? (
          <Box
            component="div"
            dangerouslySetInnerHTML={{ __html: processContentHtml(data.ap_content) }}
            sx={{
              overflow: 'hidden',
              wordBreak: 'break-word',
              '& img': {
                maxWidth: '100%',
                height: 'auto',
                objectFit: 'contain',
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
        </Box>


        {[data.cate1, data.cate2].some(Boolean) && (
          <FieldRow
            label="카테고리"
            value={[data.cate1, data.cate2].filter(Boolean).join(' / ')}
          />
        )}

        <Divider sx={{ my: 2 }} />

        <Stack direction="row" spacing={1.5} sx={{ mt: 3, justifyContent: 'flex-end' }}>
          <Button variant="outlined" color="inherit" onClick={() => navigate('/makerplan')}>
            목록
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate(`/makerplan/${rootId}/form?reply=1&step=1`)}
          >
            답변
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate(`/makerplan/${data.data_id}/form`)}
          >
            수정
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
