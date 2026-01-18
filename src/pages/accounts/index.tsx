import { useEffect, useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Select,
  MenuItem,
  Radio,
  RadioGroup,
  FormControlLabel,
} from '@mui/material'
import {
  createAccountApi,
  fetchAccountsApi,
  fetchAccountDetailApi,
  updateAccountApi,
} from '../../apis/accountApi'

interface AccountRow {
  acId: number
  acSubject: string
  acLoginId?: string
  acLoginPw?: string | null
  acMemo?: string | null
  sortNo: number
  acLevel: number
  useFlag: number
  delFlag: number
  createdAt: string
  updatedAt: string
}


export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [selectedAccount, setSelectedAccount] = useState<AccountRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'detail' | 'create'>('detail')

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const data = await fetchAccountsApi()

        const mapped: AccountRow[] = data.map((item) => {
          const dateOnly = item.createdAt?.slice(0, 10) ?? ''

          return {
            sortNo: item.sortNo ?? item.acId,
            acId: item.acId,
            acMemo: item.acMemo,
            acSubject: item.acSubject,
            acLoginId: item.acLoginId,
            acLoginPw: item.acLoginPw,
            acLevel: item.acLevel ?? 0,
            // delFlag가 0이면 사용, 1이면 미사용이라고 가정
            useFlag: item.delFlag ? 0 : 1,
            delFlag: item.delFlag ?? 0,
            createdAt: dateOnly,
            // 수정일 필드가 없으므로 일단 등록일과 동일하게 표시
            updatedAt: dateOnly,
          }
        })

        setAccounts(mapped)
      } catch (error) {
        console.error('계정 목록을 불러오는 중 오류가 발생했습니다:', error)
      }
    }

    fetchAccounts()
  }, [])

  const handleOpenDetail = async (row: AccountRow) => {
    setDialogMode('detail')
    // 먼저 목록에서 선택한 데이터로 표시
    setSelectedAccount(row)
    setDetailOpen(true)

    try {
      const detail = await fetchAccountDetailApi(row.acId)
      const dateOnly = detail.createdAt?.slice(0, 10) ?? ''

      const mappedDetail: AccountRow = {
        sortNo: detail.sortNo ?? detail.acId,
        acId: detail.acId,
        acMemo: detail.acMemo,
        acSubject: detail.acSubject,
        acLoginId: detail.acLoginId,
        acLoginPw: detail.acLoginPw,
        acLevel: detail.acLevel ?? 0,
        useFlag: detail.delFlag ? 0 : 1,
        delFlag: detail.delFlag ?? 0,
        createdAt: dateOnly,
        updatedAt: dateOnly,
      }

      setSelectedAccount(mappedDetail)
    } catch (error) {
      console.error('계정 상세를 불러오는 중 오류가 발생했습니다:', error)
    }
  }

  const handleCloseDetail = () => {
    setDetailOpen(false)
  }

  const handleSaveDetail = async () => {
    if (!selectedAccount) return

    try {
      const upsertPayload = {
        ac_subject: selectedAccount.acSubject,
        ac_login_id: selectedAccount.acLoginId ?? '',
        ac_login_pw: selectedAccount.acLoginPw ?? null,
        ac_memo: selectedAccount.acMemo ?? null,
        sort_no: selectedAccount.sortNo,
        ac_level: selectedAccount.acLevel,
        // useFlag가 1이면 사용(delFlag 0), 0이면 미사용(delFlag 1)으로 전송
        del_flag: selectedAccount.useFlag ? 0 : 1,
        created_at: selectedAccount.createdAt,
      }

      if (dialogMode === 'create') {
        await createAccountApi(upsertPayload)
      } else {
        await updateAccountApi(selectedAccount.acId, { ac_id: selectedAccount.acId, ...upsertPayload })
      }

      // 목록 상태도 함께 갱신
      setAccounts((prev) =>
        prev.map((item) => (item.acId === selectedAccount.acId ? { ...item, ...selectedAccount } : item)),
      )

      setDetailOpen(false)
    } catch (error) {
      console.error('계정 수정 중 오류가 발생했습니다:', error)
    }
  }

  const handleOpenCreate = () => {
    setDialogMode('create')
    setSelectedAccount({
      acId: 0,
      acSubject: '',
      acLoginId: '',
      acLoginPw: null,
      acMemo: null,
      sortNo: 0,
      acLevel: 2,
      useFlag: 1,
      delFlag: 0,
      createdAt: '',
      updatedAt: '',
    })
    setDetailOpen(true)
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
          계정 관리
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          시스템에서 사용하는 계정 목록입니다.
        </Typography>

        <Button variant="contained" color="primary" sx={{ mb: 2 }} onClick={handleOpenCreate}>
          계정 추가
        </Button>

        <Paper
          variant="outlined"
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow
                sx={{
                  backgroundColor: '#f5f7fb',
                }}
              >
                <TableCell align="center" sx={{ fontWeight: 600, width: 60 }}>
                  NO
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>계정명</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>아이디</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 100 }}>
                  중요도
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 100 }}>
                  사용여부
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 140 }}>
                  등록일
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 140 }}>
                  수정일
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.map((row) => (
                <TableRow key={row.acId} hover>
                  <TableCell align="center">{row.acId}</TableCell>
                  <TableCell
                    onClick={() => handleOpenDetail(row)}
                    sx={{ cursor: 'pointer', color: 'primary.main', fontWeight: 600 }}
                  >
                    {row.acSubject}
                  </TableCell>
                  <TableCell align="center">{row.acLoginId}</TableCell>
                  <TableCell align="center">{row.acLevel}</TableCell>
                  <TableCell align="center">{row.useFlag ? '사용' : '미사용'}</TableCell>
                  <TableCell align="center">{row.createdAt}</TableCell>
                  <TableCell align="center">{row.updatedAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        {/* 등록 팝업: 상세 팝업(Dialog) 재사용 */}

        {/* 상세/등록 팝업 (공용) */}
        <Dialog
          open={detailOpen}
          onClose={(_, reason) => {
            // 팝업 밖 클릭/ESC로 닫기 금지
            if (reason === 'backdropClick' || reason === 'escapeKeyDown') return
            handleCloseDetail()
          }}
          disableEscapeKeyDown
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 600 }}>
            {dialogMode === 'create' ? '계정 등록' : '계정 상세'}
          </DialogTitle>
          <DialogContent dividers sx={{ pt: 3 }}>
            {selectedAccount && (
              <>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    기본 정보
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    선택한 계정의 정보를 확인하고 수정할 수 있습니다.
                  </Typography>
                </Box>

                <Stack spacing={2.5}>
                  <Box sx={{ display: 'none' }}>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      NO
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      value={selectedAccount.acId}
                      InputProps={{
                        readOnly: true,
                        sx: { backgroundColor: 'grey.50' },
                      }}
                    />
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      계정명
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      value={selectedAccount.acSubject}
                      onChange={(e) =>
                        setSelectedAccount((prev) =>
                          prev ? { ...prev, acSubject: e.target.value } : prev,
                        )
                      }
                      InputProps={{
                        sx: { backgroundColor: 'grey.50' },
                      }}
                    />
                  </Box>

                  {dialogMode === 'create' ? (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        계정 ID
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        value={selectedAccount.acLoginId ?? ''}
                        onChange={(e) =>
                          setSelectedAccount((prev) =>
                            prev ? { ...prev, acLoginId: e.target.value } : prev,
                          )
                        }
                        InputProps={{
                          sx: { backgroundColor: 'grey.50' },
                        }}
                      />
                    </Box>
                  ) : (
                    <Box sx={{ display: 'none' }}>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      계정 ID
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      value={selectedAccount.acLoginId ?? ''}
                      onChange={(e) =>
                        setSelectedAccount((prev) =>
                          prev ? { ...prev, acLoginId: e.target.value } : prev,
                        )
                      }
                      InputProps={{
                        sx: { backgroundColor: 'grey.50' },
                      }}
                    />
                    </Box>
                  )}

                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      계정 비밀번호
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      type="password"
                      value={selectedAccount.acLoginPw ?? ''}
                      onChange={(e) =>
                        setSelectedAccount((prev) =>
                          prev ? { ...prev, acLoginPw: e.target.value } : prev,
                        )
                      }
                      InputProps={{
                        sx: { backgroundColor: 'grey.50' },
                      }}
                    />
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      중요도
                    </Typography>
                    <Select
                      fullWidth
                      size="small"
                      value={selectedAccount.acLevel}
                      onChange={(e) =>
                        setSelectedAccount((prev) =>
                          prev ? { ...prev, acLevel: Number(e.target.value) } : prev,
                        )
                      }
                      sx={{ backgroundColor: 'grey.50' }}
                    >
                      <MenuItem value={3}>상</MenuItem>
                      <MenuItem value={2}>중</MenuItem>
                      <MenuItem value={1}>하</MenuItem>
                    </Select>
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      사용여부
                    </Typography>
                    <RadioGroup
                      row
                      value={selectedAccount.useFlag ? '1' : '0'}
                      onChange={(e) =>
                        setSelectedAccount((prev) =>
                          prev ? { ...prev, useFlag: e.target.value === '1' ? 1 : 0 } : prev,
                        )
                      }
                    >
                      <FormControlLabel
                        value="1"
                        control={<Radio size="small" />}
                        label="사용"
                      />
                      <FormControlLabel
                        value="0"
                        control={<Radio size="small" />}
                        label="미사용"
                      />
                    </RadioGroup>
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      등록일
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      value={selectedAccount.createdAt}
                      InputProps={{
                        sx: { backgroundColor: 'grey.50' },
                      }}
                    />
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      수정일
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      value={selectedAccount.updatedAt}
                      InputProps={{
                        sx: { backgroundColor: 'grey.50' },
                      }}
                    />
                  </Box>
                </Stack>
              </>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%', gap: 1.5 }}>
              <Button onClick={handleCloseDetail} color="inherit">
                {dialogMode === 'create' ? '취소' : '닫기'}
              </Button>
              <Button onClick={handleSaveDetail} variant="contained" color="primary">
                저장
              </Button>
            </Box>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  )
}

