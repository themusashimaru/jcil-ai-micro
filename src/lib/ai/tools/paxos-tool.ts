/**
 * PAXOS TOOL
 * Paxos consensus protocol implementation
 * Supports Basic Paxos and Multi-Paxos for distributed consensus
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ProposalId {
  number: number;
  proposerId: string;
}

interface Proposal {
  id: ProposalId;
  value: any;
}

interface PrepareRequest {
  proposalId: ProposalId;
}

interface PrepareResponse {
  promised: boolean;
  acceptedProposal?: Proposal;
  acceptorId: string;
}

interface AcceptRequest {
  proposal: Proposal;
}

interface AcceptResponse {
  accepted: boolean;
  acceptorId: string;
}

interface PaxosMessage {
  type: 'prepare' | 'promise' | 'accept' | 'accepted' | 'learn';
  from: string;
  to: string;
  payload: any;
  timestamp: number;
}

interface AcceptorState {
  id: string;
  promisedId: ProposalId | null;
  acceptedProposal: Proposal | null;
}

interface ProposerState {
  id: string;
  proposalNumber: number;
  value: any;
  phase: 'idle' | 'preparing' | 'accepting' | 'decided';
  promises: Map<string, PrepareResponse>;
  accepts: Map<string, AcceptResponse>;
}

interface LearnerState {
  id: string;
  learnedValue: any;
  learnedFrom: Set<string>;
}

interface PaxosConfig {
  numAcceptors: number;
  numProposers?: number;
  numLearners?: number;
  networkDelay?: number;
  failureProbability?: number;
}

interface SimulationResult {
  decided: boolean;
  decidedValue: any;
  rounds: number;
  messages: PaxosMessage[];
  acceptorStates: AcceptorState[];
  history: SimulationEvent[];
}

interface SimulationEvent {
  round: number;
  event: string;
  details: any;
}

// ============================================================================
// PROPOSAL ID COMPARISON
// ============================================================================

function compareProposalIds(a: ProposalId | null, b: ProposalId | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;

  if (a.number !== b.number) {
    return a.number - b.number;
  }
  return a.proposerId.localeCompare(b.proposerId);
}

function isGreaterProposalId(a: ProposalId, b: ProposalId | null): boolean {
  return compareProposalIds(a, b) > 0;
}

// ============================================================================
// ACCEPTOR
// ============================================================================

class Acceptor {
  private state: AcceptorState;

  constructor(id: string) {
    this.state = {
      id,
      promisedId: null,
      acceptedProposal: null
    };
  }

  handlePrepare(request: PrepareRequest): PrepareResponse {
    const { proposalId } = request;

    if (isGreaterProposalId(proposalId, this.state.promisedId)) {
      // Promise not to accept proposals with lower IDs
      this.state.promisedId = proposalId;

      return {
        promised: true,
        acceptedProposal: this.state.acceptedProposal || undefined,
        acceptorId: this.state.id
      };
    }

    return {
      promised: false,
      acceptorId: this.state.id
    };
  }

  handleAccept(request: AcceptRequest): AcceptResponse {
    const { proposal } = request;

    if (this.state.promisedId === null ||
        compareProposalIds(proposal.id, this.state.promisedId) >= 0) {
      // Accept the proposal
      this.state.promisedId = proposal.id;
      this.state.acceptedProposal = proposal;

      return {
        accepted: true,
        acceptorId: this.state.id
      };
    }

    return {
      accepted: false,
      acceptorId: this.state.id
    };
  }

  getState(): AcceptorState {
    return { ...this.state };
  }

  reset(): void {
    this.state.promisedId = null;
    this.state.acceptedProposal = null;
  }
}

// ============================================================================
// PROPOSER
// ============================================================================

class Proposer {
  private state: ProposerState;
  private quorumSize: number;

  constructor(id: string, numAcceptors: number) {
    this.state = {
      id,
      proposalNumber: 0,
      value: null,
      phase: 'idle',
      promises: new Map(),
      accepts: new Map()
    };
    this.quorumSize = Math.floor(numAcceptors / 2) + 1;
  }

  propose(value: any): ProposalId {
    this.state.proposalNumber++;
    this.state.value = value;
    this.state.phase = 'preparing';
    this.state.promises.clear();
    this.state.accepts.clear();

    return {
      number: this.state.proposalNumber,
      proposerId: this.state.id
    };
  }

  handlePromise(response: PrepareResponse): {
    ready: boolean;
    proposal?: Proposal;
  } {
    if (this.state.phase !== 'preparing') {
      return { ready: false };
    }

    if (response.promised) {
      this.state.promises.set(response.acceptorId, response);

      // Check if we have enough promises
      if (this.state.promises.size >= this.quorumSize) {
        // Find highest-numbered accepted proposal
        let highestAccepted: Proposal | null = null;

        for (const promise of this.state.promises.values()) {
          if (promise.acceptedProposal) {
            if (highestAccepted === null ||
                compareProposalIds(promise.acceptedProposal.id, highestAccepted.id) > 0) {
              highestAccepted = promise.acceptedProposal;
            }
          }
        }

        // Use the highest accepted value or our proposed value
        const valueToPropose = highestAccepted ? highestAccepted.value : this.state.value;

        this.state.phase = 'accepting';

        return {
          ready: true,
          proposal: {
            id: {
              number: this.state.proposalNumber,
              proposerId: this.state.id
            },
            value: valueToPropose
          }
        };
      }
    }

    return { ready: false };
  }

  handleAccepted(response: AcceptResponse): {
    decided: boolean;
    value?: any;
  } {
    if (this.state.phase !== 'accepting') {
      return { decided: false };
    }

    if (response.accepted) {
      this.state.accepts.set(response.acceptorId, response);

      // Check if we have enough accepts
      if (this.state.accepts.size >= this.quorumSize) {
        this.state.phase = 'decided';
        return {
          decided: true,
          value: this.state.value
        };
      }
    }

    return { decided: false };
  }

  getState(): ProposerState {
    return {
      ...this.state,
      promises: new Map(this.state.promises),
      accepts: new Map(this.state.accepts)
    };
  }

  getCurrentProposalId(): ProposalId {
    return {
      number: this.state.proposalNumber,
      proposerId: this.state.id
    };
  }
}

// ============================================================================
// LEARNER
// ============================================================================

class Learner {
  private state: LearnerState;
  private quorumSize: number;
  private acceptedValues: Map<string, { value: any; acceptors: Set<string> }>;

  constructor(id: string, numAcceptors: number) {
    this.state = {
      id,
      learnedValue: null,
      learnedFrom: new Set()
    };
    this.quorumSize = Math.floor(numAcceptors / 2) + 1;
    this.acceptedValues = new Map();
  }

  handleAccepted(acceptorId: string, proposal: Proposal): {
    learned: boolean;
    value?: any;
  } {
    const key = JSON.stringify(proposal.id);

    if (!this.acceptedValues.has(key)) {
      this.acceptedValues.set(key, {
        value: proposal.value,
        acceptors: new Set()
      });
    }

    const entry = this.acceptedValues.get(key)!;
    entry.acceptors.add(acceptorId);

    if (entry.acceptors.size >= this.quorumSize && this.state.learnedValue === null) {
      this.state.learnedValue = proposal.value;
      this.state.learnedFrom = new Set(entry.acceptors);
      return {
        learned: true,
        value: proposal.value
      };
    }

    return { learned: false };
  }

  getState(): LearnerState {
    return {
      ...this.state,
      learnedFrom: new Set(this.state.learnedFrom)
    };
  }

  hasLearned(): boolean {
    return this.state.learnedValue !== null;
  }
}

// ============================================================================
// BASIC PAXOS SIMULATOR
// ============================================================================

class BasicPaxosSimulator {
  private acceptors: Map<string, Acceptor>;
  private proposers: Map<string, Proposer>;
  private learners: Map<string, Learner>;
  private messages: PaxosMessage[];
  private history: SimulationEvent[];
  private config: PaxosConfig;
  private round: number;

  constructor(config: PaxosConfig) {
    this.config = config;
    this.acceptors = new Map();
    this.proposers = new Map();
    this.learners = new Map();
    this.messages = [];
    this.history = [];
    this.round = 0;

    // Initialize acceptors
    for (let i = 0; i < config.numAcceptors; i++) {
      const id = `acceptor-${i}`;
      this.acceptors.set(id, new Acceptor(id));
    }

    // Initialize proposers
    const numProposers = config.numProposers || 1;
    for (let i = 0; i < numProposers; i++) {
      const id = `proposer-${i}`;
      this.proposers.set(id, new Proposer(id, config.numAcceptors));
    }

    // Initialize learners
    const numLearners = config.numLearners || 1;
    for (let i = 0; i < numLearners; i++) {
      const id = `learner-${i}`;
      this.learners.set(id, new Learner(id, config.numAcceptors));
    }
  }

  simulate(proposedValues: Map<string, any>): SimulationResult {
    this.round = 0;
    let decided = false;
    let decidedValue: any = null;

    // Phase 1a: Proposers send prepare requests
    for (const [proposerId, value] of proposedValues) {
      const proposer = this.proposers.get(proposerId);
      if (!proposer) continue;

      const proposalId = proposer.propose(value);

      this.logEvent('prepare', {
        proposer: proposerId,
        proposalId,
        value
      });

      // Send prepare to all acceptors
      for (const [acceptorId] of this.acceptors) {
        if (this.shouldDeliver()) {
          this.messages.push({
            type: 'prepare',
            from: proposerId,
            to: acceptorId,
            payload: { proposalId },
            timestamp: this.round
          });
        }
      }
    }

    this.round++;

    // Phase 1b: Acceptors respond with promises
    for (const [acceptorId, acceptor] of this.acceptors) {
      for (const msg of this.messages.filter(m => m.to === acceptorId && m.type === 'prepare')) {
        const response = acceptor.handlePrepare(msg.payload);

        this.logEvent('promise', {
          acceptor: acceptorId,
          proposer: msg.from,
          promised: response.promised,
          acceptedProposal: response.acceptedProposal
        });

        if (this.shouldDeliver()) {
          this.messages.push({
            type: 'promise',
            from: acceptorId,
            to: msg.from,
            payload: response,
            timestamp: this.round
          });
        }
      }
    }

    this.round++;

    // Phase 2a: Proposers send accept requests
    for (const [proposerId, proposer] of this.proposers) {
      const promiseMessages = this.messages.filter(
        m => m.to === proposerId && m.type === 'promise'
      );

      for (const msg of promiseMessages) {
        const result = proposer.handlePromise(msg.payload);

        if (result.ready && result.proposal) {
          this.logEvent('accept_request', {
            proposer: proposerId,
            proposal: result.proposal
          });

          // Send accept to all acceptors
          for (const [acceptorId] of this.acceptors) {
            if (this.shouldDeliver()) {
              this.messages.push({
                type: 'accept',
                from: proposerId,
                to: acceptorId,
                payload: { proposal: result.proposal },
                timestamp: this.round
              });
            }
          }
          break;
        }
      }
    }

    this.round++;

    // Phase 2b: Acceptors accept proposals
    for (const [acceptorId, acceptor] of this.acceptors) {
      const acceptMessages = this.messages.filter(
        m => m.to === acceptorId && m.type === 'accept'
      );

      for (const msg of acceptMessages) {
        const response = acceptor.handleAccept(msg.payload);

        this.logEvent('accept_response', {
          acceptor: acceptorId,
          proposal: msg.payload.proposal,
          accepted: response.accepted
        });

        // Send to proposer
        if (this.shouldDeliver()) {
          this.messages.push({
            type: 'accepted',
            from: acceptorId,
            to: msg.from,
            payload: { response, proposal: msg.payload.proposal },
            timestamp: this.round
          });
        }

        // Send to all learners
        if (response.accepted) {
          for (const [learnerId] of this.learners) {
            if (this.shouldDeliver()) {
              this.messages.push({
                type: 'learn',
                from: acceptorId,
                to: learnerId,
                payload: { proposal: msg.payload.proposal },
                timestamp: this.round
              });
            }
          }
        }
      }
    }

    this.round++;

    // Check if proposers have decided
    for (const [proposerId, proposer] of this.proposers) {
      const acceptedMessages = this.messages.filter(
        m => m.to === proposerId && m.type === 'accepted'
      );

      for (const msg of acceptedMessages) {
        const result = proposer.handleAccepted(msg.payload.response);

        if (result.decided) {
          decided = true;
          decidedValue = result.value;

          this.logEvent('decided', {
            proposer: proposerId,
            value: result.value
          });
        }
      }
    }

    // Learners learn the value
    for (const [learnerId, learner] of this.learners) {
      const learnMessages = this.messages.filter(
        m => m.to === learnerId && m.type === 'learn'
      );

      for (const msg of learnMessages) {
        const result = learner.handleAccepted(msg.from, msg.payload.proposal);

        if (result.learned) {
          this.logEvent('learned', {
            learner: learnerId,
            value: result.value
          });
        }
      }
    }

    return {
      decided,
      decidedValue,
      rounds: this.round,
      messages: this.messages,
      acceptorStates: Array.from(this.acceptors.values()).map(a => a.getState()),
      history: this.history
    };
  }

  private shouldDeliver(): boolean {
    const failureProbability = this.config.failureProbability || 0;
    return Math.random() >= failureProbability;
  }

  private logEvent(event: string, details: any): void {
    this.history.push({
      round: this.round,
      event,
      details
    });
  }
}

// ============================================================================
// MULTI-PAXOS LOG ENTRY
// ============================================================================

interface LogEntry {
  index: number;
  value: any;
  decided: boolean;
}

interface MultiPaxosState {
  leader: string | null;
  logEntries: LogEntry[];
  committedIndex: number;
}

class MultiPaxosSimulator {
  private state: MultiPaxosState;
  private numNodes: number;

  constructor(numNodes: number) {
    this.numNodes = numNodes;
    this.state = {
      leader: null,
      logEntries: [],
      committedIndex: -1
    };
  }

  electLeader(): string {
    // Simplified leader election
    const leaderId = `node-${Math.floor(Math.random() * this.numNodes)}`;
    this.state.leader = leaderId;
    return leaderId;
  }

  appendEntry(value: any): { index: number; success: boolean } {
    if (!this.state.leader) {
      this.electLeader();
    }

    const index = this.state.logEntries.length;
    this.state.logEntries.push({
      index,
      value,
      decided: false
    });

    // Simulate consensus (simplified)
    const quorum = Math.floor(this.numNodes / 2) + 1;
    const votes = Math.floor(Math.random() * this.numNodes) + 1;

    if (votes >= quorum) {
      this.state.logEntries[index].decided = true;
      this.state.committedIndex = index;
      return { index, success: true };
    }

    return { index, success: false };
  }

  getState(): MultiPaxosState {
    return {
      ...this.state,
      logEntries: this.state.logEntries.map(e => ({ ...e }))
    };
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const paxosTool: UnifiedTool = {
  name: 'paxos',
  description: 'Paxos consensus protocol simulation and analysis including Basic Paxos and Multi-Paxos for distributed systems',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['basic_paxos', 'multi_paxos', 'analyze', 'info', 'examples', 'demo'],
        description: 'Paxos operation to perform'
      },
      parameters: {
        type: 'object',
        description: 'Operation-specific parameters'
      }
    },
    required: ['operation']
  }
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executepaxos(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, parameters = {} } = args;

    switch (operation) {
      case 'basic_paxos': {
        const {
          numAcceptors = 5,
          numProposers = 2,
          numLearners = 1,
          proposedValues = { 'proposer-0': 'value-A', 'proposer-1': 'value-B' },
          failureProbability = 0
        } = parameters;

        const simulator = new BasicPaxosSimulator({
          numAcceptors,
          numProposers,
          numLearners,
          failureProbability
        });

        const proposalsMap = new Map(Object.entries(proposedValues));
        const result = simulator.simulate(proposalsMap);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'basic_paxos',
            algorithm: 'Basic Paxos (Single-Decree)',
            configuration: {
              numAcceptors,
              numProposers,
              numLearners,
              failureProbability
            },
            result: {
              decided: result.decided,
              decidedValue: result.decidedValue,
              rounds: result.rounds,
              totalMessages: result.messages.length,
              acceptorStates: result.acceptorStates,
              eventLog: result.history
            },
            description: 'Basic Paxos reaches consensus on a single value among distributed nodes'
          }, null, 2)
        };
      }

      case 'multi_paxos': {
        const {
          numNodes = 5,
          entries = ['command-1', 'command-2', 'command-3']
        } = parameters;

        const simulator = new MultiPaxosSimulator(numNodes);
        const results: { entry: any; index: number; committed: boolean }[] = [];

        for (const entry of entries) {
          const result = simulator.appendEntry(entry);
          results.push({
            entry,
            index: result.index,
            committed: result.success
          });
        }

        const state = simulator.getState();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'multi_paxos',
            algorithm: 'Multi-Paxos (Replicated State Machine)',
            configuration: {
              numNodes,
              quorumSize: Math.floor(numNodes / 2) + 1
            },
            result: {
              leader: state.leader,
              committedIndex: state.committedIndex,
              logEntries: state.logEntries,
              appendResults: results
            },
            description: 'Multi-Paxos maintains a replicated log for state machine replication'
          }, null, 2)
        };
      }

      case 'analyze': {
        const {
          numNodes = 5,
          failureScenario = 'none'
        } = parameters;

        const quorum = Math.floor(numNodes / 2) + 1;
        const maxFailures = numNodes - quorum;

        const analysis = {
          totalNodes: numNodes,
          quorumSize: quorum,
          maxTolerableFailures: maxFailures,
          faultTolerance: `${maxFailures} out of ${numNodes} nodes`,
          liveness: failureScenario === 'none' || maxFailures > 0
            ? 'Guaranteed (with functioning quorum)'
            : 'Not guaranteed (quorum lost)',
          safety: 'Always guaranteed (Paxos never violates agreement)',
          phases: [
            { name: 'Phase 1a', description: 'Proposer sends Prepare(n) to acceptors' },
            { name: 'Phase 1b', description: 'Acceptors respond with Promise or rejection' },
            { name: 'Phase 2a', description: 'Proposer sends Accept(n, v) if quorum promised' },
            { name: 'Phase 2b', description: 'Acceptors send Accepted(n, v) if proposal valid' }
          ],
          complexityAnalysis: {
            messageComplexity: 'O(n) per consensus instance',
            roundComplexity: '2 rounds in best case (Phase 1 + Phase 2)',
            worstCase: 'Unbounded rounds with competing proposers (but still safe)'
          }
        };

        // Analyze failure scenario
        if (failureScenario === 'minority_failure') {
          analysis.liveness = 'Guaranteed - minority failures tolerated';
        } else if (failureScenario === 'majority_failure') {
          analysis.liveness = 'Not guaranteed - cannot form quorum';
        } else if (failureScenario === 'network_partition') {
          analysis.liveness = 'Guaranteed in majority partition only';
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze',
            analysis,
            description: 'Analysis of Paxos consensus properties and fault tolerance'
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'paxos',
            description: 'Paxos distributed consensus protocol simulation',
            algorithms: {
              basic_paxos: {
                name: 'Basic Paxos (Single-Decree)',
                description: 'Reaches consensus on a single value',
                phases: ['Prepare', 'Promise', 'Accept', 'Accepted'],
                properties: ['Safety', 'Liveness (with eventual synchrony)']
              },
              multi_paxos: {
                name: 'Multi-Paxos',
                description: 'Replicated state machine using Paxos instances',
                optimization: 'Leader-based to reduce message complexity',
                useCase: 'Replicated logs, distributed databases'
              }
            },
            guarantees: {
              safety: 'No two nodes decide differently (agreement)',
              validity: 'Decided value was proposed by some proposer',
              termination: 'Eventually decide (with functioning majority)'
            },
            roles: {
              proposer: 'Proposes values for consensus',
              acceptor: 'Votes on proposals, stores decisions',
              learner: 'Learns the decided value'
            },
            operations: ['basic_paxos', 'multi_paxos', 'analyze', 'info', 'examples', 'demo']
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Basic Paxos with competing proposers',
                operation: 'basic_paxos',
                parameters: {
                  numAcceptors: 5,
                  numProposers: 2,
                  proposedValues: { 'proposer-0': 'config-A', 'proposer-1': 'config-B' }
                }
              },
              {
                name: 'Multi-Paxos log replication',
                operation: 'multi_paxos',
                parameters: {
                  numNodes: 5,
                  entries: ['SET x=1', 'SET y=2', 'DELETE x']
                }
              },
              {
                name: 'Analyze fault tolerance',
                operation: 'analyze',
                parameters: {
                  numNodes: 7,
                  failureScenario: 'minority_failure'
                }
              }
            ]
          }, null, 2)
        };
      }

      case 'demo': {
        // Demo: Run Basic Paxos simulation
        const simulator = new BasicPaxosSimulator({
          numAcceptors: 5,
          numProposers: 2,
          numLearners: 1,
          failureProbability: 0
        });

        const proposals = new Map([
          ['proposer-0', 'value-X'],
          ['proposer-1', 'value-Y']
        ]);

        const result = simulator.simulate(proposals);

        return {
          toolCallId: id,
          content: JSON.stringify({
            demo: 'Basic Paxos Consensus',
            description: 'Two proposers competing for consensus with 5 acceptors',
            configuration: {
              acceptors: 5,
              proposers: 2,
              quorumSize: 3
            },
            proposals: {
              'proposer-0': 'value-X',
              'proposer-1': 'value-Y'
            },
            outcome: {
              consensusReached: result.decided,
              decidedValue: result.decidedValue,
              rounds: result.rounds,
              totalMessages: result.messages.length
            },
            explanation: result.decided
              ? `Consensus reached on "${result.decidedValue}" - both safety and liveness achieved`
              : 'Consensus not yet reached - may need more rounds'
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown operation: ${operation}`,
            availableOperations: ['basic_paxos', 'multi_paxos', 'analyze', 'info', 'examples', 'demo']
          }, null, 2),
          isError: true
        };
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: JSON.stringify({ error: errorMessage }, null, 2),
      isError: true
    };
  }
}

export function ispaxosAvailable(): boolean {
  return true;
}
