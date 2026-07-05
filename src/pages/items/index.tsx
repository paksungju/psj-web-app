import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
  Menu,
  MenuItem,
  Checkbox,
  Grid,
  Card,
  CardActionArea,
  IconButton,
  Avatar,
  InputAdornment,
} from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import MenuIcon from '@mui/icons-material/Menu'
import AppsIcon from '@mui/icons-material/Apps'
import SearchIcon from '@mui/icons-material/Search'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import TopBar from '../../components/TopBar'
import {
  createAppDataApi,
  deleteAppDataApi,
  deleteAppDataBatchApi,
  fetchAppDataByIdApi,
  fetchAppDataListApi,
  updateAppDataApi,
  type ApiAppData,
  type ApiAppPayload,
} from '../../apis/appApi'
import {
  deleteFilesApi,
  fetchFilesByDataApi,
  uploadFileApi,
} from '../../apis/fileApi'
import { fetchCodesByParentApi, type CodeRow } from '../../apis/codesApi'

const ITEMS_APP_ID = 9
const ITEMS_MENU_CD = 'items'
const ITEMS_SAVE_PATH = 'items'
const ITEM_CODE_GROUP = 'itemCate'

function getValidCate1Code(value: string | null | undefined, options: CodeRow[]): string {
  const v = String(value ?? '').trim()
  if (!v) return ''
  if (options.some((o) => o.code_cd === v)) return v
  const byName = options.find((o) => (o.code_nm ?? '').trim() === v)
  return byName?.code_cd ?? ''
}

function getCodeLabel(codeCd: string | null | undefined, options: CodeRow[]): string {
  const validCode = getValidCate1Code(codeCd, options)
  if (!validCode) return '-'
  const row = options.find((o) => o.code_cd === validCode)
  return row?.code_nm?.trim() || '-'
}

function cate1MatchesFilter(rowCate1: unknown, filter: string, options: CodeRow[]): boolean {
  if (!filter) return true
  return getValidCate1Code(String(rowCate1 ?? ''), options) === filter
}

function matchesItemKeyword(row: ApiAppData, keyword: string): boolean {
  const q = keyword.trim().toLowerCase()
  if (!q) return true
  const fields = [row.ap_subject, row.extra_1, row.ap_content, row.recv_mail, row.hit]
  return fields.some((value) => {
    if (value == null || value === '') return false
    return String(value).toLowerCase().includes(q)
  })
}

function matchesItemFilters(row: ApiAppData, keyword: string, cateFilter: string, codeOptions: CodeRow[]): boolean {
  if (!cate1MatchesFilter(row.cate1, cateFilter, codeOptions)) return false
  return matchesItemKeyword(row, keyword)
}

type AttachedFile =
  | { type: 'local'; id: string; file: File }
  | { type: 'uploaded'; fileId: number; fileUrl: string; fileName: string; filesize: number; created_at: string }

function toAbsoluteFileUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `http://impsj.net${url.startsWith('/') ? url : `/${url}`}`
}

function formatUploadFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}kb`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function formatUploadDate(s: string): string {
  const d = new Date(s)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function normalizeAppPayload(input: ApiAppPayload): ApiAppPayload {
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

  const payload = {} as ApiAppPayload
  for (const k of strKeys) {
    const v = input[k]
    ;(payload as Record<string, unknown>)[k] = v != null && v !== '' ? String(v) : ''
  }
  for (const k of intKeys) {
    const v = input[k]
    if (v != null && v !== '') {
      const n = Number(v)
      ;(payload as Record<string, unknown>)[k] = Number.isNaN(n) ? 0 : n
    } else {
      ;(payload as Record<string, unknown>)[k] = 0
    }
  }
  return payload
}

function makeEmptyItem(): ApiAppData {
  return normalizeAppPayload({
    app_id: ITEMS_APP_ID,
    ap_subject: '',
    ap_content: '',
    user_nm: '',
    link1: '',
  }) as ApiAppData
}

function getItemId(row: ApiAppData): number | null {
  return row.data_id ?? null
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}.${month}.${day}`
  } catch {
    return '-'
  }
}

