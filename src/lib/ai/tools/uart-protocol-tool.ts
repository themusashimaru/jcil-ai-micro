/**
 * UART-PROTOCOL TOOL
 * Full UART serial communication simulator with frame analysis,
 * error detection, flow control, and protocol decoding
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

/** Standard baud rates (used for type documentation) */
export type StandardBaudRate = 300 | 600 | 1200 | 2400 | 4800 | 9600 | 14400 | 19200 | 28800 | 38400 |
  57600 | 76800 | 115200 | 230400 | 460800 | 921600 | 1000000 | 2000000 | 4000000;

/** Data bits options */
type DataBits = 5 | 6 | 7 | 8 | 9;

/** Parity options */
type Parity = 'none' | 'odd' | 'even' | 'mark' | 'space';

/** Stop bits options */
type StopBits = 1 | 1.5 | 2;

/** Flow control modes */
type FlowControl = 'none' | 'rts_cts' | 'xon_xoff';

/** UART operating mode */
type UARTMode = 'rs232' | 'rs485';

/** Protocol types for decoding */
type ProtocolType = 'raw' | 'at_commands' | 'nmea' | 'modbus_rtu';

interface UARTConfig {
  baudRate: number;
  dataBits: DataBits;
  parity: Parity;
  stopBits: StopBits;
  flowControl: FlowControl;
  mode: UARTMode;
  halfDuplex: boolean;
}

interface UARTFrame {
  id: string;
  timestamp: number;
  startBit: boolean;
  dataBits: number[];
  parityBit?: number;
  stopBits: number[];
  rawValue: number;
  character?: string;
  valid: boolean;
  errors: string[];
  bitDuration: number;  // microseconds
}

interface UARTTransmission {
  id: string;
  timestamp: number;
  direction: 'tx' | 'rx';
  frames: UARTFrame[];
  data: number[];
  text?: string;
  duration: number;     // microseconds
  errors: string[];
}

interface FIFOBuffer {
  data: number[];
  capacity: number;
  readPointer: number;
  writePointer: number;
  overrun: boolean;
}

interface UARTErrors {
  framingErrors: number;
  parityErrors: number;
  overrunErrors: number;
  breakConditions: number;
  noiseErrors: number;
}

interface TimingAnalysis {
  bitDuration: number;          // microseconds
  frameDuration: number;        // microseconds
  bitsPerFrame: number;
  effectiveBitrate: number;     // bps
  efficiency: number;           // percentage
  maxThroughput: number;        // bytes per second
}

interface ModbusRTUFrame {
  slaveAddress: number;
  functionCode: number;
  data: number[];
  crc: number;
  valid: boolean;
}

interface NMEASentence {
  type: string;
  fields: string[];
  checksum: string;
  valid: boolean;
}

interface ATResponse {
  command: string;
  response: string;
  status: 'OK' | 'ERROR' | 'UNKNOWN';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STANDARD_BAUD_RATES: number[] = [
  300, 600, 1200, 2400, 4800, 9600, 14400, 19200, 28800, 38400,
  57600, 76800, 115200, 230400, 460800, 921600, 1000000, 2000000, 4000000
];

const XON = 0x11;  // DC1 - resume transmission
const XOFF = 0x13; // DC3 - pause transmission

// ============================================================================
// UART SIMULATOR
// ============================================================================

class UARTSimulator {
  private config: UARTConfig;
  private txBuffer: FIFOBuffer;
  private rxBuffer: FIFOBuffer;
  private transmissions: UARTTransmission[] = [];
  private transmissionCounter: number = 0;
  private errors: UARTErrors;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _rtsState: boolean = true;   // Ready to send (future use)
  private ctsState: boolean = true;   // Clear to send
  private xonState: boolean = true;   // XON active (can transmit)
  private breakCondition: boolean = false;
  private noiseLevel: number = 0;     // 0-100

  constructor(config?: Partial<UARTConfig>) {
    this.config = {
      baudRate: 9600,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      flowControl: 'none',
      mode: 'rs232',
      halfDuplex: false,
      ...config
    };

    this.txBuffer = this.createFIFO(256);
    this.rxBuffer = this.createFIFO(256);

    this.errors = {
      framingErrors: 0,
      parityErrors: 0,
      overrunErrors: 0,
      breakConditions: 0,
      noiseErrors: 0
    };
  }

  private createFIFO(capacity: number): FIFOBuffer {
    return {
      data: new Array(capacity).fill(0),
      capacity,
      readPointer: 0,
      writePointer: 0,
      overrun: false
    };
  }

  configure(config: Partial<UARTConfig>): UARTConfig {
    this.config = { ...this.config, ...config };
    return this.config;
  }

  getConfig(): UARTConfig {
    return { ...this.config };
  }

