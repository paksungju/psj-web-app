import { useCallback, useEffect, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Modal from '../../components/Modal'
import {
  contentBlockdelUpdate,
  postContentBlockSave,
  type IContentBlockModel,
} from '../../apis/contentBlockApi'
import './index.css'

export const TEXT_COLOR_PALETTE = ['#0f172a', '#334155', '#64748b', '#ef4444', '#f59e0b', '#16a34a', '#2563eb', '#7c3aed']

export type ContentBlockFormModalProps = {
  title: string
  idPrefix?: 'list'
  open: boolean
  onClose: () => void
  selectedCiId: string | null
  onSaved: () => void | Promise<void>
  initialBlock?: IContentBlockModel | null
}

function fieldId(prefix: 'list' | undefined, name: string) {
  if (!prefix) return name
  return `${prefix}${name.charAt(0).toUpperCase()}${name.slice(1)}`
}

function applyBlockToForm(
  block: IContentBlockModel,
  setters: {
    setCbId: (v: string) => void
    setCoType: (v: string) => void
    setCbSubject: (v: string) => void
    setCbContent: (v: string) => void
    setImgUrl: (v: string) => void
    setTopP: (v: string) => void
    setLeftP: (v: string) => void
    setBlockWidth: (v: string) => void
    setBlockHeight: (v: string) => void
    setHeaderYn: (v: string) => void
    setHeaderBg: (v: string) => void
    setBorderTk: (v: string) => void
    setBorderR: (v: string) => void
    setBorderGd: (v: string) => void
    setBodyBg: (v: string) => void
    setLinkUrl: (v: string) => void
    setLinkTarget: (v: string) => void
  },
) {
  setters.setCoType(String(block.coType ?? 'C01').trim() || 'C01')
  setters.setCbId(String(block.cbId ?? '').trim())
  setters.setCbSubject(String(block.cbSubject ?? '').trim())
  setters.setCbContent(String(block.cbContent ?? '').trim())
  setters.setImgUrl(String(block.imgUrl ?? '').trim())
  setters.setTopP(String(block.topP ?? 100))
  setters.setLeftP(String(block.leftP ?? 100))
  setters.setBlockWidth(String(block.width ?? 100))
  setters.setBlockHeight(String(block.height ?? 100))
  setters.setHeaderYn(String(block.headerYn ?? 1))
  setters.setHeaderBg(String(block.headerBg ?? '').trim())
  setters.setBorderTk(String(block.borderTk ?? 0))
  setters.setBorderR(String(block.borderR ?? 0))
  setters.setBorderGd(String(block.borderGd ?? 0))
  setters.setBodyBg(String(block.bodyBg ?? '').trim())
  setters.setLinkUrl(String(block.linkUrl ?? '').trim())
  setters.setLinkTarget(String(block.linkTarget ?? '_self').trim() || '_self')
}

export function ContentBlockFormModal({
  title,
  idPrefix,
  open,
  onClose,
  selectedCiId,
  onSaved,
  initialBlock = null,
}: ContentBlockFormModalProps) {
  const [cbId, setCbId] = useState('')
  const [cbSubject, setCbSubject] = useState('')
  const [cbContent, setCbContent] = useState('')
  const [coType, setCoType] = useState('C01')
  const [imgUrl, setImgUrl] = useState('')
  const [topP, setTopP] = useState('100')
  const [leftP, setLeftP] = useState('100')
  const [blockWidth, setBlockWidth] = useState('100')
  const [blockHeight, setBlockHeight] = useState('100')
  const [headerYn, setHeaderYn] = useState('1')
  const [headerBg, setHeaderBg] = useState('')
  const [borderTk, setBorderTk] = useState('0')
  const [borderR, setBorderR] = useState('0')
  const [borderGd, setBorderGd] = useState('0')
  const [bodyBg, setBodyBg] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTarget, setLinkTarget] = useState('_self')
  const [showTextColorPalette, setShowTextColorPalette] = useState(false)

  const htmlEditor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      TextStyle,
      Color,
    ],
    content: cbContent || '',
    editorProps: {
      attributes: {
        class: 'tiptap-content',
      },
    },
    onUpdate: ({ editor }) => {
      if (coType === 'C02') {
        setCbContent(editor.getHTML())
      }
    },
  })

  const textEditor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bold: false,
        italic: false,
        strike: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        horizontalRule: false,
      }),
    ],
    content: cbContent || '',
    editorProps: {
      attributes: {
        class: 'tiptap-content',
      },
    },
    onUpdate: ({ editor }) => {
      if (coType === 'C01') {
        setCbContent(editor.getText({ blockSeparator: '\n' }))
      }
    },
  })

  const resetContentBlockForm = useCallback(() => {
    setCbId('')
    setCbSubject('')
    setCbContent('')
    setCoType('C01')
    setImgUrl('')
    setTopP('100')
    setLeftP('100')
    setBlockWidth('100')
    setBlockHeight('100')
    setHeaderYn('1')
    setHeaderBg('')
    setBorderTk('0')
    setBorderR('0')
    setBorderGd('0')
    setBodyBg('')
    setLinkUrl('')
    setLinkTarget('_self')
    setShowTextColorPalette(false)
  }, [])

  useEffect(() => {
    if (!open) return
    if (initialBlock) {
      applyBlockToForm(initialBlock, {
        setCbId,
        setCoType,
        setCbSubject,
        setCbContent,
        setImgUrl,
        setTopP,
        setLeftP,
        setBlockWidth,
        setBlockHeight,
        setHeaderYn,
        setHeaderBg,
        setBorderTk,
        setBorderR,
        setBorderGd,
        setBodyBg,
        setLinkUrl,
        setLinkTarget,
      })
    } else {
      resetContentBlockForm()
    }
  }, [open, initialBlock, resetContentBlockForm])

  useEffect(() => {
    if (!htmlEditor || coType !== 'C02') return
    const current = htmlEditor.getHTML()
    if (current !== (cbContent || '')) {
      htmlEditor.commands.setContent(cbContent || '', { emitUpdate: false })
    }
  }, [htmlEditor, cbContent, coType])

  useEffect(() => {
    if (!textEditor || coType !== 'C01') return
    const current = textEditor.getText({ blockSeparator: '\n' })
    if (current !== (cbContent || '')) {
      textEditor.commands.setContent(cbContent || '', { emitUpdate: false })
    }
  }, [textEditor, cbContent, coType])

  const handleSetEditorLink = () => {
    if (!htmlEditor) return
    const previousUrl = htmlEditor.getAttributes('link').href as string | undefined
    const url = window.prompt('링크 URL을 입력하세요.', previousUrl || '')
    if (url === null) return
    const normalized = url.trim()
    if (!normalized) {
      htmlEditor.chain().focus().unsetLink().run()
      return
    }
    htmlEditor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run()
  }

  const handleSetEditorTextColor = (color: string) => {
    if (!htmlEditor) return
    htmlEditor.chain().focus().setColor(color).run()
    setShowTextColorPalette(false)
  }

  const handleUnsetEditorTextColor = () => {
    if (!htmlEditor) return
    htmlEditor.chain().focus().unsetColor().run()
    setShowTextColorPalette(false)
  }

  const activeTextColor = (htmlEditor?.getAttributes('textStyle').color as string | undefined) || ''

  const contentBlockSave = async () => {
    if (!selectedCiId) {
      alert('메뉴 항목을 선택한 후 저장해주세요.')
      return
    }

    const subjectT = cbSubject.trim()
    const contentT = cbContent.trim()
    const isInsert = !cbId || cbId.trim() === '' || cbId.trim() === '0'
    const params: Record<string, unknown> = {
      cbId: cbId.trim(),
      ciId: String(selectedCiId).trim(),
      imgUrl: imgUrl.trim(),
      cbSubject: subjectT,
      cbContent: contentT,
      coType: coType.trim() || 'C01',
      topP: Number(String(topP).trim() || 100),
      leftP: Number(String(leftP).trim() || 100),
      width: Number(String(blockWidth).trim() || 100),
      height: Number(String(blockHeight).trim() || 100),
      inUserNo: 1,
      inUserId: '1',
      useYn: '1',
      delYn: '0',
      headerYn: (() => {
        const n = Number.parseInt(String(headerYn).trim(), 10)
        return Number.isFinite(n) ? n : 1
      })(),
      headerBg: headerBg.trim(),
      borderTk: Number(String(borderTk).trim() || 0),
      borderR: Number(String(borderR).trim() || 0),
      borderGd: Number(String(borderGd).trim() || 0),
      bodyBg: bodyBg.trim(),
      linkUrl: linkUrl.trim(),
      linkTarget: linkTarget === '_blank' ? '_blank' : '_self',
    }

    if (isInsert) {
      Object.assign(params, {
        imgAngle: 0,
        zIndex: 100,
      })
    }

    if (!subjectT || !contentT) {
      alert('제목과 내용을 입력해주세요. (공백만 있으면 저장되지 않습니다)')
      return
    }

    try {
      const res = await postContentBlockSave(params)
      if (res?.code !== '0') {
        alert(res?.msg || '저장에 실패했습니다.')
        return
      }
      await onSaved()
      resetContentBlockForm()
      onClose()
    } catch (e) {
      console.error('저장 실패:', e)
      alert('저장 중 오류가 발생했습니다.')
    }
  }

  const onDelUpdate = async () => {
    if (!cbId || cbId === '0') {
      alert('삭제할 콘텐츠 블록이 없습니다.')
      return
    }
    const response = await contentBlockdelUpdate({ cbId })
    if (response?.code === '0') {
      await onSaved()
      resetContentBlockForm()
      onClose()
    } else {
      alert(response?.msg || '삭제 처리에 실패했습니다.')
    }
  }

  const handleClose = () => {
    resetContentBlockForm()
    onClose()
  }

  if (!open) return null

  return (
    <Modal
      title={title}
      onClose={handleClose}
      onSave={() => {
        void contentBlockSave()
      }}
      onDelUpdate={() => {
        void onDelUpdate()
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          height: 400,
          overflowY: 'auto',
          boxSizing: 'border-box',
          paddingRight: '4px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor={fieldId(idPrefix, 'coType')} style={{ fontWeight: 'bold', marginBottom: '4px' }}>타입 (Type)</label>
          <div id={fieldId(idPrefix, 'coType')} style={{ display: 'inline-flex', width: 'fit-content', border: '1px solid #d0d7de', borderRadius: '10px', overflow: 'hidden', marginTop: '4px' }}>
            {[
              { value: 'C01', label: 'Text' },
              { value: 'C02', label: 'Html' },
              { value: 'C03', label: 'Image' },
            ].map((opt) => {
              const selected = coType === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCoType(opt.value)}
                  style={{
                    border: 'none',
                    borderRight: opt.value === 'C03' ? 'none' : '1px solid #d0d7de',
                    padding: '8px 14px',
                    fontSize: '14px',
                    fontWeight: selected ? 700 : 500,
                    color: selected ? '#fff' : '#374151',
                    background: selected ? '#1976d2' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor={fieldId(idPrefix, 'cbSubject')} style={{ fontWeight: 'bold', marginBottom: '4px' }}>제목 (Subject)</label>
          <input type="text" id={fieldId(idPrefix, 'cbSubject')} value={cbSubject} onChange={(e) => setCbSubject(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px' }} />
        </div>

        {/* coType === 'C03' 이미지 경로 (주석 처리됨)
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label htmlFor={fieldId(idPrefix, 'imgUrl')} style={{ fontWeight: 'bold', marginBottom: '4px' }}>이미지 (imgUrl)</label>
            <input type="text" id={fieldId(idPrefix, 'imgUrl')} value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px' }} />
          </div>
        */}

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor={fieldId(idPrefix, 'linkUrl')} style={{ fontWeight: 'bold', marginBottom: '4px' }}>링크 URL (linkUrl)</label>
          <input type="text" id={fieldId(idPrefix, 'linkUrl')} value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com" style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor={fieldId(idPrefix, 'linkTarget')} style={{ fontWeight: 'bold', marginBottom: '4px' }}>링크 타겟 (linkTarget)</label>
          <select
            id={fieldId(idPrefix, 'linkTarget')}
            value={linkTarget}
            onChange={(e) => setLinkTarget(e.target.value)}
            style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', background: '#fff' }}
          >
            <option value="_self">_self (현재 창)</option>
            <option value="_blank">_blank (새 창)</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor={fieldId(idPrefix, 'cbContent')} style={{ fontWeight: 'bold', marginBottom: '4px' }}>내용 (Content)</label>
          {coType === 'C02' ? (
            <div style={{ border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
              <div className="editor-toolbar">
                <button
                  type="button"
                  className={`editor-tool-btn ${htmlEditor?.isActive('bold') ? 'is-active' : ''}`}
                  onClick={() => htmlEditor?.chain().focus().toggleBold().run()}
                >
                  Bold
                </button>
                <button
                  type="button"
                  className={`editor-tool-btn ${htmlEditor?.isActive('italic') ? 'is-active' : ''}`}
                  onClick={() => htmlEditor?.chain().focus().toggleItalic().run()}
                >
                  Italic
                </button>
                <button
                  type="button"
                  className={`editor-tool-btn ${htmlEditor?.isActive('bulletList') ? 'is-active' : ''}`}
                  onClick={() => htmlEditor?.chain().focus().toggleBulletList().run()}
                >
                  Bullet
                </button>
                <button
                  type="button"
                  className={`editor-tool-btn ${htmlEditor?.isActive('orderedList') ? 'is-active' : ''}`}
                  onClick={() => htmlEditor?.chain().focus().toggleOrderedList().run()}
                >
                  Number
                </button>
                <button
                  type="button"
                  className={`editor-tool-btn ${htmlEditor?.isActive('link') ? 'is-active' : ''}`}
                  onClick={handleSetEditorLink}
                >
                  Link
                </button>
                <div className="editor-color-wrap">
                  <button
                    type="button"
                    className={`editor-tool-btn ${activeTextColor ? 'is-active' : ''}`}
                    onClick={() => setShowTextColorPalette((prev) => !prev)}
                  >
                    Color
                  </button>
                  {showTextColorPalette && (
                    <div className="editor-color-palette">
                      <div className="editor-color-grid">
                        {TEXT_COLOR_PALETTE.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`editor-color-chip ${activeTextColor === color ? 'is-active' : ''}`}
                            style={{ backgroundColor: color }}
                            onClick={() => handleSetEditorTextColor(color)}
                            aria-label={`텍스트 색상 ${color}`}
                          />
                        ))}
                      </div>
                      <div className="editor-color-actions">
                        <input
                          type="color"
                          value={activeTextColor || '#000000'}
                          onChange={(e) => handleSetEditorTextColor(e.target.value)}
                          title="사용자 지정 색상"
                        />
                        <button type="button" className="editor-tool-btn" onClick={handleUnsetEditorTextColor}>
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <EditorContent editor={htmlEditor} />
            </div>
          ) : coType === 'C01' ? (
            <div style={{ border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '8px 10px', borderBottom: '1px solid #eee', background: '#f8fafc', color: '#64748b', fontSize: '12px' }}>
                텍스트 전용 모드 (서식/링크 사용 불가)
              </div>
              <EditorContent editor={textEditor} />
            </div>
          ) : (
            <textarea id={fieldId(idPrefix, 'cbContent')} rows={6} value={cbContent} onChange={(e) => setCbContent(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', resize: 'vertical' }} />
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '10px',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <label htmlFor={fieldId(idPrefix, 'topP')} style={{ fontWeight: 'bold', marginBottom: '4px' }}>Top</label>
            <input
              type="number"
              id={fieldId(idPrefix, 'topP')}
              value={topP}
              onChange={(e) => setTopP(e.target.value)}
              style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <label htmlFor={fieldId(idPrefix, 'leftP')} style={{ fontWeight: 'bold', marginBottom: '4px' }}>Left</label>
            <input
              type="number"
              id={fieldId(idPrefix, 'leftP')}
              value={leftP}
              onChange={(e) => setLeftP(e.target.value)}
              style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <label htmlFor={fieldId(idPrefix, 'blockWidth')} style={{ fontWeight: 'bold', marginBottom: '4px' }}>Width</label>
            <input
              type="number"
              id={fieldId(idPrefix, 'blockWidth')}
              value={blockWidth}
              onChange={(e) => setBlockWidth(e.target.value)}
              style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <label htmlFor={fieldId(idPrefix, 'blockHeight')} style={{ fontWeight: 'bold', marginBottom: '4px' }}>Height</label>
            <input
              type="number"
              id={fieldId(idPrefix, 'blockHeight')}
              value={blockHeight}
              onChange={(e) => setBlockHeight(e.target.value)}
              style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>헤더·테두리·본문 배경</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
              <span
                role="switch"
                aria-checked={headerYn !== '0'}
                tabIndex={0}
                onClick={() => setHeaderYn(headerYn !== '0' ? '0' : '1')}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setHeaderYn(headerYn !== '0' ? '0' : '1') } }}
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: headerYn !== '0' ? '#2563eb' : '#cbd5e1',
                  transition: 'background-color 0.2s',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: headerYn !== '0' ? 18 : 2,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                />
              </span>
              <span>{headerYn !== '0' ? 'ON' : 'OFF'}</span>
              헤더 표시
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <label htmlFor={fieldId(idPrefix, 'headerBg')} style={{ fontWeight: 'bold', marginBottom: '4px' }}>헤더 배경 (headerBg)</label>
              <input type="text" id={fieldId(idPrefix, 'headerBg')} value={headerBg} onChange={(e) => setHeaderBg(e.target.value)} placeholder="#ebebeb" style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <label htmlFor={fieldId(idPrefix, 'bodyBg')} style={{ fontWeight: 'bold', marginBottom: '4px' }}>본문 배경 (bodyBg)</label>
              <input type="text" id={fieldId(idPrefix, 'bodyBg')} value={bodyBg} onChange={(e) => setBodyBg(e.target.value)} placeholder="#fff" style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <label htmlFor={fieldId(idPrefix, 'borderTk')} style={{ fontWeight: 'bold', marginBottom: '4px' }}>테두리 두께 (borderTk)</label>
              <input type="number" id={fieldId(idPrefix, 'borderTk')} value={borderTk} onChange={(e) => setBorderTk(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <label htmlFor={fieldId(idPrefix, 'borderR')} style={{ fontWeight: 'bold', marginBottom: '4px' }}>모서리 반경 (borderR)</label>
              <input type="number" id={fieldId(idPrefix, 'borderR')} value={borderR} onChange={(e) => setBorderR(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gridColumn: '1 / -1' }}>
              <label htmlFor={fieldId(idPrefix, 'borderGd')} style={{ fontWeight: 'bold', marginBottom: '4px' }}>외곽선 보조 (borderGd)</label>
              <input type="number" id={fieldId(idPrefix, 'borderGd')} value={borderGd} onChange={(e) => setBorderGd(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
