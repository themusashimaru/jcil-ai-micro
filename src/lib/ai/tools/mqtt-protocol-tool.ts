/**
 * MQTT PROTOCOL TOOL
 * Comprehensive MQTT message broker simulator
 * Supports: MQTT v3.1.1 and v5.0, QoS 0/1/2, wildcards, retain, LWT, sessions
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

type MQTTVersion = '3.1.1' | '5.0';
type QoSLevel = 0 | 1 | 2;
type ClientState = 'disconnected' | 'connecting' | 'connected';

interface MQTTMessage {
  id: number;
  topic: string;
  payload: string;
  qos: QoSLevel;
  retain: boolean;
  timestamp: number;
  publisherId: string;
  expiryInterval?: number;  // v5.0
  contentType?: string;     // v5.0
  responseTopic?: string;   // v5.0
  correlationData?: string; // v5.0
  userProperties?: Record<string, string>;  // v5.0
}

interface MQTTSubscription {
  topic: string;
  qos: QoSLevel;
  clientId: string;
  timestamp: number;
  sharedGroup?: string;  // v5.0 shared subscription
}

interface MQTTClient {
  id: string;
  state: ClientState;
  version: MQTTVersion;
  cleanSession: boolean;
  keepAlive: number;
  lastSeen: number;
  subscriptions: Map<string, MQTTSubscription>;
  messageQueue: MQTTMessage[];
  pendingAcks: Map<number, { message: MQTTMessage; state: 'puback' | 'pubrec' | 'pubrel' | 'pubcomp' }>;
  willMessage?: MQTTWillMessage;
  sessionExpiry?: number;  // v5.0
}

interface MQTTWillMessage {
  topic: string;
  payload: string;
  qos: QoSLevel;
  retain: boolean;
  delay?: number;  // v5.0 will delay interval
}

interface TopicTreeNode {
  name: string;
  children: Map<string, TopicTreeNode>;
  subscribers: Set<string>;  // client IDs
  retainedMessage?: MQTTMessage;
}

interface BrokerStats {
  totalClients: number;
  connectedClients: number;
  totalSubscriptions: number;
  totalTopics: number;
  messagesReceived: number;
  messagesSent: number;
  retainedMessages: number;
  uptime: number;
}

interface NetworkCondition {
  latencyMs: number;
  packetLoss: number;  // 0-1
  disconnectProbability: number;
}

// ============================================================================
// TOPIC MATCHING UTILITIES
// ============================================================================

/**
 * Match topic against subscription pattern with wildcards
 * + matches single level
 * # matches multiple levels (must be at end)
 */
function topicMatches(pattern: string, topic: string): boolean {
  const patternParts = pattern.split('/');
  const topicParts = topic.split('/');

  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i];

    if (p === '#') {
      // # matches everything from here
      return true;
    }

    if (i >= topicParts.length) {
      // Topic is shorter than pattern
      return false;
    }

    if (p === '+') {
      // + matches any single level
      continue;
    }

    if (p !== topicParts[i]) {
      return false;
    }
  }

  // Pattern fully consumed, topic must also be fully consumed
  return patternParts.length === topicParts.length;
}

/**
 * Validate topic name (for publishing)
 */
function isValidTopicName(topic: string): { valid: boolean; error?: string } {
  if (!topic || topic.length === 0) {
    return { valid: false, error: 'Topic cannot be empty' };
  }
  if (topic.length > 65535) {
    return { valid: false, error: 'Topic too long (max 65535 bytes)' };
  }
  if (topic.includes('+') || topic.includes('#')) {
    return { valid: false, error: 'Wildcards not allowed in publish topic' };
  }
  if (topic.startsWith('$')) {
    return { valid: false, error: 'Topics starting with $ are reserved' };
  }
  return { valid: true };
}

/**
 * Validate subscription pattern
 */
function isValidSubscriptionPattern(pattern: string): { valid: boolean; error?: string } {
  if (!pattern || pattern.length === 0) {
    return { valid: false, error: 'Pattern cannot be empty' };
  }

  const parts = pattern.split('/');
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // # must be alone and at the end
    if (part.includes('#')) {
      if (part !== '#' || i !== parts.length - 1) {
        return { valid: false, error: '# wildcard must be alone at end of pattern' };
      }
    }

    // + must be alone in its level
    if (part.includes('+') && part !== '+') {
      return { valid: false, error: '+ wildcard must be alone in its level' };
    }
  }

  return { valid: true };
}

// ============================================================================
// MQTT BROKER SIMULATOR CLASS
// ============================================================================

