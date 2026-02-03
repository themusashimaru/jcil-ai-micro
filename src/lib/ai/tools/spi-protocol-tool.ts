/**
 * SPI-PROTOCOL TOOL
 * Full SPI bus protocol analyzer/simulator with multi-slave support,
 * timing analysis, and common device emulation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

/** SPI Mode based on CPOL (Clock Polarity) and CPHA (Clock Phase) */
type SPIMode = 0 | 1 | 2 | 3;

/** Bit order for data transmission */
type BitOrder = 'MSB' | 'LSB';

/** Word size options */
type WordSize = 8 | 16 | 32;

/** Chip Select active level */
type CSActiveLevel = 'low' | 'high';

/** Slave device types for emulation */
type SlaveDeviceType = 'generic' | 'flash' | 'adc' | 'dac' | 'display' | 'eeprom' | 'sensor';

interface SPIConfig {
  mode: SPIMode;
  clockFrequency: number; // Hz
  bitOrder: BitOrder;
  wordSize: WordSize;
  csActiveLevel: CSActiveLevel;
  dmaEnabled: boolean;
  daisyChainEnabled: boolean;
}

interface SPISlave {
  id: string;
  name: string;
  deviceType: SlaveDeviceType;
  csPin: number;
  csActiveLevel: CSActiveLevel;
  maxClockFrequency: number;
  supportedModes: SPIMode[];
  memory?: Uint8Array;
  registers?: Map<number, number>;
  selected: boolean;
}

interface SPISignal {
  time: number; // nanoseconds
  mosi: number | null;
  miso: number | null;
  clk: number;
  cs: Map<string, number>;
}

interface SPITransaction {
  id: string;
  timestamp: number;
  slaveId: string;
  mosiData: number[];
  misoData: number[];
  duration: number; // nanoseconds
  clockCycles: number;
  signals: SPISignal[];
}

interface SPITimingAnalysis {
  clockPeriod: number; // ns
  setupTime: number; // ns
  holdTime: number; // ns
  csSetupTime: number; // ns
  csHoldTime: number; // ns
  transferDuration: number; // ns
  effectiveBitrate: number; // bps
  efficiency: number; // percentage
}

interface FlashDevice {
  manufacturer: number;
  deviceId: number;
  capacity: number; // bytes
  pageSize: number;
  sectorSize: number;
  memory: Uint8Array;
  writeEnabled: boolean;
  statusRegister: number;
}

interface DMAConfig {
  sourceAddress: number;
  destAddress: number;
  transferSize: number;
  burstSize: number;
  circular: boolean;
}

// ============================================================================
// SPI MODE DEFINITIONS
// ============================================================================

const SPI_MODES: Record<SPIMode, { cpol: number; cpha: number; description: string }> = {
  0: { cpol: 0, cpha: 0, description: 'Clock idle LOW, data sampled on RISING edge' },
  1: { cpol: 0, cpha: 1, description: 'Clock idle LOW, data sampled on FALLING edge' },
  2: { cpol: 1, cpha: 0, description: 'Clock idle HIGH, data sampled on FALLING edge' },
  3: { cpol: 1, cpha: 1, description: 'Clock idle HIGH, data sampled on RISING edge' },
};

// ============================================================================
// SPI BUS SIMULATOR
// ============================================================================

class SPIBus {
  private config: SPIConfig;
  private slaves: Map<string, SPISlave> = new Map();
  private selectedSlave: string | null = null;
  private transactions: SPITransaction[] = [];
  private transactionCounter: number = 0;
  private flashDevices: Map<string, FlashDevice> = new Map();
  private collisionDetected: boolean = false;

  constructor(config?: Partial<SPIConfig>) {
    this.config = {
      mode: 0,
      clockFrequency: 1000000, // 1 MHz default
      bitOrder: 'MSB',
      wordSize: 8,
      csActiveLevel: 'low',
      dmaEnabled: false,
      daisyChainEnabled: false,
      ...config,
    };
  }

  configure(config: Partial<SPIConfig>): SPIConfig {
    this.config = { ...this.config, ...config };
    return this.config;
  }

  getConfig(): SPIConfig {
    return { ...this.config };
  }

  addSlave(slave: Omit<SPISlave, 'selected'>): SPISlave {
    const fullSlave: SPISlave = {
      ...slave,
      selected: false,
      memory: slave.memory || new Uint8Array(256),
      registers: slave.registers || new Map(),
    };
    this.slaves.set(slave.id, fullSlave);

    // Initialize flash device if applicable
    if (slave.deviceType === 'flash') {
      this.flashDevices.set(slave.id, this.createFlashDevice(1024 * 1024)); // 1MB default
    }

    return fullSlave;
  }

  removeSlave(slaveId: string): boolean {
    if (this.selectedSlave === slaveId) {
      this.selectedSlave = null;
    }
    this.flashDevices.delete(slaveId);
    return this.slaves.delete(slaveId);
  }

