import { Fragment, useEffect, useRef, useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Card,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Checkbox,
  CircularProgress,
  TextField,
  Stack,
  Grid,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material'
import TopBar from '../../../components/TopBar'

/** OG 메타 기반 링크 썸네일 미리보기 데이터 */
interface OgPreviewData {
  url: string
  title?: string
  description?: string
  image?: string
  loading: boolean
  error?: string
}

/** YouTube URL에서 비디오 ID 추출 */
function getYoutubeVideoId(url: string): string | null {
  try {
    const u = new URL(url.trim())
    if (/youtube\.com|youtu\.be/i.test(u.hostname)) {
      if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0] || null
      return u.searchParams.get('v') || null
    }
  } catch {
    /* ignore */
  }
  return null
}

/** OG 메타 가져오기. YouTube는 직접 썸네일, 그 외 LinkMeta → Microlink 폴백 */
async function fetchOgPreview(url: string): Promise<Pick<OgPreviewData, 'title' | 'description' | 'image'>> {
  const ytId = getYoutubeVideoId(url)
  if (ytId) {
    return {
      title: 'YouTube',
      description: undefined,
      image: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
    }
  }
  // 1) LinkMeta - CORS 지원
  try {
    const res = await fetch(`https://linkmeta.dev/api/v1/extract?url=${encodeURIComponent(url)}`)
    if (res.ok) {
      const json = await res.json()
      if (json.status === 'success' && json.data) {
        const d = json.data
        return {
          title: d.title || undefined,
          description: d.description || undefined,
          image: d.image || d.openGraph?.image || undefined,
        }
      }
    }
  } catch {
    // fallback
  }
  // 2) Microlink via CORS proxy
  const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}`
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`
  const res = await fetch(proxyUrl)
  if (!res.ok) throw new Error('미리보기를 불러올 수 없습니다.')
  const json = await res.json()
  if (json.status !== 'success' || !json.data) throw new Error('미리보기를 불러올 수 없습니다.')
  const d = json.data
  return {
    title: d.title || undefined,
    description: d.description || undefined,
    image: d.image?.url || d.logo?.url || undefined,
  }
}
import { createAppDataApi, fetchAppDataListApi, fetchAppDataByIdApi, updateAppDataApi, deleteAppDataApi, type ApiAppData, type ApiAppPayload } from '../../../apis/appApi'

const FAVORITE_APP_ID = 3

const CATEGORY_OPTIONS = [
  { value: '관공서', label: '관공서' },
  { value: '포털사이트', label: '포털사이트' },
  { value: '기술관련', label: '기술관련' },
]

