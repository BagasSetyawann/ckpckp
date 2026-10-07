import { useEffect, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Save, Plus, AlertCircle, Download, FileSpreadsheet, Printer } from 'lucide-react';

// ─── Export Tab (from OutputHasilKerja) ───

function ExportView() {
  const { isAnggota } = useAuth();
  const [periods, setPeriods] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/periods').then(r => {
      setPeriods(r.data);
      const active = r.data.find(p => p.is_active);
      if (active) setFilterPeriod(String(active.id));
    });
    if (!isAnggota) api.get('/users/employees').then(r => setEmployees(r.data.filter(e => e.role === 'Anggota')));
  }, []);

  const handleExcelExport = async () => {
    if (!filterPeriod) return alert('Pilih periode terlebih dahulu');
    setLoading(true);
    try {
      const params = { period_id: filterPeriod };
      if (filterEmployee) params.employee_id = filterEmployee;
      const response = await api.get('/export/excel', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const period = periods.find(p => String(p.id) === filterPeriod);
      link.setAttribute('download', `Rekap_CKP_${period?.nama || filterPeriod}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Gagal mengekspor Excel');
    } finally { setLoading(false); }
  };

  const handlePrintPDF = async () => {
    if (!filterPeriod) return alert('Pilih periode terlebih dahulu');
    setLoading(true);
    try {
      const params = { period_id: filterPeriod };
      if (filterEmployee) params.employee_id = filterEmployee;
      const r = await api.get('/export/pdf-data', { params });
      const data = r.data;
      const period = periods.find(p => String(p.id) === filterPeriod);
      const printWindow = window.open('', '_blank');
      const html = generatePrintHTML(data, period);
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    } catch (err) {
      alert('Gagal membuat laporan');
    } finally { setLoading(false); }
  };

  function generatePrintHTML(data, period) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Rekap CKP — ${period?.nama}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
    h1 { font-size: 16px; text-align: center; margin-bottom: 4px; }
    h2 { font-size: 13px; text-align: center; color: #555; margin-bottom: 20px; }
    h3 { font-size: 13px; margin: 16px 0 8px; color: #003580; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #003580; color: white; padding: 6px 8px; text-align: left; font-size: 11px; }
    td { padding: 5px 8px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .emp-header { background: #e8f0fe; padding: 8px; border-left: 4px solid #003580; margin: 16px 0 8px; }
    .score-row { background: #e8f9e8; font-weight: bold; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
<h1>REKAP CAPAIAN KINERJA PEGAWAI (CKP)</h1>
<h2>${period?.nama || 'Periode tidak diketahui'}</h2>
${data.map(d => {
  if (!d.employee) return '';
  return `
<div class="emp-header">
  <strong>${d.employee.nama}</strong> — ${d.employee.jabatan} | ${d.employee.unit_kerja}
  | NIP: ${d.employee.nip || '-'}
</div>
<h3>Rencana Kinerja</h3>
<table>
  <thead><tr><th>Kode</th><th>Nama PK</th><th>Target</th><th>Satuan</th><th>Bobot</th></tr></thead>
  <tbody>
    ${(d.plans || []).map(p => `<tr><td>${p.kode || '-'}</td><td>${p.nama}</td><td>${p.target}</td><td>${p.satuan}</td><td>${p.bobot}%</td></tr>`).join('')}
  </tbody>
</table>
<h3>Kegiatan Harian</h3>
<table>
  <thead><tr><th>Tanggal</th><th>Kegiatan</th><th>PK</th><th>Target</th><th>Realisasi</th><th>Capaian</th><th>Status</th><th>Verifikasi</th></tr></thead>
  <tbody>
    ${(d.activities || []).map(a => `<tr><td>${a.tanggal}</td><td>${a.nama_kegiatan}</td><td>${a.pk_kode || '-'}</td><td>${a.target || '-'} ${a.satuan || ''}</td><td>${a.realisasi || '-'}</td><td>${a.persentase_capaian || 0}%</td><td>${a.status_kegiatan}</td><td>${a.verif_status || 'Belum'}</td></tr>`).join('')}
  </tbody>
</table>
${d.ckp ? `
<div class="score-row">
  <table><tr>
    <td>Nilai PK: <strong>${d.ckp.nilai_pk}</strong></td>
    <td>Nilai Perilaku: <strong>${d.ckp.nilai_perilaku || '—'}</strong></td>
    <td>NILAI CKP: <strong>${d.ckp.nilai_ckp}</strong></td>
    <td>Status: <strong>${d.ckp.status}</strong></td>
  </tr></table>
</div>` : ''}
`;
}).join('<hr style="margin: 20px 0;">')}
<div style="margin-top:30px; text-align:right; color:#888; font-size:11px;">
  Dicetak pada: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
</div>
</body>
</html>`;
  }

  return (
    <div className="space-y-5">
      {/* Filter */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div>
          <label className="label">Periode *</label>
          <select className="input w-44" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
            <option value="">Pilih Periode</option>
            {periods.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
        </div>
        {!isAnggota && (
          <div>
            <label className="label">Pegawai</label>
            <select className="input w-48" value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
              <option value="">Semua Pegawai</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.nama}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Export options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="card p-6 text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
            <FileSpreadsheet className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">Export Excel</h3>
            <p className="text-sm text-slate-500 mt-1">
              Ekspor rekap kegiatan, PK, dan nilai CKP dalam format Excel (.xlsx).
            </p>
          </div>
          <button onClick={handleExcelExport} disabled={loading} className="btn-success w-full justify-center">
            <Download className="w-4 h-4" />
            {loading ? 'Memproses...' : 'Download Excel'}
          </button>
        </div>

        <div className="card p-6 text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
            <Printer className="w-8 h-8 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">Cetak Laporan (PDF)</h3>
            <p className="text-sm text-slate-500 mt-1">
              Buka jendela cetak browser untuk menyimpan sebagai PDF atau mencetak langsung.
            </p>
          </div>
          <button onClick={handlePrintPDF} disabled={loading} className="btn-danger w-full justify-center">
            <Printer className="w-4 h-4" />
            {loading ? 'Memproses...' : 'Cetak / Simpan PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───

export default function Pengaturan() {
  const { isKPA } = useAuth();
  const [periods, setPeriods] = useState([]);
  const [components, setComponents] = useState([]);
  const [settings, setSettings] = useState({});
  const [activePeriodWeights, setActivePeriodWeights] = useState([]);
  const [activePeriod, setActivePeriod] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('periode');

  // Period form
  const [periodForm, setPeriodForm] = useState({ nama: '', tahun: 2026, bulan: '', tanggal_mulai: '', tanggal_akhir: '', batas_pengisian: '', status: 'draft' });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const [periodsRes, compRes, settingsRes] = await Promise.all([
      api.get('/periods'),
      api.get('/ckp-config/components'),
      api.get('/ckp-config/settings'),
    ]);
    setPeriods(periodsRes.data);
    setComponents(compRes.data);
    setSettings(settingsRes.data);

    const active = periodsRes.data.find(p => p.is_active);
    setActivePeriod(active);
    if (active) {
      const wRes = await api.get(`/ckp-config/weights/${active.id}`);
      setActivePeriodWeights(wRes.data);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/ckp-config/settings', settings);
      alert('Pengaturan berhasil disimpan');
    } catch { alert('Gagal menyimpan'); }
    finally { setSaving(false); }
  };

  const handleSaveWeights = async () => {
    if (!activePeriod) return;
    const total = activePeriodWeights.reduce((s, w) => s + parseFloat(w.bobot || 0), 0);
    if (Math.abs(total - 100) > 0.01) {
      alert(`Total bobot harus 100%. Saat ini: ${total.toFixed(1)}%`);
      return;
    }
    setSaving(true);
    try {
      await api.put(`/ckp-config/weights/${activePeriod.id}`, {
        weights: activePeriodWeights.map(w => ({ component_id: w.component_id, bobot: parseFloat(w.bobot) }))
      });
      alert('Bobot berhasil disimpan');
    } catch (err) { alert(err.response?.data?.error || 'Gagal menyimpan'); }
    finally { setSaving(false); }
  };

  const handleCreatePeriod = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/periods', periodForm);
      fetchAll();
      setPeriodForm({ nama: '', tahun: 2026, bulan: '', tanggal_mulai: '', tanggal_akhir: '', batas_pengisian: '', status: 'draft' });
      alert('Periode berhasil dibuat');
    } catch (err) { alert(err.response?.data?.error || 'Gagal'); }
    finally { setSaving(false); }
  };

  const handleActivatePeriod = async (id) => {
    if (!confirm('Aktifkan periode ini? Periode aktif sebelumnya akan dinonaktifkan.')) return;
    await api.put(`/periods/${id}/activate`);
    fetchAll();
  };

  const totalBobot = activePeriodWeights.reduce((s, w) => s + parseFloat(w.bobot || 0), 0);

  const TABS = [
    { id: 'periode', label: 'Manajemen Periode' },
    { id: 'bobot', label: 'Bobot CKP' },
    { id: 'pengaturan', label: 'Pengaturan Umum' },
    { id: 'export', label: 'Export Data' },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Pengaturan Sistem</h2>
          <p className="page-subtitle">Konfigurasi SI-CKP — Hanya KPA</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Periode Tab */}
      {activeTab === 'periode' && (
        <div className="space-y-5">
          {/* Add period form */}
          <div className="card p-5">
            <h3 className="font-semibold text-slate-700 mb-4">Tambah Periode Baru</h3>
            <form onSubmit={handleCreatePeriod} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="form-group col-span-2 sm:col-span-1">
                <label className="label">Nama Periode *</label>
                <input className="input" required placeholder="September 2026" value={periodForm.nama} onChange={e => setPeriodForm({ ...periodForm, nama: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="label">Bulan *</label>
                <select className="input" required value={periodForm.bulan} onChange={e => setPeriodForm({ ...periodForm, bulan: e.target.value })}>
                  <option value="">Pilih</option>
                  {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Tahun *</label>
                <input className="input" type="number" required value={periodForm.tahun} onChange={e => setPeriodForm({ ...periodForm, tahun: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="label">Tanggal Mulai *</label>
                <input className="input" type="date" required value={periodForm.tanggal_mulai} onChange={e => setPeriodForm({ ...periodForm, tanggal_mulai: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="label">Tanggal Akhir *</label>
                <input className="input" type="date" required value={periodForm.tanggal_akhir} onChange={e => setPeriodForm({ ...periodForm, tanggal_akhir: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="label">Batas Pengisian</label>
                <input className="input" type="date" value={periodForm.batas_pengisian} onChange={e => setPeriodForm({ ...periodForm, batas_pengisian: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="label">Status</label>
                <select className="input" value={periodForm.status} onChange={e => setPeriodForm({ ...periodForm, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="aktif">Aktif</option>
                </select>
              </div>
              <div className="flex items-end col-span-2 sm:col-span-3">
                <button type="submit" disabled={saving} className="btn-primary">
                  <Plus className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Tambah Periode'}
                </button>
              </div>
            </form>
          </div>

          {/* Periods list */}
          <div className="card">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nama Periode</th>
                    <th>Mulai</th>
                    <th>Akhir</th>
                    <th>Batas Isi</th>
                    <th>Status</th>
                    <th>Aktif</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map(p => (
                    <tr key={p.id} className={p.is_active ? 'bg-emerald-50/50' : ''}>
                      <td className="font-medium">{p.nama}</td>
                      <td>{p.tanggal_mulai}</td>
                      <td>{p.tanggal_akhir}</td>
                      <td>{p.batas_pengisian || '—'}</td>
                      <td>
                        <span className={p.status === 'aktif' ? 'badge-success' : p.status === 'tutup' ? 'badge-gray' : 'badge-warning'}>{p.status}</span>
                      </td>
                      <td>{p.is_active ? <span className="badge-success">🟢 Aktif</span> : '—'}</td>
                      <td>
                        {!p.is_active && (
                          <button onClick={() => handleActivatePeriod(p.id)} className="btn-success btn-sm">Aktifkan</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Bobot Tab */}
      {activeTab === 'bobot' && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-700">Bobot Komponen CKP</h3>
              <p className="text-xs text-slate-500 mt-0.5">Untuk periode: {activePeriod?.nama || 'Tidak ada periode aktif'}</p>
            </div>
            <div className={`text-right ${Math.abs(totalBobot - 100) < 0.01 ? 'text-emerald-600' : 'text-red-500'}`}>
              <p className="text-xs">Total Bobot</p>
              <p className="text-2xl font-bold">{totalBobot.toFixed(0)}%</p>
            </div>
          </div>

          {Math.abs(totalBobot - 100) > 0.01 && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
              <AlertCircle className="w-4 h-4" /> Total bobot harus tepat 100%
            </div>
          )}

          <div className="space-y-3 mb-4">
            {activePeriodWeights.map((w, i) => (
              <div key={w.component_id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-700">{w.nama}</p>
                  <p className="text-xs text-slate-400">{w.deskripsi}</p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number" min="0" max="100" step="5"
                    className="input w-24 text-center font-semibold"
                    value={w.bobot}
                    onChange={e => {
                      const updated = [...activePeriodWeights];
                      updated[i] = { ...updated[i], bobot: e.target.value };
                      setActivePeriodWeights(updated);
                    }}
                  />
                  <span className="text-sm text-slate-500">%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={handleSaveWeights} disabled={saving || Math.abs(totalBobot - 100) > 0.01} className="btn-primary">
              <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan Bobot'}
            </button>
          </div>
        </div>
      )}

      {/* General Settings Tab */}
      {activeTab === 'pengaturan' && (
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-slate-700 mb-4">Pengaturan Umum</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="label">Nama Aplikasi</label>
              <input className="input" value={settings.app_name || ''} onChange={e => setSettings({ ...settings, app_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label">Nama Instansi</label>
              <input className="input" value={settings.instansi || ''} onChange={e => setSettings({ ...settings, instansi: e.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Hari Kerja (Pengisian Wajib)</label>
            <input className="input" value={settings.hari_kerja || ''} onChange={e => setSettings({ ...settings, hari_kerja: e.target.value })} placeholder="senin,selasa,rabu,kamis,jumat" />
            <p className="text-xs text-slate-400 mt-1">Pisahkan dengan koma. Contoh: senin,selasa,rabu,kamis,jumat</p>
          </div>

          <div className="form-group">
            <label className="label">Toleransi Keterlambatan Pengisian (hari)</label>
            <input className="input w-32" type="number" min="0" value={settings.toleransi_hari || ''} onChange={e => setSettings({ ...settings, toleransi_hari: e.target.value })} />
          </div>

          <div className="form-group">
            <label className="label flex items-center gap-2">
              <input type="checkbox"
                checked={settings.kasubbag_can_verify === 'true'}
                onChange={e => setSettings({ ...settings, kasubbag_can_verify: e.target.checked ? 'true' : 'false' })}
              />
              Izinkan Kasubbag melakukan verifikasi kegiatan
            </label>
          </div>

          <div className="form-group">
            <label className="label flex items-center gap-2">
              <input type="checkbox"
                checked={settings.reminder_enabled === 'true'}
                onChange={e => setSettings({ ...settings, reminder_enabled: e.target.checked ? 'true' : 'false' })}
              />
              Aktifkan reminder otomatis
            </label>
          </div>

          <button onClick={handleSaveSettings} disabled={saving} className="btn-primary">
            <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      )}

      {/* Export Tab (from OutputHasilKerja) */}
      {activeTab === 'export' && <ExportView />}
    </div>
  );
}