  selectSlave(slaveId: string): { success: boolean; slave?: SPISlave; error?: string } {
    // Check for bus collision (multiple slaves selected)
    if (this.selectedSlave && this.selectedSlave !== slaveId) {
      const currentSlave = this.slaves.get(this.selectedSlave);
      if (currentSlave?.selected) {
        this.collisionDetected = true;
        return {
          success: false,
          error: `Bus collision detected! Slave ${this.selectedSlave} already selected.`,
        };
      }
    }

    const slave = this.slaves.get(slaveId);
    if (!slave) {
      return { success: false, error: `Slave ${slaveId} not found` };
    }

    // Validate clock frequency
    if (this.config.clockFrequency > slave.maxClockFrequency) {
      return {
        success: false,
        error: `Clock frequency ${this.config.clockFrequency} Hz exceeds slave max ${slave.maxClockFrequency} Hz`,
      };
    }

    // Validate SPI mode
    if (!slave.supportedModes.includes(this.config.mode)) {
      return {
        success: false,
        error: `SPI mode ${this.config.mode} not supported by slave. Supported: ${slave.supportedModes.join(', ')}`,
      };
    }

    // Deselect previous slave
    if (this.selectedSlave) {
      const prev = this.slaves.get(this.selectedSlave);
      if (prev) prev.selected = false;
    }

    slave.selected = true;
    this.selectedSlave = slaveId;
    this.collisionDetected = false;

    return { success: true, slave };
  }

  deselectAll(): void {
    for (const slave of this.slaves.values()) {
      slave.selected = false;
    }
    this.selectedSlave = null;
  }

  /**
   * Perform full-duplex SPI transfer
   */
  transfer(mosiData: number[]): {
    misoData: number[];
    transaction: SPITransaction;
    timing: SPITimingAnalysis;
  } {
    if (!this.selectedSlave) {
      throw new Error('No slave selected');
    }

    const slave = this.slaves.get(this.selectedSlave)!;
    const signals: SPISignal[] = [];
    const misoData: number[] = [];
    const clockPeriod = 1e9 / this.config.clockFrequency; // ns
    let currentTime = 0;

    // Generate CS setup signal
    const csMap = new Map<string, number>();
    for (const [id, s] of this.slaves) {
      csMap.set(id, s.csActiveLevel === 'low' ? (s.selected ? 0 : 1) : s.selected ? 1 : 0);
    }

    // CS setup time
    signals.push({
      time: currentTime,
      mosi: null,
      miso: null,
      clk: SPI_MODES[this.config.mode].cpol,
      cs: new Map(csMap),
    });
    currentTime += 10; // 10ns CS setup

    // Process each byte/word
    for (const mosiByte of mosiData) {
      const misoByte = this.processSlaveByte(slave, mosiByte);
      misoData.push(misoByte);

      // Generate bit-level signals
      for (let bit = 0; bit < this.config.wordSize; bit++) {
        const bitIndex = this.config.bitOrder === 'MSB' ? this.config.wordSize - 1 - bit : bit;

        const mosiBit = (mosiByte >> bitIndex) & 1;
        const misoBit = (misoByte >> bitIndex) & 1;

        // Clock edge 1
        signals.push({
          time: currentTime,
          mosi: mosiBit,
          miso: misoBit,
          clk: SPI_MODES[this.config.mode].cpol,
          cs: new Map(csMap),
        });
        currentTime += clockPeriod / 2;

        // Clock edge 2
        signals.push({
          time: currentTime,
          mosi: mosiBit,
          miso: misoBit,
          clk: 1 - SPI_MODES[this.config.mode].cpol,
          cs: new Map(csMap),
        });
        currentTime += clockPeriod / 2;
      }
    }

    // CS hold time
    currentTime += 10; // 10ns CS hold
    signals.push({
      time: currentTime,
      mosi: null,
      miso: null,
      clk: SPI_MODES[this.config.mode].cpol,
      cs: new Map(csMap),
    });

    const transaction: SPITransaction = {
      id: `txn_${++this.transactionCounter}`,
      timestamp: Date.now(),
      slaveId: this.selectedSlave,
      mosiData,
      misoData,
      duration: currentTime,
      clockCycles: mosiData.length * this.config.wordSize,
      signals,
    };

    this.transactions.push(transaction);

    const timing = this.analyzeTiming(transaction);

    return { misoData, transaction, timing };
  }

  /**
   * DMA transfer simulation
   */
  dmaTransfer(config: DMAConfig): {
    bytesTransferred: number;
    cycles: number;
    duration: number;
    efficiency: number;
  } {
    const bytesTransferred = config.transferSize;
    const cycles = Math.ceil(bytesTransferred / config.burstSize) * config.burstSize;
    const clockPeriod = 1e9 / this.config.clockFrequency;
    const duration = cycles * this.config.wordSize * clockPeriod;
    const theoreticalDuration = bytesTransferred * this.config.wordSize * clockPeriod;
    const efficiency = (theoreticalDuration / duration) * 100;

    return {
      bytesTransferred,
      cycles,
      duration,
      efficiency,
    };
  }

  /**
   * Process byte through slave device
   */
  private processSlaveByte(slave: SPISlave, mosiByte: number): number {
    switch (slave.deviceType) {
      case 'flash':
        return this.processFlashCommand(slave.id, mosiByte);
      case 'adc':
        return this.processADC(slave, mosiByte);
      case 'dac':
        return this.processDAC(slave, mosiByte);
      case 'display':
        return this.processDisplay(slave, mosiByte);
      case 'sensor':
        return this.processSensor(slave, mosiByte);
      default:
        // Generic slave: echo with transformation
        return mosiByte ^ 0xff;
    }
  }

