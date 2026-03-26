/**
 * MARKDOWN RENDERER COMPONENT
 *
 * PURPOSE:
 * - Render markdown content with proper formatting
 * - Styled for dark glassmorphism theme
 * - Handles headers, bold, italic, lists, code, links
 * - Auto-linkifies plain URLs that aren't in markdown format
 * - Code blocks with Test/Push actions (Vercel Sandbox + GitHub)
 *
 * USAGE:
 * - <MarkdownRenderer content={message.content} />
 */

'use client';

import { useState, useCallback, memo } from 'react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { CodeBlockWithActions } from './CodeBlockWithActions';
import { TerminalOutput } from './TerminalOutput';
import { parseActionPreview, type ActionPreviewData } from './ActionPreviewCard';
import { parseDestructiveAction, type DestructiveActionData } from './DestructiveActionCard';
import { parseChainProgress } from './ChainProgressCard';
import { parseBrowserView } from './BrowserViewCard';
import { parseBrowserActions } from './BrowserActionReplay';
import { parseScheduledAction, type ScheduledActionData } from './ScheduledActionCard';

// Lazy-load heavy card components — only loaded when their markers appear in content
const ActionPreviewCard = dynamic(() => import('./ActionPreviewCard'), { ssr: false });
const DestructiveActionCard = dynamic(() => import('./DestructiveActionCard'), { ssr: false });
const ChainProgressCard = dynamic(() => import('./ChainProgressCard'), { ssr: false });
const BrowserViewCard = dynamic(() => import('./BrowserViewCard'), { ssr: false });
const BrowserActionReplay = dynamic(() => import('./BrowserActionReplay'), { ssr: false });
const ScreenshotGallery = dynamic(() => import('./ScreenshotGallery'), { ssr: false });
const ScheduledActionCard = dynamic(() => import('./ScheduledActionCard'), { ssr: false });
import { useCodeExecutionOptional } from '@/contexts/CodeExecutionContext';
import { baseMarkdownComponents } from './markdown-components';
import {
  autoLinkifyUrls,
  filterInternalMarkers,
  groupImagesIntoGallery,
  getExtensionForLanguage,
  getDisplayLanguage,
} from './markdown-helpers';

