/**
 * EPIC MULTI-LANGUAGE DEBUG ADAPTERS
 *
 * Comprehensive debugging support for 20+ programming languages.
 * This makes Code Lab the most complete debugging platform available.
 *
 * Supported Languages:
 * - Node.js/JavaScript/TypeScript (CDP)
 * - Python (DAP via debugpy)
 * - Go (DAP via Delve)
 * - Rust (DAP via CodeLLDB/rust-gdb)
 * - Java/Kotlin/Scala/Groovy (JDWP)
 * - C/C++ (GDB/LLDB via DAP)
 * - Ruby (DAP via debug gem)
 * - PHP (Xdebug DAP)
 * - C#/F# (.NET DAP)
 * - Swift (LLDB)
 * - Perl (Perl debugger)
 * - Lua (MobDebug)
 * - R (debugger)
 * - Julia (Debugger.jl)
 * - Elixir/Erlang (Debugger)
 * - Haskell (ghci-dap)
 * - Dart/Flutter (Dart DAP)
 * - Zig (GDB/LLDB)
 * - Nim (LLDB)
 * - Crystal (LLDB)
 * - OCaml (earlybird)
 * - V (LLDB)
 * - Odin (LLDB)
 * - Clojure (CIDER/nREPL)
 * - Bash/Shell (bashdb)
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { logger } from '@/lib/logger';
import { CDPClient, CDPCallFrame, CDPPropertyDescriptor, CDPRemoteObject } from './cdp-client';
import { DAPClient, DAPSource, DAPStackFrame, DAPScope, DAPVariable } from './dap-client';

const log = logger('MultiLanguageDebug');

// ============================================================================
// SUPPORTED LANGUAGE TYPES
// ============================================================================

export type DebugLanguage =
  | 'node' // Node.js/JavaScript/TypeScript
  | 'python' // Python
  | 'go' // Go (Delve)
  | 'rust' // Rust (CodeLLDB/rust-gdb)
  | 'java' // Java (JDWP)
  | 'kotlin' // Kotlin (JDWP)
  | 'scala' // Scala (JDWP)
  | 'groovy' // Groovy (JDWP)
  | 'clojure' // Clojure (CIDER/nREPL)
  | 'c' // C (GDB/LLDB)
  | 'cpp' // C++ (GDB/LLDB)
  | 'ruby' // Ruby (debug gem)
  | 'php' // PHP (Xdebug)
  | 'csharp' // C# (.NET)
  | 'fsharp' // F# (.NET)
  | 'swift' // Swift (LLDB)
  | 'perl' // Perl
  | 'lua' // Lua (MobDebug)
  | 'r' // R
  | 'julia' // Julia (Debugger.jl)
  | 'elixir' // Elixir (Debugger)
  | 'erlang' // Erlang (Debugger)
  | 'haskell' // Haskell (ghci-dap)
  | 'dart' // Dart/Flutter
  | 'zig' // Zig (GDB/LLDB)
  | 'nim' // Nim (LLDB)
  | 'crystal' // Crystal (LLDB)
  | 'ocaml' // OCaml (earlybird)
  | 'v' // V (LLDB)
  | 'odin' // Odin (LLDB)
  | 'bash' // Bash/Shell (bashdb)
  | 'powershell'; // PowerShell

// ============================================================================
// LANGUAGE CONFIGURATION
// ============================================================================

export interface LanguageDebugConfig {
  language: DebugLanguage;
  name: string;
  protocol: 'cdp' | 'dap' | 'jdwp' | 'custom';
  defaultPort: number;
  fileExtensions: string[];
  installCommand?: string;
  debugCommand: (config: DebugConfiguration) => string;
  attachCommand?: (config: DebugConfiguration) => string;
  requiresCompilation?: boolean;
  compileCommand?: (config: DebugConfiguration) => string;
  supportsBreakpoints: boolean;
  supportsConditionalBreakpoints: boolean;
  supportsLogPoints: boolean;
  supportsHitCount: boolean;
  supportsDataBreakpoints: boolean;
  supportsExceptionBreakpoints: boolean;
  supportsStepBack: boolean;
  supportsRestartFrame: boolean;
  supportsGotoTargets: boolean;
  supportsCompletionsRequest: boolean;
  supportsModulesRequest: boolean;
  supportsLoadedSourcesRequest: boolean;
  supportsTerminateRequest: boolean;
  supportsSuspendDebuggee: boolean;
  supportsValueFormattingOptions: boolean;
  supportsFunctionBreakpoints: boolean;
}

// ============================================================================
// COMPREHENSIVE LANGUAGE CONFIGURATIONS
// ============================================================================

export const LANGUAGE_CONFIGS: Record<DebugLanguage, LanguageDebugConfig> = {
  // Node.js/JavaScript/TypeScript (Chrome DevTools Protocol)
  node: {
    language: 'node',
    name: 'Node.js / JavaScript / TypeScript',
    protocol: 'cdp',
    defaultPort: 9229,
    fileExtensions: ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.jsx', '.tsx'],
    debugCommand: (c) =>
      `node --inspect-brk=0.0.0.0:${c.port || 9229} ${c.program} ${c.args?.join(' ') || ''}`,
    attachCommand: (c) => `node --inspect=0.0.0.0:${c.port || 9229}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: true,
    supportsHitCount: true,
    supportsDataBreakpoints: false,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: true,
    supportsGotoTargets: false,
    supportsCompletionsRequest: true,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // Python (Debug Adapter Protocol via debugpy)
  python: {
    language: 'python',
    name: 'Python',
    protocol: 'dap',
    defaultPort: 5678,
    fileExtensions: ['.py', '.pyw', '.pyi'],
    installCommand: 'pip install debugpy',
    debugCommand: (c) =>
      `python3 -m debugpy --listen 0.0.0.0:${c.port || 5678} --wait-for-client ${c.program} ${c.args?.join(' ') || ''}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: true,
    supportsHitCount: true,
    supportsDataBreakpoints: false,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: true,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // Go (Debug Adapter Protocol via Delve)
  go: {
    language: 'go',
    name: 'Go',
    protocol: 'dap',
    defaultPort: 2345,
    fileExtensions: ['.go'],
    installCommand: 'go install github.com/go-delve/delve/cmd/dlv@latest',
    debugCommand: (c) =>
      `dlv dap --listen=0.0.0.0:${c.port || 2345} --api-version=2 -- exec ${c.program} ${c.args?.join(' ') || ''}`,
    requiresCompilation: true,
    compileCommand: (c) =>
      `go build -gcflags="all=-N -l" -o ${c.program?.replace('.go', '')} ${c.program}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: true,
    supportsHitCount: true,
    supportsDataBreakpoints: true,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: false,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // Rust (Debug Adapter Protocol via CodeLLDB or rust-gdb)
  rust: {
    language: 'rust',
    name: 'Rust',
    protocol: 'dap',
    defaultPort: 13000,
    fileExtensions: ['.rs'],
    installCommand: 'rustup component add lldb-preview',
    requiresCompilation: true,
    compileCommand: (_c) => `cargo build`,
    debugCommand: (c) =>
      `rust-lldb --dap --port ${c.port || 13000} -- ${c.program} ${c.args?.join(' ') || ''}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: true,
    supportsHitCount: true,
    supportsDataBreakpoints: true,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: true,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // Java (JDWP - Java Debug Wire Protocol)
  java: {
    language: 'java',
    name: 'Java',
    protocol: 'jdwp',
    defaultPort: 5005,
    fileExtensions: ['.java'],
    requiresCompilation: true,
    compileCommand: (c) => `javac -g ${c.program}`,
    debugCommand: (c) =>
      `java -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=*:${c.port || 5005} ${c.program?.replace('.java', '')}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: false,
    supportsHitCount: true,
    supportsDataBreakpoints: true,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: true,
    supportsGotoTargets: false,
    supportsCompletionsRequest: false,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // Kotlin (JDWP - Uses JVM)
  kotlin: {
    language: 'kotlin',
    name: 'Kotlin',
    protocol: 'jdwp',
    defaultPort: 5005,
    fileExtensions: ['.kt', '.kts'],
    requiresCompilation: true,
    compileCommand: (c) =>
      `kotlinc ${c.program} -include-runtime -d ${c.program?.replace('.kt', '.jar')}`,
    debugCommand: (c) =>
      `java -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=*:${c.port || 5005} -jar ${c.program?.replace('.kt', '.jar')}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: false,
    supportsHitCount: true,
    supportsDataBreakpoints: true,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: true,
    supportsGotoTargets: false,
    supportsCompletionsRequest: false,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // Scala (JDWP - Uses JVM)
  scala: {
    language: 'scala',
    name: 'Scala',
    protocol: 'jdwp',
    defaultPort: 5005,
    fileExtensions: ['.scala', '.sc'],
    requiresCompilation: true,
    compileCommand: (c) => `scalac -g ${c.program}`,
    debugCommand: (c) =>
      `java -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=*:${c.port || 5005} ${c.program?.replace('.scala', '')}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: false,
    supportsHitCount: true,
    supportsDataBreakpoints: true,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: true,
    supportsGotoTargets: false,
    supportsCompletionsRequest: false,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // Groovy (JDWP - Uses JVM)
  groovy: {
    language: 'groovy',
    name: 'Groovy',
    protocol: 'jdwp',
    defaultPort: 5005,
    fileExtensions: ['.groovy', '.gvy', '.gy', '.gsh'],
    debugCommand: (config) =>
      `groovy -Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=${config.port || 5005} ${config.program}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: false,
    supportsHitCount: true,
    supportsDataBreakpoints: true,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: true,
    supportsGotoTargets: false,
    supportsCompletionsRequest: false,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // Clojure (nREPL/CIDER)
  clojure: {
    language: 'clojure',
    name: 'Clojure',
    protocol: 'custom',
    defaultPort: 7888,
    fileExtensions: ['.clj', '.cljs', '.cljc', '.edn'],
    debugCommand: (c) =>
      `clj -Sdeps '{:deps {nrepl/nrepl {:mvn/version "1.0.0"} cider/cider-nrepl {:mvn/version "0.30.0"}}}' -M -m nrepl.cmdline --middleware '["cider.nrepl/cider-middleware"]' --port ${c.port || 7888}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: true,
    supportsHitCount: false,
    supportsDataBreakpoints: false,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: true,
    supportsModulesRequest: false,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: false,
  },

  // C (GDB or LLDB via DAP)
  c: {
    language: 'c',
    name: 'C',
    protocol: 'dap',
    defaultPort: 4711,
    fileExtensions: ['.c', '.h'],
    requiresCompilation: true,
    compileCommand: (c) => `gcc -g -O0 -o ${c.program?.replace('.c', '')} ${c.program}`,
    debugCommand: (c) =>
      `lldb-vscode --port ${c.port || 4711} -- ${c.program?.replace('.c', '')} ${c.args?.join(' ') || ''}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: true,
    supportsHitCount: true,
    supportsDataBreakpoints: true,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: true,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // C++ (GDB or LLDB via DAP)
  cpp: {
    language: 'cpp',
    name: 'C++',
    protocol: 'dap',
    defaultPort: 4711,
    fileExtensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hxx', '.h'],
    requiresCompilation: true,
    compileCommand: (c) =>
      `g++ -g -O0 -o ${c.program?.replace(/\.(cpp|cc|cxx)$/, '')} ${c.program}`,
    debugCommand: (c) =>
      `lldb-vscode --port ${c.port || 4711} -- ${c.program?.replace(/\.(cpp|cc|cxx)$/, '')} ${c.args?.join(' ') || ''}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: true,
    supportsHitCount: true,
    supportsDataBreakpoints: true,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: true,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // Ruby (Debug gem with DAP)
  ruby: {
    language: 'ruby',
    name: 'Ruby',
    protocol: 'dap',
    defaultPort: 12345,
    fileExtensions: ['.rb', '.rake', '.gemspec'],
    installCommand: 'gem install debug',
    debugCommand: (c) =>
      `rdbg --open --port ${c.port || 12345} -- ${c.program} ${c.args?.join(' ') || ''}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: true,
    supportsHitCount: true,
    supportsDataBreakpoints: false,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: true,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // PHP (Xdebug 3 with DAP)
  php: {
    language: 'php',
    name: 'PHP',
    protocol: 'dap',
    defaultPort: 9003,
    fileExtensions: ['.php', '.phtml', '.php3', '.php4', '.php5', '.phps'],
    installCommand: 'pecl install xdebug',
    debugCommand: (c) =>
      `php -dxdebug.mode=debug -dxdebug.start_with_request=yes -dxdebug.client_port=${c.port || 9003} -dxdebug.client_host=0.0.0.0 ${c.program} ${c.args?.join(' ') || ''}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: true,
    supportsHitCount: true,
    supportsDataBreakpoints: false,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: false,
    supportsModulesRequest: false,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // C# (.NET with netcoredbg)
  csharp: {
    language: 'csharp',
    name: 'C#',
    protocol: 'dap',
    defaultPort: 4712,
    fileExtensions: ['.cs', '.csx'],
    requiresCompilation: true,
    compileCommand: (_c) => `dotnet build`,
    debugCommand: (c) => `netcoredbg --server --port ${c.port || 4712} -- dotnet ${c.program}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: true,
    supportsHitCount: true,
    supportsDataBreakpoints: true,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: false,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // F# (.NET with netcoredbg)
  fsharp: {
    language: 'fsharp',
    name: 'F#',
    protocol: 'dap',
    defaultPort: 4712,
    fileExtensions: ['.fs', '.fsx', '.fsi'],
    requiresCompilation: true,
    compileCommand: (_c) => `dotnet build`,
    debugCommand: (c) => `netcoredbg --server --port ${c.port || 4712} -- dotnet ${c.program}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: true,
    supportsHitCount: true,
    supportsDataBreakpoints: true,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: false,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // Swift (LLDB)
  swift: {
    language: 'swift',
    name: 'Swift',
    protocol: 'dap',
    defaultPort: 4713,
    fileExtensions: ['.swift'],
    requiresCompilation: true,
    compileCommand: (c) => `swiftc -g -o ${c.program?.replace('.swift', '')} ${c.program}`,
    debugCommand: (c) =>
      `lldb-vscode --port ${c.port || 4713} -- ${c.program?.replace('.swift', '')} ${c.args?.join(' ') || ''}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: true,
    supportsHitCount: true,
    supportsDataBreakpoints: true,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: true,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // Perl (Perl debugger with DAP adapter)
  perl: {
    language: 'perl',
    name: 'Perl',
    protocol: 'dap',
    defaultPort: 13603,
    fileExtensions: ['.pl', '.pm', '.t', '.pod'],
    installCommand: 'cpanm Perl::LanguageServer',
    debugCommand: (c) => `perl -d ${c.program} ${c.args?.join(' ') || ''}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: false,
    supportsHitCount: false,
    supportsDataBreakpoints: false,
    supportsExceptionBreakpoints: false,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: false,
    supportsModulesRequest: false,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: false,
    supportsFunctionBreakpoints: false,
  },

  // Lua (MobDebug)
  lua: {
    language: 'lua',
    name: 'Lua',
    protocol: 'dap',
    defaultPort: 8172,
    fileExtensions: ['.lua'],
    installCommand: 'luarocks install mobdebug',
    debugCommand: (c) =>
      `lua -e "require('mobdebug').listen('0.0.0.0', ${c.port || 8172})" & lua ${c.program} ${c.args?.join(' ') || ''}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: false,
    supportsLogPoints: false,
    supportsHitCount: false,
    supportsDataBreakpoints: false,
    supportsExceptionBreakpoints: false,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: false,
    supportsModulesRequest: false,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: false,
    supportsFunctionBreakpoints: false,
  },

  // R (R debugger)
  r: {
    language: 'r',
    name: 'R',
    protocol: 'dap',
    defaultPort: 18721,
    fileExtensions: ['.r', '.R', '.rmd', '.Rmd'],
    installCommand: 'R -e "install.packages(\'vscDebugger\')"',
    debugCommand: (c) =>
      `R --vanilla -e "vscDebugger::.vsc.listenForDAP(port=${c.port || 18721}); source('${c.program}')"`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: false,
    supportsLogPoints: false,
    supportsHitCount: false,
    supportsDataBreakpoints: false,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: true,
    supportsModulesRequest: false,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: false,
  },

  // Julia (Debugger.jl)
  julia: {
    language: 'julia',
    name: 'Julia',
    protocol: 'dap',
    defaultPort: 18001,
    fileExtensions: ['.jl'],
    installCommand: 'julia -e "using Pkg; Pkg.add(\\"DebugAdapter\\")"',
    debugCommand: (c) =>
      `julia -e "using DebugAdapter; DebugAdapter.run_debugger(port=${c.port || 18001}, file=\\"${c.program}\\")"`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: false,
    supportsHitCount: false,
    supportsDataBreakpoints: false,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: true,
    supportsGotoTargets: false,
    supportsCompletionsRequest: true,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // Elixir (Erlang/OTP debugger)
  elixir: {
    language: 'elixir',
    name: 'Elixir',
    protocol: 'dap',
    defaultPort: 9001,
    fileExtensions: ['.ex', '.exs'],
    installCommand: 'mix archive.install hex elixir_ls',
    debugCommand: (c) => `elixir --sname debug -S mix run ${c.program} ${c.args?.join(' ') || ''}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: false,
    supportsHitCount: false,
    supportsDataBreakpoints: false,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: true,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: false,
    supportsFunctionBreakpoints: false,
  },

  // Erlang (OTP debugger)
  erlang: {
    language: 'erlang',
    name: 'Erlang',
    protocol: 'dap',
    defaultPort: 9002,
    fileExtensions: ['.erl', '.hrl'],
    debugCommand: (c) =>
      `erl -sname debug -pa ebin -run ${c.program?.replace('.erl', '')} start ${c.args?.join(' ') || ''}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: false,
    supportsLogPoints: false,
    supportsHitCount: false,
    supportsDataBreakpoints: false,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: false,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: false,
    supportsFunctionBreakpoints: false,
  },

  // Haskell (ghci-dap / haskell-debug-adapter)
  haskell: {
    language: 'haskell',
    name: 'Haskell',
    protocol: 'dap',
    defaultPort: 4712,
    fileExtensions: ['.hs', '.lhs'],
    installCommand: 'cabal install haskell-dap ghci-dap',
    debugCommand: (c) => `haskell-debug-adapter --port ${c.port || 4712}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: false,
    supportsHitCount: false,
    supportsDataBreakpoints: false,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: true,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // Dart/Flutter (Dart DAP)
  dart: {
    language: 'dart',
    name: 'Dart / Flutter',
    protocol: 'dap',
    defaultPort: 6001,
    fileExtensions: ['.dart'],
    debugCommand: (c) =>
      `dart run --enable-vm-service=${c.port || 6001} ${c.program} ${c.args?.join(' ') || ''}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: true,
    supportsHitCount: false,
    supportsDataBreakpoints: false,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: true,
    supportsGotoTargets: false,
    supportsCompletionsRequest: true,
    supportsModulesRequest: false,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // Zig (LLDB/GDB)
  zig: {
    language: 'zig',
    name: 'Zig',
    protocol: 'dap',
    defaultPort: 4714,
    fileExtensions: ['.zig'],
    requiresCompilation: true,
    compileCommand: (c) => `zig build-exe ${c.program} -fno-llvm`,
    debugCommand: (c) =>
      `lldb-vscode --port ${c.port || 4714} -- ${c.program?.replace('.zig', '')} ${c.args?.join(' ') || ''}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: true,
    supportsHitCount: true,
    supportsDataBreakpoints: true,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: true,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // Nim (LLDB)
  nim: {
    language: 'nim',
    name: 'Nim',
    protocol: 'dap',
    defaultPort: 4715,
    fileExtensions: ['.nim', '.nims', '.nimble'],
    requiresCompilation: true,
    compileCommand: (c) => `nim c --debugger:native ${c.program}`,
    debugCommand: (c) =>
      `lldb-vscode --port ${c.port || 4715} -- ${c.program?.replace('.nim', '')} ${c.args?.join(' ') || ''}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: true,
    supportsHitCount: true,
    supportsDataBreakpoints: true,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: true,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // Crystal (LLDB)
  crystal: {
    language: 'crystal',
    name: 'Crystal',
    protocol: 'dap',
    defaultPort: 4716,
    fileExtensions: ['.cr'],
    requiresCompilation: true,
    compileCommand: (c) => `crystal build --debug ${c.program}`,
    debugCommand: (c) =>
      `lldb-vscode --port ${c.port || 4716} -- ${c.program?.replace('.cr', '')} ${c.args?.join(' ') || ''}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: true,
    supportsHitCount: true,
    supportsDataBreakpoints: true,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: true,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // OCaml (earlybird DAP)
  ocaml: {
    language: 'ocaml',
    name: 'OCaml',
    protocol: 'dap',
    defaultPort: 4717,
    fileExtensions: ['.ml', '.mli', '.mll', '.mly'],
    installCommand: 'opam install earlybird',
    requiresCompilation: true,
    compileCommand: (c) => `ocamlfind ocamlopt -g -o ${c.program?.replace('.ml', '')} ${c.program}`,
    debugCommand: (c) => `earlybird --port ${c.port || 4717}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: false,
    supportsLogPoints: false,
    supportsHitCount: false,
    supportsDataBreakpoints: false,
    supportsExceptionBreakpoints: true,
    supportsStepBack: true,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: false,
    supportsModulesRequest: false,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: false,
  },

  // V (LLDB)
  v: {
    language: 'v',
    name: 'V',
    protocol: 'dap',
    defaultPort: 4718,
    fileExtensions: ['.v', '.vv'],
    requiresCompilation: true,
    compileCommand: (c) => `v -g -o ${c.program?.replace('.v', '')} ${c.program}`,
    debugCommand: (c) =>
      `lldb-vscode --port ${c.port || 4718} -- ${c.program?.replace('.v', '')} ${c.args?.join(' ') || ''}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: true,
    supportsHitCount: true,
    supportsDataBreakpoints: true,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: true,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // Odin (LLDB)
  odin: {
    language: 'odin',
    name: 'Odin',
    protocol: 'dap',
    defaultPort: 4719,
    fileExtensions: ['.odin'],
    requiresCompilation: true,
    compileCommand: (c) => `odin build ${c.program} -debug -out:${c.program?.replace('.odin', '')}`,
    debugCommand: (c) =>
      `lldb-vscode --port ${c.port || 4719} -- ${c.program?.replace('.odin', '')} ${c.args?.join(' ') || ''}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: true,
    supportsHitCount: true,
    supportsDataBreakpoints: true,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: true,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },

  // Bash/Shell (bashdb)
  bash: {
    language: 'bash',
    name: 'Bash / Shell',
    protocol: 'dap',
    defaultPort: 4720,
    fileExtensions: ['.sh', '.bash', '.zsh', '.ksh'],
    installCommand: 'apt-get install bashdb || brew install bashdb',
    debugCommand: (c) => `bashdb --port ${c.port || 4720} ${c.program} ${c.args?.join(' ') || ''}`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: false,
    supportsHitCount: false,
    supportsDataBreakpoints: false,
    supportsExceptionBreakpoints: false,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: false,
    supportsModulesRequest: false,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: false,
    supportsFunctionBreakpoints: false,
  },

  // PowerShell
  powershell: {
    language: 'powershell',
    name: 'PowerShell',
    protocol: 'dap',
    defaultPort: 4721,
    fileExtensions: ['.ps1', '.psm1', '.psd1'],
    debugCommand: (c) =>
      `pwsh -NoProfile -Command "Start-EditorServices -Port ${c.port || 4721} -HostName localhost -LogLevel Normal -LogPath /tmp/pwsh.log"`,
    supportsBreakpoints: true,
    supportsConditionalBreakpoints: true,
    supportsLogPoints: true,
    supportsHitCount: true,
    supportsDataBreakpoints: false,
    supportsExceptionBreakpoints: true,
    supportsStepBack: false,
    supportsRestartFrame: false,
    supportsGotoTargets: false,
    supportsCompletionsRequest: true,
    supportsModulesRequest: true,
    supportsLoadedSourcesRequest: true,
    supportsTerminateRequest: true,
    supportsSuspendDebuggee: true,
    supportsValueFormattingOptions: true,
    supportsFunctionBreakpoints: true,
  },
};

// ============================================================================
// DEBUG CONFIGURATION
// ============================================================================

export interface DebugConfiguration {
  type: DebugLanguage;
  name: string;
  request: 'launch' | 'attach';
  program?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  port?: number;
  host?: string;
  stopOnEntry?: boolean;
  noDebug?: boolean;
  preLaunchTask?: string;
  postDebugTask?: string;
}

// ============================================================================
// DEBUG TYPES
// ============================================================================

export interface Breakpoint {
  id: number;
  verified: boolean;
  line: number;
  column?: number;
  source: Source;
  message?: string;
  condition?: string;
  hitCondition?: string;
  logMessage?: string;
}

export interface Source {
  name?: string;
  path?: string;
  sourceReference?: number;
}

export interface StackFrame {
  id: number;
  name: string;
  source?: Source;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  moduleId?: string | number;
  presentationHint?: 'normal' | 'label' | 'subtle';
}

export interface Scope {
  name: string;
  variablesReference: number;
  namedVariables?: number;
  indexedVariables?: number;
  expensive: boolean;
  presentationHint?: 'arguments' | 'locals' | 'registers';
}

export interface Variable {
  name: string;
  value: string;
  type?: string;
  variablesReference: number;
  namedVariables?: number;
  indexedVariables?: number;
  evaluateName?: string;
  memoryReference?: string;
  presentationHint?: VariablePresentationHint;
}

export interface VariablePresentationHint {
  kind?: string;
  attributes?: string[];
  visibility?: 'public' | 'private' | 'protected' | 'internal' | 'final';
}

export interface Thread {
  id: number;
  name: string;
}

export type DebugState = 'idle' | 'initializing' | 'running' | 'paused' | 'stopped' | 'error';

// ============================================================================
// DEBUG EVENTS
// ============================================================================

export interface DebugEvents {
  initialized: void;
  stopped: { reason: string; threadId?: number; text?: string; allThreadsStopped?: boolean };
  continued: { threadId: number; allThreadsContinued?: boolean };
  exited: { exitCode: number };
  terminated: { restart?: boolean };
  thread: { reason: 'started' | 'exited'; threadId: number };
  output: { category: string; output: string; source?: Source; line?: number; column?: number };
  breakpoint: { reason: 'changed' | 'new' | 'removed'; breakpoint: Breakpoint };
  module: { reason: 'new' | 'changed' | 'removed'; module: unknown };
  loadedSource: { reason: 'new' | 'changed' | 'removed'; source: Source };
  process: { name: string; startMethod?: string; systemProcessId?: number };
  capabilities: unknown;
  progressStart: { progressId: string; title: string; cancellable?: boolean };
  progressUpdate: { progressId: string; message?: string; percentage?: number };
  progressEnd: { progressId: string; message?: string };
  invalidated: { areas?: string[]; threadId?: number; stackFrameId?: number };
  memory: { memoryReference: string; offset: number; count: number };
}

// ============================================================================
// UNIVERSAL DEBUG ADAPTER
// ============================================================================

/**
 * Universal Debug Adapter that supports all 30+ languages.
 * Automatically routes to the appropriate protocol (CDP, DAP, JDWP, custom).
 */
