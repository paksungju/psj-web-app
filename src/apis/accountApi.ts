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

// 업데이트 요청이 snake_case로 오는 경우도 있어 허용
export type ApiAccountUpdatePayload =
  | Partial<ApiAccount>
  | Partial<{
      ac_id: number
      ac_subject: string
      ac_login_id: string
      ac_login_pw: string | null
      ac_memo: string | null
      sort_no: number
      ac_level: number | null
      del_flag: number | null
      created_at: string
    }>

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

export async function updateAccountApi(acId: number, payload: ApiAccountUpdatePayload): Promise<void> {

  const response = await fetch(`http://impsj.net/api/v1/accounts/${acId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Failed to update account')
  }
}

export async function createAccountApi(payload: ApiAccountUpdatePayload): Promise<ApiAccount> {
  const response = await fetch(`http://impsj.net/api/v1/accounts/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Failed to create account')
  }

  const data = (await response.json()) as ApiAccount
  return data
}

