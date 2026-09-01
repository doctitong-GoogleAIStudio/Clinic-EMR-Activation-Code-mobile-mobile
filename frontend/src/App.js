import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LicenseProvider, useLicense } from './context/LicenseContext';
import { Toaster } from './components/ui/sonner';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import AutoExportProvider from './components/AutoExportProvider';

// Pages
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import DashboardPage from './pages/DashboardPage';
import PatientsPage from './pages/PatientsPage';
import PatientProfilePage from './pages/PatientProfilePage';
import NewPatientPage from './pages/NewPatientPage';
import NewVisitPage from './pages/NewVisitPage';
import VisitDetailPage from './pages/VisitDetailPage';
import AIConsultationPage from './pages/AIConsultationPage';
import AppointmentsPage from './pages/AppointmentsPage';
import SettingsPage from './pages/SettingsPage';
import Layout from './components/Layout';
import ActivationPage from './pages/ActivationPage';
import UnactivatedGate from './components/UnactivatedGate';
import TrialBanner from './components/TrialBanner';
import LicenseAdminLoginPage from './pages/LicenseAdminLoginPage';
import LicenseAdminPage from './pages/LicenseAdminPage';
import GracePeriodBanner from './components/GracePeriodBanner';

// License Gate - blocks access until device is activated
const LicenseGate = ({ children }) => {
  const { loading, isActivated } = useLicense();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-[#0F766E]/30 border-t-[#0F766E] rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">Checking license...</p>
        </div>
      </div>
    );
  }

  if (!isActivated) {
    return <UnactivatedGate />;
  }

  return children;
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-[#0F766E]/30 border-t-[#0F766E] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
};

// Public Route (redirect if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-[#0F766E]/30 border-t-[#0F766E] rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Full screen protected route (no max-width constraint)
const FullScreenRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-[#0F766E]/30 border-t-[#0F766E] rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* License Admin Routes (outside license gate) */}
      <Route path="/license-admin/login" element={<LicenseAdminLoginPage />} />
      <Route path="/license-admin" element={<LicenseAdminPage />} />

      {/* All other routes go through license gate */}
      <Route path="/*" element={
        <LicenseGate>
          <TrialBanner />
          <GracePeriodBanner />
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><SignUpPage /></PublicRoute>} />

            {/* Activation / upgrade during trial */}
            <Route path="/activate" element={<ActivationPage />} />

            {/* Protected Routes */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/patients" element={<ProtectedRoute><PatientsPage /></ProtectedRoute>} />
            <Route path="/patients/new" element={<ProtectedRoute><NewPatientPage /></ProtectedRoute>} />
            <Route path="/patients/:patientId" element={<ProtectedRoute><PatientProfilePage /></ProtectedRoute>} />
            <Route path="/visits/new" element={<ProtectedRoute><NewVisitPage /></ProtectedRoute>} />
            <Route path="/visits/:visitId" element={<ProtectedRoute><VisitDetailPage /></ProtectedRoute>} />
            <Route path="/patients/:patientId/ai-consultation" element={<FullScreenRoute><AIConsultationPage /></FullScreenRoute>} />
            <Route path="/appointments" element={<ProtectedRoute><AppointmentsPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

            {/* Redirects */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </LicenseGate>
      } />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <LicenseProvider>
        <AuthProvider>
          <AutoExportProvider>
            <OfflineIndicator />
            <AppRoutes />
            <Toaster position="top-right" richColors closeButton />
            <PWAInstallPrompt />
          </AutoExportProvider>
        </AuthProvider>
      </LicenseProvider>
    </BrowserRouter>
  );
}

export default App;