function getItemImageUrl(
  content: string | null | undefined,
  link1?: string | null,
): string | null {
  if (link1?.trim()) {
    const link = link1.trim()
    if (/^https?:\/\/.+\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(link)) return link
    if (link.startsWith('http') || link.startsWith('/')) {
      return link.startsWith('http') ? link : `http://impsj.net${link.startsWith('/') ? link : `/${link}`}`
    }
  }
  if (!content?.trim()) return null
  const text = content.trim()
  const imgMatch = text.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (imgMatch?.[1]) {
    const src = imgMatch[1].trim()
    return src.startsWith('http') ? src : `http://impsj.net${src.startsWith('/') ? src : `/${src}`}`
  }
  if (/^https?:\/\/.+\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(text)) {
    return text
  }
  return null
}

function getDisplayName(name: string) {
  if (!name) return ''
  return name.length > 14 ? `${name.slice(0, 14)}...` : name
}

function getContentPreview(content: string | null | undefined): string {
  if (!content?.trim()) return '-'
  const plain = content.replace(/<[^>]+>/g, '').trim()
  return plain || '-'
}

interface ItemAttachmentFieldProps {
  dataId: number
  link1: string
  onLink1Change: (url: string) => void
  onPendingFileChange?: (file: File | null) => void
}

/** apps/info/create 첨부파일 로직 — 1개만 허용 (menuCd=items, appId=9) */
function ItemAttachmentField({
  dataId,
  link1,
  onLink1Change,
  onPendingFileChange,
}: ItemAttachmentFieldProps) {
  const [attachment, setAttachment] = useState<AttachedFile | null>(null)
  const [uploading, setUploading] = useState(false)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const effectiveDataId = dataId > 0 ? dataId : 0

  useEffect(() => {
    if (effectiveDataId <= 0) {
      setAttachment(null)
      return
    }
    let cancelled = false
    const loadAttachment = async () => {
      try {
        const res = await fetchFilesByDataApi({ menuCd: ITEMS_MENU_CD, dataId: effectiveDataId, limit: 1 })
        if (cancelled) return
        const f = res.items[0]
        if (!f) {
          setAttachment(null)
          return
        }
        const fileUrl = toAbsoluteFileUrl(f.file_url)
        setAttachment({
          type: 'uploaded',
          fileId: f.file_id,
          fileUrl,
          fileName: f.file_name,
          filesize: f.filesize,
          created_at: f.created_at,
        })
        if (!link1.trim()) onLink1Change(fileUrl)
      } catch (e) {
        console.error(e)
        if (!cancelled) setAttachment(null)
      }
    }
    void loadAttachment()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDataId])

  const uploadOneFile = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const res = await uploadFileApi({
        file,
        menuCd: ITEMS_MENU_CD,
        dataId: effectiveDataId,
        fileNo: 1,
        save_path: ITEMS_SAVE_PATH,
      })
      const fileUrl = toAbsoluteFileUrl(res.file_url)
      setAttachment({
        type: 'uploaded',
        fileId: res.file_id,
        fileUrl,
        fileName: res.file_name,
        filesize: res.filesize,
        created_at: res.created_at,
      })
      onPendingFileChange?.(null)
      onLink1Change(fileUrl)
    } catch (e) {
      console.error(e)
      alert('첨부파일 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }, [effectiveDataId, onLink1Change, onPendingFileChange])

  const handleSelectFile = useCallback(async (files: FileList | null) => {
    const file = files?.item(0)
    if (!file) return

    if (attachment?.type === 'uploaded') {
      try {
        await deleteFilesApi({ fileIds: [attachment.fileId] })
      } catch (e) {
        console.error(e)
        alert('기존 첨부파일 삭제에 실패했습니다.')
        return
      }
    }

    if (effectiveDataId > 0) {
      await uploadOneFile(file)
      return
    }

    setAttachment({ type: 'local', id: `local-${Date.now()}`, file })
    onPendingFileChange?.(file)
    onLink1Change('')
  }, [attachment, effectiveDataId, onLink1Change, onPendingFileChange, uploadOneFile])

  const handleDeleteAttachment = useCallback(async () => {
    if (!attachment) return
    if (attachment.type === 'uploaded') {
      try {
        await deleteFilesApi({ fileIds: [attachment.fileId] })
      } catch (e) {
        console.error(e)
        alert('첨부파일 삭제에 실패했습니다.')
        return
      }
      if (link1 === attachment.fileUrl) onLink1Change('')
    }
    setAttachment(null)
    onPendingFileChange?.(null)
  }, [attachment, link1, onLink1Change, onPendingFileChange])

  const displayName = attachment
    ? (attachment.type === 'local' ? attachment.file.name : attachment.fileName)
    : null
  const displaySize = attachment
    ? (attachment.type === 'local' ? attachment.file.size : attachment.filesize)
    : 0
  const displayDate = attachment
    ? (attachment.type === 'local' ? formatUploadDate(new Date().toISOString()) : formatUploadDate(attachment.created_at))
    : ''

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        첨부파일
      </Typography>
      <input
        ref={attachmentInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={(e) => {
          void handleSelectFile(e.target.files)
          e.target.value = ''
        }}
      />
      <Stack direction="row" spacing={1.5} alignItems="stretch" useFlexGap>
        <Button
          size="small"
          variant="outlined"
          onClick={() => attachmentInputRef.current?.click()}
          disabled={uploading}
          sx={{ flexShrink: 0, minHeight: 40 }}
        >
          +첨부파일
        </Button>
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            minHeight: 40,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {!attachment ? (
            <Typography variant="body2" color="text.secondary" sx={{ px: 1.5 }}>
              등록된 첨부파일이 없습니다.
            </Typography>
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                width: '100%',
                px: 1.5,
                py: 0.5,
              }}
            >
              <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }} noWrap>
                {displayName}
              </Typography>
              <Typography variant="caption" color="text.secondary">{formatUploadFileSize(displaySize)}</Typography>
              <Typography variant="caption" color="text.secondary">{displayDate}</Typography>
              <IconButton size="small" onClick={() => void handleDeleteAttachment()} title="삭제">
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
          )}
        </Box>
      </Stack>
      {effectiveDataId <= 0 && attachment?.type === 'local' && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          저장 시 첨부파일이 업로드됩니다.
        </Typography>
      )}
    </Box>
  )
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        component="div"
        sx={{
          py: 1,
          px: 1.5,
          bgcolor: 'grey.50',
          borderRadius: 1,
          minHeight: 40,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {value === '' || value == null ? '-' : value}
      </Typography>
    </Box>
  )
}

