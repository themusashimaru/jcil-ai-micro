/**
 * ADMIN PANEL LAYOUT CLIENT COMPONENT
 * Client-side UI for admin navigation
 */

'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const pages = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
    { name: 'Users', href: '/admin/users', icon: '👥' },
    { name: 'Conversations', href: '/admin/conversations', icon: '💬', disabled: true },
    { name: 'Earnings', href: '/admin/earnings', icon: '💰' },
    { name: 'Design', href: '/admin/design', icon: '🎨' },
    { name: 'Notifications', href: '/admin/notifications', icon: '🔔' },
    { name: 'Billing', href: '/admin/billing', icon: '💳', disabled: true },
    { name: 'Plans', href: '/admin/plans', icon: '📋', disabled: true },
    { name: 'Branding', href: '/admin/branding', icon: '🏷️', disabled: true },
    { name: 'Broadcasts', href: '/admin/broadcasts', icon: '📢', disabled: true },
    { name: 'CMS', href: '/admin/cms', icon: '📝', disabled: true },
    { name: 'Devotionals', href: '/admin/devotionals', icon: '📖', disabled: true },
    { name: 'Inbox (Internal)', href: '/admin/inbox-internal', icon: '📥', disabled: true },
    { name: 'Inbox (External)', href: '/admin/inbox-external', icon: '📨', disabled: true },
    { name: 'Live', href: '/admin/live', icon: '🔴', disabled: true },
    { name: 'Logs', href: '/admin/logs', icon: '📋', disabled: true },
    { name: 'Moderation', href: '/admin/moderation', icon: '🛡️', disabled: true },
    { name: 'Providers', href: '/admin/providers', icon: '🔌', disabled: true },
    { name: 'System', href: '/admin/system', icon: '⚙️', disabled: true },
  ];

  // Find current page name
  const currentPage = pages.find(
    (page) => pathname === page.href || (page.href !== '/admin' && pathname?.startsWith(page.href))
  ) || pages[0];

  const handlePageChange = (href: string, disabled: boolean) => {
    if (!disabled) {
      router.push(href);
      setIsDropdownOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Admin Header */}
      <header className="border-b border-white/10 bg-zinc-950">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 md:gap-4">
              <h1 className="text-xl md:text-2xl font-bold">
                JCIL<span className="text-blue-500">.ai</span> Admin
              </h1>

              {/* Dropdown Navigation */}
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20 transition"
                >
                  <span>{currentPage.icon}</span>
                  <span>{currentPage.name}</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-48 rounded-lg bg-zinc-900 border border-white/10 shadow-xl z-50">
                    {pages.map((page) => (
                      <button
                        key={page.href}
                        onClick={() => handlePageChange(page.href, page.disabled || false)}
                        disabled={page.disabled}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition first:rounded-t-lg last:rounded-b-lg ${
                          pathname === page.href || (page.href !== '/admin' && pathname?.startsWith(page.href))
                            ? 'bg-blue-600 text-white'
                            : page.disabled
                            ? 'text-gray-500 cursor-not-allowed'
                            : 'text-white hover:bg-white/10'
                        }`}
                      >
                        <span>{page.icon}</span>
                        <span>{page.name}</span>
                        {page.disabled && <span className="text-xs ml-auto opacity-70">(Soon)</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Link
              href="/chat"
              className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20 transition"
            >
              ← Back to App
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
