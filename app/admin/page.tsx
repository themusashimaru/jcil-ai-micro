/**
 * ADMIN DASHBOARD
 *
 * PURPOSE:
 * - Admin panel landing page with KPIs and system overview
 * - Kill switches, slow mode, budget guards
 * - Real-time metrics: active users, API spend, error rates
 *
 * PUBLIC ROUTES:
 * - /admin (requires admin role)
 *
 * SERVER ACTIONS:
 * - Fetch system metrics
 * - Toggle kill switches
 * - Update system settings
 *
 * SECURITY/RLS NOTES:
 * - Protected route: admin role required
 * - RLS policy: only users with is_admin=true can access
 * - Audit logging for all admin actions
 *
 * RATE LIMITS:
 * - Admin routes: 1000/hour per admin
 *
 * DEPENDENCIES/ENVS:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - UPSTASH_REDIS_REST_URL
 *
 * TODO:
 * - [ ] Build KPI cards (users, chats, revenue, API spend)
 * - [ ] Add kill switch UI (disable signups, chat, tools)
 * - [ ] Implement slow mode controls
 * - [ ] Add budget guards with alerts
 * - [ ] Show recent error logs
 * - [ ] Add quick action buttons
 * - [ ] Mobile-responsive tabbed layout
 *
 * TEST PLAN:
 * - Verify only admins can access
 * - Test kill switches toggle correctly
 * - Validate metrics update in real-time
 * - Check mobile layout works
 */

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-black p-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-8 text-3xl font-bold">Admin Dashboard</h1>

        {/* KPIs */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="glass-morphism rounded-xl p-6">
            <p className="text-sm text-gray-400">Active Users</p>
            <p className="text-3xl font-bold">0</p>
          </div>
          <div className="glass-morphism rounded-xl p-6">
            <p className="text-sm text-gray-400">Messages Today</p>
            <p className="text-3xl font-bold">0</p>
          </div>
          <div className="glass-morphism rounded-xl p-6">
            <p className="text-sm text-gray-400">API Spend</p>
            <p className="text-3xl font-bold">$0</p>
          </div>
          <div className="glass-morphism rounded-xl p-6">
            <p className="text-sm text-gray-400">Error Rate</p>
            <p className="text-3xl font-bold">0%</p>
          </div>
        </div>

        {/* System Controls */}
        <div className="glass-morphism rounded-2xl p-6">
          <h2 className="mb-4 text-xl font-semibold">System Controls</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Chat Enabled</span>
              <button className="rounded-lg bg-green-600 px-4 py-2">ON</button>
            </div>
            <div className="flex items-center justify-between">
              <span>Signups Enabled</span>
              <button className="rounded-lg bg-green-600 px-4 py-2">ON</button>
            </div>
            <div className="flex items-center justify-between">
              <span>Slow Mode</span>
              <button className="rounded-lg bg-gray-600 px-4 py-2">OFF</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