  /**
   * Calculate parity bit for data
   */
  private calculateParity(data: number): number {
    let ones = 0;
    let value = data;
    while (value > 0) {
      ones += value & 1;
      value >>= 1;
    }

    switch (this.config.parity) {
      case 'odd':
        return (ones % 2 === 0) ? 1 : 0;
      case 'even':
        return (ones % 2 === 1) ? 1 : 0;
      case 'mark':
        return 1;
      case 'space':
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Create a UART frame from a byte
   */
  private createFrame(data: number, addNoise: boolean = false): UARTFrame {
    const bitDuration = 1e6 / this.config.baudRate; // microseconds
    const mask = (1 << this.config.dataBits) - 1;
    const maskedData = data & mask;

    // Extract data bits (LSB first)
    const dataBits: number[] = [];
    for (let i = 0; i < this.config.dataBits; i++) {
      let bit = (maskedData >> i) & 1;
      // Add noise if enabled
      if (addNoise && this.noiseLevel > 0 && Math.random() * 100 < this.noiseLevel) {
        bit = 1 - bit;  // Flip bit
      }
      dataBits.push(bit);
    }

    // Calculate parity bit if needed
    let parityBit: number | undefined;
    if (this.config.parity !== 'none') {
      parityBit = this.calculateParity(maskedData);
      if (addNoise && this.noiseLevel > 0 && Math.random() * 100 < this.noiseLevel) {
        parityBit = 1 - parityBit;
      }
    }

    // Stop bits
    const stopBits: number[] = [];
    const stopBitCount = this.config.stopBits === 1.5 ? 2 : this.config.stopBits;
    for (let i = 0; i < stopBitCount; i++) {
      stopBits.push(1); // Stop bits are always high
    }

    // Validate frame
    const errors: string[] = [];
    let valid = true;

    // Check parity
    if (this.config.parity !== 'none' && parityBit !== undefined) {
      const expectedParity = this.calculateParity(maskedData);
      if (parityBit !== expectedParity) {
        errors.push('Parity error');
        valid = false;
        this.errors.parityErrors++;
      }
    }

    // Check framing (stop bits should be high)
    if (stopBits.some(b => b !== 1)) {
      errors.push('Framing error');
      valid = false;
      this.errors.framingErrors++;
    }

    return {
      id: `frame_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      startBit: false,  // Start bit is always low
      dataBits,
      parityBit,
      stopBits,
      rawValue: maskedData,
      character: (maskedData >= 32 && maskedData < 127) ? String.fromCharCode(maskedData) : undefined,
      valid,
      errors,
      bitDuration
    };
  }

  /**
   * Send data through UART
   */
  send(data: number[]): UARTTransmission {
    // Check flow control
    if (this.config.flowControl === 'rts_cts' && !this.ctsState) {
      throw new Error('CTS not asserted - cannot transmit');
    }
    if (this.config.flowControl === 'xon_xoff' && !this.xonState) {
      throw new Error('XOFF received - transmission paused');
    }

    const frames: UARTFrame[] = [];
    const errors: string[] = [];
    const bitDuration = 1e6 / this.config.baudRate;
    const bitsPerFrame = this.calculateBitsPerFrame();

    for (const byte of data) {
      // Check for break condition
      if (this.breakCondition) {
        errors.push('Break condition detected');
        this.errors.breakConditions++;
        break;
      }

      // Add to TX buffer
      if (!this.writeToBuffer(this.txBuffer, byte)) {
        errors.push('TX buffer overrun');
        this.errors.overrunErrors++;
      }

      const frame = this.createFrame(byte, this.noiseLevel > 0);
      frames.push(frame);
      errors.push(...frame.errors);
    }

    const transmission: UARTTransmission = {
      id: `tx_${++this.transmissionCounter}`,
      timestamp: Date.now(),
      direction: 'tx',
      frames,
      data,
      text: this.bytesToString(data),
      duration: frames.length * bitsPerFrame * bitDuration,
      errors
    };

    this.transmissions.push(transmission);
    return transmission;
  }

  /**
   * Receive data (simulated)
   */
  receive(data: number[]): UARTTransmission {
    const frames: UARTFrame[] = [];
    const errors: string[] = [];
    const bitDuration = 1e6 / this.config.baudRate;
    const bitsPerFrame = this.calculateBitsPerFrame();

    for (const byte of data) {
      // Add to RX buffer
      if (!this.writeToBuffer(this.rxBuffer, byte)) {
        errors.push('RX buffer overrun');
        this.errors.overrunErrors++;

        // Send XOFF if flow control enabled
        if (this.config.flowControl === 'xon_xoff') {
          this.xonState = false;
        }
      }

      const frame = this.createFrame(byte, this.noiseLevel > 0);
      frames.push(frame);
      errors.push(...frame.errors);
    }

    const transmission: UARTTransmission = {
      id: `rx_${++this.transmissionCounter}`,
      timestamp: Date.now(),
      direction: 'rx',
      frames,
      data,
      text: this.bytesToString(data),
      duration: frames.length * bitsPerFrame * bitDuration,
      errors
    };

    this.transmissions.push(transmission);
    return transmission;
  }

  /**
   * Analyze a single UART frame
   */
  analyzeFrame(data: number): {
    frame: UARTFrame;
    visualization: string[];
    timing: { bitDuration: number; frameDuration: number; bitsPerFrame: number };
  } {
    const frame = this.createFrame(data);
    const bitDuration = 1e6 / this.config.baudRate;
    const bitsPerFrame = this.calculateBitsPerFrame();

    // Create visualization
    const visualization: string[] = [];
    let bitLine = 'Bits: ';
    let valueLine = 'Vals: ';

    // Start bit
    bitLine += 'St ';
    valueLine += '0  ';

    // Data bits
    for (let i = 0; i < frame.dataBits.length; i++) {
      bitLine += `D${i} `;
      valueLine += `${frame.dataBits[i]}  `;
    }

    // Parity bit
    if (frame.parityBit !== undefined) {
      bitLine += 'P  ';
      valueLine += `${frame.parityBit}  `;
    }

    // Stop bits
    for (let i = 0; i < frame.stopBits.length; i++) {
      bitLine += `Sp `;
      valueLine += `${frame.stopBits[i]}  `;
    }

    visualization.push(bitLine);
    visualization.push(valueLine);

    // Waveform representation
    let waveform = '     ';
    waveform += '_';  // Start bit (low)
    for (const bit of frame.dataBits) {
      waveform += bit ? '-' : '_';
    }
    if (frame.parityBit !== undefined) {
      waveform += frame.parityBit ? '-' : '_';
    }
    for (const bit of frame.stopBits) {
      waveform += bit ? '-' : '_';
    }
    visualization.push('Wave: ' + waveform);

    return {
      frame,
      visualization,
      timing: {
        bitDuration,
        frameDuration: bitsPerFrame * bitDuration,
        bitsPerFrame
      }
    };
  }

  /**
   * Detect baud rate from timing data
   */
  detectBaudRate(pulseWidthsUs: number[]): {
    detectedBaudRate: number;
    confidence: number;
    nearestStandard: number;
    measurements: { bitTime: number; measuredRate: number }[];
  } {
    // Find the shortest pulse which should be one bit time
    const sortedWidths = [...pulseWidthsUs].sort((a, b) => a - b);
    const shortestPulses = sortedWidths.slice(0, Math.max(5, Math.floor(sortedWidths.length * 0.2)));
    const avgBitTime = shortestPulses.reduce((a, b) => a + b, 0) / shortestPulses.length;

    const measuredRate = 1e6 / avgBitTime;

    // Find nearest standard baud rate
    let nearestStandard = STANDARD_BAUD_RATES[0];
    let minDiff = Math.abs(measuredRate - nearestStandard);

    for (const rate of STANDARD_BAUD_RATES) {
      const diff = Math.abs(measuredRate - rate);
      if (diff < minDiff) {
        minDiff = diff;
        nearestStandard = rate;
      }
    }

    // Calculate confidence based on how close to standard
    const deviation = Math.abs(measuredRate - nearestStandard) / nearestStandard;
    const confidence = Math.max(0, 100 - deviation * 200);

    const measurements = pulseWidthsUs.slice(0, 10).map(width => ({
      bitTime: width,
      measuredRate: 1e6 / width
    }));

    return {
      detectedBaudRate: nearestStandard,
      confidence,
      nearestStandard,
      measurements
    };
  }

  /**
   * Simulate noise on the line
   */
  setNoiseLevel(level: number): void {
    this.noiseLevel = Math.max(0, Math.min(100, level));
  }

  /**
   * Simulate break condition
   */
  sendBreak(durationBits: number = 10): { duration: number; bitDuration: number } {
    this.breakCondition = true;
    const bitDuration = 1e6 / this.config.baudRate;
    const duration = durationBits * bitDuration;

    // Auto-clear break after duration (simulated)
    setTimeout(() => {
      this.breakCondition = false;
    }, 1);

    this.errors.breakConditions++;

    return { duration, bitDuration };
  }

  /**
   * Loopback test
   */
  loopbackTest(data: number[]): {
    sent: UARTTransmission;
    received: UARTTransmission;
    match: boolean;
    errors: string[];
  } {
    const sent = this.send(data);
    const received = this.receive(data);

    const match = sent.data.length === received.data.length &&
      sent.data.every((b, i) => b === received.data[i]);

    return {
      sent,
      received,
      match,
      errors: [...sent.errors, ...received.errors]
    };
  }

  /**
   * Decode protocol-specific data
   */
  decodeProtocol(data: number[], protocol: ProtocolType): {
    protocol: string;
    decoded: ATResponse | ModbusRTUFrame | NMEASentence | { raw: string };
    valid: boolean;
  } {
    const text = this.bytesToString(data);

    switch (protocol) {
      case 'at_commands':
        return {
          protocol: 'AT Commands',
          decoded: this.decodeATCommand(text),
          valid: true
        };

      case 'nmea':
        return {
          protocol: 'NMEA 0183',
          decoded: this.decodeNMEA(text),
          valid: text.startsWith('$')
        };

      case 'modbus_rtu':
        return {
          protocol: 'Modbus RTU',
          decoded: this.decodeModbusRTU(data),
          valid: data.length >= 4
        };

      default:
        return {
          protocol: 'Raw',
          decoded: { raw: text },
          valid: true
        };
    }
  }

  /**
   * Decode AT commands
   */
  private decodeATCommand(text: string): ATResponse {
    const lines = text.split('\r\n').filter(l => l.trim());
    const command = lines[0] || '';

    let response = '';
    let status: 'OK' | 'ERROR' | 'UNKNOWN' = 'UNKNOWN';

    if (lines.includes('OK')) {
      status = 'OK';
      response = lines.filter(l => l !== 'OK' && l !== command).join('\n');
    } else if (lines.some(l => l.startsWith('ERROR') || l.startsWith('+CME ERROR'))) {
      status = 'ERROR';
      response = lines.filter(l => l !== command).join('\n');
    } else {
      response = lines.slice(1).join('\n');
    }

    return { command, response, status };
  }

  /**
   * Decode NMEA sentence
   */
  private decodeNMEA(text: string): NMEASentence {
    // NMEA format: $GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,47.0,M,,*47
    const match = text.match(/^\$([A-Z]+),(.+)\*([0-9A-F]{2})$/);

    if (!match) {
      return {
        type: 'UNKNOWN',
        fields: [],
        checksum: '',
        valid: false
      };
    }

    const type = match[1];
    const fields = match[2].split(',');
    const checksum = match[3];

    // Validate checksum
    const payload = type + ',' + match[2];
    let calcChecksum = 0;
    for (const char of payload) {
      calcChecksum ^= char.charCodeAt(0);
    }
    const valid = calcChecksum.toString(16).toUpperCase().padStart(2, '0') === checksum;

    return { type, fields, checksum, valid };
  }

  /**
   * Decode Modbus RTU frame
   */
  private decodeModbusRTU(data: number[]): ModbusRTUFrame {
    if (data.length < 4) {
      return {
        slaveAddress: 0,
        functionCode: 0,
        data: [],
        crc: 0,
        valid: false
      };
    }

    const slaveAddress = data[0];
    const functionCode = data[1];
    const frameData = data.slice(2, -2);
    const crcLow = data[data.length - 2];
    const crcHigh = data[data.length - 1];
    const receivedCRC = (crcHigh << 8) | crcLow;

    // Calculate CRC16-MODBUS
    const calculatedCRC = this.calculateModbusCRC(data.slice(0, -2));
    const valid = receivedCRC === calculatedCRC;

    return {
      slaveAddress,
      functionCode,
      data: frameData,
      crc: receivedCRC,
      valid
    };
  }

  /**
   * Calculate Modbus CRC16
   */
  private calculateModbusCRC(data: number[]): number {
    let crc = 0xFFFF;

    for (const byte of data) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) {
        if (crc & 1) {
          crc = (crc >> 1) ^ 0xA001;
        } else {
          crc >>= 1;
        }
      }
    }

    return crc;
  }

  /**
   * Calculate bits per frame
   */
  private calculateBitsPerFrame(): number {
    let bits = 1;  // Start bit
    bits += this.config.dataBits;
    if (this.config.parity !== 'none') bits += 1;
    bits += this.config.stopBits;
    return bits;
  }

  /**
   * Analyze timing characteristics
   */
  analyzeTiming(): TimingAnalysis {
    const bitDuration = 1e6 / this.config.baudRate;
    const bitsPerFrame = this.calculateBitsPerFrame();
    const frameDuration = bitsPerFrame * bitDuration;

    // Effective data bits per frame
    const effectiveDataBits = this.config.dataBits;
    const efficiency = (effectiveDataBits / bitsPerFrame) * 100;

    // Max theoretical throughput
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _framesPerSecond = 1e6 / frameDuration;

    return {
      bitDuration,
      frameDuration,
      bitsPerFrame,
      effectiveBitrate: this.config.baudRate * efficiency / 100,
      efficiency,
      maxThroughput: Math.floor(this.config.baudRate / bitsPerFrame)
    };
  }

  /**
   * Get error statistics
   */
  getErrors(): UARTErrors {
    return { ...this.errors };
  }

  /**
   * Reset error counters
   */
  resetErrors(): void {
    this.errors = {
      framingErrors: 0,
      parityErrors: 0,
      overrunErrors: 0,
      breakConditions: 0,
      noiseErrors: 0
    };
  }

  /**
   * Set RTS state
   */
  setRTS(state: boolean): void {
    this._rtsState = state;
  }

  /**
   * Set CTS state
   */
  setCTS(state: boolean): void {
    this.ctsState = state;
  }

  /**
   * Send XON
   */
  sendXON(): void {
    this.xonState = true;
    this.send([XON]);
  }

  /**
   * Send XOFF
   */
  sendXOFF(): void {
    this.xonState = false;
    this.send([XOFF]);
  }

  /**
   * Get buffer status
   */
  getBufferStatus(): {
    tx: { used: number; capacity: number; overrun: boolean };
    rx: { used: number; capacity: number; overrun: boolean };
  } {
    return {
      tx: {
        used: this.getBufferUsed(this.txBuffer),
        capacity: this.txBuffer.capacity,
        overrun: this.txBuffer.overrun
      },
      rx: {
        used: this.getBufferUsed(this.rxBuffer),
        capacity: this.rxBuffer.capacity,
        overrun: this.rxBuffer.overrun
      }
    };
  }

  private writeToBuffer(buffer: FIFOBuffer, data: number): boolean {
    const nextWritePointer = (buffer.writePointer + 1) % buffer.capacity;
    if (nextWritePointer === buffer.readPointer) {
      buffer.overrun = true;
      return false;
    }
    buffer.data[buffer.writePointer] = data;
    buffer.writePointer = nextWritePointer;
    return true;
  }

  private getBufferUsed(buffer: FIFOBuffer): number {
    if (buffer.writePointer >= buffer.readPointer) {
      return buffer.writePointer - buffer.readPointer;
    }
    return buffer.capacity - buffer.readPointer + buffer.writePointer;
  }

  private bytesToString(data: number[]): string {
    return data.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
  }

  getTransmissions(): UARTTransmission[] {
    return [...this.transmissions];
  }
}

// ============================================================================
// GLOBAL INSTANCE
// ============================================================================

let uartSimulator: UARTSimulator | null = null;

function getSimulator(): UARTSimulator {
  if (!uartSimulator) {
    uartSimulator = new UARTSimulator();
  }
  return uartSimulator;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const uartprotocolTool: UnifiedTool = {
  name: 'uart_protocol',
  description: 'Full UART serial communication simulator with frame analysis, error detection, flow control, and protocol decoding',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'configure', 'send', 'receive', 'analyze_frame', 'detect_baud',
          'simulate_noise', 'check_errors', 'loopback_test', 'protocol_decode',
          'analyze_timing', 'flow_control', 'send_break', 'get_status', 'info', 'examples'
        ],
        description: 'Operation to perform'
      },
      baudRate: {
        type: 'number',
        description: 'Baud rate (300 to 4000000)'
      },
      dataBits: {
        type: 'number',
        enum: ['5', '6', '7', '8', '9'],
        description: 'Number of data bits per frame'
      },
      parity: {
        type: 'string',
        enum: ['none', 'odd', 'even', 'mark', 'space'],
        description: 'Parity type'
      },
      stopBits: {
        type: 'number',
        enum: ['1', '1.5', '2'],
        description: 'Number of stop bits'
      },
      flowControl: {
        type: 'string',
        enum: ['none', 'rts_cts', 'xon_xoff'],
        description: 'Flow control mode'
      },
      mode: {
        type: 'string',
        enum: ['rs232', 'rs485'],
        description: 'UART operating mode'
      },
      halfDuplex: {
        type: 'boolean',
        description: 'Enable half-duplex mode'
      },
      data: {
        type: 'array',
        items: { type: 'number' },
        description: 'Data bytes to send/receive'
      },
      text: {
        type: 'string',
        description: 'Text to send (converted to bytes)'
      },
      byte: {
        type: 'number',
        description: 'Single byte value for frame analysis'
      },
      pulseWidths: {
        type: 'array',
        items: { type: 'number' },
        description: 'Pulse widths in microseconds for baud rate detection'
      },
      noiseLevel: {
        type: 'number',
        description: 'Noise level 0-100 percent'
      },
      protocol: {
        type: 'string',
        enum: ['raw', 'at_commands', 'nmea', 'modbus_rtu'],
        description: 'Protocol type for decoding'
      },
      flowAction: {
        type: 'string',
        enum: ['set_rts', 'clear_rts', 'set_cts', 'clear_cts', 'send_xon', 'send_xoff'],
        description: 'Flow control action'
      }
    },
    required: ['operation']
  }
};

export async function executeuartprotocol(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;
    const sim = getSimulator();

    switch (operation) {
      case 'configure': {
        const config = sim.configure({
          baudRate: args.baudRate,
          dataBits: args.dataBits,
          parity: args.parity,
          stopBits: args.stopBits,
          flowControl: args.flowControl,
          mode: args.mode,
          halfDuplex: args.halfDuplex
        });

        const timing = sim.analyzeTiming();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'configure',
            config,
            timing: {
              bitDurationUs: timing.bitDuration.toFixed(2),
              frameDurationUs: timing.frameDuration.toFixed(2),
              bitsPerFrame: timing.bitsPerFrame,
              maxThroughputBps: timing.maxThroughput,
              efficiency: `${timing.efficiency.toFixed(1)}%`
            },
            frameFormat: `${config.dataBits}${config.parity.charAt(0).toUpperCase()}${config.stopBits}`,
            standardNotation: `${config.baudRate} ${config.dataBits}-${config.parity.charAt(0).toUpperCase()}-${config.stopBits}`
          }, null, 2)
        };
      }

      case 'send': {
        let data: number[];
        if (args.data) {
          data = args.data;
        } else if (args.text) {
          data = Array.from(args.text as string).map((c: string) => c.charCodeAt(0));
        } else {
          data = [0x48, 0x65, 0x6C, 0x6C, 0x6F]; // "Hello"
        }

        try {
          const transmission = sim.send(data);

          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'send',
              transmissionId: transmission.id,
              direction: transmission.direction,
              bytessSent: data.length,
              data: data.map(b => `0x${b.toString(16).padStart(2, '0')}`),
              text: transmission.text,
              durationUs: transmission.duration.toFixed(2),
              framesGenerated: transmission.frames.length,
              errors: transmission.errors
            }, null, 2)
          };
        } catch (e) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'send',
              error: e instanceof Error ? e.message : 'Send failed'
            }, null, 2),
            isError: true
          };
        }
      }

      case 'receive': {
        let data: number[];
        if (args.data) {
          data = args.data;
        } else if (args.text) {
          data = Array.from(args.text as string).map((c: string) => c.charCodeAt(0));
        } else {
          data = [0x4F, 0x4B, 0x0D, 0x0A]; // "OK\r\n"
        }

        const transmission = sim.receive(data);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'receive',
            transmissionId: transmission.id,
            direction: transmission.direction,
            bytesReceived: data.length,
            data: data.map(b => `0x${b.toString(16).padStart(2, '0')}`),
            text: transmission.text,
            durationUs: transmission.duration.toFixed(2),
            framesProcessed: transmission.frames.length,
            errors: transmission.errors
          }, null, 2)
        };
      }

      case 'analyze_frame': {
        const byte = args.byte ?? 0x55;  // 01010101 - good for seeing bit pattern
        const analysis = sim.analyzeFrame(byte);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze_frame',
            input: {
              byte: `0x${byte.toString(16).padStart(2, '0')}`,
              binary: byte.toString(2).padStart(8, '0'),
              character: analysis.frame.character
            },
            frame: {
              startBit: analysis.frame.startBit,
              dataBits: analysis.frame.dataBits,
              parityBit: analysis.frame.parityBit,
              stopBits: analysis.frame.stopBits,
              valid: analysis.frame.valid,
              errors: analysis.frame.errors
            },
            visualization: analysis.visualization,
            timing: {
              bitDurationUs: analysis.timing.bitDuration.toFixed(2),
              frameDurationUs: analysis.timing.frameDuration.toFixed(2),
              bitsPerFrame: analysis.timing.bitsPerFrame
            }
          }, null, 2)
        };
      }

      case 'detect_baud': {
        const pulseWidths = args.pulseWidths || [104, 208, 104, 104, 312, 104]; // Example at ~9600 baud
        const result = sim.detectBaudRate(pulseWidths);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'detect_baud',
            pulseWidthsUs: pulseWidths,
            detection: {
              detectedBaudRate: result.detectedBaudRate,
              confidence: `${result.confidence.toFixed(1)}%`,
              nearestStandardRate: result.nearestStandard
            },
            measurements: result.measurements,
            standardBaudRates: STANDARD_BAUD_RATES
          }, null, 2)
        };
      }

      case 'simulate_noise': {
        const level = args.noiseLevel ?? 5;
        sim.setNoiseLevel(level);

        // Send test data with noise
        const testData = [0xAA, 0x55, 0xFF, 0x00];
        const transmission = sim.send(testData);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'simulate_noise',
            noiseLevel: `${level}%`,
            testTransmission: {
              sentData: testData.map(b => `0x${b.toString(16).padStart(2, '0')}`),
              framesWithErrors: transmission.frames.filter(f => !f.valid).length,
              totalFrames: transmission.frames.length,
              errors: transmission.errors
            },
            description: level > 0
              ? `Noise simulation active: ${level}% chance of bit flip per bit`
              : 'Noise simulation disabled'
          }, null, 2)
        };
      }

      case 'check_errors': {
        const errors = sim.getErrors();
        const buffers = sim.getBufferStatus();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'check_errors',
            errorCounts: {
              framingErrors: errors.framingErrors,
              parityErrors: errors.parityErrors,
              overrunErrors: errors.overrunErrors,
              breakConditions: errors.breakConditions,
              noiseErrors: errors.noiseErrors,
              total: Object.values(errors).reduce((a, b) => a + b, 0)
            },
            bufferStatus: {
              tx: {
                used: buffers.tx.used,
                capacity: buffers.tx.capacity,
                percentFull: `${(buffers.tx.used / buffers.tx.capacity * 100).toFixed(1)}%`,
                overrun: buffers.tx.overrun
              },
              rx: {
                used: buffers.rx.used,
                capacity: buffers.rx.capacity,
                percentFull: `${(buffers.rx.used / buffers.rx.capacity * 100).toFixed(1)}%`,
                overrun: buffers.rx.overrun
              }
            },
            errorDescriptions: {
              framing: 'Stop bit not detected at expected time',
              parity: 'Calculated parity does not match received parity bit',
              overrun: 'New data arrived before previous data was read',
              break: 'Line held low longer than a full frame',
              noise: 'Bit flips detected due to line noise'
            }
          }, null, 2)
        };
      }

      case 'loopback_test': {
        let data: number[];
        if (args.data) {
          data = args.data;
        } else if (args.text) {
          data = Array.from(args.text as string).map((c: string) => c.charCodeAt(0));
        } else {
          data = [0x55, 0xAA, 0x00, 0xFF]; // Test pattern
        }

        const result = sim.loopbackTest(data);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'loopback_test',
            testData: data.map(b => `0x${b.toString(16).padStart(2, '0')}`),
            result: {
              match: result.match,
              status: result.match ? 'PASSED' : 'FAILED',
              bytesSent: result.sent.data.length,
              bytesReceived: result.received.data.length
            },
            timing: {
              txDurationUs: result.sent.duration.toFixed(2),
              rxDurationUs: result.received.duration.toFixed(2),
              roundTripUs: (result.sent.duration + result.received.duration).toFixed(2)
            },
            errors: result.errors
          }, null, 2)
        };
      }

      case 'protocol_decode': {
        const protocol = args.protocol || 'raw';
        let data: number[];

        if (args.data) {
          data = args.data;
        } else if (args.text) {
          data = Array.from(args.text as string).map((c: string) => c.charCodeAt(0));
        } else {
          // Default test data based on protocol
          switch (protocol) {
            case 'at_commands':
              data = Array.from('AT+CGMI\r\nManufacturer\r\nOK\r\n').map(c => c.charCodeAt(0));
              break;
            case 'nmea':
              data = Array.from('$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,47.0,M,,*47').map(c => c.charCodeAt(0));
              break;
            case 'modbus_rtu':
              data = [0x01, 0x03, 0x00, 0x00, 0x00, 0x0A, 0xC5, 0xCD]; // Read holding registers
              break;
            default:
              data = [0x48, 0x65, 0x6C, 0x6C, 0x6F];
          }
        }

        const decoded = sim.decodeProtocol(data, protocol as ProtocolType);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'protocol_decode',
            protocol: decoded.protocol,
            rawData: data.map(b => `0x${b.toString(16).padStart(2, '0')}`),
            rawText: data.map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join(''),
            decoded: decoded.decoded,
            valid: decoded.valid
          }, null, 2)
        };
      }

      case 'analyze_timing': {
        const timing = sim.analyzeTiming();
        const config = sim.getConfig();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze_timing',
            config: {
              baudRate: config.baudRate,
              dataBits: config.dataBits,
              parity: config.parity,
              stopBits: config.stopBits
            },
            timing: {
              bitDurationUs: timing.bitDuration.toFixed(4),
              frameDurationUs: timing.frameDuration.toFixed(2),
              bitsPerFrame: timing.bitsPerFrame,
              frameBreakdown: {
                startBit: 1,
                dataBits: config.dataBits,
                parityBit: config.parity !== 'none' ? 1 : 0,
                stopBits: config.stopBits
              }
            },
            performance: {
              effectiveBitrateBps: timing.effectiveBitrate.toFixed(0),
              efficiency: `${timing.efficiency.toFixed(1)}%`,
              maxThroughputBytesPerSec: timing.maxThroughput,
              overhead: `${(100 - timing.efficiency).toFixed(1)}%`
            },
            comparison: {
              configuredBaudRate: config.baudRate,
              actualDataRate: timing.effectiveBitrate.toFixed(0),
              lossPercentage: `${((1 - timing.efficiency / 100) * 100).toFixed(1)}%`
            }
          }, null, 2)
        };
      }

      case 'flow_control': {
        const action = args.flowAction || 'set_rts';
        const config = sim.getConfig();

        if (config.flowControl === 'none') {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'flow_control',
              warning: 'Flow control is disabled in current configuration',
              currentConfig: config.flowControl
            }, null, 2)
          };
        }

        let actionResult: string;
        switch (action) {
          case 'set_rts':
            sim.setRTS(true);
            actionResult = 'RTS asserted (ready to receive)';
            break;
          case 'clear_rts':
            sim.setRTS(false);
            actionResult = 'RTS de-asserted (not ready to receive)';
            break;
          case 'set_cts':
            sim.setCTS(true);
            actionResult = 'CTS asserted (clear to send)';
            break;
          case 'clear_cts':
            sim.setCTS(false);
            actionResult = 'CTS de-asserted (not clear to send)';
            break;
          case 'send_xon':
            sim.sendXON();
            actionResult = 'XON sent (resume transmission)';
            break;
          case 'send_xoff':
            sim.sendXOFF();
            actionResult = 'XOFF sent (pause transmission)';
            break;
          default:
            actionResult = 'Unknown action';
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'flow_control',
            action,
            result: actionResult,
            flowControlMode: config.flowControl,
            signals: config.flowControl === 'rts_cts' ? {
              RTS: 'Request To Send - Output signal indicating ready to receive',
              CTS: 'Clear To Send - Input signal indicating remote ready to receive'
            } : {
              XON: `0x${XON.toString(16)} (DC1) - Resume transmission`,
              XOFF: `0x${XOFF.toString(16)} (DC3) - Pause transmission`
            }
          }, null, 2)
        };
      }

      case 'send_break': {
        const durationBits = args.durationBits || 10;
        const result = sim.sendBreak(durationBits);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'send_break',
            durationBits,
            durationUs: result.duration.toFixed(2),
            bitDurationUs: result.bitDuration.toFixed(2),
            description: 'Break condition: line held LOW for duration longer than a frame',
            usage: [
              'Signal attention to remote device',
              'Reset protocol state',
              'Wake up sleeping device'
            ]
          }, null, 2)
        };
      }

      case 'get_status': {
        const config = sim.getConfig();
        const errors = sim.getErrors();
        const buffers = sim.getBufferStatus();
        const timing = sim.analyzeTiming();
        const transmissions = sim.getTransmissions();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_status',
            configuration: {
              baudRate: config.baudRate,
              format: `${config.dataBits}${config.parity.charAt(0).toUpperCase()}${config.stopBits}`,
              flowControl: config.flowControl,
              mode: config.mode,
              halfDuplex: config.halfDuplex
            },
            timing: {
              bitDurationUs: timing.bitDuration.toFixed(2),
              frameDurationUs: timing.frameDuration.toFixed(2),
              efficiency: `${timing.efficiency.toFixed(1)}%`
            },
            buffers: {
              txUsed: buffers.tx.used,
              rxUsed: buffers.rx.used,
              capacity: buffers.tx.capacity
            },
            errors: {
              total: Object.values(errors).reduce((a, b) => a + b, 0),
              breakdown: errors
            },
            statistics: {
              totalTransmissions: transmissions.length,
              txCount: transmissions.filter(t => t.direction === 'tx').length,
              rxCount: transmissions.filter(t => t.direction === 'rx').length
            }
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'UART Protocol Simulator',
            description: 'Full-featured UART serial communication tool for embedded/IoT development',
            features: {
              configuration: [
                'Baud rates from 300 to 4,000,000 bps',
                'Data bits: 5, 6, 7, 8, or 9',
                'Parity: none, odd, even, mark, space',
                'Stop bits: 1, 1.5, or 2',
                'RS-232 and RS-485 modes'
              ],
              flowControl: [
                'Hardware (RTS/CTS)',
                'Software (XON/XOFF)',
                'Half-duplex support'
              ],
              errorDetection: [
                'Framing error detection',
                'Parity error detection',
                'Buffer overrun detection',
                'Break condition handling',
                'Noise simulation'
              ],
              protocolDecoding: [
                'AT commands',
                'NMEA 0183 (GPS)',
                'Modbus RTU'
              ],
              analysis: [
                'Frame structure visualization',
                'Timing analysis',
                'Baud rate detection',
                'Loopback testing'
              ]
            },
            frameStructure: {
              startBit: '1 bit (always LOW)',
              dataBits: '5-9 bits (LSB first)',
              parityBit: '0 or 1 bit (optional)',
              stopBits: '1, 1.5, or 2 bits (always HIGH)'
            },
            commonBaudRates: [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600]
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Configure UART 115200 8N1',
                call: { operation: 'configure', baudRate: 115200, dataBits: 8, parity: 'none', stopBits: 1 }
              },
              {
                name: 'Send text data',
                call: { operation: 'send', text: 'Hello UART!' }
              },
              {
                name: 'Send hex data',
                call: { operation: 'send', data: [0x01, 0x02, 0x03, 0x04] }
              },
              {
                name: 'Analyze single byte frame',
                call: { operation: 'analyze_frame', byte: 85 }
              },
              {
                name: 'Detect baud rate from pulse widths',
                call: { operation: 'detect_baud', pulseWidths: [104, 208, 104, 312] }
              },
              {
                name: 'Simulate 5% noise',
                call: { operation: 'simulate_noise', noiseLevel: 5 }
              },
              {
                name: 'Loopback test',
                call: { operation: 'loopback_test', data: [0x55, 0xAA, 0xFF, 0x00] }
              },
              {
                name: 'Decode AT command response',
                call: { operation: 'protocol_decode', protocol: 'at_commands', text: 'AT+CGMI\r\nManufacturer\r\nOK\r\n' }
              },
              {
                name: 'Decode NMEA sentence',
                call: { operation: 'protocol_decode', protocol: 'nmea', text: '$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,47.0,M,,*47' }
              },
              {
                name: 'Configure with flow control',
                call: { operation: 'configure', baudRate: 9600, flowControl: 'rts_cts' }
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

export function isuartprotocolAvailable(): boolean { return true; }
