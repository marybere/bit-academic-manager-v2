import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ScreenViewer from './pages/ScreenViewer'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<ScreenViewer src="/screens/login.html" title="Login" />} />
        <Route path="/chef/dashboard" element={<ScreenViewer src="/screens/chef-dashboard.html" title="Chef Dashboard" />} />
        <Route path="/chef/attendance" element={<ScreenViewer src="/screens/attendance.html" title="Attendance" />} />
        <Route path="/chef/history" element={<ScreenViewer src="/screens/attendance-history.html" title="Attendance History" />} />
        <Route path="/secretaire/dashboard" element={<ScreenViewer src="/screens/secretary-dashboard.html" title="Secretary Dashboard" />} />
        <Route path="/secretaire/request/:id" element={<ScreenViewer src="/screens/request-detail.html" title="Request Detail" />} />
        <Route path="/etudiant/dashboard" element={<ScreenViewer src="/screens/student-dashboard.html" title="Student Dashboard" />} />
        <Route path="/etudiant/new-request" element={<ScreenViewer src="/screens/new-request.html" title="New Request" />} />
        <Route path="/etudiant/track" element={<ScreenViewer src="/screens/request-tracking.html" title="Track Request" />} />
        <Route path="/directeur/analytics" element={<ScreenViewer src="/screens/director-analytics.html" title="Director Analytics" />} />
        <Route path="/validation" element={<ScreenViewer src="/screens/validation.html" title="Validation" />} />
        <Route path="/admin/settings" element={<ScreenViewer src="/screens/admin-settings.html" title="Admin Settings" />} />
      </Routes>
    </BrowserRouter>
  )
}
