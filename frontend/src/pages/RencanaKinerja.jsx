import { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Edit2, Trash2, X, Target, TrendingUp, List, BarChart3,
  Upload, FileSpreadsheet, Users, Check, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle, Info, ArrowRight, Layers, ClipboardCopy
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

/* ─── Shared UI Components ─── */

function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null;
  const sizeMap = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${sizeMap[size]} animate-fade-in-up max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <h3 className="font-semibold text-slate-800 text-lg">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
      </div>
    </div>
  );
}

function TabSwitch({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            active === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          {t.icon && <t.icon className="w-4 h-4" />}
          <span className="hidden sm:inline">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

function Toast({ message, type = 'success', onClose }) {
  if (!message) return null;
  const icons = { success: CheckCircle, error: AlertCircle, info: Info };
  const colors = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  const Icon = icons[type] || icons.info;
  return (
    <div className={`fixed top-4 right-4 z-[60] flex items-center gap-3 px-5 py-3 rounded-xl border shadow-lg animate-fade-in-up ${colors[type]}`}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <p className="text-sm font-medium">{message}</p>
      <button onClick={onClose} className="ml-2 p-1 hover:bg-white/50 rounded">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ─── STEP 1: RK List (Daftar Rencana Kinerja) ─── */

function RKListView({ plans, periods, employees, isAnggota, canEdit, filterPeriod, setFilterPeriod, filterEmployee, setFilterEmployee, loading, onAdd, onEdit, onDelete, onImportMPH }) {
  const totalBobot = plans.reduce((sum, p) => sum + (parseFloat(p.bobot) || 0), 0);

  return (
    <div className="space-y-5">
      {/* Quick Actions for KPA - Big, clear buttons */}
      {canEdit && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={onAdd}
            className="btn-primary py-4 text-base justify-center rounded-xl"
          >
            <Plus className="w-5 h-5" />
            <span>Tambah RK Satu-Satu</span>
          </button>
          <button
            onClick={onImportMPH}
            className="btn bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 py-4 text-base justify-center rounded-xl shadow-sm"
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span>Import dari MPH</span>
          </button>
        </div>
      )}

      {/* Filters - Simplified */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[160px]">
          <label className="label text-xs">📅 Periode</label>
          <select className="input text-base py-2.5" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
            <option value="">Semua Periode</option>
            {periods.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
        </div>
        {!isAnggota && (
          <div className="flex-1 min-w-[160px]">
            <label className="label text-xs">👤 Pegawai</label>
            <select className="input text-base py-2.5" value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
              <option value="">Semua Pegawai</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.nama}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Stats summary - Bigger for readability */}
      {plans.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-5 text-center">
            <p className="text-3xl font-bold text-primary-600">{plans.length}</p>
            <p className="text-sm text-slate-500 mt-1">Total RK</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-3xl font-bold text-emerald-600">{totalBobot.toFixed(0)}%</p>
            <p className="text-sm text-slate-500 mt-1">Total Bobot</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-3xl font-bold text-amber-600">
              {plans.filter(p => p.persentase_capaian >= 100).length}
            </p>
            <p className="text-sm text-slate-500 mt-1">RK Tercapai</p>
          </div>
          <div className="card p-5 text-center">
            <p className="text-3xl font-bold text-slate-700">
              {Math.round(plans.reduce((s, p) => s + (p.persentase_capaian || 0), 0) / (plans.length || 1))}%
            </p>
            <p className="text-sm text-slate-500 mt-1">Rata-rata Capaian</p>
          </div>
        </div>
      )}

      {/* Plans as Cards (mobile friendly, bigger touch targets) */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" style={{borderWidth:'3px'}}></div>
          </div>
        ) : plans.length === 0 ? (
          <div className="card p-12 text-center">
            <Target className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-lg text-slate-500 font-medium">Belum ada Rencana Kinerja</p>
            <p className="text-sm text-slate-400 mt-1">Klik tombol di atas untuk menambahkan</p>
          </div>
        ) : (
          plans.map(p => (
            <RKCard key={p.id} plan={p} isAnggota={isAnggota} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} />
          ))
        )}
      </div>
    </div>
  );
}

function RKCard({ plan: p, isAnggota, canEdit, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const capaianColor = p.persentase_capaian >= 100 ? 'emerald' : p.persentase_capaian >= 70 ? 'primary' : 'amber';

  return (
    <div className="card overflow-hidden transition-all hover:shadow-md">
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-4">
          {/* Progress circle */}
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-${capaianColor}-100`}>
            <span className={`text-lg font-bold text-${capaianColor}-600`}>{p.persentase_capaian || 0}%</span>
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {p.kode && <span className="badge-info font-mono text-xs">{p.kode}</span>}
              <span className="badge-purple text-xs">{p.bobot}% bobot</span>
            </div>
            <h4 className="font-semibold text-slate-800 text-base">{p.nama}</h4>
            {!isAnggota && (
              <p className="text-sm text-slate-500 mt-0.5">👤 {p.pegawai_nama}</p>
            )}
          </div>

          {/* Expand toggle */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {canEdit && (
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => onEdit(p)} className="btn-icon btn-secondary btn-sm p-2.5">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(p.id)} className="btn-icon btn-danger btn-sm p-2.5">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
            {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="w-full progress-bar h-2.5">
            <div
              className={`progress-fill bg-${capaianColor}-500`}
              style={{ width: `${Math.min(p.persentase_capaian || 0, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1.5">
            <span>Realisasi: {p.total_realisasi ?? 0} / {p.target} {p.satuan}</span>
            <span>{p.jumlah_kegiatan} kegiatan</span>
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-50 bg-slate-50/50 space-y-2 text-sm animate-fade-in">
          {p.deskripsi && <div><span className="text-slate-500">Deskripsi:</span> <span className="text-slate-700">{p.deskripsi}</span></div>}
          {p.indikator && <div><span className="text-slate-500">Indikator:</span> <span className="text-slate-700">{p.indikator}</span></div>}
          <div><span className="text-slate-500">Target:</span> <span className="font-medium">{p.target} {p.satuan}</span></div>
          <div><span className="text-slate-500">Periode:</span> <span>{p.period_nama}</span></div>
        </div>
      )}
    </div>
  );
}

/* ─── STEP 2: Import MPH Modal ─── */

function ImportMPHModal({ open, onClose, periods, employees, onSuccess }) {
  const [step, setStep] = useState(1); // 1=choose method, 2=upload/manual, 3=preview, 4=result
  const [method, setMethod] = useState(null); // 'upload' or 'manual'
  const [periodId, setPeriodId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState('');

  // Manual form state
  const [manualProjects, setManualProjects] = useState([
    { proyek_nama: '', rencana_kerja_items: [{ nama: '', indikator: '', target: 100, satuan: 'Persen', bobot: 0, employee_ids: [] }] }
  ]);

  // Preview entries (from upload or manual)
  const [previewEntries, setPreviewEntries] = useState([]);

  const reset = () => {
    setStep(1);
    setMethod(null);
    setPeriodId('');
    setUploading(false);
    setImporting(false);
    setParseResult(null);
    setImportResult(null);
    setError('');
    setManualProjects([
      { proyek_nama: '', rencana_kerja_items: [{ nama: '', indikator: '', target: 100, satuan: 'Persen', bobot: 0, employee_ids: [] }] }
    ]);
    setPreviewEntries([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Step 1: Choose method
  const handleChooseMethod = (m) => {
    setMethod(m);
    setStep(2);
  };

  // Step 2 Upload: handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/mph/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setParseResult(res.data);

      // Build preview entries from parse result
      const entries = [];
      if (res.data.personnel) {
        res.data.personnel.forEach(person => {
          // Try to match person name to employee
          const matchedEmp = employees.find(e =>
            e.nama.toLowerCase().includes(person.nama.toLowerCase()) ||
            person.nama.toLowerCase().includes(e.nama.toLowerCase())
          );

          person.indicators.forEach((ind, idx) => {
            entries.push({
              employee_id: matchedEmp?.id || '',
              employee_nama: matchedEmp?.nama || person.nama,
              kode: `RK-${String(idx + 1).padStart(2, '0')}`,
              nama: ind.rk_nama,
              deskripsi: ind.project !== 'Umum' ? `Proyek: ${ind.project}` : '',
              indikator: ind.value,
              target: 100,
              satuan: 'Persen',
              bobot: 0,
              _matched: !!matchedEmp,
            });
          });
        });
      }
      setPreviewEntries(entries);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memproses file');
    } finally {
      setUploading(false);
    }
  };

  // Step 2 Manual: build entries
  const handleManualNext = () => {
    const entries = [];
    manualProjects.forEach(project => {
      project.rencana_kerja_items.forEach(rk => {
        if (!rk.nama) return;
        rk.employee_ids.forEach(empId => {
          const emp = employees.find(e => String(e.id) === String(empId));
          entries.push({
            employee_id: empId,
            employee_nama: emp?.nama || `ID ${empId}`,
            kode: `RK-${String(entries.length + 1).padStart(2, '0')}`,
            nama: rk.nama,
            deskripsi: project.proyek_nama ? `Proyek: ${project.proyek_nama}` : '',
            indikator: rk.indikator,
            target: rk.target || 100,
            satuan: rk.satuan || 'Persen',
            bobot: rk.bobot || 0,
            _matched: true,
          });
        });
      });
    });

    if (entries.length === 0) {
      setError('Tidak ada RK yang bisa dibuat. Pastikan setidaknya ada 1 kegiatan dengan pegawai terpilih.');
      return;
    }
    setPreviewEntries(entries);
    setStep(3);
  };

  // Step 3: Import
  const handleImport = async () => {
    if (!periodId) {
      setError('Pilih periode terlebih dahulu');
      return;
    }

    const validEntries = previewEntries.filter(e => e.employee_id && e.nama);
    if (validEntries.length === 0) {
      setError('Tidak ada RK valid untuk diimport');
      return;
    }

    setImporting(true);
    setError('');

    try {
      const res = await api.post('/mph/import', {
        period_id: parseInt(periodId),
        entries: validEntries,
      });
      setImportResult(res.data);
      setStep(4);
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal mengimport');
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={handleClose} title="Import RK dari Matriks Peran Hasil (MPH)" size="xl">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-red-700 font-medium">{error}</p>
            <button onClick={() => setError('')} className="text-xs text-red-500 underline mt-1">Tutup</button>
          </div>
        </div>
      )}

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
        {[
          { num: 1, label: 'Pilih Cara' },
          { num: 2, label: method === 'upload' ? 'Upload File' : 'Isi Manual' },
          { num: 3, label: 'Pratinjau' },
          { num: 4, label: 'Selesai' },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step >= s.num ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              {step > s.num ? <Check className="w-4 h-4" /> : s.num}
            </div>
            <span className={`text-sm hidden sm:inline ${step >= s.num ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
              {s.label}
            </span>
            {i < 3 && <ArrowRight className="w-4 h-4 text-slate-300 mx-1" />}
          </div>
        ))}
      </div>

      {/* STEP 1: Choose Method */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-slate-600 text-sm mb-4">
            Pilih cara memasukkan data dari Matriks Peran Hasil (MPH) tim Anda:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => handleChooseMethod('upload')}
              className="card-hover p-6 text-center cursor-pointer border-2 border-transparent hover:border-primary-300 transition-all rounded-xl"
            >
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Upload className="w-7 h-7 text-blue-600" />
              </div>
              <h4 className="font-semibold text-slate-800 text-lg mb-2">Upload File Excel</h4>
              <p className="text-sm text-slate-500">Upload file MPH dalam format Excel (.xlsx, .xls). Sistem akan membaca struktur secara otomatis.</p>
            </button>
            <button
              onClick={() => handleChooseMethod('manual')}
              className="card-hover p-6 text-center cursor-pointer border-2 border-transparent hover:border-purple-300 transition-all rounded-xl"
            >
              <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <ClipboardCopy className="w-7 h-7 text-purple-600" />
              </div>
              <h4 className="font-semibold text-slate-800 text-lg mb-2">Isi Manual dari MPH</h4>
              <p className="text-sm text-slate-500">Masukkan data proyek dan rencana kerja secara manual sesuai struktur MPH.</p>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2A: Upload File */}
      {step === 2 && method === 'upload' && (
        <div className="space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
              <Info className="w-5 h-5" /> Format File MPH
            </h4>
            <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
              <li>Baris 1-9: Header hierarki (Tujuan → Sasaran → Proyek → RK Anggota)</li>
              <li>Baris 10+: Data personel dan indikator kinerja individu</li>
              <li>Kolom pertama: Nama pegawai / peran penugasan</li>
              <li>Kolom-kolom selanjutnya: Indikator kinerja per proyek</li>
            </ul>
          </div>

          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-primary-400 transition-colors">
            <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600 font-medium mb-2">Pilih file Excel MPH</p>
            <p className="text-xs text-slate-400 mb-4">Format: .xlsx, .xls</p>
            <label className="btn-primary cursor-pointer inline-flex items-center gap-2 py-3 px-6 text-base">
              <Upload className="w-5 h-5" />
              {uploading ? 'Memproses...' : 'Pilih File'}
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setStep(1); setMethod(null); }} className="btn-secondary py-2.5">
              ← Kembali
            </button>
          </div>
        </div>
      )}

      {/* STEP 2B: Manual Entry */}
      {step === 2 && method === 'manual' && (
        <ManualMPHForm
          projects={manualProjects}
          setProjects={setManualProjects}
          employees={employees}
          onBack={() => { setStep(1); setMethod(null); }}
          onNext={handleManualNext}
        />
      )}

      {/* STEP 3: Preview */}
      {step === 3 && (
        <div className="space-y-5">
          {/* Period selector */}
          <div className="form-group">
            <label className="label text-base font-semibold">📅 Pilih Periode untuk Import *</label>
            <select
              className="input text-base py-3"
              value={periodId}
              onChange={e => setPeriodId(e.target.value)}
              required
            >
              <option value="">-- Pilih Periode --</option>
              {periods.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
            </select>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-sm text-amber-700">
              <strong>{previewEntries.length} Rencana Kinerja</strong> akan dibuat.
              {previewEntries.filter(e => !e._matched).length > 0 && (
                <span className="text-red-600 ml-1">
                  ⚠️ {previewEntries.filter(e => !e._matched).length} item belum cocok dengan pegawai yang terdaftar.
                </span>
              )}
            </p>
          </div>

          {/* Preview entries */}
          <div className="max-h-72 overflow-y-auto space-y-2">
            {previewEntries.map((entry, idx) => (
              <div key={idx} className={`card p-3 ${entry._matched ? '' : 'border-red-200 bg-red-50/30'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                    entry._matched ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800">{entry.nama}</p>
                    <p className="text-xs text-slate-500">
                      👤 {entry.employee_nama}
                      {entry.deskripsi && ` • ${entry.deskripsi}`}
                    </p>
                    {entry.indikator && (
                      <p className="text-xs text-slate-400 mt-0.5">Indikator: {entry.indikator}</p>
                    )}
                  </div>
                  <div className="text-right text-xs flex-shrink-0">
                    <p className="font-semibold">{entry.target} {entry.satuan}</p>
                    <p className="text-slate-400">Bobot {entry.bobot}%</p>
                  </div>
                  {!entry._matched && (
                    <div className="flex-shrink-0">
                      <select
                        className="input text-xs py-1 w-36"
                        value={entry.employee_id}
                        onChange={e => {
                          const updated = [...previewEntries];
                          const emp = employees.find(emp => String(emp.id) === e.target.value);
                          updated[idx] = { ...updated[idx], employee_id: e.target.value, employee_nama: emp?.nama || '', _matched: !!e.target.value };
                          setPreviewEntries(updated);
                        }}
                      >
                        <option value="">Pilih Pegawai</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.nama}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-100">
            <button
              onClick={() => setStep(2)}
              className="btn-secondary py-2.5"
            >
              ← Kembali
            </button>
            <button
              onClick={handleImport}
              disabled={importing || !periodId}
              className="btn-primary py-2.5 flex-1 text-base justify-center"
            >
              {importing ? 'Mengimport...' : `Import ${previewEntries.filter(e => e._matched).length} RK`}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Result */}
      {step === 4 && importResult && (
        <div className="text-center space-y-5">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Import Berhasil!</h3>
            <p className="text-slate-500 mt-1">{importResult.message}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{importResult.created}</p>
              <p className="text-sm text-slate-500">RK Dibuat</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-slate-500">{importResult.skipped}</p>
              <p className="text-sm text-slate-500">Dilewati</p>
            </div>
          </div>
          {importResult.errors && importResult.errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left">
              <p className="text-sm font-semibold text-amber-700 mb-1">Catatan:</p>
              <ul className="text-xs text-amber-600 space-y-0.5">
                {importResult.errors.slice(0, 5).map((e, i) => <li key={i}>• {e}</li>)}
                {importResult.errors.length > 5 && <li>... dan {importResult.errors.length - 5} lainnya</li>}
              </ul>
            </div>
          )}
          <button
            onClick={handleClose}
            className="btn-primary py-3 px-8 text-base"
          >
            Selesai
          </button>
        </div>
      )}
    </Modal>
  );
}

/* ─── Manual MPH Form Component ─── */

function ManualMPHForm({ projects, setProjects, employees, onBack, onNext }) {
  const addProject = () => {
    setProjects([...projects, {
      proyek_nama: '',
      rencana_kerja_items: [{ nama: '', indikator: '', target: 100, satuan: 'Persen', bobot: 0, employee_ids: [] }]
    }]);
  };

  const removeProject = (idx) => {
    if (projects.length <= 1) return;
    setProjects(projects.filter((_, i) => i !== idx));
  };

  const updateProject = (idx, field, value) => {
    const updated = [...projects];
    updated[idx] = { ...updated[idx], [field]: value };
    setProjects(updated);
  };

  const addRK = (projectIdx) => {
    const updated = [...projects];
    updated[projectIdx].rencana_kerja_items.push({ nama: '', indikator: '', target: 100, satuan: 'Persen', bobot: 0, employee_ids: [] });
    setProjects(updated);
  };

  const removeRK = (projectIdx, rkIdx) => {
    const updated = [...projects];
    if (updated[projectIdx].rencana_kerja_items.length <= 1) return;
    updated[projectIdx].rencana_kerja_items = updated[projectIdx].rencana_kerja_items.filter((_, i) => i !== rkIdx);
    setProjects(updated);
  };

  const updateRK = (projectIdx, rkIdx, field, value) => {
    const updated = [...projects];
    updated[projectIdx].rencana_kerja_items[rkIdx] = {
      ...updated[projectIdx].rencana_kerja_items[rkIdx],
      [field]: value,
    };
    setProjects(updated);
  };

  const toggleEmployee = (projectIdx, rkIdx, empId) => {
    const updated = [...projects];
    const rk = updated[projectIdx].rencana_kerja_items[rkIdx];
    const idx = rk.employee_ids.indexOf(empId);
    if (idx >= 0) {
      rk.employee_ids = rk.employee_ids.filter(id => id !== empId);
    } else {
      rk.employee_ids = [...rk.employee_ids, empId];
    }
    setProjects(updated);
  };

  const selectAllEmployees = (projectIdx, rkIdx) => {
    const updated = [...projects];
    updated[projectIdx].rencana_kerja_items[rkIdx].employee_ids = employees.map(e => String(e.id));
    setProjects(updated);
  };

  return (
    <div className="space-y-5">
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
        <h4 className="font-semibold text-purple-800 mb-1 flex items-center gap-2">
          <Layers className="w-5 h-5" /> Cara Pengisian
        </h4>
        <p className="text-sm text-purple-700">
          Masukkan nama proyek (misal: SAKERNAS, SUSENAS), lalu tambahkan rencana kerja anggota di bawahnya, dan pilih pegawai yang bertugas.
        </p>
      </div>

      {projects.map((project, pIdx) => (
        <div key={pIdx} className="card p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Layers className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex-1">
              <input
                className="input text-base py-2.5 font-semibold"
                placeholder={`Nama Proyek / Survei (cth: SAKERNAS, SUSENAS)`}
                value={project.proyek_nama}
                onChange={e => updateProject(pIdx, 'proyek_nama', e.target.value)}
              />
            </div>
            {projects.length > 1 && (
              <button onClick={() => removeProject(pIdx)} className="btn-icon btn-danger btn-sm p-2">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* RK Items */}
          <div className="space-y-3 pl-2 border-l-2 border-indigo-200">
            {project.rencana_kerja_items.map((rk, rkIdx) => (
              <div key={rkIdx} className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-3">
                    <input
                      className="input text-sm py-2"
                      placeholder="Nama Rencana Kerja (cth: Identifikasi blok sensus, Pelatihan, Pendataan)"
                      value={rk.nama}
                      onChange={e => updateRK(pIdx, rkIdx, 'nama', e.target.value)}
                    />
                    <input
                      className="input text-sm py-2"
                      placeholder="Indikator (cth: Tingkat kualitas minimal 95%)"
                      value={rk.indikator}
                      onChange={e => updateRK(pIdx, rkIdx, 'indikator', e.target.value)}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-slate-500">Target</label>
                        <input
                          className="input text-sm py-1.5"
                          type="number"
                          value={rk.target}
                          onChange={e => updateRK(pIdx, rkIdx, 'target', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">Satuan</label>
                        <input
                          className="input text-sm py-1.5"
                          placeholder="Persen"
                          value={rk.satuan}
                          onChange={e => updateRK(pIdx, rkIdx, 'satuan', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">Bobot (%)</label>
                        <input
                          className="input text-sm py-1.5"
                          type="number"
                          min="0"
                          max="100"
                          value={rk.bobot}
                          onChange={e => updateRK(pIdx, rkIdx, 'bobot', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    {/* Employee multi-select */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs text-slate-500 font-medium">👤 Pegawai yang bertugas</label>
                        <button
                          type="button"
                          onClick={() => selectAllEmployees(pIdx, rkIdx)}
                          className="text-xs text-primary-600 hover:underline"
                        >
                          Pilih Semua
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {employees.map(emp => {
                          const isSelected = rk.employee_ids.includes(String(emp.id));
                          return (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => toggleEmployee(pIdx, rkIdx, String(emp.id))}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                isSelected
                                  ? 'bg-primary-100 border-primary-300 text-primary-700'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-primary-300'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                              {emp.nama}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {project.rencana_kerja_items.length > 1 && (
                    <button onClick={() => removeRK(pIdx, rkIdx)} className="p-1.5 hover:bg-red-100 rounded-lg text-red-400 hover:text-red-600 mt-1">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => addRK(pIdx)}
              className="btn-secondary btn-sm w-full justify-center py-2"
            >
              <Plus className="w-4 h-4" /> Tambah Rencana Kerja
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addProject}
        className="btn-secondary w-full justify-center py-3 text-base"
      >
        <Plus className="w-5 h-5" /> Tambah Proyek / Survei
      </button>

      <div className="flex gap-3 pt-3 border-t border-slate-100">
        <button onClick={onBack} className="btn-secondary py-2.5">← Kembali</button>
        <button onClick={onNext} className="btn-primary py-2.5 flex-1 text-base justify-center">
          Lanjut ke Pratinjau →
        </button>
      </div>
    </div>
  );
}

/* ─── Monitoring Tab ─── */

function MonitoringView({ periods, employees, isAnggota, user }) {
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [pkData, setPkData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const active = periods.find(p => p.is_active);
    if (active) setFilterPeriod(String(active.id));
  }, [periods]);

  const fetchPKData = useCallback(async () => {
    const empId = isAnggota ? user?.employeeId : filterEmployee;
    if (!filterPeriod || !empId) { setPkData(null); return; }
    setLoading(true);
    try {
      const r = await api.get('/scores/pk', { params: { period_id: filterPeriod, employee_id: empId } });
      setPkData(r.data);
    } catch { setPkData(null); }
    finally { setLoading(false); }
  }, [filterPeriod, filterEmployee, isAnggota, user]);

  useEffect(() => { fetchPKData(); }, [fetchPKData]);

  const chartData = pkData?.plans?.map(p => ({
    name: p.kode || p.nama.slice(0, 12),
    target: p.target,
    realisasi: p.total_realisasi,
    capaian: p.persentase_capaian,
  })) || [];

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[160px]">
          <label className="label text-xs">📅 Periode *</label>
          <select className="input text-base py-2.5" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
            <option value="">Pilih Periode</option>
            {periods.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
        </div>
        {!isAnggota && (
          <div className="flex-1 min-w-[160px]">
            <label className="label text-xs">👤 Pegawai *</label>
            <select className="input text-base py-2.5" value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
              <option value="">Pilih Pegawai</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.nama}</option>)}
            </select>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" style={{borderWidth:'3px'}}></div>
        </div>
      )}

      {!loading && !pkData && (
        <div className="card p-12 text-center text-slate-400">
          <Target className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-lg font-medium">Pilih periode{!isAnggota && ' dan pegawai'}</p>
          <p className="text-sm mt-1">untuk melihat monitoring capaian RK</p>
        </div>
      )}

      {pkData && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="card p-5 text-center">
              <p className="text-sm text-slate-500 mb-1">Total RK</p>
              <p className="text-3xl font-bold text-slate-800">{pkData.plans?.length || 0}</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-sm text-slate-500 mb-1">Nilai RK</p>
              <p className={`text-3xl font-bold ${pkData.nilai_pk >= 90 ? 'text-emerald-600' : pkData.nilai_pk >= 70 ? 'text-primary-600' : 'text-amber-600'}`}>
                {pkData.nilai_pk || 0}
              </p>
            </div>
            <div className="card p-5 text-center col-span-2 sm:col-span-1">
              <p className="text-sm text-slate-500 mb-1">Total Bobot</p>
              <p className="text-3xl font-bold text-purple-600">{pkData.total_bobot || 0}%</p>
            </div>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-700 mb-4 text-base">📊 Grafik Capaian RK (%)</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 13 }} unit="%" />
                  <Tooltip
                    contentStyle={{ fontSize: 13, borderRadius: 12, border: '1px solid #e2e8f0' }}
                    formatter={(value) => [`${value}%`, 'Capaian']}
                  />
                  <Bar dataKey="capaian" name="Capaian" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.capaian >= 100 ? '#10b981' : entry.capaian >= 70 ? '#0c8fe7' : '#f59e0b'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Detail Cards (instead of table, easier to read) */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-700 text-base">📋 Detail Capaian Per RK</h3>
            {pkData.plans?.map(p => (
              <div key={p.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    p.persentase_capaian >= 100 ? 'bg-emerald-100' : p.persentase_capaian >= 70 ? 'bg-blue-100' : 'bg-amber-100'
                  }`}>
                    <span className={`text-sm font-bold ${
                      p.persentase_capaian >= 100 ? 'text-emerald-700' : p.persentase_capaian >= 70 ? 'text-blue-700' : 'text-amber-700'
                    }`}>{p.persentase_capaian || 0}%</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge-info font-mono text-xs">{p.kode || '—'}</span>
                      <span className="badge-purple text-xs">{p.bobot}%</span>
                    </div>
                    <h4 className="font-medium text-slate-800">{p.nama}</h4>
                    <div className="flex gap-4 mt-2 text-sm text-slate-500">
                      <span>Target: {p.target} {p.satuan}</span>
                      <span>Realisasi: <strong>{p.total_realisasi}</strong></span>
                      <span>Kegiatan: {p.jumlah_kegiatan}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-400">Nilai Tertimbang</p>
                    <p className="text-xl font-bold text-slate-700">{p.nilai_tertimbang || 0}</p>
                  </div>
                </div>
                {/* Progress */}
                <div className="mt-3 progress-bar h-2">
                  <div
                    className={`progress-fill ${p.persentase_capaian >= 100 ? 'bg-emerald-500' : p.persentase_capaian >= 70 ? 'bg-primary-500' : 'bg-amber-400'}`}
                    style={{ width: `${Math.min(p.persentase_capaian || 0, 100)}%` }}
                  />
                </div>
              </div>
            ))}

            {pkData.plans?.length > 0 && (
              <div className="card p-5 bg-primary-50 border-primary-200">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary-700 text-base">Nilai RK (Tertimbang)</span>
                  <span className="text-2xl font-bold text-primary-700">{pkData.nilai_pk}</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Main Page ─── */

export default function RencanaKinerja() {
  const { isKPA, isKasubbag, isAnggota, user } = useAuth();
  const canEdit = isKPA;

  const [activeTab, setActiveTab] = useState('daftar');
  const [plans, setPlans] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [mphModalOpen, setMphModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const [form, setForm] = useState({ employee_id: '', period_id: '', kode: '', nama: '', deskripsi: '', indikator: '', target: '', satuan: '', bobot: '' });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterPeriod) params.period_id = filterPeriod;
      if (filterEmployee) params.employee_id = filterEmployee;
      const r = await api.get('/performance-plans', { params });
      setPlans(r.data);
    } finally { setLoading(false); }
  }, [filterPeriod, filterEmployee]);

  useEffect(() => {
    api.get('/periods').then(r => {
      setPeriods(r.data);
      const active = r.data.find(p => p.is_active);
      if (active) setFilterPeriod(String(active.id));
    });
    if (!isAnggota) api.get('/users/employees').then(r => setEmployees(r.data.filter(e => e.role === 'Anggota')));
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const openModal = (data = null) => {
    setEditData(data);
    setForm(data ? {
      employee_id: data.employee_id, period_id: data.period_id, kode: data.kode || '',
      nama: data.nama, deskripsi: data.deskripsi || '', indikator: data.indikator || '',
      target: data.target, satuan: data.satuan, bobot: data.bobot
    } : { employee_id: '', period_id: filterPeriod || '', kode: '', nama: '', deskripsi: '', indikator: '', target: '', satuan: '', bobot: '' });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editData?.id) await api.put(`/performance-plans/${editData.id}`, form);
      else await api.post('/performance-plans', form);
      setModalOpen(false);
      fetchPlans();
      showToast(editData ? 'RK berhasil diperbarui' : 'RK berhasil ditambahkan');
    } catch (err) { showToast(err.response?.data?.error || 'Gagal menyimpan', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus rencana kinerja ini? Semua kegiatan terkait akan terpengaruh.')) return;
    try {
      await api.delete(`/performance-plans/${id}`);
      fetchPlans();
      showToast('RK berhasil dihapus');
    } catch (err) { showToast(err.response?.data?.error || 'Gagal menghapus', 'error'); }
  };

  const TABS = [
    { id: 'daftar', label: 'Daftar RK', icon: List },
    { id: 'monitoring', label: 'Monitoring', icon: BarChart3 },
  ];

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div>
          <h2 className="page-title text-xl">📋 Rencana Kinerja</h2>
          <p className="page-subtitle">Kelola dan pantau rencana kinerja pegawai</p>
        </div>
        <TabSwitch tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === 'daftar' && (
        <RKListView
          plans={plans}
          periods={periods}
          employees={employees}
          isAnggota={isAnggota}
          canEdit={canEdit}
          filterPeriod={filterPeriod}
          setFilterPeriod={setFilterPeriod}
          filterEmployee={filterEmployee}
          setFilterEmployee={setFilterEmployee}
          loading={loading}
          onAdd={() => openModal()}
          onEdit={openModal}
          onDelete={handleDelete}
          onImportMPH={() => setMphModalOpen(true)}
        />
      )}

      {activeTab === 'monitoring' && (
        <MonitoringView
          periods={periods}
          employees={employees}
          isAnggota={isAnggota}
          user={user}
        />
      )}

      {/* Add/Edit RK Modal - Simplified form */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editData ? '✏️ Edit Rencana Kinerja' : '➕ Tambah Rencana Kinerja'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="label text-base">👤 Pegawai *</label>
              <select className="input text-base py-2.5" required value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}>
                <option value="">Pilih Pegawai</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.nama}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label text-base">📅 Periode *</label>
              <select className="input text-base py-2.5" required value={form.period_id} onChange={e => setForm({ ...form, period_id: e.target.value })}>
                <option value="">Pilih Periode</option>
                {periods.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Kode RK</label>
              <input className="input text-base py-2.5" placeholder="RK-01" value={form.kode} onChange={e => setForm({ ...form, kode: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label">Bobot (%)</label>
              <input className="input text-base py-2.5" type="number" min="0" max="100" placeholder="30" value={form.bobot} onChange={e => setForm({ ...form, bobot: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="label text-base">📝 Nama Rencana Kinerja *</label>
            <input className="input text-base py-2.5" required placeholder="Contoh: Identifikasi blok sensus SAKERNAS" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Deskripsi</label>
            <textarea className="input resize-none text-base py-2.5" rows={2} value={form.deskripsi} onChange={e => setForm({ ...form, deskripsi: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Indikator</label>
            <input className="input text-base py-2.5" placeholder="Contoh: Tingkat kualitas penyelesaian minimal 95%" value={form.indikator} onChange={e => setForm({ ...form, indikator: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="label text-base">🎯 Target *</label>
              <input className="input text-base py-2.5" type="number" required min="0" placeholder="100" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label text-base">📏 Satuan *</label>
              <input className="input text-base py-2.5" required placeholder="Persen" value={form.satuan} onChange={e => setForm({ ...form, satuan: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-3 pt-3 border-t border-slate-100">
            <button type="submit" disabled={submitting} className="btn-primary py-3 flex-1 text-base justify-center">
              {submitting ? 'Menyimpan...' : editData ? 'Perbarui' : 'Simpan'}
            </button>
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary py-3 px-6 text-base">Batal</button>
          </div>
        </form>
      </Modal>

      {/* Import MPH Modal */}
      <ImportMPHModal
        open={mphModalOpen}
        onClose={() => setMphModalOpen(false)}
        periods={periods}
        employees={employees}
        onSuccess={() => {
          fetchPlans();
          showToast('Import RK dari MPH berhasil!');
        }}
      />
    </div>
  );
}
