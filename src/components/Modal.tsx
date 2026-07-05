import ReactDOM from 'react-dom'
import './modal.css'

interface ModalProps {
  title: string
  children: React.ReactNode
  onClose: () => void
  onSave: () => void
  onDelUpdate?: () => void
}

export default function Modal({
  title,
  children,
  onClose,
  onSave,
  onDelUpdate = () => {},
}: ModalProps) {
  return ReactDOM.createPortal(
    <div className="modal-overlay" role="presentation" onMouseDown={(e) => e.stopPropagation()}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn-delete"
            onClick={() => {
              if (window.confirm('정말 삭제하시겠습니까?')) {
                onDelUpdate()
              }
            }}
          >
            삭제
          </button>
          <div className="modal-footer-right">
            <button type="button" className="btn-close" onClick={onClose}>
              닫기
            </button>
            <button type="button" className="btn-save" onClick={onSave}>
              저장하기
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
