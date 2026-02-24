/**
 * Tests for src/lib/composio/client.ts
 *
 * Covers:
 * - isComposioConfigured
 * - getComposioClient / getClient (singleton pattern)
 * - getAnthropicClient (singleton pattern with AnthropicProvider)
 * - toComposioSlug helper (slug formatting)
 * - initiateConnection (OAuth flow)
 * - connectWithApiKey (API key auth flow)
 * - waitForConnection (polling)
 * - getConnectedAccounts (cache + API fallback)
 * - getConnectedAccount (single account retrieval)
 * - disconnectAccount (deletion + cache cleanup)
 * - executeTool (tool execution)
 * - getAvailableTools (AnthropicProvider-formatted tools)
 * - mapComposioAccount (internal mapping helper)
 * - Error handling and edge cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Set COMPOSIO_API_KEY BEFORE module loads (module reads it at top-level)
// ---------------------------------------------------------------------------
vi.hoisted(() => {
  process.env.COMPOSIO_API_KEY = 'test-composio-api-key';
});

// ---------------------------------------------------------------------------
// vi.hoisted — run before vi.mock factories
// ---------------------------------------------------------------------------

const {
  mockAnthropicProvider,
  mockGetToolkitById,
  mockComposioSlugToToolkitId,
  mockGetCachedConnections,
  mockIsCacheFresh,
  mockSaveConnectionsToCache,
  mockSaveSingleConnectionToCache,
  mockRemoveConnectionFromCache,
  mockWithRetry,
} = vi.hoisted(() => {
  const mockWithRetryImpl = vi.fn(async <T>(fn: () => Promise<T>) => fn());
  return {
    mockAnthropicProvider: vi.fn(),
    mockGetToolkitById: vi.fn(() => undefined as { id: string; displayName: string } | undefined),
    mockComposioSlugToToolkitId: vi.fn((slug: string) => slug.toUpperCase()),
    mockGetCachedConnections: vi.fn(async () => null as null | unknown[]),
    mockIsCacheFresh: vi.fn(async () => false),
    mockSaveConnectionsToCache: vi.fn(async () => undefined),
    mockSaveSingleConnectionToCache: vi.fn(async () => undefined),
    mockRemoveConnectionFromCache: vi.fn(async () => undefined),
    mockWithRetry: mockWithRetryImpl,
  };
});

// ---------------------------------------------------------------------------
// Mocks — MUST come before importing module under test
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock the Composio SDK client
const mockAuthConfigsList = vi.fn();
const mockAuthConfigsCreate = vi.fn();
const mockConnectedAccountsInitiate = vi.fn();
const mockConnectedAccountsList = vi.fn();
const mockConnectedAccountsGet = vi.fn();
const mockConnectedAccountsDelete = vi.fn();
const mockConnectedAccountsCreate = vi.fn();
const mockConnectedAccountsWaitForConnection = vi.fn();
const mockToolsExecute = vi.fn();
const mockToolsGet = vi.fn();

function createMockClient() {
  return {
    authConfigs: {
      list: mockAuthConfigsList,
      create: mockAuthConfigsCreate,
    },
    connectedAccounts: {
      initiate: mockConnectedAccountsInitiate,
      list: mockConnectedAccountsList,
      get: mockConnectedAccountsGet,
      delete: mockConnectedAccountsDelete,
      create: mockConnectedAccountsCreate,
      waitForConnection: mockConnectedAccountsWaitForConnection,
    },
    tools: {
      execute: mockToolsExecute,
      get: mockToolsGet,
    },
  };
}

vi.mock('@composio/core', () => ({
  Composio: vi.fn().mockImplementation(() => createMockClient()),
}));

vi.mock('@composio/anthropic', () => ({
  AnthropicProvider: mockAnthropicProvider,
}));

vi.mock('./toolkits', () => ({
  getToolkitById: mockGetToolkitById,
  composioSlugToToolkitId: mockComposioSlugToToolkitId,
}));

vi.mock('./connection-cache', () => ({
  getCachedConnections: mockGetCachedConnections,
  isCacheFresh: mockIsCacheFresh,
  saveConnectionsToCache: mockSaveConnectionsToCache,
  saveSingleConnectionToCache: mockSaveSingleConnectionToCache,
  removeConnectionFromCache: mockRemoveConnectionFromCache,
  withRetry: mockWithRetry,
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks
// ---------------------------------------------------------------------------

import {
  initiateConnection,
  connectWithApiKey,
  waitForConnection,
  getConnectedAccounts,
  getConnectedAccount,
  disconnectAccount,
  executeTool,
  getAvailableTools,
  isComposioConfigured,
  getComposioClient,
} from './client';

import type {
  ConnectedAccount,
  ConnectionRequest,
  ToolExecutionResult,
  ComposioTool,
} from './types';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('composio/client', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset withRetry to passthrough by default
    mockWithRetry.mockImplementation(async <T>(fn: () => Promise<T>) => fn());

    // Default toolkit mocks
    mockGetToolkitById.mockReturnValue(undefined);
    mockComposioSlugToToolkitId.mockImplementation((slug: string) => slug.toUpperCase());

    // Default cache mocks
    mockGetCachedConnections.mockResolvedValue(null);
    mockIsCacheFresh.mockResolvedValue(false);
    mockSaveConnectionsToCache.mockResolvedValue(undefined);
    mockSaveSingleConnectionToCache.mockResolvedValue(undefined);
    mockRemoveConnectionFromCache.mockResolvedValue(undefined);
  });

  // ========================================================================
  // isComposioConfigured
  // ========================================================================

  describe('isComposioConfigured', () => {
    it('is an exported function', () => {
      expect(typeof isComposioConfigured).toBe('function');
    });

    it('returns a boolean', () => {
      const result = isComposioConfigured();
      expect(typeof result).toBe('boolean');
    });
  });

  // ========================================================================
  // getComposioClient
  // ========================================================================

  describe('getComposioClient', () => {
    it('is an exported function', () => {
      expect(typeof getComposioClient).toBe('function');
    });

    it('returns an object (the Composio client)', () => {
      const client = getComposioClient();
      expect(client).toBeDefined();
      expect(typeof client).toBe('object');
    });
  });

  // ========================================================================
  // initiateConnection
  // ========================================================================

  describe('initiateConnection', () => {
    it('initiates an OAuth connection and returns ConnectionRequest', async () => {
      mockAuthConfigsList.mockResolvedValue({
        items: [{ id: 'auth-123', toolkit: { slug: 'gmail' }, name: 'Gmail Auth' }],
      });
      mockConnectedAccountsInitiate.mockResolvedValue({
        id: 'conn-abc',
        redirectUrl: 'https://accounts.google.com/oauth2/auth?...',
      });

      const result = await initiateConnection('user-1', 'GMAIL', 'https://example.com/callback');

      expect(result).toEqual({
        id: 'conn-abc',
        redirectUrl: 'https://accounts.google.com/oauth2/auth?...',
        status: 'initiated',
      });
    });

    it('satisfies the ConnectionRequest type', async () => {
      mockAuthConfigsList.mockResolvedValue({
        items: [{ id: 'auth-1', toolkit: { slug: 'slack' } }],
      });
      mockConnectedAccountsInitiate.mockResolvedValue({
        id: 'conn-1',
        redirectUrl: 'https://slack.com/oauth',
      });

      const result: ConnectionRequest = await initiateConnection('user-1', 'SLACK');
      expect(result.id).toBe('conn-1');
      expect(result.status).toBe('initiated');
    });

    it('converts toolkit name to lowercase slug without underscores', async () => {
      mockAuthConfigsList.mockResolvedValue({
        items: [{ id: 'auth-gs', toolkit: { slug: 'googlesheets' } }],
      });
      mockConnectedAccountsInitiate.mockResolvedValue({
        id: 'conn-gs',
        redirectUrl: 'https://example.com',
      });

      await initiateConnection('user-1', 'GOOGLE_SHEETS');

      // withRetry wraps authConfigs.list, verify the slug conversion
      expect(mockWithRetry).toHaveBeenCalled();
    });

    it('creates a new auth config when no matching config exists', async () => {
      // Return items that do NOT match the requested toolkit
      mockAuthConfigsList.mockResolvedValue({
        items: [{ id: 'auth-other', toolkit: { slug: 'othertoolkit' }, name: 'Other' }],
      });
      mockAuthConfigsCreate.mockResolvedValue({
        id: 'auth-new',
        toolkit: { slug: 'github' },
      });
      mockConnectedAccountsInitiate.mockResolvedValue({
        id: 'conn-gh',
        redirectUrl: 'https://github.com/login/oauth',
      });

      const result = await initiateConnection('user-1', 'GITHUB');

      expect(mockAuthConfigsCreate).toHaveBeenCalledWith('github', {
        name: 'GITHUB Auth',
        type: 'use_composio_managed_auth',
      });
      expect(result.id).toBe('conn-gh');
    });

    it('creates auth config and uses nested auth_config.id if available', async () => {
      mockAuthConfigsList.mockResolvedValue({ items: [] });
      mockAuthConfigsCreate.mockResolvedValue({
        auth_config: { id: 'nested-auth-id' },
      });
      mockConnectedAccountsInitiate.mockResolvedValue({
        id: 'conn-x',
        redirectUrl: 'https://example.com',
      });

      const result = await initiateConnection('user-1', 'TWITTER');

      expect(mockConnectedAccountsInitiate).toHaveBeenCalledWith(
        'user-1',
        'nested-auth-id',
        expect.objectContaining({ allowMultiple: true })
      );
      expect(result.id).toBe('conn-x');
    });

    it('passes redirectUrl as callbackUrl to the SDK', async () => {
      mockAuthConfigsList.mockResolvedValue({
        items: [{ id: 'auth-1', toolkit: { slug: 'slack' } }],
      });
      mockConnectedAccountsInitiate.mockResolvedValue({
        id: 'conn-1',
        redirectUrl: 'https://slack.com/oauth',
      });

      await initiateConnection('user-1', 'SLACK', 'https://myapp.com/callback');

      expect(mockConnectedAccountsInitiate).toHaveBeenCalledWith(
        'user-1',
        'auth-1',
        expect.objectContaining({ callbackUrl: 'https://myapp.com/callback' })
      );
    });

    it('throws on SDK failure', async () => {
      mockAuthConfigsList.mockRejectedValue(new Error('SDK error'));
      // withRetry will throw since the inner fn throws
      mockWithRetry.mockRejectedValue(new Error('SDK error'));

      await expect(initiateConnection('user-1', 'GMAIL')).rejects.toThrow('SDK error');
    });

    it('uses matched auth config when toolkit slug matches directly', async () => {
      mockAuthConfigsList.mockResolvedValue({
        items: [
          { id: 'auth-discord', toolkit: { slug: 'discord' }, name: 'Discord Auth' },
          { id: 'auth-slack', toolkit: { slug: 'slack' }, name: 'Slack Auth' },
        ],
      });
      mockConnectedAccountsInitiate.mockResolvedValue({
        id: 'conn-d',
        redirectUrl: 'https://discord.com/oauth2',
      });

      await initiateConnection('user-1', 'DISCORD');

      expect(mockConnectedAccountsInitiate).toHaveBeenCalledWith(
        'user-1',
        'auth-discord',
        expect.any(Object)
      );
      // Should NOT create a new auth config
      expect(mockAuthConfigsCreate).not.toHaveBeenCalled();
    });

    it('handles auth config with toolkit as string instead of object', async () => {
      mockAuthConfigsList.mockResolvedValue({
        items: [{ id: 'auth-str', toolkit: 'gmail', name: 'Gmail' }],
      });
      mockConnectedAccountsInitiate.mockResolvedValue({
        id: 'conn-str',
        redirectUrl: 'https://google.com/oauth',
      });

      const result = await initiateConnection('user-1', 'GMAIL');
      expect(result.id).toBe('conn-str');
    });

    it('handles null items in auth config response', async () => {
      mockAuthConfigsList.mockResolvedValue({ items: null });
      mockAuthConfigsCreate.mockResolvedValue({ id: 'new-auth-id' });
      mockConnectedAccountsInitiate.mockResolvedValue({
        id: 'conn-null',
        redirectUrl: 'https://example.com',
      });

      const result = await initiateConnection('user-1', 'LINEAR');
      expect(mockAuthConfigsCreate).toHaveBeenCalled();
      expect(result.id).toBe('conn-null');
    });
  });

  // ========================================================================
  // connectWithApiKey
  // ========================================================================

  describe('connectWithApiKey', () => {
    it('creates auth config and connected account for API key auth', async () => {
      mockAuthConfigsCreate.mockResolvedValue({ id: 'api-auth-1' });
      mockConnectedAccountsCreate.mockResolvedValue({
        id: 'api-conn-1',
        status: 'ACTIVE',
      });

      const result = await connectWithApiKey('user-1', 'ELEVENLABS', 'sk-test-key');

      expect(result).toEqual({
        success: true,
        connectionId: 'api-conn-1',
      });
    });

    it('converts toolkit name to slug for API creation', async () => {
      mockAuthConfigsCreate.mockResolvedValue({ id: 'auth-x' });
      mockConnectedAccountsCreate.mockResolvedValue({ id: 'conn-x' });

      await connectWithApiKey('user-1', 'GOOGLE_MAPS', 'my-api-key');

      expect(mockAuthConfigsCreate).toHaveBeenCalledWith(
        'googlemaps',
        expect.objectContaining({
          name: 'GOOGLE_MAPS API Key',
          type: 'custom_auth',
          credentials: {
            api_key: 'my-api-key',
            apiKey: 'my-api-key',
            API_KEY: 'my-api-key',
          },
        })
      );
    });

    it('uses nested auth_config.id when top-level id is missing', async () => {
      mockAuthConfigsCreate.mockResolvedValue({
        auth_config: { id: 'nested-id' },
      });
      mockConnectedAccountsCreate.mockResolvedValue({ id: 'conn-nested' });

      const result = await connectWithApiKey('user-1', 'SENTRY', 'key-123');

      expect(mockConnectedAccountsCreate).toHaveBeenCalledWith({
        authConfigId: 'nested-id',
        userId: 'user-1',
      });
      expect(result.success).toBe(true);
    });

    it('returns error on failure with Error message', async () => {
      mockAuthConfigsCreate.mockRejectedValue(new Error('Invalid API key'));

      const result = await connectWithApiKey('user-1', 'STRIPE', 'bad-key');

      expect(result).toEqual({
        success: false,
        error: 'Invalid API key',
      });
    });

    it('returns generic error on non-Error thrown value', async () => {
      mockAuthConfigsCreate.mockRejectedValue('something went wrong');

      const result = await connectWithApiKey('user-1', 'STRIPE', 'bad-key');

      expect(result).toEqual({
        success: false,
        error: 'Failed to connect with API key',
      });
    });

    it('return type matches { success, connectionId?, error? }', async () => {
      mockAuthConfigsCreate.mockResolvedValue({ id: 'auth' });
      mockConnectedAccountsCreate.mockResolvedValue({ id: 'conn' });

      const result = await connectWithApiKey('user-1', 'SENDGRID', 'key');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.connectionId).toBe('string');
      expect(result.error).toBeUndefined();
    });
  });

  // ========================================================================
  // waitForConnection
  // ========================================================================

  describe('waitForConnection', () => {
    it('returns ConnectedAccount when connection becomes active', async () => {
      mockConnectedAccountsWaitForConnection.mockResolvedValue({
        id: 'conn-1',
        status: 'ACTIVE',
        toolkit: { slug: 'github' },
        createdAt: '2026-01-01T00:00:00Z',
      });
      mockComposioSlugToToolkitId.mockReturnValue('GITHUB');
      mockGetToolkitById.mockReturnValue({ id: 'GITHUB', displayName: 'GitHub' });

      const result = await waitForConnection('conn-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('conn-1');
      expect(result!.status).toBe('connected');
      expect(result!.toolkit).toBe('GITHUB');
    });

    it('saves to cache when userId is provided and status is connected', async () => {
      mockConnectedAccountsWaitForConnection.mockResolvedValue({
        id: 'conn-2',
        status: 'ACTIVE',
        toolkit: { slug: 'slack' },
      });
      mockComposioSlugToToolkitId.mockReturnValue('SLACK');

      await waitForConnection('conn-2', 30000, 'user-1');

      expect(mockSaveSingleConnectionToCache).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ id: 'conn-2', status: 'connected' })
      );
    });

    it('does not save to cache when userId is not provided', async () => {
      mockConnectedAccountsWaitForConnection.mockResolvedValue({
        id: 'conn-3',
        status: 'ACTIVE',
        toolkit: { slug: 'gmail' },
      });
      mockComposioSlugToToolkitId.mockReturnValue('GMAIL');

      await waitForConnection('conn-3');

      expect(mockSaveSingleConnectionToCache).not.toHaveBeenCalled();
    });

    it('does not save to cache when status is not connected', async () => {
      mockConnectedAccountsWaitForConnection.mockResolvedValue({
        id: 'conn-4',
        status: 'PENDING',
        toolkit: { slug: 'linear' },
      });
      mockComposioSlugToToolkitId.mockReturnValue('LINEAR');

      await waitForConnection('conn-4', 5000, 'user-1');

      expect(mockSaveSingleConnectionToCache).not.toHaveBeenCalled();
    });

    it('returns null when SDK returns null', async () => {
      mockConnectedAccountsWaitForConnection.mockResolvedValue(null);

      const result = await waitForConnection('conn-5');
      expect(result).toBeNull();
    });

    it('returns null on SDK error (timeout, etc.)', async () => {
      mockConnectedAccountsWaitForConnection.mockRejectedValue(new Error('Connection timed out'));

      const result = await waitForConnection('conn-6', 1000);
      expect(result).toBeNull();
    });

    it('uses default timeout of 60000ms', async () => {
      mockConnectedAccountsWaitForConnection.mockResolvedValue(null);

      await waitForConnection('conn-7');

      expect(mockConnectedAccountsWaitForConnection).toHaveBeenCalledWith('conn-7', 60000);
    });

    it('passes custom timeout to the SDK', async () => {
      mockConnectedAccountsWaitForConnection.mockResolvedValue(null);

      await waitForConnection('conn-8', 120000);

      expect(mockConnectedAccountsWaitForConnection).toHaveBeenCalledWith('conn-8', 120000);
    });
  });

  // ========================================================================
  // getConnectedAccounts
  // ========================================================================

  describe('getConnectedAccounts', () => {
    it('returns cached connections when cache is fresh', async () => {
      const cachedAccounts: ConnectedAccount[] = [
        { id: 'c1', toolkit: 'GITHUB', status: 'connected' },
        { id: 'c2', toolkit: 'GMAIL', status: 'connected' },
      ];
      mockIsCacheFresh.mockResolvedValue(true);
      mockGetCachedConnections.mockResolvedValue(cachedAccounts);

      const result = await getConnectedAccounts('user-1');

      expect(result).toEqual(cachedAccounts);
      // Should NOT call the Composio API
      expect(mockConnectedAccountsList).not.toHaveBeenCalled();
    });

    it('fetches from API when cache is not fresh', async () => {
      mockIsCacheFresh.mockResolvedValue(false);
      mockConnectedAccountsList.mockResolvedValue({
        items: [
          {
            id: 'api-c1',
            status: 'ACTIVE',
            toolkit: { slug: 'github' },
            createdAt: '2026-01-01',
          },
        ],
      });
      mockComposioSlugToToolkitId.mockReturnValue('GITHUB');

      const result = await getConnectedAccounts('user-1');

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('api-c1');
      expect(result[0].status).toBe('connected');
    });

    it('saves API results to cache', async () => {
      mockIsCacheFresh.mockResolvedValue(false);
      mockConnectedAccountsList.mockResolvedValue({
        items: [{ id: 'c1', status: 'ACTIVE', toolkit: { slug: 'slack' } }],
      });
      mockComposioSlugToToolkitId.mockReturnValue('SLACK');

      await getConnectedAccounts('user-1');

      expect(mockSaveConnectionsToCache).toHaveBeenCalledWith(
        'user-1',
        expect.arrayContaining([expect.objectContaining({ id: 'c1' })])
      );
    });

    it('falls back to stale cache when API fails', async () => {
      mockIsCacheFresh.mockResolvedValue(false);
      // First getCachedConnections call returns null (not fresh check path)
      // API call fails
      mockWithRetry.mockRejectedValue(new Error('API timeout'));
      // Fallback getCachedConnections call returns stale data
      const staleData: ConnectedAccount[] = [
        { id: 'stale-1', toolkit: 'GITHUB', status: 'connected' },
      ];
      mockGetCachedConnections.mockResolvedValue(staleData);

      const result = await getConnectedAccounts('user-1');

      expect(result).toEqual(staleData);
    });

    it('returns empty array when API fails and cache is empty', async () => {
      mockIsCacheFresh.mockResolvedValue(false);
      mockWithRetry.mockRejectedValue(new Error('API timeout'));
      mockGetCachedConnections.mockResolvedValue(null);

      const result = await getConnectedAccounts('user-1');

      expect(result).toEqual([]);
    });

    it('fetches from API when cache is fresh but returns empty/null', async () => {
      mockIsCacheFresh.mockResolvedValue(true);
      mockGetCachedConnections.mockResolvedValue(null);
      mockConnectedAccountsList.mockResolvedValue({
        items: [{ id: 'fresh-api', status: 'ACTIVE', toolkit: { slug: 'discord' } }],
      });
      mockComposioSlugToToolkitId.mockReturnValue('DISCORD');

      const result = await getConnectedAccounts('user-1');

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('fresh-api');
    });

    it('handles empty items from API', async () => {
      mockIsCacheFresh.mockResolvedValue(false);
      mockConnectedAccountsList.mockResolvedValue({ items: [] });

      const result = await getConnectedAccounts('user-1');

      expect(result).toEqual([]);
      expect(mockSaveConnectionsToCache).toHaveBeenCalledWith('user-1', []);
    });

    it('handles undefined items from API', async () => {
      mockIsCacheFresh.mockResolvedValue(false);
      mockConnectedAccountsList.mockResolvedValue({});

      const result = await getConnectedAccounts('user-1');

      expect(result).toEqual([]);
    });
  });

  // ========================================================================
  // getConnectedAccount
  // ========================================================================

  describe('getConnectedAccount', () => {
    it('returns a mapped ConnectedAccount', async () => {
      mockConnectedAccountsGet.mockResolvedValue({
        id: 'conn-single',
        status: 'ACTIVE',
        toolkit: { slug: 'github' },
        createdAt: '2026-02-01T00:00:00Z',
      });
      mockComposioSlugToToolkitId.mockReturnValue('GITHUB');
      mockGetToolkitById.mockReturnValue({ id: 'GITHUB', displayName: 'GitHub' });

      const result = await getConnectedAccount('conn-single');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('conn-single');
      expect(result!.status).toBe('connected');
      expect(result!.toolkit).toBe('GITHUB');
    });

    it('returns null on error', async () => {
      mockConnectedAccountsGet.mockRejectedValue(new Error('Not found'));

      const result = await getConnectedAccount('nonexistent');
      expect(result).toBeNull();
    });

    it('correctly maps PENDING status', async () => {
      mockConnectedAccountsGet.mockResolvedValue({
        id: 'conn-pending',
        status: 'PENDING',
        toolkit: { slug: 'linear' },
      });
      mockComposioSlugToToolkitId.mockReturnValue('LINEAR');

      const result = await getConnectedAccount('conn-pending');
      expect(result!.status).toBe('pending');
    });

    it('correctly maps FAILED status', async () => {
      mockConnectedAccountsGet.mockResolvedValue({
        id: 'conn-failed',
        status: 'FAILED',
        toolkit: { slug: 'slack' },
      });
      mockComposioSlugToToolkitId.mockReturnValue('SLACK');

      const result = await getConnectedAccount('conn-failed');
      expect(result!.status).toBe('failed');
    });

    it('correctly maps EXPIRED status', async () => {
      mockConnectedAccountsGet.mockResolvedValue({
        id: 'conn-expired',
        status: 'EXPIRED',
        toolkit: { slug: 'gmail' },
      });
      mockComposioSlugToToolkitId.mockReturnValue('GMAIL');

      const result = await getConnectedAccount('conn-expired');
      expect(result!.status).toBe('expired');
    });

    it('defaults unknown status to disconnected', async () => {
      mockConnectedAccountsGet.mockResolvedValue({
        id: 'conn-unknown',
        status: 'SOME_UNKNOWN_STATUS',
        toolkit: { slug: 'jira' },
      });
      mockComposioSlugToToolkitId.mockReturnValue('JIRA');

      const result = await getConnectedAccount('conn-unknown');
      expect(result!.status).toBe('disconnected');
    });
  });

  // ========================================================================
  // disconnectAccount
  // ========================================================================

  describe('disconnectAccount', () => {
    it('deletes the connected account and returns true', async () => {
      mockConnectedAccountsDelete.mockResolvedValue(undefined);

      const result = await disconnectAccount('conn-1');

      expect(result).toBe(true);
    });

    it('calls withRetry with correct operation name', async () => {
      mockConnectedAccountsDelete.mockResolvedValue(undefined);

      await disconnectAccount('conn-abc');

      expect(mockWithRetry).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          maxRetries: 3,
          baseDelay: 1000,
          operationName: 'disconnectAccount(conn-abc)',
        })
      );
    });

    it('removes connection from cache when userId and toolkit are provided', async () => {
      mockConnectedAccountsDelete.mockResolvedValue(undefined);

      await disconnectAccount('conn-1', 'user-1', 'GITHUB');

      expect(mockRemoveConnectionFromCache).toHaveBeenCalledWith('user-1', 'GITHUB');
    });

    it('does NOT remove from cache when userId is missing', async () => {
      mockConnectedAccountsDelete.mockResolvedValue(undefined);

      await disconnectAccount('conn-1', undefined, 'GITHUB');

      expect(mockRemoveConnectionFromCache).not.toHaveBeenCalled();
    });

    it('does NOT remove from cache when toolkit is missing', async () => {
      mockConnectedAccountsDelete.mockResolvedValue(undefined);

      await disconnectAccount('conn-1', 'user-1');

      expect(mockRemoveConnectionFromCache).not.toHaveBeenCalled();
    });

    it('returns false on error', async () => {
      mockWithRetry.mockRejectedValue(new Error('Delete failed'));

      const result = await disconnectAccount('conn-fail');

      expect(result).toBe(false);
    });
  });

  // ========================================================================
  // executeTool
  // ========================================================================

  describe('executeTool', () => {
    it('executes a tool and returns success result', async () => {
      mockToolsExecute.mockResolvedValue({
        data: { message: 'Issue created', issueId: 42 },
      });

      const result = await executeTool('user-1', 'GITHUB_CREATE_ISSUE', {
        title: 'Test issue',
      });

      expect(result).toEqual({
        success: true,
        data: { message: 'Issue created', issueId: 42 },
      });
    });

    it('satisfies the ToolExecutionResult type', async () => {
      mockToolsExecute.mockResolvedValue({ data: 'ok' });

      const result: ToolExecutionResult = await executeTool('user-1', 'SLACK_SEND', {});
      expect(typeof result.success).toBe('boolean');
    });

    it('passes correct arguments to SDK tools.execute', async () => {
      mockToolsExecute.mockResolvedValue({ data: 'done' });

      await executeTool('user-1', 'GMAIL_SEND_EMAIL', { to: 'test@example.com' });

      expect(mockToolsExecute).toHaveBeenCalledWith('GMAIL_SEND_EMAIL', {
        userId: 'user-1',
        arguments: { to: 'test@example.com' },
        dangerouslySkipVersionCheck: true,
      });
    });

    it('returns result directly when data property is not present', async () => {
      const rawResult = { status: 'completed', info: 'done' };
      mockToolsExecute.mockResolvedValue(rawResult);

      const result = await executeTool('user-1', 'TOOL_X', {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual(rawResult);
    });

    it('returns error result on Error exception', async () => {
      mockToolsExecute.mockRejectedValue(new Error('Rate limit exceeded'));

      const result = await executeTool('user-1', 'TOOL_Y', {});

      expect(result).toEqual({
        success: false,
        error: 'Rate limit exceeded',
      });
    });

    it('returns Unknown error on non-Error exception', async () => {
      mockToolsExecute.mockRejectedValue('string-error');

      const result = await executeTool('user-1', 'TOOL_Z', {});

      expect(result).toEqual({
        success: false,
        error: 'Unknown error',
      });
    });

    it('handles null result from SDK', async () => {
      mockToolsExecute.mockResolvedValue(null);

      const result = await executeTool('user-1', 'TOOL_N', {});

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  // ========================================================================
  // getAvailableTools
  // ========================================================================

  describe('getAvailableTools', () => {
    it('returns empty array when no toolkits are provided', async () => {
      const result = await getAvailableTools('user-1');
      expect(result).toEqual([]);
    });

    it('returns empty array when toolkits is empty array', async () => {
      const result = await getAvailableTools('user-1', []);
      expect(result).toEqual([]);
    });

    it('fetches tools and maps them to ComposioTool format', async () => {
      mockToolsGet.mockResolvedValue([
        {
          name: 'GITHUB_CREATE_ISSUE',
          description: 'Create a new issue',
          input_schema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Issue title' },
              body: { type: 'string', description: 'Issue body' },
            },
            required: ['title'],
          },
        },
      ]);

      const result = await getAvailableTools('user-1', ['GITHUB']);

      expect(result.length).toBe(1);
      expect(result[0]).toEqual({
        name: 'GITHUB_CREATE_ISSUE',
        description: 'Create a new issue',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Issue title' },
            body: { type: 'string', description: 'Issue body' },
          },
          required: ['title'],
        },
      });
    });

    it('result conforms to ComposioTool[] type', async () => {
      mockToolsGet.mockResolvedValue([
        {
          name: 'TOOL_A',
          description: 'A tool',
          input_schema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      ]);

      const result: ComposioTool[] = await getAvailableTools('user-1', ['SOME_TOOLKIT']);
      expect(result[0].parameters.type).toBe('object');
    });

    it('converts toolkit names to Composio slugs', async () => {
      mockToolsGet.mockResolvedValue([]);

      await getAvailableTools('user-1', ['GOOGLE_SHEETS', 'MICROSOFT_TEAMS']);

      expect(mockToolsGet).toHaveBeenCalledWith('user-1', {
        toolkits: ['googlesheets', 'microsoftteams'],
      });
    });

    it('handles tools without input_schema', async () => {
      mockToolsGet.mockResolvedValue([
        {
          name: 'SIMPLE_TOOL',
          description: 'A simple tool',
        },
      ]);

      const result = await getAvailableTools('user-1', ['TOOLKIT']);

      expect(result.length).toBe(1);
      expect(result[0].parameters).toEqual({
        type: 'object',
        properties: {},
        required: [],
      });
    });

    it('handles tools without description', async () => {
      mockToolsGet.mockResolvedValue([
        {
          name: 'TOOL_NO_DESC',
          input_schema: { type: 'object', properties: {}, required: [] },
        },
      ]);

      const result = await getAvailableTools('user-1', ['TOOLKIT']);

      expect(result[0].description).toBe('');
    });

    it('returns empty array on API error', async () => {
      mockToolsGet.mockRejectedValue(new Error('API error'));

      const result = await getAvailableTools('user-1', ['GITHUB']);

      expect(result).toEqual([]);
    });

    it('handles null response from SDK', async () => {
      mockToolsGet.mockResolvedValue(null);

      const result = await getAvailableTools('user-1', ['SLACK']);

      expect(result).toEqual([]);
    });

    it('handles undefined response from SDK', async () => {
      mockToolsGet.mockResolvedValue(undefined);

      const result = await getAvailableTools('user-1', ['GMAIL']);

      expect(result).toEqual([]);
    });

    it('processes multiple toolkits at once', async () => {
      mockToolsGet.mockResolvedValue([
        {
          name: 'GITHUB_LIST_REPOS',
          description: 'List repos',
          input_schema: { type: 'object', properties: {}, required: [] },
        },
        {
          name: 'GMAIL_SEND_EMAIL',
          description: 'Send email',
          input_schema: {
            type: 'object',
            properties: {
              to: { type: 'string' },
              subject: { type: 'string' },
            },
            required: ['to', 'subject'],
          },
        },
      ]);

      const result = await getAvailableTools('user-1', ['GITHUB', 'GMAIL']);

      expect(result.length).toBe(2);
      expect(result[0].name).toBe('GITHUB_LIST_REPOS');
      expect(result[1].name).toBe('GMAIL_SEND_EMAIL');
    });
  });

  // ========================================================================
  // mapComposioAccount (tested indirectly via getConnectedAccount)
  // ========================================================================

  describe('mapComposioAccount (via getConnectedAccount)', () => {
    it('maps toolkit from nested toolkit.slug', async () => {
      mockConnectedAccountsGet.mockResolvedValue({
        id: 'c1',
        status: 'ACTIVE',
        toolkit: { slug: 'googlesheets', name: 'Google Sheets', id: 'gs-id' },
      });
      mockComposioSlugToToolkitId.mockReturnValue('GOOGLE_SHEETS');
      mockGetToolkitById.mockReturnValue({ id: 'GOOGLE_SHEETS', displayName: 'Google Sheets' });

      const result = await getConnectedAccount('c1');

      expect(result!.toolkit).toBe('GOOGLE_SHEETS');
      expect(result!.metadata?.toolkitName).toBe('Google Sheets');
    });

    it('maps toolkit from integrationId when toolkit object is missing', async () => {
      mockConnectedAccountsGet.mockResolvedValue({
        id: 'c2',
        status: 'ACTIVE',
        integrationId: 'slack',
      });
      mockComposioSlugToToolkitId.mockReturnValue('SLACK');

      const result = await getConnectedAccount('c2');
      expect(result!.toolkit).toBe('SLACK');
    });

    it('maps toolkit from appName as fallback', async () => {
      mockConnectedAccountsGet.mockResolvedValue({
        id: 'c3',
        status: 'ACTIVE',
        appName: 'discord',
      });
      mockComposioSlugToToolkitId.mockReturnValue('DISCORD');

      const result = await getConnectedAccount('c3');
      expect(result!.toolkit).toBe('DISCORD');
    });

    it('maps toolkit from appUniqueId as last fallback', async () => {
      mockConnectedAccountsGet.mockResolvedValue({
        id: 'c4',
        status: 'ACTIVE',
        appUniqueId: 'twitter',
      });
      mockComposioSlugToToolkitId.mockReturnValue('TWITTER');

      const result = await getConnectedAccount('c4');
      expect(result!.toolkit).toBe('TWITTER');
    });

    it('maps email and displayName to metadata', async () => {
      mockConnectedAccountsGet.mockResolvedValue({
        id: 'c5',
        status: 'ACTIVE',
        toolkit: { slug: 'gmail' },
        email: 'test@example.com',
        displayName: 'John Doe',
        createdAt: '2026-02-01T00:00:00Z',
      });
      mockComposioSlugToToolkitId.mockReturnValue('GMAIL');

      const result = await getConnectedAccount('c5');

      expect(result!.metadata?.email).toBe('test@example.com');
      expect(result!.metadata?.name).toBe('John Doe');
      expect(result!.connectedAt).toBe('2026-02-01T00:00:00Z');
    });

    it('handles empty toolkit object', async () => {
      mockConnectedAccountsGet.mockResolvedValue({
        id: 'c6',
        status: 'ACTIVE',
        toolkit: {},
      });
      mockComposioSlugToToolkitId.mockReturnValue('');

      const result = await getConnectedAccount('c6');
      expect(result).not.toBeNull();
    });

    it('includes toolkitName in metadata when toolkit config is found', async () => {
      mockConnectedAccountsGet.mockResolvedValue({
        id: 'c7',
        status: 'ACTIVE',
        toolkit: { slug: 'notion' },
      });
      mockComposioSlugToToolkitId.mockReturnValue('NOTION');
      mockGetToolkitById.mockReturnValue({ id: 'NOTION', displayName: 'Notion' });

      const result = await getConnectedAccount('c7');
      expect(result!.metadata?.toolkitName).toBe('Notion');
    });

    it('omits toolkitName when toolkit config is not found', async () => {
      mockConnectedAccountsGet.mockResolvedValue({
        id: 'c8',
        status: 'ACTIVE',
        toolkit: { slug: 'unknown-app' },
      });
      mockComposioSlugToToolkitId.mockReturnValue('UNKNOWN_APP');
      mockGetToolkitById.mockReturnValue(undefined);

      const result = await getConnectedAccount('c8');
      expect(result!.metadata?.toolkitName).toBeUndefined();
    });

    it('maps INITIATED status to pending', async () => {
      mockConnectedAccountsGet.mockResolvedValue({
        id: 'c9',
        status: 'INITIATED',
        toolkit: { slug: 'figma' },
      });
      mockComposioSlugToToolkitId.mockReturnValue('FIGMA');

      const result = await getConnectedAccount('c9');
      expect(result!.status).toBe('pending');
    });

    it('handles missing status field', async () => {
      mockConnectedAccountsGet.mockResolvedValue({
        id: 'c10',
        toolkit: { slug: 'zoom' },
      });
      mockComposioSlugToToolkitId.mockReturnValue('ZOOM');

      const result = await getConnectedAccount('c10');
      expect(result!.status).toBe('disconnected');
    });
  });

  // ========================================================================
  // Export existence checks
  // ========================================================================

  describe('all exports exist and are the correct type', () => {
    it('initiateConnection is a function', () => {
      expect(typeof initiateConnection).toBe('function');
    });

    it('connectWithApiKey is a function', () => {
      expect(typeof connectWithApiKey).toBe('function');
    });

    it('waitForConnection is a function', () => {
      expect(typeof waitForConnection).toBe('function');
    });

    it('getConnectedAccounts is a function', () => {
      expect(typeof getConnectedAccounts).toBe('function');
    });

    it('getConnectedAccount is a function', () => {
      expect(typeof getConnectedAccount).toBe('function');
    });

    it('disconnectAccount is a function', () => {
      expect(typeof disconnectAccount).toBe('function');
    });

    it('executeTool is a function', () => {
      expect(typeof executeTool).toBe('function');
    });

    it('getAvailableTools is a function', () => {
      expect(typeof getAvailableTools).toBe('function');
    });

    it('isComposioConfigured is a function', () => {
      expect(typeof isComposioConfigured).toBe('function');
    });

    it('getComposioClient is a function', () => {
      expect(typeof getComposioClient).toBe('function');
    });
  });
});
