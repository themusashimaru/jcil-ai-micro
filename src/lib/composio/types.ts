/**
 * COMPOSIO INTEGRATION - Types
 * ============================
 *
 * TypeScript types for Composio integration.
 * Handles 150+ app integrations via unified auth.
 */

// ============================================================================
// TOOLKIT CONFIGURATION
// ============================================================================

export type ToolkitCategory =
  | 'communication'
  | 'productivity'
  | 'social'
  | 'development'
  | 'crm'
  | 'finance'
  | 'calendar'
  | 'storage'
  | 'analytics'
  | 'marketing'
  | 'ecommerce'
  | 'hr'
  | 'support'
  | 'automation'
  | 'media'
  | 'education'
  | 'travel';

export interface ToolkitConfig {
  id: string; // Composio toolkit ID (e.g., 'GMAIL', 'SLACK')
  displayName: string; // Human-readable name
  description: string; // What it does
  icon: string; // Emoji icon
  category: ToolkitCategory;
  authType: 'oauth2' | 'api_key' | 'basic';
  scopes?: string[]; // Required OAuth scopes
  popular?: boolean; // Show in quick connect UI
  featuredActions?: string[]; // Priority actions to always include (Composio action names)
  toolLimit?: number; // Max tools to load for this toolkit (overrides global cap)
}

// ============================================================================
// CONNECTION STATES
// ============================================================================

export type ConnectionStatus = 'disconnected' | 'pending' | 'connected' | 'expired' | 'failed';

export interface ConnectedAccount {
  id: string; // Composio connected account ID
  toolkit: string; // Toolkit ID (e.g., 'GMAIL')
  status: ConnectionStatus;
  connectedAt?: string;
  expiresAt?: string;
  metadata?: {
    email?: string;
    name?: string;
    username?: string;
    avatarUrl?: string;
    [key: string]: unknown;
  };
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ConnectionRequest {
  id: string;
  redirectUrl: string;
  status: 'initiated' | 'pending' | 'active' | 'failed';
}

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================================================
// USER CONNECTIONS
// ============================================================================

export interface UserConnections {
  userId: string;
  accounts: ConnectedAccount[];
  lastUpdated: string;
}

// ============================================================================
// COMPOSIO SESSION
// ============================================================================

export interface ComposioSession {
  userId: string;
  enabledToolkits: string[];
  disabledToolkits: string[];
}

// ============================================================================
// WEBHOOK EVENTS
// ============================================================================

export interface ComposioWebhookPayload {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
  log_id: string;
}

// ============================================================================
// TOOL DEFINITIONS (for agents)
// ============================================================================

export interface ComposioTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description?: string;
        enum?: string[];
        required?: boolean;
      }
    >;
    required?: string[];
  };
}
