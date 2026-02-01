/**
 * DESIGN PATTERN TOOL
 * Detect, suggest, and generate design patterns
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const PATTERNS = {
  creational: {
    singleton: {
      description: 'Ensures a class has only one instance',
      indicators: ['getInstance', 'private constructor', 'static instance', '_instance'],
      useCase: 'Database connections, configuration managers, logging',
      template: `class Singleton {
  private static instance: Singleton;
  private constructor() {}
  public static getInstance(): Singleton {
    if (!Singleton.instance) {
      Singleton.instance = new Singleton();
    }
    return Singleton.instance;
  }
}`
    },
    factory: {
      description: 'Creates objects without specifying exact class',
      indicators: ['create', 'make', 'Factory', 'build', 'produce'],
      useCase: 'When object creation logic is complex or varies',
      template: `interface Product { operation(): string; }
class ConcreteProductA implements Product { operation() { return 'A'; } }
class ConcreteProductB implements Product { operation() { return 'B'; } }
class Factory {
  createProduct(type: string): Product {
    switch(type) {
      case 'A': return new ConcreteProductA();
      case 'B': return new ConcreteProductB();
      default: throw new Error('Unknown type');
    }
  }
}`
    },
    builder: {
      description: 'Constructs complex objects step by step',
      indicators: ['Builder', 'build', 'with', 'set', 'addPart'],
      useCase: 'Complex object construction with many optional parameters',
      template: `class Builder {
  private product: Product = new Product();
  withName(name: string) { this.product.name = name; return this; }
  withSize(size: number) { this.product.size = size; return this; }
  build() { return this.product; }
}
// Usage: new Builder().withName('test').withSize(10).build();`
    },
    prototype: {
      description: 'Creates new objects by cloning existing ones',
      indicators: ['clone', 'prototype', 'copy', 'Object.create'],
      useCase: 'When object creation is expensive',
      template: `interface Prototype { clone(): Prototype; }
class ConcretePrototype implements Prototype {
  constructor(public value: number) {}
  clone(): Prototype { return new ConcretePrototype(this.value); }
}`
    }
  },
  structural: {
    adapter: {
      description: 'Converts interface of one class to another',
      indicators: ['Adapter', 'adapt', 'wrap', 'convert', 'translate'],
      useCase: 'Integrating incompatible interfaces',
      template: `interface Target { request(): string; }
class Adaptee { specificRequest() { return 'Specific'; } }
class Adapter implements Target {
  constructor(private adaptee: Adaptee) {}
  request() { return this.adaptee.specificRequest(); }
}`
    },
    decorator: {
      description: 'Adds behavior to objects dynamically',
      indicators: ['Decorator', 'wrap', 'enhance', 'Component'],
      useCase: 'Adding features without subclassing',
      template: `interface Component { operation(): string; }
class ConcreteComponent implements Component { operation() { return 'Base'; } }
class Decorator implements Component {
  constructor(protected component: Component) {}
  operation() { return \`Decorated(\${this.component.operation()})\`; }
}`
    },
    facade: {
      description: 'Provides simplified interface to complex subsystem',
      indicators: ['Facade', 'simplify', 'unified', 'subsystem'],
      useCase: 'Simplifying complex library/API usage',
      template: `class SubsystemA { operationA() { return 'A'; } }
class SubsystemB { operationB() { return 'B'; } }
class Facade {
  constructor(private a = new SubsystemA(), private b = new SubsystemB()) {}
  operation() { return this.a.operationA() + this.b.operationB(); }
}`
    },
    proxy: {
      description: 'Controls access to another object',
      indicators: ['Proxy', 'handler', 'target', 'intercept', 'Reflect'],
      useCase: 'Lazy loading, access control, logging',
      template: `interface Subject { request(): void; }
class RealSubject implements Subject { request() { console.log('Real'); } }
class ProxySubject implements Subject {
  constructor(private real: RealSubject) {}
  request() { console.log('Proxy'); this.real.request(); }
}`
    },
    composite: {
      description: 'Composes objects into tree structures',
      indicators: ['Composite', 'children', 'add', 'remove', 'Component'],
      useCase: 'Tree structures, file systems, UI components',
      template: `interface Component { operation(): string; }
class Leaf implements Component { operation() { return 'Leaf'; } }
class Composite implements Component {
  private children: Component[] = [];
  add(c: Component) { this.children.push(c); }
  operation() { return this.children.map(c => c.operation()).join('+'); }
}`
    }
  },
  behavioral: {
    observer: {
      description: 'Defines subscription mechanism for events',
      indicators: ['Observer', 'subscribe', 'unsubscribe', 'notify', 'listener', 'emit', 'on'],
      useCase: 'Event handling, reactive programming',
      template: `interface Observer { update(data: any): void; }
class Subject {
  private observers: Observer[] = [];
  subscribe(o: Observer) { this.observers.push(o); }
  notify(data: any) { this.observers.forEach(o => o.update(data)); }
}`
    },
    strategy: {
      description: 'Defines family of interchangeable algorithms',
      indicators: ['Strategy', 'algorithm', 'execute', 'setStrategy', 'policy'],
      useCase: 'Different sorting algorithms, payment methods',
      template: `interface Strategy { execute(data: number[]): number[]; }
class BubbleSort implements Strategy { execute(d: number[]) { return d.sort(); } }
class Context {
  constructor(private strategy: Strategy) {}
  setStrategy(s: Strategy) { this.strategy = s; }
  doSort(data: number[]) { return this.strategy.execute(data); }
}`
    },
    command: {
      description: 'Encapsulates request as an object',
      indicators: ['Command', 'execute', 'undo', 'Invoker', 'Receiver'],
      useCase: 'Undo/redo, transaction systems, queuing',
      template: `interface Command { execute(): void; undo(): void; }
class ConcreteCommand implements Command {
  constructor(private receiver: Receiver) {}
  execute() { this.receiver.action(); }
  undo() { this.receiver.undoAction(); }
}`
    },
    state: {
      description: 'Alters behavior when internal state changes',
      indicators: ['State', 'setState', 'handle', 'transition', 'context'],
      useCase: 'State machines, workflow systems',
      template: `interface State { handle(context: Context): void; }
class Context {
  constructor(private state: State) {}
  setState(s: State) { this.state = s; }
  request() { this.state.handle(this); }
}`
    },
    mediator: {
      description: 'Centralizes complex communications',
      indicators: ['Mediator', 'notify', 'Colleague', 'coordinate'],
      useCase: 'Chat rooms, air traffic control',
      template: `interface Mediator { notify(sender: object, event: string): void; }
class ConcreteMediator implements Mediator {
  notify(sender: object, event: string) {
    // Coordinate between components
  }
}`
    }
  }
};

function detectPatterns(code: string): Record<string, unknown> {
  const detected: Record<string, { confidence: number; matches: string[] }> = {};

  for (const [, patterns] of Object.entries(PATTERNS)) {
    for (const [name, pattern] of Object.entries(patterns)) {
      const matches: string[] = [];
      let score = 0;

      for (const indicator of pattern.indicators) {
        if (code.toLowerCase().includes(indicator.toLowerCase())) {
          matches.push(indicator);
          score++;
        }
      }

      if (score >= 2) {
        detected[name] = {
          confidence: Math.min(score / pattern.indicators.length, 1),
          matches
        };
      }
    }
  }

  return {
    patternsDetected: Object.keys(detected),
    details: detected,
    count: Object.keys(detected).length
  };
}

function suggestPatterns(problem: string): Record<string, unknown> {
  const suggestions: Record<string, unknown>[] = [];
  const problemLower = problem.toLowerCase();

  const problemPatternMap: Record<string, string[]> = {
    'single instance': ['singleton'],
    'one instance': ['singleton'],
    'global': ['singleton'],
    'create object': ['factory', 'builder', 'prototype'],
    'complex object': ['builder'],
    'optional parameter': ['builder'],
    'clone': ['prototype'],
    'incompatible': ['adapter'],
    'legacy': ['adapter'],
    'add feature': ['decorator'],
    'extend': ['decorator'],
    'simplify': ['facade'],
    'complex api': ['facade'],
    'access control': ['proxy'],
    'lazy load': ['proxy'],
    'cache': ['proxy'],
    'tree': ['composite'],
    'hierarchy': ['composite'],
    'event': ['observer'],
    'notify': ['observer'],
    'subscribe': ['observer'],
    'algorithm': ['strategy'],
    'interchangeable': ['strategy'],
    'undo': ['command'],
    'transaction': ['command'],
    'state machine': ['state'],
    'workflow': ['state'],
    'coordinate': ['mediator'],
    'communicate': ['mediator']
  };

  for (const [keyword, patterns] of Object.entries(problemPatternMap)) {
    if (problemLower.includes(keyword)) {
      for (const patternName of patterns) {
        for (const [category, categoryPatterns] of Object.entries(PATTERNS)) {
          if (patternName in categoryPatterns) {
            const pattern = (categoryPatterns as Record<string, { description: string; useCase: string; indicators: string[]; template: string }>)[patternName];
            suggestions.push({
              pattern: patternName,
              category,
              description: pattern.description,
              useCase: pattern.useCase,
              relevance: 'high'
            });
          }
        }
      }
    }
  }

  return {
    problem,
    suggestions: [...new Map(suggestions.map(s => [s.pattern, s])).values()],
    count: suggestions.length
  };
}

function generatePattern(patternName: string): Record<string, unknown> {
  for (const [category, patterns] of Object.entries(PATTERNS)) {
    if (patternName in patterns) {
      const pattern = (patterns as Record<string, { description: string; useCase: string; indicators: string[]; template: string }>)[patternName];
      return {
        pattern: patternName,
        category,
        description: pattern.description,
        useCase: pattern.useCase,
        template: pattern.template,
        indicators: pattern.indicators
      };
    }
  }
  return { error: `Pattern '${patternName}' not found`, availablePatterns: Object.values(PATTERNS).flatMap(c => Object.keys(c)) };
}

function listPatterns(category?: string): Record<string, unknown> {
  if (category && category in PATTERNS) {
    return {
      category,
      patterns: Object.entries(PATTERNS[category as keyof typeof PATTERNS]).map(([name, p]) => ({
        name,
        description: p.description,
        useCase: p.useCase
      }))
    };
  }

  return {
    categories: Object.keys(PATTERNS),
    allPatterns: Object.entries(PATTERNS).flatMap(([cat, patterns]) =>
      Object.entries(patterns).map(([name, p]) => ({
        name,
        category: cat,
        description: p.description
      }))
    )
  };
}

export const designPatternTool: UnifiedTool = {
  name: 'design_pattern',
  description: 'Design Patterns: detect, suggest, generate, list - creational, structural, behavioral patterns',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['detect', 'suggest', 'generate', 'list'] },
      code: { type: 'string', description: 'Source code to analyze for patterns' },
      problem: { type: 'string', description: 'Problem description for pattern suggestion' },
      pattern: { type: 'string', description: 'Pattern name to generate' },
      category: { type: 'string', description: 'Pattern category (creational, structural, behavioral)' }
    },
    required: ['operation']
  },
};

export async function executeDesignPattern(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'detect':
        result = detectPatterns(args.code || 'class Singleton { private static instance; static getInstance() { return this.instance; } }');
        break;
      case 'suggest':
        result = suggestPatterns(args.problem || 'I need to create objects without specifying exact class');
        break;
      case 'generate':
        result = generatePattern(args.pattern || 'singleton');
        break;
      case 'list':
        result = listPatterns(args.category);
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isDesignPatternAvailable(): boolean { return true; }
