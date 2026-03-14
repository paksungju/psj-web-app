import { useEffect, useState } from 'react'
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
  DialogContent,
  LinearProgress,
  Checkbox,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Select,
} from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import MenuIcon from '@mui/icons-material/Menu'
import AppsIcon from '@mui/icons-material/Apps'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import CloseIcon from '@mui/icons-material/Close'
import TopBar from '../../components/TopBar'
import { uploadFileApi, fetchFilesByDataApi, deleteFilesApi, ApiFile } from '../../apis/fileApi'

export default function GalleryPage() {
  const [showDropZone, setShowDropZone] = useState(false)
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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')
  const [category, setCategory] = useState<string>('전체보기')

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
      setFiles(data.items)
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
      setFiles(data.items)
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

  const getDisplayName = (name: string) => {
    if (!name) return ''
    return name.length > 14 ? `${name.slice(0, 14)}...` : name
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
    setFiles(data.items)
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
        setFiles(data.items)
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
          겔러리
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
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
          <Box sx={{ flexGrow: 1 }} />
          <Select
            size="small"
            value={category}
            onChange={(e) => setCategory(e.target.value as string)}
            sx={{ minWidth: 160, fontSize: 13, mr: 1.5 }}
          >
            <MenuItem value="전체보기">전체보기</MenuItem>
            <MenuItem value="MAN">MAN</MenuItem>
            <MenuItem value="FAMILY">FAMILY</MenuItem>
            <MenuItem value="자연풍경">자연풍경</MenuItem>
          </Select>
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
            {/* 목록 보기 버튼 */}
            <Button
              onClick={() => setViewMode('list')}
              sx={{
                minWidth: 70,
                px: 1.5,
                py: 0.9,
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
                  fontSize: 16,
                  mr: 0.5,
                  color: viewMode === 'list' ? 'common.white' : 'inherit',
                }}
              />
              <MenuIcon
                sx={{
                  fontSize: 18,
                  color: viewMode === 'list' ? 'common.white' : 'inherit',
                }}
              />
            </Button>
            {/* 이미지(그리드) 보기 버튼 */}
            <Button
              onClick={() => setViewMode('grid')}
              sx={{
                minWidth: 70,
                px: 1.5,
                py: 0.9,
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
                  fontSize: 16,
                  color: viewMode === 'grid' ? 'common.white' : 'inherit',
                }}
              />
            </Button>
          </Box>
        </Box>
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
        ) : viewMode === 'grid' ? (
          <Grid container spacing={2.5}>
            {files.map((item, index) => (
              <Grid
                key={`${item.file_id}-${index}`}
                item
                xs={12}
                sm={6}
                md={4}
                lg={3}
              >
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
                    sx={{
                      p: 1.5,
                      bgcolor: 'background.paper',
                    }}
                    onClick={() => setPreviewIndex(index)}
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
                      <Box
                        component="img"
                        src={getThumbnailUrl(item)}
                        alt={item.file_name}
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
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
                      {selectMode && (
                        <Checkbox
                          size="small"
                          checked={selectedIndexes.includes(index)}
                          onChange={() => toggleSelected(index)}
                        />
                      )}
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 500 }}
                        noWrap
                      >
                        {getDisplayName(item.file_name)}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      component="div"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMenuOpen(e.currentTarget as HTMLElement, item.file_id)
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
              <TableRow
                sx={{
                  backgroundColor: '#f5f7fb',
                }}
              >
                <TableCell align="center" sx={{ fontWeight: 600, width: 60 }}>
                  NO
                </TableCell>
                <TableCell sx={{ fontWeight: 600, width: 100 }}>미리보기</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>파일명</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 120 }}>용량</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>설명</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 160 }} align="center">
                  등록일
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {files.map((item, index) => (
                <TableRow key={item.file_id} hover>
                  <TableCell align="center">{index + 1}</TableCell>
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
                  <TableCell>{item.content || '-'}</TableCell>
                  <TableCell align="center">
                    {item.created_at ? item.created_at.slice(0, 19).replace('T', ' ') : ''}
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
      </Paper>
      </Box>
    </Box>
  )
}

