import { describe, it, expect } from 'vitest';
import { executeBarcode, isBarcodeAvailable, barcodeTool } from './barcode-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'generate_barcode', arguments: args };
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('barcodeTool metadata', () => {
  it('should have correct name', () => {
    expect(barcodeTool.name).toBe('generate_barcode');
  });

  it('should require data', () => {
    expect(barcodeTool.parameters.required).toContain('data');
  });
});

describe('isBarcodeAvailable', () => {
  it('should return true', async () => {
    expect(await isBarcodeAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Format validation (errors - these don't require canvas)
// -------------------------------------------------------------------
describe('executeBarcode - format validation errors', () => {
  it('should reject invalid EAN13', async () => {
    const res = await executeBarcode(makeCall({ data: 'abc', format: 'EAN13' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('EAN13');
  });

  it('should reject invalid EAN8', async () => {
    const res = await executeBarcode(makeCall({ data: '123', format: 'EAN8' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('EAN8');
  });

  it('should reject invalid UPC', async () => {
    const res = await executeBarcode(makeCall({ data: '123', format: 'UPC' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('UPC');
  });

  it('should reject invalid ITF14', async () => {
    const res = await executeBarcode(makeCall({ data: '123', format: 'ITF14' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('ITF14');
  });

  it('should reject non-numeric MSI', async () => {
    const res = await executeBarcode(makeCall({ data: 'abc', format: 'MSI' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('MSI');
  });

  it('should reject out-of-range pharmacode', async () => {
    const res = await executeBarcode(makeCall({ data: '1', format: 'pharmacode' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Pharmacode');
  });

  it('should reject invalid codabar', async () => {
    const res = await executeBarcode(makeCall({ data: '123', format: 'codabar' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Codabar');
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeBarcode - errors', () => {
  it('should error without data', async () => {
    const res = await executeBarcode(makeCall({}));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('data');
  });

  it('should return toolCallId', async () => {
    const res = await executeBarcode({
      id: 'my-id',
      name: 'generate_barcode',
      arguments: { data: 'test' },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
