import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Divider,
} from '@mui/material'
import TopBar from '../../../components/TopBar'
import { fetchAppDataByIdApi, type ApiAppData } from '../../../apis/appApi'

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
        {label}
      </Typography>
      <Typography variant="body1" component="div">
        {value ?? '-'}
      </Typography>
    </Box>
  )
}

export default function AppDataViewPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const dataId = id ? parseInt(id, 10) : NaN

  const [data, setData] = useState<ApiAppData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id || isNaN(dataId)) {
      setData(null)
      setLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetchAppDataByIdApi(dataId)
        if (!cancelled) setData(res ?? null)
      } catch (e) {
        console.error(e)
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, dataId])

  if (loading) {
    return (
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
        <TopBar />
        <Typography color="text.secondary">로딩 중...</Typography>
      </Box>
    )
  }

  if (!data) {
    return (
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
        <TopBar />
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            데이터를 찾을 수 없습니다.
          </Typography>
          <Button variant="outlined" onClick={() => navigate('/app-info')}>
            목록으로
          </Button>
        </Paper>
      </Box>
    )
  }

  return (
    <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
      <TopBar />
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          backgroundColor: 'background.paper',
          maxWidth: 960,
        }}
      >
        <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
          {data.ap_subject ?? '(제목 없음)'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          data_id: {data.data_id ?? '-'} · app_id: {data.app_id ?? '-'}
        </Typography>

        <Divider sx={{ my: 2 }} />

        <FieldRow label="내용" value={data.ap_content} />

        <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <FieldRow label="그룹 번호" value={data.gr_num} />
          <FieldRow label="답글 코드" value={data.reply_cd} />
          <FieldRow label="작성자" value={data.user_nm} />
          <FieldRow label="이메일" value={data.user_email} />
        </Stack>

        <FieldRow label="시작일" value={data.start_date} />
        <FieldRow label="종료일" value={data.end_date} />
        <FieldRow label="등록일" value={data.regist_dt} />
        <FieldRow label="수정일" value={data.update_dt} />

        {[data.cate1, data.cate2].some(Boolean) && (
          <FieldRow
            label="카테고리"
            value={[data.cate1, data.cate2].filter(Boolean).join(' / ')}
          />
        )}

        <Divider sx={{ my: 2 }} />

        <Stack direction="row" spacing={1.5} sx={{ mt: 3, justifyContent: 'flex-end' }}>
          <Button variant="outlined" color="inherit" onClick={() => navigate('/app-info')}>
            목록
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate(`/apps/basic/form/${data.data_id}`)}
          >
            수정
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
