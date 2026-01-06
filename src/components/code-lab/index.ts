/**
 * CODE LAB EXPORTS
 *
 * Professional developer workspace components
 * The best web-based AI coding assistant
 */

// Main components
export { CodeLab } from './CodeLab';
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
export { CodeLabToolDisplay } from './CodeLabToolDisplay';
export { CodeLabFileBrowser } from './CodeLabFileBrowser';
export { CodeLabDiffView } from './CodeLabDiffView';

// Preview/Output components
export { CodeLabPreview } from './CodeLabPreview';
export { CodeLabOutputPanel } from './CodeLabOutputPanel';
export { CodeLabDeploy } from './CodeLabDeploy';

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
