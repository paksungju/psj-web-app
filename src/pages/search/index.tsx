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

  useEffect(() => {
    const fetchSearch = async () => {
      try {
        const params = new URLSearchParams(location.search)
        const kw = params.get('keyword') ?? ''

        const data = await fetchSearchApi(kw)

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
        console.error('검색 데이터를 불러오는 중 오류가 발생했습니다:', error)
      }
    }

    fetchSearch()
  }, [location.search])



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
            p: 2,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {searches.map((row) => (
              <Box
                key={row.sid}
                sx={{
                  cursor: 'pointer',
                }}
                onClick={() => window.open(row.url, '_blank')}
              >
                {/* 상단 URL / 도메인 영역 */}
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 0.5 }}
                >
                  {row.url}
                </Typography>

                {/* 제목 영역 (파란색 링크 스타일) */}
                <Typography
                  variant="subtitle1"
                  sx={{
                    color: '#1a0dab',
                    fontWeight: 500,
                    mb: 0.25,
                    '&:hover': {
                      textDecoration: 'underline',
                    },
                  }}
                >
                  {row.subject}
                </Typography>

                {/* 설명 / 메타 정보 영역 */}
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  {row.tb_name} · ID {row.tb_id} · {row.regist_dt?.slice(0, 10)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>

       
      </Paper>
    </Box>
  )
}

