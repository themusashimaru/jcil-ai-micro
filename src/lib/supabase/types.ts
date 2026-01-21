/**
 * SUPABASE DATABASE TYPES
 *
 * Auto-generated types for Supabase tables
 * Run: npx supabase gen types typescript --project-id kxsaxrnnhjmhtrzarjgh > src/lib/supabase/types.ts
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
        };
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
    };
  };
}
