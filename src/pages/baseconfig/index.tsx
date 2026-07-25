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
  createBaseConfigApi,
  deleteBaseConfigApi,
  fetchBaseConfigDetailApi,
  fetchBaseConfigsApi,
  updateBaseConfigApi,
  type BaseConfigRow,
} from '../../apis/baseConfigApi'
import BaseConfigAgGrid, {
  type BaseConfigGridContext,
  type BaseConfigGridRow,
  isDraftGridRow,
} from './BaseConfigAgGrid'

function formatDate(s: string) {
  return s?.slice(0, 10) ?? ''
}

function newDraftRow(sortNo: number): BaseConfigGridRow {
  return {
    draftKey: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    configId: 0,
    cfSubject: '',
    cfKey: null,
    cfVal: null,
    sortNo,
    createdAt: '',
  }
}

export default function BaseConfigPage() {
  const [rows, setRows] = useState<BaseConfigRow[]>([])
  const [draftRows, setDraftRows] = useState<BaseConfigGridRow[]>([])
  const [selected, setSelected] = useState<BaseConfigRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [menuRow, setMenuRow] = useState<BaseConfigRow | null>(null)

  const gridRows = useMemo<BaseConfigGridRow[]>(
    () => [...rows, ...draftRows],
    [rows, draftRows],
  )

  const reloadList = useCallback(async () => {
    try {
      const data = await fetchBaseConfigsApi()
      setRows(data)
    } catch (e) {
      console.error('기본설정 목록 로드 실패:', e)
    }
  }, [])

  useEffect(() => {
    void reloadList()
  }, [reloadList])

  const handleOpenDetail = useCallback(async (row: BaseConfigRow) => {
    setSelected(row)
    setDetailOpen(true)
    try {
      const detail = await fetchBaseConfigDetailApi(row.configId)
      setSelected(detail)
    } catch (e) {
      console.error('기본설정 상세 로드 실패:', e)
    }
  }, [])

  const handleCloseDetail = () => {
    setDetailOpen(false)
  }

  const handleSaveDetail = async () => {
    if (!selected) return
    if (!selected.cfSubject?.trim()) {
      alert('제목(cf_subject)은 필수입니다.')
      return
    }
    try {
      await updateBaseConfigApi(selected.configId, {
        cf_subject: selected.cfSubject.trim(),
        cf_key: selected.cfKey?.trim() || null,
        cf_val: selected.cfVal?.trim() || null,
        sort_no: Number(selected.sortNo) || 0,
      })
      setDetailOpen(false)
      await reloadList()
    } catch (e) {
      console.error('기본설정 저장 실패:', e)
      alert('저장에 실패했습니다.')
    }
  }

  const nextSortNo = useCallback(() => {
    const nums = [
      ...rows.map((r) => Number(r.sortNo) || 0),
      ...draftRows.map((r) => Number(r.sortNo) || 0),
    ]
    return nums.length > 0 ? Math.max(...nums) + 1 : 0
  }, [rows, draftRows])

  const handleOpenRowAdd = useCallback(() => {
    setDraftRows((prev) => [...prev, newDraftRow(nextSortNo())])
  }, [nextSortNo])

  const handleSaveDraft = useCallback(
    async (row: BaseConfigGridRow) => {
      if (!row.draftKey) return
      if (!row.cfSubject?.trim()) {
        alert('제목(cf_subject)은 필수입니다.')
        return
      }
      try {
        await createBaseConfigApi({
          cf_subject: row.cfSubject.trim(),
          cf_key: row.cfKey?.trim() || null,
          cf_val: row.cfVal?.trim() || null,
          sort_no: Number(row.sortNo) || 0,
        })
        setDraftRows((prev) => prev.filter((d) => d.draftKey !== row.draftKey))
        await reloadList()
      } catch (e) {
        console.error('기본설정 등록 실패:', e)
        alert('등록에 실패했습니다.')
      }
    },
    [reloadList],
  )

  const handleCancelDraft = useCallback((row: BaseConfigGridRow) => {
    if (!row.draftKey) return
    setDraftRows((prev) => prev.filter((d) => d.draftKey !== row.draftKey))
  }, [])

  const handleCellValueChanged = useCallback((e: CellValueChangedEvent<BaseConfigGridRow>) => {
    if (!isDraftGridRow(e.data) || !e.data.draftKey) return
    const field = e.colDef.field as keyof BaseConfigGridRow | undefined
    if (!field || field === 'draftKey' || field === 'configId' || field === 'createdAt') return

    const draftKey = e.data.draftKey
    let value: unknown = e.newValue

    if (field === 'cfKey' || field === 'cfVal') {
      const t = String(value ?? '').trim().slice(0, 30)
      value = t === '' ? null : t
    } else if (field === 'cfSubject') {
      value = String(value ?? '').slice(0, 30)
    } else if (field === 'sortNo') {
      value = Number(value) || 0
    }

    setDraftRows((prev) =>
      prev.map((d) => (d.draftKey === draftKey ? { ...d, [field]: value } : d)),
    )
  }, [])

  const handleOpenRowMenu = useCallback((event: React.MouseEvent<HTMLElement>, row: BaseConfigRow) => {
    setMenuAnchorEl(event.currentTarget)
    setMenuRow(row)
  }, [])

  const gridContext = useMemo<BaseConfigGridContext>(
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
    const ok = window.confirm(`"${t.cfSubject}" 항목을 삭제하시겠습니까?`)
    handleCloseRowMenu()
    if (!ok) return
    try {
      await deleteBaseConfigApi(t.configId)
      if (selected?.configId === t.configId) {
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
          기본 설정
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          시스템 기본 설정값을 관리합니다. (psj_base_config) 신규 행은 셀 더블클릭으로 편집, ✓/✕로 저장·취소합니다.
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
          <BaseConfigAgGrid rows={gridRows} context={gridContext} onCellValueChanged={handleCellValueChanged} />
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
          <DialogTitle sx={{ fontWeight: 600 }}>기본설정 상세</DialogTitle>
          <DialogContent dividers sx={{ pt: 3 }}>
            {selected && (
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    NO
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={selected.configId}
                    InputProps={{ readOnly: true, sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    제목 (cf_subject)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    inputProps={{ maxLength: 30 }}
                    value={selected.cfSubject}
                    onChange={(e) =>
                      setSelected((prev) => (prev ? { ...prev, cfSubject: e.target.value } : prev))
                    }
                    InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    키 (cf_key)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    inputProps={{ maxLength: 30 }}
                    value={selected.cfKey ?? ''}
                    onChange={(e) =>
                      setSelected((prev) => (prev ? { ...prev, cfKey: e.target.value || null } : prev))
                    }
                    InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    값 (cf_val)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    inputProps={{ maxLength: 30 }}
                    value={selected.cfVal ?? ''}
                    onChange={(e) =>
                      setSelected((prev) => (prev ? { ...prev, cfVal: e.target.value || null } : prev))
                    }
                    InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    정렬 (sort_no)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    value={selected.sortNo}
                    onChange={(e) =>
                      setSelected((prev) =>
                        prev ? { ...prev, sortNo: Number(e.target.value) || 0 } : prev,
                      )
                    }
                    InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
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
