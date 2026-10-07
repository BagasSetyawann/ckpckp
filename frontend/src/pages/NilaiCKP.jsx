import { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Award, CheckCircle, Lock, Save, UserCheck } from 'lucide-react';

function TabSwitch({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            active === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          {t.icon && <t.icon className="w-4 h-4" />}
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Nilai CKP Tab ───

function NilaiCKPView({ periods, employees, isKPA, isKasubbag, isAnggota, user }) {
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [ckpData, setCkpData] = useState(null);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    const active = periods.find(p => p.is_active);
    if (active) setFilterPeriod(String(active.id));
  }, [periods]);

  const fetchCKP = useCallback(async () => {
    const empId = isAnggota ? user?.employeeId : filterEmployee;
    if (!filterPeriod || !empId) { setCkpData(null); return; }
    setLoading(true);
    try {
      const r = await api.get('/scores/ckp', { params: { period_id: filterPeriod, employee_id: empId } });
      setCkpData(r.data);
    } catch { setCkpData(null); }
    finally { setLoading(false); }
  }, [filterPeriod, filterEmployee, isAnggota, user]);

  const fetchSummary = useCallback(async () => {
    if (!filterPeriod || isAnggota) return;
    try {
      const r = await api.get('/scores/summary', { params: { period_id: filterPeriod } });
      setSummary(r.data);
    } catch {}
  }, [filterPeriod, isAnggota]);

  useEffect(() => { fetchCKP(); fetchSummary(); }, [fetchCKP, fetchSummary]);

  const handleFinalize = async () => {
    const empId = filterEmployee;
    if (!empId || !filterPeriod) return;
    if (!confirm('Finalisasi nilai CKP? Nilai akan dikunci.')) return;
    setFinalizing(true);
    try {
      await api.post('/scores/ckp/finalize', { employee_id: empId, period_id: filterPeriod });
      fetchCKP();
      fetchSummary();
      alert('Nilai CKP berhasil difinalisasi');
    } catch (err) { alert(err.response?.data?.error || 'Gagal'); }
    finally { setFinalizing(false); }
  };

  const getNilaiLabel = (nilai) => {
    if (nilai >= 110) return { label: 'Sangat Baik', color: 'text-emerald-600' };
    if (nilai >= 90) return { label: 'Baik', color: 'text-primary-600' };
    if (nilai >= 70) return { label: 'Cukup', color: 'text-amber-600' };
    return { label: 'Kurang', color: 'text-red-500' };
  };

  const nilaiLabel = ckpData ? getNilaiLabel(ckpData.nilai_ckp) : null;

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div>
          <label className="label">Periode</label>
          <select className="input w-44" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
            <option value="">Pilih Periode</option>
            {periods.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
        </div>
        {!isAnggota && (
          <div>
            <label className="label">Pegawai</label>
            <select className="input w-52" value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
              <option value="">Pilih Pegawai</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.nama}</option>)}
            </select>
          </div>
        )}
      </div>

      {loading && <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" style={{borderWidth:'2px'}}></div></div>}

      {/* CKP Detail */}
      {ckpData && !loading && (
        <>
          {/* Main Score Card */}
          <div className="card p-6 bg-gradient-to-br from-primary-600 to-primary-800 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-primary-200 text-sm font-medium">Nilai CKP</p>
                <p className="text-5xl font-black mt-1">{ckpData.nilai_ckp}</p>
                <p className={`text-xl font-bold mt-1 ${ckpData.nilai_ckp >= 90 ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {nilaiLabel?.label}
                </p>
              </div>
              <div className="text-right">
                <Award className="w-16 h-16 text-white/20" />
                <div className="mt-2">
                  {ckpData.status === 'final'
                    ? <span className="bg-emerald-500/30 text-emerald-200 px-3 py-1 rounded-full text-sm font-medium">✓ Final</span>
                    : <span className="bg-amber-500/30 text-amber-200 px-3 py-1 rounded-full text-sm font-medium">⏳ Draft</span>
                  }
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-4">
              <div>
                <p className="text-primary-300 text-xs">Nilai PK</p>
                <p className="text-2xl font-bold">{ckpData.nilai_pk}</p>
              </div>
              <div>
                <p className="text-primary-300 text-xs">Nilai Perilaku</p>
                <p className="text-2xl font-bold">{ckpData.nilai_perilaku || '—'}</p>
              </div>
            </div>
          </div>

          {/* Components breakdown */}
          {ckpData.components?.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-700 mb-4">Komponen Nilai CKP</h3>
              <div className="space-y-4">
                {ckpData.components.map(c => (
                  <div key={c.kode} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                    <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                      <span className="text-primary-700 font-bold text-xs">{c.kode}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">{c.kode === 'PK' ? 'Nilai Capaian Kinerja' : 'Nilai Perilaku Kerja'}</span>
                        <span className="text-sm text-slate-500">Bobot: <strong>{c.bobot}%</strong></span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill bg-primary-500" style={{ width: `${Math.min(c.nilai, 100)}%` }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 w-28">
                      <p className="text-xs text-slate-400">Nilai × Bobot</p>
                      <p className="font-bold text-slate-800">{c.nilai} × {c.bobot}%</p>
                      <p className="text-primary-600 font-bold">= {c.nilai_tertimbang}</p>
                    </div>
                  </div>
                ))}

                {/* Formula */}
                <div className="p-4 bg-primary-50 border border-primary-100 rounded-xl">
                  <p className="text-xs text-slate-500 mb-2 font-medium">Formula Perhitungan</p>
                  <p className="text-sm text-slate-700 font-mono">
                    Nilai CKP = {ckpData.components?.map(c => `(${c.nilai} × ${c.bobot}%)`).join(' + ')}
                    {' = '}<strong className="text-primary-700">{ckpData.nilai_ckp}</strong>
                  </p>
                </div>
              </div>

              {isKPA && filterEmployee && ckpData.status !== 'final' && (
                <div className="mt-4 flex gap-3">
                  <button onClick={handleFinalize} disabled={finalizing} className="btn-success">
                    <Lock className="w-4 h-4" />
                    {finalizing ? 'Memproses...' : 'Finalisasi Nilai CKP'}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* All employees summary table */}
      {!isAnggota && summary.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-slate-50">
            <h3 className="font-semibold text-slate-700">Rekap Nilai CKP Semua Pegawai</h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Pegawai</th>
                  <th>Unit Kerja</th>
                  <th>Hari Pengisian</th>
                  <th>Nilai PK</th>
                  <th>Nilai CKP</th>
                  <th>Status</th>
                  <th>Predikat</th>
                </tr>
              </thead>
              <tbody>
                {summary.map(emp => {
                  const label = emp.nilai_ckp ? getNilaiLabel(emp.nilai_ckp) : null;
                  return (
                    <tr key={emp.id}>
                      <td className="font-medium">{emp.nama}</td>
                      <td className="text-slate-500 text-sm">{emp.unit_kerja}</td>
                      <td>{emp.hari_pengisian} hari</td>
                      <td>
                        {emp.nilai_pk
                          ? <span className="font-semibold text-primary-600">{emp.nilai_pk}</span>
                          : <span className="text-slate-400">—</span>
                        }
                      </td>
                      <td>
                        {emp.nilai_ckp
                          ? <span className={`text-lg font-bold ${label?.color}`}>{emp.nilai_ckp}</span>
                          : <span className="text-slate-400">Belum dihitung</span>
                        }
                      </td>
                      <td>
                        {emp.status_ckp === 'final'
                          ? <span className="badge-success">Final</span>
                          : <span className="badge-warning">Draft</span>
                        }
                      </td>
                      <td>
                        {label ? (
                          <span className={`badge ${emp.nilai_ckp >= 90 ? 'badge-success' : emp.nilai_ckp >= 70 ? 'badge-info' : 'badge-warning'}`}>
                            {label.label}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Penilaian Perilaku Tab (from PenilaianPerilaku) ───

const ASPEK = [
  { key: 'orientasi_pelayanan', label: 'Orientasi Pelayanan', desc: 'Komitmen memberikan pelayanan prima' },
  { key: 'akuntabel', label: 'Akuntabel', desc: 'Bertanggung jawab atas kepercayaan' },
  { key: 'kompeten', label: 'Kompeten', desc: 'Terus belajar dan mengembangkan kapabilitas' },
  { key: 'harmonis', label: 'Harmonis', desc: 'Saling peduli dan menghargai perbedaan' },
  { key: 'loyal', label: 'Loyal', desc: 'Berdedikasi dan mengutamakan kepentingan bangsa' },
  { key: 'adaptif', label: 'Adaptif', desc: 'Terus berinovasi dan antusias dalam perubahan' },
  { key: 'kolaboratif', label: 'Kolaboratif', desc: 'Membangun sinergi untuk hasil yang lebih baik' },
];

function ScoreInput({ value, onChange, disabled }) {
  const num = parseFloat(value) || 0;
  const color = num >= 90 ? 'text-emerald-600' : num >= 75 ? 'text-primary-600' : num >= 60 ? 'text-amber-600' : 'text-red-500';
  return (
    <div className="flex items-center gap-3">
      <input
        type="number" min="0" max="100" step="0.5"
        disabled={disabled}
        className={`input w-24 text-center font-semibold ${color} ${disabled ? 'bg-slate-50' : ''}`}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <div className="flex-1 progress-bar">
        <div
          className={`progress-fill ${num >= 90 ? 'bg-emerald-500' : num >= 75 ? 'bg-primary-500' : num >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
          style={{ width: `${Math.min(num, 100)}%` }}
        />
      </div>
      <span className={`text-sm font-bold w-14 text-right ${color}`}>{num.toFixed(1)}</span>
    </div>
  );
}

function PerilakuView({ periods, employees, isKPA, isAnggota, user }) {
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    orientasi_pelayanan: 0, akuntabel: 0, kompeten: 0,
    harmonis: 0, loyal: 0, adaptif: 0, kolaboratif: 0, catatan: ''
  });
  const [existingId, setExistingId] = useState(null);

  const nilai_akhir = Math.round(
    ASPEK.reduce((s, a) => s + (parseFloat(form[a.key]) || 0), 0) / ASPEK.length * 10
  ) / 10;

  useEffect(() => {
    const active = periods.find(p => p.is_active);
    if (active) setFilterPeriod(String(active.id));
  }, [periods]);

  const fetchAssessments = useCallback(async () => {
    const params = {};
    if (filterPeriod) params.period_id = filterPeriod;
    if (filterEmployee) params.employee_id = filterEmployee;
    setLoading(true);
    try {
      const r = await api.get('/behavior', { params });
      setAssessments(r.data);
      if (filterEmployee && filterPeriod) {
        const existing = r.data[0];
        if (existing) {
          setExistingId(existing.id);
          setForm({
            orientasi_pelayanan: existing.orientasi_pelayanan,
            akuntabel: existing.akuntabel,
            kompeten: existing.kompeten,
            harmonis: existing.harmonis,
            loyal: existing.loyal,
            adaptif: existing.adaptif,
            kolaboratif: existing.kolaboratif,
            catatan: existing.catatan || ''
          });
        } else {
          setExistingId(null);
          setForm({ orientasi_pelayanan: 0, akuntabel: 0, kompeten: 0, harmonis: 0, loyal: 0, adaptif: 0, kolaboratif: 0, catatan: '' });
        }
      }
    } finally { setLoading(false); }
  }, [filterPeriod, filterEmployee]);

  useEffect(() => { fetchAssessments(); }, [fetchAssessments]);

  const handleSave = async () => {
    if (!filterPeriod || (!isAnggota && !filterEmployee)) {
      alert('Pilih pegawai dan periode terlebih dahulu');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, period_id: filterPeriod, employee_id: isAnggota ? user?.employeeId : filterEmployee };
      if (existingId) await api.put(`/behavior/${existingId}`, payload);
      else await api.post('/behavior', payload);
      fetchAssessments();
      alert('Penilaian perilaku berhasil disimpan');
    } catch (err) { alert(err.response?.data?.error || 'Gagal menyimpan'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div>
          <label className="label">Periode</label>
          <select className="input w-44" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
            <option value="">Pilih Periode</option>
            {periods.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
        </div>
        {!isAnggota && (
          <div>
            <label className="label">Pegawai</label>
            <select className="input w-52" value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
              <option value="">Pilih Pegawai</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.nama}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Input form — KPA only when employee selected */}
      {isKPA && filterEmployee && filterPeriod && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-700">
              Input Nilai Perilaku
              {existingId && <span className="ml-2 badge-warning text-xs">Edit Mode</span>}
            </h3>
            <div className="text-right">
              <p className="text-xs text-slate-500">Nilai Akhir</p>
              <p className={`text-2xl font-bold ${nilai_akhir >= 90 ? 'text-emerald-600' : nilai_akhir >= 75 ? 'text-primary-600' : 'text-amber-600'}`}>
                {nilai_akhir}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {ASPEK.map(aspek => (
              <div key={aspek.key} className="grid grid-cols-3 gap-4 items-center">
                <div>
                  <p className="text-sm font-medium text-slate-700">{aspek.label}</p>
                  <p className="text-xs text-slate-400">{aspek.desc}</p>
                </div>
                <div className="col-span-2">
                  <ScoreInput
                    value={form[aspek.key]}
                    onChange={v => setForm({ ...form, [aspek.key]: v })}
                  />
                </div>
              </div>
            ))}

            <div className="form-group pt-2 border-t border-slate-100">
              <label className="label">Catatan</label>
              <textarea
                className="input resize-none" rows={2}
                placeholder="Catatan penilaian..."
                value={form.catatan}
                onChange={e => setForm({ ...form, catatan: e.target.value })}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                <Save className="w-4 h-4" />
                {saving ? 'Menyimpan...' : existingId ? 'Perbarui Penilaian' : 'Simpan Penilaian'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assessments table */}
      <div className="card">
        <div className="p-4 border-b border-slate-50">
          <h3 className="font-semibold text-slate-700">Riwayat Penilaian Perilaku</h3>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" style={{borderWidth:'2px'}}></div></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  {!isAnggota && <th>Pegawai</th>}
                  <th>Periode</th>
                  <th>Orientasi</th>
                  <th>Akuntabel</th>
                  <th>Kompeten</th>
                  <th>Harmonis</th>
                  <th>Loyal</th>
                  <th>Adaptif</th>
                  <th>Kolaboratif</th>
                  <th>Nilai Akhir</th>
                  <th>Penilai</th>
                </tr>
              </thead>
              <tbody>
                {assessments.length === 0 && (
                  <tr><td colSpan="12" className="text-center text-slate-400 py-8">Belum ada data penilaian</td></tr>
                )}
                {assessments.map(a => (
                  <tr key={a.id}>
                    {!isAnggota && <td className="font-medium">{a.pegawai_nama}</td>}
                    <td className="text-sm">{a.period_nama}</td>
                    {ASPEK.map(asp => (
                      <td key={asp.key} className="text-center">
                        <span className={`font-medium ${a[asp.key] >= 90 ? 'text-emerald-600' : a[asp.key] >= 75 ? 'text-primary-600' : 'text-amber-600'}`}>
                          {a[asp.key]}
                        </span>
                      </td>
                    ))}
                    <td>
                      <span className={`text-lg font-bold ${a.nilai_akhir >= 90 ? 'text-emerald-600' : a.nilai_akhir >= 75 ? 'text-primary-600' : 'text-amber-600'}`}>
                        {a.nilai_akhir}
                      </span>
                    </td>
                    <td className="text-sm text-slate-500">{a.assessed_by_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───

export default function NilaiCKP() {
  const { isKPA, isKasubbag, isAnggota, user } = useAuth();
  const [activeTab, setActiveTab] = useState('ckp');
  const [periods, setPeriods] = useState([]);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    api.get('/periods').then(r => setPeriods(r.data));
    if (!isAnggota) api.get('/users/employees').then(r => setEmployees(r.data.filter(e => e.role === 'Anggota')));
  }, []);

  const TABS = [
    { id: 'ckp', label: 'Nilai CKP', icon: Award },
    { id: 'perilaku', label: 'Penilaian Perilaku', icon: UserCheck },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Nilai CKP</h2>
          <p className="page-subtitle">Capaian kinerja dan penilaian perilaku pegawai</p>
        </div>
        <TabSwitch tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === 'ckp' && (
        <NilaiCKPView
          periods={periods}
          employees={employees}
          isKPA={isKPA}
          isKasubbag={isKasubbag}
          isAnggota={isAnggota}
          user={user}
        />
      )}

      {activeTab === 'perilaku' && (
        <PerilakuView
          periods={periods}
          employees={employees}
          isKPA={isKPA}
          isAnggota={isAnggota}
          user={user}
        />
      )}
    </div>
  );
}
