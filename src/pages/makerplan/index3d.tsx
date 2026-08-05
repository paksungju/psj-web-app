import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import ViewInArIcon from '@mui/icons-material/ViewInAr'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import {
  fetchAppDataListApi,
  fetchAppDataByIdApi,
  createAppDataApi,
  updateAppDataApi,
  deleteAppDataApi,
  type ApiAppData,
} from '../../apis/appApi'
import { uploadFileApiWithProgress, deleteFilesApi, fetchFilesByDataApi } from '../../apis/fileApi'
import { uploadImageApiWithProgress } from '../../apis/imageApi'
import { getApiPrefix } from '../../apis/apiPrefix'

const APP_ID = 11
const MENU_CD = 'makerplan_3d'
const SAVE_PATH = 'makerplan/3d'
const ACCEPTED = '.glb,.gltf,.stl,.obj'
const ACCEPTED_EXTS = ['glb', 'gltf', 'stl', 'obj']

function apiV1Base(): string {
  const prefix = getApiPrefix()
  return prefix ? `${prefix}/api/v1` : '/api/v1'
}

function toAbsoluteFileUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  const prefix = getApiPrefix()
  let origin = prefix
  if (!origin) {
    // /data 정적 파일은 Vite 프록시 대상이 아니므로 원격 호스트 사용
    if (url.startsWith('/data/')) {
      origin = 'http://impsj.net'
    } else if (typeof window !== 'undefined') {
      origin = window.location.origin
    } else {
      origin = 'http://impsj.net'
    }
  }
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`
}

/**
 * 로드 후보 URL 목록.
 * 1) /data 정적 경로(file_url) — 서버 디스크와 DB file_path 불일치 시에도 동작
 * 2) file_id 다운로드 API — 폴백
 */
function resolveModelSources(fileId: number | null, fileUrl?: string): string[] {
  const sources: string[] = []
  if (fileUrl?.trim()) {
    sources.push(toAbsoluteFileUrl(fileUrl.trim()))
  }
  if (fileId != null && !Number.isNaN(fileId)) {
    sources.push(`${apiV1Base()}/files/${fileId}/download`)
  }
  return sources
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '-'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function extOf(name: string): string {
  const raw = name.split('.').pop() || ''
  return (raw.split('?')[0] || '').toLowerCase()
}

// ── three.js helpers ────────────────────────────────────
function disposeObject(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose()
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach((m) => m?.dispose())
    }
  })
}

function fitCameraToObject(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  object: THREE.Object3D,
) {
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z, 0.001)
  const dist = maxDim * 2.2

  camera.near = Math.max(dist / 100, 0.01)
  camera.far = dist * 100
  camera.updateProjectionMatrix()
  camera.position.set(center.x + dist * 0.6, center.y + dist * 0.5, center.z + dist)
  controls.target.copy(center)
  controls.update()
}

/**
 * URL로 3D 모델을 로드해 보여주는 뷰어.
 * three.js 로더 대신 fetch로 먼저 받아 parse 하므로, 실패 시 원인(404/CORS 등)을
 * 명확히 표시할 수 있다.
 */
function ModelViewer({ sources, fileName, height = 'min(70vh, 720px)' }: { sources: string[]; fileName: string; height?: string | number }) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || sources.length === 0) return

    let disposed = false
    let frame = 0

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf4f6f8)

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000)
    camera.position.set(3, 2, 5)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb0b8c0, 1.1))
    const dir = new THREE.DirectionalLight(0xffffff, 1.2)
    dir.position.set(5, 10, 7)
    scene.add(dir)
    scene.add(new THREE.AmbientLight(0xffffff, 0.35))
    scene.add(new THREE.GridHelper(10, 20, 0xcbd5e1, 0xe2e8f0))

    const resize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      if (w <= 0 || h <= 0) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(mount)

    const animate = () => {
      frame = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    let currentModel: THREE.Object3D | null = null
    const onLoaded = (object: THREE.Object3D) => {
      if (disposed) {
        disposeObject(object)
        return
      }
      currentModel = object
      scene.add(object)
      fitCameraToObject(camera, controls, object)
      setLoading(false)
    }

    const ext = extOf(fileName) || extOf(sources[0] ?? '')
    setLoading(true)
    setError(null)

    const parseAndLoad = async (res: Response, srcUrl: string) => {
      const basePath = srcUrl.substring(0, srcUrl.lastIndexOf('/') + 1)
      if (ext === 'glb' || ext === 'gltf') {
        const buf = await res.arrayBuffer()
        const gltf = await new GLTFLoader().parseAsync(buf, basePath)
        onLoaded(gltf.scene)
      } else if (ext === 'stl') {
        const buf = await res.arrayBuffer()
        const geometry = new STLLoader().parse(buf)
        geometry.computeVertexNormals()
        onLoaded(
          new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.15, roughness: 0.55 }),
          ),
        )
      } else {
        const textData = await res.text()
        const obj = new OBJLoader().parse(textData)
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh && !child.material) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0x64748b,
              metalness: 0.15,
              roughness: 0.55,
            })
          }
        })
        onLoaded(obj)
      }
    }

    const load = async () => {
      if (!ACCEPTED_EXTS.includes(ext)) {
        setError('지원하지 않는 형식입니다. (.glb, .gltf, .stl, .obj)')
        setLoading(false)
        return
      }
      const failures: string[] = []
      for (const srcUrl of sources) {
        if (disposed) return
        try {
          const res = await fetch(srcUrl)
          if (!res.ok) {
            failures.push(`HTTP ${res.status}: ${srcUrl}`)
            continue
          }
          await parseAndLoad(res, srcUrl)
          return
        } catch (e) {
          const reason = e instanceof TypeError ? '네트워크/CORS' : e instanceof Error ? e.message : '알 수 없음'
          failures.push(`${reason}: ${srcUrl}`)
        }
      }
      console.error('3D 로딩 실패:', failures)
      if (!disposed) {
        setError(`파일을 불러오지 못했습니다.\n${failures.join('\n')}`)
        setLoading(false)
      }
    }
    void load()

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      ro.disconnect()
      if (currentModel) {
        scene.remove(currentModel)
        disposeObject(currentModel)
      }
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources.join('|'), fileName])

  return (
    <Box sx={{ position: 'relative', width: '100%', flex: 1, minHeight: 0 }}>
      <Box
        ref={mountRef}
        sx={{
          width: '100%',
          height,
          minHeight: 400,
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: '#f4f6f8',
        }}
      />
      {loading && !error && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <Stack alignItems="center" spacing={1}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary">
              불러오는 중…
            </Typography>
          </Stack>
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ position: 'absolute', left: 16, right: 16, bottom: 16, whiteSpace: 'pre-line', wordBreak: 'break-all' }}>
          {error}
        </Alert>
      )}
    </Box>
  )
}

// ── app_data(app_id=11) → 3D 항목 매핑 ─────────────────
type ModelItem = {
  dataId: number
  title: string
  sources: string[]
  thumbUrl: string
  fileName: string
  filesize: number
  ext: string
  fileId: number | null
  fileUrl: string
}

/**
 * extra 필드 매핑:
 *  extra_1 = 썸네일 이미지 URL (목록 카드용)
 *  extra_2 = 파일명, extra_3 = 크기, extra_4 = 확장자, extra_5 = file_id
 *  extra_6 = file_url (/data/... 정적 경로)
 */
function rowToItem(row: ApiAppData): ModelItem {
  const fileId = row.extra_5 ? Number(row.extra_5) || null : null
  const fileUrl = row.extra_6?.trim() ?? ''
  return {
    dataId: row.data_id ?? 0,
    title: row.ap_subject?.trim() || row.extra_2?.trim() || '(제목 없음)',
    sources: resolveModelSources(fileId, fileUrl),
    thumbUrl: toAbsoluteFileUrl(row.extra_1 ?? ''),
    fileName: row.extra_2 ?? '',
    filesize: Number(row.extra_3 ?? 0) || 0,
    ext: (row.extra_4 ?? '').toLowerCase(),
    fileId,
    fileUrl,
  }
}

async function enrichItemWithFileUrl(item: ModelItem, dataId: number): Promise<ModelItem> {
  if (item.fileUrl || !item.fileId) return item
  try {
    const { items } = await fetchFilesByDataApi({ menuCd: MENU_CD, dataId, limit: 20 })
    const file = items.find((f) => f.file_id === item.fileId) ?? items[0]
    if (!file?.file_url) return item
    return {
      ...item,
      fileUrl: file.file_url,
      sources: resolveModelSources(item.fileId, file.file_url),
    }
  } catch (e) {
    console.error('3D 파일 URL 조회 실패:', e)
    return item
  }
}

// ── 상세(뷰어) 페이지 ───────────────────────────────────
function MakerPlan3dDetail({ dataId }: { dataId: number }) {
  const navigate = useNavigate()
  const [item, setItem] = useState<ModelItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    const load = async () => {
      try {
        const row = await fetchAppDataByIdApi(dataId)
        if (cancelled) return
        if (!row) {
          setNotFound(true)
          return
        }
        setItem(await enrichItemWithFileUrl(rowToItem(row), dataId))
      } catch (e) {
        console.error('3D 상세 로드 실패:', e)
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [dataId])

  return (
    <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          backgroundColor: 'background.paper',
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/makerplan/3d')}
            sx={{ backgroundColor: '#fff', borderColor: 'grey.400', color: 'text.primary' }}
          >
            목록
          </Button>
          <Typography variant="h6" sx={{ fontWeight: 600 }} noWrap>
            {item?.title ?? '3D 파일 뷰어'}
          </Typography>
          {item?.fileName && (
            <Typography variant="body2" color="text.secondary" noWrap>
              {item.fileName} · {formatFileSize(item.filesize)}
            </Typography>
          )}
        </Stack>

        {loading ? (
          <Box sx={{ flex: 1, minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={48} />
          </Box>
        ) : notFound || !item ? (
          <Alert severity="warning">해당 3D 데이터를 찾을 수 없습니다.</Alert>
        ) : item.sources.length === 0 ? (
          <Alert severity="warning">이 항목에는 연결된 3D 파일이 없습니다.</Alert>
        ) : (
          <Paper
            variant="outlined"
            sx={{ borderRadius: 2, overflow: 'hidden', flex: 1, minHeight: 480, display: 'flex' }}
          >
            <ModelViewer sources={item.sources} fileName={item.fileName || item.title} />
          </Paper>
        )}
      </Paper>
    </Box>
  )
}

// ── 목록 페이지 ─────────────────────────────────────────
function MakerPlan3dList() {
  const navigate = useNavigate()
  const [items, setItems] = useState<ModelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [menuDataId, setMenuDataId] = useState<number | null>(null)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingRow, setEditingRow] = useState<ApiAppData | null>(null)
  const [title, setTitle] = useState('')
  const [pickedFile, setPickedFile] = useState<File | null>(null)
  const [thumbFile, setThumbFile] = useState<File | null>(null)
  const [thumbPreview, setThumbPreview] = useState<string | null>(null)
  const [thumbRemoved, setThumbRemoved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const thumbInputRef = useRef<HTMLInputElement>(null)

  const isEditing = editingId != null

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchAppDataListApi({ app_id: APP_ID, limit: 500 })
      setItems(rows.map(rowToItem).filter((it) => it.dataId > 0))
      setSelectedIds([])
    } catch (e) {
      console.error('3D 목록 로드 실패:', e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  const menuOpen = Boolean(menuAnchorEl)
  const allSelected = items.length > 0 && selectedIds.length === items.length

  const toggleSelected = (dataId: number) => {
    setSelectedIds((prev) =>
      prev.includes(dataId) ? prev.filter((id) => id !== dataId) : [...prev, dataId],
    )
  }

  const resetUploadDialog = () => {
    setEditingId(null)
    setEditingRow(null)
    setTitle('')
    setPickedFile(null)
    setThumbFile(null)
    setThumbRemoved(false)
    setThumbPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setUploadProgress(0)
    setUploading(false)
  }

  const openEditDialog = async (dataId: number) => {
    resetUploadDialog()
    setEditingId(dataId)
    setUploadOpen(true)
    try {
      const row = await fetchAppDataByIdApi(dataId)
      if (row) {
        setEditingRow(row)
        setTitle(row.ap_subject?.trim() || row.extra_2?.trim() || '')
      }
    } catch (e) {
      console.error('수정 정보 로드 실패:', e)
      window.alert('수정 정보를 불러오지 못했습니다.')
    }
  }

  const pickFile = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    if (!ACCEPTED_EXTS.includes(extOf(file.name))) {
      window.alert('지원 형식: .glb, .gltf, .stl, .obj')
      return
    }
    setPickedFile(file)
    if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''))
  }

  const pickThumb = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!imageTypes.includes(file.type)) {
      window.alert('JPEG, PNG, GIF, WEBP 이미지만 업로드할 수 있습니다.')
      return
    }
    setThumbFile(file)
    setThumbRemoved(false)
    setThumbPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const clearThumb = () => {
    setThumbFile(null)
    setThumbPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setThumbRemoved(true)
  }

  const uploadThumb = async (dataId: number, subject: string): Promise<string> => {
    if (!thumbFile) return ''
    const thumbRes = await uploadImageApiWithProgress({
      file: thumbFile,
      menuCd: MENU_CD,
      dataId,
      fileNo: 1,
      fileType: 0,
      description: `${subject} 썸네일`,
      save_path: SAVE_PATH,
    })
    return thumbRes.file_url || ''
  }

  const handleCreate = async () => {
    if (!pickedFile) {
      window.alert('업로드할 3D 파일을 선택해 주세요.')
      return
    }
    const subject = title.trim() || pickedFile.name
    setUploading(true)
    setUploadProgress(0)
    try {
      // 1) app_data 레코드 생성 (app_id = 11)
      const created = await createAppDataApi({
        app_id: APP_ID,
        ap_subject: subject,
        ap_content: '',
      })
      const dataId = created.data_id ?? 0
      if (!dataId) throw new Error('데이터 생성에 실패했습니다.')

      // 2) 정보게시판 파일 업로드 로직으로 3D 파일 업로드
      const res = await uploadFileApiWithProgress(
        {
          file: pickedFile,
          menuCd: MENU_CD,
          dataId,
          fileNo: 1,
          fileType: 0,
          description: subject,
          save_path: SAVE_PATH,
        },
        (loaded, total) => {
          if (total > 0) setUploadProgress(Math.round((loaded / total) * 100))
        },
      )

      // 3) 썸네일 이미지 업로드 (선택)
      let thumbUrl = ''
      try {
        thumbUrl = await uploadThumb(dataId, subject)
      } catch (e) {
        console.error('썸네일 업로드 실패:', e)
      }

      // 4) 파일 정보를 extra 필드에 저장 (목록/뷰어에서 사용)
      await updateAppDataApi(dataId, {
        app_id: APP_ID,
        ap_subject: subject,
        extra_1: thumbUrl,
        extra_2: res.file_name || pickedFile.name,
        extra_3: String(res.filesize || pickedFile.size),
        extra_4: extOf(res.file_name || pickedFile.name),
        extra_5: String(res.file_id ?? ''),
        extra_6: res.file_url || '',
      })

      setUploadOpen(false)
      resetUploadDialog()
      await loadItems()
    } catch (e) {
      console.error('3D 업로드 실패:', e)
      window.alert('업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleEdit = async () => {
    if (editingId == null) return
    const dataId = editingId
    const subject = title.trim() || editingRow?.ap_subject?.trim() || pickedFile?.name || '(제목 없음)'
    setUploading(true)
    setUploadProgress(0)
    try {
      // 기존 값 유지 (백엔드 update는 extra 필드를 덮어쓰므로 유지값을 다시 전달)
      let extra1 = editingRow?.extra_1 ?? '' // 썸네일
      let extra2 = editingRow?.extra_2 ?? '' // 파일명
      let extra3 = editingRow?.extra_3 ?? '' // 크기
      let extra4 = editingRow?.extra_4 ?? '' // 확장자
      let extra5 = editingRow?.extra_5 ?? '' // file_id
      let extra6 = editingRow?.extra_6 ?? '' // file_url

      // 3D 파일 교체 (선택)
      if (pickedFile) {
        const res = await uploadFileApiWithProgress(
          {
            file: pickedFile,
            menuCd: MENU_CD,
            dataId,
            fileNo: 1,
            fileType: 0,
            description: subject,
            save_path: SAVE_PATH,
          },
          (loaded, total) => {
            if (total > 0) setUploadProgress(Math.round((loaded / total) * 100))
          },
        )
        // 기존 파일 삭제 (교체)
        const oldFileId = editingRow?.extra_5 ? Number(editingRow.extra_5) : NaN
        if (!Number.isNaN(oldFileId)) {
          try {
            await deleteFilesApi({ fileIds: [oldFileId] })
          } catch (e) {
            console.error('기존 파일 삭제 실패:', e)
          }
        }
        extra2 = res.file_name || pickedFile.name
        extra3 = String(res.filesize || pickedFile.size)
        extra4 = extOf(res.file_name || pickedFile.name)
        extra5 = String(res.file_id ?? '')
        extra6 = res.file_url || ''
      }

      // 썸네일 변경 (교체/제거)
      if (thumbFile) {
        try {
          extra1 = await uploadThumb(dataId, subject)
        } catch (e) {
          console.error('썸네일 업로드 실패:', e)
        }
      } else if (thumbRemoved) {
        extra1 = ''
      }

      await updateAppDataApi(dataId, {
        app_id: APP_ID,
        ap_subject: subject,
        extra_1: extra1,
        extra_2: extra2,
        extra_3: extra3,
        extra_4: extra4,
        extra_5: extra5,
        extra_6: extra6,
      })

      setUploadOpen(false)
      resetUploadDialog()
      await loadItems()
    } catch (e) {
      console.error('3D 수정 실패:', e)
      window.alert('수정 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleSubmit = () => {
    if (isEditing) return void handleEdit()
    return void handleCreate()
  }

  const handleDelete = async (dataIds: number[]) => {
    if (!dataIds.length) return
    if (!window.confirm(`선택한 ${dataIds.length}개 항목을 삭제하시겠습니까?`)) return
    setBusy(true)
    try {
      for (const id of dataIds) {
        const target = items.find((it) => it.dataId === id)
        if (target?.fileId) {
          try {
            await deleteFilesApi({ fileIds: [target.fileId] })
          } catch (e) {
            console.error('첨부파일 삭제 실패:', e)
          }
        }
        await deleteAppDataApi(id)
      }
      setSelectedIds([])
      setSelectMode(false)
      await loadItems()
    } catch (e) {
      console.error('삭제 실패:', e)
      window.alert('삭제 중 오류가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 3 }}>
      {(loading || busy) && (
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
            3D 파일 뷰어
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            GLB / GLTF / STL / OBJ 파일을 업로드하고, 목록에서 클릭하여 회전·확대·축소로 확인할 수 있습니다.
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={<UploadFileIcon />}
              onClick={() => {
                resetUploadDialog()
                setUploadOpen(true)
              }}
            >
              업로드하기
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
              disabled={!items.length}
              onClick={() => {
                if (!selectMode) setSelectMode(true)
                setSelectedIds(allSelected ? [] : items.map((it) => it.dataId))
              }}
            >
              {allSelected ? '전체해제' : '전체선택'}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              disabled={!selectedIds.length}
              onClick={() => void handleDelete(selectedIds)}
            >
              선택 삭제
            </Button>
          </Box>

          {!loading && items.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography color="text.secondary">업로드된 3D 파일이 없습니다.</Typography>
            </Box>
          ) : (
            <Grid container spacing={2.5}>
              {items.map((item) => (
                <Grid key={item.dataId} item xs={12} sm={6} md={4} lg={3}>
                  <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                    <CardActionArea onClick={() => navigate(`/makerplan/3d/${item.dataId}`)}>
                      <Box
                        sx={{
                          width: '100%',
                          aspectRatio: '4 / 3',
                          bgcolor: 'grey.100',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 1,
                          color: 'text.secondary',
                          overflow: 'hidden',
                        }}
                      >
                        {item.thumbUrl ? (
                          <Box
                            component="img"
                            src={item.thumbUrl}
                            alt={item.title}
                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <>
                            <ViewInArIcon sx={{ fontSize: 48, opacity: 0.6 }} />
                            <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 700 }}>
                              {item.ext || '3D'}
                            </Typography>
                          </>
                        )}
                      </Box>
                    </CardActionArea>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, flex: 1 }}>
                        {selectMode && (
                          <Checkbox
                            size="small"
                            checked={selectedIds.includes(item.dataId)}
                            onChange={() => toggleSelected(item.dataId)}
                          />
                        )}
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {item.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {(item.ext || '-').toUpperCase()} · {formatFileSize(item.filesize)}
                          </Typography>
                        </Box>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          setMenuAnchorEl(e.currentTarget)
                          setMenuDataId(item.dataId)
                        }}
                      >
                        <span style={{ fontSize: 18 }}>⋯</span>
                      </IconButton>
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          <Menu anchorEl={menuAnchorEl} open={menuOpen} onClose={() => setMenuAnchorEl(null)}>
            <MenuItem
              onClick={() => {
                setMenuAnchorEl(null)
                if (menuDataId != null) navigate(`/makerplan/3d/${menuDataId}`)
              }}
            >
              보기
            </MenuItem>
            <MenuItem
              onClick={() => {
                const id = menuDataId
                setMenuAnchorEl(null)
                if (id != null) void openEditDialog(id)
              }}
            >
              수정
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuAnchorEl(null)
                if (menuDataId != null) void handleDelete([menuDataId])
              }}
            >
              삭제
            </MenuItem>
          </Menu>

          {/* 업로드 다이얼로그 */}
          <Dialog
            open={uploadOpen}
            onClose={() => {
              if (!uploading) {
                setUploadOpen(false)
                resetUploadDialog()
              }
            }}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle sx={{ fontWeight: 600 }}>{isEditing ? '3D 파일 수정' : '3D 파일 업로드'}</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <TextField
                  label="제목"
                  size="small"
                  fullWidth
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="파일 선택 시 자동 입력"
                />

                {/* 썸네일 이미지 (선택) */}
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
                    썸네일 이미지 (선택)
                  </Typography>
                  <input
                    ref={thumbInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      pickThumb(e.target.files)
                      e.target.value = ''
                    }}
                  />
                  <Box
                    sx={{
                      border: '2px dashed',
                      borderColor: 'divider',
                      borderRadius: 2,
                      bgcolor: 'grey.50',
                      p: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 1.5,
                      cursor: uploading ? 'default' : 'pointer',
                    }}
                    onClick={() => {
                      if (!uploading) thumbInputRef.current?.click()
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (!uploading) pickThumb(e.dataTransfer.files)
                    }}
                  >
                    {(() => {
                      const existingThumbSrc =
                        editingRow?.extra_1 ? toAbsoluteFileUrl(editingRow.extra_1) : ''
                      const shownThumb = thumbPreview || (!thumbRemoved ? existingThumbSrc : '')
                      const hasThumb = Boolean(thumbFile || (!thumbRemoved && existingThumbSrc))
                      return (
                        <>
                          {shownThumb ? (
                            <Box
                              component="img"
                              src={shownThumb}
                              alt="썸네일 미리보기"
                              sx={{ maxWidth: '100%', maxHeight: 160, objectFit: 'contain' }}
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary" align="center">
                              클릭하거나 이미지를 드래그하여 썸네일을 첨부하세요. (JPG/PNG/GIF/WEBP)
                            </Typography>
                          )}
                          <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={uploading}
                              onClick={() => thumbInputRef.current?.click()}
                            >
                              이미지 선택
                            </Button>
                            {hasThumb && (
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                disabled={uploading}
                                onClick={clearThumb}
                              >
                                제거
                              </Button>
                            )}
                          </Stack>
                        </>
                      )
                    })()}
                  </Box>
                </Box>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    pickFile(e.target.files)
                    e.target.value = ''
                  }}
                />
                <Box
                  sx={{
                    border: '2px dashed',
                    borderColor: 'divider',
                    borderRadius: 2,
                    bgcolor: 'grey.50',
                    p: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1.5,
                    cursor: uploading ? 'default' : 'pointer',
                  }}
                  onClick={() => {
                    if (!uploading) fileInputRef.current?.click()
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (!uploading) pickFile(e.dataTransfer.files)
                  }}
                >
                  <ViewInArIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                  {pickedFile ? (
                    <Typography variant="body2" align="center">
                      {pickedFile.name} · {formatFileSize(pickedFile.size)}
                    </Typography>
                  ) : isEditing && editingRow?.extra_2 ? (
                    <Stack spacing={0.5} alignItems="center">
                      <Typography variant="body2" align="center">
                        현재 파일: {editingRow.extra_2}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" align="center">
                        교체하려면 새 파일을 선택하세요. (.glb, .gltf, .stl, .obj)
                      </Typography>
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary" align="center">
                      클릭하거나 파일을 드래그하세요. (.glb, .gltf, .stl, .obj)
                    </Typography>
                  )}
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<UploadFileIcon />}
                    disabled={uploading}
                    onClick={(e) => {
                      e.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                  >
                    {isEditing ? '파일 교체' : '파일 선택'}
                  </Button>
                </Box>
                {uploading && (
                  <Box sx={{ width: '100%' }}>
                    <LinearProgress
                      variant={uploadProgress > 0 ? 'determinate' : 'indeterminate'}
                      value={uploadProgress}
                    />
                    <Typography variant="caption" color="text.secondary">
                      업로드 중… {uploadProgress}%
                    </Typography>
                  </Box>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button
                color="inherit"
                disabled={uploading}
                onClick={() => {
                  setUploadOpen(false)
                  resetUploadDialog()
                }}
              >
                취소
              </Button>
              <Button
                variant="contained"
                disabled={uploading || (!isEditing && !pickedFile)}
                onClick={handleSubmit}
              >
                {isEditing ? '수정' : '업로드'}
              </Button>
            </DialogActions>
          </Dialog>
        </Paper>
      </Box>
    </Box>
  )
}

export default function MakerPlan3dIndexPage() {
  const { id } = useParams<{ id?: string }>()
  const dataId = id ? Number(id) : NaN
  if (id && !Number.isNaN(dataId)) {
    return <MakerPlan3dDetail dataId={dataId} />
  }
  return <MakerPlan3dList />
}