class MQTTBrokerSimulator {
  private clients: Map<string, MQTTClient> = new Map();
  private topicTree: TopicTreeNode;
  private messages: MQTTMessage[] = [];
  private messageIdCounter: number = 0;
  private baseTime: number;
  private stats: {
    messagesReceived: number;
    messagesSent: number;
  };
  private networkCondition: NetworkCondition;
  private sharedSubscriptions: Map<string, Set<string>> = new Map();  // group -> client IDs

  constructor() {
    this.baseTime = Date.now();
    this.topicTree = { name: '', children: new Map(), subscribers: new Set() };
    this.stats = { messagesReceived: 0, messagesSent: 0 };
    this.networkCondition = { latencyMs: 0, packetLoss: 0, disconnectProbability: 0 };
  }

  private now(): number {
    return Date.now() - this.baseTime;
  }

  private generateMessageId(): number {
    return ++this.messageIdCounter;
  }

  private getOrCreateTopicNode(topic: string): TopicTreeNode {
    const parts = topic.split('/');
    let node = this.topicTree;

    for (const part of parts) {
      if (!node.children.has(part)) {
        node.children.set(part, {
          name: part,
          children: new Map(),
          subscribers: new Set(),
        });
      }
      node = node.children.get(part)!;
    }

    return node;
  }

  private findMatchingSubscribers(topic: string): { clientId: string; qos: QoSLevel; sharedGroup?: string }[] {
    const subscribers: { clientId: string; qos: QoSLevel; sharedGroup?: string }[] = [];
    const usedSharedGroups = new Set<string>();

    for (const client of this.clients.values()) {
      if (client.state !== 'connected') continue;

      for (const [pattern, sub] of client.subscriptions) {
        if (topicMatches(pattern, topic)) {
          // Handle shared subscriptions - only one client per group gets the message
          if (sub.sharedGroup) {
            if (!usedSharedGroups.has(sub.sharedGroup)) {
              usedSharedGroups.add(sub.sharedGroup);
              subscribers.push({ clientId: client.id, qos: sub.qos, sharedGroup: sub.sharedGroup });
            }
          } else {
            subscribers.push({ clientId: client.id, qos: sub.qos });
          }
          break; // Only match once per client
        }
      }
    }

    return subscribers;
  }

  private simulateNetworkDelivery(): { success: boolean; latency: number } {
    const latency = this.networkCondition.latencyMs;
    const success = Math.random() > this.networkCondition.packetLoss;
    return { success, latency };
  }

  private cleanExpiredMessages(): void {
    const now = this.now();

    // Clean expired messages in queues
    for (const client of this.clients.values()) {
      client.messageQueue = client.messageQueue.filter(msg => {
        if (msg.expiryInterval) {
          const age = now - msg.timestamp;
          return age < msg.expiryInterval * 1000;
        }
        return true;
      });
    }

    // Clean expired retained messages
    const cleanNode = (node: TopicTreeNode) => {
      if (node.retainedMessage && node.retainedMessage.expiryInterval) {
        const age = now - node.retainedMessage.timestamp;
        if (age >= node.retainedMessage.expiryInterval * 1000) {
          node.retainedMessage = undefined;
        }
      }
      for (const child of node.children.values()) {
        cleanNode(child);
      }
    };
    cleanNode(this.topicTree);
  }

  connect(
    clientId: string,
    options?: {
      version?: MQTTVersion;
      cleanSession?: boolean;
      keepAlive?: number;
      willMessage?: MQTTWillMessage;
      sessionExpiry?: number;
    }
  ): {
    success: boolean;
    client: MQTTClient;
    sessionPresent: boolean;
    error?: string;
  } {
    const version = options?.version || '3.1.1';
    const cleanSession = options?.cleanSession ?? true;

    // Check if client exists
    let client = this.clients.get(clientId);
    let sessionPresent = false;

    if (client) {
      if (client.state === 'connected') {
        // Disconnect existing connection
        this.publishWillMessage(client);
        client.state = 'disconnected';
      }

      if (!cleanSession && !client.cleanSession) {
        // Resume session
        sessionPresent = true;
        client.state = 'connected';
        client.lastSeen = this.now();
        client.version = version;
        client.keepAlive = options?.keepAlive || 60;
        if (options?.willMessage) {
          client.willMessage = options.willMessage;
        }
      } else {
        // Create new session
        client.subscriptions.clear();
        client.messageQueue = [];
        client.pendingAcks.clear();
        client.state = 'connected';
        client.cleanSession = cleanSession;
        client.version = version;
        client.keepAlive = options?.keepAlive || 60;
        client.lastSeen = this.now();
        client.willMessage = options?.willMessage;
        client.sessionExpiry = options?.sessionExpiry;
      }
    } else {
      // New client
      client = {
        id: clientId,
        state: 'connected',
        version,
        cleanSession,
        keepAlive: options?.keepAlive || 60,
        lastSeen: this.now(),
        subscriptions: new Map(),
        messageQueue: [],
        pendingAcks: new Map(),
        willMessage: options?.willMessage,
        sessionExpiry: options?.sessionExpiry,
      };
      this.clients.set(clientId, client);
    }

    return {
      success: true,
      client,
      sessionPresent,
    };
  }

