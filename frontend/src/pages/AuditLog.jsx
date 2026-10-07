import { useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Activity, Filter } from 'lucide-react';

const ACTION_LABELS = {
  LOGIN: { label: 'Login', color: 'badge-success' },
  LOGOUT: { label: 'Logout', color: 'badge-gray' },
  CREATE_ACTIVITY: { label: 'Tambah Kegiatan', color: 'badge-info' },
  UPDATE_ACTIVITY: { label: 'Edit Kegiatan', color: 'badge-warning' },
  DELETE_ACTIVITY: { label: 'Hapus Kegiatan', color: 'badge-danger' },
  VERIFY_ACTIVITY: { label: 'Verifikasi', color: 'badge-success' },
  CREATE_PERFORMANCE_PLAN: { label: 'Tambah PK', color: 'badge-info' },
  UPDATE_PERFORMANCE_PLAN: { label: 'Edit PK', color: 'badge-warning' },
  DELETE_PERFORMANCE_PLAN: { label: 'Hapus PK', color: 'badge-danger' },
  UPLOAD_EVIDENCE: { label: 'Upload Bukti', color: 'badge-purple' },
  ADD_EVIDENCE_LINK: { label: 'Tambah Link', color: 'badge-purple' },
  CREATE_BEHAVIOR: { label: 'Input Perilaku', color: 'badge-info' },
  UPDATE_BEHAVIOR: { label: 'Edit Perilaku', color: 'badge-warning' },
  FINALIZE_CKP: { label: 'Finalisasi CKP', color: 'badge-success' },
  CREATE_PERIOD: { label: 'Tambah Periode', color: 'badge-info' },
  ACTIVATE_PERIOD: { label: 'Aktifkan Periode', color: 'badge-success' },
  UPDATE_CKP_WEIGHTS: { label: 'Update Bobot', color: 'badge-warning' },
  UPDATE_SETTINGS: { label: 'Update Settings', color: 'badge-warning' },
  CREATE_USER: { label: 'Tambah User', color: 'badge-info' },
  CHANGE_PASSWORD: { label: 'Ganti Password', color: 'badge-gray' },
};

export default function AuditLog() {
  const { isKPA, isKasubbag } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterAction, setFilterAction] = useState('');
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    fetchLogs();
  }, [filterAction, limit]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = { limit };
      if (filterAction) params.action = filterAction;
      const r = await api.get('/activity-log', { params });
      setLogs(r.data);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Riwayat Aktivitas</h2>
          <p className="page-subtitle">Audit trail semua perubahan data sistem</p>
        </div>
      </div>

      {/* Filter */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div>
          <label className="label">Filter Aksi</label>
          <select className="input w-52" value={filterAction} onChange={e => setFilterAction(e.target.value)}>
            <option value="">Semua Aksi</option>
            {Object.entries(ACTION_LABELS).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Tampilkan</label>
          <select className="input w-28" value={limit} onChange={e => setLimit(e.target.value)}>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Logs */}
      <div className="card">
        {loading ? (
          <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" style={{borderWidth:'2px'}}></div></div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-slate-400">
            <Activity className="w-10 h-10 mb-2" />
            <p>Tidak ada riwayat aktivitas</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {logs.map(log => {
              const actionConfig = ACTION_LABELS[log.action] || { label: log.action, color: 'badge-gray' };
              return (
                <div key={log.id} className="p-4 flex items-start gap-3 hover:bg-slate-50/50 transition-colors">
                  <div className="w-2 h-2 bg-primary-400 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={actionConfig.color}>{actionConfig.label}</span>
                      <span className="text-sm font-medium text-slate-700">{log.pegawai_nama || log.username || '—'}</span>
                      {log.resource_type && log.resource_id && (
                        <span className="text-xs text-slate-400">#{log.resource_id}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(log.created_at).toLocaleDateString('id-ID', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                      })}
                    </p>
                  </div>
                  {log.resource_type && (
                    <span className="badge-gray text-xs flex-shrink-0">{log.resource_type}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
