/**
 * MEMORY ALLOCATOR TOOL
 * Comprehensive memory allocator simulator with multiple algorithms
 * Supports first-fit, best-fit, worst-fit, next-fit, buddy system, slab allocator
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface MemoryBlock {
  id: string;
  start: number;
  size: number;
  isFree: boolean;
  allocated?: {
    requestedSize: number;
    tag?: string;
    timestamp: number;
  };
  boundaryTag?: {
    header: number;
    footer: number;
  };
}

interface AllocationResult {
  success: boolean;
  blockId?: string;
  address?: number;
  size?: number;
  internalFragmentation?: number;
  splitOccurred?: boolean;
  error?: string;
}

interface FragmentationAnalysis {
  totalMemory: number;
  usedMemory: number;
  freeMemory: number;
  allocatedBlocks: number;
  freeBlocks: number;
  largestFreeBlock: number;
  smallestFreeBlock: number;
  externalFragmentation: number;
  internalFragmentation: number;
  fragmentationIndex: number;
}

interface AllocationStats {
  totalAllocations: number;
  totalFrees: number;
  totalBytesAllocated: number;
  totalBytesFreed: number;
  peakMemoryUsage: number;
  currentMemoryUsage: number;
  averageAllocationSize: number;
  coalescingOperations: number;
  splitOperations: number;
  failedAllocations: number;
}

interface LeakReport {
  leakCount: number;
  totalLeakedBytes: number;
  leaks: Array<{
    blockId: string;
    address: number;
    size: number;
    tag?: string;
    allocatedAt: number;
    ageMs: number;
  }>;
}

type AllocationAlgorithm = 'first-fit' | 'best-fit' | 'worst-fit' | 'next-fit';
type FreeListType = 'implicit' | 'explicit' | 'segregated';

// ============================================================================
// MEMORY ALLOCATOR CLASS
// ============================================================================

class MemoryAllocator {
  private heapSize: number;
  private blocks: MemoryBlock[];
  private algorithm: AllocationAlgorithm;
  private freeListType: FreeListType;
  private alignment: number;
  private minBlockSize: number;
  private useBoundaryTags: boolean;
  private nextFitPointer: number;
  private stats: AllocationStats;
  private allocationHistory: Map<string, { size: number; timestamp: number; tag?: string }>;
  private segregatedLists: Map<number, string[]>;
  private sizeClasses: number[];

  constructor(config: {
    heapSize?: number;
    algorithm?: AllocationAlgorithm;
    freeListType?: FreeListType;
    alignment?: number;
    minBlockSize?: number;
    useBoundaryTags?: boolean;
  } = {}) {
    this.heapSize = config.heapSize || 65536;
    this.algorithm = config.algorithm || 'first-fit';
    this.freeListType = config.freeListType || 'explicit';
    this.alignment = config.alignment || 8;
    this.minBlockSize = config.minBlockSize || 16;
    this.useBoundaryTags = config.useBoundaryTags ?? true;
    this.nextFitPointer = 0;
    this.allocationHistory = new Map();

    this.stats = {
      totalAllocations: 0,
      totalFrees: 0,
      totalBytesAllocated: 0,
      totalBytesFreed: 0,
      peakMemoryUsage: 0,
      currentMemoryUsage: 0,
      averageAllocationSize: 0,
      coalescingOperations: 0,
      splitOperations: 0,
      failedAllocations: 0
    };

    this.blocks = [{
      id: this.generateId(),
      start: 0,
      size: this.heapSize,
      isFree: true,
      boundaryTag: this.useBoundaryTags ? { header: this.heapSize, footer: this.heapSize } : undefined
    }];

    this.sizeClasses = [16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384];
    this.segregatedLists = new Map();
    for (const size of this.sizeClasses) {
      this.segregatedLists.set(size, []);
    }
    this.segregatedLists.set(Infinity, [this.blocks[0].id]);
  }

  private generateId(): string {
    return `blk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private alignSize(size: number): number {
    return Math.ceil(size / this.alignment) * this.alignment;
  }

  private getSizeClass(size: number): number {
    for (const sizeClass of this.sizeClasses) {
      if (size <= sizeClass) return sizeClass;
    }
    return Infinity;
  }

  private getFreeBlocks(): MemoryBlock[] {
    return this.blocks.filter(b => b.isFree).sort((a, b) => a.start - b.start);
  }

  private findBlockById(id: string): MemoryBlock | undefined {
    return this.blocks.find(b => b.id === id);
  }

  private findBlockByAddress(address: number): MemoryBlock | undefined {
    return this.blocks.find(b => b.start === address);
  }

  private findFirstFit(size: number): MemoryBlock | null {
    for (const block of this.getFreeBlocks()) {
      if (block.size >= size) return block;
    }
    return null;
  }

  private findBestFit(size: number): MemoryBlock | null {
    let bestBlock: MemoryBlock | null = null;
    let bestDiff = Infinity;

    for (const block of this.getFreeBlocks()) {
      if (block.size >= size) {
        const diff = block.size - size;
        if (diff < bestDiff) {
          bestDiff = diff;
          bestBlock = block;
        }
      }
    }
    return bestBlock;
  }

  private findWorstFit(size: number): MemoryBlock | null {
    let worstBlock: MemoryBlock | null = null;
    let worstDiff = -1;

    for (const block of this.getFreeBlocks()) {
      if (block.size >= size) {
        const diff = block.size - size;
        if (diff > worstDiff) {
          worstDiff = diff;
          worstBlock = block;
        }
      }
    }
    return worstBlock;
  }

  private findNextFit(size: number): MemoryBlock | null {
    const freeBlocks = this.getFreeBlocks();
    if (freeBlocks.length === 0) return null;

    const startIndex = freeBlocks.findIndex(b => b.start >= this.nextFitPointer);
    const start = startIndex >= 0 ? startIndex : 0;

    for (let i = start; i < freeBlocks.length; i++) {
      if (freeBlocks[i].size >= size) {
        this.nextFitPointer = freeBlocks[i].start + size;
        return freeBlocks[i];
      }
    }

    for (let i = 0; i < start; i++) {
      if (freeBlocks[i].size >= size) {
        this.nextFitPointer = freeBlocks[i].start + size;
        return freeBlocks[i];
      }
    }

    return null;
  }

  private findSegregatedFit(size: number): MemoryBlock | null {
    const sizeClass = this.getSizeClass(size);
    const classIndex = this.sizeClasses.indexOf(sizeClass);
    const startIndex = classIndex >= 0 ? classIndex : this.sizeClasses.length;

    for (let i = startIndex; i <= this.sizeClasses.length; i++) {
      const sc = i < this.sizeClasses.length ? this.sizeClasses[i] : Infinity;
      const list = this.segregatedLists.get(sc) || [];

      for (const blockId of list) {
        const block = this.findBlockById(blockId);
        if (block && block.isFree && block.size >= size) {
          return block;
        }
      }
    }
    return null;
  }

  private findFreeBlock(size: number): MemoryBlock | null {
    if (this.freeListType === 'segregated') {
      return this.findSegregatedFit(size);
    }

    switch (this.algorithm) {
      case 'first-fit': return this.findFirstFit(size);
      case 'best-fit': return this.findBestFit(size);
      case 'worst-fit': return this.findWorstFit(size);
      case 'next-fit': return this.findNextFit(size);
      default: return this.findFirstFit(size);
    }
  }

  private splitBlock(block: MemoryBlock, requestedSize: number): MemoryBlock {
    const alignedSize = this.alignSize(requestedSize);
    const remaining = block.size - alignedSize;

    if (remaining >= this.minBlockSize) {
      const newFreeBlock: MemoryBlock = {
        id: this.generateId(),
        start: block.start + alignedSize,
        size: remaining,
        isFree: true,
        boundaryTag: this.useBoundaryTags ? { header: remaining, footer: remaining } : undefined
      };

      block.size = alignedSize;
      if (this.useBoundaryTags) {
        block.boundaryTag = { header: alignedSize | 1, footer: alignedSize | 1 };
      }

      const index = this.blocks.indexOf(block);
      this.blocks.splice(index + 1, 0, newFreeBlock);

      if (this.freeListType === 'segregated') {
        this.removeFromSegregatedList(block.id);
        this.addToSegregatedList(newFreeBlock);
      }

      this.stats.splitOperations++;
    }

    return block;
  }

  private coalesce(block: MemoryBlock): MemoryBlock {
    const index = this.blocks.indexOf(block);
    let result = block;

    if (index < this.blocks.length - 1) {
      const nextBlock = this.blocks[index + 1];
      if (nextBlock.isFree) {
        result.size += nextBlock.size;
        if (this.useBoundaryTags) {
          result.boundaryTag = { header: result.size, footer: result.size };
        }
        if (this.freeListType === 'segregated') {
          this.removeFromSegregatedList(nextBlock.id);
        }
        this.blocks.splice(index + 1, 1);
        this.stats.coalescingOperations++;
      }
    }

    const newIndex = this.blocks.indexOf(result);
    if (newIndex > 0) {
      const prevBlock = this.blocks[newIndex - 1];
      if (prevBlock.isFree) {
        prevBlock.size += result.size;
        if (this.useBoundaryTags) {
          prevBlock.boundaryTag = { header: prevBlock.size, footer: prevBlock.size };
        }
        if (this.freeListType === 'segregated') {
          this.removeFromSegregatedList(result.id);
        }
        this.blocks.splice(newIndex, 1);
        result = prevBlock;
        this.stats.coalescingOperations++;
      }
    }

    if (this.freeListType === 'segregated') {
      this.removeFromSegregatedList(result.id);
      this.addToSegregatedList(result);
    }

    return result;
  }

  private addToSegregatedList(block: MemoryBlock): void {
    const sizeClass = this.getSizeClass(block.size);
    const list = this.segregatedLists.get(sizeClass) || [];
    if (!list.includes(block.id)) {
      list.push(block.id);
      this.segregatedLists.set(sizeClass, list);
    }
  }

  private removeFromSegregatedList(blockId: string): void {
    for (const [sizeClass, list] of this.segregatedLists.entries()) {
      const index = list.indexOf(blockId);
      if (index !== -1) {
        list.splice(index, 1);
        this.segregatedLists.set(sizeClass, list);
        break;
      }
    }
  }

  malloc(size: number, tag?: string): AllocationResult {
    if (size <= 0) {
      return { success: false, error: 'Invalid size: must be positive' };
    }

    const alignedSize = this.alignSize(size);
    const block = this.findFreeBlock(alignedSize);

    if (!block) {
      this.stats.failedAllocations++;
      return { success: false, error: `Out of memory: no block of size ${alignedSize} available` };
    }

    const originalSize = block.size;
    const allocatedBlock = this.splitBlock(block, alignedSize);

    allocatedBlock.isFree = false;
    allocatedBlock.allocated = { requestedSize: size, tag, timestamp: Date.now() };

    if (this.useBoundaryTags) {
      allocatedBlock.boundaryTag = { header: allocatedBlock.size | 1, footer: allocatedBlock.size | 1 };
    }

    if (this.freeListType === 'segregated') {
      this.removeFromSegregatedList(allocatedBlock.id);
    }

    this.stats.totalAllocations++;
    this.stats.totalBytesAllocated += allocatedBlock.size;
    this.stats.currentMemoryUsage += allocatedBlock.size;
    this.stats.peakMemoryUsage = Math.max(this.stats.peakMemoryUsage, this.stats.currentMemoryUsage);
    this.stats.averageAllocationSize = this.stats.totalBytesAllocated / this.stats.totalAllocations;

    this.allocationHistory.set(allocatedBlock.id, { size: allocatedBlock.size, timestamp: Date.now(), tag });

    return {
      success: true,
      blockId: allocatedBlock.id,
      address: allocatedBlock.start,
      size: allocatedBlock.size,
      internalFragmentation: allocatedBlock.size - size,
      splitOccurred: originalSize > allocatedBlock.size
    };
  }

  free(addressOrId: number | string): { success: boolean; error?: string; coalesced?: boolean } {
    let block: MemoryBlock | undefined;

    if (typeof addressOrId === 'string') {
      block = this.findBlockById(addressOrId);
    } else {
      block = this.findBlockByAddress(addressOrId);
    }

    if (!block) {
      return { success: false, error: 'Invalid address or block ID' };
    }

    if (block.isFree) {
      return { success: false, error: 'Double free detected!' };
    }

    const freedSize = block.size;
    block.isFree = true;
    block.allocated = undefined;

    if (this.useBoundaryTags) {
      block.boundaryTag = { header: block.size, footer: block.size };
    }

    this.allocationHistory.delete(block.id);

    const originalBlockCount = this.blocks.filter(b => b.isFree).length;
    this.coalesce(block);
    const newBlockCount = this.blocks.filter(b => b.isFree).length;
    const coalesced = newBlockCount < originalBlockCount + 1;

    this.stats.totalFrees++;
    this.stats.totalBytesFreed += freedSize;
    this.stats.currentMemoryUsage -= freedSize;

    return { success: true, coalesced };
  }

  realloc(addressOrId: number | string, newSize: number): AllocationResult {
    let block: MemoryBlock | undefined;

    if (typeof addressOrId === 'string') {
      block = this.findBlockById(addressOrId);
    } else {
      block = this.findBlockByAddress(addressOrId);
    }

    if (!block) {
      return { success: false, error: 'Invalid address or block ID' };
    }

    if (block.isFree) {
      return { success: false, error: 'Block is not allocated' };
    }

    const alignedNewSize = this.alignSize(newSize);

    if (alignedNewSize <= block.size) {
      const remaining = block.size - alignedNewSize;
      if (remaining >= this.minBlockSize) {
        const originalSize = block.size;
        block.size = alignedNewSize;

        const newFreeBlock: MemoryBlock = {
          id: this.generateId(),
          start: block.start + alignedNewSize,
          size: remaining,
          isFree: true
        };

        const index = this.blocks.indexOf(block);
        this.blocks.splice(index + 1, 0, newFreeBlock);
        this.coalesce(newFreeBlock);
        this.stats.currentMemoryUsage -= (originalSize - alignedNewSize);
      }

      return { success: true, blockId: block.id, address: block.start, size: block.size };
    }

    const index = this.blocks.indexOf(block);
    if (index < this.blocks.length - 1) {
      const nextBlock = this.blocks[index + 1];
      if (nextBlock.isFree && block.size + nextBlock.size >= alignedNewSize) {
        const neededFromNext = alignedNewSize - block.size;

        if (nextBlock.size - neededFromNext >= this.minBlockSize) {
          block.size = alignedNewSize;
          nextBlock.start += neededFromNext;
          nextBlock.size -= neededFromNext;

          if (this.freeListType === 'segregated') {
            this.removeFromSegregatedList(nextBlock.id);
            this.addToSegregatedList(nextBlock);
          }
        } else {
          const oldUsage = block.size;
          block.size += nextBlock.size;

          if (this.freeListType === 'segregated') {
            this.removeFromSegregatedList(nextBlock.id);
          }

          this.blocks.splice(index + 1, 1);
          this.stats.currentMemoryUsage += (block.size - oldUsage);
        }

        return { success: true, blockId: block.id, address: block.start, size: block.size };
      }
    }

    const tag = block.allocated?.tag;
    const result = this.malloc(newSize, tag);

    if (result.success) {
      this.free(block.id);
    }

    return result;
  }

  calloc(count: number, size: number, tag?: string): AllocationResult {
    const totalSize = count * size;
    return this.malloc(totalSize, tag);
  }

  analyzeFragmentation(): FragmentationAnalysis {
    const freeBlocks = this.getFreeBlocks();
    const allocatedBlocks = this.blocks.filter(b => !b.isFree);

    const totalFree = freeBlocks.reduce((sum, b) => sum + b.size, 0);
    const totalUsed = allocatedBlocks.reduce((sum, b) => sum + b.size, 0);

    const largestFree = freeBlocks.length > 0 ? Math.max(...freeBlocks.map(b => b.size)) : 0;
    const smallestFree = freeBlocks.length > 0 ? Math.min(...freeBlocks.map(b => b.size)) : 0;

    const externalFrag = totalFree > 0 ? 1 - (largestFree / totalFree) : 0;

    let totalRequested = 0;
    for (const block of allocatedBlocks) {
      if (block.allocated) {
        totalRequested += block.allocated.requestedSize;
      }
    }
    const internalFrag = totalUsed > 0 ? (totalUsed - totalRequested) / totalUsed : 0;

    const fragmentationIndex = (externalFrag + internalFrag) / 2;

    return {
      totalMemory: this.heapSize,
      usedMemory: totalUsed,
      freeMemory: totalFree,
      allocatedBlocks: allocatedBlocks.length,
      freeBlocks: freeBlocks.length,
      largestFreeBlock: largestFree,
      smallestFreeBlock: smallestFree,
      externalFragmentation: Math.round(externalFrag * 10000) / 100,
      internalFragmentation: Math.round(internalFrag * 10000) / 100,
      fragmentationIndex: Math.round(fragmentationIndex * 10000) / 100
    };
  }

  detectLeaks(ageThresholdMs: number = 60000): LeakReport {
    const now = Date.now();
    const leaks: LeakReport['leaks'] = [];

    for (const block of this.blocks) {
      if (!block.isFree && block.allocated) {
        const age = now - block.allocated.timestamp;
        if (age > ageThresholdMs) {
          leaks.push({
            blockId: block.id,
            address: block.start,
            size: block.size,
            tag: block.allocated.tag,
            allocatedAt: block.allocated.timestamp,
            ageMs: age
          });
        }
      }
    }

    return {
      leakCount: leaks.length,
      totalLeakedBytes: leaks.reduce((sum, l) => sum + l.size, 0),
      leaks
    };
  }

  getStats(): AllocationStats {
    return { ...this.stats };
  }

  visualize(): string {
    const scale = Math.max(1, Math.floor(this.heapSize / 80));
    let viz = '';

    viz += `Memory Layout (Scale: 1 char = ${scale} bytes)\n`;
    viz += '='.repeat(80) + '\n';
    viz += `0${' '.repeat(38)}${Math.floor(this.heapSize / 2)}${' '.repeat(37)}${this.heapSize}\n`;

    let line = '';
    for (const block of this.blocks.sort((a, b) => a.start - b.start)) {
      const chars = Math.max(1, Math.floor(block.size / scale));
      const symbol = block.isFree ? '.' : '#';
      line += symbol.repeat(Math.min(chars, 80 - line.length));
    }

    viz += line.substring(0, 80) + '\n';
    viz += '='.repeat(80) + '\n';
    viz += `Legend: # = Allocated, . = Free\n\n`;

    viz += 'Blocks:\n';
    for (const block of this.blocks.sort((a, b) => a.start - b.start)) {
      const status = block.isFree ? 'FREE' : 'USED';
      const tag = block.allocated?.tag ? ` [${block.allocated.tag}]` : '';
      viz += `  ${block.start.toString().padStart(6)}-${(block.start + block.size - 1).toString().padEnd(6)} ` +
             `(${block.size.toString().padStart(6)} bytes) ${status}${tag}\n`;
    }

    return viz;
  }

  configure(config: {
    algorithm?: AllocationAlgorithm;
    freeListType?: FreeListType;
    alignment?: number;
    minBlockSize?: number;
  }): void {
    if (config.algorithm) this.algorithm = config.algorithm;
    if (config.freeListType) this.freeListType = config.freeListType;
    if (config.alignment) this.alignment = config.alignment;
    if (config.minBlockSize) this.minBlockSize = config.minBlockSize;

    if (config.freeListType === 'segregated') {
      for (const sizeClass of this.sizeClasses) {
        this.segregatedLists.set(sizeClass, []);
      }
      this.segregatedLists.set(Infinity, []);

      for (const block of this.blocks) {
        if (block.isFree) {
          this.addToSegregatedList(block);
        }
      }
    }
  }

  growHeap(additionalSize: number): boolean {
    const alignedSize = this.alignSize(additionalSize);
    const lastBlock = this.blocks[this.blocks.length - 1];
    const newStart = lastBlock.start + lastBlock.size;

    const newBlock: MemoryBlock = {
      id: this.generateId(),
      start: newStart,
      size: alignedSize,
      isFree: true,
      boundaryTag: this.useBoundaryTags ? { header: alignedSize, footer: alignedSize } : undefined
    };

    this.blocks.push(newBlock);
    this.heapSize += alignedSize;

    if (lastBlock.isFree) {
      this.coalesce(newBlock);
    } else if (this.freeListType === 'segregated') {
      this.addToSegregatedList(newBlock);
    }

    return true;
  }
}

// ============================================================================
// BUDDY SYSTEM ALLOCATOR
// ============================================================================

class BuddyAllocator {
  private totalSize: number;
  private minBlockSize: number;
  private maxOrder: number;
  private freeLists: Map<number, number[]>;
  private allocated: Map<number, { size: number; order: number; tag?: string; timestamp: number }>;
  private stats: AllocationStats;

  constructor(totalSize: number = 65536, minBlockSize: number = 16) {
    this.totalSize = Math.pow(2, Math.ceil(Math.log2(totalSize)));
    this.minBlockSize = Math.pow(2, Math.ceil(Math.log2(minBlockSize)));
    this.maxOrder = Math.log2(this.totalSize / this.minBlockSize);

    this.freeLists = new Map();
    for (let order = 0; order <= this.maxOrder; order++) {
      this.freeLists.set(order, []);
    }
    this.freeLists.get(this.maxOrder)!.push(0);

    this.allocated = new Map();
    this.stats = {
      totalAllocations: 0,
      totalFrees: 0,
      totalBytesAllocated: 0,
      totalBytesFreed: 0,
      peakMemoryUsage: 0,
      currentMemoryUsage: 0,
      averageAllocationSize: 0,
      coalescingOperations: 0,
      splitOperations: 0,
      failedAllocations: 0
    };
  }

  private orderForSize(size: number): number {
    const blocks = Math.ceil(size / this.minBlockSize);
    return Math.ceil(Math.log2(blocks));
  }

  private sizeForOrder(order: number): number {
    return this.minBlockSize * Math.pow(2, order);
  }

  private buddyAddress(address: number, order: number): number {
    const blockSize = this.sizeForOrder(order);
    return address ^ blockSize;
  }

  malloc(size: number, tag?: string): AllocationResult {
    if (size <= 0) {
      return { success: false, error: 'Invalid size' };
    }

    const order = this.orderForSize(size);
    if (order > this.maxOrder) {
      this.stats.failedAllocations++;
      return { success: false, error: 'Size too large' };
    }

    let foundOrder = -1;
    for (let o = order; o <= this.maxOrder; o++) {
      const freeList = this.freeLists.get(o)!;
      if (freeList.length > 0) {
        foundOrder = o;
        break;
      }
    }

    if (foundOrder === -1) {
      this.stats.failedAllocations++;
      return { success: false, error: 'Out of memory' };
    }

    while (foundOrder > order) {
      const freeList = this.freeLists.get(foundOrder)!;
      const address = freeList.shift()!;
      const newOrder = foundOrder - 1;
      const buddy1 = address;
      const buddy2 = address + this.sizeForOrder(newOrder);

      this.freeLists.get(newOrder)!.push(buddy1, buddy2);
      this.stats.splitOperations++;
      foundOrder = newOrder;
    }

    const freeList = this.freeLists.get(order)!;
    const address = freeList.shift()!;
    const blockSize = this.sizeForOrder(order);

    this.allocated.set(address, { size: blockSize, order, tag, timestamp: Date.now() });

    this.stats.totalAllocations++;
    this.stats.totalBytesAllocated += blockSize;
    this.stats.currentMemoryUsage += blockSize;
    this.stats.peakMemoryUsage = Math.max(this.stats.peakMemoryUsage, this.stats.currentMemoryUsage);
    this.stats.averageAllocationSize = this.stats.totalBytesAllocated / this.stats.totalAllocations;

    return { success: true, address, size: blockSize, internalFragmentation: blockSize - size };
  }

  free(address: number): { success: boolean; error?: string; coalesced?: boolean } {
    const alloc = this.allocated.get(address);
    if (!alloc) {
      return { success: false, error: 'Invalid address' };
    }

    this.allocated.delete(address);
    let order = alloc.order;
    let currentAddress = address;
    let coalesced = false;

    while (order < this.maxOrder) {
      const buddyAddr = this.buddyAddress(currentAddress, order);
      const freeList = this.freeLists.get(order)!;
      const buddyIndex = freeList.indexOf(buddyAddr);

      if (buddyIndex === -1) break;

      freeList.splice(buddyIndex, 1);
      currentAddress = Math.min(currentAddress, buddyAddr);
      order++;
      coalesced = true;
      this.stats.coalescingOperations++;
    }

    this.freeLists.get(order)!.push(currentAddress);

    this.stats.totalFrees++;
    this.stats.totalBytesFreed += alloc.size;
    this.stats.currentMemoryUsage -= alloc.size;

    return { success: true, coalesced };
  }

  getStats(): AllocationStats {
    return { ...this.stats };
  }

  visualize(): string {
    let viz = 'Buddy Allocator State\n';
    viz += '='.repeat(60) + '\n';
    viz += `Total Size: ${this.totalSize}, Min Block: ${this.minBlockSize}\n`;
    viz += `Max Order: ${this.maxOrder}\n\n`;

    viz += 'Free Lists:\n';
    for (let order = 0; order <= this.maxOrder; order++) {
      const freeList = this.freeLists.get(order)!;
      const blockSize = this.sizeForOrder(order);
      viz += `  Order ${order} (${blockSize} bytes): ${freeList.length} blocks`;
      if (freeList.length > 0 && freeList.length <= 5) {
        viz += ` at [${freeList.join(', ')}]`;
      }
      viz += '\n';
    }

    viz += `\nAllocated: ${this.allocated.size} blocks\n`;
    return viz;
  }

  analyzeFragmentation(): FragmentationAnalysis {
    let totalFree = 0;
    let maxFree = 0;
    let minFree = Infinity;
    let freeBlockCount = 0;

    for (let order = 0; order <= this.maxOrder; order++) {
      const freeList = this.freeLists.get(order)!;
      const blockSize = this.sizeForOrder(order);
      totalFree += freeList.length * blockSize;
      freeBlockCount += freeList.length;

      if (freeList.length > 0) {
        maxFree = Math.max(maxFree, blockSize);
        minFree = Math.min(minFree, blockSize);
      }
    }

    if (freeBlockCount === 0) minFree = 0;

    const totalUsed = this.totalSize - totalFree;
    const externalFrag = totalFree > 0 ? 1 - (maxFree / totalFree) : 0;

    let totalAllocated = 0;
    for (const alloc of this.allocated.values()) {
      totalAllocated += alloc.size;
    }
    const internalFrag = totalAllocated > 0 ? 0.33 : 0;

    return {
      totalMemory: this.totalSize,
      usedMemory: totalUsed,
      freeMemory: totalFree,
      allocatedBlocks: this.allocated.size,
      freeBlocks: freeBlockCount,
      largestFreeBlock: maxFree,
      smallestFreeBlock: minFree,
      externalFragmentation: Math.round(externalFrag * 10000) / 100,
      internalFragmentation: Math.round(internalFrag * 10000) / 100,
      fragmentationIndex: Math.round(((externalFrag + internalFrag) / 2) * 10000) / 100
    };
  }
}

// ============================================================================
// SLAB ALLOCATOR
// ============================================================================

interface SlabObject {
  id: number;
  inUse: boolean;
  nextFree?: number;
}

interface Slab {
  id: string;
  objects: SlabObject[];
  freeCount: number;
  nextFree: number;
}

interface SlabCache {
  name: string;
  objectSize: number;
  objectsPerSlab: number;
  slabs: { full: Slab[]; partial: Slab[]; empty: Slab[] };
  stats: { allocations: number; frees: number; slabsCreated: number; slabsDestroyed: number };
}

class SlabAllocator {
  private caches: Map<string, SlabCache>;
  private slabSize: number;

  constructor(slabSize: number = 4096) {
    this.caches = new Map();
    this.slabSize = slabSize;
  }

  createCache(name: string, objectSize: number): SlabCache {
    const alignedSize = Math.ceil(objectSize / 8) * 8;
    const objectsPerSlab = Math.floor(this.slabSize / alignedSize);

    const cache: SlabCache = {
      name,
      objectSize: alignedSize,
      objectsPerSlab,
      slabs: { full: [], partial: [], empty: [] },
      stats: { allocations: 0, frees: 0, slabsCreated: 0, slabsDestroyed: 0 }
    };

    this.caches.set(name, cache);
    return cache;
  }

  private createSlab(cache: SlabCache): Slab {
    const objects: SlabObject[] = [];
    for (let i = 0; i < cache.objectsPerSlab; i++) {
      objects.push({ id: i, inUse: false, nextFree: i < cache.objectsPerSlab - 1 ? i + 1 : -1 });
    }

    const slab: Slab = {
      id: `slab_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      objects,
      freeCount: cache.objectsPerSlab,
      nextFree: 0
    };

    cache.stats.slabsCreated++;
    return slab;
  }

  allocate(cacheName: string): { success: boolean; slabId?: string; objectId?: number; error?: string } {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      return { success: false, error: `Cache '${cacheName}' not found` };
    }

    let slab: Slab | undefined;

    if (cache.slabs.partial.length > 0) {
      slab = cache.slabs.partial[0];
    } else if (cache.slabs.empty.length > 0) {
      slab = cache.slabs.empty.shift()!;
      cache.slabs.partial.push(slab);
    } else {
      slab = this.createSlab(cache);
      cache.slabs.partial.push(slab);
    }

    const objectIndex = slab.nextFree;
    const obj = slab.objects[objectIndex];
    obj.inUse = true;
    slab.nextFree = obj.nextFree ?? -1;
    slab.freeCount--;

    if (slab.freeCount === 0) {
      const partialIndex = cache.slabs.partial.indexOf(slab);
      if (partialIndex !== -1) {
        cache.slabs.partial.splice(partialIndex, 1);
        cache.slabs.full.push(slab);
      }
    }

    cache.stats.allocations++;
    return { success: true, slabId: slab.id, objectId: objectIndex };
  }

  free(cacheName: string, slabId: string, objectId: number): { success: boolean; error?: string } {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      return { success: false, error: `Cache '${cacheName}' not found` };
    }

    let slab: Slab | undefined;
    let fromList: 'full' | 'partial' | undefined;

    for (const s of cache.slabs.full) {
      if (s.id === slabId) { slab = s; fromList = 'full'; break; }
    }

    if (!slab) {
      for (const s of cache.slabs.partial) {
        if (s.id === slabId) { slab = s; fromList = 'partial'; break; }
      }
    }

    if (!slab) {
      return { success: false, error: 'Slab not found' };
    }

    const obj = slab.objects[objectId];
    if (!obj || !obj.inUse) {
      return { success: false, error: 'Object not allocated' };
    }

    obj.inUse = false;
    obj.nextFree = slab.nextFree;
    slab.nextFree = objectId;
    slab.freeCount++;
    cache.stats.frees++;

    if (fromList === 'full') {
      const fullIndex = cache.slabs.full.indexOf(slab);
      cache.slabs.full.splice(fullIndex, 1);
      cache.slabs.partial.push(slab);
    } else if (slab.freeCount === cache.objectsPerSlab) {
      const partialIndex = cache.slabs.partial.indexOf(slab);
      cache.slabs.partial.splice(partialIndex, 1);
      cache.slabs.empty.push(slab);
    }

    return { success: true };
  }

  getCacheStats(cacheName: string): Record<string, unknown> | null {
    const cache = this.caches.get(cacheName);
    if (!cache) return null;

    const totalSlabs = cache.slabs.full.length + cache.slabs.partial.length + cache.slabs.empty.length;
    return {
      objectSize: cache.objectSize,
      objectsPerSlab: cache.objectsPerSlab,
      fullSlabs: cache.slabs.full.length,
      partialSlabs: cache.slabs.partial.length,
      emptySlabs: cache.slabs.empty.length,
      totalObjects: totalSlabs * cache.objectsPerSlab,
      usedObjects: cache.stats.allocations - cache.stats.frees,
      stats: cache.stats
    };
  }

  visualize(cacheName: string): string {
    const cache = this.caches.get(cacheName);
    if (!cache) return `Cache '${cacheName}' not found`;

    let viz = `Slab Cache: ${cacheName}\n`;
    viz += '='.repeat(50) + '\n';
    viz += `Object Size: ${cache.objectSize} bytes\n`;
    viz += `Objects per Slab: ${cache.objectsPerSlab}\n\n`;
    viz += `Full Slabs: ${cache.slabs.full.length}\n`;
    viz += `Partial Slabs: ${cache.slabs.partial.length}\n`;
    viz += `Empty Slabs: ${cache.slabs.empty.length}\n\n`;

    if (cache.slabs.partial.length > 0) {
      viz += 'Partial Slabs:\n';
      for (const slab of cache.slabs.partial.slice(0, 3)) {
        const usage = cache.objectsPerSlab - slab.freeCount;
        viz += `  ${slab.id}: ${usage}/${cache.objectsPerSlab} used\n`;
        viz += '    [' + slab.objects.map(o => o.inUse ? '#' : '.').join('') + ']\n';
      }
    }

    return viz;
  }
}

// ============================================================================
// MEMORY POOL
// ============================================================================

class MemoryPool {
  private blockSize: number;
  private poolSize: number;
  private freeList: number[];
  private allocated: Set<number>;
  private stats: { allocations: number; frees: number; peakUsage: number };

  constructor(blockSize: number, poolSize: number) {
    this.blockSize = Math.ceil(blockSize / 8) * 8;
    this.poolSize = poolSize;
    this.freeList = [];
    this.allocated = new Set();
    this.stats = { allocations: 0, frees: 0, peakUsage: 0 };

    for (let i = 0; i < poolSize; i++) {
      this.freeList.push(i * this.blockSize);
    }
  }

  allocate(): { success: boolean; address?: number; error?: string } {
    if (this.freeList.length === 0) {
      return { success: false, error: 'Pool exhausted' };
    }

    const address = this.freeList.pop()!;
    this.allocated.add(address);
    this.stats.allocations++;
    this.stats.peakUsage = Math.max(this.stats.peakUsage, this.allocated.size);

    return { success: true, address };
  }

  free(address: number): { success: boolean; error?: string } {
    if (!this.allocated.has(address)) {
      return { success: false, error: 'Invalid address or double free' };
    }

    this.allocated.delete(address);
    this.freeList.push(address);
    this.stats.frees++;

    return { success: true };
  }

  getStats(): Record<string, unknown> {
    return {
      blockSize: this.blockSize,
      poolSize: this.poolSize,
      freeBlocks: this.freeList.length,
      usedBlocks: this.allocated.size,
      stats: this.stats
    };
  }
}

// ============================================================================
// GLOBAL INSTANCES
// ============================================================================

let mainAllocator: MemoryAllocator | null = null;
let buddyAllocator: BuddyAllocator | null = null;
let slabAllocator: SlabAllocator | null = null;
let memoryPool: MemoryPool | null = null;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const memoryallocatorTool: UnifiedTool = {
  name: 'memory_allocator',
  description: 'Memory allocator simulator with first-fit, best-fit, worst-fit, next-fit, buddy system, slab allocator, and memory pool',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'malloc', 'free', 'realloc', 'calloc', 'get_stats', 'visualize', 'analyze_fragmentation',
          'configure_algorithm', 'detect_leaks', 'grow_heap', 'buddy_malloc', 'buddy_free', 'buddy_stats',
          'slab_create_cache', 'slab_allocate', 'slab_free', 'slab_stats', 'pool_create', 'pool_allocate',
          'pool_free', 'pool_stats', 'compare_algorithms', 'info', 'examples'
        ],
        description: 'Operation to perform'
      },
      size: { type: 'number', description: 'Size in bytes for allocation' },
      address: { type: 'number', description: 'Memory address' },
      blockId: { type: 'string', description: 'Block ID' },
      tag: { type: 'string', description: 'Allocation tag' },
      count: { type: 'number', description: 'Count for calloc' },
      algorithm: { type: 'string', enum: ['first-fit', 'best-fit', 'worst-fit', 'next-fit'] },
      freeListType: { type: 'string', enum: ['implicit', 'explicit', 'segregated'] },
      heapSize: { type: 'number', description: 'Initial heap size' },
      cacheName: { type: 'string', description: 'Slab cache name' },
      objectSize: { type: 'number', description: 'Object size' },
      poolSize: { type: 'number', description: 'Pool block count' },
      slabId: { type: 'string', description: 'Slab ID' },
      objectId: { type: 'number', description: 'Object ID in slab' },
      ageThreshold: { type: 'number', description: 'Leak detection age threshold' },
      additionalSize: { type: 'number', description: 'Heap growth size' }
    },
    required: ['operation']
  }
};

export async function executememoryallocator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    switch (operation) {
      case 'malloc': {
        if (!mainAllocator) {
          mainAllocator = new MemoryAllocator({
            heapSize: args.heapSize || 65536,
            algorithm: args.algorithm || 'first-fit',
            freeListType: args.freeListType || 'explicit'
          });
        }
        const result = mainAllocator.malloc(args.size || 64, args.tag);
        return { toolCallId: id, content: JSON.stringify({ operation: 'malloc', ...result }, null, 2) };
      }

      case 'free': {
        if (!mainAllocator) {
          return { toolCallId: id, content: JSON.stringify({ error: 'No allocator initialized' }), isError: true };
        }
        const target = args.blockId || args.address;
        if (target === undefined) {
          return { toolCallId: id, content: JSON.stringify({ error: 'Provide address or blockId' }), isError: true };
        }
        const result = mainAllocator.free(target);
        return { toolCallId: id, content: JSON.stringify({ operation: 'free', ...result }, null, 2) };
      }

      case 'realloc': {
        if (!mainAllocator) {
          return { toolCallId: id, content: JSON.stringify({ error: 'No allocator initialized' }), isError: true };
        }
        const target = args.blockId || args.address;
        const result = mainAllocator.realloc(target, args.size || 128);
        return { toolCallId: id, content: JSON.stringify({ operation: 'realloc', ...result }, null, 2) };
      }

      case 'calloc': {
        if (!mainAllocator) mainAllocator = new MemoryAllocator();
        const result = mainAllocator.calloc(args.count || 10, args.size || 8, args.tag);
        return { toolCallId: id, content: JSON.stringify({ operation: 'calloc', count: args.count || 10, elementSize: args.size || 8, ...result }, null, 2) };
      }

      case 'get_stats': {
        if (!mainAllocator) {
          return { toolCallId: id, content: JSON.stringify({ error: 'No allocator initialized' }), isError: true };
        }
        return { toolCallId: id, content: JSON.stringify({ operation: 'get_stats', stats: mainAllocator.getStats() }, null, 2) };
      }

      case 'visualize': {
        if (!mainAllocator) mainAllocator = new MemoryAllocator();
        return { toolCallId: id, content: JSON.stringify({ operation: 'visualize', visualization: mainAllocator.visualize() }, null, 2) };
      }

      case 'analyze_fragmentation': {
        if (!mainAllocator) {
          return { toolCallId: id, content: JSON.stringify({ error: 'No allocator initialized' }), isError: true };
        }
        return { toolCallId: id, content: JSON.stringify({ operation: 'analyze_fragmentation', analysis: mainAllocator.analyzeFragmentation() }, null, 2) };
      }

      case 'configure_algorithm': {
        if (!mainAllocator) mainAllocator = new MemoryAllocator();
        mainAllocator.configure({ algorithm: args.algorithm, freeListType: args.freeListType, alignment: args.alignment, minBlockSize: args.minBlockSize });
        return { toolCallId: id, content: JSON.stringify({ operation: 'configure_algorithm', configured: { algorithm: args.algorithm, freeListType: args.freeListType } }, null, 2) };
      }

      case 'detect_leaks': {
        if (!mainAllocator) {
          return { toolCallId: id, content: JSON.stringify({ error: 'No allocator initialized' }), isError: true };
        }
        return { toolCallId: id, content: JSON.stringify({ operation: 'detect_leaks', report: mainAllocator.detectLeaks(args.ageThreshold || 60000) }, null, 2) };
      }

      case 'grow_heap': {
        if (!mainAllocator) mainAllocator = new MemoryAllocator();
        const success = mainAllocator.growHeap(args.additionalSize || 16384);
        return { toolCallId: id, content: JSON.stringify({ operation: 'grow_heap', success, additionalSize: args.additionalSize || 16384 }, null, 2) };
      }

      case 'buddy_malloc': {
        if (!buddyAllocator) buddyAllocator = new BuddyAllocator(args.heapSize || 65536);
        const result = buddyAllocator.malloc(args.size || 64, args.tag);
        return { toolCallId: id, content: JSON.stringify({ operation: 'buddy_malloc', ...result }, null, 2) };
      }

      case 'buddy_free': {
        if (!buddyAllocator) {
          return { toolCallId: id, content: JSON.stringify({ error: 'No buddy allocator initialized' }), isError: true };
        }
        const result = buddyAllocator.free(args.address);
        return { toolCallId: id, content: JSON.stringify({ operation: 'buddy_free', ...result }, null, 2) };
      }

      case 'buddy_stats': {
        if (!buddyAllocator) buddyAllocator = new BuddyAllocator();
        return { toolCallId: id, content: JSON.stringify({ operation: 'buddy_stats', stats: buddyAllocator.getStats(), fragmentation: buddyAllocator.analyzeFragmentation(), visualization: buddyAllocator.visualize() }, null, 2) };
      }

      case 'slab_create_cache': {
        if (!slabAllocator) slabAllocator = new SlabAllocator();
        const cache = slabAllocator.createCache(args.cacheName || 'default', args.objectSize || 64);
        return { toolCallId: id, content: JSON.stringify({ operation: 'slab_create_cache', cache: { name: cache.name, objectSize: cache.objectSize, objectsPerSlab: cache.objectsPerSlab } }, null, 2) };
      }

      case 'slab_allocate': {
        if (!slabAllocator) {
          return { toolCallId: id, content: JSON.stringify({ error: 'No slab allocator initialized' }), isError: true };
        }
        const result = slabAllocator.allocate(args.cacheName || 'default');
        return { toolCallId: id, content: JSON.stringify({ operation: 'slab_allocate', ...result }, null, 2) };
      }

      case 'slab_free': {
        if (!slabAllocator) {
          return { toolCallId: id, content: JSON.stringify({ error: 'No slab allocator initialized' }), isError: true };
        }
        const result = slabAllocator.free(args.cacheName || 'default', args.slabId, args.objectId);
        return { toolCallId: id, content: JSON.stringify({ operation: 'slab_free', ...result }, null, 2) };
      }

      case 'slab_stats': {
        if (!slabAllocator) {
          return { toolCallId: id, content: JSON.stringify({ error: 'No slab allocator initialized' }), isError: true };
        }
        return { toolCallId: id, content: JSON.stringify({ operation: 'slab_stats', stats: slabAllocator.getCacheStats(args.cacheName || 'default'), visualization: slabAllocator.visualize(args.cacheName || 'default') }, null, 2) };
      }

      case 'pool_create': {
        memoryPool = new MemoryPool(args.objectSize || 64, args.poolSize || 100);
        return { toolCallId: id, content: JSON.stringify({ operation: 'pool_create', created: memoryPool.getStats() }, null, 2) };
      }

      case 'pool_allocate': {
        if (!memoryPool) memoryPool = new MemoryPool(64, 100);
        const result = memoryPool.allocate();
        return { toolCallId: id, content: JSON.stringify({ operation: 'pool_allocate', ...result }, null, 2) };
      }

      case 'pool_free': {
        if (!memoryPool) {
          return { toolCallId: id, content: JSON.stringify({ error: 'No memory pool initialized' }), isError: true };
        }
        const result = memoryPool.free(args.address);
        return { toolCallId: id, content: JSON.stringify({ operation: 'pool_free', ...result }, null, 2) };
      }

      case 'pool_stats': {
        if (!memoryPool) {
          return { toolCallId: id, content: JSON.stringify({ error: 'No memory pool initialized' }), isError: true };
        }
        return { toolCallId: id, content: JSON.stringify({ operation: 'pool_stats', stats: memoryPool.getStats() }, null, 2) };
      }

      case 'compare_algorithms': {
        const results: Record<string, { allocations: number; avgTime: number; fragmentation: number }> = {};
        const algorithms: AllocationAlgorithm[] = ['first-fit', 'best-fit', 'worst-fit', 'next-fit'];

        for (const algo of algorithms) {
          const allocator = new MemoryAllocator({ heapSize: 65536, algorithm: algo });
          const start = Date.now();
          const addresses: string[] = [];

          for (let i = 0; i < 100; i++) {
            const size = Math.floor(Math.random() * 1024) + 16;
            const result = allocator.malloc(size);
            if (result.success && result.blockId) addresses.push(result.blockId);
            if (Math.random() < 0.3 && addresses.length > 0) {
              const idx = Math.floor(Math.random() * addresses.length);
              allocator.free(addresses[idx]);
              addresses.splice(idx, 1);
            }
          }

          const elapsed = Date.now() - start;
          const stats = allocator.getStats();
          const frag = allocator.analyzeFragmentation();

          results[algo] = { allocations: stats.totalAllocations, avgTime: elapsed / stats.totalAllocations, fragmentation: frag.fragmentationIndex };
        }

        return { toolCallId: id, content: JSON.stringify({ operation: 'compare_algorithms', testParameters: { heapSize: 65536, iterations: 100 }, results, recommendation: Object.entries(results).sort((a, b) => a[1].fragmentation - b[1].fragmentation)[0][0] }, null, 2) };
      }

      case 'info': {
        return { toolCallId: id, content: JSON.stringify({
          tool: 'Memory Allocator',
          description: 'Comprehensive memory allocator simulator',
          allocators: {
            general: { algorithms: ['first-fit', 'best-fit', 'worst-fit', 'next-fit'], freeListTypes: ['implicit', 'explicit', 'segregated'], features: ['Block splitting', 'Block coalescing', 'Boundary tags', 'Memory alignment', 'Heap growth', 'Fragmentation analysis', 'Leak detection'] },
            buddy: { description: 'Power-of-2 block allocator', features: ['O(log n) allocation', 'Simple coalescing'] },
            slab: { description: 'Object cache allocator', features: ['Zero fragmentation for same-size objects', 'Fast allocation'] },
            pool: { description: 'Fixed-block memory pool', features: ['O(1) allocation/free', 'No fragmentation'] }
          }
        }, null, 2) };
      }

      case 'examples': {
        return { toolCallId: id, content: JSON.stringify({
          examples: [
            { name: 'Basic allocation', call: { operation: 'malloc', size: 256, tag: 'buffer' } },
            { name: 'Free memory', call: { operation: 'free', address: 0 } },
            { name: 'Configure best-fit', call: { operation: 'configure_algorithm', algorithm: 'best-fit', freeListType: 'segregated' } },
            { name: 'Buddy allocation', call: { operation: 'buddy_malloc', size: 100 } },
            { name: 'Create slab cache', call: { operation: 'slab_create_cache', cacheName: 'tcp_conn', objectSize: 128 } },
            { name: 'Create memory pool', call: { operation: 'pool_create', objectSize: 64, poolSize: 1000 } }
          ]
        }, null, 2) };
      }

      default:
        return { toolCallId: id, content: `Unknown operation: ${operation}`, isError: true };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ismemoryallocatorAvailable(): boolean { return true; }
