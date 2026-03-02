// @ts-nocheck
import React from 'react';
globalThis.React = React;
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

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

import CodeLabMCPSettings, {
  CodeLabMCPSettings as NamedCodeLabMCPSettings,
  DEFAULT_MCP_SERVERS,
} from './CodeLabMCPSettings';
import type { MCPServer, MCPTool } from './CodeLabMCPSettings';

// ============================================================================
// HELPERS
// ============================================================================

function createMockServer(overrides: Partial<MCPServer> = {}): MCPServer {
  return {
    id: 'test-server',
    name: 'Test Server',
    description: 'A test MCP server',
    command: 'npx',
    args: ['-y', '@test/server'],
    enabled: false,
    status: 'stopped',
    error: undefined,
    tools: [],
    builtIn: true,
    ...overrides,
  };
}

function createMockTool(overrides: Partial<MCPTool> = {}): MCPTool {
  return {
    name: 'test-tool',
    description: 'A test tool',
    serverId: 'test-server',
    ...overrides,
  };
}

const defaultProps = {
  servers: [] as MCPServer[],
  onServerToggle: vi.fn().mockResolvedValue(undefined),
};

function renderSettings(props: Partial<React.ComponentProps<typeof CodeLabMCPSettings>> = {}) {
  return render(<CodeLabMCPSettings {...defaultProps} {...props} />);
}

// ============================================================================
// TESTS
// ============================================================================

