// ============================================================================
// MODBUS TOOL - COMPREHENSIVE INDUSTRIAL PROTOCOL SIMULATOR
// ============================================================================
// Full Modbus RTU and TCP protocol simulation with:
// - All standard function codes (01-06, 15-16)
// - CRC-16 calculation for RTU
// - Transaction ID management for TCP
// - Slave device emulation with register banks
// - Master request generation
// - Exception responses
// - Timing simulation
// Pure TypeScript implementation - no external dependencies.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface ModbusDevice {
  id: string;
  address: number;
  protocol: 'rtu' | 'tcp';
  coils: boolean[];
  discreteInputs: boolean[];
  holdingRegisters: number[];
  inputRegisters: number[];
  transactionId: number;
  lastActivity: number;
  exceptionCount: number;
  frameCount: number;
}

interface ModbusFrame {
  raw: string;
  address: number;
  functionCode: number;
  data: number[];
  crc?: number;
  transactionId?: number;
  protocolId?: number;
  length?: number;
  isValid: boolean;
  errors: string[];
}

interface ModbusResponse {
  success: boolean;
  frame: ModbusFrame;
  data?: boolean[] | number[];
  exception?: {
    code: number;
    message: string;
  };
  timing?: {
    requestTime: number;
    responseTime: number;
    interFrameDelay: number;
  };
}

interface TimingSimulation {
  baudRate: number;
  characterTime: number;
  interCharacterTimeout: number;
  interFrameDelay: number;
  responseTimeout: number;
}

// ============================================================================
// MODBUS CRC-16 CALCULATION
// ============================================================================

// CRC-16 lookup table (precomputed for Modbus polynomial 0xA001)
const CRC16_TABLE: number[] = [];
for (let i = 0; i < 256; i++) {
  let crc = i;
  for (let j = 0; j < 8; j++) {
    crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1;
  }
  CRC16_TABLE[i] = crc;
}

function calculateCRC16(data: number[]): number {
  let crc = 0xffff;
  for (const byte of data) {
    crc = (crc >> 8) ^ CRC16_TABLE[(crc ^ byte) & 0xff];
  }
  return crc;
}

function verifyCRC16(frame: number[]): boolean {
  if (frame.length < 4) return false;
  const data = frame.slice(0, -2);
  const receivedCrc = frame[frame.length - 2] | (frame[frame.length - 1] << 8);
  return calculateCRC16(data) === receivedCrc;
}

// ============================================================================
// MODBUS EXCEPTION CODES
// ============================================================================

const EXCEPTION_CODES: Record<number, string> = {
  0x01: 'ILLEGAL_FUNCTION',
  0x02: 'ILLEGAL_DATA_ADDRESS',
  0x03: 'ILLEGAL_DATA_VALUE',
  0x04: 'SLAVE_DEVICE_FAILURE',
  0x05: 'ACKNOWLEDGE',
  0x06: 'SLAVE_DEVICE_BUSY',
};

function createExceptionResponse(
  address: number,
  functionCode: number,
  exceptionCode: number,
  protocol: 'rtu' | 'tcp',
  transactionId?: number
): number[] {
  const response: number[] = [];

  if (protocol === 'tcp') {
    // TCP header
    response.push((transactionId || 0) >> 8, (transactionId || 0) & 0xff);
    response.push(0x00, 0x00); // Protocol ID
    response.push(0x00, 0x03); // Length
    response.push(address);
  } else {
    response.push(address);
  }

  response.push(functionCode | 0x80); // Exception function code
  response.push(exceptionCode);

  if (protocol === 'rtu') {
    const crc = calculateCRC16(response);
    response.push(crc & 0xff, crc >> 8);
  }

  return response;
}

// ============================================================================
// TIMING SIMULATION
// ============================================================================

function calculateTiming(baudRate: number): TimingSimulation {
  // Character time: 11 bits per character (1 start + 8 data + parity + 1 stop)
  const characterTime = (11 / baudRate) * 1000; // in milliseconds

  return {
    baudRate,
    characterTime,
    // Inter-character timeout: 1.5 character times
    interCharacterTimeout: characterTime * 1.5,
    // Inter-frame delay: 3.5 character times (minimum)
    interFrameDelay: characterTime * 3.5,
    // Response timeout: typically 100-1000ms
    responseTimeout: Math.max(100, characterTime * 100),
  };
}

// ============================================================================
// DEVICE MANAGEMENT
// ============================================================================