  disconnect(clientId: string, sendWill: boolean = false): {
    success: boolean;
    error?: string;
  } {
    const client = this.clients.get(clientId);
    if (!client) {
      return { success: false, error: 'Client not found' };
    }

    if (sendWill) {
      this.publishWillMessage(client);
    }

    client.state = 'disconnected';

    // Clean up if clean session
    if (client.cleanSession) {
      // Remove from all subscription lists
      for (const [pattern] of client.subscriptions) {
        this.removeSubscriptionFromTree(pattern, clientId);
      }
      this.clients.delete(clientId);
    }

    return { success: true };
  }

  private publishWillMessage(client: MQTTClient): void {
    if (client.willMessage) {
      this.publish(
        client.id,
        client.willMessage.topic,
        client.willMessage.payload,
        {
          qos: client.willMessage.qos,
          retain: client.willMessage.retain,
        }
      );
    }
  }

  private removeSubscriptionFromTree(_pattern: string, clientId: string): void {
    // Remove from shared subscription group if applicable
    for (const [group, clients] of this.sharedSubscriptions) {
      if (clients.has(clientId)) {
        clients.delete(clientId);
        if (clients.size === 0) {
          this.sharedSubscriptions.delete(group);
        }
      }
    }
  }

  subscribe(
    clientId: string,
    topic: string,
    qos: QoSLevel = 0,
    options?: { sharedGroup?: string }
  ): {
    success: boolean;
    grantedQos: QoSLevel;
    retainedMessages: MQTTMessage[];
    error?: string;
  } {
    const client = this.clients.get(clientId);
    if (!client || client.state !== 'connected') {
      return { success: false, grantedQos: 0, retainedMessages: [], error: 'Client not connected' };
    }

    const validation = isValidSubscriptionPattern(topic);
    if (!validation.valid) {
      return { success: false, grantedQos: 0, retainedMessages: [], error: validation.error };
    }

    // Parse shared subscription ($share/group/topic)
    let actualTopic = topic;
    let sharedGroup = options?.sharedGroup;

    if (topic.startsWith('$share/')) {
      const parts = topic.split('/');
      if (parts.length >= 3) {
        sharedGroup = parts[1];
        actualTopic = parts.slice(2).join('/');
      }
    }

    const subscription: MQTTSubscription = {
      topic: actualTopic,
      qos,
      clientId,
      timestamp: this.now(),
      sharedGroup,
    };

    client.subscriptions.set(actualTopic, subscription);

    // Add to shared subscription group
    if (sharedGroup) {
      if (!this.sharedSubscriptions.has(sharedGroup)) {
        this.sharedSubscriptions.set(sharedGroup, new Set());
      }
      this.sharedSubscriptions.get(sharedGroup)!.add(clientId);
    }

    // Find and return retained messages
    const retainedMessages: MQTTMessage[] = [];
    this.findRetainedMessages(this.topicTree, '', actualTopic, retainedMessages);

    return {
      success: true,
      grantedQos: qos,
      retainedMessages,
    };
  }

  private findRetainedMessages(
    node: TopicTreeNode,
    currentPath: string,
    pattern: string,
    results: MQTTMessage[]
  ): void {
    const fullPath = currentPath ? `${currentPath}/${node.name}` : node.name;

    if (node.retainedMessage && (fullPath === '' || topicMatches(pattern, fullPath))) {
      results.push(node.retainedMessage);
    }

    for (const [, child] of node.children) {
      const childPath = fullPath ? `${fullPath}/${child.name}` : child.name;
      // Only descend if the pattern could match
      const patternParts = pattern.split('/');
      const pathParts = childPath.split('/').filter(p => p);

      if (pathParts.length <= patternParts.length || patternParts.includes('#')) {
        this.findRetainedMessages(child, fullPath, pattern, results);
      }
    }
  }

