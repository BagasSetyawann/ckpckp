import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) {
      setError('Username dan password wajib diisi');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(form.username, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login gagal. Periksa username dan password Anda.');
    } finally {
      setLoading(false);
    }
  };

  const demoUsers = [
    { username: 'admin', label: 'KPA / Admin', color: 'text-red-600' },
    { username: 'kasubbag', label: 'Kasubbag', color: 'text-blue-600' },
    { username: 'budi', label: 'Budi (Pegawai)', color: 'text-green-600' },
    { username: 'sari', label: 'Sari (Pegawai)', color: 'text-green-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary-700 to-primary-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-white/5 rounded-full" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
          {/* Header stripe */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-800 p-6 text-white text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-xl font-bold">SI-CKP</h1>
            <p className="text-primary-200 text-sm mt-1">Sistem Informasi Capaian Kinerja Pegawai</p>
            <p className="text-primary-300 text-xs mt-0.5">Dinas Statistik Daerah</p>
          </div>

          {/* Form */}
          <div className="p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-5">Masuk ke Sistem</h2>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-group">
                <label className="label">Username</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Masukkan username"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  autoComplete="username"
                  id="login-username"
                />
              </div>

              <div className="form-group">
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showPass ? 'text' : 'password'}
                    placeholder="Masukkan password"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    autoComplete="current-password"
                    id="login-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-2.5"
                id="login-submit"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Memproses...
                  </>
                ) : 'Masuk'}
              </button>
            </form>

            {/* Demo accounts */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500 mb-3 font-medium">Akun Demo (password: password123)</p>
              <div className="grid grid-cols-2 gap-2">
                {demoUsers.map(u => (
                  <button
                    key={u.username}
                    onClick={() => setForm({ username: u.username, password: 'password123' })}
                    className="text-left p-2 rounded-lg border border-slate-100 hover:border-primary-200 hover:bg-primary-50/50 transition-colors"
                  >
                    <p className={`text-xs font-semibold ${u.color}`}>{u.label}</p>
                    <p className="text-xs text-slate-500">{u.username}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-primary-300 text-xs mt-4">
          © 2026 SI-CKP · Dinas Statistik Daerah
        </p>
      </div>
    </div>
  );
}