  /**
   * Create flash device emulation
   */
  private createFlashDevice(capacity: number): FlashDevice {
    return {
      manufacturer: 0xef, // Winbond
      deviceId: 0x4017, // W25Q64
      capacity,
      pageSize: 256,
      sectorSize: 4096,
      memory: new Uint8Array(capacity),
      writeEnabled: false,
      statusRegister: 0x00,
    };
  }

  // Flash command state machine
  private flashCommandState: Map<
    string,
    {
      state: 'idle' | 'read' | 'write' | 'erase';
      address: number;
      bytesRemaining: number;
    }
  > = new Map();

  private processFlashCommand(slaveId: string, command: number): number {
    const flash = this.flashDevices.get(slaveId);
    if (!flash) return 0xff;

    let state = this.flashCommandState.get(slaveId);
    if (!state) {
      state = { state: 'idle', address: 0, bytesRemaining: 0 };
      this.flashCommandState.set(slaveId, state);
    }

    // Process based on current state
    if (state.state === 'read' && state.bytesRemaining > 0) {
      const data = flash.memory[state.address % flash.capacity];
      state.address++;
      state.bytesRemaining--;
      return data;
    }

    if (state.state === 'write' && state.bytesRemaining > 0) {
      if (flash.writeEnabled) {
        flash.memory[state.address % flash.capacity] = command;
      }
      state.address++;
      state.bytesRemaining--;
      return 0x00;
    }

    // Process new commands
    switch (command) {
      case 0x9f: // JEDEC ID
        return flash.manufacturer;
      case 0x06: // Write Enable
        flash.writeEnabled = true;
        flash.statusRegister |= 0x02;
        return 0x00;
      case 0x04: // Write Disable
        flash.writeEnabled = false;
        flash.statusRegister &= ~0x02;
        return 0x00;
      case 0x05: // Read Status Register
        return flash.statusRegister;
      case 0x03: // Read Data
        state.state = 'read';
        state.bytesRemaining = 256; // Read up to 256 bytes
        return 0x00;
      case 0x02: // Page Program
        if (flash.writeEnabled) {
          state.state = 'write';
          state.bytesRemaining = flash.pageSize;
        }
        return 0x00;
      case 0x20: // Sector Erase
        if (flash.writeEnabled) {
          const sectorStart = state.address & ~(flash.sectorSize - 1);
          for (let i = 0; i < flash.sectorSize; i++) {
            flash.memory[sectorStart + i] = 0xff;
          }
        }
        return 0x00;
      default:
        // Address bytes
        state.address = (state.address << 8) | command;
        return 0x00;
    }
  }

  /**
   * ADC emulation - returns simulated analog readings
   */
  private processADC(_slave: SPISlave, command: number): number {
    const channel = (command >> 4) & 0x07;
    // Simulate ADC reading with some variation
    const baseValue = 2048 + Math.floor(Math.sin(Date.now() / 1000 + channel) * 1000);
    const noise = Math.floor(Math.random() * 20) - 10;
    const value = Math.max(0, Math.min(4095, baseValue + noise));

    // Return as 12-bit ADC value
    if ((command & 0x01) === 0) {
      return (value >> 8) & 0x0f; // High byte
    } else {
      return value & 0xff; // Low byte
    }
  }

  /**
   * DAC emulation - accepts digital values for analog output
   */
  private processDAC(slave: SPISlave, command: number): number {
    // Store DAC value in slave registers
    const channel = (command >> 4) & 0x03;
    const value = command & 0x0f;
    slave.registers?.set(channel, ((slave.registers?.get(channel) || 0) << 4) | value);
    return 0x00; // DAC doesn't send data back
  }

  /**
   * Display controller emulation
   */
  private processDisplay(slave: SPISlave, command: number): number {
    // Common display commands: 0x01=Clear, 0x2A=ColAddr, 0x2B=RowAddr, 0x2C=MemWrite,
    // 0x36=MemAccess, 0x3A=PixelFormat, 0x11=SleepOut, 0x29=DisplayON

    // Store command in registers
    slave.registers?.set(0xff, command);

    // Display doesn't typically send meaningful data back
    return 0x00;
  }

  /**
   * Generic sensor emulation
   */
  private processSensor(_slave: SPISlave, command: number): number {
    // Simulate sensor registers
    const registerMap: Record<number, number> = {
      0x00: 0x68, // WHO_AM_I
      0x01: 0x00, // Status
      0x02: Math.floor(Math.random() * 256), // Temp high
      0x03: Math.floor(Math.random() * 256), // Temp low
      0x04: Math.floor(Math.random() * 256), // Accel X
      0x05: Math.floor(Math.random() * 256), // Accel Y
      0x06: Math.floor(Math.random() * 256), // Accel Z
    };

    // If read bit is set (0x80), return register value
    if (command & 0x80) {
      const reg = command & 0x7f;
      return registerMap[reg] ?? 0x00;
    }

    return 0x00;
  }

