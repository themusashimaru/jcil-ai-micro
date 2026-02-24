import { describe, it, expect } from 'vitest';
import { executeSearchIndex, isSearchIndexAvailable, searchIndexTool } from './search-index-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'search_index', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeSearchIndex(makeCall(args));
  return JSON.parse(res.content);
}

// Helper: create a named index with sample documents
async function createTestIndex(name: string) {
  return getResult({
    operation: 'create',
    index_name: name,
    documents: [
      { id: '1', title: 'JavaScript Guide', body: 'Learn JavaScript programming language' },
      { id: '2', title: 'TypeScript Handbook', body: 'TypeScript adds types to JavaScript' },
      { id: '3', title: 'Python Tutorial', body: 'Get started with Python' },
    ],
  });
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('searchIndexTool metadata', () => {
  it('should have correct name', () => {
    expect(searchIndexTool.name).toBe('search_index');
  });

  it('should require operation', () => {
    expect(searchIndexTool.parameters.required).toContain('operation');
  });
});

describe('isSearchIndexAvailable', () => {
  it('should return true', () => {
    expect(isSearchIndexAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// create operation
// -------------------------------------------------------------------
describe('executeSearchIndex - create', () => {
  it('should create index from documents', async () => {
    const result = await createTestIndex('test-create-1');
    expect(result.operation).toBe('create');
    expect(result.index_name).toBe('test-create-1');
    expect(result.documents_indexed).toBe(3);
    expect(result.fields_indexed).toContain('title');
    expect(result.fields_indexed).toContain('body');
  });

  it('should accept explicit fields', async () => {
    const result = await getResult({
      operation: 'create',
      index_name: 'test-create-fields',
      documents: [{ id: '1', title: 'Hello', body: 'World', category: 'test' }],
      fields: ['title'],
    });
    expect(result.fields_indexed).toEqual(['title']);
  });

  it('should accept boost config', async () => {
    const result = await getResult({
      operation: 'create',
      index_name: 'test-create-boost',
      documents: [{ id: '1', title: 'Hello', body: 'World' }],
      boost: { title: 10, body: 1 },
    });
    expect(result.boost_config).toEqual({ title: 10, body: 1 });
  });

  it('should error without index_name', async () => {
    const res = await executeSearchIndex(
      makeCall({ operation: 'create', documents: [{ id: '1', title: 'test' }] })
    );
    expect(res.isError).toBe(true);
  });

  it('should error without documents', async () => {
    const res = await executeSearchIndex(makeCall({ operation: 'create', index_name: 'fail' }));
    expect(res.isError).toBe(true);
  });

  it('should error with empty documents', async () => {
    const res = await executeSearchIndex(
      makeCall({ operation: 'create', index_name: 'fail', documents: [] })
    );
    expect(res.isError).toBe(true);
  });

  it('should error if document missing id field', async () => {
    const res = await executeSearchIndex(
      makeCall({
        operation: 'create',
        index_name: 'fail',
        documents: [{ title: 'no id' }],
      })
    );
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// search operation
// -------------------------------------------------------------------
describe('executeSearchIndex - search', () => {
  it('should find matching documents', async () => {
    await createTestIndex('test-search-1');
    const result = await getResult({
      operation: 'search',
      index_name: 'test-search-1',
      query: 'JavaScript',
    });
    expect(result.operation).toBe('search');
    expect(result.total_results).toBeGreaterThan(0);
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].score).toBeGreaterThan(0);
    expect(result.results[0].document).toBeDefined();
  });

  it('should return documents with scores', async () => {
    await createTestIndex('test-search-scores');
    const result = await getResult({
      operation: 'search',
      index_name: 'test-search-scores',
      query: 'Python',
    });
    expect(result.results[0].document.id).toBe('3');
    expect(result.results[0].score).toBeGreaterThan(0);
  });

  it('should support fuzzy matching', async () => {
    await createTestIndex('test-search-fuzzy');
    const result = await getResult({
      operation: 'search',
      index_name: 'test-search-fuzzy',
      query: 'Javscript', // typo
      fuzzy: true,
    });
    expect(result.fuzzy).toBe(true);
    expect(result.total_results).toBeGreaterThan(0);
  });

  it('should respect limit', async () => {
    await createTestIndex('test-search-limit');
    const result = await getResult({
      operation: 'search',
      index_name: 'test-search-limit',
      query: 'JavaScript',
      limit: 1,
    });
    expect(result.returned).toBeLessThanOrEqual(1);
  });

  it('should error if index not found', async () => {
    const res = await executeSearchIndex(
      makeCall({ operation: 'search', index_name: 'nonexistent', query: 'test' })
    );
    expect(res.isError).toBe(true);
  });

  it('should error without index_name', async () => {
    const res = await executeSearchIndex(makeCall({ operation: 'search', query: 'test' }));
    expect(res.isError).toBe(true);
  });

  it('should error without query', async () => {
    const res = await executeSearchIndex(
      makeCall({ operation: 'search', index_name: 'test-search-1' })
    );
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// delete operation
// -------------------------------------------------------------------
describe('executeSearchIndex - delete', () => {
  it('should delete an existing index', async () => {
    await createTestIndex('test-delete-1');
    const result = await getResult({
      operation: 'delete',
      index_name: 'test-delete-1',
    });
    expect(result.operation).toBe('delete');
    expect(result.deleted).toBe(true);
  });

  it('should return false for non-existent index', async () => {
    const result = await getResult({
      operation: 'delete',
      index_name: 'never-existed',
    });
    expect(result.deleted).toBe(false);
  });

  it('should error without index_name', async () => {
    const res = await executeSearchIndex(makeCall({ operation: 'delete' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// list operation
// -------------------------------------------------------------------
describe('executeSearchIndex - list', () => {
  it('should list indexes', async () => {
    await createTestIndex('test-list-1');
    const result = await getResult({ operation: 'list' });
    expect(result.operation).toBe('list');
    expect(result.total).toBeGreaterThanOrEqual(1);
    const found = result.indexes.find((i: { name: string }) => i.name === 'test-list-1');
    expect(found).toBeDefined();
    expect(found.document_count).toBe(3);
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeSearchIndex - errors', () => {
  it('should error for unknown operation', async () => {
    const res = await executeSearchIndex(makeCall({ operation: 'xyz' }));
    expect(res.isError).toBe(true);
  });

  it('should error without operation', async () => {
    const res = await executeSearchIndex(makeCall({}));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executeSearchIndex({
      id: 'my-id',
      name: 'search_index',
      arguments: { operation: 'list' },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
