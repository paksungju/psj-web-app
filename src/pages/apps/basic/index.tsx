import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
} from '@mui/material'
import TopBar from '../../../components/TopBar'
import { fetchAppDataListApi, type ApiAppData } from '../../../apis/appApi'

export default function AppConfigsPage() {
  const navigate = useNavigate()
  const [list, setList] = useState<ApiAppData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchList = async () => {
      try {
        const data = await fetchAppDataListApi({ skip: 0, limit: 100 })
        if (!cancelled) setList(data)
      } catch (error) {
        console.error('앱 데이터 목록을 불러오는 중 오류가 발생했습니다:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchList()
    return () => { cancelled = true }
  }, [])

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
          앱 데이터 목록
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          앱 데이터(AppData) 목록입니다.
        </Typography>

        <Button
          variant="contained"
          color="primary"
          sx={{ mb: 2 }}
          onClick={() => navigate('/apps/info/create')}
        >
          등록하기
        </Button>

        {loading ? (
          <Typography color="text.secondary">로딩 중...</Typography>
        ) : (
          <Paper
            variant="outlined"
            sx={{
              borderRadius: 2,
              overflow: 'hidden',
              minWidth: 960,
            }}
          >
            <Table size="small" sx={{ minWidth: 960 }}>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f7fb' }}>
                  <TableCell align="center" sx={{ fontWeight: 600, width: 70 }}>
                    data_id
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, width: 70 }}>
                    app_id
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, minWidth: 180 }}>제목(ap_subject)</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 100 }}>작성자(user_nm)</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 120 }}>등록일(regist_dt)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {list.map((row) => (
                  <TableRow key={row.data_id ?? row.app_id ?? 0} hover>
                    <TableCell align="center">{row.data_id ?? '-'}</TableCell>
                    <TableCell align="center">{row.app_id ?? '-'}</TableCell>
                    <TableCell
                      onClick={() =>
                        row.data_id != null && navigate(`/apps/basic/view/${row.data_id}`)
                      }
                      sx={{
                        cursor: row.data_id != null ? 'pointer' : 'default',
                        color: row.data_id != null ? 'primary.main' : 'text.primary',
                        fontWeight: 600,
                      }}
                    >
                      {row.ap_subject ?? '-'}
                    </TableCell>
                    <TableCell>{row.user_nm ?? '-'}</TableCell>
                    <TableCell>{row.regist_dt ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}
      </Paper>
    </Box>
  )
}