const devices: Map<string, ModbusDevice> = new Map();

function createDevice(
  id: string,
  address: number,
  protocol: 'rtu' | 'tcp',
  coilCount: number = 1000,
  registerCount: number = 1000
): ModbusDevice {
  const device: ModbusDevice = {
    id,
    address,
    protocol,
    coils: new Array(coilCount).fill(false),
    discreteInputs: new Array(coilCount).fill(false),
    holdingRegisters: new Array(registerCount).fill(0),
    inputRegisters: new Array(registerCount).fill(0),
    transactionId: 0,
    lastActivity: Date.now(),
    exceptionCount: 0,
    frameCount: 0,
  };

  // Initialize with some sample data
  for (let i = 0; i < Math.min(16, coilCount); i++) {
    device.coils[i] = i % 2 === 0;
    device.discreteInputs[i] = i % 3 === 0;
  }
  for (let i = 0; i < Math.min(100, registerCount); i++) {
    device.holdingRegisters[i] = i * 10;
    device.inputRegisters[i] = Math.floor(Math.random() * 65536);
  }

  devices.set(id, device);
  return device;
}

function getDevice(id: string): ModbusDevice | undefined {
  return devices.get(id);
}

function getNextTransactionId(device: ModbusDevice): number {
  device.transactionId = (device.transactionId + 1) & 0xffff;
  return device.transactionId;
}

// ============================================================================
// FRAME PARSING
// ============================================================================

function parseRTUFrame(hexString: string): ModbusFrame {
  const errors: string[] = [];
  const bytes = hexStringToBytes(hexString);

  if (bytes.length < 4) {
    return {
      raw: hexString,
      address: 0,
      functionCode: 0,
      data: [],
      isValid: false,
      errors: ['Frame too short (minimum 4 bytes for RTU)'],
    };
  }

  const address = bytes[0];
  const functionCode = bytes[1];
  const data = bytes.slice(2, -2);
  const crc = bytes[bytes.length - 2] | (bytes[bytes.length - 1] << 8);

  if (!verifyCRC16(bytes)) {
    errors.push('CRC check failed');
  }

  if (address === 0 && functionCode !== 0x08) {
    // Broadcast only valid for diagnostics
  }

  return {
    raw: hexString,
    address,
    functionCode,
    data,
    crc,
    isValid: errors.length === 0,
    errors,
  };
}

