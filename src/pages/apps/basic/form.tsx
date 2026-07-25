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
import { type Editor } from 'ckeditor5'
import RichTextEditor from '../../../components/RichTextEditor'
import {
  fetchAppDataByIdApi,
  createAppDataApi,
  updateAppDataApi,
  type ApiAppData,
  type ApiAppPayload,
} from '../../../apis/appApi'
import { fetchAppConfigApi } from '../../../apis/appConfigApi'
import {
  uploadImageApi,
  fetchImagesByDataApi,
  deleteImagesApi,
  type ApiImage,
} from '../../../apis/imageApi'
import {
  uploadFileApi,
  fetchFilesByDataApi,
  deleteFilesApi,
} from '../../../apis/fileApi'
import InfoBoardCategorySidebar, {
  normalizeInfoBoardCategory,
  INFO_BOARD_LAYOUT_SX,
  INFO_BOARD_PAGE_SX,
  INFO_BOARD_PAPER_SX,
} from './InfoBoardCategorySidebar'

const numFields: (keyof ApiAppPayload)[] = [
  'data_id', 'app_id', 'gr_num', 'reply_cd', 'parent_id', 'is_commt', 'co_num', 'co_reply',
  'wr_type', 'is_secret', 'link1_hit', 'link2_hit', 'hit', 'good', 'nogood', 'user_no', 'file_cnt',
]

