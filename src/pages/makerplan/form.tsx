import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import LightbulbIcon from '@mui/icons-material/Lightbulb'
import BrushIcon from '@mui/icons-material/Brush'
import PaletteIcon from '@mui/icons-material/Palette'
import EngineeringIcon from '@mui/icons-material/Engineering'
import ScienceIcon from '@mui/icons-material/Science'
import ConstructionIcon from '@mui/icons-material/Construction'
import RateReviewIcon from '@mui/icons-material/RateReview'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { CKEditor } from '@ckeditor/ckeditor5-react'
import { ClassicEditor, Essentials, Paragraph, Bold, Italic, Image, ImageInsert, ImageResize, ImageToolbar, ImageStyle, Alignment } from 'ckeditor5'
import 'ckeditor5/ckeditor5.css'
import TopBar from '../../components/TopBar'
import {
  fetchAppDataByIdApi,
  fetchAppDataListApi,
  createAppDataApi,
  updateAppDataApi,
  type ApiAppData,
  type ApiAppPayload,
} from '../../apis/appApi'
import {
  uploadImageApi,
  fetchImagesByDataApi,
  deleteImagesApi,
  type ApiImage,
} from '../../apis/imageApi'

const numFields: (keyof ApiAppPayload)[] = [
  'data_id', 'app_id', 'gr_num', 'reply_cd', 'parent_id', 'is_commt', 'co_num', 'co_reply',
  'wr_type', 'is_secret', 'link1_hit', 'link2_hit', 'hit', 'good', 'nogood', 'user_no', 'file_cnt',
]

const emptyForm: ApiAppPayload = {
  app_id: 4,
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

const STEP_ITEMS = [
  { id: 'concept', label: '구상', icon: LightbulbIcon },
  { id: 'sketch', label: '스케치', icon: BrushIcon },
  { id: 'design', label: '디자인', icon: PaletteIcon },
  { id: 'plan', label: '설계', icon: EngineeringIcon },
  { id: 'prototype', label: '프로토타입', icon: ScienceIcon },
  { id: 'build', label: '본체제작', icon: ConstructionIcon },
  { id: 'review', label: '제작후기', icon: RateReviewIcon },
]

const ITEMS_PER_ROW_NARROW = 4

function normalizeText(value: unknown): string {
  return String(value ?? '').trim()
}

function isBodyEntry(value: { cate1?: unknown; parent_id?: unknown }): boolean {
  const stepName = normalizeText(value.cate1)
  const parentId = Number(value.parent_id ?? 0)
  return stepName === '' && parentId === 0
}

type AttachedFile =
  | { type: 'local'; id: string; file: File; objectUrl: string }
  | { type: 'uploaded'; fileId: number; fileUrl: string; fileName: string; filesize: number; created_at: string }

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}kb`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function formatFileDate(s: string): string {
  const d = new Date(s)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function toAbsoluteFileUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `http://impsj.net${url.startsWith('/') ? url : `/${url}`}`
}

