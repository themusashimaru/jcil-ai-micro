/**
 * DEBUGGER MODULE EXPORTS - EPIC MULTI-LANGUAGE SUPPORT
 *
 * Real debugging infrastructure for Code Lab.
 * Supports 30+ programming languages including:
 * - Node.js/JavaScript/TypeScript, Python, Go, Rust
 * - Java, Kotlin, Scala, Groovy, Clojure
 * - C, C++, Ruby, PHP, C#, F#, Swift
 * - Perl, Lua, R, Julia, Elixir, Erlang
 * - Haskell, Dart, Zig, Nim, Crystal
 * - OCaml, V, Odin, Bash, PowerShell
 */

// Core debugger - Legacy adapters
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

// Universal Multi-Language Debug Adapter (30+ languages)
export type { DebugLanguage } from './debug-adapter';
export {
  createUniversalDebugAdapter,
  getAllSupportedLanguages,
  createDebugAdapterForFile,
  UniversalDebugAdapter,
  getSupportedLanguages,
  getLanguageConfig,
  detectLanguageFromFile,
  getLanguageDisplayNames,
  getLanguageCapabilitiesSummary,
  LANGUAGE_CONFIGS,
} from './debug-adapter';

// Direct exports from multi-language adapters
export {
  type LanguageDebugConfig,
  type DebugEvents,
  type VariablePresentationHint,
} from './multi-language-adapters';

// CDP Client for Node.js debugging
export {
  CDPClient,
  cdpClient,
  type CDPLocation,
  type CDPBreakpoint,
  type CDPCallFrame,
  type CDPScope,
  type CDPRemoteObject,
  type CDPPropertyDescriptor,
  type CDPScript,
} from './cdp-client';

// DAP Client for Python and other languages debugging
export {
  DAPClient,
  dapClient,
  type DAPSource,
  type DAPBreakpoint,
  type DAPStackFrame,
  type DAPScope,
  type DAPVariable,
  type DAPThread,
  type DAPCapabilities,
} from './dap-client';

// Manager
export { DebugManager, getDebugManager, type DebugSessionInfo } from './debug-manager';

// Container Debug Adapter (E2B sandboxed debugging)
export {
  ContainerDebugAdapter,
  getContainerDebugAdapter,
  type ContainerDebugConfig,
  type ContainerDebugSession,
} from './container-debug-adapter';

// Client-side hook (to be used in React components)
export { useDebugSession } from './useDebugSession';

// ============================================================================
// SUPPORTED LANGUAGES SUMMARY
// ============================================================================

/**
 * All 30+ supported debug languages:
 *
 * Web/Scripting:
 *   - node (Node.js/JavaScript/TypeScript) - CDP
 *   - python - DAP via debugpy
 *   - ruby - DAP via debug gem
 *   - php - DAP via Xdebug
 *   - perl - DAP
 *   - lua - DAP via MobDebug
 *   - bash - DAP via bashdb
 *   - powershell - DAP
 *
 * Systems Programming:
 *   - go - DAP via Delve
 *   - rust - DAP via CodeLLDB
 *   - c - DAP via GDB/LLDB
 *   - cpp (C++) - DAP via GDB/LLDB
 *   - zig - DAP via LLDB
 *   - nim - DAP via LLDB
 *   - crystal - DAP via LLDB
 *   - v - DAP via LLDB
 *   - odin - DAP via LLDB
 *
 * JVM Languages:
 *   - java - JDWP
 *   - kotlin - JDWP
 *   - scala - JDWP
 *   - groovy - JDWP
 *   - clojure - Custom via nREPL/CIDER
 *
 * .NET Languages:
 *   - csharp (C#) - DAP via netcoredbg
 *   - fsharp (F#) - DAP via netcoredbg
 *
 * Apple Ecosystem:
 *   - swift - DAP via LLDB
 *
 * Functional Languages:
 *   - haskell - DAP via ghci-dap
 *   - ocaml - DAP via earlybird
 *   - elixir - DAP
 *   - erlang - DAP
 *
 * Data Science/Scientific:
 *   - r - DAP via vscDebugger
 *   - julia - DAP via DebugAdapter
 *
 * Mobile/Cross-platform:
 *   - dart (Dart/Flutter) - DAP
 */
