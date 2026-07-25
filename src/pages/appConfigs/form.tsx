import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
} from '@mui/material'
import {
  fetchAppConfigApi,
  createAppConfigApi,
  updateAppConfigApi,
  type ApiAppConfigPayload,
} from '../../apis/appConfigApi'

const emptyForm: ApiAppConfigPayload = {
  app_code: '',
  app_name: '',
  mobile_name: '',
  order_no: 0,
  page_rows: 10,
  upload_count: 1,
  skin_nm: '',
  mobile_skin_nm: '',
  list_level: 0,
  read_level: 0,
  write_level: 0,
  subject_len: 80,
  mobile_subject_len: 40,
}

export default function WebappFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const appId = id ? parseInt(id, 10) : NaN

  const [form, setForm] = useState<ApiAppConfigPayload>({ ...emptyForm })
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isEdit || isNaN(appId)) {
      setForm({ ...emptyForm })
      setLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const data = await fetchAppConfigApi(appId)
        if (cancelled || !data) return
        setForm({
          app_code: data.app_code ?? '',
          app_name: data.app_name ?? '',
          mobile_name: data.mobile_name ?? '',
          order_no: data.order_no ?? 0,
          page_rows: data.page_rows ?? 10,
          upload_count: data.upload_count ?? 1,
          skin_nm: data.skin_nm ?? '',
          mobile_skin_nm: data.mobile_skin_nm ?? '',
          list_level: data.list_level ?? 0,
          read_level: data.read_level ?? 0,
          write_level: data.write_level ?? 0,
          subject_len: data.subject_len ?? 80,
          mobile_subject_len: data.mobile_subject_len ?? 40,
        })
      } catch (e) {
        console.error(e)
        if (!cancelled) navigate('/app/configs')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [isEdit, appId, navigate])

  const handleChange = (field: keyof ApiAppConfigPayload) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const raw = e.target.value
    const numFields: (keyof ApiAppConfigPayload)[] = [
      'order_no', 'page_rows', 'upload_count', 'list_level', 'read_level', 'write_level',
      'subject_len', 'mobile_subject_len',
    ]
    const value = numFields.includes(field) ? (raw === '' ? 0 : parseInt(raw, 10) || 0) : raw
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!form.app_code?.trim()) {
      alert('앱 코드를 입력해 주세요.')
      return
    }
    if (!form.app_name?.trim()) {
      alert('앱 제목을 입력해 주세요.')
      return
    }
    setSaving(true)
    try {
      const payload: ApiAppConfigPayload = {
        app_code: form.app_code?.trim() || undefined,
        app_name: form.app_name?.trim() || undefined,
        mobile_name: form.mobile_name?.trim() || undefined,
        order_no: form.order_no ?? 0,
        page_rows: form.page_rows ?? 10,
        upload_count: form.upload_count ?? 1,
        skin_nm: form.skin_nm?.trim() || undefined,
        mobile_skin_nm: form.mobile_skin_nm?.trim() || undefined,
        list_level: form.list_level ?? 0,
        read_level: form.read_level ?? 0,
        write_level: form.write_level ?? 0,
        subject_len: form.subject_len ?? 80,
        mobile_subject_len: form.mobile_subject_len ?? 40,
      }
      if (isEdit && !isNaN(appId)) {
        await updateAppConfigApi(appId, payload)
      } else {
        await createAppConfigApi(payload)
      }
      navigate('/app/configs')
    } catch (e) {
      console.error(e)
      alert('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
        <Typography color="text.secondary">로딩 중...</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          backgroundColor: 'background.paper',
          maxWidth: 640,
        }}
      >
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
          {isEdit ? '웹앱 수정' : '웹앱 등록'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {isEdit ? '웹앱 정보를 수정합니다.' : '새 웹앱을 등록합니다.'}
        </Typography>

        <Stack spacing={2.5}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              앱 코드 <span style={{ color: 'red' }}>*</span>
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="예: board, memo"
              value={form.app_code ?? ''}
              onChange={handleChange('app_code')}
              InputProps={{ sx: { backgroundColor: 'grey.50' } }}
            />
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              앱 제목 <span style={{ color: 'red' }}>*</span>
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="예: 게시판, 메모장"
              value={form.app_name ?? ''}
              onChange={handleChange('app_name')}
              InputProps={{ sx: { backgroundColor: 'grey.50' } }}
            />
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              모바일 제목
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="모바일에서 표시할 제목"
              value={form.mobile_name ?? ''}
              onChange={handleChange('mobile_name')}
              InputProps={{ sx: { backgroundColor: 'grey.50' } }}
            />
          </Box>

          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                정렬 순서
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                value={form.order_no ?? 0}
                onChange={handleChange('order_no')}
                InputProps={{ sx: { backgroundColor: 'grey.50' } }}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                페이지당 행 수
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                value={form.page_rows ?? 10}
                onChange={handleChange('page_rows')}
                InputProps={{ sx: { backgroundColor: 'grey.50' } }}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                첨부파일수
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                value={form.upload_count}
                onChange={handleChange('upload_count')}
                InputProps={{ sx: { backgroundColor: 'grey.50' } }}
              />
            </Box>
          </Stack>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              PC 스킨명
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="예: basic"
              value={form.skin_nm ?? ''}
              onChange={handleChange('skin_nm')}
              InputProps={{ sx: { backgroundColor: 'grey.50' } }}
            />
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              모바일 스킨명
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="예: basic"
              value={form.mobile_skin_nm ?? ''}
              onChange={handleChange('mobile_skin_nm')}
              InputProps={{ sx: { backgroundColor: 'grey.50' } }}
            />
          </Box>

          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                목록 권한 레벨
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                value={form.list_level ?? 0}
                onChange={handleChange('list_level')}
                InputProps={{ sx: { backgroundColor: 'grey.50' } }}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                읽기 권한 레벨
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                value={form.read_level ?? 0}
                onChange={handleChange('read_level')}
                InputProps={{ sx: { backgroundColor: 'grey.50' } }}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                쓰기 권한 레벨
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                value={form.write_level ?? 0}
                onChange={handleChange('write_level')}
                InputProps={{ sx: { backgroundColor: 'grey.50' } }}
              />
            </Box>
          </Stack>

          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                제목 길이 (PC)
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                value={form.subject_len ?? 80}
                onChange={handleChange('subject_len')}
                InputProps={{ sx: { backgroundColor: 'grey.50' } }}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                제목 길이 (모바일)
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                value={form.mobile_subject_len ?? 40}
                onChange={handleChange('mobile_subject_len')}
                InputProps={{ sx: { backgroundColor: 'grey.50' } }}
              />
            </Box>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ mt: 3, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => navigate('/app/configs')}
            disabled={saving}
          >
            취소
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? '저장 중...' : '저장'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
