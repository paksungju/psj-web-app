export interface UploadImageResponse {
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

export interface ApiImage {
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

export async function uploadImageApi(params: {
  file: File
  menuCd?: string
  dataId?: number
  fileNo?: number
  fileType?: number
  description?: string
  save_path?: string
}): Promise<UploadImageResponse> {
  const {
    file,
    menuCd = 'gallery',
    dataId = 0,
    fileNo = 1,
    fileType = 0,
    description = '',
    save_path = 'gallery',
  } = params

  const formData = new FormData()
  formData.append('tb_code', menuCd)
  formData.append('data_id', String(dataId))
  formData.append('file_no', String(fileNo))
  formData.append('file_type', String(fileType))
  formData.append('description', description || file.name)
  formData.append('file', file)
  formData.append('save_path', save_path)

  const response = await fetch('http://impsj.net/api/v1/images/upload', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error('Failed to upload image')
  }

  return (await response.json()) as UploadImageResponse
}

export async function fetchImagesByDataApi(params: {
  menuCd: string
  dataId: number
}): Promise<ApiImage[]> {
  const { menuCd, dataId } = params

  const response = await fetch(
    `http://impsj.net/api/v1/images/by-data?tb_code=${menuCd}&data_id=${dataId}`,
  )
  if (!response.ok) {
    throw new Error('Failed to fetch images')
  }

  return (await response.json()) as ApiImage[]
}

export async function deleteImagesApi(params: {
  fileIds: number[]
}): Promise<void> {
  const { fileIds } = params

  await fetch('http://impsj.net/api/v1/images/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileIds }),
  })
}
