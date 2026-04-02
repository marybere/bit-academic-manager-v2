import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import LoginPage from './pages/LoginPage'

// Chef de classe
import ChefDashboardPage      from './pages/chef/ChefDashboardPage'
import AttendancePage         from './pages/chef/AttendancePage'
import AttendanceHistoryPage  from './pages/chef/AttendanceHistoryPage'
import ChefNewRequestPage     from './pages/chef/ChefNewRequestPage'
import ChefMyRequestsPage     from './pages/chef/ChefMyRequestsPage'

// Secrétaire
import SecretaireDashboardPage from './pages/secretaire/SecretaireDashboardPage'
import ClassManagementPage     from './pages/secretaire/ClassManagementPage'
import RequestDetailPage       from './pages/secretaire/RequestDetailPage'

// Étudiant
import StudentDashboardPage from './pages/etudiant/StudentDashboardPage'
import NewRequestPage       from './pages/etudiant/NewRequestPage'
import TrackRequestPage     from './pages/etudiant/TrackRequestPage'

// Directeur
import DirecteurAnalyticsPage from './pages/directeur/DirecteurAnalyticsPage'

// Validation (CAISSE / IT / LABORATOIRE / SECRETAIRE)
import ValidationPage from './pages/validation/ValidationPage'

// Admin
import AdminSettingsPage from './pages/admin/AdminSettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Chef de classe */}
          <Route path="/chef/dashboard" element={
            <ProtectedRoute roles={['CHEF_CLASSE','ADMIN']}>
              <ChefDashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/chef/attendance" element={
            <ProtectedRoute roles={['CHEF_CLASSE','ADMIN']}>
              <AttendancePage />
            </ProtectedRoute>
          } />
          <Route path="/chef/history" element={
            <ProtectedRoute roles={['CHEF_CLASSE','ADMIN']}>
              <AttendanceHistoryPage />
            </ProtectedRoute>
          } />
          <Route path="/chef/requests/new" element={
            <ProtectedRoute roles={['CHEF_CLASSE','ADMIN']}>
              <ChefNewRequestPage />
            </ProtectedRoute>
          } />
          <Route path="/chef/requests" element={
            <ProtectedRoute roles={['CHEF_CLASSE','ADMIN']}>
              <ChefMyRequestsPage />
            </ProtectedRoute>
          } />

          {/* Secrétaire */}
          <Route path="/secretaire/dashboard" element={
            <ProtectedRoute roles={['SECRETAIRE','ADMIN']}>
              <SecretaireDashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/secretaire/classes" element={
            <ProtectedRoute roles={['SECRETAIRE','ADMIN']}>
              <ClassManagementPage />
            </ProtectedRoute>
          } />
          <Route path="/secretaire/request/:id" element={
            <ProtectedRoute roles={['SECRETAIRE','ADMIN']}>
              <RequestDetailPage />
            </ProtectedRoute>
          } />

          {/* Étudiant */}
          <Route path="/etudiant/dashboard" element={
            <ProtectedRoute roles={['STUDENT','ADMIN']}>
              <StudentDashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/etudiant/new-request" element={
            <ProtectedRoute roles={['STUDENT','ADMIN']}>
              <NewRequestPage />
            </ProtectedRoute>
          } />
          <Route path="/etudiant/track" element={
            <ProtectedRoute roles={['STUDENT','ADMIN']}>
              <TrackRequestPage />
            </ProtectedRoute>
          } />
          <Route path="/etudiant/track/:id" element={
            <ProtectedRoute roles={['STUDENT','ADMIN']}>
              <TrackRequestPage />
            </ProtectedRoute>
          } />

          {/* Directeur */}
          <Route path="/directeur/analytics" element={
            <ProtectedRoute roles={['DIRECTEUR','ADMIN']}>
              <DirecteurAnalyticsPage />
            </ProtectedRoute>
          } />

          {/* Validation */}
          <Route path="/validation" element={
            <ProtectedRoute roles={['CAISSE','IT','LABORATOIRE','SECRETAIRE','ADMIN']}>
              <ValidationPage />
            </ProtectedRoute>
          } />

          {/* Admin */}
          <Route path="/admin/settings" element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminSettingsPage />
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