  /**
   * Analyze timing of a transaction
   */
  analyzeTiming(transaction: SPITransaction): SPITimingAnalysis {
    const clockPeriod = 1e9 / this.config.clockFrequency;
    const bitsTransferred = transaction.mosiData.length * this.config.wordSize;
    const theoreticalDuration = bitsTransferred * clockPeriod;

    return {
      clockPeriod,
      setupTime: clockPeriod * 0.25, // 25% of clock period
      holdTime: clockPeriod * 0.25,
      csSetupTime: 10, // 10ns
      csHoldTime: 10,
      transferDuration: transaction.duration,
      effectiveBitrate: (bitsTransferred * 1e9) / transaction.duration,
      efficiency: (theoreticalDuration / transaction.duration) * 100,
    };
  }

  /**
   * Generate signal visualization
   */
  visualizeSignals(transaction: SPITransaction, maxBits: number = 16): string[] {
    const lines: string[] = [];
    const signals = transaction.signals.slice(0, maxBits * 2 + 2);

    // Clock line
    let clkLine = 'CLK:  ';
    let mosiLine = 'MOSI: ';
    let misoLine = 'MISO: ';
    let csLine = 'CS:   ';

    for (let i = 0; i < signals.length; i++) {
      const sig = signals[i];
      clkLine += sig.clk ? '_' : '-';
      mosiLine += sig.mosi !== null ? (sig.mosi ? '1' : '0') : '-';
      misoLine += sig.miso !== null ? (sig.miso ? '1' : '0') : '-';

      const csVal = sig.cs.get(transaction.slaveId);
      csLine += csVal !== undefined ? (csVal ? '_' : '-') : '?';
    }

    lines.push(clkLine);
    lines.push(mosiLine);
    lines.push(misoLine);
    lines.push(csLine);

    return lines;
  }

  /**
   * Daisy chain transfer
   */
  daisyChainTransfer(data: number[]): {
    outputs: Map<string, number[]>;
    timing: SPITimingAnalysis;
  } {
    if (!this.config.daisyChainEnabled) {
      throw new Error('Daisy chain mode not enabled');
    }

    const slaveIds = Array.from(this.slaves.keys());
    const outputs = new Map<string, number[]>();
    let currentData = data;

    for (const slaveId of slaveIds) {
      const slave = this.slaves.get(slaveId)!;
      slave.selected = true;

      const slaveOutput: number[] = [];
      for (const byte of currentData) {
        slaveOutput.push(this.processSlaveByte(slave, byte));
      }

      outputs.set(slaveId, slaveOutput);
      currentData = slaveOutput; // Pass to next slave in chain
      slave.selected = false;
    }

    const timing: SPITimingAnalysis = {
      clockPeriod: 1e9 / this.config.clockFrequency,
      setupTime: 10,
      holdTime: 10,
      csSetupTime: 10,
      csHoldTime: 10,
      transferDuration:
        data.length * this.config.wordSize * (1e9 / this.config.clockFrequency) * slaveIds.length,
      effectiveBitrate: this.config.clockFrequency,
      efficiency: 100 / slaveIds.length,
    };

    return { outputs, timing };
  }

  getSlaves(): SPISlave[] {
    return Array.from(this.slaves.values());
  }

  getTransactions(): SPITransaction[] {
    return [...this.transactions];
  }

  hasCollision(): boolean {
    return this.collisionDetected;
  }

  clearCollision(): void {
    this.collisionDetected = false;
  }

  /**
   * Read from flash device
   */
  readFlash(slaveId: string, address: number, length: number): number[] {
    const flash = this.flashDevices.get(slaveId);
    if (!flash) {
      throw new Error(`Flash device not found: ${slaveId}`);
    }

    const data: number[] = [];
    for (let i = 0; i < length; i++) {
      data.push(flash.memory[(address + i) % flash.capacity]);
    }
    return data;
  }

  /**
   * Write to flash device
   */
  writeFlash(
    slaveId: string,
    address: number,
    data: number[]
  ): { success: boolean; bytesWritten: number } {
    const flash = this.flashDevices.get(slaveId);
    if (!flash) {
      throw new Error(`Flash device not found: ${slaveId}`);
    }

    if (!flash.writeEnabled) {
      return { success: false, bytesWritten: 0 };
    }

    for (let i = 0; i < data.length; i++) {
      flash.memory[(address + i) % flash.capacity] = data[i];
    }

    return { success: true, bytesWritten: data.length };
  }
}

// ============================================================================
// GLOBAL BUS INSTANCE
// ============================================================================

let spiBus: SPIBus | null = null;

