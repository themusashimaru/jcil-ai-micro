'use client';

import type { MCPServer } from './CodeLabMCPSettings';

export const ServerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <rect x="2" y="3" width="20" height="6" rx="1" />
    <rect x="2" y="15" width="20" height="6" rx="1" />
    <circle cx="6" cy="6" r="1" fill="currentColor" />
    <circle cx="6" cy="18" r="1" fill="currentColor" />
  </svg>
);

export const ToolIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

export const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
  </svg>
);

export const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

export const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    width="14"
    height="14"
    className={`transition-transform duration-150 ease-in-out ${expanded ? 'rotate-90' : 'rotate-0'}`}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

export function StatusBadge({ status }: { status: MCPServer['status'] }) {
  const config = {
    running: { label: 'Running', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)' },
    stopped: { label: 'Stopped', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.1)' },
    starting: { label: 'Starting...', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)' },
    error: { label: 'Error', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)' },
  }[status];

  return (
    <span
      className="status-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold"
      style={{
        color: config.color,
        backgroundColor: config.bgColor,
      }}
    >
      {status === 'starting' && <span className="spinner" />}
      {status === 'running' && (
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.color }} />
      )}
      {config.label}
    </span>
  );
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`w-[52px] h-7 rounded-[14px] border-none relative transition-[background] duration-200 ease-in-out shrink-0 ${checked ? 'bg-[#1e3a5f]' : 'bg-[#d1d5db]'} ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100'}`}
    >
      <span
        className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-[left] duration-200 ease-in-out"
        style={{ left: checked ? 26 : 2 }}
      />
    </button>
  );
}
