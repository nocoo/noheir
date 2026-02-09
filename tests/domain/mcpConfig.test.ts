import { describe, expect, it } from 'bun:test';
import { buildMcpConfigJson, getMcpProjectPath } from '../../src/domain/settings/mcpConfig';

describe('mcpConfig domain', () => {
  describe('getMcpProjectPath', () => {
    it('returns a non-empty string', () => {
      const path = getMcpProjectPath();
      expect(path).toBeTruthy();
      expect(typeof path).toBe('string');
    });
  });

  describe('buildMcpConfigJson', () => {
    it('generates valid config JSON with given refresh token', () => {
      const result = buildMcpConfigJson({
        refreshToken: 'test-refresh-token-123',
        supabaseUrl: 'http://127.0.0.1:54321',
        supabaseAnonKey: 'test-anon-key',
        projectPath: '/path/to/project',
      });

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('mcpServers');
      expect(parsed.mcpServers).toHaveProperty('noheir');
      expect(parsed.mcpServers.noheir.command).toBe('bun');
      expect(parsed.mcpServers.noheir.args).toContain('run');
      expect(parsed.mcpServers.noheir.args).toContain('/path/to/project/mcp/src/index.ts');
      expect(parsed.mcpServers.noheir.env.SUPABASE_URL).toBe('http://127.0.0.1:54321');
      expect(parsed.mcpServers.noheir.env.SUPABASE_ANON_KEY).toBe('test-anon-key');
      expect(parsed.mcpServers.noheir.env.SUPABASE_REFRESH_TOKEN).toBe('test-refresh-token-123');
    });

    it('produces pretty-printed JSON with 2-space indent', () => {
      const result = buildMcpConfigJson({
        refreshToken: 'tok',
        supabaseUrl: 'http://localhost',
        supabaseAnonKey: 'key',
        projectPath: '/p',
      });

      // Should have indented lines
      expect(result).toContain('  ');
      // Should be parseable
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('handles empty refresh token', () => {
      const result = buildMcpConfigJson({
        refreshToken: '',
        supabaseUrl: 'http://localhost',
        supabaseAnonKey: 'key',
        projectPath: '/p',
      });

      const parsed = JSON.parse(result);
      expect(parsed.mcpServers.noheir.env.SUPABASE_REFRESH_TOKEN).toBe('');
    });
  });
});
