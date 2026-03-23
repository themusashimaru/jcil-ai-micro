// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { executeZip, isZipAvailable, zipTool } from './zip-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'zip_files', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeZip(makeCall(args));
  return JSON.parse(res.content);
}

// For 'create' which now returns markdown instead of JSON
async function getRawResult(args: Record<string, unknown>) {
  return executeZip(makeCall(args));
}

// Extract the base64 zip data from the markdown download link
function extractBase64FromMarkdown(content: string): string {
  const match = content.match(/\[Download [^\]]+\]\(data:application\/zip;base64,([^)]+)\)/);
  if (!match) throw new Error('No base64 zip data found in markdown');
  return match[1];
}

// Helper: create a simple ZIP with text files
async function createTestZip(
  files = [
    { name: 'hello.txt', content: 'Hello World' },
    { name: 'data.json', content: '{"key":"value"}' },
  ]
): Promise<string> {
  const res = await getRawResult({
    operation: 'create',
    files,
  });
  return extractBase64FromMarkdown(res.content);
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('zipTool metadata', () => {
  it('should have correct name', () => {
    expect(zipTool.name).toBe('zip_files');
  });

  it('should require operation', () => {
    expect(zipTool.parameters.required).toContain('operation');
  });
});

describe('isZipAvailable', () => {
  it('should return true', () => {
    expect(isZipAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// create operation
// -------------------------------------------------------------------
describe('executeZip - create', () => {
  it('should create ZIP from text files', async () => {
    const res = await getRawResult({
      operation: 'create',
      files: [
        { name: 'a.txt', content: 'Alpha' },
        { name: 'b.txt', content: 'Beta' },
      ],
    });
    expect(res.isError).toBe(false);
    expect(res.content).toContain('ZIP archive created successfully!');
    expect(res.content).toContain('**Files:** 2 (a.txt, b.txt)');
    expect(res.content).toContain('**Size:**');
    expect(res.content).toMatch(/\[Download archive_\d+\.zip\]\(data:application\/zip;base64,/);
    // Verify base64 data is extractable
    const base64 = extractBase64FromMarkdown(res.content);
    expect(base64.length).toBeGreaterThan(0);
  });

  it('should create ZIP from base64 content', async () => {
    const b64 = Buffer.from('binary data').toString('base64');
    const res = await getRawResult({
      operation: 'create',
      files: [{ name: 'bin.dat', content: b64, is_base64: true }],
    });
    expect(res.isError).toBe(false);
    expect(res.content).toContain('**Files:** 1 (bin.dat)');
    const base64 = extractBase64FromMarkdown(res.content);
    expect(base64.length).toBeGreaterThan(0);
  });

  it('should respect compression level', async () => {
    const noCompressionRes = await getRawResult({
      operation: 'create',
      files: [{ name: 'big.txt', content: 'A'.repeat(1000) }],
      compression_level: 0,
    });
    const maxCompressionRes = await getRawResult({
      operation: 'create',
      files: [{ name: 'big.txt', content: 'A'.repeat(1000) }],
      compression_level: 9,
    });
    // Extract size from "**Size:** X.X KB"
    const sizeMatch = (s: string) => {
      const m = s.match(/\*\*Size:\*\* ([\d.]+) KB/);
      return m ? parseFloat(m[1]) : 0;
    };
    expect(sizeMatch(noCompressionRes.content)).toBeGreaterThan(
      sizeMatch(maxCompressionRes.content)
    );
  });

  it('should error without files', async () => {
    const res = await executeZip(makeCall({ operation: 'create' }));
    expect(res.isError).toBe(true);
  });

  it('should error with empty files array', async () => {
    const res = await executeZip(makeCall({ operation: 'create', files: [] }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// extract operation
// -------------------------------------------------------------------
describe('executeZip - extract', () => {
  it('should extract all files from ZIP', async () => {
    const zipData = await createTestZip();
    const result = await getResult({
      operation: 'extract',
      zip_data: zipData,
    });
    expect(result.operation).toBe('extract');
    expect(result.files_count).toBe(2);
    expect(result.files[0].name).toBe('hello.txt');
    expect(result.files[0].content_base64).toBeDefined();
    // Decode and verify
    const decoded = Buffer.from(result.files[0].content_base64, 'base64').toString();
    expect(decoded).toBe('Hello World');
  });

  it('should error without zip_data', async () => {
    const res = await executeZip(makeCall({ operation: 'extract' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// extract_file operation
// -------------------------------------------------------------------
describe('executeZip - extract_file', () => {
  it('should extract specific file', async () => {
    const zipData = await createTestZip();
    const result = await getResult({
      operation: 'extract_file',
      zip_data: zipData,
      file_name: 'data.json',
    });
    expect(result.operation).toBe('extract_file');
    expect(result.file_name).toBe('data.json');
    expect(result.content_base64).toBeDefined();
    const decoded = Buffer.from(result.content_base64, 'base64').toString();
    expect(decoded).toBe('{"key":"value"}');
  });

  it('should error for missing file in ZIP', async () => {
    const zipData = await createTestZip();
    const res = await executeZip(
      makeCall({ operation: 'extract_file', zip_data: zipData, file_name: 'missing.txt' })
    );
    expect(res.isError).toBe(true);
  });

  it('should error without zip_data', async () => {
    const res = await executeZip(makeCall({ operation: 'extract_file', file_name: 'test.txt' }));
    expect(res.isError).toBe(true);
  });

  it('should error without file_name', async () => {
    const zipData = await createTestZip();
    const res = await executeZip(makeCall({ operation: 'extract_file', zip_data: zipData }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// list operation
// -------------------------------------------------------------------
describe('executeZip - list', () => {
  it('should list ZIP contents', async () => {
    const zipData = await createTestZip();
    const result = await getResult({
      operation: 'list',
      zip_data: zipData,
    });
    expect(result.operation).toBe('list');
    expect(result.total_files).toBe(2);
    expect(result.total_directories).toBe(0);
    const names = result.contents.map((c: { name: string }) => c.name);
    expect(names).toContain('hello.txt');
    expect(names).toContain('data.json');
  });

  it('should error without zip_data', async () => {
    const res = await executeZip(makeCall({ operation: 'list' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// add operation
// -------------------------------------------------------------------
describe('executeZip - add', () => {
  it('should add files to existing ZIP', async () => {
    const zipData = await createTestZip();
    const result = await getResult({
      operation: 'add',
      zip_data: zipData,
      files: [{ name: 'extra.txt', content: 'Extra content' }],
    });
    expect(result.operation).toBe('add');
    expect(result.files_added).toBe(1);
    expect(result.added_names).toEqual(['extra.txt']);
    expect(result.zip_base64).toBeDefined();

    // Verify the new ZIP has 3 files
    const listResult = await getResult({
      operation: 'list',
      zip_data: result.zip_base64,
    });
    expect(listResult.total_files).toBe(3);
  });

  it('should error without zip_data', async () => {
    const res = await executeZip(
      makeCall({ operation: 'add', files: [{ name: 'x.txt', content: 'x' }] })
    );
    expect(res.isError).toBe(true);
  });

  it('should error without files', async () => {
    const zipData = await createTestZip();
    const res = await executeZip(makeCall({ operation: 'add', zip_data: zipData }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeZip - errors', () => {
  it('should error for unknown operation', async () => {
    const res = await executeZip(makeCall({ operation: 'xyz' }));
    expect(res.isError).toBe(true);
  });

  it('should error without operation', async () => {
    const res = await executeZip(makeCall({}));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executeZip({
      id: 'my-id',
      name: 'zip_files',
      arguments: { operation: 'create', files: [{ name: 't.txt', content: 't' }] },
    });
    expect(res.toolCallId).toBe('my-id');
    // Create now returns markdown, not JSON
    expect(res.content).toContain('ZIP archive created successfully!');
  });
});
