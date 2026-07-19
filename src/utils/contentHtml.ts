import hljs from 'highlight.js'
import type { SxProps, Theme } from '@mui/material'

/** ap_content HTML 내 이미지 src에 도메인 추가 */
export function processContentHtml(html: string): string {
  if (!html) return ''
  return html.replace(
    /<img([^>]*)\ssrc=["']([^"']+)["']/gi,
    (match, attrs: string, src: string) => {
      if (src.startsWith('http')) return match
      const path = src.startsWith('/') ? src : `/${src}`
      return `<img${attrs} src="http://impsj.net${path}"`
    },
  )
}

/** 렌더링된 본문 내 코드 블록에 구문 강조 적용 */
export function highlightCodeBlocks(root: HTMLElement | null): void {
  if (!root) return
  root.querySelectorAll<HTMLElement>('pre code').forEach((el) => {
    delete el.dataset.highlighted
    hljs.highlightElement(el)
  })
}

/** ap_content 렌더링 공통 스타일 (CKEditor 출력 기준) */
export const CONTENT_HTML_SX: SxProps<Theme> = {
  overflow: 'hidden',
  wordBreak: 'break-word',
  '& img': {
    maxWidth: '100%',
    height: 'auto',
    objectFit: 'contain',
  },
  '& figure': {
    margin: '0.5em 0',
    maxWidth: '100%',
  },
  '& figure img': {
    maxWidth: '100%',
  },
  '& p': { margin: '0 0 0.75em' },
  '& .image-style-align-left': { float: 'left', marginRight: 2, marginBottom: 1, maxWidth: '100%' },
  '& .image-style-align-right': { float: 'right', marginLeft: 2, marginBottom: 1, maxWidth: '100%' },
  '& .image-style-align-center': { display: 'block', marginLeft: 'auto', marginRight: 'auto', textAlign: 'center', maxWidth: '100%' },
  '& .image-style-align-block-left': { display: 'block', marginRight: 'auto', marginLeft: 0, maxWidth: '100%' },
  '& .image-style-align-block-right': { display: 'block', marginLeft: 'auto', marginRight: 0, maxWidth: '100%' },
  '& figure::after': { content: '""', display: 'table', clear: 'both' },
  '& pre': {
    backgroundColor: 'grey.100',
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 1,
    padding: 1.5,
    margin: '0.75em 0',
    overflowX: 'auto',
    fontSize: 13,
    lineHeight: 1.6,
  },
  '& pre code': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    backgroundColor: 'transparent',
    padding: 0,
    whiteSpace: 'pre',
  },
  '& code': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    backgroundColor: 'grey.100',
    borderRadius: '3px',
    padding: '0.15em 0.35em',
    fontSize: '0.9em',
  },
}