function parseTCPFrame(hexString: string): ModbusFrame {
  const errors: string[] = [];
  const bytes = hexStringToBytes(hexString);

  if (bytes.length < 8) {
    return {
      raw: hexString,
      address: 0,
      functionCode: 0,
      data: [],
      isValid: false,
      errors: ['Frame too short (minimum 8 bytes for TCP)'],
    };
  }

  const transactionId = (bytes[0] << 8) | bytes[1];
  const protocolId = (bytes[2] << 8) | bytes[3];
  const length = (bytes[4] << 8) | bytes[5];
  const address = bytes[6];
  const functionCode = bytes[7];
  const data = bytes.slice(8);

  if (protocolId !== 0) {
    errors.push(`Invalid protocol ID: ${protocolId} (expected 0)`);
  }

  if (length !== bytes.length - 6) {
    errors.push(`Length mismatch: header says ${length}, actual ${bytes.length - 6}`);
  }

  return {
    raw: hexString,
    address,
    functionCode,
    data,
    transactionId,
    protocolId,
    length,
    isValid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// FRAME BUILDING
// ============================================================================

function buildRTUFrame(address: number, functionCode: number, data: number[]): number[] {
  const frame = [address, functionCode, ...data];
  const crc = calculateCRC16(frame);
  frame.push(crc & 0xff, crc >> 8);
  return frame;
}

function buildTCPFrame(
  transactionId: number,
  address: number,
  functionCode: number,
  data: number[]
): number[] {
  const pduLength = 2 + data.length; // Unit ID + Function Code + Data
  return [
    (transactionId >> 8) & 0xff,
    transactionId & 0xff,
    0x00,
    0x00, // Protocol ID
    (pduLength >> 8) & 0xff,
    pduLength & 0xff,
    address,
    functionCode,
    ...data,
  ];
}

// ============================================================================
// FUNCTION CODE HANDLERS
// ============================================================================

// FC01: Read Coils
function handleReadCoils(
  device: ModbusDevice,
  startAddress: number,
  quantity: number
): ModbusResponse {
  if (quantity < 1 || quantity > 2000) {
    return createExceptionResult(device, 0x01, 0x03);
  }

  if (startAddress + quantity > device.coils.length) {
    return createExceptionResult(device, 0x01, 0x02);
  }

  const coilValues = device.coils.slice(startAddress, startAddress + quantity);
  const byteCount = Math.ceil(quantity / 8);
  const data: number[] = [byteCount];

  for (let i = 0; i < byteCount; i++) {
    let byte = 0;
    for (let j = 0; j < 8 && i * 8 + j < quantity; j++) {
      if (coilValues[i * 8 + j]) {
        byte |= 1 << j;
      }
    }
    data.push(byte);
  }

  return createSuccessResult(device, 0x01, data, coilValues);
}

// FC02: Read Discrete Inputs
function handleReadDiscreteInputs(
  device: ModbusDevice,
  startAddress: number,
  quantity: number
): ModbusResponse {
  if (quantity < 1 || quantity > 2000) {
    return createExceptionResult(device, 0x02, 0x03);
  }

  if (startAddress + quantity > device.discreteInputs.length) {
    return createExceptionResult(device, 0x02, 0x02);
  }

  const inputValues = device.discreteInputs.slice(startAddress, startAddress + quantity);
  const byteCount = Math.ceil(quantity / 8);
  const data: number[] = [byteCount];

  for (let i = 0; i < byteCount; i++) {
    let byte = 0;
    for (let j = 0; j < 8 && i * 8 + j < quantity; j++) {
      if (inputValues[i * 8 + j]) {
        byte |= 1 << j;
      }
    }
    data.push(byte);
  }

  return createSuccessResult(device, 0x02, data, inputValues);
}

// FC03: Read Holding Registers
function handleReadHoldingRegisters(
  device: ModbusDevice,
  startAddress: number,
  quantity: number
): ModbusResponse {
  if (quantity < 1 || quantity > 125) {
    return createExceptionResult(device, 0x03, 0x03);
  }

  if (startAddress + quantity > device.holdingRegisters.length) {
    return createExceptionResult(device, 0x03, 0x02);
  }

  const registerValues = device.holdingRegisters.slice(startAddress, startAddress + quantity);
  const data: number[] = [quantity * 2];

  for (const value of registerValues) {
    data.push((value >> 8) & 0xff, value & 0xff);
  }

  return createSuccessResult(device, 0x03, data, registerValues);
}

// FC04: Read Input Registers
function handleReadInputRegisters(
  device: ModbusDevice,
  startAddress: number,
  quantity: number
): ModbusResponse {
  if (quantity < 1 || quantity > 125) {
    return createExceptionResult(device, 0x04, 0x03);
  }

  if (startAddress + quantity > device.inputRegisters.length) {
    return createExceptionResult(device, 0x04, 0x02);
  }

  const registerValues = device.inputRegisters.slice(startAddress, startAddress + quantity);
  const data: number[] = [quantity * 2];

  for (const value of registerValues) {
    data.push((value >> 8) & 0xff, value & 0xff);
  }

  return createSuccessResult(device, 0x04, data, registerValues);
}

// FC05: Write Single Coil
function handleWriteSingleCoil(
  device: ModbusDevice,
  address: number,
  value: number
): ModbusResponse {
  if (address >= device.coils.length) {
    return createExceptionResult(device, 0x05, 0x02);
  }

  if (value !== 0x0000 && value !== 0xff00) {
    return createExceptionResult(device, 0x05, 0x03);
  }

  device.coils[address] = value === 0xff00;
  const data = [(address >> 8) & 0xff, address & 0xff, (value >> 8) & 0xff, value & 0xff];

  return createSuccessResult(device, 0x05, data, [device.coils[address]]);
}

// FC06: Write Single Register
function handleWriteSingleRegister(
  device: ModbusDevice,
  address: number,
  value: number
): ModbusResponse {
  if (address >= device.holdingRegisters.length) {
    return createExceptionResult(device, 0x06, 0x02);
  }

  if (value < 0 || value > 65535) {
    return createExceptionResult(device, 0x06, 0x03);
  }

  device.holdingRegisters[address] = value;
  const data = [(address >> 8) & 0xff, address & 0xff, (value >> 8) & 0xff, value & 0xff];

  return createSuccessResult(device, 0x06, data, [value]);
}

// FC15: Write Multiple Coils
function handleWriteMultipleCoils(
  device: ModbusDevice,
  startAddress: number,
  quantity: number,
  values: boolean[]
): ModbusResponse {
  if (quantity < 1 || quantity > 1968) {
    return createExceptionResult(device, 0x0f, 0x03);
  }

  if (startAddress + quantity > device.coils.length) {
    return createExceptionResult(device, 0x0f, 0x02);
  }

  for (let i = 0; i < quantity; i++) {
    device.coils[startAddress + i] = values[i] || false;
  }

  const data = [
    (startAddress >> 8) & 0xff,
    startAddress & 0xff,
    (quantity >> 8) & 0xff,
    quantity & 0xff,
  ];

  return createSuccessResult(device, 0x0f, data, values.slice(0, quantity));
}

// FC16: Write Multiple Registers
function handleWriteMultipleRegisters(
  device: ModbusDevice,
  startAddress: number,
  values: number[]
): ModbusResponse {
  const quantity = values.length;

  if (quantity < 1 || quantity > 123) {
    return createExceptionResult(device, 0x10, 0x03);
  }

  if (startAddress + quantity > device.holdingRegisters.length) {
    return createExceptionResult(device, 0x10, 0x02);
  }

  for (let i = 0; i < quantity; i++) {
    device.holdingRegisters[startAddress + i] = values[i] & 0xffff;
  }

  const data = [
    (startAddress >> 8) & 0xff,
    startAddress & 0xff,
    (quantity >> 8) & 0xff,
    quantity & 0xff,
  ];

  return createSuccessResult(device, 0x10, data, values);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createSuccessResult(
  device: ModbusDevice,
  functionCode: number,
  responseData: number[],
  values: boolean[] | number[]
): ModbusResponse {
  device.frameCount++;
  device.lastActivity = Date.now();

  let frameBytes: number[];
  if (device.protocol === 'tcp') {
    const txId = getNextTransactionId(device);
    frameBytes = buildTCPFrame(txId, device.address, functionCode, responseData);
  } else {
    frameBytes = buildRTUFrame(device.address, functionCode, responseData);
  }

  return {
    success: true,
    frame: {
      raw: bytesToHexString(frameBytes),
      address: device.address,
      functionCode,
      data: responseData,
      crc: device.protocol === 'rtu' ? calculateCRC16(frameBytes.slice(0, -2)) : undefined,
      transactionId: device.protocol === 'tcp' ? device.transactionId : undefined,
      isValid: true,
      errors: [],
    },
    data: values,
    timing: {
      requestTime: Date.now(),
      responseTime: Date.now() + Math.random() * 10,
      interFrameDelay: 3.5,
    },
  };
}

function createExceptionResult(
  device: ModbusDevice,
  functionCode: number,
  exceptionCode: number
): ModbusResponse {
  device.frameCount++;
  device.exceptionCount++;
  device.lastActivity = Date.now();

  const frameBytes = createExceptionResponse(
    device.address,
    functionCode,
    exceptionCode,
    device.protocol,
    device.protocol === 'tcp' ? getNextTransactionId(device) : undefined
  );

  return {
    success: false,
    frame: {
      raw: bytesToHexString(frameBytes),
      address: device.address,
      functionCode: functionCode | 0x80,
      data: [exceptionCode],
      isValid: true,
      errors: [],
    },
    exception: {
      code: exceptionCode,
      message: EXCEPTION_CODES[exceptionCode] || 'UNKNOWN_EXCEPTION',
    },
  };
}

function hexStringToBytes(hex: string): number[] {
  const cleanHex = hex.replace(/\s+/g, '').replace(/^0x/i, '');
  const bytes: number[] = [];
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes.push(parseInt(cleanHex.substr(i, 2), 16));
  }
  return bytes;
}

function bytesToHexString(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

// ============================================================================
// MASTER/SLAVE SIMULATION
// ============================================================================

function simulateMasterRequest(
  deviceId: string,
  functionCode: number,
  startAddress: number,
  quantityOrValue: number,
  values?: number[]
): { request: string; requestBytes: number[]; description: string } {
  const device = getDevice(deviceId);
  if (!device) {
    throw new Error(`Device not found: ${deviceId}`);
  }

  let data: number[] = [];
  let description = '';

  switch (functionCode) {
    case 0x01: // Read Coils
      data = [
        (startAddress >> 8) & 0xff,
        startAddress & 0xff,
        (quantityOrValue >> 8) & 0xff,
        quantityOrValue & 0xff,
      ];
      description = `Read ${quantityOrValue} coils starting at address ${startAddress}`;
      break;

    case 0x02: // Read Discrete Inputs
      data = [
        (startAddress >> 8) & 0xff,
        startAddress & 0xff,
        (quantityOrValue >> 8) & 0xff,
        quantityOrValue & 0xff,
      ];
      description = `Read ${quantityOrValue} discrete inputs starting at address ${startAddress}`;
      break;

    case 0x03: // Read Holding Registers
      data = [
        (startAddress >> 8) & 0xff,
        startAddress & 0xff,
        (quantityOrValue >> 8) & 0xff,
        quantityOrValue & 0xff,
      ];
      description = `Read ${quantityOrValue} holding registers starting at address ${startAddress}`;
      break;

    case 0x04: // Read Input Registers
      data = [
        (startAddress >> 8) & 0xff,
        startAddress & 0xff,
        (quantityOrValue >> 8) & 0xff,
        quantityOrValue & 0xff,
      ];
      description = `Read ${quantityOrValue} input registers starting at address ${startAddress}`;
      break;

    case 0x05: // Write Single Coil
      data = [
        (startAddress >> 8) & 0xff,
        startAddress & 0xff,
        quantityOrValue ? 0xff : 0x00,
        0x00,
      ];
      description = `Write single coil at address ${startAddress} to ${quantityOrValue ? 'ON' : 'OFF'}`;
      break;

    case 0x06: // Write Single Register
      data = [
        (startAddress >> 8) & 0xff,
        startAddress & 0xff,
        (quantityOrValue >> 8) & 0xff,
        quantityOrValue & 0xff,
      ];
      description = `Write single register at address ${startAddress} with value ${quantityOrValue}`;
      break;

    case 0x0f: // Write Multiple Coils
      {
        const byteCount = Math.ceil(quantityOrValue / 8);
        data = [
          (startAddress >> 8) & 0xff,
          startAddress & 0xff,
          (quantityOrValue >> 8) & 0xff,
          quantityOrValue & 0xff,
          byteCount,
        ];
        // Pack coil values into bytes
        for (let i = 0; i < byteCount; i++) {
          let byte = 0;
          for (let j = 0; j < 8 && i * 8 + j < quantityOrValue; j++) {
            if (values && values[i * 8 + j]) {
              byte |= 1 << j;
            }
          }
          data.push(byte);
        }
        description = `Write ${quantityOrValue} coils starting at address ${startAddress}`;
      }
      break;

    case 0x10: // Write Multiple Registers
      {
        const regCount = values?.length || 0;
        data = [
          (startAddress >> 8) & 0xff,
          startAddress & 0xff,
          (regCount >> 8) & 0xff,
          regCount & 0xff,
          regCount * 2,
        ];
        for (const value of values || []) {
          data.push((value >> 8) & 0xff, value & 0xff);
        }
        description = `Write ${regCount} registers starting at address ${startAddress}`;
      }
      break;

    default:
      throw new Error(`Unsupported function code: ${functionCode}`);
  }

  let requestBytes: number[];
  if (device.protocol === 'tcp') {
    const txId = getNextTransactionId(device);
    requestBytes = buildTCPFrame(txId, device.address, functionCode, data);
  } else {
    requestBytes = buildRTUFrame(device.address, functionCode, data);
  }

  return {
    request: bytesToHexString(requestBytes),
    requestBytes,
    description,
  };
}

function simulateSlaveResponse(
  deviceId: string,
  functionCode: number,
  startAddress: number,
  quantityOrValue: number,
  values?: number[] | boolean[]
): ModbusResponse {
  const device = getDevice(deviceId);
  if (!device) {
    throw new Error(`Device not found: ${deviceId}`);
  }

  switch (functionCode) {
    case 0x01:
      return handleReadCoils(device, startAddress, quantityOrValue);
    case 0x02:
      return handleReadDiscreteInputs(device, startAddress, quantityOrValue);
    case 0x03:
      return handleReadHoldingRegisters(device, startAddress, quantityOrValue);
    case 0x04:
      return handleReadInputRegisters(device, startAddress, quantityOrValue);
    case 0x05:
      return handleWriteSingleCoil(device, startAddress, quantityOrValue ? 0xff00 : 0x0000);
    case 0x06:
      return handleWriteSingleRegister(device, startAddress, quantityOrValue);
    case 0x0f:
      return handleWriteMultipleCoils(
        device,
        startAddress,
        quantityOrValue,
        (values as boolean[]) || []
      );
    case 0x10:
      return handleWriteMultipleRegisters(device, startAddress, (values as number[]) || []);
    default:
      return createExceptionResult(device, functionCode, 0x01);
  }
}

// ============================================================================
// FRAME ANALYSIS
// ============================================================================

function analyzeFrame(
  hexString: string,
  protocol: 'rtu' | 'tcp'
): {
  frame: ModbusFrame;
  interpretation: string;
  functionCodeName: string;
  isRequest: boolean;
  timing?: TimingSimulation;
} {
  const frame = protocol === 'rtu' ? parseRTUFrame(hexString) : parseTCPFrame(hexString);

  const functionCodeNames: Record<number, string> = {
    0x01: 'Read Coils',
    0x02: 'Read Discrete Inputs',
    0x03: 'Read Holding Registers',
    0x04: 'Read Input Registers',
    0x05: 'Write Single Coil',
    0x06: 'Write Single Register',
    0x0f: 'Write Multiple Coils',
    0x10: 'Write Multiple Registers',
    0x81: 'Read Coils Exception',
    0x82: 'Read Discrete Inputs Exception',
    0x83: 'Read Holding Registers Exception',
    0x84: 'Read Input Registers Exception',
    0x85: 'Write Single Coil Exception',
    0x86: 'Write Single Register Exception',
    0x8f: 'Write Multiple Coils Exception',
    0x90: 'Write Multiple Registers Exception',
  };

  const isException = frame.functionCode > 0x80;
  const baseFunctionCode = isException ? frame.functionCode & 0x7f : frame.functionCode;
  const functionCodeName = functionCodeNames[frame.functionCode] || `Unknown (0x${frame.functionCode.toString(16)})`;

  let interpretation = '';
  const isRequest = !isException && [0x01, 0x02, 0x03, 0x04].includes(baseFunctionCode)
    ? frame.data.length === 4
    : true;

  if (isException) {
    interpretation = `Exception response - ${EXCEPTION_CODES[frame.data[0]] || 'Unknown'}`;
  } else {
    switch (baseFunctionCode) {
      case 0x01:
      case 0x02:
        if (frame.data.length === 4) {
          const startAddr = (frame.data[0] << 8) | frame.data[1];
          const quantity = (frame.data[2] << 8) | frame.data[3];
          interpretation = `Request: Read ${quantity} ${baseFunctionCode === 0x01 ? 'coils' : 'discrete inputs'} from address ${startAddr}`;
        } else {
          interpretation = `Response: ${frame.data[0]} bytes of coil/input data`;
        }
        break;
      case 0x03:
      case 0x04:
        if (frame.data.length === 4) {
          const startAddr = (frame.data[0] << 8) | frame.data[1];
          const quantity = (frame.data[2] << 8) | frame.data[3];
          interpretation = `Request: Read ${quantity} ${baseFunctionCode === 0x03 ? 'holding' : 'input'} registers from address ${startAddr}`;
        } else {
          const byteCount = frame.data[0];
          interpretation = `Response: ${byteCount / 2} registers returned`;
        }
        break;
      case 0x05:
        {
          const addr = (frame.data[0] << 8) | frame.data[1];
          const value = (frame.data[2] << 8) | frame.data[3];
          interpretation = `Write single coil at ${addr} to ${value === 0xff00 ? 'ON' : 'OFF'}`;
        }
        break;
      case 0x06:
        {
          const addr = (frame.data[0] << 8) | frame.data[1];
          const value = (frame.data[2] << 8) | frame.data[3];
          interpretation = `Write single register at ${addr} with value ${value}`;
        }
        break;
      case 0x0f:
      case 0x10:
        {
          const startAddr = (frame.data[0] << 8) | frame.data[1];
          const quantity = (frame.data[2] << 8) | frame.data[3];
          interpretation = `Write ${quantity} ${baseFunctionCode === 0x0f ? 'coils' : 'registers'} starting at ${startAddr}`;
        }
        break;
      default:
        interpretation = 'Unknown function code';
    }
  }

  return {
    frame,
    interpretation,
    functionCodeName,
    isRequest,
    timing: protocol === 'rtu' ? calculateTiming(9600) : undefined,
  };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const modbusTool: UnifiedTool = {
  name: 'modbus',
  description: `Comprehensive Modbus industrial protocol simulator.

Supports:
- Modbus RTU (serial with CRC-16) and TCP protocols
- All standard function codes: Read Coils (01), Read Discrete Inputs (02),
  Read Holding Registers (03), Read Input Registers (04), Write Single Coil (05),
  Write Single Register (06), Write Multiple Coils (15), Write Multiple Registers (16)
- Slave device emulation with register banks
- Master request generation
- Exception responses (01-06)
- CRC-16 calculation and validation
- Frame analysis and interpretation
- Timing simulation

Operations:
- create_device: Create a new Modbus slave device
- read_coils: Read coil values (FC01)
- read_discrete_inputs: Read discrete input values (FC02)
- read_holding_registers: Read holding register values (FC03)
- read_input_registers: Read input register values (FC04)
- write_coil: Write single coil (FC05)
- write_register: Write single register (FC06)
- write_multiple_coils: Write multiple coils (FC15)
- write_multiple_registers: Write multiple registers (FC16)
- analyze_frame: Analyze a Modbus frame
- simulate_master: Generate master request frame
- simulate_slave: Simulate slave response`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'create_device',
          'read_coils',
          'read_discrete_inputs',
          'read_holding_registers',
          'read_input_registers',
          'write_coil',
          'write_register',
          'write_multiple_coils',
          'write_multiple_registers',
          'analyze_frame',
          'simulate_master',
          'simulate_slave',
        ],
        description: 'Operation to perform',
      },
      device_id: {
        type: 'string',
        description: 'Device identifier',
      },
      address: {
        type: 'number',
        description: 'Modbus slave address (1-247) or register address',
      },
      protocol: {
        type: 'string',
        enum: ['rtu', 'tcp'],
        description: 'Modbus protocol variant',
      },
      start_address: {
        type: 'number',
        description: 'Starting address for read/write operations',
      },
      quantity: {
        type: 'number',
        description: 'Number of coils/registers to read/write',
      },
      value: {
        type: 'number',
        description: 'Value to write (for single write operations)',
      },
      values: {
        type: 'array',
        items: { type: 'number' },
        description: 'Values to write (for multiple write operations)',
      },
      function_code: {
        type: 'number',
        description: 'Modbus function code (1-16)',
      },
      frame: {
        type: 'string',
        description: 'Hex string of Modbus frame to analyze',
      },
      coil_count: {
        type: 'number',
        description: 'Number of coils for device (default 1000)',
      },
      register_count: {
        type: 'number',
        description: 'Number of registers for device (default 1000)',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executemodbus(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'create_device': {
        const deviceId = args.device_id || `device_${Date.now()}`;
        const address = args.address || 1;
        const protocol = args.protocol || 'rtu';
        const coilCount = args.coil_count || 1000;
        const registerCount = args.register_count || 1000;

        const device = createDevice(deviceId, address, protocol, coilCount, registerCount);

        result = {
          operation: 'create_device',
          device: {
            id: device.id,
            address: device.address,
            protocol: device.protocol,
            coilCount: device.coils.length,
            registerCount: device.holdingRegisters.length,
            transactionId: device.transactionId,
          },
          message: `Created Modbus ${protocol.toUpperCase()} device at address ${address}`,
        };
        break;
      }

      case 'read_coils': {
        const device = getDevice(args.device_id);
        if (!device) throw new Error(`Device not found: ${args.device_id}`);

        const response = handleReadCoils(device, args.start_address || 0, args.quantity || 8);

        result = {
          operation: 'read_coils',
          device_id: args.device_id,
          start_address: args.start_address || 0,
          quantity: args.quantity || 8,
          response: {
            success: response.success,
            frame: response.frame.raw,
            values: response.data,
            exception: response.exception,
          },
        };
        break;
      }

      case 'read_discrete_inputs': {
        const device = getDevice(args.device_id);
        if (!device) throw new Error(`Device not found: ${args.device_id}`);

        const response = handleReadDiscreteInputs(
          device,
          args.start_address || 0,
          args.quantity || 8
        );

        result = {
          operation: 'read_discrete_inputs',
          device_id: args.device_id,
          start_address: args.start_address || 0,
          quantity: args.quantity || 8,
          response: {
            success: response.success,
            frame: response.frame.raw,
            values: response.data,
            exception: response.exception,
          },
        };
        break;
      }

      case 'read_holding_registers': {
        const device = getDevice(args.device_id);
        if (!device) throw new Error(`Device not found: ${args.device_id}`);

        const response = handleReadHoldingRegisters(
          device,
          args.start_address || 0,
          args.quantity || 10
        );

        result = {
          operation: 'read_holding_registers',
          device_id: args.device_id,
          start_address: args.start_address || 0,
          quantity: args.quantity || 10,
          response: {
            success: response.success,
            frame: response.frame.raw,
            values: response.data,
            exception: response.exception,
          },
        };
        break;
      }

      case 'read_input_registers': {
        const device = getDevice(args.device_id);
        if (!device) throw new Error(`Device not found: ${args.device_id}`);

        const response = handleReadInputRegisters(
          device,
          args.start_address || 0,
          args.quantity || 10
        );

        result = {
          operation: 'read_input_registers',
          device_id: args.device_id,
          start_address: args.start_address || 0,
          quantity: args.quantity || 10,
          response: {
            success: response.success,
            frame: response.frame.raw,
            values: response.data,
            exception: response.exception,
          },
        };
        break;
      }

      case 'write_coil': {
        const device = getDevice(args.device_id);
        if (!device) throw new Error(`Device not found: ${args.device_id}`);

        const response = handleWriteSingleCoil(
          device,
          args.address || 0,
          args.value ? 0xff00 : 0x0000
        );

        result = {
          operation: 'write_coil',
          device_id: args.device_id,
          address: args.address || 0,
          value: !!args.value,
          response: {
            success: response.success,
            frame: response.frame.raw,
            exception: response.exception,
          },
        };
        break;
      }

      case 'write_register': {
        const device = getDevice(args.device_id);
        if (!device) throw new Error(`Device not found: ${args.device_id}`);

        const response = handleWriteSingleRegister(device, args.address || 0, args.value || 0);

        result = {
          operation: 'write_register',
          device_id: args.device_id,
          address: args.address || 0,
          value: args.value || 0,
          response: {
            success: response.success,
            frame: response.frame.raw,
            exception: response.exception,
          },
        };
        break;
      }

      case 'write_multiple_coils': {
        const device = getDevice(args.device_id);
        if (!device) throw new Error(`Device not found: ${args.device_id}`);

        const values = (args.values || []).map((v: number | boolean) => !!v);
        const response = handleWriteMultipleCoils(
          device,
          args.start_address || 0,
          values.length,
          values
        );

        result = {
          operation: 'write_multiple_coils',
          device_id: args.device_id,
          start_address: args.start_address || 0,
          values,
          response: {
            success: response.success,
            frame: response.frame.raw,
            exception: response.exception,
          },
        };
        break;
      }

      case 'write_multiple_registers': {
        const device = getDevice(args.device_id);
        if (!device) throw new Error(`Device not found: ${args.device_id}`);

        const values = args.values || [];
        const response = handleWriteMultipleRegisters(device, args.start_address || 0, values);

        result = {
          operation: 'write_multiple_registers',
          device_id: args.device_id,
          start_address: args.start_address || 0,
          values,
          response: {
            success: response.success,
            frame: response.frame.raw,
            exception: response.exception,
          },
        };
        break;
      }

      case 'analyze_frame': {
        const protocol = args.protocol || 'rtu';
        const analysis = analyzeFrame(args.frame || '', protocol);

        result = {
          operation: 'analyze_frame',
          protocol,
          analysis: {
            frame: analysis.frame,
            functionCodeName: analysis.functionCodeName,
            interpretation: analysis.interpretation,
            isRequest: analysis.isRequest,
            timing: analysis.timing,
          },
        };
        break;
      }

      case 'simulate_master': {
        const { request, requestBytes, description } = simulateMasterRequest(
          args.device_id,
          args.function_code || 0x03,
          args.start_address || 0,
          args.quantity || args.value || 10,
          args.values
        );

        result = {
          operation: 'simulate_master',
          device_id: args.device_id,
          function_code: args.function_code || 0x03,
          request: {
            frame: request,
            bytes: requestBytes,
            description,
          },
        };
        break;
      }

      case 'simulate_slave': {
        const response = simulateSlaveResponse(
          args.device_id,
          args.function_code || 0x03,
          args.start_address || 0,
          args.quantity || args.value || 10,
          args.values
        );

        result = {
          operation: 'simulate_slave',
          device_id: args.device_id,
          function_code: args.function_code || 0x03,
          response: {
            success: response.success,
            frame: response.frame.raw,
            data: response.data,
            exception: response.exception,
            timing: response.timing,
          },
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: id,
      content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isError: true,
    };
  }
}

export function ismodbusAvailable(): boolean {
  return true;
}
