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
    tbCode?: string
    dataId?: number
    fileNo?: number
    fileType?: number
    description?: string
    save_path?: string
  },
  onProgress?: (loaded: number, total: number) => void,
): Promise<UploadFileResponse> {
  const { file, tbCode = 'gallery', dataId = 0, fileNo = 1, fileType = 0, description = '', save_path = 'gallery' } = params

  const formData = new FormData()
  formData.append('tb_code', tbCode)
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
 * GET http://impsj.net/api/v1/files/by-data?tb_code=...&data_id=...&skip=...&limit=...
 */
export async function fetchFilesByDataApi(params: {
  tbCode: string
  dataId: number
  skip?: number
  limit?: number
}): Promise<FetchFilesResponse> {
  const { tbCode, dataId, skip = 0, limit = 20 } = params

  const search = new URLSearchParams()
  search.set('tb_code', tbCode)
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
