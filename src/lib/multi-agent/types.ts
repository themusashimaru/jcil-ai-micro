/**
 * MULTI-AGENT ARCHITECTURE TYPES
 *
 * Type definitions for the specialized AI agent system.
 * Each agent has domain expertise and can be orchestrated
 * to work together on complex tasks.
 */

export type AgentRole = 'frontend' | 'backend' | 'test' | 'reviewer' | 'orchestrator';

export interface AgentContext {
  userId: string;
  sessionId: string;
  repo?: {
    owner: string;
    name: string;
    branch: string;
    fullName: string;
  };
  previousMessages?: Array<{
    role: string;
    content: string;
  }>;
  files?: Array<{
    path: string;
    content: string;
  }>;
}

export interface AgentTask {
  id: string;
  type: AgentRole;
  description: string;
  input: string;
  context: AgentContext;
  dependencies?: string[]; // IDs of tasks that must complete first
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: string;
  error?: string;
}

export interface AgentResponse {
  role: AgentRole;
  content: string;
  files?: Array<{
    path: string;
    content: string;
    language?: string;
  }>;
  suggestions?: string[];
  confidence: number; // 0-1 confidence score
}

export interface OrchestrationPlan {
  tasks: AgentTask[];
  sequence: 'parallel' | 'sequential' | 'mixed';
  reasoning: string;
}

export interface AgentConfig {
  role: AgentRole;
  name: string;
  description: string;
  capabilities: string[];
  systemPrompt: string;
  model: 'claude-opus-4-6' | 'claude-sonnet-4-20250514';
  maxTokens: number;
  temperature?: number;
}
