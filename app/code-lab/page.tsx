'use client';

/**
 * CODE LAB PAGE
 *
 * The dedicated coding workspace - a professional environment
 * for building, debugging, and shipping code.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CodeLab } from '@/components/code-lab';

export default function CodeLabPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | undefined>();

  // Check authentication
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/session');
      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(!!data.user);
        setUserId(data.user?.id);
      } else {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('[CodeLab] Auth check failed:', err);
      setIsAuthenticated(false);
    }
  };

  // Show loading state
  if (isAuthenticated === null) {
    return (
      <div className="code-lab-loading">
        <div className="loading-content">
          <div className="loading-spinner" />
          <p>Loading Code Lab...</p>
        </div>
        <style jsx>{`
          .code-lab-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background: #fafbfc;
          }
          .loading-content {
            text-align: center;
          }
          .loading-spinner {
            width: 32px;
            height: 32px;
            border: 3px solid #e5e7eb;
            border-top-color: #6366f1;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 1rem;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          p {
            color: #6b7280;
            font-size: 0.875rem;
          }
        `}</style>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="code-lab-auth">
        <div className="auth-content">
          <div className="auth-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
            </svg>
          </div>
          <h1>Code Lab</h1>
          <p>Sign in to access your professional coding workspace.</p>
          <button onClick={() => router.push('/auth/login?redirect=/code-lab')}>
            Sign In
          </button>
        </div>
        <style jsx>{`
          .code-lab-auth {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background: #fafbfc;
          }
          .auth-content {
            text-align: center;
            padding: 2rem;
          }
          .auth-icon {
            width: 64px;
            height: 64px;
            margin: 0 auto 1.5rem;
            color: #6366f1;
          }
          .auth-icon svg {
            width: 100%;
            height: 100%;
          }
          h1 {
            font-size: 1.5rem;
            font-weight: 600;
            color: #1a1f36;
            margin: 0 0 0.5rem;
          }
          p {
            color: #6b7280;
            margin: 0 0 1.5rem;
          }
          button {
            background: #1a1f36;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
          }
          button:hover {
            background: #2d3348;
          }
        `}</style>
      </div>
    );
  }

  // Render Code Lab
  return <CodeLab userId={userId} />;
}
