import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardActionArea,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  CircularProgress,
  Stack,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Select,
  TextField,
  FormControl,
  InputLabel,
  LinearProgress,
} from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import MenuIcon from '@mui/icons-material/Menu'
import AppsIcon from '@mui/icons-material/Apps'
import CloseIcon from '@mui/icons-material/Close'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { uploadImageApiWithProgress } from '../../../apis/imageApi'
import {
  createSptResourceApi,
  deleteSptResourcesApi,
  fetchSptResourcesApi,
  updateSptResourceApi,
  type SptResourceRow,
} from '../../../apis/sptResourcesApi'

const CO_TYPE_OPTIONS = [
  { value: 'C01', label: 'Text' },
  { value: 'C02', label: 'Html' },
  { value: 'C03', label: 'Image' },
] as const

type CoTypeFilter = '전체' | 'C01' | 'C02' | 'C03'

type ResourceForm = {
  subject: string
  content: string
  coType: string
  imgUrl: string
  weight: string
  heigth: string
  linkUrl: string
  useYn: string
}

const SPT_RESOURCE_MENU_CD = 'spt_resource'
const SPT_RESOURCE_SAVE_PATH = 'spt/resources'
const DEFAULT_ASSET_HOST = 'http://impsj.net'

function resolveAssetHost(): string {
  const env = import.meta.env as Record<string, string | undefined>
  const fromAssetBase = env.VITE_ASSET_BASE_URL?.trim()
  if (fromAssetBase) return fromAssetBase.replace(/\/+$/, '')

  const fromApiBase = env.VITE_API_BASE_URL?.trim() || env.VITE_API_BASE?.trim()
  if (fromApiBase) return fromApiBase.replace(/\/+$/, '')

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '')
  }

  return DEFAULT_ASSET_HOST
}

/** DB 등록용 — dev origin 대신 실제 파일 서비스 도메인 우선 */
function resolveImageStorageHost(): string {
  const env = import.meta.env as Record<string, string | undefined>
  const fromAssetBase = env.VITE_ASSET_BASE_URL?.trim()
  if (fromAssetBase) return fromAssetBase.replace(/\/+$/, '')

  const fromApiBase = env.VITE_API_BASE_URL?.trim() || env.VITE_API_BASE?.trim()
  if (fromApiBase) return fromApiBase.replace(/\/+$/, '')

  return DEFAULT_ASSET_HOST
}

function toAbsoluteUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  const host = resolveAssetHost()
  return `${host}${url.startsWith('/') ? url : `/${url}`}`
}

function toStorageImgUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  const host = resolveImageStorageHost()
  return `${host}${url.startsWith('/') ? url : `/${url}`}`
}

const EMPTY_FORM: ResourceForm = {
  subject: '',
  content: '',
  coType: 'C01',
  imgUrl: '',
  weight: '100',
  heigth: '100',
  linkUrl: '',
  useYn: '1',
}

function coTypeLabel(coType: string | null | undefined): string {
  const found = CO_TYPE_OPTIONS.find((o) => o.value === coType)
  return found?.label ?? coType ?? '-'
}

function rowToForm(row: SptResourceRow): ResourceForm {
  return {
    subject: row.subject ?? '',
    content: row.content ?? '',
    coType: row.coType?.trim() || 'C01',
    imgUrl: toStorageImgUrl(row.imgUrl ?? ''),
    weight: String(row.weight ?? 100),
    heigth: String(row.heigth ?? 100),
    linkUrl: row.linkUrl ?? '',
    useYn: String(row.useYn ?? 1),
  }
}

function formatDatetime(value: string | null | undefined): string {
  if (!value) return ''
  return value.slice(0, 19).replace('T', ' ')
}