  unsubscribe(clientId: string, topic: string): {
    success: boolean;
    error?: string;
  } {
    const client = this.clients.get(clientId);
    if (!client) {
      return { success: false, error: 'Client not found' };
    }

    if (!client.subscriptions.has(topic)) {
      return { success: false, error: 'Subscription not found' };
    }

    const sub = client.subscriptions.get(topic)!;
    client.subscriptions.delete(topic);

    // Remove from shared group
    if (sub.sharedGroup) {
      const group = this.sharedSubscriptions.get(sub.sharedGroup);
      if (group) {
        group.delete(clientId);
        if (group.size === 0) {
          this.sharedSubscriptions.delete(sub.sharedGroup);
        }
      }
    }

    return { success: true };
  }

  publish(
    clientId: string,
    topic: string,
    payload: string,
    options?: {
      qos?: QoSLevel;
      retain?: boolean;
      expiryInterval?: number;
      contentType?: string;
      responseTopic?: string;
      correlationData?: string;
      userProperties?: Record<string, string>;
    }
  ): {
    success: boolean;
    messageId: number;
    deliveredTo: string[];
    error?: string;
  } {
    const client = this.clients.get(clientId);
    if (!client || client.state !== 'connected') {
      return { success: false, messageId: 0, deliveredTo: [], error: 'Client not connected' };
    }

    const validation = isValidTopicName(topic);
    if (!validation.valid) {
      return { success: false, messageId: 0, deliveredTo: [], error: validation.error };
    }

    const qos = options?.qos ?? 0;
    const retain = options?.retain ?? false;

    const message: MQTTMessage = {
      id: this.generateMessageId(),
      topic,
      payload,
      qos,
      retain,
      timestamp: this.now(),
      publisherId: clientId,
      expiryInterval: options?.expiryInterval,
      contentType: options?.contentType,
      responseTopic: options?.responseTopic,
      correlationData: options?.correlationData,
      userProperties: options?.userProperties,
    };

    this.stats.messagesReceived++;
    this.messages.push(message);

    // Keep messages manageable
    if (this.messages.length > 10000) {
      this.messages = this.messages.slice(-5000);
    }

    // Handle retain
    if (retain) {
      const node = this.getOrCreateTopicNode(topic);
      if (payload === '') {
        // Empty payload removes retained message
        node.retainedMessage = undefined;
      } else {
        node.retainedMessage = message;
      }
    }

    // Find subscribers and deliver
    const subscribers = this.findMatchingSubscribers(topic);
    const deliveredTo: string[] = [];

    for (const sub of subscribers) {
      if (sub.clientId === clientId) continue; // Don't deliver to self

      const targetClient = this.clients.get(sub.clientId);
      if (!targetClient || targetClient.state !== 'connected') continue;

      // Simulate network
      const network = this.simulateNetworkDelivery();
      if (!network.success) continue;

      // Determine effective QoS (minimum of publisher and subscriber QoS)
      const effectiveQos = Math.min(qos, sub.qos) as QoSLevel;

      // Create message copy for this subscriber
      const deliveredMessage = { ...message, qos: effectiveQos };

      if (effectiveQos === 0) {
        // QoS 0: Fire and forget
        deliveredTo.push(sub.clientId);
      } else if (effectiveQos === 1) {
        // QoS 1: At least once - add to pending, expect PUBACK
        targetClient.pendingAcks.set(message.id, { message: deliveredMessage, state: 'puback' });
        deliveredTo.push(sub.clientId);
      } else if (effectiveQos === 2) {
        // QoS 2: Exactly once - add to pending, expect PUBREC
        targetClient.pendingAcks.set(message.id, { message: deliveredMessage, state: 'pubrec' });
        deliveredTo.push(sub.clientId);
      }

      // Add to client's message queue for retrieval
      targetClient.messageQueue.push(deliveredMessage);
      if (targetClient.messageQueue.length > 1000) {
        targetClient.messageQueue = targetClient.messageQueue.slice(-500);
      }

      this.stats.messagesSent++;
    }

    return {
      success: true,
      messageId: message.id,
      deliveredTo,
    };
  }

  acknowledgeMessage(
    clientId: string,
    messageId: number,
    ackType: 'puback' | 'pubrec' | 'pubrel' | 'pubcomp'
  ): {
    success: boolean;
    nextExpected?: 'pubrel' | 'pubcomp';
    error?: string;
  } {
    const client = this.clients.get(clientId);
    if (!client) {
      return { success: false, error: 'Client not found' };
    }

    const pending = client.pendingAcks.get(messageId);
    if (!pending) {
      return { success: false, error: 'No pending acknowledgment for this message' };
    }

    // QoS 1 flow: PUBLISH -> PUBACK
    if (pending.state === 'puback' && ackType === 'puback') {
      client.pendingAcks.delete(messageId);
      return { success: true };
    }

    // QoS 2 flow: PUBLISH -> PUBREC -> PUBREL -> PUBCOMP
    if (pending.state === 'pubrec' && ackType === 'pubrec') {
      pending.state = 'pubrel';
      return { success: true, nextExpected: 'pubrel' };
    }

    if (pending.state === 'pubrel' && ackType === 'pubrel') {
      pending.state = 'pubcomp';
      return { success: true, nextExpected: 'pubcomp' };
    }

    if (pending.state === 'pubcomp' && ackType === 'pubcomp') {
      client.pendingAcks.delete(messageId);
      return { success: true };
    }

    return { success: false, error: `Unexpected ack type ${ackType} for state ${pending.state}` };
  }

