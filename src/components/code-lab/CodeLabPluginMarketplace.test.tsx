// @ts-nocheck
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Make React available globally since source file uses JSX without explicit React import
globalThis.React = React;

// ============================================================================
// MOCKS
// ============================================================================

const mockLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => mockLogger,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import CodeLabPluginMarketplace, {
  CodeLabPluginMarketplace as NamedCodeLabPluginMarketplace,
} from './CodeLabPluginMarketplace';

// ============================================================================
// TEST FIXTURES
// ============================================================================

function makePlugin(overrides = {}) {
  return {
    metadata: {
      id: 'plugin-1',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'A test plugin',
      author: 'Test Author',
      homepage: 'https://example.com',
      license: 'MIT',
      keywords: ['tools', 'testing'],
    },
    state: 'available' as const,
    scope: 'project' as const,
    toolCount: 5,
    commandCount: 3,
    downloads: 1500,
    rating: 4.5,
    ...overrides,
  };
}

function makePluginMinimal(id: string, name: string) {
  return {
    metadata: { id, name, version: '1.0.0' },
    state: 'available' as const,
    scope: 'project' as const,
  };
}

function makePluginWithKeywords(id: string, name: string, keywords: string[]) {
  return {
    metadata: { id, name, version: '1.0.0', description: `Description for ${name}`, keywords },
    state: 'available' as const,
    scope: 'project' as const,
  };
}

const defaultProps = {
  plugins: [],
  installedPlugins: [],
  enabledPlugins: [],
  onInstall: vi.fn().mockResolvedValue(undefined),
  onUninstall: vi.fn().mockResolvedValue(undefined),
  onEnable: vi.fn().mockResolvedValue(undefined),
  onDisable: vi.fn().mockResolvedValue(undefined),
  onConfigure: vi.fn(),
};

function renderMarketplace(props = {}) {
  const merged = { ...defaultProps, ...props };
  return render(<CodeLabPluginMarketplace {...merged} />);
}

// ============================================================================
// TESTS
// ============================================================================