export default function FavoritePage() {
  const [showDropZone, setShowDropZone] = useState(false)
  const [favorites, setFavorites] = useState<ApiAppData[]>([])
  const [loading, setLoading] = useState(true)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [menuDataId, setMenuDataId] = useState<number | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formMemo, setFormMemo] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingDataId, setEditingDataId] = useState<number | null>(null)
  const [previewCards, setPreviewCards] = useState<Record<string, OgPreviewData>>({})
  const fetchedUrlsRef = useRef(new Set<string>())
  const [filterCategory, setFilterCategory] = useState<string>('')

  const fetchFavorites = async () => {
    try {
      const data = await fetchAppDataListApi({ skip: 0, limit: 100, app_id: FAVORITE_APP_ID })
      setFavorites(data ?? [])
    } catch (error) {
      console.error('즐겨찾기 목록 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSelected = async () => {
    if (!selectedIndexes.length) return
    const confirmed = window.confirm(
      `선택한 ${selectedIndexes.length}개의 항목을 삭제하시겠습니까?`,
    )
    if (!confirmed) return

    try {
      setIsDeleting(true)
      const ids = selectedIndexes
        .map((idx) => favorites[idx]?.data_id)
        .filter((id): id is number => typeof id === 'number')
      if (!ids.length) return
      for (const id of ids) {
        await deleteAppDataApi(id)
      }
      await fetchFavorites()
      setSelectedIndexes([])
      setSelectMode(false)
    } catch (error) {
      console.error('삭제 오류:', error)
      window.alert('삭제 중 오류가 발생했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteSingle = async () => {
    if (!menuDataId) return
    const confirmed = window.confirm('이 항목을 삭제하시겠습니까?')
    if (!confirmed) return

    try {
      setIsDeleting(true)
      await deleteAppDataApi(menuDataId)
      await fetchFavorites()
      setSelectedIndexes([])
      setSelectMode(false)
    } catch (error) {
      console.error('삭제 오류:', error)
      window.alert('삭제 중 오류가 발생했습니다.')
    } finally {
      setIsDeleting(false)
      handleMenuClose()
    }
  }

  const menuOpen = Boolean(menuAnchorEl)

  const handleMenuOpen = (target: HTMLElement, dataId: number) => {
    setMenuAnchorEl(target)
    setMenuDataId(dataId)
  }

  const handleMenuClose = () => {
    setMenuAnchorEl(null)
    setMenuDataId(null)
  }

  const handleEditClick = async () => {
    const dataId = menuDataId
    handleMenuClose()
    if (!dataId) return
    try {
      const data = await fetchAppDataByIdApi(dataId)
      if (!data) {
        window.alert('데이터를 찾을 수 없습니다.')
        return
      }
      setFormTitle(data.ap_subject ?? '')
      setFormUrl(data.link1 ?? '')
      setFormMemo(data.ap_content ?? '')
      setFormCategory(data.cate1 ?? '')
      setEditingDataId(dataId)
    } catch (e) {
      console.error(e)
      window.alert('데이터를 불러오는데 실패했습니다.')
    }
  }

  const toggleSelected = (index: number) => {
    setSelectedIndexes((prev) =>
      prev.includes(index) ? prev.filter((v) => v !== index) : [...prev, index],
    )
  }

  const handleSaveFavorite = async () => {
    if (!formTitle.trim()) {
      alert('제목을 입력해 주세요.')
      return
    }
    setSaving(true)
    try {
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
      const form: ApiAppPayload = {
        app_id: FAVORITE_APP_ID,
        ap_subject: formTitle.trim(),
        ap_content: formMemo.trim(),
        link1: formUrl.trim(),
        cate1: formCategory.trim(),
      }
      const payload = {} as ApiAppPayload
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
      if (editingDataId != null) {
        await updateAppDataApi(editingDataId, payload)
      } else {
        await createAppDataApi(payload)
      }
      setShowDropZone(false)
      setEditingDataId(null)
      setFormTitle('')
      setFormUrl('')
      setFormMemo('')
      setFormCategory('')
      await fetchFavorites()
      window.alert(editingDataId != null ? '수정되었습니다.' : '저장되었습니다.')
    } catch (e) {
      console.error(e)
      const message = e instanceof Error ? e.message : '저장에 실패했습니다.'
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    fetchFavorites()
  }, [])

  // link1이 http:// or https://로 시작하는 경우에만 OG 썸네일 fetch
  useEffect(() => {
    const urls = favorites
      .map((item) => (item.link1 ?? '').trim())
      .filter((u): u is string => !!u && /^https?:\/\//i.test(u))
    const uniqueUrls = [...new Set(urls)]
    const toFetch = uniqueUrls.filter((url) => !fetchedUrlsRef.current.has(url))
    toFetch.forEach((url) => fetchedUrlsRef.current.add(url))
    if (toFetch.length === 0) return
    setPreviewCards((prev) => {
      const next = { ...prev }
      toFetch.forEach((url) => { next[url] = { url, loading: true } })
      return next
    })
    toFetch.forEach((url) => {
      fetchOgPreview(url)
        .then((data) => {
          setPreviewCards((p) => ({ ...p, [url]: { url, ...data, loading: false } }))
        })
        .catch(() => {
          setPreviewCards((p) => ({ ...p, [url]: { url, loading: false, error: '미리보기 실패' } }))
        })
    })
  }, [favorites])
  return (
    <Box
      sx={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        p: 3,
      }}
    >
      <TopBar />
      {isDeleting && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            bgcolor: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
        >
          <CircularProgress size={64} />
        </Box>
      )}

      <Box
        sx={{
          flexGrow: 1,
          overflow: 'auto',
        }}
      >
        <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          backgroundColor: 'background.paper',
          minHeight: '100%',
        }}
      >
        <Typography variant="h5" sx={{ mb: 1.5, fontWeight: 600 }}>
          즐겨찾기
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          제목, 주소, 메모, 구분으로 즐겨찾기를 관리합니다.
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setShowDropZone((prev) => !prev)}
          >
           등록하기
          </Button>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => {
              setSelectMode((prev) => !prev)
              setSelectedIndexes([])
            }}
          >
            {selectMode ? '선택 취소' : '선택하기'}
          </Button>
          <Button
            variant="outlined"
            color="error"
            disabled={!selectedIndexes.length}
            onClick={handleDeleteSelected}
          >
            선택 삭제
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: 'inline-flex', borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
            <Button
              size="small"
              variant={filterCategory === '' ? 'contained' : 'text'}
              color={filterCategory === '' ? 'primary' : 'inherit'}
              onClick={() => setFilterCategory('')}
              sx={{ borderRadius: 0, minWidth: 60 }}
            >
              전체
            </Button>
            {CATEGORY_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                size="small"
                variant={filterCategory === opt.value ? 'contained' : 'text'}
                color={filterCategory === opt.value ? 'primary' : 'inherit'}
                onClick={() => setFilterCategory(opt.value)}
                sx={{ borderRadius: 0, minWidth: 80, borderLeft: '1px solid', borderColor: 'divider' }}
              >
                {opt.label}
              </Button>
            ))}
          </Box>
        </Box>
        {showDropZone && editingDataId == null && (
          <Paper
            variant="outlined"
            sx={{ p: 2.5, mb: 2, borderRadius: 2 }}
          >
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              즐겨찾기 등록
            </Typography>
            <Stack spacing={2}>
              <Box>
                <FormControl size="small" sx={{ width: '50%', backgroundColor: 'grey.50', borderRadius: 1 }}>
                  <InputLabel id="reg-category-label">구분</InputLabel>
                  <Select
                    labelId="reg-category-label"
                    value={formCategory}
                    label="구분"
                    onChange={(e) => setFormCategory(e.target.value)}
                  >
                    <MenuItem value="">
                      <em>선택</em>
                    </MenuItem>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  제목
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="제목을 입력하세요"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  주소
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="URL 주소를 입력하세요"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  메모
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  rows={3}
                  placeholder="메모를 입력하세요"
                  value={formMemo}
                  onChange={(e) => setFormMemo(e.target.value)}
                  InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                />
              </Box>
              <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end', pt: 0.5 }}>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={() => {
                    setShowDropZone(false)
                    setFormTitle('')
                    setFormUrl('')
                    setFormMemo('')
                    setFormCategory('')
                  }}
                  disabled={saving}
                >
                  취소
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSaveFavorite}
                  disabled={saving}
                >
                  {saving ? '저장 중...' : '저장'}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        )}

        {loading ? (
          <Typography color="text.secondary">로딩 중...</Typography>
        ) : (favorites?.length ?? 0) === 0 || favorites.filter((item) => !filterCategory || (item.cate1 ?? '') === filterCategory).length === 0 ? (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary" variant="body1">데이터가 존재 하지 않습니다.</Typography>
          </Paper>
        ) : (
          <Grid container spacing={1.5}>
            {favorites
              .filter((item) => !filterCategory || (item.cate1 ?? '') === filterCategory)
              .map((item) => {
                const index = favorites.indexOf(item)
                return (
              <Fragment key={`${item.data_id}-${index}`}>
                <Grid item xs={12} sm={editingDataId === item.data_id ? 12 : 6}>
                {editingDataId === item.data_id && (
                  <Paper
                    variant="outlined"
                    sx={{ p: 2.5, borderRadius: 2, border: '2px solid', borderColor: 'primary.main' }}
                  >
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                      즐겨찾기 수정
                    </Typography>
                    <Stack spacing={2}>
                      <Box>
                        <FormControl size="small" sx={{ width: '50%', backgroundColor: 'grey.50', borderRadius: 1 }}>
                          <InputLabel id="edit-category-label">구분</InputLabel>
                          <Select
                            labelId="edit-category-label"
                            value={formCategory}
                            label="구분"
                            onChange={(e) => setFormCategory(e.target.value)}
                          >
                            <MenuItem value="">
                              <em>선택</em>
                            </MenuItem>
                            {CATEGORY_OPTIONS.map((opt) => (
                              <MenuItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          제목
                        </Typography>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="제목을 입력하세요"
                          value={formTitle}
                          onChange={(e) => setFormTitle(e.target.value)}
                          InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                        />
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          주소
                        </Typography>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="URL 주소를 입력하세요"
                          value={formUrl}
                          onChange={(e) => setFormUrl(e.target.value)}
                          InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                        />
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          메모
                        </Typography>
                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          rows={3}
                          placeholder="메모를 입력하세요"
                          value={formMemo}
                          onChange={(e) => setFormMemo(e.target.value)}
                          InputProps={{ sx: { backgroundColor: 'grey.50' } }}
                        />
                      </Box>
                      <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end', pt: 0.5 }}>
                        <Button
                          variant="outlined"
                          color="inherit"
                          onClick={() => {
                            setEditingDataId(null)
                            setFormTitle('')
                            setFormUrl('')
                            setFormMemo('')
                            setFormCategory('')
                          }}
                          disabled={saving}
                        >
                          취소
                        </Button>
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={handleSaveFavorite}
                          disabled={saving}
                        >
                          {saving ? '수정 중...' : '수정'}
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                )}
                <Card
                  variant="outlined"
                sx={{
                  borderRadius: 2,
                  overflow: 'hidden',
                  '&:hover': { boxShadow: 1 },
                }}
              >
                <Box
                  sx={{
                    p: 2,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 1,
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {selectMode && (
                      <Checkbox
                        size="small"
                        checked={selectedIndexes.includes(index)}
                        onChange={() => toggleSelected(index)}
                        sx={{ mr: 1, verticalAlign: 'middle' }}
                      />
                    )}

                    {item.link1 && (
                      <Box sx={{ mb: 0.5 }}>
                        <Box
                          component="a"
                          href={(item.link1 ?? '').trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                        >
                          {item.link1}
                        </Box>
                        {(() => {
                          const urlKey = (item.link1 ?? '').trim()
                          const card = previewCards[urlKey]
                          if (!card) return null
                          if (card.loading) {
                            return (
                              <Box sx={{ mt: 1, p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', maxWidth: 560, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
                                <CircularProgress size={24} />
                              </Box>
                            )
                          }
                          if (card.error || (!card.title && !card.image)) return null
                          return (
                            <Paper
                              variant="outlined"
                              component="a"
                              href={urlKey}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                mt: 1,
                                maxWidth: 560,
                                overflow: 'hidden',
                                borderRadius: 2,
                                display: 'flex',
                                flexDirection: 'row',
                                textDecoration: 'none',
                                color: 'inherit',
                                cursor: 'pointer',
                                '&:hover': { boxShadow: 1 },
                              }}
                            >
                              {card.image && (
                                <Box
                                  component="img"
                                  src={card.image}
                                  alt=""
                                  sx={{
                                    width: 120,
                                    minWidth: 120,
                                    height: 120,
                                    objectFit: 'cover',
                                    display: 'block',
                                  }}
                                />
                              )}
                              <Box sx={{ flex: 1, p: 1.5, minWidth: 0 }}>
                                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
                                  {card.title || '(제목 없음)'} 
                                  {item.cate1 && (
                                    <Typography variant="caption" color="text.secondary">
                                      [{item.cate1}]
                                    </Typography>
                                  )}
                                </Typography>
                                {card.description && (
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                      fontSize: 12,
                                    }}
                                  >
                                    {card.description}
                                  </Typography>
                                )}
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                  {(() => {
                                    try { return new URL(card.url).hostname } catch { return card.url }
                                  })()}
                                </Typography>
                              </Box>
                            </Paper>
                          )
                        })()}
                      </Box>
                    )}

                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (item.data_id != null) handleMenuOpen(e.currentTarget as HTMLElement, item.data_id)
                    }}
                  >
                    <span style={{ fontSize: 18 }}>⋯</span>
                  </IconButton>
                </Box>
              </Card>
                </Grid>
              </Fragment>
            )
            })}
          </Grid>
        )}

        <Menu
          anchorEl={menuAnchorEl}
          open={menuOpen}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <MenuItem onClick={handleEditClick}>
            수정
          </MenuItem>
          <MenuItem
            onClick={handleDeleteSingle}
          >
            삭제
          </MenuItem>
        </Menu>

      </Paper>
      </Box>
    </Box>
  )
}

