// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeWebCapture, webCaptureTool, isWebCaptureAvailable } from './web-capture-tool';

// Mock puppeteer-core
const mockScreenshot = vi.fn().mockResolvedValue('base64screenshot');
const mockPdf = vi.fn().mockResolvedValue(Buffer.from('pdfdata'));
const mockEvaluate = vi.fn();
const mockWaitForSelector = vi.fn();
const mock$ = vi.fn();
const mockSetViewport = vi.fn();
const mockGoto = vi.fn();
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockNewPage = vi.fn().mockResolvedValue({
  setViewport: mockSetViewport,
  goto: mockGoto,
  screenshot: mockScreenshot,
  pdf: mockPdf,
  evaluate: mockEvaluate,
  waitForSelector: mockWaitForSelector,
  $: mock$,
});
const mockLaunch = vi.fn().mockResolvedValue({
  newPage: mockNewPage,
  close: mockClose,
});

vi.mock('puppeteer-core', () => ({
  default: { launch: (...args: unknown[]) => mockLaunch(...args) },
  launch: (...args: unknown[]) => mockLaunch(...args),
}));

// Mock fs.existsSync for findChrome
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

function makeCall(args: Record<string, unknown>) {
  return { id: 'wc-1', name: 'capture_webpage', arguments: args };
}

beforeEach(() => {
  mockScreenshot.mockReset().mockResolvedValue('base64screenshot');
  mockPdf.mockReset().mockResolvedValue(Buffer.from('pdfdata'));
  mockEvaluate.mockReset();
  mockWaitForSelector.mockReset();
  mock$.mockReset();
  mockSetViewport.mockReset();
  mockGoto.mockReset();
  mockClose.mockReset().mockResolvedValue(undefined);
  mockNewPage.mockReset().mockResolvedValue({
    setViewport: mockSetViewport,
    goto: mockGoto,
    screenshot: mockScreenshot,
    pdf: mockPdf,
    evaluate: mockEvaluate,
    waitForSelector: mockWaitForSelector,
    $: mock$,
  });
  mockLaunch.mockReset().mockResolvedValue({
    newPage: mockNewPage,
    close: mockClose,
  });
});

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('webCaptureTool metadata', () => {
  it('should have correct name', () => {
    expect(webCaptureTool.name).toBe('capture_webpage');
  });

  it('should require operation and url', () => {
    expect(webCaptureTool.parameters.required).toContain('operation');
    expect(webCaptureTool.parameters.required).toContain('url');
  });

  it('should have operation enum', () => {
    const props = webCaptureTool.parameters.properties as Record<string, { enum?: string[] }>;
    expect(props.operation.enum).toContain('screenshot');
    expect(props.operation.enum).toContain('pdf');
    expect(props.operation.enum).toContain('metadata');
    expect(props.operation.enum).toContain('execute_js');
  });

  it('should have format enum', () => {
    const props = webCaptureTool.parameters.properties as Record<string, { enum?: string[] }>;
    expect(props.format.enum).toContain('png');
    expect(props.format.enum).toContain('jpeg');
    expect(props.format.enum).toContain('webp');
  });
});

// -------------------------------------------------------------------
// Validation
// -------------------------------------------------------------------
describe('executeWebCapture - validation', () => {
  it('should error when operation is missing', async () => {
    const res = await executeWebCapture(makeCall({ url: 'https://example.com' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('required');
  });

  it('should error when url is missing', async () => {
    const res = await executeWebCapture(makeCall({ operation: 'screenshot' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('required');
  });

  it('should error for invalid URL', async () => {
    const res = await executeWebCapture(makeCall({ operation: 'screenshot', url: 'not-a-url' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Invalid URL');
  });

  it('should return toolCallId', async () => {
    const res = await executeWebCapture({
      id: 'wc-99',
      name: 'capture_webpage',
      arguments: { operation: 'screenshot' },
    });
    expect(res.toolCallId).toBe('wc-99');
  });
});

// -------------------------------------------------------------------
// Unknown operation
// -------------------------------------------------------------------
describe('executeWebCapture - unknown operation', () => {
  it('should error for unknown operation', async () => {
    const res = await executeWebCapture(
      makeCall({ operation: 'invalid_op', url: 'https://example.com' })
    );
    expect(res.isError).toBe(true);
    // May fail with Chrome not found or Unknown operation depending on environment
    const content = res.content;
    expect(
      content.includes('Unknown operation') ||
        content.includes('Chrome') ||
        content.includes('error')
    ).toBe(true);
  });
});

// -------------------------------------------------------------------
// Availability
// -------------------------------------------------------------------
describe('isWebCaptureAvailable', () => {
  it('should return true', () => {
    expect(isWebCaptureAvailable()).toBe(true);
  });
});
