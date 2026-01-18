/**
 * DEBUGGER MODULE EXPORTS
 *
 * Real debugging infrastructure for Code Lab.
 */

// Core debugger
export {
  DebugAdapter,
  NodeDebugAdapter,
  PythonDebugAdapter,
  createDebugAdapter,
  type DebugConfiguration,
  type Breakpoint,
  type Source,
  type StackFrame,
  type Scope,
  type Variable,
  type Thread,
  type DebugState,
  type DebugSession,
} from './debug-adapter';

// Manager
export {
  DebugManager,
  getDebugManager,
  type DebugSessionInfo,
} from './debug-manager';

// Client-side hook (to be used in React components)
export { useDebugSession } from './useDebugSession';
