import { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Upload, Link, Trash2, X, ExternalLink, FileText, Image, File } from 'lucide-react';

function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null;
  const sizeMap = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${sizeMap[size]} animate-fade-in-up max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
      </div>
    </div>
  );
}

function getFileIcon(mime) {
  if (mime?.startsWith('image/')) return <Image className="w-4 h-4 text-blue-500" />;
  if (mime === 'application/pdf') return <FileText className="w-4 h-4 text-red-500" />;
  return <File className="w-4 h-4 text-slate-500" />;
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BuktiDukung() {
  const { isKPA, isKasubbag, isAnggota } = useAuth();
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [evidence, setEvidence] = useState({ files: [], links: [] });
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [periods, setPeriods] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [linkModal, setLinkModal] = useState(false);
  const [linkForm, setLinkForm] = useState({ judul: '', url: '', platform: '', keterangan: '' });

  useEffect(() => {
    api.get('/periods').then(r => {
      setPeriods(r.data);
      const active = r.data.find(p => p.is_active);
      if (active) setFilterPeriod(String(active.id));
    });
    if (!isAnggota) api.get('/users/employees').then(r => setEmployees(r.data.filter(e => e.role === 'Anggota')));
  }, []);

  const fetchActivities = useCallback(async () => {
    const params = {};
    if (filterPeriod) params.period_id = filterPeriod;
    if (filterEmployee) params.employee_id = filterEmployee;
    const r = await api.get('/activities', { params });
    setActivities(r.data);
  }, [filterPeriod, filterEmployee]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  const fetchEvidence = async (actId) => {
    try {
      const r = await api.get(`/evidence/activity/${actId}`);
      setEvidence(r.data);
    } catch {}
  };

  const selectActivity = (act) => {
    setSelectedActivity(act);
    fetchEvidence(act.id);
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files.length || !selectedActivity) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const res = await api.post(`/evidence/upload-url/${selectedActivity.id}`, {
          nama_file: file.name,
          mime_type: file.type || 'application/octet-stream',
          ukuran_file: file.size
        });
        const { signedUrl, path } = res.data;

        await fetch(signedUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || 'application/octet-stream'
          }
        });

        await api.post(`/evidence/file/${selectedActivity.id}`, {
          path: path,
          nama_file: file.name,
          mime_type: file.type || 'application/octet-stream',
          ukuran_file: file.size
        });
      }
      fetchEvidence(selectedActivity.id);
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Gagal mengunggah file');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleAddLink = async () => {
    if (!linkForm.judul || !linkForm.url) return alert('Judul dan URL wajib diisi');
    try {
      await api.post(`/evidence/link/${selectedActivity.id}`, linkForm);
      setLinkModal(false);
      setLinkForm({ judul: '', url: '', platform: '', keterangan: '' });
      fetchEvidence(selectedActivity.id);
    } catch (err) { alert(err.response?.data?.error || 'Gagal menambah link'); }
  };

  const handleDeleteFile = async (id) => {
    if (!confirm('Hapus bukti dukung ini?')) return;
    await api.delete(`/evidence/file/${id}`);
    fetchEvidence(selectedActivity.id);
  };

  const handleDeleteLink = async (id) => {
    if (!confirm('Hapus link ini?')) return;
    await api.delete(`/evidence/link/${id}`);
    fetchEvidence(selectedActivity.id);
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Bukti Dukung</h2>
          <p className="page-subtitle">Upload file dan link bukti dukung kegiatan</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div>
          <label className="label">Periode</label>
          <select className="input w-44" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
            <option value="">Semua</option>
            {periods.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
        </div>
        {!isAnggota && (
          <div>
            <label className="label">Pegawai</label>
            <select className="input w-48" value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
              <option value="">Semua</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.nama}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Activity list */}
        <div className="card">
          <div className="p-4 border-b border-slate-50">
            <h3 className="font-semibold text-slate-700">Pilih Kegiatan</h3>
          </div>
          <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
            {activities.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Tidak ada kegiatan</p>
            )}
            {activities.map(act => (
              <button
                key={act.id}
                onClick={() => selectActivity(act)}
                className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${selectedActivity?.id === act.id ? 'bg-primary-50 border-l-2 border-primary-500' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{act.nama_kegiatan}</p>
                    <p className="text-xs text-slate-400">{act.tanggal} · {act.pegawai_nama}</p>
                    <p className="text-xs text-slate-400">{act.pk_kode ? `PK: ${act.pk_kode}` : 'Tanpa PK'}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="flex gap-1 justify-end">
                      {act.jumlah_bukti > 0 && <span className="badge-info text-xs">{act.jumlah_bukti} file</span>}
                      {act.jumlah_link > 0 && <span className="badge-purple text-xs">{act.jumlah_link} link</span>}
                    </div>
                    <p className={`text-sm font-bold mt-1 ${act.persentase_capaian >= 100 ? 'text-emerald-600' : 'text-primary-600'}`}>{act.persentase_capaian || 0}%</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Evidence panel */}
        <div className="card">
          {selectedActivity ? (
            <>
              <div className="p-4 border-b border-slate-50">
                <h3 className="font-semibold text-slate-700 truncate">{selectedActivity.nama_kegiatan}</h3>
                <p className="text-xs text-slate-400 mt-1">{selectedActivity.tanggal}</p>
              </div>
              <div className="p-4 space-y-4">
                {/* Upload actions */}
                {!isKasubbag && (
                  <div className="flex gap-2 flex-wrap">
                    <label className={`btn-primary btn-sm cursor-pointer ${uploading ? 'opacity-60' : ''}`}>
                      <Upload className="w-3.5 h-3.5" />
                      {uploading ? 'Mengunggah...' : 'Upload File'}
                      <input type="file" className="hidden" multiple accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip" onChange={handleFileUpload} disabled={uploading} />
                    </label>
                    <button onClick={() => setLinkModal(true)} className="btn-secondary btn-sm">
                      <Link className="w-3.5 h-3.5" /> Tambah Link
                    </button>
                  </div>
                )}
                <p className="text-xs text-slate-400">Format: JPG, PNG, PDF, DOC, XLS, PPT, ZIP (maks 10MB)</p>

                {/* Files */}
                {evidence.files.length > 0 && (
                  <div>
                    <p className="section-title">File Bukti</p>
                    <div className="space-y-2">
                      {evidence.files.map(f => (
                        <div key={f.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                          {getFileIcon(f.mime_type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{f.nama_file}</p>
                            <p className="text-xs text-slate-400">{f.jenis} · {formatFileSize(f.ukuran_file)}</p>
                          </div>
                          <div className="flex gap-1">
                            <a href={f.path_file} target="_blank" rel="noopener noreferrer" className="btn-icon btn-secondary btn-sm">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            {!isKasubbag && (
                              <button onClick={() => handleDeleteFile(f.id)} className="btn-icon btn-danger btn-sm">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Links */}
                {evidence.links.length > 0 && (
                  <div>
                    <p className="section-title">Link Bukti</p>
                    <div className="space-y-2">
                      {evidence.links.map(l => (
                        <div key={l.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                          <Link className="w-4 h-4 text-purple-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{l.judul}</p>
                            <p className="text-xs text-slate-400 truncate">{l.url}</p>
                            {l.platform && <span className="badge-purple text-xs">{l.platform}</span>}
                          </div>
                          <div className="flex gap-1">
                            <a href={l.url} target="_blank" rel="noopener noreferrer" className="btn-icon btn-secondary btn-sm">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            {!isKasubbag && (
                              <button onClick={() => handleDeleteLink(l.id)} className="btn-icon btn-danger btn-sm">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {evidence.files.length === 0 && evidence.links.length === 0 && (
                  <div className="text-center py-6">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">Belum ada bukti dukung</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
              <FileText className="w-12 h-12 text-slate-200 mb-3" />
              <p className="text-slate-400">Pilih kegiatan dari daftar sebelah kiri untuk mengelola bukti dukung</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Link Modal */}
      <Modal open={linkModal} onClose={() => setLinkModal(false)} title="Tambah Link Bukti Dukung" size="sm">
        <div className="space-y-3">
          <div className="form-group">
            <label className="label">Judul *</label>
            <input className="input" placeholder="Laporan di Google Drive" value={linkForm.judul} onChange={e => setLinkForm({ ...linkForm, judul: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">URL *</label>
            <input className="input" type="url" placeholder="https://drive.google.com/..." value={linkForm.url} onChange={e => setLinkForm({ ...linkForm, url: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Platform</label>
            <select className="input" value={linkForm.platform} onChange={e => setLinkForm({ ...linkForm, platform: e.target.value })}>
              <option value="">Pilih Platform</option>
              <option>Google Drive</option><option>OneDrive</option><option>SharePoint</option>
              <option>Dropbox</option><option>Website Instansi</option><option>Lainnya</option>
            </select>
          </div>
          <div className="form-group">
            <label className="label">Keterangan</label>
            <input className="input" placeholder="Keterangan tambahan..." value={linkForm.keterangan} onChange={e => setLinkForm({ ...linkForm, keterangan: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleAddLink} className="btn-primary">Tambah Link</button>
            <button onClick={() => setLinkModal(false)} className="btn-secondary">Batal</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