export class UniversalDebugAdapter extends EventEmitter {
  private language: DebugLanguage;
  private config: LanguageDebugConfig;
  private session: DebugSession | null = null;
  private debugProcess: ChildProcess | null = null;

  // Protocol clients
  private cdpClient: CDPClient | null = null;
  private dapClient: DAPClient | null = null;

  // State tracking
  private breakpointId = 0;
  private variablesReference = 0;
  private currentCallFrames: CDPCallFrame[] = [];
  private scopeToObjectId = new Map<number, string>();
  private frameIdToCallFrameId = new Map<number, string>();
  private variableReferenceMap = new Map<number, number>();

  constructor(language: DebugLanguage) {
    super();
    this.language = language;
    this.config = LANGUAGE_CONFIGS[language];

    if (!this.config) {
      throw new Error(`Unsupported language: ${language}`);
    }

    log.info('Universal debug adapter created', { language, name: this.config.name });
  }

  /**
   * Get supported capabilities for this language
   */
  getCapabilities(): Partial<LanguageDebugConfig> {
    return {
      supportsBreakpoints: this.config.supportsBreakpoints,
      supportsConditionalBreakpoints: this.config.supportsConditionalBreakpoints,
      supportsLogPoints: this.config.supportsLogPoints,
      supportsHitCount: this.config.supportsHitCount,
      supportsDataBreakpoints: this.config.supportsDataBreakpoints,
      supportsExceptionBreakpoints: this.config.supportsExceptionBreakpoints,
      supportsStepBack: this.config.supportsStepBack,
      supportsRestartFrame: this.config.supportsRestartFrame,
      supportsGotoTargets: this.config.supportsGotoTargets,
      supportsCompletionsRequest: this.config.supportsCompletionsRequest,
      supportsModulesRequest: this.config.supportsModulesRequest,
      supportsLoadedSourcesRequest: this.config.supportsLoadedSourcesRequest,
      supportsTerminateRequest: this.config.supportsTerminateRequest,
      supportsSuspendDebuggee: this.config.supportsSuspendDebuggee,
      supportsValueFormattingOptions: this.config.supportsValueFormattingOptions,
      supportsFunctionBreakpoints: this.config.supportsFunctionBreakpoints,
    };
  }

