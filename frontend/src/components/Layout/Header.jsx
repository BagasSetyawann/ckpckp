import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/kegiatan': 'Kegiatan Harian',
  '/rencana-kinerja': 'Rencana Kinerja',
  '/bukti-dukung': 'Bukti Dukung',
  '/nilai-ckp': 'Nilai CKP',
  '/pengaturan': 'Pengaturan Sistem',
  '/audit-log': 'Riwayat Aktivitas',
};

const TODAY = new Date().toLocaleDateString('id-ID', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
});

export default function Header({ setMobileOpen, unreadNotifications }) {
  const location = useLocation();
  const { user } = useAuth();
  const title = PAGE_TITLES[location.pathname] || 'SI-CKP';

  return (
    <header className="bg-white border-b border-slate-100 px-4 lg:px-6 h-14 flex items-center justify-between flex-shrink-0 sticky top-0 z-30">
      {/* Left: Mobile menu + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileOpen(prev => !prev)}
          className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-base font-semibold text-slate-800">{title}</h1>
          <p className="text-xs text-slate-400 hidden sm:block">{TODAY}</p>
        </div>
      </div>

      {/* Right: Notifications + User */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <Bell className="w-4 h-4 text-slate-600" />
          {unreadNotifications > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </span>
          )}
        </button>

        {/* User info */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-100">
          <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-xs">
            {user?.employee?.nama?.charAt(0) || user?.username?.charAt(0)?.toUpperCase()}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-700 leading-tight max-w-32 truncate">
              {user?.employee?.nama || user?.username}
            </p>
            <p className="text-xs text-slate-400 leading-tight">{user?.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
