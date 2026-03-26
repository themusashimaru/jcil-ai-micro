export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '13.0.5';
  };
  public: {
    Tables: {
      admin_activity_logs: {
        Row: {
          action_type: string;
          admin_user_id: string | null;
          created_at: string | null;
          details: Json | null;
          id: string;
          ip_address: unknown;
          target_user_id: string | null;
          user_agent: string | null;
        };
        Insert: {
          action_type: string;
          admin_user_id?: string | null;
          created_at?: string | null;
          details?: Json | null;
          id?: string;
          ip_address?: unknown;
          target_user_id?: string | null;
          user_agent?: string | null;
        };
        Update: {
          action_type?: string;
          admin_user_id?: string | null;
          created_at?: string | null;
          details?: Json | null;
          id?: string;
          ip_address?: unknown;
          target_user_id?: string | null;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'admin_activity_logs_admin_user_id_fkey';
            columns: ['admin_user_id'];
            isOneToOne: false;
            referencedRelation: 'admin_users';
            referencedColumns: ['id'];
          },
        ];
      };
      admin_users: {
        Row: {
          can_ban_users: boolean | null;
          can_edit_users: boolean | null;
          can_export_data: boolean | null;
          can_manage_subscriptions: boolean | null;
          can_view_conversations: boolean | null;
          can_view_users: boolean | null;
          created_at: string | null;
          created_by: string | null;
          email: string;
          id: string;
          last_access_at: string | null;
          user_id: string;
        };
        Insert: {
          can_ban_users?: boolean | null;
          can_edit_users?: boolean | null;
          can_export_data?: boolean | null;
          can_manage_subscriptions?: boolean | null;
          can_view_conversations?: boolean | null;
          can_view_users?: boolean | null;
          created_at?: string | null;
          created_by?: string | null;
          email: string;
          id?: string;
          last_access_at?: string | null;
          user_id: string;
        };
        Update: {
          can_ban_users?: boolean | null;
          can_edit_users?: boolean | null;
          can_export_data?: boolean | null;
          can_manage_subscriptions?: boolean | null;
          can_view_conversations?: boolean | null;
          can_view_users?: boolean | null;
          created_at?: string | null;
          created_by?: string | null;
          email?: string;
          id?: string;
          last_access_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'admin_users_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_sessions: {
        Row: {
          commands_executed: Json | null;
          created_at: string | null;
          ended_at: string | null;
          files_modified: Json | null;
          id: string;
          key_decisions: Json | null;
          messages: Json | null;
          summary: string | null;
          tool_calls: Json | null;
          total_input_tokens: number | null;
          total_output_tokens: number | null;
          updated_at: string | null;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          commands_executed?: Json | null;
          created_at?: string | null;
          ended_at?: string | null;
          files_modified?: Json | null;
          id?: string;
          key_decisions?: Json | null;
          messages?: Json | null;
          summary?: string | null;
          tool_calls?: Json | null;
          total_input_tokens?: number | null;
          total_output_tokens?: number | null;
          updated_at?: string | null;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          commands_executed?: Json | null;
          created_at?: string | null;
          ended_at?: string | null;
          files_modified?: Json | null;
          id?: string;
          key_decisions?: Json | null;
          messages?: Json | null;
          summary?: string | null;
          tool_calls?: Json | null;
          total_input_tokens?: number | null;
          total_output_tokens?: number | null;
          updated_at?: string | null;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_sessions_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      api_pricing: {
        Row: {
          cached_input_price_per_million: number | null;
          created_at: string | null;
          id: string;
          input_price_per_million: number;
          live_search_price_per_thousand: number | null;
          model_name: string;
          output_price_per_million: number;
          region: string | null;
          requests_per_minute: number | null;
          tokens_per_minute: number | null;
          updated_at: string | null;
        };
        Insert: {
          cached_input_price_per_million?: number | null;
          created_at?: string | null;
          id?: string;
          input_price_per_million: number;
          live_search_price_per_thousand?: number | null;
          model_name: string;
          output_price_per_million: number;
          region?: string | null;
          requests_per_minute?: number | null;
          tokens_per_minute?: number | null;
          updated_at?: string | null;
        };
        Update: {
          cached_input_price_per_million?: number | null;
          created_at?: string | null;
          id?: string;
          input_price_per_million?: number;
          live_search_price_per_thousand?: number | null;
          model_name?: string;
          output_price_per_million?: number;
          region?: string | null;
          requests_per_minute?: number | null;
          tokens_per_minute?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      background_tasks: {
        Row: {
          command: string;
          completed_at: string | null;
          created_at: string | null;
          error: string | null;
          id: string;
          output: Json | null;
          progress: number | null;
          started_at: string | null;
          status: string;
          type: string;
          workspace_id: string;
        };
        Insert: {
          command: string;
          completed_at?: string | null;
          created_at?: string | null;
          error?: string | null;
          id?: string;
          output?: Json | null;
          progress?: number | null;
          started_at?: string | null;
          status?: string;
          type: string;
          workspace_id: string;
        };
        Update: {
          command?: string;
          completed_at?: string | null;
          created_at?: string | null;
          error?: string | null;
          id?: string;
          output?: Json | null;
          progress?: number | null;
          started_at?: string | null;
          status?: string;
          type?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'background_tasks_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      batch_operations: {
        Row: {
          backup_data: Json | null;
          completed_at: string | null;
          created_at: string | null;
          error: string | null;
          id: string;
          operations: Json;
          results: Json | null;
          session_id: string | null;
          status: string;
          workspace_id: string;
        };
        Insert: {
          backup_data?: Json | null;
          completed_at?: string | null;
          created_at?: string | null;
          error?: string | null;
          id?: string;
          operations: Json;
          results?: Json | null;
          session_id?: string | null;
          status?: string;
          workspace_id: string;
        };
        Update: {
          backup_data?: Json | null;
          completed_at?: string | null;
          created_at?: string | null;
          error?: string | null;
          id?: string;
          operations?: Json;
          results?: Json | null;
          session_id?: string | null;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'batch_operations_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'ai_sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'batch_operations_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      branding_settings: {
        Row: {
          created_at: string | null;
          favicon: string | null;
          header_logo: string | null;
          id: string;
          login_logo: string | null;
          main_logo: string | null;
          site_name: string | null;
          subtitle: string | null;
          updated_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string | null;
          favicon?: string | null;
          header_logo?: string | null;
          id?: string;
          login_logo?: string | null;
          main_logo?: string | null;
          site_name?: string | null;
          subtitle?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string | null;
          favicon?: string | null;
          header_logo?: string | null;
          id?: string;
          login_logo?: string | null;
          main_logo?: string | null;
          site_name?: string | null;
          subtitle?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'branding_settings_updated_by_fkey';
            columns: ['updated_by'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      breaking_news_cache: {
        Row: {
          content: string;
          created_at: string | null;
          generated_at: string;
          id: number;
          updated_at: string | null;
        };
        Insert: {
          content: string;
          created_at?: string | null;
          generated_at: string;
          id?: number;
          updated_at?: string | null;
        };
        Update: {
          content?: string;
          created_at?: string | null;
          generated_at?: string;
          id?: number;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      business_reports: {
        Row: {
          created_at: string | null;
          excel_path: string | null;
          full_report: string | null;
          generated_by: string | null;
          id: string;
          key_metrics: Json | null;
          pdf_path: string | null;
          recommendations: string | null;
          report_period_end: string;
          report_period_start: string;
          report_type: string;
          summary: string | null;
        };
        Insert: {
          created_at?: string | null;
          excel_path?: string | null;
          full_report?: string | null;
          generated_by?: string | null;
          id?: string;
          key_metrics?: Json | null;
          pdf_path?: string | null;
          recommendations?: string | null;
          report_period_end: string;
          report_period_start: string;
          report_type: string;
          summary?: string | null;
        };
        Update: {
          created_at?: string | null;
          excel_path?: string | null;
          full_report?: string | null;
          generated_by?: string | null;
          id?: string;
          key_metrics?: Json | null;
          pdf_path?: string | null;
          recommendations?: string | null;
          report_period_end?: string;
          report_period_start?: string;
          report_type?: string;
          summary?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'business_reports_generated_by_fkey';
            columns: ['generated_by'];
            isOneToOne: false;
            referencedRelation: 'admin_users';
            referencedColumns: ['id'];
          },
        ];
      };
      chat_folders: {
        Row: {
          color: string | null;
          created_at: string | null;
          id: string;
          name: string;
          position: number | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string | null;
          id?: string;
          name: string;
          position?: number | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          color?: string | null;
          created_at?: string | null;
          id?: string;
          name?: string;
          position?: number | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_folders_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      code_lab_file_changes: {
        Row: {
          additions: number | null;
          created_at: string | null;
          deletions: number | null;
          diff_patch: string | null;
          file_path: string;
          id: string;
          message_id: string | null;
          new_content: string | null;
          old_content: string | null;
          old_path: string | null;
          operation: string;
          session_id: string;
        };
        Insert: {
          additions?: number | null;
          created_at?: string | null;
          deletions?: number | null;
          diff_patch?: string | null;
          file_path: string;
          id?: string;
          message_id?: string | null;
          new_content?: string | null;
          old_content?: string | null;
          old_path?: string | null;
          operation: string;
          session_id: string;
        };
        Update: {
          additions?: number | null;
          created_at?: string | null;
          deletions?: number | null;
          diff_patch?: string | null;
          file_path?: string;
          id?: string;
          message_id?: string | null;
          new_content?: string | null;
          old_content?: string | null;
          old_path?: string | null;
          operation?: string;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'code_lab_file_changes_message_id_fkey';
            columns: ['message_id'];
            isOneToOne: false;
            referencedRelation: 'code_lab_messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'code_lab_file_changes_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'code_lab_sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      code_lab_messages: {
        Row: {
          code_output: Json | null;
          content: string;
          created_at: string | null;
          id: string;
          provider: Database['public']['Enums']['ai_provider'] | null;
          role: string;
          search_output: Json | null;
          session_id: string;
          summary_output: string | null;
          type: string | null;
        };
        Insert: {
          code_output?: Json | null;
          content: string;
          created_at?: string | null;
          id?: string;
          provider?: Database['public']['Enums']['ai_provider'] | null;
          role: string;
          search_output?: Json | null;
          session_id: string;
          summary_output?: string | null;
          type?: string | null;
        };
        Update: {
          code_output?: Json | null;
          content?: string;
          created_at?: string | null;
          id?: string;
          provider?: Database['public']['Enums']['ai_provider'] | null;
          role?: string;
          search_output?: Json | null;
          session_id?: string;
          summary_output?: string | null;
          type?: string | null;
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
      code_lab_sessions: {
        Row: {
          created_at: string | null;
          has_summary: boolean | null;
          id: string;
          message_count: number | null;
          provider: Database['public']['Enums']['ai_provider'] | null;
          provider_history: Json | null;
          repo: Json | null;
          summary: string | null;
          title: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          has_summary?: boolean | null;
          id?: string;
          message_count?: number | null;
          provider?: Database['public']['Enums']['ai_provider'] | null;
          provider_history?: Json | null;
          repo?: Json | null;
          summary?: string | null;
          title?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          has_summary?: boolean | null;
          id?: string;
          message_count?: number | null;
          provider?: Database['public']['Enums']['ai_provider'] | null;
          provider_history?: Json | null;
          repo?: Json | null;
          summary?: string | null;
          title?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      code_lab_user_hooks: {
        Row: {
          created_at: string | null;
          custom_config: Json | null;
          enabled: boolean | null;
          hook_id: string;
          id: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          custom_config?: Json | null;
          enabled?: boolean | null;
          hook_id: string;
          id?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          custom_config?: Json | null;
          enabled?: boolean | null;
          hook_id?: string;
          id?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      code_lab_user_mcp_servers: {
        Row: {
          created_at: string | null;
          custom_config: Json | null;
          enabled: boolean | null;
          id: string;
          server_id: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          custom_config?: Json | null;
          enabled?: boolean | null;
          id?: string;
          server_id: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          custom_config?: Json | null;
          enabled?: boolean | null;
          id?: string;
          server_id?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      code_lab_workspaces: {
        Row: {
          cpu_usage: number | null;
          created_at: string | null;
          disk_usage: number | null;
          expires_at: string | null;
          file_tree: Json | null;
          id: string;
          last_activity_at: string | null;
          memory_usage: number | null;
          sandbox_id: string;
          session_id: string | null;
          status: string | null;
          template: string | null;
          user_id: string;
        };
        Insert: {
          cpu_usage?: number | null;
          created_at?: string | null;
          disk_usage?: number | null;
          expires_at?: string | null;
          file_tree?: Json | null;
          id?: string;
          last_activity_at?: string | null;
          memory_usage?: number | null;
          sandbox_id: string;
          session_id?: string | null;
          status?: string | null;
          template?: string | null;
          user_id: string;
        };
        Update: {
          cpu_usage?: number | null;
          created_at?: string | null;
          disk_usage?: number | null;
          expires_at?: string | null;
          file_tree?: Json | null;
          id?: string;
          last_activity_at?: string | null;
          memory_usage?: number | null;
          sandbox_id?: string;
          session_id?: string | null;
          status?: string | null;
          template?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'code_lab_workspaces_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'code_lab_sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'code_lab_workspaces_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      codebase_chunks: {
        Row: {
          chunk_type: string;
          content: string;
          created_at: string | null;
          embedding: string | null;
          end_line: number;
          file_path: string;
          id: string;
          index_id: string;
          language: string;
          metadata: Json | null;
          start_line: number;
        };
        Insert: {
          chunk_type: string;
          content: string;
          created_at?: string | null;
          embedding?: string | null;
          end_line: number;
          file_path: string;
          id: string;
          index_id: string;
          language: string;
          metadata?: Json | null;
          start_line: number;
        };
        Update: {
          chunk_type?: string;
          content?: string;
          created_at?: string | null;
          embedding?: string | null;
          end_line?: number;
          file_path?: string;
          id?: string;
          index_id?: string;
          language?: string;
          metadata?: Json | null;
          start_line?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'codebase_chunks_index_id_fkey';
            columns: ['index_id'];
            isOneToOne: false;
            referencedRelation: 'codebase_indexes';
            referencedColumns: ['id'];
          },
        ];
      };
      codebase_indexes: {
        Row: {
          branch: string | null;
          created_at: string | null;
          error: string | null;
          id: string;
          last_indexed: string | null;
          repo_name: string;
          repo_owner: string;
          status: string | null;
          total_chunks: number | null;
          total_files: number | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          branch?: string | null;
          created_at?: string | null;
          error?: string | null;
          id?: string;
          last_indexed?: string | null;
          repo_name: string;
          repo_owner: string;
          status?: string | null;
          total_chunks?: number | null;
          total_files?: number | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          branch?: string | null;
          created_at?: string | null;
          error?: string | null;
          id?: string;
          last_indexed?: string | null;
          repo_name?: string;
          repo_owner?: string;
          status?: string | null;
          total_chunks?: number | null;
          total_files?: number | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      composio_connection_cache: {
        Row: {
          connected_at: string | null;
          connection_id: string;
          created_at: string | null;
          id: string;
          last_verified_at: string | null;
          metadata: Json | null;
          status: string;
          toolkit: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          connected_at?: string | null;
          connection_id: string;
          created_at?: string | null;
          id?: string;
          last_verified_at?: string | null;
          metadata?: Json | null;
          status?: string;
          toolkit: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          connected_at?: string | null;
          connection_id?: string;
          created_at?: string | null;
          id?: string;
          last_verified_at?: string | null;
          metadata?: Json | null;
          status?: string;
          toolkit?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      conversation_memory: {
        Row: {
          conversation_ids: string[] | null;
          created_at: string | null;
          id: string;
          key_topics: string[] | null;
          last_accessed_at: string | null;
          last_conversations: string[] | null;
          summary: string;
          updated_at: string | null;
          user_id: string;
          user_preferences: Json | null;
        };
        Insert: {
          conversation_ids?: string[] | null;
          created_at?: string | null;
          id?: string;
          key_topics?: string[] | null;
          last_accessed_at?: string | null;
          last_conversations?: string[] | null;
          summary: string;
          updated_at?: string | null;
          user_id: string;
          user_preferences?: Json | null;
        };
        Update: {
          conversation_ids?: string[] | null;
          created_at?: string | null;
          id?: string;
          key_topics?: string[] | null;
          last_accessed_at?: string | null;
          last_conversations?: string[] | null;
          summary?: string;
          updated_at?: string | null;
          user_id?: string;
          user_preferences?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'conversation_memory_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      conversations: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          folder_id: string | null;
          has_memory: boolean | null;
          id: string;
          last_message_at: string | null;
          message_count: number | null;
          provider: Database['public']['Enums']['ai_provider'] | null;
          provider_history: Json | null;
          provider_preferences: Json | null;
          retention_until: string | null;
          summary: string | null;
          title: string | null;
          tool_context: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          folder_id?: string | null;
          has_memory?: boolean | null;
          id?: string;
          last_message_at?: string | null;
          message_count?: number | null;
          provider?: Database['public']['Enums']['ai_provider'] | null;
          provider_history?: Json | null;
          provider_preferences?: Json | null;
          retention_until?: string | null;
          summary?: string | null;
          title?: string | null;
          tool_context?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          folder_id?: string | null;
          has_memory?: boolean | null;
          id?: string;
          last_message_at?: string | null;
          message_count?: number | null;
          provider?: Database['public']['Enums']['ai_provider'] | null;
          provider_history?: Json | null;
          provider_preferences?: Json | null;
          retention_until?: string | null;
          summary?: string | null;
          title?: string | null;
          tool_context?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'conversations_folder_id_fkey';
            columns: ['folder_id'];
            isOneToOne: false;
            referencedRelation: 'chat_folders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'conversations_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      daily_stats: {
        Row: {
          active_users: number | null;
          basic_users: number | null;
          code_tool_usage: number | null;
          created_at: string | null;
          daily_revenue: number | null;
          email_tool_usage: number | null;
          executive_users: number | null;
          flagged_messages: number | null;
          flagged_uploads: number | null;
          free_users: number | null;
          id: string;
          image_tool_usage: number | null;
          mrr: number | null;
          new_users: number | null;
          pro_users: number | null;
          research_tool_usage: number | null;
          stat_date: string;
          study_tool_usage: number | null;
          total_conversations: number | null;
          total_images_generated: number | null;
          total_messages: number | null;
          total_uploads: number | null;
          total_users: number | null;
          updated_at: string | null;
        };
        Insert: {
          active_users?: number | null;
          basic_users?: number | null;
          code_tool_usage?: number | null;
          created_at?: string | null;
          daily_revenue?: number | null;
          email_tool_usage?: number | null;
          executive_users?: number | null;
          flagged_messages?: number | null;
          flagged_uploads?: number | null;
          free_users?: number | null;
          id?: string;
          image_tool_usage?: number | null;
          mrr?: number | null;
          new_users?: number | null;
          pro_users?: number | null;
          research_tool_usage?: number | null;
          stat_date: string;
          study_tool_usage?: number | null;
          total_conversations?: number | null;
          total_images_generated?: number | null;
          total_messages?: number | null;
          total_uploads?: number | null;
          total_users?: number | null;
          updated_at?: string | null;
        };
        Update: {
          active_users?: number | null;
          basic_users?: number | null;
          code_tool_usage?: number | null;
          created_at?: string | null;
          daily_revenue?: number | null;
          email_tool_usage?: number | null;
          executive_users?: number | null;
          flagged_messages?: number | null;
          flagged_uploads?: number | null;
          free_users?: number | null;
          id?: string;
          image_tool_usage?: number | null;
          mrr?: number | null;
          new_users?: number | null;
          pro_users?: number | null;
          research_tool_usage?: number | null;
          stat_date?: string;
          study_tool_usage?: number | null;
          total_conversations?: number | null;
          total_images_generated?: number | null;
          total_messages?: number | null;
          total_uploads?: number | null;
          total_users?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      design_settings: {
        Row: {
          created_at: string | null;
          favicon: string | null;
          header_logo: string | null;
          id: string;
          light_mode_logo: string | null;
          login_logo: string | null;
          main_logo: string | null;
          model_name: string | null;
          site_name: string | null;
          subtitle: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          favicon?: string | null;
          header_logo?: string | null;
          id?: string;
          light_mode_logo?: string | null;
          login_logo?: string | null;
          main_logo?: string | null;
          model_name?: string | null;
          site_name?: string | null;
          subtitle?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          favicon?: string | null;
          header_logo?: string | null;
          id?: string;
          light_mode_logo?: string | null;
          login_logo?: string | null;
          main_logo?: string | null;
          model_name?: string | null;
          site_name?: string | null;
          subtitle?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      export_logs: {
        Row: {
          conversation_ids: string[] | null;
          created_at: string | null;
          export_scope: string | null;
          export_type: string | null;
          exported_by: string | null;
          file_path: string | null;
          file_size: number | null;
          id: string;
          reason: string | null;
          reason_notes: string | null;
          user_id: string | null;
        };
        Insert: {
          conversation_ids?: string[] | null;
          created_at?: string | null;
          export_scope?: string | null;
          export_type?: string | null;
          exported_by?: string | null;
          file_path?: string | null;
          file_size?: number | null;
          id?: string;
          reason?: string | null;
          reason_notes?: string | null;
          user_id?: string | null;
        };
        Update: {
          conversation_ids?: string[] | null;
          created_at?: string | null;
          export_scope?: string | null;
          export_type?: string | null;
          exported_by?: string | null;
          file_path?: string | null;
          file_size?: number | null;
          id?: string;
          reason?: string | null;
          reason_notes?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      file_embeddings: {
        Row: {
          chunk_index: number;
          content: string;
          created_at: string | null;
          embedding: string | null;
          file_path: string;
          id: string;
          updated_at: string | null;
          workspace_id: string;
        };
        Insert: {
          chunk_index?: number;
          content: string;
          created_at?: string | null;
          embedding?: string | null;
          file_path: string;
          id?: string;
          updated_at?: string | null;
          workspace_id: string;
        };
        Update: {
          chunk_index?: number;
          content?: string;
          created_at?: string | null;
          embedding?: string | null;
          file_path?: string;
          id?: string;
          updated_at?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'file_embeddings_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      generated_sites: {
        Row: {
          business_name: string | null;
          business_type: string | null;
          deployed_url: string | null;
          generated_at: string | null;
          generated_html: string | null;
          github_repo: string | null;
          id: string;
          template_id: string | null;
          user_id: string;
          vercel_project_id: string | null;
        };
        Insert: {
          business_name?: string | null;
          business_type?: string | null;
          deployed_url?: string | null;
          generated_at?: string | null;
          generated_html?: string | null;
          github_repo?: string | null;
          id?: string;
          template_id?: string | null;
          user_id: string;
          vercel_project_id?: string | null;
        };
        Update: {
          business_name?: string | null;
          business_type?: string | null;
          deployed_url?: string | null;
          generated_at?: string | null;
          generated_html?: string | null;
          github_repo?: string | null;
          id?: string;
          template_id?: string | null;
          user_id?: string;
          vercel_project_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'generated_sites_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'website_templates';
            referencedColumns: ['id'];
          },
        ];
      };
      generations: {
        Row: {
          completed_at: string | null;
          conversation_id: string | null;
          cost_credits: number | null;
          created_at: string | null;
          dimensions: Json | null;
          error_code: string | null;
          error_message: string | null;
          id: string;
          input_data: Json | null;
          model: string;
          polling_url: string | null;
          progress: number | null;
          prompt: string;
          provider: string;
          provider_request_id: string | null;
          result_data: Json | null;
          result_url: string | null;
          status: string;
          type: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          conversation_id?: string | null;
          cost_credits?: number | null;
          created_at?: string | null;
          dimensions?: Json | null;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          input_data?: Json | null;
          model: string;
          polling_url?: string | null;
          progress?: number | null;
          prompt: string;
          provider?: string;
          provider_request_id?: string | null;
          result_data?: Json | null;
          result_url?: string | null;
          status?: string;
          type: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          conversation_id?: string | null;
          cost_credits?: number | null;
          created_at?: string | null;
          dimensions?: Json | null;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          input_data?: Json | null;
          model?: string;
          polling_url?: string | null;
          progress?: number | null;
          prompt?: string;
          provider?: string;
          provider_request_id?: string | null;
          result_data?: Json | null;
          result_url?: string | null;
          status?: string;
          type?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'generations_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
        ];
      };
      image_jobs: {
        Row: {
          created_at: string | null;
          error_message: string | null;
          id: string;
          model: string;
          prompt: string;
          result_content: string | null;
          result_image_data: string | null;
          result_mime_type: string | null;
          status: string;
          type: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          error_message?: string | null;
          id: string;
          model: string;
          prompt: string;
          result_content?: string | null;
          result_image_data?: string | null;
          result_mime_type?: string | null;
          status?: string;
          type: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          model?: string;
          prompt?: string;
          result_content?: string | null;
          result_image_data?: string | null;
          result_mime_type?: string | null;
          status?: string;
          type?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      knowledge_base: {
        Row: {
          agent_mode: string;
          confidence: string;
          content: string;
          created_at: string | null;
          data_points: Json | null;
          domain: string | null;
          finding_type: string;
          id: string;
          relevance_score: number | null;
          scout_name: string | null;
          scout_tools_used: string[] | null;
          search_queries: string[] | null;
          search_vector: unknown;
          session_id: string;
          sources: Json | null;
          title: string;
          topic_tags: string[] | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          agent_mode?: string;
          confidence?: string;
          content: string;
          created_at?: string | null;
          data_points?: Json | null;
          domain?: string | null;
          finding_type: string;
          id?: string;
          relevance_score?: number | null;
          scout_name?: string | null;
          scout_tools_used?: string[] | null;
          search_queries?: string[] | null;
          search_vector?: unknown;
          session_id: string;
          sources?: Json | null;
          title: string;
          topic_tags?: string[] | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          agent_mode?: string;
          confidence?: string;
          content?: string;
          created_at?: string | null;
          data_points?: Json | null;
          domain?: string | null;
          finding_type?: string;
          id?: string;
          relevance_score?: number | null;
          scout_name?: string | null;
          scout_tools_used?: string[] | null;
          search_queries?: string[] | null;
          search_vector?: unknown;
          session_id?: string;
          sources?: Json | null;
          title?: string;
          topic_tags?: string[] | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          attachment_urls: string[] | null;
          content: string;
          content_type: string | null;
          conversation_id: string;
          created_at: string | null;
          deleted_at: string | null;
          has_attachments: boolean | null;
          id: string;
          metadata: Json | null;
          model_used: string | null;
          moderated: boolean | null;
          moderation_categories: Json | null;
          moderation_flagged: boolean | null;
          provider: Database['public']['Enums']['ai_provider'] | null;
          retention_until: string | null;
          role: string;
          temperature: number | null;
          tokens_used: number | null;
          user_id: string;
        };
        Insert: {
          attachment_urls?: string[] | null;
          content: string;
          content_type?: string | null;
          conversation_id: string;
          created_at?: string | null;
          deleted_at?: string | null;
          has_attachments?: boolean | null;
          id?: string;
          metadata?: Json | null;
          model_used?: string | null;
          moderated?: boolean | null;
          moderation_categories?: Json | null;
          moderation_flagged?: boolean | null;
          provider?: Database['public']['Enums']['ai_provider'] | null;
          retention_until?: string | null;
          role: string;
          temperature?: number | null;
          tokens_used?: number | null;
          user_id: string;
        };
        Update: {
          attachment_urls?: string[] | null;
          content?: string;
          content_type?: string | null;
          conversation_id?: string;
          created_at?: string | null;
          deleted_at?: string | null;
          has_attachments?: boolean | null;
          id?: string;
          metadata?: Json | null;
          model_used?: string | null;
          moderated?: boolean | null;
          moderation_categories?: Json | null;
          moderation_flagged?: boolean | null;
          provider?: Database['public']['Enums']['ai_provider'] | null;
          retention_until?: string | null;
          role?: string;
          temperature?: number | null;
          tokens_used?: number | null;
          user_id?: string;
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
      moderation_logs: {
        Row: {
          action_taken: string | null;
          categories: Json | null;
          content_type: string | null;
          created_at: string | null;
          flagged: boolean;
          id: string;
          message_id: string | null;
          moderator_notes: string | null;
          retention_until: string | null;
          upload_id: string | null;
          user_id: string | null;
        };
        Insert: {
          action_taken?: string | null;
          categories?: Json | null;
          content_type?: string | null;
          created_at?: string | null;
          flagged: boolean;
          id?: string;
          message_id?: string | null;
          moderator_notes?: string | null;
          retention_until?: string | null;
          upload_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          action_taken?: string | null;
          categories?: Json | null;
          content_type?: string | null;
          created_at?: string | null;
          flagged?: boolean;
          id?: string;
          message_id?: string | null;
          moderator_notes?: string | null;
          retention_until?: string | null;
          upload_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'moderation_logs_message_id_fkey';
            columns: ['message_id'];
            isOneToOne: false;
            referencedRelation: 'messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'moderation_logs_upload_id_fkey';
            columns: ['upload_id'];
            isOneToOne: false;
            referencedRelation: 'uploads';
            referencedColumns: ['id'];
          },
        ];
      };
      news_costs: {
        Row: {
          api_calls: number | null;
          cost: number | null;
          created_at: string | null;
          id: string;
          tokens_used: number | null;
        };
        Insert: {
          api_calls?: number | null;
          cost?: number | null;
          created_at?: string | null;
          id?: string;
          tokens_used?: number | null;
        };
        Update: {
          api_calls?: number | null;
          cost?: number | null;
          created_at?: string | null;
          id?: string;
          tokens_used?: number | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          action_label: string | null;
          action_url: string | null;
          body: string;
          created_at: string | null;
          id: string;
          is_read: boolean | null;
          priority: string;
          read_at: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          action_label?: string | null;
          action_url?: string | null;
          body: string;
          created_at?: string | null;
          id?: string;
          is_read?: boolean | null;
          priority: string;
          read_at?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          action_label?: string | null;
          action_url?: string | null;
          body?: string;
          created_at?: string | null;
          id?: string;
          is_read?: boolean | null;
          priority?: string;
          read_at?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      pending_requests: {
        Row: {
          completed_at: string | null;
          conversation_id: string;
          created_at: string | null;
          error_message: string | null;
          id: string;
          messages: Json;
          model: string | null;
          response_content: string | null;
          response_model: string | null;
          started_at: string | null;
          status: string;
          tool: string | null;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          conversation_id: string;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          messages: Json;
          model?: string | null;
          response_content?: string | null;
          response_model?: string | null;
          started_at?: string | null;
          status?: string;
          tool?: string | null;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          conversation_id?: string;
          created_at?: string | null;
          error_message?: string | null;
          id?: string;
          messages?: Json;
          model?: string | null;
          response_content?: string | null;
          response_model?: string | null;
          started_at?: string | null;
          status?: string;
          tool?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      provider_settings: {
        Row: {
          active_provider: string;
          code_command_model: string | null;
          created_at: string | null;
          id: string;
          perplexity_model: string | null;
          provider_config: Json | null;
          updated_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          active_provider?: string;
          code_command_model?: string | null;
          created_at?: string | null;
          id?: string;
          perplexity_model?: string | null;
          provider_config?: Json | null;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          active_provider?: string;
          code_command_model?: string | null;
          created_at?: string | null;
          id?: string;
          perplexity_model?: string | null;
          provider_config?: Json | null;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          action: string;
          created_at: string | null;
          id: string;
          identifier: string;
        };
        Insert: {
          action: string;
          created_at?: string | null;
          id?: string;
          identifier: string;
        };
        Update: {
          action?: string;
          created_at?: string | null;
          id?: string;
          identifier?: string;
        };
        Relationships: [];
      };
      scheduled_tasks: {
        Row: {
          action: string;
          conversation_id: string | null;
          created_at: string | null;
          created_from: string | null;
          cron_expression: string | null;
          description: string | null;
          fail_count: number | null;
          id: string;
          last_error: string | null;
          last_result: string | null;
          last_run_at: string | null;
          name: string;
          platform: string;
          recurring: string | null;
          run_count: number | null;
          scheduled_for: string;
          status: string;
          timezone: string;
          tool_name: string;
          tool_params: Json;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          action: string;
          conversation_id?: string | null;
          created_at?: string | null;
          created_from?: string | null;
          cron_expression?: string | null;
          description?: string | null;
          fail_count?: number | null;
          id?: string;
          last_error?: string | null;
          last_result?: string | null;
          last_run_at?: string | null;
          name: string;
          platform: string;
          recurring?: string | null;
          run_count?: number | null;
          scheduled_for: string;
          status?: string;
          timezone?: string;
          tool_name: string;
          tool_params?: Json;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          action?: string;
          conversation_id?: string | null;
          created_at?: string | null;
          created_from?: string | null;
          cron_expression?: string | null;
          description?: string | null;
          fail_count?: number | null;
          id?: string;
          last_error?: string | null;
          last_result?: string | null;
          last_run_at?: string | null;
          name?: string;
          platform?: string;
          recurring?: string | null;
          run_count?: number | null;
          scheduled_for?: string;
          status?: string;
          timezone?: string;
          tool_name?: string;
          tool_params?: Json;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      scout_performance: {
        Row: {
          agent_mode: string;
          avg_relevance_score: number | null;
          browser_targets: string[] | null;
          cost_incurred: number | null;
          created_at: string | null;
          domain: string | null;
          error_message: string | null;
          execution_time_ms: number | null;
          expertise: string[] | null;
          findings_count: number | null;
          gaps_identified: string[] | null;
          high_confidence_count: number | null;
          id: string;
          low_confidence_count: number | null;
          medium_confidence_count: number | null;
          model_tier: string;
          pages_visited: number | null;
          problem_complexity: string | null;
          research_approach: string | null;
          scout_id: string;
          scout_name: string;
          scout_role: string | null;
          screenshots_taken: number | null;
          search_queries: string[] | null;
          searches_executed: number | null;
          session_id: string;
          spawned_children: number | null;
          status: string;
          tokens_used: number | null;
          tool_calls_failed: number | null;
          tool_calls_succeeded: number | null;
          tool_calls_total: number | null;
          tools_assigned: string[] | null;
          user_id: string;
        };
        Insert: {
          agent_mode?: string;
          avg_relevance_score?: number | null;
          browser_targets?: string[] | null;
          cost_incurred?: number | null;
          created_at?: string | null;
          domain?: string | null;
          error_message?: string | null;
          execution_time_ms?: number | null;
          expertise?: string[] | null;
          findings_count?: number | null;
          gaps_identified?: string[] | null;
          high_confidence_count?: number | null;
          id?: string;
          low_confidence_count?: number | null;
          medium_confidence_count?: number | null;
          model_tier: string;
          pages_visited?: number | null;
          problem_complexity?: string | null;
          research_approach?: string | null;
          scout_id: string;
          scout_name: string;
          scout_role?: string | null;
          screenshots_taken?: number | null;
          search_queries?: string[] | null;
          searches_executed?: number | null;
          session_id: string;
          spawned_children?: number | null;
          status?: string;
          tokens_used?: number | null;
          tool_calls_failed?: number | null;
          tool_calls_succeeded?: number | null;
          tool_calls_total?: number | null;
          tools_assigned?: string[] | null;
          user_id: string;
        };
        Update: {
          agent_mode?: string;
          avg_relevance_score?: number | null;
          browser_targets?: string[] | null;
          cost_incurred?: number | null;
          created_at?: string | null;
          domain?: string | null;
          error_message?: string | null;
          execution_time_ms?: number | null;
          expertise?: string[] | null;
          findings_count?: number | null;
          gaps_identified?: string[] | null;
          high_confidence_count?: number | null;
          id?: string;
          low_confidence_count?: number | null;
          medium_confidence_count?: number | null;
          model_tier?: string;
          pages_visited?: number | null;
          problem_complexity?: string | null;
          research_approach?: string | null;
          scout_id?: string;
          scout_name?: string;
          scout_role?: string | null;
          screenshots_taken?: number | null;
          search_queries?: string[] | null;
          searches_executed?: number | null;
          session_id?: string;
          spawned_children?: number | null;
          status?: string;
          tokens_used?: number | null;
          tool_calls_failed?: number | null;
          tool_calls_succeeded?: number | null;
          tool_calls_total?: number | null;
          tools_assigned?: string[] | null;
          user_id?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          accent_color: string | null;
          background_color: string | null;
          created_at: string | null;
          facebook_url: string | null;
          favicon: string | null;
          glassmorphism_enabled: boolean | null;
          google_oauth_enabled: boolean | null;
          header_logo: string | null;
          id: string;
          instagram_url: string | null;
          linkedin_url: string | null;
          login_logo: string | null;
          maintenance_mode: boolean | null;
          meta_description: string | null;
          meta_keywords: string[] | null;
          og_image: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          sidebar_logo: string | null;
          signup_enabled: boolean | null;
          site_name: string | null;
          site_tagline: string | null;
          support_email: string | null;
          support_phone: string | null;
          theme_mode: string | null;
          twitter_url: string | null;
          updated_at: string | null;
          updated_by: string | null;
        };
        Insert: {
          accent_color?: string | null;
          background_color?: string | null;
          created_at?: string | null;
          facebook_url?: string | null;
          favicon?: string | null;
          glassmorphism_enabled?: boolean | null;
          google_oauth_enabled?: boolean | null;
          header_logo?: string | null;
          id?: string;
          instagram_url?: string | null;
          linkedin_url?: string | null;
          login_logo?: string | null;
          maintenance_mode?: boolean | null;
          meta_description?: string | null;
          meta_keywords?: string[] | null;
          og_image?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          sidebar_logo?: string | null;
          signup_enabled?: boolean | null;
          site_name?: string | null;
          site_tagline?: string | null;
          support_email?: string | null;
          support_phone?: string | null;
          theme_mode?: string | null;
          twitter_url?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Update: {
          accent_color?: string | null;
          background_color?: string | null;
          created_at?: string | null;
          facebook_url?: string | null;
          favicon?: string | null;
          glassmorphism_enabled?: boolean | null;
          google_oauth_enabled?: boolean | null;
          header_logo?: string | null;
          id?: string;
          instagram_url?: string | null;
          linkedin_url?: string | null;
          login_logo?: string | null;
          maintenance_mode?: boolean | null;
          meta_description?: string | null;
          meta_keywords?: string[] | null;
          og_image?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          sidebar_logo?: string | null;
          signup_enabled?: boolean | null;
          site_name?: string | null;
          site_tagline?: string | null;
          support_email?: string | null;
          support_phone?: string | null;
          theme_mode?: string | null;
          twitter_url?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      shell_commands: {
        Row: {
          command: string;
          executed_at: string | null;
          execution_time_ms: number | null;
          exit_code: number | null;
          id: string;
          output: string | null;
          session_id: string;
          workspace_id: string;
        };
        Insert: {
          command: string;
          executed_at?: string | null;
          execution_time_ms?: number | null;
          exit_code?: number | null;
          id?: string;
          output?: string | null;
          session_id: string;
          workspace_id: string;
        };
        Update: {
          command?: string;
          executed_at?: string | null;
          execution_time_ms?: number | null;
          exit_code?: number | null;
          id?: string;
          output?: string | null;
          session_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shell_commands_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'shell_sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'shell_commands_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      shell_sessions: {
        Row: {
          closed_at: string | null;
          created_at: string | null;
          id: string;
          shell_type: string | null;
          status: string;
          workspace_id: string;
        };
        Insert: {
          closed_at?: string | null;
          created_at?: string | null;
          id?: string;
          shell_type?: string | null;
          status?: string;
          workspace_id: string;
        };
        Update: {
          closed_at?: string | null;
          created_at?: string | null;
          id?: string;
          shell_type?: string | null;
          status?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shell_sessions_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      strategy_artifacts: {
        Row: {
          artifact_type: string;
          content_base64: string | null;
          content_text: string | null;
          created_at: string | null;
          description: string | null;
          file_name: string;
          id: string;
          mime_type: string;
          session_id: string;
          size_bytes: number | null;
          title: string;
          user_id: string;
        };
        Insert: {
          artifact_type: string;
          content_base64?: string | null;
          content_text?: string | null;
          created_at?: string | null;
          description?: string | null;
          file_name: string;
          id?: string;
          mime_type: string;
          session_id: string;
          size_bytes?: number | null;
          title: string;
          user_id: string;
        };
        Update: {
          artifact_type?: string;
          content_base64?: string | null;
          content_text?: string | null;
          created_at?: string | null;
          description?: string | null;
          file_name?: string;
          id?: string;
          mime_type?: string;
          session_id?: string;
          size_bytes?: number | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      strategy_events: {
        Row: {
          created_at: string | null;
          event_data: Json | null;
          event_type: string;
          id: string;
          message: string | null;
          session_id: string;
        };
        Insert: {
          created_at?: string | null;
          event_data?: Json | null;
          event_type: string;
          id?: string;
          message?: string | null;
          session_id: string;
        };
        Update: {
          created_at?: string | null;
          event_data?: Json | null;
          event_type?: string;
          id?: string;
          message?: string | null;
          session_id?: string;
        };
        Relationships: [];
      };
      strategy_findings: {
        Row: {
          agent_name: string | null;
          category: string | null;
          confidence: string | null;
          content: string;
          created_at: string;
          discovered_at: string;
          id: string;
          session_id: string;
          source_url: string | null;
          title: string;
        };
        Insert: {
          agent_name?: string | null;
          category?: string | null;
          confidence?: string | null;
          content: string;
          created_at?: string;
          discovered_at?: string;
          id?: string;
          session_id: string;
          source_url?: string | null;
          title: string;
        };
        Update: {
          agent_name?: string | null;
          category?: string | null;
          confidence?: string | null;
          content?: string;
          created_at?: string;
          discovered_at?: string;
          id?: string;
          session_id?: string;
          source_url?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'strategy_findings_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'strategy_sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      strategy_sessions: {
        Row: {
          attachments: Json | null;
          completed_agents: number | null;
          completed_at: string | null;
          created_at: string;
          id: string;
          intake_messages: Json | null;
          mode: string | null;
          phase: string;
          problem_data: Json | null;
          problem_summary: string | null;
          result: Json | null;
          session_id: string;
          started_at: string;
          total_agents: number | null;
          total_cost: number | null;
          total_searches: number | null;
          updated_at: string;
          user_context: Json | null;
          user_id: string;
        };
        Insert: {
          attachments?: Json | null;
          completed_agents?: number | null;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          intake_messages?: Json | null;
          mode?: string | null;
          phase: string;
          problem_data?: Json | null;
          problem_summary?: string | null;
          result?: Json | null;
          session_id: string;
          started_at?: string;
          total_agents?: number | null;
          total_cost?: number | null;
          total_searches?: number | null;
          updated_at?: string;
          user_context?: Json | null;
          user_id: string;
        };
        Update: {
          attachments?: Json | null;
          completed_agents?: number | null;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          intake_messages?: Json | null;
          mode?: string | null;
          phase?: string;
          problem_data?: Json | null;
          problem_summary?: string | null;
          result?: Json | null;
          session_id?: string;
          started_at?: string;
          total_agents?: number | null;
          total_cost?: number | null;
          total_searches?: number | null;
          updated_at?: string;
          user_context?: Json | null;
          user_id?: string;
        };
        Relationships: [];
      };
      strategy_usage: {
        Row: {
          brave_searches: number | null;
          created_at: string;
          haiku_cost: number | null;
          haiku_tokens: number | null;
          id: string;
          opus_cost: number | null;
          opus_tokens: number | null;
          search_cost: number | null;
          session_id: string | null;
          sonnet_cost: number | null;
          sonnet_tokens: number | null;
          total_cost: number | null;
          user_id: string;
        };
        Insert: {
          brave_searches?: number | null;
          created_at?: string;
          haiku_cost?: number | null;
          haiku_tokens?: number | null;
          id?: string;
          opus_cost?: number | null;
          opus_tokens?: number | null;
          search_cost?: number | null;
          session_id?: string | null;
          sonnet_cost?: number | null;
          sonnet_tokens?: number | null;
          total_cost?: number | null;
          user_id: string;
        };
        Update: {
          brave_searches?: number | null;
          created_at?: string;
          haiku_cost?: number | null;
          haiku_tokens?: number | null;
          id?: string;
          opus_cost?: number | null;
          opus_tokens?: number | null;
          search_cost?: number | null;
          session_id?: string | null;
          sonnet_cost?: number | null;
          sonnet_tokens?: number | null;
          total_cost?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'strategy_usage_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'strategy_sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      stripe_webhook_events: {
        Row: {
          created_at: string;
          event_id: string;
          event_type: string;
          id: string;
          processed_at: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          event_type: string;
          id?: string;
          processed_at?: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          event_type?: string;
          id?: string;
          processed_at?: string;
        };
        Relationships: [];
      };
      subscription_history: {
        Row: {
          amount: number | null;
          change_reason: string | null;
          changed_by: string | null;
          changed_from_tier: string | null;
          created_at: string | null;
          currency: string | null;
          id: string;
          period_end: string | null;
          period_start: string | null;
          status: string;
          stripe_price_id: string | null;
          stripe_subscription_id: string | null;
          tier: string;
          user_id: string;
        };
        Insert: {
          amount?: number | null;
          change_reason?: string | null;
          changed_by?: string | null;
          changed_from_tier?: string | null;
          created_at?: string | null;
          currency?: string | null;
          id?: string;
          period_end?: string | null;
          period_start?: string | null;
          status: string;
          stripe_price_id?: string | null;
          stripe_subscription_id?: string | null;
          tier: string;
          user_id: string;
        };
        Update: {
          amount?: number | null;
          change_reason?: string | null;
          changed_by?: string | null;
          changed_from_tier?: string | null;
          created_at?: string | null;
          currency?: string | null;
          id?: string;
          period_end?: string | null;
          period_start?: string | null;
          status?: string;
          stripe_price_id?: string | null;
          stripe_subscription_id?: string | null;
          tier?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'subscription_history_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      subscription_tiers: {
        Row: {
          created_at: string | null;
          id: string;
          images_per_day: number | null;
          messages_per_day: number | null;
          monthly_price: number;
          tier_name: string;
          updated_at: string | null;
          yearly_price: number | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          images_per_day?: number | null;
          messages_per_day?: number | null;
          monthly_price: number;
          tier_name: string;
          updated_at?: string | null;
          yearly_price?: number | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          images_per_day?: number | null;
          messages_per_day?: number | null;
          monthly_price?: number;
          tier_name?: string;
          updated_at?: string | null;
          yearly_price?: number | null;
        };
        Relationships: [];
      };
      support_replies: {
        Row: {
          admin_email: string | null;
          admin_id: string | null;
          created_at: string | null;
          delivery_method: string | null;
          id: string;
          is_internal_note: boolean | null;
          message: string;
          ticket_id: string;
        };
        Insert: {
          admin_email?: string | null;
          admin_id?: string | null;
          created_at?: string | null;
          delivery_method?: string | null;
          id?: string;
          is_internal_note?: boolean | null;
          message: string;
          ticket_id: string;
        };
        Update: {
          admin_email?: string | null;
          admin_id?: string | null;
          created_at?: string | null;
          delivery_method?: string | null;
          id?: string;
          is_internal_note?: boolean | null;
          message?: string;
          ticket_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'support_replies_admin_id_fkey';
            columns: ['admin_id'];
            isOneToOne: false;
            referencedRelation: 'admin_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'support_replies_ticket_id_fkey';
            columns: ['ticket_id'];
            isOneToOne: false;
            referencedRelation: 'support_tickets';
            referencedColumns: ['id'];
          },
        ];
      };
      support_tickets: {
        Row: {
          assigned_to: string | null;
          category: string;
          created_at: string | null;
          id: string;
          ip_address: unknown;
          is_archived: boolean | null;
          is_read: boolean | null;
          is_starred: boolean | null;
          message: string;
          priority: string | null;
          read_at: string | null;
          resolved_at: string | null;
          sender_email: string;
          sender_name: string | null;
          source: string;
          status: string | null;
          subject: string;
          updated_at: string | null;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          assigned_to?: string | null;
          category: string;
          created_at?: string | null;
          id?: string;
          ip_address?: unknown;
          is_archived?: boolean | null;
          is_read?: boolean | null;
          is_starred?: boolean | null;
          message: string;
          priority?: string | null;
          read_at?: string | null;
          resolved_at?: string | null;
          sender_email: string;
          sender_name?: string | null;
          source: string;
          status?: string | null;
          subject: string;
          updated_at?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          assigned_to?: string | null;
          category?: string;
          created_at?: string | null;
          id?: string;
          ip_address?: unknown;
          is_archived?: boolean | null;
          is_read?: boolean | null;
          is_starred?: boolean | null;
          message?: string;
          priority?: string | null;
          read_at?: string | null;
          resolved_at?: string | null;
          sender_email?: string;
          sender_name?: string | null;
          source?: string;
          status?: string | null;
          subject?: string;
          updated_at?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'support_tickets_assigned_to_fkey';
            columns: ['assigned_to'];
            isOneToOne: false;
            referencedRelation: 'admin_users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'support_tickets_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      token_usage: {
        Row: {
          conversation_id: string | null;
          created_at: string;
          id: string;
          input_tokens: number;
          model: string;
          output_tokens: number;
          provider: Database['public']['Enums']['ai_provider'] | null;
          route: string;
          tool: string;
          user_id: string;
        };
        Insert: {
          conversation_id?: string | null;
          created_at?: string;
          id?: string;
          input_tokens?: number;
          model: string;
          output_tokens?: number;
          provider?: Database['public']['Enums']['ai_provider'] | null;
          route: string;
          tool: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string | null;
          created_at?: string;
          id?: string;
          input_tokens?: number;
          model?: string;
          output_tokens?: number;
          provider?: Database['public']['Enums']['ai_provider'] | null;
          route?: string;
          tool?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      tool_executions: {
        Row: {
          created_at: string | null;
          error: string | null;
          execution_time_ms: number | null;
          id: string;
          input: Json;
          output: Json | null;
          session_id: string;
          tool_name: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string | null;
          error?: string | null;
          execution_time_ms?: number | null;
          id?: string;
          input: Json;
          output?: Json | null;
          session_id: string;
          tool_name: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string | null;
          error?: string | null;
          execution_time_ms?: number | null;
          id?: string;
          input?: Json;
          output?: Json | null;
          session_id?: string;
          tool_name?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tool_executions_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'ai_sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tool_executions_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      tool_usage: {
        Row: {
          conversation_id: string | null;
          cost_estimate: number | null;
          created_at: string | null;
          deleted_at: string | null;
          error_message: string | null;
          id: string;
          retention_until: string | null;
          success: boolean | null;
          tokens_used: number | null;
          tool_action: string | null;
          tool_name: string;
          user_id: string;
        };
        Insert: {
          conversation_id?: string | null;
          cost_estimate?: number | null;
          created_at?: string | null;
          deleted_at?: string | null;
          error_message?: string | null;
          id?: string;
          retention_until?: string | null;
          success?: boolean | null;
          tokens_used?: number | null;
          tool_action?: string | null;
          tool_name: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string | null;
          cost_estimate?: number | null;
          created_at?: string | null;
          deleted_at?: string | null;
          error_message?: string | null;
          id?: string;
          retention_until?: string | null;
          success?: boolean | null;
          tokens_used?: number | null;
          tool_action?: string | null;
          tool_name?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tool_usage_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tool_usage_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      uploads: {
        Row: {
          conversation_id: string | null;
          created_at: string | null;
          deleted_at: string | null;
          file_name: string;
          file_size: number;
          file_type: string;
          id: string;
          message_id: string | null;
          moderated: boolean | null;
          moderation_flagged: boolean | null;
          retention_until: string | null;
          storage_bucket: string | null;
          storage_path: string;
          upload_status: string | null;
          user_id: string;
        };
        Insert: {
          conversation_id?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          file_name: string;
          file_size: number;
          file_type: string;
          id?: string;
          message_id?: string | null;
          moderated?: boolean | null;
          moderation_flagged?: boolean | null;
          retention_until?: string | null;
          storage_bucket?: string | null;
          storage_path: string;
          upload_status?: string | null;
          user_id: string;
        };
        Update: {
          conversation_id?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          file_name?: string;
          file_size?: number;
          file_type?: string;
          id?: string;
          message_id?: string | null;
          moderated?: boolean | null;
          moderation_flagged?: boolean | null;
          retention_until?: string | null;
          storage_bucket?: string | null;
          storage_path?: string;
          upload_status?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'uploads_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'uploads_message_id_fkey';
            columns: ['message_id'];
            isOneToOne: false;
            referencedRelation: 'messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'uploads_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      usage_tracking: {
        Row: {
          cached_input_cost: number | null;
          cached_input_tokens: number | null;
          conversation_id: string | null;
          created_at: string | null;
          id: string;
          image_processing_count: number | null;
          input_cost: number | null;
          input_tokens: number | null;
          live_search_calls: number | null;
          live_search_cost: number | null;
          message_id: string | null;
          model_name: string;
          output_cost: number | null;
          output_tokens: number | null;
          retention_until: string | null;
          total_cost: number | null;
          user_id: string;
        };
        Insert: {
          cached_input_cost?: number | null;
          cached_input_tokens?: number | null;
          conversation_id?: string | null;
          created_at?: string | null;
          id?: string;
          image_processing_count?: number | null;
          input_cost?: number | null;
          input_tokens?: number | null;
          live_search_calls?: number | null;
          live_search_cost?: number | null;
          message_id?: string | null;
          model_name: string;
          output_cost?: number | null;
          output_tokens?: number | null;
          retention_until?: string | null;
          total_cost?: number | null;
          user_id: string;
        };
        Update: {
          cached_input_cost?: number | null;
          cached_input_tokens?: number | null;
          conversation_id?: string | null;
          created_at?: string | null;
          id?: string;
          image_processing_count?: number | null;
          input_cost?: number | null;
          input_tokens?: number | null;
          live_search_calls?: number | null;
          live_search_cost?: number | null;
          message_id?: string | null;
          model_name?: string;
          output_cost?: number | null;
          output_tokens?: number | null;
          retention_until?: string | null;
          total_cost?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'usage_tracking_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'usage_tracking_message_id_fkey';
            columns: ['message_id'];
            isOneToOne: false;
            referencedRelation: 'messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'usage_tracking_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_connections: {
        Row: {
          created_at: string | null;
          display_name: string | null;
          encrypted_token: string;
          id: string;
          is_active: boolean | null;
          metadata: Json | null;
          service: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          display_name?: string | null;
          encrypted_token: string;
          id?: string;
          is_active?: boolean | null;
          metadata?: Json | null;
          service: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          display_name?: string | null;
          encrypted_token?: string;
          id?: string;
          is_active?: boolean | null;
          metadata?: Json | null;
          service?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_document_chunks: {
        Row: {
          chunk_index: number;
          content: string;
          created_at: string | null;
          document_id: string;
          embedding: string | null;
          id: string;
          page_number: number | null;
          section_title: string | null;
          token_count: number | null;
          user_id: string;
        };
        Insert: {
          chunk_index: number;
          content: string;
          created_at?: string | null;
          document_id: string;
          embedding?: string | null;
          id?: string;
          page_number?: number | null;
          section_title?: string | null;
          token_count?: number | null;
          user_id: string;
        };
        Update: {
          chunk_index?: number;
          content?: string;
          created_at?: string | null;
          document_id?: string;
          embedding?: string | null;
          id?: string;
          page_number?: number | null;
          section_title?: string | null;
          token_count?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_document_chunks_document_id_fkey';
            columns: ['document_id'];
            isOneToOne: false;
            referencedRelation: 'user_documents';
            referencedColumns: ['id'];
          },
        ];
      };
      user_document_folders: {
        Row: {
          color: string | null;
          created_at: string | null;
          icon: string | null;
          id: string;
          name: string;
          parent_folder_id: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string | null;
          icon?: string | null;
          id?: string;
          name: string;
          parent_folder_id?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          color?: string | null;
          created_at?: string | null;
          icon?: string | null;
          id?: string;
          name?: string;
          parent_folder_id?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_document_folders_parent_folder_id_fkey';
            columns: ['parent_folder_id'];
            isOneToOne: false;
            referencedRelation: 'user_document_folders';
            referencedColumns: ['id'];
          },
        ];
      };
      user_documents: {
        Row: {
          chunk_count: number | null;
          created_at: string | null;
          error_message: string | null;
          file_size: number;
          file_type: string;
          folder_id: string | null;
          id: string;
          mime_type: string;
          name: string;
          original_filename: string;
          page_count: number | null;
          processed_at: string | null;
          status: string | null;
          storage_path: string;
          updated_at: string | null;
          user_id: string;
          word_count: number | null;
        };
        Insert: {
          chunk_count?: number | null;
          created_at?: string | null;
          error_message?: string | null;
          file_size: number;
          file_type: string;
          folder_id?: string | null;
          id?: string;
          mime_type: string;
          name: string;
          original_filename: string;
          page_count?: number | null;
          processed_at?: string | null;
          status?: string | null;
          storage_path: string;
          updated_at?: string | null;
          user_id: string;
          word_count?: number | null;
        };
        Update: {
          chunk_count?: number | null;
          created_at?: string | null;
          error_message?: string | null;
          file_size?: number;
          file_type?: string;
          folder_id?: string | null;
          id?: string;
          mime_type?: string;
          name?: string;
          original_filename?: string;
          page_count?: number | null;
          processed_at?: string | null;
          status?: string | null;
          storage_path?: string;
          updated_at?: string | null;
          user_id?: string;
          word_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'user_documents_folder_id_fkey';
            columns: ['folder_id'];
            isOneToOne: false;
            referencedRelation: 'user_document_folders';
            referencedColumns: ['id'];
          },
        ];
      };
      user_learning: {
        Row: {
          confidence: number;
          created_at: string | null;
          id: string;
          observation_count: number;
          preference_type: string;
          preference_value: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          confidence?: number;
          created_at?: string | null;
          id?: string;
          observation_count?: number;
          preference_type: string;
          preference_value: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          confidence?: number;
          created_at?: string | null;
          id?: string;
          observation_count?: number;
          preference_type?: string;
          preference_value?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_message_status: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          id: string;
          is_deleted: boolean | null;
          is_read: boolean | null;
          is_starred: boolean | null;
          message_id: string;
          read_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          is_deleted?: boolean | null;
          is_read?: boolean | null;
          is_starred?: boolean | null;
          message_id: string;
          read_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          is_deleted?: boolean | null;
          is_read?: boolean | null;
          is_starred?: boolean | null;
          message_id?: string;
          read_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_message_status_message_id_fkey';
            columns: ['message_id'];
            isOneToOne: false;
            referencedRelation: 'user_messages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_message_status_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_messages: {
        Row: {
          broadcast_sent_count: number | null;
          created_at: string | null;
          expires_at: string | null;
          id: string;
          is_broadcast: boolean | null;
          is_pinned: boolean | null;
          message: string;
          message_type: string | null;
          priority: string | null;
          recipient_tier: string | null;
          recipient_user_id: string | null;
          sender_admin_email: string;
          sender_admin_id: string | null;
          subject: string;
        };
        Insert: {
          broadcast_sent_count?: number | null;
          created_at?: string | null;
          expires_at?: string | null;
          id?: string;
          is_broadcast?: boolean | null;
          is_pinned?: boolean | null;
          message: string;
          message_type?: string | null;
          priority?: string | null;
          recipient_tier?: string | null;
          recipient_user_id?: string | null;
          sender_admin_email: string;
          sender_admin_id?: string | null;
          subject: string;
        };
        Update: {
          broadcast_sent_count?: number | null;
          created_at?: string | null;
          expires_at?: string | null;
          id?: string;
          is_broadcast?: boolean | null;
          is_pinned?: boolean | null;
          message?: string;
          message_type?: string | null;
          priority?: string | null;
          recipient_tier?: string | null;
          recipient_user_id?: string | null;
          sender_admin_email?: string;
          sender_admin_id?: string | null;
          subject?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_messages_recipient_user_id_fkey';
            columns: ['recipient_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_messages_sender_admin_id_fkey';
            columns: ['sender_admin_id'];
            isOneToOne: false;
            referencedRelation: 'admin_users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_passkeys: {
        Row: {
          counter: number;
          created_at: string | null;
          credential_id: string;
          device_name: string;
          id: string;
          last_used_at: string | null;
          public_key: string;
          transports: string[] | null;
          user_id: string;
        };
        Insert: {
          counter?: number;
          created_at?: string | null;
          credential_id: string;
          device_name?: string;
          id?: string;
          last_used_at?: string | null;
          public_key: string;
          transports?: string[] | null;
          user_id: string;
        };
        Update: {
          counter?: number;
          created_at?: string | null;
          credential_id?: string;
          device_name?: string;
          id?: string;
          last_used_at?: string | null;
          public_key?: string;
          transports?: string[] | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_passkeys_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_provider_preferences: {
        Row: {
          auto_switch_enabled: boolean | null;
          cost_optimization_enabled: boolean | null;
          created_at: string | null;
          default_provider: Database['public']['Enums']['ai_provider'] | null;
          fallback_provider: Database['public']['Enums']['ai_provider'] | null;
          id: string;
          provider_api_keys: Json | null;
          provider_settings: Json | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          auto_switch_enabled?: boolean | null;
          cost_optimization_enabled?: boolean | null;
          created_at?: string | null;
          default_provider?: Database['public']['Enums']['ai_provider'] | null;
          fallback_provider?: Database['public']['Enums']['ai_provider'] | null;
          id?: string;
          provider_api_keys?: Json | null;
          provider_settings?: Json | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          auto_switch_enabled?: boolean | null;
          cost_optimization_enabled?: boolean | null;
          created_at?: string | null;
          default_provider?: Database['public']['Enums']['ai_provider'] | null;
          fallback_provider?: Database['public']['Enums']['ai_provider'] | null;
          id?: string;
          provider_api_keys?: Json | null;
          provider_settings?: Json | null;
          updated_at?: string | null;
          user_id?: string;
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
      user_settings: {
        Row: {
          created_at: string | null;
          id: string;
          theme: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          theme?: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          theme?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          api_key_pool: number | null;
          assigned_api_key_index: number | null;
          ban_reason: string | null;
          created_at: string | null;
          deleted_at: string | null;
          email: string;
          field: string | null;
          full_name: string | null;
          github_token: string | null;
          github_username: string | null;
          id: string;
          images_generated_today: number | null;
          is_active: boolean | null;
          is_admin: boolean | null;
          is_banned: boolean | null;
          last_login_at: string | null;
          last_message_date: string | null;
          messages_used_today: number | null;
          passkey_prompt_dismissed: boolean | null;
          purpose: string | null;
          role: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string | null;
          subscription_tier: string | null;
          total_images: number | null;
          total_messages: number | null;
          uber_access_token: string | null;
          uber_connected_at: string | null;
          uber_email: string | null;
          uber_first_name: string | null;
          uber_last_name: string | null;
          uber_refresh_token: string | null;
          uber_token_expires_at: string | null;
          uber_user_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          api_key_pool?: number | null;
          assigned_api_key_index?: number | null;
          ban_reason?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          email: string;
          field?: string | null;
          full_name?: string | null;
          github_token?: string | null;
          github_username?: string | null;
          id: string;
          images_generated_today?: number | null;
          is_active?: boolean | null;
          is_admin?: boolean | null;
          is_banned?: boolean | null;
          last_login_at?: string | null;
          last_message_date?: string | null;
          messages_used_today?: number | null;
          passkey_prompt_dismissed?: boolean | null;
          purpose?: string | null;
          role?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          subscription_tier?: string | null;
          total_images?: number | null;
          total_messages?: number | null;
          uber_access_token?: string | null;
          uber_connected_at?: string | null;
          uber_email?: string | null;
          uber_first_name?: string | null;
          uber_last_name?: string | null;
          uber_refresh_token?: string | null;
          uber_token_expires_at?: string | null;
          uber_user_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          api_key_pool?: number | null;
          assigned_api_key_index?: number | null;
          ban_reason?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          email?: string;
          field?: string | null;
          full_name?: string | null;
          github_token?: string | null;
          github_username?: string | null;
          id?: string;
          images_generated_today?: number | null;
          is_active?: boolean | null;
          is_admin?: boolean | null;
          is_banned?: boolean | null;
          last_login_at?: string | null;
          last_message_date?: string | null;
          messages_used_today?: number | null;
          passkey_prompt_dismissed?: boolean | null;
          purpose?: string | null;
          role?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          subscription_tier?: string | null;
          total_images?: number | null;
          total_messages?: number | null;
          uber_access_token?: string | null;
          uber_connected_at?: string | null;
          uber_email?: string | null;
          uber_first_name?: string | null;
          uber_last_name?: string | null;
          uber_refresh_token?: string | null;
          uber_token_expires_at?: string | null;
          uber_user_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      waitlist: {
        Row: {
          created_at: string | null;
          email: string;
          id: string;
          source: string | null;
        };
        Insert: {
          created_at?: string | null;
          email: string;
          id?: string;
          source?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string;
          id?: string;
          source?: string | null;
        };
        Relationships: [];
      };
      website_templates: {
        Row: {
          category: Database['public']['Enums']['template_category'];
          color_scheme: Json | null;
          created_at: string | null;
          css_template: string | null;
          customization_hints: string | null;
          description: string | null;
          features: string[] | null;
          fonts: Json | null;
          has_desktop: boolean | null;
          has_mobile: boolean | null;
          has_tablet: boolean | null;
          html_template: string;
          id: string;
          image_slots: Json | null;
          is_active: boolean | null;
          is_premium: boolean | null;
          js_template: string | null;
          layout: Database['public']['Enums']['layout_type'] | null;
          name: string;
          placeholder_mappings: Json | null;
          preview_url: string | null;
          rating: number | null;
          sections: string[] | null;
          slug: string;
          style: Database['public']['Enums']['design_style'] | null;
          subcategories: string[] | null;
          tags: string[] | null;
          thumbnail_url: string | null;
          times_used: number | null;
          updated_at: string | null;
        };
        Insert: {
          category: Database['public']['Enums']['template_category'];
          color_scheme?: Json | null;
          created_at?: string | null;
          css_template?: string | null;
          customization_hints?: string | null;
          description?: string | null;
          features?: string[] | null;
          fonts?: Json | null;
          has_desktop?: boolean | null;
          has_mobile?: boolean | null;
          has_tablet?: boolean | null;
          html_template: string;
          id?: string;
          image_slots?: Json | null;
          is_active?: boolean | null;
          is_premium?: boolean | null;
          js_template?: string | null;
          layout?: Database['public']['Enums']['layout_type'] | null;
          name: string;
          placeholder_mappings?: Json | null;
          preview_url?: string | null;
          rating?: number | null;
          sections?: string[] | null;
          slug: string;
          style?: Database['public']['Enums']['design_style'] | null;
          subcategories?: string[] | null;
          tags?: string[] | null;
          thumbnail_url?: string | null;
          times_used?: number | null;
          updated_at?: string | null;
        };
        Update: {
          category?: Database['public']['Enums']['template_category'];
          color_scheme?: Json | null;
          created_at?: string | null;
          css_template?: string | null;
          customization_hints?: string | null;
          description?: string | null;
          features?: string[] | null;
          fonts?: Json | null;
          has_desktop?: boolean | null;
          has_mobile?: boolean | null;
          has_tablet?: boolean | null;
          html_template?: string;
          id?: string;
          image_slots?: Json | null;
          is_active?: boolean | null;
          is_premium?: boolean | null;
          js_template?: string | null;
          layout?: Database['public']['Enums']['layout_type'] | null;
          name?: string;
          placeholder_mappings?: Json | null;
          preview_url?: string | null;
          rating?: number | null;
          sections?: string[] | null;
          slug?: string;
          style?: Database['public']['Enums']['design_style'] | null;
          subcategories?: string[] | null;
          tags?: string[] | null;
          thumbnail_url?: string | null;
          times_used?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      workspace_snapshots: {
        Row: {
          created_at: string | null;
          description: string | null;
          file_tree: Json;
          git_commit: string | null;
          id: string;
          name: string | null;
          workspace_id: string;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          file_tree: Json;
          git_commit?: string | null;
          id?: string;
          name?: string | null;
          workspace_id: string;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          file_tree?: Json;
          git_commit?: string | null;
          id?: string;
          name?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_snapshots_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      workspaces: {
        Row: {
          config: Json | null;
          container_id: string | null;
          container_template: string | null;
          created_at: string | null;
          env_vars: Json | null;
          github_branch: string | null;
          github_repo: string | null;
          github_token_encrypted: string | null;
          id: string;
          last_accessed_at: string | null;
          name: string;
          status: string;
          type: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          config?: Json | null;
          container_id?: string | null;
          container_template?: string | null;
          created_at?: string | null;
          env_vars?: Json | null;
          github_branch?: string | null;
          github_repo?: string | null;
          github_token_encrypted?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          name: string;
          status?: string;
          type?: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          config?: Json | null;
          container_id?: string | null;
          container_template?: string | null;
          created_at?: string | null;
          env_vars?: Json | null;
          github_branch?: string | null;
          github_repo?: string | null;
          github_token_encrypted?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          name?: string;
          status?: string;
          type?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      admin_revenue_summary: {
        Row: {
          month: string | null;
          subscription_count: number | null;
          tier: string | null;
          total_revenue: number | null;
        };
        Relationships: [];
      };
      provider_usage_analytics: {
        Row: {
          provider: Database['public']['Enums']['ai_provider'] | null;
          request_count: number | null;
          total_input_tokens: number | null;
          total_output_tokens: number | null;
          unique_users: number | null;
          usage_date: string | null;
        };
        Relationships: [];
      };
      soft_deleted_data: {
        Row: {
          deleted_at: string | null;
          hard_delete_date: string | null;
          id: string | null;
          retention_until: string | null;
          time_since_deletion: string | null;
          type: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      cleanup_low_confidence_learning: { Args: never; Returns: undefined };
      cleanup_old_rate_limits: { Args: never; Returns: undefined };
      current_user_id: { Args: never; Returns: string };
      delete_expired_data: { Args: never; Returns: undefined };
      delete_user_message: {
        Args: { p_message_id: string; p_user_id: string };
        Returns: undefined;
      };
      get_settings: {
        Args: never;
        Returns: {
          accent_color: string | null;
          background_color: string | null;
          created_at: string | null;
          facebook_url: string | null;
          favicon: string | null;
          glassmorphism_enabled: boolean | null;
          google_oauth_enabled: boolean | null;
          header_logo: string | null;
          id: string;
          instagram_url: string | null;
          linkedin_url: string | null;
          login_logo: string | null;
          maintenance_mode: boolean | null;
          meta_description: string | null;
          meta_keywords: string[] | null;
          og_image: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          sidebar_logo: string | null;
          signup_enabled: boolean | null;
          site_name: string | null;
          site_tagline: string | null;
          support_email: string | null;
          support_phone: string | null;
          theme_mode: string | null;
          twitter_url: string | null;
          updated_at: string | null;
          updated_by: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'settings';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_user_document_stats: {
        Args: { p_user_id: string };
        Returns: {
          total_chunks: number;
          total_documents: number;
          total_folders: number;
          total_size_bytes: number;
        }[];
      };
      get_user_folder_count: { Args: { p_user_id: string }; Returns: number };
      get_user_messages: {
        Args: { p_user_id: string };
        Returns: {
          created_at: string;
          is_broadcast: boolean;
          is_read: boolean;
          is_starred: boolean;
          message: string;
          message_id: string;
          message_type: string;
          priority: string;
          sender_admin_email: string;
          subject: string;
        }[];
      };
      get_user_unread_count: { Args: { p_user_id: string }; Returns: number };
      increment_template_usage: {
        Args: { p_template_id: string };
        Returns: undefined;
      };
      is_admin: { Args: never; Returns: boolean };
      mark_user_message_read: {
        Args: { p_message_id: string; p_user_id: string };
        Returns: undefined;
      };
      recover_soft_deleted_conversation: {
        Args: { conversation_uuid: string };
        Returns: undefined;
      };
      reorder_folders: {
        Args: { p_folder_ids: string[]; p_user_id: string };
        Returns: undefined;
      };
      reset_daily_usage: { Args: never; Returns: undefined };
      sanitize_search_query: { Args: { query: string }; Returns: string };
      search_codebase_chunks: {
        Args: {
          p_chunk_types?: string[];
          p_file_types?: string[];
          p_index_id: string;
          p_match_count?: number;
          p_match_threshold?: number;
          p_query_embedding: string;
        };
        Returns: {
          chunk_id: string;
          chunk_type: string;
          content: string;
          end_line: number;
          file_path: string;
          language: string;
          metadata: Json;
          similarity: number;
          start_line: number;
        }[];
      };
      search_user_documents: {
        Args: {
          p_match_count?: number;
          p_match_threshold?: number;
          p_query_embedding: string;
          p_user_id: string;
        };
        Returns: {
          chunk_id: string;
          content: string;
          document_id: string;
          document_name: string;
          folder_name: string;
          page_number: number;
          section_title: string;
          similarity: number;
        }[];
      };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { '': string }; Returns: string[] };
    };
    Enums: {
      ai_provider: 'claude' | 'openai' | 'xai' | 'deepseek';
      design_style:
        | 'modern'
        | 'minimal'
        | 'bold'
        | 'elegant'
        | 'playful'
        | 'corporate'
        | 'creative'
        | 'dark'
        | 'light'
        | 'colorful'
        | 'glassmorphism'
        | 'brutalist'
        | 'retro'
        | 'futuristic';
      layout_type:
        | 'single-page'
        | 'multi-section'
        | 'split-screen'
        | 'hero-focused'
        | 'grid-based'
        | 'magazine'
        | 'portfolio-grid'
        | 'cards';
      template_category:
        | 'hero-landing'
        | 'ecommerce-full'
        | 'ecommerce-minimal'
        | 'saas-product'
        | 'ai-tech'
        | 'agency'
        | 'professional-services'
        | 'local-business'
        | 'restaurant-food'
        | 'health-wellness'
        | 'portfolio-minimal'
        | 'portfolio-creative'
        | 'blog-magazine'
        | 'personal-brand'
        | 'event-conference'
        | 'wedding-celebration'
        | 'real-estate'
        | 'education-course'
        | 'nonprofit-charity'
        | 'coming-soon'
        | 'app-download'
        | 'membership-community';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      ai_provider: ['claude', 'openai', 'xai', 'deepseek'],
      design_style: [
        'modern',
        'minimal',
        'bold',
        'elegant',
        'playful',
        'corporate',
        'creative',
        'dark',
        'light',
        'colorful',
        'glassmorphism',
        'brutalist',
        'retro',
        'futuristic',
      ],
      layout_type: [
        'single-page',
        'multi-section',
        'split-screen',
        'hero-focused',
        'grid-based',
        'magazine',
        'portfolio-grid',
        'cards',
      ],
      template_category: [
        'hero-landing',
        'ecommerce-full',
        'ecommerce-minimal',
        'saas-product',
        'ai-tech',
        'agency',
        'professional-services',
        'local-business',
        'restaurant-food',
        'health-wellness',
        'portfolio-minimal',
        'portfolio-creative',
        'blog-magazine',
        'personal-brand',
        'event-conference',
        'wedding-celebration',
        'real-estate',
        'education-course',
        'nonprofit-charity',
        'coming-soon',
        'app-download',
        'membership-community',
      ],
    },
  },
} as const;