function getBus(): SPIBus {
  if (!spiBus) {
    spiBus = new SPIBus();
  }
  return spiBus;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const spiprotocolTool: UnifiedTool = {
  name: 'spi_protocol',
  description:
    'Full SPI bus protocol analyzer/simulator with multi-slave support, timing analysis, DMA, and device emulation',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'configure',
          'transfer',
          'add_slave',
          'select_slave',
          'analyze_timing',
          'emulate_device',
          'read_flash',
          'write_flash',
          'display_command',
          'dma_transfer',
          'daisy_chain',
          'visualize',
          'get_status',
          'info',
          'examples',
        ],
        description: 'Operation to perform',
      },
      mode: {
        type: 'number',
        enum: ['0', '1', '2', '3'],
        description: 'SPI mode (0-3) based on CPOL/CPHA',
      },
      clockFrequency: {
        type: 'number',
        description: 'Clock frequency in Hz (e.g., 1000000 for 1MHz)',
      },
      bitOrder: {
        type: 'string',
        enum: ['MSB', 'LSB'],
        description: 'Bit order (MSB or LSB first)',
      },
      wordSize: {
        type: 'number',
        enum: ['8', '16', '32'],
        description: 'Word size in bits',
      },
      csActiveLevel: {
        type: 'string',
        enum: ['low', 'high'],
        description: 'Chip select active level',
      },
      dmaEnabled: {
        type: 'boolean',
        description: 'Enable DMA transfers',
      },
      daisyChainEnabled: {
        type: 'boolean',
        description: 'Enable daisy chain mode',
      },
      slaveId: {
        type: 'string',
        description: 'Slave device identifier',
      },
      slaveName: {
        type: 'string',
        description: 'Slave device name',
      },
      deviceType: {
        type: 'string',
        enum: ['generic', 'flash', 'adc', 'dac', 'display', 'eeprom', 'sensor'],
        description: 'Type of slave device to emulate',
      },
      csPin: {
        type: 'number',
        description: 'Chip select pin number',
      },
      maxClockFrequency: {
        type: 'number',
        description: 'Maximum clock frequency supported by slave',
      },
      supportedModes: {
        type: 'array',
        items: { type: 'number' },
        description: 'SPI modes supported by slave',
      },
      data: {
        type: 'array',
        items: { type: 'number' },
        description: 'Data bytes to transfer',
      },
      address: {
        type: 'number',
        description: 'Memory address for flash operations',
      },
      length: {
        type: 'number',
        description: 'Number of bytes to read/write',
      },
      command: {
        type: 'number',
        description: 'Command byte for device',
      },
      dmaConfig: {
        type: 'object',
        description: 'DMA configuration object',
      },
    },
    required: ['operation'],
  },
};

