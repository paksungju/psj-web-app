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
import { fetchAccountsApi, fetchAccountDetailApi } from '../../apis/accountApi'

interface AccountRow {
  no: number
  acId: number
  name: string
  loginId?: string
  loginPw?: string | null
  priority: '상' | '중' | '하'
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [selectedAccount, setSelectedAccount] = useState<AccountRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    acSubject: '',
    acLoginId: '',
    acLoginPw: '',
    acMemo: '',
    sortNo: '',
    acLevel: '',
    delFlag: '',
    acId: '',
    createdAt: '',
    updatedAt: '',
  })

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const data = await fetchAccountsApi()

        const mapped: AccountRow[] = data.map((item) => {
          let priority: AccountRow['priority'] = '중'
          if (item.acLevel === 1) priority = '상'
          else if (item.acLevel === 3) priority = '하'

          const dateOnly = item.createdAt?.slice(0, 10) ?? ''

          return {
            no: item.sortNo ?? item.acId,
            acId: item.acId,
            name: item.acSubject || item.acLoginId,
            loginId: item.acLoginId,
            loginPw: item.acLoginPw,
            priority,
            enabled: !item.delFlag,
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
    // 먼저 목록에서 선택한 데이터로 표시
    setSelectedAccount(row)
    setDetailOpen(true)

    try {
      const detail = await fetchAccountDetailApi(row.acId)

      let priority: AccountRow['priority'] = '중'
      if (detail.acLevel === 1) priority = '상'
      else if (detail.acLevel === 3) priority = '하'

      const dateOnly = detail.createdAt?.slice(0, 10) ?? ''

      const mappedDetail: AccountRow = {
        no: detail.sortNo ?? detail.acId,
        acId: detail.acId,
        name: detail.acSubject || detail.acLoginId,
        loginId: detail.acLoginId,
        loginPw: detail.acLoginPw,
        priority,
        enabled: !detail.delFlag,
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

  const handleOpenCreate = () => {
    setCreateForm({
      acSubject: '',
      acLoginId: '',
      acLoginPw: '',
      acMemo: '',
      sortNo: '',
      acLevel: '',
      delFlag: '',
      acId: '',
      createdAt: '',
      updatedAt: '',
    })
    setCreateOpen(true)
  }

  const handleCloseCreate = () => {
    setCreateOpen(false)
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
                <TableRow key={row.no} hover>
                  <TableCell align="center">{row.no}</TableCell>
                  <TableCell
                    onClick={() => handleOpenDetail(row)}
                    sx={{ cursor: 'pointer', color: 'primary.main', fontWeight: 500 }}
                  >
                    {row.name}
                  </TableCell>
                  <TableCell align="center">{row.priority}</TableCell>
                  <TableCell align="center">{row.enabled ? '사용' : '미사용'}</TableCell>
                  <TableCell align="center">{row.createdAt}</TableCell>
                  <TableCell align="center">{row.updatedAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        {/* 등록 팝업 */}
        <Dialog open={createOpen} onClose={handleCloseCreate} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 600 }}>계정 등록</DialogTitle>
          <DialogContent dividers sx={{ pt: 3 }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                기본 정보
              </Typography>
              <Typography variant="body2" color="text.secondary">
                새로운 계정의 기본 정보를 입력하세요.
              </Typography>
            </Box>

            <Stack spacing={2.5}>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  계정명
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="e.g. 네이버"
                  value={createForm.acSubject}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, acSubject: e.target.value }))}
                  InputProps={{
                    sx: { backgroundColor: 'grey.50' },
                  }}
                />
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  계정 ID
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="e.g. paksungju"
                  value={createForm.acLoginId}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, acLoginId: e.target.value }))}
                  InputProps={{
                    sx: { backgroundColor: 'grey.50' },
                  }}
                />
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  계정 비밀번호
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="password"
                  placeholder="비밀번호를 입력하세요"
                  value={createForm.acLoginPw}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, acLoginPw: e.target.value }))}
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
                  displayEmpty
                  value={createForm.acLevel}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, acLevel: e.target.value as string }))}
                  sx={{ backgroundColor: 'grey.50' }}
                >
                  <MenuItem value="">
                    <em>중요도 선택</em>
                  </MenuItem>
                  <MenuItem value="상">상</MenuItem>
                  <MenuItem value="중">중</MenuItem>
                  <MenuItem value="하">하</MenuItem>
                </Select>
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  사용여부
                </Typography>
                <RadioGroup
                  row
                  value={createForm.delFlag}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, delFlag: e.target.value }))}
                >
                  <FormControlLabel
                    value="N"
                    control={<Radio size="small" />}
                    label="사용"
                  />
                  <FormControlLabel
                    value="Y"
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
                  placeholder="YYYY-MM-DD"
                  value={createForm.createdAt}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, createdAt: e.target.value }))}
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
                  placeholder="YYYY-MM-DD"
                  value={createForm.updatedAt}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, updatedAt: e.target.value }))}
                  InputProps={{
                    sx: { backgroundColor: 'grey.50' },
                  }}
                />
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%', gap: 1.5 }}>
              <Button onClick={handleCloseCreate} color="inherit">
                취소
              </Button>
              <Button onClick={handleCloseCreate} variant="contained" color="primary">
                저장
              </Button>
            </Box>
          </DialogActions>
        </Dialog>

        {/* 상세 팝업 */}
        <Dialog open={detailOpen} onClose={handleCloseDetail} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 600 }}>계정 상세</DialogTitle>
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
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      NO
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      value={selectedAccount.no}
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
                      value={selectedAccount.name}
                      InputProps={{
                        sx: { backgroundColor: 'grey.50' },
                      }}
                    />
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      계정 ID
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      value={selectedAccount.loginId ?? ''}
                      InputProps={{
                        sx: { backgroundColor: 'grey.50' },
                      }}
                    />
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      계정 비밀번호
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      type="password"
                      value={selectedAccount.loginPw ?? ''}
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
                      value={selectedAccount.priority}
                      onChange={(e) =>
                        setSelectedAccount((prev) =>
                          prev ? { ...prev, priority: e.target.value as AccountRow['priority'] } : prev,
                        )
                      }
                      sx={{ backgroundColor: 'grey.50' }}
                    >
                      <MenuItem value="상">상</MenuItem>
                      <MenuItem value="중">중</MenuItem>
                      <MenuItem value="하">하</MenuItem>
                    </Select>
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      사용여부
                    </Typography>
                    <RadioGroup
                      row
                      value={selectedAccount.enabled ? 'N' : 'Y'}
                      onChange={(e) =>
                        setSelectedAccount((prev) =>
                          prev ? { ...prev, enabled: e.target.value === 'N' } : prev,
                        )
                      }
                    >
                      <FormControlLabel
                        value="N"
                        control={<Radio size="small" />}
                        label="사용"
                      />
                      <FormControlLabel
                        value="Y"
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
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <Button onClick={handleCloseDetail} variant="contained" color="primary">
                닫기
              </Button>
            </Box>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  )
}

