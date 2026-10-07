import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, ClipboardList, Target, FileText,
  Award, Settings, LogOut,
  ChevronLeft, ChevronRight, Menu, X, Activity, Shield
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    label: 'Utama',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true, roles: ['KPA', 'Kasubbag', 'Anggota'] },
      { to: '/kegiatan', label: 'Kegiatan Harian', icon: ClipboardList, roles: ['KPA', 'Kasubbag', 'Anggota'] },
      { to: '/rencana-kinerja', label: 'Rencana Kinerja', icon: Target, roles: ['KPA', 'Kasubbag', 'Anggota'] },
      { to: '/bukti-dukung', label: 'Bukti Dukung', icon: FileText, roles: ['KPA', 'Kasubbag', 'Anggota'] },
      { to: '/nilai-ckp', label: 'Nilai CKP', icon: Award, roles: ['KPA', 'Kasubbag', 'Anggota'] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/audit-log', label: 'Riwayat Aktivitas', icon: Activity, roles: ['KPA'] },
      { to: '/pengaturan', label: 'Pengaturan', icon: Settings, roles: ['KPA'] },
    ],
  },
];

const ROLE_COLORS = {
  KPA: 'bg-red-100 text-red-700',
  Kasubbag: 'bg-blue-100 text-blue-700',
  Anggota: 'bg-green-100 text-green-700',
};

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b border-slate-100 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
          <Shield className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-bold text-primary-700 text-sm leading-tight">SI-CKP</div>
            <div className="text-xs text-slate-500 leading-tight truncate">Sistem Informasi CKP</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 overflow-y-auto">
        {NAV_SECTIONS.map(section => {
          const visibleItems = section.items.filter(item => item.roles.includes(user?.role));
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.label} className="mb-3">
              {!collapsed && (
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-1.5">
                  {section.label}
                </p>
              )}
              {collapsed && <div className="border-t border-slate-100 my-2" />}
              <div className="space-y-0.5">
                {visibleItems.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.exact}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`
                    }
                    title={collapsed ? item.label : ''}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User profile */}
      <div className="p-3 border-t border-slate-100">
        {!collapsed && (
          <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 mb-2">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-xs flex-shrink-0">
              {user?.employee?.nama?.charAt(0) || user?.username?.charAt(0)?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-700 truncate">
                {user?.employee?.nama || user?.username}
              </p>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[user?.role]}`}>
                {user?.role}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className={`sidebar-link w-full text-red-600 hover:bg-red-50 hover:text-red-700 ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? 'Keluar' : ''}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Keluar</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col bg-white border-r border-slate-100 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'} relative flex-shrink-0`}>
        <SidebarContent />
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm hover:bg-slate-50 transition-colors z-10"
        >
          {collapsed ? <ChevronRight className="w-3 h-3 text-slate-500" /> : <ChevronLeft className="w-3 h-3 text-slate-500" />}
        </button>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40 animate-fade-in" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-white h-full shadow-xl animate-fade-in-up">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-slate-100"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}
