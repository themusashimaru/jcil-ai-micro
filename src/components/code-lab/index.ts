/**
 * CODE LAB EXPORTS
 *
 * Professional developer workspace components
 * The best web-based AI coding assistant
 */

// Main components
export { CodeLab } from './CodeLab';
export { CodeLabErrorBoundary } from './CodeLabErrorBoundary';
export { CodeLabSidebar } from './CodeLabSidebar';
export { CodeLabThread } from './CodeLabThread';
export { CodeLabMessage } from './CodeLabMessage';
export { CodeLabComposer } from './CodeLabComposer';

// Feature components
export { CodeLabCommandPalette } from './CodeLabCommandPalette';
export { CodeLabKeyboardShortcuts } from './CodeLabKeyboardShortcuts';
export { CodeLabSlashAutocomplete } from './CodeLabSlashAutocomplete';
export { CodeLabConfirmDialog, CONFIRM_ACTIONS } from './CodeLabConfirmDialog';
export { CodeLabSessionTemplates, SESSION_TEMPLATES } from './CodeLabSessionTemplates';
export { CodeLabAISuggestions } from './CodeLabAISuggestions';
export { CodeLabToolProgress, CodeLabMiniProgress } from './CodeLabToolProgress';

// Theme components
export { CodeLabThemeProvider, useTheme } from './CodeLabThemeProvider';
export { CodeLabThemeToggle } from './CodeLabThemeToggle';

// Workspace components
export { CodeLabWorkspacePanel } from './CodeLabWorkspacePanel';
export { CodeLabTerminal } from './CodeLabTerminal';
export { XTermTerminal, useXTermTerminal } from './XTermTerminal';
export { CodeLabToolDisplay } from './CodeLabToolDisplay';
export { CodeLabFileBrowser } from './CodeLabFileBrowser';
export { CodeLabDiffView } from './CodeLabDiffView';

// Preview/Output components
export { CodeLabPreview } from './CodeLabPreview';
export { CodeLabOutputPanel } from './CodeLabOutputPanel';
export { CodeLabDeploy } from './CodeLabDeploy';

// Phase 1-3 Advanced Components
export { CodeLabDiffViewer } from './CodeLabDiffViewer';
export { CodeLabLiveFileTree } from './CodeLabLiveFileTree';
export { CodeLabVisualToCode } from './CodeLabVisualToCode';
export { CodeLabDeployFlow } from './CodeLabDeployFlow';

// Beyond Claude Code - Professional IDE Components
export { CodeLabEditor } from './CodeLabEditor';
export { CodeLabThinking } from './CodeLabThinking';
export { CodeLabPermissionDialog } from './CodeLabPermissionDialog';
export { CodeLabToolHistory } from './CodeLabToolHistory';
export { CodeLabSplitPane } from './CodeLabSplitPane';
export { CodeLabStatusBar, useStatusBar } from './CodeLabStatusBar';
export { CodeLabPairProgramming, GhostText } from './CodeLabPairProgramming';
export { usePairProgramming } from './usePairProgramming';
export { CodeLabDebugger } from './CodeLabDebugger';
export { CodeLabCollaboration, CursorIndicator, SelectionHighlight } from './CodeLabCollaboration';

// Types
export type {
  CodeLabSession,
  CodeLabMessage as CodeLabMessageType,
  CodeLabState,
  CodeLabContextValue,
  CodeLabTool,
} from './types';

export type { CodeLabAttachment } from './CodeLabComposer';
export type { ConfirmAction, ConfirmSeverity } from './CodeLabConfirmDialog';
export type { SessionTemplate } from './CodeLabSessionTemplates';
export type { AISuggestion } from './CodeLabAISuggestions';
export type { ToolExecution, ToolStatus } from './CodeLabToolProgress';

// Multi-Provider Components
export { CodeLabProviderSelector } from './CodeLabProviderSelector';
export { CodeLabProviderStatus } from './CodeLabProviderStatus';
export { CodeLabModelSelector } from './CodeLabModelSelector';

// Beyond Claude Code Types - re-exported from component files
// Note: Types are defined inline in components, not separately exported
// Use the component exports above for full type inference
