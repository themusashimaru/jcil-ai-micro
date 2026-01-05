/**
 * AUTONOMOUS TASK TYPES
 *
 * Type definitions for background task execution.
 * Enables AI to work autonomously on complex multi-step tasks.
 */

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskStep {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  output?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface AutonomousTask {
  id: string;
  userId: string;
  sessionId: string;
  title: string;
  description: string;
  status: TaskStatus;
  steps: TaskStep[];
  currentStep: number;
  totalSteps: number;
  progress: number; // 0-100
  result?: string;
  error?: string;
  repo?: {
    owner: string;
    name: string;
    branch: string;
  };
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration?: number; // in seconds
}

export interface TaskContext {
  userId: string;
  sessionId: string;
  repo?: {
    owner: string;
    name: string;
    branch: string;
  };
  conversationHistory?: Array<{
    role: string;
    content: string;
  }>;
  githubToken?: string;
}

export interface TaskPlan {
  title: string;
  description: string;
  steps: Array<{
    name: string;
    description: string;
    type: 'analyze' | 'generate' | 'review' | 'test' | 'deploy';
    agentType?: 'frontend' | 'backend' | 'test' | 'reviewer';
  }>;
  estimatedDuration: number;
}

export interface TaskResult {
  success: boolean;
  output: string;
  files?: Array<{
    path: string;
    content: string;
    action: 'create' | 'update' | 'delete';
  }>;
  suggestions?: string[];
  nextSteps?: string[];
}
