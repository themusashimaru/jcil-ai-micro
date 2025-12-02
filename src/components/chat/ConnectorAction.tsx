'use client';

import { useState, useMemo } from 'react';
import { CodeDiff } from './CodeDiff';

interface ConnectorActionProps {
  service: string;
  action: string;
  params: Record<string, unknown>;
  description: string;
}

const SERVICE_ICONS: Record<string, string> = {
  github: '🐙',
  supabase: '⚡',
  notion: '📝',
  shopify: '🛒',
  default: '🔗',
};

const SERVICE_COLORS: Record<string, string> = {
  github: 'border-gray-600 bg-gray-900/50',
  supabase: 'border-green-600 bg-green-900/30',
  notion: 'border-gray-500 bg-gray-800/50',
  shopify: 'border-green-500 bg-green-900/30',
  default: 'border-blue-600 bg-blue-900/30',
};

// Check if this action involves code
function isCodeAction(service: string, action: string): boolean {
  if (service === 'github') {
    return ['write_file', 'create_file', 'read_file'].includes(action);
  }
  return false;
}

export function ConnectorAction({ service, action, params, description }: ConnectorActionProps) {
  const [status, setStatus] = useState<'pending' | 'running' | 'success' | 'error'>('pending');
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(true);

  const icon = SERVICE_ICONS[service] || SERVICE_ICONS.default;
  const colorClass = SERVICE_COLORS[service] || SERVICE_COLORS.default;

  // Check if this is a code-related action
  const hasCodeContent = isCodeAction(service, action) && !!params.content;
  const filename = (params.path as string) || 'file';

  // Filter out code content from params display
  const displayParams = useMemo(() => {
    if (!hasCodeContent) return params;
    const filtered = { ...params };
    delete filtered.content;
    return filtered;
  }, [params, hasCodeContent]);

  const hasParams = Object.keys(displayParams).length > 0;
  const paramsString = hasParams ? JSON.stringify(displayParams, null, 2) : '';

  const executeAction = async () => {
    setStatus('running');
    setError(null);

    try {
      const response = await fetch(`/api/connectors/${service}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus('success');
        setResult(data.result);
      } else {
        setStatus('error');
        setError(data.error || 'Action failed');
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to execute action');
    }
  };

  return (
    <div className={`my-3 rounded-lg border ${colorClass} p-4`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="font-semibold text-white capitalize">{service}</span>
        <span className="text-gray-400">•</span>
        <span className="text-gray-300 text-sm">{action.replace(/_/g, ' ')}</span>
      </div>

      {/* Description */}
      <p className="text-gray-300 text-sm mb-3">{description}</p>

      {/* Parameters Preview (excluding code content) */}
      {hasParams && (
        <div className="mb-3 p-2 bg-black/30 rounded text-xs font-mono text-gray-400 overflow-x-auto">
          <pre>{paramsString}</pre>
        </div>
      )}

      {/* Code Preview for write/create file actions */}
      {hasCodeContent && (
        <div className="mb-3">
          <button
            onClick={() => setShowCode(!showCode)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-2"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showCode ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showCode ? 'Hide' : 'Show'} Code Preview
          </button>
          {showCode && (
            <CodeDiff
              filename={filename}
              code={params.content as string}
              showLineNumbers={true}
              maxHeight="300px"
            />
          )}
        </div>
      )}

      {/* Action Button / Status */}
      {status === 'pending' && (
        <button
          onClick={executeAction}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Run Action
        </button>
      )}

      {status === 'running' && (
        <div className="flex items-center gap-2 text-blue-400">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
          <span className="text-sm">Executing...</span>
        </div>
      )}

      {status === 'success' && result !== null && (
        <div className="mt-2">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">Success</span>
          </div>
          <div className="p-2 bg-black/30 rounded text-xs font-mono text-gray-300 overflow-x-auto max-h-48 overflow-y-auto">
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 text-red-400">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="text-sm">{error}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Parse message content for connector action markers
 * Format: [CONNECTOR_ACTION: service | action | params_json]
 * Returns the content with markers replaced by null (to be rendered separately)
 * and an array of parsed actions
 */
export function parseConnectorActions(content: string): {
  cleanContent: string;
  actions: Array<{
    service: string;
    action: string;
    params: Record<string, unknown>;
    description: string;
  }>;
} {
  // Handle undefined/null content to prevent .trim() crash
  if (!content) {
    return { cleanContent: '', actions: [] };
  }

  // Match the pattern more flexibly - capture everything after the third pipe until closing bracket
  const actionRegex = /\[CONNECTOR_ACTION:\s*(\w+)\s*\|\s*(\w+)\s*\|\s*(\{[\s\S]*?\})\s*\]/g;
  const actions: Array<{
    service: string;
    action: string;
    params: Record<string, unknown>;
    description: string;
  }> = [];

  let cleanContent = content;

  // Find all actions
  let match;
  while ((match = actionRegex.exec(content)) !== null) {
    try {
      const [fullMatch, service, action, paramsJson] = match;
      const params = JSON.parse(paramsJson);
      actions.push({
        service,
        action,
        params,
        description: `Execute ${action.replace(/_/g, ' ')} on ${service}`,
      });
      // Remove this action from the content
      cleanContent = cleanContent.replace(fullMatch, '');
    } catch {
      // Invalid JSON, skip this action
    }
  }

  return { cleanContent: cleanContent.trim(), actions };
}
