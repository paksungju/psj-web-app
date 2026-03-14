import { useEffect, useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogContent,
  LinearProgress,
  Checkbox,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  List,
  ListItemButton,
  Collapse,
} from '@mui/material'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import CloseIcon from '@mui/icons-material/Close'
import FolderIcon from '@mui/icons-material/Folder'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import TopBar from '../../components/TopBar'
import { uploadFileApi, fetchFilesByDataApi, deleteFilesApi, ApiFile } from '../../apis/fileApi'

// 폴더 구조 (개인파일 > 프로그래밍/개인정보, 회사파일 > 서식/영업자료/회계자료)
type FolderNode = {
  id: string
  label: string
  children?: FolderNode[]
}

const FOLDER_TREE: FolderNode[] = [
  {
    id: 'personal',
    label: '개인파일',
    children: [
      { id: 'personal-programming', label: '프로그래밍' },
      { id: 'personal-privacy', label: '개인정보' },
    ],
  },
  {
    id: 'company',
    label: '회사파일',
    children: [
      { id: 'company-forms', label: '서식' },
      { id: 'company-sales', label: '영업자료' },
      { id: 'company-accounting', label: '회계자료' },
    ],
  },
]

export default function GalleryPage() {
  const [showDropZone, setShowDropZone] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set(['personal', 'company']))
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [files, setFiles] = useState<ApiFile[]>([])
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [menuFileId, setMenuFileId] = useState<number | null>(null)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([])
  const [isDeleting, setIsDeleting] = useState(false)

  const toggleFolderExpand = (id: string) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDeleteSelected = async () => {
    if (!selectedIndexes.length) return
    const confirmed = window.confirm(
      `선택한 ${selectedIndexes.length}개의 이미지를 삭제하시겠습니까?`,
    )
    if (!confirmed) return

    try {
      setIsDeleting(true)

      const ids = selectedIndexes
        .map((idx) => files[idx]?.file_id)
        .filter((id): id is number => typeof id === 'number')

      if (!ids.length) return

      await deleteFilesApi({ fileIds: ids })

      const data = await fetchFilesByDataApi({
        tbCode: 'gallery',
        dataId: 0,
      })
      setFiles(data)
      setSelectedIndexes([])
      setSelectMode(false)
    } catch (error) {
      console.error('파일 삭제 오류:', error)
      window.alert('파일 삭제 중 오류가 발생했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteSingle = async () => {
    if (!menuFileId) return
    const confirmed = window.confirm(
      `이 이미지를 삭제하시겠습니까? (file_id: ${menuFileId})`,
    )
    if (!confirmed) return

    try {
      setIsDeleting(true)

      await deleteFilesApi({ fileIds: [menuFileId] })

      const data = await fetchFilesByDataApi({
        tbCode: 'gallery',
        dataId: 0,
      })
      setFiles(data)
      setSelectedIndexes([])
      setSelectMode(false)
    } catch (error) {
      console.error('파일 삭제 오류:', error)
      window.alert('파일 삭제 중 오류가 발생했습니다.')
    } finally {
      setIsDeleting(false)
      handleMenuClose()
    }
  }

  const menuOpen = Boolean(menuAnchorEl)

  const handleMenuOpen = (target: HTMLElement, fileId: number) => {
    setMenuAnchorEl(target)
    setMenuFileId(fileId)
  }

  const handleMenuClose = () => {
    setMenuAnchorEl(null)
    setMenuFileId(null)
  }

  const toggleSelected = (index: number) => {
    setSelectedIndexes((prev) =>
      prev.includes(index) ? prev.filter((v) => v !== index) : [...prev, index],
    )
  }

  const currentPreviewFile =
    previewIndex !== null && previewIndex >= 0 && previewIndex < files.length
      ? files[previewIndex]
      : null

  const handlePrevPreview = () => {
    setPreviewIndex((prev) => {
      if (prev === null || prev <= 0) return prev
      return prev - 1
    })
  }

  const handleNextPreview = () => {
    setPreviewIndex((prev) => {
      if (prev === null || prev >= files.length - 1) return prev
      return prev + 1
    })
  }

  // 파일의 실제 이미지 URL 계산 (상대경로면 impsj.net 기준으로 보정)
  const getImageUrl = (file: ApiFile) => {
    if (!file.file_url) return ''
    if (file.file_url.startsWith('http')) return file.file_url
    return `http://impsj.net${file.file_url}`
  }

  // 썸네일 URL 계산: /data/<path>/<filename> -> /data/<path>/thumbnail/<filename>
  const getThumbnailUrl = (file: ApiFile) => {
    const url = getImageUrl(file)
    if (!url) return ''
    try {
      const u = new URL(url)
      const segments = u.pathname.split('/')
      if (segments.length >= 3) {
        // [..., 'data', '<path>', '<filename>']
        const filename = segments.pop() as string
        const basePath = segments.join('/')
        u.pathname = `${basePath}/thumbnail/${filename}`
        return u.toString()
      }
      return url
    } catch {
      return url
    }
  }

  // 등록시간: 24시간 이내 → HH:mm, 24시간 지나면 → YY.MM.DD
  const formatCreatedAt = (createdAt: string | null | undefined): string => {
    if (!createdAt) return ''
    try {
      const date = new Date(createdAt)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffHours = diffMs / (1000 * 60 * 60)
      if (diffHours < 24 && diffHours >= 0) {
        const h = String(date.getHours()).padStart(2, '0')
        const m = String(date.getMinutes()).padStart(2, '0')
        return `${h}:${m}`
      }
      const yy = String(date.getFullYear()).slice(-2)
      const mm = String(date.getMonth() + 1).padStart(2, '0')
      const dd = String(date.getDate()).padStart(2, '0')
      return `${yy}.${mm}.${dd}`
    } catch {
      return ''
    }
  }

  const uploadSingleFile = async (file: File) => {
    await uploadFileApi({
      file,
      tbCode: 'gallery',
      dataId: 0,
      fileNo: 1,
      fileType: 0,
      description: file.name || '',
      save_path: 'gallery',
    })
    // 업로드 후 최신 파일 목록 다시 조회
    const data = await fetchFilesByDataApi({ tbCode: 'gallery', dataId: 0 })
    setFiles(data)
  }

  const handleUploadClick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true

    input.onchange = async (event) => {
      const target = event.target as HTMLInputElement
      const files = target.files ? Array.from(target.files) : []
      if (!files.length) return
      setSelectedFiles(files)
    }

    input.click()
  }

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const data = await fetchFilesByDataApi({ tbCode: 'gallery', dataId: 0 })
        setFiles(data)
      } catch (error) {
        console.error('파일 목록을 불러오는 중 오류가 발생했습니다:', error)
      }
    }

    fetchFiles()
  }, [])
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
          파일관리
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          UI 시안, 컴포넌트, 아이콘 등 시각 자료를 카드 형태로 모아 보는 공간입니다.
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setShowDropZone((prev) => !prev)}
          >
            파일 업로드
          </Button>
          <Button
            variant="outlined"
            color="primary"
            disabled={!selectedFiles.length}
            onClick={async () => {
              if (!selectedFiles.length) return
              try {
                setIsUploading(true)
                setUploadProgress(0)
                const total = selectedFiles.length
                let completed = 0
                for (const file of selectedFiles) {
                  await uploadSingleFile(file)
                  completed += 1
                  setUploadProgress(Math.round((completed / total) * 100))
                }
                window.alert('파일이 업로드되었습니다.')
                setSelectedFiles([])
                setShowDropZone(false)
              } catch (error) {
                console.error('파일 업로드 오류:', error)
                window.alert('파일 업로드 중 오류가 발생했습니다.')
              } finally {
                setIsUploading(false)
                setUploadProgress(0)
              }
            }}
          >
            저장하기
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
            color="primary"
            onClick={() => {
              if (!selectMode) setSelectMode(true)
              const allIndexes = files.map((_, i) => i)
              setSelectedIndexes(selectedIndexes.length === files.length ? [] : allIndexes)
            }}
            disabled={!files.length}
          >
            {selectMode && selectedIndexes.length === files.length ? '전체해제' : '전체선택'}
          </Button>
          <Button
            variant="outlined"
            color="error"
            disabled={!selectedIndexes.length}
            onClick={handleDeleteSelected}
          >
            선택 삭제
          </Button>
        </Box>

        <Box sx={{ display: 'flex', gap: 3, flex: 1, minHeight: 0 }}>
          {/* 폴더 트리 사이드바 */}
          <Paper
            elevation={0}
            sx={{
              width: 220,
              flexShrink: 0,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
              alignSelf: 'flex-start',
            }}
          >
            <Box sx={{ px: 1.5, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                폴더
              </Typography>
            </Box>
            <List dense disablePadding sx={{ py: 0.5 }}>
              {FOLDER_TREE.map((parent) => (
                <Box key={parent.id}>
                  <ListItemButton
                    onClick={() => {
                      toggleFolderExpand(parent.id)
                      setSelectedFolderId(parent.id)
                    }}
                    selected={selectedFolderId === parent.id}
                    sx={{
                      borderRadius: 1,
                      mx: 0.5,
                      py: 0.75,
                      '&.Mui-selected': { bgcolor: 'action.selected' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0 }}>
                      {expandedFolderIds.has(parent.id) ? (
                        <ExpandMoreIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      ) : (
                        <ChevronRightIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      )}
                      {expandedFolderIds.has(parent.id) ? (
                        <FolderOpenIcon fontSize="small" color="primary" />
                      ) : (
                        <FolderIcon fontSize="small" color="primary" />
                      )}
                      <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                        {parent.label}
                      </Typography>
                    </Box>
                  </ListItemButton>
                  <Collapse in={expandedFolderIds.has(parent.id)} timeout="auto" unmountOnExit>
                    <List dense disablePadding>
                      {(parent.children ?? []).map((child) => (
                        <ListItemButton
                          key={child.id}
                          onClick={() => setSelectedFolderId(child.id)}
                          selected={selectedFolderId === child.id}
                          sx={{
                            pl: 4,
                            py: 0.6,
                            borderRadius: 1,
                            mx: 0.5,
                            '&.Mui-selected': { bgcolor: 'action.selected' },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                            <FolderIcon fontSize="small" color="primary" sx={{ flexShrink: 0 }} />
                            <Typography variant="body2" noWrap>
                              {child.label}
                            </Typography>
                          </Box>
                        </ListItemButton>
                      ))}
                    </List>
                  </Collapse>
                </Box>
              ))}
            </List>
          </Paper>

          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {showDropZone && (
          <>
            <Box
              sx={{
                mb: 2,
                minHeight: 100,
                borderRadius: 2,
                border: '2px dashed',
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.secondary',
                bgcolor: 'grey.50',
                px: 2,
                py: 1.5,
              }}
              onClick={handleUploadClick}
              onDragOver={(e) => {
                e.preventDefault()
              }}
              onDrop={(e) => {
                e.preventDefault()
                const dropped = e.dataTransfer.files
                if (!dropped || !dropped.length) return
                const files = Array.from(dropped)
                setSelectedFiles((prev) => [...prev, ...files])
              }}
            >
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                여기에 파일을 드래그해서 첨부하거나, 클릭하여 파일을 선택하세요.
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                선택된 파일:
              </Typography>
              {selectedFiles.length ? (
                <Box sx={{ maxHeight: 80, overflowY: 'auto', width: '100%' }}>
                  {selectedFiles.map((file, idx) => (
                    <Typography
                      key={`${file.name}-${idx}`}
                      variant="body2"
                      color="text.secondary"
                    >
                      - {file.name}
                    </Typography>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  없음
                </Typography>
              )}
            </Box>
            {isUploading && (
              <Box sx={{ mb: 3, width: '100%' }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  업로드 중... {uploadProgress}%
                </Typography>
                <LinearProgress variant="determinate" value={uploadProgress} />
              </Box>
            )}
          </>
        )}

        {files.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">데이터 없음</Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow
                sx={{
                  backgroundColor: '#f5f7fb',
                }}
              >
                <TableCell align="center" sx={{ fontWeight: 600, width: 60 }}>
                  NO
                </TableCell>
                <TableCell sx={{ fontWeight: 600, width: 100 }}>미리보기</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">파일명</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 120 }}>용량</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 160 }} align="center">
                  등록일
                </TableCell>
                <TableCell sx={{ fontWeight: 600, width: 48 }} align="center" />
              </TableRow>
            </TableHead>
            <TableBody>
              {files.map((item, index) => (
                <TableRow key={item.file_id} hover>
                  <TableCell align="center">
                    {selectMode ? (
                      <Checkbox
                        size="small"
                        checked={selectedIndexes.includes(index)}
                        onChange={() => toggleSelected(index)}
                      />
                    ) : (
                      index + 1
                    )}
                  </TableCell>
                  <TableCell>
                    <Box
                      component="img"
                      src={getThumbnailUrl(item)}
                      alt={item.file_name}
                      sx={{
                        width: 50,
                        height: 50,
                        borderRadius: 1,
                        cursor: 'pointer',
                        objectFit: 'cover',
                      }}
                      onClick={() => setPreviewIndex(index)}
                    />
                  </TableCell>
                  <TableCell align="center">{item.file_name}</TableCell>
                  <TableCell>
                    {item.filesize ? `${(item.filesize / 1024).toFixed(1)} KB` : '-'}
                  </TableCell>
                  {/* <TableCell>{item.content || '-'}</TableCell> */}
                  <TableCell align="center">
                    {formatCreatedAt(item.created_at)}
                  </TableCell>
                  <TableCell align="center" padding="none">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMenuOpen(e.currentTarget as HTMLElement, item.file_id)
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
          <MenuItem
            onClick={() => {
              window.alert(`파일 수정 (file_id: ${menuFileId}) 기능은 추후 구현 예정입니다.`)
              handleMenuClose()
            }}
          >
            수정
          </MenuItem>
          <MenuItem
            onClick={handleDeleteSingle}
          >
            삭제
          </MenuItem>
        </Menu>

        <Dialog
          open={previewIndex !== null && currentPreviewFile !== null}
          onClose={() => setPreviewIndex(null)}
          fullScreen
          maxWidth={false}
        >
          <DialogContent
            sx={{
              p: 0,
              bgcolor: 'black',
              height: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {currentPreviewFile && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  bgcolor: 'black',
                  width: '100%',
                  height: '100%',
                  px: 2,
                  py: 1,
                  gap: 1,
                }}
              >
                <IconButton
                  onClick={() => setPreviewIndex(null)}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    color: 'white',
                    zIndex: 10,
                  }}
                >
                  <CloseIcon />
                </IconButton>
                <IconButton
                  onClick={handlePrevPreview}
                  disabled={previewIndex === null || previewIndex <= 0}
                  sx={{ color: 'white' }}
                >
                  <ArrowBackIosNewIcon />
                </IconButton>
                <Box
                  sx={{
                    flexGrow: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Box
                    component="img"
                    src={getImageUrl(currentPreviewFile)}
                    alt={currentPreviewFile.file_name}
                    sx={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                    }}
                  />
                </Box>
                <IconButton
                  onClick={handleNextPreview}
                  disabled={
                    previewIndex === null || previewIndex >= files.length - 1
                  }
                  sx={{ color: 'white' }}
                >
                  <ArrowForwardIosIcon />
                </IconButton>
              </Box>
            )}
          </DialogContent>
        </Dialog>
          </Box>
        </Box>
      </Paper>
      </Box>
    </Box>
  )
}

