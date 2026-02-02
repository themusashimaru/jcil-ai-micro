/**
 * SAGA-PATTERN TOOL
 * Comprehensive saga pattern implementation for distributed transactions
 * Supports: choreography, orchestration, compensating transactions, recovery
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

type SagaType = 'choreography' | 'orchestration';
type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'compensating' | 'compensated' | 'skipped';
type SagaStatus = 'created' | 'running' | 'completed' | 'failed' | 'compensating' | 'compensated' | 'partially_compensated';

interface SagaStep {
  id: string;
  name: string;
  serviceName: string;
  action: StepAction;
  compensation: StepAction | null;
  status: StepStatus;
  retryCount: number;
  maxRetries: number;
  timeout: number;
  executedAt?: number;
  completedAt?: number;
  error?: string;
  result?: unknown;
  compensationResult?: unknown;
  semanticLock?: SemanticLock;
  idempotencyKey: string;
  dependencies: string[];
}

interface StepAction {
  type: string;
  params: Record<string, unknown>;
  expectedDuration: number;
}

interface SemanticLock {
  resourceId: string;
  lockType: 'read' | 'write' | 'exclusive';
  acquiredAt?: number;
  releasedAt?: number;
  held: boolean;
}

interface Saga {
  id: string;
  name: string;
  type: SagaType;
  steps: SagaStep[];
  status: SagaStatus;
  currentStepIndex: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  context: Record<string, unknown>;
  log: SagaLogEntry[];
  retryPolicy: RetryPolicy;
  timeoutMs: number;
  compensationStrategy: 'backward' | 'forward' | 'semantic';
}

interface SagaLogEntry {
  timestamp: number;
  stepId: string | null;
  action: string;
  status: string;
  details: string;
  error?: string;
}

interface RetryPolicy {
  maxRetries: number;
  backoffType: 'fixed' | 'exponential' | 'linear';
  initialDelayMs: number;
  maxDelayMs: number;
  retryableErrors: string[];
}

interface ExecutionResult {
  sagaId: string;
  status: SagaStatus;
  completedSteps: string[];
  failedStep?: string;
  error?: string;
  duration: number;
  compensationRequired: boolean;
}

interface StepResult {
  stepId: string;
  status: StepStatus;
  result?: unknown;
  error?: string;
  duration: number;
  retryCount: number;
}

interface CompensationResult {
  sagaId: string;
  compensatedSteps: string[];
  failedCompensations: string[];
  status: SagaStatus;
  duration: number;
}

interface SagaAnalysis {
  sagaId: string;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  compensatedSteps: number;
  totalDuration: number;
  averageStepDuration: number;
  criticalPath: string[];
  potentialBottlenecks: string[];
  recommendations: string[];
}

interface SagaVisualization {
  sagaId: string;
  flowDiagram: string;
  timeline: Array<{
    stepId: string;
    name: string;
    status: StepStatus;
    startTime: number;
    endTime?: number;
  }>;
}

// ============================================================================
// IN-MEMORY STORAGE
// ============================================================================

const sagas: Map<string, Saga> = new Map();
const executedIdempotencyKeys: Set<string> = new Set();

// ============================================================================
// SAGA CREATION
// ============================================================================

function createSaga(config: {
  sagaId?: string;
  name: string;
  type?: SagaType;
  compensationStrategy?: 'backward' | 'forward' | 'semantic';
  timeoutMs?: number;
  retryPolicy?: Partial<RetryPolicy>;
  context?: Record<string, unknown>;
}): Saga {
  const sagaId = config.sagaId || `saga_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const retryPolicy: RetryPolicy = {
    maxRetries: config.retryPolicy?.maxRetries ?? 3,
    backoffType: config.retryPolicy?.backoffType ?? 'exponential',
    initialDelayMs: config.retryPolicy?.initialDelayMs ?? 100,
    maxDelayMs: config.retryPolicy?.maxDelayMs ?? 10000,
    retryableErrors: config.retryPolicy?.retryableErrors ?? ['TIMEOUT', 'TEMPORARY_FAILURE', 'NETWORK_ERROR']
  };

  const saga: Saga = {
    id: sagaId,
    name: config.name,
    type: config.type || 'orchestration',
    steps: [],
    status: 'created',
    currentStepIndex: -1,
    createdAt: Date.now(),
    context: config.context || {},
    log: [],
    retryPolicy,
    timeoutMs: config.timeoutMs || 300000, // 5 minutes default
    compensationStrategy: config.compensationStrategy || 'backward'
  };

  addLogEntry(saga, null, 'CREATE', 'created', `Saga ${config.name} created`);
  sagas.set(sagaId, saga);

  return saga;
}

function addStep(sagaId: string, step: {
  name: string;
  serviceName: string;
  action: StepAction;
  compensation?: StepAction;
  timeout?: number;
  maxRetries?: number;
  dependencies?: string[];
  semanticLock?: Omit<SemanticLock, 'acquiredAt' | 'releasedAt' | 'held'>;
}): SagaStep {
  const saga = sagas.get(sagaId);
  if (!saga) throw new Error(`Saga ${sagaId} not found`);
  if (saga.status !== 'created') throw new Error(`Cannot add steps to saga in ${saga.status} status`);

  const stepId = `step_${saga.steps.length}_${Date.now()}`;
  const idempotencyKey = `${sagaId}:${stepId}:${Date.now()}`;

  const sagaStep: SagaStep = {
    id: stepId,
    name: step.name,
    serviceName: step.serviceName,
    action: step.action,
    compensation: step.compensation || null,
    status: 'pending',
    retryCount: 0,
    maxRetries: step.maxRetries ?? saga.retryPolicy.maxRetries,
    timeout: step.timeout || 30000,
    idempotencyKey,
    dependencies: step.dependencies || [],
    semanticLock: step.semanticLock ? {
      ...step.semanticLock,
      held: false
    } : undefined
  };

  saga.steps.push(sagaStep);
  addLogEntry(saga, stepId, 'ADD_STEP', 'pending', `Added step: ${step.name}`);

  return sagaStep;
}

function addCompensation(sagaId: string, stepId: string, compensation: StepAction): SagaStep {
  const saga = sagas.get(sagaId);
  if (!saga) throw new Error(`Saga ${sagaId} not found`);

  const step = saga.steps.find(s => s.id === stepId);
  if (!step) throw new Error(`Step ${stepId} not found`);

  step.compensation = compensation;
  addLogEntry(saga, stepId, 'ADD_COMPENSATION', step.status, `Added compensation for step: ${step.name}`);

  return step;
}

// ============================================================================
// SAGA EXECUTION
// ============================================================================

async function executeSaga(sagaId: string, options?: {
  simulateFailure?: string;
  failureType?: string;
}): Promise<ExecutionResult> {
  const saga = sagas.get(sagaId);
  if (!saga) throw new Error(`Saga ${sagaId} not found`);
  if (saga.status !== 'created') throw new Error(`Saga already in ${saga.status} status`);

  saga.status = 'running';
  saga.startedAt = Date.now();
  saga.currentStepIndex = 0;

  addLogEntry(saga, null, 'START', 'running', 'Saga execution started');

  const completedSteps: string[] = [];
  let failedStep: string | undefined;
  let error: string | undefined;

  try {
    if (saga.type === 'orchestration') {
      // Execute steps sequentially
      for (let i = 0; i < saga.steps.length; i++) {
        const step = saga.steps[i];
        saga.currentStepIndex = i;

        // Check dependencies
        const depsOk = checkDependencies(saga, step);
        if (!depsOk) {
          throw new Error(`Dependencies not satisfied for step ${step.name}`);
        }

        // Execute step
        const result = await executeStep(saga, step, options);

        if (result.status === 'completed') {
          completedSteps.push(step.id);
        } else if (result.status === 'failed') {
          failedStep = step.id;
          error = result.error;
          throw new Error(result.error || 'Step failed');
        }
      }

      saga.status = 'completed';
      saga.completedAt = Date.now();
      addLogEntry(saga, null, 'COMPLETE', 'completed', 'Saga completed successfully');
    } else {
      // Choreography: steps publish events and react
      await executeChoreography(saga, options);
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    saga.status = 'failed';
    error = err;
    addLogEntry(saga, failedStep || null, 'FAIL', 'failed', `Saga failed: ${err}`, err);
  }

  const duration = Date.now() - saga.startedAt;

  return {
    sagaId,
    status: saga.status,
    completedSteps,
    failedStep,
    error,
    duration,
    compensationRequired: saga.status === 'failed' && completedSteps.length > 0
  };
}

async function executeStep(saga: Saga, step: SagaStep, options?: {
  simulateFailure?: string;
  failureType?: string;
}): Promise<StepResult> {
  step.status = 'running';
  step.executedAt = Date.now();

  addLogEntry(saga, step.id, 'EXECUTE', 'running', `Executing step: ${step.name}`);

  // Check idempotency
  if (executedIdempotencyKeys.has(step.idempotencyKey)) {
    step.status = 'completed';
    addLogEntry(saga, step.id, 'IDEMPOTENT_SKIP', 'completed', 'Step already executed (idempotent)');
    return {
      stepId: step.id,
      status: 'completed',
      duration: 0,
      retryCount: step.retryCount
    };
  }

  // Acquire semantic lock if needed
  if (step.semanticLock) {
    step.semanticLock.acquiredAt = Date.now();
    step.semanticLock.held = true;
    addLogEntry(saga, step.id, 'LOCK_ACQUIRED', 'running', `Acquired lock on ${step.semanticLock.resourceId}`);
  }

  try {
    // Simulate failure if requested
    if (options?.simulateFailure === step.id) {
      throw new Error(options.failureType || 'SIMULATED_FAILURE');
    }

    // Simulate step execution
    const execTime = step.action.expectedDuration || Math.random() * 1000;
    await simulateDelay(execTime);

    // Mark as executed for idempotency
    executedIdempotencyKeys.add(step.idempotencyKey);

    step.status = 'completed';
    step.completedAt = Date.now();
    step.result = { success: true, action: step.action.type };

    addLogEntry(saga, step.id, 'COMPLETE', 'completed', `Step completed: ${step.name}`);

    return {
      stepId: step.id,
      status: 'completed',
      result: step.result,
      duration: step.completedAt - step.executedAt,
      retryCount: step.retryCount
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    step.error = err;

    // Check if error is retryable
    const isRetryable = saga.retryPolicy.retryableErrors.some(re =>
      err.includes(re)
    );

    if (isRetryable && step.retryCount < step.maxRetries) {
      step.retryCount++;
      const delay = calculateBackoff(saga.retryPolicy, step.retryCount);

      addLogEntry(saga, step.id, 'RETRY', 'running',
        `Retrying step (attempt ${step.retryCount}/${step.maxRetries}) after ${delay}ms`);

      await simulateDelay(delay);
      return executeStep(saga, step, options);
    }

    step.status = 'failed';
    addLogEntry(saga, step.id, 'FAIL', 'failed', `Step failed: ${err}`, err);

    // Release semantic lock on failure
    if (step.semanticLock) {
      step.semanticLock.releasedAt = Date.now();
      step.semanticLock.held = false;
    }

    return {
      stepId: step.id,
      status: 'failed',
      error: err,
      duration: Date.now() - (step.executedAt || Date.now()),
      retryCount: step.retryCount
    };
  }
}

async function executeChoreography(saga: Saga, options?: {
  simulateFailure?: string;
  failureType?: string;
}): Promise<void> {
  // In choreography, each step publishes an event that triggers the next
  const eventBus: Array<{ type: string; stepId: string; payload: unknown }> = [];

  // Start with first step
  const firstStep = saga.steps[0];
  if (firstStep) {
    const result = await executeStep(saga, firstStep, options);
    if (result.status === 'completed') {
      eventBus.push({
        type: `${firstStep.serviceName}.${firstStep.action.type}.completed`,
        stepId: firstStep.id,
        payload: result.result
      });
    } else {
      throw new Error(result.error || 'First step failed');
    }
  }

  // Process events and trigger subsequent steps
  while (eventBus.length > 0) {
    const event = eventBus.shift()!;

    // Find steps that react to this event
    const nextSteps = saga.steps.filter(s =>
      s.status === 'pending' &&
      s.dependencies.includes(event.stepId)
    );

    for (const step of nextSteps) {
      const result = await executeStep(saga, step, options);
      if (result.status === 'completed') {
        eventBus.push({
          type: `${step.serviceName}.${step.action.type}.completed`,
          stepId: step.id,
          payload: result.result
        });
      } else {
        throw new Error(result.error || `Step ${step.name} failed`);
      }
    }
  }

  // Check if all steps completed
  const allCompleted = saga.steps.every(s => s.status === 'completed');
  if (allCompleted) {
    saga.status = 'completed';
    saga.completedAt = Date.now();
  }
}

// ============================================================================
// COMPENSATION (ROLLBACK)
// ============================================================================

async function rollback(sagaId: string, options?: {
  fromStep?: string;
  simulateFailure?: string;
}): Promise<CompensationResult> {
  const saga = sagas.get(sagaId);
  if (!saga) throw new Error(`Saga ${sagaId} not found`);

  if (saga.status !== 'failed' && saga.status !== 'running') {
    throw new Error(`Cannot rollback saga in ${saga.status} status`);
  }

  saga.status = 'compensating';
  const startTime = Date.now();

  addLogEntry(saga, null, 'ROLLBACK_START', 'compensating', 'Starting compensation');

  const compensatedSteps: string[] = [];
  const failedCompensations: string[] = [];

  // Get steps to compensate
  let stepsToCompensate: SagaStep[];

  if (saga.compensationStrategy === 'backward') {
    // Backward recovery: compensate in reverse order
    stepsToCompensate = [...saga.steps]
      .filter(s => s.status === 'completed')
      .reverse();
  } else if (saga.compensationStrategy === 'forward') {
    // Forward recovery: try to complete remaining steps
    stepsToCompensate = saga.steps.filter(s => s.status === 'failed');
    // Then compensate completed ones if forward fails
  } else {
    // Semantic compensation: use semantic locks
    stepsToCompensate = saga.steps.filter(s =>
      s.status === 'completed' && s.semanticLock?.held
    );
  }

  // Start from specific step if provided
  if (options?.fromStep) {
    const startIdx = stepsToCompensate.findIndex(s => s.id === options.fromStep);
    if (startIdx !== -1) {
      stepsToCompensate = stepsToCompensate.slice(startIdx);
    }
  }

  for (const step of stepsToCompensate) {
    if (!step.compensation) {
      addLogEntry(saga, step.id, 'NO_COMPENSATION', step.status,
        `No compensation defined for step: ${step.name}`);
      continue;
    }

    step.status = 'compensating';
    addLogEntry(saga, step.id, 'COMPENSATE_START', 'compensating',
      `Compensating step: ${step.name}`);

    try {
      // Simulate failure if requested
      if (options?.simulateFailure === step.id) {
        throw new Error('COMPENSATION_FAILED');
      }

      // Execute compensation
      await simulateDelay(step.compensation.expectedDuration || 500);

      step.status = 'compensated';
      step.compensationResult = { compensated: true, action: step.compensation.type };

      // Release semantic lock
      if (step.semanticLock) {
        step.semanticLock.releasedAt = Date.now();
        step.semanticLock.held = false;
      }

      compensatedSteps.push(step.id);
      addLogEntry(saga, step.id, 'COMPENSATE_COMPLETE', 'compensated',
        `Compensation completed for: ${step.name}`);
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Unknown error';
      failedCompensations.push(step.id);
      addLogEntry(saga, step.id, 'COMPENSATE_FAIL', 'failed',
        `Compensation failed for: ${step.name}`, err);
    }
  }

  // Determine final status
  if (failedCompensations.length === 0) {
    saga.status = 'compensated';
    addLogEntry(saga, null, 'ROLLBACK_COMPLETE', 'compensated', 'Compensation completed');
  } else {
    saga.status = 'partially_compensated';
    addLogEntry(saga, null, 'ROLLBACK_PARTIAL', 'partially_compensated',
      `Partial compensation: ${failedCompensations.length} failed`);
  }

  return {
    sagaId,
    compensatedSteps,
    failedCompensations,
    status: saga.status,
    duration: Date.now() - startTime
  };
}

// ============================================================================
// RETRY AND RECOVERY
// ============================================================================

async function retryStep(sagaId: string, stepId: string): Promise<StepResult> {
  const saga = sagas.get(sagaId);
  if (!saga) throw new Error(`Saga ${sagaId} not found`);

  const step = saga.steps.find(s => s.id === stepId);
  if (!step) throw new Error(`Step ${stepId} not found`);

  if (step.status !== 'failed') {
    throw new Error(`Step is in ${step.status} status, cannot retry`);
  }

  // Reset step for retry
  step.status = 'pending';
  step.error = undefined;
  step.retryCount = 0;
  step.idempotencyKey = `${sagaId}:${stepId}:${Date.now()}`; // New idempotency key

  addLogEntry(saga, stepId, 'MANUAL_RETRY', 'pending', `Manual retry initiated for: ${step.name}`);

  return executeStep(saga, step);
}

function calculateBackoff(policy: RetryPolicy, attempt: number): number {
  let delay: number;

  switch (policy.backoffType) {
    case 'exponential':
      delay = policy.initialDelayMs * Math.pow(2, attempt - 1);
      break;
    case 'linear':
      delay = policy.initialDelayMs * attempt;
      break;
    case 'fixed':
    default:
      delay = policy.initialDelayMs;
  }

  return Math.min(delay, policy.maxDelayMs);
}

// ============================================================================
// STATUS AND ANALYSIS
// ============================================================================

function getStatus(sagaId: string): {
  saga: {
    id: string;
    name: string;
    type: SagaType;
    status: SagaStatus;
    currentStep: string | null;
    progress: number;
    duration: number | null;
  };
  steps: Array<{
    id: string;
    name: string;
    status: StepStatus;
    retryCount: number;
    error?: string;
  }>;
  recentLog: SagaLogEntry[];
} {
  const saga = sagas.get(sagaId);
  if (!saga) throw new Error(`Saga ${sagaId} not found`);

  const completedCount = saga.steps.filter(s =>
    s.status === 'completed' || s.status === 'compensated'
  ).length;

  const currentStep = saga.currentStepIndex >= 0 && saga.currentStepIndex < saga.steps.length
    ? saga.steps[saga.currentStepIndex]
    : null;

  return {
    saga: {
      id: saga.id,
      name: saga.name,
      type: saga.type,
      status: saga.status,
      currentStep: currentStep?.name || null,
      progress: saga.steps.length > 0 ? (completedCount / saga.steps.length) * 100 : 0,
      duration: saga.startedAt
        ? (saga.completedAt || Date.now()) - saga.startedAt
        : null
    },
    steps: saga.steps.map(s => ({
      id: s.id,
      name: s.name,
      status: s.status,
      retryCount: s.retryCount,
      error: s.error
    })),
    recentLog: saga.log.slice(-10)
  };
}

function analyzeSaga(sagaId: string): SagaAnalysis {
  const saga = sagas.get(sagaId);
  if (!saga) throw new Error(`Saga ${sagaId} not found`);

  const completedSteps = saga.steps.filter(s => s.status === 'completed');
  const failedSteps = saga.steps.filter(s => s.status === 'failed');
  const compensatedSteps = saga.steps.filter(s => s.status === 'compensated');

  // Calculate durations
  const stepDurations = saga.steps
    .filter(s => s.executedAt && s.completedAt)
    .map(s => s.completedAt! - s.executedAt!);

  const totalDuration = saga.startedAt
    ? (saga.completedAt || Date.now()) - saga.startedAt
    : 0;

  const avgDuration = stepDurations.length > 0
    ? stepDurations.reduce((a, b) => a + b, 0) / stepDurations.length
    : 0;

  // Find critical path (longest chain of dependencies)
  const criticalPath = findCriticalPath(saga);

  // Find potential bottlenecks
  const bottlenecks = saga.steps
    .filter(s => s.executedAt && s.completedAt &&
      (s.completedAt - s.executedAt) > avgDuration * 2)
    .map(s => s.name);

  // Generate recommendations
  const recommendations: string[] = [];

  if (failedSteps.length > 0) {
    recommendations.push(`${failedSteps.length} step(s) failed. Review error handling.`);
  }

  if (bottlenecks.length > 0) {
    recommendations.push(`Potential bottlenecks: ${bottlenecks.join(', ')}`);
  }

  const stepsWithoutCompensation = saga.steps.filter(s => !s.compensation);
  if (stepsWithoutCompensation.length > 0) {
    recommendations.push(`${stepsWithoutCompensation.length} step(s) lack compensation logic.`);
  }

  const highRetrySteps = saga.steps.filter(s => s.retryCount > 1);
  if (highRetrySteps.length > 0) {
    recommendations.push(`${highRetrySteps.length} step(s) required multiple retries.`);
  }

  return {
    sagaId,
    totalSteps: saga.steps.length,
    completedSteps: completedSteps.length,
    failedSteps: failedSteps.length,
    compensatedSteps: compensatedSteps.length,
    totalDuration,
    averageStepDuration: avgDuration,
    criticalPath,
    potentialBottlenecks: bottlenecks,
    recommendations
  };
}

function visualizeFlow(sagaId: string): SagaVisualization {
  const saga = sagas.get(sagaId);
  if (!saga) throw new Error(`Saga ${sagaId} not found`);

  // Build timeline
  const timeline = saga.steps.map(s => ({
    stepId: s.id,
    name: s.name,
    status: s.status,
    startTime: s.executedAt || 0,
    endTime: s.completedAt
  }));

  // Generate ASCII flow diagram
  const lines: string[] = [];
  lines.push(`Saga: ${saga.name} (${saga.type})`);
  lines.push(`Status: ${saga.status}`);
  lines.push('');
  lines.push('Flow:');
  lines.push('');

  for (let i = 0; i < saga.steps.length; i++) {
    const step = saga.steps[i];
    const statusIcon = getStatusIcon(step.status);
    const compensationMark = step.compensation ? ' [C]' : '';

    lines.push(`  ${i + 1}. [${statusIcon}] ${step.name}${compensationMark}`);
    lines.push(`      Service: ${step.serviceName}`);
    lines.push(`      Action: ${step.action.type}`);

    if (step.error) {
      lines.push(`      Error: ${step.error}`);
    }

    if (step.retryCount > 0) {
      lines.push(`      Retries: ${step.retryCount}`);
    }

    if (i < saga.steps.length - 1) {
      lines.push('      |');
      lines.push('      v');
    }
  }

  lines.push('');
  lines.push('Legend: [+]=completed, [x]=failed, [~]=compensated, [?]=pending, [>]=running');
  lines.push('[C]=has compensation');

  return {
    sagaId,
    flowDiagram: lines.join('\n'),
    timeline
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function addLogEntry(saga: Saga, stepId: string | null, action: string, status: string, details: string, error?: string): void {
  saga.log.push({
    timestamp: Date.now(),
    stepId,
    action,
    status,
    details,
    error
  });
}

function checkDependencies(saga: Saga, step: SagaStep): boolean {
  if (step.dependencies.length === 0) return true;

  return step.dependencies.every(depId => {
    const depStep = saga.steps.find(s => s.id === depId);
    return depStep && depStep.status === 'completed';
  });
}

function findCriticalPath(saga: Saga): string[] {
  // Simple critical path: longest chain based on dependencies
  const visited = new Set<string>();
  let longestPath: string[] = [];

  function dfs(stepId: string, path: string[]): void {
    if (visited.has(stepId)) return;
    visited.add(stepId);

    const step = saga.steps.find(s => s.id === stepId);
    if (!step) return;

    const newPath = [...path, step.name];

    // Find steps that depend on this one
    const dependents = saga.steps.filter(s => s.dependencies.includes(stepId));

    if (dependents.length === 0) {
      if (newPath.length > longestPath.length) {
        longestPath = newPath;
      }
    } else {
      for (const dep of dependents) {
        dfs(dep.id, newPath);
      }
    }
  }

  // Start from steps with no dependencies
  const rootSteps = saga.steps.filter(s => s.dependencies.length === 0);
  for (const root of rootSteps) {
    visited.clear();
    dfs(root.id, []);
  }

  return longestPath;
}

function getStatusIcon(status: StepStatus): string {
  switch (status) {
    case 'completed': return '+';
    case 'failed': return 'x';
    case 'compensated': return '~';
    case 'compensating': return '<';
    case 'running': return '>';
    case 'pending': return '?';
    case 'skipped': return '-';
    default: return '?';
  }
}

async function simulateDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, Math.min(ms, 100))); // Cap for testing
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const sagapatternTool: UnifiedTool = {
  name: 'saga_pattern',
  description: 'Saga pattern for distributed transactions with choreography, orchestration, and compensation',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'create_saga', 'add_step', 'add_compensation', 'execute',
          'rollback', 'get_status', 'retry_step', 'analyze_saga',
          'visualize_flow', 'get_log'
        ],
        description: 'Operation to perform'
      },
      sagaId: { type: 'string', description: 'Saga identifier' },
      name: { type: 'string', description: 'Saga or step name' },
      type: { type: 'string', enum: ['choreography', 'orchestration'], description: 'Saga type' },
      compensationStrategy: {
        type: 'string',
        enum: ['backward', 'forward', 'semantic'],
        description: 'Compensation strategy'
      },
      step: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          serviceName: { type: 'string' },
          action: { type: 'object' },
          compensation: { type: 'object' },
          timeout: { type: 'number' },
          maxRetries: { type: 'number' },
          dependencies: { type: 'array', items: { type: 'string' } }
        },
        description: 'Step configuration'
      },
      stepId: { type: 'string', description: 'Step identifier' },
      compensation: { type: 'object', description: 'Compensation action' },
      retryPolicy: { type: 'object', description: 'Retry policy configuration' },
      context: { type: 'object', description: 'Saga context' },
      timeoutMs: { type: 'number', description: 'Saga timeout in milliseconds' },
      simulateFailure: { type: 'string', description: 'Step ID to simulate failure' },
      failureType: { type: 'string', description: 'Type of failure to simulate' },
      fromStep: { type: 'string', description: 'Step ID to start compensation from' }
    },
    required: ['operation']
  }
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executesagapattern(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    let result: unknown;

    switch (operation) {
      case 'create_saga': {
        if (!args.name) throw new Error('name required');

        const saga = createSaga({
          sagaId: args.sagaId,
          name: args.name,
          type: args.type,
          compensationStrategy: args.compensationStrategy,
          timeoutMs: args.timeoutMs,
          retryPolicy: args.retryPolicy,
          context: args.context
        });

        result = {
          sagaId: saga.id,
          name: saga.name,
          type: saga.type,
          status: saga.status,
          compensationStrategy: saga.compensationStrategy
        };
        break;
      }

      case 'add_step': {
        if (!args.sagaId) throw new Error('sagaId required');
        if (!args.step) throw new Error('step required');
        if (!args.step.name) throw new Error('step.name required');
        if (!args.step.serviceName) throw new Error('step.serviceName required');
        if (!args.step.action) throw new Error('step.action required');

        const step = addStep(args.sagaId, args.step);

        result = {
          stepId: step.id,
          name: step.name,
          serviceName: step.serviceName,
          hasCompensation: !!step.compensation
        };
        break;
      }

      case 'add_compensation': {
        if (!args.sagaId) throw new Error('sagaId required');
        if (!args.stepId) throw new Error('stepId required');
        if (!args.compensation) throw new Error('compensation required');

        const step = addCompensation(args.sagaId, args.stepId, args.compensation);

        result = {
          stepId: step.id,
          name: step.name,
          compensationAdded: true
        };
        break;
      }

      case 'execute': {
        if (!args.sagaId) throw new Error('sagaId required');

        result = await executeSaga(args.sagaId, {
          simulateFailure: args.simulateFailure,
          failureType: args.failureType
        });
        break;
      }

      case 'rollback': {
        if (!args.sagaId) throw new Error('sagaId required');

        result = await rollback(args.sagaId, {
          fromStep: args.fromStep,
          simulateFailure: args.simulateFailure
        });
        break;
      }

      case 'get_status': {
        if (!args.sagaId) throw new Error('sagaId required');
        result = getStatus(args.sagaId);
        break;
      }

      case 'retry_step': {
        if (!args.sagaId) throw new Error('sagaId required');
        if (!args.stepId) throw new Error('stepId required');
        result = await retryStep(args.sagaId, args.stepId);
        break;
      }

      case 'analyze_saga': {
        if (!args.sagaId) throw new Error('sagaId required');
        result = analyzeSaga(args.sagaId);
        break;
      }

      case 'visualize_flow': {
        if (!args.sagaId) throw new Error('sagaId required');
        result = visualizeFlow(args.sagaId);
        break;
      }

      case 'get_log': {
        if (!args.sagaId) throw new Error('sagaId required');
        const saga = sagas.get(args.sagaId);
        if (!saga) throw new Error(`Saga ${args.sagaId} not found`);

        result = {
          sagaId: args.sagaId,
          log: saga.log
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2)
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function issagapatternAvailable(): boolean {
  return true;
}
