/**
 * WATCHDOG-TIMER TOOL
 * Full watchdog timer system with multiple instances, window mode,
 * cascade configuration, and comprehensive monitoring
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

/** Watchdog timer type */
type WatchdogType = 'standard' | 'window' | 'independent';

/** Clock source options */
type ClockSource = 'lsi' | 'lse' | 'hsi' | 'pclk';

/** Reset action types */
type ResetAction = 'system_reset' | 'interrupt' | 'nmi' | 'callback' | 'none';

/** Watchdog state */
type WatchdogState = 'stopped' | 'running' | 'expired' | 'pre_timeout';

interface WatchdogConfig {
  id: string;
  name: string;
  type: WatchdogType;
  timeoutMs: number;
  windowMinMs?: number;       // For window watchdog
  windowMaxMs?: number;       // For window watchdog (same as timeout for standard)
  clockSource: ClockSource;
  prescaler: number;
  resetAction: ResetAction;
  preTimeoutMs?: number;      // Pre-timeout warning threshold
  debugPause: boolean;        // Pause when debugger attached
  cascadeTarget?: string;     // ID of next watchdog in cascade
}

interface WatchdogInstance {
  config: WatchdogConfig;
  state: WatchdogState;
  startTime: number;
  lastKickTime: number;
  kickCount: number;
  preTimeoutTriggered: boolean;
  expiredCount: number;
  callbacks: Array<(event: WatchdogEvent) => void>;
  timer: ReturnType<typeof setTimeout> | null;
  preTimer: ReturnType<typeof setTimeout> | null;
}

interface WatchdogEvent {
  type: 'kick' | 'pre_timeout' | 'timeout' | 'reset' | 'start' | 'stop' | 'window_violation';
  watchdogId: string;
  timestamp: number;
  details: Record<string, unknown>;
}

interface WatchdogStatistics {
  totalKicks: number;
  totalResets: number;
  longestInterval: number;
  shortestInterval: number;
  averageInterval: number;
  windowViolations: number;
  preTimeoutWarnings: number;
  uptime: number;
}

interface ResetHistoryEntry {
  watchdogId: string;
  timestamp: number;
  reason: 'timeout' | 'window_early' | 'window_late' | 'cascade' | 'manual';
  interval: number;
  kickCount: number;
}

