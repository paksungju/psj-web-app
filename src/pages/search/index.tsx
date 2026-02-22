import { useEffect, useState } from 'react'
import { Box, Paper, Typography, Button, TextField, InputAdornment, CircularProgress } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import TopBar from '../../components/TopBar'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiSearch, fetchSearchApi } from '../../apis/searchApi'

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
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)
  const initialKeyword = params.get('keyword') ?? ''

  const [searches, setSearches] = useState<SearchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [keyword, setKeyword] = useState(initialKeyword)

  useEffect(() => {
    setKeyword(initialKeyword)
  }, [initialKeyword])

  useEffect(() => {
    const fetchSearch = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchSearchApi(initialKeyword)
        const rows = Array.isArray(data) ? data : []

        const mapped: SearchRow[] = rows.map((item: ApiSearch) => {
          const dateOnly = item.regist_dt?.slice(0, 10) ?? ''
          return {
            sid: item.sid,
            tb_name: item.tb_name ?? '',
            tb_id: item.tb_id,
            subject: item.subject ?? '',
            url: item.url ?? '',
            regist_dt: item.regist_dt ?? '',
            createdAt: dateOnly,
            updatedAt: dateOnly,
          }
        })
        setSearches(mapped)
      } catch (err) {
        console.error('검색 데이터를 불러오는 중 오류가 발생했습니다:', err)
        setError(err instanceof Error ? err.message : '검색 중 오류가 발생했습니다.')
        setSearches([])
      } finally {
        setLoading(false)
      }
    }

    fetchSearch()
  }, [initialKeyword])



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

        <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="키워드 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                navigate(`/search?keyword=${encodeURIComponent(keyword.trim())}`)
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                </InputAdornment>
              ),
              sx: { backgroundColor: 'grey.50', borderRadius: 1 },
            }}
            sx={{ minWidth: 280 }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate(`/search?keyword=${encodeURIComponent(keyword.trim())}`)}
            disabled={loading}
          >
            검색
          </Button>
          <Button variant="outlined" color="inherit" onClick={() => window.location.reload()} disabled={loading}>
            새로고침
          </Button>
        </Box>

        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        {loading ? (
          <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : searches.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">검색 결과가 없습니다.</Typography>
          </Paper>
        ) : (
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
        )}
      </Paper>
    </Box>
  )
}

