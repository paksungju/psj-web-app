import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import {
  contentBlockdelUpdate,
  fetchContentBlockData,
  positionSave,
  postContentBlockSave,
  type IContentBlockModel,
} from '../../apis/contentBlockApi'
import {
  fetchSptResourcesApi,
  type SptResourceRow,
} from '../../apis/sptResourcesApi'

type ContentBlockListModalProps = {
  open: boolean
  onClose: () => void
  selectedCiId: string | null
  selectedCategoryLabel?: string
  onSaved: () => void | Promise<void>
  onViewBlock?: (block: IContentBlockModel) => void
  refreshKey?: number
}

type DraftContentBlockRow = {
  tempId: string
  crId: number
  cbSubject: string
  cbContent: string
  coType: string
  imgUrl: string
  width: string
  height: string
  leftP: string
  topP: string
  zindex: string
  linkUrl: string
  useYn: string
}

function toAbsoluteUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  const env = import.meta.env as Record<string, string | undefined>
  const host =
    env.VITE_ASSET_BASE_URL?.trim() ||
    env.VITE_API_BASE_URL?.trim() ||
    env.VITE_API_BASE?.trim() ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://impsj.net')
  return `${host.replace(/\/+$/, '')}${url.startsWith('/') ? url : `/${url}`}`
}

function resourceImageUrl(resource: SptResourceRow): string {
  const url = resource.imgUrl?.trim()
  if (!url) return ''
  return toAbsoluteUrl(url)
}

function ImageThumb({ src, alt }: { src: string; alt?: string }) {
  if (!src) {
    return (
      <Typography variant="caption" color="text.secondary">
        -
      </Typography>
    )
  }
  return (
    <Box
      component="img"
      src={src}
      alt={alt ?? ''}
      sx={{
        width: 48,
        height: 48,
        objectFit: 'cover',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        display: 'block',
      }}
    />
  )
}

function createDraftFromResource(resource: SptResourceRow): DraftContentBlockRow {
  return {
    tempId: `draft-${resource.crId}-${Math.random().toString(36).slice(2, 9)}`,
    crId: resource.crId,
    cbSubject: resource.subject,
    cbContent: resource.content ?? '',
    coType: resource.coType?.trim() || 'C01',
    imgUrl: resource.imgUrl ?? '',
    width: String(resource.weight ?? 100),
    height: String(resource.heigth ?? 100),
    leftP: '0',
    topP: '0',
    zindex: '0',
    linkUrl: resource.linkUrl ?? '',
    useYn: '1',
  }
}

function createEmptyDraft(): DraftContentBlockRow {
  return {
    tempId: `draft-new-${Math.random().toString(36).slice(2, 9)}`,
    crId: 0,
    cbSubject: '',
    cbContent: '',
    coType: 'C01',
    imgUrl: '',
    width: '100',
    height: '100',
    leftP: '0',
    topP: '0',
    zindex: '0',
    linkUrl: '',
    useYn: '1',
  }
}

function draftToPayload(ciId: string, draft: DraftContentBlockRow): Record<string, unknown> {
  return {
    ciId,
    crId: draft.crId,
    cbSubject: draft.cbSubject,
    cbContent: draft.cbContent,
    coType: draft.coType,
    imgUrl: draft.imgUrl,
    width: Number(draft.width) || 100,
    height: Number(draft.height) || 100,
    leftP: Number(draft.leftP) || 0,
    topP: Number(draft.topP) || 0,
    zindex: Number(draft.zindex) || 0,
    linkUrl: draft.linkUrl,
    useYn: draft.useYn,
    delYn: '0',
  }
}

const draftInputSx = {
  width: 72,
  '& .MuiOutlinedInput-root': {
    height: 26,
    fontSize: '0.75rem',
  },
  '& .MuiOutlinedInput-input': {
    py: 0,
    px: 0.75,
  },
}

const draftCellSx = { py: 0.5 }

