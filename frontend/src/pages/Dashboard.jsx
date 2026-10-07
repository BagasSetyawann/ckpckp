import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import {
  CheckCircle, XCircle, Clock, Users, ClipboardList, BarChart3,
  Award, TrendingUp, AlertTriangle, FileText, RefreshCw
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';

function StatCard({ icon: Icon, label, value, sub, color = 'primary', trend }) {
  const colorMap = {
    primary: 'bg-primary-50 text-primary-600',
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    info: 'bg-blue-50 text-blue-600',
  };
  return (
    <div className="stat-card">
      <div className={`stat-icon ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-slate-800">{value ?? '—'}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function ProgressBar({ value, color = 'primary', label }) {
  const colorMap = {
    primary: 'bg-primary-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
  };
  const clampedValue = Math.min(Math.max(value || 0, 0), 100);
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs">
          <span className="text-slate-600">{label}</span>
          <span className="font-semibold text-slate-700">{clampedValue}%</span>
        </div>
      )}
      <div className="progress-bar">
        <div className={`progress-fill ${colorMap[color]}`} style={{ width: `${clampedValue}%` }} />
      </div>
    </div>
  );
}

// KPA Dashboard
function KPADashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/kpa').then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" style={{borderWidth:'2px'}}></div></div>;
  if (!data) return null;

  const { stats, belum_isi_list, trend_data, employee_summary, period } = data;

  return (
    <div className="space-y-5">
      {/* Alert */}
      {stats.belum_isi > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {stats.belum_isi} pegawai belum mengisi CKP hari ini
            </p>
            <p className="text-xs text-amber-600 mt-1">
              {belum_isi_list.map(e => e.nama).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={Users} label="Total Pegawai" value={stats.total_pegawai} color="primary" />
        <StatCard icon={CheckCircle} label="Sudah Isi" value={stats.sudah_isi} color="success" sub="Hari ini" />
        <StatCard icon={XCircle} label="Belum Isi" value={stats.belum_isi} color="danger" sub="Hari ini" />
        <StatCard icon={ClipboardList} label="Kegiatan Hari Ini" value={stats.kegiatan_hari_ini} color="info" />
        <StatCard icon={Clock} label="Menunggu Verifikasi" value={stats.menunggu_verifikasi} color="warning" />
        <StatCard icon={Award} label="Rata-rata CKP" value={stats.rata_rata_ckp ? `${stats.rata_rata_ckp}` : '—'} color="purple" sub="Bulan ini" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Trend CKP */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-700 mb-4">Tren Kegiatan Bulanan</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trend_data} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Bar dataKey="total_kegiatan" fill="#0c8fe7" name="Kegiatan" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Employee status today */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-700 mb-4">Status Pengisian Hari Ini</h3>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {employee_summary.map(emp => (
              <div key={emp.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${emp.isi_hari_ini ? 'bg-emerald-500' : 'bg-red-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{emp.nama}</p>
                  <p className="text-xs text-slate-400">{emp.unit_kerja}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {emp.nilai_ckp ? (
                    <span className="text-sm font-bold text-primary-600">{emp.nilai_ckp}</span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                  {emp.isi_hari_ini
                    ? <span className="badge-success ml-2">✓ Isi</span>
                    : <span className="badge-danger ml-2">✗ Belum</span>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Employee summary table */}
      <div className="card">
        <div className="p-4 border-b border-slate-50">
          <h3 className="font-semibold text-slate-700">Rekap Pegawai — {period?.nama}</h3>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Nama Pegawai</th>
                <th>Unit Kerja</th>
                <th>Hari Ini</th>
                <th>Kegiatan Bulan Ini</th>
                <th>Hari Pengisian</th>
                <th>Nilai CKP</th>
              </tr>
            </thead>
            <tbody>
              {employee_summary.map(emp => (
                <tr key={emp.id}>
                  <td className="font-medium">{emp.nama}</td>
                  <td className="text-slate-500">{emp.unit_kerja}</td>
                  <td>
                    {emp.isi_hari_ini
                      ? <span className="badge-success">🟢 Sudah</span>
                      : <span className="badge-danger">🔴 Belum</span>
                    }
                  </td>
                  <td>{emp.total_kegiatan}</td>
                  <td>{emp.hari_pengisian} hari</td>
                  <td>
                    {emp.nilai_ckp
                      ? <span className="font-bold text-primary-600">{emp.nilai_ckp}</span>
                      : <span className="text-slate-400">—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Pegawai Dashboard
function PegawaiDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/pegawai').then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" style={{borderWidth:'2px'}}></div></div>;
  if (!data) return null;

  const { period, sudah_isi_hari_ini, today_activities, today_avg_capaian, month_stats, plan_progress, ckp_score } = data;
  const todayDate = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-5">
      {/* Today status banner */}
      <div className={`p-4 rounded-xl border flex items-center gap-4 ${
        sudah_isi_hari_ini
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-amber-50 border-amber-300'
      }`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
          sudah_isi_hari_ini ? 'bg-emerald-100' : 'bg-amber-100'
        }`}>
          {sudah_isi_hari_ini ? '🟢' : '🔴'}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-700">{todayDate}</p>
          {sudah_isi_hari_ini ? (
            <>
              <p className="text-base font-bold text-emerald-700">✓ CKP Hari Ini Sudah Diisi</p>
              <p className="text-xs text-emerald-600">
                {today_activities.length} kegiatan · Rata-rata capaian {today_avg_capaian}%
                {today_activities.some(a => !a.verif_status) && ' · Menunggu verifikasi'}
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-bold text-amber-700">⚠️ Belum Mengisi CKP Hari Ini</p>
              <p className="text-xs text-amber-600">Segera isi kegiatan harian Anda</p>
            </>
          )}
        </div>
        {!sudah_isi_hari_ini && (
          <a href="/kegiatan" className="btn-primary btn-sm flex-shrink-0">+ Isi Sekarang</a>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ClipboardList} label="Kegiatan Hari Ini" value={today_activities.length} color="primary" />
        <StatCard icon={BarChart3} label="Kegiatan Bulan Ini" value={month_stats.total_kegiatan} color="info" sub={period?.nama} />
        <StatCard icon={FileText} label="Bukti Dukung" value={month_stats.bukti_dukung} color="purple" sub="Total bulan ini" />
        <StatCard icon={Award} label="Nilai CKP" value={ckp_score?.nilai_ckp || '—'} color="success" sub={ckp_score?.status === 'final' ? 'Final' : 'Draft'} />
      </div>

      {/* Progress section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Month progress */}
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-slate-700">Progress Bulan Ini — {period?.nama}</h3>
          <ProgressBar
            value={month_stats.hari_kerja > 0 ? Math.round((month_stats.hari_pengisian / month_stats.hari_kerja) * 100) : 0}
            label="Hari Pengisian"
            color="primary"
          />
          <p className="text-xs text-slate-500">{month_stats.hari_pengisian} / {month_stats.hari_kerja} hari kerja</p>
          <ProgressBar
            value={month_stats.avg_capaian}
            label="Rata-rata Capaian"
            color="success"
          />
        </div>

        {/* RK Progress */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-700 mb-4">📋 Progress Rencana Kinerja</h3>
          <div className="space-y-3">
            {plan_progress.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Belum ada rencana kinerja</p>
            )}
            {plan_progress.map(plan => (
              <div key={plan.id}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium truncate max-w-48">{plan.kode} · {plan.nama}</span>
                  <span className="font-semibold text-slate-700 ml-2">{plan.persentase}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className={`progress-fill ${plan.persentase >= 100 ? 'bg-emerald-500' : plan.persentase >= 70 ? 'bg-primary-500' : 'bg-amber-400'}`}
                    style={{ width: `${Math.min(plan.persentase, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {plan.total_realisasi} / {plan.target} {plan.satuan}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Today's activities list */}
      {today_activities.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-slate-50">
            <h3 className="font-semibold text-slate-700">Kegiatan Hari Ini</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {today_activities.map(act => (
              <div key={act.id} className="p-4 flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  act.status_kegiatan === 'selesai' ? 'bg-emerald-500' :
                  act.status_kegiatan === 'dalam_proses' ? 'bg-amber-400' : 'bg-slate-300'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700">{act.nama_kegiatan}</p>
                  {act.pk_nama && <p className="text-xs text-slate-400">RK: {act.pk_nama}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold text-primary-600">{act.persentase_capaian}%</span>
                  {act.verif_status === 'terverifikasi'
                    ? <span className="badge-success">Terverifikasi</span>
                    : <span className="badge-warning">Menunggu</span>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user, isKPA, isKasubbag } = useAuth();

  if (isKPA || isKasubbag) return <KPADashboard />;
  return <PegawaiDashboard />;
}
