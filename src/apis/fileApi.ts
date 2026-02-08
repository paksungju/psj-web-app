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
 * 파일 업로드 API
 * POST http://impsj.net/api/v1/files/upload
 */
export async function uploadFileApi(params: {
  file: File
  tbCode?: string
  dataId?: number
  fileNo?: number
  fileType?: number
  description?: string
  save_path?: string
}): Promise<UploadFileResponse> {
  const { file, tbCode = 'gallery', dataId = 0, fileNo = 1, fileType = 0, description = '', save_path = 'gallery' } = params

  const formData = new FormData()
  formData.append('tb_code', tbCode)
  formData.append('data_id', String(dataId))
  formData.append('file_no', String(fileNo))
  formData.append('file_type', String(fileType))
  formData.append('description', description || file.name)
  formData.append('file', file)
  formData.append('save_path', save_path)

  const response = await fetch('http://impsj.net/api/v1/files/upload', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error('Failed to upload file')
  }

  const data = (await response.json()) as UploadFileResponse
  return data
}

/**
 * 저장된 파일 목록 조회
 * GET http://impsj.net/api/v1/files/by-data?tb_code=...&data_id=...
 */
export async function fetchFilesByDataApi(params: {
  tbCode: string
  dataId: number
}): Promise<ApiFile[]> {
  const { tbCode, dataId } = params

  const response = await fetch(
    `http://impsj.net/api/v1/files/by-data?tb_code=${tbCode}&data_id=${dataId}`,
  )
  if (!response.ok) {
    throw new Error('Failed to fetch files')
  }

  const data = (await response.json()) as ApiFile[]
  return data
}

export async function deleteFilesApi(params: {
  fileIds: number[]
}): Promise<void> {
  const { fileIds } = params

  const response = await fetch(`http://impsj.net/api/v1/files/delete`, {
    method: 'DELETE',
    body: JSON.stringify({ fileIds }),
  })
}
