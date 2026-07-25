import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import RefreshIcon from '@mui/icons-material/Refresh'

import {
  createSptContentCateApi,
  deleteSptContentCateApi,
  fetchSptContentCateGroupsApi,
  fetchSptContentCateItemsApi,
  updateSptContentCateApi,
  updateSptContentCateSortApi,
  type SptContentCateRow,
} from '../../apis/sptContentCateApi'

const DEFAULT_USER_ID = 1

type DialogMode = 'group' | 'item'

export default function SptContentCatePage() {
  const [groups, setGroups] = useState<SptContentCateRow[]>([])
  const [selectedGroup, setSelectedGroup] = useState<SptContentCateRow | null>(null)
  const [items, setItems] = useState<SptContentCateRow[]>([])
  const [selectedDepth1Item, setSelectedDepth1Item] = useState<SptContentCateRow | null>(null)
  const [depth2Items, setDepth2Items] = useState<SptContentCateRow[]>([])
  const [selectedDepth2Item, setSelectedDepth2Item] = useState<SptContentCateRow | null>(null)

  const [loading, setLoading] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode>('group')
  const [editingItem, setEditingItem] = useState<SptContentCateRow | null>(null)
  const [form, setForm] = useState({
    cate_cd: '',
    cate_nm: '',
    sort_no: 1,
    depth: 1,
  })

  const canDeleteGroup = useMemo(() => items.length === 0, [items.length])

  const loadGroups = async () => {
    const list = await fetchSptContentCateGroupsApi()
    setGroups(list)
    if (selectedGroup) {
      const exists = list.some((g) => g.cateCd === selectedGroup.cateCd)
      if (!exists) setSelectedGroup(null)
    }
  }

  const loadItems = async (parentCateCd: string) => {
    const list = await fetchSptContentCateItemsApi(parentCateCd)
    setItems(list)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const list = await fetchSptContentCateGroupsApi()
        if (cancelled) return
        setGroups(list)
        const first = list[0]
        if (first) setSelectedGroup(first)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedGroup) {
      setItems([])
      setSelectedDepth1Item(null)
      setDepth2Items([])
      setSelectedDepth2Item(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        await loadItems(selectedGroup.cateCd)
      } catch {
        if (!cancelled) setItems([])
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup])

  useEffect(() => {
    if (!selectedDepth1Item) return
    const exists = items.some((it) => it.ccId === selectedDepth1Item.ccId)
    if (!exists) setSelectedDepth1Item(null)
  }, [items, selectedDepth1Item])

  useEffect(() => {
    if (!selectedDepth1Item) {
      setDepth2Items([])
      setSelectedDepth2Item(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const list = await fetchSptContentCateItemsApi(selectedDepth1Item.cateCd)
        if (cancelled) return
        setDepth2Items(list)
        setSelectedDepth2Item(null)
      } catch {
        if (!cancelled) {
          setDepth2Items([])
          setSelectedDepth2Item(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedDepth1Item])

  const openCreateGroupDialog = () => {
    setDialogMode('group')
    setEditingItem(null)
    setForm({ cate_cd: '', cate_nm: '', sort_no: 1, depth: 0 })
    setDialogOpen(true)
  }

  const openEditGroupDialog = (row: SptContentCateRow) => {
    setDialogMode('group')
    setEditingItem(row)
    setForm({
      cate_cd: row.cateCd,
      cate_nm: row.cateNm ?? '',
      sort_no: row.sortNo ?? 1,
      depth: row.cateDepth ?? 0,
    })
    setDialogOpen(true)
  }

  const openCreateItemDialog = (targetDepth?: number) => {
    if (!selectedGroup) return
    const depth = Number(targetDepth ?? 1) || 1
    if (depth === 2 && !selectedDepth1Item) {
      alert('하위 분류를 추가하려면 먼저 1단계 항목을 선택해 주세요.')
      return
    }
    setDialogMode('item')
    setEditingItem(null)
    setForm({
      cate_cd: '',
      cate_nm: '',
      sort_no: 1,
      depth,
    })
    setDialogOpen(true)
  }

  const openEditItemDialog = (row: SptContentCateRow) => {
    setDialogMode('item')
    setEditingItem(row)
    setForm({
      cate_cd: row.cateCd,
      cate_nm: row.cateNm ?? '',
      sort_no: row.sortNo ?? 1,
      depth: row.cateDepth ?? 1,
    })
    setDialogOpen(true)
  }

  const submit = async () => {
    if (!form.cate_cd.trim()) {
      alert('cate_cd를 입력해 주세요.')
      return
    }
    if (!form.cate_nm.trim()) {
      alert('cate_nm을 입력해 주세요.')
      return
    }

    if (dialogMode === 'item' && !selectedGroup) {
      alert('루트 분류를 먼저 선택해 주세요.')
      return
    }

    const formDepthNum = Number(form.depth)
    const resolvedDepth = Number.isFinite(formDepthNum) ? formDepthNum : 1

    try {
      setLoading(true)
      if (editingItem) {
        if (dialogMode === 'group') {
          await updateSptContentCateApi(editingItem.ccId, {
            cate_cd: form.cate_cd.trim(),
            cate_nm: form.cate_nm.trim(),
            p_cate_cd: null,
            sort_no: Number(form.sort_no) || 0,
            cate_depth: 0,
            use_flag: editingItem.useFlag ?? 1,
            up_user_id: DEFAULT_USER_ID,
          })
        } else {
          await updateSptContentCateApi(editingItem.ccId, {
            cate_cd: form.cate_cd.trim(),
            cate_nm: form.cate_nm.trim(),
            p_cate_cd: editingItem.pCateCd,
            sort_no: Number(form.sort_no) || 0,
            cate_depth: resolvedDepth,
            use_flag: editingItem.useFlag ?? 1,
            up_user_id: DEFAULT_USER_ID,
          })
        }
      } else if (dialogMode === 'group') {
        await createSptContentCateApi({
          cate_cd: form.cate_cd.trim(),
          cate_nm: form.cate_nm.trim(),
          p_cate_cd: null,
          sort_no: Number(form.sort_no) || 0,
          cate_depth: 0,
          user_id: DEFAULT_USER_ID,
          use_flag: 1,
        })
      } else {
        const itemDepth = resolvedDepth
        let pCateForCreate: string
        if (itemDepth === 2) {
          if (!selectedDepth1Item) {
            alert('2단계 분류를 추가하려면 먼저 1단계 항목을 선택해 주세요.')
            return
          }
          pCateForCreate = selectedDepth1Item.cateCd
        } else {
          pCateForCreate = selectedGroup!.cateCd
        }
        await createSptContentCateApi({
          cate_cd: form.cate_cd.trim(),
          cate_nm: form.cate_nm.trim(),
          p_cate_cd: pCateForCreate,
          sort_no: Number(form.sort_no) || 0,
          cate_depth: itemDepth,
          user_id: DEFAULT_USER_ID,
          use_flag: 1,
        })
      }

      await loadGroups()
      if (selectedGroup) {
        const reloadItems =
          dialogMode === 'item' ||
          (dialogMode === 'group' && editingItem?.ccId === selectedGroup.ccId)
        if (reloadItems) {
          await loadItems(selectedGroup.cateCd)
          if (selectedDepth1Item) {
            const d2 = await fetchSptContentCateItemsApi(selectedDepth1Item.cateCd)
            setDepth2Items(d2)
          }
        }
      }
      setDialogOpen(false)
      setEditingItem(null)
    } catch (e) {
      console.error(e)
      alert(editingItem ? '수정에 실패했습니다.' : '저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteItem = async (row: SptContentCateRow) => {
    const confirmed = window.confirm(`분류를 삭제할까요? (cc_id: ${row.ccId})`)
    if (!confirmed) return
    try {
      setLoading(true)
      await deleteSptContentCateApi([row.ccId], DEFAULT_USER_ID)
      if (selectedGroup) await loadItems(selectedGroup.cateCd)
      if (selectedDepth1Item) {
        const d2 = await fetchSptContentCateItemsApi(selectedDepth1Item.cateCd)
        setDepth2Items(d2)
      }
    } catch (e) {
      console.error(e)
      alert('삭제에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteGroup = async (row: SptContentCateRow) => {
    if (!canDeleteGroup) {
      alert('하위 분류가 있습니다. 먼저 삭제해 주세요.')
      return
    }
    const confirmed = window.confirm(`루트 분류를 삭제할까요? (cc_id: ${row.ccId})`)
    if (!confirmed) return
    try {
      setLoading(true)
      await deleteSptContentCateApi([row.ccId], DEFAULT_USER_ID)
      setSelectedGroup(null)
      setItems([])
      await loadGroups()
    } catch (e) {
      console.error(e)
      alert('삭제에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleMoveGroup = async (dir: 'up' | 'down') => {
    if (!selectedGroup) return
    const idx = groups.findIndex((g) => g.ccId === selectedGroup.ccId)
    if (idx < 0) return
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= groups.length) return

    const a = groups[idx]!
    const b = groups[swapIdx]!
    const aSortNo = a.sortNo ?? idx + 1
    const bSortNo = b.sortNo ?? swapIdx + 1

    try {
      setLoading(true)
      await updateSptContentCateSortApi(a.ccId, bSortNo)
      await updateSptContentCateSortApi(b.ccId, aSortNo)
      await loadGroups()
    } catch (e) {
      console.error(e)
      alert('순서 변경에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleMoveItem = async (item: SptContentCateRow, itemList: SptContentCateRow[], dir: 'up' | 'down') => {
    const idx = itemList.findIndex((r) => r.ccId === item.ccId)
    if (idx < 0) return
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= itemList.length) return

    const a = itemList[idx]!
    const b = itemList[swapIdx]!
    const aSortNo = a.sortNo ?? idx + 1
    const bSortNo = b.sortNo ?? swapIdx + 1

    try {
      setLoading(true)
      await updateSptContentCateSortApi(a.ccId, bSortNo)
      await updateSptContentCateSortApi(b.ccId, aSortNo)
      if (selectedGroup) await loadItems(selectedGroup.cateCd)
    } catch (e) {
      console.error(e)
      alert('순서 변경에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        p: 3,
      }}
    >
      <Box
        sx={{
          flexGrow: 1,
          overflow: 'auto',
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
          <Typography variant="h5" sx={{ mb: 1.5, fontWeight: 600 }}>
            SPT 분류 관리
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            psj_spt_content_cate · 카테고리(루트 / 1·2단계)
          </Typography>

          <GridShell
            loading={loading}
            groups={groups}
            selectedGroup={selectedGroup}
            items={items}
            onSelectGroup={setSelectedGroup}
            onRefresh={async () => {
              try {
                setLoading(true)
                await loadGroups()
              } finally {
                setLoading(false)
              }
            }}
        onCreateGroup={openCreateGroupDialog}
        onEditGroup={openEditGroupDialog}
        onCreateItem={openCreateItemDialog}
            selectedDepth1Item={selectedDepth1Item}
            onSelectDepth1Item={setSelectedDepth1Item}
            depth2Items={depth2Items}
            selectedDepth2Item={selectedDepth2Item}
            onSelectDepth2Item={setSelectedDepth2Item}
            onEditItem={openEditItemDialog}
            onDeleteGroup={handleDeleteGroup}
            onDeleteItem={handleDeleteItem}
            onMoveGroup={handleMoveGroup}
            onMoveItem={handleMoveItem}
          />
        </Paper>
      </Box>

      <Dialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          setEditingItem(null)
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {dialogMode === 'group'
            ? editingItem
              ? '루트 분류 수정'
              : '루트 분류 추가'
            : editingItem
              ? '분류 수정'
              : '분류 추가'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="cate_cd"
              value={form.cate_cd}
              onChange={(e) => setForm((prev) => ({ ...prev, cate_cd: e.target.value }))}
              fullWidth
              disabled={Boolean(editingItem)}
              helperText={
                editingItem
                  ? dialogMode === 'group'
                    ? '하위 분류가 이 코드를 부모로 참조하므로 수정 시 코드는 변경할 수 없습니다.'
                    : '하위가 p_cate_cd로 참조하므로 수정 시 코드는 변경할 수 없습니다.'
                  : undefined
              }
            />
            <TextField
              label="cate_nm"
              value={form.cate_nm}
              onChange={(e) => setForm((prev) => ({ ...prev, cate_nm: e.target.value }))}
              fullWidth
            />
            <TextField
              label="sort_no"
              type="number"
              value={form.sort_no}
              onChange={(e) => setForm((prev) => ({ ...prev, sort_no: Number(e.target.value) }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={loading}>
            취소
          </Button>
          <Button variant="contained" onClick={submit} disabled={loading}>
            {editingItem ? '수정' : '저장'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function GridShell(props: {
  loading: boolean
  groups: SptContentCateRow[]
  selectedGroup: SptContentCateRow | null
  items: SptContentCateRow[]
  onSelectGroup: (g: SptContentCateRow) => void
  onRefresh: () => Promise<void>
  onCreateGroup: () => void
  onEditGroup: (row: SptContentCateRow) => void
  onCreateItem: (depth?: number) => void
  selectedDepth1Item: SptContentCateRow | null
  onSelectDepth1Item: (row: SptContentCateRow) => void
  depth2Items: SptContentCateRow[]
  selectedDepth2Item: SptContentCateRow | null
  onSelectDepth2Item: (row: SptContentCateRow) => void
  onEditItem: (row: SptContentCateRow) => void
  onDeleteGroup: (row: SptContentCateRow) => void
  onDeleteItem: (row: SptContentCateRow) => void
  onMoveGroup: (dir: 'up' | 'down') => void
  onMoveItem: (item: SptContentCateRow, items: SptContentCateRow[], dir: 'up' | 'down') => void
}) {
  const {
    loading,
    groups,
    selectedGroup,
    items,
    onSelectGroup,
    onRefresh,
    onCreateGroup,
    onEditGroup,
    onCreateItem,
    selectedDepth1Item,
    onSelectDepth1Item,
    depth2Items,
    selectedDepth2Item,
    onSelectDepth2Item,
    onEditItem,
    onDeleteGroup,
    onDeleteItem,
    onMoveGroup,
    onMoveItem,
  } = props

  const baseDepth = (selectedGroup?.cateDepth ?? 0) + 1
  const nextDepth = baseDepth + 1
  const baseDepthItems = items.filter((row) => row.cateDepth === baseDepth)

  const renderItemsTable = (
    rows: SptContentCateRow[],
    opts?: {
      selectableDepth?: number
      selectedRow?: SptContentCateRow | null
      onSelectRow?: (row: SptContentCateRow) => void
    },
  ) => (
    <Table size="small">
      <TableHead>
        <TableRow sx={{ backgroundColor: '#f5f7fb' }}>
          <TableCell sx={{ fontWeight: 600 }}>cate_cd</TableCell>
          <TableCell sx={{ fontWeight: 600 }}>cate_nm</TableCell>
          <TableCell sx={{ fontWeight: 600 }} align="center">
            sort_no
          </TableCell>
          <TableCell sx={{ fontWeight: 600 }} align="center" width={160}>
            작업
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.ccId}
            hover={opts?.selectableDepth === row.cateDepth}
            selected={Boolean(
              opts?.selectableDepth === row.cateDepth &&
                opts?.selectedRow &&
                opts.selectedRow.ccId === row.ccId,
            )}
            onClick={() => {
              if (opts?.selectableDepth === row.cateDepth && opts.onSelectRow) opts.onSelectRow(row)
            }}
            sx={{ cursor: opts?.selectableDepth === row.cateDepth ? 'pointer' : 'default' }}
          >
            <TableCell>{row.cateCd}</TableCell>
            <TableCell>{row.cateNm ?? '-'}</TableCell>
            <TableCell align="center">{row.sortNo ?? '-'}</TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  onEditItem(row)
                }}
                disabled={loading}
              >
                <EditOutlinedIcon />
              </IconButton>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteItem(row)
                }}
                disabled={loading}
              >
                <DeleteOutlineIcon />
              </IconButton>
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={4}>
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                항목이 없습니다.
              </Typography>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Paper sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              루트 분류
            </Typography>
            <Stack direction="row" spacing={1}>
              <IconButton size="small" onClick={onRefresh} disabled={loading}>
                <RefreshIcon />
              </IconButton>
              <IconButton size="small" onClick={onCreateGroup} disabled={loading}>
                <AddIcon />
              </IconButton>
            </Stack>
          </Stack>

          <List dense sx={{ maxHeight: '70vh', overflow: 'auto' }}>
            {groups.map((g) => (
              <ListItem
                key={g.ccId}
                disablePadding
                secondaryAction={
                  <IconButton
                    edge="end"
                    size="small"
                    aria-label="루트 분류 수정"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEditGroup(g)
                    }}
                    disabled={loading}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                }
                sx={{ pr: 6 }}
              >
                <ListItemButton
                  selected={selectedGroup?.ccId === g.ccId}
                  onClick={() => onSelectGroup(g)}
                  sx={{ borderRadius: 2 }}
                >
                  <ListItemText
                    primary={`${g.cateCd}${g.cateNm ? ` - ${g.cateNm}` : ''}`}
                    secondary={`depth:${g.cateDepth ?? 0} sort:${g.sortNo ?? '-'}`}
                  />
                </ListItemButton>
              </ListItem>
            ))}
            {groups.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                루트 분류가 없습니다.
              </Typography>
            )}
          </List>

          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
            <Stack direction="row" spacing={0.5}>
              {selectedGroup && (
                <>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={loading || groups.findIndex((g) => g.ccId === selectedGroup.ccId) <= 0}
                    onClick={() => onMoveGroup('up')}
                    sx={{ fontSize: '0.75rem', py: 0.25, px: 1, minHeight: 26 }}
                    startIcon={<ArrowUpwardIcon sx={{ fontSize: 16 }} />}
                  >
                    위로
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={loading || groups.findIndex((g) => g.ccId === selectedGroup.ccId) >= groups.length - 1}
                    onClick={() => onMoveGroup('down')}
                    sx={{ fontSize: '0.75rem', py: 0.25, px: 1, minHeight: 26 }}
                    startIcon={<ArrowDownwardIcon sx={{ fontSize: 16 }} />}
                  >
                    아래로
                  </Button>
                </>
              )}
            </Stack>
            {selectedGroup && (
              <Button
                color="error"
                size="small"
                onClick={() => onDeleteGroup(selectedGroup)}
                disabled={loading || items.length > 0}
              >
                루트 삭제
              </Button>
            )}
          </Stack>
        </Paper>

        <Box>
          {!selectedGroup ? (
            <Paper sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                왼쪽에서 루트 분류를 선택해 주세요.
              </Typography>
            </Paper>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                gap: 2,
                alignItems: 'start',
              }}
            >
              <Paper sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Depth {baseDepth}
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => onCreateItem(baseDepth)}
                    disabled={loading || !selectedGroup}
                  >
                    분류 추가
                  </Button>
                </Stack>
                {renderItemsTable(baseDepthItems, {
                  selectableDepth: baseDepth,
                  selectedRow: selectedDepth1Item,
                  onSelectRow: onSelectDepth1Item,
                })}
                {selectedDepth1Item && (
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={loading || baseDepthItems.findIndex((r) => r.ccId === selectedDepth1Item.ccId) <= 0}
                      onClick={() => onMoveItem(selectedDepth1Item, baseDepthItems, 'up')}
                      sx={{ fontSize: '0.75rem', py: 0.25, px: 1, minHeight: 26 }}
                      startIcon={<ArrowUpwardIcon sx={{ fontSize: 16 }} />}
                    >
                      위로
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={loading || baseDepthItems.findIndex((r) => r.ccId === selectedDepth1Item.ccId) >= baseDepthItems.length - 1}
                      onClick={() => onMoveItem(selectedDepth1Item, baseDepthItems, 'down')}
                      sx={{ fontSize: '0.75rem', py: 0.25, px: 1, minHeight: 26 }}
                      startIcon={<ArrowDownwardIcon sx={{ fontSize: 16 }} />}
                    >
                      아래로
                    </Button>
                  </Stack>
                )}
              </Paper>
              <Paper sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Depth {nextDepth}
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => onCreateItem(nextDepth)}
                    disabled={loading || !selectedGroup || !selectedDepth1Item}
                  >
                    분류 추가
                  </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {selectedDepth1Item
                    ? `선택된 1단계: ${selectedDepth1Item.cateCd}`
                    : '2단계 추가 전, 1단계 항목을 선택해 주세요.'}
                </Typography>
                {renderItemsTable(depth2Items, {
                  selectableDepth: nextDepth,
                  selectedRow: selectedDepth2Item,
                  onSelectRow: onSelectDepth2Item,
                })}
                {selectedDepth2Item && (
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={loading || depth2Items.findIndex((r) => r.ccId === selectedDepth2Item.ccId) <= 0}
                      onClick={() => onMoveItem(selectedDepth2Item, depth2Items, 'up')}
                      sx={{ fontSize: '0.75rem', py: 0.25, px: 1, minHeight: 26 }}
                      startIcon={<ArrowUpwardIcon sx={{ fontSize: 16 }} />}
                    >
                      위로
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={loading || depth2Items.findIndex((r) => r.ccId === selectedDepth2Item.ccId) >= depth2Items.length - 1}
                      onClick={() => onMoveItem(selectedDepth2Item, depth2Items, 'down')}
                      sx={{ fontSize: '0.75rem', py: 0.25, px: 1, minHeight: 26 }}
                      startIcon={<ArrowDownwardIcon sx={{ fontSize: 16 }} />}
                    >
                      아래로
                    </Button>
                  </Stack>
                )}
              </Paper>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}
