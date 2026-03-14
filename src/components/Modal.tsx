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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button
            className="btn-close"
            onClick={() => {
              if (window.confirm('정말 삭제하시겠습니까?')) {
                onDelUpdate()
              }
            }}
          >
            삭제
          </button>
          <button className="btn-close" onClick={onClose}>닫기</button>
          <button className="btn-save" onClick={onSave}>저장하기</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
