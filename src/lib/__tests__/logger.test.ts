import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { log, logInfo, logError } from '../logger.js';

describe('Logger', () => {
  let output: string[];
  const originalWrite = process.stdout.write;

  beforeEach(() => {
    output = [];
    process.stdout.write = vi.fn((chunk: string | Uint8Array) => {
      output.push(chunk.toString());
      return true;
    }) as typeof process.stdout.write;
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
  });

  function getLastEntry(): Record<string, unknown> {
    return JSON.parse(output[output.length - 1]);
  }

  describe('Acceptance Tests', () => {
    it('AT-1: produces valid JSON with timestamp, level, event, and context fields', () => {
      log('INFO', 'app.startup', { port: 3000, projectDir: '/app' });

      const entry = getLastEntry();
      expect(entry.timestamp).toBeDefined();
      expect(entry.level).toBe('INFO');
      expect(entry.event).toBe('app.startup');
      expect(entry.port).toBe(3000);
      expect(entry.projectDir).toBe('/app');
    });

    it('AT-1b: produces valid JSON for ERROR level', () => {
      log('ERROR', 'llm.generation_failed', { kitId: 'eek', error: 'timeout' });

      const entry = getLastEntry();
      expect(entry.level).toBe('ERROR');
      expect(entry.event).toBe('llm.generation_failed');
      expect(entry.kitId).toBe('eek');
      expect(entry.error).toBe('timeout');
    });

    it('AT-2: redacts fields named apiKey', () => {
      log('INFO', 'test.event', { apiKey: 'sk-12345' });

      const entry = getLastEntry();
      expect(entry.apiKey).toBe('[REDACTED]');
    });

    it('AT-2b: redacts fields named secret', () => {
      log('INFO', 'test.event', { secret: 'my-secret-value' });

      const entry = getLastEntry();
      expect(entry.secret).toBe('[REDACTED]');
    });
  });

  describe('Failure Tests', () => {
    it('FT-1: output is valid JSON', () => {
      log('INFO', 'test.event', { data: 'value' });

      expect(() => JSON.parse(output[0])).not.toThrow();
    });

    it('FT-2: secrets are never present in plain text', () => {
      log('INFO', 'test.event', {
        apiKey: 'sk-secret-key',
        userToken: 'bearer-token-123',
        password: 'p@ssw0rd',
      });

      const raw = output[0];
      expect(raw).not.toContain('sk-secret-key');
      expect(raw).not.toContain('bearer-token-123');
      expect(raw).not.toContain('p@ssw0rd');
    });

    it('FT-3: handles undefined context gracefully', () => {
      log('INFO', 'test.event');

      const entry = getLastEntry();
      expect(entry.timestamp).toBeDefined();
      expect(entry.level).toBe('INFO');
      expect(entry.event).toBe('test.event');
    });
  });

  describe('Edge Case Tests', () => {
    it('EC-1: timestamp is valid ISO-8601', () => {
      log('INFO', 'test.event');

      const entry = getLastEntry();
      const timestamp = entry.timestamp as string;
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('EC-2: requestId is included when provided', () => {
      log('INFO', 'test.event', { requestId: 'req-123' });

      const entry = getLastEntry();
      expect(entry.requestId).toBe('req-123');
    });

    it('EC-3: empty context produces valid JSON with only base fields', () => {
      log('INFO', 'test.event', {});

      const entry = getLastEntry();
      expect(Object.keys(entry)).toEqual(
        expect.arrayContaining(['timestamp', 'level', 'event']),
      );
    });

    it('EC-4: multiple calls produce separate newline-delimited lines', () => {
      log('INFO', 'event.one');
      log('ERROR', 'event.two');

      expect(output).toHaveLength(2);
      expect(output[0].endsWith('\n')).toBe(true);
      expect(output[1].endsWith('\n')).toBe(true);
      expect(JSON.parse(output[0]).event).toBe('event.one');
      expect(JSON.parse(output[1]).event).toBe('event.two');
    });

    it('EC-5: redaction is case-insensitive', () => {
      log('INFO', 'test.event', { ApiKey: 'val', SECRET: 'val', Password: 'val' });

      const entry = getLastEntry();
      expect(entry.ApiKey).toBe('[REDACTED]');
      expect(entry.SECRET).toBe('[REDACTED]');
      expect(entry.Password).toBe('[REDACTED]');
    });

    it('EC-6: redacts fields with secret patterns as substrings', () => {
      log('INFO', 'test.event', {
        llmApiKey: 'val',
        mySecretValue: 'val',
        authToken: 'val',
        userCredential: 'val',
      });

      const entry = getLastEntry();
      expect(entry.llmApiKey).toBe('[REDACTED]');
      expect(entry.mySecretValue).toBe('[REDACTED]');
      expect(entry.authToken).toBe('[REDACTED]');
      expect(entry.userCredential).toBe('[REDACTED]');
    });

    it('EC-7: redacts nested object secret fields', () => {
      log('INFO', 'test.event', {
        config: { apiKey: 'nested-secret', name: 'visible' },
      });

      const entry = getLastEntry();
      const config = entry.config as Record<string, unknown>;
      expect(config.apiKey).toBe('[REDACTED]');
      expect(config.name).toBe('visible');
    });

    it('EC-8: non-secret fields are not redacted', () => {
      log('INFO', 'test.event', {
        kitId: 'pik',
        stepId: 'wcr',
        port: 3000,
      });

      const entry = getLastEntry();
      expect(entry.kitId).toBe('pik');
      expect(entry.stepId).toBe('wcr');
      expect(entry.port).toBe(3000);
    });

    it('EC-9: handles null context values', () => {
      log('INFO', 'test.event', { data: null });

      const entry = getLastEntry();
      expect(entry.data).toBeNull();
    });
  });

  describe('Convenience Wrappers', () => {
    it('logInfo uses INFO level', () => {
      logInfo('app.startup', { port: 3000 });

      const entry = getLastEntry();
      expect(entry.level).toBe('INFO');
      expect(entry.event).toBe('app.startup');
    });

    it('logError uses ERROR level', () => {
      logError('llm.generation_failed', { error: 'timeout' });

      const entry = getLastEntry();
      expect(entry.level).toBe('ERROR');
      expect(entry.event).toBe('llm.generation_failed');
    });
  });

  describe('TDD §7 Log Events', () => {
    it('covers app.startup event', () => {
      logInfo('app.startup', { port: 3000, kitIds: ['pik', 'eek'], projectDir: '/project' });
      const entry = getLastEntry();
      expect(entry.event).toBe('app.startup');
      expect(entry.port).toBe(3000);
      expect(entry.kitIds).toEqual(['pik', 'eek']);
      expect(entry.projectDir).toBe('/project');
    });

    it('covers app.shutdown event', () => {
      logInfo('app.shutdown');
      expect(getLastEntry().event).toBe('app.shutdown');
    });

    it('covers kit.loaded event', () => {
      logInfo('kit.loaded', { kitId: 'pik', stepCount: 5, kitPath: '/kits/pik' });
      const entry = getLastEntry();
      expect(entry.kitId).toBe('pik');
      expect(entry.stepCount).toBe(5);
    });

    it('covers llm.generation_completed event', () => {
      logInfo('llm.generation_completed', {
        kitId: 'eek', stepId: 'acf', inputTokens: 1000, outputTokens: 2000, durationMs: 5000,
      });
      const entry = getLastEntry();
      expect(entry.inputTokens).toBe(1000);
      expect(entry.outputTokens).toBe(2000);
      expect(entry.durationMs).toBe(5000);
    });

    it('covers artifact.frozen event', () => {
      logInfo('artifact.frozen', { kitId: 'eek', stepId: 'acf', artifactId: 'ACF-CONSOLE-001' });
      const entry = getLastEntry();
      expect(entry.artifactId).toBe('ACF-CONSOLE-001');
    });

    it('covers state.transition event', () => {
      logInfo('state.transition', { kitId: 'eek', stepId: 'acf', from: 'draft', to: 'validated-pass' });
      const entry = getLastEntry();
      expect(entry.from).toBe('draft');
      expect(entry.to).toBe('validated-pass');
    });

    it('covers error event with stack (server-side only)', () => {
      logError('error', { requestId: 'req-1', error: 'Something failed', stack: 'Error: ...' });
      const entry = getLastEntry();
      expect(entry.requestId).toBe('req-1');
      expect(entry.error).toBe('Something failed');
      expect(entry.stack).toBe('Error: ...');
    });
  });
});
