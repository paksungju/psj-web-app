import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularProgress,
  Button,
  Checkbox,
} from '@mui/material'
import LightbulbIcon from '@mui/icons-material/Lightbulb'
import BrushIcon from '@mui/icons-material/Brush'
import PaletteIcon from '@mui/icons-material/Palette'
import EngineeringIcon from '@mui/icons-material/Engineering'
import ScienceIcon from '@mui/icons-material/Science'
import ConstructionIcon from '@mui/icons-material/Construction'
import RateReviewIcon from '@mui/icons-material/RateReview'
import TopBar from '../../components/TopBar'
import {
  fetchAppDataListApi,
  deleteAppDataBatchApi,
  type ApiAppData,
} from '../../apis/appApi'

const STEP_ICONS = [
  LightbulbIcon,
  BrushIcon,
  PaletteIcon,
  EngineeringIcon,
  ScienceIcon,
  ConstructionIcon,
  RateReviewIcon,
]

const STEP_LABELS = ['구상', '스케치', '디자인', '설계', '프로토타입', '본체제작', '제작후기']

type StepItem = {
  id: number
  grNum: number
  label: string
  description: string
  icon: (typeof STEP_ICONS)[number]
}

function mapAppDataToStep(item: ApiAppData, index: number): StepItem {
  const icon = STEP_ICONS[index % STEP_ICONS.length] ?? LightbulbIcon
  return {
    id: item.data_id ?? 1000000 + index,
    grNum: item.gr_num ?? 0,
    label: item.ap_subject?.trim() || '(제목 없음)',
    description: item.ap_content?.trim() || '-',
    icon,
  }
}

function buildMaxReplyCdByGrNum(items: ApiAppData[]): Map<number, number> {
  const stepNumbers = [1, 2, 3, 4, 5, 6, 7]
  const map = new Map<number, number>()
  for (const row of items) {
    const grNum = row.gr_num ?? 0
    const rc = row.reply_cd
    if (rc == null) continue
    const n = typeof rc === 'number' ? rc : parseInt(String(rc), 10)
    if (!Number.isNaN(n) && stepNumbers.includes(n)) {
      const current = map.get(grNum) ?? 0
      if (n > current) map.set(grNum, n)
    }
  }
  return map
}

const MAKERPLAN_APP_ID = 4

export default function MakerPlanPage() {
  const navigate = useNavigate()
  const [roots, setRoots] = useState<ApiAppData[]>([])
  const [maxReplyCdByGrNum, setMaxReplyCdByGrNum] = useState<Map<number, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const steps = roots.map(mapAppDataToStep)

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const ids = new Set(roots.map((r) => r.data_id).filter((id): id is number => id != null))
      setSelectedIds(ids)
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (dataId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(dataId)) next.delete(dataId)
      else next.add(dataId)
      return next
    })
  }

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) {
      alert('삭제할 항목을 선택해 주세요.')
      return
    }
    if (!window.confirm(`선택한 ${ids.length}개 항목을 삭제하시겠습니까?`)) return
    try {
      const res = await deleteAppDataBatchApi(ids)
      setSelectedIds(new Set())
      await refreshList()
      if (res.errors.length > 0) {
        alert(`${res.deleted}건 삭제됨. 일부 실패:\n${res.errors.join('\n')}`)
      } else {
        alert(`${res.deleted}건 삭제되었습니다.`)
      }
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    }
  }

  const refreshList = async () => {
    setLoading(true)
    try {
      const [roots, allItems] = await Promise.all([
        fetchAppDataListApi({
          app_id: MAKERPLAN_APP_ID,
          skip: 0,
          limit: 100,
          reply_cd_empty: true,
        }),
        fetchAppDataListApi({
          app_id: MAKERPLAN_APP_ID,
          skip: 0,
          limit: 500,
        }),
      ])
      setRoots(roots ?? [])
      setMaxReplyCdByGrNum(buildMaxReplyCdByGrNum(allItems ?? []))
    } catch (error) {
      console.error('메이커플랜 목록 조회 오류:', error)
      setRoots([])
      setMaxReplyCdByGrNum(new Map())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshList()
  }, [])

  return (
    <Box
      sx={{
        flexGrow: 1,
        overflow: 'auto',
        p: 3,
      }}
    >
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
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          정보 게시물(app_id=4) 목록 데이터를 기준으로 표시합니다.
        </Typography>

        {loading ? (
          <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : steps.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">등록된 데이터가 없습니다.</Typography>
          </Box>
        ) : (
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f7fb' }}>
              <TableCell padding="checkbox" sx={{ fontWeight: 600, width: 48 }}>
                <Checkbox
                  indeterminate={selectedIds.size > 0 && selectedIds.size < roots.length}
                  checked={roots.length > 0 && selectedIds.size === roots.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 600, width: 60 }}>
                NO
              </TableCell>
              <TableCell sx={{ fontWeight: 600, width: 100 }}>미리보기</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 160 }}>단계명</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>제목</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {steps.map((step, index) => {
              const maxCd = maxReplyCdByGrNum.get(step.grNum)
              const currentStepIdx = maxCd != null && maxCd >= 1 ? maxCd - 1 : 0
              const StepIcon = STEP_ICONS[currentStepIdx] ?? LightbulbIcon
              const dataId = roots[index]?.data_id

              return (
                <TableRow
                  key={step.id}
                  hover
                  onClick={() => navigate(`/makerplan/${step.id}`)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={dataId != null && selectedIds.has(dataId)}
                      onChange={() => dataId != null && handleSelectOne(dataId)}
                      disabled={dataId == null}
                    />
                  </TableCell>
                  <TableCell align="center">{index + 1}</TableCell>
                  <TableCell>
                    <Box
                      sx={{
                        width: 50,
                        height: 50,
                        borderRadius: 1,
                        backgroundColor: maxCd != null && maxCd >= 1 ? '#4caf50' : 'grey.300',
                        color: 'white',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <StepIcon sx={{ fontSize: 28 }} />
                    </Box>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const maxCd = maxReplyCdByGrNum.get(step.grNum)
                      return maxCd != null && maxCd >= 1
                        ? STEP_LABELS[maxCd - 1]
                        : step.label
                    })()}
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>
                    {step.label}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        )}

        <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 3, mb: 0 }}>
          행을 클릭하면 상세 페이지로 이동합니다.
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 3, mb: 2 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/makerplan/create')}
          >
            등록하기
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            onClick={handleDeleteSelected}
          >
            선택삭제
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}