function ItemDetailView({ item, itemCodeOptions }: { item: ApiAppData; itemCodeOptions: CodeRow[] }) {
  const imageUrl = getItemImageUrl(item.ap_content, item.link1)
  return (
    <Stack spacing={2.5}>
      <Box
        sx={{
          width: '100%',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'grey.50',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 180,
        }}
      >
        {imageUrl ? (
          <Box
            component="img"
            src={imageUrl}
            alt={item.ap_subject ?? '아이템 이미지'}
            sx={{
              display: 'block',
              width: '100%',
              maxHeight: 280,
              objectFit: 'contain',
            }}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            이미지 없음
          </Typography>
        )}
      </Box>
      <DetailField label="분류명 (cate1)" value={getCodeLabel(item.cate1, itemCodeOptions)} />
      <DetailField label="아이템 명 (ap_subject)" value={item.ap_subject} />
      <DetailField label="저장위치 (extra_1)" value={item.extra_1} />
      <DetailField label="수량 (hit)" value={item.hit ?? 0} />
      {item.link1?.trim() && (
        <DetailField label="이미지 URL" value={item.link1} />
      )}
      <DetailField label="설명" value={getContentPreview(item.ap_content)} />
      <DetailField label="등록일" value={formatDate(item.regist_dt)} />
    </Stack>
  )
}

function validateItemRequired(item: ApiAppData, codeOptions: CodeRow[]): { cate1?: boolean; apSubject?: boolean } {
  const errors: { cate1?: boolean; apSubject?: boolean } = {}
  if (!getValidCate1Code(item.cate1, codeOptions)) errors.cate1 = true
  if (!String(item.ap_subject ?? '').trim()) errors.apSubject = true
  return errors
}

interface ItemFormFieldsProps {
  item: ApiAppData
  itemCodeOptions: CodeRow[]
  onChange: (updater: (prev: ApiAppData) => ApiAppData) => void
  onPendingAttachmentChange?: (file: File | null) => void
  errors?: { cate1?: boolean; apSubject?: boolean }
}

