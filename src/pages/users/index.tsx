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
  Alert,
  CircularProgress,
} from '@mui/material'
import TopBar from '../../components/TopBar'
import {
  createUserApi,
  deleteUserApi,
  fetchUserDetailApi,
  fetchUsersApi,
  updateUserApi,
  type UserRow,
} from '../../apis/usersApi'
import UsersAgGrid, {
  type UserGridContext,
  type UserGridRow,
  isDraftGridRow,
} from './UsersAgGrid'

function formatDate(s: string) {
  return s?.slice(0, 10) ?? ''
}

function newDraftRow(): UserGridRow {
  return {
    draftKey: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    userId: 0,
    userLoginId: '',
    userName: null,
    userEmail: '',
    genderTypeCd: null,
    userStatusCd: null,
    userTypeCd: null,
    lastIp: null,
    delFlag: '0',
    inUserId: 0,
    inDatetime: '',
    upUserId: null,
    upDatetime: '',
  }
}

export default function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([])
  const [draftRows, setDraftRows] = useState<UserGridRow[]>([])
  const [selected, setSelected] = useState<UserRow | null>(null)
  const [detailPassword, setDetailPassword] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [menuRow, setMenuRow] = useState<UserRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const gridRows = useMemo<UserGridRow[]>(() => [...rows, ...draftRows], [rows, draftRows])

  const reloadList = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await fetchUsersApi()
      setRows(data)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '사용자 목록 로드 실패'
      console.error('사용자 목록 로드 실패:', e)
      setLoadError(msg)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reloadList()
  }, [reloadList])

  const handleOpenDetail = useCallback(async (row: UserRow) => {
    setSelected(row)
    setDetailPassword('')
    setDetailOpen(true)
    try {
      const detail = await fetchUserDetailApi(row.userId)
      setSelected(detail)
    } catch (e) {
      console.error('사용자 상세 로드 실패:', e)
    }
  }, [])

  const handleCloseDetail = () => {
    setDetailOpen(false)
    setDetailPassword('')
  }

  const handleSaveDetail = async () => {
    if (!selected) return
    if (!selected.userLoginId?.trim()) {
      alert('로그인 ID는 필수입니다.')
      return
    }
    if (!selected.userEmail?.trim()) {
      alert('이메일은 필수입니다.')
      return
    }
    try {
      await updateUserApi(selected.userId, {
        user_login_id: selected.userLoginId.trim(),
        user_name: selected.userName?.trim() || null,
        user_email: selected.userEmail.trim(),
        gender_type_cd: selected.genderTypeCd?.trim() || null,
        user_status_cd: selected.userStatusCd?.trim() || null,
        user_type_cd: selected.userTypeCd?.trim() || null,
        ...(detailPassword.trim() ? { user_password: detailPassword.trim() } : {}),
      })
      setDetailOpen(false)
      setDetailPassword('')
      await reloadList()
    } catch (e) {
      console.error('사용자 저장 실패:', e)
      alert('저장에 실패했습니다.')
    }
  }

  const handleOpenRowAdd = useCallback(() => {
    setDraftRows((prev) => [...prev, newDraftRow()])
  }, [])

  const handleSaveDraft = useCallback(
    async (row: UserGridRow) => {
      if (!row.draftKey) return
      if (!row.userLoginId?.trim()) {
        alert('로그인 ID는 필수입니다.')
        return
      }
      if (!row.userEmail?.trim()) {
        alert('이메일은 필수입니다.')
        return
      }
      try {
        await createUserApi({
          user_login_id: row.userLoginId.trim(),
          user_name: row.userName?.trim() || null,
          user_email: row.userEmail.trim(),
          gender_type_cd: row.genderTypeCd?.trim() || null,
          user_status_cd: row.userStatusCd?.trim() || null,
          user_type_cd: row.userTypeCd?.trim() || null,
        })
        setDraftRows((prev) => prev.filter((d) => d.draftKey !== row.draftKey))
        await reloadList()
      } catch (e) {
        console.error('사용자 등록 실패:', e)
        alert('등록에 실패했습니다.')
      }
    },
    [reloadList],
  )

  const handleCancelDraft = useCallback((row: UserGridRow) => {
    if (!row.draftKey) return
    setDraftRows((prev) => prev.filter((d) => d.draftKey !== row.draftKey))
  }, [])

  const handleCellValueChanged = useCallback((e: CellValueChangedEvent<UserGridRow>) => {
    if (!isDraftGridRow(e.data) || !e.data.draftKey) return
    const field = e.colDef.field as keyof UserGridRow | undefined
    if (
      !field ||
      field === 'draftKey' ||
      field === 'userId' ||
      field === 'inDatetime' ||
      field === 'upDatetime' ||
      field === 'delFlag' ||
      field === 'inUserId' ||
      field === 'upUserId' ||
      field === 'lastIp'
    ) {
      return
    }

    const draftKey = e.data.draftKey
    let value: unknown = e.newValue

    if (field === 'userName' || field === 'genderTypeCd' || field === 'userStatusCd' || field === 'userTypeCd') {
      const t = String(value ?? '').trim()
      value = t === '' ? null : t
    } else if (field === 'userLoginId' || field === 'userEmail') {
      value = String(value ?? '').trim()
    }

    setDraftRows((prev) =>
      prev.map((d) => (d.draftKey === draftKey ? { ...d, [field]: value } : d)),
    )
  }, [])

  const handleOpenRowMenu = useCallback((event: React.MouseEvent<HTMLElement>, row: UserRow) => {
    setMenuAnchorEl(event.currentTarget)
    setMenuRow(row)
  }, [])

  const gridContext = useMemo<UserGridContext>(
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
    const ok = window.confirm(`"${t.userLoginId}" 사용자를 삭제하시겠습니까?`)
    handleCloseRowMenu()
    if (!ok) return
    try {
      await deleteUserApi(t.userId)
      if (selected?.userId === t.userId) {
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
      <TopBar />
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
          사용자 관리
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          시스템 사용자를 관리합니다. (psj_users) 신규 행은 셀 더블클릭으로 편집, ✓/✕로 저장·취소합니다.
        </Typography>

        <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center">
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
            사용자 추가
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
          {loading && <CircularProgress size={22} />}
          {!loading && rows.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              {rows.length}건
            </Typography>
          )}
        </Stack>

        {loadError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {loadError}
          </Alert>
        )}

        {!loading && !loadError && rows.length === 0 && draftRows.length === 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            등록된 사용자가 없습니다.
          </Alert>
        )}

        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', p: 1 }}>
          <UsersAgGrid rows={gridRows} context={gridContext} onCellValueChanged={handleCellValueChanged} />
        </Paper>

        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleCloseRowMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem onClick={() => void handleMenuDetail()}>상세보기</MenuItem>
          <MenuItem onClick={() => void handleDeleteRow()}>삭제</MenuItem>
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
          <DialogTitle sx={{ fontWeight: 600 }}>사용자 상세</DialogTitle>
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
                    value={selected.userId}
                    InputProps={{ readOnly: true, sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    로그인 ID (user_login_id)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    inputProps={{ maxLength: 100 }}
                    value={selected.userLoginId}
                    onChange={(e) =>
                      setSelected((prev) => (prev ? { ...prev, userLoginId: e.target.value } : prev))
                    }
                    InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    비밀번호 (변경 시에만 입력)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="password"
                    value={detailPassword}
                    onChange={(e) => setDetailPassword(e.target.value)}
                    placeholder="변경하지 않으면 비워두세요"
                    InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    이름 (user_name)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    inputProps={{ maxLength: 100 }}
                    value={selected.userName ?? ''}
                    onChange={(e) =>
                      setSelected((prev) =>
                        prev ? { ...prev, userName: e.target.value || null } : prev,
                      )
                    }
                    InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    이메일 (user_email)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    inputProps={{ maxLength: 20 }}
                    value={selected.userEmail}
                    onChange={(e) =>
                      setSelected((prev) => (prev ? { ...prev, userEmail: e.target.value } : prev))
                    }
                    InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    성별 (gender_type_cd: M/F/N)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    inputProps={{ maxLength: 1 }}
                    value={selected.genderTypeCd ?? ''}
                    onChange={(e) =>
                      setSelected((prev) =>
                        prev ? { ...prev, genderTypeCd: e.target.value || null } : prev,
                      )
                    }
                    InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    상태 (user_status_cd)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    inputProps={{ maxLength: 4 }}
                    value={selected.userStatusCd ?? ''}
                    onChange={(e) =>
                      setSelected((prev) =>
                        prev ? { ...prev, userStatusCd: e.target.value || null } : prev,
                      )
                    }
                    InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    유형 (user_type_cd)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    inputProps={{ maxLength: 100 }}
                    value={selected.userTypeCd ?? ''}
                    onChange={(e) =>
                      setSelected((prev) =>
                        prev ? { ...prev, userTypeCd: e.target.value || null } : prev,
                      )
                    }
                    InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    등록일 (in_datetime)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={formatDate(selected.inDatetime)}
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
