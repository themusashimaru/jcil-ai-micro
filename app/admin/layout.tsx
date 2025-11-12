/**
 * ADMIN PANEL LAYOUT
 * Main layout for admin section with navigation tabs
 */

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    { name: 'Dashboard', href: '/admin', icon: '📊' },
    { name: 'Design', href: '/admin/design', icon: '🎨' },
    { name: 'Users', href: '/admin/users', icon: '👥', disabled: true },
    { name: 'Settings', href: '/admin/settings', icon: '⚙️', disabled: true },
    { name: 'Analytics', href: '/admin/analytics', icon: '📈', disabled: true },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Admin Header */}
      <header className="border-b border-white/10 bg-zinc-950">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                JCIL<span className="text-blue-500">.ai</span> Admin
              </h1>
            </div>
            <Link
              href="/chat"
              className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20 transition"
            >
              Back to App
            </Link>
          </div>

          {/* Navigation Tabs */}
          <nav className="mt-4 flex gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href || (tab.href !== '/admin' && pathname?.startsWith(tab.href));
              return (
                <Link
                  key={tab.href}
                  href={tab.disabled ? '#' : tab.href}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : tab.disabled
                      ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                  onClick={(e) => tab.disabled && e.preventDefault()}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.name}</span>
                  {tab.disabled && <span className="text-xs">(Soon)</span>}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
