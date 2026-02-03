/**
 * TWO-PHASE-COMMIT TOOL
 * Comprehensive 2PC/3PC protocol implementation for distributed transactions
 * Supports: coordinator/participant logic, recovery, blocking analysis, 3PC extension
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

type TransactionPhase =
  | 'init'
  | 'preparing'
  | 'prepared'
  | 'committing'
  | 'committed'
  | 'aborting'
  | 'aborted';
type ParticipantVote = 'yes' | 'no' | 'pending' | 'timeout';
type ParticipantState = 'initial' | 'working' | 'prepared' | 'committed' | 'aborted' | 'uncertain';
type CoordinatorState = 'initial' | 'waiting' | 'committing' | 'committed' | 'aborting' | 'aborted';
type ProtocolType = '2pc' | '3pc';
type RecoveryDecision = 'commit' | 'abort' | 'block' | 'heuristic_commit' | 'heuristic_abort';

interface Participant {
  id: string;
  address: string;
  state: ParticipantState;
  vote: ParticipantVote;
  preparedAt?: number;
  committedAt?: number;
  abortedAt?: number;
  lastHeartbeat: number;
  logEntries: LogEntry[];
  failureSimulated: boolean;
  responseDelay: number;
}

interface Coordinator {
  id: string;
  state: CoordinatorState;
  decision?: 'commit' | 'abort';
  decisionTime?: number;
  logEntries: LogEntry[];
  failureSimulated: boolean;
}

interface Transaction {
  id: string;
  protocol: ProtocolType;
  coordinator: Coordinator;
  participants: Map<string, Participant>;
  phase: TransactionPhase;
  startTime: number;
  endTime?: number;
  timeoutMs: number;
  presumedAbort: boolean;
  result?: TransactionResult;
  threePhaseState?: ThreePhaseState;
}

interface ThreePhaseState {
  preCommitAcks: Set<string>;
  preCommitPhase: boolean;
  canCommit: boolean;
}

interface TransactionResult {
  status: 'committed' | 'aborted';
  participantResults: Map<string, { vote: ParticipantVote; finalState: ParticipantState }>;
  duration: number;
  blockingOccurred: boolean;
  heuristicDecision: boolean;
}

interface LogEntry {
  timestamp: number;
  type: 'prepare' | 'vote_yes' | 'vote_no' | 'commit' | 'abort' | 'ack' | 'decision' | 'pre_commit';
  transactionId: string;
  participantId?: string;
  data?: unknown;
}

interface PrepareResult {
  transactionId: string;
  phase: TransactionPhase;
  votes: Record<string, ParticipantVote>;
  canCommit: boolean;
  timedOut: string[];
}

interface CommitResult {
  transactionId: string;
  status: 'committed' | 'aborted';
  participants: Record<string, ParticipantState>;
  duration: number;
}

interface RecoveryResult {
  transactionId: string;
  coordinatorRecovered: boolean;
  participantsRecovered: string[];
  decision: RecoveryDecision;
  logBased: boolean;
  explanation: string;
}

interface BlockingAnalysis {
  transactionId: string;
  isBlocking: boolean;
  blockingParticipants: string[];
  uncertainParticipants: string[];
  canResolve: boolean;
  resolution: string;
  worstCaseScenario: string;
}

interface FailureSimulation {
  targetId: string;
  failureType: 'crash' | 'timeout' | 'network_partition' | 'message_loss';
  phase: TransactionPhase;
  duration?: number;
}

// ============================================================================
// IN-MEMORY STORAGE
// ============================================================================

const transactions: Map<string, Transaction> = new Map();
const durableLog: Map<string, LogEntry[]> = new Map();

// ============================================================================
// TRANSACTION INITIALIZATION
// ============================================================================

function initTransaction(config: {
  transactionId?: string;
  coordinatorId: string;
  participantIds: string[];
  protocol?: ProtocolType;
  timeoutMs?: number;
  presumedAbort?: boolean;
}): Transaction {
  const txId = config.transactionId || `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const coordinator: Coordinator = {
    id: config.coordinatorId,
    state: 'initial',
    logEntries: [],
    failureSimulated: false,
  };

  const participants = new Map<string, Participant>();
  for (const pId of config.participantIds) {
    participants.set(pId, {
      id: pId,
      address: `${pId}.local`,
      state: 'initial',
      vote: 'pending',
      lastHeartbeat: Date.now(),
      logEntries: [],
      failureSimulated: false,
      responseDelay: 0,
    });
  }

  const transaction: Transaction = {
    id: txId,
    protocol: config.protocol || '2pc',
    coordinator,
    participants,
    phase: 'init',
    startTime: Date.now(),
    timeoutMs: config.timeoutMs || 30000,
    presumedAbort: config.presumedAbort ?? true,
  };

  if (config.protocol === '3pc') {
    transaction.threePhaseState = {
      preCommitAcks: new Set(),
      preCommitPhase: false,
      canCommit: false,
    };
  }

  // Initialize durable log
  durableLog.set(txId, []);

  // Log transaction start
  writeLog(txId, {
    timestamp: Date.now(),
    type: 'prepare',
    transactionId: txId,
    data: { coordinatorId: config.coordinatorId, participants: config.participantIds },
  });

  transactions.set(txId, transaction);
  return transaction;
}

// ============================================================================
// PHASE 1: PREPARE
// ============================================================================

async function prepare(
  transactionId: string,
  options?: {
    simulateVoteNo?: string;
    simulateTimeout?: string;
  }
): Promise<PrepareResult> {
  const tx = transactions.get(transactionId);
  if (!tx) throw new Error(`Transaction ${transactionId} not found`);
  if (tx.phase !== 'init') throw new Error(`Transaction in ${tx.phase} phase, expected init`);

  tx.phase = 'preparing';
  tx.coordinator.state = 'waiting';

  // Log prepare start
  writeLog(transactionId, {
    timestamp: Date.now(),
    type: 'prepare',
    transactionId,
    data: { phase: 'start' },
  });

  const votes: Record<string, ParticipantVote> = {};
  const timedOut: string[] = [];
  let canCommit = true;

  // Send prepare to all participants
  for (const [pId, participant] of tx.participants) {
    participant.state = 'working';

    try {
      // Simulate timeout
      if (options?.simulateTimeout === pId || participant.failureSimulated) {
        await simulateDelay(tx.timeoutMs + 100);
        participant.vote = 'timeout';
        timedOut.push(pId);
        canCommit = false;
        continue;
      }

      // Simulate response delay
      await simulateDelay(participant.responseDelay || Math.random() * 500);

      // Simulate vote no
      if (options?.simulateVoteNo === pId) {
        participant.vote = 'no';
        participant.state = 'aborted';
        writeLog(transactionId, {
          timestamp: Date.now(),
          type: 'vote_no',
          transactionId,
          participantId: pId,
        });
        canCommit = false;
      } else {
        // Vote yes
        participant.vote = 'yes';
        participant.state = 'prepared';
        participant.preparedAt = Date.now();
        writeLog(transactionId, {
          timestamp: Date.now(),
          type: 'vote_yes',
          transactionId,
          participantId: pId,
        });
      }

      participant.lastHeartbeat = Date.now();
    } catch (_e) {
      participant.vote = 'timeout';
      timedOut.push(pId);
      canCommit = false;
    }

    votes[pId] = participant.vote;
  }

  tx.phase = 'prepared';

  // Log decision
  writeLog(transactionId, {
    timestamp: Date.now(),
    type: 'decision',
    transactionId,
    data: { canCommit, votes },
  });

  return {
    transactionId,
    phase: tx.phase,
    votes,
    canCommit,
    timedOut,
  };
}

// ============================================================================
// PHASE 2: COMMIT/ABORT
// ============================================================================

async function commit(transactionId: string): Promise<CommitResult> {
  const tx = transactions.get(transactionId);
  if (!tx) throw new Error(`Transaction ${transactionId} not found`);
  if (tx.phase !== 'prepared')
    throw new Error(`Transaction in ${tx.phase} phase, expected prepared`);

  // Check all votes are yes
  const allYes = Array.from(tx.participants.values()).every((p) => p.vote === 'yes');
  if (!allYes) {
    return abort(transactionId);
  }

  tx.phase = 'committing';
  tx.coordinator.state = 'committing';
  tx.coordinator.decision = 'commit';
  tx.coordinator.decisionTime = Date.now();

  // Log commit decision (POINT OF NO RETURN)
  writeLog(transactionId, {
    timestamp: Date.now(),
    type: 'commit',
    transactionId,
    data: { decision: 'commit' },
  });

  // For 3PC, do pre-commit phase first
  if (tx.protocol === '3pc' && tx.threePhaseState) {
    await preCommitPhase(tx);
  }

  // Send commit to all participants
  const participantStates: Record<string, ParticipantState> = {};

  for (const [pId, participant] of tx.participants) {
    if (participant.state === 'prepared') {
      await simulateDelay(participant.responseDelay || Math.random() * 200);

      participant.state = 'committed';
      participant.committedAt = Date.now();

      writeLog(transactionId, {
        timestamp: Date.now(),
        type: 'ack',
        transactionId,
        participantId: pId,
        data: { ack: 'commit' },
      });
    }

    participantStates[pId] = participant.state;
  }

  tx.phase = 'committed';
  tx.coordinator.state = 'committed';
  tx.endTime = Date.now();

  tx.result = {
    status: 'committed',
    participantResults: new Map(
      Array.from(tx.participants.entries()).map(([id, p]) => [
        id,
        { vote: p.vote, finalState: p.state },
      ])
    ),
    duration: tx.endTime - tx.startTime,
    blockingOccurred: false,
    heuristicDecision: false,
  };

  return {
    transactionId,
    status: 'committed',
    participants: participantStates,
    duration: tx.endTime - tx.startTime,
  };
}

async function abort(transactionId: string): Promise<CommitResult> {
  const tx = transactions.get(transactionId);
  if (!tx) throw new Error(`Transaction ${transactionId} not found`);

  tx.phase = 'aborting';
  tx.coordinator.state = 'aborting';
  tx.coordinator.decision = 'abort';
  tx.coordinator.decisionTime = Date.now();

  // Log abort decision
  writeLog(transactionId, {
    timestamp: Date.now(),
    type: 'abort',
    transactionId,
    data: { decision: 'abort' },
  });

  // Send abort to all participants
  const participantStates: Record<string, ParticipantState> = {};

  for (const [pId, participant] of tx.participants) {
    if (participant.state !== 'aborted') {
      await simulateDelay(participant.responseDelay || Math.random() * 200);

      participant.state = 'aborted';
      participant.abortedAt = Date.now();

      writeLog(transactionId, {
        timestamp: Date.now(),
        type: 'ack',
        transactionId,
        participantId: pId,
        data: { ack: 'abort' },
      });
    }

    participantStates[pId] = participant.state;
  }

  tx.phase = 'aborted';
  tx.coordinator.state = 'aborted';
  tx.endTime = Date.now();

  tx.result = {
    status: 'aborted',
    participantResults: new Map(
      Array.from(tx.participants.entries()).map(([id, p]) => [
        id,
        { vote: p.vote, finalState: p.state },
      ])
    ),
    duration: tx.endTime - tx.startTime,
    blockingOccurred: false,
    heuristicDecision: false,
  };

  return {
    transactionId,
    status: 'aborted',
    participants: participantStates,
    duration: tx.endTime - tx.startTime,
  };
}

// ============================================================================
// THREE-PHASE COMMIT EXTENSION
// ============================================================================

async function preCommitPhase(tx: Transaction): Promise<void> {
  if (!tx.threePhaseState) return;

  tx.threePhaseState.preCommitPhase = true;

  // Send pre-commit to all prepared participants
  for (const [pId, participant] of tx.participants) {
    if (participant.state === 'prepared') {
      await simulateDelay(participant.responseDelay || Math.random() * 100);

      // Log pre-commit
      writeLog(tx.id, {
        timestamp: Date.now(),
        type: 'pre_commit',
        transactionId: tx.id,
        participantId: pId,
      });

      tx.threePhaseState.preCommitAcks.add(pId);
    }
  }

  // Check all pre-commit acks received
  const allAcked = tx.threePhaseState.preCommitAcks.size === tx.participants.size;
  tx.threePhaseState.canCommit = allAcked;
}

// ============================================================================
// RECOVERY
// ============================================================================

function recover(
  transactionId: string,
  options?: {
    coordinatorFailed?: boolean;
    failedParticipants?: string[];
  }
): RecoveryResult {
  const tx = transactions.get(transactionId);
  if (!tx) throw new Error(`Transaction ${transactionId} not found`);

  const log = durableLog.get(transactionId) || [];
  let decision: RecoveryDecision = 'block';
  let explanation = '';
  let coordinatorRecovered = false;
  const participantsRecovered: string[] = [];

  // Check log for decision
  const decisionLog = log.find((e) => e.type === 'commit' || e.type === 'abort');
  const commitLog = log.find((e) => e.type === 'commit');
  const abortLog = log.find((e) => e.type === 'abort');

  if (options?.coordinatorFailed) {
    tx.coordinator.failureSimulated = true;

    if (commitLog) {
      // Coordinator decided to commit before failing
      decision = 'commit';
      explanation = 'Coordinator logged COMMIT before failure. Completing commit.';
      coordinatorRecovered = true;
    } else if (abortLog) {
      // Coordinator decided to abort
      decision = 'abort';
      explanation = 'Coordinator logged ABORT before failure. Completing abort.';
      coordinatorRecovered = true;
    } else if (tx.presumedAbort) {
      // Presumed abort protocol
      decision = 'abort';
      explanation = 'No decision logged. Using presumed abort protocol.';
      coordinatorRecovered = true;
    } else {
      // Must block and wait for coordinator recovery
      decision = 'block';
      explanation = 'No decision logged. Participants must block until coordinator recovers.';
    }
  }

  // Handle participant failures
  if (options?.failedParticipants) {
    for (const pId of options.failedParticipants) {
      const participant = tx.participants.get(pId);
      if (participant) {
        participant.failureSimulated = true;

        // Check participant's log for its state
        const pLog = participant.logEntries;
        const votedYes = pLog.some((e) => e.type === 'vote_yes');
        const votedNo = pLog.some((e) => e.type === 'vote_no');

        if (decisionLog) {
          // Decision was made, participant can recover
          participant.state = commitLog ? 'committed' : 'aborted';
          participantsRecovered.push(pId);
        } else if (votedNo) {
          // Participant voted no, safe to abort
          participant.state = 'aborted';
          participantsRecovered.push(pId);
        } else if (votedYes) {
          // Participant voted yes but no decision - uncertain
          participant.state = 'uncertain';
          decision = 'block';
          explanation += ` Participant ${pId} is uncertain (voted YES, no decision).`;
        } else {
          // Participant didn't vote, can safely abort
          participant.state = 'aborted';
          participantsRecovered.push(pId);
        }
      }
    }
  }

  // Apply decision if possible
  if (decision === 'commit' && !options?.coordinatorFailed) {
    for (const [, participant] of tx.participants) {
      if (participant.state === 'prepared' || participant.state === 'uncertain') {
        participant.state = 'committed';
      }
    }
    tx.phase = 'committed';
  } else if (decision === 'abort' && !options?.coordinatorFailed) {
    for (const [, participant] of tx.participants) {
      if (participant.state !== 'committed') {
        participant.state = 'aborted';
      }
    }
    tx.phase = 'aborted';
  }

  return {
    transactionId,
    coordinatorRecovered,
    participantsRecovered,
    decision,
    logBased: !!decisionLog,
    explanation: explanation.trim() || 'Recovery completed',
  };
}

function heuristicDecision(
  transactionId: string,
  decision: 'commit' | 'abort'
): {
  transactionId: string;
  decision: string;
  warning: string;
  affectedParticipants: string[];
} {
  const tx = transactions.get(transactionId);
  if (!tx) throw new Error(`Transaction ${transactionId} not found`);

  const affectedParticipants: string[] = [];

  // Apply heuristic decision
  for (const [pId, participant] of tx.participants) {
    if (participant.state === 'prepared' || participant.state === 'uncertain') {
      participant.state = decision === 'commit' ? 'committed' : 'aborted';
      affectedParticipants.push(pId);
    }
  }

  tx.phase = decision === 'commit' ? 'committed' : 'aborted';
  tx.coordinator.decision = decision;

  if (tx.result) {
    tx.result.heuristicDecision = true;
  }

  writeLog(transactionId, {
    timestamp: Date.now(),
    type: decision === 'commit' ? 'commit' : 'abort',
    transactionId,
    data: { heuristic: true, decision },
  });

  return {
    transactionId,
    decision,
    warning: 'HEURISTIC DECISION: May cause data inconsistency if actual decision differs!',
    affectedParticipants,
  };
}

// ============================================================================
// FAILURE SIMULATION
// ============================================================================

function simulateFailure(
  transactionId: string,
  failure: FailureSimulation
): {
  success: boolean;
  targetId: string;
  failureType: string;
  currentPhase: TransactionPhase;
} {
  const tx = transactions.get(transactionId);
  if (!tx) throw new Error(`Transaction ${transactionId} not found`);

  if (failure.targetId === tx.coordinator.id) {
    tx.coordinator.failureSimulated = true;
  } else {
    const participant = tx.participants.get(failure.targetId);
    if (participant) {
      participant.failureSimulated = true;

      if (failure.failureType === 'timeout') {
        participant.responseDelay = (failure.duration || tx.timeoutMs) + 1000;
      }
    } else {
      throw new Error(`Target ${failure.targetId} not found`);
    }
  }

  return {
    success: true,
    targetId: failure.targetId,
    failureType: failure.failureType,
    currentPhase: tx.phase,
  };
}

// ============================================================================
// BLOCKING ANALYSIS
// ============================================================================

function analyzeBlocking(transactionId: string): BlockingAnalysis {
  const tx = transactions.get(transactionId);
  if (!tx) throw new Error(`Transaction ${transactionId} not found`);

  const blockingParticipants: string[] = [];
  const uncertainParticipants: string[] = [];
  let isBlocking = false;

  // Check for blocking conditions
  const coordinatorFailed = tx.coordinator.failureSimulated;
  const noDecision = !tx.coordinator.decision;

  for (const [pId, participant] of tx.participants) {
    if (participant.state === 'prepared' && noDecision) {
      // Participant is in prepared state but no global decision
      blockingParticipants.push(pId);
      isBlocking = true;
    }

    if (participant.state === 'uncertain') {
      uncertainParticipants.push(pId);
      isBlocking = true;
    }

    if (participant.failureSimulated && participant.state === 'prepared') {
      blockingParticipants.push(pId);
    }
  }

  // Analyze resolution options
  let canResolve = false;
  let resolution = '';
  let worstCaseScenario = '';

  if (tx.protocol === '3pc') {
    canResolve = true;
    resolution = '3PC allows non-blocking resolution through pre-commit phase.';
    worstCaseScenario = 'Timeout may cause abort even if some participants committed.';
  } else if (tx.presumedAbort && noDecision) {
    canResolve = true;
    resolution = 'Presumed abort: Can safely abort if no commit decision logged.';
    worstCaseScenario =
      'Participants may block until timeout if coordinator fails after logging commit.';
  } else if (coordinatorFailed) {
    canResolve = false;
    resolution = 'Must wait for coordinator recovery or use heuristic decision.';
    worstCaseScenario =
      'Indefinite blocking if coordinator never recovers. Data inconsistency if heuristic decision differs from actual.';
  } else {
    canResolve = true;
    resolution = 'Coordinator can complete the transaction.';
    worstCaseScenario = 'Blocking if coordinator fails before sending decision.';
  }

  if (blockingParticipants.length === 0 && uncertainParticipants.length === 0) {
    isBlocking = false;
    resolution = 'No blocking detected. Transaction can complete normally.';
    worstCaseScenario = 'N/A';
  }

  return {
    transactionId,
    isBlocking,
    blockingParticipants,
    uncertainParticipants,
    canResolve,
    resolution,
    worstCaseScenario,
  };
}

// ============================================================================
// STATE AND LOG ACCESS
// ============================================================================

function getState(transactionId: string): {
  transactionId: string;
  protocol: ProtocolType;
  phase: TransactionPhase;
  coordinator: {
    id: string;
    state: CoordinatorState;
    decision?: string;
    failed: boolean;
  };
  participants: Array<{
    id: string;
    state: ParticipantState;
    vote: ParticipantVote;
    failed: boolean;
  }>;
  duration: number;
  presumedAbort: boolean;
  threePhaseState?: {
    preCommitPhase: boolean;
    preCommitAcks: number;
    canCommit: boolean;
  };
} {
  const tx = transactions.get(transactionId);
  if (!tx) throw new Error(`Transaction ${transactionId} not found`);

  return {
    transactionId: tx.id,
    protocol: tx.protocol,
    phase: tx.phase,
    coordinator: {
      id: tx.coordinator.id,
      state: tx.coordinator.state,
      decision: tx.coordinator.decision,
      failed: tx.coordinator.failureSimulated,
    },
    participants: Array.from(tx.participants.values()).map((p) => ({
      id: p.id,
      state: p.state,
      vote: p.vote,
      failed: p.failureSimulated,
    })),
    duration: (tx.endTime || Date.now()) - tx.startTime,
    presumedAbort: tx.presumedAbort,
    threePhaseState: tx.threePhaseState
      ? {
          preCommitPhase: tx.threePhaseState.preCommitPhase,
          preCommitAcks: tx.threePhaseState.preCommitAcks.size,
          canCommit: tx.threePhaseState.canCommit,
        }
      : undefined,
  };
}

function getLog(transactionId: string): {
  transactionId: string;
  entries: LogEntry[];
  coordinatorLog: LogEntry[];
  participantLogs: Record<string, LogEntry[]>;
} {
  const tx = transactions.get(transactionId);
  if (!tx) throw new Error(`Transaction ${transactionId} not found`);

  const log = durableLog.get(transactionId) || [];
  const participantLogs: Record<string, LogEntry[]> = {};

  for (const [pId, participant] of tx.participants) {
    participantLogs[pId] = participant.logEntries;
  }

  return {
    transactionId,
    entries: log,
    coordinatorLog: tx.coordinator.logEntries,
    participantLogs,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function writeLog(transactionId: string, entry: LogEntry): void {
  const log = durableLog.get(transactionId);
  if (log) {
    log.push(entry);
  }

  const tx = transactions.get(transactionId);
  if (tx) {
    if (entry.participantId) {
      const participant = tx.participants.get(entry.participantId);
      if (participant) {
        participant.logEntries.push(entry);
      }
    } else {
      tx.coordinator.logEntries.push(entry);
    }
  }
}

async function simulateDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.min(ms, 100)));
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const twophasecommitTool: UnifiedTool = {
  name: 'two_phase_commit',
  description: '2PC/3PC distributed transaction protocol with recovery and blocking analysis',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'init_transaction',
          'prepare',
          'commit',
          'abort',
          'recover',
          'get_state',
          'simulate_failure',
          'analyze_blocking',
          'heuristic_decision',
          'get_log',
        ],
        description: 'Operation to perform',
      },
      transactionId: { type: 'string', description: 'Transaction identifier' },
      coordinatorId: { type: 'string', description: 'Coordinator identifier' },
      participantIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of participant identifiers',
      },
      protocol: { type: 'string', enum: ['2pc', '3pc'], description: 'Protocol type' },
      timeoutMs: { type: 'number', description: 'Timeout in milliseconds' },
      presumedAbort: { type: 'boolean', description: 'Use presumed abort protocol' },
      simulateVoteNo: { type: 'string', description: 'Participant to simulate NO vote' },
      simulateTimeout: { type: 'string', description: 'Participant to simulate timeout' },
      failure: {
        type: 'object',
        properties: {
          targetId: { type: 'string' },
          failureType: {
            type: 'string',
            enum: ['crash', 'timeout', 'network_partition', 'message_loss'],
          },
          phase: { type: 'string' },
          duration: { type: 'number' },
        },
        description: 'Failure simulation configuration',
      },
      coordinatorFailed: {
        type: 'boolean',
        description: 'Simulate coordinator failure in recovery',
      },
      failedParticipants: {
        type: 'array',
        items: { type: 'string' },
        description: 'Participants to mark as failed in recovery',
      },
      decision: { type: 'string', enum: ['commit', 'abort'], description: 'Heuristic decision' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executetwophasecommit(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    let result: unknown;

    switch (operation) {
      case 'init_transaction': {
        if (!args.coordinatorId) throw new Error('coordinatorId required');
        if (!args.participantIds || args.participantIds.length === 0) {
          throw new Error('participantIds required');
        }

        const tx = initTransaction({
          transactionId: args.transactionId,
          coordinatorId: args.coordinatorId,
          participantIds: args.participantIds,
          protocol: args.protocol,
          timeoutMs: args.timeoutMs,
          presumedAbort: args.presumedAbort,
        });

        result = {
          transactionId: tx.id,
          protocol: tx.protocol,
          coordinatorId: tx.coordinator.id,
          participantCount: tx.participants.size,
          phase: tx.phase,
          presumedAbort: tx.presumedAbort,
        };
        break;
      }

      case 'prepare': {
        if (!args.transactionId) throw new Error('transactionId required');

        result = await prepare(args.transactionId, {
          simulateVoteNo: args.simulateVoteNo,
          simulateTimeout: args.simulateTimeout,
        });
        break;
      }

      case 'commit': {
        if (!args.transactionId) throw new Error('transactionId required');
        result = await commit(args.transactionId);
        break;
      }

      case 'abort': {
        if (!args.transactionId) throw new Error('transactionId required');
        result = await abort(args.transactionId);
        break;
      }

      case 'recover': {
        if (!args.transactionId) throw new Error('transactionId required');

        result = recover(args.transactionId, {
          coordinatorFailed: args.coordinatorFailed,
          failedParticipants: args.failedParticipants,
        });
        break;
      }

      case 'get_state': {
        if (!args.transactionId) throw new Error('transactionId required');
        result = getState(args.transactionId);
        break;
      }

      case 'simulate_failure': {
        if (!args.transactionId) throw new Error('transactionId required');
        if (!args.failure) throw new Error('failure configuration required');
        if (!args.failure.targetId) throw new Error('failure.targetId required');
        if (!args.failure.failureType) throw new Error('failure.failureType required');

        result = simulateFailure(args.transactionId, args.failure);
        break;
      }

      case 'analyze_blocking': {
        if (!args.transactionId) throw new Error('transactionId required');
        result = analyzeBlocking(args.transactionId);
        break;
      }

      case 'heuristic_decision': {
        if (!args.transactionId) throw new Error('transactionId required');
        if (!args.decision) throw new Error('decision required');
        result = heuristicDecision(args.transactionId, args.decision);
        break;
      }

      case 'get_log': {
        if (!args.transactionId) throw new Error('transactionId required');
        result = getLog(args.transactionId);
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function istwophasecommitAvailable(): boolean {
  return true;
}
