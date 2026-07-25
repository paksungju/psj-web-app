import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CellValueChangedEvent } from 'ag-grid-community'
import {
  Box,
  Paper,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Menu,
  MenuItem,
} from '@mui/material'
import {
  createPaidInfoApi,
  deletePaidInfoApi,
  fetchPaidInfoDetailApi,
  fetchPaidInfosApi,
  updatePaidInfoApi,
  type PaidInfoRow,
} from '../../apis/paidInfoApi'
import PaidInfoAgGrid, {
  type PaidInfoGridContext,
  type PaidInfoGridRow,
  isDraftPaidGridRow,
} from './PaidInfoAgGrid'

function newDraftRow(): PaidInfoGridRow {
  return {
    draftKey: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    paidId: 0,
    accNm: '',
    accNo: '',
    subject: '',
    memo: '',
    cateCd: null,
    cateNm: null,
    price: null,
    ioType: null,
    paidDt: null,
  }
}

export default function PaidInfoPage() {
  const [rows, setRows] = useState<PaidInfoRow[]>([])
  const [draftRows, setDraftRows] = useState<PaidInfoGridRow[]>([])
  const [selected, setSelected] = useState<PaidInfoRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [menuRow, setMenuRow] = useState<PaidInfoRow | null>(null)

  const gridRows = useMemo<PaidInfoGridRow[]>(
    () => [...rows, ...draftRows],
    [rows, draftRows],
  )

  const reloadList = useCallback(async () => {
    try {
      const data = await fetchPaidInfosApi()
      setRows(data)
    } catch (e) {
      console.error('수납·결제 목록 로드 실패:', e)
    }
  }, [])

  useEffect(() => {
    void reloadList()
  }, [reloadList])

  const handleOpenDetail = useCallback(async (row: PaidInfoRow) => {
    setSelected(row)
    setDetailOpen(true)
    try {
      const detail = await fetchPaidInfoDetailApi(row.paidId)
      setSelected(detail)
    } catch (e) {
      console.error('상세 로드 실패:', e)
    }
  }, [])

  const handleCloseDetail = () => {
    setDetailOpen(false)
  }

  const handleSaveDetail = async () => {
    if (!selected) return
    if (!selected.accNm?.trim() || !selected.accNo?.trim() || !selected.subject?.trim()) {
      alert('계정명, 계정번호, 제목은 필수입니다.')
      return
    }
    try {
      await updatePaidInfoApi(selected.paidId, {
        acc_nm: selected.accNm.trim(),
        acc_no: selected.accNo.trim(),
        subject: selected.subject.trim(),
        memo: selected.memo?.trim() ?? '',
        cate_cd: selected.cateCd?.trim() || null,
        cate_nm: selected.cateNm?.trim() || null,
        price: selected.price ?? null,
        io_type: selected.ioType?.trim()?.slice(0, 1) || null,
        paid_dt: selected.paidDt?.trim() || null,
      })
      setDetailOpen(false)
      await reloadList()
    } catch (e) {
      console.error('저장 실패:', e)
      alert('저장에 실패했습니다.')
    }
  }

  const handleOpenRowAdd = useCallback(() => {
    setDraftRows((prev) => [...prev, newDraftRow()])
  }, [])

  const handleSaveDraft = useCallback(
    async (row: PaidInfoGridRow) => {
      if (!row.draftKey) return
      if (!row.accNm?.trim() || !row.accNo?.trim() || !row.subject?.trim()) {
        alert('계정명, 계정번호, 제목은 필수입니다.')
        return
      }
      try {
        await createPaidInfoApi({
          acc_nm: row.accNm.trim(),
          acc_no: row.accNo.trim(),
          subject: row.subject.trim(),
          memo: row.memo?.trim() ?? '',
          cate_cd: row.cateCd?.trim() || null,
          cate_nm: row.cateNm?.trim() || null,
          price: row.price ?? null,
          io_type: row.ioType?.trim()?.slice(0, 1) || null,
          paid_dt: row.paidDt?.trim() || null,
        })
        setDraftRows((prev) => prev.filter((d) => d.draftKey !== row.draftKey))
        await reloadList()
      } catch (e) {
        console.error('등록 실패:', e)
        alert('등록에 실패했습니다.')
      }
    },
    [reloadList],
  )

  const handleCancelDraft = useCallback((row: PaidInfoGridRow) => {
    if (!row.draftKey) return
    setDraftRows((prev) => prev.filter((d) => d.draftKey !== row.draftKey))
  }, [])

  const handleCellValueChanged = useCallback((e: CellValueChangedEvent<PaidInfoGridRow>) => {
    if (!isDraftPaidGridRow(e.data) || !e.data.draftKey) return
    const field = e.colDef.field as keyof PaidInfoGridRow | undefined
    if (!field || field === 'draftKey' || field === 'paidId') return

    const draftKey = e.data.draftKey
    let value: unknown = e.newValue

    if (field === 'price') {
      const n = Number(value)
      value = Number.isFinite(n) ? n : null
    } else {
      const raw = String(value ?? '')
      const t = raw.trim()
      if (field === 'ioType') {
        value = t === '' ? null : t.slice(0, 1)
      } else if (field === 'cateCd') {
        value = t === '' ? null : t.slice(0, 20)
      } else if (field === 'cateNm') {
        value = t === '' ? null : t.slice(0, 30)
      } else if (field === 'paidDt') {
        value = t === '' ? null : t.slice(0, 25)
      } else if (field === 'memo') {
        value = raw.slice(0, 255)
      } else if (field === 'accNm') {
        value = raw.slice(0, 30)
      } else if (field === 'accNo') {
        value = raw.slice(0, 30)
      } else if (field === 'subject') {
        value = raw.slice(0, 50)
      }
    }

    setDraftRows((prev) =>
      prev.map((d) => (d.draftKey === draftKey ? { ...d, [field]: value } : d)),
    )
  }, [])

  const handleOpenRowMenu = useCallback((event: React.MouseEvent<HTMLElement>, row: PaidInfoRow) => {
    setMenuAnchorEl(event.currentTarget)
    setMenuRow(row)
  }, [])

  const gridContext = useMemo<PaidInfoGridContext>(
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

  const handleMenuDetail = async () => {
    if (!menuRow) return
    const t = menuRow
    handleCloseRowMenu()
    await handleOpenDetail(t)
  }

  const handleDeleteRow = async () => {
    if (!menuRow) return
    const t = menuRow
    const ok = window.confirm(`"${t.subject}" 항목을 삭제하시겠습니까?`)
    handleCloseRowMenu()
    if (!ok) return
    try {
      await deletePaidInfoApi(t.paidId)
      if (selected?.paidId === t.paidId) {
        setDetailOpen(false)
        setSelected(null)
      }
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
          수납·결제 정보
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          psj_paid_info 테이블을 관리합니다. 신규 행은 셀 편집 후 ✓/✕로 저장·취소합니다.
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
          <PaidInfoAgGrid rows={gridRows} context={gridContext} onCellValueChanged={handleCellValueChanged} />
        </Paper>

        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleCloseRowMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem
            onClick={() => {
              void handleMenuDetail()
            }}
          >
            상세보기
          </MenuItem>
          <MenuItem
            onClick={() => {
              void handleDeleteRow()
            }}
          >
            삭제
          </MenuItem>
        </Menu>

        <Dialog
          open={detailOpen}
          onClose={(_, reason) => {
            if (reason === 'backdropClick' || reason === 'escapeKeyDown') return
            handleCloseDetail()
          }}
          disableEscapeKeyDown
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 600 }}>수납·결제 상세</DialogTitle>
          <DialogContent dividers sx={{ pt: 3 }}>
            {selected && (
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    NO (paid_id)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={selected.paidId}
                    InputProps={{ readOnly: true, sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    계정명 (acc_nm)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    inputProps={{ maxLength: 30 }}
                    value={selected.accNm}
                    onChange={(e) =>
                      setSelected((prev) => (prev ? { ...prev, accNm: e.target.value } : prev))
                    }
                    InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    계정번호 (acc_no)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    inputProps={{ maxLength: 30 }}
                    value={selected.accNo}
                    onChange={(e) =>
                      setSelected((prev) => (prev ? { ...prev, accNo: e.target.value } : prev))
                    }
                    InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    제목 (subject)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    inputProps={{ maxLength: 50 }}
                    value={selected.subject}
                    onChange={(e) =>
                      setSelected((prev) => (prev ? { ...prev, subject: e.target.value } : prev))
                    }
                    InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    메모 (memo)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    minRows={2}
                    inputProps={{ maxLength: 255 }}
                    value={selected.memo}
                    onChange={(e) =>
                      setSelected((prev) => (prev ? { ...prev, memo: e.target.value } : prev))
                    }
                    InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    분류코드 (cate_cd)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    inputProps={{ maxLength: 20 }}
                    value={selected.cateCd ?? ''}
                    onChange={(e) =>
                      setSelected((prev) =>
                        prev ? { ...prev, cateCd: e.target.value || null } : prev,
                      )
                    }
                    InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    분류명 (cate_nm)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    inputProps={{ maxLength: 30 }}
                    value={selected.cateNm ?? ''}
                    onChange={(e) =>
                      setSelected((prev) =>
                        prev ? { ...prev, cateNm: e.target.value || null } : prev,
                      )
                    }
                    InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    금액 (price)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    value={selected.price ?? ''}
                    onChange={(e) =>
                      setSelected((prev) => {
                        if (!prev) return prev
                        const v = e.target.value
                        if (v === '') return { ...prev, price: null }
                        const n = Number(v)
                        return { ...prev, price: Number.isFinite(n) ? n : null }
                      })
                    }
                    InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    입출 구분 (io_type, 1자)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    inputProps={{ maxLength: 1 }}
                    value={selected.ioType ?? ''}
                    onChange={(e) =>
                      setSelected((prev) =>
                        prev ? { ...prev, ioType: e.target.value || null } : prev,
                      )
                    }
                    InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    일자 (paid_dt)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    inputProps={{ maxLength: 25 }}
                    value={selected.paidDt ?? ''}
                    onChange={(e) =>
                      setSelected((prev) =>
                        prev ? { ...prev, paidDt: e.target.value || null } : prev,
                      )
                    }
                    InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%', gap: 1.5 }}>
              <Button
                onClick={handleCloseDetail}
                color="inherit"
                sx={{
                  backgroundColor: 'grey.100',
                  '&:hover': { backgroundColor: 'grey.200' },
                }}
              >
                닫기
              </Button>
              <Button onClick={() => void handleSaveDetail()} variant="contained" color="primary">
                저장
              </Button>
            </Box>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  )
}
