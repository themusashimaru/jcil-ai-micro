import { describe, it, expect } from 'vitest';

import type { Json, AIProvider, Database } from './types';

// ============================================================================
// Json type
// ============================================================================

describe('Json type', () => {
  it('should accept string values', () => {
    const val: Json = 'hello';
    expect(typeof val).toBe('string');
  });

  it('should accept number values', () => {
    const val: Json = 42;
    expect(typeof val).toBe('number');
  });

  it('should accept boolean values', () => {
    const val: Json = true;
    expect(typeof val).toBe('boolean');
  });

  it('should accept null', () => {
    const val: Json = null;
    expect(val).toBeNull();
  });

  it('should accept nested objects', () => {
    const val: Json = { key: 'value', nested: { deep: 123 } };
    expect(typeof val).toBe('object');
  });

  it('should accept arrays', () => {
    const val: Json = [1, 'two', true, null];
    expect(Array.isArray(val)).toBe(true);
  });
});

// ============================================================================
// AIProvider type
// ============================================================================

describe('AIProvider type', () => {
  it('should accept claude', () => {
    const p: AIProvider = 'claude';
    expect(p).toBe('claude');
  });

  it('should accept openai', () => {
    const p: AIProvider = 'openai';
    expect(p).toBe('openai');
  });

  it('should accept xai', () => {
    const p: AIProvider = 'xai';
    expect(p).toBe('xai');
  });

  it('should accept deepseek', () => {
    const p: AIProvider = 'deepseek';
    expect(p).toBe('deepseek');
  });
});

// ============================================================================
// Database type - Users table
// ============================================================================

describe('Database type - Users table', () => {
  it('should define Row with required fields', () => {
    const row: Database['public']['Tables']['users']['Row'] = {
      id: 'user-123',
      email: 'test@example.com',
      full_name: null,
      role: 'student',
      field: null,
      purpose: null,
      subscription_tier: 'free',
      subscription_status: 'active',
      stripe_customer_id: null,
      stripe_subscription_id: null,
      messages_used_today: 0,
      images_generated_today: 0,
      last_message_date: null,
      total_messages: 0,
      total_images: 0,
      is_active: true,
      is_banned: false,
      ban_reason: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      last_login_at: null,
      deleted_at: null,
    };
    expect(row.id).toBe('user-123');
    expect(row.subscription_tier).toBe('free');
    expect(row.is_active).toBe(true);
  });

  it('should support student and professional roles', () => {
    const student: Database['public']['Tables']['users']['Row']['role'] = 'student';
    const professional: Database['public']['Tables']['users']['Row']['role'] = 'professional';
    expect(student).toBe('student');
    expect(professional).toBe('professional');
  });

  it('should support all subscription tiers', () => {
    const tiers: Database['public']['Tables']['users']['Row']['subscription_tier'][] = [
      'free',
      'basic',
      'pro',
      'executive',
    ];
    expect(tiers).toHaveLength(4);
  });

  it('should support all subscription statuses', () => {
    const statuses: Database['public']['Tables']['users']['Row']['subscription_status'][] = [
      'active',
      'canceled',
      'past_due',
      'trialing',
    ];
    expect(statuses).toHaveLength(4);
  });

  it('should have Insert type with optional fields', () => {
    const insert: Database['public']['Tables']['users']['Insert'] = {
      email: 'test@example.com',
    };
    expect(insert.email).toBe('test@example.com');
    expect(insert.id).toBeUndefined();
  });

  it('should have Update type with all optional fields', () => {
    const update: Database['public']['Tables']['users']['Update'] = {
      full_name: 'John Doe',
    };
    expect(update.full_name).toBe('John Doe');
  });
});

// ============================================================================
// Database type - Conversations table
// ============================================================================

describe('Database type - Conversations table', () => {
  it('should define Row with required fields', () => {
    const row: Database['public']['Tables']['conversations']['Row'] = {
      id: 'conv-123',
      user_id: 'user-123',
      title: 'Test Conversation',
      tool_context: 'general',
      summary: null,
      has_memory: false,
      message_count: 0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      last_message_at: '2026-01-01T00:00:00Z',
      retention_until: '2026-12-01T00:00:00Z',
      deleted_at: null,
      provider: 'claude',
      provider_history: null,
      provider_preferences: null,
    };
    expect(row.id).toBe('conv-123');
    expect(row.provider).toBe('claude');
  });

  it('should support different tool_context values', () => {
    const general: Database['public']['Tables']['conversations']['Row']['tool_context'] = 'general';
    const code: Database['public']['Tables']['conversations']['Row']['tool_context'] = 'code';
    expect(general).toBe('general');
    expect(code).toBe('code');
  });
});

// ============================================================================
// Database type - Messages table
// ============================================================================

describe('Database type - Messages table', () => {
  it('should define Row with required fields', () => {
    const row: Database['public']['Tables']['messages']['Row'] = {
      id: 'msg-123',
      conversation_id: 'conv-123',
      user_id: 'user-123',
      role: 'user',
      content: 'Hello world',
      content_type: 'text',
      model_used: 'claude',
      temperature: null,
      tokens_used: 10,
      has_attachments: false,
      attachment_urls: null,
      moderated: false,
      moderation_flagged: false,
      moderation_categories: null,
      created_at: '2026-01-01T00:00:00Z',
      retention_until: '2026-12-01T00:00:00Z',
      deleted_at: null,
      provider: 'claude',
      metadata: null,
      edited_at: null,
      original_content: null,
    };
    expect(row.role).toBe('user');
    expect(row.content).toBe('Hello world');
  });

  it('should support user, assistant, and system roles', () => {
    const user: Database['public']['Tables']['messages']['Row']['role'] = 'user';
    const assistant: Database['public']['Tables']['messages']['Row']['role'] = 'assistant';
    const system: Database['public']['Tables']['messages']['Row']['role'] = 'system';
    expect(user).toBe('user');
    expect(assistant).toBe('assistant');
    expect(system).toBe('system');
  });
});
