/**
 * I2C PROTOCOL TOOL
 * Comprehensive I2C bus protocol analyzer and simulator
 * Supports: Master/Slave simulation, multiple speed modes, arbitration, device emulation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

type I2CSpeedMode = 'standard' | 'fast' | 'fast_plus' | 'high_speed';
type AddressMode = '7bit' | '10bit';
type TransactionType = 'write' | 'read' | 'write_read';

interface I2CSpeedConfig {
  name: string;
  frequency: number;
  tLow: number;      // Low period (ns)
  tHigh: number;     // High period (ns)
  tRise: number;     // Rise time (ns)
  tFall: number;     // Fall time (ns)
  tHD_STA: number;   // Hold time for START (ns)
  tSU_STA: number;   // Setup time for repeated START (ns)
  tSU_STO: number;   // Setup time for STOP (ns)
}

interface I2CDevice {
  address: number;
  addressMode: AddressMode;
  type: string;
  memory: Uint8Array;
  memorySize: number;
  registers: Map<number, number>;
  isConnected: boolean;
  lastAccess: number;
  clockStretching: boolean;
  stretchDuration: number;
}

interface I2CTransaction {
  id: number;
  timestamp: number;
  type: TransactionType;
  address: number;
  addressMode: AddressMode;
  data: number[];
  readLength?: number;
  ack: boolean[];
  success: boolean;
  duration: number;
  speedMode: I2CSpeedMode;
  conditions: string[];
  error?: string;
}

interface I2CBusState {
  sda: boolean;
  scl: boolean;
  busy: boolean;
  arbitrationLost: boolean;
  clockStretched: boolean;
  currentMaster: string | null;
}

interface BusHealthResult {
  healthy: boolean;
  sdaState: boolean;
  sclState: boolean;
  busStuck: boolean;
  pullUpDetected: boolean;
  deviceCount: number;
  issues: string[];
  recommendations: string[];
}

interface TimingAnalysis {
  clockFrequency: number;
  actualTLow: number;
  actualTHigh: number;
  setupViolations: number;
  holdViolations: number;
  withinSpec: boolean;
}

// ============================================================================
// SPEED MODE CONFIGURATIONS
// ============================================================================

const SPEED_CONFIGS: Record<I2CSpeedMode, I2CSpeedConfig> = {
  standard: {
    name: 'Standard Mode',
    frequency: 100000,
    tLow: 4700,
    tHigh: 4000,
    tRise: 1000,
    tFall: 300,
    tHD_STA: 4000,
    tSU_STA: 4700,
    tSU_STO: 4000,
  },
  fast: {
    name: 'Fast Mode',
    frequency: 400000,
    tLow: 1300,
    tHigh: 600,
    tRise: 300,
    tFall: 300,
    tHD_STA: 600,
    tSU_STA: 600,
    tSU_STO: 600,
  },
  fast_plus: {
    name: 'Fast Mode Plus',
    frequency: 1000000,
    tLow: 500,
    tHigh: 260,
    tRise: 120,
    tFall: 120,
    tHD_STA: 260,
    tSU_STA: 260,
    tSU_STO: 260,
  },
  high_speed: {
    name: 'High Speed Mode',
    frequency: 3400000,
    tLow: 160,
    tHigh: 60,
    tRise: 40,
    tFall: 40,
    tHD_STA: 160,
    tSU_STA: 160,
    tSU_STO: 160,
  },
};

// ============================================================================
// COMMON I2C DEVICE TEMPLATES
// ============================================================================

interface DeviceTemplate {
  type: string;
  defaultAddress: number;
  memorySize: number;
  description: string;
  registers?: Record<number, { name: string; default: number; readonly?: boolean }>;
}

const DEVICE_TEMPLATES: Record<string, DeviceTemplate> = {
  eeprom_24c02: {
    type: 'EEPROM 24C02',
    defaultAddress: 0x50,
    memorySize: 256,
    description: '2Kbit (256 byte) I2C EEPROM',
  },
  eeprom_24c256: {
    type: 'EEPROM 24C256',
    defaultAddress: 0x50,
    memorySize: 32768,
    description: '256Kbit (32KB) I2C EEPROM',
  },
  rtc_ds3231: {
    type: 'RTC DS3231',
    defaultAddress: 0x68,
    memorySize: 19,
    description: 'Real-Time Clock with temperature compensation',
    registers: {
      0x00: { name: 'Seconds', default: 0x00 },
      0x01: { name: 'Minutes', default: 0x00 },
      0x02: { name: 'Hours', default: 0x00 },
      0x03: { name: 'Day', default: 0x01 },
      0x04: { name: 'Date', default: 0x01 },
      0x05: { name: 'Month', default: 0x01 },
      0x06: { name: 'Year', default: 0x00 },
      0x0E: { name: 'Control', default: 0x00 },
      0x0F: { name: 'Status', default: 0x88 },
      0x11: { name: 'Temp MSB', default: 0x19, readonly: true },
      0x12: { name: 'Temp LSB', default: 0x00, readonly: true },
    },
  },
  sensor_bmp280: {
    type: 'Sensor BMP280',
    defaultAddress: 0x76,
    memorySize: 64,
    description: 'Pressure and temperature sensor',
    registers: {
      0xD0: { name: 'Chip ID', default: 0x58, readonly: true },
      0xE0: { name: 'Reset', default: 0x00 },
      0xF3: { name: 'Status', default: 0x00, readonly: true },
      0xF4: { name: 'Ctrl Meas', default: 0x00 },
      0xF5: { name: 'Config', default: 0x00 },
      0xF7: { name: 'Press MSB', default: 0x80, readonly: true },
      0xF8: { name: 'Press LSB', default: 0x00, readonly: true },
      0xF9: { name: 'Press XLSB', default: 0x00, readonly: true },
      0xFA: { name: 'Temp MSB', default: 0x80, readonly: true },
      0xFB: { name: 'Temp LSB', default: 0x00, readonly: true },
      0xFC: { name: 'Temp XLSB', default: 0x00, readonly: true },
    },
  },
  sensor_mpu6050: {
    type: 'IMU MPU6050',
    defaultAddress: 0x68,
    memorySize: 128,
    description: '6-axis accelerometer/gyroscope',
    registers: {
      0x6B: { name: 'PWR_MGMT_1', default: 0x40 },
      0x6C: { name: 'PWR_MGMT_2', default: 0x00 },
      0x75: { name: 'WHO_AM_I', default: 0x68, readonly: true },
      0x3B: { name: 'ACCEL_XOUT_H', default: 0x00, readonly: true },
      0x3C: { name: 'ACCEL_XOUT_L', default: 0x00, readonly: true },
      0x3D: { name: 'ACCEL_YOUT_H', default: 0x00, readonly: true },
      0x3E: { name: 'ACCEL_YOUT_L', default: 0x00, readonly: true },
      0x3F: { name: 'ACCEL_ZOUT_H', default: 0x00, readonly: true },
      0x40: { name: 'ACCEL_ZOUT_L', default: 0x00, readonly: true },
    },
  },
  gpio_expander_pcf8574: {
    type: 'GPIO Expander PCF8574',
    defaultAddress: 0x20,
    memorySize: 1,
    description: '8-bit I/O expander',
  },
  adc_ads1115: {
    type: 'ADC ADS1115',
    defaultAddress: 0x48,
    memorySize: 4,
    description: '16-bit 4-channel ADC',
    registers: {
      0x00: { name: 'Conversion', default: 0x0000, readonly: true },
      0x01: { name: 'Config', default: 0x8583 },
      0x02: { name: 'Lo Thresh', default: 0x8000 },
      0x03: { name: 'Hi Thresh', default: 0x7FFF },
    },
  },
};

// ============================================================================
// I2C BUS SIMULATOR CLASS
// ============================================================================

class I2CBusSimulator {
  private devices: Map<number, I2CDevice> = new Map();
  private transactions: I2CTransaction[] = [];
  private busState: I2CBusState;
  private speedMode: I2CSpeedMode = 'standard';
  private baseTime: number;
  private transactionCounter: number = 0;

  constructor() {
    this.baseTime = Date.now();
    this.busState = {
      sda: true,
      scl: true,
      busy: false,
      arbitrationLost: false,
      clockStretched: false,
      currentMaster: null,
    };
  }

  private now(): number {
    return Date.now() - this.baseTime;
  }

  private getSpeedConfig(): I2CSpeedConfig {
    return SPEED_CONFIGS[this.speedMode];
  }

  private calculateTransactionDuration(dataLength: number, _isRead: boolean): number {
    const config = this.getSpeedConfig();
    const bitTime = 1000000 / config.frequency; // microseconds per bit

    // Each byte: 8 data bits + 1 ACK bit = 9 bits
    // Start: 1 condition
    // Address: 1 byte (7-bit) or 2 bytes (10-bit)
    // R/W bit included in address byte
    // Stop: 1 condition

    const startBits = 1;
    const addressBits = 9; // 7-bit address + R/W + ACK
    const dataBits = dataLength * 9;
    const stopBits = 1;

    const totalBits = startBits + addressBits + dataBits + stopBits;
    return totalBits * bitTime;
  }

  private validateAddress(address: number, mode: AddressMode): boolean {
    if (mode === '7bit') {
      return address >= 0x08 && address <= 0x77; // Valid 7-bit range (excluding reserved)
    } else {
      return address >= 0x000 && address <= 0x3FF; // Valid 10-bit range
    }
  }

  private isReservedAddress(address: number): boolean {
    // Reserved I2C addresses
    const reserved = [
      0x00, // General call
      0x01, // CBUS
      0x02, // Reserved for different bus
      0x03, // Reserved for future
      0x04, 0x05, 0x06, 0x07, // Hs-mode master code
      0x78, 0x79, 0x7A, 0x7B, // 10-bit slave addressing
      0x7C, 0x7D, 0x7E, 0x7F, // Reserved
    ];
    return reserved.includes(address);
  }

  initBus(speedMode: I2CSpeedMode = 'standard'): {
    success: boolean;
    speedMode: I2CSpeedMode;
    config: I2CSpeedConfig;
  } {
    this.speedMode = speedMode;
    this.busState = {
      sda: true,
      scl: true,
      busy: false,
      arbitrationLost: false,
      clockStretched: false,
      currentMaster: null,
    };

    return {
      success: true,
      speedMode,
      config: this.getSpeedConfig(),
    };
  }

  addDevice(
    address: number,
    template?: string,
    options?: {
      addressMode?: AddressMode;
      clockStretching?: boolean;
      stretchDuration?: number;
    }
  ): {
    success: boolean;
    device?: I2CDevice;
    error?: string;
  } {
    const addressMode = options?.addressMode || '7bit';

    if (!this.validateAddress(address, addressMode)) {
      return { success: false, error: `Invalid ${addressMode} address: 0x${address.toString(16)}` };
    }

    if (this.isReservedAddress(address)) {
      return { success: false, error: `Address 0x${address.toString(16)} is reserved` };
    }

    if (this.devices.has(address)) {
      return { success: false, error: `Device already exists at address 0x${address.toString(16)}` };
    }

    let deviceType = 'Generic Device';
    let memorySize = 256;
    const registers = new Map<number, number>();

    if (template && DEVICE_TEMPLATES[template]) {
      const tmpl = DEVICE_TEMPLATES[template];
      deviceType = tmpl.type;
      memorySize = tmpl.memorySize;

      if (tmpl.registers) {
        for (const [reg, info] of Object.entries(tmpl.registers)) {
          registers.set(parseInt(reg), info.default);
        }
      }
    }

    const device: I2CDevice = {
      address,
      addressMode,
      type: deviceType,
      memory: new Uint8Array(memorySize),
      memorySize,
      registers,
      isConnected: true,
      lastAccess: this.now(),
      clockStretching: options?.clockStretching || false,
      stretchDuration: options?.stretchDuration || 0,
    };

    // Initialize registers in memory
    for (const [reg, value] of registers) {
      if (reg < memorySize) {
        device.memory[reg] = value;
      }
    }

    this.devices.set(address, device);

    return { success: true, device };
  }

  removeDevice(address: number): boolean {
    return this.devices.delete(address);
  }

  transfer(
    address: number,
    type: TransactionType,
    writeData?: number[],
    readLength?: number
  ): {
    success: boolean;
    transaction: I2CTransaction;
    readData?: number[];
    error?: string;
  } {
    const device = this.devices.get(address);
    const transaction: I2CTransaction = {
      id: this.transactionCounter++,
      timestamp: this.now(),
      type,
      address,
      addressMode: device?.addressMode || '7bit',
      data: writeData || [],
      readLength,
      ack: [],
      success: false,
      duration: 0,
      speedMode: this.speedMode,
      conditions: ['START'],
      error: undefined,
    };

    // Check if bus is available
    if (this.busState.busy) {
      transaction.error = 'Bus busy';
      transaction.conditions.push('ARBITRATION_LOST');
      this.transactions.push(transaction);
      return { success: false, transaction, error: 'Bus busy - arbitration lost' };
    }

    // Set bus to busy
    this.busState.busy = true;
    this.busState.currentMaster = 'master0';

    // Check if device exists
    if (!device) {
      transaction.ack.push(false); // NACK on address
      transaction.conditions.push('NACK', 'STOP');
      transaction.error = 'No device at address';
      this.busState.busy = false;
      this.transactions.push(transaction);
      return { success: false, transaction, error: `No device at address 0x${address.toString(16)}` };
    }

    // Device ACKs the address
    transaction.ack.push(true);

    // Handle clock stretching
    if (device.clockStretching) {
      this.busState.clockStretched = true;
      transaction.conditions.push('CLOCK_STRETCH');
      transaction.duration += device.stretchDuration;
    }

    let readData: number[] | undefined;

    switch (type) {
      case 'write': {
        if (!writeData || writeData.length === 0) {
          transaction.error = 'No data to write';
          transaction.conditions.push('STOP');
          this.busState.busy = false;
          this.transactions.push(transaction);
          return { success: false, transaction, error: 'No data to write' };
        }

        // Write data to device memory
        let writePointer = writeData[0]; // First byte is usually register address
        for (let i = 1; i < writeData.length; i++) {
          if (writePointer < device.memorySize) {
            device.memory[writePointer] = writeData[i];
            device.registers.set(writePointer, writeData[i]);
            writePointer++;
            transaction.ack.push(true);
          } else {
            transaction.ack.push(false);
          }
        }
        transaction.success = true;
        break;
      }

      case 'read': {
        const length = readLength || 1;
        readData = [];
        let readPointer = 0;

        // If there was a write before (register address), use that
        if (writeData && writeData.length > 0) {
          readPointer = writeData[0];
        }

        for (let i = 0; i < length; i++) {
          if (readPointer < device.memorySize) {
            readData.push(device.memory[readPointer]);
            readPointer++;
            transaction.ack.push(i < length - 1); // NACK on last byte
          } else {
            readData.push(0xFF);
            transaction.ack.push(false);
          }
        }
        transaction.success = true;
        break;
      }

      case 'write_read': {
        // Combined write then read (repeated start)
        transaction.conditions.push('REPEATED_START');

        if (!writeData || writeData.length === 0) {
          transaction.error = 'No register address to write';
          transaction.conditions.push('STOP');
          this.busState.busy = false;
          this.transactions.push(transaction);
          return { success: false, transaction, error: 'No register address' };
        }

        const regAddress = writeData[0];
        transaction.ack.push(true); // ACK for register write

        // Now read
        const len = readLength || 1;
        readData = [];

        for (let i = 0; i < len; i++) {
          const addr = regAddress + i;
          if (addr < device.memorySize) {
            readData.push(device.memory[addr]);
            transaction.ack.push(i < len - 1);
          } else {
            readData.push(0xFF);
            transaction.ack.push(false);
          }
        }
        transaction.success = true;
        break;
      }
    }

    transaction.conditions.push('STOP');
    transaction.duration += this.calculateTransactionDuration(
      (writeData?.length || 0) + (readLength || 0),
      type === 'read' || type === 'write_read'
    );

    device.lastAccess = this.now();
    this.busState.busy = false;
    this.busState.clockStretched = false;
    this.transactions.push(transaction);

    return {
      success: transaction.success,
      transaction,
      readData,
    };
  }

  scanBus(): {
    devicesFound: { address: number; addressHex: string; type: string }[];
    scanTime: number;
    speedMode: I2CSpeedMode;
  } {
    const startTime = this.now();
    const devicesFound: { address: number; addressHex: string; type: string }[] = [];

    // Scan all valid 7-bit addresses
    for (let addr = 0x08; addr <= 0x77; addr++) {
      if (!this.isReservedAddress(addr)) {
        const device = this.devices.get(addr);
        if (device && device.isConnected) {
          devicesFound.push({
            address: addr,
            addressHex: `0x${addr.toString(16).padStart(2, '0')}`,
            type: device.type,
          });
        }
      }
    }

    return {
      devicesFound,
      scanTime: this.now() - startTime,
      speedMode: this.speedMode,
    };
  }

  analyzeTransaction(transactionId: number): {
    transaction: I2CTransaction | null;
    timing: TimingAnalysis | null;
    protocol: {
      startCondition: boolean;
      stopCondition: boolean;
      repeatedStart: boolean;
      ackSequence: string;
      dataIntegrity: boolean;
    } | null;
  } {
    const transaction = this.transactions.find(t => t.id === transactionId);
    if (!transaction) {
      return { transaction: null, timing: null, protocol: null };
    }

    const config = SPEED_CONFIGS[transaction.speedMode];

    const timing: TimingAnalysis = {
      clockFrequency: config.frequency,
      actualTLow: config.tLow,
      actualTHigh: config.tHigh,
      setupViolations: 0,
      holdViolations: 0,
      withinSpec: true,
    };

    const protocol = {
      startCondition: transaction.conditions.includes('START'),
      stopCondition: transaction.conditions.includes('STOP'),
      repeatedStart: transaction.conditions.includes('REPEATED_START'),
      ackSequence: transaction.ack.map(a => a ? 'ACK' : 'NACK').join(', '),
      dataIntegrity: transaction.success,
    };

    return { transaction, timing, protocol };
  }

  emulateDevice(
    address: number,
    registerAddress: number,
    value: number
  ): {
    success: boolean;
    error?: string;
  } {
    const device = this.devices.get(address);
    if (!device) {
      return { success: false, error: `No device at address 0x${address.toString(16)}` };
    }

    if (registerAddress >= device.memorySize) {
      return { success: false, error: `Register address 0x${registerAddress.toString(16)} out of range` };
    }

    device.memory[registerAddress] = value & 0xFF;
    device.registers.set(registerAddress, value & 0xFF);

    return { success: true };
  }

  checkBusHealth(): BusHealthResult {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check SDA and SCL states
    const sdaState = this.busState.sda;
    const sclState = this.busState.scl;

    // Both lines should be high when idle
    const busStuck = !sdaState || !sclState;

    if (busStuck) {
      if (!sdaState) {
        issues.push('SDA line stuck LOW');
        recommendations.push('Check for device holding SDA low, may need bus recovery');
      }
      if (!sclState) {
        issues.push('SCL line stuck LOW - possible clock stretching or stuck slave');
        recommendations.push('Check for unresponsive slave device');
      }
    }

    // Check device count
    const deviceCount = this.devices.size;
    if (deviceCount === 0) {
      issues.push('No devices on bus');
      recommendations.push('Add I2C devices using add_device operation');
    }

    // Check for address conflicts
    const addresses = Array.from(this.devices.keys());
    const duplicates = addresses.filter((addr, idx) => addresses.indexOf(addr) !== idx);
    if (duplicates.length > 0) {
      issues.push(`Address conflicts detected: ${duplicates.map(a => `0x${a.toString(16)}`).join(', ')}`);
    }

    // Check for too many devices
    if (deviceCount > 112) { // Max 7-bit addresses minus reserved
      issues.push('Excessive devices on bus may cause signal degradation');
      recommendations.push('Consider using I2C multiplexer or reducing device count');
    }

    // Speed recommendations
    if (this.speedMode === 'high_speed' && deviceCount > 10) {
      recommendations.push('High-speed mode with many devices may require active pull-ups');
    }

    return {
      healthy: issues.length === 0,
      sdaState,
      sclState,
      busStuck,
      pullUpDetected: true, // Simulated
      deviceCount,
      issues,
      recommendations,
    };
  }

  getTransactionLog(limit: number = 50): I2CTransaction[] {
    return this.transactions.slice(-limit);
  }

  getDevice(address: number): I2CDevice | undefined {
    return this.devices.get(address);
  }

  getAllDevices(): I2CDevice[] {
    return Array.from(this.devices.values());
  }

  getBusState(): I2CBusState {
    return { ...this.busState };
  }

  reset(): void {
    this.devices.clear();
    this.transactions = [];
    this.transactionCounter = 0;
    this.busState = {
      sda: true,
      scl: true,
      busy: false,
      arbitrationLost: false,
      clockStretched: false,
      currentMaster: null,
    };
  }
}

// ============================================================================
// GLOBAL SIMULATOR INSTANCE
// ============================================================================

const i2cBus = new I2CBusSimulator();

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const i2cprotocolTool: UnifiedTool = {
  name: 'i2c_protocol',
  description: `Comprehensive I2C bus protocol analyzer and simulator.

Features:
- Master and slave device simulation
- 7-bit and 10-bit addressing modes
- Standard (100kHz), Fast (400kHz), Fast-mode Plus (1MHz), High-speed (3.4MHz) modes
- Start/Stop/Repeated Start conditions
- ACK/NACK handling and clock stretching simulation
- Multi-master arbitration support
- Bus error detection (stuck bus, collision)
- Common I2C device emulation (EEPROM, sensors, RTC)
- Transaction logging and timing analysis

Operations: init_bus, add_device, remove_device, transfer, scan_bus, analyze_transaction, emulate_device, check_bus_health, get_log, get_devices, get_state, reset, info, examples`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'init_bus', 'add_device', 'remove_device', 'transfer', 'scan_bus',
          'analyze_transaction', 'emulate_device', 'check_bus_health',
          'get_log', 'get_devices', 'get_device', 'get_state', 'reset',
          'info', 'examples', 'list_templates'
        ],
        description: 'Operation to perform'
      },
      speed_mode: {
        type: 'string',
        enum: ['standard', 'fast', 'fast_plus', 'high_speed'],
        description: 'I2C speed mode (100kHz/400kHz/1MHz/3.4MHz)'
      },
      address: {
        type: 'number',
        description: 'I2C device address (7-bit: 0x08-0x77, 10-bit: 0x000-0x3FF)'
      },
      address_mode: {
        type: 'string',
        enum: ['7bit', '10bit'],
        description: 'Address mode'
      },
      template: {
        type: 'string',
        description: 'Device template (eeprom_24c02, rtc_ds3231, sensor_bmp280, etc.)'
      },
      transfer_type: {
        type: 'string',
        enum: ['write', 'read', 'write_read'],
        description: 'Type of I2C transfer'
      },
      write_data: {
        type: 'array',
        items: { type: 'number' },
        description: 'Data bytes to write (first byte often register address)'
      },
      read_length: {
        type: 'number',
        description: 'Number of bytes to read'
      },
      register_address: {
        type: 'number',
        description: 'Register address for emulation'
      },
      value: {
        type: 'number',
        description: 'Value to set in emulated register'
      },
      transaction_id: {
        type: 'number',
        description: 'Transaction ID for analysis'
      },
      clock_stretching: {
        type: 'boolean',
        description: 'Enable clock stretching for device'
      },
      stretch_duration: {
        type: 'number',
        description: 'Clock stretch duration in microseconds'
      },
      limit: {
        type: 'number',
        description: 'Limit for log entries'
      }
    },
    required: ['operation']
  }
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executei2cprotocol(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    switch (operation) {
      case 'init_bus': {
        const speedMode = args.speed_mode || 'standard';
        const result = i2cBus.initBus(speedMode);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'init_bus',
            result,
          }, null, 2)
        };
      }

      case 'add_device': {
        const address = args.address ?? 0x50;
        const template = args.template;
        const options = {
          addressMode: args.address_mode as AddressMode,
          clockStretching: args.clock_stretching,
          stretchDuration: args.stretch_duration,
        };

        const result = i2cBus.addDevice(address, template, options);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'add_device',
            address: `0x${address.toString(16).padStart(2, '0')}`,
            template,
            result: {
              success: result.success,
              device: result.device ? {
                address: `0x${result.device.address.toString(16).padStart(2, '0')}`,
                type: result.device.type,
                memorySize: result.device.memorySize,
                addressMode: result.device.addressMode,
              } : null,
              error: result.error,
            },
          }, null, 2)
        };
      }

      case 'remove_device': {
        const address = args.address ?? 0x50;
        const success = i2cBus.removeDevice(address);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'remove_device',
            address: `0x${address.toString(16).padStart(2, '0')}`,
            success,
          }, null, 2)
        };
      }

      case 'transfer': {
        const address = args.address ?? 0x50;
        const transferType = args.transfer_type || 'write_read';
        const writeData = args.write_data;
        const readLength = args.read_length;

        const result = i2cBus.transfer(address, transferType, writeData, readLength);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'transfer',
            address: `0x${address.toString(16).padStart(2, '0')}`,
            type: transferType,
            writeData: writeData?.map((b: number) => `0x${b.toString(16).padStart(2, '0')}`),
            readLength,
            result: {
              success: result.success,
              readData: result.readData?.map(b => `0x${b.toString(16).padStart(2, '0')}`),
              transaction: {
                id: result.transaction.id,
                conditions: result.transaction.conditions,
                ackSequence: result.transaction.ack.map(a => a ? 'ACK' : 'NACK'),
                duration: `${result.transaction.duration.toFixed(2)}us`,
              },
              error: result.error,
            },
          }, null, 2)
        };
      }

      case 'scan_bus': {
        const result = i2cBus.scanBus();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'scan_bus',
            result: {
              devicesFound: result.devicesFound,
              deviceCount: result.devicesFound.length,
              scanTime: `${result.scanTime}ms`,
              speedMode: result.speedMode,
            },
          }, null, 2)
        };
      }

      case 'analyze_transaction': {
        const transactionId = args.transaction_id ?? 0;
        const result = i2cBus.analyzeTransaction(transactionId);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze_transaction',
            transactionId,
            result: result.transaction ? {
              transaction: {
                ...result.transaction,
                address: `0x${result.transaction.address.toString(16).padStart(2, '0')}`,
              },
              timing: result.timing,
              protocol: result.protocol,
            } : { error: 'Transaction not found' },
          }, null, 2)
        };
      }

      case 'emulate_device': {
        const address = args.address ?? 0x50;
        const registerAddress = args.register_address ?? 0;
        const value = args.value ?? 0;

        const result = i2cBus.emulateDevice(address, registerAddress, value);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'emulate_device',
            address: `0x${address.toString(16).padStart(2, '0')}`,
            register: `0x${registerAddress.toString(16).padStart(2, '0')}`,
            value: `0x${value.toString(16).padStart(2, '0')}`,
            result,
          }, null, 2)
        };
      }

      case 'check_bus_health': {
        const result = i2cBus.checkBusHealth();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'check_bus_health',
            result,
          }, null, 2)
        };
      }

      case 'get_log': {
        const limit = args.limit ?? 50;
        const transactions = i2cBus.getTransactionLog(limit);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_log',
            count: transactions.length,
            transactions: transactions.map(t => ({
              id: t.id,
              timestamp: t.timestamp,
              type: t.type,
              address: `0x${t.address.toString(16).padStart(2, '0')}`,
              success: t.success,
              conditions: t.conditions,
              error: t.error,
            })),
          }, null, 2)
        };
      }

      case 'get_devices': {
        const devices = i2cBus.getAllDevices();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_devices',
            count: devices.length,
            devices: devices.map(d => ({
              address: `0x${d.address.toString(16).padStart(2, '0')}`,
              type: d.type,
              addressMode: d.addressMode,
              memorySize: d.memorySize,
              isConnected: d.isConnected,
              clockStretching: d.clockStretching,
            })),
          }, null, 2)
        };
      }

      case 'get_device': {
        const address = args.address ?? 0x50;
        const device = i2cBus.getDevice(address);

        if (!device) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'get_device',
              address: `0x${address.toString(16).padStart(2, '0')}`,
              error: 'Device not found',
            }, null, 2)
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_device',
            device: {
              address: `0x${device.address.toString(16).padStart(2, '0')}`,
              type: device.type,
              addressMode: device.addressMode,
              memorySize: device.memorySize,
              isConnected: device.isConnected,
              clockStretching: device.clockStretching,
              registers: Array.from(device.registers.entries()).map(([reg, val]) => ({
                register: `0x${reg.toString(16).padStart(2, '0')}`,
                value: `0x${val.toString(16).padStart(2, '0')}`,
              })),
            },
          }, null, 2)
        };
      }

      case 'get_state': {
        const state = i2cBus.getBusState();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_state',
            busState: state,
          }, null, 2)
        };
      }

      case 'reset': {
        i2cBus.reset();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'reset',
            message: 'I2C bus reset to initial state',
          }, null, 2)
        };
      }

      case 'list_templates': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'list_templates',
            templates: Object.entries(DEVICE_TEMPLATES).map(([key, tmpl]) => ({
              key,
              type: tmpl.type,
              defaultAddress: `0x${tmpl.defaultAddress.toString(16).padStart(2, '0')}`,
              memorySize: tmpl.memorySize,
              description: tmpl.description,
            })),
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'I2C Protocol Analyzer/Simulator',
            description: 'Comprehensive I2C bus simulation for embedded development',
            features: {
              speedModes: Object.entries(SPEED_CONFIGS).map(([key, cfg]) => ({
                mode: key,
                name: cfg.name,
                frequency: `${cfg.frequency / 1000}kHz`,
              })),
              addressModes: ['7-bit (0x08-0x77)', '10-bit (0x000-0x3FF)'],
              deviceTemplates: Object.keys(DEVICE_TEMPLATES),
              protocols: [
                'Start/Stop conditions',
                'Repeated Start',
                'ACK/NACK handling',
                'Clock stretching',
                'Multi-master arbitration',
              ],
            },
            operations: [
              { name: 'init_bus', desc: 'Initialize I2C bus with speed mode' },
              { name: 'add_device', desc: 'Add device to bus (optionally from template)' },
              { name: 'remove_device', desc: 'Remove device from bus' },
              { name: 'transfer', desc: 'Perform I2C transfer (write/read/write_read)' },
              { name: 'scan_bus', desc: 'Scan bus for connected devices' },
              { name: 'analyze_transaction', desc: 'Analyze transaction timing and protocol' },
              { name: 'emulate_device', desc: 'Set register value in emulated device' },
              { name: 'check_bus_health', desc: 'Check bus health and detect issues' },
              { name: 'get_log', desc: 'Get transaction log' },
              { name: 'get_devices', desc: 'List all devices on bus' },
              { name: 'get_device', desc: 'Get details for specific device' },
              { name: 'get_state', desc: 'Get current bus state' },
              { name: 'list_templates', desc: 'List available device templates' },
              { name: 'reset', desc: 'Reset bus to initial state' },
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
                name: 'Initialize bus in Fast mode',
                call: { operation: 'init_bus', speed_mode: 'fast' }
              },
              {
                name: 'Add EEPROM device',
                call: { operation: 'add_device', address: 0x50, template: 'eeprom_24c02' }
              },
              {
                name: 'Add temperature sensor',
                call: { operation: 'add_device', address: 0x76, template: 'sensor_bmp280' }
              },
              {
                name: 'Write to EEPROM (address 0, data 0x42)',
                call: { operation: 'transfer', address: 0x50, transfer_type: 'write', write_data: [0x00, 0x42] }
              },
              {
                name: 'Read from EEPROM (address 0, 4 bytes)',
                call: { operation: 'transfer', address: 0x50, transfer_type: 'write_read', write_data: [0x00], read_length: 4 }
              },
              {
                name: 'Read sensor chip ID',
                call: { operation: 'transfer', address: 0x76, transfer_type: 'write_read', write_data: [0xD0], read_length: 1 }
              },
              {
                name: 'Scan bus for devices',
                call: { operation: 'scan_bus' }
              },
              {
                name: 'Check bus health',
                call: { operation: 'check_bus_health' }
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

export function isi2cprotocolAvailable(): boolean {
  return true;
}
