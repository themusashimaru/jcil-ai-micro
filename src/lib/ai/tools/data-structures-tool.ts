/**
 * DATA STRUCTURES TOOL
 *
 * Interactive data structure demonstrations and operations.
 * Visualizes stacks, queues, linked lists, trees, and graphs.
 *
 * Part of TIER EDUCATION - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// STACK
// ============================================================================

class Stack<T> {
  private items: T[] = [];
  private history: string[] = [];

  push(item: T): void {
    this.items.push(item);
    this.history.push(`PUSH ${item}`);
  }

  pop(): T | undefined {
    const item = this.items.pop();
    if (item !== undefined) this.history.push(`POP -> ${item}`);
    return item;
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }

  isEmpty(): boolean { return this.items.length === 0; }
  size(): number { return this.items.length; }
  toArray(): T[] { return [...this.items]; }
  getHistory(): string[] { return this.history; }

  visualize(): string {
    if (this.items.length === 0) return '│ (empty) │';
    const lines: string[] = ['┌─────────┐'];
    for (let i = this.items.length - 1; i >= 0; i--) {
      lines.push(`│ ${String(this.items[i]).padEnd(7)} │${i === this.items.length - 1 ? ' ← top' : ''}`);
    }
    lines.push('└─────────┘');
    return lines.join('\n');
  }
}

// ============================================================================
// QUEUE
// ============================================================================

class Queue<T> {
  private items: T[] = [];
  private history: string[] = [];

  enqueue(item: T): void {
    this.items.push(item);
    this.history.push(`ENQUEUE ${item}`);
  }

  dequeue(): T | undefined {
    const item = this.items.shift();
    if (item !== undefined) this.history.push(`DEQUEUE -> ${item}`);
    return item;
  }

  front(): T | undefined { return this.items[0]; }
  isEmpty(): boolean { return this.items.length === 0; }
  size(): number { return this.items.length; }
  toArray(): T[] { return [...this.items]; }
  getHistory(): string[] { return this.history; }

  visualize(): string {
    if (this.items.length === 0) return 'front → (empty) ← back';
    const items = this.items.map((v, i) => {
      if (i === 0) return `[${v}]←front`;
      if (i === this.items.length - 1) return `[${v}]←back`;
      return `[${v}]`;
    });
    return 'front → ' + items.join(' → ') + ' ← back';
  }
}

// ============================================================================
// LINKED LIST
// ============================================================================

interface ListNode<T> {
  value: T;
  next: ListNode<T> | null;
}

class LinkedList<T> {
  head: ListNode<T> | null = null;
  private _size = 0;

  append(value: T): void {
    const node: ListNode<T> = { value, next: null };
    if (!this.head) {
      this.head = node;
    } else {
      let current = this.head;
      while (current.next) current = current.next;
      current.next = node;
    }
    this._size++;
  }

  prepend(value: T): void {
    this.head = { value, next: this.head };
    this._size++;
  }

  delete(value: T): boolean {
    if (!this.head) return false;
    if (this.head.value === value) {
      this.head = this.head.next;
      this._size--;
      return true;
    }
    let current = this.head;
    while (current.next && current.next.value !== value) {
      current = current.next;
    }
    if (current.next) {
      current.next = current.next.next;
      this._size--;
      return true;
    }
    return false;
  }

  find(value: T): number {
    let current = this.head;
    let index = 0;
    while (current) {
      if (current.value === value) return index;
      current = current.next;
      index++;
    }
    return -1;
  }

  size(): number { return this._size; }

  toArray(): T[] {
    const result: T[] = [];
    let current = this.head;
    while (current) {
      result.push(current.value);
      current = current.next;
    }
    return result;
  }

  visualize(): string {
    if (!this.head) return 'null';
    const nodes: string[] = [];
    let current: ListNode<T> | null = this.head;
    while (current) {
      nodes.push(`[${current.value}]`);
      current = current.next;
    }
    return nodes.join(' → ') + ' → null';
  }
}

// ============================================================================
// BINARY TREE
// ============================================================================

interface TreeNode<T> {
  value: T;
  left: TreeNode<T> | null;
  right: TreeNode<T> | null;
}

class BinarySearchTree<T> {
  root: TreeNode<T> | null = null;

  insert(value: T): void {
    const node: TreeNode<T> = { value, left: null, right: null };
    if (!this.root) {
      this.root = node;
      return;
    }
    let current = this.root;
    while (true) {
      if (value < current.value) {
        if (!current.left) { current.left = node; return; }
        current = current.left;
      } else {
        if (!current.right) { current.right = node; return; }
        current = current.right;
      }
    }
  }

  search(value: T): boolean {
    let current = this.root;
    while (current) {
      if (value === current.value) return true;
      current = value < current.value ? current.left : current.right;
    }
    return false;
  }

  inorder(): T[] {
    const result: T[] = [];
    const traverse = (node: TreeNode<T> | null) => {
      if (node) {
        traverse(node.left);
        result.push(node.value);
        traverse(node.right);
      }
    };
    traverse(this.root);
    return result;
  }

  preorder(): T[] {
    const result: T[] = [];
    const traverse = (node: TreeNode<T> | null) => {
      if (node) {
        result.push(node.value);
        traverse(node.left);
        traverse(node.right);
      }
    };
    traverse(this.root);
    return result;
  }

  height(): number {
    const getHeight = (node: TreeNode<T> | null): number => {
      if (!node) return 0;
      return 1 + Math.max(getHeight(node.left), getHeight(node.right));
    };
    return getHeight(this.root);
  }

  visualize(): string {
    if (!this.root) return '(empty tree)';
    const lines: string[] = [];

    const printNode = (node: TreeNode<T> | null, prefix: string, isLeft: boolean): void => {
      if (node) {
        lines.push(prefix + (isLeft ? '├── ' : '└── ') + node.value);
        const newPrefix = prefix + (isLeft ? '│   ' : '    ');
        if (node.left || node.right) {
          if (node.left) printNode(node.left, newPrefix, true);
          else lines.push(newPrefix + '├── (null)');
          if (node.right) printNode(node.right, newPrefix, false);
          else lines.push(newPrefix + '└── (null)');
        }
      }
    };

    lines.push(String(this.root.value));
    if (this.root.left) printNode(this.root.left, '', true);
    if (this.root.right) printNode(this.root.right, '', false);

    return lines.join('\n');
  }
}

// ============================================================================
// HASH TABLE
// ============================================================================

class HashTable<K, V> {
  private buckets: Array<Array<[K, V]>>;
  private _size: number;

  constructor(size: number = 16) {
    this.buckets = Array.from({ length: size }, () => []);
    this._size = size;
  }

  private hash(key: K): number {
    const str = String(key);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) % this._size;
    }
    return hash;
  }

  set(key: K, value: V): void {
    const index = this.hash(key);
    const bucket = this.buckets[index];
    const existing = bucket.findIndex(([k]) => k === key);
    if (existing >= 0) {
      bucket[existing][1] = value;
    } else {
      bucket.push([key, value]);
    }
  }

  get(key: K): V | undefined {
    const index = this.hash(key);
    const pair = this.buckets[index].find(([k]) => k === key);
    return pair ? pair[1] : undefined;
  }

  delete(key: K): boolean {
    const index = this.hash(key);
    const bucket = this.buckets[index];
    const idx = bucket.findIndex(([k]) => k === key);
    if (idx >= 0) {
      bucket.splice(idx, 1);
      return true;
    }
    return false;
  }

  visualize(): string {
    const lines: string[] = [];
    this.buckets.forEach((bucket, i) => {
      if (bucket.length > 0) {
        const pairs = bucket.map(([k, v]) => `${k}:${v}`).join(', ');
        lines.push(`[${i}] → ${pairs}`);
      } else {
        lines.push(`[${i}] → (empty)`);
      }
    });
    return lines.join('\n');
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const dataStructuresTool: UnifiedTool = {
  name: 'data_structures',
  description: `Interactive data structure demonstrations.

Structures:
- stack: LIFO operations (push, pop, peek)
- queue: FIFO operations (enqueue, dequeue)
- linked_list: Linked list operations (append, prepend, delete)
- bst: Binary Search Tree (insert, search, traverse)
- hash_table: Hash table (set, get, delete)

All include ASCII visualizations!`,

  parameters: {
    type: 'object',
    properties: {
      structure: {
        type: 'string',
        enum: ['stack', 'queue', 'linked_list', 'bst', 'hash_table'],
        description: 'Data structure type',
      },
      operations: { type: 'string', description: 'Operations as JSON array ["push 5", "pop"]' },
      values: { type: 'string', description: 'Initial values as JSON array' },
    },
    required: ['structure'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeDataStructures(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { structure } = args;
    const values: (string | number)[] = args.values ? JSON.parse(args.values) : [];
    const operations: string[] = args.operations ? JSON.parse(args.operations) : [];

    let result: Record<string, unknown>;

    switch (structure) {
      case 'stack': {
        const stack = new Stack<string | number>();
        values.forEach(v => stack.push(v));
        operations.forEach(op => {
          const parts = op.split(' ');
          if (parts[0] === 'push') stack.push(parts[1]);
          else if (parts[0] === 'pop') stack.pop();
        });
        result = {
          structure: 'stack',
          items: stack.toArray(),
          size: stack.size(),
          top: stack.peek(),
          history: stack.getHistory(),
          visualization: stack.visualize(),
        };
        break;
      }

      case 'queue': {
        const queue = new Queue<string | number>();
        values.forEach(v => queue.enqueue(v));
        operations.forEach(op => {
          const parts = op.split(' ');
          if (parts[0] === 'enqueue') queue.enqueue(parts[1]);
          else if (parts[0] === 'dequeue') queue.dequeue();
        });
        result = {
          structure: 'queue',
          items: queue.toArray(),
          size: queue.size(),
          front: queue.front(),
          history: queue.getHistory(),
          visualization: queue.visualize(),
        };
        break;
      }

      case 'linked_list': {
        const list = new LinkedList<string | number>();
        values.forEach(v => list.append(v));
        operations.forEach(op => {
          const parts = op.split(' ');
          if (parts[0] === 'append') list.append(parts[1]);
          else if (parts[0] === 'prepend') list.prepend(parts[1]);
          else if (parts[0] === 'delete') list.delete(parts[1]);
        });
        result = {
          structure: 'linked_list',
          items: list.toArray(),
          size: list.size(),
          visualization: list.visualize(),
        };
        break;
      }

      case 'bst': {
        const tree = new BinarySearchTree<number>();
        values.forEach(v => tree.insert(Number(v)));
        operations.forEach(op => {
          const parts = op.split(' ');
          if (parts[0] === 'insert') tree.insert(Number(parts[1]));
        });
        result = {
          structure: 'bst',
          inorder: tree.inorder(),
          preorder: tree.preorder(),
          height: tree.height(),
          visualization: tree.visualize(),
        };
        break;
      }

      case 'hash_table': {
        const table = new HashTable<string, string | number>(8);
        values.forEach((v, i) => table.set(`key${i}`, v));
        operations.forEach(op => {
          const parts = op.split(' ');
          if (parts[0] === 'set') table.set(parts[1], parts[2]);
          else if (parts[0] === 'delete') table.delete(parts[1]);
        });
        result = {
          structure: 'hash_table',
          visualization: table.visualize(),
        };
        break;
      }

      default:
        throw new Error(`Unknown structure: ${structure}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isDataStructuresAvailable(): boolean { return true; }