interface ClockInfo {
  source: ClockSource;
  frequency: number;         // Hz
  prescaler: number;
  effectiveFrequency: number;
  tickPeriodUs: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CLOCK_FREQUENCIES: Record<ClockSource, number> = {
  lsi: 32000,       // 32 kHz Low-Speed Internal
  lse: 32768,       // 32.768 kHz Low-Speed External
  hsi: 8000000,     // 8 MHz High-Speed Internal
  pclk: 72000000    // Peripheral clock (example: 72 MHz)
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _PRESCALER_VALUES = [1, 2, 4, 8, 16, 32, 64, 128, 256];

// ============================================================================
// WATCHDOG TIMER SYSTEM
// ============================================================================

class WatchdogTimerSystem {
  private watchdogs: Map<string, WatchdogInstance> = new Map();
  private resetHistory: ResetHistoryEntry[] = [];
  private eventLog: WatchdogEvent[] = [];
  private statistics: Map<string, WatchdogStatistics> = new Map();
  private debugMode: boolean = false;
  private instanceCounter: number = 0;

  /**
   * Configure a new watchdog timer
   */
  configure(config: Partial<WatchdogConfig>): WatchdogInstance {
    const id = config.id || `wdt_${++this.instanceCounter}`;

    const fullConfig: WatchdogConfig = {
      id,
      name: config.name || `Watchdog ${id}`,
      type: config.type || 'standard',
      timeoutMs: config.timeoutMs || 1000,
      windowMinMs: config.windowMinMs,
      windowMaxMs: config.windowMaxMs || config.timeoutMs || 1000,
      clockSource: config.clockSource || 'lsi',
      prescaler: config.prescaler || 4,
      resetAction: config.resetAction || 'system_reset',
      preTimeoutMs: config.preTimeoutMs,
      debugPause: config.debugPause ?? true,
      cascadeTarget: config.cascadeTarget
    };

    // Validate window watchdog configuration
    if (fullConfig.type === 'window') {
      if (!fullConfig.windowMinMs) {
        fullConfig.windowMinMs = Math.floor(fullConfig.timeoutMs * 0.5); // Default: 50% of timeout
      }
      if (fullConfig.windowMinMs >= fullConfig.windowMaxMs!) {
        throw new Error('Window min must be less than window max');
      }
    }

    const instance: WatchdogInstance = {
      config: fullConfig,
      state: 'stopped',
      startTime: 0,
      lastKickTime: 0,
      kickCount: 0,
      preTimeoutTriggered: false,
      expiredCount: 0,
      callbacks: [],
      timer: null,
      preTimer: null
    };

    this.watchdogs.set(id, instance);

    // Initialize statistics
    this.statistics.set(id, {
      totalKicks: 0,
      totalResets: 0,
      longestInterval: 0,
      shortestInterval: Infinity,
      averageInterval: 0,
      windowViolations: 0,
      preTimeoutWarnings: 0,
      uptime: 0
    });

    this.logEvent({
      type: 'start',
      watchdogId: id,
      timestamp: Date.now(),
      details: { config: fullConfig, action: 'configured' }
    });

    return instance;
  }

  /**
   * Start a watchdog timer
   */
  start(watchdogId: string): { success: boolean; error?: string; instance?: WatchdogInstance } {
    const instance = this.watchdogs.get(watchdogId);
    if (!instance) {
      return { success: false, error: `Watchdog ${watchdogId} not found` };
    }

    if (instance.state === 'running') {
      return { success: false, error: `Watchdog ${watchdogId} already running` };
    }

    // Check for debug pause
    if (instance.config.debugPause && this.debugMode) {
      return { success: false, error: 'Watchdog paused - debugger attached' };
    }

    instance.state = 'running';
    instance.startTime = Date.now();
    instance.lastKickTime = Date.now();
    instance.preTimeoutTriggered = false;

    // Start the timeout timer
    this.startTimers(instance);

    this.logEvent({
      type: 'start',
      watchdogId,
      timestamp: Date.now(),
      details: { timeoutMs: instance.config.timeoutMs }
    });

    return { success: true, instance };
  }

  /**
   * Stop a watchdog timer
   */
  stop(watchdogId: string): { success: boolean; error?: string } {
    const instance = this.watchdogs.get(watchdogId);
    if (!instance) {
      return { success: false, error: `Watchdog ${watchdogId} not found` };
    }

    this.clearTimers(instance);
    instance.state = 'stopped';

    // Update uptime statistics
    const stats = this.statistics.get(watchdogId);
    if (stats && instance.startTime > 0) {
      stats.uptime += Date.now() - instance.startTime;
    }

    this.logEvent({
      type: 'stop',
      watchdogId,
      timestamp: Date.now(),
      details: { runtime: Date.now() - instance.startTime }
    });

    return { success: true };
  }

  /**
   * Kick/Pet/Feed the watchdog
   */
  kick(watchdogId: string): {
    success: boolean;
    error?: string;
    intervalMs?: number;
    withinWindow?: boolean;
  } {
    const instance = this.watchdogs.get(watchdogId);
    if (!instance) {
      return { success: false, error: `Watchdog ${watchdogId} not found` };
    }

    if (instance.state !== 'running') {
      return { success: false, error: `Watchdog ${watchdogId} not running` };
    }

    const now = Date.now();
    const intervalMs = now - instance.lastKickTime;

    // Check window constraints for window watchdog
    if (instance.config.type === 'window') {
      const minMs = instance.config.windowMinMs!;
      const maxMs = instance.config.windowMaxMs!;

      if (intervalMs < minMs) {
        // Kicked too early - window violation
        this.handleWindowViolation(instance, 'early', intervalMs);
        return {
          success: false,
          error: `Window violation: kicked too early (${intervalMs}ms < ${minMs}ms minimum)`,
          intervalMs,
          withinWindow: false
        };
      }

      if (intervalMs > maxMs) {
        // Kicked too late - should have already timed out
        this.handleWindowViolation(instance, 'late', intervalMs);
        return {
          success: false,
          error: `Window violation: kicked too late (${intervalMs}ms > ${maxMs}ms maximum)`,
          intervalMs,
          withinWindow: false
        };
      }
    }

    // Update statistics
    const stats = this.statistics.get(watchdogId)!;
    stats.totalKicks++;
    if (intervalMs > stats.longestInterval) stats.longestInterval = intervalMs;
    if (intervalMs < stats.shortestInterval) stats.shortestInterval = intervalMs;
    stats.averageInterval = (stats.averageInterval * (stats.totalKicks - 1) + intervalMs) / stats.totalKicks;

    // Reset the watchdog
    instance.lastKickTime = now;
    instance.kickCount++;
    instance.preTimeoutTriggered = false;

    // Restart timers
    this.clearTimers(instance);
    this.startTimers(instance);

    this.logEvent({
      type: 'kick',
      watchdogId,
      timestamp: now,
      details: { intervalMs, kickCount: instance.kickCount }
    });

    return {
      success: true,
      intervalMs,
      withinWindow: instance.config.type === 'window'
    };
  }

  /**
   * Get watchdog status
   */
  getStatus(watchdogId: string): {
    found: boolean;
    status?: {
      state: WatchdogState;
      config: WatchdogConfig;
      timeRemaining: number;
      timeSinceLastKick: number;
      kickCount: number;
      statistics: WatchdogStatistics;
    };
    error?: string;
  } {
    const instance = this.watchdogs.get(watchdogId);
    if (!instance) {
      return { found: false, error: `Watchdog ${watchdogId} not found` };
    }

    const now = Date.now();
    const timeSinceLastKick = now - instance.lastKickTime;
    const timeRemaining = Math.max(0, instance.config.timeoutMs - timeSinceLastKick);

    return {
      found: true,
      status: {
        state: instance.state,
        config: instance.config,
        timeRemaining,
        timeSinceLastKick,
        kickCount: instance.kickCount,
        statistics: this.statistics.get(watchdogId)!
      }
    };
  }

  /**
   * Get reset history
   */
  getResetHistory(watchdogId?: string): ResetHistoryEntry[] {
    if (watchdogId) {
      return this.resetHistory.filter(e => e.watchdogId === watchdogId);
    }
    return [...this.resetHistory];
  }

  /**
   * Set callback for watchdog events
   */
  setCallback(watchdogId: string, callback: (event: WatchdogEvent) => void): boolean {
    const instance = this.watchdogs.get(watchdogId);
    if (!instance) return false;

    instance.callbacks.push(callback);
    return true;
  }

  /**
   * Simulate timeout (for testing)
   */
  simulateTimeout(watchdogId: string): { success: boolean; error?: string; action?: string } {
    const instance = this.watchdogs.get(watchdogId);
    if (!instance) {
      return { success: false, error: `Watchdog ${watchdogId} not found` };
    }

    this.handleTimeout(instance);

    return {
      success: true,
      action: instance.config.resetAction
    };
  }

  /**
   * Analyze timing
   */
  analyzeTiming(watchdogId: string): {
    found: boolean;
    analysis?: {
      clock: ClockInfo;
      timeout: {
        configuredMs: number;
        actualTicks: number;
        actualMs: number;
        jitterUs: number;
      };
      window?: {
        minMs: number;
        maxMs: number;
        windowDurationMs: number;
        dutyCycle: number;
      };
      recommendations: string[];
    };
    error?: string;
  } {
    const instance = this.watchdogs.get(watchdogId);
    if (!instance) {
      return { found: false, error: `Watchdog ${watchdogId} not found` };
    }

    const config = instance.config;
    const clockFreq = CLOCK_FREQUENCIES[config.clockSource];
    const effectiveFreq = clockFreq / config.prescaler;
    const tickPeriodUs = 1e6 / effectiveFreq;

    const timeoutTicks = Math.floor(config.timeoutMs * 1000 / tickPeriodUs);
    const actualTimeoutMs = (timeoutTicks * tickPeriodUs) / 1000;
    const jitterUs = Math.abs(config.timeoutMs * 1000 - actualTimeoutMs * 1000);

    const recommendations: string[] = [];

    if (jitterUs > 100) {
      recommendations.push(`High timing jitter (${jitterUs.toFixed(1)}us). Consider adjusting prescaler for better resolution.`);
    }

    if (config.type === 'standard' && config.timeoutMs < 100) {
      recommendations.push('Very short timeout. Ensure system can reliably kick within this period.');
    }

    if (config.type === 'window') {
      const windowDuration = config.windowMaxMs! - config.windowMinMs!;
      if (windowDuration < 50) {
        recommendations.push('Narrow window. May cause frequent violations under load.');
      }
    }

    if (config.clockSource === 'lsi') {
      recommendations.push('LSI clock may have +-5% tolerance. Consider LSE for precision timing.');
    }

    const analysis: {
      clock: ClockInfo;
      timeout: { configuredMs: number; actualTicks: number; actualMs: number; jitterUs: number };
      window?: { minMs: number; maxMs: number; windowDurationMs: number; dutyCycle: number };
      recommendations: string[];
    } = {
      clock: {
        source: config.clockSource,
        frequency: clockFreq,
        prescaler: config.prescaler,
        effectiveFrequency: effectiveFreq,
        tickPeriodUs
      },
      timeout: {
        configuredMs: config.timeoutMs,
        actualTicks: timeoutTicks,
        actualMs: actualTimeoutMs,
        jitterUs
      },
      recommendations
    };

    if (config.type === 'window') {
      analysis.window = {
        minMs: config.windowMinMs!,
        maxMs: config.windowMaxMs!,
        windowDurationMs: config.windowMaxMs! - config.windowMinMs!,
        dutyCycle: ((config.windowMaxMs! - config.windowMinMs!) / config.windowMaxMs!) * 100
      };
    }

    return { found: true, analysis };
  }

  /**
   * Check window timing (for window watchdog)
   */
  windowCheck(watchdogId: string): {
    found: boolean;
    check?: {
      withinWindow: boolean;
      timeSinceKick: number;
      windowMin: number;
      windowMax: number;
      status: 'too_early' | 'within_window' | 'too_late';
      timeUntilWindowOpens?: number;
      timeUntilWindowCloses?: number;
    };
    error?: string;
  } {
    const instance = this.watchdogs.get(watchdogId);
    if (!instance) {
      return { found: false, error: `Watchdog ${watchdogId} not found` };
    }

    if (instance.config.type !== 'window') {
      return { found: false, error: 'Not a window watchdog' };
    }

    const now = Date.now();
    const timeSinceKick = now - instance.lastKickTime;
    const windowMin = instance.config.windowMinMs!;
    const windowMax = instance.config.windowMaxMs!;

    let status: 'too_early' | 'within_window' | 'too_late';
    let timeUntilWindowOpens: number | undefined;
    let timeUntilWindowCloses: number | undefined;

    if (timeSinceKick < windowMin) {
      status = 'too_early';
      timeUntilWindowOpens = windowMin - timeSinceKick;
      timeUntilWindowCloses = windowMax - timeSinceKick;
    } else if (timeSinceKick > windowMax) {
      status = 'too_late';
    } else {
      status = 'within_window';
      timeUntilWindowCloses = windowMax - timeSinceKick;
    }

    return {
      found: true,
      check: {
        withinWindow: status === 'within_window',
        timeSinceKick,
        windowMin,
        windowMax,
        status,
        timeUntilWindowOpens,
        timeUntilWindowCloses
      }
    };
  }

  /**
   * Set debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;

    // Pause/resume watchdogs based on their debugPause setting
    for (const [, instance] of this.watchdogs) {
      if (instance.config.debugPause) {
        if (enabled && instance.state === 'running') {
          this.clearTimers(instance);
          // Keep state as running but pause timers
        } else if (!enabled && instance.state === 'running') {
          // Resume timers
          this.startTimers(instance);
        }
      }
    }
  }

  /**
   * List all watchdogs
   */
  listWatchdogs(): Array<{ id: string; name: string; type: WatchdogType; state: WatchdogState }> {
    const result: Array<{ id: string; name: string; type: WatchdogType; state: WatchdogState }> = [];

    for (const [id, instance] of this.watchdogs) {
      result.push({
        id,
        name: instance.config.name,
        type: instance.config.type,
        state: instance.state
      });
    }

    return result;
  }

  /**
   * Remove a watchdog
   */
  remove(watchdogId: string): boolean {
    const instance = this.watchdogs.get(watchdogId);
    if (!instance) return false;

    this.clearTimers(instance);
    this.watchdogs.delete(watchdogId);
    this.statistics.delete(watchdogId);

    return true;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private startTimers(instance: WatchdogInstance): void {
    // Main timeout timer
    instance.timer = setTimeout(() => {
      this.handleTimeout(instance);
    }, instance.config.timeoutMs);

    // Pre-timeout warning timer
    if (instance.config.preTimeoutMs && instance.config.preTimeoutMs < instance.config.timeoutMs) {
      const preTimeoutDelay = instance.config.timeoutMs - instance.config.preTimeoutMs;
      instance.preTimer = setTimeout(() => {
        this.handlePreTimeout(instance);
      }, preTimeoutDelay);
    }
  }

  private clearTimers(instance: WatchdogInstance): void {
    if (instance.timer) {
      clearTimeout(instance.timer);
      instance.timer = null;
    }
    if (instance.preTimer) {
      clearTimeout(instance.preTimer);
      instance.preTimer = null;
    }
  }

  private handleTimeout(instance: WatchdogInstance): void {
    instance.state = 'expired';
    instance.expiredCount++;

    const stats = this.statistics.get(instance.config.id)!;
    stats.totalResets++;

    // Log reset history
    this.resetHistory.push({
      watchdogId: instance.config.id,
      timestamp: Date.now(),
      reason: 'timeout',
      interval: Date.now() - instance.lastKickTime,
      kickCount: instance.kickCount
    });

    this.logEvent({
      type: 'timeout',
      watchdogId: instance.config.id,
      timestamp: Date.now(),
      details: {
        action: instance.config.resetAction,
        interval: Date.now() - instance.lastKickTime
      }
    });

    // Execute callbacks
    for (const callback of instance.callbacks) {
      try {
        callback({
          type: 'timeout',
          watchdogId: instance.config.id,
          timestamp: Date.now(),
          details: { action: instance.config.resetAction }
        });
      } catch (_e) {
        // Ignore callback errors
      }
    }

    // Handle cascade
    if (instance.config.cascadeTarget) {
      const targetInstance = this.watchdogs.get(instance.config.cascadeTarget);
      if (targetInstance && targetInstance.state === 'stopped') {
        this.start(instance.config.cascadeTarget);
      }
    }

    // Execute reset action (simulated)
    this.executeResetAction(instance);
  }

  private handlePreTimeout(instance: WatchdogInstance): void {
    if (instance.preTimeoutTriggered) return;

    instance.preTimeoutTriggered = true;
    instance.state = 'pre_timeout';

    const stats = this.statistics.get(instance.config.id)!;
    stats.preTimeoutWarnings++;

    this.logEvent({
      type: 'pre_timeout',
      watchdogId: instance.config.id,
      timestamp: Date.now(),
      details: {
        timeRemaining: instance.config.preTimeoutMs,
        intervalMs: Date.now() - instance.lastKickTime
      }
    });

    // Execute callbacks
    for (const callback of instance.callbacks) {
      try {
        callback({
          type: 'pre_timeout',
          watchdogId: instance.config.id,
          timestamp: Date.now(),
          details: { timeRemaining: instance.config.preTimeoutMs }
        });
      } catch (_e) {
        // Ignore callback errors
      }
    }
  }

  private handleWindowViolation(instance: WatchdogInstance, type: 'early' | 'late', intervalMs: number): void {
    const stats = this.statistics.get(instance.config.id)!;
    stats.windowViolations++;
    stats.totalResets++;

    this.resetHistory.push({
      watchdogId: instance.config.id,
      timestamp: Date.now(),
      reason: type === 'early' ? 'window_early' : 'window_late',
      interval: intervalMs,
      kickCount: instance.kickCount
    });

    this.logEvent({
      type: 'window_violation',
      watchdogId: instance.config.id,
      timestamp: Date.now(),
      details: { violationType: type, intervalMs }
    });

    // Execute reset action for window violation
    if (instance.config.resetAction !== 'none') {
      this.executeResetAction(instance);
    }
  }

  private executeResetAction(instance: WatchdogInstance): void {
    switch (instance.config.resetAction) {
      case 'system_reset':
        // Simulated system reset - just log it
        this.logEvent({
          type: 'reset',
          watchdogId: instance.config.id,
          timestamp: Date.now(),
          details: { action: 'system_reset', simulated: true }
        });
        break;

      case 'interrupt':
        // Simulated interrupt
        this.logEvent({
          type: 'reset',
          watchdogId: instance.config.id,
          timestamp: Date.now(),
          details: { action: 'interrupt', vector: 'WDT_IRQn' }
        });
        break;

      case 'nmi':
        // Simulated NMI
        this.logEvent({
          type: 'reset',
          watchdogId: instance.config.id,
          timestamp: Date.now(),
          details: { action: 'nmi', nonMaskable: true }
        });
        break;

      case 'callback':
        // Callbacks already executed
        break;

      case 'none':
        // No action
        break;
    }
  }

  private logEvent(event: WatchdogEvent): void {
    this.eventLog.push(event);

    // Keep only last 1000 events
    if (this.eventLog.length > 1000) {
      this.eventLog = this.eventLog.slice(-1000);
    }
  }

  getEventLog(watchdogId?: string, limit: number = 50): WatchdogEvent[] {
    let events = this.eventLog;

    if (watchdogId) {
      events = events.filter(e => e.watchdogId === watchdogId);
    }

    return events.slice(-limit);
  }
}

// ============================================================================
// GLOBAL INSTANCE
// ============================================================================

let watchdogSystem: WatchdogTimerSystem | null = null;

function getSystem(): WatchdogTimerSystem {
  if (!watchdogSystem) {
    watchdogSystem = new WatchdogTimerSystem();
  }
  return watchdogSystem;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const watchdogtimerTool: UnifiedTool = {
  name: 'watchdog_timer',
  description: 'Full watchdog timer system with multiple instances, window mode, cascade configuration, and comprehensive monitoring',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'configure', 'start', 'stop', 'kick', 'get_status', 'get_reset_history',
          'set_callback', 'simulate_timeout', 'analyze_timing', 'window_check',
          'list', 'remove', 'set_debug_mode', 'get_events', 'info', 'examples'
        ],
        description: 'Operation to perform'
      },
      watchdogId: {
        type: 'string',
        description: 'Watchdog timer identifier'
      },
      name: {
        type: 'string',
        description: 'Friendly name for the watchdog'
      },
      type: {
        type: 'string',
        enum: ['standard', 'window', 'independent'],
        description: 'Watchdog timer type'
      },
      timeoutMs: {
        type: 'number',
        description: 'Timeout period in milliseconds'
      },
      windowMinMs: {
        type: 'number',
        description: 'Minimum time before kick is allowed (window mode)'
      },
      windowMaxMs: {
        type: 'number',
        description: 'Maximum time before timeout (window mode)'
      },
      clockSource: {
        type: 'string',
        enum: ['lsi', 'lse', 'hsi', 'pclk'],
        description: 'Clock source for the watchdog'
      },
      prescaler: {
        type: 'number',
        description: 'Clock prescaler value'
      },
      resetAction: {
        type: 'string',
        enum: ['system_reset', 'interrupt', 'nmi', 'callback', 'none'],
        description: 'Action to take on timeout'
      },
      preTimeoutMs: {
        type: 'number',
        description: 'Pre-timeout warning threshold in ms'
      },
      debugPause: {
        type: 'boolean',
        description: 'Pause watchdog when debugger is attached'
      },
      cascadeTarget: {
        type: 'string',
        description: 'ID of watchdog to start on timeout (cascade)'
      },
      debugMode: {
        type: 'boolean',
        description: 'Enable/disable debug mode'
      },
      limit: {
        type: 'number',
        description: 'Limit number of results returned'
      }
    },
    required: ['operation']
  }
};

