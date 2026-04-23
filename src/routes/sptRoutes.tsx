import { Navigate, Route, Routes } from 'react-router-dom'
import SptPage from '../pages/spt'

export default function SptRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/spt" replace />} />
      <Route path="/spt" element={<SptPage title="SPT HOME" description="전략기획툴 홈 화면입니다." />} />
      <Route path="*" element={<Navigate to="/spt" replace />} />
    </Routes>
  )
}
