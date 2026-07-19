import { useCallback, useMemo, useRef, useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CodeIcon from '@mui/icons-material/Code'
import { CKEditor } from '@ckeditor/ckeditor5-react'
import {
  ClassicEditor,
  Essentials,
  Paragraph,
  Bold,
  Italic,
  Code,
  FontColor,
  Image,
  ImageInsert,
  ImageResize,
  ImageToolbar,
  ImageStyle,
  Alignment,
  GeneralHtmlSupport,
  type Editor,
  type MatcherObjectPattern,
} from 'ckeditor5'
import 'ckeditor5/ckeditor5.css'
import 'highlight.js/styles/github.css'
import {
  codeToInlineHtml,
  extractCodeFromBlock,
  CODE_LANGUAGES,
  CODE_BLOCK_ATTR,
} from '../utils/codeToInlineHtml'

/**
 * 본문 HTML에서 해당 id의 코드 블록만 새 HTML로 교체한다.
 * 모델을 직접 다루는 대신 HTML 단계에서 바꾸므로 CKEditor 내부 구조에 의존하지 않는다.
 */
function replaceCodeBlock(html: string, blockId: string, nextHtml: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const container = doc.body.firstElementChild
  if (!container) return html
  const target = container.querySelector(`[${CODE_BLOCK_ATTR}="${blockId}"]`)
  if (!target) return html
  target.outerHTML = nextHtml
  return container.innerHTML
}

/**
 * HTML을 현재 선택 위치에 삽입한다.
 * setData()와 달리 하나의 배치로 처리되어 실행 취소 이력이 유지된다.
 */
function insertHtmlAtSelection(editor: Editor, html: string): void {
  const viewFragment = editor.data.processor.toView(html)
  const modelFragment = editor.data.toModel(viewFragment)
  editor.model.insertContent(modelFragment)
}

/** 편집 영역의 코드 블록 DOM을 찾아 대응하는 모델 요소로 매핑한다. */
function findCodeBlockModelElement(editor: Editor, blockId: string) {
  const editable = editor.ui.getEditableElement()
  const dom = editable?.querySelector<HTMLElement>(`[${CODE_BLOCK_ATTR}="${blockId}"]`)
  if (!dom) return null
  const view = editor.editing.view.domConverter.mapDomToView(dom)
  if (!view || !view.is('element')) return null
  return editor.editing.mapper.toModelElement(view) ?? null
}

/**
 * 문서 맨 끝에 빈 문단을 만들고 커서를 옮긴다.
 * 코드 블록(GHS로 들어온 div)은 위젯이 아니라서 문서 끝에 있으면
 * 그 뒤에 커서를 놓을 자리가 없어 내용을 이어 쓸 수 없다.
 */
function appendTrailingParagraph(editor: Editor): void {
  editor.model.change((writer) => {
    const root = editor.model.document.getRoot()
    if (!root) return
    const paragraph = writer.createElement('paragraph')
    writer.insert(paragraph, root, 'end')
    writer.setSelection(paragraph, 'in')
  })
  editor.editing.view.focus()
}

/** CKEditor GeneralHtmlSupport의 허용 규칙 타입 */
export type HtmlSupportAllowRule = MatcherObjectPattern

/**
 * 코드 삽입 시 박아넣은 인라인 색상이 필터링되지 않도록 허용하는 최소 규칙.
 * 더 넓은 HTML이 필요한 화면은 htmlSupportAllow로 직접 넘긴다.
 */
export const DEFAULT_HTML_SUPPORT_ALLOW: HtmlSupportAllowRule[] = [
  { name: 'div', styles: true, classes: true, attributes: true },
  { name: 'span', styles: true, classes: true },
  { name: 'br' },
  // 줄 번호를 코드와 다른 셀에 두기 위한 테이블 구조
  { name: /^(table|tbody|tr|td)$/, styles: true, classes: true, attributes: true },
]

export type RichTextEditorProps = {
  value: string
  onChange: (data: string) => void
  /** 헤더 좌측에 표시할 라벨. 생략하면 라벨 없이 버튼만 표시된다. */
  label?: React.ReactNode
  /** CKEditor 인스턴스를 재생성해야 할 때 바꿔주는 키 (기존 key prop과 동일한 역할) */
  editorKey?: string | number
  /** 편집 영역 최소 높이 */
  minHeight?: number
  /** 글자 색상 버튼 노출 여부 */
  fontColor?: boolean
  /** 코드 삽입 버튼 노출 여부 */
  enableCodeBlock?: boolean
  /** 이미지 삽입 등 외부에서 에디터 인스턴스가 필요할 때 */
  onReady?: (editor: Editor) => void
  /** GeneralHtmlSupport 허용 규칙. 생략하면 코드 블록에 필요한 최소 규칙만 적용된다. */
  htmlSupportAllow?: HtmlSupportAllowRule[]
}

/**
 * CKEditor 기반 본문 편집기.
 * 코드 삽입(구문 강조 + 줄 번호) 기능을 포함하며, 여러 등록 폼에서 공용으로 사용한다.
 */
export default function RichTextEditor({
  value,
  onChange,
  label,
  editorKey,
  minHeight = 300,
  fontColor = true,
  enableCodeBlock = true,
  onReady,
  htmlSupportAllow = DEFAULT_HTML_SUPPORT_ALLOW,
}: RichTextEditorProps) {
  const editorRef = useRef<Editor | null>(null)
  const [codeDialogOpen, setCodeDialogOpen] = useState(false)
  const [codeText, setCodeText] = useState('')
  const [codeLang, setCodeLang] = useState<string>('javascript')
  /** 수정 중인 코드 블록의 id. null이면 새로 삽입한다. */
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null)

  /** 변환은 DOM 조작 + getComputedStyle을 동반하므로 입력마다 재계산하지 않는다. */
  const codeHtml = useMemo(
    () =>
      codeDialogOpen && codeText.trim() !== ''
        ? codeToInlineHtml(codeText, codeLang, editingCodeId ?? undefined)
        : '',
    [codeDialogOpen, codeText, codeLang, editingCodeId],
  )

  /** 코드 블록을 더블클릭하면 원본 코드를 복원해 수정 모달을 연다. */
  const handleCodeBlockDblClick = useCallback((event: MouseEvent) => {
    const target = event.target as HTMLElement | null
    const block = target?.closest<HTMLElement>(`[${CODE_BLOCK_ATTR}]`)
    if (!block) return
    const blockId = block.getAttribute(CODE_BLOCK_ATTR)
    if (!blockId) return

    event.preventDefault()
    const { code, language } = extractCodeFromBlock(block)
    setCodeText(code)
    setCodeLang(language)
    setEditingCodeId(blockId)
    setCodeDialogOpen(true)
  }, [])

  const closeCodeDialog = useCallback(() => {
    setCodeDialogOpen(false)
    setCodeText('')
    setEditingCodeId(null)
  }, [])

  const handleInsertCode = useCallback(() => {
    if (!codeText.trim()) {
      alert('삽입할 코드를 입력해 주세요.')
      return
    }
    if (!codeHtml) {
      alert('코드 변환에 실패했습니다.')
      return
    }
    const editor = editorRef.current
    if (!editor) {
      // 에디터가 아직 준비되지 않은 경우에만 값을 직접 갱신한다.
      onChange(
        editingCodeId
          ? replaceCodeBlock(value ?? '', editingCodeId, codeHtml)
          : (value ?? '') + codeHtml,
      )
      closeCodeDialog()
      return
    }

    if (editingCodeId) {
      const modelElement = findCodeBlockModelElement(editor, editingCodeId)
      if (modelElement) {
        // 기존 블록을 선택한 뒤 덮어쓰면 실행 취소 한 번으로 되돌아간다.
        editor.model.change((writer) => writer.setSelection(modelElement, 'on'))
        insertHtmlAtSelection(editor, codeHtml)
      } else {
        // 모델 매핑에 실패하면 HTML 단계 교체로 물러난다. (이력은 초기화됨)
        editor.setData(replaceCodeBlock(editor.getData(), editingCodeId, codeHtml))
      }
    } else {
      editor.model.change((writer) => {
        const root = editor.model.document.getRoot()
        if (root) writer.setSelection(root, 'end')
      })
      insertHtmlAtSelection(editor, codeHtml)
      appendTrailingParagraph(editor)
    }
    closeCodeDialog()
  }, [codeText, codeHtml, editingCodeId, value, onChange, closeCodeDialog])

  const plugins = [
    Essentials,
    Paragraph,
    Bold,
    Italic,
    ...(enableCodeBlock ? [Code] : []),
    ...(fontColor ? [FontColor] : []),
    Image,
    ImageInsert,
    ImageResize,
    ImageToolbar,
    ImageStyle,
    Alignment,
    GeneralHtmlSupport,
  ]

  const toolbar = [
    'undo', 'redo', '|',
    'bold', 'italic',
    ...(enableCodeBlock ? ['code'] : []),
    '|',
    ...(fontColor ? ['fontColor', '|'] : []),
    'alignment:left', 'alignment:center', 'alignment:right', 'alignment:justify', '|',
    'insertImage',
  ]

  return (
    <Box>
      {(label || enableCodeBlock) && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
          {label ? <Typography variant="subtitle2">{label}</Typography> : <span />}
          {enableCodeBlock && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<CodeIcon />}
              onClick={() => {
                setEditingCodeId(null)
                setCodeDialogOpen(true)
              }}
            >
              코드 삽입
            </Button>
          )}
        </Stack>
      )}

      <Box sx={{ '& .ck-editor': { backgroundColor: 'grey.50' }, '& .ck.ck-editor__editable': { minHeight } }}>
        <CKEditor
          key={editorKey}
          editor={ClassicEditor}
          data={value ?? ''}
          config={{
            licenseKey: 'GPL',
            // CodeBlock은 자식을 $text만 허용해 인라인 색상을 지우므로 사용하지 않는다.
            plugins,
            toolbar,
            htmlSupport: { allow: htmlSupportAllow },
            image: {
              resizeOptions: [
                { name: 'resizeImage:original', value: null, icon: 'original' },
                { name: 'resizeImage:25', value: '25', icon: 'small' },
                { name: 'resizeImage:50', value: '50', icon: 'medium' },
                { name: 'resizeImage:75', value: '75', icon: 'large' },
                { name: 'resizeImage:custom', value: 'custom', icon: 'custom' },
              ],
              styles: {
                options: ['inline', 'alignLeft', 'alignRight', 'alignCenter', 'alignBlockLeft', 'alignBlockRight', 'block'],
              },
              toolbar: [
                'resizeImage:25', 'resizeImage:50', 'resizeImage:75', 'resizeImage:original', 'resizeImage:custom',
                '|',
                'imageStyle:wrapText',
                'imageStyle:breakText',
                '|',
                'imageStyle:alignLeft', 'imageStyle:alignRight', 'imageStyle:alignCenter',
                'imageStyle:alignBlockLeft', 'imageStyle:alignBlockRight',
              ],
            },
          }}
          onReady={(editor) => {
            editorRef.current = editor
            // 코드 블록은 위젯이 아니라 CKEditor 이벤트로는 잡기 어려워 DOM에 직접 건다.
            editor.ui.getEditableElement()?.addEventListener('dblclick', handleCodeBlockDblClick)
            onReady?.(editor)
          }}
          onChange={(_evt, editor) => {
            onChange(editor.getData())
          }}
        />
      </Box>

      <Dialog open={codeDialogOpen} onClose={closeCodeDialog} fullWidth maxWidth="md">
        <DialogTitle>{editingCodeId ? '코드 수정' : '코드 삽입'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              size="small"
              label="언어"
              value={codeLang}
              onChange={(e) => setCodeLang(e.target.value)}
              sx={{ width: 220 }}
            >
              {CODE_LANGUAGES.map((item) => (
                <MenuItem key={item.language} value={item.language}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              multiline
              minRows={12}
              fullWidth
              placeholder="코드를 붙여넣어 주세요."
              value={codeText}
              onChange={(e) => setCodeText(e.target.value)}
              InputProps={{
                sx: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 13 },
              }}
            />
            {codeText.trim() !== '' && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  미리보기
                </Typography>
                <Box
                  sx={{ maxHeight: 240, overflow: 'auto' }}
                  dangerouslySetInnerHTML={{ __html: codeHtml }}
                />
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCodeDialog}>취소</Button>
          <Button variant="contained" onClick={handleInsertCode}>
            {editingCodeId ? '수정' : '삽입'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
