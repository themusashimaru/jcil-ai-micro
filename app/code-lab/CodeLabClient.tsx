'use client';

/**
 * CODE LAB CLIENT
 *
 * Client-side wrapper for the Code Lab component.
 * Receives userId from server-side auth.
 * Provides toast notification context for error handling.
 */

import { CodeLab } from '@/components/code-lab';
import { ToastProvider } from '@/components/ui/Toast';

interface CodeLabClientProps {
  userId: string;
}

export function CodeLabClient({ userId }: CodeLabClientProps) {
  return (
    <ToastProvider>
      <CodeLab userId={userId} />
    </ToastProvider>
  );
}