export default function ContentBlockListModal({
  open,
  onClose,
  selectedCiId,
  selectedCategoryLabel = '',
  onSaved,
  onViewBlock,
  refreshKey,
}: ContentBlockListModalProps) {
  const [rows, setRows] = useState<IContentBlockModel[]>([])
  const [resources, setResources] = useState<SptResourceRow[]>([])
  const [selectedCrIds, setSelectedCrIds] = useState<number[]>([])
  const [selectedCbIds, setSelectedCbIds] = useState<string[]>([])
  const [draftRows, setDraftRows] = useState<DraftContentBlockRow[]>([])
  const [isRowEditMode, setIsRowEditMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const registeredCrIdCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const row of rows) {
      const crId = Number(row.crId ?? 0)
      if (crId > 0) counts.set(crId, (counts.get(crId) ?? 0) + 1)
    }
    return counts
  }, [rows])

  const loadRows = useCallback(async () => {
    if (!selectedCiId) {
      setRows([])
      return
    }
    setLoading(true)
    try {
      const list = await fetchContentBlockData({ ciId: selectedCiId })
      setRows(
        (list ?? []).map((row) => ({
          ...row,
          cbId: String(row.cbId ?? '').trim(),
        })),
      )
    } catch (e) {
      console.error('콘텐츠블록 목록 조회 실패:', e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [selectedCiId])

  const loadResources = useCallback(async () => {
    try {
      const list = await fetchSptResourcesApi({ limit: 500 })
      setResources(list ?? [])
    } catch (e) {
      console.error('리소스 목록 조회 실패:', e)
      setResources([])
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setIsRowEditMode(false)
      setDraftRows([])
      setSelectedCrIds([])
      setSelectedCbIds([])
      return
    }
    void loadRows()
    void loadResources()
    setSelectedCrIds([])
    setSelectedCbIds([])
    setIsRowEditMode(false)
    setDraftRows([])
  }, [open, loadRows, loadResources])

  useEffect(() => {
    if (refreshKey && open) {
      void loadRows()
    }
  }, [refreshKey, open, loadRows])

  const toggleResource = (crId: number) => {
    setSelectedCrIds((prev) =>
      prev.includes(crId) ? prev.filter((id) => id !== crId) : [...prev, crId],
    )
  }

  const handleRowAdd = () => {
    if (!selectedCiId) {
      window.alert('콘텐츠 항목을 먼저 선택해 주세요.')
      return
    }
    if (selectedCrIds.length === 0) {
      window.alert('추가할 리소스를 선택해 주세요.')
      return
    }

    const targets = resources.filter((resource) => selectedCrIds.includes(resource.crId))
    if (targets.length === 0) {
      window.alert('추가할 리소스를 선택해 주세요.')
      return
    }

    setIsRowEditMode(true)
    setDraftRows(targets.map(createDraftFromResource))
    setSelectedCrIds([])
  }

  const handleNewAdd = () => {
    if (!selectedCiId) {
      window.alert('콘텐츠 항목을 먼저 선택해 주세요.')
      return
    }
    setIsRowEditMode(true)
    setDraftRows((prev) => [...prev, createEmptyDraft()])
  }

  const handleRowCancel = () => {
    setIsRowEditMode(false)
    setDraftRows([])
    setSelectedCrIds([])
  }

  const updateDraftRow = (tempId: string, patch: Partial<DraftContentBlockRow>) => {
    setDraftRows((prev) => prev.map((row) => (row.tempId === tempId ? { ...row, ...patch } : row)))
  }

  const removeDraftRow = (tempId: string) => {
    setDraftRows((prev) => {
      const next = prev.filter((row) => row.tempId !== tempId)
      if (next.length === 0) setIsRowEditMode(false)
      return next
    })
  }

  const handleBatchSave = async () => {
    if (!selectedCiId || draftRows.length === 0) return

    const invalid = draftRows.find((row) => !row.cbSubject.trim())
    if (invalid) {
      window.alert('제목(cb_subject)을 입력해 주세요.')
      return
    }

    setSaving(true)
    const saveCount = draftRows.length
    try {
      for (const draft of draftRows) {
        await postContentBlockSave(draftToPayload(selectedCiId, draft))
      }
      setIsRowEditMode(false)
      setDraftRows([])
      await loadRows()
      await onSaved()
      window.alert(`${saveCount}건 저장되었습니다.`)
    } catch (e) {
      console.error('콘텐츠블록 다중 저장 실패:', e)
      window.alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (cbId: string) => {
    if (!window.confirm('이 콘텐츠블록을 삭제하시겠습니까?')) return
    try {
      await contentBlockdelUpdate({ cbId })
      await loadRows()
      await onSaved()
    } catch (e) {
      console.error('콘텐츠블록 삭제 실패:', e)
      window.alert('삭제 중 오류가 발생했습니다.')
    }
  }

  const [savingOrder, setSavingOrder] = useState(false)

  const moveSelected = (dir: 'up' | 'down') => {
    if (selectedCbIds.length !== 1) return
    const cbId = selectedCbIds[0]
    const idx = rows.findIndex((r) => r.cbId === cbId)
    if (idx < 0) return
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= rows.length) return
    setRows((prev) => {
      const next = [...prev]
      const tmp = next[idx]!
      next[idx] = next[swapIdx]!
      next[swapIdx] = tmp
      return next
    })
  }

  const handleOrderSave = async () => {
    if (rows.length === 0) return
    setSavingOrder(true)
    try {
      const payload = rows.map((row, i) => ({
        cbId: row.cbId,
        zindex: i,
      }))
      await positionSave(payload)
      await loadRows()
      await onSaved()
      window.alert('순서가 저장되었습니다.')
    } catch (e) {
      console.error('순서 저장 실패:', e)
      window.alert('순서 저장에 실패했습니다.')
    } finally {
      setSavingOrder(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth disableEnforceFocus>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight={600}>
            콘텐츠블록 목록
          </Typography>
          {/* <Typography variant="caption" color="text.secondary">
            ci_id: {selectedCiId ?? '-'}
          </Typography> */}
        </Box>
        <IconButton onClick={onClose} aria-label="닫기">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <Box>
            {/* <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
              리소스 다중 등록 (cr_id)
            </Typography> */}
            {!selectedCiId ? (
              <Typography variant="body2" color="text.secondary">
                왼쪽에서 콘텐츠 항목을 먼저 선택해 주세요.
              </Typography>
            ) : resources.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                등록된 리소스가 없습니다.
              </Typography>
            ) : (
              <Box
                sx={{
                  maxHeight: 220,
                  overflow: 'auto',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f5f7fb' }}>
                      <TableCell padding="checkbox" />
                      <TableCell sx={{ fontWeight: 600, width: 80 }}>cr_id</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 64 }} align="center">이미지</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 90 }}>타입</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>제목</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 100 }}>상태</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {resources.map((resource) => {
                      const registeredCount = registeredCrIdCounts.get(resource.crId) ?? 0
                      return (
                        <TableRow key={resource.crId} hover>
                          <TableCell padding="checkbox">
                            <Checkbox
                              size="small"
                              checked={selectedCrIds.includes(resource.crId)}
                              disabled={isRowEditMode}
                              onChange={() => toggleResource(resource.crId)}
                            />
                          </TableCell>
                          <TableCell>{resource.crId}</TableCell>
                          <TableCell align="center">
                            <ImageThumb src={resourceImageUrl(resource)} alt={resource.subject} />
                          </TableCell>
                          <TableCell>{resource.coType?.trim() || '-'}</TableCell>
                          <TableCell>{resource.subject}</TableCell>
                          <TableCell>
                            {registeredCount > 0 ? (
                              <Typography variant="caption" color="text.secondary">
                                등록됨{registeredCount > 1 ? ` (${registeredCount})` : ''}
                              </Typography>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Box>

          <Box>
            {/* <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
              psj_spt_content_block
            </Typography> */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 1 }}>
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                onClick={handleRowCancel}
                disabled={!isRowEditMode}
                sx={{ borderColor: 'grey.400', fontSize: '0.75rem', py: 0.25, px: 1, minHeight: 26 }}
              >
                RowCancel
              </Button>
              <Button
                variant="contained"
                size="small"
                disabled={!selectedCiId || selectedCrIds.length === 0 || saving || isRowEditMode}
                onClick={handleRowAdd}
                sx={{ fontSize: '0.75rem', py: 0.25, px: 1, minHeight: 26 }}
              >
                선택추가
              </Button>
              <Button
                variant="contained"
                size="small"
                disabled={!selectedCiId || saving}
                onClick={handleNewAdd}
                sx={{ fontSize: '0.75rem', py: 0.25, px: 1, minHeight: 26 }}
              >
                NewAdd
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {selectedCategoryLabel || '분류 미선택'}
            </Typography>

            {isRowEditMode ? (
              <Box
                sx={{
                  maxHeight: 200,
                  overflow: 'auto',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f5f7fb' }}>
                      <TableCell sx={{ fontWeight: 600, width: 70 }}>cb_id</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 70 }}>ci_id</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 70 }}>cr_id</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 100 }}>제목</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 70 }}>width</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 70 }}>height</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 70 }}>leftP</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 70 }}>topP</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 70 }}>zindex</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 70 }}>useYn</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 48 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {draftRows.map((row) => (
                      <TableRow key={row.tempId} hover>
                        <TableCell sx={draftCellSx}>-</TableCell>
                        <TableCell sx={draftCellSx}>{selectedCiId}</TableCell>
                        <TableCell sx={draftCellSx}>
                          <TextField
                            size="small"
                            type="number"
                            value={row.crId}
                            onChange={(e) => updateDraftRow(row.tempId, { crId: Number(e.target.value) || 0 })}
                            sx={draftInputSx}
                          />
                        </TableCell>
                        <TableCell sx={draftCellSx}>
                          <TextField
                            size="small"
                            value={row.cbSubject}
                            onChange={(e) => updateDraftRow(row.tempId, { cbSubject: e.target.value })}
                            sx={draftInputSx}
                          />
                        </TableCell>
                        <TableCell sx={draftCellSx}>
                          <TextField
                            size="small"
                            type="number"
                            value={row.width}
                            onChange={(e) => updateDraftRow(row.tempId, { width: e.target.value })}
                            sx={draftInputSx}
                          />
                        </TableCell>
                        <TableCell sx={draftCellSx}>
                          <TextField
                            size="small"
                            type="number"
                            value={row.height}
                            onChange={(e) => updateDraftRow(row.tempId, { height: e.target.value })}
                            sx={draftInputSx}
                          />
                        </TableCell>
                        <TableCell sx={draftCellSx}>
                          <TextField
                            size="small"
                            type="number"
                            value={row.leftP}
                            onChange={(e) => updateDraftRow(row.tempId, { leftP: e.target.value })}
                            sx={draftInputSx}
                          />
                        </TableCell>
                        <TableCell sx={draftCellSx}>
                          <TextField
                            size="small"
                            type="number"
                            value={row.topP}
                            onChange={(e) => updateDraftRow(row.tempId, { topP: e.target.value })}
                            sx={draftInputSx}
                          />
                        </TableCell>
                        <TableCell sx={draftCellSx}>
                          <TextField
                            size="small"
                            type="number"
                            value={row.zindex}
                            onChange={(e) => updateDraftRow(row.tempId, { zindex: e.target.value })}
                            sx={draftInputSx}
                          />
                        </TableCell>
                        <TableCell sx={draftCellSx}>
                          <TextField
                            size="small"
                            value={row.useYn}
                            onChange={(e) => updateDraftRow(row.tempId, { useYn: e.target.value })}
                            sx={draftInputSx}
                          />
                        </TableCell>
                        <TableCell align="center" sx={draftCellSx}>
                          <IconButton size="small" onClick={() => removeDraftRow(row.tempId)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ) : loading ? (
              <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={28} />
              </Box>
            ) : rows.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                등록된 콘텐츠블록이 없습니다.
              </Typography>
            ) : (
              <Box
                sx={{
                  maxHeight: 200,
                  overflow: 'auto',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f5f7fb' }}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={rows.length > 0 && selectedCbIds.length === rows.length}
                          indeterminate={selectedCbIds.length > 0 && selectedCbIds.length < rows.length}
                          onChange={(e) =>
                            setSelectedCbIds(e.target.checked ? rows.map((r) => r.cbId) : [])
                          }
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 70 }}>ci_id</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 70 }}>cr_id</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 70 }}>width</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 70 }}>height</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 70 }}>leftP</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 70 }}>topP</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 70 }}>zindex</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 70 }}>useYn</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: 48 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.cbId} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            size="small"
                            checked={selectedCbIds.includes(row.cbId)}
                            onChange={() =>
                              setSelectedCbIds((prev) =>
                                prev.includes(row.cbId)
                                  ? prev.filter((id) => id !== row.cbId)
                                  : [...prev, row.cbId],
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>{row.ciId ?? selectedCiId ?? '-'}</TableCell>
                        <TableCell>{row.crId ?? 0}</TableCell>
                        <TableCell>{row.width ?? 0}</TableCell>
                        <TableCell>{row.height ?? 0}</TableCell>
                        <TableCell>{row.leftP ?? 0}</TableCell>
                        <TableCell>{row.topP ?? 0}</TableCell>
                        <TableCell>{row.zindex ?? 0}</TableCell>
                        <TableCell>{row.useYn ?? 0}</TableCell>
                        <TableCell align="center">
                          {onViewBlock && (
                            <IconButton size="small" onClick={() => onViewBlock(row)} title="보기">
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          )}
                          <IconButton size="small" onClick={() => void handleDelete(row.cbId)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 2,
          justifyContent: 'space-between',
        }}
      >
        {!isRowEditMode ? (
          <>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {rows.length > 0 && (
                <>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={selectedCbIds.length !== 1 || rows.findIndex((r) => r.cbId === selectedCbIds[0]) <= 0}
                    onClick={() => moveSelected('up')}
                    sx={{ fontSize: '0.75rem', py: 0.25, px: 1, minHeight: 26 }}
                    startIcon={<ArrowUpwardIcon sx={{ fontSize: 16 }} />}
                  >
                    위로
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={selectedCbIds.length !== 1 || rows.findIndex((r) => r.cbId === selectedCbIds[0]) >= rows.length - 1}
                    onClick={() => moveSelected('down')}
                    sx={{ fontSize: '0.75rem', py: 0.25, px: 1, minHeight: 26 }}
                    startIcon={<ArrowDownwardIcon sx={{ fontSize: 16 }} />}
                  >
                    아래로
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={savingOrder}
                    onClick={() => void handleOrderSave()}
                    sx={{ fontSize: '0.75rem', py: 0.25, px: 1, minHeight: 26 }}
                  >
                    {savingOrder ? '저장 중...' : '순서 저장'}
                  </Button>
                </>
              )}
            </Box>
            <Button variant="outlined" color="inherit" size="small" onClick={onClose} sx={{ borderColor: 'grey.400' }}>
              닫기
            </Button>
          </>
        ) : (
          <>
            <Box />
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                onClick={onClose}
                sx={{ borderColor: 'grey.400' }}
              >
                닫기
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                onClick={handleRowCancel}
                disabled={saving}
                sx={{ borderColor: 'grey.400' }}
              >
                취소
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={() => void handleBatchSave()}
                disabled={saving || draftRows.length === 0}
              >
                {saving ? '저장 중...' : `저장하기 (${draftRows.length})`}
              </Button>
            </Stack>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
