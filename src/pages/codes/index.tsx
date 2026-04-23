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
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import RefreshIcon from '@mui/icons-material/Refresh'

import {
  createCodeApi,
  deleteCodesApi,
  fetchCodeGroupsApi,
  fetchCodesByParentApi,
  updateCodeApi,
  type CodeRow,
} from '../../apis/codesApi'

type DialogMode = 'group' | 'item'

export default function CodesPage() {
  const [groups, setGroups] = useState<CodeRow[]>([])
  const [selectedGroup, setSelectedGroup] = useState<CodeRow | null>(null)
  const [items, setItems] = useState<CodeRow[]>([])
  const [selectedDepth1Item, setSelectedDepth1Item] = useState<CodeRow | null>(null)
  const [depth2Items, setDepth2Items] = useState<CodeRow[]>([])
  const [selectedDepth2Item, setSelectedDepth2Item] = useState<CodeRow | null>(null)
  const [depth3Items, setDepth3Items] = useState<CodeRow[]>([])

  const [loading, setLoading] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode>('group')
  const [editingItem, setEditingItem] = useState<CodeRow | null>(null)
  const [form, setForm] = useState({
    code_cd: '',
    code_nm: '',
    sort_no: 1,
    depth: 1,
  })

  const canDeleteGroup = useMemo(() => items.length === 0, [items.length])

  const loadGroups = async () => {
    const res = await fetchCodeGroupsApi()
    setGroups(res.items)
    // 선택 유지 (없으면 첫 그룹 선택)
    if (selectedGroup) {
      const exists = res.items.some((g) => g.code_cd === selectedGroup.code_cd)
      if (!exists) setSelectedGroup(null)
    }
  }

  const loadItems = async (parentCodeCd: string) => {
    const res = await fetchCodesByParentApi(parentCodeCd)
    setItems(res.items)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetchCodeGroupsApi()
        if (cancelled) return
        setGroups(res.items)
        const first = res.items[0]
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
      setDepth3Items([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        await loadItems(selectedGroup.code_cd)
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
    const exists = items.some((it) => it.code_id === selectedDepth1Item.code_id)
    if (!exists) setSelectedDepth1Item(null)
  }, [items, selectedDepth1Item])

  useEffect(() => {
    if (!selectedDepth1Item) {
      setDepth2Items([])
      setSelectedDepth2Item(null)
      setDepth3Items([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetchCodesByParentApi(selectedDepth1Item.code_cd)
        if (cancelled) return
        setDepth2Items(res.items)
        setSelectedDepth2Item(null)
        setDepth3Items([])
      } catch {
        if (!cancelled) {
          setDepth2Items([])
          setSelectedDepth2Item(null)
          setDepth3Items([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedDepth1Item])

  useEffect(() => {
    if (!selectedDepth2Item) {
      setDepth3Items([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetchCodesByParentApi(selectedDepth2Item.code_cd)
        if (cancelled) return
        setDepth3Items(res.items)
      } catch {
        if (!cancelled) setDepth3Items([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedDepth2Item])

  const openCreateGroupDialog = () => {
    setDialogMode('group')
    setEditingItem(null)
    setForm({ code_cd: '', code_nm: '', sort_no: 1, depth: 0 })
    setDialogOpen(true)
  }

  const openCreateItemDialog = (targetDepth?: number) => {
    if (!selectedGroup) return
    const depth = Number(targetDepth ?? 1) || 1
    if (depth === 2 && !selectedDepth1Item) {
      alert('Depth 2 코드를 추가하려면 Depth 1 항목을 먼저 선택해 주세요.')
      return
    }
    if (depth === 3 && !selectedDepth2Item) {
      alert('Depth 3 코드를 추가하려면 Depth 2 항목을 먼저 선택해 주세요.')
      return
    }
    setDialogMode('item')
    setEditingItem(null)
    setForm({
      code_cd: '',
      code_nm: '',
      sort_no: 1,
      depth,
    })
    setDialogOpen(true)
  }

  const openEditItemDialog = (row: CodeRow) => {
    setDialogMode('item')
    setEditingItem(row)
    setForm({
      code_cd: row.code_cd,
      code_nm: row.code_nm ?? '',
      sort_no: row.sort_no,
      depth: row.depth,
    })
    setDialogOpen(true)
  }

  const submit = async () => {
    if (!form.code_cd.trim()) {
      alert('code_cd를 입력해 주세요.')
      return
    }

    if (dialogMode === 'item' && !selectedGroup) {
      alert('분류(그룹)를 먼저 선택해 주세요.')
      return
    }

    const payload =
      dialogMode === 'group'
        ? {
            code_cd: form.code_cd.trim(),
            code_nm: form.code_nm.trim() || null,
            p_code: null,
            sort_no: Number(form.sort_no) || 0,
            depth: 0,
            is_group: 1,
          }
        : {
            code_cd: form.code_cd.trim(),
            code_nm: form.code_nm.trim() || null,
            p_code:
              (Number(form.depth) || 1) === 3
                ? (selectedDepth2Item?.code_cd ?? selectedDepth1Item?.code_cd ?? selectedGroup!.code_cd)
                : (Number(form.depth) || 1) === 2
                  ? (selectedDepth1Item?.code_cd ?? selectedGroup!.code_cd)
                  : selectedGroup!.code_cd,
            sort_no: Number(form.sort_no) || 0,
            depth: Number(form.depth) || 1,
            is_group: 0,
          }

    try {
      setLoading(true)
      if (editingItem) {
        await updateCodeApi(editingItem.code_id, {
          code_cd: form.code_cd.trim(),
          code_nm: form.code_nm.trim() || null,
          p_code: editingItem.p_code,
          sort_no: Number(form.sort_no) || 0,
          depth: Number(form.depth) || 1,
          is_group: editingItem.is_group,
        })
      } else {
        await createCodeApi(payload)
      }
      await loadGroups()
      if (dialogMode === 'item' && selectedGroup) {
        await loadItems(selectedGroup.code_cd)
        if (selectedDepth1Item) {
          const d2 = await fetchCodesByParentApi(selectedDepth1Item.code_cd)
          setDepth2Items(d2.items)
        }
        if (selectedDepth2Item) {
          const d3 = await fetchCodesByParentApi(selectedDepth2Item.code_cd)
          setDepth3Items(d3.items)
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

  const handleDeleteItem = async (row: CodeRow) => {
    const confirmed = window.confirm(`아이템 삭제? (code_id: ${row.code_id})`)
    if (!confirmed) return
    try {
      setLoading(true)
      await deleteCodesApi([row.code_id])
      if (selectedGroup) await loadItems(selectedGroup.code_cd)
    } catch (e) {
      console.error(e)
      alert('삭제에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteGroup = async (row: CodeRow) => {
    if (!canDeleteGroup) {
      alert('해당 그룹에 아이템이 존재합니다. 아이템을 먼저 삭제해 주세요.')
      return
    }
    const confirmed = window.confirm(`그룹 삭제? (code_id: ${row.code_id})`)
    if (!confirmed) return
    try {
      setLoading(true)
      await deleteCodesApi([row.code_id])
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

  return (
    <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 3 }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          코드관리
        </Typography>
      </Box>

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
        onCreateItem={openCreateItemDialog}
        selectedDepth1Item={selectedDepth1Item}
        onSelectDepth1Item={setSelectedDepth1Item}
        depth2Items={depth2Items}
        selectedDepth2Item={selectedDepth2Item}
        onSelectDepth2Item={setSelectedDepth2Item}
        depth3Items={depth3Items}
        onEditItem={openEditItemDialog}
        onDeleteGroup={handleDeleteGroup}
        onDeleteItem={handleDeleteItem}
      />

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
          {dialogMode === 'group' ? '그룹 추가' : editingItem ? '아이템 수정' : '아이템 추가'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="code_cd"
              value={form.code_cd}
              onChange={(e) => setForm((prev) => ({ ...prev, code_cd: e.target.value }))}
              fullWidth
            />
            <TextField
              label="code_nm"
              value={form.code_nm}
              onChange={(e) => setForm((prev) => ({ ...prev, code_nm: e.target.value }))}
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
  groups: CodeRow[]
  selectedGroup: CodeRow | null
  items: CodeRow[]
  onSelectGroup: (g: CodeRow) => void
  onRefresh: () => Promise<void>
  onCreateGroup: () => void
  onCreateItem: (depth?: number) => void
  selectedDepth1Item: CodeRow | null
  onSelectDepth1Item: (row: CodeRow) => void
  depth2Items: CodeRow[]
  selectedDepth2Item: CodeRow | null
  onSelectDepth2Item: (row: CodeRow) => void
  depth3Items: CodeRow[]
  onEditItem: (row: CodeRow) => void
  onDeleteGroup: (row: CodeRow) => void
  onDeleteItem: (row: CodeRow) => void
}) {
  const {
    loading,
    groups,
    selectedGroup,
    items,
    onSelectGroup,
    onRefresh,
    onCreateGroup,
    onCreateItem,
    selectedDepth1Item,
    onSelectDepth1Item,
    depth2Items,
    selectedDepth2Item,
    onSelectDepth2Item,
    depth3Items,
    onEditItem,
    onDeleteGroup,
    onDeleteItem,
  } = props

  const baseDepth = (selectedGroup?.depth ?? 0) + 1
  const nextDepth = baseDepth + 1
  const baseDepthItems = items.filter((row) => row.depth === baseDepth)
  void depth3Items

  const renderItemsTable = (
    rows: CodeRow[],
    opts?: {
      selectableDepth?: number
      selectedRow?: CodeRow | null
      onSelectRow?: (row: CodeRow) => void
    },
  ) => (
    <Table size="small">
      <TableHead>
        <TableRow sx={{ backgroundColor: '#f5f7fb' }}>
          <TableCell sx={{ fontWeight: 600 }}>code_cd</TableCell>
          <TableCell sx={{ fontWeight: 600 }}>code_nm</TableCell>
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
            key={row.code_id}
            hover={opts?.selectableDepth === row.depth}
            selected={Boolean(
              opts?.selectableDepth === row.depth &&
                opts?.selectedRow &&
                opts.selectedRow.code_id === row.code_id,
            )}
            onClick={() => {
              if (opts?.selectableDepth === row.depth && opts.onSelectRow) opts.onSelectRow(row)
            }}
            sx={{ cursor: opts?.selectableDepth === row.depth ? 'pointer' : 'default' }}
          >
            <TableCell>{row.code_cd}</TableCell>
            <TableCell>{row.code_nm ?? '-'}</TableCell>
            <TableCell align="center">{row.sort_no}</TableCell>
            <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
              <IconButton size="small" onClick={() => onEditItem(row)} disabled={loading}>
                <EditOutlinedIcon />
              </IconButton>
              <IconButton size="small" onClick={() => onDeleteItem(row)} disabled={loading}>
                <DeleteOutlineIcon />
              </IconButton>
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={4}>
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                아이템이 없습니다.
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
              분류(그룹)
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
              <ListItemButton
                key={g.code_id}
                selected={selectedGroup?.code_id === g.code_id}
                onClick={() => onSelectGroup(g)}
                sx={{ borderRadius: 2 }}
              >
                <ListItemText
                  primary={`${g.code_cd}${g.code_nm ? ` - ${g.code_nm}` : ''}`}
                  secondary={`depth:${g.depth} sort:${g.sort_no}`}
                />
              </ListItemButton>
            ))}
            {groups.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                분류가 없습니다.
              </Typography>
            )}
          </List>

          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
            {selectedGroup && (
              <Button
                color="error"
                size="small"
                onClick={() => onDeleteGroup(selectedGroup)}
                disabled={loading || items.length > 0}
              >
                그룹 삭제
              </Button>
            )}
          </Stack>
        </Paper>

        <Box>
          {/* <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            코드 아이템
          </Typography> */}
          {!selectedGroup ? (
            <Paper sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                왼쪽에서 분류(그룹)를 선택해 주세요.
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
                    아이템 추가
                  </Button>
                </Stack>
                {renderItemsTable(baseDepthItems, {
                  selectableDepth: baseDepth,
                  selectedRow: selectedDepth1Item,
                  onSelectRow: onSelectDepth1Item,
                })}
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
                    아이템 추가
                  </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {selectedDepth1Item
                    ? `선택된 Depth 1: ${selectedDepth1Item.code_cd}`
                    : 'Depth 2 추가 전, Depth 1 항목을 선택해 주세요.'}
                </Typography>
                {renderItemsTable(depth2Items, {
                  selectableDepth: nextDepth,
                  selectedRow: selectedDepth2Item,
                  onSelectRow: onSelectDepth2Item,
                })}
              </Paper>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}