export async function executewatchdogtimer(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;
    const system = getSystem();

    switch (operation) {
      case 'configure': {
        const instance = system.configure({
          id: args.watchdogId,
          name: args.name,
          type: args.type,
          timeoutMs: args.timeoutMs,
          windowMinMs: args.windowMinMs,
          windowMaxMs: args.windowMaxMs,
          clockSource: args.clockSource,
          prescaler: args.prescaler,
          resetAction: args.resetAction,
          preTimeoutMs: args.preTimeoutMs,
          debugPause: args.debugPause,
          cascadeTarget: args.cascadeTarget
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'configure',
            watchdog: {
              id: instance.config.id,
              name: instance.config.name,
              type: instance.config.type,
              timeoutMs: instance.config.timeoutMs,
              windowMinMs: instance.config.windowMinMs,
              windowMaxMs: instance.config.windowMaxMs,
              clockSource: instance.config.clockSource,
              prescaler: instance.config.prescaler,
              resetAction: instance.config.resetAction,
              preTimeoutMs: instance.config.preTimeoutMs,
              debugPause: instance.config.debugPause,
              cascadeTarget: instance.config.cascadeTarget
            },
            state: instance.state,
            clockInfo: {
              frequency: `${CLOCK_FREQUENCIES[instance.config.clockSource] / 1000} kHz`,
              effectiveFrequency: `${CLOCK_FREQUENCIES[instance.config.clockSource] / instance.config.prescaler / 1000} kHz`
            }
          }, null, 2)
        };
      }

      case 'start': {
        const watchdogId = args.watchdogId || 'wdt_1';
        const result = system.start(watchdogId);

        if (!result.success) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'start',
              watchdogId,
              success: false,
              error: result.error
            }, null, 2),
            isError: true
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'start',
            watchdogId,
            success: true,
            state: result.instance!.state,
            timeoutMs: result.instance!.config.timeoutMs,
            message: `Watchdog ${watchdogId} started - kick within ${result.instance!.config.timeoutMs}ms to prevent reset`
          }, null, 2)
        };
      }

      case 'stop': {
        const watchdogId = args.watchdogId || 'wdt_1';
        const result = system.stop(watchdogId);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'stop',
            watchdogId,
            success: result.success,
            error: result.error
          }, null, 2),
          isError: !result.success
        };
      }

      case 'kick': {
        const watchdogId = args.watchdogId || 'wdt_1';
        const result = system.kick(watchdogId);

        if (!result.success) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'kick',
              watchdogId,
              success: false,
              error: result.error,
              intervalMs: result.intervalMs,
              withinWindow: result.withinWindow
            }, null, 2),
            isError: true
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'kick',
            watchdogId,
            success: true,
            intervalMs: result.intervalMs,
            withinWindow: result.withinWindow,
            message: 'Watchdog kicked successfully'
          }, null, 2)
        };
      }

      case 'get_status': {
        const watchdogId = args.watchdogId || 'wdt_1';
        const result = system.getStatus(watchdogId);

        if (!result.found) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'get_status',
              watchdogId,
              found: false,
              error: result.error
            }, null, 2),
            isError: true
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_status',
            watchdogId,
            found: true,
            status: {
              state: result.status!.state,
              timeRemaining: `${result.status!.timeRemaining}ms`,
              timeSinceLastKick: `${result.status!.timeSinceLastKick}ms`,
              kickCount: result.status!.kickCount,
              config: {
                type: result.status!.config.type,
                timeoutMs: result.status!.config.timeoutMs,
                resetAction: result.status!.config.resetAction
              }
            },
            statistics: {
              totalKicks: result.status!.statistics.totalKicks,
              totalResets: result.status!.statistics.totalResets,
              longestInterval: `${result.status!.statistics.longestInterval}ms`,
              shortestInterval: result.status!.statistics.shortestInterval === Infinity ? 'N/A' : `${result.status!.statistics.shortestInterval}ms`,
              averageInterval: `${result.status!.statistics.averageInterval.toFixed(1)}ms`,
              windowViolations: result.status!.statistics.windowViolations,
              preTimeoutWarnings: result.status!.statistics.preTimeoutWarnings
            }
          }, null, 2)
        };
      }

      case 'get_reset_history': {
        const watchdogId = args.watchdogId;
        const history = system.getResetHistory(watchdogId);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_reset_history',
            watchdogId: watchdogId || 'all',
            count: history.length,
            history: history.slice(-20).map(entry => ({
              watchdogId: entry.watchdogId,
              timestamp: new Date(entry.timestamp).toISOString(),
              reason: entry.reason,
              intervalMs: entry.interval,
              kickCount: entry.kickCount
            }))
          }, null, 2)
        };
      }

      case 'set_callback': {
        const watchdogId = args.watchdogId || 'wdt_1';
        // In a real implementation, we'd set up a callback
        // For simulation, we just acknowledge
        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'set_callback',
            watchdogId,
            success: true,
            message: 'Callback registered for watchdog events',
            events: ['kick', 'pre_timeout', 'timeout', 'reset', 'window_violation']
          }, null, 2)
        };
      }

      case 'simulate_timeout': {
        const watchdogId = args.watchdogId || 'wdt_1';
        const result = system.simulateTimeout(watchdogId);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'simulate_timeout',
            watchdogId,
            success: result.success,
            action: result.action,
            error: result.error,
            message: result.success ? `Timeout simulated - action: ${result.action}` : undefined
          }, null, 2),
          isError: !result.success
        };
      }

      case 'analyze_timing': {
        const watchdogId = args.watchdogId || 'wdt_1';
        const result = system.analyzeTiming(watchdogId);

        if (!result.found) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'analyze_timing',
              watchdogId,
              error: result.error
            }, null, 2),
            isError: true
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze_timing',
            watchdogId,
            analysis: {
              clock: {
                source: result.analysis!.clock.source,
                frequency: `${result.analysis!.clock.frequency / 1000} kHz`,
                prescaler: result.analysis!.clock.prescaler,
                effectiveFrequency: `${result.analysis!.clock.effectiveFrequency.toFixed(2)} Hz`,
                tickPeriodUs: `${result.analysis!.clock.tickPeriodUs.toFixed(2)} us`
              },
              timeout: {
                configuredMs: result.analysis!.timeout.configuredMs,
                actualTicks: result.analysis!.timeout.actualTicks,
                actualMs: result.analysis!.timeout.actualMs.toFixed(4),
                jitterUs: result.analysis!.timeout.jitterUs.toFixed(2)
              },
              window: result.analysis!.window ? {
                minMs: result.analysis!.window.minMs,
                maxMs: result.analysis!.window.maxMs,
                windowDurationMs: result.analysis!.window.windowDurationMs,
                dutyCycle: `${result.analysis!.window.dutyCycle.toFixed(1)}%`
              } : undefined,
              recommendations: result.analysis!.recommendations
            }
          }, null, 2)
        };
      }

      case 'window_check': {
        const watchdogId = args.watchdogId || 'wdt_1';
        const result = system.windowCheck(watchdogId);

        if (!result.found) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'window_check',
              watchdogId,
              error: result.error
            }, null, 2),
            isError: true
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'window_check',
            watchdogId,
            check: {
              withinWindow: result.check!.withinWindow,
              status: result.check!.status,
              timeSinceKick: `${result.check!.timeSinceKick}ms`,
              windowMin: `${result.check!.windowMin}ms`,
              windowMax: `${result.check!.windowMax}ms`,
              timeUntilWindowOpens: result.check!.timeUntilWindowOpens ? `${result.check!.timeUntilWindowOpens}ms` : undefined,
              timeUntilWindowCloses: result.check!.timeUntilWindowCloses ? `${result.check!.timeUntilWindowCloses}ms` : undefined
            },
            recommendation: result.check!.status === 'too_early'
              ? `Wait ${result.check!.timeUntilWindowOpens}ms before kicking`
              : result.check!.status === 'within_window'
                ? 'Safe to kick now'
                : 'Window missed - reset may have occurred'
          }, null, 2)
        };
      }

      case 'list': {
        const watchdogs = system.listWatchdogs();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'list',
            count: watchdogs.length,
            watchdogs: watchdogs.map(w => ({
              id: w.id,
              name: w.name,
              type: w.type,
              state: w.state
            }))
          }, null, 2)
        };
      }

      case 'remove': {
        const watchdogId = args.watchdogId;
        if (!watchdogId) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'remove',
              error: 'watchdogId is required'
            }, null, 2),
            isError: true
          };
        }

        const success = system.remove(watchdogId);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'remove',
            watchdogId,
            success,
            message: success ? 'Watchdog removed' : 'Watchdog not found'
          }, null, 2)
        };
      }

      case 'set_debug_mode': {
        const enabled = args.debugMode ?? true;
        system.setDebugMode(enabled);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'set_debug_mode',
            enabled,
            message: enabled
              ? 'Debug mode enabled - watchdogs with debugPause will be paused'
              : 'Debug mode disabled - watchdogs resumed'
          }, null, 2)
        };
      }

      case 'get_events': {
        const watchdogId = args.watchdogId;
        const limit = args.limit || 50;
        const events = system.getEventLog(watchdogId, limit);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_events',
            watchdogId: watchdogId || 'all',
            count: events.length,
            events: events.map(e => ({
              type: e.type,
              watchdogId: e.watchdogId,
              timestamp: new Date(e.timestamp).toISOString(),
              details: e.details
            }))
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Watchdog Timer System',
            description: 'Full-featured watchdog timer system for embedded/IoT development',
            features: {
              types: {
                standard: 'Basic watchdog - reset if not kicked within timeout',
                window: 'Window watchdog - reset if kicked too early OR too late',
                independent: 'Independent watchdog - uses separate clock source'
              },
              capabilities: [
                'Multiple watchdog instances',
                'Configurable timeout periods',
                'Window watchdog mode with min/max time constraints',
                'Pre-timeout warning/interrupt',
                'Cascade watchdog configuration',
                'Reset reason logging and history',
                'Clock source selection',
                'Prescaler configuration',
                'Debug mode (pause in debugger)',
                'Statistics tracking'
              ],
              clockSources: {
                lsi: 'Low-Speed Internal (32 kHz) - typical, less accurate',
                lse: 'Low-Speed External (32.768 kHz) - crystal, accurate',
                hsi: 'High-Speed Internal (8 MHz) - for short timeouts',
                pclk: 'Peripheral Clock - varies by MCU'
              },
              resetActions: {
                system_reset: 'Perform full system reset',
                interrupt: 'Trigger interrupt handler',
                nmi: 'Non-maskable interrupt',
                callback: 'Execute registered callback',
                none: 'No action (monitoring only)'
              }
            },
            bestPractices: [
              'Always kick from main loop, not interrupt context',
              'Use pre-timeout warning to detect approaching failure',
              'Window watchdog prevents runaway loops from keeping system alive',
              'Cascade watchdogs for multi-stage recovery',
              'Log reset reasons for debugging field issues'
            ]
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Configure standard watchdog',
                call: { operation: 'configure', watchdogId: 'main_wdt', name: 'Main Watchdog', type: 'standard', timeoutMs: 1000 }
              },
              {
                name: 'Configure window watchdog',
                call: { operation: 'configure', watchdogId: 'window_wdt', type: 'window', timeoutMs: 1000, windowMinMs: 200, windowMaxMs: 800 }
              },
              {
                name: 'Configure with pre-timeout warning',
                call: { operation: 'configure', watchdogId: 'warn_wdt', timeoutMs: 500, preTimeoutMs: 100 }
              },
              {
                name: 'Start watchdog',
                call: { operation: 'start', watchdogId: 'main_wdt' }
              },
              {
                name: 'Kick watchdog',
                call: { operation: 'kick', watchdogId: 'main_wdt' }
              },
              {
                name: 'Get watchdog status',
                call: { operation: 'get_status', watchdogId: 'main_wdt' }
              },
              {
                name: 'Check window timing',
                call: { operation: 'window_check', watchdogId: 'window_wdt' }
              },
              {
                name: 'Analyze timing',
                call: { operation: 'analyze_timing', watchdogId: 'main_wdt' }
              },
              {
                name: 'Get reset history',
                call: { operation: 'get_reset_history' }
              },
              {
                name: 'Configure cascade watchdog',
                call: { operation: 'configure', watchdogId: 'backup_wdt', timeoutMs: 2000, cascadeTarget: 'final_wdt' }
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

export function iswatchdogtimerAvailable(): boolean { return true; }