  /**
   * Initialize the debug adapter
   */
  async initialize(): Promise<void> {
    log.info('Initializing debug adapter', { language: this.language });
    this.emit('initialized');
  }

  /**
   * Launch a debug session
   */
  async launch(debugConfig: DebugConfiguration): Promise<void> {
    if (!debugConfig.program) {
      throw new Error('Program path required for debugging');
    }

    log.info('Launching debug session', {
      language: this.language,
      program: debugConfig.program,
    });

    this.session = {
      id: `${this.language}-${Date.now()}`,
      configuration: debugConfig,
      state: 'initializing',
      threads: [],
      breakpoints: new Map(),
    };

    // Compile if needed
    if (this.config.requiresCompilation && this.config.compileCommand) {
      log.info('Compiling program', { language: this.language });
      await this.compile(debugConfig);
    }

    // Install debug tools if needed
    if (this.config.installCommand) {
      log.info('Installing debug tools', { language: this.language });
      await this.installDebugTools();
    }

    // Launch based on protocol
    switch (this.config.protocol) {
      case 'cdp':
        await this.launchWithCDP(debugConfig);
        break;
      case 'dap':
        await this.launchWithDAP(debugConfig);
        break;
      case 'jdwp':
        await this.launchWithJDWP(debugConfig);
        break;
      case 'custom':
        await this.launchCustom(debugConfig);
        break;
    }

    this.session.state = 'running';
    this.emit('process', { name: debugConfig.program });
  }

