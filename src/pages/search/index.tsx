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
import TopBar from '../../components/TopBar'
import { useLocation } from 'react-router-dom'
import {
  createAccountApi,
  fetchAccountsApi,
  fetchAccountDetailApi,
  updateAccountApi,
} from '../../apis/accountApi'
import { ApiSearch, fetchSearchApi } from '../../apis/searchApi'

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

interface SearchRow {
  sid: number
  tb_name: string
  tb_id: number
  subject: string
  url: string
  regist_dt: string
  createdAt: string
  updatedAt: string
}


export default function SearchPage() {
  const location = useLocation()

  const [searches, setSearches] = useState<ApiSearch[]>([])
  const [keyword, setKeyword] = useState('')
  const [selectedSearch, setSelectedSearch] = useState<ApiSearch | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'detail' | 'create'>('detail')

  // URL 쿼리의 keyword를 상태와 동기화 (초기 진입 + /search 내 재검색 모두 대응)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const kw = params.get('keyword') ?? ''
    if (kw !== keyword) {
      setKeyword(kw)
    }
  }, [location.search, keyword])

  useEffect(() => {
    const fetchSearch = async () => {
      try {
        const data = await fetchSearchApi(keyword ?? '')

        const mapped: SearchRow[] = data.map((item) => {
          const dateOnly = item.regist_dt?.slice(0, 10) ?? ''

          return {

            sid: item.sid,
            tb_name: item.tb_name,
            tb_id: item.tb_id,
            subject: item.subject,
            url: item.url,
            regist_dt: item.regist_dt,
            createdAt: dateOnly,
            // 수정일 필드가 없으므로 일단 등록일과 동일하게 표시
            updatedAt: dateOnly,
          }
        })

        setSearches(mapped)
      } catch (error) {
        console.error('계정 목록을 불러오는 중 오류가 발생했습니다:', error)
      }
    }

    fetchSearch()
  }, [keyword])



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
          검 색
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          시스템내의 전체 데이터 목록입니다.
        </Typography>

        <Button
          variant="contained"
          color="primary"
          sx={{ mb: 2 }}
          onClick={() => window.location.reload()}
        >
          새로고침
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
                <TableCell sx={{ fontWeight: 600, width: 200 }}>제목</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 140 }}>테이블명</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 100 }}>대상 ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>URL</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, width: 140 }}>
                  등록일
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {searches.map((row) => (
                <TableRow key={row.sid} hover>
                  <TableCell align="center">{row.sid}</TableCell>
                  <TableCell
                    onClick={() => window.open(row.url, '_blank')}
                    sx={{ cursor: 'pointer', color: 'primary.main', fontWeight: 600 }}
                  >
                    {row.subject}
                  </TableCell>
                  <TableCell>{row.tb_name}</TableCell>
                  <TableCell align="center">{row.tb_id}</TableCell>
                  <TableCell>{row.url}</TableCell>
                  <TableCell align="center">{row.regist_dt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

       
      </Paper>
    </Box>
  )
}

