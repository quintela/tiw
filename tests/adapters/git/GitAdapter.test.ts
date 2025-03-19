// Mocks must be defined before imports
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock setup
const mockExecSync = jest.fn(() => Buffer.from('test diff content'));
jest.mock('node:child_process', () => ({
  execSync: mockExecSync,
}));
import type { AppConfig } from '@/config/config';
import { GitAdapter } from '@/adapters/git/GitAdapter';

// Create a concrete implementation of the abstract class for testing
class TestGitAdapter extends GitAdapter {
  parseRequestUrl(_url: string): Record<string, string> {
    return { url: _url };
  }

  async getRequestDiff(_params: Record<string, string>): Promise<string> {
    return 'test diff';
  }

  async commentOnRequest(_params: Record<string, string>, _comment: string): Promise<void> {
    // Implementation not needed for testing
  }
}

describe('GitAdapter', () => {
  // Mock console methods
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.log = jest.fn();
    console.error = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    jest.clearAllMocks();
  });

  const mockConfig = {
    llmProvider: 'anthropic',
    anthropicModel: 'claude-3',
    openaiModel: 'gpt-4',
    deepseekModel: 'deepseek-coder',
    copilotModel: 'gpt-4',
    anthropicApiKey: 'test-key',
    openaiApiKey: undefined,
    deepseekApiKey: undefined,
    copilotApiKey: undefined,
    gitPlatform: 'github',
    gitlabUrl: 'https://gitlab.com',
    gitlabToken: undefined,
    githubToken: 'test-token',
    projectId: undefined,
    mergeRequestIid: undefined,
    mrMode: 'local',
    gitMrUrl: null,
    showDiff: false,
    reviewsDir: '/reviews',
    promptDir: '/prompts',
    formatterTemplate: '/formatters/template.md',
  } as AppConfig;

  describe('constructor', () => {
    describe('when instantiated directly', () => {
      it('should throw an error', () => {
        expect(() => {
          // @ts-expect-error Testing constructor error
          new GitAdapter(mockConfig);
        }).toThrow('GitAdapter is an abstract class and cannot be instantiated directly');
      });
    });

    describe('when extended properly', () => {
      it('should allow instantiation of derived class', () => {
        expect(() => {
          new TestGitAdapter(mockConfig);
        }).not.toThrow();
      });

      it('should store config in instance', () => {
        const adapter = new TestGitAdapter(mockConfig);
        // Using any to access protected property for testing
        expect((adapter as any).config).toBe(mockConfig);
      });
    });
  });

  describe('getLocalDiff', () => {
    // Make sure execSync is properly mocked for these tests
    it('should execute git diff command with default branch from remote', async () => {
      // Set up the mock for git fetch
      mockExecSync.mockImplementationOnce(() => Buffer.from(''));
      // Set up the mock for git branch -r
      mockExecSync.mockImplementationOnce(() =>
        Buffer.from('  origin/HEAD -> origin/develop\n  origin/develop\n  origin/feature')
      );
      // Set up the mock for fetch of default branch
      mockExecSync.mockImplementationOnce(() => Buffer.from(''));
      // Set up the mock for branch verification
      mockExecSync.mockImplementationOnce(() => Buffer.from(''));
      // Set up the mock for diff command
      mockExecSync.mockImplementationOnce(() => Buffer.from('test diff content'));

      const adapter = new TestGitAdapter(mockConfig);
      await adapter.getLocalDiff();

      // Should fetch from origin first
      expect(mockExecSync).toHaveBeenNthCalledWith(1, 'git fetch origin --prune', {
        stdio: 'ignore',
      });
      // Should get the branch listing
      expect(mockExecSync).toHaveBeenNthCalledWith(2, 'git branch -r');
      // Should fetch the default branch
      expect(mockExecSync).toHaveBeenNthCalledWith(3, 'git fetch origin develop:develop', {
        stdio: 'ignore',
      });
      // Should check if branch exists
      expect(mockExecSync).toHaveBeenNthCalledWith(4, 'git rev-parse --verify develop', {
        stdio: 'ignore',
      });
      // Then should get diff
      expect(mockExecSync).toHaveBeenNthCalledWith(5, 'git diff develop...HEAD');
    });

    it('should use specified target branch', async () => {
      // Set up the mock
      mockExecSync.mockImplementation(() => Buffer.from('test diff content'));

      const adapter = new TestGitAdapter(mockConfig);
      await adapter.getLocalDiff('develop');

      // Should check if branch exists first
      expect(mockExecSync).toHaveBeenNthCalledWith(1, 'git rev-parse --verify develop', {
        stdio: 'ignore',
      });
      // Then should get diff
      expect(mockExecSync).toHaveBeenNthCalledWith(2, 'git diff develop...HEAD');
    });

    it('should use staged changes in CI mode', async () => {
      // Set up the mock
      mockExecSync.mockImplementation(() => Buffer.from('test diff content'));

      // Create config with CI mode
      const ciConfig = { ...mockConfig, mrMode: 'ci' };
      const adapter = new TestGitAdapter(ciConfig);

      await adapter.getLocalDiff();

      expect(mockExecSync).toHaveBeenCalledWith('git diff --staged');
    });

    it('should throw if target branch does not exist', async () => {
      // Make the branch check fail
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('Branch not found');
      });

      const adapter = new TestGitAdapter(mockConfig);

      await expect(adapter.getLocalDiff('nonexistent')).rejects.toThrow(
        "Target branch 'nonexistent' does not exist"
      );
    });

    it('should use fallback if empty string is provided', async () => {
      // Set up the mock for git fetch
      mockExecSync.mockImplementationOnce(() => Buffer.from(''));
      // Set up the mock for git branch -r
      mockExecSync.mockImplementationOnce(() =>
        Buffer.from('  origin/HEAD -> origin/main\n  origin/main\n  origin/feature')
      );
      // Set up the mock for fetch of default branch
      mockExecSync.mockImplementationOnce(() => Buffer.from(''));
      // Set up the mock for branch verification
      mockExecSync.mockImplementationOnce(() => Buffer.from(''));
      // Set up the mock for diff command
      mockExecSync.mockImplementationOnce(() => Buffer.from('test diff content'));

      const adapter = new TestGitAdapter(mockConfig);
      const result = await adapter.getLocalDiff('');

      // Should fetch from origin first
      expect(mockExecSync).toHaveBeenNthCalledWith(1, 'git fetch origin --prune', {
        stdio: 'ignore',
      });
      // Should get the branch listing
      expect(mockExecSync).toHaveBeenNthCalledWith(2, 'git branch -r');
      expect(result).toBe('test diff content');
    });

    it('should convert buffer output to string', async () => {
      // Set up the mock
      mockExecSync.mockImplementation(() => Buffer.from('test diff content'));

      const adapter = new TestGitAdapter(mockConfig);
      const result = await adapter.getLocalDiff();

      expect(result).toBe('test diff content');
    });

    it('should log error message to console when git command fails', async () => {
      // Set up the mock for git fetch
      mockExecSync.mockImplementationOnce(() => Buffer.from(''));
      // Set up the mock for git branch -r
      mockExecSync.mockImplementationOnce(() =>
        Buffer.from('  origin/HEAD -> origin/main\n  origin/main\n  origin/feature')
      );
      // Set up the mock for fetch of default branch
      mockExecSync.mockImplementationOnce(() => Buffer.from(''));
      // Set up the mock for branch verification
      mockExecSync.mockImplementationOnce(() => Buffer.from('')); // Branch exists check

      // Then throw error on the diff command
      const testError = new Error('Command failed');
      mockExecSync.mockImplementationOnce(() => {
        throw testError;
      });

      // Set up spy on console.error
      const errorSpy = jest.spyOn(console, 'error');

      const adapter = new TestGitAdapter(mockConfig);

      try {
        await adapter.getLocalDiff();
      } catch (_error) {
        // Expected to throw
      }

      expect(errorSpy).toHaveBeenCalledWith('Error getting local git diff:', 'Command failed');

      // Reset the mock for subsequent tests
      mockExecSync.mockImplementation(() => Buffer.from('test diff content'));
    });
  });
});