  /**
   * Compile the program if needed
   */
  private async compile(config: DebugConfiguration): Promise<void> {
    if (!this.config.compileCommand) return;

    const command = this.config.compileCommand(config);
    log.info('Compiling', { command });

    return new Promise((resolve, reject) => {
      const proc = spawn('sh', ['-c', command], {
        cwd: config.cwd,
        env: { ...process.env, ...config.env },
      });

      proc.stdout?.on('data', (data) => {
        this.emit('output', { category: 'stdout', output: data.toString() });
      });

      proc.stderr?.on('data', (data) => {
        this.emit('output', { category: 'stderr', output: data.toString() });
      });

      proc.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Compilation failed with exit code ${code}`));
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * Install debug tools if needed
   */
  private async installDebugTools(): Promise<void> {
    if (!this.config.installCommand) return;

    const command = this.config.installCommand;
    log.info('Installing debug tools', { command });

    return new Promise((resolve, _reject) => {
      const proc = spawn('sh', ['-c', command], {
        env: process.env,
      });

      proc.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          // Don't fail if install fails - tools might already be installed
          log.warn('Debug tools installation returned non-zero', { code });
          resolve();
        }
      });

      proc.on('error', () => resolve()); // Ignore install errors
    });
  }

  /**
   * Launch with Chrome DevTools Protocol (Node.js)
   */
  private async launchWithCDP(config: DebugConfiguration): Promise<void> {
    const port = config.port || this.config.defaultPort;
    const host = config.host || '127.0.0.1';
    const command = this.config.debugCommand(config);

    log.info('Launching with CDP', { command, port });

    // Start the debug process
    this.debugProcess = spawn('sh', ['-c', command], {
      cwd: config.cwd,
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.setupProcessHandlers();

    // Wait for debugger to start, then connect
    await new Promise<void>((resolve) => {
      const checkOutput = (data: Buffer) => {
        const output = data.toString();
        if (output.includes('Debugger listening') || output.includes('ws://')) {
          setTimeout(resolve, 200);
        }
      };

      this.debugProcess!.stderr?.on('data', checkOutput);
      setTimeout(resolve, 3000); // Fallback timeout
    });

    // Connect CDP client
    this.cdpClient = new CDPClient();
    this.setupCDPEventHandlers();
    await this.cdpClient.connect(host, port);
  }

  /**
   * Launch with Debug Adapter Protocol
   */
  private async launchWithDAP(config: DebugConfiguration): Promise<void> {
    const port = config.port || this.config.defaultPort;
    const host = config.host || '127.0.0.1';
    const command = this.config.debugCommand(config);

    log.info('Launching with DAP', { command, port });

    // Start the debug process
    this.debugProcess = spawn('sh', ['-c', command], {
      cwd: config.cwd,
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.setupProcessHandlers();

    // Wait for debugger to start
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Connect DAP client
    this.dapClient = new DAPClient();
    this.setupDAPEventHandlers();
    await this.dapClient.connect(host, port);

    // Initialize and launch through DAP
    await this.dapClient.launch({
      program: config.program!,
      args: config.args,
      cwd: config.cwd,
      env: config.env,
      stopOnEntry: config.stopOnEntry,
    });
  }

  /**
   * Launch with Java Debug Wire Protocol
   */
  private async launchWithJDWP(config: DebugConfiguration): Promise<void> {
    const port = config.port || this.config.defaultPort;
    const command = this.config.debugCommand(config);

    log.info('Launching with JDWP', { command, port });

    // Start the debug process
    this.debugProcess = spawn('sh', ['-c', command], {
      cwd: config.cwd,
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.setupProcessHandlers();

    // JDWP is often wrapped in a DAP adapter, so we use DAP client
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Try to connect via DAP adapter (many JDWP implementations expose DAP)
    this.dapClient = new DAPClient();
    this.setupDAPEventHandlers();

    try {
      await this.dapClient.connect(config.host || '127.0.0.1', port);
    } catch (error) {
      log.warn('Could not connect via DAP, JDWP running in raw mode', error as Error);
    }
  }

  /**
   * Launch with custom protocol
   */
  private async launchCustom(config: DebugConfiguration): Promise<void> {
    const command = this.config.debugCommand(config);

    log.info('Launching with custom protocol', { command });

    this.debugProcess = spawn('sh', ['-c', command], {
      cwd: config.cwd,
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.setupProcessHandlers();

    // Custom protocols need specific handling
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  /**
   * Setup process event handlers
   */
  private setupProcessHandlers(): void {
    if (!this.debugProcess) return;

    this.debugProcess.stdout?.on('data', (data) => {
      this.emit('output', { category: 'stdout', output: data.toString() });
    });

    this.debugProcess.stderr?.on('data', (data) => {
      this.emit('output', { category: 'stderr', output: data.toString() });
    });

    this.debugProcess.on('exit', (code) => {
      this.cleanup();
      this.emit('exited', { exitCode: code || 0 });
      this.emit('terminated', { restart: false });
    });

    this.debugProcess.on('error', (error) => {
      log.error('Debug process error', error);
      this.cleanup();
      this.emit('terminated', { restart: false });
    });
  }

  /**
   * Setup CDP event handlers
   */
  private setupCDPEventHandlers(): void {
    if (!this.cdpClient) return;

    this.cdpClient.on(
      'Debugger.paused',
      (params: { callFrames: CDPCallFrame[]; reason: string }) => {
        this.currentCallFrames = params.callFrames;

        this.frameIdToCallFrameId.clear();
        params.callFrames.forEach((frame: CDPCallFrame, index: number) => {
          this.frameIdToCallFrameId.set(index + 1, frame.callFrameId);
        });

        if (this.session) {
          this.session.state = 'paused';
        }

        let reason = params.reason;
        if (reason === 'Break' || reason === 'breakpoint') reason = 'breakpoint';
        else if (reason === 'exception') reason = 'exception';
        else reason = 'step';

        this.emit('stopped', { reason, threadId: 1 });
      }
    );

    this.cdpClient.on('Debugger.resumed', () => {
      this.currentCallFrames = [];
      if (this.session) this.session.state = 'running';
      this.emit('continued', { threadId: 1 });
    });

    this.cdpClient.on(
      'Runtime.consoleAPICalled',
      (params: { type: string; args: Array<{ value?: unknown; description?: string }> }) => {
        const output = params.args.map((arg) => arg.value ?? arg.description ?? '').join(' ');
        this.emit('output', {
          category: params.type === 'error' ? 'stderr' : 'stdout',
          output: output + '\n',
        });
      }
    );

    this.cdpClient.on('disconnected', () => {
      this.cleanup();
    });
  }

  /**
   * Setup DAP event handlers
   */
  private setupDAPEventHandlers(): void {
    if (!this.dapClient) return;

    this.dapClient.on('stopped', (params: { reason: string; threadId?: number }) => {
      if (this.session) this.session.state = 'paused';
      this.emit('stopped', {
        reason: params.reason,
        threadId: params.threadId || 1,
      });
    });

    this.dapClient.on('continued', (params: { threadId: number }) => {
      if (this.session) this.session.state = 'running';
      this.emit('continued', { threadId: params.threadId });
    });

    this.dapClient.on('output', (params: { category?: string; output: string }) => {
      this.emit('output', {
        category: params.category || 'console',
        output: params.output,
      });
    });

    this.dapClient.on('exited', (params: { exitCode: number }) => {
      this.emit('exited', { exitCode: params.exitCode });
    });

    this.dapClient.on('terminated', () => {
      this.cleanup();
      this.emit('terminated', { restart: false });
    });

    this.dapClient.on('disconnected', () => {
      this.cleanup();
    });
  }

  /**
   * Attach to a running process
   */
  async attach(config: DebugConfiguration): Promise<void> {
    const port = config.port || this.config.defaultPort;
    const host = config.host || '127.0.0.1';

    log.info('Attaching to process', { language: this.language, host, port });

    this.session = {
      id: `${this.language}-attach-${Date.now()}`,
      configuration: config,
      state: 'running',
      threads: [],
      breakpoints: new Map(),
    };

    switch (this.config.protocol) {
      case 'cdp':
        this.cdpClient = new CDPClient();
        this.setupCDPEventHandlers();
        await this.cdpClient.connect(host, port);
        break;
      case 'dap':
      case 'jdwp':
        this.dapClient = new DAPClient();
        this.setupDAPEventHandlers();
        await this.dapClient.connect(host, port);
        break;
    }

    this.emit('process', { name: 'attached' });
  }

  /**
   * Disconnect from debuggee
   */
  async disconnect(): Promise<void> {
    log.info('Disconnecting', { language: this.language });

    if (this.dapClient) {
      try {
        await this.dapClient.disconnect(true);
      } catch {
        // Ignore disconnect errors
      }
    }

    this.cleanup();
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.cdpClient) {
      this.cdpClient.disconnect();
      this.cdpClient = null;
    }

    if (this.dapClient) {
      this.dapClient.removeAllListeners();
      this.dapClient = null;
    }

    if (this.debugProcess) {
      this.debugProcess.kill();
      this.debugProcess = null;
    }

    this.currentCallFrames = [];
    this.scopeToObjectId.clear();
    this.frameIdToCallFrameId.clear();
    this.variableReferenceMap.clear();
    this.session = null;
  }

  /**
   * Set breakpoints
   */
  async setBreakpoints(
    source: Source,
    breakpoints: Array<{
      line: number;
      column?: number;
      condition?: string;
      hitCondition?: string;
      logMessage?: string;
    }>
  ): Promise<Breakpoint[]> {
    if (!this.session || !source.path) return [];

    log.info('Setting breakpoints', {
      language: this.language,
      file: source.path,
      count: breakpoints.length,
    });

    if (this.cdpClient) {
      return this.setBreakpointsCDP(source, breakpoints);
    } else if (this.dapClient) {
      return this.setBreakpointsDAP(source, breakpoints);
    }

    return [];
  }

  private async setBreakpointsCDP(
    source: Source,
    breakpoints: Array<{ line: number; column?: number; condition?: string }>
  ): Promise<Breakpoint[]> {
    if (!this.cdpClient || !source.path) return [];

    const verified: Breakpoint[] = [];

    for (const bp of breakpoints) {
      try {
        const url = source.path.startsWith('file://') ? source.path : `file://${source.path}`;
        const result = await this.cdpClient.setBreakpointByUrl(
          url,
          bp.line - 1,
          bp.column ? bp.column - 1 : undefined,
          bp.condition
        );

        verified.push({
          id: ++this.breakpointId,
          verified: result.locations.length > 0,
          line: result.locations[0]?.lineNumber + 1 || bp.line,
          column: result.locations[0]?.columnNumber
            ? result.locations[0].columnNumber + 1
            : bp.column,
          source,
        });
      } catch (error) {
        verified.push({
          id: ++this.breakpointId,
          verified: false,
          line: bp.line,
          source,
          message: (error as Error).message,
        });
      }
    }

    return verified;
  }

