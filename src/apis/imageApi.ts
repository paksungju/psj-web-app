export interface UploadImageResponse {
  file_id: number
  image_group_id: number
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
  menu_cd?: string
  data_id?: number
  cate1_cd?: string | null
}

export interface ApiImage extends UploadImageResponse {}

export interface FetchImagesResponse {
  items: ApiImage[]
  total: number
}

export async function uploadImageApiWithProgress(
  params: {
    file: File
    menuCd?: string
    dataId?: number
    cate1Cd?: string
    fileNo?: number
    fileType?: number
    description?: string
    save_path?: string
  },
  onProgress?: (loaded: number, total: number) => void,
): Promise<UploadImageResponse> {
  const {
    file,
    menuCd = 'gallery',
    dataId = -999,
    cate1Cd,
    fileNo = 1,
    fileType = 0,
    description = '',
    save_path = 'gallery',
  } = params

  const formData = new FormData()
  formData.append('menu_cd', menuCd)
  formData.append('data_id', String(dataId))
  if (cate1Cd) formData.append('cate1_cd', cate1Cd)
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
          const data = JSON.parse(xhr.responseText) as UploadImageResponse
          resolve(data)
        } catch {
          reject(new Error('Failed to parse response'))
        }
      } else {
        reject(new Error('Failed to upload image'))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Failed to upload image')))
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))

    xhr.open('POST', 'http://impsj.net/api/v1/images/upload')
    xhr.send(formData)
  })
}

export async function uploadImageApi(
  params: Parameters<typeof uploadImageApiWithProgress>[0],
): Promise<UploadImageResponse> {
  return uploadImageApiWithProgress(params)
}

export async function fetchImagesByDataApi(params: {
  menuCd: string
  dataId: number
  cate1Cd?: string
  skip?: number
  limit?: number
}): Promise<FetchImagesResponse> {
  const { menuCd, dataId, cate1Cd, skip = 0, limit = 200 } = params

  const search = new URLSearchParams()
  search.set('menu_cd', menuCd)
  search.set('data_id', String(dataId))
  if (cate1Cd) search.set('cate1_cd', cate1Cd)
  search.set('skip', String(skip))
  search.set('limit', String(limit))

  const response = await fetch(`http://impsj.net/api/v1/images/by-data?${search.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch images')
  }

  return (await response.json()) as FetchImagesResponse
}

export async function deleteImagesApi(params: { fileIds: number[] }): Promise<void> {
  const { fileIds } = params

  const response = await fetch(`http://impsj.net/api/v1/images/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds }),
  })

  if (!response.ok) {
    throw new Error('Failed to delete images')
  }
}
