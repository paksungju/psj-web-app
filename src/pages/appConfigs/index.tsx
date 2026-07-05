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
import TopBar from '../../components/TopBar'
import { fetchAppConfigsApi, type ApiAppConfig } from '../../apis/appConfigApi'

export default function WebappsPage() {
  const navigate = useNavigate()
  const [appConfigs, setAppConfigs] = useState<ApiAppConfig[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchList = async () => {
      try {
        const data = await fetchAppConfigsApi({ skip: 0, limit: 100 })
        if (!cancelled) setAppConfigs(data)
      } catch (error) {
        console.error('웹앱 목록을 불러오는 중 오류가 발생했습니다:', error)
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
          웹앱 설정 관리
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          시스템에서 사용하는 웹앱 설정 목록입니다.
        </Typography>

        <Button
          size="small"
          variant="contained"
          color="primary"
          sx={{ mb: 2 }}
          onClick={() => navigate('/app/configs/form')}
        >
          웹앱 등록
        </Button>

        {loading ? (
          <Typography color="text.secondary">로딩 중...</Typography>
        ) : (
          <Paper
            variant="outlined"
            sx={{
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f7fb' }}>
                  <TableCell align="center" sx={{ fontWeight: 600, width: 60 }}>
                    NO
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 120 }}>앱 코드</TableCell>
                  <TableCell sx={{ fontWeight: 600, minWidth: 140 }}>앱 제목</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 120 }}>모바일 제목</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, width: 90 }}>
                    정렬순서
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600, width: 90 }}>
                    페이지 행수
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 100 }}>PC 스킨</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 100 }}>모바일 스킨</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {appConfigs.map((row) => (
                  <TableRow key={row.app_id ?? 0} hover>
                    <TableCell align="center">{row.app_id ?? '-'}</TableCell>
                    <TableCell align="center">{row.app_code ?? '-'}</TableCell>
                    <TableCell
                      onClick={() => row.app_id != null && navigate(`/app/configs/${row.app_id}/form`)}
                      sx={{
                        cursor: row.app_id != null ? 'pointer' : 'default',
                        color: row.app_id != null ? 'primary.main' : 'text.primary',
                        fontWeight: 600,
                      }}
                    >
                      {row.app_name ?? '-'}
                    </TableCell>
                    <TableCell>{row.mobile_name ?? '-'}</TableCell>
                    <TableCell align="center">{row.order_no ?? '-'}</TableCell>
                    <TableCell align="center">{row.page_rows ?? '-'}</TableCell>
                    <TableCell>{row.skin_nm ?? '-'}</TableCell>
                    <TableCell>{row.mobile_skin_nm ?? '-'}</TableCell>
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