  private async setBreakpointsDAP(
    source: Source,
    breakpoints: Array<{ line: number; column?: number; condition?: string }>
  ): Promise<Breakpoint[]> {
    if (!this.dapClient || !source.path) return [];

    try {
      const dapSource: DAPSource = { path: source.path, name: source.name };
      const dapBreakpoints = await this.dapClient.setBreakpoints(dapSource, breakpoints);

      return dapBreakpoints.map((bp, index) => ({
        id: bp.id || ++this.breakpointId,
        verified: bp.verified,
        line: bp.line || breakpoints[index].line,
        column: bp.column,
        source,
      }));
    } catch (error) {
      return breakpoints.map((bp) => ({
        id: ++this.breakpointId,
        verified: false,
        line: bp.line,
        source,
        message: (error as Error).message,
      }));
    }
  }

  // Execution control methods
  async continue(threadId: number = 1): Promise<void> {
    if (this.cdpClient) {
      await this.cdpClient.resume();
    } else if (this.dapClient) {
      await this.dapClient.continue(threadId);
    }
    if (this.session) this.session.state = 'running';
  }

  async stepOver(threadId: number = 1): Promise<void> {
    if (this.cdpClient) {
      await this.cdpClient.stepOver();
    } else if (this.dapClient) {
      await this.dapClient.next(threadId);
    }
  }

