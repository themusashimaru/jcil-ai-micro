/**
 * ADMIN DASHBOARD
 * Main admin panel overview
 */

'use client';

export default function AdminDashboard() {
  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stats Cards */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">👥</span>
            <h3 className="text-sm font-medium text-gray-400">Total Users</h3>
          </div>
          <p className="text-3xl font-bold">1,234</p>
          <p className="text-xs text-green-400 mt-1">+12% from last month</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">💬</span>
            <h3 className="text-sm font-medium text-gray-400">Total Chats</h3>
          </div>
          <p className="text-3xl font-bold">45,678</p>
          <p className="text-xs text-green-400 mt-1">+8% from last month</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">📊</span>
            <h3 className="text-sm font-medium text-gray-400">API Usage</h3>
          </div>
          <p className="text-3xl font-bold">892K</p>
          <p className="text-xs text-yellow-400 mt-1">+5% from last month</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">⚡</span>
            <h3 className="text-sm font-medium text-gray-400">Uptime</h3>
          </div>
          <p className="text-3xl font-bold">99.9%</p>
          <p className="text-xs text-green-400 mt-1">All systems operational</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h3 className="text-xl font-bold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/admin/design"
            className="rounded-xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 transition group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🎨</span>
              <h4 className="text-lg font-medium group-hover:text-blue-400 transition">Design Settings</h4>
            </div>
            <p className="text-sm text-gray-400">Upload logos, customize branding</p>
          </a>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6 opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">👥</span>
              <h4 className="text-lg font-medium">Manage Users</h4>
            </div>
            <p className="text-sm text-gray-400">View and manage user accounts (Coming Soon)</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6 opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">📈</span>
              <h4 className="text-lg font-medium">View Analytics</h4>
            </div>
            <p className="text-sm text-gray-400">Track usage and performance (Coming Soon)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