export async function executespiprotocol(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;
    const bus = getBus();

    switch (operation) {
      case 'configure': {
        const config = bus.configure({
          mode: args.mode,
          clockFrequency: args.clockFrequency,
          bitOrder: args.bitOrder,
          wordSize: args.wordSize,
          csActiveLevel: args.csActiveLevel,
          dmaEnabled: args.dmaEnabled,
          daisyChainEnabled: args.daisyChainEnabled,
        });

        const modeInfo = SPI_MODES[config.mode];

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'configure',
              config,
              modeDetails: {
                mode: config.mode,
                cpol: modeInfo.cpol,
                cpha: modeInfo.cpha,
                description: modeInfo.description,
              },
              timing: {
                clockPeriodNs: (1e9 / config.clockFrequency).toFixed(2),
                maxBitrateMbps: (config.clockFrequency / 1e6).toFixed(2),
                bitsPerWord: config.wordSize,
              },
            },
            null,
            2
          ),
        };
      }

      case 'add_slave': {
        const slave = bus.addSlave({
          id: args.slaveId || `slave_${Date.now()}`,
          name: args.slaveName || 'Generic Slave',
          deviceType: args.deviceType || 'generic',
          csPin: args.csPin ?? 0,
          csActiveLevel: args.csActiveLevel || 'low',
          maxClockFrequency: args.maxClockFrequency || 10000000,
          supportedModes: args.supportedModes || [0, 1, 2, 3],
        });

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'add_slave',
              slave: {
                id: slave.id,
                name: slave.name,
                deviceType: slave.deviceType,
                csPin: slave.csPin,
                csActiveLevel: slave.csActiveLevel,
                maxClockFrequency: slave.maxClockFrequency,
                supportedModes: slave.supportedModes,
              },
              totalSlaves: bus.getSlaves().length,
            },
            null,
            2
          ),
        };
      }

      case 'select_slave': {
        const result = bus.selectSlave(args.slaveId);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'select_slave',
              slaveId: args.slaveId,
              success: result.success,
              error: result.error,
              selectedSlave: result.slave
                ? {
                    id: result.slave.id,
                    name: result.slave.name,
                    deviceType: result.slave.deviceType,
                  }
                : null,
            },
            null,
            2
          ),
          isError: !result.success,
        };
      }

      case 'transfer': {
        const data = args.data || [0x9f, 0x00, 0x00]; // Default: JEDEC ID read

        try {
          const result = bus.transfer(data);

          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                operation: 'transfer',
                transactionId: result.transaction.id,
                mosiData: result.transaction.mosiData.map(
                  (b: number) => `0x${b.toString(16).padStart(2, '0')}`
                ),
                misoData: result.misoData.map(
                  (b: number) => `0x${b.toString(16).padStart(2, '0')}`
                ),
                timing: {
                  durationNs: result.timing.transferDuration.toFixed(2),
                  clockCycles: result.transaction.clockCycles,
                  effectiveBitrateMbps: (result.timing.effectiveBitrate / 1e6).toFixed(2),
                  efficiency: `${result.timing.efficiency.toFixed(1)}%`,
                },
                signalVisualization: bus.visualizeSignals(result.transaction),
              },
              null,
              2
            ),
          };
        } catch (e) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                operation: 'transfer',
                error: e instanceof Error ? e.message : 'Transfer failed',
              },
              null,
              2
            ),
            isError: true,
          };
        }
      }

      case 'analyze_timing': {
        const transactions = bus.getTransactions();
        if (transactions.length === 0) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                operation: 'analyze_timing',
                error: 'No transactions to analyze',
              },
              null,
              2
            ),
            isError: true,
          };
        }

        const lastTransaction = transactions[transactions.length - 1];
        const timing = bus.analyzeTiming(lastTransaction);
        const config = bus.getConfig();

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'analyze_timing',
              transactionId: lastTransaction.id,
              timing: {
                clockPeriodNs: timing.clockPeriod.toFixed(2),
                setupTimeNs: timing.setupTime.toFixed(2),
                holdTimeNs: timing.holdTime.toFixed(2),
                csSetupTimeNs: timing.csSetupTime,
                csHoldTimeNs: timing.csHoldTime,
                totalDurationNs: timing.transferDuration.toFixed(2),
                effectiveBitrateMbps: (timing.effectiveBitrate / 1e6).toFixed(2),
                efficiency: `${timing.efficiency.toFixed(1)}%`,
              },
              recommendations: [
                timing.efficiency < 90 ? 'Consider reducing CS setup/hold times' : null,
                config.clockFrequency < 1e6
                  ? 'Clock frequency could be increased for faster transfers'
                  : null,
                config.wordSize === 8 && lastTransaction.mosiData.length > 4
                  ? 'Consider using 16 or 32-bit word size for bulk transfers'
                  : null,
              ].filter(Boolean),
            },
            null,
            2
          ),
        };
      }

      case 'emulate_device': {
        const deviceType = args.deviceType || 'flash';
        const slaveId = args.slaveId || `${deviceType}_${Date.now()}`;

        // Pre-configured device profiles
        const deviceProfiles: Record<string, Partial<SPISlave>> = {
          flash: {
            name: 'W25Q64 Flash',
            maxClockFrequency: 104000000,
            supportedModes: [0, 3],
          },
          adc: {
            name: 'MCP3008 ADC',
            maxClockFrequency: 3600000,
            supportedModes: [0, 3],
          },
          dac: {
            name: 'MCP4921 DAC',
            maxClockFrequency: 20000000,
            supportedModes: [0, 3],
          },
          display: {
            name: 'ILI9341 Display',
            maxClockFrequency: 10000000,
            supportedModes: [0],
          },
          sensor: {
            name: 'MPU6500 IMU',
            maxClockFrequency: 20000000,
            supportedModes: [0, 3],
          },
        };

        const profile = deviceProfiles[deviceType] || {
          name: 'Generic Device',
          maxClockFrequency: 10000000,
          supportedModes: [0, 1, 2, 3],
        };

        const slave = bus.addSlave({
          id: slaveId,
          name: profile.name!,
          deviceType: deviceType as SlaveDeviceType,
          csPin: args.csPin ?? bus.getSlaves().length,
          csActiveLevel: args.csActiveLevel || 'low',
          maxClockFrequency: profile.maxClockFrequency!,
          supportedModes: profile.supportedModes as SPIMode[],
        });

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'emulate_device',
              device: {
                id: slave.id,
                name: slave.name,
                type: slave.deviceType,
                csPin: slave.csPin,
                maxClockMHz: slave.maxClockFrequency / 1e6,
                supportedModes: slave.supportedModes,
              },
              capabilities:
                deviceType === 'flash'
                  ? {
                      commands: [
                        'Read (0x03)',
                        'Write Enable (0x06)',
                        'Page Program (0x02)',
                        'Sector Erase (0x20)',
                        'JEDEC ID (0x9F)',
                      ],
                      capacity: '1MB',
                      pageSize: 256,
                      sectorSize: 4096,
                    }
                  : deviceType === 'adc'
                    ? {
                        channels: 8,
                        resolution: '12-bit',
                        sampleRate: '200ksps',
                      }
                    : deviceType === 'dac'
                      ? {
                          channels: 1,
                          resolution: '12-bit',
                          outputRange: '0-VREF',
                        }
                      : deviceType === 'display'
                        ? {
                            resolution: '320x240',
                            colorDepth: '16-bit RGB565',
                            commands: [
                              'Clear (0x01)',
                              'Column Set (0x2A)',
                              'Row Set (0x2B)',
                              'Memory Write (0x2C)',
                            ],
                          }
                        : {
                            type: 'Generic register-based device',
                          },
            },
            null,
            2
          ),
        };
      }

      case 'read_flash': {
        const slaveId = args.slaveId;
        const address = args.address ?? 0;
        const length = args.length ?? 16;

        if (!slaveId) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                operation: 'read_flash',
                error: 'slaveId is required',
              },
              null,
              2
            ),
            isError: true,
          };
        }

        try {
          const data = bus.readFlash(slaveId, address, length);

          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                operation: 'read_flash',
                slaveId,
                address: `0x${address.toString(16).padStart(6, '0')}`,
                length,
                data: data.map((b: number) => `0x${b.toString(16).padStart(2, '0')}`),
                hexDump: formatHexDump(data, address),
              },
              null,
              2
            ),
          };
        } catch (e) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                operation: 'read_flash',
                error: e instanceof Error ? e.message : 'Read failed',
              },
              null,
              2
            ),
            isError: true,
          };
        }
      }

      case 'write_flash': {
        const slaveId = args.slaveId;
        const address = args.address ?? 0;
        const data = args.data || [0x48, 0x65, 0x6c, 0x6c, 0x6f]; // "Hello"

        if (!slaveId) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                operation: 'write_flash',
                error: 'slaveId is required',
              },
              null,
              2
            ),
            isError: true,
          };
        }

        try {
          // Need to enable write first
          const selectResult = bus.selectSlave(slaveId);
          if (!selectResult.success) {
            throw new Error(selectResult.error);
          }

          // Send write enable command
          bus.transfer([0x06]);

          const result = bus.writeFlash(slaveId, address, data);

          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                operation: 'write_flash',
                slaveId,
                address: `0x${address.toString(16).padStart(6, '0')}`,
                bytesWritten: result.bytesWritten,
                success: result.success,
                data: data.map((b: number) => `0x${b.toString(16).padStart(2, '0')}`),
              },
              null,
              2
            ),
          };
        } catch (e) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                operation: 'write_flash',
                error: e instanceof Error ? e.message : 'Write failed',
              },
              null,
              2
            ),
            isError: true,
          };
        }
      }

      case 'display_command': {
        const command = args.command ?? 0x29; // Display ON
        const slaveId = args.slaveId;

        if (!slaveId) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                operation: 'display_command',
                error: 'slaveId is required',
              },
              null,
              2
            ),
            isError: true,
          };
        }

        const displayCommands: Record<number, { name: string; description: string }> = {
          0x01: { name: 'SWRESET', description: 'Software Reset' },
          0x11: { name: 'SLPOUT', description: 'Sleep Out' },
          0x29: { name: 'DISPON', description: 'Display ON' },
          0x28: { name: 'DISPOFF', description: 'Display OFF' },
          0x2a: { name: 'CASET', description: 'Column Address Set' },
          0x2b: { name: 'RASET', description: 'Row Address Set' },
          0x2c: { name: 'RAMWR', description: 'Memory Write' },
          0x36: { name: 'MADCTL', description: 'Memory Access Control' },
          0x3a: { name: 'COLMOD', description: 'Pixel Format Set' },
        };

        try {
          const selectResult = bus.selectSlave(slaveId);
          if (!selectResult.success) {
            throw new Error(selectResult.error);
          }

          bus.transfer([command]);
          const cmdInfo = displayCommands[command] || {
            name: 'Unknown',
            description: 'Custom command',
          };

          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                operation: 'display_command',
                slaveId,
                command: `0x${command.toString(16).padStart(2, '0')}`,
                commandName: cmdInfo.name,
                description: cmdInfo.description,
                sent: true,
              },
              null,
              2
            ),
          };
        } catch (e) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                operation: 'display_command',
                error: e instanceof Error ? e.message : 'Command failed',
              },
              null,
              2
            ),
            isError: true,
          };
        }
      }

      case 'dma_transfer': {
        const dmaConfig: DMAConfig = args.dmaConfig || {
          sourceAddress: 0x20000000,
          destAddress: 0x40013000,
          transferSize: 256,
          burstSize: 4,
          circular: false,
        };

        const result = bus.dmaTransfer(dmaConfig);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'dma_transfer',
              config: {
                source: `0x${dmaConfig.sourceAddress.toString(16)}`,
                destination: `0x${dmaConfig.destAddress.toString(16)}`,
                size: dmaConfig.transferSize,
                burstSize: dmaConfig.burstSize,
                circular: dmaConfig.circular,
              },
              result: {
                bytesTransferred: result.bytesTransferred,
                clockCycles: result.cycles,
                durationNs: result.duration.toFixed(2),
                efficiency: `${result.efficiency.toFixed(1)}%`,
              },
              advantages: [
                'CPU free during transfer',
                'Continuous data streaming',
                'Reduced interrupt overhead',
                dmaConfig.circular ? 'Circular buffer enables continuous sampling' : null,
              ].filter(Boolean),
            },
            null,
            2
          ),
        };
      }

      case 'daisy_chain': {
        const data = args.data || [0xaa, 0xbb, 0xcc];
        const config = bus.getConfig();

        if (!config.daisyChainEnabled) {
          bus.configure({ daisyChainEnabled: true });
        }

        if (bus.getSlaves().length < 2) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                operation: 'daisy_chain',
                error: 'Daisy chain requires at least 2 slaves',
              },
              null,
              2
            ),
            isError: true,
          };
        }

        const result = bus.daisyChainTransfer(data);
        const outputs: Record<string, string[]> = {};
        for (const [slaveId, outData] of result.outputs) {
          outputs[slaveId] = outData.map((b: number) => `0x${b.toString(16).padStart(2, '0')}`);
        }

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'daisy_chain',
              inputData: data.map((b: number) => `0x${b.toString(16).padStart(2, '0')}`),
              slaveOutputs: outputs,
              timing: {
                totalDurationNs: result.timing.transferDuration.toFixed(2),
                efficiency: `${result.timing.efficiency.toFixed(1)}%`,
              },
              topology: bus
                .getSlaves()
                .map((s) => s.name)
                .join(' -> '),
            },
            null,
            2
          ),
        };
      }

      case 'visualize': {
        const transactions = bus.getTransactions();
        if (transactions.length === 0) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                operation: 'visualize',
                error: 'No transactions to visualize',
              },
              null,
              2
            ),
            isError: true,
          };
        }

        const lastTransaction = transactions[transactions.length - 1];
        const visualization = bus.visualizeSignals(lastTransaction);
        const config = bus.getConfig();

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'visualize',
              transactionId: lastTransaction.id,
              config: {
                mode: config.mode,
                clockFrequency: `${config.clockFrequency / 1e6} MHz`,
                bitOrder: config.bitOrder,
              },
              signals: visualization,
              legend: {
                CLK: 'Clock signal (-=low, _=high)',
                MOSI: 'Master Out Slave In (0/1/-)',
                MISO: 'Master In Slave Out (0/1/-)',
                CS: 'Chip Select (-=active low, _=inactive)',
              },
            },
            null,
            2
          ),
        };
      }

      case 'get_status': {
        const config = bus.getConfig();
        const slaves = bus.getSlaves();
        const transactions = bus.getTransactions();

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'get_status',
              busConfig: {
                mode: config.mode,
                modeDescription: SPI_MODES[config.mode].description,
                clockFrequency: `${config.clockFrequency / 1e6} MHz`,
                bitOrder: config.bitOrder,
                wordSize: config.wordSize,
                csActiveLevel: config.csActiveLevel,
                dmaEnabled: config.dmaEnabled,
                daisyChainEnabled: config.daisyChainEnabled,
              },
              slaves: slaves.map((s) => ({
                id: s.id,
                name: s.name,
                type: s.deviceType,
                selected: s.selected,
                csPin: s.csPin,
              })),
              statistics: {
                totalSlaves: slaves.length,
                totalTransactions: transactions.length,
                busCollisionDetected: bus.hasCollision(),
              },
            },
            null,
            2
          ),
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              tool: 'SPI Protocol Analyzer/Simulator',
              description: 'Full-featured SPI bus protocol tool for embedded/IoT development',
              features: {
                communication: [
                  'Full-duplex transfers',
                  'All 4 SPI modes (CPOL/CPHA combinations)',
                  'Configurable clock frequency',
                  'MSB/LSB first bit ordering',
                  '8/16/32-bit word sizes',
                ],
                busManagement: [
                  'Multi-slave topology',
                  'Chip select management',
                  'Bus collision detection',
                  'Daisy chain configuration',
                ],
                deviceEmulation: [
                  'Flash memory (W25Q series)',
                  'ADC (MCP3008)',
                  'DAC (MCP4921)',
                  'Display (ILI9341)',
                  'IMU sensors (MPU6500)',
                ],
                analysis: [
                  'Transaction timing analysis',
                  'Signal visualization',
                  'Efficiency metrics',
                  'DMA transfer simulation',
                ],
              },
              spiModes: Object.entries(SPI_MODES).map(([mode, info]) => ({
                mode: parseInt(mode),
                cpol: info.cpol,
                cpha: info.cpha,
                description: info.description,
              })),
              typicalApplications: [
                'Flash memory programming',
                'Sensor interfacing',
                'Display controllers',
                'ADC/DAC data acquisition',
                'Inter-processor communication',
              ],
            },
            null,
            2
          ),
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              examples: [
                {
                  name: 'Configure SPI bus',
                  call: {
                    operation: 'configure',
                    mode: 0,
                    clockFrequency: 1000000,
                    bitOrder: 'MSB',
                    wordSize: 8,
                  },
                },
                {
                  name: 'Add flash slave device',
                  call: { operation: 'emulate_device', deviceType: 'flash', slaveId: 'flash0' },
                },
                {
                  name: 'Select slave',
                  call: { operation: 'select_slave', slaveId: 'flash0' },
                },
                {
                  name: 'Read JEDEC ID',
                  call: { operation: 'transfer', data: [0x9f, 0x00, 0x00, 0x00] },
                },
                {
                  name: 'Write to flash',
                  call: {
                    operation: 'write_flash',
                    slaveId: 'flash0',
                    address: 0,
                    data: [0x48, 0x65, 0x6c, 0x6c, 0x6f],
                  },
                },
                {
                  name: 'Read from flash',
                  call: { operation: 'read_flash', slaveId: 'flash0', address: 0, length: 16 },
                },
                {
                  name: 'Analyze timing',
                  call: { operation: 'analyze_timing' },
                },
                {
                  name: 'DMA transfer',
                  call: {
                    operation: 'dma_transfer',
                    dmaConfig: {
                      sourceAddress: 0x20000000,
                      destAddress: 0x40013000,
                      transferSize: 256,
                      burstSize: 4,
                      circular: false,
                    },
                  },
                },
              ],
            },
            null,
            2
          ),
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use 'info' for available operations.`,
          isError: true,
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

/**
 * Format hex dump of data
 */
function formatHexDump(data: number[], baseAddress: number): string[] {
  const lines: string[] = [];
  for (let i = 0; i < data.length; i += 16) {
    const addr = (baseAddress + i).toString(16).padStart(6, '0');
    const hex = data
      .slice(i, i + 16)
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join(' ');
    const ascii = data
      .slice(i, i + 16)
      .map((b: number) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.'))
      .join('');
    lines.push(`${addr}: ${hex.padEnd(48)} |${ascii}|`);
  }
  return lines;
}

export function isspiprotocolAvailable(): boolean {
  return true;
}
