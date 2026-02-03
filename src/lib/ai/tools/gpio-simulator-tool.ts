/**
 * GPIO SIMULATOR TOOL
 * Comprehensive GPIO pin simulation system for embedded/IoT development
 * Supports: pin configuration, digital I/O, PWM, interrupts, debouncing, timing analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

type PinMode = 'input' | 'output' | 'pwm' | 'analog_in' | 'open_drain' | 'open_source';
type PullType = 'none' | 'pull_up' | 'pull_down';
type InterruptEdge = 'rising' | 'falling' | 'both' | 'none';
type VoltageLevel = '3.3V' | '5V' | '1.8V';

interface PinConfig {
  mode: PinMode;
  pull: PullType;
  voltage: VoltageLevel;
  interruptEdge: InterruptEdge;
  debounceMs: number;
  pwmFrequency: number;
  pwmDutyCycle: number;
  maxCurrentMa: number;
}

interface PinState {
  value: boolean;
  analogValue: number;
  lastChange: number;
  changeCount: number;
  lastDebounced: number;
  isDebouncing: boolean;
}

interface PinHistoryEntry {
  timestamp: number;
  value: boolean;
  source: 'write' | 'simulate' | 'interrupt' | 'toggle';
  duration?: number;
}

interface InterruptEvent {
  pin: number;
  edge: 'rising' | 'falling';
  timestamp: number;
  previousValue: boolean;
  newValue: boolean;
}

interface GPIOBank {
  name: string;
  startPin: number;
  endPin: number;
  voltage: VoltageLevel;
  maxCurrent: number;
}

interface TimingAnalysis {
  pulseWidths: { high: number[]; low: number[] };
  frequency: number;
  dutyCycle: number;
  jitter: number;
  risingEdges: number;
  fallingEdges: number;
}

interface SafetyStatus {
  shortCircuit: boolean;
  overload: boolean;
  conflictingOutputs: boolean;
  warnings: string[];
}

// ============================================================================
// GPIO SIMULATOR CLASS
// ============================================================================

class GPIOSimulator {
  private pins: Map<number, PinConfig> = new Map();
  private states: Map<number, PinState> = new Map();
  private history: Map<number, PinHistoryEntry[]> = new Map();
  private interrupts: InterruptEvent[] = [];
  private banks: GPIOBank[] = [];
  private baseTime: number;
  private globalVoltage: VoltageLevel = '3.3V';

  constructor() {
    this.baseTime = Date.now();
    this.initializeBanks();
  }

  private initializeBanks(): void {
    // Default GPIO banks similar to RPi/STM32
    this.banks = [
      { name: 'GPIOA', startPin: 0, endPin: 15, voltage: '3.3V', maxCurrent: 16 },
      { name: 'GPIOB', startPin: 16, endPin: 31, voltage: '3.3V', maxCurrent: 16 },
      { name: 'GPIOC', startPin: 32, endPin: 47, voltage: '3.3V', maxCurrent: 8 },
      { name: 'GPIOD', startPin: 48, endPin: 63, voltage: '5V', maxCurrent: 20 },
    ];
  }

  private getDefaultConfig(): PinConfig {
    return {
      mode: 'input',
      pull: 'none',
      voltage: this.globalVoltage,
      interruptEdge: 'none',
      debounceMs: 0,
      pwmFrequency: 1000,
      pwmDutyCycle: 50,
      maxCurrentMa: 16,
    };
  }

  private getDefaultState(): PinState {
    return {
      value: false,
      analogValue: 0,
      lastChange: this.now(),
      changeCount: 0,
      lastDebounced: this.now(),
      isDebouncing: false,
    };
  }

  private now(): number {
    return Date.now() - this.baseTime;
  }

  private getBankForPin(pin: number): GPIOBank | undefined {
    return this.banks.find(b => pin >= b.startPin && pin <= b.endPin);
  }

  private getVoltageValue(level: VoltageLevel): number {
    switch (level) {
      case '1.8V': return 1.8;
      case '3.3V': return 3.3;
      case '5V': return 5.0;
      default: return 3.3;
    }
  }

  private checkInterrupt(pin: number, oldValue: boolean, newValue: boolean): void {
    const config = this.pins.get(pin);
    if (!config || config.interruptEdge === 'none') return;

    const state = this.states.get(pin)!;

    // Apply debouncing
    if (config.debounceMs > 0) {
      const timeSinceLastDebounced = this.now() - state.lastDebounced;
      if (timeSinceLastDebounced < config.debounceMs) {
        state.isDebouncing = true;
        return;
      }
      state.lastDebounced = this.now();
      state.isDebouncing = false;
    }

    let shouldTrigger = false;
    let edge: 'rising' | 'falling' = 'rising';

    if (oldValue !== newValue) {
      if (!oldValue && newValue) {
        edge = 'rising';
        shouldTrigger = config.interruptEdge === 'rising' || config.interruptEdge === 'both';
      } else if (oldValue && !newValue) {
        edge = 'falling';
        shouldTrigger = config.interruptEdge === 'falling' || config.interruptEdge === 'both';
      }
    }

    if (shouldTrigger) {
      this.interrupts.push({
        pin,
        edge,
        timestamp: this.now(),
        previousValue: oldValue,
        newValue,
      });
    }
  }

  configure(pin: number, options: Partial<PinConfig>): {
    success: boolean;
    config: PinConfig;
    bank: string | null;
    warnings: string[];
  } {
    const warnings: string[] = [];
    const bank = this.getBankForPin(pin);

    let config = this.pins.get(pin) || this.getDefaultConfig();
    config = { ...config, ...options };

    // Apply bank constraints
    if (bank) {
      if (options.voltage && options.voltage !== bank.voltage) {
        warnings.push(`Pin ${pin} is in ${bank.name} which operates at ${bank.voltage}. Voltage set to ${bank.voltage}.`);
        config.voltage = bank.voltage;
      }
      if (config.maxCurrentMa > bank.maxCurrent) {
        warnings.push(`Max current limited to ${bank.maxCurrent}mA for ${bank.name}`);
        config.maxCurrentMa = bank.maxCurrent;
      }
    }

    // PWM constraints
    if (config.mode === 'pwm') {
      if (config.pwmFrequency < 1) config.pwmFrequency = 1;
      if (config.pwmFrequency > 1000000) {
        warnings.push('PWM frequency limited to 1MHz');
        config.pwmFrequency = 1000000;
      }
      if (config.pwmDutyCycle < 0) config.pwmDutyCycle = 0;
      if (config.pwmDutyCycle > 100) config.pwmDutyCycle = 100;
    }

    this.pins.set(pin, config);

    if (!this.states.has(pin)) {
      const state = this.getDefaultState();
      // Apply pull-up/pull-down initial state
      if (config.pull === 'pull_up') {
        state.value = true;
        state.analogValue = this.getVoltageValue(config.voltage);
      } else if (config.pull === 'pull_down') {
        state.value = false;
        state.analogValue = 0;
      }
      this.states.set(pin, state);
    }

    if (!this.history.has(pin)) {
      this.history.set(pin, []);
    }

    return {
      success: true,
      config,
      bank: bank?.name || null,
      warnings,
    };
  }

  read(pin: number): {
    success: boolean;
    value: boolean;
    analogValue: number;
    voltage: number;
    config: PinConfig | null;
  } {
    const config = this.pins.get(pin);
    const state = this.states.get(pin);

    if (!config || !state) {
      // Return default for unconfigured pin
      return {
        success: false,
        value: false,
        analogValue: 0,
        voltage: 0,
        config: null,
      };
    }

    const voltageValue = state.value ? this.getVoltageValue(config.voltage) : 0;

    return {
      success: true,
      value: state.value,
      analogValue: state.analogValue,
      voltage: voltageValue,
      config,
    };
  }

  write(pin: number, value: boolean): {
    success: boolean;
    previousValue: boolean;
    newValue: boolean;
    interruptTriggered: boolean;
    error?: string;
  } {
    const config = this.pins.get(pin);
    const state = this.states.get(pin);

    if (!config) {
      return {
        success: false,
        previousValue: false,
        newValue: false,
        interruptTriggered: false,
        error: `Pin ${pin} not configured`,
      };
    }

    if (config.mode === 'input') {
      return {
        success: false,
        previousValue: state?.value || false,
        newValue: state?.value || false,
        interruptTriggered: false,
        error: `Pin ${pin} is configured as input`,
      };
    }

    if (!state) {
      return {
        success: false,
        previousValue: false,
        newValue: false,
        interruptTriggered: false,
        error: `Pin ${pin} state not initialized`,
      };
    }

    const previousValue = state.value;
    const interruptCountBefore = this.interrupts.length;

    state.value = value;
    state.analogValue = value ? this.getVoltageValue(config.voltage) : 0;
    state.lastChange = this.now();
    state.changeCount++;

    this.checkInterrupt(pin, previousValue, value);

    // Record in history
    const hist = this.history.get(pin)!;
    hist.push({
      timestamp: this.now(),
      value,
      source: 'write',
    });

    // Keep history manageable
    if (hist.length > 1000) {
      hist.splice(0, hist.length - 1000);
    }

    return {
      success: true,
      previousValue,
      newValue: value,
      interruptTriggered: this.interrupts.length > interruptCountBefore,
    };
  }

  toggle(pin: number): {
    success: boolean;
    newValue: boolean;
    error?: string;
  } {
    const state = this.states.get(pin);
    if (!state) {
      return { success: false, newValue: false, error: `Pin ${pin} not configured` };
    }

    const result = this.write(pin, !state.value);
    if (result.success) {
      const hist = this.history.get(pin)!;
      if (hist.length > 0) {
        hist[hist.length - 1].source = 'toggle';
      }
    }

    return {
      success: result.success,
      newValue: result.newValue,
      error: result.error,
    };
  }

  setInterrupt(pin: number, edge: InterruptEdge, debounceMs: number = 0): {
    success: boolean;
    config: PinConfig | null;
  } {
    const config = this.pins.get(pin);
    if (!config) {
      return { success: false, config: null };
    }

    config.interruptEdge = edge;
    config.debounceMs = debounceMs;

    return { success: true, config };
  }

  getHistory(pin: number, limit: number = 100): {
    entries: PinHistoryEntry[];
    totalChanges: number;
    timing?: TimingAnalysis;
  } {
    const hist = this.history.get(pin) || [];
    const state = this.states.get(pin);
    const entries = hist.slice(-limit);

    let timing: TimingAnalysis | undefined;

    if (entries.length >= 2) {
      const highWidths: number[] = [];
      const lowWidths: number[] = [];
      let risingEdges = 0;
      let fallingEdges = 0;

      for (let i = 1; i < entries.length; i++) {
        const prev = entries[i - 1];
        const curr = entries[i];
        const duration = curr.timestamp - prev.timestamp;

        if (prev.value) {
          highWidths.push(duration);
        } else {
          lowWidths.push(duration);
        }

        if (!prev.value && curr.value) risingEdges++;
        if (prev.value && !curr.value) fallingEdges++;
      }

      const avgHighWidth = highWidths.length > 0
        ? highWidths.reduce((a, b) => a + b, 0) / highWidths.length
        : 0;
      const avgLowWidth = lowWidths.length > 0
        ? lowWidths.reduce((a, b) => a + b, 0) / lowWidths.length
        : 0;
      const period = avgHighWidth + avgLowWidth;
      const frequency = period > 0 ? 1000 / period : 0;
      const dutyCycle = period > 0 ? (avgHighWidth / period) * 100 : 0;

      // Calculate jitter (standard deviation of period)
      const allWidths = [...highWidths, ...lowWidths];
      const avgWidth = allWidths.length > 0
        ? allWidths.reduce((a, b) => a + b, 0) / allWidths.length
        : 0;
      const variance = allWidths.length > 0
        ? allWidths.reduce((sum, w) => sum + Math.pow(w - avgWidth, 2), 0) / allWidths.length
        : 0;
      const jitter = Math.sqrt(variance);

      timing = {
        pulseWidths: { high: highWidths.slice(-10), low: lowWidths.slice(-10) },
        frequency,
        dutyCycle,
        jitter,
        risingEdges,
        fallingEdges,
      };
    }

    return {
      entries,
      totalChanges: state?.changeCount || 0,
      timing,
    };
  }

  simulateInput(pin: number, value: boolean): {
    success: boolean;
    interruptTriggered: boolean;
    debounced: boolean;
    error?: string;
  } {
    const config = this.pins.get(pin);
    const state = this.states.get(pin);

    if (!config) {
      return {
        success: false,
        interruptTriggered: false,
        debounced: false,
        error: `Pin ${pin} not configured`,
      };
    }

    if (config.mode !== 'input' && config.mode !== 'analog_in') {
      return {
        success: false,
        interruptTriggered: false,
        debounced: false,
        error: `Pin ${pin} is not configured as input`,
      };
    }

    if (!state) {
      return {
        success: false,
        interruptTriggered: false,
        debounced: false,
        error: `Pin ${pin} state not initialized`,
      };
    }

    const previousValue = state.value;
    const interruptCountBefore = this.interrupts.length;

    state.value = value;
    state.analogValue = value ? this.getVoltageValue(config.voltage) : 0;
    state.lastChange = this.now();
    state.changeCount++;

    this.checkInterrupt(pin, previousValue, value);

    const hist = this.history.get(pin)!;
    hist.push({
      timestamp: this.now(),
      value,
      source: 'simulate',
    });

    return {
      success: true,
      interruptTriggered: this.interrupts.length > interruptCountBefore,
      debounced: state.isDebouncing,
    };
  }

  simulateSequence(pin: number, sequence: { value: boolean; durationMs: number }[]): {
    success: boolean;
    stepsExecuted: number;
    interruptsTriggered: number;
    finalValue: boolean;
  } {
    let interruptsTriggered = 0;
    let stepsExecuted = 0;
    let finalValue = false;

    for (const step of sequence) {
      const result = this.simulateInput(pin, step.value);
      if (result.success) {
        stepsExecuted++;
        if (result.interruptTriggered) interruptsTriggered++;
        finalValue = step.value;

        // Advance simulated time
        this.baseTime -= step.durationMs;
      }
    }

    return {
      success: stepsExecuted === sequence.length,
      stepsExecuted,
      interruptsTriggered,
      finalValue,
    };
  }

  getInterrupts(clear: boolean = false): InterruptEvent[] {
    const events = [...this.interrupts];
    if (clear) {
      this.interrupts = [];
    }
    return events;
  }

  readPort(startPin: number, count: number): {
    value: number;
    binaryString: string;
    pinValues: { pin: number; value: boolean }[];
  } {
    let portValue = 0;
    const pinValues: { pin: number; value: boolean }[] = [];

    for (let i = 0; i < count; i++) {
      const pin = startPin + i;
      const state = this.states.get(pin);
      const value = state?.value || false;
      if (value) {
        portValue |= (1 << i);
      }
      pinValues.push({ pin, value });
    }

    return {
      value: portValue,
      binaryString: portValue.toString(2).padStart(count, '0'),
      pinValues,
    };
  }

  writePort(startPin: number, value: number, count: number): {
    success: boolean;
    pinsWritten: number;
    errors: string[];
  } {
    let pinsWritten = 0;
    const errors: string[] = [];

    for (let i = 0; i < count; i++) {
      const pin = startPin + i;
      const bitValue = (value & (1 << i)) !== 0;
      const result = this.write(pin, bitValue);
      if (result.success) {
        pinsWritten++;
      } else if (result.error) {
        errors.push(`Pin ${pin}: ${result.error}`);
      }
    }

    return {
      success: errors.length === 0,
      pinsWritten,
      errors,
    };
  }

  getPWMState(pin: number): {
    enabled: boolean;
    frequency: number;
    dutyCycle: number;
    period: number;
    highTime: number;
    lowTime: number;
  } | null {
    const config = this.pins.get(pin);
    if (!config || config.mode !== 'pwm') {
      return null;
    }

    const period = 1000 / config.pwmFrequency; // ms
    const highTime = period * (config.pwmDutyCycle / 100);
    const lowTime = period - highTime;

    return {
      enabled: true,
      frequency: config.pwmFrequency,
      dutyCycle: config.pwmDutyCycle,
      period,
      highTime,
      lowTime,
    };
  }

  setPWM(pin: number, frequency: number, dutyCycle: number): {
    success: boolean;
    config: PinConfig | null;
    error?: string;
  } {
    const config = this.pins.get(pin);
    if (!config) {
      return { success: false, config: null, error: `Pin ${pin} not configured` };
    }

    if (config.mode !== 'pwm') {
      return { success: false, config, error: `Pin ${pin} not in PWM mode` };
    }

    config.pwmFrequency = Math.max(1, Math.min(1000000, frequency));
    config.pwmDutyCycle = Math.max(0, Math.min(100, dutyCycle));

    return { success: true, config };
  }

  checkSafety(): SafetyStatus {
    const warnings: string[] = [];
    let shortCircuit = false;
    let overload = false;
    const conflictingOutputs = false;

    // Check for conflicting outputs (two outputs connected)
    const outputPins = Array.from(this.pins.entries())
      .filter(([, c]) => c.mode === 'output' || c.mode === 'pwm' || c.mode === 'open_drain')
      .map(([p, c]) => ({ pin: p, config: c, state: this.states.get(p) }));

    // Group by bank
    for (const bank of this.banks) {
      const bankPins = outputPins.filter(p => p.pin >= bank.startPin && p.pin <= bank.endPin);
      const highPins = bankPins.filter(p => p.state?.value);
      const lowPins = bankPins.filter(p => !p.state?.value);

      // Check total current draw
      let totalCurrent = 0;
      for (const p of bankPins) {
        if (p.state?.value) {
          totalCurrent += p.config.maxCurrentMa;
        }
      }

      if (totalCurrent > bank.maxCurrent * 4) {
        overload = true;
        warnings.push(`${bank.name} total current (${totalCurrent}mA) exceeds safe limit`);
      }

      // Check for potential conflicts (simplified)
      if (highPins.length > 0 && lowPins.length > 0) {
        // This would only be a real conflict if they were connected together
        // For simulation, just warn about potential issues
        const highCount = highPins.length;
        const lowCount = lowPins.length;
        if (highCount > 0 && lowCount > 0) {
          warnings.push(`${bank.name} has ${highCount} high and ${lowCount} low outputs - verify no conflicts`);
        }
      }
    }

    // Check for input pins with output-level signals
    for (const [pin, config] of this.pins) {
      const state = this.states.get(pin);
      if (config.mode === 'input' && state) {
        const expectedVoltage = this.getVoltageValue(config.voltage);
        if (state.analogValue > expectedVoltage * 1.1) {
          shortCircuit = true;
          warnings.push(`Pin ${pin} input voltage (${state.analogValue}V) exceeds ${config.voltage} level`);
        }
      }
    }

    return {
      shortCircuit,
      overload,
      conflictingOutputs,
      warnings,
    };
  }

  getAllPinsStatus(): {
    pin: number;
    config: PinConfig;
    state: PinState;
    bank: string | null;
  }[] {
    const result: {
      pin: number;
      config: PinConfig;
      state: PinState;
      bank: string | null;
    }[] = [];

    for (const [pin, config] of this.pins) {
      const state = this.states.get(pin);
      if (state) {
        const bank = this.getBankForPin(pin);
        result.push({
          pin,
          config,
          state,
          bank: bank?.name || null,
        });
      }
    }

    return result.sort((a, b) => a.pin - b.pin);
  }

  getBanks(): GPIOBank[] {
    return [...this.banks];
  }

  reset(): void {
    this.pins.clear();
    this.states.clear();
    this.history.clear();
    this.interrupts = [];
    this.baseTime = Date.now();
  }
}

// ============================================================================
// GLOBAL SIMULATOR INSTANCE
// ============================================================================

const simulator = new GPIOSimulator();

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const gpiosimulatorTool: UnifiedTool = {
  name: 'gpio_simulator',
  description: `Comprehensive GPIO pin simulation system for embedded/IoT development.

Features:
- Pin configuration: input/output mode, pull-up/pull-down resistors
- Digital read/write operations with voltage level simulation
- Interrupt simulation (rising/falling/both edges) with debouncing
- PWM output capability with configurable frequency and duty cycle
- GPIO banks/ports organization with per-bank constraints
- Multi-pin operations (port-wide read/write)
- Timing analysis and history tracking
- Short circuit and overload detection

Operations: configure, read, write, toggle, set_interrupt, get_history, simulate_input, analyze_timing, read_port, write_port, get_pwm, set_pwm, check_safety, get_status, get_banks, reset`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'configure', 'read', 'write', 'toggle', 'set_interrupt', 'get_history',
          'simulate_input', 'simulate_sequence', 'analyze_timing', 'read_port',
          'write_port', 'get_pwm', 'set_pwm', 'check_safety', 'get_status',
          'get_interrupts', 'get_banks', 'reset', 'info', 'examples'
        ],
        description: 'Operation to perform'
      },
      pin: {
        type: 'number',
        description: 'GPIO pin number'
      },
      mode: {
        type: 'string',
        enum: ['input', 'output', 'pwm', 'analog_in', 'open_drain', 'open_source'],
        description: 'Pin mode'
      },
      pull: {
        type: 'string',
        enum: ['none', 'pull_up', 'pull_down'],
        description: 'Pull resistor configuration'
      },
      voltage: {
        type: 'string',
        enum: ['1.8V', '3.3V', '5V'],
        description: 'Logic voltage level'
      },
      value: {
        type: 'boolean',
        description: 'Digital value to write'
      },
      edge: {
        type: 'string',
        enum: ['rising', 'falling', 'both', 'none'],
        description: 'Interrupt edge type'
      },
      debounce_ms: {
        type: 'number',
        description: 'Debounce time in milliseconds'
      },
      frequency: {
        type: 'number',
        description: 'PWM frequency in Hz'
      },
      duty_cycle: {
        type: 'number',
        description: 'PWM duty cycle (0-100)'
      },
      start_pin: {
        type: 'number',
        description: 'Starting pin for port operations'
      },
      count: {
        type: 'number',
        description: 'Number of pins for port operations'
      },
      port_value: {
        type: 'number',
        description: 'Value to write to port (as integer)'
      },
      sequence: {
        type: 'array',
        items: { type: 'object' },
        description: 'Input sequence for simulation - array of {value: boolean, durationMs: number}'
      },
      limit: {
        type: 'number',
        description: 'Limit for history entries'
      },
      clear: {
        type: 'boolean',
        description: 'Clear interrupts after reading'
      }
    },
    required: ['operation']
  }
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executegpiosimulator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    switch (operation) {
      case 'configure': {
        const pin = args.pin ?? 0;
        const options: Partial<PinConfig> = {};

        if (args.mode) options.mode = args.mode;
        if (args.pull) options.pull = args.pull;
        if (args.voltage) options.voltage = args.voltage;
        if (args.debounce_ms !== undefined) options.debounceMs = args.debounce_ms;
        if (args.frequency !== undefined) options.pwmFrequency = args.frequency;
        if (args.duty_cycle !== undefined) options.pwmDutyCycle = args.duty_cycle;

        const result = simulator.configure(pin, options);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'configure',
            pin,
            result,
          }, null, 2)
        };
      }

      case 'read': {
        const pin = args.pin ?? 0;
        const result = simulator.read(pin);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'read',
            pin,
            result,
          }, null, 2)
        };
      }

      case 'write': {
        const pin = args.pin ?? 0;
        const value = args.value ?? false;
        const result = simulator.write(pin, value);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'write',
            pin,
            value,
            result,
          }, null, 2)
        };
      }

      case 'toggle': {
        const pin = args.pin ?? 0;
        const result = simulator.toggle(pin);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'toggle',
            pin,
            result,
          }, null, 2)
        };
      }

      case 'set_interrupt': {
        const pin = args.pin ?? 0;
        const edge = args.edge ?? 'none';
        const debounceMs = args.debounce_ms ?? 0;
        const result = simulator.setInterrupt(pin, edge, debounceMs);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'set_interrupt',
            pin,
            edge,
            debounceMs,
            result,
          }, null, 2)
        };
      }

      case 'get_history': {
        const pin = args.pin ?? 0;
        const limit = args.limit ?? 100;
        const result = simulator.getHistory(pin, limit);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_history',
            pin,
            limit,
            result,
          }, null, 2)
        };
      }

      case 'simulate_input': {
        const pin = args.pin ?? 0;
        const value = args.value ?? false;
        const result = simulator.simulateInput(pin, value);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'simulate_input',
            pin,
            value,
            result,
          }, null, 2)
        };
      }

      case 'simulate_sequence': {
        const pin = args.pin ?? 0;
        const sequence = args.sequence ?? [
          { value: true, durationMs: 100 },
          { value: false, durationMs: 100 },
          { value: true, durationMs: 100 },
        ];
        const result = simulator.simulateSequence(pin, sequence);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'simulate_sequence',
            pin,
            sequence,
            result,
          }, null, 2)
        };
      }

      case 'analyze_timing': {
        const pin = args.pin ?? 0;
        const limit = args.limit ?? 100;
        const result = simulator.getHistory(pin, limit);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze_timing',
            pin,
            timing: result.timing,
            totalChanges: result.totalChanges,
            samplesAnalyzed: result.entries.length,
          }, null, 2)
        };
      }

      case 'read_port': {
        const startPin = args.start_pin ?? 0;
        const count = args.count ?? 8;
        const result = simulator.readPort(startPin, count);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'read_port',
            startPin,
            count,
            result,
          }, null, 2)
        };
      }

      case 'write_port': {
        const startPin = args.start_pin ?? 0;
        const portValue = args.port_value ?? 0;
        const count = args.count ?? 8;
        const result = simulator.writePort(startPin, portValue, count);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'write_port',
            startPin,
            portValue,
            binaryValue: portValue.toString(2).padStart(count, '0'),
            count,
            result,
          }, null, 2)
        };
      }

      case 'get_pwm': {
        const pin = args.pin ?? 0;
        const result = simulator.getPWMState(pin);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_pwm',
            pin,
            pwm: result,
            error: result ? null : 'Pin not configured for PWM',
          }, null, 2)
        };
      }

      case 'set_pwm': {
        const pin = args.pin ?? 0;
        const frequency = args.frequency ?? 1000;
        const dutyCycle = args.duty_cycle ?? 50;
        const result = simulator.setPWM(pin, frequency, dutyCycle);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'set_pwm',
            pin,
            frequency,
            dutyCycle,
            result,
          }, null, 2)
        };
      }

      case 'check_safety': {
        const result = simulator.checkSafety();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'check_safety',
            result,
          }, null, 2)
        };
      }

      case 'get_status': {
        const pins = simulator.getAllPinsStatus();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_status',
            configuredPins: pins.length,
            pins,
          }, null, 2)
        };
      }

      case 'get_interrupts': {
        const clear = args.clear ?? false;
        const interrupts = simulator.getInterrupts(clear);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_interrupts',
            count: interrupts.length,
            cleared: clear,
            interrupts,
          }, null, 2)
        };
      }

      case 'get_banks': {
        const banks = simulator.getBanks();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_banks',
            banks,
          }, null, 2)
        };
      }

      case 'reset': {
        simulator.reset();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'reset',
            message: 'GPIO simulator reset to initial state',
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'GPIO Simulator',
            description: 'Comprehensive GPIO pin simulation for embedded/IoT development',
            features: {
              pinModes: ['input', 'output', 'pwm', 'analog_in', 'open_drain', 'open_source'],
              pullConfigs: ['none', 'pull_up', 'pull_down'],
              voltageLevels: ['1.8V', '3.3V', '5V'],
              interrupts: ['rising', 'falling', 'both', 'none'],
              pwm: 'Configurable frequency (1Hz-1MHz) and duty cycle (0-100%)',
              safety: 'Short circuit, overload, and conflict detection',
            },
            banks: simulator.getBanks(),
            operations: [
              { name: 'configure', desc: 'Set pin mode, pull resistor, voltage level' },
              { name: 'read', desc: 'Read digital/analog value from pin' },
              { name: 'write', desc: 'Write digital value to output pin' },
              { name: 'toggle', desc: 'Toggle output pin state' },
              { name: 'set_interrupt', desc: 'Configure interrupt edge and debounce' },
              { name: 'get_history', desc: 'Get pin state change history' },
              { name: 'simulate_input', desc: 'Simulate external input signal' },
              { name: 'simulate_sequence', desc: 'Simulate input signal sequence' },
              { name: 'analyze_timing', desc: 'Analyze pulse timing and frequency' },
              { name: 'read_port', desc: 'Read multiple pins as port' },
              { name: 'write_port', desc: 'Write to multiple pins as port' },
              { name: 'get_pwm', desc: 'Get PWM configuration' },
              { name: 'set_pwm', desc: 'Configure PWM frequency and duty cycle' },
              { name: 'check_safety', desc: 'Check for electrical safety issues' },
              { name: 'get_status', desc: 'Get all configured pins status' },
              { name: 'get_interrupts', desc: 'Get triggered interrupt events' },
              { name: 'get_banks', desc: 'Get GPIO bank configuration' },
              { name: 'reset', desc: 'Reset simulator to initial state' },
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
                name: 'Configure output pin',
                call: { operation: 'configure', pin: 0, mode: 'output', voltage: '3.3V' }
              },
              {
                name: 'Configure input with pull-up',
                call: { operation: 'configure', pin: 1, mode: 'input', pull: 'pull_up' }
              },
              {
                name: 'Configure PWM pin',
                call: { operation: 'configure', pin: 2, mode: 'pwm', frequency: 1000, duty_cycle: 50 }
              },
              {
                name: 'Write to output',
                call: { operation: 'write', pin: 0, value: true }
              },
              {
                name: 'Set up interrupt',
                call: { operation: 'set_interrupt', pin: 1, edge: 'rising', debounce_ms: 50 }
              },
              {
                name: 'Simulate button press',
                call: { operation: 'simulate_sequence', pin: 1, sequence: [
                  { value: false, durationMs: 10 },
                  { value: true, durationMs: 100 },
                  { value: false, durationMs: 10 }
                ]}
              },
              {
                name: 'Read 8-bit port',
                call: { operation: 'read_port', start_pin: 0, count: 8 }
              },
              {
                name: 'Write to port',
                call: { operation: 'write_port', start_pin: 0, port_value: 170, count: 8 }
              },
              {
                name: 'Check safety',
                call: { operation: 'check_safety' }
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

export function isgpiosimulatorAvailable(): boolean {
  return true;
}
