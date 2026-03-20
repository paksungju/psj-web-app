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
import RefreshIcon from '@mui/icons-material/Refresh'

import {
  createCodeApi,
  deleteCodesApi,
  fetchCodeGroupsApi,
  fetchCodesByParentApi,
  type CodeRow,
} from '../../apis/codesApi'

type DialogMode = 'group' | 'item'

export default function CodesPage() {
  const [groups, setGroups] = useState<CodeRow[]>([])
  const [selectedGroup, setSelectedGroup] = useState<CodeRow | null>(null)
  const [items, setItems] = useState<CodeRow[]>([])

  const [loading, setLoading] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode>('group')
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

  const openCreateGroupDialog = () => {
    setDialogMode('group')
    setForm({ code_cd: '', code_nm: '', sort_no: 1, depth: 1 })
    setDialogOpen(true)
  }

  const openCreateItemDialog = () => {
    if (!selectedGroup) return
    setDialogMode('item')
    setForm({
      code_cd: '',
      code_nm: '',
      sort_no: 1,
      depth: selectedGroup.depth + 1,
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
            depth: Number(form.depth) || 0,
            is_group: 1,
          }
        : {
            code_cd: form.code_cd.trim(),
            code_nm: form.code_nm.trim() || null,
            p_code: selectedGroup!.code_cd,
            sort_no: Number(form.sort_no) || 0,
            depth: Number(form.depth) || 0,
            is_group: 0,
          }

    try {
      setLoading(true)
      await createCodeApi(payload)
      await loadGroups()
      if (dialogMode === 'item' && selectedGroup) {
        await loadItems(selectedGroup.code_cd)
      }
      setDialogOpen(false)
    } catch (e) {
      console.error(e)
      alert('저장에 실패했습니다.')
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
        onDeleteGroup={handleDeleteGroup}
        onDeleteItem={handleDeleteItem}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogMode === 'group' ? '그룹 추가' : '아이템 추가'}
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
            <TextField
              label="depth"
              type="number"
              value={form.depth}
              onChange={(e) => setForm((prev) => ({ ...prev, depth: Number(e.target.value) }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={loading}>
            취소
          </Button>
          <Button variant="contained" onClick={submit} disabled={loading}>
            저장
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
  onCreateItem: () => void
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
    onDeleteGroup,
    onDeleteItem,
  } = props

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

        <Paper sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              코드 아이템
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" size="small" onClick={onCreateItem} disabled={loading || !selectedGroup}>
                아이템 추가
              </Button>
            </Stack>
          </Stack>

          {!selectedGroup ? (
            <Typography variant="body2" color="text.secondary">
              왼쪽에서 분류(그룹)를 선택해 주세요.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f7fb' }}>
                  <TableCell sx={{ fontWeight: 600 }}>code_cd</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>code_nm</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">
                    sort_no
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">
                    depth
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center" width={80}>
                    작업
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.code_id}>
                    <TableCell>{row.code_cd}</TableCell>
                    <TableCell>{row.code_nm ?? '-'}</TableCell>
                    <TableCell align="center">{row.sort_no}</TableCell>
                    <TableCell align="center">{row.depth}</TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => onDeleteItem(row)} disabled={loading}>
                        <DeleteOutlineIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        아이템이 없습니다.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </Paper>
      </Box>
    </Box>
  )
}