function ItemFormFields({ item, itemCodeOptions, onChange, onPendingAttachmentChange, errors }: ItemFormFieldsProps) {
  const cate1Value = getValidCate1Code(item.cate1, itemCodeOptions)

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          분류명 (cate1) <Typography component="span" color="error">*</Typography>
        </Typography>
        <TextField
          select
          fullWidth
          size="small"
          required
          value={cate1Value}
          onChange={(e) => onChange((prev) => ({ ...prev, cate1: e.target.value }))}
          error={Boolean(errors?.cate1)}
          helperText={errors?.cate1 ? '공통코드에 등록된 분류를 선택해 주세요.' : undefined}
          InputProps={{ sx: { backgroundColor: 'grey.50' } }}
          SelectProps={{
            displayEmpty: true,
            MenuProps: { disablePortal: true },
          }}
        >
          <MenuItem value="">선택</MenuItem>
          {itemCodeOptions.map((opt) => (
            <MenuItem key={opt.code_id} value={opt.code_cd}>
              {opt.code_nm ?? opt.code_cd}
            </MenuItem>
          ))}
        </TextField>
      </Box>
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          아이템 명 (ap_subject) <Typography component="span" color="error">*</Typography>
        </Typography>
        <TextField
          fullWidth
          size="small"
          required
          value={item.ap_subject ?? ''}
          onChange={(e) => onChange((prev) => ({ ...prev, ap_subject: e.target.value }))}
          error={Boolean(errors?.apSubject)}
          helperText={errors?.apSubject ? '아이템 명을 입력해 주세요.' : undefined}
          InputProps={{ sx: { backgroundColor: 'grey.50' } }}
        />
      </Box>
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          저장위치 (extra_1)
        </Typography>
        <TextField
          fullWidth
          size="small"
          value={item.extra_1 ?? ''}
          onChange={(e) => onChange((prev) => ({ ...prev, extra_1: e.target.value }))}
          InputProps={{ sx: { backgroundColor: 'grey.50' } }}
        />
      </Box>
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          수량 (hit)
        </Typography>
        <TextField
          fullWidth
          size="small"
          type="number"
          value={item.hit ?? 0}
          onChange={(e) => onChange((prev) => ({ ...prev, hit: Number(e.target.value) }))}
          InputProps={{ sx: { backgroundColor: 'grey.50' } }}
        />
      </Box>
      <Box>
        <ItemAttachmentField
          dataId={item.data_id ?? 0}
          link1={item.link1 ?? ''}
          onLink1Change={(url) => onChange((prev) => ({ ...prev, link1: url }))}
          onPendingFileChange={onPendingAttachmentChange}
        />
      </Box>
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          설명
        </Typography>
        <TextField
          fullWidth
          size="small"
          multiline
          minRows={3}
          maxRows={6}
          value={item.ap_content ?? ''}
          onChange={(e) => onChange((prev) => ({ ...prev, ap_content: e.target.value }))}
          InputProps={{ sx: { backgroundColor: 'grey.50' } }}
        />
      </Box>
    </Stack>
  )
}