export default function MakerPlanFormPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams<{ id?: string }>()
  const theme = useTheme()
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'))

  const isCreate = location.pathname === '/makerplan/create'
  const dataId = !isCreate && id ? parseInt(id, 10) : NaN
  const searchParams = new URLSearchParams(location.search)
  const isReply = searchParams.get('reply') === '1'
  const stepParam = searchParams.get('step')
  const parsed = stepParam != null ? parseInt(stepParam, 10) : NaN
  const stepIndex = Number.isFinite(parsed) ? Math.min(Math.max(parsed - 1, 0), STEP_ITEMS.length - 1) : 0
  const returnTo = typeof location.state === 'object' && location.state != null && 'returnTo' in location.state
    ? String((location.state as { returnTo?: string }).returnTo ?? '')
    : ''

  const [form, setForm] = useState<ApiAppPayload>({ ...emptyForm })
  const [loading, setLoading] = useState(!isCreate)
  const [saving, setSaving] = useState(false)
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null)
  const [selectedStepDataId, setSelectedStepDataId] = useState<number | null>(null)
  const [stepContents, setStepContents] = useState<Array<{ stepLabel: string; data_id: number; ap_subject: string; ap_content: string; parent_id: number }>>([])
  const [rootDataId, setRootDataId] = useState<number | null>(null)
  const [rootSubject, setRootSubject] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [selectedFileId, setSelectedFileId] = useState<string | number | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<{ execute: (cmd: string, opts?: { source?: string | string[] }) => void } | null>(null)

  const menuCd = 'makerplan'
  const effectiveDataId = selectedStepDataId ?? (!isCreate && !isNaN(dataId) ? dataId : 0)

  useEffect(() => {
    if (isCreate) {
      if (isReply) {
        const step = STEP_ITEMS[stepIndex]
        setForm({ ...emptyForm, cate1: step?.label ?? '' })
        setSelectedStepIndex(stepIndex)
      } else {
        setForm({ ...emptyForm })
        setSelectedStepIndex(null)
      }
      setRootDataId(null)
      setRootSubject('')
      setLoading(false)
      return
    }
    if (isReply && !isNaN(dataId)) {
      let cancelled = false
      const loadParent = async () => {
        try {
          const parent = await fetchAppDataByIdApi(dataId)
          if (!cancelled && parent) {
            const step = STEP_ITEMS[stepIndex]
            setForm({
              ...emptyForm,
              parent_id: dataId,
              gr_num: parent.gr_num ?? 0,
              app_id: parent.app_id ?? 4,
              cate1: step?.label ?? '',
            })
            setSelectedStepIndex(stepIndex)
            setRootDataId(dataId)
            setRootSubject(parent.ap_subject?.trim() ?? '')
            const grNum = parent.gr_num ?? 0
            const listRes = await fetchAppDataListApi({ app_id: 4, gr_num: grNum, skip: 0, limit: 500 })
            if (!cancelled && listRes) {
              const rootRow = listRes.find((r) => isBodyEntry(r))
              const rootId = rootRow?.data_id ?? dataId
              const items: Array<{ stepLabel: string; data_id: number; ap_subject: string; ap_content: string; parent_id: number }> = []
              if (rootRow?.data_id) {
                setRootSubject(rootRow.ap_subject?.trim() ?? parent.ap_subject?.trim() ?? '')
                items.push({
                  stepLabel: '본문',
                  data_id: rootRow.data_id,
                  ap_subject: rootRow.ap_subject?.trim() ?? '',
                  ap_content: rootRow.ap_content?.trim() ?? '',
                  parent_id: rootRow.parent_id ?? 0,
                })
              }
              for (let i = 0; i < STEP_ITEMS.length; i++) {
                const row = listRes.find((r) => {
                  return normalizeText(r.cate1) === STEP_ITEMS[i]?.label && (r.parent_id ?? 0) === rootId
                })
                if (row && row.data_id != null) {
                  const stepItem = STEP_ITEMS[i] ?? STEP_ITEMS[0]
                  items.push({
                    stepLabel: stepItem?.label ?? '단계',
                    data_id: row.data_id,
                    ap_subject: row.ap_subject?.trim() ?? '',
                    ap_content: row.ap_content?.trim() ?? '',
                    parent_id: row.parent_id ?? 0,
                  })
                }
              }
              setStepContents(items)
            }
          }
        } catch (e) {
          console.error(e)
          if (!cancelled) navigate('/makerplan')
        } finally {
          if (!cancelled) setLoading(false)
        }
      }
      setLoading(true)
      loadParent()
      return () => { cancelled = true }
    }
    if (isNaN(dataId)) {
      setLoading(false)
      if (!isCreate) navigate('/makerplan')
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const data: ApiAppData | null = await fetchAppDataByIdApi(dataId)
        if (cancelled) return
        if (!data) {
          navigate('/makerplan')
          return
        }
        const grNum = data.gr_num ?? 0
        const listRes = await fetchAppDataListApi({
          app_id: 4,
          gr_num: grNum,
          skip: 0,
          limit: 500,
        })
        if (cancelled) return
        const loadStepIndex = STEP_ITEMS.findIndex((s) => normalizeText(data.cate1) === s.label)
        if (!cancelled) {
          setSelectedStepIndex(loadStepIndex >= 0 ? loadStepIndex : null)
        }
        const rootRow = (listRes ?? []).find((r) => isBodyEntry(r))
        const rootId = rootRow?.data_id ?? data.data_id ?? 0
        setRootSubject(rootRow?.ap_subject?.trim() ?? (isBodyEntry(data) ? data.ap_subject?.trim() ?? '' : ''))
        const items: Array<{ stepLabel: string; data_id: number; ap_subject: string; ap_content: string; parent_id: number }> = []
        if (rootRow?.data_id) {
          items.push({
            stepLabel: '본문',
            data_id: rootRow.data_id,
            ap_subject: rootRow.ap_subject?.trim() ?? '',
            ap_content: rootRow.ap_content?.trim() ?? '',
            parent_id: rootRow.parent_id ?? 0,
          })
        }
        for (let i = 0; i < STEP_ITEMS.length; i++) {
          const row = (listRes ?? []).find((r) => {
            return normalizeText(r.cate1) === STEP_ITEMS[i]?.label && (r.parent_id ?? 0) === rootId
          })
          if (row && row.data_id != null) {
            const stepItem = STEP_ITEMS[i] ?? STEP_ITEMS[0]
            items.push({
              stepLabel: stepItem?.label ?? '단계',
              data_id: row.data_id,
              ap_subject: row.ap_subject?.trim() ?? '',
              ap_content: row.ap_content?.trim() ?? '',
              parent_id: row.parent_id ?? 0,
            })
          }
        }
        setStepContents(items)
        setRootDataId(isBodyEntry(data) ? (data.data_id ?? null) : rootId)
        setSelectedStepDataId(data.data_id ?? null)
        setForm({
          data_id: data.data_id,
          app_id: data.app_id ?? 4,
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
        if (!cancelled) navigate('/makerplan')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [isCreate, isReply, dataId, navigate])

  useEffect(() => {
    if (!selectedStepDataId) {
      setAttachedFiles([])
      setSelectedFileId(null)
      return
    }
    let cancelled = false
    const loadFiles = async () => {
      try {
        const res = await fetchImagesByDataApi({ menuCd, dataId: selectedStepDataId })
        if (cancelled) return
        const items: AttachedFile[] = res.items.map((f: ApiImage) => ({
          type: 'uploaded',
          fileId: f.file_id,
          fileUrl: toAbsoluteFileUrl(f.file_url),
          fileName: f.file_name,
          filesize: f.filesize,
          created_at: f.created_at,
        }))
        setAttachedFiles(items)
        const firstItem = items[0]
        setSelectedFileId(firstItem && 'fileId' in firstItem ? firstItem.fileId : null)
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setAttachedFiles([])
          setSelectedFileId(null)
        }
      }
    }
    loadFiles()
    return () => { cancelled = true }
  }, [selectedStepDataId])

  const addFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return
    if (!effectiveDataId) {
      alert('단계를 먼저 선택하거나 저장한 뒤 이미지를 첨부해 주세요.')
      return
    }
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
    if (first?.type === 'local' && selectedFileId === null) setSelectedFileId(first.id)
    setUploading(true)
    try {
      for (const item of toAdd) {
        if (item.type !== 'local') continue
        const res = await uploadImageApi({
          file: item.file,
          menuCd,
          dataId: effectiveDataId,
          save_path: 'makerplan',
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
        await deleteImagesApi({ fileIds: [item.fileId] })
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
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    const stepName = normalizeText(form.cate1)
    const isBodyForm = isBodyEntry(form)
    if (!isBodyForm && !stepName) {
      alert('단계명을 입력해 주세요.')
      return
    }
    if (!isCreate && isNaN(dataId)) return
    setSaving(true)
    try {
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
      const shouldCreateStep = !isBodyForm && Number(form.parent_id ?? 0) > 0 && selectedStepDataId == null
      if (selectedStepDataId != null) {
        await updateAppDataApi(selectedStepDataId, payload)
      } else if (isCreate || shouldCreateStep || (isReply && form.parent_id)) {
        const apiParams = Number(form.parent_id ?? 0) > 0 ? { reply: 1 } : undefined
        await createAppDataApi(payload, apiParams)
      } else {
        await updateAppDataApi(dataId, payload)
      }
      navigate('/makerplan')
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    navigate(returnTo || '/makerplan')
  }

  if (loading) {
    return (
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
        <TopBar />
        <Typography color="text.secondary">로딩 중...</Typography>
      </Box>
    )
  }

  const matchedStepIndex = STEP_ITEMS.findIndex((s) => normalizeText(form.cate1) === s.label)
  const activeStepIndex = selectedStepIndex ?? (matchedStepIndex >= 0 ? matchedStepIndex : null)
  const isBodyForm = isBodyEntry(form)
  const isInitialBodyCreate = isCreate && !isReply
  const pageTitle = isCreate ? '메이커플랜 등록' : '메이커플랜 상세'
  const pageDescription = isCreate ? '단계 정보를 등록합니다.' : '단계 정보를 조회하고 수정합니다.'

  const handleStepClick = (index: number) => {
    const step = STEP_ITEMS[index]
    if (step) {
      setSelectedStepIndex(index)
      const stepContent = stepContents.find((s) => s.stepLabel === step.label)
      const apContent = stepContent?.ap_content ?? ''
      setSelectedStepDataId(stepContent?.data_id ?? null)
      setForm((prev) => ({
        ...prev,
        cate1: step.label,
        parent_id: stepContent?.parent_id ?? rootDataId ?? prev.parent_id ?? 0,
        ap_content: apContent,
      }))
    }
  }
  const isEndOfRow = (idx: number) =>
    isNarrow && (idx + 1) % ITEMS_PER_ROW_NARROW === 0
  const showConnector = (idx: number) =>
    idx < STEP_ITEMS.length - 1 && !isEndOfRow(idx)

  return (
    <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
      <TopBar />
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          backgroundColor: 'background.paper',
        }}
      >
        <Typography variant="h5" sx={{ mb: 1.5, fontWeight: 600 }}>
          메이커플랜
        </Typography>
        {/* <Typography variant="body2" color="text.secondary" sx={{ mb: 0 }}>
          {pageGuideText}
        </Typography> */}

        {!isInitialBodyCreate && (
          <>
            {/* 스텝별 진행 단계 UI */}
            <Box sx={{ mt: 5 }}>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: isNarrow ? 'wrap' : 'nowrap',
                  alignItems: 'center',
                  gap: isNarrow ? 2 : 0,
                }}
              >
                {STEP_ITEMS.map((step, index) => {
                  const isCompleted = activeStepIndex != null && index < activeStepIndex
                  const isActive = activeStepIndex === index
                  const isLast = index === STEP_ITEMS.length - 1
                  const StepIcon = step.icon

                  return (
                    <Box
                      key={step.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        flex: isNarrow
                          ? `0 0 calc((100% - ${(ITEMS_PER_ROW_NARROW - 1) * 16}px) / ${ITEMS_PER_ROW_NARROW})`
                          : isLast
                            ? '0 0 auto'
                            : 1,
                        minWidth: isNarrow ? 0 : 0,
                        mb: isNarrow ? 2 : 0,
                      }}
                    >
                      <Box
                        onClick={() => handleStepClick(index)}
                        sx={{
                          width: 80,
                          height: 80,
                          borderRadius: '15%',
                          backgroundColor: isCompleted ? '#4caf50' : isActive ? '#2196f3' : '#ccc',
                          color: 'white',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          fontWeight: 'bold',
                          border: '4px solid white',
                          boxSizing: 'border-box',
                          flexShrink: 0,
                          cursor: 'pointer',
                        }}
                      >
                        <StepIcon sx={{ fontSize: 36 }} />
                      </Box>
                      {showConnector(index) && (
                        <Box
                          sx={{
                            flex: 1,
                            height: 2,
                            minWidth: 20,
                            mx: 0.5,
                            backgroundColor: isCompleted ? '#4caf50' : '#bbb',
                          }}
                        />
                      )}
                    </Box>
                  )
                })}
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: isNarrow ? 'wrap' : 'nowrap',
                  alignItems: 'center',
                  mt: 1.25,
                  gap: isNarrow ? 2 : 0,
                }}
              >
                {STEP_ITEMS.map((step, index) => {
                  const isActive = activeStepIndex === index
                  const isLast = index === STEP_ITEMS.length - 1

                  return (
                    <Box
                      key={step.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        flex: isNarrow
                          ? `0 0 calc((100% - ${(ITEMS_PER_ROW_NARROW - 1) * 16}px) / ${ITEMS_PER_ROW_NARROW})`
                          : isLast
                            ? '0 0 auto'
                            : 1,
                        minWidth: 0,
                        mb: isNarrow ? 0.5 : 0,
                      }}
                    >
                      <Box
                        onClick={() => handleStepClick(index)}
                        sx={{
                          width: 80,
                          flexShrink: 0,
                          textAlign: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontSize: 14,
                            color: isActive ? '#2196f3' : '#666',
                            fontWeight: isActive ? 'bold' : 400,
                          }}
                        >
                          {step.label}
                        </Typography>
                      </Box>
                      {showConnector(index) && <Box sx={{ flex: 1, minWidth: 20, mx: 0.5 }} />}
                    </Box>
                  )
                })}
              </Box>
            </Box>

            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 3, mb: 2 }}>
              {isBodyForm
                ? `본문 제목 - ${form.ap_subject || '(제목 없음)'}`
                : `본문 제목 - ${rootSubject || '(제목 없음)'}`}
            </Typography>
          </>
        )}

        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          {pageTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {pageDescription}
        </Typography>

        <Stack spacing={2.5}>
          {stepContents.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                단계별 등록 현황
              </Typography>
              {stepContents.map((item) => (
                <Box key={item.data_id} sx={{ mb: 1.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                    {item.stepLabel} (data_id: {item.data_id})
                  </Typography>
                  {item.stepLabel === '본문' ? (
                    <Typography
                      variant="body2"
                      sx={{
                        p: 1.5,
                        borderRadius: 1,
                        backgroundColor: 'grey.50',
                        wordBreak: 'break-word',
                        fontSize: 13,
                      }}
                    >
                      {item.ap_subject || '(제목 없음)'}
                    </Typography>
                  ) : (
                    <></>
                    // <Typography
                    //   variant="body2"
                    //   component="pre"
                    //   sx={{
                    //     p: 1.5,
                    //     borderRadius: 1,
                    //     backgroundColor: 'grey.50',
                    //     whiteSpace: 'pre-wrap',
                    //     wordBreak: 'break-word',
                    //     fontSize: 13,
                    //   }}
                    // >
                    //   {item.ap_content || '(비어 있음)'}
                    // </Typography>
                  )}
                </Box>
              ))}
            </Box>
          )}
          {!isInitialBodyCreate && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                단계명 {!isBodyForm && <span style={{ color: 'red' }}>*</span>}
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder={isBodyForm ? '최초 본문은 단계명이 없습니다.' : '단계명 (cate1)'}
                value={form.cate1 ?? ''}
                onChange={handleChange('cate1')}
                disabled={isBodyForm}
                InputProps={{ readOnly: true, sx: { backgroundColor: 'grey.50' } }}
              />
            </Box>
          )}

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              제목
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="제목 (ap_subject)"
              value={form.ap_subject ?? ''}
              onChange={handleChange('ap_subject')}
              InputProps={{ sx: { backgroundColor: 'grey.50' } }}
            />
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              설명
            </Typography>
            <Box sx={{ '& .ck-editor': { backgroundColor: 'grey.50' }, '& .ck.ck-editor__editable': { minHeight: 240 } }}>
              <CKEditor
                key={loading ? 'loading' : `makerplan-${selectedStepDataId ?? dataId ?? 'new'}`}
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
              에디터 이미지
            </Typography>
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
                disabled={uploading || !effectiveDataId}
              >
                +이미지등록
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
                    등록된 이미지가 없습니다.
                  </Typography>
                ) : (
                  <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                    {attachedFiles.map((item) => {
                      const id = item.type === 'local' ? item.id : item.fileId
                      const name = item.type === 'local' ? item.file.name : item.fileName
                      const size = item.type === 'local' ? item.file.size : item.filesize
                      const date = item.type === 'local' ? formatFileDate(new Date().toISOString()) : formatFileDate(item.created_at)
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
            onClick={handleCancel}
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
