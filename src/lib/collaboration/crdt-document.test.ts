import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}));

import { CRDTDocument, DocumentStore, getDocumentStore } from './crdt-document';
import type { CRDTOperation, CRDTState, CursorPosition } from './crdt-document';

// ============================================================================
// CRDTDocument
// ============================================================================

describe('CRDTDocument', () => {
  describe('constructor', () => {
    it('should create a document with given id, userId, and empty content', () => {
      const doc = new CRDTDocument('doc-1', 'user-1');
      expect(doc.getDocumentId()).toBe('doc-1');
      expect(doc.getContent()).toBe('');
      expect(doc.getVersion()).toBe(0);
    });

    it('should create a document with initial content', () => {
      const doc = new CRDTDocument('doc-2', 'user-2', 'Hello World');
      expect(doc.getContent()).toBe('Hello World');
    });

    it('should initialize vector clock for the userId', () => {
      const doc = new CRDTDocument('doc-3', 'user-3');
      const state = doc.getState();
      expect(state.vectorClock['user-3']).toBe(0);
    });

    it('should set max listeners to 50', () => {
      const doc = new CRDTDocument('doc-4', 'user-4');
      expect(doc.getMaxListeners()).toBe(50);
    });
  });

  describe('insert', () => {
    it('should insert text at position 0 into empty document', () => {
      const doc = new CRDTDocument('doc-1', 'user-1');
      const op = doc.insert(0, 'Hello');
      expect(doc.getContent()).toBe('Hello');
      expect(op.type).toBe('insert');
      expect(op.content).toBe('Hello');
      expect(op.position).toBe(0);
      expect(op.userId).toBe('user-1');
    });

    it('should insert text at the end of existing content', () => {
      const doc = new CRDTDocument('doc-1', 'user-1', 'Hello');
      doc.insert(5, ' World');
      expect(doc.getContent()).toBe('Hello World');
    });

    it('should insert text in the middle of existing content', () => {
      const doc = new CRDTDocument('doc-1', 'user-1', 'Helo');
      doc.insert(2, 'l');
      expect(doc.getContent()).toBe('Hello');
    });

    it('should clamp position to 0 when negative', () => {
      const doc = new CRDTDocument('doc-1', 'user-1');
      doc.insert(-5, 'text');
      expect(doc.getContent()).toBe('text');
    });

    it('should clamp position to content length when beyond end', () => {
      const doc = new CRDTDocument('doc-1', 'user-1', 'abc');
      doc.insert(100, 'def');
      expect(doc.getContent()).toBe('abcdef');
    });

    it('should increment vector clock on insert', () => {
      const doc = new CRDTDocument('doc-1', 'user-1');
      doc.insert(0, 'a');
      const state = doc.getState();
      expect(state.vectorClock['user-1']).toBe(1);
    });

    it('should increment version on insert', () => {
      const doc = new CRDTDocument('doc-1', 'user-1');
      doc.insert(0, 'a');
      expect(doc.getVersion()).toBe(1);
    });

    it('should store the operation in state', () => {
      const doc = new CRDTDocument('doc-1', 'user-1');
      doc.insert(0, 'Hello');
      const state = doc.getState();
      expect(state.operations).toHaveLength(1);
      expect(state.operations[0].type).toBe('insert');
    });

    it('should emit operation and change events on insert', () => {
      const doc = new CRDTDocument('doc-1', 'user-1');
      const operationSpy = vi.fn();
      const changeSpy = vi.fn();
      doc.on('operation', operationSpy);
      doc.on('change', changeSpy);

      doc.insert(0, 'Hello');

      expect(operationSpy).toHaveBeenCalledTimes(1);
      expect(operationSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'insert', content: 'Hello' })
      );
      expect(changeSpy).toHaveBeenCalledTimes(1);
      expect(changeSpy).toHaveBeenCalledWith(expect.objectContaining({ content: 'Hello' }));
    });

    it('should return operation with correct structure', () => {
      const doc = new CRDTDocument('doc-1', 'user-1');
      const op = doc.insert(0, 'Test');
      expect(op).toMatchObject({
        type: 'insert',
        position: 0,
        content: 'Test',
        userId: 'user-1',
        timestamp: 1,
      });
      expect(op.id).toBeDefined();
      expect(op.vectorClock).toBeDefined();
      expect(op.vectorClock['user-1']).toBe(1);
    });
  });

  describe('delete', () => {
    it('should delete text at position', () => {
      const doc = new CRDTDocument('doc-1', 'user-1', 'Hello World');
      const op = doc.delete(5, 6);
      expect(doc.getContent()).toBe('Hello');
      expect(op.type).toBe('delete');
      expect(op.length).toBe(6);
    });

    it('should handle deleting from beginning', () => {
      const doc = new CRDTDocument('doc-1', 'user-1', 'Hello');
      doc.delete(0, 2);
      expect(doc.getContent()).toBe('llo');
    });

    it('should clamp length when beyond content end', () => {
      const doc = new CRDTDocument('doc-1', 'user-1', 'Hi');
      doc.delete(0, 100);
      expect(doc.getContent()).toBe('');
    });

    it('should return no-op operation when length is 0', () => {
      const doc = new CRDTDocument('doc-1', 'user-1', 'Hello');
      const op = doc.delete(0, 0);
      expect(op.type).toBe('delete');
      expect(op.length).toBe(0);
      expect(doc.getContent()).toBe('Hello');
    });

    it('should clamp position to valid range', () => {
      const doc = new CRDTDocument('doc-1', 'user-1', 'Hello');
      doc.delete(-5, 2);
      expect(doc.getContent()).toBe('llo');
    });

    it('should emit operation and change events on delete', () => {
      const doc = new CRDTDocument('doc-1', 'user-1', 'Hello');
      const operationSpy = vi.fn();
      const changeSpy = vi.fn();
      doc.on('operation', operationSpy);
      doc.on('change', changeSpy);

      doc.delete(0, 2);

      expect(operationSpy).toHaveBeenCalledTimes(1);
      expect(changeSpy).toHaveBeenCalledTimes(1);
    });

    it('should increment version on delete', () => {
      const doc = new CRDTDocument('doc-1', 'user-1', 'Hello');
      doc.delete(0, 1);
      expect(doc.getVersion()).toBe(1);
    });

    it('should return no-op when position is past content end and length is effectively 0', () => {
      const doc = new CRDTDocument('doc-1', 'user-1', 'abc');
      const op = doc.delete(3, 5);
      // position clamps to 3, length = min(5, 3-3) = 0 => no-op
      expect(op.length).toBe(0);
      expect(doc.getContent()).toBe('abc');
    });
  });

  describe('applyRemoteOperation', () => {
    it('should apply a remote insert operation', () => {
      const doc = new CRDTDocument('doc-1', 'user-1', 'Hello');
      const remoteOp: CRDTOperation = {
        id: 'remote-op-1',
        type: 'insert',
        position: 5,
        content: ' World',
        userId: 'user-2',
        timestamp: 1,
        vectorClock: { 'user-2': 1 },
      };

      const applied = doc.applyRemoteOperation(remoteOp);
      expect(applied).toBe(true);
      expect(doc.getContent()).toBe('Hello World');
    });

    it('should apply a remote delete operation', () => {
      const doc = new CRDTDocument('doc-1', 'user-1', 'Hello World');
      const remoteOp: CRDTOperation = {
        id: 'remote-op-2',
        type: 'delete',
        position: 5,
        length: 6,
        userId: 'user-2',
        timestamp: 1,
        vectorClock: { 'user-2': 1 },
      };

      const applied = doc.applyRemoteOperation(remoteOp);
      expect(applied).toBe(true);
      expect(doc.getContent()).toBe('Hello');
    });

    it('should reject duplicate operations by id', () => {
      const doc = new CRDTDocument('doc-1', 'user-1', 'Hello');
      const remoteOp: CRDTOperation = {
        id: 'remote-op-1',
        type: 'insert',
        position: 5,
        content: ' World',
        userId: 'user-2',
        timestamp: 1,
        vectorClock: { 'user-2': 1 },
      };

      doc.applyRemoteOperation(remoteOp);
      const secondApply = doc.applyRemoteOperation(remoteOp);
      expect(secondApply).toBe(false);
      expect(doc.getContent()).toBe('Hello World');
    });

    it('should update vector clock after applying remote operation', () => {
      const doc = new CRDTDocument('doc-1', 'user-1');
      const remoteOp: CRDTOperation = {
        id: 'remote-op-1',
        type: 'insert',
        position: 0,
        content: 'test',
        userId: 'user-2',
        timestamp: 5,
        vectorClock: { 'user-2': 5 },
      };

      doc.applyRemoteOperation(remoteOp);
      const state = doc.getState();
      expect(state.vectorClock['user-2']).toBe(5);
    });

    it('should increment version after applying remote operation', () => {
      const doc = new CRDTDocument('doc-1', 'user-1');
      const remoteOp: CRDTOperation = {
        id: 'remote-op-1',
        type: 'insert',
        position: 0,
        content: 'test',
        userId: 'user-2',
        timestamp: 1,
        vectorClock: { 'user-2': 1 },
      };

      doc.applyRemoteOperation(remoteOp);
      expect(doc.getVersion()).toBe(1);
    });

    it('should emit change event with remote flag', () => {
      const doc = new CRDTDocument('doc-1', 'user-1');
      const changeSpy = vi.fn();
      doc.on('change', changeSpy);

      const remoteOp: CRDTOperation = {
        id: 'remote-op-1',
        type: 'insert',
        position: 0,
        content: 'test',
        userId: 'user-2',
        timestamp: 1,
        vectorClock: { 'user-2': 1 },
      };

      doc.applyRemoteOperation(remoteOp);
      expect(changeSpy).toHaveBeenCalledWith(
        expect.objectContaining({ remote: true, content: 'test' })
      );
    });
  });

  describe('cursor operations', () => {
    it('should update cursor position', () => {
      const doc = new CRDTDocument('doc-1', 'user-1', 'Hello');
      const cursorSpy = vi.fn();
      doc.on('cursorUpdate', cursorSpy);

      doc.updateCursor(3);

      expect(cursorSpy).toHaveBeenCalledTimes(1);
      expect(cursorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', position: 3 })
      );
    });

    it('should update cursor with selection', () => {
      const doc = new CRDTDocument('doc-1', 'user-1', 'Hello World');
      const cursorSpy = vi.fn();
      doc.on('cursorUpdate', cursorSpy);

      doc.updateCursor(0, { start: 0, end: 5 });

      expect(cursorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          position: 0,
          selection: { start: 0, end: 5 },
        })
      );
    });

    it('should apply remote cursor', () => {
      const doc = new CRDTDocument('doc-1', 'user-1');
      const cursorsSpy = vi.fn();
      doc.on('cursorsChanged', cursorsSpy);

      const remoteCursor: CursorPosition = {
        userId: 'user-2',
        userName: 'Bob',
        position: 10,
        color: '#FF0000',
      };

      doc.applyRemoteCursor(remoteCursor);

      expect(cursorsSpy).toHaveBeenCalledTimes(1);
      const cursorsArg = cursorsSpy.mock.calls[0][0] as CursorPosition[];
      expect(cursorsArg).toHaveLength(1);
      expect(cursorsArg[0].userId).toBe('user-2');
    });

    it('should remove cursor', () => {
      const doc = new CRDTDocument('doc-1', 'user-1');

      const remoteCursor: CursorPosition = {
        userId: 'user-2',
        userName: 'Bob',
        position: 10,
        color: '#FF0000',
      };
      doc.applyRemoteCursor(remoteCursor);

      const cursorsSpy = vi.fn();
      doc.on('cursorsChanged', cursorsSpy);

      doc.removeCursor('user-2');

      expect(cursorsSpy).toHaveBeenCalledTimes(1);
      const cursorsArg = cursorsSpy.mock.calls[0][0] as CursorPosition[];
      expect(cursorsArg).toHaveLength(0);
    });

    it('should get cursors excluding own cursor', () => {
      const doc = new CRDTDocument('doc-1', 'user-1');

      doc.updateCursor(5);

      const remoteCursor: CursorPosition = {
        userId: 'user-2',
        userName: 'Bob',
        position: 10,
        color: '#FF0000',
      };
      doc.applyRemoteCursor(remoteCursor);

      const cursors = doc.getCursors();
      expect(cursors).toHaveLength(1);
      expect(cursors[0].userId).toBe('user-2');
    });
  });

  describe('getContent', () => {
    it('should return current document content', () => {
      const doc = new CRDTDocument('doc-1', 'user-1', 'Initial');
      expect(doc.getContent()).toBe('Initial');
    });
  });

  describe('getState', () => {
    it('should return full document state', () => {
      const doc = new CRDTDocument('doc-1', 'user-1', 'Hello');
      doc.insert(5, ' World');

      const state = doc.getState();
      expect(state.content).toBe('Hello World');
      expect(state.operations).toHaveLength(1);
      expect(state.vectorClock['user-1']).toBe(1);
      expect(state.version).toBe(1);
    });

    it('should return a copy of vector clock, not reference', () => {
      const doc = new CRDTDocument('doc-1', 'user-1');
      const state1 = doc.getState();
      state1.vectorClock['user-1'] = 999;

      const state2 = doc.getState();
      expect(state2.vectorClock['user-1']).toBe(0);
    });
  });

  describe('syncWithState', () => {
    it('should apply new operations from remote state', () => {
      const doc = new CRDTDocument('doc-1', 'user-1', '');

      const remoteState: CRDTState = {
        content: 'Hello',
        operations: [
          {
            id: 'op-remote-1',
            type: 'insert',
            position: 0,
            content: 'Hello',
            userId: 'user-2',
            timestamp: 1,
            vectorClock: { 'user-2': 1 },
          },
        ],
        vectorClock: { 'user-2': 1 },
        version: 1,
      };

      doc.syncWithState(remoteState);
      expect(doc.getContent()).toBe('Hello');
    });

    it('should not duplicate existing operations during sync', () => {
      const doc = new CRDTDocument('doc-1', 'user-1', '');
      const op: CRDTOperation = {
        id: 'op-1',
        type: 'insert',
        position: 0,
        content: 'Hi',
        userId: 'user-2',
        timestamp: 1,
        vectorClock: { 'user-2': 1 },
      };
      doc.applyRemoteOperation(op);

      const remoteState: CRDTState = {
        content: 'Hi',
        operations: [op],
        vectorClock: { 'user-2': 1 },
        version: 1,
      };

      doc.syncWithState(remoteState);
      // Should still be 'Hi' not 'HiHi'
      expect(doc.getContent()).toBe('Hi');
    });

    it('should merge vector clocks after sync', () => {
      const doc = new CRDTDocument('doc-1', 'user-1', '');
      doc.insert(0, 'a'); // user-1 clock = 1

      const remoteState: CRDTState = {
        content: 'b',
        operations: [
          {
            id: 'op-remote',
            type: 'insert',
            position: 0,
            content: 'b',
            userId: 'user-2',
            timestamp: 3,
            vectorClock: { 'user-2': 3 },
          },
        ],
        vectorClock: { 'user-2': 3 },
        version: 3,
      };

      doc.syncWithState(remoteState);
      const state = doc.getState();
      expect(state.vectorClock['user-1']).toBe(1);
      expect(state.vectorClock['user-2']).toBe(3);
    });
  });

  describe('getDocumentId', () => {
    it('should return the document ID', () => {
      const doc = new CRDTDocument('my-doc', 'user-1');
      expect(doc.getDocumentId()).toBe('my-doc');
    });
  });

  describe('getVersion', () => {
    it('should start at 0', () => {
      const doc = new CRDTDocument('doc-1', 'user-1');
      expect(doc.getVersion()).toBe(0);
    });

    it('should increment with local operations', () => {
      const doc = new CRDTDocument('doc-1', 'user-1');
      doc.insert(0, 'a');
      doc.insert(1, 'b');
      expect(doc.getVersion()).toBe(2);
    });

    it('should increment with remote operations', () => {
      const doc = new CRDTDocument('doc-1', 'user-1');
      doc.applyRemoteOperation({
        id: 'r-1',
        type: 'insert',
        position: 0,
        content: 'x',
        userId: 'user-2',
        timestamp: 1,
        vectorClock: { 'user-2': 1 },
      });
      expect(doc.getVersion()).toBe(1);
    });
  });
});