  async stepInto(threadId: number = 1): Promise<void> {
    if (this.cdpClient) {
      await this.cdpClient.stepInto();
    } else if (this.dapClient) {
      await this.dapClient.stepIn(threadId);
    }
  }

  async stepOut(threadId: number = 1): Promise<void> {
    if (this.cdpClient) {
      await this.cdpClient.stepOut();
    } else if (this.dapClient) {
      await this.dapClient.stepOut(threadId);
    }
  }

  async pause(threadId: number = 1): Promise<void> {
    if (this.cdpClient) {
      await this.cdpClient.pause();
    } else if (this.dapClient) {
      await this.dapClient.pause(threadId);
    }
    if (this.session) this.session.state = 'paused';
  }

  // Inspection methods
  async getThreads(): Promise<Thread[]> {
    if (this.cdpClient) {
      return [{ id: 1, name: 'Main Thread' }];
    } else if (this.dapClient) {
      const threads = await this.dapClient.threads();
      return threads.map((t) => ({ id: t.id, name: t.name }));
    }
    return [{ id: 1, name: 'Main Thread' }];
  }

  async getStackTrace(
    threadId: number = 1,
    startFrame?: number,
    levels?: number
  ): Promise<StackFrame[]> {
    if (this.cdpClient) {
      return this.getStackTraceCDP(startFrame, levels);
    } else if (this.dapClient) {
      return this.getStackTraceDAP(threadId, startFrame, levels);
    }
    return [];
  }

