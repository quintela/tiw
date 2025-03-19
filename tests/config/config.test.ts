// We need to set up mocks before imports
import { jest } from '@jest/globals';
// Now import modules after mocking
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { Config, type ConfigOptions, type GitPlatform, type LLMProvider } from '@/config/config';
import { GitDetector } from '@/utils/gitDetector';

// Create mock for git operations
const mockGetRemotes = jest.fn().mockResolvedValue([]);
const mockRevparse = jest.fn().mockResolvedValue('');
const mockCheckIsRepo = jest.fn().mockResolvedValue(true);

// Mock simple-git which is used by GitDetector
jest.mock('simple-git', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getRemotes: mockGetRemotes,
    revparse: mockRevparse,
    checkIsRepo: mockCheckIsRepo,
  })),
}));

// Mock path module
jest.mock('node:path', () => ({
  join: (...args: string[]) => args.join('/'),
}));

// Create mock GitDetector
const mockDetectGitPlatform = jest.fn();
jest.mock('@/utils/gitDetector', () => ({
  GitDetector: jest.fn().mockImplementation(() => ({
    detectGitPlatform: mockDetectGitPlatform,
  })),
}));
// Set default mock return value for each test
mockDetectGitPlatform.mockResolvedValue(null);

// Create mock Logger
const mockInfo = jest.fn();
const mockWarn = jest.fn();
const mockDebug = jest.fn();
const mockError = jest.fn();
jest.mock('@/utils/logging', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: mockInfo,
    warn: mockWarn,
    debug: mockDebug,
    error: mockError,
  })),
}));

describe('Config', () => {
  // Store original process.env and process.cwd
  const originalEnv = { ...process.env };
  const originalCwd = process.cwd;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Reset process.env
    process.env = { ...originalEnv };

    // Mock process.cwd
    process.cwd = jest.fn().mockReturnValue('/test/dir');
  });

  afterEach(() => {
    // Restore process.env and process.cwd
    process.env = originalEnv;
    process.cwd = originalCwd;
  });

  describe('constructor', () => {
    describe('when initialized with default options', () => {
      it('should create a valid Config instance', () => {
        const config = new Config();
        expect(config).toBeInstanceOf(Config);
      });

      it('should not throw any errors', () => {
        expect(() => new Config()).not.toThrow();
      });
    });

    describe('when initialized with custom options', () => {
      it('should accept llmProvider option', () => {
        const options: ConfigOptions = {
          llmProvider: 'openai',
        };

        const config = new Config(options);
        expect(config).toBeInstanceOf(Config);
      });

      it('should accept gitPlatform option', () => {
        const options: ConfigOptions = {
          gitPlatform: 'github',
        };

        const config = new Config(options);
        expect(config).toBeInstanceOf(Config);
      });

      it('should accept multiple options', () => {
        const options: ConfigOptions = {
          llmProvider: 'openai',
          gitPlatform: 'github',
          showDiff: true,
        };

        const config = new Config(options);
        expect(config).toBeInstanceOf(Config);
      });
    });
  });

  describe('load', () => {
    describe('when git platform is not specified', () => {
      it('should try to auto-detect git platform', async () => {
        const config = new Config();
        await config.load();

        expect(GitDetector).toHaveBeenCalled();
        expect(mockDetectGitPlatform).toHaveBeenCalled();
      });

      it('should use detected platform if available', async () => {
        mockDetectGitPlatform.mockResolvedValueOnce({
          platform: 'github',
          url: 'https://github.com/testuser/testrepo',
          owner: 'testuser',
          repo: 'testrepo',
        });

        const config = new Config();
        const result = await config.load();

        expect(result.gitPlatform).toBe('github');
      });

      it('should keep default if detection fails', async () => {
        mockDetectGitPlatform.mockResolvedValueOnce(null);

        const config = new Config();
        const result = await config.load();

        // The default platform depends on the implementation
        expect(result.gitPlatform).toBeDefined();
      });
    });

    describe('when git platform is specified', () => {
      it('should not attempt auto-detection', async () => {
        const config = new Config({ gitPlatform: 'github' });
        await config.load();

        const mockGitDetector = GitDetector as jest.MockedFunction<typeof GitDetector>;
        const mockInstance = mockGitDetector.mock.results[0].value;
        expect(mockInstance.detectGitPlatform).not.toHaveBeenCalled();
      });

      it('should keep the specified platform', async () => {
        const config = new Config({ gitPlatform: 'gitlab' });
        const result = await config.load();

        expect(result.gitPlatform).toBe('gitlab');
      });
    });

    describe('when merging options with defaults', () => {
      it('should override defaults with provided options', async () => {
        const options: ConfigOptions = {
          llmProvider: 'openai',
          model: 'gpt-4-turbo',
          showDiff: true,
        };

        const config = new Config(options);
        const result = await config.load();

        expect(result.llmProvider).toBe('openai');
        expect(result.showDiff).toBe(true);
      });

      it('should keep defaults for unspecified options', async () => {
        const options: ConfigOptions = {
          llmProvider: 'openai',
        };

        const config = new Config(options);
        const result = await config.load();

        expect(result.llmProvider).toBe('openai');
        expect(result.reviewsDir).toBeDefined();
      });
    });
  });

  describe('validate', () => {
    describe('when using Anthropic provider', () => {
      it('should validate with API key in options', async () => {
        const config = new Config({
          llmProvider: 'anthropic',
          anthropicApiKey: 'test-key',
        });

        await config.load();

        expect(() => config.validate()).not.toThrow();
      });

      it('should validate with API key in environment', async () => {
        process.env.ANTHROPIC_API_KEY = 'env-test-key';

        const config = new Config({ llmProvider: 'anthropic' });
        await config.load();

        expect(() => config.validate()).not.toThrow();
      });

      it('should throw for missing API key', async () => {
        // Clear the API key in the environment
        delete process.env.ANTHROPIC_API_KEY;

        const config = new Config({ llmProvider: 'anthropic' });
        await config.load();

        expect(() => config.validate()).toThrow(/required but not set/);
      });
    });

    describe('when using OpenAI provider', () => {
      it('should validate with API key in options', async () => {
        const config = new Config({
          llmProvider: 'openai',
          openaiApiKey: 'test-key',
        });

        await config.load();

        expect(() => config.validate()).not.toThrow();
      });

      it('should validate with API key in environment', async () => {
        process.env.OPENAI_API_KEY = 'env-test-key';

        const config = new Config({ llmProvider: 'openai' });
        await config.load();

        expect(() => config.validate()).not.toThrow();
      });

      it('should throw for missing API key', async () => {
        const config = new Config({ llmProvider: 'openai' });
        await config.load();

        expect(() => config.validate()).toThrow(/required but not set/);
      });
    });
  });
});
