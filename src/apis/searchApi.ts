export interface ApiSearch {
	sid: number,
	tb_name: string,
	tb_id: number,
	subject: string,
	url: string,
	regist_dt: string
  }
  
  // 업데이트 요청이 snake_case로 오는 경우도 있어 허용
  export type ApiSearchUpdatePayload =
    | Partial<ApiSearch>
    | Partial<{
        sid: number
        tb_name: string
        tb_id: number
        subject: string
        url: string
        regist_dt: string
      }>
  
    export async function fetchSearchApi(keyword: string): Promise<ApiSearch[]> {
    const response = await fetch(`http://impsj.net/api/v1/search/?keyword=${encodeURIComponent(keyword)}`)
    if (!response.ok) {
      throw new Error('Failed to fetch search')
    }
  
    const data = (await response.json()) as ApiSearch[]
    return data
  }
  