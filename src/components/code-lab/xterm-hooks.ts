'use client';

import { useRef, useState, useCallback } from 'react';
import type { XTermTerminalRef } from './xterm-types';

export function useXTermTerminal(sessionId: string, sandboxId?: string) {
  const terminalRef = useRef<XTermTerminalRef>(null);
  const [commandBuffer, setCommandBuffer] = useState('');

  const executeCommand = useCallback(
    async (command: string) => {
      if (!command.trim()) return;

      terminalRef.current?.writeln(`\x1b[32m$ \x1b[0m${command}`);

      try {
        const response = await fetch('/api/code-lab/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            sandboxId,
            command,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          terminalRef.current?.writeln(
            `\x1b[31mError: ${error.message || 'Command failed'}\x1b[0m`
          );
        } else {
          const result = await response.json();
          if (result.stdout) {
            terminalRef.current?.write(result.stdout);
          }
          if (result.stderr) {
            terminalRef.current?.write(`\x1b[31m${result.stderr}\x1b[0m`);
          }
        }
      } catch (err) {
        terminalRef.current?.writeln(
          `\x1b[31mError: ${err instanceof Error ? err.message : 'Unknown error'}\x1b[0m`
        );
      }

      terminalRef.current?.write('\x1b[32m$ \x1b[0m');
    },
    [sessionId, sandboxId]
  );

  const handleData = useCallback(
    (data: string) => {
      if (data === '\r') {
        executeCommand(commandBuffer);
        setCommandBuffer('');
        return;
      }

      if (data === '\x7f') {
        if (commandBuffer.length > 0) {
          setCommandBuffer((prev) => prev.slice(0, -1));
          terminalRef.current?.write('\b \b');
        }
        return;
      }

      if (data === '\x03') {
        setCommandBuffer('');
        terminalRef.current?.writeln('^C');
        terminalRef.current?.write('\x1b[32m$ \x1b[0m');
        return;
      }

      if (data === '\x0c') {
        terminalRef.current?.clear();
        terminalRef.current?.write('\x1b[32m$ \x1b[0m');
        return;
      }

      if (data >= ' ' || data === '\t') {
        setCommandBuffer((prev) => prev + data);
        terminalRef.current?.write(data);
      }
    },
    [commandBuffer, executeCommand]
  );

  return {
    terminalRef,
    handleData,
    executeCommand,
  };
}
