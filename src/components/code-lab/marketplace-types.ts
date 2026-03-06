export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  license?: string;
  keywords?: string[];
}

export interface Plugin {
  metadata: PluginMetadata;
  state: 'available' | 'installed' | 'enabled' | 'disabled' | 'error';
  scope: 'project' | 'user';
  toolCount?: number;
  commandCount?: number;
  downloads?: number;
  rating?: number;
  error?: string;
}

export type TabType = 'browse' | 'installed';
export type FilterCategory = 'all' | 'tools' | 'commands' | 'themes' | 'mcp';

export const CATEGORIES: { id: FilterCategory; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '📦' },
  { id: 'tools', label: 'Tools', icon: '🔧' },
  { id: 'commands', label: 'Commands', icon: '⌨️' },
  { id: 'themes', label: 'Themes', icon: '🎨' },
  { id: 'mcp', label: 'MCP Servers', icon: '🔌' },
];