  getMessages(
    clientId: string,
    options?: { limit?: number; clear?: boolean }
  ): {
    messages: MQTTMessage[];
    pendingAcks: number;
  } {
    // Clean up expired messages before returning
    this.cleanExpiredMessages();

    const client = this.clients.get(clientId);
    if (!client) {
      return { messages: [], pendingAcks: 0 };
    }

    const limit = options?.limit ?? 100;
    const messages = client.messageQueue.slice(0, limit);

    if (options?.clear) {
      client.messageQueue = client.messageQueue.slice(limit);
    }

    return {
      messages,
      pendingAcks: client.pendingAcks.size,
    };
  }

  listTopics(): {
    topics: { topic: string; hasRetained: boolean; subscriberCount: number }[];
  } {
    const topics: { topic: string; hasRetained: boolean; subscriberCount: number }[] = [];

    const traverse = (node: TopicTreeNode, path: string) => {
      const currentPath = path ? `${path}/${node.name}` : node.name;

      if (currentPath && (node.retainedMessage || node.subscribers.size > 0)) {
        // Count subscribers across all clients for this topic
        let subscriberCount = 0;
        for (const client of this.clients.values()) {
          for (const [pattern] of client.subscriptions) {
            if (topicMatches(pattern, currentPath)) {
              subscriberCount++;
              break;
            }
          }
        }

        topics.push({
          topic: currentPath,
          hasRetained: !!node.retainedMessage,
          subscriberCount,
        });
      }

      for (const [, child] of node.children) {
        traverse(child, currentPath);
      }
    };

    traverse(this.topicTree, '');
    return { topics };
  }

  getStats(): BrokerStats {
    let totalSubscriptions = 0;
    let connectedClients = 0;
    let retainedMessages = 0;

    for (const client of this.clients.values()) {
      totalSubscriptions += client.subscriptions.size;
      if (client.state === 'connected') {
        connectedClients++;
      }
    }

    const countRetained = (node: TopicTreeNode): number => {
      let count = node.retainedMessage ? 1 : 0;
      for (const [, child] of node.children) {
        count += countRetained(child);
      }
      return count;
    };
    retainedMessages = countRetained(this.topicTree);

    return {
      totalClients: this.clients.size,
      connectedClients,
      totalSubscriptions,
      totalTopics: this.listTopics().topics.length,
      messagesReceived: this.stats.messagesReceived,
      messagesSent: this.stats.messagesSent,
      retainedMessages,
      uptime: this.now(),
    };
  }

  simulateNetwork(condition: Partial<NetworkCondition>): NetworkCondition {
    this.networkCondition = {
      ...this.networkCondition,
      ...condition,
    };
    return this.networkCondition;
  }

  getClient(clientId: string): MQTTClient | undefined {
    return this.clients.get(clientId);
  }

  getAllClients(): MQTTClient[] {
    return Array.from(this.clients.values());
  }

  reset(): void {
    this.clients.clear();
    this.topicTree = { name: '', children: new Map(), subscribers: new Set() };
    this.messages = [];
    this.messageIdCounter = 0;
    this.stats = { messagesReceived: 0, messagesSent: 0 };
    this.sharedSubscriptions.clear();
    this.baseTime = Date.now();
  }
}

// ============================================================================
// GLOBAL BROKER INSTANCE
// ============================================================================

