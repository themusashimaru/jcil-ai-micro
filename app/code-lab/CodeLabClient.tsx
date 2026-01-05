'use client';

/**
 * CODE LAB CLIENT
 *
 * Client-side wrapper for the Code Lab component.
 * Receives userId from server-side auth.
 */

import { CodeLab } from '@/components/code-lab';

interface CodeLabClientProps {
  userId: string;
}

export function CodeLabClient({ userId }: CodeLabClientProps) {
  return <CodeLab userId={userId} />;
}
