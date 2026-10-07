import { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Edit2, Trash2, Eye, X, Check, Clock, ChevronLeft, ChevronRight,
  CalendarDays, List, RefreshCw, Upload, Link as LinkIcon
} from 'lucide-react';

// ─── Shared Components ───

const STATUS_LABELS = {
  selesai: { label: 'Selesai', class: 'badge-success' },
  dalam_proses: { label: 'Dalam Proses', class: 'badge-warning' },
  ditunda: { label: 'Ditunda', class: 'badge-gray' },
  dibatalkan: { label: 'Dibatalkan', class: 'badge-danger' },
};

const STATUS_CONFIG = {
  lengkap: { label: 'Sudah Diisi', emoji: '🟢', class: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  sebagian: { label: 'Belum Lengkap', emoji: '🟡', class: 'bg-amber-100 text-amber-800 border-amber-200' },
  belum: { label: 'Belum Diisi', emoji: '🔴', class: 'bg-red-100 text-red-800 border-red-200' },
  verified: { label: 'Terverifikasi', emoji: '🔵', class: 'bg-blue-100 text-blue-800 border-blue-200' },
  weekend: { label: 'Hari Libur', emoji: '—', class: 'bg-slate-50 text-slate-400' },
};

const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const DAYS_ID = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfMonth(year, month) { return new Date(year, month, 1).getDay(); }
function isWeekend(year, month, day) { const dow = new Date(year, month, day).getDay(); return dow === 0 || dow === 6; }
function dateStr(year, month, day) { return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }

function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null;
  const sizeMap = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${sizeMap[size]} animate-fade-in-up max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-500" />
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

function CalendarIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

// ─── Kegiatan Form ───

function KegiatanForm({ periods, plans, employees, onSubmit, loading, initialData, isKPA }) {
  const { isAnggota, user } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    period_id: '',
    employee_id: isAnggota ? user?.employeeId : '',
    performance_plan_id: '',
    tanggal: today,
    nama_kegiatan: '',
    deskripsi: '',
    target: '',
    satuan: '',
    realisasi: '',
    status_kegiatan: 'selesai',
    catatan: '',
    ...initialData
  });
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([]);

  const addLink = () => setLinks(l => [...l, { judul: '', url: '', platform: '', keterangan: '' }]);
  const updateLink = (i, patch) => setLinks(l => l.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const removeLink = (i) => setLinks(l => l.filter((_, idx) => idx !== i));

  const capaian = form.target && form.realisasi
    ? Math.min(Math.round((parseFloat(form.realisasi) / parseFloat(form.target)) * 100), 100)
    : 0;

  const filteredPlans = plans.filter(p =>
    (!form.period_id || p.period_id == form.period_id) &&
    (!form.employee_id || p.employee_id == form.employee_id)
  );

  const handlePlanChange = (pkId) => {
    const plan = plans.find(p => p.id == pkId);
    setForm(f => ({
      ...f,
      performance_plan_id: pkId,
      satuan: plan?.satuan || f.satuan,
    }));
  };

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form, { files, links: links.filter(l => l.judul || l.url) }); }} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="form-group">
          <label className="label">Periode *</label>
          <select className="input" required value={form.period_id} onChange={e => setForm({ ...form, period_id: e.target.value })}>
            <option value="">Pilih Periode</option>
            {periods.filter(p => p.status === 'aktif').map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
        </div>
        {!isAnggota && (
          <div className="form-group">
            <label className="label">Pegawai *</label>
            <select className="input" required value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value, performance_plan_id: '' })}>
              <option value="">Pilih Pegawai</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.nama}</option>)}
            </select>
          </div>
        )}
        <div className="form-group">
          <label className="label">Tanggal *</label>
          <input className="input" type="date" required value={form.tanggal} onChange={e => setForm({ ...form, tanggal: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="label">Rencana Kinerja</label>
          <select className="input" value={form.performance_plan_id} onChange={e => handlePlanChange(e.target.value)}>
            <option value="">Pilih RK (opsional)</option>
            {filteredPlans.map(p => <option key={p.id} value={p.id}>{p.kode} — {p.nama}</option>)}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="label">Nama Kegiatan *</label>
        <input className="input" required placeholder="Contoh: Melakukan pemeriksaan data hasil survei" value={form.nama_kegiatan} onChange={e => setForm({ ...form, nama_kegiatan: e.target.value })} />
      </div>

      <div className="form-group">
        <label className="label">Deskripsi Kegiatan</label>
        <textarea className="input resize-none" rows={2} placeholder="Deskripsi singkat kegiatan..." value={form.deskripsi} onChange={e => setForm({ ...form, deskripsi: e.target.value })} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="form-group col-span-1">
          <label className="label">Target</label>
          <input className="input" type="number" min="0" placeholder="0" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} />
        </div>
        <div className="form-group col-span-1">
          <label className="label">Satuan</label>
          <input className="input" placeholder="Dokumen, dsb" value={form.satuan} onChange={e => setForm({ ...form, satuan: e.target.value })} />
        </div>
        <div className="form-group col-span-1">
          <label className="label">Realisasi</label>
          <input className="input" type="number" min="0" placeholder="0" value={form.realisasi} onChange={e => setForm({ ...form, realisasi: e.target.value })} />
        </div>
        <div className="form-group col-span-1">
          <label className="label">Capaian</label>
          <div className={`input bg-slate-50 font-semibold ${capaian >= 100 ? 'text-emerald-600' : capaian >= 70 ? 'text-primary-600' : 'text-amber-600'}`}>
            {capaian}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="form-group">
          <label className="label">Status Kegiatan</label>
          <select className="input" value={form.status_kegiatan} onChange={e => setForm({ ...form, status_kegiatan: e.target.value })}>
            <option value="selesai">Selesai</option>
            <option value="dalam_proses">Dalam Proses</option>
            <option value="ditunda">Ditunda</option>
            <option value="dibatalkan">Dibatalkan</option>
          </select>
        </div>
        <div className="form-group">
          <label className="label">Catatan</label>
          <input className="input" placeholder="Catatan tambahan..." value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} />
        </div>
      </div>

      {/* Bukti Dukung (opsional) */}
      <div className="space-y-3 border-t border-slate-100 pt-4">
        <p className="label">Bukti Dukung (opsional)</p>
        <div className="flex gap-2 flex-wrap">
          <label className="btn-secondary btn-sm cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Pilih File
            <input type="file" className="hidden" multiple accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
              onChange={e => { setFiles(f => [...f, ...Array.from(e.target.files)]); e.target.value = ''; }} />
          </label>
          <button type="button" onClick={addLink} className="btn-secondary btn-sm">
            <LinkIcon className="w-3.5 h-3.5" /> Tambah Link
          </button>
        </div>
        <p className="text-xs text-slate-400">Format: JPG, PNG, PDF, DOC, XLS, PPT, ZIP (maks 10MB). Bisa juga diisi nanti di menu Bukti Dukung.</p>
        {files.map((f, i) => (
          <div key={i} className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-lg text-sm">
            <span className="truncate">{f.name}</span>
            <button type="button" onClick={() => setFiles(fs => fs.filter((_, idx) => idx !== i))} className="p-1 hover:bg-slate-200 rounded"><X className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        {links.map((l, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_auto] gap-2 items-center">
            <input className="input" placeholder="Judul link" value={l.judul} onChange={e => updateLink(i, { judul: e.target.value })} />
            <input className="input" type="url" placeholder="https://drive.google.com/..." value={l.url} onChange={e => updateLink(i, { url: e.target.value })} />
            <button type="button" onClick={() => removeLink(i)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-2 border-t border-slate-50">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Menyimpan...' : initialData?.id ? 'Perbarui Kegiatan' : 'Simpan Kegiatan'}
        </button>
      </div>
    </form>
  );
}

// ─── Calendar View (from CekHarian) ───

function CalendarView({ periods, employees, canSeeAll }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [calendarData, setCalendarData] = useState({});
  const [dailyStatus, setDailyStatus] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const active = periods.find(p => p.is_active);
    if (active) setSelectedPeriod(String(active.id));
  }, [periods]);

  const fetchCalendar = useCallback(() => {
    if (!selectedPeriod) return;
    setLoading(true);
    const params = { period_id: selectedPeriod, year, month: month + 1 };
    if (selectedEmployee) params.employee_id = selectedEmployee;
    api.get('/activities/calendar', { params }).then(r => {
      const map = {};
      r.data.forEach(d => { map[d.tanggal] = d; });
      setCalendarData(map);
    }).finally(() => setLoading(false));
  }, [selectedPeriod, selectedEmployee, year, month]);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  const fetchDailyStatus = async (date) => {
    if (!canSeeAll) return;
    try {
      const r = await api.get('/activities/daily-status', { params: { tanggal: date } });
      setDailyStatus(r.data);
    } catch {}
  };

  const handleDateClick = (day) => {
    const ds = dateStr(year, month, day);
    setSelectedDate(ds);
    fetchDailyStatus(ds);
  };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const todayStr = today.toISOString().split('T')[0];

  const getDayStatus = (day) => {
    const ds = dateStr(year, month, day);
    if (isWeekend(year, month, day)) return 'weekend';
    const d = calendarData[ds];
    if (!d || d.jumlah_kegiatan === 0) return 'belum';
    if (d.terverifikasi) return 'verified';
    if (d.avg_capaian >= 80) return 'lengkap';
    return 'sebagian';
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Periode</label>
          <select className="input w-44" value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}>
            <option value="">Pilih Periode</option>
            {periods.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
        </div>
        {canSeeAll && (
          <div>
            <label className="label">Pegawai</label>
            <select className="input w-52" value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)}>
              <option value="">Semua Pegawai</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.nama}</option>)}
            </select>
          </div>
        )}
        <button onClick={fetchCalendar} className="btn-secondary btn-sm" disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendar */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="btn-secondary btn-sm btn-icon">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="font-semibold text-slate-800">{MONTHS_ID[month]} {year}</h2>
            <button onClick={nextMonth} className="btn-secondary btn-sm btn-icon">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAYS_ID.map(d => (
              <div key={d} className={`text-center text-xs font-semibold py-2 ${d === 'Min' || d === 'Sab' ? 'text-slate-400' : 'text-slate-500'}`}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const ds = dateStr(year, month, day);
              const status = getDayStatus(day);
              const cfg = STATUS_CONFIG[status];
              const isToday = ds === todayStr;
              const isSelected = ds === selectedDate;
              const d = calendarData[ds];

              return (
                <button
                  key={day}
                  onClick={() => !isWeekend(year, month, day) && handleDateClick(day)}
                  disabled={isWeekend(year, month, day)}
                  className={`
                    relative rounded-lg p-1.5 text-center transition-all border
                    ${status === 'weekend' ? 'border-transparent cursor-default' : 'cursor-pointer hover:ring-2 hover:ring-primary-300'}
                    ${cfg.class}
                    ${isToday ? 'ring-2 ring-primary-500 font-bold' : ''}
                    ${isSelected ? 'ring-2 ring-primary-600' : ''}
                  `}
                >
                  <span className={`text-xs block ${isToday ? 'font-bold' : ''}`}>{day}</span>
                  {status !== 'weekend' && (
                    <span className="text-xs block">{cfg.emoji}</span>
                  )}
                  {d && d.jumlah_kegiatan > 0 && (
                    <span className="text-xs block">{d.jumlah_kegiatan}keg</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-slate-50">
            {Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'weekend').map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className="text-sm">{v.emoji}</span>
                <span className="text-xs text-slate-500">{v.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily detail panel */}
        <div className="card p-5">
          {selectedDate ? (
            <>
              <h3 className="font-semibold text-slate-700 mb-3">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>

              {canSeeAll && dailyStatus ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-slate-500">Total Pegawai</span>
                    <span className="font-semibold">{dailyStatus.employees?.length}</span>
                  </div>
                  <div className="flex gap-3 text-xs mb-3">
                    <span className="badge-success">{dailyStatus.employees?.filter(e => e.status !== 'belum').length} Sudah</span>
                    <span className="badge-danger">{dailyStatus.employees?.filter(e => e.status === 'belum').length} Belum</span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {dailyStatus.employees?.map(emp => (
                      <div key={emp.id} className="flex items-center gap-2 py-1.5 border-b border-slate-50">
                        <div className={`w-2 h-2 rounded-full ${emp.status === 'belum' ? 'bg-red-400' : emp.status === 'lengkap' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate">{emp.nama}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">{emp.jumlah_kegiatan} keg</p>
                          {emp.avg_capaian > 0 && <p className="text-xs text-primary-600 font-semibold">{emp.avg_capaian}%</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  {calendarData[selectedDate] ? (
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Jumlah Kegiatan</span>
                        <span className="font-semibold">{calendarData[selectedDate].jumlah_kegiatan}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Rata-rata Capaian</span>
                        <span className="font-semibold text-primary-600">{Math.round(calendarData[selectedDate].avg_capaian || 0)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Bukti Dukung</span>
                        <span>{calendarData[selectedDate].has_bukti ? '✅ Ada' : '❌ Belum'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Verifikasi</span>
                        <span>{calendarData[selectedDate].terverifikasi ? '🔵 Terverifikasi' : '⏳ Belum'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-slate-400 text-sm">Belum ada kegiatan</p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-10">
              <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Klik tanggal untuk melihat detail</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Activity List View ───

function ActivityListView({ periods, plans, employees, canEdit, isKPA, isKasubbag, isAnggota }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [detailData, setDetailData] = useState(null);

  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    const active = periods.find(p => p.is_active);
    if (active) setFilterPeriod(String(active.id));
  }, [periods]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterPeriod) params.period_id = filterPeriod;
      if (filterEmployee) params.employee_id = filterEmployee;
      if (filterDate) params.tanggal = filterDate;
      const r = await api.get('/activities', { params });
      setActivities(r.data);
    } finally {
      setLoading(false);
    }
  }, [filterPeriod, filterEmployee, filterDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (form, evidence = { files: [], links: [] }) => {
    setSubmitting(true);
    try {
      let actId = editData?.id;
      if (actId) {
        await api.put(`/activities/${actId}`, form);
      } else {
        const r = await api.post('/activities', form);
        actId = r.data?.id;
      }
      if (actId) {
        try {
          if (evidence.files.length) {
            const fd = new FormData();
            evidence.files.forEach(f => fd.append('files', f));
            await api.post(`/evidence/upload/${actId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          }
          for (const l of evidence.links) {
            if (!l.judul || !l.url) continue;
            await api.post(`/evidence/link/${actId}`, l);
          }
        } catch (err) {
          alert('Kegiatan tersimpan, tetapi bukti dukung gagal diunggah: ' + (err.response?.data?.error || 'error'));
        }
      }
      setModalOpen(false);
      setEditData(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menyimpan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus kegiatan ini?')) return;
    try {
      await api.delete(`/activities/${id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menghapus');
    }
  };

  const handleVerify = async (id, status) => {
    try {
      await api.post(`/verifications/${id}`, { status });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal verifikasi');
    }
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div>
          <label className="label">Periode</label>
          <select className="input w-44" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
            <option value="">Semua Periode</option>
            {periods.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
        </div>
        {!isAnggota && (
          <div>
            <label className="label">Pegawai</label>
            <select className="input w-44" value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
              <option value="">Semua Pegawai</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.nama}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">Tanggal</label>
          <input className="input" type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        </div>
        <div className="flex items-end">
          <button onClick={() => { setFilterDate(''); setFilterEmployee(''); }} className="btn-secondary btn-sm">
            Reset Filter
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
          <p className="text-sm text-slate-500">{activities.length} kegiatan</p>
          {canEdit && (
            <button onClick={() => { setEditData(null); setModalOpen(true); }} className="btn-primary btn-sm">
              <Plus className="w-4 h-4" /> Tambah Kegiatan
            </button>
          )}
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" style={{borderWidth:'2px'}}></div></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  {!isAnggota && <th>Pegawai</th>}
                  <th>Kegiatan</th>
                  <th>RK</th>
                  <th>Target</th>
                  <th>Realisasi</th>
                  <th>Capaian</th>
                  <th>Status</th>
                  <th>Verifikasi</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {activities.length === 0 && (
                  <tr><td colSpan="10" className="text-center text-slate-400 py-8">Belum ada kegiatan</td></tr>
                )}
                {activities.map(act => (
                  <tr key={act.id}>
                    <td className="whitespace-nowrap">
                      {new Date(act.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </td>
                    {!isAnggota && <td className="font-medium">{act.pegawai_nama}</td>}
                    <td>
                      <p className="font-medium text-slate-700 max-w-48 truncate">{act.nama_kegiatan}</p>
                      {act.jumlah_bukti > 0 && <p className="text-xs text-slate-400">📎 {act.jumlah_bukti} bukti</p>}
                    </td>
                    <td>
                      {act.pk_kode
                        ? <span className="badge-info">{act.pk_kode}</span>
                        : <span className="text-slate-300">—</span>
                      }
                    </td>
                    <td>{act.target ? `${act.target} ${act.satuan || ''}` : '—'}</td>
                    <td>{act.realisasi ?? '—'}</td>
                    <td>
                      <span className={`font-semibold ${(act.persentase_capaian || 0) >= 100 ? 'text-emerald-600' : (act.persentase_capaian || 0) >= 70 ? 'text-primary-600' : 'text-amber-600'}`}>
                        {act.persentase_capaian || 0}%
                      </span>
                    </td>
                    <td>
                      <span className={STATUS_LABELS[act.status_kegiatan]?.class || 'badge-gray'}>
                        {STATUS_LABELS[act.status_kegiatan]?.label}
                      </span>
                    </td>
                    <td>
                      {act.verif_status === 'terverifikasi'
                        ? <span className="badge-success">✓ Verified</span>
                        : act.verif_status === 'ditolak'
                        ? <span className="badge-danger">✗ Ditolak</span>
                        : <span className="badge-warning">Menunggu</span>
                      }
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setDetailData(act)} className="btn-icon btn-secondary btn-sm" title="Detail">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canEdit && !act.verif_status && (
                          <button onClick={() => { setEditData(act); setModalOpen(true); }} className="btn-icon btn-secondary btn-sm" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(isKPA || isKasubbag) && !act.verif_status && (
                          <button onClick={() => handleVerify(act.id, 'terverifikasi')} className="btn-icon btn-success btn-sm" title="Verifikasi">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isKPA && (
                          <button onClick={() => handleDelete(act.id)} className="btn-icon btn-danger btn-sm" title="Hapus">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditData(null); }} title={editData ? 'Edit Kegiatan' : 'Tambah Kegiatan Harian'} size="lg">
        <KegiatanForm
          periods={periods}
          plans={plans}
          employees={employees}
          onSubmit={handleSubmit}
          loading={submitting}
          initialData={editData}
          isKPA={isKPA}
        />
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailData} onClose={() => setDetailData(null)} title="Detail Kegiatan" size="md">
        {detailData && (
          <div className="space-y-3 text-sm">
            <div><span className="text-slate-500">Pegawai:</span> <span className="font-medium">{detailData.pegawai_nama}</span></div>
            <div><span className="text-slate-500">Tanggal:</span> <span className="font-medium">{detailData.tanggal}</span></div>
            <div><span className="text-slate-500">Kegiatan:</span> <span className="font-medium">{detailData.nama_kegiatan}</span></div>
            {detailData.deskripsi && <div><span className="text-slate-500">Deskripsi:</span> <p className="text-slate-700 mt-1">{detailData.deskripsi}</p></div>}
            <div><span className="text-slate-500">PK:</span> <span>{detailData.pk_nama || '—'}</span></div>
            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg">
              <div><p className="text-slate-500 text-xs">Target</p><p className="font-semibold">{detailData.target || '—'} {detailData.satuan}</p></div>
              <div><p className="text-slate-500 text-xs">Realisasi</p><p className="font-semibold">{detailData.realisasi || '—'}</p></div>
              <div><p className="text-slate-500 text-xs">Capaian</p><p className="font-bold text-primary-600">{detailData.persentase_capaian || 0}%</p></div>
            </div>
            <div><span className="text-slate-500">Status:</span> <span className={`${STATUS_LABELS[detailData.status_kegiatan]?.class || 'badge-gray'} ml-2`}>{STATUS_LABELS[detailData.status_kegiatan]?.label}</span></div>
            <div><span className="text-slate-500">Verifikasi:</span> <span className={`ml-2 ${detailData.verif_status === 'terverifikasi' ? 'text-emerald-600 font-semibold' : 'text-amber-600'}`}>{detailData.verif_status || 'Belum diverifikasi'}</span></div>
            {detailData.catatan && <div><span className="text-slate-500">Catatan:</span> <p>{detailData.catatan}</p></div>}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Main Page ───

export default function Kegiatan() {
  const { isKPA, isKasubbag, isAnggota, user } = useAuth();
  const canEdit = isKPA || isAnggota;
  const canSeeAll = isKPA || isKasubbag;

  const [activeTab, setActiveTab] = useState('daftar');
  const [periods, setPeriods] = useState([]);
  const [plans, setPlans] = useState([]);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    api.get('/periods').then(r => setPeriods(r.data));
    if (!isAnggota) {
      api.get('/users/employees').then(r => setEmployees(r.data.filter(e => e.role === 'Anggota')));
    }
  }, []);

  useEffect(() => {
    const activePeriod = periods.find(p => p.is_active);
    if (activePeriod) {
      api.get('/performance-plans', { params: { period_id: activePeriod.id } })
        .then(r => setPlans(r.data));
    }
  }, [periods]);

  const TABS = [
    { id: 'daftar', label: 'Daftar Kegiatan', icon: List },
    { id: 'kalender', label: 'Kalender', icon: CalendarDays },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Kegiatan Harian</h2>
          <p className="page-subtitle">Daftar dan kalender kegiatan harian pegawai</p>
        </div>
        <TabSwitch tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === 'daftar' && (
        <ActivityListView
          periods={periods}
          plans={plans}
          employees={employees}
          canEdit={canEdit}
          isKPA={isKPA}
          isKasubbag={isKasubbag}
          isAnggota={isAnggota}
        />
      )}

      {activeTab === 'kalender' && (
        <CalendarView
          periods={periods}
          employees={employees}
          canSeeAll={canSeeAll}
        />
      )}
    </div>
  );
}
