export interface ApiAccount {
  acSubject: string
  acLoginId: string
  acLoginPw: string | null
  acMemo: string | null
  sortNo: number
  acLevel: number | null
  delFlag: number | null
  acId: number
  createdAt: string
}

export async function fetchAccountsApi(): Promise<ApiAccount[]> {
  const response = await fetch('http://impsj.net/api/v1/accounts/')
  if (!response.ok) {
    throw new Error('Failed to fetch accounts')
  }

  // 서버 응답이 이미 카멜 케이스(ApiAccount) 형식이라고 가정
  const data = (await response.json()) as ApiAccount[]
  return data
}

export async function fetchAccountDetailApi(acId: number): Promise<ApiAccount> {
  const response = await fetch(`http://impsj.net/api/v1/accounts/${acId}`)
  if (!response.ok) {
    throw new Error('Failed to fetch account detail')
  }

  const data = (await response.json()) as ApiAccount
  return data
}

