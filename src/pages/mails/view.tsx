import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Paper,
  Typography,
  Button,
  Divider,
} from '@mui/material'
import { fetchAppDataByIdApi } from '../../apis/appApi'
import { fetchMailsApi, markMailReadApi, fetchMailAttachmentsApi, type ApiMailAttachment } from '../../apis/mailApi'

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    return `${year}.${month}.${day} ${hour}:${min}`
  } catch {
    return '-'
  }
}

/** 메일 본문 HTML 내 이미지 src에 도메인 추가 */
function processContentHtml(html: string): string {
  if (!html) return ''
  let out = html.replace(
    /<img([^>]*)\ssrc=["']([^"']+)["']/gi,
    (match, attrs: string, src: string) => {
      if (src.startsWith('http')) return match
      const path = src.startsWith('/') ? src : `/${src}`
      return `<img${attrs} src="http://impsj.net${path}"`
    },
  )
  // charset 메타를 utf-8로 통일 (한글 깨짐 방지)
  out = out.replace(
    /<meta[^>]*charset\s*=\s*["']?[^"'\s>]+["']?[^>]*>/gi,
    '<meta charset="utf-8">',
  )
  // base 태그 제거 (상대 경로 깨짐 방지)
  out = out.replace(/<base[^>]*>/gi, '')
  // position:absolute 등 레이아웃 깨짐 스타일 제거 (로그 뷰어 등) - height는 유지 (뉴스레터 등 정상 레이아웃용)
  out = out.replace(/position:\s*absolute/gi, 'position: relative')
  out = out.replace(/inset-inline-start:\s*[^;]+;?/gi, '')
  out = out.replace(/\btop:\s*\d+px;?/gi, '')
  // width: 1000px 이상 → 반응형, width: 400~999px → max-width로 반응형 (뉴스레터 등)
  out = out.replace(/\bwidth:\s*(\d{4,})px/gi, 'max-width: $1px; width: 100%')
  out = out.replace(/\bwidth:\s*(\d{3})px/gi, (_, n) => `max-width: ${n}px; width: 100%`)
  return out
}

