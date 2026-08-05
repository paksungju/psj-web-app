import hljs from 'highlight.js'
import { randomUUID } from './randomUUID'

/** 삽입한 코드 블록을 나중에 다시 찾아내기 위한 표식 */
export const CODE_BLOCK_ATTR = 'data-code-block'
const CODE_LANG_ATTR = 'data-code-lang'

/** 코드 삽입 모달에서 선택 가능한 언어 */
export const CODE_LANGUAGES = [
  { language: 'plaintext', label: '일반 텍스트' },
  { language: 'javascript', label: 'JavaScript' },
  { language: 'typescript', label: 'TypeScript' },
  { language: 'python', label: 'Python' },
  { language: 'java', label: 'Java' },
  { language: 'csharp', label: 'C#' },
  { language: 'cpp', label: 'C++' },
  { language: 'sql', label: 'SQL' },
  { language: 'xml', label: 'HTML/XML' },
  { language: 'css', label: 'CSS' },
  { language: 'json', label: 'JSON' },
  { language: 'bash', label: 'Shell/Bash' },
] as const

/**
 * CKEditor의 CodeBlock 플러그인은 <pre><code>를 자기 모델로 변환하면서
 * 자식을 $text만 허용하기 때문에 내부 <span>이 전부 제거된다.
 * 그래서 코드 블록을 pre/code가 아닌 div + table 구조로 만든다.
 * 줄 번호를 별도 셀에 두면 코드만 드래그해서 복사할 수 있다.
 */
const CODE_FONT_FAMILY =
  '"D2Coding","D2Coding ligature",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'

const WRAPPER_STYLE = [
  'background:#0d1117',
  'border:1px solid #30363d',
  'border-radius:6px',
  'padding:12px',
  'margin:12px 0',
  'overflow-x:auto',
  `font-family:${CODE_FONT_FAMILY}`,
  'font-size:13px',
  'line-height:1.6',
].join(';')

const TABLE_STYLE = 'border-collapse:collapse;border:none;width:100%'

const LINE_NO_STYLE = [
  'padding:0 12px 0 0',
  'border:none',
  'border-right:1px solid #30363d',
  'text-align:right',
  'vertical-align:top',
  'color:#6e7681',
  'white-space:nowrap',
  'width:1%',
  'user-select:none',
  '-webkit-user-select:none',
].join(';')

const LINE_CODE_STYLE = [
  'padding:0 0 0 16px',
  'border:none',
  'vertical-align:top',
  'white-space:pre-wrap',
  'word-break:break-word',
].join(';')

/**
 * 코드를 구문 강조된 HTML로 변환한다.
 * hljs가 붙인 클래스를 화면에 적용된 실제 색상으로 읽어 인라인 style로 박아넣기 때문에,
 * CSS가 없는 곳(에디터 내부, 외부 붙여넣기)에서도 색상이 유지된다.
 * 색상은 import된 highlight.js 테마를 그대로 따라간다.
 */
export function codeToInlineHtml(code: string, language: string, blockId?: string): string {
  // 등록되지 않은 언어면 hljs.highlight가 예외를 던지므로 색상 없이 처리한다.
  let highlighted: string
  if (language === 'plaintext' || !hljs.getLanguage(language)) {
    highlighted = escapeHtml(code)
  } else {
    try {
      highlighted = hljs.highlight(code, { language, ignoreIllegals: true }).value
    } catch {
      highlighted = escapeHtml(code)
    }
  }

  // 계산된 색상을 읽으려면 테마 CSS가 적용된 실제 문서에 붙어 있어야 한다.
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-9999px;top:0;visibility:hidden'
  host.innerHTML = `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`
  document.body.appendChild(host)

  try {
    const codeEl = host.querySelector('code')
    if (!codeEl) return ''

    codeEl.querySelectorAll<HTMLElement>('span').forEach((span) => {
      const computed = window.getComputedStyle(span)
      const parts = [`color:${computed.color}`]
      if (computed.fontWeight === 'bold' || Number(computed.fontWeight) >= 600) {
        parts.push('font-weight:bold')
      }
      if (computed.fontStyle === 'italic') parts.push('font-style:italic')
      span.setAttribute('style', parts.join(';'))
      span.removeAttribute('class')
    })
    const baseColor = window.getComputedStyle(codeEl).color

    // 색상을 다 읽은 뒤 pre/code를 버리고 div + table 구조로 옮긴다.
    const wrapper = document.createElement('div')
    wrapper.setAttribute('style', `${WRAPPER_STYLE};color:${baseColor}`)
    wrapper.setAttribute(CODE_BLOCK_ATTR, blockId ?? randomUUID())
    wrapper.setAttribute(CODE_LANG_ATTR, language)

    const table = document.createElement('table')
    table.setAttribute('style', TABLE_STYLE)
    const tbody = document.createElement('tbody')

    splitIntoLines(codeEl).forEach((line, index) => {
      const row = document.createElement('tr')

      const lineNo = document.createElement('td')
      lineNo.setAttribute('style', LINE_NO_STYLE)
      lineNo.textContent = String(index + 1)

      const lineCode = document.createElement('td')
      lineCode.setAttribute('style', LINE_CODE_STYLE)
      lineCode.appendChild(line)

      row.append(lineNo, lineCode)
      tbody.appendChild(row)
    })

    table.appendChild(tbody)
    wrapper.appendChild(table)

    return wrapper.outerHTML
  } finally {
    host.remove()
  }
}

/**
 * 강조된 DOM을 줄 단위 fragment로 쪼갠다.
 * 블록 주석처럼 하나의 span이 여러 줄에 걸치는 경우가 있으므로,
 * 줄이 나뉠 때마다 감싸고 있던 span을 복제해 색상이 끊기지 않게 한다.
 */
function splitIntoLines(source: Node): DocumentFragment[] {
  const lines: DocumentFragment[] = [document.createDocumentFragment()]
  const current = () => lines[lines.length - 1] as DocumentFragment

  for (const child of Array.from(source.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const parts = (child.nodeValue ?? '').split('\n')
      parts.forEach((part, i) => {
        if (i > 0) lines.push(document.createDocumentFragment())
        if (part !== '') current().appendChild(document.createTextNode(preserveSpaces(part)))
      })
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue

    const el = child as HTMLElement
    splitIntoLines(el).forEach((frag, i) => {
      if (i > 0) lines.push(document.createDocumentFragment())
      if (!frag.hasChildNodes()) return
      const clone = el.cloneNode(false) as HTMLElement
      clone.appendChild(frag)
      current().appendChild(clone)
    })
  }

  return lines
}

/** 연속된 공백이 접히지 않도록 두 칸마다 non-breaking space를 섞는다. */
function preserveSpaces(text: string): string {
  return text.replace(/ {2}/g, ' \u00a0')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** 삽입된 코드 블록에서 원본 코드와 언어를 되돌린다. (수정 흐름용) */
export function extractCodeFromBlock(block: HTMLElement): { code: string; language: string } {
  const rows = Array.from(block.querySelectorAll('tr'))
  const code = rows
    // 각 행의 두 번째 셀이 코드, 첫 번째 셀은 줄 번호라 버린다.
    .map((row) => row.querySelectorAll('td')[1]?.textContent ?? '')
    .join('\n')
    // 삽입 시 섞어 넣은 non-breaking space를 일반 공백으로 되돌린다.
    .replace(/ /g, ' ')
  return {
    code,
    language: block.getAttribute('data-code-lang') || 'plaintext',
  }
}
