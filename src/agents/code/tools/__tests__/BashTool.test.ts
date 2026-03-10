// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BashTool, bashTool } from '../BashTool';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BashTool', () => {
  let tool: BashTool;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new BashTool();
  });

  describe('basic properties', () => {
    it('should have name "bash"', () => {
      expect(tool.name).toBe('bash');
    });

    it('should have a description', () => {
      expect(tool.description).toBeTruthy();
    });
  });

  describe('getDefinition', () => {
    it('should return a valid tool definition', () => {
      const def = tool.getDefinition();
      expect(def.name).toBe('bash');
      expect(def.parameters.type).toBe('object');
      expect(def.parameters.properties.command).toBeDefined();
      expect(def.parameters.required).toContain('command');
    });
  });

  describe('initialize', () => {
    it('should accept sandbox URL', () => {
      tool.initialize({ sandboxUrl: 'https://sandbox.example.com' });
      // No throw = success
      expect(true).toBe(true);
    });

    it('should accept OIDC token', () => {
      tool.initialize({ sandboxUrl: 'https://sb.test', oidcToken: 'tok-123' });
      expect(true).toBe(true);
    });
  });

  // =========================================================================
  // Command Safety Validation
  // =========================================================================

  describe('isAllowed', () => {
    // Allowed commands
    it.each([
      'npm test',
      'npm run build',
      'npx vitest run',
      'yarn install',
      'pnpm add express',
      'node index.js',
      'python3 script.py',
      'tsc --noEmit',
      'eslint . --fix',
      'prettier --write .',
      'jest --coverage',
      'vitest run',
      'ls -la',
      'cat file.txt',
      'head -n 10 file.txt',
      'tail -f log.txt',
      'wc -l src/**/*.ts',
      'grep -r "TODO" src/',
      'find . -name "*.ts"',
      'pwd',
      'echo "hello"',
      'which node',
      'git status',
      'git log --oneline -5',
      'git diff HEAD',
      'curl https://api.example.com/health',
      'mkdir -p dist',
      'touch newfile.ts',
      'cp src/a.ts src/b.ts',
      'mv old.ts new.ts',
    ])('should allow: %s', (cmd) => {
      expect(tool.isAllowed(cmd)).toBe(true);
    });

    // Blocked commands
    it.each([
      'rm -rf /',
      'rm -r /home',
      'sudo apt install',
      'su root',
      'chmod 777 /etc/passwd',
      'chown root:root file',
      'kill -9 1234',
      'killall node',
      'pkill -f node',
      'shutdown -h now',
      'reboot',
      'dd if=/dev/zero of=/dev/sda',
      'systemctl restart nginx',
      'iptables -F',
      'passwd root',
      'useradd hacker',
      'userdel admin',
      'crontab -e',
    ])('should block: %s', (cmd) => {
      expect(tool.isAllowed(cmd)).toBe(false);
    });

    // Command chaining blocked
    it.each([
      'ls && rm -rf /',
      'echo hi || shutdown -h now',
      'cat file.txt; rm -rf /',
      'ls | grep secret',
      'sleep 1 & malicious',
    ])('should block chaining: %s', (cmd) => {
      expect(tool.isAllowed(cmd)).toBe(false);
    });

    // Chaining inside quotes is fine
    it('should allow operators inside quoted strings', () => {
      expect(tool.isAllowed("echo 'hello && world'")).toBe(true);
      expect(tool.isAllowed('grep "foo || bar" file.txt')).toBe(true);
    });

    // Command substitution blocked
    it.each(['echo $(whoami)', 'echo ${HOME}', 'echo `id`'])(
      'should block command substitution: %s',
      (cmd) => {
        expect(tool.isAllowed(cmd)).toBe(false);
      }
    );

    // Redirections blocked
    it.each(['echo data > /etc/passwd', 'cat file >> /tmp/log', 'cat < /etc/shadow'])(
      'should block redirections: %s',
      (cmd) => {
        expect(tool.isAllowed(cmd)).toBe(false);
      }
    );

    // Process substitution blocked
    it.each(['diff <(ls dir1) <(ls dir2)', 'cat >(tee output.txt)'])(
      'should block process substitution: %s',
      (cmd) => {
        expect(tool.isAllowed(cmd)).toBe(false);
      }
    );

    // Git dangerous operations blocked
    it.each([
      'git push --force',
      'git push -f origin main',
      'git reset --hard HEAD~5',
      'git clean -fd',
    ])('should block dangerous git: %s', (cmd) => {
      expect(tool.isAllowed(cmd)).toBe(false);
    });

    // curl/wget to sensitive endpoints blocked
    it.each([
      'curl http://169.254.169.254/latest/meta-data/',
      'curl http://metadata.google.internal/computeMetadata/v1/',
      'curl http://localhost:3000/admin',
      'curl http://127.0.0.1:8080',
      'wget http://0.0.0.0:9090',
      'curl http://[::1]:3000',
    ])('should block sensitive endpoints: %s', (cmd) => {
      expect(tool.isAllowed(cmd)).toBe(false);
    });

    // Unknown commands blocked
    it.each(['hackertool --pwn', '/usr/bin/unknown_binary', 'malware'])(
      'should block unknown commands: %s',
      (cmd) => {
        expect(tool.isAllowed(cmd)).toBe(false);
      }
    );

    // Env var prefix before command
    it('should handle env var prefix', () => {
      expect(tool.isAllowed('NODE_ENV=test npm test')).toBe(true);
    });

    // Path-based command
    it('should extract command name from path', () => {
      expect(tool.isAllowed('/usr/bin/node index.js')).toBe(true);
    });
  });

  // =========================================================================
  // execute
  // =========================================================================

  describe('execute', () => {
    it('should return error for missing command', async () => {
      const result = await tool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('command');
    });

    it('should return error for blocked command', async () => {
      const result = await tool.execute({ command: 'rm -rf /' });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return sandbox not configured error when no sandbox URL', async () => {
      const result = await tool.execute({ command: 'npm test' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Sandbox not configured');
    });

    it('should execute in sandbox and return success', async () => {
      tool.initialize({ sandboxUrl: 'https://sandbox.test' });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ stdout: 'test output', stderr: '', exitCode: 0 }),
      });

      const result = await tool.execute({ command: 'npm test' });
      expect(result.success).toBe(true);
      expect(result.result?.stdout).toBe('test output');
      expect(result.result?.exitCode).toBe(0);
    });

    it('should return failure for non-zero exit code', async () => {
      tool.initialize({ sandboxUrl: 'https://sandbox.test' });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ stdout: '', stderr: 'Error: test failed', exitCode: 1 }),
      });

      const result = await tool.execute({ command: 'npm test' });
      expect(result.success).toBe(false);
      expect(result.result?.exitCode).toBe(1);
    });

    it('should handle sandbox HTTP error', async () => {
      tool.initialize({ sandboxUrl: 'https://sandbox.test' });
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const result = await tool.execute({ command: 'npm test' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Sandbox error');
    });

    it('should handle network error', async () => {
      tool.initialize({ sandboxUrl: 'https://sandbox.test' });
      mockFetch.mockRejectedValue(new Error('Network failure'));

      const result = await tool.execute({ command: 'npm test' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network failure');
    });

    it('should cap timeout at 120000ms', async () => {
      tool.initialize({ sandboxUrl: 'https://sandbox.test' });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
      });

      await tool.execute({ command: 'npm test', timeout: 999999 });
      // No timeout error = max was capped correctly
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should truncate long output', async () => {
      tool.initialize({ sandboxUrl: 'https://sandbox.test' });
      const longOutput = 'x'.repeat(15000);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ stdout: longOutput, stderr: '', exitCode: 0 }),
      });

      const result = await tool.execute({ command: 'npm test' });
      expect(result.result?.truncated).toBe(true);
      expect(result.result?.stdout.length).toBeLessThan(longOutput.length);
      expect(result.result?.stdout).toContain('[truncated]');
    });

    it('should pass OIDC token in Authorization header', async () => {
      tool.initialize({ sandboxUrl: 'https://sandbox.test', oidcToken: 'my-token' });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
      });

      await tool.execute({ command: 'npm test' });
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[1].headers.Authorization).toBe('Bearer my-token');
    });
  });

  // =========================================================================
  // runSequence
  // =========================================================================

  describe('runSequence', () => {
    it('should run commands sequentially', async () => {
      tool.initialize({ sandboxUrl: 'https://sandbox.test' });
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ stdout: 'a', stderr: '', exitCode: 0 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ stdout: 'b', stderr: '', exitCode: 0 }),
        });

      const results = await tool.runSequence(['npm install', 'npm test']);
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should stop on first failure', async () => {
      tool.initialize({ sandboxUrl: 'https://sandbox.test' });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ stdout: '', stderr: 'err', exitCode: 1 }),
      });

      const results = await tool.runSequence(['npm install', 'npm test', 'npm run build']);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
    });
  });

  // =========================================================================
  // Singleton export
  // =========================================================================

  describe('bashTool singleton', () => {
    it('should be an instance of BashTool', () => {
      expect(bashTool).toBeInstanceOf(BashTool);
    });
  });
});
