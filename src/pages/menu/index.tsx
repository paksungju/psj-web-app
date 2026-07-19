import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import {
  Box,
  Button,
  Collapse,
  CircularProgress,
  FormControl,
  FormControlLabel,
  List,
  ListItemButton,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import TopBar from '../../components/TopBar'
import MenuFolderIcon from '../../components/MenuFolderIcon'
import {
  createMenuApi,
  fetchMenusApi,
  saveMenusSortOrderApi,
  updateMenuApi,
  type ApiMenuRow,
} from '../../apis/menuApi'

type MenuNode = ApiMenuRow & {
  children: MenuNode[]
}

function buildMenuTree(rows: ApiMenuRow[]): MenuNode[] {
  const map = new Map<number, MenuNode>()
  const roots: MenuNode[] = []

  for (const r of rows) {
    map.set(r.menu_id, { ...r, children: [] })
  }

  for (const r of rows) {
    const node = map.get(r.menu_id)
    if (!node) continue

    if (r.parent_id == null) {
      roots.push(node)
      continue
    }

    const parent = map.get(r.parent_id)
    if (!parent) {
      // parent row가 없어도 화면은 깨지지 않게 root로 취급
      roots.push(node)
      continue
    }
    parent.children.push(node)
  }

  const sortRec = (nodes: MenuNode[]) => {
    nodes.sort((a, b) => (a.sort_no - b.sort_no) || (b.menu_id - a.menu_id))
    for (const n of nodes) sortRec(n.children)
  }

  sortRec(roots)
  return roots
}

function getMenuAncestorIds(rows: ApiMenuRow[], menuId: number): number[] {
  const ids: number[] = []
  let current = rows.find((m) => m.menu_id === menuId)
  while (current?.parent_id != null) {
    ids.push(current.parent_id)
    current = rows.find((m) => m.menu_id === current!.parent_id)
  }
  return ids
}

export default function MenuPage() {
  const [loading, setLoading] = useState(true)
  const [menus, setMenus] = useState<ApiMenuRow[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null)
  const [formParentId, setFormParentId] = useState<number | null>(null)
  const [savingSort, setSavingSort] = useState(false)

  const selectedNode = useMemo(() => {
    if (selectedMenuId == null) return null
    return menus.find((m) => m.menu_id === selectedMenuId) ?? null
  }, [menus, selectedMenuId])

  const treeRoots = useMemo(() => buildMenuTree(menus), [menus])

  const openFolderIds = useMemo(() => {
    if (selectedMenuId == null) return new Set<number>()
    return new Set([selectedMenuId, ...getMenuAncestorIds(menus, selectedMenuId)])
  }, [menus, selectedMenuId])

  const siblingSortMaxPlusOne = useMemo(() => {
    const parentId = formParentId
    const siblings =
      parentId == null ? menus.filter((m) => m.parent_id == null) : menus.filter((m) => m.parent_id === parentId)
    const maxSort = siblings.reduce((acc, s) => Math.max(acc, s.sort_no ?? 0), 0)
    return maxSort + 1
  }, [menus, formParentId])

  const newDepth = useMemo(() => {
    if (formParentId == null) return 1
    const parentNode = menus.find((m) => m.menu_id === formParentId)
    return (parentNode?.depth ?? 0) + 1
  }, [menus, formParentId])

  const depthOneMenus = useMemo(
    () =>
      menus
        .filter((m) => m.parent_id == null)
        .sort((a, b) => a.sort_no - b.sort_no || b.menu_id - a.menu_id),
    [menus],
  )

  const [form, setForm] = useState({
    me_subject: '',
    me_url: '',
    target_type: '_self',
    sort_no: 1,
    me_icon: '',
    is_use: 1,
  })

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const rows = await fetchMenusApi({ skip: 0, limit: 500 })
        setMenus(rows)
        // 하위 메뉴를 실제로 "열었을 때만" open 아이콘이 표시되도록 초기에는 모두 닫힘 처리
        setExpandedIds(new Set<number>())
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (loading) return
    setForm((prev) => ({ ...prev, sort_no: siblingSortMaxPlusOne }))
  }, [loading, siblingSortMaxPlusOne])

  useEffect(() => {
    if (!selectedNode) return
    setFormParentId(selectedNode.parent_id)
    setForm({
      me_subject: selectedNode.me_subject ?? '',
      me_url: selectedNode.me_url ?? '',
      target_type: selectedNode.target_type ?? '_self',
      sort_no: selectedNode.sort_no ?? 1,
      me_icon: selectedNode.me_icon ?? '',
      is_use: selectedNode.is_use ?? 1,
    })
  }, [selectedNode])

  useEffect(() => {
    if (selectedMenuId == null) return
    const ancestorIds = getMenuAncestorIds(menus, selectedMenuId)
    if (ancestorIds.length === 0) return
    setExpandedIds((prev) => {
      const next = new Set(prev)
      for (const id of ancestorIds) next.add(id)
      return next
    })
  }, [selectedMenuId, menus])

  const handleFormChange =
    (field: keyof typeof form) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const raw = e.target.value
      setForm((prev) => {
        if (field === 'is_use') {
          return { ...prev, is_use: (e.target as HTMLInputElement).checked ? 1 : 0 }
        }
        if (field === 'sort_no') {
          return { ...prev, sort_no: raw === '' ? 0 : parseInt(raw, 10) || 0 }
        }
        return { ...prev, [field]: raw }
      })
    }

  const refresh = async () => {
    const rows = await fetchMenusApi({ skip: 0, limit: 500 })
    setMenus(rows)
  }

  const getSiblingsSorted = (menuId: number) => {
    const row = menus.find((m) => m.menu_id === menuId)
    if (!row) return []
    const pid = row.parent_id
    return menus
      .filter((m) => (pid == null ? m.parent_id == null : m.parent_id === pid))
      .sort((a, b) => (a.sort_no - b.sort_no) || (b.menu_id - a.menu_id))
  }

  /** 형제 메뉴들을 전달된 순서대로 sort_no = 1..n 재부여하고 서버에 즉시 저장 */
  const persistSiblingOrder = async (orderedSiblings: ApiMenuRow[]) => {
    const items = orderedSiblings.map((m, i) => ({ menu_id: m.menu_id, sort_no: i + 1 }))
    setMenus((prev) =>
      prev.map((m) => {
        const found = items.find((it) => it.menu_id === m.menu_id)
        return found ? { ...m, sort_no: found.sort_no } : m
      }),
    )
    await saveMenusSortOrderApi(items)
  }

  const moveTreeSibling = async (dir: 'up' | 'down') => {
    if (selectedMenuId == null || savingSort) return
    const sibs = getSiblingsSorted(selectedMenuId)
    const idx = sibs.findIndex((m) => m.menu_id === selectedMenuId)
    if (idx < 0) return
    const j = dir === 'up' ? idx - 1 : idx + 1
    if (j < 0 || j >= sibs.length) return
    const reordered = [...sibs]
    const [moved] = reordered.splice(idx, 1)
    if (!moved) return
    reordered.splice(j, 0, moved)
    setSavingSort(true)
    try {
      await persistSiblingOrder(reordered)
    } catch (e) {
      console.error(e)
      window.alert('순서 저장에 실패했습니다.')
      await refresh()
    } finally {
      setSavingSort(false)
    }
  }

  const siblingIndexInfo = useMemo(() => {
    if (selectedMenuId == null) return { idx: -1, len: 0 }
    const row = menus.find((m) => m.menu_id === selectedMenuId)
    if (!row) return { idx: -1, len: 0 }
    const pid = row.parent_id
    const sibs = menus
      .filter((m) => (pid == null ? m.parent_id == null : m.parent_id === pid))
      .sort((a, b) => (a.sort_no - b.sort_no) || (b.menu_id - a.menu_id))
    const idx = sibs.findIndex((m) => m.menu_id === selectedMenuId)
    return { idx, len: sibs.length }
  }, [menus, selectedMenuId])

  const handleSave = async () => {
    const me_subject = form.me_subject.trim()
    if (!me_subject) {
      window.alert('메뉴 제목(me_subject)을 입력해 주세요.')
      return
    }

    const payload = {
      me_subject,
      parent_id: formParentId,
      me_url: form.me_url.trim() || null,
      target_type: form.target_type.trim() || null,
      depth: newDepth,
      sort_no: form.sort_no,
      me_icon: form.me_icon.trim() || null,
      is_use: form.is_use,
    }

    try {
      if (selectedMenuId != null) {
        await updateMenuApi(selectedMenuId, payload)
        window.alert('수정되었습니다.')
      } else {
        await createMenuApi(payload)
        window.alert('저장되었습니다.')
      }
      setForm({ me_subject: '', me_url: '', target_type: '_self', sort_no: 1, me_icon: '', is_use: 1 })
      setFormParentId(null)
      setSelectedMenuId(null)
      await refresh()
    } catch (e) {
      console.error(e)
      window.alert('저장에 실패했습니다.')
    }
  }

  const renderNode = (node: MenuNode, level: number) => {
    const hasChildren = node.children.length > 0
    const expanded = expandedIds.has(node.menu_id)
    const isFolderOpen = openFolderIds.has(node.menu_id)

    return (
      <Box key={node.menu_id}>
        <ListItemButton
          selected={selectedMenuId === node.menu_id}
          onClick={() => {
            setSelectedMenuId(node.menu_id)
            if (hasChildren) {
              setExpandedIds((prev) => {
                const next = new Set(prev)
                if (next.has(node.menu_id)) next.delete(node.menu_id)
                else next.add(node.menu_id)
                return next
              })
            }
          }}
          sx={{
            borderRadius: 1,
            mx: 0.5,
            py: 0.6,
            pl: 0.5 + level * 1.25,
            '&.Mui-selected': { bgcolor: 'action.selected' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, flex: 1 }}>
            <MenuFolderIcon open={isFolderOpen} size={20} />

            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
              {node.me_subject}
            </Typography>
          </Box>
        </ListItemButton>

        {hasChildren && (
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <List dense disablePadding>
              {node.children.map((c) => renderNode(c, level + 1))}
            </List>
          </Collapse>
        )}
      </Box>
    )
  }

  return (
    <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 3 }}>
      <TopBar />

      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
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
            메뉴관리
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            `psj_menu` 스키마 기준으로 메뉴(분류/항목)를 등록합니다.
          </Typography>

          {loading ? (
            <Stack alignItems="center" sx={{ py: 6 }}>
              <CircularProgress />
            </Stack>
          ) : (
            <Box sx={{ display: 'flex', gap: 3, flex: 1, minHeight: 0, alignItems: 'flex-start' }}>
              <Paper
                elevation={0}
                sx={{
                  width: 260,
                  flexShrink: 0,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  overflow: 'hidden',
                  alignSelf: 'flex-start',
                }}
              >
                <Box sx={{ px: 1.5, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                    분류 트리
                  </Typography>
                </Box>
                <List dense disablePadding sx={{ py: 0.5 }}>
                  {treeRoots.length ? (
                    treeRoots.map((root) => renderNode(root, 0))
                  ) : (
                    <Typography sx={{ px: 2, py: 2 }} color="text.secondary">
                      메뉴 데이터가 없습니다.
                    </Typography>
                  )}
                </List>
                <Stack
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderTop: 1,
                    borderColor: 'divider',
                    justifyContent: 'flex-start',
                  }}
                >
                  {(() => {
                    const canUp =
                      selectedMenuId != null && siblingIndexInfo.idx > 0 && !savingSort
                    const canDown =
                      selectedMenuId != null &&
                      siblingIndexInfo.idx >= 0 &&
                      siblingIndexInfo.idx < siblingIndexInfo.len - 1 &&
                      !savingSort
                    return (
                      <>
                        <Typography
                          variant="body2"
                          onClick={() => {
                            if (canUp) void moveTreeSibling('up')
                          }}
                          sx={{
                            cursor: canUp ? 'pointer' : 'default',
                            color: canUp ? 'primary.main' : 'text.disabled',
                            userSelect: 'none',
                            '&:hover': canUp ? { textDecoration: 'underline' } : undefined,
                          }}
                        >
                          위로
                        </Typography>
                        <Typography
                          variant="body2"
                          onClick={() => {
                            if (canDown) void moveTreeSibling('down')
                          }}
                          sx={{
                            cursor: canDown ? 'pointer' : 'default',
                            color: canDown ? 'primary.main' : 'text.disabled',
                            userSelect: 'none',
                            '&:hover': canDown ? { textDecoration: 'underline' } : undefined,
                          }}
                        >
                          아래로
                        </Typography>
                        {savingSort && (
                          <Typography variant="caption" color="text.secondary">
                            저장 중…
                          </Typography>
                        )}
                      </>
                    )
                  })()}
                </Stack>
              </Paper>

              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {/* <Typography variant="body2" color="text.secondary">
                  부모( parent_id ):{' '}
                  <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    {parentLabel}
                  </Box>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  새 항목 depth:{' '}
                  <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    {newDepth}
                  </Box>
                </Typography> */}

                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    backgroundColor: 'background.paper',
                    maxWidth: 680,
                    width: '100%',
                    border: '1px solid',
                    borderColor: 'divider',
                    alignSelf: 'flex-start',
                  }}
                >
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    메뉴 등록
                  </Typography>

                  <Stack spacing={2.2}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        상위메뉴
                      </Typography>
                      <FormControl fullWidth size="small">
                        <Select
                          value={formParentId ?? ''}
                          displayEmpty
                          renderValue={() => {
                            if (formParentId == null) return 'ROOT(부모 없음)'
                            const menu = menus.find((m) => m.menu_id === formParentId)
                            return menu ? menu.me_subject : 'ROOT(부모 없음)'
                          }}
                          onChange={(e) => {
                            const v = e.target.value
                            setFormParentId(v === '' ? null : Number(v))
                          }}
                        >
                          <MenuItem value="">
                            ROOT(부모 없음)
                          </MenuItem>
                          {depthOneMenus.map((m) => (
                            <MenuItem key={m.menu_id} value={m.menu_id}>
                              {m.me_subject}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        메뉴명 <span style={{ color: 'red' }}>*</span>
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="예: 코드관리"
                        value={form.me_subject}
                        onChange={handleFormChange('me_subject')}
                        InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                      />
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        링크 URL
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="예: /codes"
                        value={form.me_url}
                        onChange={handleFormChange('me_url')}
                        InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                      />
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        링크 타입
                      </Typography>
                      <RadioGroup
                        row
                        value={form.target_type}
                        onChange={handleFormChange('target_type')}
                      >
                        <FormControlLabel value="_self" control={<Radio size="small" />} label="자신(_self)" />
                        <FormControlLabel value="_parent" control={<Radio size="small" />} label="새창(_parent)" />
                      </RadioGroup>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        정렬순서
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        value={form.sort_no}
                        onChange={handleFormChange('sort_no')}
                        InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                      />
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        메뉴 아이콘
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="예: bi bi-list"
                        value={form.me_icon}
                        onChange={handleFormChange('me_icon')}
                        InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                      />
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        사용여부
                      </Typography>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={form.is_use === 1}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                is_use: e.target.checked ? 1 : 0,
                              }))
                            }
                          />
                        }
                        label={form.is_use === 1 ? 'ON' : 'OFF'}
                      />
                    </Box>

                    <Stack direction="row" spacing={1.5} sx={{ mt: 2, justifyContent: 'flex-end' }}>
                      <Button
                        variant="outlined"
                        color="inherit"
                        onClick={() =>
                          {
                            // 신규 추가 모드: 부모 선택을 초기화(ROOT)하고 폼도 리셋
                            setSelectedMenuId(null)
                            setFormParentId(null)
                            setForm({
                              me_subject: '',
                              me_url: '',
                              target_type: '_self',
                              sort_no: 1,
                              me_icon: '',
                              is_use: 1,
                            })
                          }
                        }
                      >
                        취소
                      </Button>
                      <Button variant="contained" color="primary" onClick={handleSave}>
                        {selectedMenuId != null ? '수정' : '저장'}
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              </Box>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  )
}

