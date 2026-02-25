import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { CodeFlowVisualizer } from './code-flow-visualizer';

describe('CodeFlowVisualizer', () => {
  let visualizer: CodeFlowVisualizer;

  beforeEach(() => {
    visualizer = new CodeFlowVisualizer();
  });

  // ==========================================================================
  // CONSTRUCTOR
  // ==========================================================================

  it('should create an instance', () => {
    expect(visualizer).toBeInstanceOf(CodeFlowVisualizer);
  });

  // ==========================================================================
  // visualize()
  // ==========================================================================

  describe('visualize', () => {
    it('should return mermaid, ascii, and hotspots', async () => {
      const result = await visualizer.visualize('const x = 1;', 'javascript');
      expect(result).toHaveProperty('mermaid');
      expect(result).toHaveProperty('ascii');
      expect(result).toHaveProperty('hotspots');
      expect(typeof result.mermaid).toBe('string');
      expect(typeof result.ascii).toBe('string');
      expect(Array.isArray(result.hotspots)).toBe(true);
    });

    it('should detect functions in JavaScript code', async () => {
      const code = `function greet(name) {
  console.log("Hello " + name);
}`;
      const result = await visualizer.visualize(code, 'javascript');
      expect(result.mermaid).toContain('greet');
      expect(result.ascii).toContain('greet');
    });

    it('should detect const arrow function declarations', async () => {
      const code = `const greet = (name) => {
  return name;
}`;
      const result = await visualizer.visualize(code, 'javascript');
      expect(result.mermaid).toContain('greet');
    });

    it('should detect if branches', async () => {
      const code = `function test() {
  if (x > 0) {
    return true;
  } else {
    return false;
  }
}`;
      const result = await visualizer.visualize(code, 'javascript');
      expect(result.mermaid).toContain('branch');
      expect(result.ascii).toContain('if');
    });

    it('should detect for loops', async () => {
      const code = `for (let i = 0; i < 10; i++) {
  console.log(i);
}`;
      const result = await visualizer.visualize(code, 'javascript');
      expect(result.mermaid).toContain('loop');
      expect(result.ascii).toContain('for');
    });

    it('should detect while loops', async () => {
      const code = `while (running) {
  tick();
}`;
      const result = await visualizer.visualize(code, 'javascript');
      expect(result.mermaid).toContain('loop');
      expect(result.ascii).toContain('while');
    });

    it('should detect side effects: console', async () => {
      const code = `function test() {
  console.log("hello");
}`;
      const result = await visualizer.visualize(code, 'javascript');
      expect(result.mermaid).toContain('side');
      expect(result.ascii).toContain('io');
    });

    it('should detect side effects: fetch', async () => {
      const code = `function getData() {
  fetch("https://api.example.com/data");
}`;
      const result = await visualizer.visualize(code, 'javascript');
      expect(result.ascii).toContain('network');
    });

    it('should detect side effects: database query', async () => {
      const code = `function query() {
  db.query("SELECT * FROM users");
}`;
      const result = await visualizer.visualize(code, 'javascript');
      expect(result.ascii).toContain('database');
    });

    it('should detect side effects: file system', async () => {
      const code = `function readData() {
  fs.readFileSync("data.json");
}`;
      const result = await visualizer.visualize(code, 'javascript');
      expect(result.ascii).toContain('file');
    });

    it('should identify hotspots for loops with side effects', async () => {
      const code = `for (let i = 0; i < 10; i++) {
  console.log(i);
  fetch("https://api.example.com/" + i);
}`;
      const result = await visualizer.visualize(code, 'javascript');
      const perfHotspot = result.hotspots.find((h) => h.reason.includes('side effect'));
      expect(perfHotspot).toBeDefined();
    });

    it('should identify hotspots for deeply nested conditionals', async () => {
      const code = `if (a) {
  if (b) {
    if (c) {
      doSomething();
    }
  }
}`;
      const result = await visualizer.visualize(code, 'javascript');
      const nestedHotspot = result.hotspots.find((h) => h.reason.includes('nested'));
      expect(nestedHotspot).toBeDefined();
    });

    it('should identify hotspots for sequential side effects', async () => {
      const code = `function process() {
  console.log("start");
  fetch("/api/data");
  fs.writeFileSync("output.txt", data);
}`;
      const result = await visualizer.visualize(code, 'javascript');
      const seqHotspot = result.hotspots.find((h) => h.reason.includes('sequential side effects'));
      expect(seqHotspot).toBeDefined();
    });

    it('should sort hotspots by severity', async () => {
      const code = `function test() {
  for (let i = 0; i < 10; i++) {
    console.log(i);
    fetch("/api/" + i);
  }
  if (a) {
    if (b) {
      if (c) {
        doSomething();
      }
    }
  }
}`;
      const result = await visualizer.visualize(code, 'javascript');
      const severityOrder: Record<string, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
        info: 4,
      };
      for (let i = 1; i < result.hotspots.length; i++) {
        expect(severityOrder[result.hotspots[i].severity]).toBeGreaterThanOrEqual(
          severityOrder[result.hotspots[i - 1].severity]
        );
      }
    });

    it('should handle empty code', async () => {
      const result = await visualizer.visualize('', 'javascript');
      expect(result.mermaid).toContain('flowchart');
      expect(result.ascii).toContain('SUMMARY');
    });

    it('should include class definitions in Mermaid diagram', async () => {
      const result = await visualizer.visualize('const x = 1;', 'javascript');
      expect(result.mermaid).toContain('classDef function');
      expect(result.mermaid).toContain('classDef branch');
      expect(result.mermaid).toContain('classDef loop');
      expect(result.mermaid).toContain('classDef sideEffect');
    });

    it('should include summary in ASCII output', async () => {
      const result = await visualizer.visualize('const x = 1;', 'javascript');
      expect(result.ascii).toContain('SUMMARY');
      expect(result.ascii).toContain('Functions:');
      expect(result.ascii).toContain('Branches:');
      expect(result.ascii).toContain('Loops:');
      expect(result.ascii).toContain('Side Effects:');
    });
  });

  // ==========================================================================
  // generatePathDiagram()
  // ==========================================================================

  describe('generatePathDiagram', () => {
    it('should return message for empty paths', () => {
      const result = visualizer.generatePathDiagram([]);
      expect(result).toBe('No execution paths detected');
    });

    it('should generate flowchart for execution paths', () => {
      const result = visualizer.generatePathDiagram([
        {
          id: 'path_1',
          name: 'Main Path',
          steps: [
            {
              location: { file: 'test.ts', line: 1 },
              operation: 'Initialize variable',
              inputs: [],
              outputs: [],
              sideEffects: [],
              branches: [],
            },
            {
              location: { file: 'test.ts', line: 5 },
              operation: 'Process data',
              inputs: [],
              outputs: [],
              sideEffects: [],
              branches: [],
            },
          ],
          probability: 1.0,
          complexity: 2,
          isCritical: false,
        },
      ]);

      expect(result).toContain('flowchart TD');
      expect(result).toContain('subgraph');
      expect(result).toContain('Initialize variable');
      expect(result).toContain('Process data');
      expect(result).toContain('-->');
    });

    it('should include side effect indicators', () => {
      const result = visualizer.generatePathDiagram([
        {
          id: 'path_se',
          name: 'Side Effect Path',
          steps: [
            {
              location: { file: 'test.ts', line: 1 },
              operation: 'Network call',
              inputs: [],
              outputs: [],
              sideEffects: [
                { type: 'network', description: 'API call', reversible: false, idempotent: false },
              ],
              branches: [],
            },
          ],
          probability: 1.0,
          complexity: 1,
          isCritical: false,
        },
      ]);

      expect(result).toContain('network');
      expect(result).toContain('-.->');
    });

    it('should truncate long operation names', () => {
      const longOpName = 'This is a very long operation name that exceeds thirty characters';
      const result = visualizer.generatePathDiagram([
        {
          id: 'path_long',
          name: 'Long Name Path',
          steps: [
            {
              location: { file: 'test.ts', line: 1 },
              operation: longOpName,
              inputs: [],
              outputs: [],
              sideEffects: [],
              branches: [],
            },
          ],
          probability: 1.0,
          complexity: 1,
          isCritical: false,
        },
      ]);

      // The label should be truncated to 30 chars
      expect(result).toContain('...');
    });

    it('should sanitize IDs (replace non-alphanumeric)', () => {
      const result = visualizer.generatePathDiagram([
        {
          id: 'path-with-dashes',
          name: 'Test Path',
          steps: [
            {
              location: { file: 'test.ts', line: 1 },
              operation: 'op',
              inputs: [],
              outputs: [],
              sideEffects: [],
              branches: [],
            },
          ],
          probability: 1.0,
          complexity: 1,
          isCritical: false,
        },
      ]);

      // Dashes should be replaced with underscores in IDs
      expect(result).toContain('path_with_dashes');
    });
  });

  // ==========================================================================
  // generateDataFlowDiagram()
  // ==========================================================================

  describe('generateDataFlowDiagram', () => {
    it('should return a flowchart with input/processing/output subgraphs', () => {
      const result = visualizer.generateDataFlowDiagram('const x = 1;', 'javascript');
      expect(result).toContain('flowchart LR');
      expect(result).toContain('subgraph Input');
      expect(result).toContain('subgraph Processing');
      expect(result).toContain('subgraph Output');
    });

    it('should detect request patterns', () => {
      const code = 'const data = req.body;';
      const result = visualizer.generateDataFlowDiagram(code, 'javascript');
      expect(result).toContain('I1 --> P1');
    });

    it('should detect validation patterns', () => {
      const code = 'validate(input);';
      const result = visualizer.generateDataFlowDiagram(code, 'javascript');
      expect(result).toContain('P1 --> P2');
    });

    it('should detect transform patterns', () => {
      const code = 'const mapped = data.map(x => x * 2);';
      const result = visualizer.generateDataFlowDiagram(code, 'javascript');
      expect(result).toContain('P2 --> P3');
    });

    it('should detect response patterns', () => {
      const code = 'res.json({ data });';
      const result = visualizer.generateDataFlowDiagram(code, 'javascript');
      expect(result).toContain('P3 --> O1');
    });

    it('should detect database write patterns', () => {
      const code = 'await db.save(record);';
      const result = visualizer.generateDataFlowDiagram(code, 'javascript');
      expect(result).toContain('P3 --> O2');
    });

    it('should detect external API patterns', () => {
      const code = 'const response = await fetch(apiUrl);';
      const result = visualizer.generateDataFlowDiagram(code, 'javascript');
      expect(result).toContain('P3 --> O3');
    });
  });

  // ==========================================================================
  // generateDependencyGraph()
  // ==========================================================================

  describe('generateDependencyGraph', () => {
    it('should generate a flowchart for JS imports', () => {
      const code = `import { foo } from './foo';
import { bar } from 'bar-module';`;
      const result = visualizer.generateDependencyGraph(code, 'javascript');

      expect(result).toContain('flowchart BT');
      expect(result).toContain('This Module');
      expect(result).toContain('Dependencies');
      expect(result).toContain('./foo');
      expect(result).toContain('bar-module');
    });

    it('should generate a flowchart for Python imports', () => {
      const code = `from os import path
import sys`;
      const result = visualizer.generateDependencyGraph(code, 'python');

      expect(result).toContain('flowchart BT');
      expect(result).toContain('Dependencies');
    });

    it('should handle code with no imports', () => {
      const code = 'const x = 1;';
      const result = visualizer.generateDependencyGraph(code, 'javascript');

      expect(result).toContain('flowchart BT');
      expect(result).toContain('This Module');
      // No dependencies subgraph since no imports
      expect(result).not.toContain('Dependencies');
    });

    it('should handle default imports', () => {
      const code = `import React from 'react';`;
      const result = visualizer.generateDependencyGraph(code, 'javascript');

      expect(result).toContain('react');
    });
  });
});
