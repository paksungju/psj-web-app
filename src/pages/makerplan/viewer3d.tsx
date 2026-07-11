import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import TopBar from '../../components/TopBar'

const ACCEPTED = '.glb,.gltf,.stl,.obj'

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

export default function MakerPlan3dViewerPage() {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const modelRef = useRef<THREE.Object3D | null>(null)
  const frameRef = useRef<number>(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const clearModel = useCallback(() => {
    const scene = sceneRef.current
    if (scene && modelRef.current) {
      scene.remove(modelRef.current)
      disposeObject(modelRef.current)
      modelRef.current = null
    }
  }, [])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf4f6f8)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000)
    camera.position.set(3, 2, 5)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controlsRef.current = controls

    const hemi = new THREE.HemisphereLight(0xffffff, 0xb0b8c0, 1.1)
    scene.add(hemi)
    const dir = new THREE.DirectionalLight(0xffffff, 1.2)
    dir.position.set(5, 10, 7)
    scene.add(dir)
    scene.add(new THREE.AmbientLight(0xffffff, 0.35))

    const grid = new THREE.GridHelper(10, 20, 0xcbd5e1, 0xe2e8f0)
    scene.add(grid)

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
      frameRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameRef.current)
      ro.disconnect()
      clearModel()
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
      sceneRef.current = null
      cameraRef.current = null
      rendererRef.current = null
      controlsRef.current = null
    }
  }, [clearModel])

  const loadObject = useCallback(
    (object: THREE.Object3D, name: string) => {
      const scene = sceneRef.current
      const camera = cameraRef.current
      const controls = controlsRef.current
      if (!scene || !camera || !controls) return

      clearModel()
      scene.add(object)
      modelRef.current = object
      fitCameraToObject(camera, controls, object)
      setFileName(name)
      setError(null)
    },
    [clearModel],
  )

  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!['glb', 'gltf', 'stl', 'obj'].includes(ext)) {
        setError('지원 형식: .glb, .gltf, .stl, .obj')
        return
      }

      setLoading(true)
      setError(null)
      const url = URL.createObjectURL(file)

      try {
        if (ext === 'glb' || ext === 'gltf') {
          const gltf = await new GLTFLoader().loadAsync(url)
          loadObject(gltf.scene, file.name)
        } else if (ext === 'stl') {
          const geometry = await new STLLoader().loadAsync(url)
          geometry.computeVertexNormals()
          const mesh = new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.15, roughness: 0.55 }),
          )
          loadObject(mesh, file.name)
        } else {
          const obj = await new OBJLoader().loadAsync(url)
          obj.traverse((child) => {
            if (child instanceof THREE.Mesh && !child.material) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0x64748b,
                metalness: 0.15,
                roughness: 0.55,
              })
            }
          })
          loadObject(obj, file.name)
        }
      } catch (e) {
        console.error(e)
        setError('파일을 불러오지 못했습니다. 형식을 확인해 주세요.')
      } finally {
        URL.revokeObjectURL(url)
        setLoading(false)
      }
    },
    [loadObject],
  )

  const handleReset = () => {
    clearModel()
    setFileName(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (camera && controls) {
      camera.position.set(3, 2, 5)
      controls.target.set(0, 0, 0)
      controls.update()
    }
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
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
          3D 파일 뷰어
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          GLB / GLTF / STL / OBJ 파일을 열어 회전·확대·축소로 확인할 수 있습니다.
        </Typography>

        <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap">
          <Button
            variant="outlined"
            size="small"
            startIcon={<UploadFileIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            sx={{
              backgroundColor: '#fff',
              borderColor: 'grey.400',
              color: 'text.primary',
            }}
          >
            파일 열기
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RestartAltIcon />}
            onClick={handleReset}
            disabled={!fileName && !error}
            sx={{
              backgroundColor: '#fff',
              borderColor: 'grey.400',
              color: 'text.primary',
            }}
          >
            초기화
          </Button>
          {fileName && (
            <Typography variant="body2" color="text.secondary">
              {fileName}
            </Typography>
          )}
          {loading && (
            <Typography variant="body2" color="text.secondary">
              불러오는 중…
            </Typography>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleFile(f)
            }}
          />
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Paper
          variant="outlined"
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            flex: 1,
            minHeight: 480,
            position: 'relative',
          }}
        >
          <Box
            ref={mountRef}
            sx={{ width: '100%', height: 'min(70vh, 720px)', minHeight: 480 }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files?.[0]
              if (f) void handleFile(f)
            }}
          />
          {!fileName && !loading && (
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
              <Typography variant="body2" color="text.secondary">
                파일을 선택하거나 여기로 드래그하세요
              </Typography>
            </Box>
          )}
        </Paper>
      </Paper>
    </Box>
  )
}