export default function SptResourcePage() {
  const [rows, setRows] = useState<SptResourceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')
  const [typeFilter, setTypeFilter] = useState<CoTypeFilter>('전체')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [menuCrId, setMenuCrId] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ResourceForm>(EMPTY_FORM)
  const [previewRow, setPreviewRow] = useState<SptResourceRow | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [imageUploadProgress, setImageUploadProgress] = useState(0)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const items = await fetchSptResourcesApi({
        co_type: typeFilter === '전체' ? undefined : typeFilter,
      })
      setRows(items)
      setSelectedIds([])
    } catch (e) {
      console.error('리소스 목록 로드 실패:', e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [typeFilter])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const menuOpen = Boolean(menuAnchorEl)

  const toggleSelected = (crId: number) => {
    setSelectedIds((prev) =>
      prev.includes(crId) ? prev.filter((id) => id !== crId) : [...prev, crId],
    )
  }

  const clearLocalPreview = useCallback(() => {
    setLocalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }, [])

  const openCreateDialog = () => {
    clearLocalPreview()
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEditDialog = (row: SptResourceRow) => {
    clearLocalPreview()
    setEditingId(row.crId)
    setForm(rowToForm(row))
    setDialogOpen(true)
  }

  const closeDialog = () => {
    clearLocalPreview()
    setDialogOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setImageUploading(false)
    setImageUploadProgress(0)
  }

  const uploadResourceImage = async (file: File) => {
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!imageTypes.includes(file.type)) {
      window.alert('JPEG, PNG, GIF, WEBP 이미지만 업로드할 수 있습니다.')
      return
    }

    const preview = URL.createObjectURL(file)
    setLocalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return preview
    })

    try {
      setImageUploading(true)
      setImageUploadProgress(0)
      const res = await uploadImageApiWithProgress(
        {
          file,
          menuCd: SPT_RESOURCE_MENU_CD,
          dataId: editingId ?? -999,
          fileNo: 1,
          fileType: 0,
          description: form.subject.trim() || file.name,
          save_path: SPT_RESOURCE_SAVE_PATH,
        },
        (loaded, total) => {
          if (total > 0) setImageUploadProgress(Math.round((loaded / total) * 100))
        },
      )
      setForm((prev) => ({
        ...prev,
        coType: 'C03',
        imgUrl: toStorageImgUrl(res.file_url),
        weight: res.width > 0 ? String(res.width) : prev.weight,
        heigth: res.height > 0 ? String(res.height) : prev.heigth,
      }))
      clearLocalPreview()
    } catch (e) {
      console.error('이미지 업로드 실패:', e)
      window.alert('이미지 업로드 중 오류가 발생했습니다.')
    } finally {
      setImageUploading(false)
      setImageUploadProgress(0)
    }
  }

  const handleImageFileChange = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    void uploadResourceImage(file)
  }

  const clearUploadedImage = () => {
    clearLocalPreview()
    setForm((prev) => ({ ...prev, imgUrl: '' }))
  }

  const handleSave = async () => {
    const subject = form.subject.trim()
    const imgUrl = toStorageImgUrl(form.imgUrl)
    if (!subject) {
      window.alert('제목을 입력해 주세요.')
      return
    }
    if (form.coType === 'C03' && !imgUrl) {
      window.alert('이미지 타입은 이미지를 업로드해 주세요.')
      return
    }
    if (imageUploading) {
      window.alert('이미지 업로드가 완료된 후 저장해 주세요.')
      return
    }
    const payload = {
      subject,
      content: form.content.trim() || null,
      co_type: form.coType.trim() || 'C01',
      img_url: imgUrl || null,
      weight: Number(form.weight) || 0,
      heigth: Number(form.heigth) || 0,
      link_url: form.linkUrl.trim() || null,
      use_yn: Number(form.useYn) === 0 ? 0 : 1,
    }

    try {
      setSaving(true)
      if (editingId != null) {
        await updateSptResourceApi(editingId, payload)
      } else {
        await createSptResourceApi(payload)
      }
      closeDialog()
      await loadRows()
    } catch (e) {
      console.error('리소스 저장 실패:', e)
      window.alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteIds = async (crIds: number[]) => {
    if (!crIds.length) return
    const confirmed = window.confirm(`선택한 ${crIds.length}개의 리소스를 삭제하시겠습니까?`)
    if (!confirmed) return
    try {
      setIsDeleting(true)
      await deleteSptResourcesApi(crIds)
      setSelectedIds([])
      setSelectMode(false)
      setPreviewRow(null)
      await loadRows()
    } catch (e) {
      console.error('리소스 삭제 실패:', e)
      window.alert('삭제 중 오류가 발생했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  const allSelected = rows.length > 0 && selectedIds.length === rows.length

  const previewImageUrl = useMemo(() => {
    if (!previewRow?.imgUrl) return ''
    return toAbsoluteUrl(previewRow.imgUrl)
  }, [previewRow])

  const formImagePreviewUrl = useMemo(() => {
    if (localPreviewUrl) return localPreviewUrl
    if (form.imgUrl.trim()) return toAbsoluteUrl(form.imgUrl)
    return ''
  }, [form.imgUrl, localPreviewUrl])

  return (
    <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 3 }}>
      {(loading || isDeleting) && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            bgcolor: 'rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
        >
          <CircularProgress size={64} />
        </Box>
      )}

      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, backgroundColor: 'background.paper', minHeight: '100%' }}>
          <Typography variant="h5" sx={{ mb: 1.5, fontWeight: 600 }}>
            리소스관리
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            SPT 콘텐츠 리소스(텍스트·HTML·이미지)를 등록하고 관리합니다.
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
            <Button size="small" variant="contained" color="primary" onClick={openCreateDialog}>
              등록하기
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              onClick={() => {
                setSelectMode((prev) => !prev)
                setSelectedIds([])
              }}
            >
              {selectMode ? '선택 취소' : '선택하기'}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              disabled={!rows.length}
              onClick={() => {
                if (!selectMode) setSelectMode(true)
                setSelectedIds(allSelected ? [] : rows.map((r) => r.crId))
              }}
            >
              {allSelected ? '전체해제' : '전체선택'}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              disabled={!selectedIds.length}
              onClick={() => void handleDeleteIds(selectedIds)}
            >
              선택 삭제
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="spt-resource-type-filter">타입</InputLabel>
              <Select
                labelId="spt-resource-type-filter"
                label="타입"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as CoTypeFilter)}
              >
                <MenuItem value="전체">전체</MenuItem>
                {CO_TYPE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
                }}
              >
                <CheckIcon sx={{ fontSize: 14, mr: 0.5, color: viewMode === 'list' ? 'common.white' : 'inherit' }} />
                <MenuIcon sx={{ fontSize: 16, color: viewMode === 'list' ? 'common.white' : 'inherit' }} />
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
                }}
              >
                <AppsIcon sx={{ fontSize: 14, color: viewMode === 'grid' ? 'common.white' : 'inherit' }} />
              </Button>
            </Box>
          </Box>

          {!loading && rows.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography color="text.secondary">데이터 없음</Typography>
            </Box>
          ) : viewMode === 'grid' ? (
            <Grid container spacing={2.5}>
              {rows.map((row) => (
                <Grid key={row.crId} item xs={12} sm={6} md={4} lg={3}>
                  <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                    <CardActionArea onClick={() => setPreviewRow(row)}>
                      <Box
                        sx={{
                          width: '100%',
                          aspectRatio: '4 / 3',
                          bgcolor: 'grey.100',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          p: 1,
                        }}
                      >
                        {row.coType === 'C03' && row.imgUrl ? (
                          <Box
                            component="img"
                            src={toAbsoluteUrl(row.imgUrl)}
                            alt={row.subject}
                            sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ px: 1, textAlign: 'center' }}>
                            {row.coType === 'C02'
                              ? (row.content || '').replace(/<[^>]+>/g, ' ').slice(0, 80)
                              : (row.content || row.subject || '').slice(0, 80)}
                          </Typography>
                        )}
                      </Box>
                    </CardActionArea>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, flex: 1 }}>
                        {selectMode && (
                          <Checkbox
                            size="small"
                            checked={selectedIds.includes(row.crId)}
                            onChange={() => toggleSelected(row.crId)}
                          />
                        )}
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {row.subject}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {coTypeLabel(row.coType)} · {row.weight}×{row.heigth}
                          </Typography>
                        </Box>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          setMenuAnchorEl(e.currentTarget)
                          setMenuCrId(row.crId)
                        }}
                      >
                        <span style={{ fontSize: 18 }}>⋯</span>
                      </IconButton>
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f7fb' }}>
                  {selectMode && <TableCell padding="checkbox" />}
                  <TableCell align="center" sx={{ fontWeight: 600, width: 60 }}>NO</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 90 }}>타입</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>제목</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 100 }}>크기</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>링크</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 160 }} align="center">등록일</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 56 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={row.crId} hover>
                    {selectMode && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={selectedIds.includes(row.crId)}
                          onChange={() => toggleSelected(row.crId)}
                        />
                      </TableCell>
                    )}
                    <TableCell align="center">{index + 1}</TableCell>
                    <TableCell>{coTypeLabel(row.coType)}</TableCell>
                    <TableCell>
                      <Button size="small" variant="text" onClick={() => openEditDialog(row)}>
                        {row.subject}
                      </Button>
                    </TableCell>
                    <TableCell>{row.weight}×{row.heigth}</TableCell>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.linkUrl || '-'}
                    </TableCell>
                    <TableCell align="center">{formatDatetime(row.inDatetime)}</TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          setMenuAnchorEl(e.currentTarget)
                          setMenuCrId(row.crId)
                        }}
                      >
                        <span style={{ fontSize: 18 }}>⋯</span>
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Menu anchorEl={menuAnchorEl} open={menuOpen} onClose={() => setMenuAnchorEl(null)}>
            <MenuItem
              onClick={() => {
                const row = rows.find((r) => r.crId === menuCrId)
                setMenuAnchorEl(null)
                if (row) openEditDialog(row)
              }}
            >
              수정
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuAnchorEl(null)
                if (menuCrId != null) void handleDeleteIds([menuCrId])
              }}
            >
              삭제
            </MenuItem>
          </Menu>

          <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 600 }}>
              {editingId != null ? '리소스 수정' : '리소스 등록'}
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <TextField
                  label="제목 (subject)"
                  size="small"
                  fullWidth
                  required
                  value={form.subject}
                  onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                  inputProps={{ maxLength: 100 }}
                />
                <FormControl size="small" fullWidth>
                  <InputLabel id="resource-co-type">타입 (co_type)</InputLabel>
                  <Select
                    labelId="resource-co-type"
                    label="타입 (co_type)"
                    value={form.coType}
                    onChange={(e) => setForm((prev) => ({ ...prev, coType: e.target.value }))}
                  >
                    {CO_TYPE_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    첨부 이미지 (img_url)
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    이미지를 업로드하면 타입이 Image(C03)로 설정되고 경로가 img_url에 저장됩니다.
                  </Typography>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      handleImageFileChange(e.target.files)
                      e.target.value = ''
                    }}
                  />
                  <Box
                    sx={{
                      border: '2px dashed',
                      borderColor: form.coType === 'C03' && !form.imgUrl ? 'warning.main' : 'divider',
                      borderRadius: 2,
                      bgcolor: 'grey.50',
                      p: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 1.5,
                      cursor: imageUploading ? 'default' : 'pointer',
                    }}
                    onClick={() => {
                      if (!imageUploading) imageInputRef.current?.click()
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (imageUploading) return
                      handleImageFileChange(e.dataTransfer.files)
                    }}
                  >
                    {formImagePreviewUrl ? (
                      <Box
                        component="img"
                        src={formImagePreviewUrl}
                        alt="미리보기"
                        sx={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }}
                      />
                    ) : (
                      <Stack alignItems="center" spacing={0.5}>
                        <AttachFileIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary" align="center">
                          클릭하거나 이미지를 드래그하여 첨부하세요.
                        </Typography>
                      </Stack>
                    )}
                    <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AttachFileIcon />}
                        disabled={imageUploading}
                        onClick={() => imageInputRef.current?.click()}
                      >
                        이미지 첨부
                      </Button>
                      {(form.imgUrl || localPreviewUrl) && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteOutlineIcon />}
                          disabled={imageUploading}
                          onClick={clearUploadedImage}
                        >
                          제거
                        </Button>
                      )}
                    </Stack>
                    {imageUploading && (
                      <Box sx={{ width: '100%' }}>
                        <LinearProgress
                          variant={imageUploadProgress > 0 ? 'determinate' : 'indeterminate'}
                          value={imageUploadProgress}
                        />
                      </Box>
                    )}
                  </Box>
                  <TextField
                    label="저장 경로 (img_url)"
                    size="small"
                    fullWidth
                    sx={{ mt: 1.5 }}
                    value={form.imgUrl}
                    InputProps={{ readOnly: true }}
                    placeholder="이미지 첨부 시 자동 입력"
                    helperText={
                      form.coType === 'C03' && !form.imgUrl
                        ? 'Image 타입은 이미지 첨부가 필요합니다.'
                        : '업로드된 이미지 경로가 자동으로 저장됩니다.'
                    }
                  />
                </Box>

                <TextField
                  label="내용 (content)"
                  size="small"
                  fullWidth
                  multiline
                  minRows={4}
                  value={form.content}
                  onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                />
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="가로 (weight)"
                    size="small"
                    type="number"
                    fullWidth
                    value={form.weight}
                    onChange={(e) => setForm((prev) => ({ ...prev, weight: e.target.value }))}
                  />
                  <TextField
                    label="세로 (heigth)"
                    size="small"
                    type="number"
                    fullWidth
                    value={form.heigth}
                    onChange={(e) => setForm((prev) => ({ ...prev, heigth: e.target.value }))}
                  />
                </Stack>
                <TextField
                  label="링크 URL (link_url)"
                  size="small"
                  fullWidth
                  value={form.linkUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, linkUrl: e.target.value }))}
                />
                <FormControl size="small" fullWidth>
                  <InputLabel id="resource-use-yn">사용 (use_yn)</InputLabel>
                  <Select
                    labelId="resource-use-yn"
                    label="사용 (use_yn)"
                    value={form.useYn}
                    onChange={(e) => setForm((prev) => ({ ...prev, useYn: e.target.value }))}
                  >
                    <MenuItem value="1">사용</MenuItem>
                    <MenuItem value="0">미사용</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
              <Button onClick={closeDialog} color="inherit" disabled={saving}>
                취소
              </Button>
              <Button onClick={() => void handleSave()} variant="contained" disabled={saving || imageUploading}>
                저장
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog open={previewRow != null} onClose={() => setPreviewRow(null)} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{previewRow?.subject}</span>
              <IconButton onClick={() => setPreviewRow(null)} size="small">
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              {previewRow && (
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    {coTypeLabel(previewRow.coType)} · {previewRow.weight}×{previewRow.heigth}
                  </Typography>
                  {previewRow.coType === 'C03' && previewImageUrl ? (
                    <Box
                      component="img"
                      src={previewImageUrl}
                      alt={previewRow.subject}
                      sx={{ maxWidth: '100%', maxHeight: 400, objectFit: 'contain', alignSelf: 'center' }}
                    />
                  ) : previewRow.coType === 'C02' ? (
                    <Box dangerouslySetInnerHTML={{ __html: previewRow.content || '' }} />
                  ) : (
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>{previewRow.content || '-'}</Typography>
                  )}
                  {previewRow.linkUrl && (
                    <Typography variant="body2">
                      링크:{' '}
                      <a href={previewRow.linkUrl} target="_blank" rel="noreferrer">
                        {previewRow.linkUrl}
                      </a>
                    </Typography>
                  )}
                </Stack>
              )}
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  if (previewRow) openEditDialog(previewRow)
                  setPreviewRow(null)
                }}
              >
                수정
              </Button>
            </DialogActions>
          </Dialog>
        </Paper>
      </Box>
    </Box>
  )
}
