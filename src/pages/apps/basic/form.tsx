import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  IconButton,
} from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { CKEditor } from '@ckeditor/ckeditor5-react'
import { ClassicEditor, Essentials, Paragraph, Bold, Italic, Image, ImageInsert, ImageResize, ImageToolbar, ImageStyle, Alignment } from 'ckeditor5'
import 'ckeditor5/ckeditor5.css'
import TopBar from '../../../components/TopBar'
import {
  fetchAppDataByIdApi,
  createAppDataApi,
  updateAppDataApi,
  type ApiAppData,
  type ApiAppPayload,
} from '../../../apis/appApi'
import {
  uploadFileApi,
  fetchFilesByDataApi,
  deleteFilesApi,
  type ApiFile,
} from '../../../apis/fileApi'

const numFields: (keyof ApiAppPayload)[] = [
  'data_id', 'app_id', 'gr_num', 'reply_cd', 'parent_id', 'is_commt', 'co_num', 'co_reply',
  'wr_type', 'is_secret', 'link1_hit', 'link2_hit', 'hit', 'good', 'nogood', 'user_no', 'file_cnt',
]

/** 폼에서 편집하는 AppData 항목 기본값 (정보 app_id=2) */
const emptyForm: ApiAppPayload = {
  app_id: 2,
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

type AttachedFile =
  | { type: 'local'; id: string; file: File; objectUrl: string }
  | { type: 'uploaded'; fileId: number; fileUrl: string; fileName: string; filesize: number; created_at: string }

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}kb`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function formatDate(s: string): string {
  const d = new Date(s)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function toAbsoluteFileUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `http://impsj.net${url.startsWith('/') ? url : `/${url}`}`
}

