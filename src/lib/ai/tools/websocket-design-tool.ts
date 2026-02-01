/**
 * WEBSOCKET DESIGN TOOL
 * Design real-time WebSocket applications
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function designWebSocketServer(config: {
  type?: 'chat' | 'notifications' | 'collaboration' | 'gaming' | 'streaming';
  scalingStrategy?: 'single' | 'redis' | 'kafka';
  authentication?: 'jwt' | 'session' | 'apiKey';
}): Record<string, unknown> {
  const { type = 'chat', scalingStrategy = 'redis', authentication = 'jwt' } = config;

  const serverImplementation = `import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from 'redis';
import jwt from 'jsonwebtoken';

interface Client {
  ws: WebSocket;
  userId: string;
  rooms: Set<string>;
}

class WSServer {
  private wss: WebSocketServer;
  private clients: Map<string, Client> = new Map();
  private redis: ReturnType<typeof createClient>;
  private pubClient: ReturnType<typeof createClient>;
  private subClient: ReturnType<typeof createClient>;

  async start(port: number) {
    // Redis for scaling
    this.redis = createClient();
    this.pubClient = this.redis.duplicate();
    this.subClient = this.redis.duplicate();
    await Promise.all([
      this.redis.connect(),
      this.pubClient.connect(),
      this.subClient.connect()
    ]);

    // Subscribe to cross-server messages
    await this.subClient.subscribe('ws:broadcast', (message) => {
      const { room, data, excludeClient } = JSON.parse(message);
      this.broadcastToRoom(room, data, excludeClient);
    });

    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', async (ws, req) => {
      try {
        const client = await this.authenticateClient(ws, req);
        this.setupClientHandlers(client);
      } catch (error) {
        ws.close(4001, 'Authentication failed');
      }
    });

    console.log(\`WebSocket server running on port \${port}\`);
  }

  private async authenticateClient(ws: WebSocket, req: any): Promise<Client> {
    const token = new URL(req.url, 'http://localhost').searchParams.get('token');
    ${authentication === 'jwt' ? `
    const payload = jwt.verify(token!, process.env.JWT_SECRET!) as { userId: string };
    const userId = payload.userId;` : `
    const userId = token; // Simplified for example`}

    const client: Client = { ws, userId, rooms: new Set() };
    this.clients.set(userId, client);

    // Track online status
    await this.redis.sAdd('online:users', userId);

    return client;
  }

  private setupClientHandlers(client: Client) {
    client.ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(client, message);
      } catch (error) {
        client.ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    client.ws.on('close', async () => {
      this.clients.delete(client.userId);
      await this.redis.sRem('online:users', client.userId);

      // Notify rooms
      for (const room of client.rooms) {
        await this.publishToRoom(room, {
          type: 'user:left',
          userId: client.userId,
          room
        });
      }
    });

    client.ws.on('pong', () => {
      // Connection is alive
    });
  }

  private async handleMessage(client: Client, message: any) {
    switch (message.type) {
      case 'join':
        await this.joinRoom(client, message.room);
        break;
      case 'leave':
        await this.leaveRoom(client, message.room);
        break;
      case 'message':
        await this.publishToRoom(message.room, {
          type: 'message',
          userId: client.userId,
          content: message.content,
          timestamp: Date.now()
        });
        break;
      case 'typing':
        await this.publishToRoom(message.room, {
          type: 'typing',
          userId: client.userId,
          room: message.room
        }, client.userId);
        break;
    }
  }

  private async joinRoom(client: Client, room: string) {
    client.rooms.add(room);
    await this.redis.sAdd(\`room:\${room}:members\`, client.userId);

    await this.publishToRoom(room, {
      type: 'user:joined',
      userId: client.userId,
      room
    });
  }

  private async leaveRoom(client: Client, room: string) {
    client.rooms.delete(room);
    await this.redis.sRem(\`room:\${room}:members\`, client.userId);
  }

  private async publishToRoom(room: string, data: any, excludeClient?: string) {
    await this.pubClient.publish('ws:broadcast', JSON.stringify({
      room,
      data,
      excludeClient
    }));
  }

  private broadcastToRoom(room: string, data: any, excludeClient?: string) {
    for (const [userId, client] of this.clients) {
      if (client.rooms.has(room) && userId !== excludeClient) {
        client.ws.send(JSON.stringify(data));
      }
    }
  }
}

const server = new WSServer();
server.start(8080);`;

  return {
    implementation: serverImplementation,
    messageProtocol: getMessageProtocol(type),
    scalingArchitecture: getScalingArchitecture(scalingStrategy),
    clientImplementation: getClientImplementation(),
    securityConsiderations: [
      'Validate and sanitize all incoming messages',
      'Implement rate limiting per connection',
      'Use WSS (TLS) in production',
      'Validate authentication on every connection',
      'Implement connection timeouts',
      'Handle DoS protection (max connections per IP)'
    ]
  };
}

function getMessageProtocol(type: string): Record<string, unknown> {
  const protocols: Record<string, Record<string, unknown>> = {
    chat: {
      clientToServer: [
        { type: 'join', room: 'string' },
        { type: 'leave', room: 'string' },
        { type: 'message', room: 'string', content: 'string' },
        { type: 'typing', room: 'string' }
      ],
      serverToClient: [
        { type: 'user:joined', userId: 'string', room: 'string' },
        { type: 'user:left', userId: 'string', room: 'string' },
        { type: 'message', userId: 'string', content: 'string', timestamp: 'number' },
        { type: 'typing', userId: 'string', room: 'string' }
      ]
    },
    notifications: {
      serverToClient: [
        { type: 'notification', title: 'string', body: 'string', data: 'object' },
        { type: 'notification:read', notificationId: 'string' },
        { type: 'badge:update', count: 'number' }
      ]
    },
    collaboration: {
      clientToServer: [
        { type: 'cursor:move', x: 'number', y: 'number' },
        { type: 'selection:change', range: 'object' },
        { type: 'operation', ops: 'array' }
      ],
      serverToClient: [
        { type: 'cursor:update', userId: 'string', x: 'number', y: 'number' },
        { type: 'operation', userId: 'string', ops: 'array' },
        { type: 'presence:update', users: 'array' }
      ]
    }
  };

  return protocols[type] || protocols.chat;
}

function getScalingArchitecture(strategy: string): Record<string, unknown> {
  const architectures: Record<string, Record<string, unknown>> = {
    single: {
      description: 'Single server, no horizontal scaling',
      pros: ['Simple', 'No external dependencies'],
      cons: ['No HA', 'Limited connections'],
      maxConnections: '~10,000 per server'
    },
    redis: {
      description: 'Redis Pub/Sub for cross-server communication',
      architecture: `
┌─────────────┐     ┌─────────────┐
│ WS Server 1 │◄───►│    Redis    │◄───►│ WS Server 2 │
└─────────────┘     │   Pub/Sub   │     └─────────────┘
                    └─────────────┘
                          ▲
                          │
                    ┌─────────────┐
                    │ WS Server N │
                    └─────────────┘`,
      pros: ['Easy to implement', 'Works well for most cases'],
      cons: ['Redis is single point of failure', 'Limited by Redis throughput'],
      maxConnections: '~100,000+ with multiple servers'
    },
    kafka: {
      description: 'Kafka for durable, high-throughput messaging',
      architecture: `
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ WS Server 1 │◄───►│    Kafka    │◄───►│ WS Server 2 │
└─────────────┘     │   Cluster   │     └─────────────┘
                    └─────────────┘`,
      pros: ['Highly durable', 'Message replay', 'High throughput'],
      cons: ['Complex setup', 'Higher latency'],
      maxConnections: '~1,000,000+ with proper infrastructure'
    }
  };

  return architectures[strategy] || architectures.redis;
}

function getClientImplementation(): string {
  return `class WSClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: number | null = null;
  private messageHandlers: Map<string, Set<(data: any) => void>> = new Map();

  constructor(private url: string, private token: string) {}

  connect() {
    this.ws = new WebSocket(\`\${this.url}?token=\${this.token}\`);

    this.ws.onopen = () => {
      console.log('Connected');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const handlers = this.messageHandlers.get(message.type);
      handlers?.forEach(handler => handler(message));
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.reconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    setTimeout(() => this.connect(), delay);
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  on(type: string, handler: (data: any) => void) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);
    return () => this.messageHandlers.get(type)!.delete(handler);
  }

  send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  joinRoom(room: string) {
    this.send({ type: 'join', room });
  }

  leaveRoom(room: string) {
    this.send({ type: 'leave', room });
  }

  sendMessage(room: string, content: string) {
    this.send({ type: 'message', room, content });
  }

  disconnect() {
    this.stopHeartbeat();
    this.ws?.close();
  }
}`;
}

function designRealTimeSync(config: {
  dataType?: 'document' | 'list' | 'counter' | 'presence';
  conflictResolution?: 'last-write-wins' | 'operational-transform' | 'crdt';
}): Record<string, unknown> {
  const { dataType = 'document', conflictResolution = 'crdt' } = config;

  const strategies: Record<string, Record<string, unknown>> = {
    'last-write-wins': {
      description: 'Simple timestamp-based conflict resolution',
      implementation: `function merge(local: Data, remote: Data): Data {
  if (remote.timestamp > local.timestamp) {
    return remote;
  }
  return local;
}`,
      pros: ['Simple', 'Easy to implement'],
      cons: ['Can lose concurrent updates']
    },
    'operational-transform': {
      description: 'Transform operations to maintain consistency',
      implementation: `// OT for collaborative text editing
function transform(op1: Operation, op2: Operation): Operation {
  if (op1.type === 'insert' && op2.type === 'insert') {
    if (op1.position <= op2.position) {
      return { ...op2, position: op2.position + op1.text.length };
    }
  }
  // ... more transformation rules
  return op2;
}`,
      pros: ['Handles concurrent edits well', 'Battle-tested (Google Docs)'],
      cons: ['Complex to implement correctly', 'Requires central server']
    },
    crdt: {
      description: 'Conflict-free Replicated Data Types',
      types: {
        'G-Counter': 'Grow-only counter',
        'PN-Counter': 'Increment/decrement counter',
        'G-Set': 'Grow-only set',
        'OR-Set': 'Observed-remove set',
        'LWW-Register': 'Last-writer-wins register',
        'LWW-Map': 'Last-writer-wins map',
        'RGA': 'Replicated Growable Array (for lists)',
        'YATA': 'Yet Another Transformation Approach (for text)'
      },
      implementation: `// CRDT G-Counter
class GCounter {
  private counts: Map<string, number> = new Map();

  constructor(private nodeId: string) {}

  increment() {
    const current = this.counts.get(this.nodeId) || 0;
    this.counts.set(this.nodeId, current + 1);
  }

  value(): number {
    let sum = 0;
    for (const count of this.counts.values()) {
      sum += count;
    }
    return sum;
  }

  merge(other: GCounter) {
    for (const [nodeId, count] of other.counts) {
      const current = this.counts.get(nodeId) || 0;
      this.counts.set(nodeId, Math.max(current, count));
    }
  }

  toJSON() {
    return Object.fromEntries(this.counts);
  }
}`,
      pros: ['Eventually consistent without coordination', 'Works offline'],
      cons: ['Higher memory usage', 'Some operations have limitations'],
      libraries: ['Yjs', 'Automerge', 'Riak CRDTs']
    }
  };

  return {
    dataType,
    conflictResolution: strategies[conflictResolution],
    syncProtocol: {
      steps: [
        '1. Client sends local changes with vector clock',
        '2. Server applies changes and broadcasts to other clients',
        '3. Other clients receive and merge changes',
        '4. Conflicts are resolved using chosen strategy'
      ]
    },
    offlineSupport: `class OfflineSync {
  private pendingOperations: Operation[] = [];
  private syncState: SyncState;

  applyLocal(operation: Operation) {
    // Apply locally immediately
    this.applyOperation(operation);

    // Queue for sync
    this.pendingOperations.push(operation);

    // Try to sync if online
    if (navigator.onLine) {
      this.sync();
    }
  }

  async sync() {
    while (this.pendingOperations.length > 0) {
      const op = this.pendingOperations[0];
      try {
        await this.sendToServer(op);
        this.pendingOperations.shift();
      } catch (error) {
        break; // Will retry later
      }
    }
  }
}`
  };
}

function designPresence(config: {
  features?: ('cursor' | 'selection' | 'status' | 'typing')[];
}): Record<string, unknown> {
  const { features = ['cursor', 'selection', 'status', 'typing'] } = config;

  return {
    features,
    implementation: `interface PresenceData {
  cursor?: { x: number; y: number; };
  selection?: { start: number; end: number; };
  status?: 'online' | 'away' | 'busy';
  lastSeen?: number;
  typing?: boolean;
}

class PresenceManager {
  private presence: Map<string, PresenceData> = new Map();
  private myPresence: PresenceData = { status: 'online' };
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  updateCursor(x: number, y: number) {
    this.myPresence.cursor = { x, y };
    this.throttledBroadcast('cursor');
  }

  updateSelection(start: number, end: number) {
    this.myPresence.selection = { start, end };
    this.debouncedBroadcast('selection', 100);
  }

  setTyping(isTyping: boolean) {
    this.myPresence.typing = isTyping;
    this.broadcast('typing');

    // Auto-clear typing after 3 seconds
    if (isTyping) {
      setTimeout(() => {
        this.myPresence.typing = false;
        this.broadcast('typing');
      }, 3000);
    }
  }

  private throttledBroadcast(key: string, interval = 50) {
    // Throttle updates
  }

  private debouncedBroadcast(key: string, delay: number) {
    const existing = this.debounceTimers.get(key);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(key, setTimeout(() => {
      this.broadcast(key);
    }, delay));
  }

  private broadcast(type: string) {
    ws.send(JSON.stringify({
      type: 'presence',
      data: this.myPresence
    }));
  }

  handleRemotePresence(userId: string, data: PresenceData) {
    this.presence.set(userId, { ...this.presence.get(userId), ...data });
    this.emit('presence:update', { userId, data });
  }

  getPresence(userId: string): PresenceData | undefined {
    return this.presence.get(userId);
  }

  getAllPresence(): Map<string, PresenceData> {
    return this.presence;
  }
}`,
    rendering: `// React component for cursors
function CollaboratorCursors({ presence }: { presence: Map<string, PresenceData> }) {
  return (
    <>
      {Array.from(presence.entries()).map(([userId, data]) => (
        data.cursor && (
          <div
            key={userId}
            className="collaborator-cursor"
            style={{
              left: data.cursor.x,
              top: data.cursor.y,
              backgroundColor: getUserColor(userId)
            }}
          >
            <span className="cursor-label">{getUserName(userId)}</span>
          </div>
        )
      ))}
    </>
  );
}`,
    optimizations: [
      'Throttle cursor updates (50ms)',
      'Debounce selection updates',
      'Batch presence updates',
      'Use delta compression',
      'Prune stale presence data'
    ]
  };
}

export const websocketDesignTool: UnifiedTool = {
  name: 'websocket_design',
  description: 'WebSocket Design: server, real_time_sync, presence',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['server', 'real_time_sync', 'presence'] },
      config: { type: 'object' }
    },
    required: ['operation']
  },
};

export async function executeWebsocketDesign(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'server':
        result = designWebSocketServer(args.config || {});
        break;
      case 'real_time_sync':
        result = designRealTimeSync(args.config || {});
        break;
      case 'presence':
        result = designPresence(args.config || {});
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isWebsocketDesignAvailable(): boolean { return true; }
