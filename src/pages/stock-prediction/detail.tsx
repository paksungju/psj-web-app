import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Divider,
} from '@mui/material'
import {
  deleteStockPredictionApi,
  fetchStockPredictionDetailApi,
  updateStockPredictionApi,
  type StockPredictionRow,
} from '../../apis/stockPredictionApi'
import {
  formatDate,
  rowToWritePayload,
  type GoodBadField,
} from './utils'

function NewsFields({
  prefix,
  fields,
  selected,
  onChange,
}: {
  prefix: string
  fields: GoodBadField[]
  selected: StockPredictionRow
  onChange: (field: GoodBadField, value: string) => void
}) {
  return (
    <Stack spacing={1.5}>
      {fields.map((field, idx) => (
        <Box key={field}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            {prefix} {idx + 1}
          </Typography>
          <TextField
            fullWidth
            size="small"
            inputProps={{ maxLength: 255 }}
            value={selected[field] ?? ''}
            onChange={(e) => onChange(field, e.target.value)}
            InputProps={{ sx: { backgroundColor: 'grey.50' } }}
          />
        </Box>
      ))}
    </Stack>
  )
}

export default function StockPredictionDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const stPrdId = id ? parseInt(id, 10) : NaN

  const [selected, setSelected] = useState<StockPredictionRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadDetail = useCallback(async () => {
    if (!id || Number.isNaN(stPrdId)) {
      setSelected(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const detail = await fetchStockPredictionDetailApi(stPrdId)
      setSelected(detail)
    } catch (e) {
      console.error('주가예측 상세 로드 실패:', e)
      setSelected(null)
    } finally {
      setLoading(false)
    }
  }, [id, stPrdId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const updateSelected = (patch: Partial<StockPredictionRow>) => {
    setSelected((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  const updateNewsField = (field: GoodBadField, value: string) => {
    updateSelected({ [field]: value || null })
  }

  const handleSave = async () => {
    if (!selected) return
    if (!selected.stockName?.trim()) {
      alert('종목명은 필수입니다.')
      return
    }
    setSaving(true)
    try {
      await updateStockPredictionApi(selected.stPrdId, rowToWritePayload(selected))
      alert('저장되었습니다.')
      await loadDetail()
    } catch (e) {
      console.error('주가예측 저장 실패:', e)
      alert('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    const label = selected.stockName || selected.stockCode || String(selected.stPrdId)
    const ok = window.confirm(`"${label}" 항목을 삭제하시겠습니까?`)
    if (!ok) return
    try {
      await deleteStockPredictionApi(selected.stPrdId)
      navigate('/stock-prediction')
    } catch (e) {
      console.error('삭제 실패:', e)
      alert('삭제에 실패했습니다.')
    }
  }

  if (loading) {
    return (
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, backgroundColor: 'background.paper' }}>
          <Typography color="text.secondary">로딩 중...</Typography>
        </Paper>
      </Box>
    )
  }

  if (!selected) {
    return (
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, backgroundColor: 'background.paper' }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            데이터를 찾을 수 없습니다.
          </Typography>
          <Button variant="outlined" onClick={() => navigate('/stock-prediction')}>
            목록으로
          </Button>
        </Paper>
      </Box>
    )
  }

  return (
    <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          backgroundColor: 'background.paper',
          minHeight: '100%',
        }}
      >
        <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
          주가예측 상세
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {selected.stockName || '(종목명 없음)'} · NO {selected.stPrdId}
        </Typography>

        <Stack spacing={2.5}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              NO
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={selected.stPrdId}
              InputProps={{ readOnly: true, sx: { backgroundColor: 'grey.50' } }}
            />
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                종목코드 (stock_code)
              </Typography>
              <TextField
                fullWidth
                size="small"
                inputProps={{ maxLength: 30 }}
                value={selected.stockCode ?? ''}
                onChange={(e) => updateSelected({ stockCode: e.target.value || null })}
                InputProps={{ sx: { backgroundColor: 'grey.50' } }}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                종목명 (stock_name)
              </Typography>
              <TextField
                fullWidth
                size="small"
                inputProps={{ maxLength: 30 }}
                value={selected.stockName ?? ''}
                onChange={(e) => updateSelected({ stockName: e.target.value || null })}
                InputProps={{ sx: { backgroundColor: 'grey.50' } }}
              />
            </Box>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                작성일 (wr_date)
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="date"
                value={formatDate(selected.wrDate)}
                onChange={(e) => updateSelected({ wrDate: e.target.value || null })}
                InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                시간 (wr_time)
              </Typography>
              <TextField
                fullWidth
                size="small"
                inputProps={{ maxLength: 4 }}
                placeholder="HHMM"
                value={selected.wrTime ?? ''}
                onChange={(e) => updateSelected({ wrTime: e.target.value || null })}
                InputProps={{ sx: { backgroundColor: 'grey.50' } }}
              />
            </Box>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                주가 (stock_price)
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                value={selected.stockPrice ?? ''}
                onChange={(e) =>
                  updateSelected({
                    stockPrice: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                InputProps={{ sx: { backgroundColor: 'grey.50' } }}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                PER (per_price)
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                value={selected.perPrice ?? ''}
                onChange={(e) =>
                  updateSelected({
                    perPrice: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                InputProps={{ sx: { backgroundColor: 'grey.50' } }}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                예측 (prediction)
              </Typography>
              <TextField
                fullWidth
                size="small"
                inputProps={{ maxLength: 20 }}
                value={selected.prediction ?? ''}
                onChange={(e) => updateSelected({ prediction: e.target.value || null })}
                InputProps={{ sx: { backgroundColor: 'grey.50' } }}
              />
            </Box>
          </Stack>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              내용 (content)
            </Typography>
            <TextField
              fullWidth
              size="small"
              multiline
              minRows={3}
              value={selected.content ?? ''}
              onChange={(e) => updateSelected({ content: e.target.value || null })}
              InputProps={{ sx: { backgroundColor: 'grey.50' } }}
            />
          </Box>
          <Divider />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            호재
          </Typography>
          <NewsFields
            prefix="호재"
            fields={['goodNew1', 'goodNew2', 'goodNew3', 'goodNew4', 'goodNew5']}
            selected={selected}
            onChange={updateNewsField}
          />
          <Divider />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            악재
          </Typography>
          <NewsFields
            prefix="악재"
            fields={['badNew1', 'badNew2', 'badNew3', 'badNew4', 'badNew5']}
            selected={selected}
            onChange={updateNewsField}
          />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              등록일 (created_at)
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={formatDate(selected.createdAt)}
              InputProps={{ readOnly: true, sx: { backgroundColor: 'grey.50' } }}
            />
          </Box>
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ mt: 4, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => navigate('/stock-prediction')}
            sx={{
              backgroundColor: 'grey.100',
              borderColor: 'grey.300',
              '&:hover': { backgroundColor: 'grey.200' },
            }}
          >
            목록
          </Button>
          <Button variant="outlined" color="error" onClick={() => void handleDelete()}>
            삭제
          </Button>
          <Button variant="contained" color="primary" disabled={saving} onClick={() => void handleSave()}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