function makeEmptyForm(defaultAppId: number): ApiAppPayload {
  return {
    app_id: defaultAppId,
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

type AppDataFormPageProps = {
  appId?: number
  basePath?: string
  menuCd?: string
  savePath?: string
  hideCategorySidebar?: boolean
}

export function AppDataFormPage({
  appId: defaultAppId = 2,
  basePath = '/apps/info',
  menuCd = 'info',
  savePath = 'info',
  hideCategorySidebar = false,
}: AppDataFormPageProps) {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const searchParams = new URLSearchParams(useLocation().search)
  const isReply = searchParams.get('reply') === '1'
  const isEdit = !!id && !isReply
  const dataId = id ? parseInt(id, 10) : NaN
  const parentId = isReply && !isNaN(dataId) ? dataId : undefined

  const [form, setForm] = useState<ApiAppPayload>(() => ({ ...makeEmptyForm(defaultAppId) }))
  const [loading, setLoading] = useState(isEdit || (isReply && !!id))
  const [saving, setSaving] = useState(false)
  const [attachedImages, setAttachedImages] = useState<AttachedFile[]>([])
  const [selectedImageId, setSelectedImageId] = useState<string | number | null>(null)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [uploadCount, setUploadCount] = useState(1)
  const [attachmentsBySlot, setAttachmentsBySlot] = useState<AttachedFile[][]>([])
  const [uploadingAttachments, setUploadingAttachments] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const addingToSlotRef = useRef<number>(0)
  const editorRef = useRef<Editor | null>(null)

  const effectiveDataId = isEdit ? (form.data_id ?? dataId ?? 0) : 0
  const appId = form.app_id ?? defaultAppId

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const config = await fetchAppConfigApi(appId)
        if (cancelled) return
        const count = config?.upload_count != null && config.upload_count > 0 ? config.upload_count : 1
        setUploadCount(count)
        setAttachmentsBySlot((prev) =>
          Array.from({ length: count }, (_, i) => prev[i] ?? []),
        )
      } catch (e) {
        console.error(e)
      }
    }
    load()
    return () => { cancelled = true }
  }, [appId])

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
          if (!cancelled) navigate(basePath)
        } finally {
          if (!cancelled) setLoading(false)
        }
      }
      loadParent()
      return () => { cancelled = true }
    }
    if (!isEdit || isNaN(dataId)) {
      setForm({ ...makeEmptyForm(defaultAppId) })
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
        if (!cancelled) navigate(basePath)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, isEdit, isReply, parentId, dataId, navigate])

  useEffect(() => {
    if (!isEdit || isNaN(dataId)) {
      setAttachedImages([])
      setSelectedImageId(null)
      return
    }
    let cancelled = false
    const loadImages = async () => {
      try {
        const res = await fetchImagesByDataApi({ menuCd, dataId })
        if (cancelled) return
        const items: AttachedFile[] = res.items.map((f: ApiImage) => ({
          type: 'uploaded',
          fileId: f.file_id,
          fileUrl: toAbsoluteFileUrl(f.file_url),
          fileName: f.file_name,
          filesize: f.filesize,
          created_at: f.created_at,
        }))
        setAttachedImages(items)
        if (items.length > 0) setSelectedImageId((items[0] as { fileId: number }).fileId)
      } catch (e) {
        console.error(e)
        if (!cancelled) setAttachedImages([])
      }
    }
    loadImages()
    return () => { cancelled = true }
  }, [isEdit, dataId])

  useEffect(() => {
    if (!isEdit || isNaN(dataId)) {
      setAttachmentsBySlot([])
      return
    }
    let cancelled = false
    const loadAttachments = async () => {
      try {
        const res = await fetchFilesByDataApi({ menuCd, dataId, limit: 200 })
        if (cancelled) return
        const bySlot: AttachedFile[][] = []
        for (const f of res.items) {
          const fileNo = f.file_no ?? 1
          const idx = Math.max(0, fileNo - 1)
          while (bySlot.length <= idx) bySlot.push([])
          const slot = bySlot[idx]
          if (slot) {
            slot.push({
              type: 'uploaded',
              fileId: f.file_id,
              fileUrl: toAbsoluteFileUrl(f.file_url),
              fileName: f.file_name,
              filesize: f.filesize,
              created_at: f.created_at,
            })
          }
        }
        setAttachmentsBySlot((prev) => {
          const slotCount = Math.max(prev.length, bySlot.length, 1)
          return Array.from({ length: slotCount }, (_, i) => bySlot[i] ?? prev[i] ?? [])
        })
      } catch (e) {
        console.error(e)
        if (!cancelled) setAttachmentsBySlot([])
      }
    }
    loadAttachments()
    return () => { cancelled = true }
  }, [isEdit, dataId, uploadCount])

  const addImages = useCallback(async (files: FileList | null) => {
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
    setAttachedImages((prev) => [...prev, ...toAdd])
    const first = toAdd[0]
    if (first && selectedImageId === null) setSelectedImageId(first.type === 'local' ? first.id : first.fileId)
    setUploadingImages(true)
    try {
      for (const item of toAdd) {
        if (item.type !== 'local') continue
        const res = await uploadImageApi({
          file: item.file,
          menuCd,
          dataId: effectiveDataId,
          save_path: savePath,
        })
        setAttachedImages((prev) =>
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
      alert('이미지 업로드에 실패했습니다.')
    } finally {
      setUploadingImages(false)
    }
  }, [effectiveDataId, selectedImageId])

  const addAttachmentForSlot = useCallback(async (slotIndex: number, files: FileList | null) => {
    if (!files?.length) return
    const toAdd: AttachedFile[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files.item(i)
      if (!f) continue
      toAdd.push({
        type: 'local',
        id: `attach-local-${Date.now()}-${slotIndex}-${i}`,
        file: f,
        objectUrl: URL.createObjectURL(f),
      })
    }
    setAttachmentsBySlot((prev) => {
      const next = [...prev]
      while (next.length <= slotIndex) next.push([])
      next[slotIndex] = [...(next[slotIndex] ?? []), ...toAdd]
      return next
    })
    if (effectiveDataId === 0) {
      return
    }
    const fileNo = slotIndex + 1
    setUploadingAttachments(true)
    try {
      for (const item of toAdd) {
        if (item.type !== 'local') continue
        const res = await uploadFileApi({
          file: item.file,
          menuCd,
          dataId: effectiveDataId,
          fileNo,
          save_path: savePath,
        })
        setAttachmentsBySlot((prev) => {
          const next = [...prev]
          const slot = next[slotIndex] ?? []
          next[slotIndex] = slot.map((x) =>
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
          )
          return next
        })
      }
    } catch (e) {
      console.error(e)
      alert('첨부파일 업로드에 실패했습니다.')
    } finally {
      setUploadingAttachments(false)
    }
  }, [effectiveDataId])

  const handleDeleteImage = useCallback(async (item: AttachedFile) => {
    if (item.type === 'uploaded') {
      try {
        await deleteImagesApi({ fileIds: [item.fileId] })
        setAttachedImages((prev) => prev.filter((x) => x.type !== 'uploaded' || x.fileId !== item.fileId))
        if (selectedImageId === item.fileId) setSelectedImageId(null)
      } catch (e) {
        console.error(e)
        alert('이미지 삭제에 실패했습니다.')
      }
    } else {
      URL.revokeObjectURL(item.objectUrl)
      setAttachedImages((prev) => prev.filter((x) => x.type !== 'local' || x.id !== item.id))
      if (selectedImageId === item.id) setSelectedImageId(null)
    }
  }, [selectedImageId])

  const handleDeleteAttachment = useCallback(async (slotIndex: number, item: AttachedFile) => {
    if (item.type === 'uploaded') {
      try {
        await deleteFilesApi({ fileIds: [item.fileId] })
        setAttachmentsBySlot((prev) => {
          const next = [...prev]
          const slot = next[slotIndex] ?? []
          next[slotIndex] = slot.filter((x) => x.type !== 'uploaded' || x.fileId !== item.fileId)
          return next
        })
      } catch (e) {
        console.error(e)
        alert('첨부파일 삭제에 실패했습니다.')
      }
    } else {
      URL.revokeObjectURL(item.objectUrl)
      setAttachmentsBySlot((prev) => {
        const next = [...prev]
        const slot = next[slotIndex] ?? []
        next[slotIndex] = slot.filter((x) => x.type !== 'local' || x.id !== item.id)
        return next
      })
    }
  }, [])

  const handleInsertToEditor = useCallback(() => {
    if (selectedImageId == null) {
      alert('삽입할 이미지를 선택해 주세요.')
      return
    }
    const item = attachedImages.find(
      (x) => (x.type === 'local' && x.id === selectedImageId) || (x.type === 'uploaded' && x.fileId === selectedImageId),
    )
    if (!item) return
    if (item.type === 'local') {
      alert('이미지 업로드 완료 후 삽입할 수 있습니다.')
      return
    }
    const img = `<p><img src="${item.fileUrl}" alt="${item.fileName.replace(/"/g, '&quot;')}" /></p>`
    const editor = editorRef.current
    if (editor) {
      const currentData = editor.getData()
      editor.setData((currentData ?? '') + img)
    } else {
      setForm((prev) => ({ ...prev, ap_content: (prev.ap_content ?? '') + img }))
    }
  }, [attachedImages, selectedImageId])

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
      payload.app_id = defaultAppId
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
        if (savedId) {
          for (let slotIndex = 0; slotIndex < attachmentsBySlot.length; slotIndex++) {
            const slot = attachmentsBySlot[slotIndex] ?? []
            const fileNo = slotIndex + 1
            for (const item of slot) {
              if (item.type !== 'local') continue
              try {
                await uploadFileApi({
                  file: item.file,
                  menuCd,
                  dataId: savedId,
                  fileNo,
                  save_path: savePath,
                })
              } catch (e) {
                console.error(e)
                alert('첨부파일 업로드에 실패했습니다.')
              }
            }
          }
        }
      }
      if (savedId) {
        navigate(`${basePath}/${savedId}`)
      } else {
        navigate(basePath)
      }
    } catch (e) {
      console.error(e)
      const message = e instanceof Error ? e.message : '저장에 실패했습니다.'
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  const categorySelectedKey = normalizeInfoBoardCategory(form.cate1)

  if (loading) {
    return (
      <Box sx={INFO_BOARD_PAGE_SX}>
        <Paper
          elevation={0}
          sx={INFO_BOARD_PAPER_SX}
        >
          <Box sx={INFO_BOARD_LAYOUT_SX}>
            {!hideCategorySidebar && (
              <InfoBoardCategorySidebar
                selectedKey={categorySelectedKey}
                appId={defaultAppId}
                basePath={basePath}
              />
            )}
            <Typography color="text.secondary">로딩 중...</Typography>
          </Box>
        </Paper>
      </Box>
    )
  }

  return (
    <Box sx={INFO_BOARD_PAGE_SX}>
      <Paper
        elevation={0}
        sx={INFO_BOARD_PAPER_SX}
      >
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
          {isEdit ? '앱 데이터 수정' : '앱 데이터 등록'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {isEdit ? '앱 데이터를 수정합니다.' : '새 앱 데이터를 등록합니다.'}
        </Typography>

        <Box sx={INFO_BOARD_LAYOUT_SX}>
          {!hideCategorySidebar && (
            <InfoBoardCategorySidebar
              selectedKey={categorySelectedKey}
              appId={defaultAppId}
              basePath={basePath}
            />
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack spacing={2.5}>
          <Box sx={{ display: 'none' }}>
            <TextField
              type="number"
              value={form.app_id ?? defaultAppId}
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

          <RichTextEditor
            label="내용"
            editorKey={loading ? 'loading' : `edit-${form.data_id ?? 'new'}`}
            value={form.ap_content ?? ''}
            onChange={(data) => setForm((prev) => ({ ...prev, ap_content: data }))}
            onReady={(editor) => { editorRef.current = editor }}
          />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              이미지
            </Typography>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                addImages(e.target.files)
                e.target.value = ''
              }}
            />
            <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImages}
              >
                +이미지등록
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={handleInsertToEditor}
                disabled={attachedImages.length === 0 || selectedImageId == null}
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
                {selectedImageId != null ? (
                  (() => {
                    const item = attachedImages.find(
                      (x) =>
                        (x.type === 'local' && x.id === selectedImageId) ||
                        (x.type === 'uploaded' && x.fileId === selectedImageId),
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
                {attachedImages.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                    등록된 이미지 파일이 없습니다.
                  </Typography>
                ) : (
                  <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                    {attachedImages.map((item) => {
                      const id = item.type === 'local' ? item.id : item.fileId
                      const name = item.type === 'local' ? item.file.name : item.fileName
                      const size = item.type === 'local' ? item.file.size : item.filesize
                      const date = item.type === 'local' ? formatDate(new Date().toISOString()) : formatDate(item.created_at)
                      const selected = selectedImageId === id
                      return (
                        <Box
                          component="li"
                          key={id}
                          onClick={() => setSelectedImageId(id)}
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
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDeleteImage(item) }} title="삭제">
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

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              첨부파일
            </Typography>
            <input
              ref={attachmentInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                addAttachmentForSlot(addingToSlotRef.current, e.target.files)
                e.target.value = ''
              }}
            />
            {Array.from({ length: uploadCount }, (_, slotIndex) => (
              <Box key={slotIndex} sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1.5} alignItems="stretch" useFlexGap>
                  <Box sx={{ flexShrink: 0, minHeight: 40, display: 'flex' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        addingToSlotRef.current = slotIndex
                        attachmentInputRef.current?.click()
                      }}
                      disabled={uploadingAttachments}
                      sx={{ height: '100%', minHeight: 40 }}
                    >
                      +첨부파일 {slotIndex + 1}
                    </Button>
                  </Box>
                  <Box
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      minHeight: 40,
                      maxHeight: 40,
                      overflow: 'auto',
                    }}
                  >
                  {(attachmentsBySlot[slotIndex] ?? []).length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
                      등록된 첨부파일이 없습니다.
                    </Typography>
                  ) : (
                    <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                      {(attachmentsBySlot[slotIndex] ?? []).map((item) => {
                        const id = item.type === 'local' ? item.id : item.fileId
                        const name = item.type === 'local' ? item.file.name : item.fileName
                        const size = item.type === 'local' ? item.file.size : item.filesize
                        const date = item.type === 'local' ? formatDate(new Date().toISOString()) : formatDate(item.created_at)
                        return (
                          <Box
                            component="li"
                            key={id}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              px: 1.5,
                              py: 0.75,
                              borderBottom: '1px solid',
                              borderColor: 'divider',
                            }}
                          >
                            <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</Typography>
                            <Typography variant="caption" color="text.secondary">{formatFileSize(size)}</Typography>
                            <Typography variant="caption" color="text.secondary">{date}</Typography>
                            <IconButton size="small" onClick={() => handleDeleteAttachment(slotIndex, item)} title="삭제">
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
            ))}
          </Box>

        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ mt: 3, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => navigate(basePath)}
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
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}

export default function AppDataFormPageDefault() {
  return <AppDataFormPage />
}
