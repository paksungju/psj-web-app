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
import TopBar from '../../../components/TopBar'
import {
  fetchAppDataByIdApi,
  createAppDataApi,
  updateAppDataApi,
  type ApiAppData,
  type ApiAppPayload,
} from '../../../apis/appApi'

const numFields: (keyof ApiAppPayload)[] = [
  'data_id', 'app_id', 'gr_num', 'reply_cd', 'parent_id', 'is_commt', 'co_num', 'co_reply',
  'wr_type', 'is_secret', 'link1_hit', 'link2_hit', 'hit', 'good', 'nogood', 'user_no', 'file_cnt',
]

/** 폼에서 편집하는 AppData 항목 기본값 */
const emptyForm: ApiAppPayload = {
  app_id: 0,
  gr_num: 0,
  reply_cd: 0,
  parent_id: 0,
  is_commt: 0,
  co_num: 0,
  co_reply: 0,
  cate1: '',
  cate2: '',
  ap_subject: '',
  ap_content: '',
  wr_type: 0,
  is_secret: 0,
  recv_mail: '',
  link1: '',
  link2: '',
  link1_hit: 0,
  link2_hit: 0,
  hit: 0,
  good: 0,
  nogood: 0,
  user_no: 0,
  user_passwd: '',
  user_nm: '',
  user_email: '',
  user_home: '',
  file_cnt: 0,
  last_login: '',
  ip: '',
  facebook_user: '',
  twitter_user: '',
  start_date: '',
  start_time: '',
  end_date: '',
  end_time: '',
  regist_dt: '',
  update_dt: '',
  extra_1: '',
  extra_2: '',
  extra_3: '',
  extra_4: '',
  extra_5: '',
  extra_6: '',
  extra_7: '',
  extra_8: '',
  extra_9: '',
  extra_10: '',
}

