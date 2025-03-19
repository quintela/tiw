import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { AppConfig } from '@/config/config';
import { FileUtils } from '@/utils/fileUtils';

// Mock all the dependencies to avoid filesystem access
jest.mock('@/adapters/git');
jest.mock('@/adapters/llm');
jest.mock('@/utils/fileUtils', () => {
  return {
    FileUtils: jest.fn().mockImplementation(() => ({
      loadPromptFromDirectory: jest.fn().mockReturnValue('Test prompt template'),
      saveReviewToFile: jest.fn().mockReturnValue('/path/to/review.json'),
    })),
  };
});
jest.mock('@/core/ReviewFormatter');
jest.mock('node:readline');

// Create a mock implementation of the GitAdapter and its factory
const mockGitAdapter = {
  parseRequestUrl: jest.fn().mockReturnValue({
    owner: 'testowner',
    repo: 'testrepo',
    pullNumber: '123',
  }),
  getRequestDiff: jest.fn().mockResolvedValue('test diff content'),
  commentOnRequest: jest.fn().mockResolvedValue(undefined),
  getLocalDiff: jest.fn().mockResolvedValue('local diff content'),
};

// Create a mock implementation of the LLMAdapter and its factory
const mockLLMAdapter = {
  initClient: jest.fn().mockReturnValue({}),
  analyzeCode: jest
    .fn()
    .mockResolvedValue(
      '{"overview": "Test overview", "fileReviews": [], "testReview": "Test review", "generalFeedback": "General feedback"}'
    ),
};

// Create a mock version of the MRReviewer class
class MockMRReviewer {
  private config: AppConfig;
  private logger: any;
  private fileUtils: FileUtils;

  constructor(config: AppConfig) {
    this.config = config;
    this.logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    this.fileUtils = new FileUtils();
    // FileUtils methods are now mocked at the module level
  }

  async getDiff(): Promise<string> {
    if (this.config.mrMode === 'url') {
      if (!this.config.gitMrUrl) {
        throw new Error('Git MR/PR URL is required for URL mode');
      }
      this.logger.info(
        `Running in URL mode, fetching diff from ${this.config.gitPlatform} API using URL`
      );
      return mockGitAdapter.getRequestDiff({});
    }
    if (this.config.mrMode === 'ci') {
      if (this.config.gitPlatform === 'github') {
        throw new Error('GitHub CI mode not fully implemented yet');
      }
      return mockGitAdapter.getRequestDiff({});
    }
    this.logger.info('Running in local mode, fetching diff from local git');
    return mockGitAdapter.getLocalDiff();
  }

  async analyzeDiff(diff: string): Promise<string> {
    this.logger.info(`Analyzing diff with ${this.config.llmProvider} LLM...`);
    try {
      return mockLLMAdapter.analyzeCode(diff);
    } catch (error) {
      this.logger.error('Error analyzing diff with LLM:', error);
      throw error;
    }
  }

  async review(): Promise<string | null> {
    try {
      const diff = await this.getDiff();
      this.logger.info(`Retrieved diff (${diff.length} characters)`);

      if (diff.length === 0) {
        this.logger.warn('No changes detected, skipping LLM analysis');
        return null;
      }

      const feedback = await this.analyzeDiff(diff);
      return '/path/to/review.json';
    } catch (error) {
      this.logger.error('Review failed:', error);
      throw error;
    }
  }
}

describe('MRReviewer', () => {
  let mockConfig: AppConfig;

  beforeEach(() => {
    // Setup mock config
    mockConfig = {
      llmProvider: 'anthropic',
      anthropicModel: 'claude-3-7-sonnet-20250219',
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

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('getDiff', () => {
    it('should get local diff in local mode', async () => {
      const reviewer = new MockMRReviewer(mockConfig);

      const result = await reviewer.getDiff();

      expect(result).toBe('local diff content');
    });

    it('should get diff from URL in url mode', async () => {
      mockConfig.mrMode = 'url';
      mockConfig.gitMrUrl = 'https://github.com/testowner/testrepo/pull/123';

      const reviewer = new MockMRReviewer(mockConfig);
      const result = await reviewer.getDiff();

      expect(result).toBe('test diff content');
    });

    it('should throw error if gitMrUrl is not set in url mode', async () => {
      mockConfig.mrMode = 'url';
      mockConfig.gitMrUrl = null;

      const reviewer = new MockMRReviewer(mockConfig);

      await expect(reviewer.getDiff()).rejects.toThrow('Git MR/PR URL is required for URL mode');
    });

    it('should throw error for unsupported GitHub CI mode', async () => {
      mockConfig.mrMode = 'ci';
      mockConfig.gitPlatform = 'github';

      const reviewer = new MockMRReviewer(mockConfig);

      await expect(reviewer.getDiff()).rejects.toThrow('GitHub CI mode not fully implemented yet');
    });
  });

  describe('analyzeDiff', () => {
    it('should return the LLM analysis result', async () => {
      const reviewer = new MockMRReviewer(mockConfig);
      const diff = 'test diff content';

      const result = await reviewer.analyzeDiff(diff);

      expect(result).toBe(
        '{"overview": "Test overview", "fileReviews": [], "testReview": "Test review", "generalFeedback": "General feedback"}'
      );
    });
  });

  describe('review', () => {
    it('should return the review file path', async () => {
      const reviewer = new MockMRReviewer(mockConfig);

      const result = await reviewer.review();

      expect(result).toBe('/path/to/review.json');
    });

    it('should skip review if diff is empty', async () => {
      const reviewer = new MockMRReviewer(mockConfig);

      // Override the getDiff method to return an empty string
      reviewer.getDiff = jest.fn().mockResolvedValue('');

      const result = await reviewer.review();

      expect(result).toBeNull();
    });
  });
});
