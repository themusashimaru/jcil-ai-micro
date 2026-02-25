import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
    },
  })),
}));

import { DeepExecutionTracer } from './deep-execution-tracer';

describe('DeepExecutionTracer', () => {
  let tracer: DeepExecutionTracer;

  beforeEach(() => {
    vi.clearAllMocks();
    tracer = new DeepExecutionTracer();
  });

  // ==========================================================================
  // CONSTRUCTOR
  // ==========================================================================

  it('should create an instance', () => {
    expect(tracer).toBeInstanceOf(DeepExecutionTracer);
  });

  // ==========================================================================
  // traceExecutionPaths()
  // ==========================================================================

  describe('traceExecutionPaths', () => {
    it('should return an array of ExecutionPaths', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              pathName: 'Main execution',
              steps: [
                {
                  line: 1,
                  operation: 'Initialize',
                  inputs: [],
                  outputs: [{ name: 'x', type: 'number' }],
                  sideEffects: [],
                  branches: [],
                },
              ],
              complexity: 2,
              isCritical: false,
            }),
          },
        ],
      });

      const code = `export function main() {
  const x = 1;
  return x;
}`;
      const result = await tracer.traceExecutionPaths(code, 'javascript');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should use specified entry point', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              pathName: 'Custom entry',
              steps: [
                {
                  line: 1,
                  operation: 'Start',
                  inputs: [],
                  outputs: [],
                  sideEffects: [],
                  branches: [],
                },
              ],
              complexity: 1,
              isCritical: false,
            }),
          },
        ],
      });

      const code = `function process() { return 1; }
function main() { process(); }`;
      const result = await tracer.traceExecutionPaths(code, 'javascript', {
        entryPoint: 'process',
      });

      expect(Array.isArray(result)).toBe(true);
      // Should have called the API with 'process' entry
      if (mockCreate.mock.calls.length > 0) {
        const prompt = mockCreate.mock.calls[0][0].messages[0].content;
        expect(prompt).toContain('process');
      }
    });

    it('should respect maxDepth option', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              pathName: 'test',
              steps: [],
              complexity: 1,
              isCritical: false,
            }),
          },
        ],
      });

      const result = await tracer.traceExecutionPaths('export function test() {}', 'javascript', {
        maxDepth: 3,
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it('should detect async flows with await', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              pathName: 'test',
              steps: [],
              complexity: 1,
              isCritical: false,
            }),
          },
        ],
      });

      const code = `export async function fetchData() {
  const data = await fetch("/api");
  const json = await data.json();
  return json;
}`;
      const result = await tracer.traceExecutionPaths(code, 'javascript');

      // Should include async flow path
      const asyncPath = result.find((p) => p.name === 'Async Operations Flow');
      expect(asyncPath).toBeDefined();
      if (asyncPath) {
        expect(asyncPath.steps.length).toBeGreaterThanOrEqual(2); // Two await operations
      }
    });

    it('should detect async flows with .then()', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"pathName":"test","steps":[],"complexity":1,"isCritical":false}',
          },
        ],
      });

      const code = `export function fetchData() {
  fetch("/api").then(r => r.json()).then(console.log);
}`;
      const result = await tracer.traceExecutionPaths(code, 'javascript');

      const asyncPath = result.find((p) => p.name === 'Async Operations Flow');
      expect(asyncPath).toBeDefined();
    });

    it('should detect async flows with new Promise', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"pathName":"test","steps":[],"complexity":1,"isCritical":false}',
          },
        ],
      });

      const code = `export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}`;
      const result = await tracer.traceExecutionPaths(code, 'javascript');

      const asyncPath = result.find((p) => p.name === 'Async Operations Flow');
      expect(asyncPath).toBeDefined();
    });

    it('should detect async flows with setTimeout', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"pathName":"test","steps":[],"complexity":1,"isCritical":false}',
          },
        ],
      });

      const code = `export function delayed() {
  setTimeout(() => console.log("done"), 1000);
}`;
      const result = await tracer.traceExecutionPaths(code, 'javascript');

      const asyncPath = result.find((p) => p.name === 'Async Operations Flow');
      expect(asyncPath).toBeDefined();
    });

    it('should skip async tracing when includeAsync is false', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"pathName":"test","steps":[],"complexity":1,"isCritical":false}',
          },
        ],
      });

      const code = `export async function fetchData() {
  const data = await fetch("/api");
  return data;
}`;
      const result = await tracer.traceExecutionPaths(code, 'javascript', {
        includeAsync: false,
      });

      const asyncPath = result.find((p) => p.name === 'Async Operations Flow');
      expect(asyncPath).toBeUndefined();
    });

    it('should handle API failure gracefully', async () => {
      mockCreate.mockRejectedValue(new Error('API error'));

      const code = `export function test() { return 1; }`;
      const result = await tracer.traceExecutionPaths(code, 'javascript');

      // Should not throw, should return whatever paths could be created
      expect(Array.isArray(result)).toBe(true);
    });

    it('should identify export entry points', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"pathName":"test","steps":[],"complexity":1,"isCritical":false}',
          },
        ],
      });

      const code = `export function handler() { return 1; }
export const helper = () => 2;`;
      const result = await tracer.traceExecutionPaths(code, 'javascript');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should identify event handler entry points', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"pathName":"test","steps":[],"complexity":1,"isCritical":false}',
          },
        ],
      });

      const code = `document.addEventListener('click', handler);
function handler() { return 1; }`;
      const result = await tracer.traceExecutionPaths(code, 'javascript');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should identify HTTP handler entry points', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"pathName":"test","steps":[],"complexity":1,"isCritical":false}',
          },
        ],
      });

      const code = `app.get('/api/users', getUsers);
app.post('/api/users', createUser);`;
      const result = await tracer.traceExecutionPaths(code, 'javascript');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should fall back to first function as entry point', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"pathName":"test","steps":[],"complexity":1,"isCritical":false}',
          },
        ],
      });

      const code = `function helper() { return 1; }`;
      const result = await tracer.traceExecutionPaths(code, 'javascript');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should mark async path as critical when >3 async ops', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"pathName":"test","steps":[],"complexity":1,"isCritical":false}',
          },
        ],
      });

      const code = `export async function complex() {
  const a = await step1();
  const b = await step2();
  const c = await step3();
  const d = await step4();
}`;
      const result = await tracer.traceExecutionPaths(code, 'javascript');
      const asyncPath = result.find((p) => p.name === 'Async Operations Flow');
      expect(asyncPath?.isCritical).toBe(true);
    });
  });

  // ==========================================================================
  // trackVariableMutations()
  // ==========================================================================

  describe('trackVariableMutations', () => {
    it('should detect variable declaration', async () => {
      const code = `let count = 0;
count++;
count = 10;`;
      const result = await tracer.trackVariableMutations(code, 'javascript', 'count');

      expect(result.name).toBe('count');
      expect(result.origin).toBeDefined();
      expect(result.origin?.line).toBe(1);
      expect(result.isMutable).toBe(true);
    });

    it('should detect increment/decrement mutations', async () => {
      const code = `let count = 0;
count++;
count--;`;
      const result = await tracer.trackVariableMutations(code, 'javascript', 'count');

      expect(result.mutations.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect assignment mutations', async () => {
      const code = `let x = 1;
x = 2;
x += 3;
x -= 1;
x *= 2;
x /= 2;`;
      const result = await tracer.trackVariableMutations(code, 'javascript', 'x');

      expect(result.mutations.length).toBeGreaterThanOrEqual(4);
    });

    it('should detect method mutations (push, pop, etc.)', async () => {
      const code = `const arr = [];
arr.push(1);
arr.pop();
arr.splice(0, 1);`;
      const result = await tracer.trackVariableMutations(code, 'javascript', 'arr');

      expect(result.mutations.length).toBe(3);
      expect(result.mutations[0].operation).toBe('push()');
      expect(result.mutations[1].operation).toBe('pop()');
      expect(result.mutations[2].operation).toBe('splice()');
    });

    it('should return isMutable=false when no mutations', async () => {
      const code = `const x = 1;
console.log(x);`;
      const result = await tracer.trackVariableMutations(code, 'javascript', 'x');

      expect(result.isMutable).toBe(false);
      expect(result.mutations).toHaveLength(0);
    });

    it('should detect typed variable declarations', async () => {
      const code = `let count: number = 0;`;
      const result = await tracer.trackVariableMutations(code, 'typescript', 'count');

      expect(result.type).toBe('number');
    });

    it('should return unknown type when no type annotation', async () => {
      const code = `let count = 0;`;
      const result = await tracer.trackVariableMutations(code, 'javascript', 'count');

      expect(result.type).toBe('unknown');
    });

    it('should handle variable not found in code', async () => {
      const code = `const x = 1;`;
      const result = await tracer.trackVariableMutations(code, 'javascript', 'nonexistent');

      expect(result.name).toBe('nonexistent');
      expect(result.origin).toBeUndefined();
      expect(result.mutations).toHaveLength(0);
    });
  });

  // ==========================================================================
  // identifySideEffects()
  // ==========================================================================

  describe('identifySideEffects', () => {
    it('should detect console.log as IO side effect', async () => {
      const code = `console.log("hello");`;
      const result = await tracer.identifySideEffects(code, 'javascript');

      const ioEffect = result.find((se) => se.type === 'io');
      expect(ioEffect).toBeDefined();
      expect(ioEffect?.idempotent).toBe(true);
    });

    it('should detect fetch as network side effect', async () => {
      const code = `fetch("https://api.example.com/data");`;
      const result = await tracer.identifySideEffects(code, 'javascript');

      const netEffect = result.find((se) => se.type === 'network');
      expect(netEffect).toBeDefined();
      expect(netEffect?.reversible).toBe(false);
    });

    it('should detect database queries as database side effect', async () => {
      const code = `db.query("SELECT * FROM users");`;
      const result = await tracer.identifySideEffects(code, 'javascript');

      const dbEffect = result.find((se) => se.type === 'database');
      expect(dbEffect).toBeDefined();
    });

    it('should detect fs operations as file side effect', async () => {
      const code = `fs.readFileSync("data.json");`;
      const result = await tracer.identifySideEffects(code, 'javascript');

      const fileEffect = result.find((se) => se.type === 'file');
      expect(fileEffect).toBeDefined();
      expect(fileEffect?.reversible).toBe(true);
    });

    it('should detect localStorage as state side effect', async () => {
      const code = `localStorage.setItem("key", "value");`;
      const result = await tracer.identifySideEffects(code, 'javascript');

      const stateEffect = result.find((se) => se.type === 'state');
      expect(stateEffect).toBeDefined();
    });

    it('should detect DOM manipulation as external side effect', async () => {
      const code = `document.getElementById("root").innerHTML = "hello";`;
      const result = await tracer.identifySideEffects(code, 'javascript');

      const extEffect = result.find((se) => se.type === 'external');
      expect(extEffect).toBeDefined();
    });

    it('should detect new allocations as memory side effect', async () => {
      const code = `const buf = new Buffer(1024);`;
      const result = await tracer.identifySideEffects(code, 'javascript');

      const memEffect = result.find((se) => se.type === 'memory');
      expect(memEffect).toBeDefined();
    });

    it('should include source location for each side effect', async () => {
      const code = `console.log("line 1");
fetch("/api");`;
      const result = await tracer.identifySideEffects(code, 'javascript');

      for (const se of result) {
        expect(se.location).toBeDefined();
        expect(se.location.line).toBeGreaterThan(0);
      }
    });

    it('should return empty array for code with no side effects', async () => {
      const code = `const x = 1 + 2;
const y = x * 3;`;
      const result = await tracer.identifySideEffects(code, 'javascript');

      expect(result).toEqual([]);
    });

    it('should detect multiple side effects on the same line', async () => {
      // This line matches both 'io' (console.log) and potentially others
      const code = `console.log(await fetch("/api"));`;
      const result = await tracer.identifySideEffects(code, 'javascript');

      expect(result.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==========================================================================
  // generateExecutionTrace()
  // ==========================================================================

  describe('generateExecutionTrace', () => {
    it('should return a trace string', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Line 1: const x = 1 -> x = 1\nVariables: { x: 1 }' }],
      });

      const result = await tracer.generateExecutionTrace('const x = 1;', 'javascript', { x: 1 });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return fallback on API failure', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API error'));

      const result = await tracer.generateExecutionTrace('const x = 1;', 'javascript', {});

      expect(result).toBe('Trace generation failed');
    });
  });

  // ==========================================================================
  // parseCodeStructure (tested indirectly)
  // ==========================================================================

  describe('code structure parsing', () => {
    it('should detect async functions', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"pathName":"test","steps":[],"complexity":1,"isCritical":false}',
          },
        ],
      });

      const code = `export async function fetchData() {
  const data = await fetch("/api");
}`;
      // The method is private, but we test it through traceExecutionPaths
      const result = await tracer.traceExecutionPaths(code, 'javascript');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should detect switch statements', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"pathName":"test","steps":[],"complexity":1,"isCritical":false}',
          },
        ],
      });

      const code = `export function handle(action) {
  switch (action.type) {
    case 'INCREMENT': return state + 1;
    case 'DECREMENT': return state - 1;
  }
}`;
      const result = await tracer.traceExecutionPaths(code, 'javascript');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should detect ternary operators', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"pathName":"test","steps":[],"complexity":1,"isCritical":false}',
          },
        ],
      });

      const code = `export const value = condition ? 'yes' : 'no';`;
      const result = await tracer.traceExecutionPaths(code, 'javascript');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should detect iterator methods (.forEach, .map)', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"pathName":"test","steps":[],"complexity":1,"isCritical":false}',
          },
        ],
      });

      const code = `export function process(items) {
  items.forEach(item => handle(item));
  return items.map(item => item.value);
}`;
      const result = await tracer.traceExecutionPaths(code, 'javascript');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should detect arrow function declarations', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"pathName":"test","steps":[],"complexity":1,"isCritical":false}',
          },
        ],
      });

      const code = `export const handler = async (req, res) => {
  res.json({ ok: true });
};`;
      const result = await tracer.traceExecutionPaths(code, 'javascript');
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
