import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from '../pages/login'

export default function AuthRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
