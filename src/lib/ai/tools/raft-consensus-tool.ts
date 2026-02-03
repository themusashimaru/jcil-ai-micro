/**
 * RAFT-CONSENSUS TOOL
 * Raft distributed consensus algorithm implementation
 * Implements leader election, log replication, and state machine replication
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type NodeState = 'follower' | 'candidate' | 'leader';

interface LogEntry {
  term: number;
  index: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  command: any;
}

interface AppendEntriesRequest {
  term: number;
  leaderId: string;
  prevLogIndex: number;
  prevLogTerm: number;
  entries: LogEntry[];
  leaderCommit: number;
}

interface AppendEntriesResponse {
  term: number;
  success: boolean;
  matchIndex?: number;
}

interface RequestVoteRequest {
  term: number;
  candidateId: string;
  lastLogIndex: number;
  lastLogTerm: number;
}

interface RequestVoteResponse {
  term: number;
  voteGranted: boolean;
}

interface RaftMessage {
  type: 'append_entries' | 'append_entries_response' | 'request_vote' | 'request_vote_response';
  from: string;
  to: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  timestamp: number;
}

interface RaftNodeState {
  id: string;
  state: NodeState;
  currentTerm: number;
  votedFor: string | null;
  log: LogEntry[];
  commitIndex: number;
  lastApplied: number;
  // Leader state
  nextIndex: Map<string, number>;
  matchIndex: Map<string, number>;
  // Timing
  electionTimeout: number;
  heartbeatTimeout: number;
}

interface ClusterConfig {
  numNodes: number;
  electionTimeoutMin?: number;
  electionTimeoutMax?: number;
  heartbeatInterval?: number;
  networkReliability?: number;
}

interface SimulationResult {
  leader: string | null;
  term: number;
  committedEntries: LogEntry[];
  nodeStates: RaftNodeState[];
  messages: RaftMessage[];
  events: SimulationEvent[];
}

interface SimulationEvent {
  tick: number;
  event: string;
  nodeId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: any;
}

// ============================================================================
// RAFT NODE
// ============================================================================

class RaftNode {
  private state: RaftNodeState;
  private peers: string[];
  private ticksUntilElection: number;
  private ticksSinceHeartbeat: number;

  constructor(id: string, peers: string[], config: Partial<ClusterConfig> = {}) {
    const electionTimeoutMin = config.electionTimeoutMin || 150;
    const electionTimeoutMax = config.electionTimeoutMax || 300;

    this.state = {
      id,
      state: 'follower',
      currentTerm: 0,
      votedFor: null,
      log: [],
      commitIndex: -1,
      lastApplied: -1,
      nextIndex: new Map(),
      matchIndex: new Map(),
      electionTimeout: this.randomTimeout(electionTimeoutMin, electionTimeoutMax),
      heartbeatTimeout: config.heartbeatInterval || 50
    };

    this.peers = peers;
    this.ticksUntilElection = this.state.electionTimeout;
    this.ticksSinceHeartbeat = 0;

    // Initialize leader state
    for (const peer of peers) {
      this.state.nextIndex.set(peer, 0);
      this.state.matchIndex.set(peer, -1);
    }
  }

  private randomTimeout(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  getId(): string {
    return this.state.id;
  }

  getState(): RaftNodeState {
    return {
      ...this.state,
      nextIndex: new Map(this.state.nextIndex),
      matchIndex: new Map(this.state.matchIndex),
      log: this.state.log.map(e => ({ ...e }))
    };
  }

  getCurrentTerm(): number {
    return this.state.currentTerm;
  }

  isLeader(): boolean {
    return this.state.state === 'leader';
  }

  getLastLogIndex(): number {
    return this.state.log.length - 1;
  }

  getLastLogTerm(): number {
    if (this.state.log.length === 0) return 0;
    return this.state.log[this.state.log.length - 1].term;
  }

  // Handle election timeout
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tick(): { action: 'none' | 'start_election' | 'send_heartbeats'; messages?: any[] } {
    if (this.state.state === 'leader') {
      this.ticksSinceHeartbeat++;
      if (this.ticksSinceHeartbeat >= this.state.heartbeatTimeout) {
        this.ticksSinceHeartbeat = 0;
        return { action: 'send_heartbeats' };
      }
      return { action: 'none' };
    }

    this.ticksUntilElection--;
    if (this.ticksUntilElection <= 0) {
      this.startElection();
      return { action: 'start_election' };
    }

    return { action: 'none' };
  }

  private startElection(): void {
    this.state.state = 'candidate';
    this.state.currentTerm++;
    this.state.votedFor = this.state.id;
    this.ticksUntilElection = this.randomTimeout(150, 300);
  }

  createRequestVote(): RequestVoteRequest {
    return {
      term: this.state.currentTerm,
      candidateId: this.state.id,
      lastLogIndex: this.getLastLogIndex(),
      lastLogTerm: this.getLastLogTerm()
    };
  }

  handleRequestVote(request: RequestVoteRequest): RequestVoteResponse {
    // Reply false if term < currentTerm
    if (request.term < this.state.currentTerm) {
      return { term: this.state.currentTerm, voteGranted: false };
    }

    // Update term if needed
    if (request.term > this.state.currentTerm) {
      this.state.currentTerm = request.term;
      this.state.state = 'follower';
      this.state.votedFor = null;
    }

    // Check if we can grant vote
    const canVote = this.state.votedFor === null || this.state.votedFor === request.candidateId;
    const logOk = this.isLogUpToDate(request.lastLogIndex, request.lastLogTerm);

    if (canVote && logOk) {
      this.state.votedFor = request.candidateId;
      this.resetElectionTimeout();
      return { term: this.state.currentTerm, voteGranted: true };
    }

    return { term: this.state.currentTerm, voteGranted: false };
  }

  private isLogUpToDate(lastLogIndex: number, lastLogTerm: number): boolean {
    const myLastTerm = this.getLastLogTerm();
    const myLastIndex = this.getLastLogIndex();

    if (lastLogTerm !== myLastTerm) {
      return lastLogTerm > myLastTerm;
    }
    return lastLogIndex >= myLastIndex;
  }

  handleRequestVoteResponse(response: RequestVoteResponse, votesReceived: number): { becameLeader: boolean } {
    if (response.term > this.state.currentTerm) {
      this.state.currentTerm = response.term;
      this.state.state = 'follower';
      this.state.votedFor = null;
      return { becameLeader: false };
    }

    if (this.state.state !== 'candidate') {
      return { becameLeader: false };
    }

    // Check if we have majority (including self vote)
    const majority = Math.floor((this.peers.length + 1) / 2) + 1;
    if (votesReceived >= majority) {
      this.becomeLeader();
      return { becameLeader: true };
    }

    return { becameLeader: false };
  }

  private becomeLeader(): void {
    this.state.state = 'leader';

    // Initialize leader state
    for (const peer of this.peers) {
      this.state.nextIndex.set(peer, this.state.log.length);
      this.state.matchIndex.set(peer, -1);
    }
  }

  createAppendEntries(peerId: string): AppendEntriesRequest {
    const nextIdx = this.state.nextIndex.get(peerId) || 0;
    const prevLogIndex = nextIdx - 1;
    const prevLogTerm = prevLogIndex >= 0 && prevLogIndex < this.state.log.length
      ? this.state.log[prevLogIndex].term
      : 0;

    const entries = this.state.log.slice(nextIdx);

    return {
      term: this.state.currentTerm,
      leaderId: this.state.id,
      prevLogIndex,
      prevLogTerm,
      entries,
      leaderCommit: this.state.commitIndex
    };
  }

  handleAppendEntries(request: AppendEntriesRequest): AppendEntriesResponse {
    // Reply false if term < currentTerm
    if (request.term < this.state.currentTerm) {
      return { term: this.state.currentTerm, success: false };
    }

    // Update term and become follower if needed
    if (request.term > this.state.currentTerm) {
      this.state.currentTerm = request.term;
      this.state.state = 'follower';
      this.state.votedFor = null;
    }

    this.resetElectionTimeout();

    // If candidate, become follower
    if (this.state.state === 'candidate') {
      this.state.state = 'follower';
    }

    // Check log consistency
    if (request.prevLogIndex >= 0) {
      if (request.prevLogIndex >= this.state.log.length) {
        return { term: this.state.currentTerm, success: false };
      }
      if (this.state.log[request.prevLogIndex].term !== request.prevLogTerm) {
        // Delete conflicting entries
        this.state.log = this.state.log.slice(0, request.prevLogIndex);
        return { term: this.state.currentTerm, success: false };
      }
    }

    // Append new entries
    for (const entry of request.entries) {
      if (entry.index < this.state.log.length) {
        if (this.state.log[entry.index].term !== entry.term) {
          // Delete conflicting entry and all following
          this.state.log = this.state.log.slice(0, entry.index);
          this.state.log.push(entry);
        }
      } else {
        this.state.log.push(entry);
      }
    }

    // Update commit index
    if (request.leaderCommit > this.state.commitIndex) {
      this.state.commitIndex = Math.min(request.leaderCommit, this.state.log.length - 1);
    }

    return {
      term: this.state.currentTerm,
      success: true,
      matchIndex: this.state.log.length - 1
    };
  }

  handleAppendEntriesResponse(peerId: string, response: AppendEntriesResponse): void {
    if (response.term > this.state.currentTerm) {
      this.state.currentTerm = response.term;
      this.state.state = 'follower';
      this.state.votedFor = null;
      return;
    }

    if (this.state.state !== 'leader') return;

    if (response.success) {
      if (response.matchIndex !== undefined) {
        this.state.matchIndex.set(peerId, response.matchIndex);
        this.state.nextIndex.set(peerId, response.matchIndex + 1);
      }
      this.updateCommitIndex();
    } else {
      // Decrement nextIndex and retry
      const nextIdx = this.state.nextIndex.get(peerId) || 1;
      this.state.nextIndex.set(peerId, Math.max(0, nextIdx - 1));
    }
  }

  private updateCommitIndex(): void {
    // Find the highest index that a majority of nodes have
    const matchIndices = Array.from(this.state.matchIndex.values());
    matchIndices.push(this.state.log.length - 1); // Include leader

    matchIndices.sort((a, b) => b - a);
    const majorityIndex = Math.floor(matchIndices.length / 2);
    const newCommitIndex = matchIndices[majorityIndex];

    if (newCommitIndex > this.state.commitIndex &&
        this.state.log[newCommitIndex]?.term === this.state.currentTerm) {
      this.state.commitIndex = newCommitIndex;
    }
  }

  private resetElectionTimeout(): void {
    this.ticksUntilElection = this.randomTimeout(150, 300);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appendCommand(command: any): LogEntry | null {
    if (this.state.state !== 'leader') {
      return null;
    }

    const entry: LogEntry = {
      term: this.state.currentTerm,
      index: this.state.log.length,
      command
    };

    this.state.log.push(entry);
    return entry;
  }

  getCommittedEntries(): LogEntry[] {
    return this.state.log.slice(0, this.state.commitIndex + 1);
  }
}

// ============================================================================
// RAFT CLUSTER SIMULATOR
// ============================================================================

class RaftClusterSimulator {
  private nodes: Map<string, RaftNode>;
  private messages: RaftMessage[];
  private events: SimulationEvent[];
  private tick: number;
  private config: ClusterConfig;
  private votes: Map<string, Set<string>>;

  constructor(config: ClusterConfig) {
    this.config = config;
    this.nodes = new Map();
    this.messages = [];
    this.events = [];
    this.tick = 0;
    this.votes = new Map();

    // Create nodes
    const nodeIds = Array.from({ length: config.numNodes }, (_, i) => `node-${i}`);

    for (const nodeId of nodeIds) {
      const peers = nodeIds.filter(id => id !== nodeId);
      this.nodes.set(nodeId, new RaftNode(nodeId, peers, config));
      this.votes.set(nodeId, new Set());
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  simulate(ticks: number, commands: { tick: number; command: any }[] = []): SimulationResult {
    const commandQueue = [...commands];

    for (this.tick = 0; this.tick < ticks; this.tick++) {
      // Process any commands for this tick
      while (commandQueue.length > 0 && commandQueue[0].tick <= this.tick) {
        const cmd = commandQueue.shift()!;
        this.submitCommand(cmd.command);
      }

      // Tick each node
      for (const [nodeId, node] of this.nodes) {
        const result = node.tick();

        if (result.action === 'start_election') {
          this.logEvent(nodeId, 'start_election', {
            term: node.getCurrentTerm(),
            state: 'candidate'
          });

          // Reset votes for this candidate
          this.votes.set(nodeId, new Set([nodeId])); // Vote for self

          // Send RequestVote to all peers
          const request = node.createRequestVote();
          for (const [peerId] of this.nodes) {
            if (peerId !== nodeId && this.shouldDeliver()) {
              this.messages.push({
                type: 'request_vote',
                from: nodeId,
                to: peerId,
                payload: request,
                timestamp: this.tick
              });
            }
          }
        } else if (result.action === 'send_heartbeats') {
          // Send AppendEntries to all peers
          for (const [peerId] of this.nodes) {
            if (peerId !== nodeId && this.shouldDeliver()) {
              const request = node.createAppendEntries(peerId);
              this.messages.push({
                type: 'append_entries',
                from: nodeId,
                to: peerId,
                payload: request,
                timestamp: this.tick
              });
            }
          }
        }
      }

      // Process messages
      this.processMessages();
    }

    // Find leader
    let leader: string | null = null;
    let maxTerm = 0;
    for (const [nodeId, node] of this.nodes) {
      if (node.isLeader() && node.getCurrentTerm() >= maxTerm) {
        leader = nodeId;
        maxTerm = node.getCurrentTerm();
      }
    }

    // Get committed entries from leader
    const committedEntries = leader
      ? this.nodes.get(leader)!.getCommittedEntries()
      : [];

    return {
      leader,
      term: maxTerm,
      committedEntries,
      nodeStates: Array.from(this.nodes.values()).map(n => n.getState()),
      messages: this.messages,
      events: this.events
    };
  }

  private processMessages(): void {
    const pendingMessages = this.messages.filter(m => m.timestamp === this.tick);

    for (const msg of pendingMessages) {
      const targetNode = this.nodes.get(msg.to);
      const sourceNode = this.nodes.get(msg.from);
      if (!targetNode || !sourceNode) continue;

      switch (msg.type) {
        case 'request_vote': {
          const response = targetNode.handleRequestVote(msg.payload);

          this.logEvent(msg.to, 'vote_response', {
            candidate: msg.from,
            granted: response.voteGranted,
            term: response.term
          });

          if (this.shouldDeliver()) {
            this.messages.push({
              type: 'request_vote_response',
              from: msg.to,
              to: msg.from,
              payload: response,
              timestamp: this.tick
            });
          }
          break;
        }

        case 'request_vote_response': {
          const response = msg.payload as RequestVoteResponse;
          const candidateVotes = this.votes.get(msg.to);

          if (response.voteGranted && candidateVotes) {
            candidateVotes.add(msg.from);
          }

          const result = sourceNode.handleRequestVoteResponse(
            response,
            candidateVotes?.size || 0
          );

          if (result.becameLeader) {
            this.logEvent(msg.to, 'became_leader', {
              term: sourceNode.getCurrentTerm(),
              votes: candidateVotes?.size || 0
            });
          }
          break;
        }

        case 'append_entries': {
          const response = targetNode.handleAppendEntries(msg.payload);

          this.logEvent(msg.to, 'append_entries', {
            from: msg.from,
            success: response.success,
            entriesCount: (msg.payload as AppendEntriesRequest).entries.length
          });

          if (this.shouldDeliver()) {
            this.messages.push({
              type: 'append_entries_response',
              from: msg.to,
              to: msg.from,
              payload: response,
              timestamp: this.tick
            });
          }
          break;
        }

        case 'append_entries_response': {
          sourceNode.handleAppendEntriesResponse(msg.from, msg.payload);
          break;
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private submitCommand(command: any): boolean {
    // Find leader and submit command
    for (const [nodeId, node] of this.nodes) {
      if (node.isLeader()) {
        const entry = node.appendCommand(command);
        if (entry) {
          this.logEvent(nodeId, 'command_received', { command, index: entry.index });
          return true;
        }
      }
    }
    return false;
  }

  private shouldDeliver(): boolean {
    const reliability = this.config.networkReliability || 1.0;
    return Math.random() < reliability;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private logEvent(nodeId: string, event: string, details: any): void {
    this.events.push({
      tick: this.tick,
      event,
      nodeId,
      details
    });
  }
}

// ============================================================================
// RAFT ANALYSIS
// ============================================================================

interface RaftAnalysis {
  safetyProperties: {
    electionSafety: string;
    leaderAppendOnly: string;
    logMatching: string;
    leaderCompleteness: string;
    stateMachineSafety: string;
  };
  livenessProperties: {
    electionLiveness: string;
    logReplication: string;
  };
  faultTolerance: {
    maxFailures: number;
    quorumSize: number;
    networkPartition: string;
  };
  performance: {
    bestCaseLatency: string;
    worstCaseLatency: string;
    throughput: string;
  };
}

function analyzeRaft(numNodes: number): RaftAnalysis {
  const quorum = Math.floor(numNodes / 2) + 1;
  const maxFailures = numNodes - quorum;

  return {
    safetyProperties: {
      electionSafety: 'At most one leader per term (guaranteed by majority voting)',
      leaderAppendOnly: 'Leader never overwrites or deletes entries, only appends',
      logMatching: 'If two logs have same index and term, all preceding entries match',
      leaderCompleteness: 'If entry committed in term T, present in all leaders for terms > T',
      stateMachineSafety: 'If server applies entry at index, no other server applies different entry at same index'
    },
    livenessProperties: {
      electionLiveness: 'Eventually elect a leader (requires randomized timeouts)',
      logReplication: 'Committed entries eventually replicated to all nodes'
    },
    faultTolerance: {
      maxFailures,
      quorumSize: quorum,
      networkPartition: `System remains available if majority (${quorum}/${numNodes}) can communicate`
    },
    performance: {
      bestCaseLatency: '1 round-trip (leader to majority)',
      worstCaseLatency: 'Multiple round-trips during leader election or log inconsistency',
      throughput: 'Limited by leader\'s network bandwidth and disk I/O'
    }
  };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const raftconsensusTool: UnifiedTool = {
  name: 'raft_consensus',
  description: 'Raft distributed consensus algorithm simulation with leader election, log replication, and fault tolerance analysis',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['simulate', 'election', 'replicate', 'analyze', 'info', 'examples', 'demo'],
        description: 'Raft operation to perform'
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

export async function executeraftconsensus(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, parameters = {} } = args;

    switch (operation) {
      case 'simulate': {
        const {
          numNodes = 5,
          ticks = 1000,
          commands = [],
          networkReliability = 1.0
        } = parameters;

        const simulator = new RaftClusterSimulator({
          numNodes,
          networkReliability
        });

        const result = simulator.simulate(ticks, commands);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'simulate',
            algorithm: 'Raft Consensus',
            configuration: {
              numNodes,
              ticks,
              networkReliability,
              commandCount: commands.length
            },
            result: {
              leader: result.leader,
              currentTerm: result.term,
              committedEntries: result.committedEntries,
              totalMessages: result.messages.length,
              significantEvents: result.events.filter(e =>
                ['became_leader', 'start_election', 'command_received'].includes(e.event)
              )
            },
            description: 'Raft simulation with leader election and log replication'
          }, null, 2)
        };
      }

      case 'election': {
        const {
          numNodes = 5,
          ticks = 500
        } = parameters;

        const simulator = new RaftClusterSimulator({ numNodes });
        const result = simulator.simulate(ticks);

        const electionEvents = result.events.filter(e =>
          e.event === 'start_election' || e.event === 'became_leader'
        );

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'election',
            algorithm: 'Raft Leader Election',
            configuration: { numNodes },
            result: {
              electedLeader: result.leader,
              finalTerm: result.term,
              electionHistory: electionEvents,
              nodeStates: result.nodeStates.map(s => ({
                id: s.id,
                state: s.state,
                term: s.currentTerm,
                votedFor: s.votedFor
              }))
            },
            description: 'Raft uses randomized election timeouts to elect a single leader per term'
          }, null, 2)
        };
      }

      case 'replicate': {
        const {
          numNodes = 5,
          commands = ['SET x=1', 'SET y=2', 'DELETE x'],
          ticks = 2000
        } = parameters;

        // Schedule commands at different ticks
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scheduledCommands = commands.map((cmd: any, i: number) => ({
          tick: 500 + i * 100,
          command: cmd
        }));

        const simulator = new RaftClusterSimulator({ numNodes });
        const result = simulator.simulate(ticks, scheduledCommands);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'replicate',
            algorithm: 'Raft Log Replication',
            configuration: {
              numNodes,
              quorumSize: Math.floor(numNodes / 2) + 1
            },
            input: { commands },
            result: {
              leader: result.leader,
              term: result.term,
              committedEntries: result.committedEntries,
              replicationStatus: result.nodeStates.map(s => ({
                id: s.id,
                logLength: s.log.length,
                commitIndex: s.commitIndex
              }))
            },
            description: 'Leader replicates log entries to followers and commits when majority acknowledge'
          }, null, 2)
        };
      }

      case 'analyze': {
        const { numNodes = 5 } = parameters;

        const analysis = analyzeRaft(numNodes);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze',
            algorithm: 'Raft Consensus Analysis',
            configuration: { numNodes },
            analysis,
            comparison: {
              vsPaxos: {
                similarity: 'Both achieve consensus with majority quorums',
                difference: 'Raft has stronger leader, simpler to understand',
                performance: 'Similar in normal operation, Raft simpler recovery'
              }
            },
            description: 'Analysis of Raft safety, liveness, and fault tolerance properties'
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'raft_consensus',
            description: 'Raft distributed consensus algorithm for replicated state machines',
            components: {
              leaderElection: {
                description: 'Elects a single leader using randomized timeouts',
                mechanism: 'Candidate requests votes, wins with majority'
              },
              logReplication: {
                description: 'Leader replicates log entries to followers',
                mechanism: 'AppendEntries RPC with consistency checks'
              },
              safety: {
                description: 'Ensures all nodes agree on the same sequence',
                mechanism: 'Voting restrictions and log matching'
              }
            },
            states: {
              follower: 'Passive, responds to leader and candidates',
              candidate: 'Attempting to become leader',
              leader: 'Handles all client requests, replicates log'
            },
            rpcs: {
              requestVote: 'Candidate asks for votes during election',
              appendEntries: 'Leader replicates entries and sends heartbeats'
            },
            operations: ['simulate', 'election', 'replicate', 'analyze', 'info', 'examples', 'demo']
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Simple cluster simulation',
                operation: 'simulate',
                parameters: {
                  numNodes: 5,
                  ticks: 1000,
                  commands: [
                    { tick: 500, command: 'SET key1=value1' },
                    { tick: 600, command: 'SET key2=value2' }
                  ]
                }
              },
              {
                name: 'Leader election only',
                operation: 'election',
                parameters: {
                  numNodes: 3,
                  ticks: 500
                }
              },
              {
                name: 'Log replication',
                operation: 'replicate',
                parameters: {
                  numNodes: 5,
                  commands: ['INSERT user1', 'UPDATE user1', 'DELETE user1']
                }
              },
              {
                name: 'Fault tolerance analysis',
                operation: 'analyze',
                parameters: {
                  numNodes: 7
                }
              }
            ]
          }, null, 2)
        };
      }

      case 'demo': {
        // Demo: Full Raft simulation
        const simulator = new RaftClusterSimulator({
          numNodes: 5,
          networkReliability: 0.95
        });

        const commands = [
          { tick: 400, command: 'CREATE TABLE users' },
          { tick: 500, command: 'INSERT INTO users VALUES (1, "Alice")' },
          { tick: 600, command: 'INSERT INTO users VALUES (2, "Bob")' }
        ];

        const result = simulator.simulate(1500, commands);

        const leaderElections = result.events.filter(e => e.event === 'became_leader');

        return {
          toolCallId: id,
          content: JSON.stringify({
            demo: 'Raft Consensus Demonstration',
            description: '5-node Raft cluster with command replication',
            scenario: {
              nodes: 5,
              commands: commands.map(c => c.command),
              networkReliability: '95%'
            },
            timeline: {
              leaderElections: leaderElections.map(e => ({
                tick: e.tick,
                leader: e.nodeId,
                term: e.details.term
              })),
              currentLeader: result.leader,
              currentTerm: result.term
            },
            replication: {
              committedCommands: result.committedEntries.length,
              entries: result.committedEntries.map(e => ({
                index: e.index,
                term: e.term,
                command: e.command
              }))
            },
            clusterHealth: result.nodeStates.map(s => ({
              node: s.id,
              state: s.state,
              logLength: s.log.length,
              commitIndex: s.commitIndex
            }))
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown operation: ${operation}`,
            availableOperations: ['simulate', 'election', 'replicate', 'analyze', 'info', 'examples', 'demo']
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

export function israftconsensusAvailable(): boolean {
  return true;
}
