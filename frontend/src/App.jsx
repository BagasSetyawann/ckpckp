import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Kegiatan from './pages/Kegiatan';
import RencanaKinerja from './pages/RencanaKinerja';
import BuktiDukung from './pages/BuktiDukung';
import NilaiCKP from './pages/NilaiCKP';
import Pengaturan from './pages/Pengaturan';
import AuditLog from './pages/AuditLog';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" style={{borderWidth:'3px'}}></div>
        <p className="text-sm text-slate-500">Memuat...</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="kegiatan" element={<Kegiatan />} />
        <Route path="rencana-kinerja" element={<RencanaKinerja />} />
        <Route path="bukti-dukung" element={<BuktiDukung />} />
        <Route path="nilai-ckp" element={<NilaiCKP />} />
        <Route path="pengaturan" element={<ProtectedRoute roles={['KPA']}><Pengaturan /></ProtectedRoute>} />
        <Route path="audit-log" element={<ProtectedRoute roles={['KPA']}><AuditLog /></ProtectedRoute>} />

        {/* Redirects from old routes to new merged pages */}
        <Route path="cek-harian" element={<Navigate to="/kegiatan" replace />} />
        <Route path="monitoring-pk" element={<Navigate to="/rencana-kinerja" replace />} />
        <Route path="penilaian-perilaku" element={<Navigate to="/nilai-ckp" replace />} />
        <Route path="output" element={<Navigate to="/pengaturan" replace />} />
        <Route path="reminder" element={<Navigate to="/" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
