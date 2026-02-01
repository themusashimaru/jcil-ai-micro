/**
 * GARBAGE COLLECTOR TOOL
 * Memory management simulation with mark-sweep and reference counting
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface HeapObject { id: number; size: number; marked: boolean; refCount: number; refs: number[]; data?: string; }
interface Heap { objects: Map<number, HeapObject>; nextId: number; totalSize: number; maxSize: number; roots: Set<number>; }

function createHeap(maxSize: number = 1000): Heap {
  return { objects: new Map(), nextId: 1, totalSize: 0, maxSize, roots: new Set() };
}

function allocate(heap: Heap, size: number, data?: string): number | null {
  if (heap.totalSize + size > heap.maxSize) return null;
  const id = heap.nextId++;
  heap.objects.set(id, { id, size, marked: false, refCount: 0, refs: [], data });
  heap.totalSize += size;
  return id;
}

function addReference(heap: Heap, from: number, to: number): void {
  const fromObj = heap.objects.get(from);
  const toObj = heap.objects.get(to);
  if (fromObj && toObj) {
    fromObj.refs.push(to);
    toObj.refCount++;
  }
}

function removeReference(heap: Heap, from: number, to: number): void {
  const fromObj = heap.objects.get(from);
  const toObj = heap.objects.get(to);
  if (fromObj && toObj) {
    const idx = fromObj.refs.indexOf(to);
    if (idx !== -1) {
      fromObj.refs.splice(idx, 1);
      toObj.refCount--;
    }
  }
}

function addRoot(heap: Heap, id: number): void {
  heap.roots.add(id);
  const obj = heap.objects.get(id);
  if (obj) obj.refCount++;
}

function removeRoot(heap: Heap, id: number): void {
  heap.roots.delete(id);
  const obj = heap.objects.get(id);
  if (obj) obj.refCount--;
}
void removeReference; // Available for full reference counting
void removeRoot; // Available for root management

function markSweep(heap: Heap): { collected: number; freed: number } {
  // Mark phase
  for (const obj of heap.objects.values()) obj.marked = false;
  
  const toVisit = [...heap.roots];
  while (toVisit.length > 0) {
    const id = toVisit.pop()!;
    const obj = heap.objects.get(id);
    if (obj && !obj.marked) {
      obj.marked = true;
      toVisit.push(...obj.refs);
    }
  }
  
  // Sweep phase
  let collected = 0, freed = 0;
  for (const [id, obj] of heap.objects) {
    if (!obj.marked) {
      collected++;
      freed += obj.size;
      heap.totalSize -= obj.size;
      heap.objects.delete(id);
    }
  }
  
  return { collected, freed };
}

function refCountCollect(heap: Heap): { collected: number; freed: number } {
  let collected = 0, freed = 0;
  let changed = true;
  
  while (changed) {
    changed = false;
    for (const [id, obj] of heap.objects) {
      if (obj.refCount === 0 && !heap.roots.has(id)) {
        // Decrement refs of all referenced objects
        for (const refId of obj.refs) {
          const refObj = heap.objects.get(refId);
          if (refObj) refObj.refCount--;
        }
        collected++;
        freed += obj.size;
        heap.totalSize -= obj.size;
        heap.objects.delete(id);
        changed = true;
      }
    }
  }
  
  return { collected, freed };
}

function heapStats(heap: Heap): Record<string, unknown> {
  const objects = Array.from(heap.objects.values());
  return {
    objectCount: objects.length,
    totalSize: heap.totalSize,
    maxSize: heap.maxSize,
    utilization: (heap.totalSize / heap.maxSize * 100).toFixed(1) + '%',
    roots: heap.roots.size,
    avgRefCount: objects.length > 0 ? (objects.reduce((a, o) => a + o.refCount, 0) / objects.length).toFixed(2) : 0
  };
}

export const garbageCollectorTool: UnifiedTool = {
  name: 'garbage_collector',
  description: 'Memory management simulation with mark-sweep and reference counting GC',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['demo', 'mark_sweep', 'ref_count', 'info'], description: 'Operation' },
      scenario: { type: 'string', enum: ['simple', 'cycle', 'fragmented'], description: 'Demo scenario' }
    },
    required: ['operation']
  }
};

export async function executeGarbageCollector(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'demo': {
        const heap = createHeap(100);
        const steps: string[] = [];
        
        // Allocate objects
        const a = allocate(heap, 10, 'A')!;
        const b = allocate(heap, 15, 'B')!;
        const c = allocate(heap, 20, 'C')!;
        allocate(heap, 10, 'D'); // D is intentionally orphaned (no reference)
        steps.push('Allocated A(10), B(15), C(20), D(10)');
        
        // Create references
        addRoot(heap, a);
        addReference(heap, a, b);
        addReference(heap, b, c);
        steps.push('Created root -> A -> B -> C, D is orphan');
        
        const beforeGC = heapStats(heap);
        const gcResult = markSweep(heap);
        const afterGC = heapStats(heap);
        
        result = { steps, beforeGC, gcResult, afterGC };
        break;
      }
      case 'mark_sweep': {
        const heap = createHeap(200);
        for (let i = 0; i < 10; i++) allocate(heap, 10, 'obj' + i);
        addRoot(heap, 1);
        addRoot(heap, 3);
        addReference(heap, 1, 2);
        addReference(heap, 3, 4);
        const before = heapStats(heap);
        const gcResult = markSweep(heap);
        result = { algorithm: 'Mark-Sweep', before, gcResult, after: heapStats(heap) };
        break;
      }
      case 'ref_count': {
        const heap = createHeap(200);
        for (let i = 0; i < 10; i++) allocate(heap, 10, 'obj' + i);
        addRoot(heap, 1);
        addReference(heap, 1, 2);
        addReference(heap, 2, 3);
        const before = heapStats(heap);
        const gcResult = refCountCollect(heap);
        result = { algorithm: 'Reference Counting', before, gcResult, after: heapStats(heap) };
        break;
      }
      case 'info':
      default:
        result = { description: 'GC simulation', algorithms: ['Mark-Sweep', 'Reference Counting'], concepts: ['Roots', 'Reachability', 'Cycles', 'Fragmentation'] };
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isGarbageCollectorAvailable(): boolean { return true; }