export default function AppDataFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const dataId = id ? parseInt(id, 10) : NaN

  const [form, setForm] = useState<ApiAppPayload>({ ...emptyForm })
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isEdit || isNaN(dataId)) {
      setForm({ ...emptyForm })
      setLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const data: ApiAppData | null = await fetchAppDataByIdApi(dataId)
        if (cancelled || !data) return
        setForm({
          data_id: data.data_id,
          app_id: data.app_id ?? 0,
          gr_num: data.gr_num ?? 0,
          reply_cd: data.reply_cd ?? 0,
          parent_id: data.parent_id ?? 0,
          is_commt: data.is_commt ?? 0,
          co_num: data.co_num ?? 0,
          co_reply: data.co_reply ?? 0,
          cate1: data.cate1 ?? '',
          cate2: data.cate2 ?? '',
          ap_subject: data.ap_subject ?? '',
          ap_content: data.ap_content ?? '',
          wr_type: data.wr_type ?? 0,
          is_secret: data.is_secret ?? 0,
          recv_mail: data.recv_mail ?? '',
          link1: data.link1 ?? '',
          link2: data.link2 ?? '',
          link1_hit: data.link1_hit ?? 0,
          link2_hit: data.link2_hit ?? 0,
          hit: data.hit ?? 0,
          good: data.good ?? 0,
          nogood: data.nogood ?? 0,
          user_no: data.user_no ?? 0,
          user_passwd: data.user_passwd ?? '',
          user_nm: data.user_nm ?? '',
          user_email: data.user_email ?? '',
          user_home: data.user_home ?? '',
          file_cnt: data.file_cnt ?? 0,
          last_login: data.last_login ?? '',
          ip: data.ip ?? '',
          facebook_user: data.facebook_user ?? '',
          twitter_user: data.twitter_user ?? '',
          start_date: data.start_date ?? '',
          start_time: data.start_time ?? '',
          end_date: data.end_date ?? '',
          end_time: data.end_time ?? '',
          regist_dt: data.regist_dt ?? '',
          update_dt: data.update_dt ?? '',
          extra_1: data.extra_1 ?? '',
          extra_2: data.extra_2 ?? '',
          extra_3: data.extra_3 ?? '',
          extra_4: data.extra_4 ?? '',
          extra_5: data.extra_5 ?? '',
          extra_6: data.extra_6 ?? '',
          extra_7: data.extra_7 ?? '',
          extra_8: data.extra_8 ?? '',
          extra_9: data.extra_9 ?? '',
          extra_10: data.extra_10 ?? '',
        })
      } catch (e) {
        console.error(e)
        if (!cancelled) navigate('/app-info')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [isEdit, dataId, navigate])

  const handleChange = (field: keyof ApiAppPayload) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const raw = e.target.value
    const value = numFields.includes(field) ? (raw === '' ? 0 : parseInt(raw, 10) || 0) : raw
    setForm((prev: ApiAppPayload) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (form.ap_subject == null || !String(form.ap_subject).trim()) {
      alert('제목을 입력해 주세요.')
      return
    }
    setSaving(true)
    try {
      // Payload: remove undefined, use ''/0 so backend receives valid values
      const payload = {} as ApiAppPayload
      const strKeys: (keyof ApiAppPayload)[] = [
        'cate1', 'cate2', 'ap_subject', 'ap_content', 'recv_mail', 'link1', 'link2',
        'user_passwd', 'user_nm', 'user_email', 'user_home', 'last_login', 'ip',
        'facebook_user', 'twitter_user', 'start_date', 'start_time', 'end_date', 'end_time',
        'regist_dt', 'update_dt', 'extra_1', 'extra_2', 'extra_3', 'extra_4', 'extra_5',
        'extra_6', 'extra_7', 'extra_8', 'extra_9', 'extra_10',
      ]
      const intKeys: (keyof ApiAppPayload)[] = [
        'data_id', 'app_id', 'gr_num', 'reply_cd', 'parent_id', 'is_commt', 'co_num', 'co_reply',
        'wr_type', 'is_secret', 'link1_hit', 'link2_hit', 'hit', 'good', 'nogood', 'user_no', 'file_cnt',
      ]
      for (const k of strKeys) {
        const v = form[k]
        ;(payload as Record<string, unknown>)[k] = v != null && v !== '' ? String(v) : ''
      }
      for (const k of intKeys) {
        const v = form[k]
        if (v != null && v !== '') {
          const n = Number(v)
          ;(payload as Record<string, unknown>)[k] = Number.isNaN(n) ? 0 : n
        } else {
          ;(payload as Record<string, unknown>)[k] = 0
        }
      }
      if (isEdit && !isNaN(dataId)) {
        await updateAppDataApi(dataId, payload)
      } else {
        await createAppDataApi(payload)
      }
      navigate('/app-info')
    } catch (e) {
      console.error(e)
      const message = e instanceof Error ? e.message : '저장에 실패했습니다.'
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
        <TopBar />
        <Typography color="text.secondary">로딩 중...</Typography>
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
          maxWidth: 640,
        }}
      >
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
          {isEdit ? '앱 데이터 수정' : '앱 데이터 등록'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {isEdit ? '앱 데이터를 수정합니다.' : '새 앱 데이터를 등록합니다.'}
        </Typography>

        <Stack spacing={2.5}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              앱 ID <span style={{ color: 'red' }}>*</span>
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="number"
              value={form.app_id ?? 0}
              onChange={handleChange('app_id')}
              InputProps={{ sx: { backgroundColor: 'grey.50' } }}
            />
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              제목 <span style={{ color: 'red' }}>*</span>
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="ap_subject"
              value={form.ap_subject ?? ''}
              onChange={handleChange('ap_subject')}
              InputProps={{ sx: { backgroundColor: 'grey.50' } }}
            />
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              내용
            </Typography>
            <TextField
              fullWidth
              size="small"
              multiline
              rows={4}
              placeholder="ap_content"
              value={form.ap_content ?? ''}
              onChange={handleChange('ap_content')}
              InputProps={{ sx: { backgroundColor: 'grey.50' } }}
            />
          </Box>

          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>그룹 번호</Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                value={form.gr_num ?? 0}
                onChange={handleChange('gr_num')}
                InputProps={{ sx: { backgroundColor: 'grey.50' } }}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>답글 코드</Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                value={form.reply_cd ?? 0}
                onChange={handleChange('reply_cd')}
                InputProps={{ sx: { backgroundColor: 'grey.50' } }}
              />
            </Box>
          </Stack>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>작성자명</Typography>
            <TextField
              fullWidth
              size="small"
              value={form.user_nm ?? ''}
              onChange={handleChange('user_nm')}
              InputProps={{ sx: { backgroundColor: 'grey.50' } }}
            />
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>이메일</Typography>
            <TextField
              fullWidth
              size="small"
              type="email"
              value={form.user_email ?? ''}
              onChange={handleChange('user_email')}
              InputProps={{ sx: { backgroundColor: 'grey.50' } }}
            />
          </Box>

          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>시작일</Typography>
              <TextField
                fullWidth
                size="small"
                value={form.start_date ?? ''}
                onChange={handleChange('start_date')}
                InputProps={{ sx: { backgroundColor: 'grey.50' } }}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>종료일</Typography>
              <TextField
                fullWidth
                size="small"
                value={form.end_date ?? ''}
                onChange={handleChange('end_date')}
                InputProps={{ sx: { backgroundColor: 'grey.50' } }}
              />
            </Box>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ mt: 3, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => navigate('/app-info')}
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