  private async getStackTraceCDP(startFrame?: number, levels?: number): Promise<StackFrame[]> {
    if (this.currentCallFrames.length === 0) return [];

    const start = startFrame || 0;
    const count = levels || this.currentCallFrames.length;
    const frames = this.currentCallFrames.slice(start, start + count);

    return frames.map((frame: CDPCallFrame, index: number) => {
      const script = this.cdpClient!.getScript(frame.location.scriptId);
      const url = frame.url || script?.url || '';
      const name = url.split('/').pop() || 'unknown';

      return {
        id: start + index + 1,
        name: frame.functionName || '<anonymous>',
        source: { path: url.replace('file://', ''), name },
        line: frame.location.lineNumber + 1,
        column: (frame.location.columnNumber || 0) + 1,
      };
    });
  }

  private async getStackTraceDAP(
    threadId: number,
    startFrame?: number,
    levels?: number
  ): Promise<StackFrame[]> {
    if (!this.dapClient) return [];

    try {
      const result = await this.dapClient.stackTrace(threadId, startFrame, levels);
      return result.stackFrames.map((frame: DAPStackFrame) => ({
        id: frame.id,
        name: frame.name,
        source: frame.source ? { path: frame.source.path, name: frame.source.name } : undefined,
        line: frame.line,
        column: frame.column,
        endLine: frame.endLine,
        endColumn: frame.endColumn,
      }));
    } catch {
      return [];
    }
  }

  async getScopes(frameId: number): Promise<Scope[]> {
    if (this.cdpClient) {
      return this.getScopesCDP(frameId);
    } else if (this.dapClient) {
      return this.getScopesDAP(frameId);
    }
    return [];
  }

  private async getScopesCDP(frameId: number): Promise<Scope[]> {
    const frame = this.currentCallFrames[frameId - 1];
    if (!frame) return [];

    const scopes: Scope[] = [];
    const scopeTypeMap: Record<string, string> = {
      global: 'Global',
      local: 'Local',
      with: 'With',
      closure: 'Closure',
      catch: 'Catch',
      block: 'Block',
      script: 'Script',
      eval: 'Eval',
      module: 'Module',
    };

    for (const cdpScope of frame.scopeChain) {
      const varRef = ++this.variablesReference;
      if (cdpScope.object.objectId) {
        this.scopeToObjectId.set(varRef, cdpScope.object.objectId);
      }

      scopes.push({
        name: scopeTypeMap[cdpScope.type] || cdpScope.type,
        variablesReference: varRef,
        expensive: cdpScope.type === 'global',
      });
    }

    return scopes;
  }

  private async getScopesDAP(frameId: number): Promise<Scope[]> {
    if (!this.dapClient) return [];

    try {
      const scopes = await this.dapClient.scopes(frameId);
      return scopes.map((scope: DAPScope) => {
        const localRef = ++this.variablesReference;
        this.variableReferenceMap.set(localRef, scope.variablesReference);

        return {
          name: scope.name,
          variablesReference: localRef,
          namedVariables: scope.namedVariables,
          indexedVariables: scope.indexedVariables,
          expensive: scope.expensive,
        };
      });
    } catch {
      return [];
    }
  }

  async getVariables(variablesReference: number): Promise<Variable[]> {
    if (this.cdpClient) {
      return this.getVariablesCDP(variablesReference);
    } else if (this.dapClient) {
      return this.getVariablesDAP(variablesReference);
    }
    return [];
  }

  private async getVariablesCDP(variablesReference: number): Promise<Variable[]> {
    if (!this.cdpClient) return [];

    const objectId = this.scopeToObjectId.get(variablesReference);
    if (!objectId) return [];

    try {
      const properties = await this.cdpClient.getProperties(objectId, true, true);
      return properties
        .filter((prop: CDPPropertyDescriptor) => prop.enumerable || prop.isOwn)
        .map((prop: CDPPropertyDescriptor) => {
          const value = prop.value;
          let varRef = 0;

          if (value?.objectId && (value.type === 'object' || value.type === 'function')) {
            varRef = ++this.variablesReference;
            this.scopeToObjectId.set(varRef, value.objectId);
          }

          return {
            name: prop.name,
            value: this.formatCDPValue(value),
            type: value?.type || 'undefined',
            variablesReference: varRef,
          };
        });
    } catch {
      return [];
    }
  }

