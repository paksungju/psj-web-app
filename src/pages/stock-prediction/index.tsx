import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CellValueChangedEvent } from 'ag-grid-community'
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Menu,
  MenuItem,
} from '@mui/material'
import {
  createStockPredictionApi,
  deleteStockPredictionApi,
  fetchStockPredictionsApi,
  type StockPredictionRow,
} from '../../apis/stockPredictionApi'
import StockPredictionAgGrid, {
  type StockPredictionGridContext,
  type StockPredictionGridRow,
  isDraftGridRow,
} from './StockPredictionAgGrid'
import { newDraftRow, rowToWritePayload } from './utils'

export default function StockPredictionPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<StockPredictionRow[]>([])
  const [draftRows, setDraftRows] = useState<StockPredictionGridRow[]>([])
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [menuRow, setMenuRow] = useState<StockPredictionRow | null>(null)

  const gridRows = useMemo<StockPredictionGridRow[]>(
    () => [...rows, ...draftRows],
    [rows, draftRows],
  )

  const reloadList = useCallback(async () => {
    try {
      const data = await fetchStockPredictionsApi()
      setRows(data)
    } catch (e) {
      console.error('주가예측 목록 로드 실패:', e)
    }
  }, [])

  useEffect(() => {
    void reloadList()
  }, [reloadList])

  const handleOpenRowAdd = useCallback(() => {
    setDraftRows((prev) => [...prev, newDraftRow()])
  }, [])

  const handleSaveDraft = useCallback(
    async (row: StockPredictionGridRow) => {
      if (!row.draftKey) return
      if (!row.stockName?.trim()) {
        alert('종목명은 필수입니다.')
        return
      }
      try {
        await createStockPredictionApi(rowToWritePayload(row))
        setDraftRows((prev) => prev.filter((d) => d.draftKey !== row.draftKey))
        await reloadList()
      } catch (e) {
        console.error('주가예측 등록 실패:', e)
        alert('등록에 실패했습니다.')
      }
    },
    [reloadList],
  )

  const handleCancelDraft = useCallback((row: StockPredictionGridRow) => {
    if (!row.draftKey) return
    setDraftRows((prev) => prev.filter((d) => d.draftKey !== row.draftKey))
  }, [])

  const handleCellValueChanged = useCallback((e: CellValueChangedEvent<StockPredictionGridRow>) => {
    if (!isDraftGridRow(e.data) || !e.data.draftKey) return
    const field = e.colDef.field as keyof StockPredictionGridRow | undefined
    if (!field || field === 'draftKey' || field === 'stPrdId' || field === 'createdAt') return

    const draftKey = e.data.draftKey
    let value: unknown = e.newValue

    if (field === 'stockCode' || field === 'stockName' || field === 'prediction') {
      value = String(value ?? '').slice(0, 30)
    } else if (field === 'wrTime') {
      value = String(value ?? '').slice(0, 4)
    } else if (field === 'wrDate') {
      value = String(value ?? '').slice(0, 10) || null
    } else if (field === 'stockPrice' || field === 'perPrice') {
      const n = Number(value)
      value = Number.isFinite(n) ? n : null
    }

    setDraftRows((prev) =>
      prev.map((d) => (d.draftKey === draftKey ? { ...d, [field]: value } : d)),
    )
  }, [])

  const handleOpenRowMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>, row: StockPredictionRow) => {
      setMenuAnchorEl(event.currentTarget)
      setMenuRow(row)
    },
    [],
  )

  const gridContext = useMemo<StockPredictionGridContext>(
    () => ({
      onOpenMenu: handleOpenRowMenu,
      onSaveDraft: (r) => void handleSaveDraft(r),
      onCancelDraft: handleCancelDraft,
    }),
    [handleOpenRowMenu, handleSaveDraft, handleCancelDraft],
  )

  const handleCloseRowMenu = () => {
    setMenuAnchorEl(null)
    setMenuRow(null)
  }

  const handleMenuDetail = () => {
    if (!menuRow) return
    const t = menuRow
    handleCloseRowMenu()
    navigate(`/stock-prediction/${t.stPrdId}`)
  }

  const handleDeleteRow = async () => {
    if (!menuRow) return
    const t = menuRow
    const label = t.stockName || t.stockCode || String(t.stPrdId)
    const ok = window.confirm(`"${label}" 항목을 삭제하시겠습니까?`)
    handleCloseRowMenu()
    if (!ok) return
    try {
      await deleteStockPredictionApi(t.stPrdId)
      await reloadList()
    } catch (e) {
      console.error('삭제 실패:', e)
      alert('삭제에 실패했습니다.')
    }
  }

  return (
    <Box
      sx={{
        flexGrow: 1,
        overflow: 'auto',
        p: 3,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          backgroundColor: 'background.paper',
          minHeight: '100%',
        }}
      >
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
          주가예측시스템
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          주가 예측 데이터를 관리합니다. (psj_stock_predic) 신규 행은 셀 더블클릭으로 편집, ✓/✕로
          저장·취소합니다.
        </Typography>

        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            size="small"
            sx={{
              backgroundColor: '#fff',
              borderColor: 'grey.400',
              color: 'text.primary',
              '&:hover': {
                backgroundColor: 'grey.50',
                borderColor: 'grey.500',
              },
            }}
            onClick={handleOpenRowAdd}
          >
            항목 추가
          </Button>
          <Button
            variant="outlined"
            size="small"
            sx={{
              backgroundColor: '#fff',
              borderColor: 'grey.400',
              color: 'text.primary',
              '&:hover': {
                backgroundColor: 'grey.50',
                borderColor: 'grey.500',
              },
            }}
            onClick={() => void reloadList()}
          >
            새로고침
          </Button>
        </Stack>

        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', p: 1 }}>
          <StockPredictionAgGrid
            rows={gridRows}
            context={gridContext}
            onCellValueChanged={handleCellValueChanged}
          />
        </Paper>

        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleCloseRowMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem onClick={handleMenuDetail}>상세보기</MenuItem>
          <MenuItem
            onClick={() => {
              void handleDeleteRow()
            }}
          >
            삭제
          </MenuItem>
        </Menu>
      </Paper>
    </Box>
  )
}
