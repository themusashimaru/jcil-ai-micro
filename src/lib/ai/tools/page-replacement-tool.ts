/**
 * PAGE REPLACEMENT TOOL
 * Comprehensive page replacement algorithm simulator
 * Supports FIFO, LRU, LFU, Optimal, Clock, NRU, Working Set
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface PageTableEntry {
  pageNumber: number;
  frameNumber: number;
  valid: boolean;
  dirty: boolean;
  referenced: boolean;
  accessCount: number;
  lastAccessTime: number;
  loadTime: number;
}

interface TLBEntry {
  pageNumber: number;
  frameNumber: number;
  valid: boolean;
  lastAccess: number;
}

interface SimulationResult {
  pageFaults: number;
  pageHits: number;
  hitRate: number;
  faultRate: number;
  dirtyPageWritebacks: number;
  referenceString: number[];
  frameHistory: number[][];
  faultPositions: number[];
}

interface WorkingSetInfo {
  windowSize: number;
  workingSet: number[];
  workingSetSize: number;
  pageReferences: number[];
}

type PageReplacementAlgorithm = 'fifo' | 'lru' | 'lfu' | 'optimal' | 'clock' | 'nru' | 'lru-approx';

// ============================================================================
// PAGE REPLACEMENT ALGORITHMS
// ============================================================================

class PageReplacementSimulator {
  private numFrames: number;
  private frames: (number | null)[];
  private pageTable: Map<number, PageTableEntry>;
  private referenceString: number[];
  private currentTime: number;
  private algorithm: PageReplacementAlgorithm;
  private clockHand: number;
  private stats: {
    pageFaults: number;
    pageHits: number;
    dirtyWritebacks: number;
    tlbHits: number;
    tlbMisses: number;
  };

  // For NRU (Not Recently Used)
  private nruClasses: Map<number, number>;  // page -> class (0-3)

  // TLB simulation
  private tlb: TLBEntry[];
  private tlbSize: number;

  // For LRU approximation (second chance with reference bits)
  private referenceBits: Map<number, boolean>;

  // Multi-level page table
  private pageTableLevels: number;
  private pageSizeBits: number;

  constructor(config: {
    numFrames?: number;
    algorithm?: PageReplacementAlgorithm;
    tlbSize?: number;
    pageTableLevels?: number;
  } = {}) {
    this.numFrames = config.numFrames || 4;
    this.algorithm = config.algorithm || 'lru';
    this.tlbSize = config.tlbSize || 16;
    this.pageTableLevels = config.pageTableLevels || 2;
    this.pageSizeBits = 12;  // 4KB pages

    this.frames = new Array(this.numFrames).fill(null);
    this.pageTable = new Map();
    this.referenceString = [];
    this.currentTime = 0;
    this.clockHand = 0;
    this.nruClasses = new Map();
    this.referenceBits = new Map();

    this.tlb = [];

    this.stats = {
      pageFaults: 0,
      pageHits: 0,
      dirtyWritebacks: 0,
      tlbHits: 0,
      tlbMisses: 0
    };
  }

  private findFrame(page: number): number {
    return this.frames.indexOf(page);
  }

  private findEmptyFrame(): number {
    return this.frames.indexOf(null);
  }

  private selectVictimFIFO(): number {
    let oldest = Infinity;
    let victim = 0;

    for (let i = 0; i < this.numFrames; i++) {
      const page = this.frames[i];
      if (page !== null) {
        const entry = this.pageTable.get(page);
        if (entry && entry.loadTime < oldest) {
          oldest = entry.loadTime;
          victim = i;
        }
      }
    }

    return victim;
  }

  private selectVictimLRU(): number {
    let oldest = Infinity;
    let victim = 0;

    for (let i = 0; i < this.numFrames; i++) {
      const page = this.frames[i];
      if (page !== null) {
        const entry = this.pageTable.get(page);
        if (entry && entry.lastAccessTime < oldest) {
          oldest = entry.lastAccessTime;
          victim = i;
        }
      }
    }

    return victim;
  }

  private selectVictimLFU(): number {
    let minCount = Infinity;
    let oldestTime = Infinity;
    let victim = 0;

    for (let i = 0; i < this.numFrames; i++) {
      const page = this.frames[i];
      if (page !== null) {
        const entry = this.pageTable.get(page);
        if (entry) {
          if (entry.accessCount < minCount ||
              (entry.accessCount === minCount && entry.lastAccessTime < oldestTime)) {
            minCount = entry.accessCount;
            oldestTime = entry.lastAccessTime;
            victim = i;
          }
        }
      }
    }

    return victim;
  }

  private selectVictimOptimal(futureRefs: number[]): number {
    let farthest = -1;
    let victim = 0;

    for (let i = 0; i < this.numFrames; i++) {
      const page = this.frames[i];
      if (page !== null) {
        const nextUse = futureRefs.indexOf(page);
        if (nextUse === -1) {
          return i;  // Page won't be used again
        }
        if (nextUse > farthest) {
          farthest = nextUse;
          victim = i;
        }
      }
    }

    return victim;
  }

  private selectVictimClock(): number {
    while (true) {
      const page = this.frames[this.clockHand];
      if (page !== null) {
        const entry = this.pageTable.get(page);
        if (entry) {
          if (entry.referenced) {
            entry.referenced = false;
          } else {
            const victim = this.clockHand;
            this.clockHand = (this.clockHand + 1) % this.numFrames;
            return victim;
          }
        }
      } else {
        const victim = this.clockHand;
        this.clockHand = (this.clockHand + 1) % this.numFrames;
        return victim;
      }
      this.clockHand = (this.clockHand + 1) % this.numFrames;
    }
  }

  private selectVictimNRU(): number {
    // NRU classes: 0 = !R & !M, 1 = !R & M, 2 = R & !M, 3 = R & M
    for (let cls = 0; cls <= 3; cls++) {
      for (let i = 0; i < this.numFrames; i++) {
        const page = this.frames[i];
        if (page !== null) {
          const entry = this.pageTable.get(page);
          if (entry) {
            const pageClass = (entry.referenced ? 2 : 0) + (entry.dirty ? 1 : 0);
            if (pageClass === cls) {
              return i;
            }
          }
        }
      }
    }
    return 0;
  }

  private selectVictimLRUApprox(): number {
    // Second-chance with reference bits
    let passes = 0;
    while (passes < 2) {
      for (let i = 0; i < this.numFrames; i++) {
        const page = this.frames[i];
        if (page !== null) {
          if (!this.referenceBits.get(page)) {
            return i;
          }
          if (passes === 1) {
            this.referenceBits.set(page, false);
          }
        }
      }
      passes++;
    }
    return 0;
  }

  private selectVictim(futureRefs: number[] = []): number {
    switch (this.algorithm) {
      case 'fifo': return this.selectVictimFIFO();
      case 'lru': return this.selectVictimLRU();
      case 'lfu': return this.selectVictimLFU();
      case 'optimal': return this.selectVictimOptimal(futureRefs);
      case 'clock': return this.selectVictimClock();
      case 'nru': return this.selectVictimNRU();
      case 'lru-approx': return this.selectVictimLRUApprox();
      default: return this.selectVictimFIFO();
    }
  }

  private evictPage(frameIndex: number): void {
    const page = this.frames[frameIndex];
    if (page !== null) {
      const entry = this.pageTable.get(page);
      if (entry) {
        if (entry.dirty) {
          this.stats.dirtyWritebacks++;
        }
        entry.valid = false;
        entry.frameNumber = -1;
      }

      // Remove from TLB
      this.tlb = this.tlb.filter(e => e.pageNumber !== page);
    }
    this.frames[frameIndex] = null;
  }

  private loadPage(page: number, frameIndex: number): void {
    this.frames[frameIndex] = page;

    let entry = this.pageTable.get(page);
    if (!entry) {
      entry = {
        pageNumber: page,
        frameNumber: frameIndex,
        valid: true,
        dirty: false,
        referenced: true,
        accessCount: 1,
        lastAccessTime: this.currentTime,
        loadTime: this.currentTime
      };
      this.pageTable.set(page, entry);
    } else {
      entry.frameNumber = frameIndex;
      entry.valid = true;
      entry.referenced = true;
      entry.accessCount++;
      entry.lastAccessTime = this.currentTime;
      entry.loadTime = this.currentTime;
    }

    this.referenceBits.set(page, true);
  }

  private accessPage(page: number): void {
    const entry = this.pageTable.get(page);
    if (entry) {
      entry.referenced = true;
      entry.accessCount++;
      entry.lastAccessTime = this.currentTime;
    }
    this.referenceBits.set(page, true);
  }

  private checkTLB(page: number): number | null {
    for (const entry of this.tlb) {
      if (entry.valid && entry.pageNumber === page) {
        entry.lastAccess = this.currentTime;
        this.stats.tlbHits++;
        return entry.frameNumber;
      }
    }
    this.stats.tlbMisses++;
    return null;
  }

  private updateTLB(page: number, frame: number): void {
    // Remove existing entry for this page
    this.tlb = this.tlb.filter(e => e.pageNumber !== page);

    // Add new entry
    if (this.tlb.length >= this.tlbSize) {
      // Evict LRU entry
      let lru = 0;
      let oldestTime = Infinity;
      for (let i = 0; i < this.tlb.length; i++) {
        if (this.tlb[i].lastAccess < oldestTime) {
          oldestTime = this.tlb[i].lastAccess;
          lru = i;
        }
      }
      this.tlb.splice(lru, 1);
    }

    this.tlb.push({
      pageNumber: page,
      frameNumber: frame,
      valid: true,
      lastAccess: this.currentTime
    });
  }

  accessMemory(page: number, isWrite: boolean = false, futureRefs: number[] = []): boolean {
    this.currentTime++;
    let pageFault = false;

    // Check TLB first
    let frame = this.checkTLB(page);

    if (frame === null) {
      // TLB miss - check page table
      frame = this.findFrame(page);

      if (frame === -1) {
        // Page fault
        pageFault = true;
        this.stats.pageFaults++;

        frame = this.findEmptyFrame();
        if (frame === -1) {
          frame = this.selectVictim(futureRefs);
          this.evictPage(frame);
        }

        this.loadPage(page, frame);
      } else {
        this.stats.pageHits++;
        this.accessPage(page);
      }

      // Update TLB
      this.updateTLB(page, frame);
    } else {
      this.stats.pageHits++;
      this.accessPage(page);
    }

    // Handle write
    if (isWrite) {
      const entry = this.pageTable.get(page);
      if (entry) {
        entry.dirty = true;
      }
    }

    return pageFault;
  }

  simulate(references: number[]): SimulationResult {
    this.reset();
    this.referenceString = [...references];

    const frameHistory: number[][] = [];
    const faultPositions: number[] = [];

    for (let i = 0; i < references.length; i++) {
      const page = references[i];
      const futureRefs = references.slice(i + 1);
      const fault = this.accessMemory(page, false, futureRefs);

      frameHistory.push([...this.frames.map(f => f === null ? -1 : f)]);
      if (fault) {
        faultPositions.push(i);
      }
    }

    const total = this.stats.pageFaults + this.stats.pageHits;

    return {
      pageFaults: this.stats.pageFaults,
      pageHits: this.stats.pageHits,
      hitRate: total > 0 ? this.stats.pageHits / total : 0,
      faultRate: total > 0 ? this.stats.pageFaults / total : 0,
      dirtyPageWritebacks: this.stats.dirtyWritebacks,
      referenceString: this.referenceString,
      frameHistory,
      faultPositions
    };
  }

  addReference(page: number, isWrite: boolean = false): boolean {
    this.referenceString.push(page);
    const futureRefs: number[] = [];
    return this.accessMemory(page, isWrite, futureRefs);
  }

  reset(): void {
    this.frames = new Array(this.numFrames).fill(null);
    this.pageTable.clear();
    this.referenceString = [];
    this.currentTime = 0;
    this.clockHand = 0;
    this.nruClasses.clear();
    this.referenceBits.clear();
    this.tlb = [];

    this.stats = {
      pageFaults: 0,
      pageHits: 0,
      dirtyWritebacks: 0,
      tlbHits: 0,
      tlbMisses: 0
    };
  }

  getStats(): Record<string, unknown> {
    const total = this.stats.pageFaults + this.stats.pageHits;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.pageHits / total * 100).toFixed(2) + '%' : '0%',
      faultRate: total > 0 ? (this.stats.pageFaults / total * 100).toFixed(2) + '%' : '0%',
      tlbHitRate: this.stats.tlbHits + this.stats.tlbMisses > 0
        ? ((this.stats.tlbHits / (this.stats.tlbHits + this.stats.tlbMisses)) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  configureFrames(numFrames: number): void {
    this.numFrames = numFrames;
    this.reset();
  }

  configureAlgorithm(algorithm: PageReplacementAlgorithm): void {
    this.algorithm = algorithm;
    this.reset();
  }

  visualize(): string {
    let viz = `Page Replacement Simulation\n`;
    viz += '='.repeat(60) + '\n';
    viz += `Algorithm: ${this.algorithm.toUpperCase()}\n`;
    viz += `Frames: ${this.numFrames}\n\n`;

    viz += 'Current Frame State:\n';
    viz += '+' + '-'.repeat(8).repeat(this.numFrames) + '+\n';
    viz += '|';
    for (let i = 0; i < this.numFrames; i++) {
      const page = this.frames[i];
      viz += ` ${page === null ? '  -  ' : `  ${page.toString().padStart(2)}  `} |`;
    }
    viz += '\n';
    viz += '+' + '-'.repeat(8).repeat(this.numFrames) + '+\n';

    viz += '\nFrame Labels:\n';
    viz += '|';
    for (let i = 0; i < this.numFrames; i++) {
      viz += `   F${i}   |`;
    }
    viz += '\n\n';

    viz += `Statistics:\n`;
    viz += `  Page Faults: ${this.stats.pageFaults}\n`;
    viz += `  Page Hits: ${this.stats.pageHits}\n`;
    viz += `  Dirty Writebacks: ${this.stats.dirtyWritebacks}\n`;
    viz += `  TLB Hits: ${this.stats.tlbHits}\n`;
    viz += `  TLB Misses: ${this.stats.tlbMisses}\n`;

    return viz;
  }

  analyzeWorkingSet(windowSize: number): WorkingSetInfo {
    if (this.referenceString.length === 0) {
      return {
        windowSize,
        workingSet: [],
        workingSetSize: 0,
        pageReferences: []
      };
    }

    const start = Math.max(0, this.referenceString.length - windowSize);
    const window = this.referenceString.slice(start);
    const workingSet = [...new Set(window)];

    return {
      windowSize,
      workingSet,
      workingSetSize: workingSet.length,
      pageReferences: window
    };
  }

  translateAddress(virtualAddress: number): {
    pageNumber: number;
    offset: number;
    physicalAddress: number | null;
    tlbHit: boolean;
    pageTableLookups: number;
  } {
    const pageSize = 1 << this.pageSizeBits;
    const pageNumber = Math.floor(virtualAddress / pageSize);
    const offset = virtualAddress % pageSize;

    // Check TLB
    let tlbHit = false;
    let frame = null;

    for (const entry of this.tlb) {
      if (entry.valid && entry.pageNumber === pageNumber) {
        tlbHit = true;
        frame = entry.frameNumber;
        break;
      }
    }

    let pageTableLookups = 0;

    if (!tlbHit) {
      // Multi-level page table walk
      pageTableLookups = this.pageTableLevels;

      const entry = this.pageTable.get(pageNumber);
      if (entry && entry.valid) {
        frame = entry.frameNumber;
      }
    }

    const physicalAddress = frame !== null ? frame * pageSize + offset : null;

    return {
      pageNumber,
      offset,
      physicalAddress,
      tlbHit,
      pageTableLookups
    };
  }
}

// ============================================================================
// BELADY'S ANOMALY DEMONSTRATION
// ============================================================================

function demonstrateBelady(): {
  referenceString: number[];
  results: { frames: number; faults: number }[];
  anomalyDetected: boolean;
} {
  // Classic example showing Belady's anomaly
  const referenceString = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
  const results: { frames: number; faults: number }[] = [];

  for (let numFrames = 3; numFrames <= 5; numFrames++) {
    const simulator = new PageReplacementSimulator({
      numFrames,
      algorithm: 'fifo'
    });

    const result = simulator.simulate(referenceString);
    results.push({
      frames: numFrames,
      faults: result.pageFaults
    });
  }

  // Check for anomaly (more frames causing more faults)
  let anomalyDetected = false;
  for (let i = 1; i < results.length; i++) {
    if (results[i].faults > results[i - 1].faults) {
      anomalyDetected = true;
      break;
    }
  }

  return {
    referenceString,
    results,
    anomalyDetected
  };
}

// ============================================================================
// ALGORITHM COMPARISON
// ============================================================================

function compareAlgorithms(referenceString: number[], numFrames: number): Record<string, SimulationResult> {
  const algorithms: PageReplacementAlgorithm[] = ['fifo', 'lru', 'lfu', 'optimal', 'clock', 'nru'];
  const results: Record<string, SimulationResult> = {};

  for (const algo of algorithms) {
    const simulator = new PageReplacementSimulator({
      numFrames,
      algorithm: algo
    });

    results[algo] = simulator.simulate(referenceString);
  }

  return results;
}

// ============================================================================
// GLOBAL INSTANCE
// ============================================================================

let simulator: PageReplacementSimulator | null = null;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const pagereplacementTool: UnifiedTool = {
  name: 'page_replacement',
  description: 'Page replacement algorithm simulator with FIFO, LRU, LFU, Optimal, Clock, NRU, Working Set, TLB simulation',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'simulate', 'add_reference', 'get_page_faults', 'compare_algorithms',
          'analyze_working_set', 'configure_frames', 'visualize_memory',
          'demonstrate_belady', 'translate_address', 'get_stats',
          'configure_algorithm', 'reset', 'info', 'examples'
        ],
        description: 'Operation to perform'
      },
      referenceString: {
        type: 'array',
        items: { type: 'number' },
        description: 'Page reference string'
      },
      page: {
        type: 'number',
        description: 'Page number to reference'
      },
      isWrite: {
        type: 'boolean',
        description: 'Whether this is a write operation'
      },
      numFrames: {
        type: 'number',
        description: 'Number of physical frames'
      },
      algorithm: {
        type: 'string',
        enum: ['fifo', 'lru', 'lfu', 'optimal', 'clock', 'nru', 'lru-approx'],
        description: 'Page replacement algorithm'
      },
      windowSize: {
        type: 'number',
        description: 'Working set window size'
      },
      virtualAddress: {
        type: 'number',
        description: 'Virtual address to translate'
      },
      tlbSize: {
        type: 'number',
        description: 'TLB size'
      }
    },
    required: ['operation']
  }
};

export async function executepagereplacement(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    switch (operation) {
      case 'simulate': {
        if (!simulator) {
          simulator = new PageReplacementSimulator({
            numFrames: args.numFrames || 4,
            algorithm: args.algorithm || 'lru',
            tlbSize: args.tlbSize || 16
          });
        }

        const refs = args.referenceString || [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
        const result = simulator.simulate(refs);

        // Format frame history for display
        const historyStr = result.frameHistory.map((frames, i) => {
          const fault = result.faultPositions.includes(i) ? '*' : ' ';
          return `${fault} Ref ${refs[i]}: [${frames.map(f => f === -1 ? '-' : f).join(', ')}]`;
        }).join('\n');

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'simulate',
            algorithm: args.algorithm || 'lru',
            numFrames: args.numFrames || 4,
            result: {
              pageFaults: result.pageFaults,
              pageHits: result.pageHits,
              hitRate: (result.hitRate * 100).toFixed(2) + '%',
              faultRate: (result.faultRate * 100).toFixed(2) + '%',
              dirtyWritebacks: result.dirtyPageWritebacks
            },
            frameHistory: historyStr,
            legend: '* = page fault'
          }, null, 2)
        };
      }

      case 'add_reference': {
        if (!simulator) {
          simulator = new PageReplacementSimulator({
            numFrames: args.numFrames || 4,
            algorithm: args.algorithm || 'lru'
          });
        }

        const page = args.page ?? 0;
        const isWrite = args.isWrite || false;
        const fault = simulator.addReference(page, isWrite);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'add_reference',
            page,
            isWrite,
            pageFault: fault,
            stats: simulator.getStats()
          }, null, 2)
        };
      }

      case 'get_page_faults': {
        if (!simulator) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'No simulation run yet' }),
            isError: true
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_page_faults',
            stats: simulator.getStats()
          }, null, 2)
        };
      }

      case 'compare_algorithms': {
        const refs = args.referenceString || [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1];
        const numFrames = args.numFrames || 3;

        const results = compareAlgorithms(refs, numFrames);

        const comparison = Object.entries(results).map(([algo, result]) => ({
          algorithm: algo.toUpperCase(),
          pageFaults: result.pageFaults,
          hitRate: (result.hitRate * 100).toFixed(2) + '%'
        })).sort((a, b) => a.pageFaults - b.pageFaults);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'compare_algorithms',
            referenceString: refs,
            numFrames,
            comparison,
            bestAlgorithm: comparison[0].algorithm,
            worstAlgorithm: comparison[comparison.length - 1].algorithm
          }, null, 2)
        };
      }

      case 'analyze_working_set': {
        if (!simulator) {
          simulator = new PageReplacementSimulator();
        }

        const windowSize = args.windowSize || 5;
        const wsInfo = simulator.analyzeWorkingSet(windowSize);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze_working_set',
            ...wsInfo,
            memoryNeeded: wsInfo.workingSetSize,
            explanation: `With window size ${windowSize}, the working set contains ${wsInfo.workingSetSize} unique pages`
          }, null, 2)
        };
      }

      case 'configure_frames': {
        const numFrames = args.numFrames || 4;

        if (!simulator) {
          simulator = new PageReplacementSimulator({ numFrames });
        } else {
          simulator.configureFrames(numFrames);
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'configure_frames',
            numFrames,
            message: `Configured ${numFrames} frames, simulation reset`
          }, null, 2)
        };
      }

      case 'configure_algorithm': {
        const algorithm = args.algorithm || 'lru';

        if (!simulator) {
          simulator = new PageReplacementSimulator({ algorithm });
        } else {
          simulator.configureAlgorithm(algorithm as PageReplacementAlgorithm);
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'configure_algorithm',
            algorithm,
            message: `Configured ${algorithm.toUpperCase()} algorithm, simulation reset`
          }, null, 2)
        };
      }

      case 'visualize_memory': {
        if (!simulator) {
          simulator = new PageReplacementSimulator();
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'visualize_memory',
            visualization: simulator.visualize()
          }, null, 2)
        };
      }

      case 'demonstrate_belady': {
        const result = demonstrateBelady();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'demonstrate_belady',
            explanation: "Belady's Anomaly: Using FIFO, more frames can cause MORE page faults",
            referenceString: result.referenceString,
            results: result.results,
            anomalyDetected: result.anomalyDetected,
            conclusion: result.anomalyDetected
              ? 'ANOMALY DETECTED: Increasing frames increased page faults!'
              : 'No anomaly detected in this example'
          }, null, 2)
        };
      }

      case 'translate_address': {
        if (!simulator) {
          simulator = new PageReplacementSimulator();
        }

        const virtualAddress = args.virtualAddress || 0x1234;
        const result = simulator.translateAddress(virtualAddress);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'translate_address',
            virtualAddress: `0x${virtualAddress.toString(16)}`,
            ...result,
            physicalAddress: result.physicalAddress !== null
              ? `0x${result.physicalAddress.toString(16)}`
              : 'PAGE FAULT - not in memory'
          }, null, 2)
        };
      }

      case 'get_stats': {
        if (!simulator) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'No simulator initialized' }),
            isError: true
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_stats',
            stats: simulator.getStats()
          }, null, 2)
        };
      }

      case 'reset': {
        if (simulator) {
          simulator.reset();
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'reset',
            message: 'Simulator reset'
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Page Replacement Simulator',
            description: 'Comprehensive page replacement algorithm simulator',
            algorithms: {
              FIFO: 'First In First Out - replaces oldest page',
              LRU: 'Least Recently Used - replaces least recently accessed page',
              LFU: 'Least Frequently Used - replaces least accessed page',
              Optimal: "Belady's algorithm - replaces page used farthest in future",
              Clock: 'Second Chance - circular queue with reference bits',
              NRU: 'Not Recently Used - 4 classes based on R and M bits',
              'LRU-Approx': 'LRU approximation using reference bits'
            },
            features: [
              'Page fault simulation',
              'TLB simulation',
              'Working set analysis',
              'Multi-level page table',
              'Dirty page tracking',
              'Address translation',
              "Belady's anomaly demonstration",
              'Algorithm comparison'
            ],
            complexity: {
              FIFO: 'O(1)',
              LRU: 'O(n) naive, O(1) with proper data structures',
              LFU: 'O(n) naive',
              Optimal: 'O(n) - requires future knowledge',
              Clock: 'O(n) worst case',
              NRU: 'O(n)'
            }
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Simulate LRU with reference string',
                call: {
                  operation: 'simulate',
                  algorithm: 'lru',
                  numFrames: 3,
                  referenceString: [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5]
                }
              },
              {
                name: 'Compare all algorithms',
                call: {
                  operation: 'compare_algorithms',
                  numFrames: 4,
                  referenceString: [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2]
                }
              },
              {
                name: "Demonstrate Belady's Anomaly",
                call: { operation: 'demonstrate_belady' }
              },
              {
                name: 'Analyze working set',
                call: {
                  operation: 'analyze_working_set',
                  windowSize: 5
                }
              },
              {
                name: 'Translate virtual address',
                call: {
                  operation: 'translate_address',
                  virtualAddress: 0x12345
                }
              }
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}`,
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ispagereplacementAvailable(): boolean { return true; }
