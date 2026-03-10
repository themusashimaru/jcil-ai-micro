/**
 * SUPABASE DATABASE TYPES
 *
 * Auto-generated types for Supabase tables
 * Run: npx supabase gen types typescript --project-id kxsaxrnnhjmhtrzarjgh > src/lib/supabase/types.ts
 *
 * NOTE: Relationships arrays added manually to fix insert/update type resolution
 * with @supabase/supabase-js v2.43+. Regenerating types from DB will include these
 * automatically.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/**
 * AI Provider type - matches database enum
 */
export type AIProvider = 'claude' | 'openai' | 'xai' | 'deepseek';

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: 'student' | 'professional' | null;
          field: string | null;
          purpose: string | null;
          subscription_tier: 'free' | 'basic' | 'pro' | 'executive';
          subscription_status: 'active' | 'canceled' | 'past_due' | 'trialing';
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          messages_used_today: number;
          images_generated_today: number;
          last_message_date: string | null;
          total_messages: number;
          total_images: number;
          is_active: boolean;
          is_banned: boolean;
          ban_reason: string | null;
          created_at: string;
          updated_at: string;
          last_login_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          full_name?: string | null;
          role?: 'student' | 'professional' | null;
          field?: string | null;
          purpose?: string | null;
          subscription_tier?: 'free' | 'basic' | 'pro' | 'executive';
          subscription_status?: 'active' | 'canceled' | 'past_due' | 'trialing';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          messages_used_today?: number;
          images_generated_today?: number;
          last_message_date?: string | null;
          total_messages?: number;
          total_images?: number;
          is_active?: boolean;
          is_banned?: boolean;
          ban_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          last_login_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: 'student' | 'professional' | null;
          field?: string | null;
          purpose?: string | null;
          subscription_tier?: 'free' | 'basic' | 'pro' | 'executive';
          subscription_status?: 'active' | 'canceled' | 'past_due' | 'trialing';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          messages_used_today?: number;
          images_generated_today?: number;
          last_message_date?: string | null;
          total_messages?: number;
          total_images?: number;
          is_active?: boolean;
          is_banned?: boolean;
          ban_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          last_login_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          tool_context:
            | 'general'
            | 'email'
            | 'study'
            | 'research'
            | 'code'
            | 'image'
            | 'video'
            | 'sms'
            | 'scripture'
            | null;
          summary: string | null;
          has_memory: boolean;
          message_count: number;
          created_at: string;
          updated_at: string;
          last_message_at: string;
          retention_until: string;
          deleted_at: string | null;
          /** Current AI provider for this conversation */
          provider: AIProvider | null;
          /** History of provider switches with timestamps */
          provider_history: Json | null;
          /** Provider-specific preferences */
          provider_preferences: Json | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          tool_context?:
            | 'general'
            | 'email'
            | 'study'
            | 'research'
            | 'code'
            | 'image'
            | 'video'
            | 'sms'
            | 'scripture'
            | null;
          summary?: string | null;
          has_memory?: boolean;
          message_count?: number;
          created_at?: string;
          updated_at?: string;
          last_message_at?: string;
          retention_until?: string;
          deleted_at?: string | null;
          provider?: AIProvider | null;
          provider_history?: Json | null;
          provider_preferences?: Json | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          tool_context?:
            | 'general'
            | 'email'
            | 'study'
            | 'research'
            | 'code'
            | 'image'
            | 'video'
            | 'sms'
            | 'scripture'
            | null;
          summary?: string | null;
          has_memory?: boolean;
          message_count?: number;
          created_at?: string;
          updated_at?: string;
          last_message_at?: string;
          retention_until?: string;
          deleted_at?: string | null;
          provider?: AIProvider | null;
          provider_history?: Json | null;
          provider_preferences?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          content_type: 'text' | 'image' | 'code' | 'error';
          model_used: string | null;
          temperature: number | null;
          tokens_used: number | null;
          has_attachments: boolean;
          attachment_urls: string[] | null;
          moderated: boolean;
          moderation_flagged: boolean;
          moderation_categories: Json | null;
          created_at: string;
          retention_until: string;
          deleted_at: string | null;
          /** AI provider that generated this message */
          provider: AIProvider | null;
          /** Arbitrary metadata attached to the message */
          metadata: Json | null;
          /** When the message was last edited */
          edited_at: string | null;
          /** Original content before editing */
          original_content: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          user_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          content_type?: 'text' | 'image' | 'code' | 'error';
          model_used?: string | null;
          temperature?: number | null;
          tokens_used?: number | null;
          has_attachments?: boolean;
          attachment_urls?: string[] | null;
          moderated?: boolean;
          moderation_flagged?: boolean;
          moderation_categories?: Json | null;
          created_at?: string;
          retention_until?: string;
          deleted_at?: string | null;
          provider?: AIProvider | null;
          metadata?: Json | null;
          edited_at?: string | null;
          original_content?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          user_id?: string;
          role?: 'user' | 'assistant' | 'system';
          content?: string;
          content_type?: 'text' | 'image' | 'code' | 'error';
          model_used?: string | null;
          temperature?: number | null;
          tokens_used?: number | null;
          has_attachments?: boolean;
          attachment_urls?: string[] | null;
          moderated?: boolean;
          moderation_flagged?: boolean;
          moderation_categories?: Json | null;
          created_at?: string;
          retention_until?: string;
          deleted_at?: string | null;
          provider?: AIProvider | null;
          metadata?: Json | null;
          edited_at?: string | null;
          original_content?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'messages_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      token_usage: {
        Row: {
          id: string;
          user_id: string;
          conversation_id: string | null;
          model: string;
          route: string;
          tool: string;
          input_tokens: number;
          output_tokens: number;
          created_at: string;
          /** AI provider for this token usage record */
          provider: AIProvider | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          conversation_id?: string | null;
          model: string;
          route: string;
          tool: string;
          input_tokens?: number;
          output_tokens?: number;
          created_at?: string;
          provider?: AIProvider | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          conversation_id?: string | null;
          model?: string;
          route?: string;
          tool?: string;
          input_tokens?: number;
          output_tokens?: number;
          created_at?: string;
          provider?: AIProvider | null;
        };
        Relationships: [
          {
            foreignKeyName: 'token_usage_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_learning: {
        Row: {
          id: string;
          user_id: string;
          preference_type:
            | 'format_style'
            | 'response_length'
            | 'communication_tone'
            | 'domain_expertise'
            | 'topic_interest'
            | 'output_preference'
            | 'explicit_memory'
            | 'project_context'
            | 'personal_info'
            | 'work_context';
          preference_value: string;
          confidence: number;
          observation_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          preference_type:
            | 'format_style'
            | 'response_length'
            | 'communication_tone'
            | 'domain_expertise'
            | 'topic_interest'
            | 'output_preference'
            | 'explicit_memory'
            | 'project_context'
            | 'personal_info'
            | 'work_context';
          preference_value: string;
          confidence?: number;
          observation_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          preference_type?:
            | 'format_style'
            | 'response_length'
            | 'communication_tone'
            | 'domain_expertise'
            | 'topic_interest'
            | 'output_preference'
            | 'explicit_memory'
            | 'project_context'
            | 'personal_info'
            | 'work_context';
          preference_value?: string;
          confidence?: number;
          observation_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_learning_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      code_lab_sessions: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          repo: Json | null;
          message_count: number;
          has_summary: boolean;
          summary: string | null;
          created_at: string;
          updated_at: string;
          /** Current AI provider for this coding session */
          provider: AIProvider | null;
          /** History of provider switches with timestamps */
          provider_history: Json | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          repo?: Json | null;
          message_count?: number;
          has_summary?: boolean;
          summary?: string | null;
          created_at?: string;
          updated_at?: string;
          provider?: AIProvider | null;
          provider_history?: Json | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          repo?: Json | null;
          message_count?: number;
          has_summary?: boolean;
          summary?: string | null;
          created_at?: string;
          updated_at?: string;
          provider?: AIProvider | null;
          provider_history?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'code_lab_sessions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      code_lab_messages: {
        Row: {
          id: string;
          session_id: string;
          role: 'user' | 'assistant';
          content: string;
          type: 'chat' | 'code' | 'search' | null;
          code_output: Json | null;
          search_output: Json | null;
          summary_output: string | null;
          created_at: string;
          /** AI provider that generated this message */
          provider: AIProvider | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          role: 'user' | 'assistant';
          content: string;
          type?: 'chat' | 'code' | 'search' | null;
          code_output?: Json | null;
          search_output?: Json | null;
          summary_output?: string | null;
          created_at?: string;
          provider?: AIProvider | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          role?: 'user' | 'assistant';
          content?: string;
          type?: 'chat' | 'code' | 'search' | null;
          code_output?: Json | null;
          search_output?: Json | null;
          summary_output?: string | null;
          created_at?: string;
          provider?: AIProvider | null;
        };
        Relationships: [
          {
            foreignKeyName: 'code_lab_messages_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'code_lab_sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      /** User-level AI provider preferences and settings */
      user_provider_preferences: {
        Row: {
          id: string;
          user_id: string;
          default_provider: AIProvider;
          fallback_provider: AIProvider;
          provider_api_keys: Json | null;
          provider_settings: Json | null;
          auto_switch_enabled: boolean;
          cost_optimization_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          default_provider?: AIProvider;
          fallback_provider?: AIProvider;
          provider_api_keys?: Json | null;
          provider_settings?: Json | null;
          auto_switch_enabled?: boolean;
          cost_optimization_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          default_provider?: AIProvider;
          fallback_provider?: AIProvider;
          provider_api_keys?: Json | null;
          provider_settings?: Json | null;
          auto_switch_enabled?: boolean;
          cost_optimization_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_provider_preferences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      /*
       * Tables below are stub types — not yet fully typed from the database.
       * TODO: Regenerate with `npx supabase gen types typescript` for full types.
       */
      admin_users: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      api_pricing: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      business_reports: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      chat_folders: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      code_lab_workspaces: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      design_settings: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      documents: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      generations: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      news_costs: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      pending_requests: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      rate_limits: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      stripe_webhook_events: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      subscription_history: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      subscription_tiers: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      support_replies: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      support_tickets: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      uploads: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      usage_tracking: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      user_document_chunks: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      user_document_folders: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      user_documents: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      user_mcp_servers: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      user_message_status: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      user_messages: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      user_passkeys: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      user_settings: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      website_leads: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      website_sessions: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      workspaces: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      background_tasks: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      shell_commands: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      tool_executions: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      audit_logs: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      autonomous_tasks: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      batch_operations: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      branding: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      chat_code_artifacts: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      code_lab_user_hooks: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      code_lab_user_mcp_servers: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      codebase_indexes: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      composio_connection_cache: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      conversation_memory: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      custom_slash_commands: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      developer_profiles: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      file_backups: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      generated_documents: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      knowledge_base: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      knowledge_graph_clusters: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      knowledge_graph_entities: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      knowledge_graph_relationships: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      profiles: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      scout_performance: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      sessions: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      shell_sessions: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      strategy_artifacts: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      strategy_audit_events: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      test_table: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      workspace_snapshots: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: {
      admin_users_summary: {
        Row: {
          subscription_tier: 'free' | 'basic' | 'pro' | 'executive';
          user_count: number;
          active_last_7_days: number;
          active_last_30_days: number;
          total_messages: number;
          total_images: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      current_user_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      get_user_document_stats: {
        Args: { p_user_id: string };
        Returns: Record<string, unknown>[];
      };
      exec_sql: {
        Args: { query: string };
        Returns: unknown;
      };
      increment_message_count: {
        Args: { user_id_param: string };
        Returns: void;
      };
      increment_image_count: {
        Args: { user_id_param: string };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
