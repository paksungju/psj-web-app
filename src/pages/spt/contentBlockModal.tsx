import { ContentBlockFormModal, type ContentBlockFormModalProps } from './contentBlockFormShared'

type ContentBlockModalProps = Omit<ContentBlockFormModalProps, 'title' | 'idPrefix'>

export default function ContentBlockModal(props: ContentBlockModalProps) {
  return <ContentBlockFormModal title="콘텐츠블록 등록" {...props} />
}