  private formatCDPValue(obj?: CDPRemoteObject): string {
    if (!obj) return 'undefined';
    if (obj.type === 'undefined') return 'undefined';
    if (obj.type === 'string') return `"${obj.value}"`;
    if (obj.type === 'number' || obj.type === 'boolean') return String(obj.value);
    if (obj.type === 'function') return obj.description || 'function';
    if (obj.type === 'object') {
      if (obj.subtype === 'null') return 'null';
      return obj.description || 'Object';
    }
    return obj.description || String(obj.value);
  }

  private async getVariablesDAP(variablesReference: number): Promise<Variable[]> {
    if (!this.dapClient) return [];

    const dapRef = this.variableReferenceMap.get(variablesReference) || variablesReference;

    try {
      const variables = await this.dapClient.variables(dapRef);
      return variables.map((v: DAPVariable) => {
        let localRef = 0;
        if (v.variablesReference > 0) {
          localRef = ++this.variablesReference;
          this.variableReferenceMap.set(localRef, v.variablesReference);
        }

        return {
          name: v.name,
          value: v.value,
          type: v.type,
          variablesReference: localRef,
          namedVariables: v.namedVariables,
          indexedVariables: v.indexedVariables,
        };
      });
    } catch {
      return [];
    }
  }

  async evaluate(
    expression: string,
    frameId?: number,
    context?: 'watch' | 'repl' | 'hover'
  ): Promise<{ result: string; type?: string; variablesReference: number }> {
    if (this.cdpClient) {
      return this.evaluateCDP(expression, frameId);
    } else if (this.dapClient) {
      return this.evaluateDAP(expression, frameId, context);
    }
    return { result: 'Not connected', variablesReference: 0 };
  }

  private async evaluateCDP(
    expression: string,
    frameId?: number
  ): Promise<{ result: string; type?: string; variablesReference: number }> {
    if (!this.cdpClient) throw new Error('Not connected');

    try {
      let evalResult;
      if (frameId && this.frameIdToCallFrameId.has(frameId)) {
        const callFrameId = this.frameIdToCallFrameId.get(frameId)!;
        evalResult = await this.cdpClient.evaluateOnCallFrame(callFrameId, expression);
      } else {
        evalResult = await this.cdpClient.evaluate(expression);
      }

      if (evalResult.exceptionDetails) {
        return {
          result: `Error: ${evalResult.exceptionDetails.text}`,
          type: 'error',
          variablesReference: 0,
        };
      }

      let varRef = 0;
      if (evalResult.result.objectId && evalResult.result.type === 'object') {
        varRef = ++this.variablesReference;
        this.scopeToObjectId.set(varRef, evalResult.result.objectId);
      }

      return {
        result: this.formatCDPValue(evalResult.result),
        type: evalResult.result.type,
        variablesReference: varRef,
      };
    } catch (error) {
      return { result: `Error: ${(error as Error).message}`, type: 'error', variablesReference: 0 };
    }
  }

  private async evaluateDAP(
    expression: string,
    frameId?: number,
    context?: 'watch' | 'repl' | 'hover'
  ): Promise<{ result: string; type?: string; variablesReference: number }> {
    if (!this.dapClient) throw new Error('Not connected');

    try {
      const result = await this.dapClient.evaluate(expression, frameId, context);

      let localRef = 0;
      if (result.variablesReference > 0) {
        localRef = ++this.variablesReference;
        this.variableReferenceMap.set(localRef, result.variablesReference);
      }

      return {
        result: result.result,
        type: result.type,
        variablesReference: localRef,
      };
    } catch (error) {
      return { result: `Error: ${(error as Error).message}`, type: 'error', variablesReference: 0 };
    }
  }

  // Getters
  getSession(): DebugSession | null {
    return this.session;
  }

  getState(): DebugState {
    return this.session?.state || 'idle';
  }

  getLanguage(): DebugLanguage {
    return this.language;
  }

  getLanguageConfig(): LanguageDebugConfig {
    return this.config;
  }
}

// ============================================================================
// DEBUG SESSION TYPE
// ============================================================================

interface DebugSession {
  id: string;
  configuration: DebugConfiguration;
  state: DebugState;
  threads: Thread[];
  breakpoints: Map<string, Breakpoint[]>;
  currentThread?: number;
  currentFrame?: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get supported languages
 */
export function getSupportedLanguages(): DebugLanguage[] {
  return Object.keys(LANGUAGE_CONFIGS) as DebugLanguage[];
}

/**
 * Get language configuration
 */
export function getLanguageConfig(language: DebugLanguage): LanguageDebugConfig | undefined {
  return LANGUAGE_CONFIGS[language];
}

/**
 * Detect language from file extension
 */
export function detectLanguageFromFile(filePath: string): DebugLanguage | undefined {
  const ext = '.' + filePath.split('.').pop()?.toLowerCase();

  for (const [language, config] of Object.entries(LANGUAGE_CONFIGS)) {
    if (config.fileExtensions.includes(ext)) {
      return language as DebugLanguage;
    }
  }

  return undefined;
}

/**
 * Create a debug adapter for a language
 */
export function createUniversalDebugAdapter(language: DebugLanguage): UniversalDebugAdapter {
  return new UniversalDebugAdapter(language);
}

/**
 * Get all language display names
 */
export function getLanguageDisplayNames(): Record<DebugLanguage, string> {
  const names: Partial<Record<DebugLanguage, string>> = {};

  for (const [language, config] of Object.entries(LANGUAGE_CONFIGS)) {
    names[language as DebugLanguage] = config.name;
  }

  return names as Record<DebugLanguage, string>;
}

/**
 * Get language capabilities summary
 */
export function getLanguageCapabilitiesSummary(): Array<{
  language: DebugLanguage;
  name: string;
  protocol: string;
  capabilities: string[];
}> {
  return Object.entries(LANGUAGE_CONFIGS).map(([language, config]) => {
    const capabilities: string[] = [];

    if (config.supportsBreakpoints) capabilities.push('Breakpoints');
    if (config.supportsConditionalBreakpoints) capabilities.push('Conditional Breakpoints');
    if (config.supportsLogPoints) capabilities.push('Log Points');
    if (config.supportsDataBreakpoints) capabilities.push('Data Breakpoints');
    if (config.supportsExceptionBreakpoints) capabilities.push('Exception Breakpoints');
    if (config.supportsStepBack) capabilities.push('Step Back');
    if (config.supportsRestartFrame) capabilities.push('Restart Frame');
    if (config.supportsCompletionsRequest) capabilities.push('Code Completion');

    return {
      language: language as DebugLanguage,
      name: config.name,
      protocol: config.protocol.toUpperCase(),
      capabilities,
    };
  });
}

log.info('Multi-language debug adapters loaded', {
  languageCount: Object.keys(LANGUAGE_CONFIGS).length,
  languages: Object.keys(LANGUAGE_CONFIGS),
});
