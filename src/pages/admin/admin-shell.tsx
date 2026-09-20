import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar } from '../../components/admin/admin-sidebar';
import { AdminHeader } from '../../components/admin/admin-header';

export const AdminShell: React.FC = () => {
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-page-background text-text-primary flex flex-col antialiased selection:bg-primary/20 selection:text-primary">
      {/* Fixed Sidebar */}
      <AdminSidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 min-w-0 ${
          collapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        <AdminHeader onToggleMobileMenu={() => setMobileOpen(!mobileOpen)} />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminShell;