interface MarkdownRendererProps {
  content: string;
  enableCodeActions?: boolean;
  onTestResult?: (result: { success: boolean; output: string }) => void;
  onActionSend?: (preview: ActionPreviewData) => Promise<void>;
  onActionEdit?: (preview: ActionPreviewData, instruction: string) => void;
  onActionCancel?: (preview: ActionPreviewData) => void;
  onDestructiveConfirm?: (data: DestructiveActionData) => Promise<void>;
  onDestructiveCancel?: (data: DestructiveActionData) => void;
  onScheduledConfirm?: (data: ScheduledActionData) => Promise<void>;
  onScheduledModifyTime?: (data: ScheduledActionData, newTime: string) => void;
  onScheduledCancel?: (data: ScheduledActionData) => void;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  enableCodeActions = false,
  onTestResult,
  onActionSend,
  onActionEdit,
  onActionCancel,
  onDestructiveConfirm,
  onDestructiveCancel,
  onScheduledConfirm,
  onScheduledModifyTime,
  onScheduledCancel,
}: MarkdownRendererProps) {
  const [actionSending, setActionSending] = useState(false);
  const [destructiveConfirming, setDestructiveConfirming] = useState(false);
  const [scheduledConfirming, setScheduledConfirming] = useState(false);

  const codeExecution = useCodeExecutionOptional();

  const [testResults, setTestResults] = useState<
    Map<string, { success: boolean; output: string; testing: boolean }>
  >(new Map());

  const filteredContent = filterInternalMarkers(content);
  const linkedContent = autoLinkifyUrls(filteredContent);
  const processedContent = groupImagesIntoGallery(linkedContent);

  const getCodeHash = useCallback((code: string) => {
    return code.slice(0, 100) + '_' + code.length;
  }, []);

  const componentsWithActions: Components = {
    ...baseMarkdownComponents,
    code: ({ className, children }) => {
      const isInline = !className;
      const language = className?.replace('language-', '') || '';
      const codeContent = String(children).replace(/\n$/, '');

      if (isInline) {
        return (
          <code className="px-1.5 py-0.5 rounded text-sm font-mono bg-glass text-primary">
            {children}
          </code>
        );
      }

      if (language === 'action-preview') {
        const previewData = parseActionPreview(`\`\`\`action-preview\n${codeContent}\n\`\`\``);
        if (previewData) {
          return (
            <ActionPreviewCard
              preview={previewData}
              sending={actionSending}
              onSend={async () => {
                if (onActionSend) {
                  setActionSending(true);
                  try {
                    await onActionSend(previewData);
                  } finally {
                    setActionSending(false);
                  }
                }
              }}
              onEdit={(instruction) => onActionEdit?.(previewData, instruction)}
              onCancel={() => onActionCancel?.(previewData)}
            />
          );
        }
      }

      if (language === 'action-confirm') {
        const confirmData = parseDestructiveAction(`\`\`\`action-confirm\n${codeContent}\n\`\`\``);
        if (confirmData) {
          return (
            <DestructiveActionCard
              data={confirmData}
              confirming={destructiveConfirming}
              onConfirm={async () => {
                if (onDestructiveConfirm) {
                  setDestructiveConfirming(true);
                  try {
                    await onDestructiveConfirm(confirmData);
                  } finally {
                    setDestructiveConfirming(false);
                  }
                }
              }}
              onCancel={() => onDestructiveCancel?.(confirmData)}
            />
          );
        }
      }

      if (language === 'chain-progress') {
        const progressData = parseChainProgress(`\`\`\`chain-progress\n${codeContent}\n\`\`\``);
        if (progressData) return <ChainProgressCard data={progressData} />;
      }

      if (language === 'browser-view') {
        const viewData = parseBrowserView(`\`\`\`browser-view\n${codeContent}\n\`\`\``);
        if (viewData) return <BrowserViewCard data={viewData} />;
      }

      if (language === 'browser-actions') {
        const replayData = parseBrowserActions(`\`\`\`browser-actions\n${codeContent}\n\`\`\``);
        if (replayData) return <BrowserActionReplay data={replayData} />;
      }

      if (language === 'screenshot-gallery') {
        try {
          const images = JSON.parse(codeContent);
          if (Array.isArray(images) && images.length > 0)
            return <ScreenshotGallery images={images} />;
        } catch {
          /* Not valid JSON, fall through */
        }
      }

      if (language === 'scheduled-action') {
        const scheduleData = parseScheduledAction(`\`\`\`scheduled-action\n${codeContent}\n\`\`\``);
        if (scheduleData) {
          return (
            <ScheduledActionCard
              data={scheduleData}
              confirming={scheduledConfirming}
              onConfirm={async (data) => {
                if (onScheduledConfirm) {
                  setScheduledConfirming(true);
                  try {
                    await onScheduledConfirm(data);
                  } finally {
                    setScheduledConfirming(false);
                  }
                }
              }}
              onModifyTime={(data, newTime) => onScheduledModifyTime?.(data, newTime)}
              onCancel={(data) => onScheduledCancel?.(data)}
            />
          );
        }
      }

      const isTerminalOutput = [
        'bash',
        'sh',
        'shell',
        'console',
        'terminal',
        'output',
        'log',
      ].includes(language.toLowerCase());
      if (isTerminalOutput) {
        const hasError =
          codeContent.toLowerCase().includes('error') ||
          codeContent.toLowerCase().includes('failed') ||
          codeContent.toLowerCase().includes('exception');
        return (
          <TerminalOutput
            output={codeContent}
            success={!hasError}
            title={language === 'output' ? 'Output' : language === 'log' ? 'Log' : 'Terminal'}
          />
        );
      }

      if (enableCodeActions && codeExecution) {
        const codeHash = getCodeHash(codeContent);
        const testState = testResults.get(codeHash);

        return (
          <CodeBlockWithActions
            key={codeHash}
            code={codeContent}
            language={language}
            showTestButton={true}
            showPushButton={codeExecution.githubConnected}
            externalTesting={testState?.testing}
            externalTestResult={
              testState && !testState.testing
                ? { success: testState.success, output: testState.output }
                : undefined
            }
            onTest={async (code, lang) => {
              setTestResults((prev) => {
                const next = new Map(prev);
                next.set(codeHash, { success: false, output: '', testing: true });
                return next;
              });

              try {
                const result = await codeExecution.testCode(code, lang);
                const output = Array.isArray(result.outputs)
                  ? result.outputs.map((o) => o.stdout || o.stderr).join('\n')
                  : '';
                const displayOutput = output || result.error || '';

                setTestResults((prev) => {
                  const next = new Map(prev);
                  next.set(codeHash, {
                    success: result.success,
                    output: displayOutput,
                    testing: false,
                  });
                  return next;
                });

                if (onTestResult) onTestResult({ success: result.success, output: displayOutput });
                return { success: result.success, output: displayOutput };
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Test failed';
                setTestResults((prev) => {
                  const next = new Map(prev);
                  next.set(codeHash, { success: false, output: errorMsg, testing: false });
                  return next;
                });
                return { success: false, output: errorMsg };
              }
            }}
            onPush={async (code, lang) => {
              const ext = getExtensionForLanguage(lang);
              const filename = `code${ext}`;

              if (!codeExecution.selectedRepo) {
                codeExecution.setShowRepoSelector(true);
                return;
              }

              await codeExecution.pushToGitHub(code, filename);
            }}
          />
        );
      }

      return (
        <div className="rounded-lg overflow-hidden my-2 bg-glass">
          {language && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border-b border-theme text-text-muted bg-blue-500/10">
              <span>{getDisplayLanguage(language)}</span>
            </div>
          )}
          <code className="block p-3 text-sm font-mono overflow-x-auto text-text-primary">
            {children}
          </code>
        </div>
      );
    },
  };

  return (
    <div className="markdown-content text-inherit">
      <ReactMarkdown components={componentsWithActions}>{processedContent}</ReactMarkdown>
    </div>
  );
});