// ============================================================================
// DocumentStore
// ============================================================================

describe('DocumentStore', () => {
  it('should create a new document when not found', () => {
    const store = new DocumentStore();
    const doc = store.getDocument('doc-1', 'user-1');
    expect(doc).toBeInstanceOf(CRDTDocument);
    expect(doc.getDocumentId()).toBe('doc-1');
  });

  it('should return existing document if already created', () => {
    const store = new DocumentStore();
    const doc1 = store.getDocument('doc-1', 'user-1');
    const doc2 = store.getDocument('doc-1', 'user-2');
    expect(doc1).toBe(doc2);
  });

  it('should create document with initial content', () => {
    const store = new DocumentStore();
    const doc = store.getDocument('doc-1', 'user-1', 'Hello');
    expect(doc.getContent()).toBe('Hello');
  });

  it('should remove a document', () => {
    const store = new DocumentStore();
    store.getDocument('doc-1', 'user-1');
    expect(store.hasDocument('doc-1')).toBe(true);

    store.removeDocument('doc-1');
    expect(store.hasDocument('doc-1')).toBe(false);
  });

  it('should report whether a document exists', () => {
    const store = new DocumentStore();
    expect(store.hasDocument('doc-1')).toBe(false);
    store.getDocument('doc-1', 'user-1');
    expect(store.hasDocument('doc-1')).toBe(true);
  });

  it('should return all document IDs', () => {
    const store = new DocumentStore();
    store.getDocument('doc-1', 'user-1');
    store.getDocument('doc-2', 'user-1');
    store.getDocument('doc-3', 'user-1');

    const ids = store.getDocumentIds();
    expect(ids).toHaveLength(3);
    expect(ids).toContain('doc-1');
    expect(ids).toContain('doc-2');
    expect(ids).toContain('doc-3');
  });

  it('should return empty array when no documents', () => {
    const store = new DocumentStore();
    expect(store.getDocumentIds()).toEqual([]);
  });

  it('should not re-create a removed document without explicit getDocument call', () => {
    const store = new DocumentStore();
    store.getDocument('doc-1', 'user-1', 'content');
    store.removeDocument('doc-1');
    expect(store.hasDocument('doc-1')).toBe(false);
    // Getting it again creates a new one
    const newDoc = store.getDocument('doc-1', 'user-1', 'new-content');
    expect(newDoc.getContent()).toBe('new-content');
  });

  it('should ignore initial content for existing document', () => {
    const store = new DocumentStore();
    store.getDocument('doc-1', 'user-1', 'original');
    const doc = store.getDocument('doc-1', 'user-1', 'overwrite attempt');
    expect(doc.getContent()).toBe('original');
  });

  it('should handle removing a non-existent document gracefully', () => {
    const store = new DocumentStore();
    // Should not throw
    expect(() => store.removeDocument('nonexistent')).not.toThrow();
  });
});

// ============================================================================
// getDocumentStore singleton
// ============================================================================

describe('getDocumentStore', () => {
  it('should return a DocumentStore instance', () => {
    const store = getDocumentStore();
    expect(store).toBeInstanceOf(DocumentStore);
  });

  it('should return the same instance on multiple calls', () => {
    const store1 = getDocumentStore();
    const store2 = getDocumentStore();
    expect(store1).toBe(store2);
  });
});