export default function ItemsPage() {
  const [items, setItems] = useState<ApiAppData[]>([])
  const [selectedItem, setSelectedItem] = useState<ApiAppData | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'detail' | 'edit' | 'create'>('detail')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')
  const [selectMode, setSelectMode] = useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [menuItem, setMenuItem] = useState<ApiAppData | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null)
  const [itemCodeOptions, setItemCodeOptions] = useState<CodeRow[]>([])
  const [keyword, setKeyword] = useState('')
  const [cateFilter, setCateFilter] = useState('')
  const [formErrors, setFormErrors] = useState<{ cate1?: boolean; apSubject?: boolean }>({})

  const hasActiveFilters = Boolean(keyword.trim() || cateFilter)

  const filteredItems = useMemo(
    () => items.filter((row) => matchesItemFilters(row, keyword, cateFilter, itemCodeOptions)),
    [items, keyword, cateFilter, itemCodeOptions],
  )

  const refreshItems = async () => {
    setLoading(true)
    try {
      const data = await fetchAppDataListApi({ app_id: ITEMS_APP_ID, skip: 0, limit: 200 })
      setItems(data ?? [])
    } catch (error) {
      console.error('항목 목록을 불러오는 중 오류가 발생했습니다:', error)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshItems()
  }, [])

  useEffect(() => {
    if (cateFilter && !itemCodeOptions.some((o) => o.code_cd === cateFilter)) {
      setCateFilter('')
    }
  }, [cateFilter, itemCodeOptions])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchCodesByParentApi(ITEM_CODE_GROUP)
        setItemCodeOptions(res.items ?? [])
      } catch (error) {
        console.error('itemCate 공통코드 조회 오류:', error)
        setItemCodeOptions([])
      }
    })()
  }, [])

  const handleSelectOne = (dataId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(dataId)) next.delete(dataId)
      else next.add(dataId)
      return next
    })
  }

  const handleToggleSelectMode = () => {
    setSelectMode((prev) => !prev)
    setSelectedIds(new Set())
  }

  const handleToggleSelectAll = () => {
    if (!selectMode) setSelectMode(true)
    const allIds = filteredItems.map(getItemId).filter((id): id is number => id != null)
    setSelectedIds((prev) =>
      prev.size === allIds.length && allIds.length > 0 ? new Set() : new Set(allIds),
    )
  }

  const handleMenuOpen = (target: HTMLElement, row: ApiAppData) => {
    setMenuAnchorEl(target)
    setMenuItem(row)
  }

  const handleMenuClose = () => {
    setMenuAnchorEl(null)
    setMenuItem(null)
  }

  const handleDeleteOne = async (row: ApiAppData) => {
    handleMenuClose()
    const dataId = getItemId(row)
    if (dataId == null) return
    if (!window.confirm(`"${row.ap_subject ?? ''}" 항목을 삭제하시겠습니까?`)) return

    try {
      await deleteAppDataApi(dataId)
      setItems((prev) => prev.filter((item) => getItemId(item) !== dataId))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(dataId)
        return next
      })
      if (selectedItem?.data_id === dataId) {
        setDetailOpen(false)
        setSelectedItem(null)
      }
    } catch (error) {
      console.error('항목 삭제 중 오류가 발생했습니다:', error)
      alert('항목 삭제에 실패했습니다.')
    }
  }

  const handleOpenDetail = async (row: ApiAppData) => {
    const dataId = getItemId(row)
    if (dataId == null) return

    setDialogMode('detail')
    setSelectedItem(row)
    setDetailOpen(true)

    try {
      const detail = await fetchAppDataByIdApi(dataId)
      if (detail) setSelectedItem(detail)
    } catch (error) {
      console.error('항목 상세를 불러오는 중 오류가 발생했습니다:', error)
    }
  }

  const handleCloseDetail = () => {
    setDetailOpen(false)
    setDialogMode('detail')
    setPendingAttachment(null)
    setFormErrors({})
  }

  const handleStartEdit = () => {
    setFormErrors({})
    setSelectedItem((prev) => {
      if (!prev) return prev
      return { ...prev, cate1: getValidCate1Code(prev.cate1, itemCodeOptions) }
    })
    setDialogMode('edit')
  }

  const handleCancelEdit = async () => {
    if (!selectedItem?.data_id) {
      handleCloseDetail()
      return
    }
    try {
      const detail = await fetchAppDataByIdApi(selectedItem.data_id)
      if (detail) setSelectedItem(detail)
    } catch (error) {
      console.error('항목 상세를 불러오는 중 오류가 발생했습니다:', error)
    }
    setDialogMode('detail')
    setFormErrors({})
  }

  const handleSaveDetail = async () => {
    if (!selectedItem) return

    const errors = validateItemRequired(selectedItem, itemCodeOptions)
    if (errors.cate1 || errors.apSubject) {
      setFormErrors(errors)
      if (errors.cate1) alert('공통코드에 등록된 분류를 선택해 주세요.')
      else alert('아이템 명은 필수입니다.')
      return
    }
    setFormErrors({})

    try {
      const resolvedCate1 = getValidCate1Code(String(selectedItem.cate1 ?? '').trim(), itemCodeOptions)
      const payload = normalizeAppPayload({
        ...selectedItem,
        data_id: selectedItem.data_id,
        app_id: ITEMS_APP_ID,
        cate1: resolvedCate1,
        ap_subject: String(selectedItem.ap_subject ?? '').trim(),
        ap_content: selectedItem.ap_content ?? '',
        extra_1: selectedItem.extra_1 ?? '',
        hit: selectedItem.hit ?? 0,
        link1: selectedItem.link1 ?? '',
      })

      if (dialogMode === 'create') {
        const created = await createAppDataApi(payload)
        const savedId = created.data_id
        if (savedId && pendingAttachment) {
          try {
            const res = await uploadFileApi({
              file: pendingAttachment,
              menuCd: ITEMS_MENU_CD,
              dataId: savedId,
              fileNo: 1,
              save_path: ITEMS_SAVE_PATH,
            })
            const fileUrl = toAbsoluteFileUrl(res.file_url)
            await updateAppDataApi(savedId, normalizeAppPayload({ ...payload, data_id: savedId, link1: fileUrl }))
          } catch (e) {
            console.error(e)
            alert('항목은 저장되었으나 첨부파일 업로드에 실패했습니다.')
          }
        }
        setPendingAttachment(null)
        await refreshItems()
        handleCloseDetail()
        setSelectedItem(null)
        return
      }

      if (selectedItem.data_id != null) {
        await updateAppDataApi(selectedItem.data_id, payload)
        await refreshItems()
        const detail = await fetchAppDataByIdApi(selectedItem.data_id)
        if (detail) setSelectedItem(detail)
        setDialogMode('detail')
      }
    } catch (error) {
      console.error('항목 저장 중 오류가 발생했습니다:', error)
      alert(error instanceof Error ? error.message : '항목 저장에 실패했습니다.')
    }
  }

  const handleOpenCreate = () => {
    setDialogMode('create')
    setSelectedItem(makeEmptyItem())
    setPendingAttachment(null)
    setFormErrors({})
    setDetailOpen(true)
  }

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) {
      alert('삭제할 항목을 선택해 주세요.')
      return
    }
    if (!window.confirm(`선택한 ${ids.length}개 항목을 삭제하시겠습니까?`)) return

    try {
      const res = await deleteAppDataBatchApi(ids)
      setSelectedIds(new Set())
      await refreshItems()
      if (selectedItem?.data_id != null && ids.includes(selectedItem.data_id)) {
        setDetailOpen(false)
        setSelectedItem(null)
      }
      if (res.errors.length > 0) {
        alert(`${res.deleted}건 삭제됨. 일부 실패:\n${res.errors.join('\n')}`)
      }
    } catch (error) {
      console.error('항목 삭제 중 오류가 발생했습니다:', error)
      alert('항목 삭제에 실패했습니다.')
    }
  }

  return (
    <Box
      sx={{
        flexGrow: 1,
        overflow: 'auto',
        p: { xs: 2, sm: 2, md: 3 },
      }}
    >
      <TopBar />
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2, md: 4 },
          borderRadius: 3,
          backgroundColor: 'background.paper',
          minHeight: '100%',
        }}
      >
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
          아이템 관리
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          psj_app_data (app_id={ITEMS_APP_ID}) 항목 목록입니다.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <TextField
            select
            size="small"
            label="분류"
            value={cateFilter}
            onChange={(e) => setCateFilter(e.target.value)}
            InputLabelProps={{ shrink: true }}
            SelectProps={{
              displayEmpty: true,
              MenuProps: { disablePortal: true },
            }}
            sx={{
              minWidth: { xs: '100%', sm: 160 },
              flex: { xs: '1 1 100%', sm: '0 1 auto' },
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'grey.50',
                borderRadius: 1,
              },
            }}
          >
            <MenuItem value="">전체</MenuItem>
            {itemCodeOptions.map((opt) => (
              <MenuItem key={opt.code_id} value={opt.code_cd}>
                {opt.code_nm ?? opt.code_cd}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            placeholder="키워드 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                </InputAdornment>
              ),
              sx: { backgroundColor: 'grey.50', borderRadius: 1 },
            }}
            sx={{ minWidth: { xs: '100%', sm: 280 }, flex: { xs: '1 1 100%', sm: '1 1 auto' } }}
          />
          {hasActiveFilters ? (
            <>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                onClick={() => {
                  setKeyword('')
                  setCateFilter('')
                }}
              >
                초기화
              </Button>
              <Typography variant="body2" color="text.secondary">
                {filteredItems.length}건
              </Typography>
            </>
          ) : null}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3, flexWrap: 'wrap' }}>
          <Button size="small" variant="contained" color="primary" onClick={handleOpenCreate}>
            등록하기
          </Button>
          <Button size="small" variant="outlined" color="primary" onClick={handleToggleSelectMode}>
            {selectMode ? '선택 취소' : '선택하기'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="primary"
            onClick={handleToggleSelectAll}
            disabled={!items.length}
          >
            {selectMode && selectedIds.size === filteredItems.length && filteredItems.length > 0 ? '전체해제' : '전체선택'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            disabled={!selectedIds.size}
            onClick={handleDeleteSelected}
          >
            선택 삭제
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'stretch',
              borderRadius: 999,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Button
              size="small"
              onClick={() => setViewMode('list')}
              sx={{
                minWidth: 56,
                px: 1,
                py: 0.5,
                borderRadius: 0,
                bgcolor: viewMode === 'list' ? 'primary.light' : 'background.paper',
                color: viewMode === 'list' ? 'primary.main' : 'text.secondary',
                '&:hover': {
                  bgcolor: viewMode === 'list' ? 'primary.light' : 'action.hover',
                },
              }}
            >
              <CheckIcon
                sx={{
                  fontSize: 14,
                  mr: 0.5,
                  color: viewMode === 'list' ? 'common.white' : 'inherit',
                }}
              />
              <MenuIcon
                sx={{
                  fontSize: 16,
                  color: viewMode === 'list' ? 'common.white' : 'inherit',
                }}
              />
            </Button>
            <Button
              size="small"
              onClick={() => setViewMode('grid')}
              sx={{
                minWidth: 56,
                px: 1,
                py: 0.5,
                borderRadius: 0,
                bgcolor: viewMode === 'grid' ? 'primary.light' : 'background.paper',
                color: viewMode === 'grid' ? 'primary.main' : 'text.secondary',
                borderLeft: '1px solid',
                borderColor: 'divider',
                '&:hover': {
                  bgcolor: viewMode === 'grid' ? 'primary.light' : 'action.hover',
                },
              }}
            >
              <AppsIcon
                sx={{
                  fontSize: 14,
                  color: viewMode === 'grid' ? 'common.white' : 'inherit',
                }}
              />
            </Button>
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">로딩 중...</Typography>
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">데이터 없음</Typography>
          </Box>
        ) : filteredItems.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">검색 결과가 없습니다.</Typography>
          </Box>
        ) : viewMode === 'grid' ? (
          <Grid container spacing={2.5}>
            {filteredItems.map((row, index) => {
              const dataId = getItemId(row)
              const imageUrl = getItemImageUrl(row.ap_content, row.link1)
              return (
                <Grid key={dataId ?? `item-${index}`} item xs={6} sm={6} md={4} lg={2}>
                  <Card
                    sx={{
                      borderRadius: 3,
                      overflow: 'hidden',
                      boxShadow: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 4,
                      },
                    }}
                  >
                    <CardActionArea
                      sx={{ p: 1.5, bgcolor: 'background.paper' }}
                      onClick={() => handleOpenDetail(row)}
                    >
                      <Box
                        sx={{
                          width: '100%',
                          aspectRatio: '1 / 1',
                          borderRadius: 2,
                          overflow: 'hidden',
                          backgroundColor: 'grey.100',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {imageUrl ? (
                          <Box
                            component="img"
                            src={imageUrl}
                            alt={row.ap_subject ?? ''}
                            sx={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        ) : (
                          <Avatar
                            variant="rounded"
                            sx={{
                              width: '100%',
                              height: '100%',
                              borderRadius: 2,
                              bgcolor: 'grey.200',
                              color: 'grey.700',
                              fontSize: 40,
                              fontWeight: 700,
                            }}
                          >
                            {row.ap_subject?.charAt(0)?.toUpperCase() ?? '?'}
                          </Avatar>
                        )}
                      </Box>
                    </CardActionArea>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        mt: 0.5,
                        px: 1.5,
                        pb: 1.5,
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        {selectMode && dataId != null && (
                          <Checkbox
                            size="small"
                            checked={selectedIds.has(dataId)}
                            onChange={() => handleSelectOne(dataId)}
                          />
                        )}
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          {getValidCate1Code(row.cate1, itemCodeOptions) ? (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              noWrap
                              sx={{ display: 'block', lineHeight: 1.3 }}
                            >
                              [{getCodeLabel(row.cate1, itemCodeOptions)}]
                            </Typography>
                          ) : null}
                          <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                            {getDisplayName(row.ap_subject || '-')}
                          </Typography>
                        </Box>
                      </Box>
                      <IconButton
                        size="small"
                        component="div"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMenuOpen(e.currentTarget as HTMLElement, row)
                        }}
                      >
                        <span style={{ fontSize: 18 }}>⋯</span>
                      </IconButton>
                    </Box>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        ) : (
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f7fb' }}>
                  <TableCell align="center" sx={{ fontWeight: 600, width: 60 }}>
                    NO
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 100 }}>미리보기</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>분류명(cate1)</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>아이템명(ap_subject)</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 120 }}>저장위치(extra_1)</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>수량(hit)</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>설명</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 160 }} align="center">
                    등록일
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 72 }} align="center">
                    메뉴
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredItems.map((row, index) => {
                  const imageUrl = getItemImageUrl(row.ap_content, row.link1)
                  return (
                    <TableRow key={getItemId(row) ?? `item-${index}`} hover>
                      <TableCell align="center">{index + 1}</TableCell>
                      <TableCell>
                        {imageUrl ? (
                          <Box
                            component="img"
                            src={imageUrl}
                            alt={row.ap_subject ?? ''}
                            sx={{
                              width: 50,
                              height: 50,
                              borderRadius: 1,
                              cursor: 'pointer',
                              objectFit: 'cover',
                            }}
                            onClick={() => handleOpenDetail(row)}
                          />
                        ) : (
                         
                          <Avatar
                            variant="rounded"
                            sx={{
                              width: 50,
                              height: 50,
                              borderRadius: 1,
                              cursor: 'pointer',
                              bgcolor: 'grey.200',
                              color: 'grey.700',
                              fontWeight: 700,
                            }}
                            onClick={() => handleOpenDetail(row)}
                          >
                            {row.ap_subject?.charAt(0)?.toUpperCase() ?? '?'}
                          </Avatar>
                        )}
                      </TableCell>
                      <TableCell
                        onClick={() => handleOpenDetail(row)}
                        sx={{ cursor: 'pointer' }}
                      >
                        {getCodeLabel(row.cate1, itemCodeOptions)}
                      </TableCell>
                      <TableCell
                        onClick={() => handleOpenDetail(row)}
                        sx={{ cursor: 'pointer', color: 'primary.main', fontWeight: 600 }}
                      >
                        {row.ap_subject || '-'}
                      </TableCell>
                      <TableCell>{row.extra_1 || '-'}</TableCell>
                      <TableCell align="center">{row.hit ?? 0}</TableCell>
                      <TableCell>{getContentPreview(row.ap_content)}</TableCell>
                      <TableCell align="center">{formatDate(row.regist_dt)}</TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e.currentTarget, row)}
                        >
                          <span style={{ fontSize: 18 }}>⋯</span>
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Paper>
        )}

        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleMenuClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem
            onClick={() => {
              if (menuItem) void handleOpenDetail(menuItem)
              handleMenuClose()
            }}
          >
            상세 보기
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (menuItem) void handleDeleteOne(menuItem)
            }}
          >
            삭제
          </MenuItem>
        </Menu>

        <Dialog
          open={detailOpen}
          onClose={(_, reason) => {
            if (reason === 'backdropClick' || reason === 'escapeKeyDown') return
            handleCloseDetail()
          }}
          disableEscapeKeyDown
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: (theme) => ({
              [theme.breakpoints.down('sm')]: {
                mx: 0.75,
                my: 1,
                width: 'calc(100% - 12px)',
                maxWidth: 'calc(100% - 12px)',
              },
            }),
          }}
        >
          <DialogTitle sx={{ fontWeight: 600 }}>
            {dialogMode === 'create' ? '항목 등록' : dialogMode === 'edit' ? '항목 수정' : '항목 상세'}
          </DialogTitle>
          <DialogContent dividers sx={{ pt: 3 }}>
            {selectedItem && (
              dialogMode === 'detail'
                ? <ItemDetailView item={selectedItem} itemCodeOptions={itemCodeOptions} />
                : (
                  <ItemFormFields
                    item={selectedItem}
                    itemCodeOptions={itemCodeOptions}
                    errors={formErrors}
                    onChange={(updater) => {
                      setFormErrors({})
                      setSelectedItem((prev) => (prev ? updater(prev) : prev))
                    }}
                    onPendingAttachmentChange={setPendingAttachment}
                  />
                )
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%', gap: 1.5 }}>
              {dialogMode === 'detail' ? (
                <>
                  <Button
                    onClick={handleCloseDetail}
                    color="inherit"
                    sx={{
                      backgroundColor: 'grey.100',
                      '&:hover': { backgroundColor: 'grey.200' },
                    }}
                  >
                    닫기
                  </Button>
                  <Button onClick={handleStartEdit} variant="contained" color="primary">
                    수정
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={dialogMode === 'create' ? handleCloseDetail : handleCancelEdit}
                    color="inherit"
                    sx={{
                      backgroundColor: 'grey.100',
                      '&:hover': { backgroundColor: 'grey.200' },
                    }}
                  >
                    {dialogMode === 'create' ? '취소' : '취소'}
                  </Button>
                  <Button onClick={handleSaveDetail} variant="contained" color="primary">
                    저장
                  </Button>
                </>
              )}
            </Box>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  )
}