/** 서버 에러 로그/스택 트레이스 패턴인지 판별 (메일 본문에 잘못 저장된 경우 대비) */
function looksLikeErrorLog(content: string): boolean {
  if (!content?.trim()) return false
  const s = content.trim()
  return (
    /SSLHandshakeException|certificate_unknown|javax\.net\.ssl|at sun\.security\.ssl|at org\.apache\.tomcat|NioEndpoint\.handshake/i.test(s) ||
    /pf-v5-c-log-viewer__list-item|pf-v5-c-log-viewer__text/i.test(s) ||
    (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(s) && /Exception|Error|at\s+\w+\.\w+\.\w+\(/.test(s))
  )
}

/** ap_content가 HTML인지 간단 판별 */
function isHtmlContent(content: string): boolean {
  if (!content?.trim()) return false
  const s = content.trim()
  return /<\s*(html|body|div|p|img|br|span|table|tr|td)[\s>]/i.test(s) || s.startsWith('<')
}

export default function MailViewPage() {
  const navigate = useNavigate()
  const { dataId } = useParams<{ dataId?: string }>()
  const [data, setData] = useState<{
    subject: string
    account: string
    from: string
    replyToEmail: string
    date: string
    body: string
    body_is_html: boolean
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRawErrorContent, setShowRawErrorContent] = useState(false)
  const [prevMail, setPrevMail] = useState<{ id: string; subject: string; date: string } | null>(null)
  const [nextMail, setNextMail] = useState<{ id: string; subject: string; date: string } | null>(null)
  const [attachments, setAttachments] = useState<ApiMailAttachment[]>([])

  const toAbsoluteFileUrl = (fileUrl?: string) => {
    if (!fileUrl) return '#'
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) return fileUrl
    return `http://impsj.net${fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`}`
  }

  const handleDownloadAttachment = async (file: ApiMailAttachment) => {
    const url = toAbsoluteFileUrl(file.file_url)
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const objectUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = file.file_name ?? `attachment-${file.file_id}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(objectUrl)
    } catch (error) {
      console.error('첨부파일 다운로드 오류:', error)
      window.alert('첨부파일 다운로드에 실패했습니다.')
    }
  }

  useEffect(() => {
    if (!dataId) {
      setData(null)
      setLoading(false)
      return
    }
    const id = parseInt(dataId, 10)
    if (isNaN(id)) {
      setData(null)
      setLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const [res, listData, fileData] = await Promise.all([
          fetchAppDataByIdApi(id),
          fetchMailsApi({ skip: 0, limit: 300 }),
          fetchMailAttachmentsApi(id),
        ])
        if (!cancelled && res) {
          markMailReadApi(id).catch(() => {})
          const body = res.ap_content ?? ''
          const isSent = res.extra_1 === 'send'
          setData({
            subject: res.ap_subject ?? '(제목 없음)',
            account: res.cate1 ?? 'naver',
            from: res.user_email ?? '',
            replyToEmail: isSent ? (res.extra_2 ?? '') : (res.user_email ?? ''),
            date: res.regist_dt ?? '',
            body,
            body_is_html: isHtmlContent(body),
          })
          setAttachments(fileData ?? [])
          const mails = listData.mails ?? []
          const idx = mails.findIndex((m) => String(m.id) === String(id))
          if (idx >= 0) {
            const prev = mails[idx + 1]
            const next = mails[idx - 1]
            setPrevMail(
              prev
                ? { id: String(prev.id), subject: prev.subject ?? '(제목 없음)', date: prev.date ?? '' }
                : null,
            )
            setNextMail(
              next
                ? { id: String(next.id), subject: next.subject ?? '(제목 없음)', date: next.date ?? '' }
                : null,
            )
          } else {
            setPrevMail(null)
            setNextMail(null)
          }
        } else if (!cancelled) {
          setData(null)
          setAttachments([])
          setPrevMail(null)
          setNextMail(null)
        }
      } catch (e) {
        console.error(e)
        if (!cancelled) setData(null)
        if (!cancelled) setAttachments([])
        if (!cancelled) {
          setPrevMail(null)
          setNextMail(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [dataId])

  if (loading) {
    return (
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
        <Typography color="text.secondary">로딩 중...</Typography>
      </Box>
    )
  }

  if (!data) {
    return (
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            메일을 찾을 수 없습니다.
          </Typography>
          <Button variant="outlined" onClick={() => navigate('/mails')}>
            목록으로
          </Button>
        </Paper>
      </Box>
    )
  }

  return (
    <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          backgroundColor: 'background.paper',
          minWidth: 960,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 1, mb: 2 }}>
          <Button variant="outlined" color="inherit" onClick={() => navigate('/mails')}>
            목록
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() =>
              navigate('/mails/create', {
                state: {
                  replyTo: data.replyToEmail,
                  replySubject: data.subject.startsWith('Re:') ? data.subject : `Re: ${data.subject}`,
                  replyBody: (() => {
                    if (!data.body) return ''
                    const content = data.body_is_html
                      ? processContentHtml(data.body)
                      : `<p style="margin:0;white-space:pre-wrap;font-family:inherit;">${(data.body || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`
                    return `<br><br><div style="border-left:4px solid #ccc;padding:12px 0 12px 20px;margin:16px 0;background:#f9f9f9;color:#333;font-size:inherit;line-height:inherit;">${content}</div>`
                  })(),
                },
              })
            }
          >
            답장
          </Button>
        </Box>
        <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
          {data.subject ?? '(제목 없음)'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {data.account} · {formatDate(data.date)}
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
            발신자
          </Typography>
          <Typography variant="body1">{data.from ?? '-'}</Typography>
        </Box>
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            첨부파일
          </Typography>
          {attachments.length === 0 ? (
            <Typography variant="body2" color="text.secondary">없음</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {attachments.map((file) => (
                <Box key={file.file_id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {file.file_name ?? `attachment-${file.file_id}`}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleDownloadAttachment(file)}
                  >
                    다운로드
                  </Button>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ minHeight: 200 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
            내용
          </Typography>
          {looksLikeErrorLog(data.body) && !showRawErrorContent ? (
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: 'action.hover',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography color="text.secondary" sx={{ mb: 1 }}>
                이 메일 본문에 서버 에러 로그가 포함되어 있어 정상적인 내용으로 표시되지 않습니다.
                (SSL 인증서 오류 등 외부 시스템 로그가 저장된 것으로 보입니다.)
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setShowRawErrorContent(true)}
              >
                원본 보기
              </Button>
            </Box>
          ) : data.body_is_html ? (
            <>
              <style>{`
                .mail-view-body img {
                  max-width: 100%;
                  display: block;
                }
                .mail-view-body div[style*="height:161px"] > img,
                .mail-view-body div[style*="height:244px"] > img {
                  width: 100% !important;
                  height: 100% !important;
                  object-fit: cover !important;
                }
                .mail-view-body ul { overflow: hidden; }
                .mail-view-body li { list-style: none; }
                .mail-view-body * { box-sizing: border-box; }
              `}</style>
              <Box
                className="content-html mail-view-body"
                component="div"
                dangerouslySetInnerHTML={{ __html: processContentHtml(data.body ?? '') }}
                sx={{
                  overflow: 'auto',
                  wordBreak: 'break-word',
                  maxWidth: '100%',
                  fontSize: '0.9375rem',
                  lineHeight: 1.6,
                  '& figure': { margin: '0.5em 0', maxWidth: '100%' },
                  '& p': { margin: '0 0 0.75em' },
                  '& table': { maxWidth: '100%', tableLayout: 'fixed' },
                }}
              />
            </>
          ) : (
            <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
              {data.body || '(내용 없음)'}
            </Typography>
          )}
          {looksLikeErrorLog(data.body) && showRawErrorContent && (
            <Button
              size="small"
              sx={{ mt: 1 }}
              onClick={() => setShowRawErrorContent(false)}
            >
              원본 숨기기
            </Button>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ mb: 2 }}>
          <Box
            component="button"
            onClick={() => nextMail && navigate(`/mails/${nextMail.id}`)}
            disabled={!nextMail}
            sx={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              p: 1,
              border: 'none',
              borderRadius: 1,
              bgcolor: nextMail ? 'action.hover' : 'transparent',
              cursor: nextMail ? 'pointer' : 'default',
              '&:hover': nextMail ? { bgcolor: 'action.selected' } : {},
              mb: 0.5,
            }}
          >
            <Typography variant="body2" color={nextMail ? 'text.primary' : 'text.disabled'}>
              다음 : {nextMail ? `${nextMail.subject} : ${formatDate(nextMail.date)}` : '-'}
            </Typography>
          </Box>
          <Box
            component="button"
            onClick={() => prevMail && navigate(`/mails/${prevMail.id}`)}
            disabled={!prevMail}
            sx={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              p: 1,
              border: 'none',
              borderRadius: 1,
              bgcolor: prevMail ? 'action.hover' : 'transparent',
              cursor: prevMail ? 'pointer' : 'default',
              '&:hover': prevMail ? { bgcolor: 'action.selected' } : {},
            }}
          >
            <Typography variant="body2" color={prevMail ? 'text.primary' : 'text.disabled'}>
              이전 : {prevMail ? `${prevMail.subject} : ${formatDate(prevMail.date)}` : '-'}
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}