const broker = new MQTTBrokerSimulator();

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const mqttprotocolTool: UnifiedTool = {
  name: 'mqtt_protocol',
  description: `Comprehensive MQTT message broker simulator for IoT development.

Features:
- MQTT v3.1.1 and v5.0 protocol support
- Topic subscription with wildcards (+, #)
- QoS levels 0, 1, 2 with proper message flow
- Retain messages and Will messages (LWT)
- Session persistence (clean session flag)
- Message queue management
- Topic tree structure with subscriber tracking
- Message expiry (v5.0)
- Shared subscriptions (v5.0)
- Network condition simulation (latency, packet loss)

Operations: connect, disconnect, publish, subscribe, unsubscribe, get_messages, list_topics, get_stats, simulate_network, get_client, list_clients, ack_message, reset, info, examples`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'connect', 'disconnect', 'publish', 'subscribe', 'unsubscribe',
          'get_messages', 'list_topics', 'get_stats', 'simulate_network',
          'get_client', 'list_clients', 'ack_message', 'reset', 'info', 'examples'
        ],
        description: 'Operation to perform'
      },
      client_id: {
        type: 'string',
        description: 'MQTT client identifier'
      },
      topic: {
        type: 'string',
        description: 'Topic name or subscription pattern'
      },
      payload: {
        type: 'string',
        description: 'Message payload'
      },
      qos: {
        type: 'number',
        description: 'Quality of Service level (0, 1, or 2)'
      },
      retain: {
        type: 'boolean',
        description: 'Retain flag for publish'
      },
      clean_session: {
        type: 'boolean',
        description: 'Clean session flag for connect'
      },
      version: {
        type: 'string',
        enum: ['3.1.1', '5.0'],
        description: 'MQTT protocol version'
      },
      keep_alive: {
        type: 'number',
        description: 'Keep alive interval in seconds'
      },
      will_topic: {
        type: 'string',
        description: 'Will message topic (LWT)'
      },
      will_payload: {
        type: 'string',
        description: 'Will message payload (LWT)'
      },
      will_qos: {
        type: 'number',
        description: 'Will message QoS'
      },
      will_retain: {
        type: 'boolean',
        description: 'Will message retain flag'
      },
      message_id: {
        type: 'number',
        description: 'Message ID for acknowledgment'
      },
      ack_type: {
        type: 'string',
        enum: ['puback', 'pubrec', 'pubrel', 'pubcomp'],
        description: 'Acknowledgment type'
      },
      expiry_interval: {
        type: 'number',
        description: 'Message expiry in seconds (v5.0)'
      },
      content_type: {
        type: 'string',
        description: 'Content type (v5.0)'
      },
      shared_group: {
        type: 'string',
        description: 'Shared subscription group name (v5.0)'
      },
      latency_ms: {
        type: 'number',
        description: 'Network latency in milliseconds'
      },
      packet_loss: {
        type: 'number',
        description: 'Packet loss rate (0-1)'
      },
      limit: {
        type: 'number',
        description: 'Limit for message retrieval'
      },
      clear: {
        type: 'boolean',
        description: 'Clear messages after retrieval'
      },
      send_will: {
        type: 'boolean',
        description: 'Send will message on disconnect'
      }
    },
    required: ['operation']
  }
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executemqttprotocol(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    switch (operation) {
      case 'connect': {
        const clientId = args.client_id || `client_${Date.now()}`;
        const options: {
          version?: MQTTVersion;
          cleanSession?: boolean;
          keepAlive?: number;
          willMessage?: MQTTWillMessage;
          sessionExpiry?: number;
        } = {};

        if (args.version) options.version = args.version;
        if (args.clean_session !== undefined) options.cleanSession = args.clean_session;
        if (args.keep_alive) options.keepAlive = args.keep_alive;
        if (args.session_expiry) options.sessionExpiry = args.session_expiry;

        if (args.will_topic) {
          options.willMessage = {
            topic: args.will_topic,
            payload: args.will_payload || '',
            qos: (args.will_qos || 0) as QoSLevel,
            retain: args.will_retain || false,
          };
        }

        const result = broker.connect(clientId, options);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'connect',
            result: {
              success: result.success,
              clientId: result.client.id,
              version: result.client.version,
              cleanSession: result.client.cleanSession,
              sessionPresent: result.sessionPresent,
              subscriptionCount: result.client.subscriptions.size,
              hasWill: !!result.client.willMessage,
            },
          }, null, 2)
        };
      }

      case 'disconnect': {
        const clientId = args.client_id;
        if (!clientId) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'client_id required' }, null, 2),
            isError: true
          };
        }

        const sendWill = args.send_will ?? false;
        const result = broker.disconnect(clientId, sendWill);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'disconnect',
            clientId,
            sendWill,
            result,
          }, null, 2)
        };
      }

      case 'publish': {
        const clientId = args.client_id;
        const topic = args.topic;
        const payload = args.payload ?? '';

        if (!clientId) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'client_id required' }, null, 2),
            isError: true
          };
        }

        if (!topic) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'topic required' }, null, 2),
            isError: true
          };
        }

        const options: {
          qos?: QoSLevel;
          retain?: boolean;
          expiryInterval?: number;
          contentType?: string;
        } = {};

        if (args.qos !== undefined) options.qos = args.qos as QoSLevel;
        if (args.retain !== undefined) options.retain = args.retain;
        if (args.expiry_interval) options.expiryInterval = args.expiry_interval;
        if (args.content_type) options.contentType = args.content_type;

        const result = broker.publish(clientId, topic, payload, options);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'publish',
            clientId,
            topic,
            payload: payload.length > 100 ? `${payload.substring(0, 100)}...` : payload,
            qos: options.qos ?? 0,
            retain: options.retain ?? false,
            result: {
              success: result.success,
              messageId: result.messageId,
              deliveredTo: result.deliveredTo,
              deliveryCount: result.deliveredTo.length,
              error: result.error,
            },
          }, null, 2)
        };
      }

      case 'subscribe': {
        const clientId = args.client_id;
        const topic = args.topic;
        const qos = (args.qos ?? 0) as QoSLevel;

        if (!clientId) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'client_id required' }, null, 2),
            isError: true
          };
        }

        if (!topic) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'topic required' }, null, 2),
            isError: true
          };
        }

        const options: { sharedGroup?: string } = {};
        if (args.shared_group) options.sharedGroup = args.shared_group;

        const result = broker.subscribe(clientId, topic, qos, options);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'subscribe',
            clientId,
            topic,
            requestedQos: qos,
            result: {
              success: result.success,
              grantedQos: result.grantedQos,
              retainedMessageCount: result.retainedMessages.length,
              retainedMessages: result.retainedMessages.slice(0, 5).map(m => ({
                topic: m.topic,
                payload: m.payload.length > 50 ? `${m.payload.substring(0, 50)}...` : m.payload,
              })),
              error: result.error,
            },
          }, null, 2)
        };
      }

      case 'unsubscribe': {
        const clientId = args.client_id;
        const topic = args.topic;

        if (!clientId || !topic) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'client_id and topic required' }, null, 2),
            isError: true
          };
        }

        const result = broker.unsubscribe(clientId, topic);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'unsubscribe',
            clientId,
            topic,
            result,
          }, null, 2)
        };
      }

      case 'get_messages': {
        const clientId = args.client_id;

        if (!clientId) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'client_id required' }, null, 2),
            isError: true
          };
        }

        const options = {
          limit: args.limit,
          clear: args.clear,
        };

        const result = broker.getMessages(clientId, options);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_messages',
            clientId,
            messageCount: result.messages.length,
            pendingAcks: result.pendingAcks,
            messages: result.messages.map(m => ({
              id: m.id,
              topic: m.topic,
              payload: m.payload.length > 100 ? `${m.payload.substring(0, 100)}...` : m.payload,
              qos: m.qos,
              retain: m.retain,
              publisherId: m.publisherId,
              timestamp: m.timestamp,
            })),
          }, null, 2)
        };
      }

      case 'list_topics': {
        const result = broker.listTopics();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'list_topics',
            topicCount: result.topics.length,
            topics: result.topics,
          }, null, 2)
        };
      }

      case 'get_stats': {
        const stats = broker.getStats();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_stats',
            stats: {
              ...stats,
              uptimeFormatted: `${Math.floor(stats.uptime / 1000)}s`,
            },
          }, null, 2)
        };
      }

      case 'simulate_network': {
        const condition: Partial<NetworkCondition> = {};

        if (args.latency_ms !== undefined) condition.latencyMs = args.latency_ms;
        if (args.packet_loss !== undefined) condition.packetLoss = args.packet_loss;

        const result = broker.simulateNetwork(condition);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'simulate_network',
            networkCondition: result,
          }, null, 2)
        };
      }

      case 'get_client': {
        const clientId = args.client_id;

        if (!clientId) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'client_id required' }, null, 2),
            isError: true
          };
        }

        const client = broker.getClient(clientId);

        if (!client) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'get_client',
              clientId,
              error: 'Client not found',
            }, null, 2)
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_client',
            client: {
              id: client.id,
              state: client.state,
              version: client.version,
              cleanSession: client.cleanSession,
              keepAlive: client.keepAlive,
              subscriptions: Array.from(client.subscriptions.entries()).map(([topic, sub]) => ({
                topic,
                qos: sub.qos,
                sharedGroup: sub.sharedGroup,
              })),
              messageQueueSize: client.messageQueue.length,
              pendingAcks: client.pendingAcks.size,
              hasWill: !!client.willMessage,
            },
          }, null, 2)
        };
      }

      case 'list_clients': {
        const clients = broker.getAllClients();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'list_clients',
            clientCount: clients.length,
            clients: clients.map(c => ({
              id: c.id,
              state: c.state,
              version: c.version,
              subscriptionCount: c.subscriptions.size,
              messageQueueSize: c.messageQueue.length,
            })),
          }, null, 2)
        };
      }

      case 'ack_message': {
        const clientId = args.client_id;
        const messageId = args.message_id;
        const ackType = args.ack_type;

        if (!clientId || messageId === undefined || !ackType) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'client_id, message_id, and ack_type required' }, null, 2),
            isError: true
          };
        }

        const result = broker.acknowledgeMessage(clientId, messageId, ackType);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'ack_message',
            clientId,
            messageId,
            ackType,
            result,
          }, null, 2)
        };
      }

      case 'reset': {
        broker.reset();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'reset',
            message: 'MQTT broker reset to initial state',
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'MQTT Protocol Broker Simulator',
            description: 'Comprehensive MQTT broker simulation for IoT development',
            features: {
              protocolVersions: ['3.1.1', '5.0'],
              qosLevels: {
                0: 'At most once (fire and forget)',
                1: 'At least once (acknowledged delivery)',
                2: 'Exactly once (assured delivery)',
              },
              wildcards: {
                '+': 'Single-level wildcard (matches one level)',
                '#': 'Multi-level wildcard (matches all remaining levels)',
              },
              v5Features: [
                'Message expiry interval',
                'Content type',
                'Response topic',
                'Correlation data',
                'User properties',
                'Shared subscriptions ($share/group/topic)',
                'Session expiry interval',
              ],
              messageTypes: [
                'CONNECT/CONNACK',
                'PUBLISH',
                'PUBACK (QoS 1)',
                'PUBREC/PUBREL/PUBCOMP (QoS 2)',
                'SUBSCRIBE/SUBACK',
                'UNSUBSCRIBE/UNSUBACK',
                'DISCONNECT',
              ],
            },
            operations: [
              { name: 'connect', desc: 'Connect client to broker' },
              { name: 'disconnect', desc: 'Disconnect client (optionally send will)' },
              { name: 'publish', desc: 'Publish message to topic' },
              { name: 'subscribe', desc: 'Subscribe to topic pattern' },
              { name: 'unsubscribe', desc: 'Unsubscribe from topic' },
              { name: 'get_messages', desc: 'Get messages for client' },
              { name: 'list_topics', desc: 'List all topics with info' },
              { name: 'get_stats', desc: 'Get broker statistics' },
              { name: 'simulate_network', desc: 'Configure network simulation' },
              { name: 'get_client', desc: 'Get client details' },
              { name: 'list_clients', desc: 'List all clients' },
              { name: 'ack_message', desc: 'Acknowledge QoS 1/2 message' },
              { name: 'reset', desc: 'Reset broker to initial state' },
            ],
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Connect client',
                call: { operation: 'connect', client_id: 'sensor1', version: '5.0', clean_session: true }
              },
              {
                name: 'Connect with will message (LWT)',
                call: {
                  operation: 'connect',
                  client_id: 'sensor2',
                  will_topic: 'sensors/sensor2/status',
                  will_payload: 'offline',
                  will_retain: true
                }
              },
              {
                name: 'Subscribe to topic',
                call: { operation: 'subscribe', client_id: 'sensor1', topic: 'home/temperature', qos: 1 }
              },
              {
                name: 'Subscribe with wildcard',
                call: { operation: 'subscribe', client_id: 'sensor1', topic: 'home/+/temperature', qos: 0 }
              },
              {
                name: 'Subscribe to all (multi-level wildcard)',
                call: { operation: 'subscribe', client_id: 'sensor1', topic: 'home/#', qos: 0 }
              },
              {
                name: 'Publish message QoS 0',
                call: { operation: 'publish', client_id: 'sensor1', topic: 'home/living/temperature', payload: '22.5', qos: 0 }
              },
              {
                name: 'Publish retained message',
                call: { operation: 'publish', client_id: 'sensor1', topic: 'home/status', payload: 'online', retain: true }
              },
              {
                name: 'Publish with expiry (v5.0)',
                call: { operation: 'publish', client_id: 'sensor1', topic: 'alerts/temp', payload: 'high', qos: 1, expiry_interval: 3600 }
              },
              {
                name: 'Get messages for client',
                call: { operation: 'get_messages', client_id: 'sensor1', limit: 10, clear: true }
              },
              {
                name: 'Shared subscription (v5.0)',
                call: { operation: 'subscribe', client_id: 'worker1', topic: '$share/workers/tasks/#', qos: 1 }
              },
              {
                name: 'Simulate network issues',
                call: { operation: 'simulate_network', latency_ms: 100, packet_loss: 0.1 }
              },
              {
                name: 'Get broker statistics',
                call: { operation: 'get_stats' }
              }
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use 'info' for available operations.`,
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ismqttprotocolAvailable(): boolean {
  return true;
}
