export interface UploadFileResponse {
  file_id: number
  board_id: number
  data_id: number
  file_no: number
  file_name: string
  file_enc_name: string
  file_path: string
  file_url: string
  download: number
  content: string
  filesize: number
  width: number
  height: number
  type: number
  created_at: string
}

export interface ApiFile {
  file_id: number
  board_id: number
  data_id: number
  file_no: number
  file_name: string
  file_enc_name: string
  file_path: string
  file_url: string
  download: number
  content: string
  filesize: number
  width: number
  height: number
  type: number
  created_at: string
}

/**
 * 파일 업로드 API (업로드 진행률 콜백 지원)
 * POST http://impsj.net/api/v1/files/upload
 */
export async function uploadFileApiWithProgress(
  params: {
    file: File
    menuCd?: string
    dataId?: number
    fileNo?: number
    fileType?: number
    description?: string
    save_path?: string
  },
  onProgress?: (loaded: number, total: number) => void,
): Promise<UploadFileResponse> {
  const { file, menuCd = 'gallery', dataId = 0, fileNo = 1, fileType = 0, description = '', save_path = 'gallery' } = params

  const formData = new FormData()
  formData.append('menu_cd', menuCd)
  formData.append('data_id', String(dataId))
  formData.append('file_no', String(fileNo))
  formData.append('file_type', String(fileType))
  formData.append('description', description || file.name)
  formData.append('file', file)
  formData.append('save_path', save_path)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(e.loaded, e.total)
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as UploadFileResponse
          resolve(data)
        } catch {
          reject(new Error('Failed to parse response'))
        }
      } else {
        reject(new Error('Failed to upload file'))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Failed to upload file')))
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))

    xhr.open('POST', 'http://impsj.net/api/v1/files/upload')
    xhr.send(formData)
  })
}

/**
 * 청크 분할 업로드 API
 * 1) /init -> upload_id
 * 2) /chunk 반복
 * 3) /complete
 */
export async function uploadFileApiChunkedWithProgress(
  params: {
    file: File
    menuCd?: string
    dataId?: number
    fileNo?: number
    fileType?: number
    description?: string
    save_path?: string
    chunkSize?: number
  },
  onProgress?: (loaded: number, total: number) => void,
  options?: {
    signal?: AbortSignal
    onUploadId?: (uploadId: string) => void
  },
): Promise<UploadFileResponse> {
  const {
    file,
    menuCd = 'gallery',
    dataId = 0,
    fileNo = 1,
    fileType = 0,
    description = '',
    save_path = 'gallery',
    chunkSize = 8 * 1024 * 1024,
  } = params

  if (options?.signal?.aborted) {
    throw new DOMException('Upload aborted', 'AbortError')
  }

  const initRes = await fetch('http://impsj.net/api/v1/files/upload/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      menu_cd: menuCd,
      data_id: dataId,
      file_no: fileNo,
      file_type: fileType,
      description: description || file.name,
      save_path,
      filename: file.name,
      filesize: file.size,
      chunk_size: chunkSize,
    }),
  })
  if (!initRes.ok) {
    throw new Error('Failed to init chunk upload')
  }
  const initJson = (await initRes.json()) as { upload_id: string }
  const uploadId = initJson.upload_id
  if (!uploadId) {
    throw new Error('Invalid upload id')
  }
  options?.onUploadId?.(uploadId)

  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize))
  let loadedTotal = 0

  for (let idx = 0; idx < totalChunks; idx++) {
    if (options?.signal?.aborted) {
      try {
        await abortChunkUpload(uploadId)
      } catch {
        // best effort
      }
      throw new DOMException('Upload aborted', 'AbortError')
    }
    const start = idx * chunkSize
    const end = Math.min(file.size, start + chunkSize)
    const blob = file.slice(start, end)

    const formData = new FormData()
    formData.append('upload_id', uploadId)
    formData.append('chunk_index', String(idx))
    formData.append('chunk', blob, `${file.name}.part${idx}`)

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const currentChunkLoaded = e.loaded
          const aggregate = Math.min(file.size, loadedTotal + currentChunkLoaded)
          onProgress(aggregate, file.size)
        }
      })
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error(`Failed to upload chunk ${idx}`))
      })
      xhr.addEventListener('error', () => reject(new Error(`Failed to upload chunk ${idx}`)))
      if (options?.signal) {
        const onAbort = () => {
          try {
            xhr.abort()
          } catch {
            // noop
          }
          reject(new DOMException('Upload aborted', 'AbortError'))
        }
        options.signal.addEventListener('abort', onAbort, { once: true })
      }
      xhr.open('POST', 'http://impsj.net/api/v1/files/upload/chunk')
      xhr.send(formData)
    })

    loadedTotal += blob.size
    if (onProgress) onProgress(loadedTotal, file.size)
  }

  const completeRes = await fetch(
    `http://impsj.net/api/v1/files/upload/complete?upload_id=${encodeURIComponent(uploadId)}&total_chunks=${totalChunks}`,
    { method: 'POST' },
  )
  if (!completeRes.ok) {
    throw new Error('Failed to complete chunk upload')
  }
  return (await completeRes.json()) as UploadFileResponse
}

export async function abortChunkUpload(uploadId: string): Promise<void> {
  const response = await fetch(
    `http://impsj.net/api/v1/files/upload/abort?upload_id=${encodeURIComponent(uploadId)}`,
    { method: 'POST' },
  )
  if (!response.ok) {
    throw new Error('Failed to abort chunk upload')
  }
}

/** 진행률 없이 업로드 (기존 호환용) */
export async function uploadFileApi(params: Parameters<typeof uploadFileApiWithProgress>[0]): Promise<UploadFileResponse> {
  return uploadFileApiWithProgress(params)
}

export interface FetchFilesResponse {
  items: ApiFile[]
  total: number
}

/**
 * 저장된 파일 목록 조회 (최신순, 페이징)
 * GET http://impsj.net/api/v1/files/by-data?menu_cd=...&data_id=...&skip=...&limit=...
 */
export async function fetchFilesByDataApi(params: {
  menuCd: string
  dataId: number
  skip?: number
  limit?: number
}): Promise<FetchFilesResponse> {
  const { menuCd, dataId, skip = 0, limit = 20 } = params

  const search = new URLSearchParams()
  search.set('menu_cd', menuCd)
  search.set('data_id', String(dataId))
  search.set('skip', String(skip))
  search.set('limit', String(limit))

  const response = await fetch(
    `http://impsj.net/api/v1/files/by-data?${search.toString()}`,
  )
  if (!response.ok) {
    throw new Error('Failed to fetch files')
  }

  return (await response.json()) as FetchFilesResponse
}

export async function deleteFilesApi(params: {
  fileIds: number[]
}): Promise<void> {
  const { fileIds } = params

  const response = await fetch(`http://impsj.net/api/v1/files/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds }),
  })

  if (!response.ok) {
    throw new Error('Failed to delete files')
  }
}