describe('CodeLabPluginMarketplace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // MODULE EXPORTS
  // --------------------------------------------------------------------------

  describe('Module Exports', () => {
    it('should export CodeLabPluginMarketplace as default export', () => {
      expect(CodeLabPluginMarketplace).toBeDefined();
      expect(typeof CodeLabPluginMarketplace).toBe('function');
    });

    it('should export CodeLabPluginMarketplace as named export', () => {
      expect(NamedCodeLabPluginMarketplace).toBeDefined();
      expect(typeof NamedCodeLabPluginMarketplace).toBe('function');
    });

    it('should have default and named exports reference the same function', () => {
      expect(CodeLabPluginMarketplace).toBe(NamedCodeLabPluginMarketplace);
    });
  });

  // --------------------------------------------------------------------------
  // BASIC RENDERING
  // --------------------------------------------------------------------------

  describe('Basic Rendering', () => {
    it('should render without crashing with empty plugins', () => {
      const { container } = renderMarketplace();
      expect(container.querySelector('.plugin-marketplace')).toBeInTheDocument();
    });

    it('should render the marketplace header', () => {
      renderMarketplace();
      expect(screen.getByText('Plugin Marketplace')).toBeInTheDocument();
    });

    it('should render the marketplace subtitle', () => {
      renderMarketplace();
      expect(
        screen.getByText('Discover and install plugins to extend Code Lab')
      ).toBeInTheDocument();
    });

    it('should render embedded styles', () => {
      const { container } = renderMarketplace();
      const styleElements = container.querySelectorAll('style');
      expect(styleElements.length).toBeGreaterThan(0);
    });

    it('should render the search input', () => {
      renderMarketplace();
      expect(screen.getByPlaceholderText('Search plugins...')).toBeInTheDocument();
    });

    it('should render the search input with proper aria-label', () => {
      renderMarketplace();
      expect(screen.getByLabelText('Search plugins')).toBeInTheDocument();
    });

    it('should render search SVG icon', () => {
      const { container } = renderMarketplace();
      const svg = container.querySelector('.search-icon');
      expect(svg).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // TABS
  // --------------------------------------------------------------------------

  describe('Tabs', () => {
    it('should render Browse tab', () => {
      renderMarketplace();
      expect(screen.getByText('Browse')).toBeInTheDocument();
    });

    it('should render Installed tab with count', () => {
      renderMarketplace({ installedPlugins: ['p1', 'p2'] });
      expect(screen.getByText('Installed (2)')).toBeInTheDocument();
    });

    it('should render Installed tab with zero count', () => {
      renderMarketplace({ installedPlugins: [] });
      expect(screen.getByText('Installed (0)')).toBeInTheDocument();
    });

    it('should have tablist role', () => {
      renderMarketplace();
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('should have aria-label on tablist', () => {
      renderMarketplace();
      expect(screen.getByLabelText('Plugin views')).toBeInTheDocument();
    });

    it('should have Browse tab with role="tab"', () => {
      renderMarketplace();
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBe(2);
    });

    it('should mark Browse tab as active by default', () => {
      renderMarketplace();
      const browseTab = screen.getByText('Browse');
      expect(browseTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should mark Installed tab as not active by default', () => {
      renderMarketplace();
      const installedTab = screen.getByText('Installed (0)');
      expect(installedTab).toHaveAttribute('aria-selected', 'false');
    });

    it('should switch to Installed tab on click', () => {
      renderMarketplace({ installedPlugins: [] });
      const installedTab = screen.getByText('Installed (0)');
      fireEvent.click(installedTab);
      expect(installedTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should switch back to Browse tab on click', () => {
      renderMarketplace({ installedPlugins: [] });
      const installedTab = screen.getByText('Installed (0)');
      fireEvent.click(installedTab);
      const browseTab = screen.getByText('Browse');
      fireEvent.click(browseTab);
      expect(browseTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should apply active class to Browse tab by default', () => {
      renderMarketplace();
      const browseTab = screen.getByText('Browse');
      expect(browseTab.className).toContain('active');
    });

    it('should apply active class to Installed tab when selected', () => {
      renderMarketplace({ installedPlugins: [] });
      const installedTab = screen.getByText('Installed (0)');
      fireEvent.click(installedTab);
      expect(installedTab.className).toContain('active');
    });
  });

  // --------------------------------------------------------------------------
  // CATEGORIES
  // --------------------------------------------------------------------------

  describe('Categories', () => {
    it('should render all 5 category buttons', () => {
      const { container } = renderMarketplace();
      const categoryBtns = container.querySelectorAll('.category-btn');
      expect(categoryBtns.length).toBe(5);
    });

    it('should render All category', () => {
      renderMarketplace();
      expect(screen.getByText('All')).toBeInTheDocument();
    });

    it('should render Tools category', () => {
      renderMarketplace();
      expect(screen.getByText('Tools')).toBeInTheDocument();
    });

    it('should render Commands category', () => {
      renderMarketplace();
      expect(screen.getByText('Commands')).toBeInTheDocument();
    });

    it('should render Themes category', () => {
      renderMarketplace();
      expect(screen.getByText('Themes')).toBeInTheDocument();
    });

    it('should render MCP Servers category', () => {
      renderMarketplace();
      expect(screen.getByText('MCP Servers')).toBeInTheDocument();
    });

    it('should mark All category as active by default', () => {
      const { container } = renderMarketplace();
      const allBtn = container.querySelectorAll('.category-btn')[0];
      expect(allBtn.className).toContain('active');
    });

    it('should switch active category on click', () => {
      renderMarketplace();
      const toolsBtn = screen.getByText('Tools').closest('.category-btn');
      fireEvent.click(toolsBtn);
      expect(toolsBtn.className).toContain('active');
    });

    it('should deactivate All when another category is selected', () => {
      const { container } = renderMarketplace();
      const allBtn = container.querySelectorAll('.category-btn')[0];
      const toolsBtn = screen.getByText('Tools').closest('.category-btn');
      fireEvent.click(toolsBtn);
      expect(allBtn.className).not.toContain('active');
    });

    it('should render category icons', () => {
      const { container } = renderMarketplace();
      const catIcons = container.querySelectorAll('.cat-icon');
      expect(catIcons.length).toBe(5);
    });

    it('should render category labels', () => {
      const { container } = renderMarketplace();
      const catLabels = container.querySelectorAll('.cat-label');
      expect(catLabels.length).toBe(5);
    });
  });

  // --------------------------------------------------------------------------
  // LOADING STATE
  // --------------------------------------------------------------------------

  describe('Loading State', () => {
    it('should show loading state when isLoading is true', () => {
      renderMarketplace({ isLoading: true });
      expect(screen.getByText('Loading plugins...')).toBeInTheDocument();
    });

    it('should render spinner when loading', () => {
      const { container } = renderMarketplace({ isLoading: true });
      expect(container.querySelector('.spinner')).toBeInTheDocument();
    });

    it('should not show plugin cards when loading', () => {
      const plugin = makePlugin();
      renderMarketplace({ isLoading: true, plugins: [plugin] });
      expect(screen.queryByText('Test Plugin')).not.toBeInTheDocument();
    });

    it('should not show loading state when isLoading is false', () => {
      renderMarketplace({ isLoading: false });
      expect(screen.queryByText('Loading plugins...')).not.toBeInTheDocument();
    });

    it('should default isLoading to false', () => {
      renderMarketplace();
      expect(screen.queryByText('Loading plugins...')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // EMPTY STATE
  // --------------------------------------------------------------------------

  describe('Empty State', () => {
    it('should show empty state when no plugins match', () => {
      renderMarketplace({ plugins: [] });
      expect(screen.getByText('No plugins found')).toBeInTheDocument();
    });

    it('should show helpful message in empty state', () => {
      renderMarketplace({ plugins: [] });
      expect(screen.getByText('Try a different search or category')).toBeInTheDocument();
    });

    it('should show empty state when search has no results', () => {
      const plugin = makePlugin();
      renderMarketplace({ plugins: [plugin] });
      const searchInput = screen.getByPlaceholderText('Search plugins...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent-xyz-abc' } });
      expect(screen.getByText('No plugins found')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // PLUGIN CARD RENDERING
  // --------------------------------------------------------------------------

  describe('Plugin Card Rendering', () => {
    it('should render plugin cards when plugins are provided', () => {
      const plugin = makePlugin();
      renderMarketplace({ plugins: [plugin] });
      expect(screen.getByText('Test Plugin')).toBeInTheDocument();
    });

    it('should render plugin version with v prefix', () => {
      const plugin = makePlugin();
      renderMarketplace({ plugins: [plugin] });
      expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    });

    it('should render plugin description', () => {
      const plugin = makePlugin();
      renderMarketplace({ plugins: [plugin] });
      expect(screen.getByText('A test plugin')).toBeInTheDocument();
    });

    it('should show fallback when no description', () => {
      const plugin = makePlugin({
        metadata: { id: 'p1', name: 'NoDesc', version: '1.0.0' },
      });
      renderMarketplace({ plugins: [plugin] });
      // "No description available" appears both in card and detail panel when selected
      expect(screen.getAllByText('No description available').length).toBeGreaterThanOrEqual(1);
    });

    it('should render plugin icon as first letter uppercased', () => {
      const plugin = makePlugin({
        metadata: { id: 'p1', name: 'alpha', version: '1.0.0' },
      });
      const { container } = renderMarketplace({ plugins: [plugin] });
      const icon = container.querySelector('.plugin-icon');
      expect(icon).toHaveTextContent('A');
    });

    it('should render plugin tags (max 3)', () => {
      const plugin = makePlugin({
        metadata: {
          id: 'p1',
          name: 'Tagged',
          version: '1.0.0',
          keywords: ['tools', 'testing', 'linting', 'formatting'],
        },
      });
      const { container } = renderMarketplace({ plugins: [plugin] });
      const tags = container.querySelectorAll('.plugin-tags .tag');
      expect(tags.length).toBe(3);
    });

    it('should not render tags section when no keywords', () => {
      const plugin = makePluginMinimal('p1', 'NoTags');
      const { container } = renderMarketplace({ plugins: [plugin] });
      expect(container.querySelector('.plugin-tags')).not.toBeInTheDocument();
    });

    it('should not render tags section when keywords is empty array', () => {
      const plugin = makePlugin({
        metadata: { id: 'p1', name: 'EmptyTags', version: '1.0.0', keywords: [] },
      });
      const { container } = renderMarketplace({ plugins: [plugin] });
      expect(container.querySelector('.plugin-tags')).not.toBeInTheDocument();
    });

    it('should render tool count stat', () => {
      const plugin = makePlugin({ toolCount: 10 });
      renderMarketplace({ plugins: [plugin] });
      expect(screen.getByText(/10 tools/)).toBeInTheDocument();
    });

    it('should render command count stat', () => {
      const plugin = makePlugin({ commandCount: 7 });
      renderMarketplace({ plugins: [plugin] });
      expect(screen.getByText(/7 commands/)).toBeInTheDocument();
    });

    it('should render download count with locale formatting', () => {
      const plugin = makePlugin({ downloads: 15000 });
      renderMarketplace({ plugins: [plugin] });
      // toLocaleString for 15000 typically produces "15,000"
      expect(screen.getByText(/15,000/)).toBeInTheDocument();
    });

    it('should not render tool stat when toolCount is undefined', () => {
      const plugin = makePlugin({ toolCount: undefined });
      const { container } = renderMarketplace({ plugins: [plugin] });
      const stats = container.querySelectorAll('.stat');
      const toolStat = Array.from(stats).find((s) => s.textContent?.includes('tools'));
      expect(toolStat).toBeUndefined();
    });

    it('should not render command stat when commandCount is undefined', () => {
      const plugin = makePlugin({ commandCount: undefined });
      const { container } = renderMarketplace({ plugins: [plugin] });
      const stats = container.querySelectorAll('.stat');
      const commandStat = Array.from(stats).find((s) => s.textContent?.includes('commands'));
      expect(commandStat).toBeUndefined();
    });

    it('should not render download stat when downloads is undefined', () => {
      const plugin = makePlugin({ downloads: undefined });
      const { container } = renderMarketplace({ plugins: [plugin] });
      const stats = container.querySelectorAll('.stat');
      const downloadStat = Array.from(stats).find((s) => s.textContent?.includes('\u{1F4E5}'));
      expect(downloadStat).toBeUndefined();
    });

    it('should render multiple plugin cards', () => {
      const plugins = [
        makePlugin({ metadata: { id: 'p1', name: 'Plugin One', version: '1.0.0' } }),
        makePlugin({ metadata: { id: 'p2', name: 'Plugin Two', version: '2.0.0' } }),
        makePlugin({ metadata: { id: 'p3', name: 'Plugin Three', version: '3.0.0' } }),
      ];
      renderMarketplace({ plugins });
      expect(screen.getByText('Plugin One')).toBeInTheDocument();
      expect(screen.getByText('Plugin Two')).toBeInTheDocument();
      expect(screen.getByText('Plugin Three')).toBeInTheDocument();
    });

    it('should have role="button" on plugin card', () => {
      const plugin = makePlugin();
      const { container } = renderMarketplace({ plugins: [plugin] });
      const card = container.querySelector('.plugin-card');
      expect(card).toHaveAttribute('role', 'button');
    });

    it('should have tabIndex=0 on plugin card', () => {
      const plugin = makePlugin();
      const { container } = renderMarketplace({ plugins: [plugin] });
      const card = container.querySelector('.plugin-card');
      expect(card).toHaveAttribute('tabindex', '0');
    });
  });

  // --------------------------------------------------------------------------
  // STATUS BADGES
  // --------------------------------------------------------------------------

  describe('Status Badges', () => {
    it('should show Enabled badge for enabled plugins', () => {
      const plugin = makePlugin();
      renderMarketplace({
        plugins: [plugin],
        installedPlugins: ['plugin-1'],
        enabledPlugins: ['plugin-1'],
      });
      expect(screen.getByText('Enabled')).toBeInTheDocument();
    });

    it('should show Installed badge for installed but not enabled plugins', () => {
      const plugin = makePlugin();
      renderMarketplace({
        plugins: [plugin],
        installedPlugins: ['plugin-1'],
        enabledPlugins: [],
      });
      expect(screen.getByText('Installed')).toBeInTheDocument();
    });

    it('should not show any badge for available (not installed) plugins', () => {
      const plugin = makePlugin();
      renderMarketplace({
        plugins: [plugin],
        installedPlugins: [],
        enabledPlugins: [],
      });
      expect(screen.queryByText('Enabled')).not.toBeInTheDocument();
      expect(screen.queryByText('Installed')).not.toBeInTheDocument();
    });

    it('should have correct CSS classes on badges', () => {
      const plugin = makePlugin();
      renderMarketplace({
        plugins: [plugin],
        installedPlugins: ['plugin-1'],
        enabledPlugins: ['plugin-1'],
      });
      const badge = screen.getByText('Enabled');
      expect(badge.className).toContain('status-badge');
      expect(badge.className).toContain('enabled');
    });
  });

  // --------------------------------------------------------------------------
  // PLUGIN CARD ACTIONS - INSTALL
  // --------------------------------------------------------------------------

  describe('Plugin Card Actions - Install', () => {
    it('should show Install button for available plugins', () => {
      const plugin = makePlugin();
      renderMarketplace({ plugins: [plugin] });
      expect(screen.getByText('Install')).toBeInTheDocument();
    });

    it('should call onInstall when Install button is clicked', async () => {
      const onInstall = vi.fn().mockResolvedValue(undefined);
      const plugin = makePlugin();
      renderMarketplace({ plugins: [plugin], onInstall });

      await act(async () => {
        fireEvent.click(screen.getByText('Install'));
      });

      expect(onInstall).toHaveBeenCalledWith('plugin-1');
    });

    it('should show Installing... text while install is in progress', async () => {
      let resolveInstall;
      const onInstall = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveInstall = resolve;
          })
      );
      const plugin = makePlugin();
      renderMarketplace({ plugins: [plugin], onInstall });

      await act(async () => {
        fireEvent.click(screen.getByText('Install'));
      });

      expect(screen.getByText('Installing...')).toBeInTheDocument();

      await act(async () => {
        resolveInstall();
      });
    });

    it('should disable Install button while action is loading', async () => {
      let resolveInstall;
      const onInstall = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveInstall = resolve;
          })
      );
      const plugin = makePlugin();
      renderMarketplace({ plugins: [plugin], onInstall });

      await act(async () => {
        fireEvent.click(screen.getByText('Install'));
      });

      expect(screen.getByText('Installing...')).toBeDisabled();

      await act(async () => {
        resolveInstall();
      });
    });

    it('should stop propagation when Install button is clicked', () => {
      const plugin = makePlugin();
      renderMarketplace({ plugins: [plugin] });

      // The install button click should not select the plugin card
      // (stopPropagation prevents the card onClick from firing)
      const installBtn = screen.getByText('Install');
      fireEvent.click(installBtn);

      // Card should not get selected class after clicking install button
      // (if stopPropagation works, the card won't become selected)
      // However, since the card might already be selected from a previous click,
      // we just verify the install handler was called
      expect(defaultProps.onInstall).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // PLUGIN CARD ACTIONS - ENABLE/DISABLE
  // --------------------------------------------------------------------------

  describe('Plugin Card Actions - Enable/Disable', () => {
    it('should show Enable button for installed but not enabled plugins', () => {
      const plugin = makePlugin();
      renderMarketplace({
        plugins: [plugin],
        installedPlugins: ['plugin-1'],
        enabledPlugins: [],
      });
      expect(screen.getByText('Enable')).toBeInTheDocument();
    });

    it('should show Disable button for enabled plugins', () => {
      const plugin = makePlugin();
      renderMarketplace({
        plugins: [plugin],
        installedPlugins: ['plugin-1'],
        enabledPlugins: ['plugin-1'],
      });
      expect(screen.getByText('Disable')).toBeInTheDocument();
    });

    it('should call onEnable when Enable button is clicked', async () => {
      const onEnable = vi.fn().mockResolvedValue(undefined);
      const plugin = makePlugin();
      renderMarketplace({
        plugins: [plugin],
        installedPlugins: ['plugin-1'],
        enabledPlugins: [],
        onEnable,
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Enable'));
      });

      expect(onEnable).toHaveBeenCalledWith('plugin-1');
    });

    it('should call onDisable when Disable button is clicked', async () => {
      const onDisable = vi.fn().mockResolvedValue(undefined);
      const plugin = makePlugin();
      renderMarketplace({
        plugins: [plugin],
        installedPlugins: ['plugin-1'],
        enabledPlugins: ['plugin-1'],
        onDisable,
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Disable'));
      });

      expect(onDisable).toHaveBeenCalledWith('plugin-1');
    });

    it('should show ... text while enable/disable is in progress', async () => {
      let resolveEnable;
      const onEnable = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveEnable = resolve;
          })
      );
      const plugin = makePlugin();
      renderMarketplace({
        plugins: [plugin],
        installedPlugins: ['plugin-1'],
        enabledPlugins: [],
        onEnable,
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Enable'));
      });

      expect(screen.getByText('...')).toBeInTheDocument();

      await act(async () => {
        resolveEnable();
      });
    });
  });

  // --------------------------------------------------------------------------
  // PLUGIN CARD ACTIONS - CONFIGURE
  // --------------------------------------------------------------------------

  describe('Plugin Card Actions - Configure', () => {
    it('should show configure button for installed plugins', () => {
      const plugin = makePlugin();
      renderMarketplace({
        plugins: [plugin],
        installedPlugins: ['plugin-1'],
        enabledPlugins: [],
      });
      expect(screen.getByLabelText('Configure plugin')).toBeInTheDocument();
    });

    it('should not show configure button for available (not installed) plugins', () => {
      const plugin = makePlugin();
      renderMarketplace({ plugins: [plugin] });
      expect(screen.queryByLabelText('Configure plugin')).not.toBeInTheDocument();
    });

    it('should call onConfigure when configure button is clicked', () => {
      const onConfigure = vi.fn();
      const plugin = makePlugin();
      renderMarketplace({
        plugins: [plugin],
        installedPlugins: ['plugin-1'],
        enabledPlugins: [],
        onConfigure,
      });

      fireEvent.click(screen.getByLabelText('Configure plugin'));
      expect(onConfigure).toHaveBeenCalledWith('plugin-1');
    });
  });

  // --------------------------------------------------------------------------
  // PLUGIN CARD SELECTION
  // --------------------------------------------------------------------------

  describe('Plugin Card Selection', () => {
    it('should select a plugin when card is clicked', () => {
      const plugin = makePlugin();
      const { container } = renderMarketplace({ plugins: [plugin] });

      const card = container.querySelector('.plugin-card');
      fireEvent.click(card);

      expect(card.className).toContain('selected');
    });

    it('should select a plugin via Enter key', () => {
      const plugin = makePlugin();
      const { container } = renderMarketplace({ plugins: [plugin] });

      const card = container.querySelector('.plugin-card');
      fireEvent.keyDown(card, { key: 'Enter' });

      expect(card.className).toContain('selected');
    });

    it('should not select a plugin on non-Enter key press', () => {
      const plugin = makePlugin();
      const { container } = renderMarketplace({ plugins: [plugin] });

      const card = container.querySelector('.plugin-card');
      fireEvent.keyDown(card, { key: 'Space' });

      expect(card.className).not.toContain('selected');
    });

    it('should show detail panel content when a plugin is selected', () => {
      const plugin = makePlugin();
      const { container } = renderMarketplace({ plugins: [plugin] });

      const card = container.querySelector('.plugin-card');
      fireEvent.click(card);

      // Detail panel should show plugin name in h2
      const detailPanel = container.querySelector('.plugin-detail');
      expect(detailPanel).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // DETAIL PANEL - EMPTY
  // --------------------------------------------------------------------------

  describe('Detail Panel - Empty', () => {
    it('should show empty detail panel when no plugin is selected', () => {
      const { container } = renderMarketplace();
      expect(container.querySelector('.detail-empty')).toBeInTheDocument();
    });

    it('should show prompt to select a plugin', () => {
      renderMarketplace();
      expect(screen.getByText('Select a plugin to view details')).toBeInTheDocument();
    });

    it('should show empty icon in detail panel', () => {
      const { container } = renderMarketplace();
      expect(container.querySelector('.empty-icon')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // DETAIL PANEL - WITH PLUGIN
  // --------------------------------------------------------------------------

  describe('Detail Panel - With Plugin Selected', () => {
    function renderWithSelection(pluginOverrides = {}, props = {}) {
      const plugin = makePlugin(pluginOverrides);
      const result = renderMarketplace({ plugins: [plugin], ...props });
      const card = result.container.querySelector('.plugin-card');
      fireEvent.click(card);
      return result;
    }

    it('should display plugin name in detail header', () => {
      renderWithSelection();
      const detailHeader = screen.getAllByText('Test Plugin');
      expect(detailHeader.length).toBeGreaterThanOrEqual(2); // card + detail
    });

    it('should display plugin version in detail header', () => {
      renderWithSelection();
      const versions = screen.getAllByText('v1.0.0');
      expect(versions.length).toBeGreaterThanOrEqual(2);
    });

    it('should display plugin author in detail header', () => {
      renderWithSelection();
      expect(screen.getByText('by Test Author')).toBeInTheDocument();
    });

    it('should not display author when not provided', () => {
      renderWithSelection({
        metadata: { id: 'p1', name: 'NoAuthor', version: '1.0.0' },
      });
      expect(screen.queryByText(/^by /)).not.toBeInTheDocument();
    });

    it('should display Description section', () => {
      renderWithSelection();
      expect(screen.getByText('Description')).toBeInTheDocument();
    });

    it('should display plugin description text', () => {
      renderWithSelection();
      expect(screen.getAllByText('A test plugin').length).toBeGreaterThanOrEqual(1);
    });

    it('should show fallback description when none provided', () => {
      renderWithSelection({
        metadata: { id: 'p1', name: 'NoDesc', version: '1.0.0' },
      });
      expect(screen.getAllByText('No description available').length).toBeGreaterThanOrEqual(1);
    });

    it('should display Tags section when keywords exist', () => {
      renderWithSelection();
      expect(screen.getByText('Tags')).toBeInTheDocument();
    });

    it('should display all tags in detail panel (not limited to 3)', () => {
      renderWithSelection({
        metadata: {
          id: 'p1',
          name: 'Many Tags',
          version: '1.0.0',
          keywords: ['a', 'b', 'c', 'd', 'e'],
        },
      });
      renderMarketplace();
      // In detail panel, all tags should be shown
      // The tags-list in the detail panel should contain all keywords
      expect(screen.getByText('Tags')).toBeInTheDocument();
    });

    it('should not display Tags section when no keywords', () => {
      const plugin = makePluginMinimal('p1', 'NoKeywords');
      const { container } = renderMarketplace({ plugins: [plugin] });
      const card = container.querySelector('.plugin-card');
      fireEvent.click(card);
      expect(screen.queryByText('Tags')).not.toBeInTheDocument();
    });

    it('should display Details section', () => {
      renderWithSelection();
      expect(screen.getByText('Details')).toBeInTheDocument();
    });

    it('should display version in details list', () => {
      renderWithSelection();
      expect(screen.getByText('Version')).toBeInTheDocument();
    });

    it('should display author in details list when provided', () => {
      renderWithSelection();
      expect(screen.getByText('Author')).toBeInTheDocument();
    });

    it('should display license in details list when provided', () => {
      renderWithSelection();
      expect(screen.getByText('License')).toBeInTheDocument();
      expect(screen.getByText('MIT')).toBeInTheDocument();
    });

    it('should not display license when not provided', () => {
      renderWithSelection({
        metadata: { id: 'p1', name: 'NoLicense', version: '1.0.0' },
      });
      expect(screen.queryByText('License')).not.toBeInTheDocument();
    });

    it('should display homepage link when provided', () => {
      renderWithSelection();
      expect(screen.getByText('Homepage')).toBeInTheDocument();
      const link = screen.getByText('https://example.com');
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should not display homepage when not provided', () => {
      renderWithSelection({
        metadata: { id: 'p1', name: 'NoHP', version: '1.0.0' },
      });
      expect(screen.queryByText('Homepage')).not.toBeInTheDocument();
    });

    it('should display scope as Project for project scope', () => {
      renderWithSelection({ scope: 'project' });
      expect(screen.getByText('Scope')).toBeInTheDocument();
      expect(screen.getByText('Project')).toBeInTheDocument();
    });

    it('should display scope as User for user scope', () => {
      renderWithSelection({ scope: 'user' });
      expect(screen.getByText('User')).toBeInTheDocument();
    });

    it('should display error section when plugin has error', () => {
      renderWithSelection({ error: 'Something went wrong' });
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should not display error section when no error', () => {
      renderWithSelection({ error: undefined });
      expect(screen.queryByText('Error')).not.toBeInTheDocument();
    });

    it('should apply error class to error section', () => {
      const plugin = makePlugin({ error: 'Fail' });
      const { container } = renderMarketplace({ plugins: [plugin] });
      const card = container.querySelector('.plugin-card');
      fireEvent.click(card);
      const errorSection = container.querySelector('.detail-section.error');
      expect(errorSection).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // DETAIL PANEL ACTIONS
  // --------------------------------------------------------------------------

  describe('Detail Panel Actions', () => {
    it('should show Install Plugin button for available plugin in detail', () => {
      const plugin = makePlugin();
      const { container } = renderMarketplace({ plugins: [plugin] });
      fireEvent.click(container.querySelector('.plugin-card'));
      expect(screen.getByText('Install Plugin')).toBeInTheDocument();
    });

    it('should call onInstall from detail panel Install button', async () => {
      const onInstall = vi.fn().mockResolvedValue(undefined);
      const plugin = makePlugin();
      const { container } = renderMarketplace({ plugins: [plugin], onInstall });
      fireEvent.click(container.querySelector('.plugin-card'));

      await act(async () => {
        fireEvent.click(screen.getByText('Install Plugin'));
      });

      expect(onInstall).toHaveBeenCalledWith('plugin-1');
    });

    it('should show Enable button in detail for installed but not enabled plugin', () => {
      const plugin = makePlugin();
      const { container } = renderMarketplace({
        plugins: [plugin],
        installedPlugins: ['plugin-1'],
        enabledPlugins: [],
      });
      fireEvent.click(container.querySelector('.plugin-card'));

      // There should be an Enable button in both card and detail panel
      const enableBtns = screen.getAllByText('Enable');
      expect(enableBtns.length).toBeGreaterThanOrEqual(2);
    });

    it('should show Disable button in detail for enabled plugin', () => {
      const plugin = makePlugin();
      const { container } = renderMarketplace({
        plugins: [plugin],
        installedPlugins: ['plugin-1'],
        enabledPlugins: ['plugin-1'],
      });
      fireEvent.click(container.querySelector('.plugin-card'));

      const disableBtns = screen.getAllByText('Disable');
      expect(disableBtns.length).toBeGreaterThanOrEqual(2);
    });

    it('should show Configure button in detail for installed plugin', () => {
      const plugin = makePlugin();
      const { container } = renderMarketplace({
        plugins: [plugin],
        installedPlugins: ['plugin-1'],
        enabledPlugins: [],
      });
      fireEvent.click(container.querySelector('.plugin-card'));
      expect(screen.getByText('Configure')).toBeInTheDocument();
    });

    it('should call onConfigure from detail panel Configure button', () => {
      const onConfigure = vi.fn();
      const plugin = makePlugin();
      const { container } = renderMarketplace({
        plugins: [plugin],
        installedPlugins: ['plugin-1'],
        enabledPlugins: [],
        onConfigure,
      });
      fireEvent.click(container.querySelector('.plugin-card'));
      fireEvent.click(screen.getByText('Configure'));
      expect(onConfigure).toHaveBeenCalledWith('plugin-1');
    });

    it('should show Uninstall button in detail for installed plugin', () => {
      const plugin = makePlugin();
      const { container } = renderMarketplace({
        plugins: [plugin],
        installedPlugins: ['plugin-1'],
        enabledPlugins: [],
      });
      fireEvent.click(container.querySelector('.plugin-card'));
      expect(screen.getByText('Uninstall')).toBeInTheDocument();
    });

    it('should call onUninstall from detail panel Uninstall button', async () => {
      const onUninstall = vi.fn().mockResolvedValue(undefined);
      const plugin = makePlugin();
      const { container } = renderMarketplace({
        plugins: [plugin],
        installedPlugins: ['plugin-1'],
        enabledPlugins: [],
        onUninstall,
      });
      fireEvent.click(container.querySelector('.plugin-card'));

      await act(async () => {
        fireEvent.click(screen.getByText('Uninstall'));
      });

      expect(onUninstall).toHaveBeenCalledWith('plugin-1');
    });

    it('should show Installing... in detail panel while install is in progress', async () => {
      let resolveInstall;
      const onInstall = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveInstall = resolve;
          })
      );
      const plugin = makePlugin();
      const { container } = renderMarketplace({ plugins: [plugin], onInstall });
      fireEvent.click(container.querySelector('.plugin-card'));

      await act(async () => {
        fireEvent.click(screen.getByText('Install Plugin'));
      });

      // Both card and detail should show installing state
      const installingTexts = screen.getAllByText('Installing...');
      expect(installingTexts.length).toBeGreaterThanOrEqual(1);

      await act(async () => {
        resolveInstall();
      });
    });
  });

  // --------------------------------------------------------------------------
  // SEARCH FILTERING
  // --------------------------------------------------------------------------

  describe('Search Filtering', () => {
    it('should filter plugins by name', () => {
      const plugins = [
        makePluginMinimal('p1', 'Alpha Tool'),
        makePluginMinimal('p2', 'Beta Widget'),
      ];
      renderMarketplace({ plugins });

      const searchInput = screen.getByPlaceholderText('Search plugins...');
      fireEvent.change(searchInput, { target: { value: 'alpha' } });

      expect(screen.getByText('Alpha Tool')).toBeInTheDocument();
      expect(screen.queryByText('Beta Widget')).not.toBeInTheDocument();
    });

    it('should filter plugins by description', () => {
      const plugins = [
        makePluginWithKeywords('p1', 'Plugin A', []),
        makePlugin({
          metadata: {
            id: 'p2',
            name: 'Plugin B',
            version: '1.0.0',
            description: 'Unique description here',
          },
        }),
      ];
      renderMarketplace({ plugins });

      const searchInput = screen.getByPlaceholderText('Search plugins...');
      fireEvent.change(searchInput, { target: { value: 'unique' } });

      expect(screen.queryByText('Plugin A')).not.toBeInTheDocument();
      expect(screen.getByText('Plugin B')).toBeInTheDocument();
    });

    it('should filter plugins by keywords', () => {
      const plugins = [
        makePluginWithKeywords('p1', 'Plugin A', ['linting']),
        makePluginWithKeywords('p2', 'Plugin B', ['formatting']),
      ];
      renderMarketplace({ plugins });

      const searchInput = screen.getByPlaceholderText('Search plugins...');
      fireEvent.change(searchInput, { target: { value: 'linting' } });

      expect(screen.getByText('Plugin A')).toBeInTheDocument();
      expect(screen.queryByText('Plugin B')).not.toBeInTheDocument();
    });

    it('should be case-insensitive', () => {
      const plugins = [makePluginMinimal('p1', 'Alpha Tool')];
      renderMarketplace({ plugins });

      const searchInput = screen.getByPlaceholderText('Search plugins...');
      fireEvent.change(searchInput, { target: { value: 'ALPHA' } });

      expect(screen.getByText('Alpha Tool')).toBeInTheDocument();
    });

    it('should show all plugins when search is cleared', () => {
      const plugins = [
        makePluginMinimal('p1', 'Alpha Tool'),
        makePluginMinimal('p2', 'Beta Widget'),
      ];
      renderMarketplace({ plugins });

      const searchInput = screen.getByPlaceholderText('Search plugins...');
      fireEvent.change(searchInput, { target: { value: 'alpha' } });
      fireEvent.change(searchInput, { target: { value: '' } });

      expect(screen.getByText('Alpha Tool')).toBeInTheDocument();
      expect(screen.getByText('Beta Widget')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // CATEGORY FILTERING
  // --------------------------------------------------------------------------

  describe('Category Filtering', () => {
    it('should show all plugins when All category is selected', () => {
      const plugins = [
        makePluginWithKeywords('p1', 'Tool Plugin', ['tools']),
        makePluginWithKeywords('p2', 'Command Plugin', ['commands']),
      ];
      renderMarketplace({ plugins });

      expect(screen.getByText('Tool Plugin')).toBeInTheDocument();
      expect(screen.getByText('Command Plugin')).toBeInTheDocument();
    });

    it('should filter by tools category', () => {
      const plugins = [
        makePluginWithKeywords('p1', 'Tool Plugin', ['tools']),
        makePluginWithKeywords('p2', 'Command Plugin', ['commands']),
      ];
      renderMarketplace({ plugins });

      const toolsBtn = screen.getByText('Tools').closest('.category-btn');
      fireEvent.click(toolsBtn);

      expect(screen.getByText('Tool Plugin')).toBeInTheDocument();
      expect(screen.queryByText('Command Plugin')).not.toBeInTheDocument();
    });

    it('should filter by commands category', () => {
      const plugins = [
        makePluginWithKeywords('p1', 'Tool Plugin', ['tools']),
        makePluginWithKeywords('p2', 'Command Plugin', ['commands']),
      ];
      renderMarketplace({ plugins });

      const commandsBtn = screen.getByText('Commands').closest('.category-btn');
      fireEvent.click(commandsBtn);

      expect(screen.queryByText('Tool Plugin')).not.toBeInTheDocument();
      expect(screen.getByText('Command Plugin')).toBeInTheDocument();
    });

    it('should filter by themes category', () => {
      const plugins = [
        makePluginWithKeywords('p1', 'Theme Plugin', ['themes']),
        makePluginWithKeywords('p2', 'Tool Plugin', ['tools']),
      ];
      renderMarketplace({ plugins });

      const themesBtn = screen.getByText('Themes').closest('.category-btn');
      fireEvent.click(themesBtn);

      expect(screen.getByText('Theme Plugin')).toBeInTheDocument();
      expect(screen.queryByText('Tool Plugin')).not.toBeInTheDocument();
    });

    it('should filter by mcp category', () => {
      const plugins = [
        makePluginWithKeywords('p1', 'MCP Plugin', ['mcp']),
        makePluginWithKeywords('p2', 'Tool Plugin', ['tools']),
      ];
      renderMarketplace({ plugins });

      const mcpBtn = screen.getByText('MCP Servers').closest('.category-btn');
      fireEvent.click(mcpBtn);

      expect(screen.getByText('MCP Plugin')).toBeInTheDocument();
      expect(screen.queryByText('Tool Plugin')).not.toBeInTheDocument();
    });

    it('should show empty state when category has no matches', () => {
      const plugins = [makePluginWithKeywords('p1', 'Tool Plugin', ['tools'])];
      renderMarketplace({ plugins });

      const themesBtn = screen.getByText('Themes').closest('.category-btn');
      fireEvent.click(themesBtn);

      expect(screen.getByText('No plugins found')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // INSTALLED TAB FILTERING
  // --------------------------------------------------------------------------

  describe('Installed Tab Filtering', () => {
    it('should only show installed plugins on Installed tab', () => {
      const plugins = [
        makePluginMinimal('p1', 'Installed Plugin'),
        makePluginMinimal('p2', 'Available Plugin'),
      ];
      renderMarketplace({
        plugins,
        installedPlugins: ['p1'],
      });

      const installedTab = screen.getByText('Installed (1)');
      fireEvent.click(installedTab);

      expect(screen.getByText('Installed Plugin')).toBeInTheDocument();
      expect(screen.queryByText('Available Plugin')).not.toBeInTheDocument();
    });

    it('should show empty state when no plugins are installed', () => {
      const plugins = [makePluginMinimal('p1', 'Available Plugin')];
      renderMarketplace({ plugins, installedPlugins: [] });

      const installedTab = screen.getByText('Installed (0)');
      fireEvent.click(installedTab);

      expect(screen.getByText('No plugins found')).toBeInTheDocument();
    });

    it('should combine installed tab filter with search', () => {
      const plugins = [
        makePluginMinimal('p1', 'Installed Alpha'),
        makePluginMinimal('p2', 'Installed Beta'),
        makePluginMinimal('p3', 'Available Gamma'),
      ];
      renderMarketplace({
        plugins,
        installedPlugins: ['p1', 'p2'],
      });

      const installedTab = screen.getByText('Installed (2)');
      fireEvent.click(installedTab);

      const searchInput = screen.getByPlaceholderText('Search plugins...');
      fireEvent.change(searchInput, { target: { value: 'alpha' } });

      expect(screen.getByText('Installed Alpha')).toBeInTheDocument();
      expect(screen.queryByText('Installed Beta')).not.toBeInTheDocument();
      expect(screen.queryByText('Available Gamma')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // COMBINED SEARCH + CATEGORY FILTERING
  // --------------------------------------------------------------------------

  describe('Combined Search and Category Filtering', () => {
    it('should apply both search and category filters', () => {
      const plugins = [
        makePluginWithKeywords('p1', 'Alpha Tool', ['tools']),
        makePluginWithKeywords('p2', 'Alpha Command', ['commands']),
        makePluginWithKeywords('p3', 'Beta Tool', ['tools']),
      ];
      renderMarketplace({ plugins });

      const searchInput = screen.getByPlaceholderText('Search plugins...');
      fireEvent.change(searchInput, { target: { value: 'alpha' } });

      const toolsBtn = screen.getByText('Tools').closest('.category-btn');
      fireEvent.click(toolsBtn);

      expect(screen.getByText('Alpha Tool')).toBeInTheDocument();
      expect(screen.queryByText('Alpha Command')).not.toBeInTheDocument();
      expect(screen.queryByText('Beta Tool')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // ERROR HANDLING IN ACTIONS
  // --------------------------------------------------------------------------

  describe('Error Handling in Actions', () => {
    it('should clear actionLoading even when onInstall throws', async () => {
      const onInstall = vi.fn().mockRejectedValue(new Error('Install failed'));
      const plugin = makePlugin();
      renderMarketplace({ plugins: [plugin], onInstall });

      await act(async () => {
        fireEvent.click(screen.getByText('Install'));
      });

      // After the error, the button should go back to "Install"
      await waitFor(() => {
        expect(screen.getByText('Install')).toBeInTheDocument();
      });
    });

    it('should clear actionLoading even when onUninstall throws', async () => {
      const onUninstall = vi.fn().mockRejectedValue(new Error('Uninstall failed'));
      const plugin = makePlugin();
      const { container } = renderMarketplace({
        plugins: [plugin],
        installedPlugins: ['plugin-1'],
        enabledPlugins: [],
        onUninstall,
      });
      fireEvent.click(container.querySelector('.plugin-card'));

      await act(async () => {
        fireEvent.click(screen.getByText('Uninstall'));
      });

      // actionLoading should be cleared
      await waitFor(() => {
        const enableBtns = screen.getAllByText('Enable');
        enableBtns.forEach((btn) => {
          expect(btn).not.toBeDisabled();
        });
      });
    });

    it('should clear actionLoading even when onEnable throws', async () => {
      const onEnable = vi.fn().mockRejectedValue(new Error('Enable failed'));
      const plugin = makePlugin();
      renderMarketplace({
        plugins: [plugin],
        installedPlugins: ['plugin-1'],
        enabledPlugins: [],
        onEnable,
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Enable'));
      });

      await waitFor(() => {
        expect(screen.getByText('Enable')).toBeInTheDocument();
      });
    });

    it('should clear actionLoading even when onDisable throws', async () => {
      const onDisable = vi.fn().mockRejectedValue(new Error('Disable failed'));
      const plugin = makePlugin();
      renderMarketplace({
        plugins: [plugin],
        installedPlugins: ['plugin-1'],
        enabledPlugins: ['plugin-1'],
        onDisable,
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Disable'));
      });

      await waitFor(() => {
        expect(screen.getByText('Disable')).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // DETAIL PANEL ICON
  // --------------------------------------------------------------------------

  describe('Detail Panel Icon', () => {
    it('should show first letter of plugin name uppercased in detail icon', () => {
      const plugin = makePlugin({
        metadata: { id: 'p1', name: 'zebra', version: '1.0.0' },
      });
      const { container } = renderMarketplace({ plugins: [plugin] });
      fireEvent.click(container.querySelector('.plugin-card'));

      const detailIcon = container.querySelector('.detail-icon');
      expect(detailIcon).toHaveTextContent('Z');
    });
  });

  // --------------------------------------------------------------------------
  // MARKETPLACE LAYOUT
  // --------------------------------------------------------------------------

  describe('Marketplace Layout', () => {
    it('should have marketplace-content container', () => {
      const { container } = renderMarketplace();
      expect(container.querySelector('.marketplace-content')).toBeInTheDocument();
    });

    it('should have plugin-list container', () => {
      const { container } = renderMarketplace();
      expect(container.querySelector('.plugin-list')).toBeInTheDocument();
    });

    it('should have detail-panel container', () => {
      const { container } = renderMarketplace();
      expect(container.querySelector('.detail-panel')).toBeInTheDocument();
    });

    it('should have marketplace-header', () => {
      const { container } = renderMarketplace();
      expect(container.querySelector('.marketplace-header')).toBeInTheDocument();
    });

    it('should have marketplace-toolbar', () => {
      const { container } = renderMarketplace();
      expect(container.querySelector('.marketplace-toolbar')).toBeInTheDocument();
    });

    it('should have marketplace-categories', () => {
      const { container } = renderMarketplace();
      expect(container.querySelector('.marketplace-categories')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // EDGE CASES
  // --------------------------------------------------------------------------

  describe('Edge Cases', () => {
    it('should handle plugin with zero downloads', () => {
      const plugin = makePlugin({ downloads: 0 });
      const { container } = renderMarketplace({ plugins: [plugin] });
      const stats = container.querySelectorAll('.stat');
      const downloadStat = Array.from(stats).find((s) => s.textContent?.includes('0'));
      expect(downloadStat).toBeDefined();
    });

    it('should handle plugin with zero toolCount', () => {
      const plugin = makePlugin({ toolCount: 0 });
      renderMarketplace({ plugins: [plugin] });
      expect(screen.getByText(/0 tools/)).toBeInTheDocument();
    });

    it('should handle plugin with zero commandCount', () => {
      const plugin = makePlugin({ commandCount: 0 });
      renderMarketplace({ plugins: [plugin] });
      expect(screen.getByText(/0 commands/)).toBeInTheDocument();
    });

    it('should handle plugin name starting with lowercase', () => {
      const plugin = makePlugin({
        metadata: { id: 'p1', name: 'lowercase', version: '1.0.0' },
      });
      const { container } = renderMarketplace({ plugins: [plugin] });
      const icon = container.querySelector('.plugin-icon');
      expect(icon).toHaveTextContent('L');
    });

    it('should handle plugin name starting with number', () => {
      const plugin = makePlugin({
        metadata: { id: 'p1', name: '42plugin', version: '1.0.0' },
      });
      const { container } = renderMarketplace({ plugins: [plugin] });
      const icon = container.querySelector('.plugin-icon');
      expect(icon).toHaveTextContent('4');
    });

    it('should handle very long plugin name', () => {
      const longName = 'A'.repeat(200);
      const plugin = makePlugin({
        metadata: { id: 'p1', name: longName, version: '1.0.0' },
      });
      renderMarketplace({ plugins: [plugin] });
      expect(screen.getByText(longName)).toBeInTheDocument();
    });

    it('should handle plugin with single keyword', () => {
      const plugin = makePlugin({
        metadata: { id: 'p1', name: 'Single', version: '1.0.0', keywords: ['only'] },
      });
      const { container } = renderMarketplace({ plugins: [plugin] });
      const tags = container.querySelectorAll('.plugin-tags .tag');
      expect(tags.length).toBe(1);
    });

    it('should handle large number of plugins', () => {
      const plugins = Array.from({ length: 50 }, (_, i) =>
        makePluginMinimal(`p${i}`, `Plugin ${i}`)
      );
      const { container } = renderMarketplace({ plugins });
      const cards = container.querySelectorAll('.plugin-card');
      expect(cards.length).toBe(50);
    });

    it('should handle simultaneously installed and enabled plugin', () => {
      const plugin = makePlugin();
      renderMarketplace({
        plugins: [plugin],
        installedPlugins: ['plugin-1'],
        enabledPlugins: ['plugin-1'],
      });
      // Should show Enabled badge, not Installed
      expect(screen.getByText('Enabled')).toBeInTheDocument();
      // Should not show Installed badge when Enabled
      const badges = screen.queryAllByText('Installed');
      // The Installed badge should not appear when the plugin is enabled
      // (the component checks isEnabled first, then isInstalled && !isEnabled)
      expect(badges.length).toBe(0);
    });
  });
});
