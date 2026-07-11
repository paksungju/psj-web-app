import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Checkbox,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  IconButton,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import TopBar from '../../../components/TopBar'
import {
  fetchAppDataListApi,
  deleteAppDataApi,
  deleteAppDataBatchApi,
  updateAppDataApi,
  type ApiAppData,
  type ApiAppPayload,
} from '../../../apis/appApi'
import {
  INFO_BOARD_LAYOUT_SX,
  INFO_BOARD_MAIN_SX,
  INFO_BOARD_PAGE_SX,
  INFO_BOARD_PAPER_SX,
} from '../basic/InfoBoardCategorySidebar'

const APP_ID = 10
const BASE_PATH = '/apps/ideablock'

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}.${month}.${day}`
  } catch {
    return '-'
  }
}

function toInt(value: unknown, fallback = 0): number {
  if (value == null || value === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function toStr(value: unknown): string {
  if (value == null) return ''
  return String(value)
}

/** PUT /app_data 검증용 — DB에서 숫자로 온 recv_mail 등을 문자열로 맞춤 */
function normalizeAppPayload(row: ApiAppData, overrides?: Partial<ApiAppData>): ApiAppPayload {
  const src = { ...row, ...overrides }
  return {
    data_id: toInt(src.data_id),
    app_id: toInt(src.app_id, APP_ID),
    gr_num: toInt(src.gr_num),
    reply_cd: toInt(src.reply_cd),
    parent_id: toInt(src.parent_id),
    is_commt: toInt(src.is_commt),
    co_num: toInt(src.co_num),
    co_reply: toInt(src.co_reply),
    cate1: toStr(src.cate1),
    cate2: toStr(src.cate2),
    ap_subject: toStr(src.ap_subject),
    ap_content: toStr(src.ap_content),
    wr_type: toInt(src.wr_type),
    is_secret: toInt(src.is_secret),
    recv_mail: toStr(src.recv_mail),
    link1: toStr(src.link1),
    link2: toStr(src.link2),
    link1_hit: toInt(src.link1_hit),
    link2_hit: toInt(src.link2_hit),
    hit: toInt(src.hit),
    good: toInt(src.good),
    nogood: toInt(src.nogood),
    user_no: toInt(src.user_no),
    user_passwd: toStr(src.user_passwd),
    user_nm: toStr(src.user_nm),
    user_email: toStr(src.user_email),
    user_home: toStr(src.user_home),
    file_cnt: toInt(src.file_cnt),
    last_login: toStr(src.last_login),
    ip: toStr(src.ip),
    facebook_user: toStr(src.facebook_user),
    twitter_user: toStr(src.twitter_user),
    start_date: toStr(src.start_date),
    start_time: toStr(src.start_time),
    end_date: toStr(src.end_date),
    end_time: toStr(src.end_time),
    regist_dt: toStr(src.regist_dt),
    update_dt: toStr(src.update_dt),
    extra_1: toStr(src.extra_1),
    extra_2: toStr(src.extra_2),
    extra_3: toStr(src.extra_3),
    extra_4: toStr(src.extra_4),
    extra_5: toStr(src.extra_5),
    extra_6: toStr(src.extra_6),
    extra_7: toStr(src.extra_7),
    extra_8: toStr(src.extra_8),
    extra_9: toStr(src.extra_9),
    extra_10: toStr(src.extra_10),
  }
}

function isRootPost(row: ApiAppData): boolean {
  const rc = row.reply_cd
  if (rc == null) return true
  const s = String(rc).trim()
  return s === '' || s === '0'
}

function isBlockOf(row: ApiAppData, parent: ApiAppData): boolean {
  if (isRootPost(row)) return false
  if (parent.data_id != null && row.parent_id === parent.data_id) return true
  if (parent.gr_num != null && row.gr_num === parent.gr_num && row.data_id !== parent.data_id) {
    return true
  }
  return false
}

export default function IdeaBlockPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [allItems, setAllItems] = useState<ApiAppData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedContentId, setSelectedContentId] = useState<number | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [menuContent, setMenuContent] = useState<ApiAppData | null>(null)
  const [orderedBlocks, setOrderedBlocks] = useState<ApiAppData[]>([])
  const [draggingBlockId, setDraggingBlockId] = useState<number | null>(null)
  const [dropTargetId, setDropTargetId] = useState<number | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)

  const contents = useMemo(() => allItems.filter(isRootPost), [allItems])

  const selectedContent = useMemo(
    () => contents.find((c) => c.data_id === selectedContentId) ?? null,
    [contents, selectedContentId],
  )

  const blocks = useMemo(() => {
    if (!selectedContent) return []
    return allItems
      .filter((row) => isBlockOf(row, selectedContent))
      .sort((a, b) => {
        const an = typeof a.nogood === 'number' ? a.nogood : Number(a.nogood ?? 999999)
        const bn = typeof b.nogood === 'number' ? b.nogood : Number(b.nogood ?? 999999)
        const aOrder = Number.isNaN(an) ? 999999 : an
        const bOrder = Number.isNaN(bn) ? 999999 : bn
        if (aOrder !== bOrder) return aOrder - bOrder
        return (a.data_id ?? 0) - (b.data_id ?? 0)
      })
  }, [allItems, selectedContent])

  useEffect(() => {
    setOrderedBlocks(blocks)
    setDraggingBlockId(null)
    setDropTargetId(null)
  }, [blocks])

  const refreshList = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAppDataListApi({
        skip: 0,
        limit: 2000,
        app_id: APP_ID,
      })
      setAllItems(data ?? [])
    } catch (error) {
      console.error('아이디어블록 목록을 불러오는 중 오류가 발생했습니다:', error)
      setAllItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshList()
  }, [refreshList])

  useEffect(() => {
    const raw = new URLSearchParams(location.search).get('content')
    if (raw == null || raw === '') return
    const id = Number(raw)
    if (Number.isFinite(id)) setSelectedContentId(id)
  }, [location.search])

  useEffect(() => {
    if (loading || selectedContentId == null) return
    const exists = contents.some((c) => c.data_id === selectedContentId)
    if (!exists) {
      setSelectedContentId(null)
      navigate(BASE_PATH, { replace: true })
    }
  }, [contents, selectedContentId, loading, navigate])

  const selectContent = (dataId: number) => {
    setSelectedContentId(dataId)
    setSelectMode(false)
    setSelectedIds(new Set())
    navigate(`${BASE_PATH}?content=${dataId}`)
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
    if (!window.confirm(`선택한 ${ids.length}개 블록을 삭제하시겠습니까?`)) return
    try {
      const res = await deleteAppDataBatchApi(ids)
      setSelectedIds(new Set())
      setSelectMode(false)
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

  const handleBlockRegister = () => {
    if (selectedContentId == null) {
      alert('왼쪽에서 컨텐츠를 먼저 선택해 주세요.')
      return
    }
    navigate(`${BASE_PATH}/${selectedContentId}/form?reply=1`)
  }

  const persistBlockOrder = async (rows: ApiAppData[]) => {
    await Promise.all(
      rows.map((row, index) =>
        row.data_id != null
          ? updateAppDataApi(
              row.data_id,
              normalizeAppPayload(row, { app_id: row.app_id ?? APP_ID, nogood: index + 1 }),
            )
          : Promise.resolve(null),
      ),
    )
  }

  const handleDropBlock = async (targetId: number | undefined) => {
    if (draggingBlockId == null || targetId == null || draggingBlockId === targetId) {
      setDraggingBlockId(null)
      setDropTargetId(null)
      return
    }
    const fromIndex = orderedBlocks.findIndex((r) => r.data_id === draggingBlockId)
    const toIndex = orderedBlocks.findIndex((r) => r.data_id === targetId)
    if (fromIndex < 0 || toIndex < 0) {
      setDraggingBlockId(null)
      setDropTargetId(null)
      return
    }

    const next = [...orderedBlocks]
    const [moved] = next.splice(fromIndex, 1)
    if (!moved) {
      setDraggingBlockId(null)
      setDropTargetId(null)
      return
    }
    next.splice(toIndex, 0, moved)
    setOrderedBlocks(next)
    setDraggingBlockId(null)
    setDropTargetId(null)

    setSavingOrder(true)
    try {
      await persistBlockOrder(next)
      setAllItems((prev) => {
        const orderMap = new Map(
          next
            .map((row, index) => (row.data_id != null ? [row.data_id, index + 1] as const : null))
            .filter((v): v is readonly [number, number] => v != null),
        )
        return prev.map((row) =>
          row.data_id != null && orderMap.has(row.data_id)
            ? { ...row, nogood: orderMap.get(row.data_id) }
            : row,
        )
      })
    } catch (error) {
      console.error('블록 순서 저장 오류:', error)
      alert('순서 저장에 실패했습니다.')
      await refreshList()
    } finally {
      setSavingOrder(false)
    }
  }

  const handleContentMenuOpen = (event: React.MouseEvent<HTMLElement>, item: ApiAppData) => {
    event.stopPropagation()
    setMenuAnchorEl(event.currentTarget)
    setMenuContent(item)
  }

  const handleContentMenuClose = () => {
    setMenuAnchorEl(null)
    setMenuContent(null)
  }

  const handleContentEdit = () => {
    const id = menuContent?.data_id
    handleContentMenuClose()
    if (id != null) navigate(`${BASE_PATH}/${id}/form`)
  }

  const handleContentDelete = async () => {
    const item = menuContent
    handleContentMenuClose()
    if (item?.data_id == null) return
    const title = item.ap_subject?.trim() || `(#${item.data_id})`
    if (!window.confirm(`"${title}" 컨텐츠를 삭제하시겠습니까?\n하위 블록도 함께 정리해야 할 수 있습니다.`)) {
      return
    }
    try {
      await deleteAppDataApi(item.data_id)
      if (selectedContentId === item.data_id) {
        setSelectedContentId(null)
        navigate(BASE_PATH, { replace: true })
      }
      await refreshList()
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    }
  }

  return (
    <Box sx={INFO_BOARD_PAGE_SX}>
      <TopBar />
      <Paper elevation={0} sx={INFO_BOARD_PAPER_SX}>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
          아이디어블록
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          왼쪽에서 컨텐츠를 선택하면 블록 목록이 표시됩니다. 블록등록은 선택한 컨텐츠의 답변글로 저장됩니다.
        </Typography>

        <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={() => navigate(`${BASE_PATH}/create`)}
          >
            컨텐츠 등록
          </Button>
          <Button
            size="small"
            variant="contained"
            color="primary"
            onClick={handleBlockRegister}
            disabled={selectedContentId == null}
          >
            블록등록
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="primary"
            onClick={() => {
              setSelectMode((prev) => !prev)
              setSelectedIds(new Set())
            }}
            disabled={!selectedContent}
          >
            {selectMode ? '선택 취소' : '선택하기'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={() => void handleDeleteSelected()}
            disabled={!selectMode || selectedIds.size === 0}
          >
            선택삭제
          </Button>
        </Stack>

        <Box sx={INFO_BOARD_LAYOUT_SX}>
          <Paper
            variant="outlined"
            sx={{
              width: { xs: '100%', md: 260 },
              flexShrink: 0,
              borderRadius: 2,
              overflow: 'hidden',
              maxHeight: { md: '70vh' },
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box sx={{ px: 1.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                컨텐츠 목록
              </Typography>
            </Box>
            <List dense disablePadding sx={{ py: 0.5, overflow: 'auto', flex: 1 }}>
              {loading ? (
                <Box sx={{ px: 2, py: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    로딩 중...
                  </Typography>
                </Box>
              ) : contents.length === 0 ? (
                <Box sx={{ px: 2, py: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    등록된 컨텐츠가 없습니다.
                  </Typography>
                </Box>
              ) : (
                contents.map((item) => (
                  <ListItemButton
                    key={item.data_id ?? item.ap_subject}
                    selected={selectedContentId === item.data_id}
                    onClick={() => item.data_id != null && selectContent(item.data_id)}
                    sx={{
                      mx: 0.5,
                      borderRadius: 1,
                      py: 0.75,
                      '&.Mui-selected': { bgcolor: 'action.selected' },
                      '& .content-edit-btn': {
                        opacity:
                          menuContent?.data_id === item.data_id && Boolean(menuAnchorEl) ? 1 : 0,
                        transition: 'opacity 0.15s ease',
                      },
                      '&:hover .content-edit-btn': {
                        opacity: 1,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: '100%',
                        minWidth: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.25,
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{
                            fontWeight: selectedContentId === item.data_id ? 700 : 500,
                          }}
                        >
                          {item.ap_subject?.trim() || '(제목 없음)'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          #{item.data_id} · {formatDate(item.regist_dt)}
                        </Typography>
                      </Box>
                      <IconButton
                        className="content-edit-btn"
                        size="small"
                        aria-label="메뉴"
                        onClick={(e) => handleContentMenuOpen(e, item)}
                        sx={{ flexShrink: 0 }}
                      >
                        <MoreHorizIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </ListItemButton>
                ))
              )}
            </List>
          </Paper>

          <Menu
            anchorEl={menuAnchorEl}
            open={Boolean(menuAnchorEl)}
            onClose={handleContentMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem onClick={handleContentEdit}>수정</MenuItem>
            <MenuItem onClick={() => void handleContentDelete()}>삭제</MenuItem>
          </Menu>

          <Box sx={INFO_BOARD_MAIN_SX}>
            {!selectedContent ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  왼쪽에서 컨텐츠를 선택하면 블록 목록이 표시됩니다.
                </Typography>
              </Box>
            ) : loading ? (
              <Typography color="text.secondary">로딩 중...</Typography>
            ) : (
              <Paper
                elevation={0}
                sx={{
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  p: { xs: 1, sm: 1.5, md: 2 },
                  minWidth: 0,
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  {selectedContent.ap_subject?.trim() || '(제목 없음)'} — 블록 목록
                  {savingOrder ? ' (순서 저장 중…)' : ''}
                </Typography>
                <List
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
                  component="nav"
                  aria-label="block list"
                >
                  {orderedBlocks.length === 0 ? (
                    <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-start', gap: 1, py: 2 }}>
                      <ListItemText primary="등록된 블록이 없습니다." />
                      <Button size="small" variant="contained" onClick={handleBlockRegister}>
                        블록등록
                      </Button>
                    </ListItem>
                  ) : (
                    orderedBlocks.map((row, index) => {
                      const isDragging = draggingBlockId === row.data_id
                      const isDropTarget =
                        dropTargetId === row.data_id && draggingBlockId != null && draggingBlockId !== row.data_id
                      return (
                        <Box
                          key={row.data_id ?? `${row.ap_subject ?? 'block'}-${index}`}
                          onDragOver={(e) => {
                            e.preventDefault()
                            if (row.data_id != null && draggingBlockId != null) {
                              setDropTargetId(row.data_id)
                            }
                          }}
                          onDragLeave={() => {
                            if (dropTargetId === row.data_id) setDropTargetId(null)
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            void handleDropBlock(row.data_id)
                          }}
                          sx={{
                            position: 'relative',
                            opacity: isDragging ? 0.35 : 1,
                            transition: 'opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
                            transform: isDragging ? 'scale(0.98)' : 'none',
                            zIndex: isDragging ? 2 : 1,
                            borderTop: isDropTarget ? '3px solid' : '3px solid transparent',
                            borderColor: isDropTarget ? 'primary.main' : 'transparent',
                            bgcolor: isDragging ? 'primary.50' : 'transparent',
                            boxShadow: isDragging
                              ? '0 8px 24px rgba(25, 118, 210, 0.35)'
                              : 'none',
                            outline: isDragging ? '2px solid' : 'none',
                            outlineColor: isDragging ? 'primary.main' : 'transparent',
                            borderRadius: isDragging ? 1 : 0,
                          }}
                        >
                          <ListItem disablePadding>
                            {selectMode && (
                              <ListItemIcon sx={{ minWidth: 42, pl: 1 }}>
                                <Checkbox
                                  edge="start"
                                  checked={row.data_id != null && selectedIds.has(row.data_id)}
                                  onChange={() =>
                                    row.data_id != null && handleSelectOne(row.data_id)
                                  }
                                  disabled={row.data_id == null}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </ListItemIcon>
                            )}
                            <ListItemButton
                              onClick={() =>
                                row.data_id != null && navigate(`${BASE_PATH}/${row.data_id}`)
                              }
                            >
                              <ListItemText
                                primary={
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: 1,
                                    }}
                                  >
                                    <Box
                                      component="span"
                                      sx={{
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        fontWeight: 600,
                                        color: isDragging ? 'primary.main' : 'inherit',
                                      }}
                                    >
                                      {row.ap_subject?.trim() || '(제목 없음)'}
                                    </Box>
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.75,
                                        flexShrink: 0,
                                      }}
                                    >
                                      <Box
                                        component="span"
                                        sx={{
                                          display: 'inline-block',
                                          px: 1,
                                          py: 0.2,
                                          borderRadius: 1,
                                          fontSize: 11,
                                          fontWeight: 700,
                                          lineHeight: 1.35,
                                          backgroundColor: isDragging ? 'primary.main' : 'grey.100',
                                          color: isDragging ? '#fff' : 'text.secondary',
                                        }}
                                      >
                                        #{row.data_id ?? '-'}
                                      </Box>
                                      <Box
                                        component="span"
                                        draggable={row.data_id != null && !savingOrder}
                                        onDragStart={(e) => {
                                          e.stopPropagation()
                                          setDraggingBlockId(row.data_id ?? null)
                                          e.dataTransfer.effectAllowed = 'move'
                                          e.dataTransfer.setData('text/plain', String(row.data_id ?? ''))
                                        }}
                                        onDragEnd={() => {
                                          setDraggingBlockId(null)
                                          setDropTargetId(null)
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        sx={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: isDragging ? 'primary.main' : 'text.secondary',
                                          cursor: savingOrder ? 'default' : 'grab',
                                          '&:active': { cursor: 'grabbing' },
                                          p: 0.25,
                                          borderRadius: 1,
                                          bgcolor: isDragging ? 'primary.100' : 'transparent',
                                        }}
                                        title="드래그해서 순서 변경"
                                      >
                                        <DragIndicatorIcon fontSize="small" />
                                      </Box>
                                    </Box>
                                  </Box>
                                }
                                secondary={
                                  <Box sx={{ mt: 0.25 }}>
                                    {[row.user_nm, formatDate(row.regist_dt)]
                                      .filter((v) => v && v !== '-')
                                      .join(' · ') || '-'}
                                  </Box>
                                }
                              />
                            </ListItemButton>
                          </ListItem>
                          {index < orderedBlocks.length - 1 && !isDragging && <Divider />}
                        </Box>
                      )
                    })
                  )}
                </List>
              </Paper>
            )}
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}