export default function AppDataFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const searchParams = new URLSearchParams(useLocation().search)
  const isReply = searchParams.get('reply') === '1'
  const isEdit = !!id && !isReply
  const dataId = id ? parseInt(id, 10) : NaN
  const parentId = isReply && !isNaN(dataId) ? dataId : undefined

  const [form, setForm] = useState<ApiAppPayload>({ ...emptyForm })
  const [loading, setLoading] = useState(isEdit || (isReply && !!id))
  const [saving, setSaving] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [selectedFileId, setSelectedFileId] = useState<string | number | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<{ execute: (cmd: string, opts?: { source?: string | string[] }) => void } | null>(null)

  const tbCode = 'info'
  const effectiveDataId = isEdit && !isNaN(dataId) ? dataId : 0

  useEffect(() => {
    if (isReply && id && !isNaN(parseInt(id, 10))) {
      const pid = parseInt(id, 10)
      let cancelled = false
      setLoading(true)
      const loadParent = async () => {
        try {
          const parent = await fetchAppDataByIdApi(pid)
          if (!cancelled && parent) {
            setForm((prev) => ({
              ...prev,
              parent_id: pid,
              gr_num: parent.gr_num ?? 0,
              app_id: parent.app_id ?? 0,
            }))
          } else if (!cancelled) {
            setForm((prev) => ({ ...prev, parent_id: pid }))
          }
        } catch (e) {
          console.error(e)
          if (!cancelled) navigate('/apps/info')
        } finally {
          if (!cancelled) setLoading(false)
        }
      }
      loadParent()
      return () => { cancelled = true }
    }
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
        if (!cancelled) navigate('/apps/info')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, isEdit, isReply, parentId, dataId, navigate])

  useEffect(() => {
    if (!isEdit || isNaN(dataId)) {
      setAttachedFiles([])
      setSelectedFileId(null)
      return
    }
    let cancelled = false
    const loadFiles = async () => {
      try {
        const files = await fetchFilesByDataApi({ tbCode: 'info', dataId })
        if (cancelled) return
        const items: AttachedFile[] = files.map((f: ApiFile) => ({
          type: 'uploaded',
          fileId: f.file_id,
          fileUrl: toAbsoluteFileUrl(f.file_url),
          fileName: f.file_name,
          filesize: f.filesize,
          created_at: f.created_at,
        }))
        setAttachedFiles(items)
        if (items.length > 0) setSelectedFileId((items[0] as { fileId: number }).fileId)
      } catch (e) {
        console.error(e)
        if (!cancelled) setAttachedFiles([])
      }
    }
    loadFiles()
    return () => { cancelled = true }
  }, [isEdit, dataId])

  const addFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    const toAdd: AttachedFile[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files.item(i)
      if (!f || !imageTypes.includes(f.type)) continue
      toAdd.push({
        type: 'local',
        id: `local-${Date.now()}-${i}`,
        file: f,
        objectUrl: URL.createObjectURL(f),
      })
    }
    setAttachedFiles((prev) => [...prev, ...toAdd])
    const first = toAdd[0]
    if (first && selectedFileId === null) setSelectedFileId(first.type === 'local' ? first.id : first.fileId)
    setUploading(true)
    try {
      for (const item of toAdd) {
        if (item.type !== 'local') continue
        const res = await uploadFileApi({
          file: item.file,
          tbCode,
          dataId: effectiveDataId,
          save_path: 'gallery',
        })
        setAttachedFiles((prev) =>
          prev.map((x) =>
            x.type === 'local' && x.id === item.id
              ? {
                  type: 'uploaded' as const,
                  fileId: res.file_id,
                  fileUrl: toAbsoluteFileUrl(res.file_url),
                  fileName: res.file_name,
                  filesize: res.filesize,
                  created_at: res.created_at,
                }
              : x,
          ),
        )
      }
    } catch (e) {
      console.error(e)
      alert('파일 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }, [effectiveDataId, selectedFileId])

  const handleDeleteFile = useCallback(async (item: AttachedFile) => {
    if (item.type === 'uploaded') {
      try {
        await deleteFilesApi({ fileIds: [item.fileId] })
        setAttachedFiles((prev) => prev.filter((x) => x.type !== 'uploaded' || x.fileId !== item.fileId))
        if (selectedFileId === item.fileId) setSelectedFileId(null)
      } catch (e) {
        console.error(e)
        alert('파일 삭제에 실패했습니다.')
      }
    } else {
      URL.revokeObjectURL(item.objectUrl)
      setAttachedFiles((prev) => prev.filter((x) => x.type !== 'local' || x.id !== item.id))
      if (selectedFileId === item.id) setSelectedFileId(null)
    }
  }, [selectedFileId])

  const handleInsertToEditor = useCallback(() => {
    if (selectedFileId == null) {
      alert('삽입할 파일을 선택해 주세요.')
      return
    }
    const item = attachedFiles.find(
      (x) => (x.type === 'local' && x.id === selectedFileId) || (x.type === 'uploaded' && x.fileId === selectedFileId),
    )
    if (!item) return
    if (item.type === 'local') {
      alert('파일 업로드 완료 후 삽입할 수 있습니다.')
      return
    }
    const editor = editorRef.current
    if (editor?.execute) {
      editor.execute('insertImage', { source: item.fileUrl })
    } else {
      const img = `<p><img src="${item.fileUrl}" alt="${item.fileName.replace(/"/g, '&quot;')}" /></p>`
      setForm((prev) => ({ ...prev, ap_content: (prev.ap_content ?? '') + img }))
    }
  }, [attachedFiles, selectedFileId])

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
      payload.app_id = 2
      const apiParams = isReply ? { reply: 1 } : undefined
      let savedId: number
      if (isEdit && !isNaN(dataId)) {
        await updateAppDataApi(dataId, payload, apiParams)
        savedId = dataId
      } else {
        if (parentId != null) {
          payload.parent_id = parentId
        }
        const created = await createAppDataApi(payload, apiParams)
        savedId = created.data_id ?? 0
      }
      if (savedId) {
        navigate(`/apps/info/${savedId}`)
      } else {
        navigate('/apps/info')
      }
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
          maxWidth: 960,
        }}
      >
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
          {isEdit ? '앱 데이터 수정' : '앱 데이터 등록'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {isEdit ? '앱 데이터를 수정합니다.' : '새 앱 데이터를 등록합니다.'}
        </Typography>

        <Stack spacing={2.5}>
          <Box sx={{ display: 'none' }}>
            <TextField
              type="number"
              value={form.app_id ?? 2}
              onChange={handleChange('app_id')}
            />
            <TextField
              type="number"
              value={form.data_id ?? 0}
              onChange={handleChange('data_id')}
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
            <Box sx={{ '& .ck-editor': { backgroundColor: 'grey.50' }, '& .ck.ck-editor__editable': { minHeight: 200 } }}>
              <CKEditor
                key={loading ? 'loading' : `edit-${form.data_id ?? 'new'}`}
                editor={ClassicEditor}
                data={form.ap_content ?? ''}
                config={{
                  licenseKey: 'GPL',
                  plugins: [Essentials, Paragraph, Bold, Italic, Image, ImageInsert, ImageResize, ImageToolbar, ImageStyle, Alignment],
                  toolbar: ['undo', 'redo', '|', 'bold', 'italic', '|', 'alignment:left', 'alignment:center', 'alignment:right', 'alignment:justify', '|', 'insertImage'],
                  image: {
                    resizeOptions: [
                      { name: 'resizeImage:original', value: null, icon: 'original' },
                      { name: 'resizeImage:25', value: '25', icon: 'small' },
                      { name: 'resizeImage:50', value: '50', icon: 'medium' },
                      { name: 'resizeImage:75', value: '75', icon: 'large' },
                      { name: 'resizeImage:custom', value: 'custom', icon: 'custom' },
                    ],
                    styles: {
                      options: ['inline', 'alignLeft', 'alignRight', 'alignCenter', 'alignBlockLeft', 'alignBlockRight', 'block'],
                    },
                    toolbar: [
                      'resizeImage:25', 'resizeImage:50', 'resizeImage:75', 'resizeImage:original', 'resizeImage:custom',
                      '|',
                      'imageStyle:wrapText',
                      'imageStyle:breakText',
                      '|',
                      'imageStyle:alignLeft', 'imageStyle:alignRight', 'imageStyle:alignCenter',
                      'imageStyle:alignBlockLeft', 'imageStyle:alignBlockRight',
                    ],
                  },
                }}
                onReady={(editor) => {
                  ;(editorRef as React.MutableRefObject<typeof editor | null>).current = editor
                }}
                onChange={(_evt, editor) => {
                  setForm((prev) => ({ ...prev, ap_content: editor.getData() }))
                }}
              />
            </Box>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              첨부 이미지
            </Typography>
            {/* <Box
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                addFiles(e.dataTransfer.files)
              }}
              sx={{
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: 2,
                bgcolor: 'grey.50',
                py: 3,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'grey.100' },
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Typography variant="body2" color="text.secondary">
                Drag File
              </Typography>
            </Box> */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                +파일등록
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={handleInsertToEditor}
                disabled={attachedFiles.length === 0 || selectedFileId == null}
              >
                에디터삽입
              </Button>
            </Stack>
            <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
              <Box
                sx={{
                  width: 140,
                  height: 140,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: 'grey.50',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {selectedFileId != null ? (
                  (() => {
                    const item = attachedFiles.find(
                      (x) =>
                        (x.type === 'local' && x.id === selectedFileId) ||
                        (x.type === 'uploaded' && x.fileId === selectedFileId),
                    )
                    if (!item) return <Typography variant="caption" color="text.secondary">미리보기</Typography>
                    const src = item.type === 'local' ? item.objectUrl : item.fileUrl
                    return <Box component="img" src={src} alt="" sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  })()
                ) : (
                  <Typography variant="caption" color="text.secondary">미리보기</Typography>
                )}
              </Box>
              <Box
                sx={{
                  flex: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  maxHeight: 200,
                  overflow: 'auto',
                }}
              >
                {attachedFiles.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                    첨부된 파일이 없습니다.
                  </Typography>
                ) : (
                  <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                    {attachedFiles.map((item) => {
                      const id = item.type === 'local' ? item.id : item.fileId
                      const name = item.type === 'local' ? item.file.name : item.fileName
                      const size = item.type === 'local' ? item.file.size : item.filesize
                      const date = item.type === 'local' ? formatDate(new Date().toISOString()) : formatDate(item.created_at)
                      const selected = selectedFileId === id
                      return (
                        <Box
                          component="li"
                          key={id}
                          onClick={() => setSelectedFileId(id)}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            px: 1.5,
                            py: 0.75,
                            bgcolor: selected ? 'action.selected' : 'transparent',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' },
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</Typography>
                          <Typography variant="caption" color="text.secondary">{formatFileSize(size)}</Typography>
                          <Typography variant="caption" color="text.secondary">{date}</Typography>
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDeleteFile(item) }} title="삭제">
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      )
                    })}
                  </Box>
                )}
              </Box>
            </Stack>
          </Box>

        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ mt: 3, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => navigate('/apps/info')}
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
