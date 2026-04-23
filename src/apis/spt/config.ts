// API 서버의 기본 URL을 정의하는 공통 설정 파일입니다.
// 다른 API 모듈에서는 `import { apiUrl } from './config'` 형태로 사용합니다.

// 개발 환경에서는 Vite dev 서버의 프록시(`/api` → impsj 서버)를 사용해서
// CORS 에러를 피하기 위해 **도메인을 붙이지 않고** 상대 경로로 호출합니다.
// 필요하면 .env 파일에 VITE_API_BASE_URL를 직접 지정해서 사용할 수도 있습니다.
export const apiUrl =
  (import.meta as any).env?.VITE_API_BASE_URL ?? ''

