import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Divider,
  Dialog,
  IconButton,
  Link,
  List,
  ListItemButton,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import TopBar from '../../../components/TopBar'
import {
  fetchAppDataByIdApi,
  fetchAppDataListApi,
  deleteAppDataApi,
  type ApiAppData,
} from '../../../apis/appApi'
import { fetchFilesByDataApi, type ApiFile } from '../../../apis/fileApi'
import {
  INFO_BOARD_LAYOUT_SX,
  INFO_BOARD_MAIN_SX,
  INFO_BOARD_PAGE_SX,
  INFO_BOARD_PAPER_SX,
} from '../basic/InfoBoardCategorySidebar'

const APP_ID = 10
const BASE_PATH = '/apps/ideablock'
const MENU_CD = 'ideablock'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}kb`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function getDownloadUrl(fileId: number): string {
  return `http://impsj.net/api/v1/files/${fileId}/download`
}

/** ap_content HTML 내 이미지 src에 도메인 추가 */
function processContentHtml(html: string): string {
  if (!html) return ''
  return html.replace(
    /<img([^>]*)\ssrc=["']([^"']+)["']/gi,
    (match, attrs: string, src: string) => {
      if (src.startsWith('http')) return match
      const path = src.startsWith('/') ? src : `/${src}`
      return `<img${attrs} src="http://impsj.net${path}"`
    },
  )
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

function isRootPost(row: ApiAppData): boolean {
  const rc = row.reply_cd
  if (rc == null) return true
  const s = String(rc).trim()
  return s === '' || s === '0'
}

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

function isBlockOf(row: ApiAppData, parent: ApiAppData): boolean {
  if (isRootPost(row)) return false
  if (parent.data_id != null && row.parent_id === parent.data_id) return true
  if (parent.gr_num != null && row.gr_num === parent.gr_num && row.data_id !== parent.data_id) {
    return true
  }
  return false
}

function sortBlocks(rows: ApiAppData[]): ApiAppData[] {
  return [...rows].sort((a, b) => {
    const an = typeof a.nogood === 'number' ? a.nogood : Number(a.nogood ?? 999999)
    const bn = typeof b.nogood === 'number' ? b.nogood : Number(b.nogood ?? 999999)
    const aOrder = Number.isNaN(an) ? 999999 : an
    const bOrder = Number.isNaN(bn) ? 999999 : bn
    if (aOrder !== bOrder) return aOrder - bOrder
    return (a.data_id ?? 0) - (b.data_id ?? 0)
  })
}

/** 아이디어블록 목록 페이지와 동일한 '컨텐츠 목록' + 선택 컨텐츠의 하위 아이템(블록) 사이드바 */
export function ContentListSidebar({
  selectedContentId,
  currentDataId,
}: {
  selectedContentId: number | null
  currentDataId: number | null
}) {
  const navigate = useNavigate()
  const [allItems, setAllItems] = useState<ApiAppData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const data = await fetchAppDataListApi({ skip: 0, limit: 2000, app_id: APP_ID })
        if (!cancelled) setAllItems(data ?? [])
      } catch (e) {
        console.error(e)
        if (!cancelled) setAllItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const contents = allItems.filter(isRootPost)

  return (
    <Paper
      variant="outlined"
      sx={{
        width: { xs: '100%', md: 260 },
        flexShrink: 0,
        borderRadius: 2,
        overflow: 'hidden',
        maxHeight: { md: '70vh' },
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ px: 1.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
          컨텐츠 목록
        </Typography>
      </Box>
      <List dense disablePadding sx={{ py: 0.5, overflow: 'auto', flex: 1 }}>
        {loading ? (
          <Box sx={{ px: 2, py: 2 }}>
            <Typography variant="body2" color="text.secondary">
              로딩 중...
            </Typography>
          </Box>
        ) : contents.length === 0 ? (
          <Box sx={{ px: 2, py: 2 }}>
            <Typography variant="body2" color="text.secondary">
              등록된 컨텐츠가 없습니다.
            </Typography>
          </Box>
        ) : (
          contents.map((content) => {
            const isSelectedContent = selectedContentId === content.data_id
            const blocks = isSelectedContent
              ? sortBlocks(allItems.filter((row) => isBlockOf(row, content)))
              : []
            return (
              <Box key={content.data_id ?? content.ap_subject}>
                <ListItemButton
                  selected={isSelectedContent}
                  onClick={() =>
                    content.data_id != null && navigate(`${BASE_PATH}?content=${content.data_id}`)
                  }
                  sx={{
                    mx: 0.5,
                    borderRadius: 1,
                    py: 0.75,
                    '&.Mui-selected': { bgcolor: 'action.selected' },
                  }}
                >
                  <Box sx={{ width: '100%', minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{
                        fontWeight: isSelectedContent ? 700 : 500,
                        color: isSelectedContent ? 'primary.main' : 'inherit',
                      }}
                    >
                      {content.ap_subject?.trim() || '(제목 없음)'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      #{content.data_id} · {formatDate(content.regist_dt)}
                    </Typography>
                  </Box>
                </ListItemButton>
                {isSelectedContent && blocks.length > 0 && (
                  <List
                    dense
                    disablePadding
                    sx={{
                      ml: 1.5,
                      pl: 1,
                      borderLeft: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    {blocks.map((block) => (
                      <ListItemButton
                        key={block.data_id ?? block.ap_subject}
                        selected={currentDataId === block.data_id}
                        onClick={() =>
                          block.data_id != null && navigate(`${BASE_PATH}/${block.data_id}`)
                        }
                        sx={{
                          mr: 0.5,
                          borderRadius: 1,
                          py: 0.5,
                          '&.Mui-selected': { bgcolor: 'action.selected' },
                        }}
                      >
                        <Box
                          sx={{
                            width: '100%',
                            minWidth: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.75,
                          }}
                        >
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{
                              flex: 1,
                              minWidth: 0,
                              fontWeight: currentDataId === block.data_id ? 700 : 400,
                            }}
                          >
                            {block.ap_subject?.trim() || '(제목 없음)'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                            #{block.data_id}
                          </Typography>
                        </Box>
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </Box>
            )
          })
        )}
      </List>
    </Paper>
  )
}

export default function IdeaBlockViewPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const dataId = id ? parseInt(id, 10) : NaN

  const [data, setData] = useState<ApiAppData | null>(null)
  const [files, setFiles] = useState<ApiFile[]>([])
  const [loading, setLoading] = useState(true)
  const [previewImage, setPreviewImage] = useState<{ src: string; alt?: string }>({ src: '' })
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id || isNaN(dataId)) {
      setData(null)
      setFiles([])
      setLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const [res, fileRes] = await Promise.all([
          fetchAppDataByIdApi(dataId),
          fetchFilesByDataApi({ menuCd: MENU_CD, dataId }),
        ])
        if (!cancelled) {
          setData(res ?? null)
          setFiles(fileRes?.items ?? [])
        }
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          setData(null)
          setFiles([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, dataId])

  if (loading) {
    return (
      <Box sx={INFO_BOARD_PAGE_SX}>
        <TopBar />
        <Paper elevation={0} sx={INFO_BOARD_PAPER_SX}>
          <Box sx={INFO_BOARD_LAYOUT_SX}>
            <ContentListSidebar selectedContentId={null} currentDataId={null} />
            <Typography color="text.secondary">로딩 중...</Typography>
          </Box>
        </Paper>
      </Box>
    )
  }

  if (!data) {
    return (
      <Box sx={INFO_BOARD_PAGE_SX}>
        <TopBar />
        <Paper elevation={0} sx={INFO_BOARD_PAPER_SX}>
          <Box sx={INFO_BOARD_LAYOUT_SX}>
            <ContentListSidebar selectedContentId={null} currentDataId={null} />
            <Box sx={INFO_BOARD_MAIN_SX}>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                데이터를 찾을 수 없습니다.
              </Typography>
              <Button variant="outlined" onClick={() => navigate(BASE_PATH)}>
                목록으로
              </Button>
            </Box>
          </Box>
        </Paper>
      </Box>
    )
  }

  const handleDelete = async () => {
    if (!data?.data_id) return
    setDeleting(true)
    try {
      await deleteAppDataApi(data.data_id)
      setDeleteConfirmOpen(false)
      navigate(BASE_PATH)
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : '삭제에 실패했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  const handleContentImageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null
    const imgEl = target?.closest('img') as HTMLImageElement | null
    if (!imgEl?.src) return
    setPreviewImage({ src: imgEl.src, alt: imgEl.alt })
  }

  return (
    <Box sx={INFO_BOARD_PAGE_SX}>
      <TopBar />
      <Paper elevation={0} sx={INFO_BOARD_PAPER_SX}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          아이디어블록 보기
        </Typography>
        <Box sx={INFO_BOARD_LAYOUT_SX}>
          <ContentListSidebar
            selectedContentId={
              isRootPost(data)
                ? data.data_id ?? null
                : data.parent_id ?? data.gr_num ?? null
            }
            currentDataId={data.data_id ?? null}
          />
          <Box sx={INFO_BOARD_MAIN_SX}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
              {data.ap_subject ?? '(제목 없음)'}
            </Typography>
            {/* <Typography variant="body2" color="text.secondary" sx={{ mb: files.length > 0 ? 1 : 3 }}>
              data_id: {data.data_id ?? '-'} · app_id: {data.app_id ?? '-'}
            </Typography> */}
            {files.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  첨부파일 ({files.length})
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={1.5} useFlexGap>
                  {files.map((f) => (
                    <Link
                      key={f.file_id}
                      href={getDownloadUrl(f.file_id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      underline="hover"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        fontSize: '0.875rem',
                        color: 'primary.main',
                      }}
                    >
                      <InsertDriveFileIcon sx={{ fontSize: 18 }} />
                      {f.file_name}
                      <Typography component="span" variant="caption" color="text.secondary">
                        ({formatFileSize(f.filesize ?? 0)})
                      </Typography>
                    </Link>
                  ))}
                </Stack>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            <Box sx={{ minHeight: 300 }}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                  내용
                </Typography>
                <Box
                  className="content-html"
                  component="div"
                  onClick={handleContentImageClick}
                  dangerouslySetInnerHTML={{ __html: processContentHtml(data.ap_content ?? '') }}
                  sx={{
                    overflow: 'hidden',
                    wordBreak: 'break-word',
                    '& img': {
                      maxWidth: '100%',
                      height: 'auto',
                      objectFit: 'contain',
                      cursor: 'zoom-in',
                    },
                    '& figure': { margin: '0.5em 0', maxWidth: '100%' },
                    '& figure img': { maxWidth: '100%' },
                    '& p': { margin: '0 0 0.75em' },
                    '& .image-style-align-left': { float: 'left', marginRight: 2, marginBottom: 1, maxWidth: '100%' },
                    '& .image-style-align-right': { float: 'right', marginLeft: 2, marginBottom: 1, maxWidth: '100%' },
                    '& .image-style-align-center': { display: 'block', marginLeft: 'auto', marginRight: 'auto', textAlign: 'center', maxWidth: '100%' },
                    '& .image-style-align-block-left': { display: 'block', marginRight: 'auto', marginLeft: 0, maxWidth: '100%' },
                    '& .image-style-align-block-right': { display: 'block', marginLeft: 'auto', marginRight: 0, maxWidth: '100%' },
                    '& figure::after': { content: '""', display: 'table', clear: 'both' },
                  }}
                />
              </Box>
            </Box>

            {/* <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <FieldRow label="그룹 번호" value={data.gr_num} />
              <FieldRow label="답글 코드" value={data.reply_cd} />
              <FieldRow label="작성자" value={data.user_nm} />
              <FieldRow label="이메일" value={data.user_email} />
            </Stack> */}

            {[data.cate1, data.cate2].some(Boolean) && (
              <FieldRow
                label="카테고리"
                value={[data.cate1, data.cate2].filter(Boolean).join(' / ')}
              />
            )}

            <Divider sx={{ my: 2 }} />

            <Stack direction="row" spacing={1.5} sx={{ mt: 3, justifyContent: 'flex-end' }}>
              <Button size="small" variant="outlined" color="inherit" onClick={() => navigate(BASE_PATH)}>
                목 록
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                삭제
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                onClick={() => navigate(`${BASE_PATH}/${data.data_id}/form?reply=1`)}
              >
                답변
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                onClick={() => navigate(`${BASE_PATH}/${data.data_id}/form`)}
              >
                수 정
              </Button>
            </Stack>
          </Box>
        </Box>
      </Paper>

      <Dialog open={deleteConfirmOpen} onClose={() => !deleting && setDeleteConfirmOpen(false)}>
        <Box sx={{ p: 3, minWidth: 320 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            삭제 확인
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            이 게시물과 첨부 파일을 모두 삭제합니다. 계속하시겠습니까?
          </Typography>
          <Stack direction="row" spacing={1.5} justifyContent="flex-end">
            <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
              취소
            </Button>
            <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
              {deleting ? '삭제 중...' : '삭제'}
            </Button>
          </Stack>
        </Box>
      </Dialog>

      <Dialog
        open={Boolean(previewImage.src)}
        onClose={() => setPreviewImage({ src: '' })}
        maxWidth={false}
      >
        <Box sx={{ position: 'relative', bgcolor: 'background.default', p: 1 }}>
          <IconButton
            onClick={() => setPreviewImage({ src: '' })}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'rgba(0,0,0,0.5)',
              color: '#fff',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' },
            }}
          >
            <CloseIcon />
          </IconButton>
          <Box
            component="img"
            src={previewImage.src}
            alt={previewImage.alt ?? '이미지 미리보기'}
            sx={{
              display: 'block',
              maxWidth: '90vw',
              maxHeight: '90vh',
              width: 'auto',
              height: 'auto',
            }}
          />
        </Box>
      </Dialog>
    </Box>
  )
}
