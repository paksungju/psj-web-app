import { Navigate, Route, Routes } from 'react-router-dom'
import SptPage from '../pages/spt'

export default function SptRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/spt" replace />} />
      <Route path="/spt/:cat1/:cat2" element={<SptPage />} />
      <Route path="/spt/:cat1" element={<SptPage />} />
      <Route path="/spt" element={<SptPage />} />
      <Route path="*" element={<Navigate to="/spt" replace />} />
    </Routes>
  )
}
