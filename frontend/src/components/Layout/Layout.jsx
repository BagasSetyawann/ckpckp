import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../../context/AuthContext';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { unreadNotifications } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          setMobileOpen={setMobileOpen}
          unreadNotifications={unreadNotifications}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-7xl mx-auto animate-fade-in-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