describe('CodeLabMCPSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // EXPORTS
  // ==========================================================================

  describe('Exports', () => {
    it('should export CodeLabMCPSettings as default', () => {
      expect(CodeLabMCPSettings).toBeDefined();
      expect(typeof CodeLabMCPSettings).toBe('function');
    });

    it('should export CodeLabMCPSettings as named export', () => {
      expect(NamedCodeLabMCPSettings).toBeDefined();
      expect(typeof NamedCodeLabMCPSettings).toBe('function');
    });

    it('should export DEFAULT_MCP_SERVERS', () => {
      expect(DEFAULT_MCP_SERVERS).toBeDefined();
      expect(Array.isArray(DEFAULT_MCP_SERVERS)).toBe(true);
    });

    it('should have default and named export reference the same component', () => {
      expect(CodeLabMCPSettings).toBe(NamedCodeLabMCPSettings);
    });
  });

  // ==========================================================================
  // DEFAULT_MCP_SERVERS
  // ==========================================================================

  describe('DEFAULT_MCP_SERVERS', () => {
    it('should contain filesystem server', () => {
      const fs = DEFAULT_MCP_SERVERS.find((s) => s.id === 'filesystem');
      expect(fs).toBeDefined();
      expect(fs!.name).toBe('Filesystem');
      expect(fs!.builtIn).toBe(true);
    });

    it('should contain github server', () => {
      const gh = DEFAULT_MCP_SERVERS.find((s) => s.id === 'github');
      expect(gh).toBeDefined();
      expect(gh!.name).toBe('GitHub');
      expect(gh!.builtIn).toBe(true);
    });

    it('should contain puppeteer server', () => {
      const pup = DEFAULT_MCP_SERVERS.find((s) => s.id === 'puppeteer');
      expect(pup).toBeDefined();
      expect(pup!.name).toBe('Puppeteer');
      expect(pup!.builtIn).toBe(true);
    });

    it('should contain postgres server', () => {
      const pg = DEFAULT_MCP_SERVERS.find((s) => s.id === 'postgres');
      expect(pg).toBeDefined();
      expect(pg!.name).toBe('PostgreSQL');
      expect(pg!.builtIn).toBe(true);
    });

    it('should have all servers disabled by default', () => {
      DEFAULT_MCP_SERVERS.forEach((server) => {
        expect(server.enabled).toBe(false);
      });
    });

    it('should have all servers marked as builtIn', () => {
      DEFAULT_MCP_SERVERS.forEach((server) => {
        expect(server.builtIn).toBe(true);
      });
    });

    it('should have all servers using npx command', () => {
      DEFAULT_MCP_SERVERS.forEach((server) => {
        expect(server.command).toBe('npx');
      });
    });

    it('should have descriptions for all servers', () => {
      DEFAULT_MCP_SERVERS.forEach((server) => {
        expect(server.description).toBeTruthy();
      });
    });
  });

  // ==========================================================================
  // BASIC RENDERING
  // ==========================================================================

  describe('Basic Rendering', () => {
    it('should render the MCP Servers heading', () => {
      renderSettings();
      expect(screen.getByText('MCP Servers')).toBeInTheDocument();
    });

    it('should render the description text', () => {
      renderSettings();
      expect(screen.getByText(/Connect to MCP servers to extend Claude/)).toBeInTheDocument();
    });

    it('should render stats with 0 running and 0 tools when no servers', () => {
      renderSettings();
      const statValues = screen.getAllByText('0');
      expect(statValues).toHaveLength(2);
      expect(screen.getByText('running')).toBeInTheDocument();
      expect(screen.getByText('tools')).toBeInTheDocument();
    });

    it('should apply className prop', () => {
      const { container } = renderSettings({ className: 'custom-class' });
      const root = container.firstChild as HTMLElement;
      expect(root.className).toContain('custom-class');
    });

    it('should apply empty className by default', () => {
      const { container } = renderSettings();
      const root = container.firstChild as HTMLElement;
      expect(root.className).toContain('mcp-settings');
    });
  });

  // ==========================================================================
  // LOADING STATE
  // ==========================================================================

  describe('Loading State', () => {
    it('should show loading state when isLoading is true', () => {
      renderSettings({ isLoading: true });
      expect(screen.getByText('Loading servers...')).toBeInTheDocument();
    });

    it('should not show loading state when isLoading is false', () => {
      renderSettings({ isLoading: false });
      expect(screen.queryByText('Loading servers...')).not.toBeInTheDocument();
    });

    it('should not render server cards when loading', () => {
      const servers = [createMockServer({ name: 'My Server' })];
      renderSettings({ servers, isLoading: true });
      expect(screen.queryByText('My Server')).not.toBeInTheDocument();
    });

    it('should default isLoading to false', () => {
      renderSettings();
      expect(screen.queryByText('Loading servers...')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // EMPTY STATE
  // ==========================================================================

  describe('Empty State', () => {
    it('should show empty state when servers array is empty', () => {
      renderSettings({ servers: [] });
      expect(screen.getByText('No MCP servers configured')).toBeInTheDocument();
    });

    it('should show hint text in empty state', () => {
      renderSettings({ servers: [] });
      expect(screen.getByText(/Add a server to extend Claude/)).toBeInTheDocument();
    });

    it('should not show empty state when servers exist', () => {
      const servers = [createMockServer()];
      renderSettings({ servers });
      expect(screen.queryByText('No MCP servers configured')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // SERVER CARD RENDERING
  // ==========================================================================

  describe('Server Card Rendering', () => {
    it('should render server name', () => {
      const servers = [createMockServer({ name: 'My MCP Server' })];
      renderSettings({ servers });
      expect(screen.getByText('My MCP Server')).toBeInTheDocument();
    });

    it('should render server description', () => {
      const servers = [createMockServer({ description: 'A great server' })];
      renderSettings({ servers });
      expect(screen.getByText('A great server')).toBeInTheDocument();
    });

    it('should not render description paragraph when description is undefined', () => {
      const servers = [createMockServer({ description: undefined })];
      renderSettings({ servers });
      // The server name should exist but no description paragraph
      expect(screen.getByText('Test Server')).toBeInTheDocument();
    });

    it('should render error message when server has error', () => {
      const servers = [createMockServer({ error: 'Connection refused' })];
      renderSettings({ servers });
      expect(screen.getByText('Connection refused')).toBeInTheDocument();
    });

    it('should not render error when no error exists', () => {
      const servers = [createMockServer({ error: undefined })];
      renderSettings({ servers });
      expect(screen.queryByText('Connection refused')).not.toBeInTheDocument();
    });

    it('should render multiple server cards', () => {
      const servers = [
        createMockServer({ id: 's1', name: 'Server One' }),
        createMockServer({ id: 's2', name: 'Server Two' }),
        createMockServer({ id: 's3', name: 'Server Three' }),
      ];
      renderSettings({ servers });
      expect(screen.getByText('Server One')).toBeInTheDocument();
      expect(screen.getByText('Server Two')).toBeInTheDocument();
      expect(screen.getByText('Server Three')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // STATUS BADGE
  // ==========================================================================

  describe('Status Badge', () => {
    it('should show "Running" badge for running status', () => {
      const servers = [createMockServer({ status: 'running' })];
      renderSettings({ servers });
      expect(screen.getByText('Running')).toBeInTheDocument();
    });

    it('should show "Stopped" badge for stopped status', () => {
      const servers = [createMockServer({ status: 'stopped' })];
      renderSettings({ servers });
      expect(screen.getByText('Stopped')).toBeInTheDocument();
    });

    it('should show "Starting..." badge for starting status', () => {
      const servers = [createMockServer({ status: 'starting' })];
      renderSettings({ servers });
      expect(screen.getByText('Starting...')).toBeInTheDocument();
    });

    it('should show "Error" badge for error status', () => {
      const servers = [createMockServer({ status: 'error' })];
      renderSettings({ servers });
      expect(screen.getByText('Error')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // TOGGLE SWITCH
  // ==========================================================================

  describe('Toggle Switch', () => {
    it('should render toggle with correct aria-checked for enabled server', () => {
      const servers = [createMockServer({ enabled: true })];
      renderSettings({ servers });
      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    });

    it('should render toggle with correct aria-checked for disabled server', () => {
      const servers = [createMockServer({ enabled: false })];
      renderSettings({ servers });
      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    });

    it('should call onServerToggle when toggle is clicked', async () => {
      const onServerToggle = vi.fn().mockResolvedValue(undefined);
      const servers = [createMockServer({ id: 'fs', enabled: false })];
      renderSettings({ servers, onServerToggle });

      const toggle = screen.getByRole('switch');
      await act(async () => {
        fireEvent.click(toggle);
      });

      expect(onServerToggle).toHaveBeenCalledWith('fs', true);
    });

    it('should call onServerToggle with false when disabling an enabled server', async () => {
      const onServerToggle = vi.fn().mockResolvedValue(undefined);
      const servers = [createMockServer({ id: 'fs', enabled: true })];
      renderSettings({ servers, onServerToggle });

      const toggle = screen.getByRole('switch');
      await act(async () => {
        fireEvent.click(toggle);
      });

      expect(onServerToggle).toHaveBeenCalledWith('fs', false);
    });

    it('should disable toggle when server status is starting', () => {
      const servers = [createMockServer({ status: 'starting' })];
      renderSettings({ servers });
      const toggle = screen.getByRole('switch');
      expect(toggle).toBeDisabled();
    });

    it('should not be disabled for stopped status', () => {
      const servers = [createMockServer({ status: 'stopped' })];
      renderSettings({ servers });
      const toggle = screen.getByRole('switch');
      expect(toggle).not.toBeDisabled();
    });

    it('should not be disabled for running status', () => {
      const servers = [createMockServer({ status: 'running' })];
      renderSettings({ servers });
      const toggle = screen.getByRole('switch');
      expect(toggle).not.toBeDisabled();
    });

    it('should not be disabled for error status', () => {
      const servers = [createMockServer({ status: 'error' })];
      renderSettings({ servers });
      const toggle = screen.getByRole('switch');
      expect(toggle).not.toBeDisabled();
    });
  });

  // ==========================================================================
  // STATS
  // ==========================================================================

  describe('Stats Display', () => {
    it('should show correct running count', () => {
      const servers = [
        createMockServer({ id: 's1', status: 'running' }),
        createMockServer({ id: 's2', status: 'stopped' }),
        createMockServer({ id: 's3', status: 'running' }),
      ];
      renderSettings({ servers });
      // With 2 running servers, we expect a '2' in the stats
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should show correct tool count', () => {
      const servers = [
        createMockServer({
          id: 's1',
          tools: [createMockTool({ name: 't1' }), createMockTool({ name: 't2' })],
        }),
        createMockServer({
          id: 's2',
          tools: [createMockTool({ name: 't3' })],
        }),
      ];
      renderSettings({ servers });
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should show 0 running and 0 tools for empty servers', () => {
      renderSettings({ servers: [] });
      // Both stats show 0
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBe(2);
    });

    it('should count only running servers, not starting or error', () => {
      const servers = [
        createMockServer({ id: 's1', status: 'running' }),
        createMockServer({ id: 's2', status: 'starting' }),
        createMockServer({ id: 's3', status: 'error' }),
        createMockServer({ id: 's4', status: 'stopped' }),
      ];
      renderSettings({ servers });
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // TOOLS EXPANSION
  // ==========================================================================

  describe('Tools Expansion', () => {
    it('should not show expand button when server has no tools', () => {
      const servers = [createMockServer({ tools: [] })];
      renderSettings({ servers });
      const expandBtns = screen.queryAllByRole('button');
      // Only toggle switch should exist, no expand button
      const expandButton = expandBtns.find((btn) => btn.classList.contains('expand-btn'));
      expect(expandButton).toBeUndefined();
    });

    it('should show expand button when server has tools', () => {
      const servers = [
        createMockServer({
          tools: [createMockTool({ name: 'my-tool' })],
        }),
      ];
      renderSettings({ servers });
      // There should be an expand button
      const buttons = screen.getAllByRole('button');
      const expandBtn = buttons.find((btn) => btn.classList.contains('expand-btn'));
      expect(expandBtn).toBeDefined();
    });

    it('should not show tools list initially', () => {
      const servers = [
        createMockServer({
          tools: [createMockTool({ name: 'my-tool', description: 'My tool desc' })],
        }),
      ];
      renderSettings({ servers });
      expect(screen.queryByText('my-tool')).not.toBeInTheDocument();
    });

    it('should show tools list after clicking expand button', () => {
      const servers = [
        createMockServer({
          tools: [createMockTool({ name: 'read_file', description: 'Read a file' })],
        }),
      ];
      renderSettings({ servers });
      const buttons = screen.getAllByRole('button');
      const expandBtn = buttons.find((btn) => btn.classList.contains('expand-btn'));
      fireEvent.click(expandBtn!);
      expect(screen.getByText('read_file')).toBeInTheDocument();
      expect(screen.getByText('Read a file')).toBeInTheDocument();
    });

    it('should show Available Tools header with count when expanded', () => {
      const servers = [
        createMockServer({
          tools: [createMockTool({ name: 'tool1' }), createMockTool({ name: 'tool2' })],
        }),
      ];
      renderSettings({ servers });
      const buttons = screen.getAllByRole('button');
      const expandBtn = buttons.find((btn) => btn.classList.contains('expand-btn'));
      fireEvent.click(expandBtn!);
      expect(screen.getByText('Available Tools (2)')).toBeInTheDocument();
    });

    it('should hide tools list when clicking expand again (toggle)', () => {
      const servers = [
        createMockServer({
          tools: [createMockTool({ name: 'togglable-tool' })],
        }),
      ];
      renderSettings({ servers });
      const buttons = screen.getAllByRole('button');
      const expandBtn = buttons.find((btn) => btn.classList.contains('expand-btn'));

      // Expand
      fireEvent.click(expandBtn!);
      expect(screen.getByText('togglable-tool')).toBeInTheDocument();

      // Collapse
      fireEvent.click(expandBtn!);
      expect(screen.queryByText('togglable-tool')).not.toBeInTheDocument();
    });

    it('should render all tools when expanded', () => {
      const tools = [
        createMockTool({ name: 'tool-a', description: 'Desc A' }),
        createMockTool({ name: 'tool-b', description: 'Desc B' }),
        createMockTool({ name: 'tool-c', description: 'Desc C' }),
      ];
      const servers = [createMockServer({ tools })];
      renderSettings({ servers });
      const buttons = screen.getAllByRole('button');
      const expandBtn = buttons.find((btn) => btn.classList.contains('expand-btn'));
      fireEvent.click(expandBtn!);

      expect(screen.getByText('tool-a')).toBeInTheDocument();
      expect(screen.getByText('tool-b')).toBeInTheDocument();
      expect(screen.getByText('tool-c')).toBeInTheDocument();
      expect(screen.getByText('Desc A')).toBeInTheDocument();
      expect(screen.getByText('Desc B')).toBeInTheDocument();
      expect(screen.getByText('Desc C')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // REMOVE SERVER
  // ==========================================================================

  describe('Remove Server', () => {
    it('should not show remove button for built-in servers', () => {
      const onServerRemove = vi.fn();
      const servers = [createMockServer({ builtIn: true })];
      renderSettings({ servers, onServerRemove });
      const removeBtn = screen.queryByTitle('Remove server');
      expect(removeBtn).not.toBeInTheDocument();
    });

    it('should show remove button for non-built-in servers when onServerRemove provided', () => {
      const onServerRemove = vi.fn();
      const servers = [createMockServer({ builtIn: false })];
      renderSettings({ servers, onServerRemove });
      const removeBtn = screen.getByTitle('Remove server');
      expect(removeBtn).toBeInTheDocument();
    });

    it('should not show remove button when onServerRemove is not provided', () => {
      const servers = [createMockServer({ builtIn: false })];
      renderSettings({ servers });
      const removeBtn = screen.queryByTitle('Remove server');
      expect(removeBtn).not.toBeInTheDocument();
    });

    it('should call onServerRemove with serverId when remove button is clicked', () => {
      const onServerRemove = vi.fn();
      const servers = [createMockServer({ id: 'custom-1', builtIn: false })];
      renderSettings({ servers, onServerRemove });

      const removeBtn = screen.getByTitle('Remove server');
      fireEvent.click(removeBtn);
      expect(onServerRemove).toHaveBeenCalledWith('custom-1');
    });
  });

  // ==========================================================================
  // ADD SERVER BUTTON
  // ==========================================================================

  describe('Add Server Button', () => {
    it('should show add button when onServerAdd is provided', () => {
      renderSettings({ onServerAdd: vi.fn() });
      expect(screen.getByText('Add Custom Server')).toBeInTheDocument();
    });

    it('should not show add button when onServerAdd is not provided', () => {
      renderSettings();
      expect(screen.queryByText('Add Custom Server')).not.toBeInTheDocument();
    });

    it('should open modal when add button is clicked', () => {
      renderSettings({ onServerAdd: vi.fn() });
      fireEvent.click(screen.getByText('Add Custom Server'));
      expect(screen.getByText('Add MCP Server')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // ADD SERVER MODAL
  // ==========================================================================

  describe('Add Server Modal', () => {
    function openModal(props: Partial<React.ComponentProps<typeof CodeLabMCPSettings>> = {}) {
      const onServerAdd = vi.fn().mockResolvedValue(undefined);
      const result = renderSettings({ onServerAdd, ...props });
      fireEvent.click(screen.getByText('Add Custom Server'));
      return { ...result, onServerAdd };
    }

    it('should render modal title', () => {
      openModal();
      expect(screen.getByText('Add MCP Server')).toBeInTheDocument();
    });

    it('should render Name input field', () => {
      openModal();
      expect(screen.getByPlaceholderText('My Custom Server')).toBeInTheDocument();
    });

    it('should render Command input field', () => {
      openModal();
      expect(screen.getByPlaceholderText('npx')).toBeInTheDocument();
    });

    it('should render Arguments input field', () => {
      openModal();
      expect(
        screen.getByPlaceholderText('-y @modelcontextprotocol/server-name')
      ).toBeInTheDocument();
    });

    it('should render Description input field', () => {
      openModal();
      expect(screen.getByPlaceholderText('What does this server do?')).toBeInTheDocument();
    });

    it('should render hint text for arguments', () => {
      openModal();
      expect(screen.getByText('Space-separated arguments')).toBeInTheDocument();
    });

    it('should render Cancel button', () => {
      openModal();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should render Add Server submit button', () => {
      openModal();
      expect(screen.getByText('Add Server')).toBeInTheDocument();
    });

    it('should have Add Server button disabled initially (empty name)', () => {
      openModal();
      const submitBtn = screen.getByText('Add Server');
      expect(submitBtn).toBeDisabled();
    });

    it('should have default command value of "npx"', () => {
      openModal();
      const commandInput = screen.getByPlaceholderText('npx') as HTMLInputElement;
      expect(commandInput.value).toBe('npx');
    });

    it('should enable Add Server button when name and command are filled', () => {
      openModal();
      const nameInput = screen.getByPlaceholderText('My Custom Server');
      fireEvent.change(nameInput, { target: { value: 'My Server' } });
      const submitBtn = screen.getByText('Add Server');
      expect(submitBtn).not.toBeDisabled();
    });

    it('should keep button disabled when only name is whitespace', () => {
      openModal();
      const nameInput = screen.getByPlaceholderText('My Custom Server');
      fireEvent.change(nameInput, { target: { value: '   ' } });
      const submitBtn = screen.getByText('Add Server');
      expect(submitBtn).toBeDisabled();
    });

    it('should keep button disabled when command is cleared', () => {
      openModal();
      const nameInput = screen.getByPlaceholderText('My Custom Server');
      const commandInput = screen.getByPlaceholderText('npx');
      fireEvent.change(nameInput, { target: { value: 'My Server' } });
      fireEvent.change(commandInput, { target: { value: '' } });
      const submitBtn = screen.getByText('Add Server');
      expect(submitBtn).toBeDisabled();
    });

    it('should close modal when Cancel is clicked', () => {
      openModal();
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByText('Add MCP Server')).not.toBeInTheDocument();
    });

    it('should close modal when overlay is clicked', () => {
      openModal();
      // The modal-overlay is the outermost div
      const overlay = screen.getByText('Add MCP Server').closest('.modal-content')!.parentElement!;
      fireEvent.click(overlay);
      expect(screen.queryByText('Add MCP Server')).not.toBeInTheDocument();
    });

    it('should not close modal when modal content is clicked', () => {
      openModal();
      const content = screen.getByText('Add MCP Server').closest('.modal-content')!;
      fireEvent.click(content);
      expect(screen.getByText('Add MCP Server')).toBeInTheDocument();
    });

    it('should call onServerAdd with correct data on submit', async () => {
      const { onServerAdd } = openModal();
      const nameInput = screen.getByPlaceholderText('My Custom Server');
      const argsInput = screen.getByPlaceholderText('-y @modelcontextprotocol/server-name');
      const descInput = screen.getByPlaceholderText('What does this server do?');

      fireEvent.change(nameInput, { target: { value: 'Custom FS' } });
      fireEvent.change(argsInput, { target: { value: '-y @my/server' } });
      fireEvent.change(descInput, { target: { value: 'My custom server' } });

      const form = screen.getByText('Add Server').closest('form')!;
      await act(async () => {
        fireEvent.submit(form);
      });

      expect(onServerAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Custom FS',
          command: 'npx',
          args: ['-y', '@my/server'],
          description: 'My custom server',
          enabled: false,
        })
      );
    });

    it('should generate id with custom- prefix', async () => {
      const { onServerAdd } = openModal();
      const nameInput = screen.getByPlaceholderText('My Custom Server');
      fireEvent.change(nameInput, { target: { value: 'My Server' } });

      const form = screen.getByText('Add Server').closest('form')!;
      await act(async () => {
        fireEvent.submit(form);
      });

      expect(onServerAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^custom-\d+$/),
        })
      );
    });

    it('should not submit when name is empty', async () => {
      const { onServerAdd } = openModal();
      const form = screen.getByText('Add Server').closest('form')!;
      await act(async () => {
        fireEvent.submit(form);
      });
      expect(onServerAdd).not.toHaveBeenCalled();
    });

    it('should set description to undefined when empty', async () => {
      const { onServerAdd } = openModal();
      const nameInput = screen.getByPlaceholderText('My Custom Server');
      fireEvent.change(nameInput, { target: { value: 'Server' } });

      const form = screen.getByText('Add Server').closest('form')!;
      await act(async () => {
        fireEvent.submit(form);
      });

      expect(onServerAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          description: undefined,
        })
      );
    });

    it('should set args to undefined when empty', async () => {
      const { onServerAdd } = openModal();
      const nameInput = screen.getByPlaceholderText('My Custom Server');
      fireEvent.change(nameInput, { target: { value: 'Server' } });

      const form = screen.getByText('Add Server').closest('form')!;
      await act(async () => {
        fireEvent.submit(form);
      });

      expect(onServerAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          args: undefined,
        })
      );
    });

    it('should close modal after successful submit', async () => {
      openModal();
      const nameInput = screen.getByPlaceholderText('My Custom Server');
      fireEvent.change(nameInput, { target: { value: 'Server' } });

      const form = screen.getByText('Add Server').closest('form')!;
      await act(async () => {
        fireEvent.submit(form);
      });

      expect(screen.queryByText('Add MCP Server')).not.toBeInTheDocument();
    });

    it('should trim whitespace from name on submit', async () => {
      const { onServerAdd } = openModal();
      const nameInput = screen.getByPlaceholderText('My Custom Server');
      fireEvent.change(nameInput, { target: { value: '  My Server  ' } });

      const form = screen.getByText('Add Server').closest('form')!;
      await act(async () => {
        fireEvent.submit(form);
      });

      expect(onServerAdd).toHaveBeenCalledWith(expect.objectContaining({ name: 'My Server' }));
    });

    it('should trim whitespace from command on submit', async () => {
      const { onServerAdd } = openModal();
      const nameInput = screen.getByPlaceholderText('My Custom Server');
      const commandInput = screen.getByPlaceholderText('npx');
      fireEvent.change(nameInput, { target: { value: 'Server' } });
      fireEvent.change(commandInput, { target: { value: '  node  ' } });

      const form = screen.getByText('Add Server').closest('form')!;
      await act(async () => {
        fireEvent.submit(form);
      });

      expect(onServerAdd).toHaveBeenCalledWith(expect.objectContaining({ command: 'node' }));
    });

    it('should render labels for all form fields', () => {
      openModal();
      expect(screen.getByText('Name *')).toBeInTheDocument();
      expect(screen.getByText('Command *')).toBeInTheDocument();
      expect(screen.getByText('Arguments')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // SERVER TOGGLE BEHAVIOR
  // ==========================================================================

  describe('Server Toggle Behavior', () => {
    it('should handle toggle for multiple servers independently', async () => {
      const onServerToggle = vi.fn().mockResolvedValue(undefined);
      const servers = [
        createMockServer({ id: 'a', name: 'Server A', enabled: false }),
        createMockServer({ id: 'b', name: 'Server B', enabled: true }),
      ];
      renderSettings({ servers, onServerToggle });

      const toggles = screen.getAllByRole('switch');
      await act(async () => {
        fireEvent.click(toggles[0]);
      });

      expect(onServerToggle).toHaveBeenCalledWith('a', true);
      expect(onServerToggle).not.toHaveBeenCalledWith('b', expect.anything());
    });

    it('should handle slow toggle that eventually resolves', async () => {
      let resolveToggle: () => void;
      const togglePromise = new Promise<void>((resolve) => {
        resolveToggle = resolve;
      });
      const onServerToggle = vi.fn().mockReturnValue(togglePromise);
      const servers = [createMockServer({ id: 'slow-server' })];
      renderSettings({ servers, onServerToggle });

      const toggle = screen.getByRole('switch');
      await act(async () => {
        fireEvent.click(toggle);
      });
      expect(onServerToggle).toHaveBeenCalled();

      // Resolve it
      await act(async () => {
        resolveToggle!();
      });
    });
  });

  // ==========================================================================
  // CONDITIONAL RENDERING
  // ==========================================================================

  describe('Conditional Rendering', () => {
    it('should prioritize loading state over empty state', () => {
      renderSettings({ servers: [], isLoading: true });
      expect(screen.getByText('Loading servers...')).toBeInTheDocument();
      expect(screen.queryByText('No MCP servers configured')).not.toBeInTheDocument();
    });

    it('should prioritize loading state over server list', () => {
      const servers = [createMockServer({ name: 'Hidden Server' })];
      renderSettings({ servers, isLoading: true });
      expect(screen.getByText('Loading servers...')).toBeInTheDocument();
      expect(screen.queryByText('Hidden Server')).not.toBeInTheDocument();
    });

    it('should show add button alongside loading state', () => {
      renderSettings({ isLoading: true, onServerAdd: vi.fn() });
      expect(screen.getByText('Loading servers...')).toBeInTheDocument();
      expect(screen.getByText('Add Custom Server')).toBeInTheDocument();
    });

    it('should show add button alongside empty state', () => {
      renderSettings({ servers: [], onServerAdd: vi.fn() });
      expect(screen.getByText('No MCP servers configured')).toBeInTheDocument();
      expect(screen.getByText('Add Custom Server')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle server with empty name', () => {
      const servers = [createMockServer({ name: '' })];
      renderSettings({ servers });
      // Should still render the card (toggle should exist)
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('should handle server with very long name', () => {
      const longName = 'A'.repeat(200);
      const servers = [createMockServer({ name: longName })];
      renderSettings({ servers });
      expect(screen.getByText(longName)).toBeInTheDocument();
    });

    it('should handle server with many tools', () => {
      const tools = Array.from({ length: 50 }, (_, i) =>
        createMockTool({ name: `tool-${i}`, description: `Desc ${i}` })
      );
      const servers = [createMockServer({ tools })];
      renderSettings({ servers });

      // Expand tools
      const buttons = screen.getAllByRole('button');
      const expandBtn = buttons.find((btn) => btn.classList.contains('expand-btn'));
      fireEvent.click(expandBtn!);

      expect(screen.getByText('Available Tools (50)')).toBeInTheDocument();
      expect(screen.getByText('tool-0')).toBeInTheDocument();
      expect(screen.getByText('tool-49')).toBeInTheDocument();
    });

    it('should handle server with empty string error', () => {
      const servers = [createMockServer({ error: '' })];
      renderSettings({ servers });
      // Empty error string is falsy, so no error paragraph should render
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('should handle large number of servers', () => {
      const servers = Array.from({ length: 20 }, (_, i) =>
        createMockServer({ id: `s${i}`, name: `Server ${i}` })
      );
      renderSettings({ servers });
      expect(screen.getByText('Server 0')).toBeInTheDocument();
      expect(screen.getByText('Server 19')).toBeInTheDocument();
    });

    it('should calculate tool count across multiple servers correctly', () => {
      const servers = [
        createMockServer({
          id: 's1',
          status: 'running',
          tools: [createMockTool({ name: 't1' }), createMockTool({ name: 't2' })],
        }),
        createMockServer({
          id: 's2',
          status: 'stopped',
          tools: [
            createMockTool({ name: 't3' }),
            createMockTool({ name: 't4' }),
            createMockTool({ name: 't5' }),
          ],
        }),
      ];
      renderSettings({ servers });
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should handle className with multiple classes', () => {
      const { container } = renderSettings({ className: 'class-a class-b class-c' });
      const root = container.firstChild as HTMLElement;
      expect(root.className).toContain('class-a');
      expect(root.className).toContain('class-b');
      expect(root.className).toContain('class-c');
    });

    it('should handle onServerAdd that resolves slowly', async () => {
      let resolveAdd: () => void;
      const addPromise = new Promise<void>((resolve) => {
        resolveAdd = resolve;
      });
      const onServerAdd = vi.fn().mockReturnValue(addPromise);
      renderSettings({ onServerAdd });

      fireEvent.click(screen.getByText('Add Custom Server'));

      const nameInput = screen.getByPlaceholderText('My Custom Server');
      fireEvent.change(nameInput, { target: { value: 'Slow Server' } });

      const form = screen.getByText('Add Server').closest('form')!;
      await act(async () => {
        fireEvent.submit(form);
      });

      expect(onServerAdd).toHaveBeenCalled();

      // Resolve it
      await act(async () => {
        resolveAdd!();
      });
    });
  });

  // ==========================================================================
  // MIXED SCENARIOS
  // ==========================================================================

  describe('Mixed Scenarios', () => {
    it('should render mix of built-in and custom servers', () => {
      const onServerRemove = vi.fn();
      const servers = [
        createMockServer({ id: 'built-in', name: 'Built In', builtIn: true }),
        createMockServer({ id: 'custom', name: 'Custom', builtIn: false }),
      ];
      renderSettings({ servers, onServerRemove });

      expect(screen.getByText('Built In')).toBeInTheDocument();
      expect(screen.getByText('Custom')).toBeInTheDocument();

      // Only custom server should have remove button
      const removeBtns = screen.getAllByTitle('Remove server');
      expect(removeBtns).toHaveLength(1);
    });

    it('should render mix of server statuses', () => {
      const servers = [
        createMockServer({ id: 's1', status: 'running' }),
        createMockServer({ id: 's2', status: 'stopped' }),
        createMockServer({ id: 's3', status: 'error' }),
        createMockServer({ id: 's4', status: 'starting' }),
      ];
      renderSettings({ servers });

      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('Stopped')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Starting...')).toBeInTheDocument();
    });

    it('should handle server with both error and description', () => {
      const servers = [
        createMockServer({
          description: 'Good server',
          error: 'Bad connection',
          status: 'error',
        }),
      ];
      renderSettings({ servers });
      expect(screen.getByText('Good server')).toBeInTheDocument();
      expect(screen.getByText('Bad connection')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('should handle servers with tools of different counts', () => {
      const servers = [
        createMockServer({ id: 's1', tools: [] }),
        createMockServer({
          id: 's2',
          tools: [createMockTool({ name: 'only-tool' })],
        }),
      ];
      renderSettings({ servers });

      // Only server with tools should have expand button
      const buttons = screen.getAllByRole('button');
      const expandBtns = buttons.filter((btn) => btn.classList.contains('expand-btn'));
      expect(expandBtns).toHaveLength(1);
    });

    it('should allow opening and closing modal multiple times', () => {
      renderSettings({ onServerAdd: vi.fn() });

      // Open
      fireEvent.click(screen.getByText('Add Custom Server'));
      expect(screen.getByText('Add MCP Server')).toBeInTheDocument();

      // Close
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByText('Add MCP Server')).not.toBeInTheDocument();

      // Open again
      fireEvent.click(screen.getByText('Add Custom Server'));
      expect(screen.getByText('Add MCP Server')).toBeInTheDocument();

      // Close again
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByText('Add MCP Server')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // FORM INPUT HANDLING
  // ==========================================================================

  describe('Form Input Handling', () => {
    function openModalAndGetInputs() {
      const onServerAdd = vi.fn().mockResolvedValue(undefined);
      renderSettings({ onServerAdd });
      fireEvent.click(screen.getByText('Add Custom Server'));
      return {
        onServerAdd,
        nameInput: screen.getByPlaceholderText('My Custom Server') as HTMLInputElement,
        commandInput: screen.getByPlaceholderText('npx') as HTMLInputElement,
        argsInput: screen.getByPlaceholderText(
          '-y @modelcontextprotocol/server-name'
        ) as HTMLInputElement,
        descInput: screen.getByPlaceholderText('What does this server do?') as HTMLInputElement,
      };
    }

    it('should update name input value on change', () => {
      const { nameInput } = openModalAndGetInputs();
      fireEvent.change(nameInput, { target: { value: 'New Name' } });
      expect(nameInput.value).toBe('New Name');
    });

    it('should update command input value on change', () => {
      const { commandInput } = openModalAndGetInputs();
      fireEvent.change(commandInput, { target: { value: 'node' } });
      expect(commandInput.value).toBe('node');
    });

    it('should update args input value on change', () => {
      const { argsInput } = openModalAndGetInputs();
      fireEvent.change(argsInput, { target: { value: '--flag value' } });
      expect(argsInput.value).toBe('--flag value');
    });

    it('should update description input value on change', () => {
      const { descInput } = openModalAndGetInputs();
      fireEvent.change(descInput, { target: { value: 'My description' } });
      expect(descInput.value).toBe('My description');
    });

    it('should split args by space on submit', async () => {
      const { onServerAdd, nameInput, argsInput } = openModalAndGetInputs();
      fireEvent.change(nameInput, { target: { value: 'Server' } });
      fireEvent.change(argsInput, { target: { value: '-y @my/server --port 3000' } });

      const form = screen.getByText('Add Server').closest('form')!;
      await act(async () => {
        fireEvent.submit(form);
      });

      expect(onServerAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          args: ['-y', '@my/server', '--port', '3000'],
        })
      );
    });
  });
});
